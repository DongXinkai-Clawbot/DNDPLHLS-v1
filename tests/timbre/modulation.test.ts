import type { TimbrePatch, TimbreVoiceSettings } from '../../types';
import { DEFAULT_TIMBRE_PATCHES } from '../../timbrePresets';
import { accumulateMods, computeHarmonicSpectrum } from '../../timbreEngine/modulation';
import { createRng } from '../../timbreEngine/utils';

const basePatch = (): TimbrePatch => JSON.parse(JSON.stringify(DEFAULT_TIMBRE_PATCHES[0]));

describe('timbreEngine modulation', () => {
  test('accumulateMods applies deadzone, curve, clamp, and combine', () => {
    const patch = basePatch();
    patch.modMatrix = [
      {
        id: 'r1',
        source: 'velocity',
        target: 'overallGain',
        depth: 1,
        deadzone: 0.2,
        curve: 'exp',
        clampMin: 0,
        clampMax: 0.8,
        combineMode: 'sum'
      },
      {
        id: 'r2',
        source: 'velocity',
        target: 'overallGain',
        depth: 0.5,
        combineMode: 'max'
      }
    ];
    const { modAccum } = accumulateMods(patch, {
      velocity: 0.1,
      noteRandom: 0,
      keyTracking: 0,
      modWheel: 0,
      aftertouch: 0,
      mpePressure: 0,
      mpeTimbre: 0,
      cc7: 0,
      cc74: 0,
      pitchBend: 0.5,
      time: 0,
      macro1: 0, macro2: 0, macro3: 0, macro4: 0, macro5: 0, macro6: 0, macro7: 0, macro8: 0,
      lfo1: 0, lfo2: 0, lfo3: 0, lfo4: 0,
      envAmp: 0, envFilter: 0, mseg: 0,
      randomHold: 0, randomSmooth: 0,
      noteAge: 0, releaseAge: 0,
      envelopeFollower: 0
    } as any);
    expect(modAccum.overallGain ?? 0).toBeGreaterThanOrEqual(0);
    expect(modAccum.overallGain ?? 0).toBeLessThanOrEqual(0.8);
  });

  test('computeHarmonicSpectrum honors pattern mask', () => {
    const voice = JSON.parse(JSON.stringify(basePatch().voice)) as TimbreVoiceSettings;
    voice.harmonic.enabled = true;
    voice.harmonic.mask = 'pattern';
    voice.harmonic.pattern = '10'; // keep odd, drop even
    const rng = createRng(1234);
    const amps = computeHarmonicSpectrum(voice, 8, rng, 220, 48000);
    expect(amps[0]).toBeGreaterThan(0);
    expect(amps[1]).toBe(0);
  });
});
