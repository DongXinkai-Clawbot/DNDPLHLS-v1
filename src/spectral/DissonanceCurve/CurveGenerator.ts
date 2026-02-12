/**
 * @module DissonanceCurve
 * @description Generates dissonance curves for a given spectrum.
 */

import { Spectrum, DissonanceCurveData, Partial } from './types';
import { calculateSpectrumDissonance } from './PlompLevelt';

/**
 * Generates a dissonance curve by sweeping a second tone against a fixed reference tone.
 * 
 * @param referenceSpectrum The spectrum of the fixed tone (root).
 * @param sweepSpectrum The spectrum of the sweeping tone (interval). usually identical to reference.
 * @param startRatio Start of the sweep (e.g. 1.0 for unison).
 * @param endRatio End of the sweep (e.g. 2.0 for octave).
 * @param steps Number of steps in the sweep.
 * @returns The dissonance curve data.
 */
export const generateDissonanceCurve = (
  referenceSpectrum: Spectrum,
  sweepSpectrum: Spectrum,
  startRatio: number = 1.0,
  endRatio: number = 2.0,
  steps: number = 100
): DissonanceCurveData => {
  const ratios: number[] = [];
  const dissonance: number[] = [];
  const stepSize = (endRatio - startRatio) / steps;

  for (let i = 0; i <= steps; i++) {
    const ratio = startRatio + i * stepSize;
    
    // Create shifted spectrum
    const shiftedPartials: Partial[] = sweepSpectrum.partials.map(p => ({
      frequency: p.frequency * ratio,
      amplitude: p.amplitude,
    }));

    // Combine spectra
    const combinedSpectrum: Spectrum = {
      partials: [...referenceSpectrum.partials, ...shiftedPartials],
    };

    // Calculate dissonance
    const d = calculateSpectrumDissonance(combinedSpectrum);
    
    ratios.push(ratio);
    dissonance.push(d);
  }

  return { ratios, dissonance };
};

/**
 * Finds local minima in the dissonance curve, which correspond to consonant intervals.
 * 
 * @param data The dissonance curve data.
 * @returns Array of ratios that are local minima.
 */
export const findLocalMinima = (data: DissonanceCurveData): number[] => {
  const minima: number[] = [];
  const { ratios, dissonance } = data;
  
  // Simple local minima check
  for (let i = 1; i < dissonance.length - 1; i++) {
    if (dissonance[i] < dissonance[i - 1] && dissonance[i] < dissonance[i + 1]) {
      minima.push(ratios[i]);
    }
  }

  return minima;
};
