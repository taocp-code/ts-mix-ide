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

export class MixDevice {
    public static readonly DEVICES: MixDevice[] = [];
    static {
        for (const type in MIX_DEVICES_BY_TYPE) {
            const c = MIX_DEVICES_BY_TYPE[type as MixDeviceTypeKey];
            for (let j = 0; j < c; j++) {
                MixDevice.DEVICES.push(new MixDevice(type as MixDeviceType));
            }
        }
    }
    private _blockSize: number;
    private _type: MixDeviceType;

    constructor(type: MixDeviceType) {
        this._blockSize = BLOCK_SIZE_IN_WORDS[type];
        this._type = type;
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
    ioc(_m: number, _mix: MixEmulator) {
        if (this._type === MixDeviceType.PRINTER) {
            console.log('==== Next Page ====')
        }
    }
    input(): MixWord[] {
        return [];
    }
    output(m: number, mix: MixEmulator) {
        if (this._type === MixDeviceType.PRINTER) {
            const line: string[] = [];
            for (let j = 0; j < this._blockSize; j++) {
                const word = mix.memory.load(m + j);
                const bytes: number[] = [];
                for (let l = 1; l <= MIX_WORD_SIZE; l++) {
                    bytes.push(word.getByte(l));
                }
                const text = decode(bytes);
                line.push(text);
            }
            console.log(line.join(''));
        } else {
            console.log()
        }
    }
}
