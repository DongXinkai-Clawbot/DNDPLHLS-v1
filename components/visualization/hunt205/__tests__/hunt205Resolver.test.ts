import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveToneBindings, type NormalizedNoteEvent } from '../Hunt205ToneResolver';
import { DEFAULT_HUNT205_RING_CONFIG, computeToneStates } from '../Hunt205RingRenderer';

const loadLayout = () => {
  const filePath = path.resolve(__dirname, '../../../../assets/hunt205_ring_layout.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

const buildEvent = (id: string, pitch: NormalizedNoteEvent['pitch_representation']) => ({
  event_id: id,
  start_time_ms: 0,
  end_time_ms: 100,
  pitch_representation: pitch,
  velocity: 0.8
});

describe('Hunt205 tone resolver', () => {
  it('prefers label matches when provided', () => {
    const layout = loadLayout();
    const event = buildEvent('e1', { type: 'label', label: 'T1-L0' });
    const [binding] = resolveToneBindings([event], layout);
    expect(binding.match_method).toBe('label');
    expect(binding.tone_id).toBe(1);
    expect(binding.label_id).toBeDefined();
  });

  it('falls back to cents when no label is available', () => {
    const layout = loadLayout();
    const target = layout.tones[2];
    const event = buildEvent('e2', { type: 'cents', cents: target.cent_value });
    const [binding] = resolveToneBindings([event], layout);
    expect(binding.match_method).toBe('cents');
    expect(binding.tone_id).toBe(target.tone_id);
  });

  it('resolves ratio to cents and maps to nearest tone', () => {
    const layout = loadLayout();
    const event = buildEvent('e3', { type: 'ratio', ratio_num: 2, ratio_den: 1 });
    const [binding] = resolveToneBindings([event], layout);
    expect(binding.match_method).toBe('ratio');
    expect(binding.tone_id).toBe(0);
  });

  it('resolves frequency via reference Hz', () => {
    const layout = loadLayout();
    const event = buildEvent('e4', { type: 'frequency', hz: 440 });
    const [binding] = resolveToneBindings([event], layout, { referenceHz: 440, referenceCents: 0 });
    expect(binding.match_method).toBe('frequency');
    expect(binding.tone_id).toBe(0);
  });

  it('marks approx when distance exceeds threshold', () => {
    const layout = loadLayout();
    const event = buildEvent('e5', { type: 'cents', cents: 13.5 });
    const [binding] = resolveToneBindings([event], layout, { centsThreshold: 0.1 });
    expect(binding.approx).toBe(true);
  });
});

describe('Hunt205 tone state aggregation', () => {
  it('keeps activeCount for overlapping events', () => {
    const bindings = [
      { tone_id: 0, start_time_ms: 0, end_time_ms: 100, velocity: 0.7 },
      { tone_id: 0, start_time_ms: 50, end_time_ms: 150, velocity: 0.9 }
    ];
    const states = computeToneStates(bindings, 75, DEFAULT_HUNT205_RING_CONFIG);
    const state = states.get(0);
    expect(state).toBeTruthy();
    if (!state) return;
    expect(state.activeCount).toBe(2);
    expect(state.activeVelocity).toBeCloseTo(0.9, 5);
  });

  it('applies release when notes end', () => {
    const bindings = [{ tone_id: 1, start_time_ms: 0, end_time_ms: 100, velocity: 0.5 }];
    const states = computeToneStates(bindings, 120, DEFAULT_HUNT205_RING_CONFIG);
    const state = states.get(1);
    expect(state).toBeTruthy();
    if (!state) return;
    expect(state.activeCount).toBe(0);
    expect(state.releaseProgress).toBeGreaterThanOrEqual(0);
  });
});