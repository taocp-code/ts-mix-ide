import {MIX_WORD_SIZE, MixWord} from "../mix-word.ts";
import {MixEmulator, MixMemory} from "../mix-emulator.ts";
import {decodeToMixChars, encodeToMixBytes} from "../mix-chars.ts";

export const PRINTER = "PRINTER";
export const TAPE = "TAPE";
export const DISK = "DISK";
export const CARD_READER = "CARD_READER";
export const CARD_PUNCHER = "CARD_PUNCHER";
export const TYPE_WRITER = "TYPE_WRITER";
export const PAPER_TAPE = "PAPER_TAPE";
export const MIX_DEVICE_TYPES: MixDeviceType[] = [
    PRINTER,
    TAPE,
    DISK,
    CARD_READER,
    CARD_PUNCHER,
    TYPE_WRITER,
    PAPER_TAPE
];
export type MixDeviceType = typeof TAPE
    | typeof DISK
    | typeof CARD_READER
    | typeof CARD_PUNCHER
    | typeof PRINTER
    | typeof TYPE_WRITER
    | typeof PAPER_TAPE;

export interface MixDeviceConfig {
    blockSize: number;
    idStart: number;
    idEnd: number;
}

export const MixDeviceConfigs: Record<MixDeviceType, MixDeviceConfig> = {
    TAPE: {
        blockSize: 100,
        idStart: 0,
        idEnd: 7,
    },
    DISK: {
        blockSize: 100,
        idStart: 8,
        idEnd: 15,
    },
    CARD_READER: {
        blockSize: 16,
        idStart: 16,
        idEnd: 16,
    },
    CARD_PUNCHER: {
        blockSize: 16,
        idStart: 17,
        idEnd: 17,
    },
    PRINTER: {
        blockSize: 24,
        idStart: 18,
        idEnd: 18,
    },
    TYPE_WRITER: {
        blockSize: 14,
        idStart: 19,
        idEnd: 19,
    },
    PAPER_TAPE: {
        blockSize: 14,
        idStart: 20,
        idEnd: 20,
    },
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
    id?: number;
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
    private _id?: number;
    private _busy: boolean;

    constructor(type: MixDeviceType, blockSize: number, mode: MixDeviceMode, iocHandler: IocHandler = () => Promise.resolve()) {
        this._type = type;
        this._blockSize = blockSize;
        this._mode = mode;
        this._iocHandler = iocHandler;
        this._id = undefined;
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

    get id(): number | undefined {
        return this._id;
    }

    set id(v: number | undefined) {
        this._id = v;
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

export class LinePrinter extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;

    constructor(textSink: MixTextSink, onIoc: IocHandler) {
        super(PRINTER, MixDeviceConfigs[PRINTER].blockSize, MixDeviceMode.WRITE_ONLY,
            (m, rX) => {
                if (m !== 0) {
                    return Promise.reject(new Error("m must be zero for printer IOC."));
                }
                return onIoc(m, rX);
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
        super(CARD_READER, 16, MixDeviceMode.READ_ONLY);
        this._textSource = textSource;
    }

    async readInternal(): Promise<MixWord[]> {
        return readWordsFromTextSource(this._textSource, this.blockSize);
    }
}

export class CardPuncher extends AbstractMixDevice {
    private readonly _textSink: MixTextSink;

    constructor(textSink: MixTextSink) {
        super(CARD_PUNCHER, 16, MixDeviceMode.WRITE_ONLY);
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
        super(TYPE_WRITER, 14, MixDeviceMode.READ_WRITE);
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

export type DeviceRegistry = Record<number, MixDevice>;

export type RegisterDeviceFn = (device: MixDevice) => number;

export type UnregisterDeviceFn = (device: MixDevice) => void;

export interface MixDeviceEntry {
    id: number;
    device: MixDevice;
}

export class MixDeviceRegistry implements DeviceRegistry {
    [x: number]: MixDevice;

    private readonly _mixDeviceIds: Record<MixDeviceType, number[]> = {
        CARD_PUNCHER: [], CARD_READER: [], DISK: [], PAPER_TAPE: [], PRINTER: [], TAPE: [], TYPE_WRITER: []

    };
    private _devices: MixDeviceEntry[];

    constructor() {
        this._devices = [];
        for (const type of MIX_DEVICE_TYPES) {
            const config = MixDeviceConfigs[type];
            for (let i = config.idStart; i <= config.idEnd; i++) {
                this._mixDeviceIds[type].push(i);
            }
        }
    }

    register(device: MixDevice): number {
        if (this.alreadyRegistered(device)) {
            console.log(`Device `, device, ' already registered.');
            return -1;
        }
        const id = this.nextId(device.type);
        if (id === undefined) return -1;
        this[id] = device;
        device.id = id;
        this._devices.push({id, device});
        return id;
    }

    unregister(device: MixDevice): void {
        const entry = this._devices.find((entry) => entry.device === device);
        if (!entry) return;
        delete this[entry.id];
        device.id = undefined;
        this._mixDeviceIds[entry.device.type].unshift(entry.id);
        this._devices = this._devices.filter((e) => e !== entry);
    }

    get devices(): MixDeviceEntry[] {
        return this._devices;
    }

    private alreadyRegistered(device: MixDevice): boolean {
        return this._devices.find((entry) => {
            return entry.device === device;
        }) !== undefined;
    }

    private nextId(type: MixDeviceType): number | undefined {
        const ids = this._mixDeviceIds[type];
        if (ids.length === 0) return;
        return ids.shift();
    }
}