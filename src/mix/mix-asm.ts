/**
 * The MIX assembly language parser.
 */
import {F_OP_ADDR, F_OP_F, F_OP_I, MIX_BYTE_MAX, MIX_WORD_SIZE, MixWord} from "./mix-word.ts";
import {MixOpCodeMap} from "./mix-opcodes.ts";
import {encode} from "./mix-chars.ts";

export interface MixSourceLine {
    lineNo: number;
    line: string;
    loc: string;
    op: string;
    addr: string;
}

export interface MixSection {
    offset: number;
    data: MixWord[];
    memory: MixWord[];
    lines: MixSourceLine[];
}

export interface MixProgram {
    start: number; // program start address,
    sections: MixSection[];
}

// @ts-ignore
type Op = '+' | '-' | '*' | '/' | '//' | ':';
type SymTable = Record<string, number>;
interface Literal {
    value: number;
    op: MixWord;
}
interface Token {
    value: Op|string|number;
    type: 'op'|'symbol'|'number';
}

// @ts-ignore
function isOp(s: string): boolean {
    return ['+', '-', '*', '/', '//', ':'].indexOf(s) !== -1;
}
function isDigit(s: string): boolean {
    return /\d/.test(s);
}
function isAlpabet(s: string): boolean {
    return /[a-z]/i.test(s);
}
function isEmpty(s: string): boolean {
    return s.length === 0;
}
function isLocalSymbol(s: string, define: boolean = true): boolean {
    return define ? /\dh/i.test(s) : /\d[fb]/i.test(s);
}
function isWhitespace(c: string) {
    return /\s/.test(c);
}

interface EvalContext {
    counter: number;
    symbols: SymTable;
    locals: Record<number, number[]>;
    unresolvedReferences: string[];
}
type OptionalNumber = number|undefined;
abstract class Expr {
    eval(_: EvalContext): OptionalNumber {
        return undefined;
    }
}
class NumberExpr extends Expr {
    private _value: number;
    constructor(value: number) {
        super();
        this._value = value;
    }
    eval(_: EvalContext): OptionalNumber {
        return this._value;
    }
}
class SymbolExpr extends Expr{
    private _sym: string;
    constructor(symbol: string) {
        super();
        this._sym = symbol;
    }
    eval(ctx: EvalContext): OptionalNumber {
        if (isLocalSymbol(this._sym, false)) {
            // referencing a local symbol
            return this.resolveLocal(ctx);
        }
        if (!ctx.symbols[this._sym]) {
            ctx.unresolvedReferences.push(this._sym);
        }
        return ctx.symbols[this._sym];
    }

    private resolveLocal(ctx: EvalContext) {
        const d = parseInt(this._sym[0]);
        let value: OptionalNumber = undefined;
        if (d in ctx.locals) {
            const dir = this._sym[1].toLowerCase();
            const values = ctx.locals[d];
            if (dir === 'f') {
                // find smallest value greater than counter
                for (let i = values.length - 1; i >= 0; i--) {
                    if (values[i] > ctx.counter) value = values[i];
                    else break;
                }
            } else if (dir === 'b') {
                // find largest value smaller than counter
                for (let i = 0; i < values.length; i++) {
                    if (values[i] < ctx.counter) value = values[i];
                    else break;
                }
            }
        }
        if (value === undefined) {
            ctx.unresolvedReferences.push(this._sym);
        }
        return value;
    }
}
class StarExpr extends Expr{
    eval(ctx: EvalContext): OptionalNumber {
        return ctx.counter;
    }
}
type AtomicExpr = NumberExpr | SymbolExpr | StarExpr;
class UnaryExpr extends Expr{
    private _sign: string;
    private _expr: AtomicExpr;
    constructor(sign: '+'|'-', expr: AtomicExpr) {
        super();
        this._sign = sign;
        this._expr = expr;
    }
    eval(ctx: EvalContext): OptionalNumber {
        const v = this._expr.eval(ctx);
        if (v) {
            return this._sign == '-' ? -v : v;
        }
    }
}
class BinaryExpr extends Expr {
    private _lhs: Expr;
    private _op: Op;
    private _rhs: Expr;
    constructor(lhs: Expr, op: Op, rhs: Expr) {
        super();
        this._lhs = lhs;
        this._op = op;
        this._rhs = rhs;
    }
    eval(ctx: EvalContext): OptionalNumber {
        const lv = this._lhs.eval(ctx);
        const rv = this._rhs.eval(ctx);
        if (lv && rv) {
            switch (this._op) {
                case '+': return lv + rv;
                case '-': return lv - rv;
                case '*': return lv * rv;
                case '/': return Math.floor(lv / rv);
                case '//': return Math.floor(Math.pow(MIX_BYTE_MAX, MIX_WORD_SIZE) * lv / rv);
                case ':': return lv * 8 + rv;
            }
        }
    }
}
class OptExpr extends Expr {
    private readonly _expr?: Expr;
    constructor(expr?: Expr) {
        super();
        this._expr = expr;
    }
    eval(ctx: EvalContext): OptionalNumber {
        return this._expr?.eval(ctx);
    }
}
class AExpr extends OptExpr {
    readonly literal: boolean;
    constructor(literal: boolean, expr?: Expr) {
        super(expr);
        this.literal = literal;
    }
}
class IExpr extends OptExpr {
    constructor(expr?: Expr) {
        super(expr);
    }
}
class FExpr extends OptExpr {
    constructor(expr?: Expr) {
        super(expr);
    }
}
class WValueExpr extends Expr {
    private _prev?: WValueExpr;
    private _v: Expr;
    private _f: FExpr;
    constructor(v: Expr, f: FExpr, prev?: WValueExpr) {
        super();
        this._prev = prev;
        this._v = v;
        this._f = f;
    }
    eval(ctx: EvalContext): OptionalNumber {
        const w: MixWord = new MixWord(this._prev?.eval(ctx));
        const v = new MixWord(this._v.eval(ctx));
        const f = this._f.eval(ctx);
        w.store(v, f);
        return w.value;
    }
}

export class Parser {
    private readonly _expr: string;
    private _i: number;
    private _n: number;
    constructor(expr: string) {
        this._expr = expr;
        this._i = 0;
        this._n = expr.length;
    }
    parseAExpr(): AExpr {
        if (!this.hasNext() || this.peek([',', '('])) return new AExpr(false, new NumberExpr(0));
        if (this.char() === '=') {
            // literal
            this.advance();
            const expr = this.parseWValueExpr();
            this.consume('=');
            return new AExpr(true, expr);
        }
        const expr = this.parseExpr();
        return new AExpr(false, expr);
    }
    parseIExpr(): IExpr {
        if (!this.hasNext() || this.peek(['('])) return new IExpr();
        this.consume(',');
        const expr = this.parseExpr();
        return new IExpr(expr);
    }
    parseFExpr(): FExpr {
        if (!this.hasNext() || this.peek([',', '='])) return new FExpr();
        this.consume('(');
        const expr = this.parseExpr();
        this.consume(')');
        return new FExpr(expr);
    }
    parseWValueExpr(prev?: WValueExpr): WValueExpr {
        const expr = this.parseExpr();
        const f = this.parseFExpr();
        const wexpr = new WValueExpr(expr, f, prev);
        if (this.hasNext() && this.peek([','])) {
            this.advance();
            return this.parseWValueExpr(wexpr);
        }
        return wexpr;
    }
    private parseExpr(): Expr {
        let expr: Expr|null = null;
        let op: Op|null = null;
        let unaryOp: '+'|'-'|null = null;
        while (this.hasNext() && !this.peek([',', '(', ')', '=', ' '])) {
            const token = this.next();
            switch (token.type) {
                case 'number':
                    {
                        let t: Expr = new NumberExpr(token.value as number);
                        if (unaryOp !== null) {
                            t = new UnaryExpr(unaryOp, t);
                            unaryOp = null;
                        }
                        if (expr !== null && op !== null) {
                            expr = new BinaryExpr(expr, op, t);
                            op = null;
                        } else {
                            expr = t;
                        }
                    }
                    break;
                case 'symbol':
                    {
                        let t: Expr = new SymbolExpr(token.value as string);
                        if (unaryOp !== null) {
                            t = new UnaryExpr(unaryOp, t);
                            unaryOp = null;
                        }
                        if (expr !== null && op !== null) {
                            expr = new BinaryExpr(expr, op, t);
                            op = null;
                        } else {
                            expr = t;
                        }
                    }
                    break;
                case 'op':
                    if (expr === null || op !== null) {
                        if (token.value === '*') {
                            // expr is null or op is not null,
                            const t: Expr = new StarExpr();
                            if (expr === null) {
                                expr = t;
                            } else {
                                expr = new BinaryExpr(expr, op!, t);
                            }
                            break;
                        }
                        if (token.value !== '+' && token.value != '-') {
                            throw new Error('Unary operator must be + or -.');
                        }
                        unaryOp = token.value as '+'|'-';
                    } else {
                        op = token.value as Op;
                    }
                    break;
            }
        }
        if (expr === null) throw new Error('No expression found.');
        return expr;
    }
    private char(): string {
        return this._expr[this._i];
    }
    private advance() {
        this._i++;
    }
    private peek(expected: string[]) {
        return !!expected.find(c => c === this.char());
    }
    private consume(expected: string) {
        if (this.char() === expected) this.advance();
        else throw new Error(`Unknown char ${this.char()} at ${this._i} in ${this._expr}, expected "${expected}"`);
    }
    private next(): Token {
        if (!this.hasNext()) throw new Error(`No more input.`);
        const expr = this._expr;
        const n = this._n;

        let i = this._i;
        const ch0 = expr[i++];
        if (isOp(ch0)) {
            // next operator
            let op = ch0;
            if (ch0 === '/' && expr[i] == '/') {
                // special treatment for '//'
                this._i = i + 1;
                op = '//';
            } else {
                this._i = i;
            }
            return {value: op, type: 'op'};
        }
        if (isDigit(ch0)) {
            let isNumber = true;
            const chars: string[] = [ch0];
            while (i < n && (isDigit(expr[i]) || isAlpabet(expr[i]))) {
                chars.push(expr[i]);
                if (isAlpabet(expr[i])) {
                    isNumber = false;
                }
                i++;
            }
            this._i = i;
            const value = isNumber ? parseInt(chars.join('')) : chars.join('');
            return { value, type: isNumber ? 'number' : 'symbol' };
        }
        if (isAlpabet(ch0)) {
            const chars: string[] = [ch0];
            while (i < n && (isDigit(expr[i]) || isAlpabet(expr[i]))) {
                chars.push(expr[i++]);
            }
            this._i = i;
            return {value: chars.join(''), type: 'symbol'};
        }
        throw new Error(`Unknown input at ${i}: ${ch0} in "${this._expr}".`);
    }
    private hasNext(): boolean {
        return this._i < this._n;
    }
}


// parse line into LOC, OP and ADDRESS
// LOC OP and ADDRESS should not contain whitespaces.
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

interface UnresolvedReference {
    // counter value at the moment where the op is defined.
    counter: number,
    op: MixWord,
    aExpr: AExpr,
    iExpr: IExpr,
    fExpr: FExpr,
    undefinedSymbols: string[],
}

class MIXAssembler {
    private readonly _source;
    private readonly _symbols: SymTable;
    private readonly _locals: Record<number, number[]>;
    private readonly _literals: Literal[];
    private _unresolvedReferences: UnresolvedReference[];
    private _mixProgram: MixProgram|undefined;
    private _counter: number; // the unit counter referred to as '*'
    // @ts-ignore
    private _line: string;
    // @ts-ignore
    private _lineNo: number;

    constructor(program: string) {
        this._source = program;
        this._symbols = {};
        this._locals = {};
        this._literals = [];
        this._unresolvedReferences = [];
        this._counter = 0;
        this._line = '';
        this._lineNo = -1;
    }

    compile() {
        const sections: MixSection[] = [];
        let cur: MixSection = {
            offset: 0,
            data: [],
            memory: [],
            lines: [],
        };
        let start: number = 0;
        this._source.split('\n').forEach((line, lineIndex) => {
            this._line = line;
            this._lineNo = lineIndex + 1;

            if (/^\s*\*/.test(line)) return; // ignore comments
            if (/^\s*$/.test(line)) return; // ignore empty lines

            let {loc, op, addr} = parseLine(line);

            const parser = new Parser(addr);
            if (op === 'EQU') {
                const v = parser.parseWValueExpr().eval(this.context)!;
                this.defineSymbol(loc, v);
            } else if (op === 'ORIG') {
                this.defineSymbol(loc, this._counter);
                this._counter = parser.parseWValueExpr().eval(this.context)!;
                if (cur.data.length === 0) {
                    cur.offset = this._counter;
                } else {
                    sections.push(cur);
                    cur = {
                        offset: this._counter,
                        data: [],
                        memory: [],
                        lines: []
                    }
                }
            } else if (op === 'CON') {
                this.defineSymbol(loc, this._counter);
                const w = new MixWord(parser.parseWValueExpr().eval(this.context));
                cur.data.push(w);
                cur.lines.push({lineNo: this._lineNo, line: this._line, loc, op, addr});
                this._counter++;
            } else if (op === 'ALF') {
                this.defineSymbol(loc, this._counter);
                cur.data.push(MixWord.fromBytes([1, ...encode(addr)]));
                cur.lines.push({lineNo: this._lineNo, line: this._line, loc, op, addr});
                this._counter++;
            } else if (op === 'END') {
                for (const lit of this._literals) {
                    cur.data.push(new MixWord(lit.value));
                    cur.lines.push({lineNo: this._lineNo, line: `CON ${lit.value}`, loc: '', op: 'CON', addr: `${lit.value}`});
                    lit.op.store(new MixWord(this._counter++), F_OP_ADDR);
                }
                this.defineSymbol(loc, this._counter);
                for (const {undefinedSymbols} of this._unresolvedReferences) {
                    for (const symbol of undefinedSymbols) {
                        cur.data.push(new MixWord());
                        cur.lines.push({lineNo: this._lineNo, line: `${symbol} CON 0`, loc: symbol, op: 'CON', addr: '0'});
                        this.defineSymbol(symbol, this._counter++);
                    }
                }
                this.tryFixUnresolvedReferences()
                sections.push(cur);
                start = parser.parseWValueExpr().eval(this.context)!;
            } else if (op in MixOpCodeMap) {
                this.defineSymbol(loc, this._counter);
                this.defineLocal(loc, this._counter);
                const opcode = MixOpCodeMap[op];
                const aExpr = parser.parseAExpr();
                const iExpr = parser.parseIExpr();
                const fExpr = parser.parseFExpr();
                let ctx = this.context;
                const a = aExpr.eval(ctx);
                const i = iExpr.eval(ctx) || 0;
                const f = fExpr.eval(ctx) || opcode.f;
                const w = MixWord.fromOp(a === undefined ? -1 : a, i, f, opcode.c);
                if (ctx.unresolvedReferences.length > 0) {
                    this._unresolvedReferences.push({
                        aExpr,
                        fExpr,
                        iExpr,
                        op: w,
                        counter: this._counter,
                        undefinedSymbols: ctx.unresolvedReferences,
                    });
                }
                if (aExpr.literal) {
                    if (!a) throw new Error('Undefined A literal value.');
                    this._literals.push({
                        op: w,
                        value: a
                    })
                }
                cur.data.push(w);
                cur.lines.push({lineNo: this._lineNo, line: this._line, loc, op, addr});
                this._counter++
            }
            this.tryFixUnresolvedReferences();
        });
        if (this._unresolvedReferences.length > 0) {
            throw new Error('Unresolved references: ' + this._unresolvedReferences);
        }
        this._mixProgram = {start, sections};
        return this._mixProgram;
    }

    get context(): EvalContext {
        return {
            counter: this._counter,
            symbols: this._symbols,
            locals: this._locals,
            unresolvedReferences: [],
        }
    }
    private defineLocal(sym: string, value: number) {
        if (!isLocalSymbol(sym)) return;
        const d = parseInt(sym[0]);
        if (!(d in this._locals)) this._locals[d] = [];
        this._locals[d].push(value);
    }
    private defineSymbol(sym: string, value: number) {
        if (isEmpty(sym)) return;
        if (isLocalSymbol(sym)) return;
        if (sym in this._symbols) {
            throw new Error(`Redefinition of symbol ${sym}, existing value: ${this._symbols[sym]}`);
        }
        this._symbols[sym] = value;
    }
    private tryFixUnresolvedReferences() {
        const newList: UnresolvedReference[] = [];
        for (const {counter, op, aExpr, iExpr, fExpr, undefinedSymbols} of this._unresolvedReferences) {
            const ctx = this.context;
            ctx.counter = counter;
            const a = aExpr.eval(ctx);
            const i = iExpr.eval(ctx) || 0;
            const f = fExpr.eval(ctx) || op.load(F_OP_F).value;
            if (ctx.unresolvedReferences.length > 0) {
                newList.push({counter, op, aExpr, iExpr, fExpr, undefinedSymbols});
            } else {
                op.store(new MixWord(a), F_OP_ADDR);
                op.store(new MixWord(i), F_OP_I);
                op.store(new MixWord(f), F_OP_F);
            }
        }
        this._unresolvedReferences = newList;
    }
}

export function compile(program: string): MixProgram {
    const asm = new MIXAssembler(program);
    return asm.compile();
}