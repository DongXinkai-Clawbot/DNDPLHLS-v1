export interface StringParams {
  frequency: number;
  damping: number; // 0.0 to 1.0 (Brightness decay)
  decay: number; // 0.0 to 1.0 (Overall energy loss per sample)
  stiffness: number; // 0.0 to 1.0 (Not fully implemented in MVP)
  pluckPosition: number; // 0.0 to 1.0
}

export class PluckedString {
  private delayLine: Float32Array;
  private pointer: number = 0;
  private length: number;
  private sampleRate: number;
  private params: StringParams;
  private prevSample: number = 0; // For lowpass filter state

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    // Max delay length for ~20Hz
    this.delayLine = new Float32Array(Math.ceil(sampleRate / 20));
    this.length = Math.floor(sampleRate / 440);
    this.params = {
      frequency: 440,
      damping: 0.5,
      decay: 0.995,
      stiffness: 0.0,
      pluckPosition: 0.5,
    };
  }

  public setParams(params: Partial<StringParams>): void {
    this.params = { ...this.params, ...params };
    this.updateLength();
  }

  private updateLength(): void {
    // Basic integer length for now. 
    // Todo: Implement fractional delay for microtonal precision.
    this.length = Math.floor(this.sampleRate / this.params.frequency);
    if (this.length < 2) this.length = 2;
    if (this.length > this.delayLine.length) this.length = this.delayLine.length;
  }

  public pluck(velocity: number): void {
    // Initialize delay line with noise burst
    // Using pluckPosition to affect spectral content (comb filtering) could be done here,
    // but simple white noise is standard KS.
    // Velocity scales amplitude.
    
    // Fill the ACTIVE length of the buffer
    for (let i = 0; i < this.length; i++) {
      this.delayLine[i] = (Math.random() * 2 - 1) * velocity;
    }
    this.pointer = 0;
    this.prevSample = 0;
  }

  public getSample(): number {
    // Read current sample from delay line
    const currentSample = this.delayLine[this.pointer];

    // Read next sample (next in buffer = previous in time stream due to wrap?)
    // In KS: y[n] = 0.5 * (y[n-L] + y[n-L-1])
    // The buffer holds past output.
    // We are about to overwrite `pointer` with new value.
    // `pointer` points to y[n-L].
    // `pointer + 1` points to y[n-L+1] ? No.
    // `pointer` is the oldest sample. `pointer - 1` is newer.
    // If we want adjacent samples for averaging (lowpass), we need `pointer` and `pointer + 1`.
    
    const nextPtr = (this.pointer + 1) % this.length;
    const nextSample = this.delayLine[nextPtr];

    // Lowpass Filter (Damping)
    // simple average: (current + next) / 2
    // damping factor 0..1 controls mix between raw sample and averaged sample
    const averaged = 0.5 * (currentSample + nextSample);
    
    // damping = 1.0 -> fully averaged (strong damping)
    // damping = 0.0 -> no averaging (metallic/bright)
    const filtered = currentSample * (1.0 - this.params.damping) + averaged * this.params.damping;

    // Apply overall decay (energy loss)
    const feedback = filtered * this.params.decay;

    // Write back to delay line (overwrite oldest sample)
    this.delayLine[this.pointer] = feedback;

    // Advance pointer
    this.pointer = (this.pointer + 1) % this.length;

    return currentSample;
  }
}

export class PhysicalModelEngine {
  private strings: PluckedString[] = [];
  private sampleRate: number;

  constructor(polyphony: number = 6, sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    for (let i = 0; i < polyphony; i++) {
      this.strings.push(new PluckedString(sampleRate));
    }
  }

  public pluck(noteIndex: number, frequency: number, velocity: number): void {
    // Modulo to cycle through strings if index > polyphony?
    // Or just clamp.
    const idx = noteIndex % this.strings.length;
    const string = this.strings[idx];
    
    // Update params
    string.setParams({ frequency });
    
    // Pluck
    string.pluck(velocity);
  }

  public getSample(): number {
    let mix = 0;
    for (const string of this.strings) {
      mix += string.getSample();
    }
    return mix; // Summing can clip, but that's expected in raw engine
  }
}
