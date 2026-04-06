import {expect, test} from 'vitest';
import {_mix_field_encode, F_ALL, F_SIGN, MixWord} from "./mix-word.ts";

test('mix word - construct from number', () => {
    let w = new MixWord(-42);
    expect(w.sign).toBe(-1);
    expect(w.abs).toBe(42);
    expect(w.value).toBe(-42)
});

test('mix word - construct value too large', () => {
    expect(() => new MixWord(MixWord.MAX_VALUE + 1)).toThrow();
    expect(() => new MixWord(-MixWord.MAX_VALUE - 1)).toThrow();
})

test('mix word - construct from byte array', () => {
    let w = MixWord.fromBytes([0x00, 0x00, 0x00, 0x01, 0x02, 0x03]);
    expect(w.sign).toBe(1);
    expect(w.abs).toBe(10203);
});

test('mix word - load', () => {
    let w = new MixWord(-65543712);
    expect(w.load(F_ALL)).toStrictEqual(new MixWord(-65543712));
    expect(w.load(F_SIGN)).toStrictEqual(MixWord.fromBytes([-1, 0, 0, 0, 0, 0]));
    expect(w.load(_mix_field_encode(1, 5))).toStrictEqual(new MixWord(w.abs));

    w = MixWord.fromBytes([1, 99, 0, 1, 2, 13]);
    expect(w.load(_mix_field_encode(1, 3))).toStrictEqual(new MixWord(990001));

    w = new MixWord(w.value, '', 4);
    expect(w.load(_mix_field_encode(1, 3))).toStrictEqual(new MixWord(0));
    expect(w.load(_mix_field_encode(3, 5))).toStrictEqual(MixWord.fromBytes([1, 0, 0, 0, 2, 13]))
});

test('mix word - store', () => {
    const v = MixWord.fromBytes([1, 6, 7, 8, 9, 0]);
    const w = MixWord.fromBytes([-1, 1, 2, 3, 4, 5]);
    expect(w.load().store(v)).toStrictEqual(MixWord.fromBytes([1, 6, 7, 8, 9, 0]));
    expect(w.load().store(v, _mix_field_encode(1, 5))).toStrictEqual(MixWord.fromBytes([-1, 6, 7, 8, 9, 0]));
    expect(w.load().store(v, _mix_field_encode(5, 5))).toStrictEqual(MixWord.fromBytes([-1, 1, 2, 3, 4, 0]));
    expect(w.load().store(v, _mix_field_encode(2, 2))).toStrictEqual(MixWord.fromBytes([-1, 1, 0, 3, 4, 5]));
    expect(w.load().store(v, _mix_field_encode(2, 3))).toStrictEqual(MixWord.fromBytes([-1, 1, 9, 0, 4, 5]));
    expect(w.load().store(v, _mix_field_encode(0, 1))).toStrictEqual(MixWord.fromBytes([1, 0, 2, 3, 4, 5]));
});
