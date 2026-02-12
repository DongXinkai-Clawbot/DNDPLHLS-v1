
import type { AdvancedIntervalSpec, IntervalError, SolverInput } from './index';
import {
  buildEqualTemperament,
  clamp,
  nearestStepForRatio,
  ratioToCents,
  signedWrapDiff,
  wrapToCycle
} from './index';

interface AdvancedConstraint extends IntervalError {
  baseWeight: number;
  toleranceCents: number;
  maxErrorCents?: number;
  priority: number;
}

const classifyKind = (cents: number): 'P5' | 'M3' | 'm3' => {
  if (cents > 650 && cents < 750) return 'P5';
  if (cents > 350 && cents < 420) return 'M3';
  if (cents > 280 && cents < 340) return 'm3';
  return 'M3';
};

const normalizeDegree = (degree: number, N: number) => {
  const d = Math.round(degree);
  if (!Number.isFinite(d)) return 0;
  return ((d % N) + N) % N;
};

const buildAdvancedConstraints = (
  intervals: AdvancedIntervalSpec[],
  N: number,
  cycle: number
): AdvancedConstraint[] => {
  const constraints: AdvancedConstraint[] = [];
  intervals.forEach(spec => {
    if (!Number.isFinite(spec.priority) || spec.priority <= 0) return;
    const i = normalizeDegree(spec.degree, N);
    const targetCents = wrapToCycle(ratioToCents({ n: spec.n, d: spec.d, label: spec.label }), cycle);
    const rawStep = nearestStepForRatio(targetCents, N, cycle);
    const step = Math.max(1, Math.min(N - 1, rawStep));
    const j = (i + step) % N;
    const tol = Math.max(0.001, spec.toleranceCents || 0.001);
    const baseWeight = Math.max(0, spec.priority);
    const kind = classifyKind(targetCents);
    constraints.push({
      i,
      j,
      step,
      target: { n: spec.n, d: spec.d, label: spec.label || `${spec.n}/${spec.d}`, tolerance: tol },
      targetCents,
      actualCents: 0,
      errorCents: 0,
      weight: baseWeight,
      baseWeight,
      toleranceCents: tol,
      maxErrorCents: spec.maxErrorCents,
      priority: spec.priority,
      kind,
      isSkeleton: false
    });
  });
  return constraints;
};

const solveWeightedLeastSquares = (
  N: number,
  cycle: number,
  constraints: AdvancedConstraint[],
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
      const actual = wrapToCycle(x[c.j] - x[c.i], cycle);
      const err = signedWrapDiff(actual, c.targetCents, cycle);
      const w = c.weight;
      loss += w * err * err;
      const g = 2 * w * err;
      grad[c.j] += g;
      grad[c.i] -= g;
    }
    grad[0] = 0;
    return loss;
  };

  for (let t = 0; t < iters; t++) {
    computeLossAndGrad();
    for (let k = 1; k < N; k++) {
      x[k] = wrapToCycle(x[k] - lr * grad[k], cycle);
    }
    
    const et = buildEqualTemperament(N, cycle);
    const mix = 0.02;
    for (let k = 1; k < N; k++) {
      x[k] = wrapToCycle((1 - mix) * x[k] + mix * et[k], cycle);
    }
  }

  const withIdx = x.map((c, idx) => ({ c, idx }));
  withIdx.sort((a, b) => a.c - b.c);
  const out = withIdx.map(o => o.c);
  const offset = out[0];
  for (let i = 0; i < out.length; i++) {
    out[i] = wrapToCycle(out[i] - offset, cycle);
  }
  return out;
};

const solveForCycle = (
  N: number,
  cycle: number,
  specs: AdvancedIntervalSpec[]
) => {
  const constraints = buildAdvancedConstraints(specs, N, cycle);
  if (constraints.length === 0) {
    return {
      cents: buildEqualTemperament(N, cycle),
      constraints,
      cost: 0
    };
  }

  let cents = buildEqualTemperament(N, cycle);
  for (let round = 0; round < 5; round++) {
    cents = solveWeightedLeastSquares(N, cycle, constraints, 220, 0.00035);
    for (const c of constraints) {
      const actual = wrapToCycle(cents[c.j] - cents[c.i], cycle);
      const err = signedWrapDiff(actual, c.targetCents, cycle);
      c.actualCents = actual;
      c.errorCents = err;
    }
    for (const c of constraints) {
      const errAbs = Math.abs(c.errorCents);
      const tol = Math.max(0.001, c.toleranceCents || 0.001);
      const norm = errAbs / tol;
      let factor = 1 + 1.6 * norm * norm;
      if (c.maxErrorCents !== undefined && c.maxErrorCents > 0 && errAbs > c.maxErrorCents) {
        const over = errAbs / c.maxErrorCents;
        factor *= 6 + 18 * (over * over);
      }
      c.weight = clamp(c.baseWeight * factor, 0.0001, 1e6);
    }
  }

  let cost = 0;
  for (const c of constraints) {
    const tol = Math.max(0.001, c.toleranceCents || 0.001);
    const w = c.baseWeight / (tol * tol);
    cost += w * c.errorCents * c.errorCents;
  }

  return { cents, constraints, cost };
};

const goldenSectionSearch = (f: (x: number) => number, lo: number, hi: number, iters: number = 18) => {
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

export const solveAdvancedConstraints = (input: SolverInput) => {
  const adv = input.advancedConstraints;
  const N = input.scaleSize;
  const boundaryCents = input.cycleCents;
  const specs = adv?.intervals ?? [];

  const octave = adv?.octave;
  const octaveTol = octave?.toleranceCents ?? 0;
  const octavePriority = octave?.priority ?? 0;
  const octaveDenom = Math.max(0.1, octaveTol || 0.1);
  const octaveWeight = octavePriority > 0 ? octavePriority / (octaveDenom * octaveDenom) : 0;

  const span = octave?.maxErrorCents ?? Math.max(5, (octaveTol || 10) * 4);
  const minCycle = Math.max(1, boundaryCents - span);
  const maxCycle = boundaryCents + span;

  const cache = new Map<number, { cost: number; cents: number[]; constraints: AdvancedConstraint[] }>();
  const evalCycle = (cycle: number) => {
    const key = parseFloat(cycle.toFixed(6));
    const cached = cache.get(key);
    if (cached) return cached;
    const solved = solveForCycle(N, cycle, specs);
    let totalCost = solved.cost;
    if (octaveWeight > 0) {
      const diff = cycle - boundaryCents;
      totalCost += octaveWeight * diff * diff;
      if (octave?.maxErrorCents && Math.abs(diff) > octave.maxErrorCents) {
        const over = Math.abs(diff) / octave.maxErrorCents;
        totalCost += octaveWeight * 50 * (over * over);
      }
    }
    const out = { cost: totalCost, cents: solved.cents, constraints: solved.constraints };
    cache.set(key, out);
    return out;
  };

  let bestCycle = boundaryCents;
  if (octaveWeight > 0 && maxCycle > minCycle) {
    bestCycle = goldenSectionSearch(c => evalCycle(c).cost, minCycle, maxCycle);
  }

  const bestEval = evalCycle(bestCycle);
  let bestCost = bestEval.cost;
  cache.forEach((v, k) => {
    if (v.cost < bestCost) {
      bestCost = v.cost;
      bestCycle = k;
    }
  });

  const best = evalCycle(bestCycle);
  const periodStretchCents = bestCycle - boundaryCents;
  const periodStretchWarning = Math.abs(periodStretchCents) > 10;

  return {
    notesCents: best.cents,
    intervals: best.constraints,
    optimizedPeriodCents: bestCycle,
    periodStretchCents,
    periodStretchWarning
  };
};
