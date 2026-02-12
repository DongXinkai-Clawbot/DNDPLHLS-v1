/**
 * @module DissonanceCurve
 * @description Utilities to generate spectra for common waveforms.
 */

import { Spectrum, Partial } from './types';

/**
 * Generates a harmonic series spectrum.
 * 
 * @param f0 Fundamental frequency.
 * @param numPartials Number of partials to generate.
 * @param amplitudeFn Function mapping partial index (1-based) to amplitude.
 * @returns A Spectrum object.
 */
export const createHarmonicSpectrum = (
  f0: number,
  numPartials: number,
  amplitudeFn: (n: number) => number
): Spectrum => {
  const partials: Partial[] = [];
  for (let n = 1; n <= numPartials; n++) {
    partials.push({
      frequency: f0 * n,
      amplitude: amplitudeFn(n),
    });
  }
  return { partials };
};

/**
 * Creates a Sawtooth wave spectrum (1/n amplitude).
 */
export const createSawtooth = (f0: number, numPartials: number = 10): Spectrum => {
  return createHarmonicSpectrum(f0, numPartials, n => 1 / n);
};

/**
 * Creates a Square wave spectrum (1/n for odd n only).
 */
export const createSquare = (f0: number, numPartials: number = 10): Spectrum => {
  return createHarmonicSpectrum(f0, numPartials, n => (n % 2 === 1 ? 1 / n : 0));
};

/**
 * Creates a Triangle wave spectrum (1/n^2 for odd n only).
 */
export const createTriangle = (f0: number, numPartials: number = 10): Spectrum => {
  return createHarmonicSpectrum(f0, numPartials, n => (n % 2 === 1 ? 1 / (n * n) : 0));
};

/**
 * Creates a generic harmonic series with exponential rolloff.
 * A = e^(-decay * n)
 */
export const createDecayingHarmonic = (f0: number, numPartials: number = 10, decay: number = 0.5): Spectrum => {
  return createHarmonicSpectrum(f0, numPartials, n => Math.exp(-decay * (n - 1)));
};
