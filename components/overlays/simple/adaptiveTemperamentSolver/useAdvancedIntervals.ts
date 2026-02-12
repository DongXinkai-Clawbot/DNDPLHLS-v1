import { useEffect, useMemo, useState } from 'react';
import type { AdvancedIntervalItem } from './types';
import { gcd } from './utils';

type UseAdvancedIntervalsParams = {
  N: number;
};

export const useAdvancedIntervals = ({ N }: UseAdvancedIntervalsParams) => {
  const [boundaryNumerator, setBoundaryNumerator] = useState<number>(2);
  const [boundaryDenominator, setBoundaryDenominator] = useState<number>(1);
  const [advancedIntervals, setAdvancedIntervals] = useState<AdvancedIntervalItem[]>([]);
  const [newIntervalDegree, setNewIntervalDegree] = useState<number>(0);
  const [newIntervalRatio, setNewIntervalRatio] = useState<string>('3/2');
  const [newIntervalTolerance, setNewIntervalTolerance] = useState<number>(5);
  const [newIntervalPriority, setNewIntervalPriority] = useState<number>(1);
  const [newIntervalHardMax, setNewIntervalHardMax] = useState<string>('');
  const [octaveTolerance, setOctaveTolerance] = useState<number>(5);
  const [octavePriority, setOctavePriority] = useState<number>(1);
  const [octaveHardMax, setOctaveHardMax] = useState<string>('');
  const boundaryRatio = useMemo(() => {
    const n = Math.max(1, Math.round(boundaryNumerator));
    const d = Math.max(1, Math.round(boundaryDenominator));
    if (n <= d) return 2;
    return n / d;
  }, [boundaryNumerator, boundaryDenominator]);

  const boundaryCents = useMemo(() => {
    const ratio = boundaryRatio;
    if (!Number.isFinite(ratio) || ratio <= 1) return 1200;
    return 1200 * Math.log2(ratio);
  }, [boundaryRatio]);

  const normalizeRatioToBoundary = (n: number, d: number) => {
    let nn = Math.max(1, Math.round(n));
    let dd = Math.max(1, Math.round(d));
    if (!Number.isFinite(nn) || !Number.isFinite(dd) || dd === 0) {
      return { n: 1, d: 1, adjusted: false };
    }
    const bn = Math.max(2, Math.round(boundaryNumerator));
    const bd = Math.max(1, Math.round(boundaryDenominator));
    const boundary = bn / bd;
    if (!Number.isFinite(boundary) || boundary <= 1) {
      return { n: nn, d: dd, adjusted: false };
    }
    let ratio = nn / dd;
    let adjusted = false;
    let loops = 0;
    while (ratio >= boundary && loops < 12) {
      nn *= bd;
      dd *= bn;
      ratio = nn / dd;
      adjusted = true;
      loops += 1;
    }
    while (ratio < 1 && loops < 12) {
      nn *= bn;
      dd *= bd;
      ratio = nn / dd;
      adjusted = true;
      loops += 1;
    }
    const g = gcd(nn, dd);
    return { n: Math.round(nn / g), d: Math.round(dd / g), adjusted };
  };

  const updateBoundaryRatio = (nextN: number, nextD: number) => {
    let nn = Math.max(1, Math.round(nextN));
    let dd = Math.max(1, Math.round(nextD));
    if (nn <= dd) nn = dd + 1;
    const g = gcd(nn, dd);
    setBoundaryNumerator(nn / g);
    setBoundaryDenominator(dd / g);
  };

  useEffect(() => {
    setNewIntervalDegree(prev => Math.max(0, Math.min(N - 1, prev)));
  }, [N]);

  useEffect(() => {
    setAdvancedIntervals(prev => prev.map(interval => {
      const normalized = normalizeRatioToBoundary(interval.n, interval.d);
      return {
        ...interval,
        n: normalized.n,
        d: normalized.d,
        degree: Math.max(0, Math.min(N - 1, interval.degree))
      };
    }));
  }, [boundaryNumerator, boundaryDenominator, N]);

  const addAdvancedInterval = () => {
    const m = newIntervalRatio.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!m) return;
    const rawN = parseInt(m[1], 10);
    const rawD = parseInt(m[2], 10);
    const normalized = normalizeRatioToBoundary(rawN, rawD);
    const tol = Math.max(0.01, newIntervalTolerance);
    const prio = Math.max(0, newIntervalPriority);
    const hardMax = newIntervalHardMax.trim() === '' ? undefined : Math.max(0.01, parseFloat(newIntervalHardMax));
    const id = `adv-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    setAdvancedIntervals(prev => ([
      ...prev,
      {
        id,
        degree: Math.max(0, Math.min(N - 1, newIntervalDegree)),
        n: normalized.n,
        d: normalized.d,
        toleranceCents: tol,
        priority: prio,
        maxErrorCents: Number.isFinite(hardMax) ? hardMax : undefined
      }
    ]));
  };

  const updateAdvancedInterval = (id: string, patch: Partial<AdvancedIntervalItem>) => {
    setAdvancedIntervals(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, ...patch };
    }));
  };

  const removeAdvancedInterval = (id: string) => {
    setAdvancedIntervals(prev => prev.filter(item => item.id !== id));
  };

  return {
    boundaryNumerator,
    setBoundaryNumerator,
    boundaryDenominator,
    setBoundaryDenominator,
    boundaryRatio,
    boundaryCents,
    normalizeRatioToBoundary,
    updateBoundaryRatio,
    advancedIntervals,
    addAdvancedInterval,
    updateAdvancedInterval,
    removeAdvancedInterval,
    newIntervalDegree,
    setNewIntervalDegree,
    newIntervalRatio,
    setNewIntervalRatio,
    newIntervalTolerance,
    setNewIntervalTolerance,
    newIntervalPriority,
    setNewIntervalPriority,
    newIntervalHardMax,
    setNewIntervalHardMax,
    octaveTolerance,
    setOctaveTolerance,
    octavePriority,
    setOctavePriority,
    octaveHardMax,
    setOctaveHardMax
  };
};
