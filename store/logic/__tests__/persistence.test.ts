import { DEFAULT_SETTINGS } from '../../../constants';
import { loadMainState, saveMainState } from '../persistence';

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

describe('persistence', () => {
  beforeEach(() => {
    (globalThis as any).localStorage = createLocalStorageMock();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    delete (globalThis as any).localStorage;
  });

  it('round-trips settings and flags', () => {
    const baseSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const settings = {
      ...baseSettings,
      baseFrequency: 432,
      visuals: {
        ...baseSettings.visuals,
        globalScale: 1.25
      }
    };

    saveMainState(settings, { landingMode: 'advanced', isSetupComplete: true }, { immediate: true });
    jest.runOnlyPendingTimers();

    const loaded = loadMainState();

    expect(loaded.flags).toEqual({ landingMode: 'advanced', isSetupComplete: true });
    expect(loaded.settings).toEqual(settings);
  });
});
