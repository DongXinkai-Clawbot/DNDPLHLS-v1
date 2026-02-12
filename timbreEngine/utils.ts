export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const hashString = (str: string) => {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
};

import type { TimbreCurve } from '../typesPart1';

export type CurveOptions = {
  pow?: number;
  steps?: number;
};

export const applyCurve = (v: number, curve: TimbreCurve = 'linear', opts: CurveOptions = {}) => {
  const t = clamp(v, 0, 1);
  const pow = Number.isFinite(opts.pow) ? Math.max(0.1, opts.pow!) : 3;
  const steps = Number.isFinite(opts.steps) ? Math.max(2, Math.round(opts.steps!)) : 12;
  switch (curve) {
    case 'log': return Math.pow(t, 2);
    case 'invert-log': return 1 - Math.pow(1 - t, 2);
    case 'exp': return Math.pow(t, 0.5);
    case 'pow': return Math.pow(t, pow);
    case 's-curve': return t * t * (3 - 2 * t);
    case 'step': return Math.round(t * (steps - 1)) / Math.max(1, steps - 1);
    case 'bipolar-s-curve': {
      // 0..1 -> -1..1 -> cubic -> 0..1
      const x = 2 * t - 1;
      const z = x * x * x;
      return (z + 1) / 2;
    }
    default: return t;
  }
};

export const applyVelocityCurve = (velocity: number, curve: 'linear' | 'soft' | 'hard') => {
  const v = clamp(velocity, 0, 1);
  if (curve === 'soft') return Math.pow(v, 0.6);
  if (curve === 'hard') return Math.pow(v, 1.6);
  return v;
};

export const computeKeyTracking = (freq: number, baseFreq: number) => {
  const raw = Math.log2(freq / baseFreq);
  return clamp((raw + 2) / 4, 0, 1);
};
