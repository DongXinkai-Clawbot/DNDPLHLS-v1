/**
 * @module GeneticTuner
 * @description Standard fitness functions for temperament tuning.
 */

import { FitnessFunction } from './types';

/**
 * Creates a fitness function that minimizes the error between a generated scale and target intervals.
 * Assumes genes represent [Period, Generator] in cents.
 * 
 * @param targetRatios Array of target frequency ratios (e.g. 3/2, 5/4).
 * @param mappings Array of [periodSteps, generatorSteps] for each target ratio.
 *                 E.g. for 3/2 in Meantone (1/4 comma), mapping might be [0, 1] (one generator).
 *                 This defines the "ideal" mapping for the temperament.
 * @returns A fitness function returning negative total squared error (higher is better).
 */
export const createRank2Fitness = (
  targetRatios: number[],
  mappings: [number, number][]
): FitnessFunction => {
  // Pre-calculate target cents
  const targetCents = targetRatios.map(r => 1200 * Math.log2(r));

  return (genes: number[]) => {
    const [period, generator] = genes;
    let totalErrorSq = 0;

    for (let i = 0; i < targetCents.length; i++) {
      const [pSteps, gSteps] = mappings[i];
      
      // Calculate tuned interval in cents
      // Note: We might need to reduce by period, but typically we compare absolute distance
      // or the difference modulo period.
      // Here we assume the mapping defines the specific interval combination.
      const tunedCents = (pSteps * period) + (gSteps * generator);
      
      // Error
      const diff = tunedCents - targetCents[i];
      totalErrorSq += diff * diff;
    }

    // Return negative error (minimization)
    return -totalErrorSq;
  };
};
