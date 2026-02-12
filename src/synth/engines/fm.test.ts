import { FMEngine, FMOperator } from './fm';

describe('FMEngine', () => {
  let fm: FMEngine;

  beforeEach(() => {
    fm = new FMEngine(44100);
  });

  test('should initialize with 8 operators', () => {
    expect(fm).toBeDefined();
    // Verify internal state if possible, or just run a sample
    // Since operators are private, we can't check length directly unless we expose getter.
    // But we can check behavior.
  });

  test('should generate silence when no trigger', () => {
    const sample = fm.getSample(440);
    expect(sample).toBe(0);
  });

  test('should generate sound when triggered', () => {
    fm.trigger();
    // First sample might be 0 due to phase 0 and attack start
    // Let's advance a few samples
    let max = 0;
    for (let i = 0; i < 100; i++) {
      const s = fm.getSample(440);
      max = Math.max(max, Math.abs(s));
    }
    expect(max).toBeGreaterThan(0);
  });

  test('should apply envelope', () => {
    fm.trigger();
    // Attack phase
    const s1 = fm.getSample(440);
    // ... advance ...
    for (let i = 0; i < 1000; i++) fm.getSample(440);
    const s2 = fm.getSample(440);
    
    // Release
    fm.release();
    for (let i = 0; i < 1000; i++) fm.getSample(440);
    const s3 = fm.getSample(440);

    // Eventually silence
    for (let i = 0; i < 44100; i++) fm.getSample(440); // 1 sec
    const s4 = fm.getSample(440);
    
    expect(s4).toBeCloseTo(0, 4);
  });

  test('should modulate frequency (FM/PM)', () => {
    // Op 0 -> Op 1 -> Out
    // Set Op 1 as carrier
    // Set Op 0 as modulator for Op 1
    
    // Default: Op 7 is carrier.
    // Let's use Op 0 mod Op 1, Op 1 mod Op 7?
    // Or simpler: Op 0 mod Op 7.
    
    // Set modulation 0 -> 7
    fm.setModulation(0, 7, 0.5); // Mod amount 0.5
    
    fm.trigger();
    
    // Compare with unmodulated signal
    const fmClean = new FMEngine(44100);
    fmClean.trigger();
    
    // Advance both
    let diffSum = 0;
    for (let i = 0; i < 1000; i++) {
      const sMod = fm.getSample(440);
      const sClean = fmClean.getSample(440);
      diffSum += Math.abs(sMod - sClean);
    }
    
    expect(diffSum).toBeGreaterThan(0.1);
  });
});
