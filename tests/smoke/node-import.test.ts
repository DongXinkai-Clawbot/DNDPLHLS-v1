describe('node import smoke', () => {
  it('imports core modules without throwing', () => {
    expect(() => require('../../store/storeImpl')).not.toThrow();
    expect(() => require('../../engine/audio/context')).not.toThrow();
    expect(() => require('../../native/bridge')).not.toThrow();
  });
});
