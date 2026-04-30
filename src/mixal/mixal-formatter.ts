// A simple formatter of MIXAL

import {MIX_WORD_SIZE} from "../emulator/mix-word.ts";

export interface MixalLine {
    loc: string;
    op: string;
    addr: string;
    comment: string;
    lineComment?: string;
}

export function formatMixal(mixalCode: string): string {
    const lines = mixalCode.split("\n").map(parseLine);
    const widths = lines.map(code => {
        return {loc: code.loc.length + 1, op: code.op.length + 1, addr: code.addr.length + 1}
    }).reduce((prev, cur) => {
        return {
            loc: Math.max(prev.loc, cur.loc),
            op: Math.max(prev.op, cur.op),
            addr: Math.max(prev.addr, cur.addr),
        }
    }, {loc: 0, op: 0, addr: 0});

    return lines.map(code => {
        return {
            loc: code.loc.padEnd(widths.loc, ' '),
            op: code.op !== 'ALF' ? code.op.padEnd(widths.op, ' ') : 'ALF ',
            addr: code.addr.padEnd(widths.addr, ' '),
            comment: code.comment,
            lineComment: code.lineComment,
        }
    }).map(code => (code.lineComment || `${code.loc}${code.op}${code.addr}${code.comment}`).trimEnd())
        .join('\n');
}

function isWhitespace(c: string) {
    return /\s/.test(c);
}

// parse line into LOC, OP, ADDRESS and COMMENT
export function parseLine(line: string): MixalLine {
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
    if (line.startsWith('*')) {
        return {
            loc: '', op: '', addr: '', comment: '', lineComment: line
        }
    }
    const locStart = 0;
    const locEnd = nextWhitespace(locStart);
    const loc = line.substring(locStart, locEnd);

    const opStart = skipWhitespaces(locEnd);
    const opEnd = nextWhitespace(opStart);
    const op = line.substring(opStart, opEnd).toUpperCase();

    let addr: string = '';
    let comment: string = '';
    if (op === 'ALF') {
        // "ALF" should followed by a space and five characters
        const alfTextStart = opEnd + 1;
        const alfTextEnd = Math.min(alfTextStart + MIX_WORD_SIZE, line.length);
        addr = line.substring(alfTextStart, alfTextEnd).padStart(MIX_WORD_SIZE, ' ');
        if (alfTextEnd < line.length) {
            comment = line.substring(skipWhitespaces(alfTextEnd));
        }
    } else if (op === 'HLT' || op === 'NOP') {
        addr = '';
        comment = line.substring(skipWhitespaces(opEnd));
    } else {
        const addrStart = skipWhitespaces(opEnd);
        const addrEnd = nextWhitespace(addrStart);
        addr = line.substring(addrStart, addrEnd);
        comment = line.substring(skipWhitespaces(addrEnd));
    }
    return {loc, op, addr, comment};
}