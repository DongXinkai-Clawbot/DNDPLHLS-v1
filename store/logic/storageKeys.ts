export const STORAGE_KEYS = {
  settings: 'ql_settings_v2',
  settingsUi: 'ql_settings_ui_v1',
  settingsLegacy: 'ql_settings_v1',
  flags: 'ql_session_flags',
  panels: 'ql_panels_v1',
  earTraining: 'earTrainingPersisted_v1',
  earTrainingLegacy: 'EarTrainingPersistedV1',
  earTrainingLegacyAlt: 'earTrainingPersisted_v1',
  devDiagnostics: 'ql_dev_diag',
  simpleSkip: 'ql_simple_skip',
  mathWarningDismissed: 'ql_math_warning_dismissed_v2',
  mathLabBackup: 'ql_mathlab_backup',
  auth: 'ql_auth_v1',
  workspacePresets: 'ql_workspace_presets_v1',
  scalaArchivePrefs: 'scalaArchivePrefs_v1',
  simpleTutorialSeen: 'mm_simple_tutorial_seen',
  museumOnboardingSeen: 'mm_museum_onboarding_seen_v1',
  museumTourHistory: 'mm_museum_progress_v2',
  midiDeviceConfig: 'midi-device-manager-config',
  commaJndProfiles: 'CommaJNDToolProfilesV1',
  commaJndActiveProfile: 'CommaJNDToolActiveProfileV1',
  jndUploadLastAtMs: 'jndUploadLastAtMs',
  anonUserId: 'anonUserId',
  retunerGroupSyncMessage: 'dndplhls-retuner-group-sync-msg-v1',
  retunerGroupSyncChannel: 'dndplhls-retuner-group-sync-v1'
};

export const RESET_STRATEGY_VERSION = 1;

export const RESET_WHITELIST_BY_VERSION: Record<number, string[]> = {
  1: [STORAGE_KEYS.devDiagnostics, STORAGE_KEYS.anonUserId, STORAGE_KEYS.jndUploadLastAtMs],
};

export const migrateLegacyStorage = () => {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.settings) && localStorage.getItem(STORAGE_KEYS.settingsLegacy)) {
      const legacy = localStorage.getItem(STORAGE_KEYS.settingsLegacy);
      if (legacy) {
        localStorage.setItem(STORAGE_KEYS.settings, legacy);
      }
      localStorage.removeItem(STORAGE_KEYS.settingsLegacy);
    }

    if (!localStorage.getItem(STORAGE_KEYS.earTraining)) {
      const legacyEar = localStorage.getItem(STORAGE_KEYS.earTrainingLegacy) || localStorage.getItem(STORAGE_KEYS.earTrainingLegacyAlt);
      if (legacyEar) {
        localStorage.setItem(STORAGE_KEYS.earTraining, legacyEar);
      }
      if (localStorage.getItem(STORAGE_KEYS.earTrainingLegacy)) {
        localStorage.removeItem(STORAGE_KEYS.earTrainingLegacy);
      }
      if (localStorage.getItem(STORAGE_KEYS.earTrainingLegacyAlt)) {
        localStorage.removeItem(STORAGE_KEYS.earTrainingLegacyAlt);
      }
    }
  } catch {
    // ignore storage access issues
  }
};

export const resetPersistedState = (opts?: { version?: number; keep?: string[] }) => {
  const version = opts?.version ?? RESET_STRATEGY_VERSION;
  const keepList = opts?.keep ?? RESET_WHITELIST_BY_VERSION[version] ?? [];
  const snapshot: Record<string, string> = {};
  try {
    keepList.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
    });
    localStorage.clear();
    Object.entries(snapshot).forEach(([key, value]) => localStorage.setItem(key, value));
  } catch {
    // ignore storage access issues
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore storage access issues
  }
};
