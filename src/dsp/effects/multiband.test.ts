import { MultiBandCompressor } from './multiband';

describe('MultiBandCompressor', () => {
  let mbc: MultiBandCompressor;

  beforeEach(() => {
    mbc = new MultiBandCompressor(44100);
  });

  test('should initialize', () => {
    expect(mbc).toBeDefined();
    expect(mbc.lowComp).toBeDefined();
    expect(mbc.midComp).toBeDefined();
    expect(mbc.highComp).toBeDefined();
  });

  test('should pass signal when threshold is high (no compression)', () => {
    // Set threshold high
    mbc.lowComp.threshold = 0; // 0dB (FS)
    mbc.midComp.threshold = 0;
    mbc.highComp.threshold = 0;
    
    // Process sine wave (low frequency 100Hz)
    // Low band should pass it. Mid/High should reject it (attenuate).
    // Sum should be unity (magnitude).
    // But since filters have phase shift, simple check is amplitude.
    
    // Check output amplitude matches input for low amplitude signal
    // Input 0.1 (-20dB)
    const input = 0.1;
    let maxOut = 0;
    
    // Need to run multiple samples to settle filter state?
    // Biquads have delay.
    // Also, crossover sum is unity magnitude in steady state.
    
    // Run for a few samples
    for (let i = 0; i < 1000; i++) {
        // Sine wave 100Hz
        const s = Math.sin(i * 2 * Math.PI * 100 / 44100) * 0.1;
        const out = mbc.process(s);
        if (i > 500) { // Check after settling
            maxOut = Math.max(maxOut, Math.abs(out));
        }
    }
    
    // Expected max output ~ 0.1
    expect(maxOut).toBeCloseTo(0.1, 2);
  });

  test('should compress high amplitude signal in low band', () => {
    // Set Low Comp threshold low (-20dB = 0.1)
    mbc.lowComp.threshold = -20;
    mbc.lowComp.ratio = 10; // Strong compression
    
    // Input loud 100Hz sine (0.5 amplitude -> -6dB)
    // Should be compressed.
    // Overshoot: -6 - (-20) = 14dB.
    // Reduction: 14 * (1 - 1/10) = 12.6dB.
    // Output: -6 - 12.6 = -18.6dB.
    // Linear: 10^(-18.6/20) ~ 0.117.
    
    let maxOut = 0;
    for (let i = 0; i < 2000; i++) {
        const s = Math.sin(i * 2 * Math.PI * 100 / 44100) * 0.5;
        const out = mbc.process(s);
        if (i > 1000) {
            maxOut = Math.max(maxOut, Math.abs(out));
        }
    }
    
    // Expect output < 0.2 (significantly compressed from 0.5)
    expect(maxOut).toBeLessThan(0.25);
    // And > 0.1 (threshold)
    expect(maxOut).toBeGreaterThan(0.1);
  });
});
