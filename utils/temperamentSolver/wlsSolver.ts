
import type { Rank2Constraint } from './index';
import { clamp, ratioToCents } from './index';
import { createLogger } from '../logger';

export const ANCHOR_WEIGHT_MIN = 0.1;   
export const ANCHOR_WEIGHT_MAX = 100;   

export const REF_GENERATOR_CENTS = 1200 * Math.log2(3 / 2); 

const log = createLogger('temperament/wls');

export const PERIOD_MIN = 1190;
export const PERIOD_MAX = 1210;

export interface WLSResult {
  generatorCents: number;       
  periodCents: number;          
  residuals: number[];          
  conditionNumber: number;      
  wasClamped: boolean;          
}

export function estimatePeriodSteps(
  idealCents: number,
  generatorSteps: number,
  refGenerator: number = REF_GENERATOR_CENTS,
  cycle: number = 1200
): number {
  if (generatorSteps === 0) return 0;
  const rawOffset = (generatorSteps * refGenerator - idealCents) / cycle;
  return Math.round(rawOffset);
}

export function estimateGeneratorSteps(
  idealCents: number,
  refGenerator: number = REF_GENERATOR_CENTS,
  cycle: number = 1200
): number {
  let bestStep = 1;
  let minDiff = Infinity;

  for (let k = -31; k <= 31; k++) {
    if (k === 0) continue;
    
    let generated = (k * refGenerator) % cycle;
    if (generated < 0) generated += cycle;
    
    const diff1 = Math.abs(generated - idealCents);
    const diff2 = Math.abs(generated - cycle - idealCents);
    const diff3 = Math.abs(generated + cycle - idealCents);
    const diff = Math.min(diff1, diff2, diff3);
    
    if (diff < minDiff) {
      minDiff = diff;
      bestStep = k;
    }
  }
  return bestStep;
}

export function buildDesignMatrix(constraints: Rank2Constraint[]): number[][] {
  return constraints.map(c => [c.generatorSteps, c.periodSteps]);
}

export function buildWeightArray(constraints: Rank2Constraint[]): number[] {
  return constraints.map(c => c.weight);
}

export function buildTargetVector(constraints: Rank2Constraint[]): number[] {
  return constraints.map(c => c.idealCents);
}

export function solve2x2(
  A: [[number, number], [number, number]],
  b: [number, number]
): [number, number] | null {
  const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
  if (Math.abs(det) < 1e-10) return null; 
  
  const invDet = 1 / det;
  return [
    invDet * (A[1][1] * b[0] - A[0][1] * b[1]),  
    invDet * (A[0][0] * b[1] - A[1][0] * b[0])   
  ];
}

export function estimateConditionNumber(A: [[number, number], [number, number]]): number {
  
  const a = A[0][0], b = A[0][1], c = A[1][0], d = A[1][1];
  const trace = a * a + b * b + c * c + d * d;
  const det = Math.abs(a * d - b * c);
  if (det < 1e-15) return Infinity;
  return Math.sqrt(trace) / Math.sqrt(det);
}

export function solveNormalEquations(
  X: number[][],
  W: number[],
  Y: number[]
): { solution: [number, number]; conditionNumber: number } | null {
  const n = X.length;
  if (n === 0) return null;

  let a00 = 0, a01 = 0, a10 = 0, a11 = 0;
  for (let i = 0; i < n; i++) {
    const w = W[i];
    const s = X[i][0]; 
    const o = X[i][1]; 
    a00 += w * s * s;
    a01 += w * s * o;
    a10 += w * o * s;
    a11 += w * o * o;
  }
  const XtWX: [[number, number], [number, number]] = [[a00, a01], [a10, a11]];

  let b0 = 0, b1 = 0;
  for (let i = 0; i < n; i++) {
    const w = W[i];
    const s = X[i][0];
    const o = X[i][1];
    const y = Y[i];
    b0 += w * s * y;
    b1 += w * o * y;
  }
  const XtWY: [number, number] = [b0, b1];

  const condNum = estimateConditionNumber(XtWX);
  if (condNum > 1e10) return null; 

  const solution = solve2x2(XtWX, XtWY);
  if (!solution) return null;

  return { solution, conditionNumber: condNum };
}

export function createOctaveAnchor(octaveStiffness: number): Rank2Constraint {
  
  const stiffness = clamp(octaveStiffness, 0, 1);
  
  const weight = ANCHOR_WEIGHT_MIN + stiffness * (ANCHOR_WEIGHT_MAX - ANCHOR_WEIGHT_MIN);

  return {
    label: '2/1 (Octave Anchor)',
    n: 2,
    d: 1,
    weight,
    idealCents: 1200,
    generatorSteps: 0,  
    periodSteps: 1      
  };
}

export function optimizeGeneratorWithFixedPeriod(
  constraints: Rank2Constraint[],
  fixedPeriod: number
): number {
  
  let sumWss = 0;  
  let sumWsy = 0;  
  
  for (const c of constraints) {
    const w = c.weight;
    const s = c.generatorSteps;
    const adjustedTarget = c.idealCents - c.periodSteps * fixedPeriod;
    
    sumWss += w * s * s;
    sumWsy += w * s * adjustedTarget;
  }
  
  if (Math.abs(sumWss) < 1e-10) {
    
    return REF_GENERATOR_CENTS;
  }
  
  return sumWsy / sumWss;
}

export function computeResiduals(
  constraints: Rank2Constraint[],
  g: number,
  p: number
): number[] {
  return constraints.map(c => {
    const predicted = c.generatorSteps * g + c.periodSteps * p;
    return predicted - c.idealCents;
  });
}

export function solveWLS(
  constraints: Rank2Constraint[],
  octaveStiffness: number = 1.0,
  fallbackGenerator: number = REF_GENERATOR_CENTS
): WLSResult {
  
  const anchor = createOctaveAnchor(octaveStiffness);
  const allConstraints = [...constraints, anchor];

  const X = buildDesignMatrix(allConstraints);
  const W = buildWeightArray(allConstraints);
  const Y = buildTargetVector(allConstraints);

  const result = solveNormalEquations(X, W, Y);

  if (!result) {
    
    log.warn('Singular matrix detected, falling back to Rank-1 mode');
    return {
      generatorCents: fallbackGenerator,
      periodCents: 1200,
      residuals: computeResiduals(allConstraints, fallbackGenerator, 1200),
      conditionNumber: Infinity,
      wasClamped: false
    };
  }

  let [g_opt, p_opt] = result.solution;
  let wasClamped = false;

  if (p_opt < PERIOD_MIN || p_opt > PERIOD_MAX) {
    wasClamped = true;
    p_opt = clamp(p_opt, PERIOD_MIN, PERIOD_MAX);
    
    g_opt = optimizeGeneratorWithFixedPeriod(allConstraints, p_opt);
  }

  const residuals = computeResiduals(allConstraints, g_opt, p_opt);

  return {
    generatorCents: g_opt,
    periodCents: p_opt,
    residuals,
    conditionNumber: result.conditionNumber,
    wasClamped
  };
}

export function buildRank2Constraints(
  ratios: Array<{ n: number; d: number; label?: string; weight: number }>,
  cycle: number = 1200
): Rank2Constraint[] {
  return ratios.map(r => {
    const idealCents = ratioToCents({ n: r.n, d: r.d });
    const generatorSteps = estimateGeneratorSteps(idealCents, REF_GENERATOR_CENTS, cycle);
    const periodSteps = estimatePeriodSteps(idealCents, generatorSteps, REF_GENERATOR_CENTS, cycle);

    return {
      label: r.label || `${r.n}/${r.d}`,
      n: r.n,
      d: r.d,
      weight: r.weight,
      idealCents,
      generatorSteps,
      periodSteps
    };
  });
}
