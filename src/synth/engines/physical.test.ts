import { PhysicalModelEngine } from './physical';

describe('PhysicalModelEngine', () => {
  let pm: PhysicalModelEngine;

  beforeEach(() => {
    pm = new PhysicalModelEngine(1, 44100);
  });

  test('should initialize', () => {
    expect(pm).toBeDefined();
  });

  test('should generate silence initially', () => {
    expect(pm.getSample()).toBe(0);
  });

  test('should generate sound when plucked', () => {
    pm.pluck(0, 440, 1.0);
    // Plucking fills the buffer with noise
    // First sample is random, non-zero likely
    // Unless we get extremely unlucky and random() yields exactly 0.5 (mapped to 0)
    
    // Check multiple samples
    let max = 0;
    for (let i = 0; i < 100; i++) {
      max = Math.max(max, Math.abs(pm.getSample()));
    }
    expect(max).toBeGreaterThan(0);
  });

  test('should decay over time', () => {
    pm.pluck(0, 440, 1.0);
    
    // Measure energy at start
    let energyStart = 0;
    for (let i = 0; i < 100; i++) energyStart += Math.abs(pm.getSample());
    
    // Advance time (simulate 1 second)
    for (let i = 0; i < 44100; i++) pm.getSample();
    
    // Measure energy at end
    let energyEnd = 0;
    for (let i = 0; i < 100; i++) energyEnd += Math.abs(pm.getSample());
    
    expect(energyEnd).toBeLessThan(energyStart);
  });
});
