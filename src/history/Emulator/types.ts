/**
 * @module Emulator
 * @description Type definitions for the Historical Synth Emulator and Scala file handling.
 */

/**
 * Represents a parsed Scala (.scl) tuning file.
 */
export interface ScalaTuning {
  /** Description or name of the tuning. */
  description: string;

  /** Number of notes in the scale (excluding the root/octave usually, but Scala format varies). */
  count: number;

  /** 
   * Array of pitch values. 
   * Can be in cents (e.g. 100.0) or ratios (e.g. 3/2).
   * Typically normalized to cents or frequency multipliers.
   */
  pitches: number[];
  
  /** 
   * Original raw lines from the file for reference. 
   */
  rawLines?: string[];
}

/**
 * Interface for a synthesizer voice.
 */
export interface SynthVoice {
  /** The oscillator node. */
  oscillator: OscillatorNode;

  /** The gain node (envelope). */
  gain: GainNode;

  /** 
   * Starts the note.
   * @param frequency Frequency in Hz.
   * @param time Start time (AudioContext time).
   */
  start(frequency: number, time?: number): void;

  /**
   * Stops the note.
   * @param time Stop time.
   */
  stop(time?: number): void;
}
