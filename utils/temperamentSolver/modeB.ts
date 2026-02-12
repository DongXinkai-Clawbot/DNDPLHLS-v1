
import type { IntervalError, RatioSpec, SolverInput } from './index';
import {
  buildEqualTemperament,
  buildHarmonicSkeletonPairs,
  buildKeySetOnFifths,
  nearestStepForRatio,
  ratioToCents,
  signedWrapDiff,
  wrapToCycle,
  clamp
} from './index';
import { createLogger } from '../logger';

export interface ModeBResult {
  notesCents: number[];
  intervals: IntervalError[];
}

const log = createLogger('temperament/modeB');

const solveWeightedLeastSquares = (
  N: number,
  cycle: number,
  constraints: IntervalError[],
  iters: number,
  lr: number
) => {
  
  let x = buildEqualTemperament(N, cycle);
  x[0] = 0;

  const grad = new Array(N).fill(0);

  const computeLossAndGrad = () => {
    grad.fill(0);
    let loss = 0;
    for (const c of constraints) {
      const i = c.i, j = c.j;
      const actual = wrapToCycle(x[j] - x[i], cycle);
      const err = signedWrapDiff(actual, c.targetCents, cycle);
      const w = c.weight;
      loss += w * err * err;

      const g = 2 * w * err;
      grad[j] += g;
      grad[i] -= g;
    }
    
    grad[0] = 0;
    return loss;
  };

  for (let t=0;t<iters;t++){
    computeLossAndGrad();
    for (let k=1;k<N;k++){
      x[k] = wrapToCycle(x[k] - lr * grad[k], cycle);
    }
    
    const et = buildEqualTemperament(N, cycle);
    const mix = 0.02;
    for (let k=1;k<N;k++){
      x[k] = wrapToCycle((1-mix)*x[k] + mix*et[k], cycle);
    }
  }

  const withIdx = x.map((c, idx)=>({c, idx}));
  withIdx.sort((a,b)=>a.c-b.c);
  const out = withIdx.map(o=>o.c);
  
  const offset = out[0];
  for (let i = 0; i < out.length; i++) {
    out[i] = wrapToCycle(out[i] - offset, cycle);
  }
  
  return out;
};

const getTarget = (targets: RatioSpec[], n:number, d:number): RatioSpec | null => {
  for (const r of targets) if (r.n===n && r.d===d) return r;
  return null;
};

export const solveModeB = (input: SolverInput): ModeBResult => {
  const N = input.scaleSize;
  const cycle = input.cycleCents;

  const userTargets = input.targets.length > 0 ? input.targets : [
    { n: 3, d: 2, label: '3/2' },
    { n: 5, d: 4, label: '5/4' }
  ];

  const targetInfos = userTargets.map(t => ({
    ratio: t,
    targetCents: wrapToCycle(ratioToCents(t), cycle),
    step: nearestStepForRatio(ratioToCents(t), N, cycle),
    
    kind: ((): 'P5' | 'M3' | 'm3' => {
      const cents = ratioToCents(t);
      if (cents > 650 && cents < 750) return 'P5';  
      if (cents > 350 && cents < 420) return 'M3';  
      if (cents > 280 && cents < 340) return 'm3';  
      return 'M3'; 
    })()
  }));

  const stepCents = cycle / N;
  const poorApproximations = new Set<number>();
  
  targetInfos.forEach((info, idx) => {
    const bestStepCents = info.step * stepCents;
    const error = Math.abs(signedWrapDiff(bestStepCents, info.targetCents, cycle));
    const tolerance = info.ratio.tolerance ?? input.globalToleranceCents;
    
    if (error > tolerance * 2) {
      poorApproximations.add(idx);
      log.warn(
        `Ratio ${info.ratio.n}/${info.ratio.d} has poor approximation in ${N}-EDO`,
        { error: Number(error.toFixed(1)), tolerance }
      );
    }
  });

  const keys = buildKeySetOnFifths(input.keySpecificity.tonic, input.keySpecificity.flats, input.keySpecificity.sharps, N);
  const skeleton = buildHarmonicSkeletonPairs(keys, N);

  const constraints: IntervalError[] = [];

  const skeletonSet = new Set<string>();
  for (const p of skeleton) skeletonSet.add(`${p.a}-${p.b}-${p.kind}-${p.keyTonic}`);

  const tonicPc = input.keySpecificity.tonic;
  const keyRange = input.keySpecificity.flats + input.keySpecificity.sharps;
  
  const weightFor = (i: number, j: number, kind: 'P5' | 'M3' | 'm3') => {
    
    const distI = Math.min(
      Math.abs((i - tonicPc + N) % N),
      Math.abs((tonicPc - i + N) % N)
    );
    const distJ = Math.min(
      Math.abs((j - tonicPc + N) % N),
      Math.abs((tonicPc - j + N) % N)
    );
    
    const avgDist = (distI + distJ) / 2;
    
    let isSkel = false;
    let keyTonic: number | undefined = undefined;
    
    for (const p of skeleton) {
      if (p.a === i && p.b === j && p.kind === kind) {
        isSkel = true;
        keyTonic = p.keyTonic;
        break;
      }
    }
    
    const baseWeight = isSkel ? 5.0 : 1.0;
    
    const decayRate = 0.15; 
    const distanceWeight = Math.exp(-decayRate * avgDist);
    
    const w = baseWeight * distanceWeight;
    
    return { w, isSkel, keyTonic };
  };

  const addConstraint = (i: number, j: number, step: number, kind: 'P5' | 'M3' | 'm3', target: RatioSpec, targetCents: number) => {
    const wf = weightFor(i, j, kind);
    constraints.push({
      i, j, step, kind,
      target, targetCents,
      actualCents: 0,
      errorCents: 0,
      weight: wf.w,
      isSkeleton: wf.isSkel,
      keyTonic: wf.keyTonic
    });
  };

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const step = (j - i + N) % N;

      for (let idx = 0; idx < targetInfos.length; idx++) {
        const info = targetInfos[idx];
        if (step === info.step) {
          const wf = weightFor(i, j, info.kind);
          
          let finalWeight = wf.w;
          if (poorApproximations.has(idx)) {
            finalWeight *= 0.3; 
          }
          
          constraints.push({
            i, j, step, kind: info.kind,
            target: info.ratio, targetCents: info.targetCents,
            actualCents: 0,
            errorCents: 0,
            weight: finalWeight,
            isSkeleton: wf.isSkel,
            keyTonic: wf.keyTonic
          });
        }
      }
    }
  }

  if (input.curveShape === 'gradual') {
    for (const c of constraints) {
      if (c.isSkeleton) continue;
      
      c.weight *= 0.7;
    }
  }

  let x = buildEqualTemperament(N, cycle);
  x[0]=0;

  let cents = x;
  for (let round=0; round<6; round++){
    cents = solveWeightedLeastSquares(N, cycle, constraints, 220, 0.00035);

    let maxAbs = 0;
    for (const c of constraints) {
      const actual = wrapToCycle(cents[c.j] - cents[c.i], cycle);
      const err = signedWrapDiff(actual, c.targetCents, cycle);
      c.actualCents = actual;
      c.errorCents = err;
      maxAbs = Math.max(maxAbs, Math.abs(err));
    }
    
    for (const c of constraints) {
      if (c.isSkeleton) continue;
      const e = Math.abs(c.errorCents);
      const factor = 1 + 2.5 * Math.pow(e / Math.max(1e-6, maxAbs), 2);
      c.weight = clamp(c.weight * factor, 0.25, 12);
    }
  }

  let maxErrorFound = 0;
  let maxErrorRatio = '';
  
  for (const c of constraints) {
    const actual = wrapToCycle(cents[c.j] - cents[c.i], cycle);
    const err = signedWrapDiff(actual, c.targetCents, cycle);
    c.actualCents = actual;
    c.errorCents = err;
    
    const absErr = Math.abs(err);
    if (absErr > maxErrorFound) {
      maxErrorFound = absErr;
      maxErrorRatio = `${c.target.n}/${c.target.d}`;
    }
  }
  
  if (maxErrorFound > input.globalToleranceCents * 2) {
    log.warn('Large error detected', {
      ratio: maxErrorRatio,
      error: Number(maxErrorFound.toFixed(1)),
      tolerance: input.globalToleranceCents,
      edo: N
    });
  }

  const withIdx = cents.map((c, idx)=>({c, idx}));
  withIdx.sort((a,b)=>a.c-b.c);
  const out = withIdx.map(o=>o.c);
  
  const offset = out[0];
  for (let i = 0; i < out.length; i++) {
    out[i] = wrapToCycle(out[i] - offset, cycle);
  }

  return { notesCents: out, intervals: constraints };
};
