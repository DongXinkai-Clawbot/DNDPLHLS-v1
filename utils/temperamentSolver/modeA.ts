
import type { IntervalError, NoteResult, RatioSpec, SolverInput, Rank2Constraint } from './index';
import {
  degreeName,
  ratioToCents,
  signedWrapDiff,
  wrapToCycle,
  clamp,
  nearestStepForRatio,
  computeOctaWeights,
  OCTA_ANCHORS
} from './index';
import {
  solveWLS,
  buildRank2Constraints,
  REF_GENERATOR_CENTS,
  estimateGeneratorSteps as wlsEstimateGeneratorSteps,
  estimatePeriodSteps
} from './wlsSolver';

const goldenSectionSearch = (f: (x: number) => number, lo: number, hi: number, iters: number = 80) => {
  const phi = (1 + Math.sqrt(5)) / 2;
  let a = lo, b = hi;
  let c = b - (b - a) / phi;
  let d = a + (b - a) / phi;
  let fc = f(c), fd = f(d);
  for (let i = 0; i < iters; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - (b - a) / phi; fc = f(c); }
    else { a = c; c = d; fc = fd; d = a + (b - a) / phi; fd = f(d); }
  }
  return (a + b) / 2;
};

export interface ModeAResult {
  notesCents: number[];   
  generatorCents: number;
  intervals: IntervalError[];
  
  optimizedPeriodCents?: number;
  periodStretchCents?: number;
  periodStretchWarning?: boolean;
  centsAbsolute?: number[];  
}

const estimateGeneratorSteps = (targetCents: number, cycle: number): number => {
  const pureFifth = 1200 * Math.log2(1.5);
  let bestStep = 1;
  let minDiff = Infinity;
  for (let k = -31; k <= 31; k++) {
    if (k === 0) continue;
    const generated = wrapToCycle(k * pureFifth, cycle);
    const diff = Math.abs(signedWrapDiff(generated, targetCents, cycle));
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = k;
    }
  }
  return bestStep;
};

interface Constraint {
  label: string;
  n: number;
  d: number;
  weight: number;
  idealCents: number;
  steps: number;
  periodComp?: number;
  anchorId?: string;
}

const getTarget = (targets: RatioSpec[], n: number, d: number): RatioSpec | null => {
  for (const r of targets) if (r.n === n && r.d === d) return r;
  return null;
};

export const solveModeA = (input: SolverInput): ModeAResult => {
  const N = input.scaleSize;
  const cycle = input.cycleCents;
  const octaveStiffness = input.octaveStiffness ?? 1.0; 

  const constraints: Constraint[] = [];
  const useOcta = !!input.octaWeighting?.enabled;
  const useRank2 = octaveStiffness < 1.0; 

  if (useOcta) {
    const x = input.octaWeighting?.x ?? 0.5;
    const y = input.octaWeighting?.y ?? 0.5;
    const z = input.octaWeighting?.z ?? 0.5;
    const weights = computeOctaWeights(x, y, z);
    const gRef = wrapToCycle(ratioToCents({ n: 3, d: 2 }), cycle);
    const anchors = input.octaWeighting?.targets?.length ? input.octaWeighting.targets : OCTA_ANCHORS;

    anchors.forEach(anchor => {
      const key = `${anchor.n}/${anchor.d}`;
      const w = weights[anchor.id] ?? 0;
      const ideal = wrapToCycle(ratioToCents(anchor), cycle);
      const steps = estimateGeneratorSteps(ideal, cycle);
      if (steps !== 0) {
        const periodComp = Math.round((steps * gRef - ideal) / cycle);
        constraints.push({
          label: `${anchor.label || anchor.id} (${key})`,
          n: anchor.n,
          d: anchor.d,
          weight: w,
          idealCents: ideal,
          steps,
          periodComp,
          anchorId: anchor.id
        });
      }
    });
  } else {
    
    const useMatrixMode = input.targetWeights &&
      Object.keys(input.targetWeights).some(k => (input.targetWeights![k] || 0) > 0.001);

    if (useMatrixMode) {
      
      input.targets.forEach(t => {
        const key = `${t.n}/${t.d}`;
        const w = input.targetWeights?.[key] || 0;
        if (w > 0.001) {
          const ideal = wrapToCycle(ratioToCents(t), cycle);
          const steps = estimateGeneratorSteps(ideal, cycle);
          if (steps !== 0) {
            constraints.push({
              label: t.label || key,
              n: t.n,
              d: t.d,
              weight: w,
              idealCents: ideal,
              steps
            });
          }
        }
      });
    } else if (input.targets.length > 0) {
      
      const enabledTargets = input.targets;
      const equalWeight = 1.0 / enabledTargets.length;

      enabledTargets.forEach(t => {
        const key = `${t.n}/${t.d}`;
        const ideal = wrapToCycle(ratioToCents(t), cycle);
        const steps = estimateGeneratorSteps(ideal, cycle);
        if (steps !== 0) {
          constraints.push({
            label: t.label || key,
            n: t.n,
            d: t.d,
            weight: equalWeight,
            idealCents: ideal,
            steps
          });
        }
      });
    }
  }

  if (constraints.length === 0) {
    
    const rP5 = { n: 3, d: 2, label: '3/2' };
    const ideal = wrapToCycle(ratioToCents(rP5), cycle);
    const steps = estimateGeneratorSteps(ideal, cycle);

    constraints.push({
      label: rP5.label || '3/2',
      n: 3, d: 2,
      weight: 1.0,
      idealCents: ideal,
      steps: steps !== 0 ? steps : 1
    });
  }

  const totalWeight = constraints.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight > 0) {
    constraints.forEach(c => c.weight = c.weight / totalWeight);
  }

  let gBest = wrapToCycle(ratioToCents({ n: 3, d: 2, label: '3/2' }), cycle);
  let pBest = cycle; 
  let periodStretchCents: number | undefined;
  let periodStretchWarning: boolean | undefined;
  let centsAbsolute: number[] | undefined;

  if (useOcta && useRank2 && constraints.length > 0) {
    
    const rank2Constraints: Rank2Constraint[] = constraints.map(c => ({
      label: c.label,
      n: c.n,
      d: c.d,
      weight: c.weight,
      idealCents: c.idealCents,
      generatorSteps: c.steps,
      periodSteps: c.periodComp ?? estimatePeriodSteps(c.idealCents, c.steps, REF_GENERATOR_CENTS, cycle)
    }));

    const wlsResult = solveWLS(rank2Constraints, octaveStiffness, REF_GENERATOR_CENTS);
    gBest = wlsResult.generatorCents;
    pBest = wlsResult.periodCents;
    periodStretchCents = pBest - 1200;
    periodStretchWarning = Math.abs(periodStretchCents) > 10;

  } else if (useOcta && constraints.length > 0) {
    
    const denom = constraints.reduce((sum, c) => sum + c.weight * (c.steps * c.steps), 0);
    if (Math.abs(denom) > 1e-9) {
      const numer = constraints.reduce((sum, c) => {
        const offset = (c.periodComp ?? 0) * cycle;
        return sum + c.weight * c.steps * (c.idealCents + offset);
      }, 0);
      gBest = wrapToCycle(numer / denom, cycle);
    }
  } else {
    
    const loss = (g: number) => {
      let totalErrSq = 0;
      for (const c of constraints) {
        const actual = wrapToCycle(g * c.steps, cycle);
        const err = signedWrapDiff(actual, c.idealCents, cycle);
        totalErrSq += c.weight * (err * err);
      }
      return totalErrSq;
    };

    const searchLo = cycle * 0.575;  
    const searchHi = cycle * 0.595;  
    gBest = goldenSectionSearch(loss, searchLo, searchHi);
  }

  const effectiveCycle = pBest;

  const startIndex = (() => {
    if (input.wolfPlacement === 'manual' && typeof input.wolfEdgeIndex === 'number') {
      const edge = clamp(Math.round(input.wolfEdgeIndex), 0, N - 1);
      return (N - 1 - edge + N) % N;
    }
    return clamp(Math.round(input.keySpecificity.flats), 0, N - 1);
  })();

  const tonicDegree = ((input.keySpecificity.tonic % N) + N) % N;
  const stepSize = nearestStepForRatio(gBest, N, effectiveCycle);
  const degreeToCents = new Array(N).fill(0);
  const absoluteCents = new Array(N).fill(0); 

  for (let k = 0; k < N; k++) {
    const genOffset = k - startIndex;
    const absoluteValue = genOffset * gBest; 
    const cents = wrapToCycle(absoluteValue, effectiveCycle);
    let deg = (tonicDegree + genOffset * stepSize) % N;
    if (deg < 0) deg += N;
    degreeToCents[deg] = cents;
    absoluteCents[deg] = absoluteValue;
  }

  const rootOffset = degreeToCents[tonicDegree];
  const rootAbsoluteOffset = absoluteCents[tonicDegree];
  for (let i = 0; i < N; i++) {
    degreeToCents[i] = wrapToCycle(degreeToCents[i] - rootOffset, effectiveCycle);
    absoluteCents[i] = absoluteCents[i] - rootAbsoluteOffset;
  }

  const degreeMapping = degreeToCents.map((cents, idx) => ({ cents, originalDegree: idx }));
  degreeMapping.sort((a, b) => a.cents - b.cents);

  const sortedDegreeToCents = degreeMapping.map(d => d.cents);
  const sortedAbsoluteCents = degreeMapping.map(d => absoluteCents[d.originalDegree]);

  const finalRootOffset = sortedDegreeToCents[0];
  for (let i = 0; i < N; i++) {
    sortedDegreeToCents[i] = wrapToCycle(sortedDegreeToCents[i] - finalRootOffset, effectiveCycle);
    sortedAbsoluteCents[i] = sortedAbsoluteCents[i] - sortedAbsoluteCents[0];
  }

  const finalDegreeToCents = sortedDegreeToCents;
  const finalAbsoluteCents = sortedAbsoluteCents;

  if (useRank2) {
    centsAbsolute = finalAbsoluteCents;
  }

  const intervals: IntervalError[] = [];
  for (const c of constraints) {
    const step = nearestStepForRatio(c.idealCents, N, effectiveCycle);
    
    const kind: 'P5' | 'M3' | 'm3' = (() => {
      const cents = c.idealCents;
      if (cents > 650 && cents < 750) return 'P5';  
      if (cents > 350 && cents < 420) return 'M3';  
      if (cents > 280 && cents < 340) return 'm3';  
      return 'M3'; 
    })();

    for (let i = 0; i < N; i++) {
      const j = (i + step) % N;
      const actual = wrapToCycle(finalDegreeToCents[j] - finalDegreeToCents[i], effectiveCycle);
      const err = signedWrapDiff(actual, c.idealCents, effectiveCycle);
      intervals.push({
        i, j, step,
        target: { n: c.n, d: c.d, label: c.label },
        targetCents: c.idealCents,
        actualCents: actual,
        errorCents: err,
        weight: c.weight,
        kind,
        isSkeleton: c.weight > 0.1,
        keyTonic: i === tonicDegree ? tonicDegree : undefined,
        anchorId: c.anchorId
      });
    }
  }

  return {
    notesCents: finalDegreeToCents,
    generatorCents: wrapToCycle(gBest, effectiveCycle),
    intervals,
    optimizedPeriodCents: useRank2 ? pBest : undefined,
    periodStretchCents,
    periodStretchWarning,
    centsAbsolute: useRank2 ? finalAbsoluteCents : undefined
  };
};

export const buildModeANotes = (input: SolverInput, centsByDegree: number[]): NoteResult[] => {
  const N = input.scaleSize;
  const baseHz = input.baseFrequencyHz;
  return centsByDegree.map((cents, degree) => {
    const freq = baseHz * Math.pow(2, cents / 1200);
    return {
      degree,
      name: degreeName(degree, N),
      centsFromRoot: cents,
      freqHzAtRootMidi: freq
    };
  });
};
