import type { AppState, AppSettings } from '../types';
import { getDeviceCapabilities } from './capabilities';
import { getLogBuffer } from './logger';
import { STORAGE_KEYS } from '../store/logic/storageKeys';
import { parseSettingsPayload, migrateSettingsPayload, validateSettingsPayload } from '../store/logic/settingsSchema';
import { bigIntReplacer, bigIntReviver } from '../store/logic/utils';

const safeSerialize = (value: unknown) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  try {
    return JSON.parse(JSON.stringify(value, bigIntReplacer));
  } catch {
    return String(value);
  }
};

const sanitizeSettings = (settings: AppSettings) => {
  const cloned = JSON.parse(JSON.stringify(settings, bigIntReplacer)) as any;
  if (cloned.midi) {
    if (cloned.midi.inputName) cloned.midi.inputName = '[redacted]';
    if (cloned.midi.outputId) cloned.midi.outputId = '[redacted]';
  }
  if (cloned.midiDeviceManager?.selectedDeviceId) {
    cloned.midiDeviceManager.selectedDeviceId = '[redacted]';
  }
  if (Array.isArray(cloned.retunerDestinations)) {
    cloned.retunerDestinations = cloned.retunerDestinations.map((dest: any) => {
      if (dest?.webmidi?.outputId) {
        return { ...dest, webmidi: { ...dest.webmidi, outputId: '[redacted]' } };
      }
      return dest;
    });
  }
  return cloned;
};

const loadPersistedSettings = () => {
  if (typeof window === 'undefined') return { settings: null, raw: null };

  const raw = {
    settings: window.localStorage?.getItem(STORAGE_KEYS.settings),
    settingsUi: window.localStorage?.getItem(STORAGE_KEYS.settingsUi),
    flags: window.localStorage?.getItem(STORAGE_KEYS.flags),
  };

  const parsePart = (value: string | null) => {
    if (!value) return null;
    try {
      const parsed = parseSettingsPayload(value, bigIntReviver);
      const migrated = migrateSettingsPayload(parsed.version, parsed.data);
      const validated = validateSettingsPayload(migrated);
      if (validated.ok) return validated.data;
    } catch {
      return null;
    }
    return null;
  };

  const core = parsePart(raw.settings);
  const ui = parsePart(raw.settingsUi);
  const merged = core && ui ? { ...core, ...ui } : (core || ui || null);

  return {
    settings: merged ? sanitizeSettings(merged as AppSettings) : null,
    raw,
  };
};

export const buildDiagnosticsPackage = (state?: AppState) => {
  const caps = getDeviceCapabilities();
  const logs = getLogBuffer().map((entry) => ({
    ...entry,
    data: safeSerialize(entry.data),
  }));

  const persisted = loadPersistedSettings();
  const settingsSnapshot = state ? sanitizeSettings(state.settings) : persisted.settings;

  const stateSummary = state ? {
    appMode: state.appMode,
    landingMode: state.landingMode,
    isArActive: state.settings.isArActive,
    isPureUIMode: state.isPureUIMode,
    isRecording: state.isRecording,
    nodes: state.nodes.length,
    edges: state.edges.length,
    selectedNodeId: state.selectedNode?.id ?? null,
    storageReadOnly: state.isStorageReadOnly,
  } : null;

  return {
    createdAt: new Date().toISOString(),
    app: {
      url: typeof window !== 'undefined' ? window.location.href : null,
      mode: import.meta.env.MODE,
      online: caps.isOnline,
    },
    device: caps,
    state: stateSummary,
    settings: settingsSnapshot,
    persisted: persisted.raw,
    logs,
  };
};
