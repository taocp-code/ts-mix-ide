import {MIX_WORD_SIZE, MixWord} from "../mix-word.ts";
import {MixEmulator, MixMemory} from "../mix-emulator.ts";
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
                if (offset + i >= MixMemory.SIZE) {
                    return Promise.reject(new Error(`Reading invalid addr ${offset + i}.`));
                } else {
                    words.push(memory.load(offset + i));
                }
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
export const consoleTextSink: MixTextSink = async (text) => {
    return new Promise((resolve) => {
        const delayMs = 10;
        setTimeout(() => {
            console.log(text);
            resolve();
        }, delayMs);
    });
};

/**
 * A text source that feeds the reader line by line.
 * @param lines
 */
export function createTextSource(lines: string[]): MixTextSource {
    const buffer = lines.join('');
    let i = 0;
    return async (n: number): Promise<string> => {
        if (i >= buffer.length) {
            return ' '.repeat(n);
        }
        const s = buffer.slice(i, Math.min(i + n, buffer.length)).padEnd(n, ' ');
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
    waitUntilReady: (waitMs?: number) => Promise<void>;
    waitUntilBusy: (waitMs?: number) => Promise<void>;
    ioc: (m: number, rX: number) => Promise<void>;
    read: (rX: number, sink: MixWordSink) => Promise<void>;
    write: (rX: number, words: MixWordSource) => Promise<void>;
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

    async read(rX: number, sink: MixWordSink): Promise<void> {
        if (!this.canRead) {
            return Promise.reject(new Error(`Device ${this.type} doesn't support read operation.`));
        }
        const words = await this.readInternal(rX);
        await sink(words);
    }

    async write(rX: number, words: MixWordSource): Promise<void> {
        if (!this.canWrite) {
            return Promise.reject(new Error(`Device ${this.type} doesn't support write operation.`));
        }
        await this.writeInternal(rX, words);
    }

    async ioc(m: number, rX: number): Promise<void> {
        await this._iocHandler(m, rX);
    }

    async waitUntilReady(waitMs: number = 5): Promise<void> {
        return this.waitBusyFlag(false, waitMs)
    }

    async waitUntilBusy(waitMs: number = 5): Promise<void> {
        return this.waitBusyFlag(true, waitMs);
    }

    protected async waitBusyFlag(target: boolean, waitMs: number): Promise<void> {
        if (this._busy === target) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(this.waitBusyFlag(target, waitMs));
            }, waitMs);
        });
    }

    protected readInternal(_rX: number): Promise<MixWord[]> {
        return Promise.reject(new Error(`Read not supported on ${this.type}`));
    }

    protected writeInternal(_rX: number, _words: MixWordSource): Promise<void> {
        return Promise.reject(new Error(`Write not supported on ${this.type}`));
    }

    set busy(v: boolean) {
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
}

async function readWordsFromTextSource(textSource: MixTextSource, blockSize: number): Promise<MixWord[]> {
    const text = await textSource(blockSize * MIX_WORD_SIZE);
    if (text.length !== blockSize * MIX_WORD_SIZE) throw new Error(`Card reader expects ${blockSize * MIX_WORD_SIZE} characters.`);
    const bytes = encodeToMixBytes(text);
    const words: MixWord[] = [];
    for (let w = 0; w < blockSize; w++) {
        words.push(MixWord.fromBytes(bytes.slice(w * MIX_WORD_SIZE, w * MIX_WORD_SIZE + MIX_WORD_SIZE)));
    }
    return words;
}

async function writeWordsToTextSink(wordSource: MixWordSource, blockSize: number, textSink: MixTextSink): Promise<void> {
    const data = await wordSource(blockSize);
    if (data.length !== blockSize) {
        throw new Error(`Device expects ${blockSize} words.`);
    }
    const line = mixWordToText(data);
    await textSink(line);
}

function mixWordToText(data: MixWord[]) {
    return data.map(word => decodeToMixChars(word.bytes.slice(1))).join('');
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

    async writeInternal(_: number, src: MixWordSource): Promise<void> {
        return writeWordsToTextSink(src, this.blockSize, this._textSink);
    }
}

export class CardReader extends AbstractMixDevice {
    private readonly _textSource: MixTextSource;

    constructor(textSource: MixTextSource) {
        super(MixDeviceType.CARD_READER, 16, MixDeviceMode.READ_ONLY);
        this._textSource = textSource;
    }

    async readInternal(): Promise<MixWord[]> {
        return readWordsFromTextSource(this._textSource, this.blockSize);
    }
}

export class CardPuncher extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;

    constructor(textSink: MixTextSink) {
        super(MixDeviceType.CARD_PUNCHER, 16, MixDeviceMode.WRITE_ONLY);
        this._textSink = textSink;
    }

    async writeInternal(_: number, src: MixWordSource): Promise<void> {
        await writeWordsToTextSink(src, this.blockSize, this._textSink);
    }
}

export class TeletypeWriter extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;
    private readonly _textSource: MixTextSource;

    constructor(textSink: MixTextSink, textSource: MixTextSource) {
        super(MixDeviceType.TYPEWRITER, 14, MixDeviceMode.READ_WRITE);
        this._textSink = textSink;
        this._textSource = textSource;
    }

    protected async readInternal(): Promise<MixWord[]> {
        return readWordsFromTextSource(this._textSource, this.blockSize);
    }

    protected async writeInternal(_: number, src: MixWordSource): Promise<void> {
        return writeWordsToTextSink(src, this.blockSize, this._textSink);
    }
}
