/**
 * IO devices
 * */
import {MIX_WORD_SIZE, type MixWord} from "./mix-word.ts";
import type {MixEmulator} from "./mix-emulator.ts";
import {decode} from "./mix-chars.ts";

export enum MixDeviceType {
    TAPE = "TAPE",
    DISK = "DISK",
    CARD_READER = "CARD_READER",
    CARD_PUNCHER = "CARD_PUNCHER",
    PRINTER = "PRINTER",
    TYPEWRITER = "TYPEWRITER",
    PAPER_TAPE = "PAPER_TAPE",
}

export type MixDeviceTypeKey = keyof typeof MixDeviceType;

const MIX_DEVICES_BY_TYPE: Record<MixDeviceType, number> = {
    TAPE: 8,
    DISK: 8,
    CARD_READER: 1,
    CARD_PUNCHER: 1,
    PRINTER: 1,
    TYPEWRITER: 1,
    PAPER_TAPE: 1,
};

const BLOCK_SIZE_IN_WORDS: Record<MixDeviceType, number> = {
    TAPE: 100,
    DISK: 100,
    CARD_READER: 16,
    CARD_PUNCHER: 16,
    PRINTER: 24,
    TYPEWRITER: 14,
    PAPER_TAPE: 14,
};

export interface MixIocEvent {
    device: MixDevice;
    m: number;
    rX?: number;
}

export interface MixOutputEvent {
    device: MixDevice;
    data: MixWord[];
    lines?: string[];
}

export interface MixInputEvent {
    device: MixDevice;
    size: number;
}

export interface MixInputResult {
    success: boolean;
    data: MixWord[];
    lines?: string[];
}

type MixEventHandler<Event, Output = void> = (_: Event) => Output;

export type MixOutputEventHandler = MixEventHandler<MixOutputEvent>;
export type MixIocEventHandler = MixEventHandler<MixIocEvent>;
export type MixInputEventHandler = MixEventHandler<MixInputEvent, MixInputResult>;

export class MixDevice {
    public static readonly DEVICES: MixDevice[] = [];
    static {
        for (const type in MIX_DEVICES_BY_TYPE) {
            const c = MIX_DEVICES_BY_TYPE[type as MixDeviceTypeKey];
            for (let j = 0; j < c; j++) {
                MixDevice.DEVICES.push(new MixDevice(type as MixDeviceType, `${type} ${j}`));
            }
        }
    }
    private _blockSize: number;
    private _type: MixDeviceType;
    private _label: string;
    private _outputEventListeners: MixOutputEventHandler[];
    private _iocEventListeners: MixIocEventHandler[];
    private _inputEventListeners: MixInputEventHandler[];

    constructor(type: MixDeviceType, label: string) {
        this._blockSize = BLOCK_SIZE_IN_WORDS[type];
        this._type = type;
        this._label = label;
        this._outputEventListeners = [];
        this._iocEventListeners = [];
        this._inputEventListeners = [];
    }

    onOutput(handler: MixOutputEventHandler) {
        this._outputEventListeners.push(handler);
    }

    onIoc(handler: MixIocEventHandler) {
        this._iocEventListeners.push(handler);
    }

    onInput(handler: MixInputEventHandler) {
        this._inputEventListeners.push(handler);
    }

    get blockSize(): number {
        return this._blockSize;
    }

    get type(): MixDeviceType {
        return this._type;
    }

    get ready(): boolean {
        return true;
    }

    get label(): string {
        return this._label;
    }

    ioc(m: number, mix: MixEmulator) {
        this.emitIocEvent({
            device: this,
            m,
            rX: mix.rX.value,
        })
    }

    input(_m: number, _mix: MixEmulator) {
        // TODO:
        this.emitInputEvent({device: this, size: this.blockSize});
    }

    output(m: number, mix: MixEmulator) {
        if (this._type === MixDeviceType.PRINTER) {
            const lines: string[] = [];
            const data: MixWord[] = [];
            for (let j = 0; j < this._blockSize; j++) {
                const word = mix.memory.load(m + j);
                data.push(word);

                const bytes: number[] = [];
                for (let l = 1; l <= MIX_WORD_SIZE; l++) {
                    bytes.push(word.getByte(l));
                }
                const text = decode(bytes);
                lines.push(text);
            }
            this.emitOutputEvent({
                device: this,
                data,
                lines: [lines.join('')]
            })
        } else {
            console.log()
        }
    }

    private emitOutputEvent(e: MixOutputEvent) {
        this._outputEventListeners.forEach(cb => cb(e));
    }

    private emitIocEvent(e: MixIocEvent) {
        this._iocEventListeners.forEach(cb => cb(e));
    }

    private emitInputEvent(e: MixInputEvent) {
        return this._inputEventListeners.map(cb => cb(e));
    }
}
