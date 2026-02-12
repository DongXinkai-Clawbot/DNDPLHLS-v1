
import type { AppState, SavedSession } from '../../types';
import { INITIAL_PANELS } from './constants';
import { createLogger } from '../../utils/logger';
import { createDefaultMathLabState, migrateMathLabState } from '../../utils/mathLabSchema';
import { STORAGE_KEYS } from './storageKeys';

const log = createLogger('store/snapshot');

export const buildSessionSnapshotFromState = (state: AppState): SavedSession => {
    
    const earPersisted = (state as any).earTraining?.persisted || null;
    const commaProfiles = (() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.commaJndProfiles) || '[]'); } catch { return []; }
    })();
    const commaActive = (() => {
        try { return localStorage.getItem(STORAGE_KEYS.commaJndActiveProfile) || null; } catch { return null; }
    })();

    return {
        version: 2,
        date: new Date().toISOString(),
        settings: state.settings,
        customKeyboard: state.customKeyboard,
        keyBindings: state.keyBindings,
        customNodeTextures: state.customNodeTextures,
        customNodeRotations: state.customNodeRotations,
        nodeSurfaceLabelOverrides: (state as any).nodeSurfaceLabelOverrides || {},
        savedChords: state.savedChords,
        savedKeyboards: state.savedKeyboards,
        savedCommas: state.savedCommas,
        savedMidiScales: state.savedMidiScales,
        savedChordGroupCollections: state.savedChordGroupCollections,
        progressionSteps: state.progressionSteps,
        panels: state.panels,
        mathLabState: state.mathLab,
        
        earTrainingPersisted: earPersisted,
        commaJNDProfiles: commaProfiles,
        commaJNDActiveProfile: commaActive
    };
};

export const applySessionSnapshot = (set: any, get: any, session: SavedSession) => {
    if (!session.settings) return;

    try {
        const profiles = (session as any).commaJNDProfiles;
        const active = (session as any).commaJNDActiveProfile;
        if (profiles) localStorage.setItem(STORAGE_KEYS.commaJndProfiles, JSON.stringify(profiles));
        if (active) localStorage.setItem(STORAGE_KEYS.commaJndActiveProfile, String(active));
        
        try { (window as any).__commaJNDToolState = undefined; } catch { }
    } catch (e) { log.warn('Failed to restore Comma profiles', e); }

    set((state: AppState) => {
        
        let nextEarTraining = { ...state.earTraining };
        try {
            const et = (session as any).earTrainingPersisted;
            if (et) {
                nextEarTraining.persisted = et;
                
                try { localStorage.setItem(STORAGE_KEYS.earTraining, JSON.stringify(et)); } catch { }
            }
        } catch (e) { log.warn('Failed to restore Ear Training data', e); }

        return {
            settings: session.settings,
            customKeyboard: session.customKeyboard || [],
            keyBindings: session.keyBindings || {},
            customNodeTextures: session.customNodeTextures || {},
            customNodeRotations: session.customNodeRotations || {},
            nodeSurfaceLabelOverrides: (session as any).nodeSurfaceLabelOverrides || {},
            savedChords: session.savedChords || [],
            savedKeyboards: session.savedKeyboards || [],
            savedCommas: session.savedCommas || [],
            savedMidiScales: session.savedMidiScales || [],
            savedChordGroupCollections: session.savedChordGroupCollections || [],
            progressionSteps: session.progressionSteps || [],
            panels: { ...INITIAL_PANELS, ...(session.panels || {}) },
            mathLab: session.mathLabState ? (() => {
                const current = state.mathLab || createDefaultMathLabState();
                const incoming: any = session.mathLabState;
                const migrated = migrateMathLabState(incoming, current);
                if (migrated.warnings.length) {
                    log.warn('MathLab migration warnings', migrated.warnings);
                }
                return migrated.next;
            })() : state.mathLab,

            isSetupComplete: true,
            hasConfiguredAdvanced: true,
            activeMaxPrimeLimit: session.settings.maxPrimeLimit,
            landingMode: 'advanced',
            earTraining: nextEarTraining
        };
    });

    get().regenerateLattice(false, true);
};
