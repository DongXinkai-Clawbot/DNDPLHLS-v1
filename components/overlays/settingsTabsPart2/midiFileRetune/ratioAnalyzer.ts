import type { AppSettings, CustomPrimeConfig, NodeData } from '../../../../types';
import { parseGeneralRatio, simplify, generatePrimeColor } from '../../../../musicLogic';
import { STANDARD_PRIMES } from '../../../../constants';
import { buildNodeScale } from './utils';

type MissingRatio = {
  ratio: string;
  primeVector: Record<number, number>;
};

export type LatticeExtensionPlan = {
  missingRatios: MissingRatio[];
  newCustomPrimes: CustomPrimeConfig[];
  gen0Changes: Record<number, { current: { neg: number; pos: number }; required: { neg: number; pos: number } }>;
  exceedsGen0Limit: boolean;
  axesExceedingLimit: number[];
};

const normalizeRatioValue = (value: number) => {
  let v = value;
  if (!Number.isFinite(v) || v <= 0) return 1;
  while (v >= 2) v /= 2;
  while (v < 1) v *= 2;
  return v;
};

const formatRatioValue = (value: number) => {
  const v = normalizeRatioValue(value);
  if (Math.abs(v - 1) < 1e-12) return '1/1';
  return v.toFixed(6).replace(/\.?0+$/, '');
};

const ratioToValue = (ratio: string) => {
  try {
    const frac = parseGeneralRatio(ratio);
    const value = Number(frac.n) / Number(frac.d);
    return normalizeRatioValue(value);
  } catch {
    return 1;
  }
};

const factorize = (value: bigint) => {
  const factors = new Map<number, number>();
  let n = value < 0n ? -value : value;
  if (n <= 1n) return factors;

  let divisor = 2n;
  while (divisor * divisor <= n) {
    let count = 0;
    while (n % divisor === 0n) {
      n /= divisor;
      count += 1;
    }
    if (count > 0) {
      factors.set(Number(divisor), count);
    }
    divisor = divisor === 2n ? 3n : divisor + 2n;
  }
  if (n > 1n) {
    const prime = Number(n);
    factors.set(prime, (factors.get(prime) || 0) + 1);
  }
  return factors;
};

const isRationalLiteral = (ratio: string) => {
  const trimmed = ratio.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/')) return true;
  return /^-?\d+$/.test(trimmed);
};

const buildPrimeVector = (ratio: string) => {
  if (!isRationalLiteral(ratio)) return {};
  const frac = simplify(parseGeneralRatio(ratio));
  const numFactors = factorize(frac.n);
  const denFactors = factorize(frac.d);
  const vector: Record<number, number> = {};

  numFactors.forEach((exp, prime) => {
    if (prime === 2) return;
    vector[prime] = (vector[prime] || 0) + exp;
  });
  denFactors.forEach((exp, prime) => {
    if (prime === 2) return;
    vector[prime] = (vector[prime] || 0) - exp;
  });

  return vector;
};

const getCurrentAxisRange = (settings: AppSettings, prime: number) => {
  const base = settings.expansionA || 0;
  let neg = base;
  let pos = base;

  if (settings.gen0CustomizeEnabled !== false) {
    const loopLen = settings.axisLooping?.[prime as any];
    if (Number.isFinite(loopLen) && loopLen !== null && loopLen !== undefined) {
      neg = Math.floor(loopLen);
      pos = Math.ceil(loopLen);
      return { neg, pos };
    }
    if (settings.gen0Lengths && settings.gen0Lengths[prime as any] !== undefined) {
      const len = settings.gen0Lengths[prime as any] as number;
      neg = len;
      pos = len;
      return { neg, pos };
    }
    if (settings.gen0Ranges && settings.gen0Ranges[prime as any]) {
      const range = settings.gen0Ranges[prime as any]!;
      neg = range.neg;
      pos = range.pos;
    }
  }

  return { neg, pos };
};

export const computeLatticeExtension = (
  scale: string[],
  nodes: NodeData[],
  settings: AppSettings
): LatticeExtensionPlan => {
  const nodeScale = buildNodeScale(nodes);
  const nodeSet = new Set(nodeScale.scale);
  const missingRatios: MissingRatio[] = [];
  const seen = new Set<string>();

  scale.forEach((ratio) => {
    if (!ratio) return;
    const formatted = formatRatioValue(ratioToValue(ratio));
    if (nodeSet.has(formatted) || seen.has(formatted)) return;
    seen.add(formatted);
    missingRatios.push({ ratio: formatted, primeVector: buildPrimeVector(ratio) });
  });

  const standard = new Set<number>(STANDARD_PRIMES as number[]);
  const existingCustom = new Set<number>((settings.customPrimes || []).map((p) => p.prime));
  const newCustomPrimes: CustomPrimeConfig[] = [];
  const gen0Changes: LatticeExtensionPlan['gen0Changes'] = {};
  const axesExceedingLimit: number[] = [];
  const limitThreshold = 6;

  missingRatios.forEach((missing) => {
    Object.entries(missing.primeVector).forEach(([primeStr, exp]) => {
      const prime = Number(primeStr);
      if (!Number.isFinite(prime) || prime <= 2 || exp === 0) return;

      const current = gen0Changes[prime]?.current || getCurrentAxisRange(settings, prime);
      const required = gen0Changes[prime]?.required || { neg: 0, pos: 0 };

      if (exp > 0) required.pos = Math.max(required.pos, exp);
      if (exp < 0) required.neg = Math.max(required.neg, Math.abs(exp));

      gen0Changes[prime] = { current, required };

      if (!standard.has(prime) && !existingCustom.has(prime) && !newCustomPrimes.some((p) => p.prime === prime)) {
        newCustomPrimes.push({ prime, color: generatePrimeColor(prime) });
      }
    });
  });

  Object.entries(gen0Changes).forEach(([primeStr, change]) => {
    const prime = Number(primeStr);
    if (change.required.neg > limitThreshold || change.required.pos > limitThreshold) {
      axesExceedingLimit.push(prime);
    }
  });

  return {
    missingRatios,
    newCustomPrimes,
    gen0Changes,
    exceedsGen0Limit: axesExceedingLimit.length > 0,
    axesExceedingLimit
  };
};
