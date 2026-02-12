import fc from 'fast-check';

import {
  calculateCents,
  createFraction,
  adjustOctave,
  normalizeOctave,
  parseGeneralRatio,
  getPrimeVectorFromRatio,
  calculateOctaveCentsFromPrimeVector,
} from '../../musicLogic';
import {
  buildEqualTemperament,
  nearestStepForRatio,
  ratioToCents,
  wrapToCycle,
} from '../../utils/temperamentSolver';
import { ControlManager } from '../midi/controlManager';
import { CC_LOCAL_CONTROL, LOCAL_CONTROL_OFF, LOCAL_CONTROL_ON } from '../midi/deviceManager';
import { DEFAULT_TIMBRE_PATCHES, DEFAULT_TIMBRE_SETTINGS } from '../../timbrePresets';

describe('Music math invariants', () => {
  test('Invariant: cents<->ratio round-trip stays stable for 2^(c/1200)', () => {
    const seed = 424242;
    fc.assert(
      fc.property(
        fc.double({ min: -4800, max: 4800, noNaN: true }),
        (cents) => {
          const ratio = parseGeneralRatio(`2^(${cents}/1200)`);
          const back = calculateCents(ratio);
          expect(back).toBeCloseTo(cents, 3);
        }
      ),
      { seed, numRuns: 30 }
    );
  });

  test('Invariant: normalizeOctave keeps ratios within [1,2) and tracks octaves', () => {
    const quarter = createFraction(1n, 4n);
    const normQuarter = normalizeOctave(quarter);
    expect(normQuarter.ratio.n).toBe(4n);
    expect(normQuarter.ratio.d).toBe(4n);
    expect(normQuarter.octaves).toBe(-2);

    const nineFour = createFraction(9n, 4n);
    const normNineFour = normalizeOctave(nineFour);
    expect(normNineFour.ratio.n).toBe(9n);
    expect(normNineFour.ratio.d).toBe(8n);
    expect(normNineFour.octaves).toBe(1);

    const adjusted = adjustOctave(createFraction(3n, 2n), -1);
    expect(adjusted.n).toBe(3n);
    expect(adjusted.d).toBe(4n);
  });

  test('Invariant: calculateCents matches reference ratios', () => {
    expect(calculateCents(createFraction(1n, 1n))).toBeCloseTo(0, 6);
    expect(calculateCents(createFraction(2n, 1n))).toBeCloseTo(1200, 6);
    expect(calculateCents(createFraction(3n, 2n))).toBeCloseTo(701.955, 3);
  });

  test('Invariant: prime-vector octave cents stays aligned with 3/2', () => {
    const vec = getPrimeVectorFromRatio(3n, 2n);
    const cents = calculateOctaveCentsFromPrimeVector(vec);
    const target = calculateCents(createFraction(3n, 2n));
    expect(Math.abs(cents - target)).toBeLessThan(0.001);
  });
});

describe('Temperament mapping invariants', () => {
  test('Invariant: equal temperament steps are stable for 12-TET', () => {
    const steps = buildEqualTemperament(12, 1200);
    expect(steps).toHaveLength(12);
    expect(steps[0]).toBe(0);
    expect(steps[1]).toBeCloseTo(100, 6);
    expect(steps[11]).toBeCloseTo(1100, 6);
  });

  test('Invariant: nearest step mapping remains anchored for 3/2', () => {
    const cents = ratioToCents({ n: 3, d: 2 });
    const step = nearestStepForRatio(cents, 12, 1200);
    expect(step).toBe(7);
  });

  test('Invariant: wrapToCycle always returns values within [0, cycle)', () => {
    const seed = 424242;
    fc.assert(
      fc.property(
        fc.double({ min: -10000, max: 10000, noNaN: true }),
        fc.integer({ min: 1, max: 2400 }),
        (value, cycle) => {
          const wrapped = wrapToCycle(value, cycle);
          expect(wrapped).toBeGreaterThanOrEqual(0);
          expect(wrapped).toBeLessThanOrEqual(cycle);
          if (wrapped === cycle) {
            expect(Math.abs(value % cycle)).toBeLessThan(Number.EPSILON);
          }
        }
      ),
      { seed, numRuns: 50 }
    );
  });
});

describe('MIDI control invariants', () => {
  test('Invariant: local control CC message stays stable', async () => {
    const calls: Array<{ channel: number; cc: number; value: number }> = [];
    const queue = {
      enqueueCC: (channel: number, cc: number, value: number) => {
        calls.push({ channel, cc, value });
      },
    };
    const manager = new ControlManager(queue as any);

    await manager.sendLocalControl({ channel: 2, state: 'off' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ channel: 2, cc: CC_LOCAL_CONTROL, value: LOCAL_CONTROL_OFF });
  });

  test('Invariant: local control all-channels mapping remains 1..16', async () => {
    const calls: Array<{ channel: number; cc: number; value: number }> = [];
    const queue = {
      enqueueCC: (channel: number, cc: number, value: number) => {
        calls.push({ channel, cc, value });
      },
    };
    const manager = new ControlManager(queue as any);

    await manager.sendLocalControl({ channel: 0, state: 'on' });
    expect(calls).toHaveLength(16);
    const channels = calls.map((c) => c.channel);
    expect(channels).toEqual([...Array(16)].map((_, i) => i + 1));
    calls.forEach((call) => {
      expect(call.cc).toBe(CC_LOCAL_CONTROL);
      expect(call.value).toBe(LOCAL_CONTROL_ON);
    });
  });
});

describe('Timbre preset invariants', () => {
  test('Invariant: default timbre patch order and context map stay stable', () => {
    expect(DEFAULT_TIMBRE_PATCHES.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_TIMBRE_PATCHES[0].id).toBe('timbre-pure-sine');

    const [clickPatch, keyboardPatch, sequencePatch] = DEFAULT_TIMBRE_PATCHES;
    expect(DEFAULT_TIMBRE_SETTINGS.activePatchId).toBe(clickPatch.id);
    expect(DEFAULT_TIMBRE_SETTINGS.mapping.contextMap.click).toBe(clickPatch.id);
    expect(DEFAULT_TIMBRE_SETTINGS.mapping.contextMap.keyboard).toBe(keyboardPatch.id);
    expect(DEFAULT_TIMBRE_SETTINGS.mapping.contextMap.sequence).toBe(sequencePatch.id);
  });

  test('Invariant: each default patch preserves macro defaults', () => {
    DEFAULT_TIMBRE_PATCHES.forEach((patch) => {
      expect(patch.macros).toHaveLength(2);
      expect(patch.macros[0].id).toBe('macro1');
      expect(patch.macros[1].id).toBe('macro2');
    });
  });
});
