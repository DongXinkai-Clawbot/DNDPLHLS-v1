export interface Wavetable {
  id: string;
  name: string;
  waveforms: Float32Array[];
  length: number; // Length of each waveform (e.g. 2048)
  morphMode: 'linear' | 'spectral';
}

/**
 * A wavetable oscillator engine capable of morphing between waveforms.
 */
export class WavetableOscillator {
  private wavetable: Wavetable | null = null;
  private phase: number = 0;
  private sampleRate: number = 44100;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  /**
   * Sets the wavetable to use.
   * @param wt The Wavetable object.
   */
  public setWavetable(wt: Wavetable): void {
    if (wt.waveforms.length === 0) {
        throw new Error('Wavetable must contain at least one waveform');
    }
    if (wt.waveforms.some(w => w.length !== wt.length)) {
      throw new Error('All waveforms must have the same length as defined in the wavetable');
    }
    this.wavetable = wt;
  }

  /**
   * Generates the next sample.
   * @param frequency Frequency in Hz.
   * @param position Morph position (0.0 to 1.0).
   * @param phaseMod Phase modulation amount (0.0 to 1.0).
   */
  public getSample(frequency: number, position: number, phaseMod: number = 0): number {
    if (!this.wavetable || this.wavetable.waveforms.length === 0) return 0;

    // Calculate phase increment
    const phaseInc = frequency / this.sampleRate;
    this.phase += phaseInc;
    
    // Wrap phase
    if (this.phase >= 1.0) this.phase -= 1.0;
    if (this.phase < 0) this.phase += 1.0; // Handle negative frequency edge case

    // Apply phase modulation
    let currentPhase = this.phase + phaseMod;
    // Wrap currentPhase to 0-1
    currentPhase = currentPhase - Math.floor(currentPhase);

    // Determine waveform morphing
    const numWaves = this.wavetable.waveforms.length;
    // position 0 -> index 0, position 1 -> index N-1
    let waveIndex = position * (numWaves - 1);
    waveIndex = Math.max(0, Math.min(numWaves - 1.000001, waveIndex)); // prevent overflow
    
    const indexA = Math.floor(waveIndex);
    const indexB = Math.min(indexA + 1, numWaves - 1);
    const morph = waveIndex - indexA;

    const waveA = this.wavetable.waveforms[indexA];
    const waveB = this.wavetable.waveforms[indexB];

    // Read sample from waveA and waveB with linear interpolation for phase
    const sampleA = this.readWave(waveA, currentPhase);
    
    // Optimization: avoid reading B if morph is 0
    if (morph <= 0.001) return sampleA;
    if (morph >= 0.999) return this.readWave(waveB, currentPhase);

    const sampleB = this.readWave(waveB, currentPhase);

    // Morph between waveA and waveB (linear interpolation)
    return sampleA * (1 - morph) + sampleB * morph;
  }

  /**
   * Resets the oscillator phase.
   */
  public resetPhase(): void {
    this.phase = 0;
  }

  /**
   * Reads a sample from a waveform at a specific phase using linear interpolation.
   */
  private readWave(wave: Float32Array, phase: number): number {
    const len = wave.length;
    const pos = phase * len;
    const index = Math.floor(pos);
    const frac = pos - index;
    
    // Wrap index for circular buffer
    const s0 = wave[index % len];
    const s1 = wave[(index + 1) % len];
    
    return s0 + (s1 - s0) * frac;
  }
}
