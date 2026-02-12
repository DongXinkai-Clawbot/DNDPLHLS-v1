import { WavetableOscillator, Wavetable } from './wavetable';

describe('WavetableOscillator', () => {
  let osc: WavetableOscillator;

  beforeEach(() => {
    osc = new WavetableOscillator(44100);
  });

  test('should initialize correctly', () => {
    expect(osc).toBeDefined();
  });

  test('should set wavetable', () => {
    const wave = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      wave[i] = Math.sin((i / 2048) * Math.PI * 2);
    }
    const wavetable: Wavetable = {
      id: 'test-wt',
      name: 'Sine Wave',
      waveforms: [wave],
      length: 2048,
      morphMode: 'linear',
    };
    osc.setWavetable(wavetable);
    // Should not throw
    expect(true).toBe(true);
  });

  test('should generate sine wave', () => {
    const wave = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) {
      wave[i] = Math.sin((i / 2048) * Math.PI * 2);
    }
    const wavetable: Wavetable = {
      id: 'sine-wt',
      name: 'Sine',
      waveforms: [wave],
      length: 2048,
      morphMode: 'linear',
    };
    osc.setWavetable(wavetable);
    osc.resetPhase();

    // Generate first sample (phase 0)
    // Actually, getSample increments phase *after* calculating phase increment?
    // Wait, getSample implementation:
    // const phaseInc = frequency / this.sampleRate;
    // this.phase += phaseInc;
    // ...
    // let currentPhase = this.phase + phaseMod;

    // So if phase starts at 0, first call increments it to phaseInc.
    // If frequency is 44100/2048 = 21.53Hz, phaseInc is 1/2048.
    // So first sample is at index 1.
    // Wait, usually oscillator starts at 0.
    // But `this.phase` is updated *before* used?
    // Let's check implementation.

    /*
    const phaseInc = frequency / this.sampleRate;
    this.phase += phaseInc;
    if (this.phase >= 1.0) this.phase -= 1.0;
    
    // Apply phase modulation
    let currentPhase = this.phase + phaseMod;
    */

    // Yes, it increments first. So first sample is at `phaseInc`.
    // If I want to verify 0, I should expect the value at `phaseInc`.
    
    const freq = 44100 / 2048; // One cycle per 2048 samples
    // phaseInc = 1/2048.
    // wave[1] is close to sin(1/2048 * 2PI).

    const sample = osc.getSample(freq, 0, 0);
    // Expected value: sin((1/2048) * 2PI)
    const expected = Math.sin((1 / 2048) * Math.PI * 2);
    
    expect(sample).toBeCloseTo(expected, 4);
  });

  test('should morph between waveforms', () => {
    const waveA = new Float32Array(2048).fill(0.0); // Silence
    const waveB = new Float32Array(2048).fill(1.0); // DC Offset 1.0
    
    const wavetable: Wavetable = {
      id: 'morph-wt',
      name: 'Morph',
      waveforms: [waveA, waveB],
      length: 2048,
      morphMode: 'linear',
    };
    osc.setWavetable(wavetable);
    osc.resetPhase();

    const freq = 440;

    // Position 0.0 -> Wave A -> 0.0
    expect(osc.getSample(freq, 0.0)).toBeCloseTo(0.0);

    // Position 1.0 -> Wave B -> 1.0
    expect(osc.getSample(freq, 1.0)).toBeCloseTo(1.0);

    // Position 0.5 -> 0.5
    expect(osc.getSample(freq, 0.5)).toBeCloseTo(0.5);
  });
});
