export enum FilterType {
  LowPass,
  HighPass,
  BandPass,
  Notch,
  Peaking,
  LowShelf,
  HighShelf,
  AllPass,
}

export class BiquadFilter {
  private type: FilterType;
  private frequency: number;
  private Q: number;
  private gain: number;
  private sampleRate: number;

  private x1: number = 0;
  private x2: number = 0;
  private y1: number = 0;
  private y2: number = 0;

  private b0: number = 1;
  private b1: number = 0;
  private b2: number = 0;
  private a1: number = 0;
  private a2: number = 0;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.type = FilterType.LowPass;
    this.frequency = 1000;
    this.Q = 0.707;
    this.gain = 0;
    this.calcCoefficients();
  }

  public configure(type: FilterType, frequency: number, Q: number = 0.707, gain: number = 0): void {
    this.type = type;
    this.frequency = frequency;
    this.Q = Q;
    this.gain = gain;
    this.calcCoefficients();
  }

  public process(input: number): number {
    const output = this.b0 * input + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = input;
    this.y2 = this.y1;
    this.y1 = output;
    return output;
  }

  private calcCoefficients(): void {
    const w0 = 2 * Math.PI * this.frequency / this.sampleRate;
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * this.Q);
    const A = Math.pow(10, this.gain / 40); // For shelving/peaking

    let a0 = 1;

    switch (this.type) {
      case FilterType.LowPass:
        this.b0 = (1 - cosw0) / 2;
        this.b1 = 1 - cosw0;
        this.b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
        break;
      case FilterType.HighPass:
        this.b0 = (1 + cosw0) / 2;
        this.b1 = -(1 + cosw0);
        this.b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        this.a1 = -2 * cosw0;
        this.a2 = 1 - alpha;
        break;
        
      // Implement others if needed (Peaking, Shelving)
      // For Crossover (Linkwitz-Riley), we just need LowPass and HighPass
      
      default:
        this.b0 = 1; this.b1 = 0; this.b2 = 0; a0 = 1; this.a1 = 0; this.a2 = 0;
    }

    // Normalize
    this.b0 /= a0;
    this.b1 /= a0;
    this.b2 /= a0;
    this.a1 /= a0;
    this.a2 /= a0;
  }
}
