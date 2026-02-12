import type { PrimeLimit } from '../../types';

export function calculateLoopComma(prime: PrimeLimit, steps: number): number {
  if (steps === 0) return 0;
  
  const totalCents = 1200 * Math.log2(Math.pow(prime, steps));
  
  const octaves = Math.round(totalCents / 1200);
  
  const comma = totalCents - (octaves * 1200);
  
  return comma;
}

export function calculatePerStepAdjustment(comma: number, steps: number): number {
  if (steps === 0) return 0;
  
  return -comma / steps;
}
