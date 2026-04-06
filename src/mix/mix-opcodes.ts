import {_mix_field_encode, F_OP_ADDR, F_OP_CODE, F_OP_F, F_OP_I, MixWord} from "./mix-word.ts";

/**
 * Decoded MIX op from a MIX word.
 */
export interface MixOperation {
    // OP code
    c: number;
    // Field desc, usually 8 * L + R or other meanings.
    f: number;
    // Index register, 0-6
    i: number;
    // Address value, sign and bytes 1-3
    a: MixWord;
    opcode?: MixOpCode;
}

/**
 * Decode a MIX word into a MIX operation.
 * @param word
 */
export function decode(word: MixWord): MixOperation {
    const op: MixOperation = {
        c: word.load(F_OP_CODE).value,
        f: word.load(F_OP_F).value,
        i: word.load(F_OP_I).value,
        a: word.load(F_OP_ADDR),
    }
    op.opcode = getOpCode(op.c, op.f);
    if (!op.opcode) throw new Error(`Unknown MIX Operation ${op.c} ${op.f} ${op.i} ${op.a.value}`);
    return op;
}

export interface MixOpCode {
    // name of the op code
    name: string;
    // description
    description: string;
    // op code value
    c: number;
    // execution time
    t: number | ((op: MixOperation) => number);
    // standard F value
    f: number;
}

function _regCmpZeroJump(c: number, register: string, namePrefix: string): MixOpCode[] {
    const FCODES = ['N', 'Z', 'P', 'NN', 'NZ', 'NP'];
    const RELS = ['<', '=', '>', '>=', '!=', '<='];
    const ops: MixOpCode[] = [];
    for (let f = 0; f < 6; f++) {
        ops.push({
            name: `${namePrefix}${FCODES[f]}`,
            description: `Jump on ${register} ${RELS[f]} 0`,
            c,
            t: 1,
            f
        });
    }
    return ops;
}

function _regDirectOps(c: number, register: string, nameSuffix: string): MixOpCode[] {
    const FCODES = ['INC', 'DEC', "ENT", 'ENN'];
    const FDESCS = [
        `${register} <- ${register} + M`,
        `${register} <- ${register} - M`,
        `${register} <- M`,
        `${register} <- -M`
    ];
    const ops: MixOpCode[] = [];
    for (let f = 0; f < 4; f++) {
        ops.push({
            name: `${FCODES[f]}${nameSuffix}`,
            description: `${FDESCS[f]}`,
            c,
            t: 1,
            f
        });
    }
    return ops;
}

export const MixOpCodes: MixOpCode[] = [
    {
        name: 'NOP',
        description: 'No operation',
        c: 0,
        t: 1,
        f: 0,
    },
    {
        name: 'ADD',
        description: 'rA <- rA + V',
        c: 1,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'SUB',
        description: 'rA <- rA - V',
        c: 2,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'MUL',
        description: 'rAX <- rA * V',
        c: 3,
        t: 10,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'DIV',
        description: 'rAX <- rA / V, rX <- remainder',
        c: 4,
        t: 12,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'FADD',
        description: 'rA <- rA + V',
        c: 1,
        t: 2,
        f: 6,
    },
    {
        name: 'FSUB',
        description: 'rA <- rA - V',
        c: 2,
        t: 2,
        f: 6,
    },
    {
        name: 'FMUL',
        description: 'rAX <- rA * V',
        c: 3,
        t: 10,
        f: 6,
    },
    {
        name: 'FDIV',
        description: 'rAX <- rA / V, rX <- remainder',
        c: 4,
        t: 12,
        f: 6,
    },
    {
        name: 'NUM',
        description: 'NUM',
        c: 5,
        t: 10,
        f: 0,
    },
    {
        name: 'CHAR',
        description: 'CHAR',
        c: 5,
        t: 10,
        f: 1,
    },
    {
        name: 'HLT',
        description: 'HLT',
        c: 5,
        t: 10,
        f: 2,
    },
    {
        name: 'SLA',
        description: 'Shift rA to left by M bytes',
        c: 6,
        t: 2,
        f: 0,
    },
    {
        name: 'SRA',
        description: 'Shift rA to right M bytes',
        c: 6,
        t: 2,
        f: 1,
    },
    {
        name: 'SLAX',
        description: 'Shift rAX to left by M bytes',
        c: 6,
        t: 2,
        f: 2,
    },
    {
        name: 'SRAX',
        description: 'Shift rAX to right by M bytes',
        c: 6,
        t: 2,
        f: 3,
    },
    {
        name: 'SLC',
        description: 'Shift rAX cyclic left M bytes',
        c: 6,
        t: 2,
        f: 4,
    },
    {
        name: 'SRC',
        description: 'Shift rAX cyclic right M bytes',
        c: 6,
        t: 2,
        f: 5,
    },
    {
        name: 'MOVE',
        description: 'Move F words to rI1',
        c: 7,
        t: (op) => 1 + 2 * op.f,
        f: 1,
    },
    {
        name: 'LDA',
        description: 'rA <- V',
        c: 8,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD1',
        description: 'rI1 <- V',
        c: 9,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD2',
        description: 'rI2 <- V',
        c: 10,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD3',
        description: 'rI3 <- V',
        c: 11,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD4',
        description: 'rI4 <- V',
        c: 12,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD5',
        description: 'rI5 <- V',
        c: 13,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD6',
        description: 'rI6 <- V',
        c: 14,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LDX',
        description: 'rX <- V',
        c: 15,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LDAN',
        description: 'rA <- -V',
        c: 16,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD1N',
        description: 'rI1 <- -V',
        c: 17,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD2N',
        description: 'rI2 <- -V',
        c: 18,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD3N',
        description: 'rI3 <- -V',
        c: 19,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD4N',
        description: 'rI4 <- -V',
        c: 20,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD5N',
        description: 'rI5 <- -V',
        c: 21,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LD6N',
        description: 'rI6 <- -V',
        c: 22,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'LDXN',
        description: 'rX <- -V',
        c: 23,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'STA',
        description: 'M(F) <- rA',
        c: 24,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST1',
        description: 'M(F) <- rI1',
        c: 25,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST2',
        description: 'M(F) <- rI2',
        c: 26,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST3',
        description: 'M(F) <- rI3',
        c: 27,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST4',
        description: 'M(F) <- rI4',
        c: 28,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST5',
        description: 'M(F) <- rI5',
        c: 29,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'ST6',
        description: 'M(F) <- rI6',
        c: 30,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'STX',
        description: 'M(F) <- rX',
        c: 31,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'STJ',
        description: 'M(F) <- rJ',
        c: 32,
        t: 2,
        f: _mix_field_encode(0, 2),
    },
    {
        name: 'STZ',
        description: 'M(F) <- 0',
        c: 33,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'JBUS',
        description: 'Device F is busy?',
        c: 34,
        t: 1,
        f: 0,
    },
    {
        name: 'IOC',
        description: 'IO control device F',
        c: 35,
        t: 1,
        f: 0,
    },
    {
        name: 'IN',
        description: 'Input from device F',
        c: 36,
        t: 1,
        f: 0,
    },
    {
        name: 'IN',
        description: 'Input from device F',
        c: 36,
        t: 1,
        f: 0,
    },
    {
        name: 'OUT',
        description: 'Output to device F',
        c: 37,
        t: 1,
        f: 0,
    },
    {
        name: 'JRED',
        description: 'Device F ready?',
        c: 38,
        t: 1,
        f: 0,
    },
    {
        name: 'JMP',
        description: 'Jump',
        c: 39,
        t: 1,
        f: 0,
    },
    {
        name: 'JSJ',
        description: 'Jump without changing rJ',
        c: 39,
        t: 1,
        f: 1,
    },
    {
        name: 'JOV',
        description: 'Jump on overflow',
        c: 39,
        t: 1,
        f: 2,
    },
    {
        name: 'JNOV',
        description: 'Jump on no overflow',
        c: 39,
        t: 1,
        f: 3,
    },
    {
        name: 'JL',
        description: 'Jump on less',
        c: 39,
        t: 1,
        f: 4,
    },
    {
        name: 'JE',
        description: 'Jump on equal',
        c: 39,
        t: 1,
        f: 5,
    },
    {
        name: 'JG',
        description: 'Jump on greater',
        c: 39,
        t: 1,
        f: 6,
    },
    {
        name: 'JGE',
        description: 'Jump on greater or equal',
        c: 39,
        t: 1,
        f: 7,
    },
    {
        name: 'JNE',
        description: 'Jump on not equal',
        c: 39,
        t: 1,
        f: 8,
    },
    {
        name: 'JLE',
        description: 'Jump on less or equal',
        c: 39,
        t: 1,
        f: 9,
    },
    ..._regCmpZeroJump(40, 'rA', 'JA'),
    ..._regCmpZeroJump(41, 'rI1', 'J1'),
    ..._regCmpZeroJump(42, 'rI2', 'J2'),
    ..._regCmpZeroJump(43, 'rI3', 'J3'),
    ..._regCmpZeroJump(44, 'rI4', 'J4'),
    ..._regCmpZeroJump(45, 'rI5', 'J5'),
    ..._regCmpZeroJump(46, 'rI6', 'J6'),
    ..._regCmpZeroJump(47, 'rX', 'JX'),
    ..._regDirectOps(48, 'rA', 'A'),
    ..._regDirectOps(49, 'rI1', '1'),
    ..._regDirectOps(50, 'rI2', '2'),
    ..._regDirectOps(51, 'rI3', '3'),
    ..._regDirectOps(52, 'rI4', '4'),
    ..._regDirectOps(53, 'rI5', '5'),
    ..._regDirectOps(54, 'rI6', '6'),
    ..._regDirectOps(55, 'rX', 'X'),
    {
        name: 'CMPA',
        description: 'CI <- rA(F): V',
        c: 56,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP1',
        description: 'CI <- rI1(F): V',
        c: 57,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP2',
        description: 'CI <- rI2(F): V',
        c: 58,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP3',
        description: 'CI <- rI3(F): V',
        c: 59,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP4',
        description: 'CI <- rI4(F): V',
        c: 60,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP5',
        description: 'CI <- rI5(F): V',
        c: 61,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMP6',
        description: 'CI <- rI6(F): V',
        c: 62,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
    {
        name: 'CMPX',
        description: 'CI <- rX(F): V',
        c: 63,
        t: 2,
        f: _mix_field_encode(0, 5),
    },
];

function getOpCode(code: number, field: number): MixOpCode | undefined {
    const codes = MixOpCodes.filter((op) => op.c === code);
    if (codes.length === 0) return undefined;
    if (codes.length === 1) return codes[0];
    return codes.find((op) => op.f === field);
}