import { SpectralGate } from './spectral_gate';

describe('SpectralGate', () => {
  let gate: SpectralGate;

  beforeEach(() => {
    gate = new SpectralGate(32); // Small FFT for speed
  });

  test('should silence low amplitude signal', () => {
    gate.setThreshold(0.1);
    const input = new Float32Array(32).fill(0.01); // 0.01 < 0.1
    // DC component of 0.01 in 32 bins -> Bin 0 mag is 32 * 0.01 = 0.32 ?
    // Wait. DFT definition.
    // X[0] = sum(x[n]).
    // sum(0.01 * 32) = 0.32.
    // If threshold is 0.1, 0.32 > 0.1.
    // So it will PASS.
    
    // I need to set threshold higher than spectral magnitude.
    // Magnitude of DC is sum of samples.
    gate.setThreshold(0.5); 
    
    const output = gate.processBlock(input);
    
    // Check energy
    let energy = 0;
    for (let i = 0; i < 32; i++) energy += Math.abs(output[i]);
    
    expect(energy).toBeCloseTo(0, 5);
  });

  test('should pass high amplitude signal', () => {
    gate.setThreshold(0.1);
    const input = new Float32Array(32).fill(0.5); 
    // Mag = 0.5 * 32 = 16. > 0.1.
    
    const output = gate.processBlock(input);
    
    expect(output[0]).toBeCloseTo(0.5, 3);
  });
});
