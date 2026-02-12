
import type { AppState, PrimeLimit, OriginConfig, AppSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { deepCopySettings } from './utils';
import { TRANSIENT_OVERLAY_RESET } from './transients';
import { saveMainState } from './persistence';
import { buildLatticeTopologyKey, buildLatticeDisplayKey } from '../../utils/lattice/generationKey';
import { buildNodeSearchIndex } from '../../utils/nodeSearchIndex';

const SETTINGS_HISTORY_LIMIT = 50;
const HISTORY_TRANSIENT_KEYS = new Set<keyof AppSettings>(['isArActive', 'retunerState']);

const buildHistorySnapshot = (settings: AppSettings) => {
    const next = deepCopySettings(settings);
    HISTORY_TRANSIENT_KEYS.forEach((key) => {
        delete (next as any)[key];
    });
    return next;
};

const applyHistorySnapshot = (snapshot: AppSettings, current: AppSettings) => {
    const next = deepCopySettings(snapshot);
    HISTORY_TRANSIENT_KEYS.forEach((key) => {
        (next as any)[key] = (current as any)[key];
    });
    return next;
};

const pushHistory = (history: AppSettings[], snapshot: AppSettings) => {
    const next = [...history, buildHistorySnapshot(snapshot)];
    return next.length > SETTINGS_HISTORY_LIMIT ? next.slice(next.length - SETTINGS_HISTORY_LIMIT) : next;
};

const pushFuture = (future: AppSettings[], snapshot: AppSettings) => {
    const next = [buildHistorySnapshot(snapshot), ...future];
    return next.length > SETTINGS_HISTORY_LIMIT ? next.slice(0, SETTINGS_HISTORY_LIMIT) : next;
};

const shouldRegenerateLattice = (state: AppState, nextSettings: AppSettings) => {
    const nextTopologyKey = buildLatticeTopologyKey(nextSettings);
    const nextDisplayKey = buildLatticeDisplayKey(nextSettings);
    const topologyChanged = state.latticeTopologyKey !== nextTopologyKey;
    const displayChanged = state.latticeDisplayKey !== nextDisplayKey;
    return { topologyChanged, displayChanged };
};

export const updateSettings = (set: any, newS: any) => set((s: AppState) => {
    const prevScale = s.settings.visuals.globalScale ?? 1;
    const nextScale = newS?.visuals?.globalScale ?? prevScale;
    let nextNodes = s.nodes;

    if (newS?.visuals && typeof nextScale === 'number' && prevScale > 0 && nextScale > 0 && prevScale !== nextScale) {
        const factor = nextScale / prevScale;
        const scaled = s.nodes.map(n => ({
            ...n,
            position: n.position.clone().multiplyScalar(factor)
        }));
        nextNodes = scaled;
    }

    const next = { ...s.settings, ...newS };
    const nextNodeSearchIndex = nextNodes === s.nodes ? s.nodeSearchIndex : buildNodeSearchIndex(nextNodes);
    saveMainState(next, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
    return { settings: next, nodes: nextNodes, nodeSearchIndex: nextNodeSearchIndex };
});

export const updateVisualSettings = (set: any, newV: any) => set((s: AppState) => {
    const prevScale = s.settings.visuals.globalScale ?? 1;
    const nextScale = typeof newV.globalScale === 'number' ? newV.globalScale : prevScale;
    let nextNodes = s.nodes;

    if (typeof newV.globalScale === 'number' && prevScale > 0 && nextScale > 0 && prevScale !== nextScale) {
        const factor = nextScale / prevScale;
        const scaled = s.nodes.map(n => ({
            ...n,
            position: n.position.clone().multiplyScalar(factor)
        }));
        nextNodes = scaled;
    }

    const next = { ...s.settings, visuals: { ...s.settings.visuals, ...newV } };
    const nextNodeSearchIndex = nextNodes === s.nodes ? s.nodeSearchIndex : buildNodeSearchIndex(nextNodes);
    saveMainState(next, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
    return { settings: next, nodes: nextNodes, nodeSearchIndex: nextNodeSearchIndex };
});

export const commitDraftSettings = (set: any, get: any, newSettings: AppSettings) => {
    const current = get() as AppState;
    const { settings, settingsHistory, landingMode, isSetupComplete } = current;
    const regen = shouldRegenerateLattice(current, newSettings);

    const historyUpdate = pushHistory(settingsHistory, settings);
    set({
        settings: newSettings,
        settingsHistory: historyUpdate,
        settingsFuture: []
    });
    saveMainState(newSettings, { landingMode, isSetupComplete }, { immediate: true });
    if (regen.topologyChanged || regen.displayChanged) {
        get().regenerateLattice(false, false);
    }
};

export const undoSettings = (set: any, get: any) => {
    const current = get() as AppState;
    const { settingsHistory, settings, landingMode, isSetupComplete } = current;
    if (settingsHistory.length === 0) return;
    const prev = settingsHistory[settingsHistory.length - 1];
    const nextSettings = applyHistorySnapshot(prev, settings);
    const newHistory = settingsHistory.slice(0, -1);
    set((s: AppState) => ({
        settingsHistory: newHistory,
        settingsFuture: pushFuture(s.settingsFuture, s.settings),
        settings: nextSettings
    }));
    saveMainState(nextSettings, { landingMode, isSetupComplete });
    const regen = shouldRegenerateLattice(current, nextSettings);
    if (regen.topologyChanged || regen.displayChanged) {
        get().regenerateLattice(false, false);
    }
};

export const redoSettings = (set: any, get: any) => {
    const current = get() as AppState;
    const { settingsFuture, settings, landingMode, isSetupComplete } = current;
    if (settingsFuture.length === 0) return;
    const next = settingsFuture[0];
    const nextSettings = applyHistorySnapshot(next, settings);
    const newFuture = settingsFuture.slice(1);
    set((s: AppState) => ({
        settingsHistory: pushHistory(s.settingsHistory, s.settings),
        settingsFuture: newFuture,
        settings: nextSettings
    }));
    saveMainState(nextSettings, { landingMode, isSetupComplete });
    const regen = shouldRegenerateLattice(current, nextSettings);
    if (regen.topologyChanged || regen.displayChanged) {
        get().regenerateLattice(false, false);
    }
};

export const toggleAxisLoop = (set: any, limit: PrimeLimit) => {
    set((s: AppState) => {
        const cur = s.settings.axisLooping[limit];
        const next = cur !== null ? null : (s.settings.gen0Lengths[limit] || s.settings.expansionA);
        const nextSettings = { ...s.settings, axisLooping: { ...s.settings.axisLooping, [limit]: next } };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings };
    });
};

export const toggleCommaSpreadingForAxis = (set: any, get: any, limit: PrimeLimit) => {
    set((s: AppState) => {
        const current = s.settings.commaSpreadingEnabled?.[limit] || false;
        const nextSettings = {
            ...s.settings,
            commaSpreadingEnabled: {
                ...s.settings.commaSpreadingEnabled,
                [limit]: !current
            }
        };
        saveMainState(nextSettings, {
            landingMode: s.landingMode,
            isSetupComplete: s.isSetupComplete
        });
        return { settings: nextSettings };
    });
    get().regenerateLattice(false, true);
};

export const setCenter = (set: any, get: any, node: any) => {
    const { settings, landingMode, isSetupComplete } = get();
    if (settings.secondaryOrigins.length > 0) return;
    const vec = node.primeVector;
    const t = { ...settings.transpositionVector };
    [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].forEach((p: any) => { t[p as PrimeLimit] = (t[p as PrimeLimit] || 0) + (vec[p as PrimeLimit] || 0); });
    const nextSettings = { ...settings, transpositionVector: t };
    set({ settings: nextSettings });
    saveMainState(nextSettings, { landingMode, isSetupComplete });
    get().regenerateLattice(false, true);
};

export const addSecondaryOrigin = (set: any, get: any, node: any) => {
    set((s: AppState) => {
        if (s.settings.secondaryOrigins.length >= 6) return s;
        const o: OriginConfig = {
            id: node.id,
            primeVector: node.primeVector,
            name: node.name,
            rootLimits: [...s.settings.rootLimits],
            expansionA: s.settings.expansionA,
            gen0MaxLength: s.settings.gen0MaxLength,
            gen0MaxDisplayLength: s.settings.gen0MaxDisplayLength,
            gen0CustomizeEnabled: s.settings.gen0CustomizeEnabled,
            gen0Lengths: { ...s.settings.gen0Lengths },
            gen0Ranges: JSON.parse(JSON.stringify(s.settings.gen0Ranges)),
            expansionB: s.settings.expansionB,
            gen1Lengths: { ...s.settings.gen1Lengths },
            gen1Ranges: JSON.parse(JSON.stringify(s.settings.gen1Ranges)),
            gen2Lengths: JSON.parse(JSON.stringify(s.settings.gen2Lengths)),
            gen2Ranges: JSON.parse(JSON.stringify(s.settings.gen2Ranges)),
            expansionC: s.settings.expansionC,
            expansionD: s.settings.expansionD,
            expansionE: s.settings.expansionE,
            maxPrimeLimit: s.settings.maxPrimeLimit,
            gen1MaxPrimeLimit: s.settings.gen1MaxPrimeLimit,
            gen2MaxPrimeLimit: s.settings.gen2MaxPrimeLimit,
            gen3MaxPrimeLimit: s.settings.gen3MaxPrimeLimit,
            gen4MaxPrimeLimit: s.settings.gen4MaxPrimeLimit,
            gen1PrimeSet: s.settings.gen1PrimeSet ? [...s.settings.gen1PrimeSet] : undefined,
            gen2PrimeSet: s.settings.gen2PrimeSet ? [...s.settings.gen2PrimeSet] : undefined,
            gen3PrimeSet: s.settings.gen3PrimeSet ? [...s.settings.gen3PrimeSet] : undefined,
            gen4PrimeSet: s.settings.gen4PrimeSet ? [...s.settings.gen4PrimeSet] : undefined,
            axisLooping: { ...s.settings.axisLooping },
            commaSpreadingEnabled: { ...s.settings.commaSpreadingEnabled },
            loopTolerance: s.settings.loopTolerance
        };
        const nextSettings = { ...s.settings, secondaryOrigins: [...s.settings.secondaryOrigins, o] };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings };
    });
    get().regenerateLattice(false, true);
};

export const removeSecondaryOrigin = (set: any, get: any, id: string) => {
    set((s: AppState) => {
        const nextSettings = { ...s.settings, secondaryOrigins: s.settings.secondaryOrigins.filter(o => o.id !== id) };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings };
    });
    get().regenerateLattice(false, true);
};

export const resetHarmonicCenter = (set: any, get: any) => {
    set((s: AppState) => {
        const nextSettings = { ...s.settings, transpositionVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 } };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings };
    });
    get().regenerateLattice(false, true);
};

export const resetLatticeConfig = (set: any, get: any) => {
    const s = get().settings;
    const def = DEFAULT_SETTINGS;
    const nextSettings = { ...s, rootLimits: def.rootLimits, expansionA: def.expansionA, gen0Lengths: def.gen0Lengths, gen0Ranges: def.gen0Ranges, expansionB: def.expansionB, gen1Lengths: def.gen1Lengths, gen1Ranges: def.gen1Ranges, expansionC: def.expansionC, expansionD: def.expansionD, expansionE: def.expansionE, maxPrimeLimit: def.maxPrimeLimit, gen1MaxPrimeLimit: def.gen1MaxPrimeLimit, gen2MaxPrimeLimit: def.gen2MaxPrimeLimit, gen3MaxPrimeLimit: def.gen3MaxPrimeLimit, gen4MaxPrimeLimit: def.gen4MaxPrimeLimit, axisLooping: def.axisLooping };
    set({ settings: nextSettings });
    saveMainState(nextSettings, { landingMode: get().landingMode, isSetupComplete: get().isSetupComplete });
    get().regenerateLattice(false, true);
};

export const resetSettings = (set: any, get: any) => {
    const current = get().settings;
    const nextSettings = deepCopySettings(DEFAULT_SETTINGS);
    nextSettings.namingSetupCompleted = current.namingSetupCompleted ?? nextSettings.namingSetupCompleted;
    set({
        settings: nextSettings,
        settingsHistory: [],
        settingsFuture: [],
        activeMaxPrimeLimit: DEFAULT_SETTINGS.maxPrimeLimit,
        ...TRANSIENT_OVERLAY_RESET
    });
    saveMainState(nextSettings, { landingMode: get().landingMode, isSetupComplete: get().isSetupComplete });
    get().regenerateLattice(true, false);
};

export const toggleSimpleMode = (set: any, get: any) => {
    const s = get();
    const currentSettings = s.settings;
    const nextMode = !currentSettings.isSimpleMode;
    let newSettings: AppSettings;
    let newSavedAdvanced = s.savedAdvancedSettings;
    let newSavedSimple = s.savedSimpleSettings;
    const namingSetupCompleted = currentSettings.namingSetupCompleted ?? DEFAULT_SETTINGS.namingSetupCompleted;
    const branchHotkeys = currentSettings.branchHotkeys ?? DEFAULT_SETTINGS.branchHotkeys;

    if (nextMode) {
        newSavedAdvanced = deepCopySettings(currentSettings);
        if (newSavedSimple) {
            newSettings = { ...newSavedSimple, isSimpleMode: true };
        } else {
            newSettings = { ...deepCopySettings(DEFAULT_SETTINGS), isSimpleMode: true, rootLimits: [3, 5], maxPrimeLimit: 5, expansionA: 6, expansionB: 2, expansionC: 0, expansionD: 0, expansionE: 0, gen0Lengths: {} as any, gen0Ranges: {}, gen1Lengths: {} as any, gen1Ranges: {}, secondaryOrigins: [], visuals: { ...DEFAULT_SETTINGS.visuals, spiralFactor: 0, layoutMode: 'lattice' }, namingSetupCompleted, branchHotkeys };
        }
    } else {
        newSavedSimple = deepCopySettings(currentSettings);
        if (newSavedAdvanced) {
            newSettings = { ...newSavedAdvanced, isSimpleMode: false };
        } else {
            newSettings = { ...deepCopySettings(DEFAULT_SETTINGS), isSimpleMode: false, namingSetupCompleted, branchHotkeys };
        }
    }

    set({
        settings: newSettings,
        savedAdvancedSettings: newSavedAdvanced,
        savedSimpleSettings: newSavedSimple,
        simpleModeStage: nextMode ? (s.savedSimpleSettings ? s.simpleModeStage : 'prompt') : s.simpleModeStage,
        ...TRANSIENT_OVERLAY_RESET
    });
    saveMainState(newSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
    get().regenerateLattice(false, true);
};

export const maskNode = (set: any, get: any, id: string) => {
    set((s: AppState) => {
        const currentMask = s.settings.maskedNodeIds || [];
        if (currentMask.includes(id)) return s;
        const historyUpdate = pushHistory(s.settingsHistory, s.settings);
        const nextSettings = { ...s.settings, maskedNodeIds: [...currentMask, id] };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings, settingsHistory: historyUpdate, settingsFuture: [] };
    });
    get().regenerateLattice(false, true);
};

export const unmaskNode = (set: any, get: any, id: string) => {
    set((s: AppState) => {
        const currentMask = s.settings.maskedNodeIds || [];
        if (!currentMask.includes(id)) return s;
        const historyUpdate = pushHistory(s.settingsHistory, s.settings);
        const nextSettings = { ...s.settings, maskedNodeIds: currentMask.filter(mid => mid !== id) };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings, settingsHistory: historyUpdate, settingsFuture: [] };
    });
    get().regenerateLattice(false, true);
};

export const unmaskAllNodes = (set: any, get: any) => {
    set((s: AppState) => {
        const historyUpdate = pushHistory(s.settingsHistory, s.settings);
        const nextSettings = { ...s.settings, maskedNodeIds: [] };
        saveMainState(nextSettings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
        return { settings: nextSettings, settingsHistory: historyUpdate, settingsFuture: [] };
    });
    get().regenerateLattice(false, true);
};
