import type { RatioTarget, WeightMode, WeightNormalization } from './jiTypes';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const foldRatio = (ratio: number, beta: number) => {
  if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(beta) || beta <= 1) return NaN;
  const logBeta = Math.log(beta);
  if (!Number.isFinite(logBeta) || logBeta === 0) return NaN;
  const k = Math.floor(Math.log(ratio) / logBeta);
  let folded = ratio / Math.pow(beta, k);
  if (folded < 1) folded *= beta;
  if (folded >= beta) folded /= beta;
  return folded;
};

const gcd = (a: number, b: number) => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
};

export const parseRatioText = (text: string, maxDen = 256) => {
  const raw = text.trim();
  if (!raw) return null;
  if (raw.includes('/')) {
    const [a, b] = raw.split('/');
    const num = Number(a);
    const den = Number(b);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    const ratio = num / den;
    if (!Number.isFinite(ratio) || ratio <= 0) return null;
    const n = Math.round(num);
    const d = Math.round(den);
    const g = gcd(n, d);
    return { ratio, num: n / g, den: d / g };
  }
  const ratio = Number(raw);
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  const approx = approximateRatio(ratio, maxDen);
  const g = gcd(approx.num, approx.den);
  return { ratio, num: approx.num / g, den: approx.den / g };
};

export const approximateRatio = (ratio: number, maxDen: number) => {
  const maxD = Math.max(1, Math.round(maxDen));
  let x = ratio;
  let a0 = Math.floor(x);
  let p0 = 1;
  let q0 = 0;
  let p1 = a0;
  let q1 = 1;
  let best = { num: p1, den: q1, error: Math.abs(p1 / q1 - ratio) };
  for (let iter = 0; iter < 32; iter++) {
    const frac = x - Math.floor(x);
    if (frac === 0) break;
    x = 1 / frac;
    const a = Math.floor(x);
    const p2 = a * p1 + p0;
    const q2 = a * q1 + q0;
    if (q2 > maxD) break;
    const err = Math.abs(p2 / q2 - ratio);
    best = { num: p2, den: q2, error: err };
    p0 = p1;
    q0 = q1;
    p1 = p2;
    q1 = q2;
  }
  return best;
};

const factorize = (value: number) => {
  let n = Math.abs(Math.round(value));
  const factors = new Map<number, number>();
  if (n < 2) return factors;
  let p = 2;
  while (p * p <= n) {
    while (n % p === 0) {
      factors.set(p, (factors.get(p) ?? 0) + 1);
      n = Math.floor(n / p);
    }
    p += p === 2 ? 1 : 2;
  }
  if (n > 1) factors.set(n, (factors.get(n) ?? 0) + 1);
  return factors;
};

export const tenneyDecay = (num: number, den: number) => {
  const product = Math.max(1, Math.abs(num) * Math.abs(den));
  const denom = Math.log2(product);
  if (!Number.isFinite(denom) || denom <= 0) return 1;
  return 1 / denom;
};

export const eulerGradus = (value: number) => {
  const factors = factorize(value);
  let sum = 1;
  factors.forEach((k, p) => {
    sum += k * (p - 1);
  });
  return sum;
};

export const eulerDecay = (num: number, den: number) => {
  const gp = eulerGradus(num);
  const gq = eulerGradus(den);
  const gradus = Math.max(1, gp + gq - 1);
  return 1 / gradus;
};

export const computeWeightDecay = (mode: WeightMode, num: number, den: number) => {
  if (mode === 'tenney') return tenneyDecay(num, den);
  if (mode === 'euler') return eulerDecay(num, den);
  return 1;
};

export const normalizeWeights = (targets: RatioTarget[], mode: WeightNormalization, weightMode: WeightMode) => {
  const raw = targets.map(t => t.weight * computeWeightDecay(weightMode, t.num, t.den));
  if (raw.length === 0) return raw;
  if (mode === 'l1') {
    const sum = raw.reduce((acc, v) => acc + v, 0);
    if (sum <= 0) return raw.map(() => 1 / raw.length);
    return raw.map(v => v / sum);
  }
  const max = Math.max(...raw);
  if (max <= 0) return raw.map(() => 1 / raw.length);
  return raw.map(v => v / max);
};

export const buildTargetsKey = (targets: RatioTarget[]) =>
  targets
    .map(t => `${t.num}/${t.den}@${t.weight.toFixed(4)}`)
    .sort()
    .join('|');

