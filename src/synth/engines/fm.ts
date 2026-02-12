export interface FMOperatorParams {
  ratio: number; // Frequency ratio relative to fundamental
  detune: number; // Detune in Hz
  fixed: boolean; // If true, ratio is treated as fixed frequency in Hz
  startPhase: number; // 0.0 to 1.0
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  outputLevel: number; // Modulation index or carrier amplitude (0.0 to 1.0)
}

/**
 * A single FM operator with envelope.
 */
export class FMOperator {
  public params: FMOperatorParams;
  private phase: number = 0;
  private sampleRate: number;
  public lastOutput: number = 0;

  // Envelope internal state
  private envState: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
  private envValue: number = 0;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.params = {
      ratio: 1.0,
      detune: 0,
      fixed: false,
      startPhase: 0,
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.5 },
      outputLevel: 1.0,
    };
  }

  /**
   * Triggers the operator envelope (Note On).
   */
  public trigger(): void {
    this.envState = 'attack';
    this.phase = this.params.startPhase;
  }

  /**
   * Releases the operator envelope (Note Off).
   */
  public release(): void {
    if (this.envState !== 'idle') {
      this.envState = 'release';
    }
  }

  /**
   * Generates a sample for the operator.
   * @param frequency Fundamental frequency in Hz.
   * @param modPhase Phase modulation input (radians / 2PI or normalized 0-1).
   */
  public getSample(frequency: number, modPhase: number): number {
    // 1. Calculate frequency
    let freq = this.params.fixed ? this.params.ratio : frequency * this.params.ratio;
    freq += this.params.detune;

    // 2. Increment Phase
    const phaseInc = freq / this.sampleRate;
    this.phase += phaseInc;
    if (this.phase >= 1.0) this.phase -= 1.0;

    // 3. Process Envelope
    this.processEnvelope();

    // 4. Calculate Output (Sine)
    // PM: sin(2PI * (phase + modPhase))
    // modPhase is assumed to be normalized (0-1 represents 0-2PI)
    // If modPhase is large (FM index), it wraps naturally in sin function.
    const output = Math.sin((this.phase + modPhase) * Math.PI * 2);
    
    // 5. Apply Amplitude (Envelope * Output Level)
    const finalOutput = output * this.envValue * this.params.outputLevel;
    
    this.lastOutput = finalOutput;
    return finalOutput;
  }

  private processEnvelope(): void {
    // Simple linear ADSR approximation per sample
    const dt = 1.0 / this.sampleRate;
    
    switch (this.envState) {
      case 'idle':
        this.envValue = 0;
        break;
      case 'attack':
        const attackRate = 1.0 / Math.max(0.001, this.params.envelope.attack);
        this.envValue += dt * attackRate;
        if (this.envValue >= 1.0) {
          this.envValue = 1.0;
          this.envState = 'decay';
        }
        break;
      case 'decay':
        const decayRate = (1.0 - this.params.envelope.sustain) / Math.max(0.001, this.params.envelope.decay);
        this.envValue -= dt * decayRate;
        if (this.envValue <= this.params.envelope.sustain) {
          this.envValue = this.params.envelope.sustain;
          this.envState = 'sustain';
        }
        break;
      case 'sustain':
        this.envValue = this.params.envelope.sustain;
        break;
      case 'release':
        const releaseRate = this.params.envelope.sustain / Math.max(0.001, this.params.envelope.release);
        this.envValue -= dt * releaseRate;
        if (this.envValue <= 0) {
          this.envValue = 0;
          this.envState = 'idle';
        }
        break;
    }
  }

  public getEnvValue(): number {
    return this.envValue;
  }
}

/**
 * An 8-operator FM synthesis engine with a modulation matrix.
 */
export class FMEngine {
  private operators: FMOperator[] = [];
  private matrix: Float32Array; // 8x8 = 64. Row = Source, Col = Dest.
  private carrierLevels: Float32Array; // 8 values. 0.0 to 1.0
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.matrix = new Float32Array(64).fill(0);
    this.carrierLevels = new Float32Array(8).fill(0);
    // Default: Operator 7 (last one) is the only carrier
    this.carrierLevels[7] = 1.0;

    for (let i = 0; i < 8; i++) {
      this.operators.push(new FMOperator(sampleRate));
    }
  }

  /**
   * Sets the modulation amount from source operator to destination operator.
   * @param src Source operator index (0-7).
   * @param dest Destination operator index (0-7).
   * @param amount Modulation amount.
   */
  public setModulation(src: number, dest: number, amount: number): void {
    if (src >= 0 && src < 8 && dest >= 0 && dest < 8) {
      this.matrix[src * 8 + dest] = amount;
    }
  }

  /**
   * Sets the carrier output level for an operator.
   * @param opIndex Operator index (0-7).
   * @param level Output level (0.0 to 1.0).
   */
  public setCarrierLevel(opIndex: number, level: number): void {
    if (opIndex >= 0 && opIndex < 8) {
      this.carrierLevels[opIndex] = level;
    }
  }

  public getOperator(index: number): FMOperator | undefined {
    return this.operators[index];
  }

  public trigger(): void {
    this.operators.forEach(op => op.trigger());
  }

  public release(): void {
    this.operators.forEach(op => op.release());
  }

  /**
   * Generates the next sample.
   * @param frequency Fundamental frequency.
   */
  public getSample(frequency: number): number {
    // Process operators
    // Since we support arbitrary feedback loops, we use the `lastOutput` from the previous sample frame
    // for all modulations to ensure stability and avoid dependency resolution complexity.
    // However, for feed-forward paths (e.g. 0 -> 1), using current output of 0 for 1 is better (no delay).
    // But sticking to strict 1-sample delay for ALL modulations is simpler and standard in some DSP matrices.
    // Let's stick to using `lastOutput` for modulation inputs.

    // Store current frame outputs to update `lastOutput` after calculation?
    // No, `FMOperator.getSample` updates `lastOutput`.
    // So if we iterate 0..7, Op 1 sees Op 0's *new* output if Op 0 is processed first.
    // Op 0 sees Op 1's *old* output.
    // This implicit ordering creates a specific topology behavior.
    // To allow true matrix behavior where order doesn't matter (always 1 sample delay), we should capture *previous* outputs first.
    
    const prevOutputs = this.operators.map(op => op.lastOutput);
    
    let finalMix = 0;

    for (let i = 0; i < 8; i++) {
      // Calculate modulation input for Operator i
      let modInput = 0;
      for (let source = 0; source < 8; source++) {
        const amount = this.matrix[source * 8 + i];
        if (amount !== 0) {
          modInput += prevOutputs[source] * amount;
        }
      }

      // Generate sample for Operator i
      // Mod input is added to phase.
      // FMOperator expects normalized phase offset (0-1 or radians/2PI).
      // Usually modulation index is in radians.
      // If `amount` is modulation index, then `modInput` is in radians?
      // `FMOperator` implementation: `Math.sin((this.phase + modPhase) * Math.PI * 2)`
      // So `modPhase` 1.0 = 2PI phase shift.
      // Standard PM: output = sin(phase + index * modulator).
      // So `modInput` should be normalized.
      // If modulator output is +/- 1.0, and amount is 1.0, shift is +/- 2PI.
      // This is quite strong FM. Reasonable.

      const output = this.operators[i].getSample(frequency, modInput);

      // Add to final mix if carrier
      const carrierLevel = this.carrierLevels[i];
      if (carrierLevel > 0) {
        finalMix += output * carrierLevel;
      }
    }

    return finalMix;
  }
}
