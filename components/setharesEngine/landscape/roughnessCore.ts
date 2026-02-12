import { GridPointDiagnostics, Partial, RoughnessConstants, RoughnessOptions } from './types';
import { getPairIndices } from './pairCache';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/**
 * exp() clamp: Math.log(Number.MIN_VALUE) is the largest negative exponent that still
 * produces a non-zero float64 on compliant JS engines.
 */
const DEFAULT_EXP_CLAMP_MIN = Math.log(Number.MIN_VALUE);

export const buildDefaultDiagnostics = (): GridPointDiagnostics => ({
  originalPartials: 0,
  prunedPartials: 0,
  invalidPartials: 0,
  skippedPairs: 0,
  totalPairs: 0,
  maxPairContribution: 0,
  silent: false
});

const isValidPartial = (p: Partial) =>
  Number.isFinite(p.freq) && p.freq > 0 && Number.isFinite(p.amp) && p.amp >= 0;

export const prunePartials = (
  partials: Partial[],
  ampThreshold: number
): { list: Partial[]; diagnostics: GridPointDiagnostics } => {
  const diag = buildDefaultDiagnostics();
  diag.originalPartials = partials.length;
  const valid = partials.filter(p => {
    const ok = isValidPartial(p);
    if (!ok) diag.invalidPartials += 1;
    return ok;
  });
  const th = Math.max(0, ampThreshold);
  const pruned = valid.filter(p => p.amp >= th);
  diag.prunedPartials = pruned.length;
  if (pruned.length === 0) diag.silent = true;
  return { list: pruned, diagnostics: diag };
};

/**
 * Merge strictly duplicate frequencies inside a single partial list.
 * - Keeps the smallest index for stable diagnostics.
 * - Sums amplitudes (linear) and ORs toneMask.
 */
export const mergeDuplicatePartials = (partials: Partial[], freqTolerance = 1e-9) => {
  if (partials.length === 0) return partials;
  const tol = Math.max(0, freqTolerance);
  const sorted = [...partials].sort((a, b) => a.freq - b.freq);
  const merged: Partial[] = [];
  for (const p of sorted) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.freq - p.freq) <= tol) {
      last.amp += p.amp;
      last.toneMask = (last.toneMask ?? 0) | (p.toneMask ?? 0);
      last.index = Math.min(last.index, p.index);
    } else {
      merged.push({ ...p });
    }
  }
  return merged;
};

/**
 * Sethares-style roughness kernel:
 *   s = dStar / (s1 * min(f1,f2) + s2)
 *   rough = v1*v2*(exp(-a*s*df) - exp(-b*s*df))
 *
 * Returns a non-negative value.
 */
export const pairRoughness = (
  f1: number,
  f2: number,
  v1: number,
  v2: number,
  constants: RoughnessConstants
) => {
  const lo = Math.min(f1, f2);
  const hi = Math.max(f1, f2);
  if (lo <= 0 || v1 <= 0 || v2 <= 0) return 0;
  const df = hi - lo;
  if (df === 0) return 0;

  const denom = constants.s1 * lo + constants.s2;
  if (!(denom > 0)) {
    throw new Error('Invalid roughness constants: (s1*minF + s2) must be positive');
  }
  const s = constants.dStar / denom;

  const expClamp = constants.expClampMin ?? DEFAULT_EXP_CLAMP_MIN;

  // x = s*df (>=0)
  const x = s * df;

  // exp(-a*x) can underflow.
  const e1 = -constants.a * x;
  if (e1 < expClamp) return 0;

  // Use a stable form: exp(-a*x) * (1 - exp(-(b-a)*x))
  const expA = Math.exp(e1);
  const eDiff = -(constants.b - constants.a) * x;
  if (eDiff < expClamp) return 0;

  const diff = expA * (-Math.expm1(eDiff)); // >= 0 when b>a and x>=0
  const out = v1 * v2 * diff;

  // Guard against tiny negative due to numeric noise.
  return out > 0 ? out : 0;
};

export type PoolData = {
  freqs: Float64Array;

  /** Total amplitude per pooled frequency (sum of tone amplitudes). */
  amps: Float64Array;

  /** Tone mask indicating which tones contribute to this pooled frequency. */
  toneMask: Uint8Array;

  /** Stable index for diagnostics (usually smallest contributing partial index). */
  partialIndex: Uint16Array;

  length: number;

  /**
   * Optional per-tone amplitudes (needed if pooled bins can contain contributions from multiple tones).
   * If provided, poolRoughness can apply self-interaction weights correctly even after merging.
   */
  ampTone0?: Float64Array;
  ampTone1?: Float64Array;
  ampTone2?: Float64Array;
};

export type PairContribution = {
  i: number;
  j: number;
  contribution: number;
  f1: number;
  f2: number;
  a1: number;
  a2: number;
  toneMask1: number;
  toneMask2: number;
  partialIndex1: number;
  partialIndex2: number;
};

const sumAB = (pool: PoolData, i: number, j: number) => {
  if (pool.ampTone0 && pool.ampTone1 && pool.ampTone2) {
    return (
      pool.ampTone0[i] * pool.ampTone0[j] +
      pool.ampTone1[i] * pool.ampTone1[j] +
      pool.ampTone2[i] * pool.ampTone2[j]
    );
  }
  // Fallback: only correct when each pooled bin belongs to at most one tone.
  return (pool.toneMask[i] & pool.toneMask[j]) !== 0 ? pool.amps[i] * pool.amps[j] : 0;
};

/**
 * Effective amplitude product for a pair after applying within-tone weighting:
 *   prod = (sumA*sumB) + (selfW - 1) * sum_t(A_t * B_t)
 *
 * - selfW == 1 => prod == sumA*sumB (plain product)
 * - selfW == 0 => excludes same-tone interactions
 */
const effectiveAmpProduct = (pool: PoolData, i: number, j: number, selfW: number) => {
  const a = pool.amps[i];
  const b = pool.amps[j];
  if (!(a > 0) || !(b > 0)) return 0;
  const sab = sumAB(pool, i, j);
  return a * b + (selfW - 1) * sab;
};

export const poolRoughness = (
  pool: PoolData,
  constants: RoughnessConstants,
  options: RoughnessOptions,
  topCount = 0
) => {
  const totalPairs = (pool.length * (pool.length - 1)) / 2;
  let skippedPairs = 0;
  let maxPair = 0;
  let total = 0;

  const pairs = getPairIndices(pool.length);
  const top: PairContribution[] = [];

  const eps = options.performanceMode ? (options.pairSkipEpsilon ?? options.epsilonContribution) : 0;
  const selfW = options.enableSelfInteraction ? clamp01(options.selfInteractionWeight) : 0;

  const expClamp = constants.expClampMin ?? DEFAULT_EXP_CLAMP_MIN;

  for (let k = 0; k < pairs.i.length; k++) {
    const i = pairs.i[k];
    const j = pairs.j[k];

    const a1 = pool.amps[i];
    const a2 = pool.amps[j];

    // Fast skip if no cross-tone contribution exists (self interactions excluded).
    const ampProd = effectiveAmpProduct(pool, i, j, selfW);
    if (!(ampProd > 0)) {
      skippedPairs += 1;
      continue;
    }

    const f1 = pool.freqs[i];
    const f2 = pool.freqs[j];
    const lo = f1 < f2 ? f1 : f2;
    const hi = f1 < f2 ? f2 : f1;
    if (!(lo > 0)) continue;
    const df = hi - lo;
    if (df === 0) {
      skippedPairs += 1;
      continue;
    }

    const denom = constants.s1 * lo + constants.s2;
    if (!(denom > 0)) {
      throw new Error('Invalid roughness constants: (s1*minF + s2) must be positive');
    }
    const s = constants.dStar / denom;
    const x = s * df;

    // Performance skip using a conservative upper bound:
    // kernel <= exp(-a*x), contribution <= ampBound * exp(-a*x)
    if (options.performanceMode && eps > 0) {
      const ampBound = a1 * a2 * Math.max(1, selfW);
      if (!(ampBound > eps)) {
        skippedPairs += 1;
        continue;
      }
      const dfLimit = Math.log(ampBound / eps) / (constants.a * s);
      if (df > dfLimit) {
        skippedPairs += 1;
        continue;
      }
    }

    // Kernel compute (stable)
    const e1 = -constants.a * x;
    if (e1 < expClamp) {
      skippedPairs += 1;
      continue;
    }
    const expA = Math.exp(e1);

    const eDiff = -(constants.b - constants.a) * x;
    if (eDiff < expClamp) {
      skippedPairs += 1;
      continue;
    }
    const kernel = expA * (-Math.expm1(eDiff)); // >= 0
    const contrib = kernel > 0 ? kernel * ampProd : 0;

    total += contrib;
    if (contrib > maxPair) maxPair = contrib;

    if (topCount > 0 && contrib > 0) {
      const entry: PairContribution = {
        i,
        j,
        contribution: contrib,
        f1,
        f2,
        a1,
        a2,
        toneMask1: pool.toneMask[i],
        toneMask2: pool.toneMask[j],
        partialIndex1: pool.partialIndex[i],
        partialIndex2: pool.partialIndex[j]
      };
      if (top.length < topCount) {
        top.push(entry);
        top.sort((a, b) => b.contribution - a.contribution);
      } else if (contrib > top[top.length - 1].contribution) {
        top[top.length - 1] = entry;
        top.sort((a, b) => b.contribution - a.contribution);
      }
    }
  }

  return {
    roughness: total,
    skippedPairs,
    totalPairs,
    maxPair,
    topPairs: topCount > 0 ? top : undefined
  };
};
