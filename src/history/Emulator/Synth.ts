/**
 * @module Emulator
 * @description A Web Audio API based synthesizer for playing microtonal scales.
 */

import { ScalaTuning } from './types';
import { centsToRatio } from './ScalaLoader';

/**
 * A simple synth engine that can play notes from a Scala tuning.
 */
export class MicrotonalSynth {
  private ctx: AudioContext;
  private tuning: ScalaTuning;
  private baseFrequency: number;

  /**
   * Creates a new synth instance.
   * @param tuning The Scala tuning to use.
   * @param baseFrequency The frequency of the root note (degree 0). Default 440Hz.
   */
  constructor(tuning: ScalaTuning, baseFrequency: number = 440) {
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
    } else {
      // Mock or throw in non-browser env
      this.ctx = {} as AudioContext;
    }
    this.tuning = tuning;
    this.baseFrequency = baseFrequency;
  }

  /**
   * Updates the current tuning.
   * @param tuning New ScalaTuning object.
   */
  setTuning(tuning: ScalaTuning): void {
    this.tuning = tuning;
  }

  /**
   * Calculates the frequency for a given scale degree.
   * Supports octaves for degrees outside [0, count].
   * @param degree The scale degree (0-indexed).
   * @returns Frequency in Hz.
   */
  getFrequency(degree: number): number {
    const count = this.tuning.count;
    // Calculate octave shift
    const octave = Math.floor(degree / count);
    const step = ((degree % count) + count) % count; // Handle negative degrees correctly

    // Get cents for this step
    // Note: pitches[step] is cents from root.
    // If step is 0 (root), cents is usually 0?
    // Scala files usually list notes starting from index 1 (the first interval).
    // The root (unison) is implicit.
    // So pitches array has length 'count'.
    // Index 0 of pitches corresponds to degree 1 of the scale?
    // Wait, let's assume `pitches` has `count` entries.
    // Standard: 
    // count = 7
    // 100.0 (degree 1)
    // 200.0
    // ...
    // 1200.0 (degree 7 / octave)
    
    // So degree 0 is the root.
    // degree 1 is pitches[0].
    
    let cents = 0;
    if (step > 0) {
      cents = this.tuning.pitches[step - 1];
    } else if (step === 0) {
      cents = 0;
    }

    // However, the last pitch usually defines the "formal octave" or period.
    // For standard scales, pitches[count-1] is the octave (1200 cents).
    // So for `octave` calculation, we should use the period defined by the last interval.
    
    const periodCents = this.tuning.pitches[this.tuning.count - 1];
    
    // Total cents = octave * period + step_cents
    const totalCents = octave * periodCents + cents;
    
    const ratio = centsToRatio(totalCents);
    return this.baseFrequency * ratio;
  }

  /**
   * Plays a note at the specified scale degree.
   * @param degree Scale degree.
   * @param duration Duration in seconds.
   * @param time Start time (optional, defaults to now).
   */
  playNote(degree: number, duration: number = 0.5, time?: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    const now = time || this.ctx.currentTime;
    const freq = this.getFrequency(degree);

    osc.frequency.setValueAtTime(freq, now);
    osc.type = 'sine'; // Simple sine wave for purity

    // Envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.05); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Decay

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /**
   * Resumes the AudioContext if suspended.
   */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Closes the AudioContext.
   */
  close(): void {
    this.ctx.close();
  }
}
