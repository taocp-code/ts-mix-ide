export const CHARS: string = ' ABCDEFGHIΔJKLMNOPQRΣΠSTUVWXYZ0123456789.,()+-*/=$<>@;:`';
export const NUMS: Record<string, number> = {};
for (let i = 0; i < CHARS.length; i++) {
    NUMS[CHARS[i]] = i;
}

export function decodeToMixChars(bytes: number[]) {
    return bytes.map(b => CHARS[b]).join('');
}

export function encodeToMixBytes(s: string) {
    const bytes: number[] = [];
    for (let i = 0; i < s.length; i++) {
        bytes.push(NUMS[s[i]]);
    }
    return bytes;
}

export function clean(s: string): string {
    s = s.toUpperCase();
    const result: string[] = [];
    for (let i = 0; i < s.length; i++) {
        if (NUMS[s[i]] !== undefined) result.push(s[i]);
    }
    return result.join('');
}