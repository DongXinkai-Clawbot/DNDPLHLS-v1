import { Vector3 } from 'three';
import type { NodeData } from '../../../../types';

export const centsFromRatio = (n: number, d: number, octaveCents: number) => octaveCents * (Math.log2(n / d));
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) { const t = x % y; x = y; y = t; }
  return x || 1;
};
export const fmt = (v: number, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '--');
export const fmtPct = (v: number, digits = 0) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '--');
export const fmtSigned = (v: number, digits = 2) => (Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(digits)}` : '--');
export const detuneClass = (err: number) => {
  const abs = Math.abs(err);
  if (abs < 1) return 'bg-emerald-500/70';
  if (abs < 3) return 'bg-yellow-500/70';
  if (abs < 6) return 'bg-orange-500/70';
  return 'bg-red-500/70';
};

export const makeDummyNode = (cents: number, name: string): NodeData => ({
  id: `tempsolver-${name}-${cents.toFixed(4)}`,
  position: new Vector3(),
  primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
  ratio: { n: 1n, d: 1n },
  octave: 0,
  cents,
  gen: 0,
  originLimit: 0,
  parentId: null,
  name,
});
