import { classifyDeviceCategory, estimateLowEnd } from '../../utils/capabilities';

describe('device classification', () => {
  it('classifies phones vs tablets vs desktops', () => {
    expect(classifyDeviceCategory({ width: 390, height: 844, pointer: 'coarse', isNativePlatform: true })).toBe('phone');
    expect(classifyDeviceCategory({ width: 1024, height: 768, pointer: 'coarse', isNativePlatform: false })).toBe('tablet');
    expect(classifyDeviceCategory({ width: 1440, height: 900, pointer: 'fine', isNativePlatform: false })).toBe('desktop');
  });
});

describe('low-end estimation', () => {
  it('flags constrained devices', () => {
    expect(estimateLowEnd({ deviceMemoryGb: 1, hardwareConcurrency: 8, category: 'phone', minDim: 360 })).toBe(true);
    expect(estimateLowEnd({ deviceMemoryGb: 4, hardwareConcurrency: 2, category: 'tablet', minDim: 768 })).toBe(true);
    expect(estimateLowEnd({ deviceMemoryGb: 4, hardwareConcurrency: 8, category: 'desktop', minDim: 900 })).toBe(false);
  });
});
