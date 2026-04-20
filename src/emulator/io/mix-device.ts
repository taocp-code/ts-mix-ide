import {MIX_WORD_SIZE, MixWord} from "../mix-word.ts";
import {MixEmulator} from "../mix-emulator.ts";
import {decodeToMixChars, encodeToMixBytes} from "../mix-chars.ts";

export enum MixDeviceType {
    TAPE = "TAPE",
    DISK = "DISK",
    CARD_READER = "CARD_READER",
    CARD_PUNCHER = "CARD_PUNCHER",
    PRINTER = "PRINTER",
    TYPEWRITER = "TYPEWRITER",
    PAPER_TAPE = "PAPER_TAPE",
}

export enum MixDeviceMode {
    READ_ONLY = 1,
    WRITE_ONLY = 2,
    READ_WRITE = READ_ONLY | WRITE_ONLY,
}

/**
 * A source of MixWords, read n words from a source.
 */
export type MixWordSource = (n: number) => Promise<MixWord[]>;

/**
 * A source of Mix text, read n characters (5 characters makes a mix word).
 */
export type MixTextSource = (n: number) => Promise<string>;

/**
 * A sink for output text data, used by printers, tty and card punchers
 */
export type MixTextSink = (text: string) => Promise<void>;

/**
 * A sink for output binary data
 */
export type MixWordSink = (data: MixWord[]) => Promise<void>;

/**
 * IocHandler: handles IOC requests
 */
export type IocHandler = (m: number, rX: number) => Promise<void>;

export function createMixMemoryWordSource(mix: MixEmulator, offset: number): MixWordSource {
    return (n: number) => {
        try {
            const memory = mix.memory;
            const words: MixWord[] = [];
            for (let i = 0; i < n; i++) {
                words.push(memory.load(offset + i));
            }
            return Promise.resolve(words);
        } catch (err) {
            return Promise.reject(err);
        }
    };
}

/**
 * Simple text sink that prints to console.
 * @param text
 */
export const consoleTextSink: MixTextSink = (text) => {
    console.log(text);
    return Promise.resolve();
};

/**
 * A text source that feeds the reader line by line.
 * @param lines
 */
export function createTextSource(lines: string[]): MixTextSource {
    const buffer = lines.join('');
    let i = 0;
    return async (n: number): Promise<string> => {
        if (i + n > buffer.length){
            throw new Error(`Buffer exhausted, not enough data, reading ${n}, available ${buffer.length - i}.`);
        }
        const s = buffer.slice(i, i + n);
        i = i + n;
        return s;
    }
}

/**
 * A mix device has a type, block size (in words), busy flag, mode (ReadOnly, WriteOnly, or RW) and three operations
 */
export interface MixDevice {
    type: MixDeviceType;
    blockSize: number;
    busy: boolean;
    mode: MixDeviceMode;
    ioc: (m: number, rX: number) => Promise<void>;
    read: (rX: number) => Promise<MixWord[]>;
    write: (rX: number, words: MixWordSource) => Promise<void>;
}

export async function sleep(millis: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(undefined);
        }, millis);
    });
}

export abstract class AbstractMixDevice implements MixDevice {
    private readonly _type: MixDeviceType;
    private readonly _blockSize: number;
    private readonly _mode: MixDeviceMode;
    private readonly _iocHandler: IocHandler;
    private _busy: boolean;

    constructor(type: MixDeviceType, blockSize: number, mode: MixDeviceMode, iocHandler: IocHandler = () => Promise.resolve()) {
        this._type = type;
        this._blockSize = blockSize;
        this._mode = mode;
        this._iocHandler = iocHandler;
        this._busy = false;
    }

    async read(rX: number): Promise<MixWord[]> {
        if (!this.canRead) {
            return Promise.reject(new Error(`Device ${this.type} doesn't support read operation.`));
        }
        await this.waitWhileBusy();
        this.busy = true;
        return this.readInternal(rX).finally(() => this.busy = false);
    }

    async write(rX: number, words: MixWordSource): Promise<void> {
        if (!this.canWrite) {
            return Promise.reject(new Error(`Device ${this.type} doesn't support write operation.`));
        }
        await this.waitWhileBusy();
        this.busy = true;
        return this.writeInternal(rX, words).finally(() => this.busy = false);
    }

    async ioc(m: number, rX: number): Promise<void> {
        await this.waitWhileBusy();
        this.busy = true;
        return this._iocHandler(m, rX).finally(() => this.busy = false);
    }

    protected abstract readInternal(rX: number): Promise<MixWord[]>;

    protected abstract writeInternal(rX: number, words: MixWordSource): Promise<void>;

    protected set busy(v: boolean) {
        this._busy = v;
    }

    get type(): MixDeviceType {
        return this._type;
    }

    get blockSize(): number {
        return this._blockSize;
    }

    get busy(): boolean {
        return this._busy;
    }

    get mode(): MixDeviceMode {
        return this._mode;
    }

    get canRead(): boolean {
        return this.mode !== MixDeviceMode.WRITE_ONLY;
    }

    get canWrite(): boolean {
        return this.mode !== MixDeviceMode.READ_ONLY;
    }

    private async waitWhileBusy() {
        while (this.busy) await sleep(5);
    }
}

function mixWordToText(data: MixWord[]) {
    return data.map(word => decodeToMixChars(word.bytes)).join('');
}

export class MixPrinter extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;

    constructor(textSink: MixTextSink, onNewPage: () => Promise<void>) {
        super(MixDeviceType.PRINTER, 24, MixDeviceMode.WRITE_ONLY,
            (m) => {
                if (m !== 0) {
                    return Promise.reject(new Error("m must be zero for printer IOC."));
                }
                return onNewPage();
            });
        this._textSink = textSink;
    }

    readInternal(): Promise<MixWord[]> {
        return Promise.reject(new Error("Cannot read from printers."));
    }

    async writeInternal(_: number, src: MixWordSource): Promise<void> {
        const data = await src(this.blockSize);
        if (data.length !== this.blockSize) {
            throw new Error(`Printer expects ${this.blockSize} words.`);
        }
        const line = mixWordToText(data);
        await this._textSink(line);
    }
}

export class CardReader extends AbstractMixDevice {
    private readonly _textSource: MixTextSource;

    constructor(textSource: MixTextSource) {
        super(MixDeviceType.CARD_READER, 16, MixDeviceMode.READ_ONLY);
        this._textSource = textSource;
    }

    async readInternal(): Promise<MixWord[]> {
        const text = await this._textSource(this.blockSize * MIX_WORD_SIZE);
        if (text.length !== this.blockSize * MIX_WORD_SIZE) throw new Error(`Card reader expects ${this.blockSize * MIX_WORD_SIZE} characters.`);
        const bytes = encodeToMixBytes(text);
        const words: MixWord[] = [];
        for (let w = 0; w < this.blockSize; w++) {
            words.push(MixWord.fromBytes(bytes.slice(w * MIX_WORD_SIZE, w * MIX_WORD_SIZE + MIX_WORD_SIZE)));
        }
        return words;
    }

    protected writeInternal(): Promise<void> {
        return Promise.reject(new Error("Cannot write to Card Reader."));
    }
}

export class CardPuncher extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;

    constructor(textSink: MixTextSink) {
        super(MixDeviceType.CARD_PUNCHER, 16, MixDeviceMode.WRITE_ONLY);
        this._textSink = textSink;
    }

    async writeInternal(_: number, src: MixWordSource): Promise<void> {
        const data = await src(this.blockSize);
        if (data.length !== this.blockSize) {
            throw new Error(`Printer expects ${this.blockSize} words.`);
        }
        const line = mixWordToText(data);
        await this._textSink(line);
    }

    protected readInternal(): Promise<MixWord[]> {
        return Promise.reject(new Error("Cannot read from Card Puncher."));
    }
}