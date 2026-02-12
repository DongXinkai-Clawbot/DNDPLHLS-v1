
import type { EarTrainingPersistedV1, AppSettings, LandingMode, StorageRecovery } from '../../types';
import { DEFAULT_PERSISTED_EAR } from './constants';
import { bigIntReplacer, bigIntReviver } from './utils';
import { createLogger } from '../../utils/logger';
import { STORAGE_KEYS, migrateLegacyStorage } from './storageKeys';
import { wrapSettingsPayload, parseSettingsPayload, migrateSettingsPayload, validateSettingsPayload } from './settingsSchema';

const log = createLogger('store/persistence');

const FLAGS_VERSION = 1;
const MAIN_SAVE_DEBOUNCE_MS = 2000;
const UI_SAVE_DEBOUNCE_MS = 5000;
const FLAGS_SAVE_DEBOUNCE_MS = 5000;
const EAR_SAVE_DEBOUNCE_MS = 1000;

let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let coreDueAt = 0;
let uiDueAt = 0;
let flagsDueAt = 0;
let earDueAt = 0;
let pendingCoreSettings: Partial<AppSettings> | null = null;
let pendingUiSettings: Partial<AppSettings> | null = null;
let pendingFlags: { landingMode: LandingMode; isSetupComplete: boolean } | null = null;
let pendingEarData: EarTrainingPersistedV1 | null = null;
let listenersInitialized = false;
let lastCoreSerialized: string | null = null;
let lastUiSerialized: string | null = null;
let lastFlagsSerialized: string | null = null;
let lastEarSerialized: string | null = null;
let storageReadOnly = false;
let storageRecovery: StorageRecovery | null = null;

const canUseStorage = () => {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
        return false;
    }
};

export const isStorageReadOnly = () => storageReadOnly;
export const getStorageRecovery = () => storageRecovery;
export const setStorageReadOnly = (next: boolean) => {
    storageReadOnly = next;
};

const UI_SETTING_KEYS = new Set<string>([
    'visuals',
    'playbackVisualizationMode',
    'playbackRing',
    'notationSymbols',
    'navigationShortcuts',
    'navigationControls',
    'accidentalPlacement',
    'simpleLabelMode',
    'hunt'
]);

const TRANSIENT_SETTING_KEYS = new Set<string>([
    'isArActive',
    'retunerState'
]);

const splitSettingsForPersistence = (settings: AppSettings) => {
    const core: Partial<AppSettings> = {};
    const ui: Partial<AppSettings> = {};

    Object.entries(settings).forEach(([key, value]) => {
        if (TRANSIENT_SETTING_KEYS.has(key)) return;
        if (UI_SETTING_KEYS.has(key)) {
            (ui as any)[key] = value;
        } else {
            (core as any)[key] = value;
        }
    });

    if (core.timbre?.lastError) {
        core.timbre = { ...core.timbre, lastError: null };
    }
    if (ui.timbre?.lastError) {
        ui.timbre = { ...ui.timbre, lastError: null };
    }

    return { core, ui };
};

const clearFlushTimeout = () => {
    if (!flushTimeout) return;
    clearTimeout(flushTimeout);
    flushTimeout = null;
};

const resetPendingState = () => {
    pendingCoreSettings = null;
    pendingUiSettings = null;
    pendingFlags = null;
    pendingEarData = null;
    coreDueAt = 0;
    uiDueAt = 0;
    flagsDueAt = 0;
    earDueAt = 0;
    clearFlushTimeout();
};

const getNextDueAt = () => {
    const candidates = [coreDueAt, uiDueAt, flagsDueAt, earDueAt].filter((t) => t > 0);
    if (candidates.length === 0) return Infinity;
    return Math.min(...candidates);
};

const scheduleFlush = () => {
    if (!canUseStorage()) {
        resetPendingState();
        return;
    }
    const nextDue = getNextDueAt();
    if (!Number.isFinite(nextDue)) return;
    const delay = Math.max(0, nextDue - Date.now());
    clearFlushTimeout();
    flushTimeout = setTimeout(() => {
        flushPendingState();
    }, delay);
};

const flushPendingState = (force = false) => {
    if (!pendingCoreSettings && !pendingUiSettings && !pendingFlags && !pendingEarData) return;
    if (!canUseStorage()) {
        resetPendingState();
        return;
    }
    const now = Date.now();
    const shouldFlushCore = pendingCoreSettings && (force || coreDueAt <= now);
    const shouldFlushUi = pendingUiSettings && (force || uiDueAt <= now);
    const shouldFlushFlags = pendingFlags && (force || flagsDueAt <= now);
    const shouldFlushEar = pendingEarData && (force || earDueAt <= now);
    try {
        if (shouldFlushCore && pendingCoreSettings) {
            const serialized = JSON.stringify(wrapSettingsPayload(pendingCoreSettings), bigIntReplacer);
            if (serialized !== lastCoreSerialized) {
                localStorage.setItem(STORAGE_KEYS.settings, serialized);
                lastCoreSerialized = serialized;
            }
            pendingCoreSettings = null;
            coreDueAt = 0;
        }
        if (shouldFlushUi && pendingUiSettings) {
            const serialized = JSON.stringify(wrapSettingsPayload(pendingUiSettings), bigIntReplacer);
            if (serialized !== lastUiSerialized) {
                localStorage.setItem(STORAGE_KEYS.settingsUi, serialized);
                lastUiSerialized = serialized;
            }
            pendingUiSettings = null;
            uiDueAt = 0;
        }
        if (shouldFlushFlags && pendingFlags) {
            const serialized = JSON.stringify({ v: FLAGS_VERSION, ...pendingFlags });
            if (serialized !== lastFlagsSerialized) {
                localStorage.setItem(STORAGE_KEYS.flags, serialized);
                lastFlagsSerialized = serialized;
            }
            pendingFlags = null;
            flagsDueAt = 0;
        }
        if (shouldFlushEar && pendingEarData) {
            const serialized = JSON.stringify(pendingEarData);
            if (serialized !== lastEarSerialized) {
                localStorage.setItem(STORAGE_KEYS.earTraining, serialized);
                lastEarSerialized = serialized;
            }
            pendingEarData = null;
            earDueAt = 0;
        }
    } catch (e) {
        log.warn('Failed to persist app state', e);
    } finally {
        clearFlushTimeout();
        if (pendingCoreSettings || pendingUiSettings || pendingFlags || pendingEarData) {
            scheduleFlush();
        }
    }
};

const flushMainState = () => flushPendingState(true);

const ensureFlushListeners = () => {
    if (listenersInitialized || typeof window === 'undefined') return;
    listenersInitialized = true;

    const handleHide = () => flushMainState();
    window.addEventListener('pagehide', handleHide);
    window.addEventListener('beforeunload', handleHide);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') handleHide();
    });
};

export const saveEarData = (data: EarTrainingPersistedV1) => {
    if (!canUseStorage() || storageReadOnly) return;
    pendingEarData = data;
    earDueAt = Date.now() + EAR_SAVE_DEBOUNCE_MS;
    ensureFlushListeners();
    scheduleFlush();
};

export const loadEarData = (): EarTrainingPersistedV1 => {
    if (!canUseStorage()) return DEFAULT_PERSISTED_EAR;
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.earTraining);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.v === 1) return data;
        }
    } catch (e) {}
    return DEFAULT_PERSISTED_EAR;
};

export const saveMainState = (
    settings: AppSettings,
    flags: { landingMode: LandingMode; isSetupComplete: boolean },
    opts?: { immediate?: boolean }
) => {
    if (!canUseStorage() || storageReadOnly) return;
    const layers = splitSettingsForPersistence(settings);
    pendingCoreSettings = pendingCoreSettings ? { ...pendingCoreSettings, ...layers.core } : layers.core;
    pendingUiSettings = pendingUiSettings ? { ...pendingUiSettings, ...layers.ui } : layers.ui;
    pendingFlags = flags;
    ensureFlushListeners();
    const now = Date.now();
    const coreDelay = opts?.immediate ? 0 : MAIN_SAVE_DEBOUNCE_MS;
    const uiDelay = opts?.immediate ? 0 : UI_SAVE_DEBOUNCE_MS;
    const flagsDelay = opts?.immediate ? 0 : FLAGS_SAVE_DEBOUNCE_MS;
    coreDueAt = now + coreDelay;
    uiDueAt = now + uiDelay;
    flagsDueAt = now + flagsDelay;
    if (opts?.immediate) {
        flushMainState();
        return;
    }
    scheduleFlush();
};

export const loadMainState = () => {
    if (!canUseStorage()) return { settings: null, flags: null, recovery: null, readOnly: false };
    try {
        storageReadOnly = false;
        storageRecovery = null;
        migrateLegacyStorage();
        const s = localStorage.getItem(STORAGE_KEYS.settings);
        const ui = localStorage.getItem(STORAGE_KEYS.settingsUi);
        const f = localStorage.getItem(STORAGE_KEYS.flags);

        let flags: any = null;
        if (f) {
            try {
                const raw = JSON.parse(f);
                const landingMode = raw?.landingMode;
                const isSetupComplete = raw?.isSetupComplete;
                const v = raw?.v;
                const allowed = new Set<LandingMode>(['none', 'simple', 'advanced', 'tutorial', 'ear']);
                if (v === FLAGS_VERSION && allowed.has(landingMode) && typeof isSetupComplete === 'boolean') {
                    flags = { landingMode, isSetupComplete };
                } else if (allowed.has(landingMode) && typeof isSetupComplete === 'boolean') {
                    flags = { landingMode, isSetupComplete };
                } else {
                    flags = null;
                }
            } catch (e) {
                flags = null;
            }
        }

        const parseSettingsPart = (raw: string | null) => {
            if (!raw) return { data: null as Partial<AppSettings> | null, error: null as string | null, raw: null as string | null };
            try {
                const parsed = parseSettingsPayload(raw, bigIntReviver);
                const migrated = migrateSettingsPayload(parsed.version, parsed.data);
                const validated = validateSettingsPayload(migrated);
                if (!validated.ok) {
                    return { data: null, error: validated.reason, raw };
                }
                return { data: validated.data, error: null, raw };
            } catch (e) {
                return { data: null, error: 'Failed to parse settings payload.', raw };
            }
        };

        const coreResult = parseSettingsPart(s);
        const uiResult = parseSettingsPart(ui);

        const mergedSettings = coreResult.data && uiResult.data
            ? { ...coreResult.data, ...uiResult.data }
            : (coreResult.data || uiResult.data || null);

        if (coreResult.error || uiResult.error) {
            storageReadOnly = true;
            storageRecovery = {
                reason: coreResult.error || uiResult.error || 'Stored settings appear corrupted.',
                payloads: {
                    settings: coreResult.raw,
                    settingsUi: uiResult.raw,
                    flags: f
                }
            };
        }

        return {
            settings: mergedSettings,
            flags,
            recovery: storageRecovery,
            readOnly: storageReadOnly
        };
    } catch (e) {
        storageReadOnly = true;
        storageRecovery = {
            reason: 'Failed to load saved state.',
            payloads: {
                settings: null,
                settingsUi: null,
                flags: null
            }
        };
        return { settings: null, flags: null, recovery: storageRecovery, readOnly: storageReadOnly };
    }
};

export const clearSessionFlags = () => {
    localStorage.removeItem(STORAGE_KEYS.flags);
};

export const initialEarData = loadEarData();
