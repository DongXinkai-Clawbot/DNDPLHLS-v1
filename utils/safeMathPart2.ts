
import {
    MathValue, Complex, CONSTANTS,
    isNum, isCpx, toNumber, toComplex, clamp, factorial,
    gammaReal, erf, erfc, sinc, zeta, mandel, airyAi, airyBi, besselJ0, besselJ1,
    saw, square, tri, pulse,
    deg2rad, rad2deg, sec, csc, cot, sech, csch, coth, nCr, nPr, beta, heaviside, dirac, si,
    Token, tokenize
} from './safeMathPart1';

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: string; expr: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] };

class Parser {
  private tokens: Token[] = [];
  private pos = 0;

  evaluate(expr: string, context: Record<string, any> = {}): MathValue {
    if (!expr || !expr.trim()) return NaN;
    this.tokens = tokenize(expr);
    this.pos = 0;
    const ast = this.parseExpression();
    return this.evalNode(ast, context);
  }

  private peek(): Token { return this.tokens[this.pos] || { type: 'EOF' }; }
  private next(): Token { return this.tokens[this.pos++] || { type: 'EOF' }; }
  private match(type: Token['type'], value?: string): boolean {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    this.pos++;
    return true;
  }

  private parseExpression(): Node { return this.parseOr(); }

  private parseOr(): Node {
    let node = this.parseAnd();
    while (this.match('OP', '||')) node = { kind: 'binary', op: '||', left: node, right: this.parseAnd() };
    return node;
  }
  private parseAnd(): Node {
    let node = this.parseCompare();
    while (this.match('OP', '&&')) node = { kind: 'binary', op: '&&', left: node, right: this.parseCompare() };
    return node;
  }
  private parseCompare(): Node {
    let node = this.parseAdd();
    while (true) {
      const t = this.peek();
      if (t.type === 'OP' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value || '')) {
        this.next();
        node = { kind: 'binary', op: t.value!, left: node, right: this.parseAdd() };
      } else break;
    }
    return node;
  }

  private parseAdd(): Node {
    let node = this.parseMul();
    while (true) {
      const t = this.peek();
      if (t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        this.next();
        node = { kind: 'binary', op: t.value!, left: node, right: this.parseMul() };
      } else break;
    }
    return node;
  }

  private parseMul(): Node {
    let node = this.parsePow();
    while (true) {
      const t = this.peek();
      if (t.type === 'OP' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        this.next();
        node = { kind: 'binary', op: t.value!, left: node, right: this.parsePow() };
      } else break;
    }
    return node;
  }

  private parsePow(): Node {
    let node = this.parseUnary();
    const t = this.peek();
    if (t.type === 'OP' && t.value === '^') {
      this.next();
      node = { kind: 'binary', op: '^', left: node, right: this.parsePow() };
    }
    return node;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t.type === 'OP' && (t.value === '+' || t.value === '-' || t.value === '!')) {
      this.next();
      return { kind: 'unary', op: t.value!, expr: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t.type === 'OP' && t.value === '!') {
        this.next();
        node = { kind: 'call', name: 'fact', args: [node] };
        continue;
      }
      break;
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (t.type === 'NUM') {
      this.next();
      return { kind: 'num', value: Number(t.value) };
    }
    if (t.type === 'ID') {
      this.next();
      const name = t.value!;
      if (this.match('LPAREN')) {
        const args: Node[] = [];
        if (!this.match('RPAREN')) {
          do { args.push(this.parseExpression()); } while (this.match('COMMA'));
          this.match('RPAREN');
        }
        return { kind: 'call', name, args };
      }
      return { kind: 'var', name };
    }
    if (this.match('LPAREN')) {
      const node = this.parseExpression();
      this.match('RPAREN');
      return node;
    }
    this.next();
    return { kind: 'num', value: NaN };
  }

  private evalNode(node: Node, ctx: Record<string, any>): MathValue {
    switch (node.kind) {
      case 'num': return node.value;
      case 'var': {
        const v = ctx[node.name];
        if (v === undefined) return CONSTANTS[node.name] ?? NaN;
        return v;
      }
      case 'unary': {
        const v = this.evalNode(node.expr, ctx);
        if (node.op === '+') return v;
        if (node.op === '-') {
          if (isCpx(v)) return v.neg();
          if (Array.isArray(v)) return v.map((x) => -x);
          return -toNumber(v);
        }
        if (node.op === '!') return toNumber(v) ? 0 : 1;
        return NaN;
      }
      case 'binary': {
        const a = this.evalNode(node.left, ctx);
        if (node.op === '&&' || node.op === '||') {
          const av = toNumber(a);
          if (node.op === '&&') {
            if (!av) return 0;
            return toNumber(this.evalNode(node.right, ctx)) ? 1 : 0;
          }
          if (node.op === '||') {
            if (av) return 1;
            return toNumber(this.evalNode(node.right, ctx)) ? 1 : 0;
          }
        }
        const b = this.evalNode(node.right, ctx);

        if (node.op === '==') return toNumber(a) === toNumber(b) ? 1 : 0;
        if (node.op === '!=') return toNumber(a) !== toNumber(b) ? 1 : 0;
        if (node.op === '<') return toNumber(a) < toNumber(b) ? 1 : 0;
        if (node.op === '>') return toNumber(a) > toNumber(b) ? 1 : 0;
        if (node.op === '<=') return toNumber(a) <= toNumber(b) ? 1 : 0;
        if (node.op === '>=') return toNumber(a) >= toNumber(b) ? 1 : 0;

        if (node.op === '+') {
          if (isCpx(a) || isCpx(b)) return toComplex(a).add(toComplex(b));
          if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v + (b[i] ?? 0));
          if (Array.isArray(a) && isNum(b)) return a.map((v) => v + b);
          if (Array.isArray(b) && isNum(a)) return b.map((v) => a + v);
          return toNumber(a) + toNumber(b);
        }
        if (node.op === '-') {
          if (isCpx(a) || isCpx(b)) return toComplex(a).sub(toComplex(b));
          if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => v - (b[i] ?? 0));
          if (Array.isArray(a) && isNum(b)) return a.map((v) => v - b);
          if (Array.isArray(b) && isNum(a)) return b.map((v) => a - v);
          return toNumber(a) - toNumber(b);
        }
        if (node.op === '*') {
          if (isCpx(a) || isCpx(b)) return toComplex(a).mul(toComplex(b));
          if (Array.isArray(a) && isNum(b)) return a.map((v) => v * b);
          if (Array.isArray(b) && isNum(a)) return b.map((v) => a * v);
          return toNumber(a) * toNumber(b);
        }
        if (node.op === '/') {
          if (isCpx(a) || isCpx(b)) return toComplex(a).div(toComplex(b));
          if (Array.isArray(a) && isNum(b)) return a.map((v) => v / b);
          return toNumber(a) / toNumber(b);
        }
        if (node.op === '%') return toNumber(a) % toNumber(b);
        if (node.op === '^') {
          if (isCpx(a) || isCpx(b)) return toComplex(a).pow(toComplex(b));
          return Math.pow(toNumber(a), toNumber(b));
        }
        return NaN;
      }
      case 'call': return this.evalCall(node.name.toLowerCase(), node.args, ctx);
    }
  }

  private evalCall(name: string, args: Node[], ctx: Record<string, any>): MathValue {
    
    switch (name) {
      case 'if': {
        const c = toNumber(this.evalNode(args[0], ctx));
        return c ? this.evalNode(args[1], ctx) : this.evalNode(args[2], ctx);
      }
      case 'diff': {
        const expr = args[0];
        const varName = args[1]?.kind === 'var' ? args[1].name : 'x';
        const x0 = args[2] ? toNumber(this.evalNode(args[2], ctx)) : toNumber(ctx[varName] ?? 0);
        const h = args[3] ? Math.abs(toNumber(this.evalNode(args[3], ctx))) : 1e-4;
        const f1 = toNumber(this.evalNode(expr, { ...ctx, [varName]: x0 + h }));
        const f2 = toNumber(this.evalNode(expr, { ...ctx, [varName]: x0 - h }));
        return (f1 - f2) / (2 * h);
      }
      case 'integrate': {
        const expr = args[0];
        let varName = 'x';
        let aI = 1, bI = 2, stepsI = 3;
        if (args[1]?.kind === 'var') {
          varName = args[1].name;
          aI = 2; bI = 3; stepsI = 4;
        }
        const a = toNumber(this.evalNode(args[aI], ctx));
        const b = toNumber(this.evalNode(args[bI], ctx));
        const steps = Math.max(16, Math.floor(toNumber(this.evalNode(args[stepsI] ?? { kind:'num', value: 512 }, ctx))));
        if (!isFinite(a) || !isFinite(b)) return NaN;
        const h = (b - a) / steps;
        let s = 0;
        for (let i = 0; i <= steps; i++) {
          const x = a + i * h;
          const w = i === 0 || i === steps ? 0.5 : 1;
          const fx = toNumber(this.evalNode(expr, { ...ctx, [varName]: x }));
          s += w * fx;
        }
        return s * h;
      }
      case 'sum': {
        const expr = args[0];
        const varName = args[1]?.kind === 'var' ? args[1].name : 'n';
        const a = Math.floor(toNumber(this.evalNode(args[2], ctx)));
        const b = Math.floor(toNumber(this.evalNode(args[3], ctx)));
        const cap = 10000;
        let s = 0;
        let count = 0;
        for (let n = a; n <= b; n++) {
          const v = toNumber(this.evalNode(expr, { ...ctx, [varName]: n }));
          s += v;
          if (++count > cap) break;
        }
        return s;
      }
      case 'prod': {
        const expr = args[0];
        const varName = args[1]?.kind === 'var' ? args[1].name : 'n';
        const a = Math.floor(toNumber(this.evalNode(args[2], ctx)));
        const b = Math.floor(toNumber(this.evalNode(args[3], ctx)));
        const cap = 2000;
        let s = 1;
        let count = 0;
        for (let n = a; n <= b; n++) {
          const v = toNumber(this.evalNode(expr, { ...ctx, [varName]: n }));
          s *= v;
          if (++count > cap) break;
        }
        return s;
      }
      case 'limit': {
        const expr = args[0];
        const varName = args[1]?.kind === 'var' ? args[1].name : 'x';
        const x0 = toNumber(this.evalNode(args[2], ctx));
        const side = args[3] ? Math.sign(toNumber(this.evalNode(args[3], ctx))) : 0; 
        let eps0 = 1e-2;
        let last = NaN;
        for (let k = 0; k < 12; k++) {
          const eps = eps0 / Math.pow(2, k);
          const xl = x0 - eps;
          const xr = x0 + eps;
          const fl = toNumber(this.evalNode(expr, { ...ctx, [varName]: xl }));
          const fr = toNumber(this.evalNode(expr, { ...ctx, [varName]: xr }));
          const cur = side < 0 ? fl : side > 0 ? fr : (fl + fr) / 2;
          if (isFinite(cur)) last = cur;
        }
        return last;
      }
      case 'mean': {
        const vals = args.map((a) => toNumber(this.evalNode(a, ctx))).filter((v) => isFinite(v));
        if (vals.length === 0) return NaN;
        return vals.reduce((s, v) => s + v, 0) / vals.length;
      }
      case 'var': {
        const vals = args.map((a) => toNumber(this.evalNode(a, ctx))).filter((v) => isFinite(v));
        if (vals.length === 0) return NaN;
        const m = vals.reduce((s, v) => s + v, 0) / vals.length;
        return vals.reduce((s, v) => s + (v - m) * (v - m), 0) / vals.length;
      }
    }

    const evalArgs = args.map((a) => this.evalNode(a, ctx));
    const fn = FUNCTIONS[name];
    if (!fn) return NaN;
    try { return fn(evalArgs); } catch { return NaN; }
  }
}

type Fn = (args: MathValue[]) => MathValue;

const mapUnary = (fnR: (x: number) => number, fnC?: (z: Complex) => Complex): Fn => {
  return (args) => {
    const v = args[0];
    if (v instanceof Complex) return fnC ? fnC(v) : new Complex(fnR(v.re), 0);
    if (Array.isArray(v)) return v.map(fnR);
    return fnR(v as number);
  };
};

const mapBinary = (fnR: (a: number, b: number) => number): Fn => {
  return (args) => fnR(toNumber(args[0]), toNumber(args[1]));
};

const FUNCTIONS: Record<string, Fn> = {
  abs: mapUnary(Math.abs, (z) => new Complex(z.abs(), 0)),
  sign: mapUnary(Math.sign),
  sgn: mapUnary(Math.sign), 
  floor: mapUnary(Math.floor),
  ceil: mapUnary(Math.ceil),
  round: mapUnary(Math.round),
  fract: mapUnary((x) => x - Math.floor(x)),
  fractionalpart: mapUnary((x) => x - Math.floor(x)), 
  min: (args) => Math.min(...args.map(toNumber)),
  max: (args) => Math.max(...args.map(toNumber)),
  clamp: (args) => clamp(toNumber(args[0]), toNumber(args[1]), toNumber(args[2])),
  mod: mapBinary((a, b) => a % b),

  exp: mapUnary(Math.exp, (z) => z.exp()),
  exp2: mapUnary((x) => Math.pow(2, x)),
  expm1: mapUnary(Math.expm1),
  ln: mapUnary(Math.log, (z) => z.log()),
  log: (args) => {
      if (args.length === 1) return Math.log10(toNumber(args[0])); 
      return Math.log(toNumber(args[1])) / Math.log(toNumber(args[0])); 
  },
  lg: mapUnary(Math.log10),
  log10: mapUnary(Math.log10),
  ld: mapUnary(Math.log2),
  log2: mapUnary(Math.log2),
  log1p: mapUnary(Math.log1p),
  sqrt: mapUnary(Math.sqrt, (z) => z.sqrt()),
  cbrt: mapUnary(Math.cbrt),
  nroot: mapBinary((x, n) => Math.pow(x, 1/n)),
  pow: (args) => (isCpx(args[0]) || isCpx(args[1])) ? toComplex(args[0]).pow(toComplex(args[1])) : Math.pow(toNumber(args[0]), toNumber(args[1])),

  sin: mapUnary(Math.sin, (z) => z.sin()),
  cos: mapUnary(Math.cos, (z) => z.cos()),
  tan: mapUnary(Math.tan, (z) => z.tan()),
  sec: mapUnary(sec),
  csc: mapUnary(csc),
  cosec: mapUnary(csc),
  cot: mapUnary(cot),
  
  asin: mapUnary(Math.asin),
  acos: mapUnary(Math.acos),
  atan: mapUnary(Math.atan),
  atan2: mapBinary(Math.atan2),
  
  sind: mapUnary((x) => Math.sin(deg2rad(x))),
  cosd: mapUnary((x) => Math.cos(deg2rad(x))),
  tand: mapUnary((x) => Math.tan(deg2rad(x))),
  asind: mapUnary((x) => rad2deg(Math.asin(x))),
  acosd: mapUnary((x) => rad2deg(Math.acos(x))),
  atand: mapUnary((x) => rad2deg(Math.atan(x))),

  sinh: mapUnary(Math.sinh),
  cosh: mapUnary(Math.cosh),
  tanh: mapUnary(Math.tanh),
  sech: mapUnary(sech),
  csch: mapUnary(csch),
  cosech: mapUnary(csch),
  coth: mapUnary(coth),
  
  asinh: mapUnary(Math.asinh),
  acosh: mapUnary(Math.acosh),
  atanh: mapUnary(Math.atanh),

  hypot: (args) => Math.hypot(...args.map(toNumber)),

  real: (args) => (args[0] instanceof Complex ? args[0].re : toNumber(args[0])),
  imag: (args) => (args[0] instanceof Complex ? args[0].im : 0),
  imaginary: (args) => (args[0] instanceof Complex ? args[0].im : 0),
  re: (args) => (args[0] instanceof Complex ? args[0].re : toNumber(args[0])),
  im: (args) => (args[0] instanceof Complex ? args[0].im : 0),
  arg: (args) => (args[0] instanceof Complex ? args[0].arg() : Math.atan2(0, toNumber(args[0]))),
  conj: (args) => (args[0] instanceof Complex ? args[0].conj() : new Complex(toNumber(args[0]), 0)),
  conjugate: (args) => (args[0] instanceof Complex ? args[0].conj() : new Complex(toNumber(args[0]), 0)),
  i: () => new Complex(0, 1),

  gamma: (args) => args.length > 1 ? NaN : gammaReal(toNumber(args[0])), 
  gammaregularized: (args) => gammaReal(toNumber(args[0])), 
  lgamma: mapUnary((x) => Math.log(Math.abs(gammaReal(x)))),
  beta: mapBinary(beta),
  ncr: mapBinary(nCr),
  npr: mapBinary(nPr),
  
  erf: mapUnary(erf),
  erfc: mapUnary(erfc),
  sinc: mapUnary(sinc),
  zeta: mapUnary(zeta),
  airy_ai: mapUnary(airyAi),
  airy_bi: mapUnary(airyBi),
  besselj0: mapUnary(besselJ0),
  besselj1: mapUnary(besselJ1),
  
  heaviside: mapUnary(heaviside),
  dirac: mapUnary(dirac),
  sinintegral: mapUnary(si), 

  rand: () => Math.random(),
  random: () => Math.random(),
  uniform: (args) => {
    const a = toNumber(args[0] ?? 0);
    const b = toNumber(args[1] ?? 1);
    return a + (b - a) * Math.random();
  },
  normal: (args) => {
    const mu = toNumber(args[0] ?? 0);
    const sigma = Math.max(1e-12, Math.abs(toNumber(args[1] ?? 1)));
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return mu + sigma * z;
  },

  fact: (args) => factorial(toNumber(args[0])),

  vec: (args) => args.map(toNumber),
  vec2: (args) => [toNumber(args[0]), toNumber(args[1])],
  vec3: (args) => [toNumber(args[0]), toNumber(args[1]), toNumber(args[2])],
  vec4: (args) => [toNumber(args[0]), toNumber(args[1]), toNumber(args[2]), toNumber(args[3])],
  dot: (args) => {
    const a = args[0], b = args[1];
    if (!Array.isArray(a) || !Array.isArray(b)) return NaN;
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
    return s;
  },

  mandel: (args) => mandel(toNumber(args[0]), toNumber(args[1]), toNumber(args[2] ?? 80)),

  saw: mapUnary(saw),
  square: mapUnary(square),
  tri: mapUnary(tri),
  pulse: (args) => pulse(toNumber(args[0]), toNumber(args[1] ?? 0.5)),
};

export const mathParser = new Parser();
