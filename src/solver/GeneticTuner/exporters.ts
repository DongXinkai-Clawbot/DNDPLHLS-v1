/**
 * @module GeneticTuner
 * @description Export utilities for genetic solutions.
 */

import { Individual } from './types';
import { ScalaTuning } from '../../history/Emulator/types';

/**
 * Converts a Rank-2 temperament genome (Period, Generator) into a ScalaTuning.
 * Generates a chain of generators.
 * 
 * @param individual The individual to export.
 * @param chainLength Number of notes in the chain (e.g. 12 for chromatic).
 * @param description Description for the Scala file.
 * @returns A ScalaTuning object.
 */
export const exportRank2ToScala = (
  individual: Individual,
  chainLength: number = 12,
  description: string = 'Genetic Rank-2 Tuning'
): ScalaTuning => {
  const [period, generator] = individual.genes;
  
  // Generate chain: 0, 1*gen, 2*gen ...
  // reduced by period.
  
  const pitches: number[] = [];
  
  // Generate chain from 0 to chainLength - 1
  for (let i = 0; i < chainLength; i++) {
    let cents = (i * generator) % period;
    while (cents < 0) cents += period;
    pitches.push(cents);
  }
  
  // Filter out the root (approximated by 0 or very small value)
  // And ensure unique values
  const uniquePitches = Array.from(new Set(pitches))
    .filter(p => p > 0.001)
    .sort((a, b) => a - b);
    
  // Append period as the closure of the scale
  uniquePitches.push(period);
  
  return {
    description: `${description} (P: ${period.toFixed(3)}, G: ${generator.toFixed(3)})`,
    count: uniquePitches.length,
    pitches: uniquePitches,
  };
};
