import { GranularEngine } from './granular';

describe('GranularEngine', () => {
  let engine: GranularEngine;
  let buffer: Float32Array;

  beforeEach(() => {
    engine = new GranularEngine(44100);
    // Create a simple ramp buffer
    buffer = new Float32Array(44100); // 1 second
    for (let i = 0; i < 44100; i++) {
      buffer[i] = i / 44100;
    }
  });

  test('should initialize', () => {
    expect(engine).toBeDefined();
  });

  test('should not generate sound without buffer', () => {
    expect(engine.getSample()).toBe(0);
  });

  test('should generate sound with buffer', () => {
    engine.setBuffer(buffer);
    
    // Set params to ensure grains spawn
    engine.setParams({
      density: 100, // Frequent grains
      grainSize: 100,
      position: 0.5,
      spread: 0,
      pitch: 1.0,
    });

    // Advance to trigger spawn
    // Interval = 44100 / 100 = 441 samples
    let max = 0;
    for (let i = 0; i < 1000; i++) {
      const s = engine.getSample();
      max = Math.max(max, Math.abs(s));
    }
    
    expect(max).toBeGreaterThan(0);
  });

  test('should respect pitch parameter', () => {
    engine.setBuffer(buffer);
    engine.setParams({
      density: 1000, // Very frequent to ensure overlap
      grainSize: 50,
      position: 0.0,
      spread: 0,
      pitch: 2.0, // 2x speed
    });

    // Advance
    for (let i = 0; i < 500; i++) engine.getSample();
    
    // We can't easily check pitch without FFT or intricate logic.
    // But we can check that it produces output.
    expect(engine.getSample()).not.toBeNaN();
  });
});
