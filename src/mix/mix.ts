import {Compare, F_ALL, F_OP_ADDR, F_OP_CODE, F_OP_F, F_OP_I, MixWord} from "./mix-word.ts";

/**
 * Decoded MIX op from a MIX word.
 */
interface MixOp {
    // OP code
    c: number;
    // Field desc, usually 8 * L + R or other meanings.
    f: number;
    // Index register, 0-6
    i: number;
    // Address value, sign and bytes 1-3
    a: MixWord;
}

/**
 * OP code table
 */
const OP_LDA = 8;
const OP_STA = 9;

function decodeOp(word: MixWord): MixOp {
    return {
        c: word.load(F_OP_CODE).value,
        f: word.load(F_OP_F).value,
        i: word.load(F_OP_I).value,
        a: word.load(F_OP_ADDR),
    }
}


class MixMemory {
    public static readonly SIZE = 4000;
    private words: MixWord[] = new Array(MixMemory.SIZE).map(() => new MixWord());

    load(addr: number, f: number=F_ALL): MixWord {
        return this.words[addr].load(f);
    }

    store(addr: number, value: MixWord, f: number=F_ALL) {
        this.words[addr].store(value, f);
    }

    reset() {
        this.words.forEach(w => w.store(MixWord.ZERO));
    }
}

export class Mix {
    private _memory: MixMemory = new MixMemory();
    private _rA: MixWord = new MixWord();
    private _rX: MixWord = new MixWord();
    private _rI: MixWord[] = [
        new MixWord(),
        new MixWord(),
        new MixWord(),
        new MixWord(),
        new MixWord(),
        new MixWord()
    ];
    private _rJ: MixWord = new MixWord();
    private _overflow: boolean = false;
    private _compare: Compare = Compare.EQUAL;
    private _pc: number = 0;

    constructor() {
        this.reset();
    }

    reset() {
        this._memory.reset();
        this._rA.store(MixWord.ZERO);
        this._rX.store(MixWord.ZERO);
        this._rI.forEach(r => r.store(MixWord.ZERO));
        this._rJ.store(MixWord.ZERO);
        this._overflow = false;
        this._compare = Compare.EQUAL;
        this._pc = 0;
    }

    step() {
        const op = decodeOp(this._memory.load(this._pc));
        this._pc++;
        switch (op.c) {
            case OP_LDA:
                this.lda(op.f, op.i, op.a);
                break;
            case OP_STA:
                this.sta(op.f, op.i, op.a);
                break;
        }
    }

    get overflow() {
        return this._overflow;
    }
    get compare() {
        return this._compare;
    }
    get rA() {
        return this._rA;
    }
    get rX() {
        return this._rX;
    }
    get rI1() {
        return this._rI[0];
    }
    get rI3() {
        return this._rI[2];
    }

    get rI4() {
        return this._rI[3];
    }

    get rI5() {
        return this._rI[4];
    }
    get rI6() {
        return this._rI[5];
    }

    private getI(i: number) {
        if (i == 0) return MixWord.ZERO;
        if (i < 6) return this._rI[i-1];
        return undefined;
    }

    private getM(i: number, a: MixWord): number {
        const rI = this.getI(i);
        if (!rI) throw new Error(`Invalid index register: ${i}.`);
        return rI.value + a.value;
    }

    private lda(f: number, i: number, a: MixWord) {
        const M = this.getM(i, a);
        const content = this._memory.load(M, f);
        this._rA.store(content);
    }

    private sta(f: number, i: number, a: MixWord) {
        const M = this.getM(i, a);
        this._memory.store(M, this._rA, f);
    }
}