/**
 * @module DissonanceCurve
 * @description Type definitions for spectral analysis and dissonance calculation.
 */

/**
 * Represents a single partial (harmonic or inharmonic component) in a sound spectrum.
 */
export interface Partial {
  /** Frequency in Hz. */
  frequency: number;

  /** Amplitude (linear scale, usually normalized 0-1). */
  amplitude: number;
}

/**
 * Represents a complete spectrum of a sound.
 */
export interface Spectrum {
  partials: Partial[];
}

/**
 * Configuration for the Plomp-Levelt dissonance model.
 */
export interface DissonanceConfig {
  /**
   * Reference frequency for critical bandwidth scaling.
   * Default usually around 500Hz or derived from psychoacoustic models.
   */
  referenceFreq?: number;

  /**
   * Scaling factor for the dissonance curve width.
   * Adjusts the point of maximum dissonance (critical bandwidth).
   * Default 0.25 (approximate for simple tones).
   */
  b1?: number;
  b2?: number;
}

/**
 * Result of a dissonance curve calculation.
 */
export interface DissonanceCurveData {
  /** Array of interval ratios (e.g. 1.0 to 2.0). */
  ratios: number[];

  /** Corresponding dissonance values. */
  dissonance: number[];
}
