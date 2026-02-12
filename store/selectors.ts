import type { AppState } from '../types';

export const selectAppFlags = (state: AppState) => ({
  appMode: state.appMode,
  landingMode: state.landingMode,
  isSetupComplete: state.isSetupComplete
});

export const selectAppVisuals = (state: AppState) => ({
  isArActive: state.settings.isArActive,
  backgroundImageUrl: state.settings.visuals.backgroundImageUrl,
  backgroundColor: state.settings.visuals.backgroundColor,
  namingSetupCompleted: state.settings.namingSetupCompleted
});

export const selectNamingSetupOpen = (state: AppState) => state.namingSetupOpen;

export const selectAppActions = (state: AppState) => ({
  setAppMode: state.setAppMode,
  updateSettings: state.updateSettings,
  setNamingSetupOpen: state.setNamingSetupOpen
});
