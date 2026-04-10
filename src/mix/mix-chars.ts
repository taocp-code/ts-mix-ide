export const CHARS: string = ' ABCDEFGHIΔJKLMNOPQRΣΠSTUVWXYZ0123456789.,()+-*/=$<>@;:`';
export const NUMS: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) {
    NUMS[CHARS[i]] = i;
}

export function decode(bytes: number[]) {
    return bytes.map(b => CHARS[b]).join('');
}

export function encode(s: string) {
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) {
        bytes.push(NUMS[s[i]]);
    }
    return bytes;
}