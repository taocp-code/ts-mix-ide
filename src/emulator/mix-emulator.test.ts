import {expect, test} from 'vitest';
import {MixEmulator} from "./mix-emulator.ts";
import type {MixProgram} from "./mix-asm.ts";
import {MixWord} from "./mix-word.ts";
import {MixOpCodeMap, MixOpCodes} from "./mix-opcodes.ts";

function op(name: string, a: number = 0, i?: number, f?: number) {
    const opcode = MixOpCodeMap[name];
    return MixWord.fromOp(a, i || 0, f || opcode.f, opcode.c);
}

function makeMixProgram(data: MixWord[], text: MixWord[], textOffset: number = 3000, dataOffset: number = 0): MixProgram {
    return {
        start: textOffset,
        sections: [
            {
                offset: dataOffset,
                data,
                lines: [],
                memory: [],
            },
            {
                offset: textOffset,
                data: [...text, op('HLT')],
                lines: [],
                memory: [],
            }
        ]
    }
}

function addTwoNumbers(a: number, b: number): MixProgram {
    return makeMixProgram(
        [
            new MixWord(a), // 0
            new MixWord(b), // 1
        ],
        [
            op('LDA', 0),
            op('ADD', 1),
        ]);
}

function subTwoNumbers(a: number, b: number): MixProgram {
    return makeMixProgram(
        [
            new MixWord(a), // 0
            new MixWord(b), // 1
        ],
        [
            op('LDA', 0),
            op('SUB', 1),
        ]);
}

function mulTwoNumbers(a: number, b: number): MixProgram {
    return makeMixProgram(
        [
            new MixWord(a),
            new MixWord(b),
        ],
        [
            op('LDA', 0),
            op('MUL', 1)
        ]
    )
}

function divTwoNumbers(a: number, b: number): MixProgram {
    return makeMixProgram(
        [
            new MixWord(a),
            new MixWord(b),
        ],
        [
            op('ENTA', 0),
            op('LDX', 0),
            op('DIV', 1),
        ]
    )
}

function runMixProgram(mix: MixEmulator, program: MixProgram) {
    mix.reset();
    mix.loadProgram(program);
    mix.run();
}

test('arithmetic operations - add', () => {
    const mix = new MixEmulator();
    runMixProgram(mix, addTwoNumbers(1, 2));
    expect(mix.rA.value).toEqual(3);
    expect(mix.overflow).toBe(false);

    runMixProgram(mix, addTwoNumbers(1000, -24));
    expect(mix.rA.value).toEqual(976);
    expect(mix.overflow).toBe(false);

    runMixProgram(mix, addTwoNumbers(MixWord.MAX_VALUE, 1));
    expect(mix.overflow).toBe(true);
});

test('arithmetic operations - sub', () => {
    const mix = new MixEmulator();
    runMixProgram(mix, subTwoNumbers(10, 1192));
    expect(mix.rA.value).toEqual(-1182);
});

test('arithmetic operations - mul', () => {
    const mix = new MixEmulator();
    runMixProgram(mix, mulTwoNumbers(412, -18));
    expect(mix.rA.value).toEqual(-0);
    expect(mix.rX.value).toEqual(412 * -18);
});

test('arithmetic operations - div', () => {
    const mix = new MixEmulator();
    runMixProgram(mix, divTwoNumbers(17, 3));
    expect(mix.rA.value).toEqual(5);
    expect(mix.rX.value).toEqual(2);

    runMixProgram(mix, divTwoNumbers(1234000301, -20));
    expect(mix.rA.value).toEqual(-61700015);
    expect(mix.rX.value).toEqual(1);

    runMixProgram(mix, divTwoNumbers(17, 0));
    expect(mix.overflow).toBe(true);
});

test('shift operations', () => {
    const mix = new MixEmulator();
    const rAs: MixWord[] = [];
    const rXs: MixWord[] = [];
    mix.rA.onChange((e) => {
        rAs.push(new MixWord(e.word.value));
    });
    mix.rX.onChange((e) => {
        rXs.push(new MixWord(e.word.value));
    });
    runMixProgram(mix, makeMixProgram([
        MixWord.fromBytes([1, 1, 2, 3, 4, 5]),
        MixWord.fromBytes([1, 6, 7, 8, 9, 10]),
    ], [
        op('LDA', 0),
        op('LDX', 1),
        op('SRAX', 1),
        op('SLA', 2),
        op('SRC', 4),
        op('SRA', 2),
        op('SLC', 501),
    ]));
});

test('all operations - implemented', () => {
    const mix = new MixEmulator();
    const ops: string[] = [];
    for (const opcode of MixOpCodes) {
        if (opcode.name === 'FADD' || opcode.name === 'FSUB' || opcode.name === 'FMUL' || opcode.name === 'FDIV') continue;
        mix.reset();
        mix.memory.store(0, MixWord.fromOp(0, 0, opcode.f, opcode.c))
        try {
            mix.step();
        } catch (err) {
            ops.push(opcode.name);
        }
    }
    console.log(ops);
    expect(ops.length).toEqual(0);
});