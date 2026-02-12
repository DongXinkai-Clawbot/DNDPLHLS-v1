import { getWavetableKey } from '../../timbreEngine/buffers';

describe('timbreEngine buffers', () => {
  test('getWavetableKey differs for different tables', () => {
    const keyA = getWavetableKey([0, 1, 0], [0, 0.5, 0]);
    const keyB = getWavetableKey([0, 1, 0.1], [0, 0.5, 0]);
    expect(keyA).not.toBe(keyB);
  });
});
