
export type MathValue = number | Complex | number[];

export class Complex {
  constructor(public re: number, public im: number = 0) {}

  static from(v: MathValue): Complex {
    if (v instanceof Complex) return v;
    if (Array.isArray(v)) return new Complex(v[0] ?? 0, 0);
    return new Complex(v as number, 0);
  }

  add(o: Complex) { return new Complex(this.re + o.re, this.im + o.im); }
  sub(o: Complex) { return new Complex(this.re - o.re, this.im - o.im); }
  mul(o: Complex) { return new Complex(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re); }
  div(o: Complex) {
    const d = o.re * o.re + o.im * o.im;
    if (d === 0) throw new Error('Division by zero');
    return new Complex((this.re * o.re + this.im * o.im) / d, (this.im * o.re - this.re * o.im) / d);
  }
  neg() { return new Complex(-this.re, -this.im); }
  conj() { return new Complex(this.re, -this.im); }
  abs() { return Math.hypot(this.re, this.im); }
  arg() { return Math.atan2(this.im, this.re); }
  exp() {
    const ea = Math.exp(this.re);
    return new Complex(ea * Math.cos(this.im), ea * Math.sin(this.im));
  }
  log() { return new Complex(Math.log(this.abs()), this.arg()); }
  pow(o: Complex) { return this.log().mul(o).exp(); }
  sin() {
    const a = this.re, b = this.im;
    return new Complex(Math.sin(a) * Math.cosh(b), Math.cos(a) * Math.sinh(b));
  }
  cos() {
    const a = this.re, b = this.im;
    return new Complex(Math.cos(a) * Math.cosh(b), -Math.sin(a) * Math.sinh(b));
  }
  tan() { return this.sin().div(this.cos()); }
  sqrt() {
    const r = this.abs();
    const a = this.re;
    const b = this.im;
    const t = Math.sqrt((r + a) / 2);
    const u = Math.sign(b) * Math.sqrt(Math.max(0, (r - a) / 2));
    return new Complex(t, u);
  }

  toString() { return `${this.re.toFixed(6)}${this.im >= 0 ? '+' : ''}${this.im.toFixed(6)}i`; }
}

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  tau: Math.PI * 2,
  e: Math.E,
  phi: 1.6180339887498948,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
  inf: Infinity,
  nan: NaN,
  epsilon: Number.EPSILON,
};

export const isNum = (v: MathValue): v is number => typeof v === 'number';
export const isCpx = (v: MathValue): v is Complex => v instanceof Complex;

export const toNumber = (v: MathValue): number => {
  if (typeof v === 'number') return v;
  if (v instanceof Complex) return v.re;
  if (Array.isArray(v)) return v[0] ?? 0;
  return NaN;
};

export const toComplex = (v: MathValue): Complex => Complex.from(v);

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export const factorial = (n: number): number => {
  if (!isFinite(n)) return NaN;
  const k = Math.floor(n);
  if (k < 0) return NaN;
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
};

export function gammaReal(z: number): number {
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaReal(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
  const t = z + p.length - 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

export function erf(x: number): number {
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429;
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return s * y;
}
export function erfc(x: number): number {
  return 1 - erf(x);
}
export function sinc(x: number): number {
  if (Math.abs(x) < 1e-8) return 1;
  return Math.sin(x) / x;
}

export function zeta(s: number): number {
  if (s <= 1) return Infinity;
  let sum = 0;
  for (let n = 1; n < 4000; n++) sum += 1 / Math.pow(n, s);
  return sum;
}

export function mandel(x: number, y: number, iters: number = 80): number {
  let zr = 0, zi = 0;
  let i = 0;
  for (; i < iters; i++) {
    const zr2 = zr * zr - zi * zi + x;
    const zi2 = 2 * zr * zi + y;
    zr = zr2; zi = zi2;
    if (zr * zr + zi * zi > 4) break;
  }
  return i / iters;
}

export function airyAi(x: number): number {
  const ax = Math.abs(x);
  if (ax < 1e-6) return 0.355028053887817;
  if (x > 0) {
    const t = (2 / 3) * Math.pow(x, 1.5);
    const pref = 0.5 / Math.sqrt(Math.PI) * Math.pow(x, -0.25);
    const corr = 1 - 5 / (48 * t);
    return pref * Math.exp(-t) * corr;
  }
  const t = (2 / 3) * Math.pow(-x, 1.5);
  const pref = 1 / Math.sqrt(Math.PI) * Math.pow(-x, -0.25);
  return pref * Math.sin(t + Math.PI / 4);
}

export function airyBi(x: number): number {
  const ax = Math.abs(x);
  if (ax < 1e-6) return 0.614926627446001;
  if (x > 0) {
    const t = (2 / 3) * Math.pow(x, 1.5);
    const pref = 1 / Math.sqrt(Math.PI) * Math.pow(x, -0.25);
    const corr = 1 + 5 / (48 * t);
    return pref * Math.exp(t) * corr;
  }
  const t = (2 / 3) * Math.pow(-x, 1.5);
  const pref = 1 / Math.sqrt(Math.PI) * Math.pow(-x, -0.25);
  return pref * Math.cos(t + Math.PI / 4);
}

export function besselJ0(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const x2 = x * x;
    return 1 - x2 / 4 + (x2 * x2) / 64 - (x2 * x2 * x2) / 2304;
  }
  const t = ax;
  return Math.sqrt(2 / (Math.PI * t)) * Math.cos(t - Math.PI / 4);
}

export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    const x2 = x * x;
    return x / 2 - (x * x2) / 16 + (x * x2 * x2) / 384 - (x * x2 * x2 * x2) / 18432;
  }
  const t = ax;
  const approx = Math.sqrt(2 / (Math.PI * t)) * Math.cos(t - (3 * Math.PI) / 4);
  return x < 0 ? -approx : approx;
}

export function frac(x: number): number { return x - Math.floor(x); }
export function saw(x: number): number { return 2 * (frac(x) - 0.5); }
export function square(x: number): number { return frac(x) < 0.5 ? 1 : -1; }
export function tri(x: number): number { return 1 - 4 * Math.abs(frac(x) - 0.5); }
export function pulse(x: number, duty: number = 0.5): number {
  const d = Math.min(0.999999, Math.max(0.000001, duty));
  return frac(x) < d ? 1 : -1;
}

export const deg2rad = (d: number) => d * (Math.PI / 180);
export const rad2deg = (r: number) => r * (180 / Math.PI);

export const sec = (x: number) => 1 / Math.cos(x);
export const csc = (x: number) => 1 / Math.sin(x);
export const cot = (x: number) => 1 / Math.tan(x);

export const sech = (x: number) => 1 / Math.cosh(x);
export const csch = (x: number) => 1 / Math.sinh(x);
export const coth = (x: number) => 1 / Math.tanh(x);

export const nCr = (n: number, r: number) => factorial(n) / (factorial(r) * factorial(n - r));
export const nPr = (n: number, r: number) => factorial(n) / factorial(n - r);

export const beta = (x: number, y: number) => (gammaReal(x) * gammaReal(y)) / gammaReal(x + y);

export const heaviside = (x: number) => x >= 0 ? 1 : 0;
export const dirac = (x: number) => Math.abs(x) < 0.01 ? 50 : 0;

export const si = (x: number): number => {
    
    if (x === 0) return 0;
    let sum = 0;
    let term = x;
    let k = 0;
    const x2 = x*x;
    while (Math.abs(term) > 1e-6 && k < 100) {
        sum += term / (2*k + 1);
        term *= -x2 / ((2*k+2)*(2*k+3));
        k++;
    }
    return sum;
};

export interface Token {
  type: 'NUM' | 'ID' | 'OP' | 'LPAREN' | 'RPAREN' | 'COMMA' | 'EOF';
  value?: string;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const src = input.trim();
  let i = 0;

  const isAlpha = (c: string) => /[a-zA-Z_]/.test(c);
  const isNumChar = (c: string) => /[0-9]/.test(c);

  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

    if (c === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (c === ',') { tokens.push({ type: 'COMMA' }); i++; continue; }

    const two = src.slice(i, i + 2);
    const three = src.slice(i, i + 3);
    if (three === '&&' || three === '||') {
      tokens.push({ type: 'OP', value: three });
      i += 3;
      continue;
    }
    if (two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||') {
      tokens.push({ type: 'OP', value: two });
      i += 2;
      continue;
    }
    if ('+-*/%^<>!'.includes(c)) {
      tokens.push({ type: 'OP', value: c });
      i++;
      continue;
    }

    if (isNumChar(c) || (c === '.' && isNumChar(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      if (src[j] === 'e' || src[j] === 'E') {
        j++;
        if (src[j] === '+' || src[j] === '-') j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      tokens.push({ type: 'NUM', value: src.slice(i, j) });
      i = j;
      continue;
    }

    if (isAlpha(c)) {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      tokens.push({ type: 'ID', value: src.slice(i, j) });
      i = j;
      continue;
    }

    i++;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}
