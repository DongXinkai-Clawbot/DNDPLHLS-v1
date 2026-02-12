export class SimpleFFT {
  private size: number;
  private reverseTable: Uint32Array;
  private sinTable: Float32Array;
  private cosTable: Float32Array;

  constructor(size: number) {
    if ((size & (size - 1)) !== 0) throw new Error("FFT size must be power of 2");
    this.size = size;
    
    // Bit reversal table
    this.reverseTable = new Uint32Array(size);
    let limit = 1;
    let bit = size >> 1;
    while (limit < size) {
      for (let i = 0; i < limit; i++) {
        this.reverseTable[i + limit] = this.reverseTable[i] + bit;
      }
      limit <<= 1;
      bit >>= 1;
    }

    // Trig tables
    this.sinTable = new Float32Array(size / 2);
    this.cosTable = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cosTable[i] = Math.cos(-2 * Math.PI * i / size);
      this.sinTable[i] = Math.sin(-2 * Math.PI * i / size);
    }
  }

  public process(real: Float32Array, imag: Float32Array, inverse: boolean = false): void {
    const size = this.size;
    const rev = this.reverseTable;
    
    // Bit-reverse copy
    // Note: This modifies input arrays in-place
    // If we want non-destructive, we should copy first.
    // But usually buffers are provided for processing.
    // However, the swap logic assumes we work on same array.
    for (let i = 0; i < size; i++) {
      const j = rev[i];
      if (j > i) {
        const tr = real[j];
        const ti = imag[j];
        real[j] = real[i];
        imag[j] = imag[i];
        real[i] = tr;
        imag[i] = ti;
      }
    }

    // FFT
    let halfSize = 1;
    while (halfSize < size) {
      const step = size / (halfSize * 2);
      
      for (let i = 0; i < size; i += halfSize * 2) {
        for (let j = 0; j < halfSize; j++) {
            const tableIdx = j * step;
            const cos = this.cosTable[tableIdx];
            // Inverse FFT uses conjugate W -> exp(j...) -> sin is positive
            // Since my table stores sin(-x), for inverse we negate sin.
            const sin = inverse ? -this.sinTable[tableIdx] : this.sinTable[tableIdx];
            
            const k = i + j;
            const m = k + halfSize;
            
            const tr = cos * real[m] - sin * imag[m];
            const ti = cos * imag[m] + sin * real[m];
            
            real[m] = real[k] - tr;
            imag[m] = imag[k] - ti;
            real[k] = real[k] + tr;
            imag[k] = imag[k] + ti;
        }
      }
      halfSize <<= 1;
    }

    // Scaling for Inverse
    if (inverse) {
      const scale = 1.0 / size;
      for (let i = 0; i < size; i++) {
        real[i] *= scale;
        imag[i] *= scale;
      }
    }
  }
}
