
import type { Fraction, PrimeLimit, NotationSymbols, NodeData } from './types';
import { createLogger } from './utils/logger';

const log = createLogger('music-logic');

export const createFraction = (n: number | bigint, d: number | bigint = 1n): Fraction => ({
    n: BigInt(n),
    d: BigInt(d)
});

const gcd = (a: bigint, b: bigint): bigint => {
    let x = a;
    let y = b;
    while (y !== 0n) {
        const temp = y;
        y = x % y;
        x = temp;
    }
    return x;
};

const lcm = (a: bigint, b: bigint): bigint => {
    if (a === 0n || b === 0n) return 0n;
    const absA = a < 0n ? -a : a;
    const absB = b < 0n ? -b : b;
    return (absA * absB) / gcd(absA, absB);
};

export const simplify = (f: Fraction): Fraction => {
    const common = gcd(f.n < 0n ? -f.n : f.n, f.d);
    return { n: f.n / common, d: f.d / common };
};

export const multiply = (a: Fraction, b: Fraction): Fraction => ({
    n: a.n * b.n,
    d: a.d * b.d
});

export const divide = (a: Fraction, b: Fraction): Fraction => ({
    n: a.n * b.d,
    d: a.d * b.n
});

export const normalizeOctave = (f: Fraction): { ratio: Fraction; octaves: number } => {
    let { n, d } = f;
    let octaves = 0;

    if (n <= 0n || d <= 0n) return { ratio: f, octaves: 0 };

    while (n < d) {
        n *= 2n;
        octaves -= 1;
    }
    while (n >= d * 2n) {
        d *= 2n;
        octaves += 1;
    }
    return { ratio: { n, d }, octaves };
};

export const adjustOctave = (f: Fraction, shift: number): Fraction => {
    let { n, d } = f;
    if (shift > 0) {
        n *= (2n ** BigInt(shift));
    } else if (shift < 0) {
        d *= (2n ** BigInt(Math.abs(shift)));
    }
    return simplify({ n, d });
};

export const parseMathExpression = (str: string): bigint => {

    const f = parseGeneralRatio(str);

    return f.n;
};

export const parseGeneralRatio = (str: string): Fraction => {
    if (!str) return { n: 1n, d: 1n };

    const s = str.replace(/\s/g, '').replace(',', '.');

    const centsMatch = s.match(/^2\^(\(?[\d\.]+\)?)\/1200$/);
    if (centsMatch) {
        let valStr = centsMatch[1];
        if (valStr.startsWith('(') && valStr.endsWith(')')) valStr = valStr.slice(1, -1);
        const cents = parseFloat(valStr);
        if (!isNaN(cents)) {
            const val = Math.pow(2, cents / 1200);
            const precision = 10000000000n;
            const n = BigInt(Math.round(val * 10000000000));
            return simplify({ n, d: precision });
        }
    }

    const findSplit = (expr: string, ops: string[], dir: 'last' | 'first') => {
        let depth = 0;
        if (dir === 'last') {
            for (let i = expr.length - 1; i >= 0; i--) {
                if (expr[i] === ')') depth++;
                else if (expr[i] === '(') depth--;
                else if (depth === 0 && ops.includes(expr[i])) return i;
            }
        } else {
            for (let i = 0; i < expr.length; i++) {
                if (expr[i] === '(') depth++;
                else if (expr[i] === ')') depth--;
                else if (depth === 0 && ops.includes(expr[i])) return i;
            }
        }
        return -1;
    };

    const mdIdx = findSplit(s, ['*', '/'], 'last');
    if (mdIdx !== -1) {
        const op = s[mdIdx];
        const left = parseGeneralRatio(s.slice(0, mdIdx));
        const right = parseGeneralRatio(s.slice(mdIdx + 1));
        if (op === '/') return simplify(divide(left, right));
        return simplify(multiply(left, right));
    }

    const powIdx = findSplit(s, ['^'], 'first');
    if (powIdx !== -1) {
        const leftStr = s.slice(0, powIdx);
        const rightStr = s.slice(powIdx + 1);

        const baseFrac = parseGeneralRatio(leftStr);
        const expFrac = parseGeneralRatio(rightStr);

        const baseVal = Number(baseFrac.n) / Number(baseFrac.d);
        const expVal = Number(expFrac.n) / Number(expFrac.d);

        if (baseFrac.d === 1n && expFrac.d === 1n && expFrac.n >= 0n) {
            return { n: baseFrac.n ** expFrac.n, d: 1n };
        }

        const val = Math.pow(baseVal, expVal);
        const precision = 10000000000n;
        const n = BigInt(Math.round(val * 10000000000));
        return simplify({ n, d: precision });
    }

    if (s.startsWith('(') && s.endsWith(')')) {
        return parseGeneralRatio(s.slice(1, -1));
    }

    try {
        if (s.includes('.')) {
            const val = parseFloat(s);
            if (!isNaN(val)) {
                // Check for recurring .333... or .666...
                const decimalPart = s.split('.')[1] || '';
                if (decimalPart.length >= 3) {
                    if (/^3+$/.test(decimalPart) || /^3+4$/.test(decimalPart)) { // .333... or .3334 (rounding)
                        const intPart = BigInt(s.split('.')[0]);
                        return simplify({ n: intPart * 3n + 1n, d: 3n });
                    }
                    if (/^6+$/.test(decimalPart) || /^6+7$/.test(decimalPart)) { // .666... or .6667
                        const intPart = BigInt(s.split('.')[0]);
                        return simplify({ n: intPart * 3n + 2n, d: 3n });
                    }
                }

                const precision = 10000000000n;
                const n = BigInt(Math.round(val * 10000000000));
                return simplify({ n, d: precision });
            }
        }
        const n = BigInt(s);
        return { n, d: 1n };
    } catch (e) {
        return { n: 0n, d: 1n };
    }
};

const SAFE_FUNCTIONS: Record<string, (...args: number[]) => number> = {
    sqrt: Math.sqrt,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    abs: Math.abs,
    log: Math.log,
    log10: Math.log10 ? Math.log10 : (x) => Math.log(x) / Math.LN10,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
};

const SAFE_CONSTANTS: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
};

const normalizeMathExpression = (input: string): string => {
    if (!input) return '';
    let s = input.trim();
    s = s.replace(/\s+/g, '');
    s = s.replace(/Math\./gi, '');
    s = s.replace(/\*\*/g, '^');
    return s.toLowerCase();
};

type MathToken =
    | { type: 'number'; value: number }
    | { type: 'identifier'; value: string }
    | { type: 'operator'; value: string }
    | { type: 'paren'; value: '(' | ')' }
    | { type: 'comma' }
    | { type: 'eof' };

const tokenizeMath = (input: string): MathToken[] => {
    const tokens: MathToken[] = [];
    let i = 0;
    while (i < input.length) {
        const ch = input[i];
        if (ch === ' ') {
            i += 1;
            continue;
        }
        const rest = input.slice(i);
        const numMatch = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+\-]?\d+)?/);
        if (numMatch) {
            tokens.push({ type: 'number', value: Number(numMatch[0]) });
            i += numMatch[0].length;
            continue;
        }
        if (/[a-zA-Z_]/.test(ch)) {
            const idMatch = rest.match(/^[a-zA-Z_][a-zA-Z_0-9]*/);
            const id = idMatch ? idMatch[0] : ch;
            tokens.push({ type: 'identifier', value: id.toLowerCase() });
            i += id.length;
            continue;
        }
        if ('+-*/^'.includes(ch)) {
            tokens.push({ type: 'operator', value: ch });
            i += 1;
            continue;
        }
        if (ch === '(' || ch === ')') {
            tokens.push({ type: 'paren', value: ch });
            i += 1;
            continue;
        }
        if (ch === ',') {
            tokens.push({ type: 'comma' });
            i += 1;
            continue;
        }
        throw new Error(`Invalid character "${ch}"`);
    }
    tokens.push({ type: 'eof' });
    return tokens;
};

const parseSafeMath = (input: string): number => {
    const tokens = tokenizeMath(input);
    let pos = 0;

    const peek = () => tokens[pos];
    const next = () => tokens[pos++];

    const expectParen = (value: '(' | ')') => {
        const token = next();
        if (token.type !== 'paren' || token.value !== value) {
            throw new Error(`Expected "${value}"`);
        }
    };

    const parsePrimary = (): number => {
        const token = next();
        if (token.type === 'number') return token.value;
        if (token.type === 'identifier') {
            const id = token.value;
            if (peek().type === 'paren' && (peek() as any).value === '(') {
                expectParen('(');
                const args: number[] = [];
                if (!(peek().type === 'paren' && (peek() as any).value === ')')) {
                    args.push(parseExpression());
                    while (peek().type === 'comma') {
                        next();
                        args.push(parseExpression());
                    }
                }
                expectParen(')');
                const fn = SAFE_FUNCTIONS[id];
                if (!fn) throw new Error(`Unknown function "${id}"`);
                return fn(...args);
            }
            if (id in SAFE_CONSTANTS) return SAFE_CONSTANTS[id];
            throw new Error(`Unknown identifier "${id}"`);
        }
        if (token.type === 'paren' && token.value === '(') {
            const val = parseExpression();
            expectParen(')');
            return val;
        }
        throw new Error('Unexpected token');
    };

    const parseUnary = (): number => {
        const token = peek();
        if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
            next();
            const val = parseUnary();
            return token.value === '-' ? -val : val;
        }
        return parsePrimary();
    };

    const parsePow = (): number => {
        let left = parseUnary();
        const token = peek();
        if (token.type === 'operator' && token.value === '^') {
            next();
            const right = parsePow();
            left = Math.pow(left, right);
        }
        return left;
    };

    const parseMulDiv = (): number => {
        let left = parsePow();
        while (true) {
            const token = peek();
            if (token.type === 'operator' && (token.value === '*' || token.value === '/')) {
                next();
                const right = parsePow();
                left = token.value === '*' ? left * right : left / right;
                continue;
            }
            break;
        }
        return left;
    };

    const parseAddSub = (): number => {
        let left = parseMulDiv();
        while (true) {
            const token = peek();
            if (token.type === 'operator' && (token.value === '+' || token.value === '-')) {
                next();
                const right = parseMulDiv();
                left = token.value === '+' ? left + right : left - right;
                continue;
            }
            break;
        }
        return left;
    };

    const parseExpression = (): number => parseAddSub();

    const value = parseExpression();
    if (peek().type !== 'eof') throw new Error('Unexpected input');
    return value;
};

export const parseAdvancedMathUnsafe = (str: string): Fraction => {
    if (!str.trim()) return { n: 0n, d: 1n };

    let s = str.toLowerCase().trim();
    s = s.replace(/\^/g, '**');
    s = s.replace(/\bpi\b/g, 'Math.PI');
    s = s.replace(/\be\b/g, 'Math.E');

    const funcs = ['sqrt', 'sin', 'cos', 'tan', 'abs', 'log', 'log10', 'exp', 'floor', 'ceil', 'round'];
    funcs.forEach(f => {
        s = s.replace(new RegExp(`\\b${f}\\b`, 'g'), `Math.${f}`);
    });

    try {
        const func = new Function(`"use strict"; return (${s})`);
        const result = func();

        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            throw new Error("Invalid result");
        }

        const precision = 10000000000;
        const n = BigInt(Math.round(result * precision));
        const d = BigInt(precision);

        return simplify({ n, d });
    } catch (e) {
        log.warn('Math parse error (unsafe)', { input: str, error: e });
        return { n: 0n, d: 1n };
    }
};

export const parseAdvancedMath = (str: string): Fraction => {
    if (!str.trim()) return { n: 0n, d: 1n };
    const normalized = normalizeMathExpression(str);
    if (!normalized) return { n: 0n, d: 1n };
    if (!/^[0-9a-zA-Z+\-*\^().,/]*$/.test(normalized)) {
        log.warn('Math parse rejected invalid characters', { input: str });
        return { n: 0n, d: 1n };
    }
    try {
        const result = parseSafeMath(normalized);
        if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
            throw new Error('Invalid result');
        }
        const precision = 10000000000;
        const n = BigInt(Math.round(result * precision));
        const d = BigInt(precision);
        return simplify({ n, d });
    } catch (e) {
        log.warn('Math parse error', { input: str, error: e });
        return { n: 0n, d: 1n };
    }
};

export const getFrequency = (baseFrequency: number, ratio: Fraction, ratioFloat?: number): number => {

    if (ratioFloat !== undefined && ratioFloat > 0) {
        return baseFrequency * ratioFloat;
    }
    return baseFrequency * (Number(ratio.n) / Number(ratio.d));
};

const toIndexForm = (num: bigint): string => {
    const s = num.toString();
    if (s.length >= 9) {
        const exponent = s.length - 1;
        const mantissa = s.length > 2 ? `${s[0]}.${s.slice(1, 3)}` : s[0];
        return `${mantissa}*10^${exponent}`;
    }
    return s;
};

export const formatRatio = (ratio: Fraction): string => {
    return `${toIndexForm(ratio.n)}/${toIndexForm(ratio.d)}`;
};

export const calculateCents = (ratio: Fraction): number => {
    const val = Number(ratio.n) / Number(ratio.d);
    if (val <= 0) return 0;
    return 1200 * Math.log2(val);
};

const PRIME_LIMITS: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
const LOG2_PRIME: Record<PrimeLimit, number> = {
    3: Math.log2(3),
    5: Math.log2(5),
    7: Math.log2(7),
    11: Math.log2(11),
    13: Math.log2(13),
    17: Math.log2(17),
    19: Math.log2(19),
    23: Math.log2(23),
    29: Math.log2(29),
    31: Math.log2(31)
};

export const calculateOctaveCentsFromPrimeVector = (vector: { [key in PrimeLimit]?: number }): number => {
    let log2Val = 0;

    for (const primeStr in vector) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vector[p] || 0;
        if (exp) {

            const log2Prime = LOG2_PRIME[p] ?? Math.log2(p);
            log2Val += exp * log2Prime;
        }
    }

    let frac = log2Val - Math.floor(log2Val);
    if (frac < 0) frac += 1;
    return frac * 1200;
};

const formatPrimeTerm = (base: number, exp: number, customSymbols?: Record<number, string>) => {
    const abs = Math.abs(exp);
    const baseStr = customSymbols?.[base] || `${base}`;
    if (abs === 0) return '';
    if (abs === 1) return baseStr;
    return `${baseStr}^${abs}`;
};

export const estimatePrimePowerDigitsFromPrimeVector = (vector: { [key in PrimeLimit]?: number }): { numeratorDigits: number; denominatorDigits: number } => {
    let log2Val = 0;

    for (const primeStr in vector) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vector[p] || 0;
        if (exp) {
            const log2Prime = LOG2_PRIME[p] ?? Math.log2(p);
            log2Val += exp * log2Prime;
        }
    }
    const k = Math.floor(log2Val);

    const log10_2 = Math.log10(2);

    let log10Num = k < 0 ? (-k) * log10_2 : 0;
    let log10Den = k > 0 ? k * log10_2 : 0;

    for (const primeStr in vector) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vector[p] || 0;
        if (!exp) continue;
        const log10Prime = Math.log10(p);
        if (exp > 0) log10Num += exp * log10Prime;
        else log10Den += (-exp) * log10Prime;
    }

    const numeratorDigits = log10Num <= 0 ? 1 : Math.floor(log10Num) + 1;
    const denominatorDigits = log10Den <= 0 ? 1 : Math.floor(log10Den) + 1;
    return { numeratorDigits, denominatorDigits };
};

export const formatPrimePowerRatioFromPrimeVector = (vector: { [key in PrimeLimit]?: number }, customSymbols?: Record<number, string>): string => {
    let log2Val = 0;
    for (const primeStr in vector) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vector[p] || 0;
        if (exp) {
            const log2Prime = LOG2_PRIME[p] ?? Math.log2(p);
            log2Val += exp * log2Prime;
        }
    }
    const k = Math.floor(log2Val);

    const numTerms: string[] = [];
    const denTerms: string[] = [];

    if (k > 0) denTerms.push(formatPrimeTerm(2, k));
    else if (k < 0) numTerms.push(formatPrimeTerm(2, -k));

    for (const primeStr in vector) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vector[p] || 0;
        if (!exp) continue;
        if (exp > 0) numTerms.push(formatPrimeTerm(p, exp, customSymbols));
        else denTerms.push(formatPrimeTerm(p, -exp, customSymbols));
    }

    const num = numTerms.length ? numTerms.join('*') : '1';
    const den = denTerms.length ? denTerms.join('*') : '1';
    return den === '1' ? num : `${num}/${den}`;
};

export const formatTwoPrimePowerRatioFromPrimeVector = (vector: { [key in PrimeLimit]?: number }): string | null => {
    const nonZero = Object.keys(vector).filter(primeStr => (vector[Number(primeStr) as PrimeLimit] || 0) !== 0);
    if (nonZero.length === 0) return '1/1';
    if (nonZero.length <= 2) return formatPrimePowerRatioFromPrimeVector(vector);
    return null;
};

export const formatRatioForDisplay = (
    ratio: Fraction,
    vector: { [key in PrimeLimit]?: number },
    opts: { mode: 'fraction' | 'primePowers' | 'auto'; autoPowerDigits: number; unsupported?: boolean; customSymbols?: Record<number, string> }
) => {
    if (opts.unsupported) return formatRatio(ratio);
    if (opts.mode === 'fraction') return formatRatio(ratio);
    if (opts.mode === 'primePowers') return formatPrimePowerRatioFromPrimeVector(vector, opts.customSymbols);

    const { numeratorDigits, denominatorDigits } = estimatePrimePowerDigitsFromPrimeVector(vector);
    const maxDigits = Math.max(numeratorDigits, denominatorDigits);
    if (maxDigits >= Math.max(2, Math.floor(opts.autoPowerDigits))) {
        return formatPrimePowerRatioFromPrimeVector(vector, opts.customSymbols);
    }
    return formatRatio(ratio);
};

export const getTETCents = (jiCents: number, divisions: number = 12): number => {
    const step = 1200 / divisions;
    const raw = Math.round(jiCents / step) * step;
    return parseFloat(raw.toFixed(4));
};

export const calculateRelativeRatio = (nodeA: NodeData, nodeB: NodeData): Fraction => {
    return simplify(divide(nodeB.ratio, nodeA.ratio));
};

export const getPrimeVectorFromRatio = (n: bigint, d: bigint): { [key in PrimeLimit]: number } => {
    const vec: any = { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 };
    const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

    let tn = n;
    while (tn > 0n && tn % 2n === 0n) tn /= 2n;
    for (const p of primes) {
        const bp = BigInt(p);
        while (tn > 0n && tn % bp === 0n) {
            vec[p] = (vec[p] || 0) + 1;
            tn /= bp;
        }
    }

    let td = d;
    while (td > 0n && td % 2n === 0n) td /= 2n;
    for (const p of primes) {
        const bp = BigInt(p);
        while (td > 0n && td % bp === 0n) {
            vec[p] = (vec[p] || 0) - 1;
            td /= bp;
        }
    }

    return vec;
};

export const addVectors = (v1: { [key in PrimeLimit]?: number }, v2: { [key in PrimeLimit]?: number }): { [key in PrimeLimit]: number } => {
    const res: any = {};
    const keys = new Set<string>([...Object.keys(v1 || {}), ...Object.keys(v2 || {})]);
    if (keys.size === 0) return res;
    keys.forEach((k) => {
        const p = Number(k);
        if (!Number.isFinite(p)) return;
        const v1Val = v1?.[p as PrimeLimit] ?? 0;
        const v2Val = v2?.[p as PrimeLimit] ?? 0;
        res[p] = v1Val + v2Val;
    });
    return res;
};

export const hasUnsupportedFactors = (n: bigint, d: bigint): boolean => {
    let tn = n;
    while (tn > 0n && tn % 2n === 0n) tn /= 2n;
    let td = d;
    while (td > 0n && td % 2n === 0n) td /= 2n;

    const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    for (const p of primes) {
        const bp = BigInt(p);
        while (tn > 0n && tn % bp === 0n) tn /= bp;
        while (td > 0n && td % bp === 0n) td /= bp;
    }

    return tn !== 1n || td !== 1n;
};

const toSuper = (n: number) => {

    return `(${n})`;
};

export const getNoteName = (
    vector: { [key in PrimeLimit]?: number },
    symbols: NotationSymbols,
    placement: 'split' | 'left' | 'right' = 'split'
): string => {
    const expandedVector = expandCompositePrimeVector(vector);
    const buildNamingVector = () => {
        const res: any = {};
        Object.keys(vector || {}).forEach((key) => {
            const p = Number(key);
            if (!Number.isFinite(p)) return;
            const count = vector[p as PrimeLimit] || 0;
            if (!count) return;
            if (p === 2 || isPrime(p)) {
                res[p] = (res[p] || 0) + count;
                return;
            }
            const sym = symbols?.[p];
            const useComposite = count > 0 ? !!sym?.up : !!sym?.down;
            if (useComposite) {
                res[p] = (res[p] || 0) + count;
                return;
            }
            const factors = factorizeOddInteger(p);
            Object.keys(factors).forEach((fp) => {
                const prime = Number(fp);
                if (!Number.isFinite(prime)) return;
                res[prime] = (res[prime] || 0) + count * factors[prime];
            });
        });
        return res;
    };
    const namingVector = buildNamingVector();
    const threes = expandedVector[3] || 0;
    const baseNames = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const offset = threes + 1;
    const cyclePos = ((offset % 7) + 7) % 7;
    const base = baseNames[cyclePos];
    const sharps = Math.floor(offset / 7);

    let acc = '';
    const absSharps = Math.abs(sharps);

    if (absSharps >= 8) {
        const sup = toSuper(absSharps);
        if (sharps > 0) acc = `${sup}#`;
        else if (sharps < 0) acc = `${sup}b`;
    } else {
        if (sharps > 0) acc = '#'.repeat(sharps);
        else if (sharps < 0) acc = 'b'.repeat(-sharps);
    }

    const coreName = base + acc;

    let leftStr = '';
    let rightStr = '';

    const allPrimes = Object.keys(namingVector)
        .map(k => parseInt(k))
        .filter(p => p !== 3 && !isNaN(p))
        .sort((a, b) => a - b);

    for (const p of allPrimes) {
        const count = namingVector[p as PrimeLimit];
        if (!count) continue;
        const sym = symbols[p] || { up: '', down: '' };
        const absCount = Math.abs(count);
        let char = count > 0 ? sym.up : sym.down;
        let effectivePlacement = sym.placement || placement;
        if (p === 5 && count < 0) {
            char = '+';
            effectivePlacement = 'right';
        }
        if (!char) continue;
        let token = absCount >= 8 ? `${char}${toSuper(absCount)}` : char.repeat(absCount);

        if (effectivePlacement === 'left') {
            leftStr = token + leftStr;
        } else if (effectivePlacement === 'right') {
            rightStr = rightStr + token;
        } else {
            if (count > 0) rightStr = rightStr + token;
            else leftStr = token + leftStr;
        }
    }

    return leftStr + coreName + rightStr;
};

export const getChordRatio = (nodes: NodeData[]): string => {
    if (nodes.length < 2) return "";

    const sorted = [...nodes].sort((a, b) => {
        const absA = a.cents + (a.octave * 1200);
        const absB = b.cents + (b.octave * 1200);
        return absA - absB;
    });

    const base = sorted[0];

    const fractions = sorted.map(node => {

        let n = node.ratio.n;
        let d = node.ratio.d;
        const octDiff = node.octave - base.octave;

        let relN = BigInt(n) * BigInt(base.ratio.d);
        let relD = BigInt(d) * BigInt(base.ratio.n);

        if (octDiff > 0) relN *= (2n ** BigInt(octDiff));
        else if (octDiff < 0) relD *= (2n ** BigInt(Math.abs(octDiff)));

        return simplify({ n: relN, d: relD });
    });

    const denoms = fractions.map(f => f.d);

    let globalLCM = 1n;
    denoms.forEach(d => { globalLCM = lcm(globalLCM, d); });

    const integerRatios = fractions.map(f => {
        return f.n * (globalLCM / f.d);
    });

    if (integerRatios.length > 0) {
        let commonFactor = integerRatios[0];
        for (let i = 1; i < integerRatios.length; i++) {
            commonFactor = gcd(commonFactor, integerRatios[i]);
        }
        if (commonFactor > 1n) {
            for (let i = 0; i < integerRatios.length; i++) {
                integerRatios[i] /= commonFactor;
            }
        }
    }

    return integerRatios.join(" : ");
};

export const getPitchClassDistance = (centsA: number, centsB: number): number => {
    let diff = Math.abs(centsA - centsB);
    diff = diff % 1200;
    return Math.min(diff, 1200 - diff);
};

export const isPrime = (n: number): boolean => {
    if (n < 2) return false;
    if (n === 2 || n === 3) return true;
    if (n % 2 === 0) return false;

    if (n < 1000000) {
        const sqrtN = Math.sqrt(n);
        for (let i = 3; i <= sqrtN; i += 2) {
            if (n % i === 0) return false;
        }
        return true;
    }

    const witnesses = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];

    let d = n - 1;
    let r = 0;
    while (d % 2 === 0) {
        d /= 2;
        r++;
    }

    witnessLoop: for (const a of witnesses) {
        if (a >= n) continue;

        let x = modPow(a, d, n);

        if (x === 1 || x === n - 1) continue;

        for (let i = 0; i < r - 1; i++) {
            x = modMul(x, x, n);
            if (x === n - 1) continue witnessLoop;
        }

        return false;
    }

    return true;
};

const factorizeOddInteger = (n: number): Record<number, number> => {
    const out: Record<number, number> = {};
    let remaining = Math.abs(Math.floor(n));
    if (remaining < 2) return out;
    while (remaining % 2 === 0) remaining = Math.floor(remaining / 2);
    let p = 3;
    while (p * p <= remaining) {
        if (remaining % p === 0) {
            let count = 0;
            while (remaining % p === 0) {
                remaining = Math.floor(remaining / p);
                count += 1;
            }
            out[p] = (out[p] || 0) + count;
        }
        p += 2;
    }
    if (remaining > 1) out[remaining] = (out[remaining] || 0) + 1;
    return out;
};

export const expandCompositePrimeVector = (vector: { [key in PrimeLimit]?: number }): { [key in PrimeLimit]: number } => {
    const res: any = {};
    Object.keys(vector || {}).forEach((key) => {
        const p = Number(key);
        if (!Number.isFinite(p)) return;
        const exp = vector[p as PrimeLimit] || 0;
        if (!exp) return;
        if (p === 2 || isPrime(p)) {
            res[p] = (res[p] || 0) + exp;
            return;
        }
        const factors = factorizeOddInteger(p);
        Object.keys(factors).forEach((fp) => {
            const prime = Number(fp);
            if (!Number.isFinite(prime)) return;
            res[prime] = (res[prime] || 0) + exp * factors[prime];
        });
    });
    return res;
};

const modPow = (base: number, exp: number, mod: number): number => {
    let result = 1;
    base = base % mod;
    while (exp > 0) {
        if (exp % 2 === 1) {
            result = modMul(result, base, mod);
        }
        exp = Math.floor(exp / 2);
        base = modMul(base, base, mod);
    }
    return result;
};

const modMul = (a: number, b: number, mod: number): number => {

    if (a < 1e7 && b < 1e7) {
        return (a * b) % mod;
    }
    return Number((BigInt(a) * BigInt(b)) % BigInt(mod));
};

export const generatePrimeColor = (prime: number): string => {

    const hue = (prime * 137.508) % 360;
    const saturation = 60 + (prime % 30);
    const lightness = 45 + (prime % 20);

    const h = hue;
    const s = saturation / 100;
    const l = lightness / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }

    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const nextPrime = (n: number): number => {
    let candidate = n + 1;
    if (candidate % 2 === 0) candidate++;
    while (!isPrime(candidate)) {
        candidate += 2;
    }
    return candidate;
};
