import {Compare, F_ALL, MixWord} from "./mix-word.ts";


class MixMemory implements Iterable<MixWord> {
    [Symbol.iterator](): Iterator<MixWord> {
        let index = 0;
        const self = this;
        return {
            next(): IteratorResult<MixWord> {
                if (index < self.words.length) {
                    return {value: self.words[index++], done: false};
                } else {
                    return {value: undefined, done: true};
                }
            }
        }
    }
    public static readonly SIZE = 4000;
    private words: MixWord[] = [...new Array(MixMemory.SIZE).keys()]
        .map((addr) => new MixWord(0, `${addr.toString(10).padStart(4, '0')}`));
    load(addr: number, f: number=F_ALL): MixWord {
        if (addr < 0 || addr >= MixMemory.SIZE) throw new Error(`Invalid address: ${addr}.`);
        return this.words[addr].load(f);
    }
    store(addr: number, value: MixWord, f: number=F_ALL) {
        if (addr < 0 || addr >= MixMemory.SIZE) throw new Error(`Invalid address: ${addr}.`);
        this.words[addr].store(value, f);
    }
    reset(random: boolean = false) {
        this.words.forEach(w => w.store(MixWord.initValue(random)));
    }
}

export class MixEmulator {
    private _memory: MixMemory = new MixMemory();
    private _rA: MixWord = MixWord.newGeneralRegister('rA');
    private _rX: MixWord = MixWord.newGeneralRegister('rX');
    private _rI: MixWord[] = [
        MixWord.newIndexRegister('rI1'),
        MixWord.newIndexRegister('rI2'),
        MixWord.newIndexRegister('rI3'),
        MixWord.newIndexRegister('rI4'),
        MixWord.newIndexRegister('rI5'),
        MixWord.newIndexRegister('rI6'),
    ];
    private _rJ: MixWord = MixWord.newIndexRegister('rIJ');
    private _overflow: boolean = false;
    private _compare: Compare = Compare.EQUAL;
    private _pc: number = 0;

    constructor() {
        this.reset();
    }

    reset(random: boolean = false) {
        this._memory.reset(random);
        this._rA.store(MixWord.initValue(random));
        this._rX.store(MixWord.initValue(random));
        this._rI.forEach(r => r.store(MixWord.initValue(random)));
        this._rJ.store(MixWord.initValue(random));
        this._overflow = false;
        this._compare = Compare.EQUAL;
        this._pc = 0;
    }

    step() {
        // TODO: finish implementation of all opcodes.
    }

    get overflow() {
        return this._overflow;
    }
    get compare() {
        return this._compare;
    }
    get pc() {
        return this._pc;
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
    get rI2() {
        return this._rI[1];
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
    get rJ() {
        return this._rJ;
    }
    get memory() {
        return this._memory;
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