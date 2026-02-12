import { SimpleFFT } from '../math/fft';

export class SpectralGate {
  private fft: SimpleFFT;
  private size: number;
  private real: Float32Array;
  private imag: Float32Array;
  private threshold: number = 0.01;

  constructor(size: number = 2048) {
    this.size = size;
    this.fft = new SimpleFFT(size);
    this.real = new Float32Array(size);
    this.imag = new Float32Array(size);
  }

  public setThreshold(val: number): void {
    this.threshold = val;
  }

  public processBlock(input: Float32Array): Float32Array {
    if (input.length !== this.size) throw new Error(`Input size mismatch. Expected ${this.size}, got ${input.length}`);
    
    // Copy input to real, clear imag
    this.real.set(input);
    this.imag.fill(0);

    // FFT
    this.fft.process(this.real, this.imag, false);

    // Thresholding (Spectral Gating)
    const thresholdSq = this.threshold * this.threshold;
    // Iterate only up to Nyquist? No, full spectrum for complex FFT.
    // Real signal has symmetry, but we just process all bins.
    for (let i = 0; i < this.size; i++) {
      const magSq = this.real[i] * this.real[i] + this.imag[i] * this.imag[i];
      if (magSq < thresholdSq) {
        // Gate: Silence bin
        this.real[i] = 0;
        this.imag[i] = 0;
      }
    }

    // IFFT
    this.fft.process(this.real, this.imag, true);

    // Return real part (copy)
    return new Float32Array(this.real);
  }
}
