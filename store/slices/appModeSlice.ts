import type { AppState } from '../../types';

export const createAppModeSlice = (set: any, initialAppMode: AppState['appMode']) => ({
  appMode: initialAppMode,
  setAppMode: (mode: AppState['appMode']) => set({ appMode: mode })
});
