
/**
 * Compare results.
 */
export enum Compare {
    EQUAL = 0,
    LESS = -1,
    GREATER = 1,
}

/**
 * A byte in MIX word.
 */
export type MixByte = number;

// maximum number of states a MIX byte can represent.
export const MIX_BYTE_MAX = 100;
// Number of bytes in a MIX word, excluding the sign.
export const MIX_WORD_SIZE = 5;
export const SIGN_POSITIVE = 1;
export const SIGN_NEGATIVE = -1;

// field descriptors L*8 + R
export const F_ALL = _mix_field_encode(0, MIX_WORD_SIZE);
export const F_SIGN = _mix_field_encode(0, 0);
export const F_OP_ADDR = _mix_field_encode(0, 2);
export const F_OP_I = _mix_field_encode(3, 3);
export const F_OP_F = _mix_field_encode(4, 4);
export const F_OP_CODE = _mix_field_encode(5, 5);

/**
 * Represent a field range in MIX word, inclusive [L, R]
 */
export interface MixField {
    l: number;
    r: number;
}
export function _mix_field_decode(f: number): MixField {
    return {
        l: Math.floor(f / 8),
        r: f % 8,
    }
}
export function _mix_field_encode(l: number, r: number) {
    return l * 8 + r;
}

function _sign_of(v: number) {
    return v >= 0 ? SIGN_POSITIVE : SIGN_NEGATIVE;
}

export interface MixWordChangeEvent {
    word: MixWord;
    field: MixField;
}

export type MixWordChangeCallback = (e: MixWordChangeEvent) => void;

/**
 * A MIX word, which is a 5-byte value with sign.
 * Word layout:
 * Index:   0     1    2    3    4    5
 *       | +/- | B1 | B2 | B3 | B4 | B5 |
 * Where B1 is the most significant byte, B5 is the least significant byte.
 */
export class MixWord implements Iterable<MixByte> {
    public static readonly ZERO = new MixWord(0);
    public static readonly MAX_VALUE = Math.pow(MIX_BYTE_MAX, MIX_WORD_SIZE) - 1;
    private readonly _label: string;
    // leftmost byte of the word, 1-based, could be 1 for normal words or 4 for rI* and rJ.
    private readonly _left: number;
    // array of bytes, including the sign byte.
    private _bytes: MixByte[];
    private _onChange: MixWordChangeCallback[] = [];

    constructor(value: number = 0, label: string = '', left: number = 1) {
        // bytes[0] is sign, bytes[1] is the most significant byte, bytes[size] is the least significant byte.
        this._label = label;
        this._left = left;
        this._bytes = new Array(MIX_WORD_SIZE + 1).fill(0);
        this._bytes[0] = _sign_of(value);
        this._setAbsValue(value);
    }

    [Symbol.iterator](): Iterator<number> {
        let i = 1;
        const self = this;
        return {
            next(): IteratorResult<number> {
                if (i <= MIX_WORD_SIZE) {
                    return {value: i < self._left ? 0 : self._bytes[i++], done: false};
                } else {
                    return {value: undefined, done: true};
                }
            }
        };
    }

    static initValue(random: boolean = false): MixWord {
        if (!random) return MixWord.ZERO;
        return new MixWord(Math.floor((Math.random() - 0.5) * 2 * MixWord.MAX_VALUE));
    }

    static fromBytes(bytes: MixByte[]) {
        if (bytes.length != MIX_WORD_SIZE + 1) throw new Error(`Invalid bytes length: ${bytes.length}.`);
        const w = new MixWord();
        w._bytes = bytes.slice(0, MIX_WORD_SIZE + 1)
            .map((b, i) => i == 0 ? _sign_of(b) : Math.abs(b) % MIX_BYTE_MAX);
        return w;
    }

    static newGeneralRegister(label: string) {
        return new MixWord(0, label);
    }

    static newIndexRegister(label: string) {
        return new MixWord(0, label, 4); // only bytes 4-5 are used.
    }

    get label() {
        return this._label;
    }
    get sign() {
        return this._bytes[0];
    }
    get signLabel() : string {
        return this.sign == SIGN_POSITIVE ? '+' : '-';
    }
    set sign(s: number) {
        this._bytes[0] = _sign_of(s);
        this._emitChange({l: 0, r: 0});
    }
    get abs() {
        let x = 0;
        for (let i = 1; i <= MIX_WORD_SIZE; i++) {
            x = x * MIX_BYTE_MAX + this._bytes[i];
        }
        return x;
    }
    set abs(v: number) {
        this._setAbsValue(v);
        this._emitChange({l: 1, r: MIX_WORD_SIZE});
    }
    get value() {
        return this.sign * this.abs;
    }
    set value(v: number) {
        this.sign = _sign_of(v);
        this._setAbsValue(v);
        this._emitChange({l: 0, r: MIX_WORD_SIZE});
    }
    get left() {
        return this._left;
    }

    /**
     * Get value at byte index (1-5)
     * @param i 1-based index of the byte.
     */
    getByte(i: number) {
        if (i <= 0 || i > MIX_WORD_SIZE) throw new Error(`Invalid byte index: ${i}.`);
        return i < this._left ? 0 : this._bytes[i];
    }

    /**
     * Add event listener for change to the word.
     * @param callback
     */
    onChange(callback: MixWordChangeCallback) {
        this._onChange.push(callback);
    }

    /**
     * Load a MIX word from the field range.
     * @param f
     */
    load(f: number = F_ALL): MixWord {
        if (f == F_ALL) return MixWord.fromBytes(this._bytes);
        const {l, r} = _mix_field_decode(f);
        const bytes : MixByte[] = [1, 0, 0, 0, 0, 0];
        if (l == 0) bytes[l] = this._bytes[0];
        for (let i = Math.max(1, l); i <= r; i++) {
            bytes[MIX_WORD_SIZE - r + i] = this.getByte(i);
        }
        return MixWord.fromBytes(bytes);
    }
    /**
     * Store a value into the MIX word, update bytes based on the field range.
     *
     * f specifies a range [L, R] and the current instance's bytes[L] to bytes[R] are updated.
     * If R is less than the word size, the val is "shifted" to the left.
     *
     * @param val the MIX word to store.
     * @param f field descriptor.
     */
    store(val: MixWord, f: number = F_ALL): MixWord {
        const {l, r} = _mix_field_decode(f);
        if (l == 0) this._bytes[0] = val.sign;
        for (let i = Math.max(1, l); i <= r; i++) {
            if (i >= this._left) {
                this._bytes[i] = val._bytes[MIX_WORD_SIZE - r + i];
            }
        }
        this._emitChange({l, r});
        return this;
    }

    private _emitChange(field: MixField) {
        const event: MixWordChangeEvent = {
            word: this,
            field: field,
        };
        this._onChange.forEach(c => c(event));
    }

    private _setAbsValue(v: number) {
        v = Math.abs(v);
        if (v > MixWord.MAX_VALUE) throw new Error(`Value too large: ${v}.`);
        for (let i = 0; i < MIX_WORD_SIZE; i++) {
            this._bytes[MIX_WORD_SIZE - i] = v % MIX_BYTE_MAX;
            v = Math.floor(v / MIX_BYTE_MAX);
        }
    }
}
