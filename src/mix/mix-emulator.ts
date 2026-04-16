import {_mix_field_encode, B, Compare, F_ALL, MIX_WORD_SIZE, MixWord, MixWordOverflowError} from "./mix-word.ts";
import {decode, type MixOperation} from "./mix-opcodes.ts";
import type {MIXProgram} from "./mix-asm.ts";
import {MixDevice} from "./mix-io.ts";
import {NUMS} from "./mix-chars.ts";
import {formatNumber} from "./utils.ts";


/**
 * MIX memory: an array of 4000 MIX words.
 */
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
        .map((addr) => new MixWord(0, `${formatNumber(addr, 4)}`));
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
    halt: boolean;
    totalTime: number;
    profile: Record<number, number>;
    instructions: number;
    running: boolean;
    startTime: number;
    ips: number;
    error?: string;
}

export interface MixStateChangeEvent {
    state: MixState;
}

export type MixStateChangeCallback = (e: MixStateChangeEvent) => void;

export class MixEmulator {
    // MIX machine states: memory, registers, overflow, compare flag, program counter and halt flag
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
    private _halt: boolean = false;

    // State change callback list
    private _stateChangeCallback: MixStateChangeCallback[] = [];

    // Timeout id for async run.
    private _runAsyncTimer: any = null;

    // Run start time, not affected by step function.
    private _startTime: number = -1;
    // MIX machine total run time - accumulated virtual time per instruction
    private _totalTime: number = 0;
    // Number of instructions executed since last reset.
    private _instructions: number = 0;
    // execution count per address
    private _profile: Record<number, number> = {};

    // Error handling
    private _error?: string = undefined;

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
        this._halt = false;

        this._startTime = -1;
        this._totalTime = 0;
        this._instructions = 0;
        this._profile = {};
        this._error = undefined;
        this.emitStateChange();
    }

    onStateChange(callback: MixStateChangeCallback) {
        this._stateChangeCallback.push(callback);
        console.log(`MIX Emulator onStateChange size: ${this._stateChangeCallback.length};`)
    }

    loadProgram(program: MIXProgram) {
        try {
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
        } catch (e) {
            this._error = (e as Error).message;
        }
        this.emitStateChange();
    }


    runAsync(stepDelayMs: number = 1) {
        if (this._halt) {
            return;
        }
        if (this._runAsyncTimer !== null) {
            // already running.
            return;
        }
        const next = () => {
            this._runAsyncTimer = setTimeout(execAsync, stepDelayMs);
        }
        const execAsync = () => {
            this.step();
            if (!this._halt) next();
        }
        this._startTime = performance.now();
        this._instructions = 0;
        next();
    }

    stopAsync() {
        if (this._runAsyncTimer !== null) {
            clearTimeout(this._runAsyncTimer);
            this._runAsyncTimer = null;
            this.emitStateChange();
        }
    }

    run(emitStateChange: boolean = true, limit: number = -1) {
        this._startTime = performance.now();
        while (!this._halt) {
            this.step(emitStateChange);
            if (limit !== -1 && this._instructions > limit) break;
        }
        return this.ips;
    }

    step(emitStateChange: boolean = true) {
        if (this._halt) {
            this._error = 'MIX Emulator halted, reset it.';
            return;
        }

        const opAddr = this._pc++;
        const op = decode(this._memory.load(opAddr));
        const func = this.operations[op.opcode?.name!];
        if (!func) {
            this._error = `Unknown opcode: ${op.opcode?.name} at ${opAddr}`;
            return;
        }

        try {
            func(op);
        } catch (e) {
            console.error(e);
            this._error = (e as Error).message;
        }

        if (typeof op.opcode?.t === 'function') {
            this._totalTime += op.opcode?.t(op);
        } else if (op.opcode?.t as number) {
            this._totalTime += op.opcode?.t as number;
        }

        if (!this._profile[opAddr]) this._profile[opAddr] = 0;
        this._profile[opAddr]++;
        this._instructions++;

        if (emitStateChange) this.emitStateChange();
    }

    emitStateChange() {
        const event: MixStateChangeEvent = {
            state: this.state,
        };
        this._stateChangeCallback.forEach(c => c(event));
    }

    emitRegisterAndMemoryChange() {
        this._rA.emitChange();
        this._rX.emitChange();
        this._rJ.emitChange();
        for (const rI of this._rI) rI.emitChange();
        for (const w of this._memory) w.emitChange();
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
    get running() {
        return this._runAsyncTimer !== null;
    }
    get ips() {
        if (this._startTime === -1) return 0;
        const now = performance.now();
        return 1000 * this._instructions / (now - this._startTime);
    }
    get totalTime() {
        return this._totalTime;
    }
    get profile() {
        return this._profile;
    }
    get state() {
        return this.getCurrentState();
    }

    private getI(i: number) {
        if (i <= 0) return MixWord.ZERO;
        if (i <= 6) return this._rI[i-1];
        return undefined;
    }

    private getM(i: number, a: MixWord): number {
        const rI = this.getI(i);
        if (!rI) {
            throw new Error(`Invalid index register: ${i}.`);
        }
        return rI.value + a.value;
    }

    /**
     * Get the current state of the MIX emulator
     * @private
     */
    private getCurrentState(): MixState {
        return {
            pc: this._pc,
            overflow: this._overflow,
            compare: this._compare,
            halt: this._halt,
            totalTime: this._totalTime,
            profile: this._profile,
            instructions: this._instructions,
            running: this.running,
            startTime: this._startTime,
            ips: this.ips,
            error: this._error,
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

    private ent(op: MixOperation, register: MixWord, neg: boolean = false) {
        let M = this.getM(op.i, op.a);
        let m = new MixWord(M);
        if (M === 0) {
            m.sign = op.a.sign;
        }
        if (neg) m.sign = -m.sign;
        register.store(new MixWord(M));
    }

    private inc(op: MixOperation, register: MixWord, neg: boolean = false) {
        let M = this.getM(op.i, op.a);
        if (neg) M = -M;
        try {
            register.value = register.value + M;
            this._overflow = false;
        } catch (e) {
            if (e instanceof MixWordOverflowError) {
                this._overflow = true;
            } else throw e;
        }
    }

    private jmp(op: MixOperation, setJ: boolean = true) {
        if (setJ) this.rJ.value = this.pc;
        this._pc = this.getM(op.i, op.a);
    }

    private cmp(op: MixOperation, register: MixWord) {
        const M = this.getM(op.i, op.a);
        const V = this._memory.load(M, op.f).value;
        const rV = register.load(op.f).value;
        if (V < rV) {
            this._compare = Compare.GREATER;
        } else if (V > rV) {
            this._compare = Compare.LESS;
        } else {
            this._compare = Compare.EQUAL;
        }
    }

    private operations: Record<string, MixOpFunc> = {
        "NOP": (_: MixOperation) => {
            // do nothing
        },
        "HLT": (_: MixOperation) => {
            this._halt = true;
        },
        "ADD": (op: MixOperation) => {
            const M = this.getM(op.i, op.a);
            const V = this._memory.load(M, op.f).value;
            try {
                this._rA.value = this._rA.value + V;
                this._overflow = false;
            } catch (e: any) {
                if (e instanceof MixWordOverflowError) {
                    this._overflow = true;
                } else {
                    throw e;
                }
            }
        },
        "SUB": (op: MixOperation) => {
            const M = this.getM(op.i, op.a);
            const V = this._memory.load(M, op.f).value;
            try {
                this._rA.value = this._rA.value - V;
                this._overflow = false;
            } catch (e: any) {
                if (e instanceof MixWordOverflowError) {
                    this._overflow = true;
                } else {
                    throw e;
                }
            }
        },
        "DIV": (op: MixOperation) => {
            const M = this.getM(op.i, op.a);
            const V = this._memory.load(M, op.f);

            const a = BigInt(this._rA.abs);
            const v = BigInt(V.abs);
            if (v === 0n || a >= v) {
                this._overflow = true;
                return;
            }
            const sign = this._rA.sign;
            const vsign = V.sign;
            const x = BigInt(this._rX.abs);
            // (a * B + x) / V
            const q = (a * B + x) / v;
            const r = (a * B + x) % v;
            this._rA.abs = parseInt(q.toString());
            this._rA.sign = sign * vsign;
            this._rX.abs = parseInt(r.toString());
            this._rX.sign = sign;
        },
        "MUL": (op: MixOperation) => {
            const M = this.getM(op.i, op.a);
            const V = this._memory.load(M, op.f);
            const sign = this._rA.sign * V.sign;
            const p = BigInt(this._rA.abs) * BigInt(V.abs);
            this._rA.abs = parseInt((p / B).toString());
            this._rA.sign = sign;
            this._rX.abs = parseInt((p % B).toString());
            this._rX.sign = sign;
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
        "ENTA": (op: MixOperation)=> {
            this.ent(op, this.rA);
        },
        "ENNA": (op: MixOperation)=> {
            this.ent(op, this.rA, true);
        },
        "ENTX": (op: MixOperation)=> {
            this.ent(op, this.rX);
        },
        "ENNX": (op: MixOperation)=> {
            this.ent(op, this.rX, true);
        },
        "ENT1": (op: MixOperation)=> {
            this.ent(op, this.rI1);
        },
        "ENT2": (op: MixOperation)=> {
            this.ent(op, this.rI2);
        },
        "ENT3": (op: MixOperation)=> {
            this.ent(op, this.rI3);
        },
        "ENT4": (op: MixOperation)=> {
            this.ent(op, this.rI4);
        },
        "ENT5": (op: MixOperation)=> {
            this.ent(op, this.rI5);
        },
        "ENT6": (op: MixOperation)=> {
            this.ent(op, this.rI6);
        },
        "ENN1": (op: MixOperation)=> {
            this.ent(op, this.rI1, true);
        },
        "ENN2": (op: MixOperation)=> {
            this.ent(op, this.rI2, true);
        },
        "ENN3": (op: MixOperation)=> {
            this.ent(op, this.rI3, true);
        },
        "ENN4": (op: MixOperation)=> {
            this.ent(op, this.rI4, true);
        },
        "ENN5": (op: MixOperation)=> {
            this.ent(op, this.rI5, true);
        },
        "ENN6": (op: MixOperation)=> {
            this.ent(op, this.rI6, true);
        },
        "INCA": (op: MixOperation)=> {
            this.inc(op, this.rA);
        },
        "DECA": (op: MixOperation)=> {
            this.inc(op, this.rA, true);
        },
        "INCX": (op: MixOperation)=> {
            this.inc(op, this.rX);
        },
        "DECX": (op: MixOperation)=> {
            this.inc(op, this.rX, true);
        },
        "INC1": (op: MixOperation)=> {
            this.inc(op, this.rI1);
        },
        "DEC1": (op: MixOperation)=> {
            this.inc(op, this.rI1, true);
        },
        "INC2": (op: MixOperation)=> {
            this.inc(op, this.rI2);
        },
        "DEC2": (op: MixOperation)=> {
            this.inc(op, this.rI2, true);
        },
        "INC3": (op: MixOperation)=> {
            this.inc(op, this.rI3);
        },
        "DEC3": (op: MixOperation)=> {
            this.inc(op, this.rI3, true);
        },
        "INC4": (op: MixOperation)=> {
            this.inc(op, this.rI4);
        },
        "DEC4": (op: MixOperation)=> {
            this.inc(op, this.rI4, true);
        },
        "INC5": (op: MixOperation)=> {
            this.inc(op, this.rI5);
        },
        "DEC5": (op: MixOperation)=> {
            this.inc(op, this.rI5, true);
        },
        "INC6": (op: MixOperation)=> {
            this.inc(op, this.rI6);
        },
        "DEC6": (op: MixOperation)=> {
            this.inc(op, this.rI6, true);
        },
        "CMPA": (op: MixOperation) => {
            this.cmp(op, this.rA);
        },
        "CMPX": (op: MixOperation) => {
            this.cmp(op, this.rX);
        },
        "CMP1": (op: MixOperation) => {
            this.cmp(op, this.rI1);
        },
        "CMP2": (op: MixOperation) => {
            this.cmp(op, this.rI2);
        },
        "CMP3": (op: MixOperation) => {
            this.cmp(op, this.rI3);
        },
        "CMP4": (op: MixOperation) => {
            this.cmp(op, this.rI4);
        },
        "CMP5": (op: MixOperation) => {
            this.cmp(op, this.rI5);
        },
        "CMP6": (op: MixOperation) => {
            this.cmp(op, this.rI6);
        },
        "JMP": (op: MixOperation) => {
            this.jmp(op);
        },
        "JSJ": (op: MixOperation) => {
            this.jmp(op, false);
        },
        "JOV": (op: MixOperation) => {
            if (this._overflow) {
                this.jmp(op);
            }
        },
        "JNOV": (op: MixOperation)=> {
            if (!this._overflow) {
                this.jmp(op);
            }
        },
        "JL": (op) => {
            if (this._compare === Compare.LESS) {
                this.jmp(op);
            }
        },
        "JE": (op) => {
            if (this._compare === Compare.EQUAL) {
                this.jmp(op);
            }
        },
        "JG": (op) => {
            if (this._compare === Compare.GREATER) {
                this.jmp(op);
            }
        },
        "JGE": (op) => {
            if (this._compare === Compare.GREATER || this._compare === Compare.EQUAL) {
                this.jmp(op);
            }
        },
        "JNE": (op) => {
            if (this._compare !== Compare.EQUAL) {
                this.jmp(op);
            }
        },
        "JLE": (op) => {
            if (this._compare === Compare.LESS || this._compare === Compare.EQUAL) {
                this.jmp(op);
            }
        },
        ...this.jmpRegisterOps('A', this._rA),
        ...this.jmpRegisterOps('X', this._rX),
        ...this.jmpRegisterOps('1', this.rI1),
        ...this.jmpRegisterOps('2', this.rI2),
        ...this.jmpRegisterOps('3', this.rI3),
        ...this.jmpRegisterOps('4', this.rI4),
        ...this.jmpRegisterOps('5', this.rI5),
        ...this.jmpRegisterOps('6', this.rI6),
        "MOVE": (op) => {
            const M = this.getM(op.i, op.a);
            const dst = this.rI1.value;
            for (let i = 0; i < op.f; i++) {
                this.memory.store(dst + i, this.memory.load(M + i));
            }
            this.rI1.value = this.rI1.value + op.f;
        },
        // IO
        "IOC": (op) => {
            const M = this.getM(op.i, op.a);
            MixDevice.DEVICES[op.f].ioc(M, this);
        },
        "IN": (op) => {
            // read data from device
            const M = this.getM(op.i, op.a);
            const words = MixDevice.DEVICES[op.f].input();
            let i = M;
            for (const w of words) {
                this._memory.store(i, w);
                i++;
            }
        },
        "OUT": (op) => {
            const M = this.getM(op.i, op.a);
            MixDevice.DEVICES[op.f].output(M, this);
        },
        "JRED": (op) => {
            if (MixDevice.DEVICES[op.f].ready) {
                this.jmp(op);
            }
        },
        "JBUS": (op) => {
            if (!MixDevice.DEVICES[op.f].ready) {
                this.jmp(op);
            }
        },
        "CHAR": (_) => {
            const rA = this._rA;
            const bytes: number[] = [];
            for (let i = 1; i <= MIX_WORD_SIZE; i++) {
                const b = rA.getByte(i);
                bytes.push(NUMS[Math.floor(b / 10).toString()]);
                bytes.push(NUMS[Math.floor(b % 10).toString()]);
            }
            rA.store(MixWord.fromBytes([1, ...bytes.slice(0, 5)]), _mix_field_encode(1, MIX_WORD_SIZE));
            this._rX.store(MixWord.fromBytes([1, ...bytes.slice(5)]), _mix_field_encode(1, MIX_WORD_SIZE));
        },
        "NUM": (_) => {
            const rA = this._rA;
            const rX = this._rX;
            let v = 0;
            for (const b of rA) {
                const d = b % 10;
                v = v * 10 + d;
            }
            for (const b of rX) {
                const d = b % 10;
                v = v * 10 + d;
            }
            this._rA.store(new MixWord(v), _mix_field_encode(1, MIX_WORD_SIZE));
        },
        "SLA": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytes = this._rA.bytes.slice();
            if (M >= MIX_WORD_SIZE) {
                this._rA.abs = 0;
            } else {
                for (let i = 1; i <= MIX_WORD_SIZE - M; i++) {
                    bytes[i] = bytes[i + M];
                }
                for (let i = MIX_WORD_SIZE - M + 1; i <= MIX_WORD_SIZE; i++) {
                    bytes[i] = 0;
                }
                this._rA.store(MixWord.fromBytes(bytes));
            }
        },
        "SRA": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytes = this._rA.bytes.slice();
            if (M >= MIX_WORD_SIZE) {
                this._rA.abs = 0;
            } else {
                for (let i = MIX_WORD_SIZE; i > M; i--) {
                    bytes[i] = bytes[i - M];
                }
                for (let i = 1; i <= M; i++) {
                    bytes[i] = 0;
                }
                this._rA.store(MixWord.fromBytes(bytes));
            }
        },
        "SRAX": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytesA = this._rA.bytes.slice(this._rA.left);
            const bytesX = this._rX.bytes.slice(this._rX.left);
            const bytes = [1, ...bytesA, ...bytesX];
            if (M >= MIX_WORD_SIZE*2) {
                this._rA.abs = 0;
                this._rX.abs = 0;
            } else {
                for (let i = MIX_WORD_SIZE * 2; i > M; i--) {
                    bytes[i] = bytes[i - M];
                }
                for (let i = 1; i <= M; i++) {
                    bytes[i] = 0;
                }
                this._rA.store(MixWord.fromBytes([this._rA.sign, ...bytes.slice(1, MIX_WORD_SIZE+1)]));
                this._rX.store(MixWord.fromBytes([this._rX.sign, ...bytes.slice(MIX_WORD_SIZE+1)]));
            }
        },
        "SLAX": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytesA = this._rA.bytes.slice(this._rA.left);
            const bytesX = this._rX.bytes.slice(this._rX.left);
            const bytes = [1, ...bytesA, ...bytesX];
            if (M >= MIX_WORD_SIZE*2) {
                this._rA.abs = 0;
                this._rX.abs = 0;
            } else {
                for (let i = 1; i <= MIX_WORD_SIZE*2 - M; i++) {
                    bytes[i] = bytes[i+M];
                }
                for (let i = MIX_WORD_SIZE*2 - M + 1; i <= MIX_WORD_SIZE * 2; i++) {
                    bytes[i] = 0;
                }
                this._rA.store(MixWord.fromBytes([this._rA.sign, ...bytes.slice(1, MIX_WORD_SIZE+1)]));
                this._rX.store(MixWord.fromBytes([this._rX.sign, ...bytes.slice(MIX_WORD_SIZE+1)]));
            }
        },
        "SLC": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytesA = this._rA.bytes.slice(this._rA.left);
            const bytesX = this._rX.bytes.slice(this._rX.left);
            let bytes = [...bytesA, ...bytesX];
            let k = M % bytes.length;
            if (k > 0) {
                const b1 = bytes.slice(0, k);
                const b2 = bytes.slice(k);
                bytes = [1, ...b2, ...b1];
                this._rA.store(MixWord.fromBytes([this._rA.sign, ...bytes.slice(1, MIX_WORD_SIZE+1)]));
                this._rX.store(MixWord.fromBytes([this._rX.sign, ...bytes.slice(MIX_WORD_SIZE+1)]));
            }
        },
        "SRC": (op) => {
            const M = this.getM(op.i, op.a);
            if (M < 0) {
                this._overflow = true;
                return;
            }
            const bytesA = this._rA.bytes.slice(this._rA.left);
            const bytesX = this._rX.bytes.slice(this._rX.left);
            let bytes = [...bytesA, ...bytesX];
            let k = bytes.length - (M % bytes.length);
            if (k > 0) {
                const b1 = bytes.slice(0, k);
                const b2 = bytes.slice(k);
                bytes = [1, ...b2, ...b1];
                this._rA.store(MixWord.fromBytes([this._rA.sign, ...bytes.slice(1, MIX_WORD_SIZE+1)]));
                this._rX.store(MixWord.fromBytes([this._rX.sign, ...bytes.slice(MIX_WORD_SIZE+1)]));
            }
        }
    };

    private makeJmpRegisterFunc(cond: string, register: MixWord): MixOpFunc {
        let predicate: () => boolean = () => false;
        switch (cond) {
            case 'N': predicate = () => register.value < 0; break;
            case 'Z': predicate = () => register.value === 0; break;
            case 'P': predicate = () => register.value > 0; break;
            case 'NP': predicate = () => register.value <= 0; break;
            case 'NN': predicate = () => register.value >= 0; break;
            case 'NZ': predicate = () => register.value !== 0; break;
        }
        return (op: MixOperation) => {
            if (predicate()) {
                this.jmp(op);
            }
        };
    }

    private jmpRegisterOps(name: string, register: MixWord): Record<string, MixOpFunc> {
        const ops: Record<string, MixOpFunc> = {};
        for (const cond of ['N', 'P', 'Z', 'NN', 'NZ', 'NP']) {
            ops[`J${name}${cond}`] = this.makeJmpRegisterFunc(cond, register);
        }
        return ops;
    }
}