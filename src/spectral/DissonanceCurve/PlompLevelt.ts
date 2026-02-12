/**
 * @module DissonanceCurve
 * @description Implementation of the Plomp-Levelt dissonance model as parametrized by Sethares.
 */

import { Spectrum, Partial } from './types';

/**
 * Constants for the Sethares dissonance curve parametrization.
 */
const B1 = 3.5;
const B2 = 5.75;
const D_STAR = 0.24;
const S1 = 0.0207;
const S2 = 18.96;

/**
 * Calculates the sensory dissonance between two pure tones (partials).
 * 
 * @param f1 Frequency of the first partial.
 * @param a1 Amplitude of the first partial.
 * @param f2 Frequency of the second partial.
 * @param a2 Amplitude of the second partial.
 * @returns The dissonance contribution of this pair.
 */
export const calculatePairDissonance = (
  f1: number,
  a1: number,
  f2: number,
  a2: number
): number => {
  if (a1 === 0 || a2 === 0) return 0;
  
  const fMin = Math.min(f1, f2);
  const fMax = Math.max(f1, f2);
  const diff = fMax - fMin;

  // Critical bandwidth approximation (Sethares)
  // s = D* / (s1 * fMin + s2)
  // This scales the dissonance curve based on frequency range (CB gets wider at higher freqs).
  const s = D_STAR / (S1 * fMin + S2);

  const x = s * diff;
  
  // Dissonance function: d(x) = e^(-b1*x) - e^(-b2*x)
  // Scaled by amplitudes
  return a1 * a2 * (Math.exp(-B1 * x) - Math.exp(-B2 * x));
};

/**
 * Calculates the total sensory dissonance of a complex spectrum.
 * Sums the pairwise dissonance of all partials.
 * 
 * @param spectrum The complex tone spectrum.
 * @returns The total dissonance value.
 */
export const calculateSpectrumDissonance = (spectrum: Spectrum): number => {
  let totalDissonance = 0;
  const partials = spectrum.partials;
  const n = partials.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalDissonance += calculatePairDissonance(
        partials[i].frequency,
        partials[i].amplitude,
        partials[j].frequency,
        partials[j].amplitude
      );
    }
  }

  return totalDissonance;
};

/**
 * Calculates the dissonance between two complex spectra sounding together.
 * Used to calculate the dissonance of an interval.
 * 
 * @param s1 The first spectrum (e.g. root note).
 * @param s2 The second spectrum (e.g. interval note).
 * @returns The total dissonance of the combined sound.
 */
export const calculateIntervalDissonance = (s1: Spectrum, s2: Spectrum): number => {
  // Combine partials
  // We need to calculate internal dissonance of s1 + internal dissonance of s2 + interaction dissonance
  // Usually, we care about the interaction dissonance or the total dissonance of the superposition.
  // The curve is usually "roughness vs interval", which includes intrinsic roughness?
  // Sethares usually plots the total roughness of the superposition.
  
  const combinedPartials = [...s1.partials, ...s2.partials];
  
  // Sort by frequency for efficiency? Not strictly needed for O(N^2) double loop,
  // but good for other algorithms. Here we just use the simple loop.
  
  return calculateSpectrumDissonance({ partials: combinedPartials });
};
