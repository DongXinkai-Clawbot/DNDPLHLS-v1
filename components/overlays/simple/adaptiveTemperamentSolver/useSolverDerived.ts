import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { OctaAnchor, OctaveModel, SolverOutput } from '../../../../utils/temperamentSolver';
import { computeOctaWeights } from '../../../../utils/temperamentSolver';
import type { TargetItem, UiRatioSpec } from './types';
import { centsFromRatio, clamp, fmtPct } from './utils';

type UseSolverDerivedParams = {
  N: number;
  octaveModel: OctaveModel;
  octaveCentsOverride: number;
  ratioSpecs: UiRatioSpec[];
  targetState: Record<string, boolean>;
  setTargetState: Dispatch<SetStateAction<Record<string, boolean>>>;
  result: SolverOutput | null;
  octaX: number;
  octaY: number;
  octaZ: number;
  octaTargets: OctaAnchor[];
};

export const useSolverDerived = ({
  N,
  octaveModel,
  octaveCentsOverride,
  ratioSpecs,
  targetState,
  setTargetState,
  result,
  octaX,
  octaY,
  octaZ,
  octaTargets
}: UseSolverDerivedParams) => {
  const octaveCents = useMemo(() => {
    if (octaveModel === 'perfect') return 1200;
    return clamp(octaveCentsOverride, 200, 2400);
  }, [octaveModel, octaveCentsOverride]);

  const targetsRaw = useMemo<TargetItem[]>(() => {
    const stepCents = octaveCents / N;
    return ratioSpecs.map((r, idx) => {
      const centsIdeal = centsFromRatio(r.n, r.d, octaveCents);
      const step = Math.max(1, Math.min(N - 1, Math.round(centsIdeal / stepCents)));
      return {
        id: `r-${idx}-${r.n}-${r.d}`,
        n: r.n,
        d: r.d,
        centsIdeal,
        step,
        enabled: !!r.defaultOn,
        label: r.label
      };
    });
  }, [ratioSpecs, octaveCents, N]);

  // Sync state on list change
  useEffect(() => {
    const next: Record<string, boolean> = {};
    targetsRaw.forEach(t => (next[t.id] = targetState[t.id] ?? t.enabled));
    setTargetState(next);
  }, [targetsRaw.length]); // only when list length changes

  const targetsWithEnabled = useMemo(() => targetsRaw.map(t => ({ ...t, enabled: !!targetState[t.id] })), [targetsRaw, targetState]);

  const octaWeights = useMemo(() => computeOctaWeights(octaX, octaY, octaZ), [octaX, octaY, octaZ]);
  const octaEntries = useMemo(() => (
    octaTargets.map(anchor => {
      const ratioKey = `${anchor.n}/${anchor.d}`;
      return { ...anchor, ratioKey, weight: octaWeights[anchor.id] ?? 0 };
    })
  ), [octaTargets, octaWeights]);
  const octaTopSummary = useMemo(() => (
    [...octaEntries]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(e => `${e.ratioKey}:${fmtPct(e.weight, 0)}`)
      .join(' ')
  ), [octaEntries]);
  const octaDetuning = useMemo(() => {
    if (!result?.input?.octaWeighting?.enabled) return null;
    const buckets = new Map<string, number[]>();
    for (const anchor of octaTargets) buckets.set(anchor.id, []);
    for (const it of result.intervals) {
      if (!it.anchorId) continue;
      const arr = buckets.get(it.anchorId);
      if (arr) arr.push(it.errorCents);
    }
    const out: Record<string, number> = {};
    buckets.forEach((arr, key) => {
      if (arr.length === 0) {
        out[key] = 0;
        return;
      }
      const mean = arr.reduce((sum, v) => sum + v, 0) / arr.length;
      out[key] = mean;
    });
    return out;
  }, [result, octaTargets]);

  return {
    octaveCents,
    targetsRaw,
    targetsWithEnabled,
    octaWeights,
    octaEntries,
    octaTopSummary,
    octaDetuning
  };
};
