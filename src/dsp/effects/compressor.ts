export class Compressor {
  public threshold: number = -20; // dB
  public ratio: number = 4;
  public attack: number = 0.01; // seconds
  public release: number = 0.1; // seconds
  public knee: number = 0; // dB
  public makeUpGain: number = 0; // dB

  private envelope: number = 0;
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
  }

  public process(input: number): number {
    const absInput = Math.abs(input);
    const inputdB = 20 * Math.log10(Math.max(1e-6, absInput)); // Clamp to -120dB

    // Envelope Follower
    // If input > envelope, Attack phase. Else Release phase.
    const attCoeff = Math.exp(-1 / (this.attack * this.sampleRate));
    const relCoeff = Math.exp(-1 / (this.release * this.sampleRate));

    let coeff = relCoeff;
    if (absInput > this.envelope) {
      coeff = attCoeff;
    }
    
    // Simple one-pole filter for envelope
    this.envelope = coeff * this.envelope + (1 - coeff) * absInput;

    // Gain Calculation (based on envelope)
    const envdB = 20 * Math.log10(Math.max(1e-6, this.envelope));
    
    let gainReductiondB = 0;
    
    // Hard Knee
    if (envdB > this.threshold) {
      const overshoot = envdB - this.threshold;
      gainReductiondB = overshoot * (1 - 1 / this.ratio);
    }

    // Apply Makeup Gain
    const totalGaindB = this.makeUpGain - gainReductiondB;
    const totalGain = Math.pow(10, totalGaindB / 20);

    return input * totalGain;
  }
}
