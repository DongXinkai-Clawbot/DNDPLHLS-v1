import { applyCurve, clamp } from '../../timbreEngine/utils';

describe('timbreEngine utils', () => {
  test('applyCurve invert-log is monotonic and inverted', () => {
    const a = applyCurve(0, 'invert-log');
    const b = applyCurve(0.5, 'invert-log');
    const c = applyCurve(1, 'invert-log');
    expect(a).toBeCloseTo(0);
    expect(c).toBeCloseTo(1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  test('clamp confines values', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});
