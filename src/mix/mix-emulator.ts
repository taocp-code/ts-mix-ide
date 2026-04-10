import {Compare, F_ALL, MixWord, MixWordOverflowError} from "./mix-word.ts";
import {decode, type MixOperation} from "./mix-opcodes.ts";
import type {MIXProgram} from "./mix-asm.ts";


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

export type MixOpFunc = (op: MixOperation) => void;

export interface MixState {
    pc: number;
    overflow: boolean;
    compare: Compare;
}

export interface MixStateChangeEvent {
    oldState: MixState;
    newState: MixState;
}

export type MixStateChangeCallback = (e: MixStateChangeEvent) => void;

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
    private _cycles: number = 0;
    private _stateChangeCallback: MixStateChangeCallback[] = [];

    private operations: Record<string, MixOpFunc> = {
        "NOP": (_: MixOperation) => {
            // do nothing
        },
        "ADD": (op: MixOperation) => {
            const M = this.getM(op.i, op.a);
            const V = this._memory.load(M, op.f).value;
            try {
                this._rA.value = this._rA.value + V;
            } catch (e: any) {
                if (e instanceof MixWordOverflowError) {
                    this._overflow = true;
                } else {
                    throw e;
                }
            }
        },
        "LDA": (op: MixOperation) => {
            this.load(op, this.rA);
        },
        "LDAN": (op: MixOperation) => {
            this.load(op, this.rA, true);
        },
        "LDX": (op: MixOperation) => {
            this.load(op, this.rX);
        },
        "LDXN": (op: MixOperation) => {
            this.load(op, this.rX, true);
        },
        "LD1": (op: MixOperation) => {
            this.load(op, this.rI1);
        },
        "LD2": (op: MixOperation) => {
            this.load(op, this.rI2);
        },
        "LD3": (op: MixOperation) => {
            this.load(op, this.rI3);
        },
        "LD4": (op: MixOperation) => {
            this.load(op, this.rI4);
        },
        "LD5": (op: MixOperation) => {
            this.load(op, this.rI5);
        },
        "LD6": (op: MixOperation) => {
            this.load(op, this.rI6);
        },
        "LD1N": (op: MixOperation) => {
            this.load(op, this.rI1, true);
        },
        "LD2N": (op: MixOperation) => {
            this.load(op, this.rI2, true);
        },
        "LD3N": (op: MixOperation) => {
            this.load(op, this.rI3, true);
        },
        "LD4N": (op: MixOperation) => {
            this.load(op, this.rI4, true);
        },
        "LD5N": (op: MixOperation) => {
            this.load(op, this.rI5, true);
        },
        "LD6N": (op: MixOperation) => {
            this.load(op, this.rI6, true);
        },
        "STA": (op: MixOperation) => {
            this.store(op, this.rA);
        },
        "STX": (op: MixOperation) => {
            this.store(op, this.rX);
        },
        "STJ": (op: MixOperation) => {
            this.store(op, this.rJ);
        },
        "STZ": (op: MixOperation) => {
            this.store(op, MixWord.ZERO);
        },
        "ST1": (op: MixOperation) => {
            this.store(op, this.rI1);
        },
        "ST2": (op: MixOperation) => {
            this.store(op, this.rI2);
        },
        "ST3": (op: MixOperation) => {
            this.store(op, this.rI3);
        },
        "ST4": (op: MixOperation) => {
            this.store(op, this.rI4);
        },
        "ST5": (op: MixOperation) => {
            this.store(op, this.rI5);
        },
        "ST6": (op: MixOperation) => {
            this.store(op, this.rI6);
        },
    };

    constructor() {
        this.reset();
    }

    onStateChange(callback: MixStateChangeCallback) {
        this._stateChangeCallback.push(callback);
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

    loadProgram(program: MIXProgram) {
        let addr = 0;
        program.sections.sort((a, b) => a.offset - b.offset);
        for (const section of program.sections) {
            if (section.offset < addr) {
                throw new Error(`Invalid program section offset: ${section.offset} cannot be less than cur address: ${addr}.`);
            }
            addr = section.offset;
            for (const word of section.data) {
                this._memory.store(addr++, word);
            }
        }
        // point program counter to program start.
        this._pc = program.start;
    }

    step() {
        const oldState = this.copyState();

        const op = decode(this._memory.load(this._pc++));
        const func = this.operations[op.opcode?.name!];
        func(op);
        if (op.opcode?.t instanceof Number) {
            this._cycles += op.opcode?.t as number;
        }
        if (op.opcode?.t instanceof Function) {
            this._cycles += op.opcode?.t(op);
        }

        const newState = this.copyState();
        const event: MixStateChangeEvent = {
            oldState: oldState,
            newState: newState,
        };
        this._stateChangeCallback.forEach(c => c(event));
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

    private copyState(): MixState {
        return {
            pc: this._pc,
            overflow: this._overflow,
            compare: this._compare,
        }
    }

    private load(op: MixOperation, register: MixWord, neg: boolean = false) {
        const M = this.getM(op.i, op.a);
        const V = this._memory.load(M, op.f);
        if (neg) V.sign = -V.sign;
        register.store(V);
    }

    private store(op: MixOperation, register: MixWord) {
        const M = this.getM(op.i, op.a);
        this._memory.store(M, register, op.f);
    }
}