/**
 * The MIX assembly language parser.
 */
import {F_ALL, MIX_WORD_SIZE, MixWord} from "./mix-word.ts";

export interface MIXSection {
    offset: number;
    data: MixWord[];
}

export interface MIXProgram {
    start: number; // program start address,
    sections: MIXSection[];
}

function isWhitespace(c: string) {
    return /\s/.test(c);
}

// parse line into LOC, OP and ADDRESS
function parseLine(line: string) {
    const nextWhitespace = (i: number) => {
        while (i < line.length && !isWhitespace(line[i]))
            i++;
        return i;
    }
    const skipWhitespaces = (i: number) => {
        while (i < line.length && isWhitespace(line[i]))
            i++;
        return i;
    };
    const locStart = 0;
    const locEnd = nextWhitespace(locStart);
    const loc = line.substring(locStart, locEnd);

    const opStart = skipWhitespaces(locEnd);
    const opEnd = nextWhitespace(opStart);
    const op = line.substring(opStart, opEnd).toUpperCase();

    let addr: string = '';
    if (op === 'ALF') {
        // "ALF" should followed by a space and five characters
        addr = line.substring(opEnd + 1, Math.min(opEnd + 1 + MIX_WORD_SIZE, line.length)).padStart(MIX_WORD_SIZE, ' ');
    } else {
        const addrStart = skipWhitespaces(opEnd);
        const addrEnd = nextWhitespace(addrStart);
        addr = line.substring(addrStart, addrEnd);
    }
    return {loc, op, addr};
}

function parseExpr(expr: string, symbols: Record<string, number>) : {v: MixWord, f: number} {
    let v = 0;
    let f = F_ALL;

    const F_PATTERN =/([^(]+)\(([^)]+)\)$/;
    const match = F_PATTERN.exec(expr);
    if (match) {
        // has F part
        const vval = parseExpr(match[1], symbols);
        const fval = parseExpr(match[2], symbols);
        f = fval.v.value;
        return {v: vval.v, f};
    }
    if (expr.length !== 0) {

    }
    return {v: new MixWord(v), f};
}

function parseWValue(s: string, symbols: Record<string, number>): number {
    const exprs = s.split(/,/);
    let value = new MixWord();
    exprs.forEach(expr => {
        const {v, f} = parseExpr(expr, symbols);
        value.store(v, f);
    });
    return value.value;
}

export function compile(program: string): MIXProgram {
    const sections: MIXSection[] = [];
    let start: number = 0;
    // Symbol table.
    const symbols: Record<string, number> = {};

    program.split('\n').forEach(line => {
        if (/^\s*\*/.test(line)) return; // ignore comments
        if (/^\s*$/.test(line)) return; // ignore empty lines
        let {loc, op, addr} = parseLine(line);
        if (op === 'EQU') {
            if (loc !== '') {
                symbols[loc] = parseWValue(addr, symbols);
            }
        }
        console.log({loc, op, addr})
    });

    return { start, sections };
}