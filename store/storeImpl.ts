import { create } from 'zustand';

import type { AppSettings, OutputDestination, NodeData, EdgeData, PrimeLimit, SavedSession, SavedChord, SavedKeyboard, OriginConfig, SimpleModeStage, Comma, AppState, SavedMidiScale, PanelState, PanelId, ProgressionStep, EarDifficulty, EarTaskType, MathNoteSet, MathLabState, ConsequentialScaleConfig, ConsequentialScaleResult, WorkspacePreset, WorkspaceSplitDirection, WorkspaceTemplateId, WorkspaceViewType } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_RETUNER_SETTINGS } from '../constants';
import { createAppModeSlice } from './slices/appModeSlice';
import { getSequencer } from '../utils/sequencer';
import { adjustOctave, parseMathExpression, parseGeneralRatio } from '../musicLogic';
import { registerSample, panicAudioPlayback, stopRecording } from '../audioEngine';
import { panicMidiOut } from '../midiOut';
import { panicTimbreEngine } from '../timbreEngine';
import type { RetunerSettings } from '../domain/retuner/types';
import { clampPitchBendRange } from '../domain/retuner/destination';
import * as Actions from './actions';
import * as EarLogic from './logic/ear';
import * as UILogic from './logic/ui';
import * as SettingsLogic from './logic/settings';
import * as KeyboardLogic from './logic/keyboard';
import * as SessionLogic from './logic/session';
import { setupRetunerGroupSync } from './logic/retunerGroupSync';
import { initialEarData, loadMainState, saveMainState, clearSessionFlags } from './logic/persistence';
import { STORAGE_KEYS, resetPersistedState } from './logic/storageKeys';
import { TRANSIENT_OVERLAY_RESET } from './logic/transients';
import { createLogger } from '../utils/logger';
import { createDefaultMathLabState } from '../utils/mathLabSchema';
import { normalizeTimbrePatch } from '../utils/timbrePatch';
import { getPerformancePolicy, applyPerformancePolicyToSettings } from '../utils/performancePolicy';
import { loadAuthState, saveAuthState, clearAuthState, DEFAULT_AUTH_STATE } from './logic/authStorage';
import { buildWorkspaceTemplate, createPaneNode, getPaneIds, removePaneNode, splitPaneNode, updatePaneNode } from '../utils/workspaceLayout';

const log = createLogger('store');

const deepCopySettings = (settings: AppSettings): AppSettings => {
    try {
        // Try structured clone first (fast path on modern browsers)
        if (typeof structuredClone === 'function') {
            try {
                // Attempt fast structured clone
                return structuredClone(settings);
            } catch (err) {
                // If structuredClone fails, fall through to JSON method
                console.warn('structuredClone failed, falling back to JSON:', err);
            }
        }

        // JSON fallback (slower but safer for large objects)
        // This is synchronous but at least logs failures
        try {
            return JSON.parse(JSON.stringify(settings));
        } catch (err) {
            console.error('deepCopySettings failed completely, returning shallow copy:', err);
            // Last resort: shallow copy to prevent crash
            return { ...settings };
        }
    } catch (err) {
        console.error('deepCopySettings unexpected error:', err);
        // Safety net: return object as-is if copying fails
        return settings;
    }
};

const clampLengths = (lengths: Record<string, number> | undefined, max: number) => {
    if (!lengths) return lengths;
    let changed = false;
    const next: Record<string, number> = {};
    Object.entries(lengths).forEach(([key, value]) => {
        const nextValue = Math.min(value, max);
        if (nextValue !== value) changed = true;
        next[key] = nextValue;
    });
    return changed ? next : lengths;
};

const clampRanges = (ranges: Record<string, { neg: number; pos: number }> | undefined, max: number) => {
    if (!ranges) return ranges;
    let changed = false;
    const next: Record<string, { neg: number; pos: number }> = {};
    Object.entries(ranges).forEach(([key, range]) => {
        const neg = Math.min(range?.neg ?? 0, max);
        const pos = Math.min(range?.pos ?? 0, max);
        if (neg !== range?.neg || pos !== range?.pos) changed = true;
        next[key] = { neg, pos };
    });
    return changed ? next : ranges;
};

const clampGen0MaxLength = (value: number | undefined) => {
    const raw = Number.isFinite(value) ? (value as number) : DEFAULT_SETTINGS.gen0MaxLength;
    return Math.min(1500, Math.max(2, raw));
};

const clampUnit = (value: number, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(1, Math.max(0, value));
};

const computeChordRatioFromRatios = (ratios: string[]) => {
    if (!ratios || ratios.length < 2) return null;
    const raw = ratios.filter(Boolean);
    if (raw.length < 2) return null;
    if (new Set(raw).size < 2) return null;
    try {
        const fractions = raw.map(r => parseGeneralRatio(r));
        const gcd = (a: bigint, b: bigint): bigint => {
            let x = a < 0n ? -a : a;
            let y = b < 0n ? -b : b;
            while (y > 0n) {
                const t = y;
                y = x % y;
                x = t;
            }
            return x;
        };
        const lcm = (a: bigint, b: bigint): bigint => (a * b) / gcd(a, b);
        let commonD = 1n;
        fractions.forEach(f => { commonD = lcm(commonD, f.d); });
        let numerators = fractions.map(f => f.n * (commonD / f.d));
        if (numerators.length > 0) {
            let commonFactor = numerators[0];
            for (let i = 1; i < numerators.length; i++) {
                commonFactor = gcd(commonFactor, numerators[i]);
            }
            numerators = numerators.map(n => n / commonFactor);
        }
        if (numerators.length > 8) return 'Complexity Limit';
        return numerators.join(':');
    } catch (e) {
        return null;
    }
};

const hydrateSettings = (settings?: AppSettings): AppSettings => {
    const base = settings ? deepCopySettings(settings) : deepCopySettings(DEFAULT_SETTINGS);
    base.gen0MaxLength = clampGen0MaxLength(base.gen0MaxLength);
    if (Array.isArray(base.secondaryOrigins) && base.secondaryOrigins.length > 0) {
        base.secondaryOrigins = base.secondaryOrigins.map(origin => ({
            ...origin,
            gen0MaxLength: clampGen0MaxLength(origin.gen0MaxLength ?? base.gen0MaxLength),
            gen0MaxDisplayLength: origin.gen0MaxDisplayLength ?? base.gen0MaxDisplayLength,
            gen0CustomizeEnabled: origin.gen0CustomizeEnabled ?? base.gen0CustomizeEnabled,
            gen3Lengths: origin.gen3Lengths ? { ...origin.gen3Lengths } : { ...(base.gen3Lengths || {}) },
            gen3Ranges: origin.gen3Ranges ? { ...origin.gen3Ranges } : { ...(base.gen3Ranges || {}) },
            gen4Lengths: origin.gen4Lengths ? { ...origin.gen4Lengths } : { ...(base.gen4Lengths || {}) },
            gen4Ranges: origin.gen4Ranges ? { ...origin.gen4Ranges } : { ...(base.gen4Ranges || {}) },
            gen1MaxPrimeLimit: origin.gen1MaxPrimeLimit ?? base.gen1MaxPrimeLimit,
            gen2MaxPrimeLimit: origin.gen2MaxPrimeLimit ?? base.gen2MaxPrimeLimit,
            gen3MaxPrimeLimit: origin.gen3MaxPrimeLimit ?? base.gen3MaxPrimeLimit,
            gen4MaxPrimeLimit: origin.gen4MaxPrimeLimit ?? base.gen4MaxPrimeLimit,
            gen1PrimeSet: origin.gen1PrimeSet ? [...origin.gen1PrimeSet] : base.gen1PrimeSet,
            gen2PrimeSet: origin.gen2PrimeSet ? [...origin.gen2PrimeSet] : base.gen2PrimeSet,
            gen3PrimeSet: origin.gen3PrimeSet ? [...origin.gen3PrimeSet] : base.gen3PrimeSet,
            gen4PrimeSet: origin.gen4PrimeSet ? [...origin.gen4PrimeSet] : base.gen4PrimeSet,
            axisLooping: origin.axisLooping ? { ...origin.axisLooping } : { ...base.axisLooping },
            commaSpreadingEnabled: origin.commaSpreadingEnabled ? { ...origin.commaSpreadingEnabled } : { ...base.commaSpreadingEnabled },
            loopTolerance: origin.loopTolerance ?? base.loopTolerance
        }));
    }
    base.visuals = {
        ...DEFAULT_SETTINGS.visuals,
        ...(base.visuals || {}),
        limitColors: { ...DEFAULT_SETTINGS.visuals.limitColors, ...(base.visuals?.limitColors || {}) },
        limitOpacities: { ...DEFAULT_SETTINGS.visuals.limitOpacities, ...(base.visuals?.limitOpacities || {}) },
        genOpacities: { ...DEFAULT_SETTINGS.visuals.genOpacities, ...(base.visuals?.genOpacities || {}) },
        primeSpacings: { ...DEFAULT_SETTINGS.visuals.primeSpacings, ...(base.visuals?.primeSpacings || {}) }
    };
    base.playbackVisualizationMode = base.playbackVisualizationMode || DEFAULT_SETTINGS.playbackVisualizationMode;
    base.playbackRing = { ...DEFAULT_SETTINGS.playbackRing, ...(base.playbackRing || {}) };
    if (base.geometry) {
        base.geometry = {
            ...DEFAULT_SETTINGS.geometry,
            ...base.geometry,
            sphere: { ...DEFAULT_SETTINGS.geometry.sphere, ...(base.geometry?.sphere || {}) },
            custom: {
                ...DEFAULT_SETTINGS.geometry.custom,
                ...(base.geometry?.custom || {}),
                parametric: {
                    ...DEFAULT_SETTINGS.geometry.custom?.parametric,
                    ...(base.geometry?.custom?.parametric || {})
                }
            }
        };
    } else {
        base.geometry = { ...DEFAULT_SETTINGS.geometry };
    }
    const defaultRatioDisplay: any = (DEFAULT_SETTINGS.visuals as any)?.ratioDisplay;
    const baseRatioDisplay: any = (base.visuals as any)?.ratioDisplay;
    if (defaultRatioDisplay) {
        (base.visuals as any).ratioDisplay = {
            ...defaultRatioDisplay,
            ...(baseRatioDisplay || {}),
            contexts: { ...(defaultRatioDisplay.contexts || {}), ...(baseRatioDisplay?.contexts || {}) }
        };
    }
    base.navigationShortcuts = { ...DEFAULT_SETTINGS.navigationShortcuts, ...(base.navigationShortcuts || {}) };
    base.notationSymbols = { ...DEFAULT_SETTINGS.notationSymbols, ...(base.notationSymbols || {}) };
    const sym5 = base.notationSymbols[5];
    if (sym5?.up === '~' && sym5?.down === '~' && !sym5.placement) {
        base.notationSymbols[5] = { ...sym5, down: '+', placement: 'right' };
    }
    if (!base.navigationControls) {
        base.navigationControls = { ...DEFAULT_SETTINGS.navigationControls };
    } else {
        base.navigationControls = { ...DEFAULT_SETTINGS.navigationControls, ...base.navigationControls };
    }
    if (base.namingSetupCompleted === undefined) {
        base.namingSetupCompleted = settings ? true : DEFAULT_SETTINGS.namingSetupCompleted;
    }
    if (!base.branchHotkeys) {
        base.branchHotkeys = { ...(DEFAULT_SETTINGS.branchHotkeys as any) };
    } else {
        base.branchHotkeys = { ...(DEFAULT_SETTINGS.branchHotkeys as any), ...base.branchHotkeys };
    }
    if (base.branchHotkeys) {
        const clampLen = (value: number, fallback: number) => {
            if (!Number.isFinite(value)) return fallback;
            return Math.max(0, Math.min(999, Math.floor(value)));
        };
        base.branchHotkeys.defaultNeg = clampLen(base.branchHotkeys.defaultNeg, DEFAULT_SETTINGS.branchHotkeys?.defaultNeg ?? 0);
        base.branchHotkeys.defaultPos = clampLen(base.branchHotkeys.defaultPos, DEFAULT_SETTINGS.branchHotkeys?.defaultPos ?? 0);
    }
    if (base.synthPatches) {
        base.synthPatches = { ...DEFAULT_SETTINGS.synthPatches, ...base.synthPatches };
        if (!base.synthPatches.keyboardPatch) {
            base.synthPatches.keyboardPatch = DEFAULT_SETTINGS.synthPatches?.keyboardPatch;
        }
    }
    if (!base.timbre) {
        base.timbre = deepCopySettings(DEFAULT_SETTINGS).timbre;
    } else {
        base.timbre = {
            ...DEFAULT_SETTINGS.timbre,
            ...base.timbre,
            mapping: { ...DEFAULT_SETTINGS.timbre.mapping, ...(base.timbre.mapping || {}) },
            performance: { ...DEFAULT_SETTINGS.timbre.performance, ...(base.timbre.performance || {}) }
        };
        if (!Array.isArray(base.timbre.patches) || base.timbre.patches.length === 0) {
            base.timbre.patches = deepCopySettings(DEFAULT_SETTINGS).timbre.patches;
        }
        if (Array.isArray(base.timbre.patches)) {
            base.timbre.patches = base.timbre.patches.map((patch) => {
                const normalized = normalizeTimbrePatch(patch);
                const harmonic = normalized.voice.harmonic;
                const nextCurve = clampUnit(harmonic.inharmonicityCurve, 1);
                if (nextCurve === harmonic.inharmonicityCurve) return normalized;
                return {
                    ...normalized,
                    voice: {
                        ...normalized.voice,
                        harmonic: { ...harmonic, inharmonicityCurve: nextCurve }
                    }
                };
            });
        }
        const activeId = base.timbre.activePatchId;
        if (!activeId || !base.timbre.patches.find(p => p.id === activeId)) {
            base.timbre.activePatchId = base.timbre.patches[0]?.id || DEFAULT_SETTINGS.timbre.activePatchId;
        }
    }
    if (!base.tuner) {
        base.tuner = deepCopySettings(DEFAULT_SETTINGS).tuner;
    } else {
        const defaultTuner = deepCopySettings(DEFAULT_SETTINGS).tuner;
        base.tuner = {
            ...defaultTuner,
            ...base.tuner,
            profiles: Array.isArray(base.tuner.profiles) && base.tuner.profiles.length > 0
                ? base.tuner.profiles
                : (defaultTuner?.profiles || [])
        };
        const activeId = base.tuner.activeProfileId;
        if (base.tuner.profiles?.length && (!activeId || !base.tuner.profiles.find(p => p.id === activeId))) {
            base.tuner.activeProfileId = base.tuner.profiles[0]?.id || defaultTuner?.activeProfileId || '';
        }
    }
    if (base.notationSymbols[29]?.up === 'm' && base.notationSymbols[29]?.down === 'm') {
        base.notationSymbols[29] = { up: '\u03bc', down: '\u03bc' };
    }
    if (base.notationSymbols[31]?.up === 'n' && base.notationSymbols[31]?.down === 'n') {
        base.notationSymbols[31] = { up: '\u03bd', down: '\u03bd' };
    }
    if (!base.curvedGeometry) {
        base.curvedGeometry = { ...DEFAULT_SETTINGS.curvedGeometry };
    } else {
        base.curvedGeometry = { ...DEFAULT_SETTINGS.curvedGeometry, ...base.curvedGeometry };
    }
    if (!base.hunt) {
        base.hunt = { ...DEFAULT_SETTINGS.hunt };
    } else {
        base.hunt = { ...DEFAULT_SETTINGS.hunt, ...base.hunt };
    }
    // --- Retuner / DAW output hydration (backwards-compatible) ---
    const anyBase = base as any;
    const existingRetuner = (anyBase.retuner || {}) as Partial<RetunerSettings>;
    const mergedRetuner: RetunerSettings = {
        ...DEFAULT_RETUNER_SETTINGS,
        ...existingRetuner,
        input: {
            ...DEFAULT_RETUNER_SETTINGS.input,
            ...((existingRetuner as any).input || {}),
            baseTuning: {
                ...DEFAULT_RETUNER_SETTINGS.input.baseTuning,
                ...(((existingRetuner as any).input || {}).baseTuning || {})
            },
            sourceFilter: {
                ...DEFAULT_RETUNER_SETTINGS.input.sourceFilter,
                ...(((existingRetuner as any).input || {}).sourceFilter || {})
            },
            loopbackGuard: {
                ...DEFAULT_RETUNER_SETTINGS.input.loopbackGuard,
                ...(((existingRetuner as any).input || {}).loopbackGuard || {})
            },
            mappingTable: Array.isArray(((existingRetuner as any).input || {}).mappingTable)
                ? ((existingRetuner as any).input || {}).mappingTable
                : DEFAULT_RETUNER_SETTINGS.input.mappingTable
        },
        zone: { ...DEFAULT_RETUNER_SETTINGS.zone, ...((existingRetuner as any).zone || {}) },
        mtsEsp: { ...DEFAULT_RETUNER_SETTINGS.mtsEsp, ...(((existingRetuner as any).mtsEsp) || {}) },
        mpeZone: ((existingRetuner as any).mpeZone !== undefined && (existingRetuner as any).mpeZone !== null)
            ? { ...(DEFAULT_RETUNER_SETTINGS as any).mpeZone, ...((existingRetuner as any).mpeZone || {}) }
            : (DEFAULT_RETUNER_SETTINGS as any).mpeZone,
        preflight: { ...DEFAULT_RETUNER_SETTINGS.preflight, ...((existingRetuner as any).preflight || {}) },
        tuningChangePolicy: { ...DEFAULT_RETUNER_SETTINGS.tuningChangePolicy, ...((existingRetuner as any).tuningChangePolicy || {}) },
        routes: Array.isArray((existingRetuner as any).routes)
            ? (existingRetuner as any).routes
            : DEFAULT_RETUNER_SETTINGS.routes,
    };
    anyBase.retuner = mergedRetuner;

    // Destinations: ensure at least one WebMIDI destination exists so UI + engine always have a target.
    const existingDestinations: OutputDestination[] | undefined = Array.isArray(anyBase.retunerDestinations)
        ? (anyBase.retunerDestinations as OutputDestination[])
        : undefined;

    const legacyOutputId = (base as any).midi?.outputId ?? '';
    const legacyPbRange = (existingRetuner as any).outputPitchBendRange
        ?? (base as any).midi?.outputPitchBendRange
        ?? 48;

    const defaultDest: OutputDestination = {
        id: 'dest-webmidi-default',
        type: 'webmidi',
        name: 'MIDI Output',
        pitchBendRangeSemitones: clampPitchBendRange(legacyPbRange),
        connected: false,
        status: 'disconnected',
        webmidi: {
            outputId: legacyOutputId,
            sendRpnOnConnect: true,
        },
    };

    if (!existingDestinations || existingDestinations.length === 0) {
        anyBase.retunerDestinations = [defaultDest];
    } else {
        anyBase.retunerDestinations = existingDestinations.map((d) => {
            const sanitized: OutputDestination = {
                ...defaultDest,
                ...d,
                // connection status is runtime-only
                connected: false,
                status: 'disconnected',
                lastError: undefined,
                lastErrorCode: undefined,
                lastConnectedAt: undefined,
                lastPreflightAt: undefined,
                capabilitiesSnapshot: undefined,
                pitchBendRangeSemitones: clampPitchBendRange((d as any).pitchBendRangeSemitones ?? legacyPbRange),
                webmidi: d.type === 'webmidi'
                    ? { ...defaultDest.webmidi!, ...((d as any).webmidi || {}) }
                    : (d as any).webmidi,
                mtsEsp: d.type === 'mts-esp'
                    ? {
                        clientCount: (d as any).mtsEsp?.clientCount ?? 0,
                        broadcastIntervalMs: (d as any).mtsEsp?.broadcastIntervalMs ?? 100,
                        mode: (d as any).mtsEsp?.mode ?? 'broadcast-only',
                        broadcastPolicy: (d as any).mtsEsp?.broadcastPolicy ?? 'onchange',
                        intervalMs: (d as any).mtsEsp?.intervalMs ?? 1000
                    }
                    : (d as any).mtsEsp,
            };
            return sanitized;
        });
    }

    // Ensure retuner.destinationId is valid.
    const destList: OutputDestination[] = anyBase.retunerDestinations as OutputDestination[];
    const destId = (anyBase.retuner as RetunerSettings).destinationId;
    if (!destId || !destList.find((d) => d.id === destId)) {
        (anyBase.retuner as RetunerSettings).destinationId = destList[0]?.id || null;
    }

    // Retuner state is runtime; ensure it exists so UI reads don't crash.
    if (!anyBase.retunerState) {
        anyBase.retunerState = {};
    }

    const policy = getPerformancePolicy();
    const tuned = applyPerformancePolicyToSettings(base, policy);
    tuned.gen0Lengths = clampLengths(tuned.gen0Lengths, tuned.expansionA) as any;
    tuned.gen0Ranges = clampRanges(tuned.gen0Ranges, tuned.expansionA) as any;
    tuned.gen1Lengths = clampLengths(tuned.gen1Lengths, tuned.expansionB) as any;
    tuned.gen1Ranges = clampRanges(tuned.gen1Ranges, tuned.expansionB) as any;
    return tuned;
};

const bigIntReviver = (key: string, value: any) => {
    if (typeof value === 'string' && /^-?\d+n$/.test(value)) return BigInt(value.slice(0, -1));
    return value;
};

const getViewportSize = () => {
    if (typeof window === 'undefined') return { width: 1200, height: 800 };
    return { width: window.innerWidth || 1200, height: window.innerHeight || 800 };
};

const WORKSPACE_SCHEMA_VERSION = 1;

const loadWorkspacePresets = (): WorkspacePreset[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.workspacePresets);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        log.warn('Failed to load workspace presets', e);
        return [];
    }
};

const saveWorkspacePresets = (presets: WorkspacePreset[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEYS.workspacePresets, JSON.stringify(presets));
    } catch (e) {
        log.warn('Failed to persist workspace presets', e);
    }
};

const buildDefaultWorkspace = () => {
    const { layout, nextId } = buildWorkspaceTemplate('single', 1);
    return {
        schemaVersion: WORKSPACE_SCHEMA_VERSION,
        layout,
        transport: { mode: 'stopped' as const, position: { measureIndex: 0, tick: 0 } },
        selection: { selectedNotes: [], selectedEvent: null, hoverNote: null },
        sync: { syncEnabled: true, mode: 'soft' as const, scope: 'scoreOnly' as const, masterPaneId: null },
        filters: {},
        quality: { mode: 'balanced' as const },
        presets: loadWorkspacePresets(),
        nextPaneId: nextId,
        debug: { enabled: false, events: [] }
    };
};

const buildInitialPanels = (): Record<PanelId, PanelState> => {
    const { width, height } = getViewportSize();
    const scoreX = Math.max(20, width - 420);
    const scoreY = Math.max(80, Math.round(height * 0.12));
    const workspaceW = Math.min(1100, Math.max(680, width - 160));
    const workspaceH = Math.min(760, Math.max(420, height - 160));
    const workspaceX = Math.max(20, Math.round((width - workspaceW) / 2));
    const workspaceY = Math.max(60, Math.round((height - workspaceH) / 2));
    return {
        settings: { id: 'settings', title: 'CONFIG', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 20, y: 80, width: 300, height: 600, zIndex: 10 },
        info: { id: 'info', title: 'DETAILS', isOpen: false, isCollapsed: true, isPinned: false, mode: 'dock-bottom', x: 0, y: 0, width: 400, height: 300, zIndex: 5 },
        keyboard: { id: 'keyboard', title: 'KEYBOARD', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 20, y: height - 200, width: 500, height: 160, zIndex: 8 },
        comparison: { id: 'comparison', title: 'COMPARISON', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: width / 2 - 170, y: height - 250, width: 340, height: 200, zIndex: 9 },
        progression: { id: 'progression', title: 'SEQUENCER', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 60, y: 120, width: 300, height: 400, zIndex: 7 },
        score: { id: 'score', title: 'SCORE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: scoreX, y: scoreY, width: 360, height: 520, zIndex: 13 },
        workspace: { id: 'workspace', title: 'WORKSPACE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: workspaceX, y: workspaceY, width: workspaceW, height: workspaceH, zIndex: 14 },
        theory: { id: 'theory', title: 'THEORY GUIDE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'fullscreen', x: 0, y: 0, width, height, zIndex: 20 },
        mathlab: { id: 'mathlab', title: 'MATH LAB', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 50, y: 50, width: 900, height: 600, zIndex: 12 },
        'midi-device': { id: 'midi-device', title: 'MIDI DEVICE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 100, y: 100, width: 400, height: 500, zIndex: 11 }
    };
};

const INITIAL_PANELS: Record<PanelId, PanelState> = buildInitialPanels();

const earTrainingDefault = {
    isActive: false,
    mode: 'normal' as const,
    sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] },
    currentQuestion: null,
    currentQuestionStartedAt: 0,
    currentReplays: 0,
    phase: 'idle' as const,
    selectedAnswerId: null,
    settings: initialEarData.settings,
    returnTo: null,
    persisted: initialEarData,
    reviewQueue: [],
    ui: { panel: 'train' as const }
};

const midiRetunerDefault: any = {
    importResult: null,
    targetMode: 'custom',
    selectedScaleId: '',
    scalaScaleId: null as string | null,
    scalaSource: 'saved' as 'saved' | 'archive',
    edoDivisions: 12,
    baseNote: 69,
    restrictToNodes: false,
    outputUrl: null,
    outputName: 'retuned.mid',
    summary: null,
    retuneCustomScale: [] as string[],
    retuneSpeed: 1,
    retuneSpeedTargets: {
        preview: true,
        wav: true,
        midi: false
    },
    retuneTrackVisualsEnabled: false,
    retuneTrackEffect: 'glow',
    retunePreviewActive: false,
    previewPositionSeconds: 0,
    previewIsPlaying: false,
    previewSeekToSeconds: null as ((seconds: number) => void) | null,
    previewStop: null as (() => void) | null,
    retuneTrackStyles: [] as any[],
    // Lattice extension state
    preExtensionSettings: null as any | null, // Settings snapshot before temporary extension
    temporaryExtensionApplied: false,
    autoSwitchToLattice: true
};

// Safely initialize store state with comprehensive error handling
// This code runs at module load time, before error boundaries, so it must be bulletproof
let storedState: ReturnType<typeof loadMainState>;
let initialAuthState: ReturnType<typeof loadAuthState>;
let initialSettings: AppSettings;
let initialAppMode: AppMode;

try {
  storedState = loadMainState();
} catch (err) {
  console.error('Failed to load main state, using defaults:', err);
  storedState = { settings: {}, flags: {}, recovery: null };
}

try {
  initialAuthState = loadAuthState();
} catch (err) {
  console.error('Failed to load auth state, using defaults:', err);
  initialAuthState = {};
}

try {
  initialSettings = hydrateSettings(storedState?.settings);
} catch (err) {
  console.error('Failed to hydrate settings, using defaults:', err);
  // Provide minimal valid settings to prevent cascading crashes
  initialSettings = {
    ...DEFAULT_SETTINGS,
    // Preserve user's basic preferences if possible
    ...(!storedState || !storedState.settings ? {} : {
      maxPrimeLimit: storedState.settings?.maxPrimeLimit || DEFAULT_SETTINGS.maxPrimeLimit,
    })
  };
}

try {
  initialAppMode = (typeof window !== 'undefined' && window.location.hash.startsWith('#/museum')) ? 'museum' : 'lattice';
} catch (err) {
  console.error('Failed to determine app mode, defaulting to lattice:', err);
  initialAppMode = 'lattice';
}

export const useStore = create<AppState>((set, get) => ({
    ...createAppModeSlice(set, initialAppMode),
    landingMode: storedState.flags?.landingMode || 'none',
    isSetupComplete: storedState.flags?.isSetupComplete || false,
    hasConfiguredAdvanced: !!storedState.settings,
    isPureUIMode: false,
    isSettingsOpen: false,
    namingSetupOpen: false,
    settings: initialSettings,
    settingsHistory: [],
    settingsFuture: [],
    activeMaxPrimeLimit: initialSettings.maxPrimeLimit,
    nodes: [],
    nodeSearchIndex: null,
    edges: [],
    latticeTopologyKey: '',
    latticeDisplayKey: '',
    selectedNode: null,
    referenceNode: null,
    nearbyNodes: [], nearestGen0Nodes: [], nearestGen1Node: null,
    highlightedPath: [], affiliatedLineNodeIds: [], affiliatedLineLimit: null,
    isGenerating: false,
    error: null,
    storageRecovery: storedState.recovery || null,
    isStorageReadOnly: !!storedState.readOnly,
    customKeyboard: [], keyBindings: {},
    customNodeTextures: {}, customNodeRotations: {}, nodeSurfaceLabelOverrides: {}, nodeNameOverrides: {}, comparisonNodes: [], comparisonGroups: [], savedChords: [],
    isComparisonVisible: false, savedKeyboards: [], savedCommas: [], savedMidiScales: [], savedChordGroupCollections: [], selectionHistory: [],
    historyIndex: -1, isKeyboardVisible: false, isNodeInfoVisible: false, disableWasdInKeyboard: false, keyboardLayout: 'custom', keyboardHoldNotes: false,
    isEducationMode: false, educationLabelMode: 'ratio',
    navAxisHorizontal: 3, navAxisVertical: 5, navAxisDepth: 7, activeNavigationLimit: 3,
    isGravityEnabled: false, isIsolationMode: false, isRecording: false,
    customSampleNames: [],
    playingNodeIds: new Map(),
    playingRatios: new Map(),
    retuneSnapDelayMs: 0,
    showRetuneRatios: false,
    ratioStats: new Map(),
    chordStats: new Map(),
    lastChordRatio: null,
    showRatioStats: false,
    commaLines: [],
    pending_tempering_constraints: [],
    tempering_strategy: null,
    tempering_model: null,
    tempering_result: null,
    modifierKeys: { z: false, a: false, x: false },
    focusSignal: 0,
    cameraResetSignal: 0,
    simpleModeStage: 'prompt',
    isProgressionVisible: false,
    progressionSteps: [],
    progressionBpm: 120,
    progressionIsPlaying: false,
    progressionCurrentStep: 0,
    panels: INITIAL_PANELS,
    topZIndex: 30,
    notifications: [],
    activeDialog: null,
    latticeSlotCurrent: null,
    latticeSlotNew: null,
    latticeSlotNewName: null,

    mathLab: createDefaultMathLabState(),

    midiRetuner: midiRetunerDefault,
    pureScoreOverlay: {
        hidden: false,
        collapsed: false,
        displayMode: 'fraction',
        showBars: true,
        showOctaveFolding: true,
        showCents: false,
        showHz: false,
        showPrimes: false,
        soloVoiceId: null,
        pxPerSecond: 120,
        preSeconds: 6,
        postSeconds: 12,
        showJoinLine: false,
        joinLineStyle: 'solid'
    },
    auth: initialAuthState,
    authUi: {
        modalOpen: false,
        sidebarOpen: false
    },
    workspace: buildDefaultWorkspace(),

    earTraining: earTrainingDefault,

    setLandingMode: (mode) => {
        set({ landingMode: mode, ...TRANSIENT_OVERLAY_RESET });
        const namingSetupCompleted = get().settings.namingSetupCompleted ?? false;
        if (mode === 'simple' || mode === 'tutorial') {
            const simpleSettings = deepCopySettings(DEFAULT_SETTINGS);
            simpleSettings.namingSetupCompleted = namingSetupCompleted;
            simpleSettings.isSimpleMode = true;
            simpleSettings.maxPrimeLimit = 5;
            simpleSettings.rootLimits = [3, 5];
            simpleSettings.expansionA = 6;
            simpleSettings.expansionB = 2;
            simpleSettings.expansionC = 0;
            simpleSettings.expansionD = 0;
            simpleSettings.expansionE = 0;
            simpleSettings.gen0Lengths = {} as any;
            simpleSettings.gen0Ranges = {};
            simpleSettings.gen1Lengths = {} as any;
            simpleSettings.gen1Ranges = {};
            simpleSettings.secondaryOrigins = [];
            simpleSettings.visuals.layoutMode = 'lattice';
            simpleSettings.visuals.spiralFactor = 0;
            simpleSettings.visuals.lineRenderingMode = 'quality';
            simpleSettings.visuals.nodeShape = 'sphere';
            simpleSettings.visuals.nodeMaterial = 'lambert';

            set({
                settings: simpleSettings,
                isSetupComplete: true,
                simpleModeStage: mode === 'tutorial' ? 'tutorial' : 'prompt'
            });
            get().regenerateLattice(false, true);
        } else if (mode === 'ear') {
            const simpleSettings = deepCopySettings(DEFAULT_SETTINGS);
            simpleSettings.namingSetupCompleted = namingSetupCompleted;
            simpleSettings.isSimpleMode = true;
            set({
                settings: simpleSettings,
                isSetupComplete: true,
                earTraining: { ...get().earTraining, isActive: true, phase: 'idle', currentQuestion: null, returnTo: null, ui: { panel: 'train' } }
            });
        }

        const s = get();
        saveMainState(s.settings, { landingMode: s.landingMode, isSetupComplete: s.isSetupComplete });
    },

    addMathObject: (obj) => UILogic.addMathObject(set, obj),
    updateMathObject: (id, partial) => UILogic.updateMathObject(set, id, partial),
    removeMathObject: (id) => UILogic.removeMathObject(set, id),
    setMathObjects: (objects) => UILogic.setMathObjects(set, objects),
    setMathView: (view) => UILogic.setMathView(set, view),
    setMathSampling: (sampling) => UILogic.setMathSampling(set, sampling),
    setMathEditorState: (partial) => UILogic.setMathEditorState(set, partial),
    setMathUnifiedFunctionState: (partial) => UILogic.setMathUnifiedFunctionState(set, partial),
    setMathLabState: (state) => UILogic.setMathLabState(set, state),

    addMathNoteSet: (ns) => UILogic.addMathNoteSet(set, ns),
    updateMathNoteSet: (id, p) => UILogic.updateMathNoteSet(set, id, p),
    removeMathNoteSet: (id) => UILogic.removeMathNoteSet(set, id),
    setActiveMathNoteSet: (id) => UILogic.setActiveMathNoteSet(set, id),

    addNoteSet: (ns) => UILogic.addMathNoteSet(set, ns),
    updateNoteSet: (id, p) => UILogic.updateMathNoteSet(set, id, p),
    deleteNoteSet: (id) => UILogic.removeMathNoteSet(set, id),
    setActiveNoteSet: (id) => UILogic.setActiveMathNoteSet(set, id),

    addMathDot: (nsId, dot) => UILogic.addMathDot(set, nsId, dot),
    updateMathDot: (nsId, dotId, p) => UILogic.updateMathDot(set, nsId, dotId, p),
    removeMathDot: (nsId, dotId) => UILogic.removeMathDot(set, nsId, dotId),
    clearMathDots: (nsId) => UILogic.clearMathDots(set, nsId),

    addConsequentialScale: (config) => UILogic.addConsequentialScale(set, config),
    updateConsequentialScale: (id, partial) => UILogic.updateConsequentialScale(set, id, partial),
    removeConsequentialScale: (id) => UILogic.removeConsequentialScale(set, id),
    setActiveConsequentialScale: (id) => UILogic.setActiveConsequentialScale(set, id),
    updateConsequentialCache: (id, result) => UILogic.updateConsequentialCache(set, id, result),

    startEarSession: () => EarLogic.startEarSession(set, get),
    stopEarSession: () => EarLogic.stopEarSession(set, get),
    backToEarSettings: () => EarLogic.backToEarSettings(set, get),
    submitEarAnswer: (id) => EarLogic.submitEarAnswer(set, get, id),
    nextEarQuestion: () => EarLogic.nextEarQuestion(set, get),
    updateEarSettings: (p) => EarLogic.updateEarSettings(set, get, p),
    startReviewSession: (src) => EarLogic.startReviewSession(set, get, src),
    startPracticeSignature: (sig) => EarLogic.startPracticeSignature(set, get, sig),
    deleteReviewItem: (key) => EarLogic.deleteReviewItem(set, get, key),

    exportEarTrainingData: () => EarLogic.exportEarTrainingData(get),
    importEarTrainingData: (data, mode) => EarLogic.importEarTrainingData(set, get, data, mode),
    resetEarTrainingData: () => EarLogic.resetEarTrainingData(set, get),
    openEarTrainerFromAdvanced: () => set(s => ({ earTraining: { ...s.earTraining, isActive: true, phase: 'idle', currentQuestion: null, returnTo: 'advanced', ui: { panel: 'train' } } })),
    recordEarReplay: () => set(s => ({ earTraining: { ...s.earTraining, currentReplays: s.earTraining.currentReplays + 1 } })),
    finishEarSession: () => set(s => ({ earTraining: { ...s.earTraining, phase: 'summary' } })),
    setEarPanel: (panel) => set(s => ({ earTraining: { ...s.earTraining, ui: { ...s.earTraining.ui, panel } } })),

    setEarTrainingPersistedPart2: (part2) => EarLogic.setEarTrainingPersistedPart2(set, get, part2),

    completeSetup: (r, m, a, b, c, d, e, v) => Actions.handleCompleteSetup(set, get, r, m, a, b, c, d, e, v),
    updateSettings: (s) => SettingsLogic.updateSettings(set, s),
    commitDraftSettings: (s) => SettingsLogic.commitDraftSettings(set, get, s),
    updateVisualSettings: (v) => SettingsLogic.updateVisualSettings(set, v),
    undoSettings: () => SettingsLogic.undoSettings(set, get),
    redoSettings: () => SettingsLogic.redoSettings(set, get),
    toggleAxisLoop: (l) => SettingsLogic.toggleAxisLoop(set, l),
    toggleCommaSpreadingForAxis: (l) => SettingsLogic.toggleCommaSpreadingForAxis(set, get, l),
    regenerateLattice: (d, h) => Actions.handleRegenerateLattice(set, get, d, h),
    setCenter: (n) => SettingsLogic.setCenter(set, get, n),
    addSecondaryOrigin: (n) => SettingsLogic.addSecondaryOrigin(set, get, n),
    removeSecondaryOrigin: (id) => SettingsLogic.removeSecondaryOrigin(set, get, id),
    resetHarmonicCenter: () => SettingsLogic.resetHarmonicCenter(set, get),
    maskNode: (id) => SettingsLogic.maskNode(set, get, id),
    unmaskNode: (id) => SettingsLogic.unmaskNode(set, get, id),
    unmaskAllNodes: () => SettingsLogic.unmaskAllNodes(set, get),
    selectNode: (n, p, h, a) => Actions.handleSelectNode(set, get, n, p, h, a),
    triggerLocate: () => set(s => ({ focusSignal: s.focusSignal + 1 })),
    triggerCameraReset: () => set(s => ({ cameraResetSignal: s.cameraResetSignal + 1 })),
    undoSelection: () => Actions.undoSelection(set, get),
    redoSelection: () => Actions.redoSelection(set, get),
    selectNearbyNode: (n) => get().selectNode(n, true),
    addToKeyboard: (n) => KeyboardLogic.addToKeyboard(set, n),
    removeFromKeyboard: (id) => KeyboardLogic.removeFromKeyboard(set, id),
    shiftKeyboardOctave: (id, d) => KeyboardLogic.shiftKeyboardOctave(set, id, d),
    bindKey: (id, k) => KeyboardLogic.bindKey(set, id, k),
    onShortcutKey: (k) => Actions.handleShortcutKey(set, get, k),
    unbindKey: (id) => KeyboardLogic.unbindKey(set, id),
    setCustomKeyboard: (n) => KeyboardLogic.setCustomKeyboard(set, n),
    toggleKeyboard: (f) => KeyboardLogic.toggleKeyboard(set, f),
    toggleNodeInfo: (v) => KeyboardLogic.toggleNodeInfo(set, v),
    toggleGravity: () => set(s => ({ isGravityEnabled: !s.isGravityEnabled })),
    toggleIsolationMode: () => set(s => ({ isIsolationMode: !s.isIsolationMode })),
    toggleEducationMode: (f) => set(s => ({ isEducationMode: f !== undefined ? f : !s.isEducationMode })),
    setEducationLabelMode: (m) => set({ educationLabelMode: m }),
    addToComparison: (n, o) => KeyboardLogic.addToComparison(set, n, o),
    removeFromComparison: (id) => KeyboardLogic.removeFromComparison(set, id),
    shiftComparisonOctave: (id, d) => KeyboardLogic.shiftComparisonOctave(set, id, d),
    clearComparison: () => KeyboardLogic.clearComparison(set),
    clearComparisonNodesOnly: () => KeyboardLogic.clearComparisonNodesOnly(set),
    toggleComparisonTray: () => KeyboardLogic.toggleComparisonTray(set),

    addComparisonGroup: (name, nodes) => KeyboardLogic.addComparisonGroup(set, name, nodes),
    updateComparisonGroup: (id, partial) => KeyboardLogic.updateComparisonGroup(set, id, partial),
    deleteComparisonGroup: (id) => KeyboardLogic.deleteComparisonGroup(set, id),
    toggleComparisonGroupVisibility: (id) => KeyboardLogic.toggleComparisonGroupVisibility(set, id),
    clearComparisonGroups: () => KeyboardLogic.clearComparisonGroups(set),

    saveChordGroupCollection: (name) => KeyboardLogic.saveChordGroupCollection(set, name),
    deleteChordGroupCollection: (id) => KeyboardLogic.deleteChordGroupCollection(set, id),
    loadChordGroupCollection: (c) => KeyboardLogic.loadChordGroupCollection(set, c),
    saveChord: (n, ns, d) => KeyboardLogic.saveChord(set, n, ns, d),
    deleteChord: (id) => KeyboardLogic.deleteChord(set, id),
    loadChord: (c) => KeyboardLogic.loadChord(set, c),
    saveKeyboard: (n, ns, b) => KeyboardLogic.saveKeyboard(set, n, ns, b),
    deleteKeyboard: (id) => KeyboardLogic.deleteKeyboard(set, id),
    loadKeyboard: (k) => KeyboardLogic.loadKeyboard(set, k),
    clearKeyboard: () => KeyboardLogic.clearKeyboard(set),
    duplicateKeyboardWithFactor: (factorNum: bigint, factorDen: bigint) => KeyboardLogic.duplicateKeyboardWithFactor(set, factorNum, factorDen),
    saveCustomComma: (c) => KeyboardLogic.saveCustomComma(set, c),
    renameCustomComma: (id, name) => KeyboardLogic.renameCustomComma(set, id, name),
    deleteCustomComma: (name: string) => KeyboardLogic.deleteCustomComma(set, name),
    deleteCustomCommaById: (id: string) => KeyboardLogic.deleteCustomCommaById(set, id),
    saveMidiScale: (n, s) => KeyboardLogic.saveMidiScale(set, n, s),
    deleteMidiScale: (id) => KeyboardLogic.deleteMidiScale(set, id),
    loadMidiScale: (s) => KeyboardLogic.loadMidiScale(set, s),
    setNavAxisHorizontal: (l) => set({ navAxisHorizontal: l }),
    setNavAxisVertical: (l) => set({ navAxisVertical: l }),
    setNavAxisDepth: (l) => set({ navAxisDepth: l }),
    setActiveNavigationLimit: (l) => set({ activeNavigationLimit: l }),
    navigateSelection: (d) => Actions.handleNavigateSelection(set, get, d),
    setNodeTexture: (id, u) => KeyboardLogic.setNodeTexture(set, id, u),
    setNodeTextureRotation: (id, r) => KeyboardLogic.setNodeTextureRotation(set, id, r),
    setNodeSurfaceLabelOverride: (id, partial) => KeyboardLogic.setNodeSurfaceLabelOverride(set, id, partial),
    clearNodeSurfaceLabelOverride: (id) => KeyboardLogic.clearNodeSurfaceLabelOverride(set, id),
    setNodeNameOverride: (id, partial) => set(s => ({
        nodeNameOverrides: {
            ...s.nodeNameOverrides,
            [id]: { ...(s.nodeNameOverrides[id] || {}), ...partial }
        }
    })),
    clearUserContent: () => set({ customKeyboard: [], keyBindings: {}, savedChords: [], savedKeyboards: [], savedCommas: [], savedMidiScales: [] }),
    resetLatticeConfig: () => SettingsLogic.resetLatticeConfig(set, get),
    saveSession: () => SessionLogic.saveSession(get),
    loadSession: (f) => SessionLogic.loadSession(set, get, f),
    loadFileToNewLattice: (f) => SessionLogic.loadFileToNewLattice(set, get, f),
    loadCurrentLattice: () => SessionLogic.loadSession(set, get, new Blob([JSON.stringify(get().latticeSlotCurrent)], { type: 'application/json' }) as File),
    loadNewLattice: () => SessionLogic.loadSession(set, get, new Blob([JSON.stringify(get().latticeSlotNew)], { type: 'application/json' }) as File),
    setRecording: (status: boolean) => set({ isRecording: status }),
    stopAllAudioActivity: () => {
        const previewStop = get().midiRetuner.previewStop;
        if (previewStop) {
            try {
                previewStop();
            } catch (e) {
                log.warn('Preview stop failed', e);
            }
        }
        try {
            panicAudioPlayback();
        } catch (e) {
            log.warn('Audio playback panic failed', e);
        }
        try {
            panicTimbreEngine();
        } catch (e) {
            log.warn('Timbre panic failed', e);
        }
        try {
            panicMidiOut();
        } catch (e) {
            log.warn('MIDI panic failed', e);
        }
        stopRecording().catch((e) => log.warn('Recording stop failed', e));
        set((state) => ({
            isRecording: false,
            playingNodeIds: new Map(),
            playingRatios: new Map(),
            midiRetuner: {
                ...state.midiRetuner,
                previewIsPlaying: false,
                retunePreviewActive: false,
            },
        }));
    },
    setDisableWasdInKeyboard: (disabled: boolean) => set({ disableWasdInKeyboard: disabled }),
    setKeyboardLayout: (layout: 'custom' | 'standard') => set({ keyboardLayout: layout }),
    setKeyboardHoldNotes: (enabled: boolean) => set({ keyboardHoldNotes: enabled }),
    uploadCustomSample: (n, f) => SessionLogic.uploadCustomSample(set, n, f),

    resetSettings: () => SettingsLogic.resetSettings(set, get),
    nuclearReset: () => { resetPersistedState(); window.location.reload(); },
    setCommaLines: (lines: { sourceId: string; targetId: string; name: string }[]) => set({ commaLines: lines }),
    setPendingTemperingConstraints: (constraints) => set({ pending_tempering_constraints: constraints }),
    setTemperingStrategy: (strategy) => set({ tempering_strategy: strategy }),
    setTemperingModel: (model) => set({ tempering_model: model }),
    setTemperingResult: (result) => set({ tempering_result: result }),
    resetTemperingTutorial: () => set({
        pending_tempering_constraints: [],
        tempering_strategy: null,
        tempering_model: null,
        tempering_result: null
    }),
    setModifierKeys: (keys: Partial<{ z: boolean; a: boolean; x: boolean; tab: boolean }>) => set(s => ({ modifierKeys: { ...s.modifierKeys, ...keys } })),
    toggleSimpleMode: () => SettingsLogic.toggleSimpleMode(set, get),
    setSimpleModeStage: (stage: SimpleModeStage) => set({ simpleModeStage: stage }),
    toggleSimpleLabelMode: () => Actions.toggleSimpleLabelMode(set, get),
    togglePureUIMode: () => set(s => ({ isPureUIMode: !s.isPureUIMode })),
    setPureUIMode: (enabled: boolean) => set({ isPureUIMode: enabled }),

    toggleSettings: (visible?: boolean) => set(s => {
        const next = visible !== undefined ? visible : !s.isSettingsOpen;
        const newPanels = { ...s.panels, settings: { ...s.panels.settings, isOpen: next } };

        let newZ = s.topZIndex;
        if (next) {
            newZ = s.topZIndex + 1;
            newPanels.settings.zIndex = newZ;
        }

        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { isSettingsOpen: next, panels: newPanels, topZIndex: newZ };
    }),
    setNamingSetupOpen: (open: boolean) => set({ namingSetupOpen: open }),

    exitToSetup: (target: 'landing' | 'advanced' = 'landing') => set((state) => {
        if (target === 'landing') {
            clearSessionFlags();
        }

        const newPanels = {
            ...state.panels,
            settings: { ...state.panels.settings, isOpen: false },
            keyboard: { ...state.panels.keyboard, isOpen: false },
            info: { ...state.panels.info, isOpen: false },
            comparison: { ...state.panels.comparison, isOpen: false },
            progression: { ...state.panels.progression, isOpen: false },
            mathlab: { ...state.panels.mathlab, isOpen: false },
            workspace: { ...state.panels.workspace, isOpen: false },
            theory: { ...state.panels.theory, isOpen: false },
            score: { ...state.panels.score, isOpen: false }
        };

        try {
            localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        } catch (e) {
            log.warn('Failed to persist panel layout', e);
        }

        const nextLandingMode = target === 'advanced' ? 'advanced' : 'none';

        const nextSettings = target === 'advanced'
            ? { ...(state.savedAdvancedSettings ?? state.settings), isSimpleMode: false }
            : state.settings;

        return {
            ...state,
            settings: nextSettings,
            landingMode: nextLandingMode,
            isSetupComplete: false,
            isSettingsOpen: false,
            isKeyboardVisible: false,
            isNodeInfoVisible: false,
            ...TRANSIENT_OVERLAY_RESET,
            selectedNode: null,
            referenceNode: null,
            error: null,
            selectionHistory: [],
            historyIndex: -1,
            panels: newPanels
        };
    }),

    toggleProgressionPanel: () => UILogic.toggleProgressionPanel(set),
    progressionAddStep: (chordId: string) => UILogic.progressionAddStep(set, chordId),
    progressionAddRestStep: () => UILogic.progressionAddRestStep(set),
    progressionRemoveStep: (index: number) => UILogic.progressionRemoveStep(set, index),
    progressionMoveStep: (from: number, to: number) => UILogic.progressionMoveStep(set, from, to),
    progressionDuplicateStep: (index: number) => UILogic.progressionDuplicateStep(set, index),
    progressionUpdateStep: (index: number, partial: Partial<ProgressionStep>) => UILogic.progressionUpdateStep(set, index, partial),
    progressionSetBpm: (bpm: number) => set({ progressionBpm: bpm }),
    progressionTogglePlay: () => {
        const next = !get().progressionIsPlaying;

        if (next && get().progressionSteps.length === 0) {
            set({ progressionIsPlaying: false, progressionCurrentStep: 0 });
            return;
        }

        set({ progressionIsPlaying: next });

        const seq = getSequencer(() => get());
        if (next) seq.start(true);
        else seq.pause();
    },
    progressionStop: () => {
        set({ progressionIsPlaying: false, progressionCurrentStep: 0 });
        const seq = getSequencer(() => get());
        seq.stop();
    },
    progressionClearSteps: () => {
        set({ progressionSteps: [], progressionCurrentStep: 0, progressionIsPlaying: false });
        const seq = getSequencer(() => get());
        seq.stop();
    },
    progressionSetCurrentStep: (index: number) => set({ progressionCurrentStep: index }),
    clearAdvancedSession: () => Actions.clearAdvancedSession(set),
    setPanelState: (id, partial) => UILogic.setPanelState(set, id, partial),
    focusPanel: (id) => UILogic.focusPanel(set, id),
    resetPanelLayout: () => UILogic.resetPanelLayout(set),

    setMidiRetunerState: (partial: any) => set(s => ({ midiRetuner: { ...s.midiRetuner, ...partial } })),
    setPureScoreOverlay: (partial: any) => set(s => ({ pureScoreOverlay: { ...s.pureScoreOverlay, ...partial } })),
    setAuthState: (partial: any) => set(s => {
        const next = { ...s.auth, ...partial };
        saveAuthState(next);
        return { auth: next };
    }),
    clearAuthState: () => set(s => {
        clearAuthState();
        const next = { ...DEFAULT_AUTH_STATE, lastEmail: s.auth.lastEmail || '' };
        return { auth: next };
    }),
    setAuthUi: (partial: any) => set(s => ({ authUi: { ...s.authUi, ...partial } })),
    applyWorkspaceTemplate: (template: WorkspaceTemplateId) => set((state) => {
        const { layout, nextId } = buildWorkspaceTemplate(template, 1);
        return {
            workspace: {
                ...state.workspace,
                layout,
                nextPaneId: nextId
            }
        };
    }),
    setWorkspaceLayout: (layout) => set((state) => ({
        workspace: { ...state.workspace, layout }
    })),
    setWorkspacePaneView: (paneId, viewType: WorkspaceViewType) => set((state) => ({
        workspace: {
            ...state.workspace,
            layout: updatePaneNode(state.workspace.layout, paneId, (pane) => ({ ...pane, viewType }))
        }
    })),
    setWorkspacePaneState: (paneId, partial) => set((state) => ({
        workspace: {
            ...state.workspace,
            layout: updatePaneNode(state.workspace.layout, paneId, (pane) => ({
                ...pane,
                viewState: { ...(pane.viewState || {}), ...partial }
            }))
        }
    })),
    splitWorkspacePane: (paneId, direction: WorkspaceSplitDirection, placement: 'before' | 'after' = 'after') => set((state) => {
        const nextPaneId = `pane-${state.workspace.nextPaneId}`;
        const nextPane = createPaneNode(nextPaneId, 'empty');
        const layout = splitPaneNode(state.workspace.layout, paneId, direction, nextPane, 0.5, placement === 'before');
        return {
            workspace: {
                ...state.workspace,
                layout,
                nextPaneId: state.workspace.nextPaneId + 1
            }
        };
    }),
    closeWorkspacePane: (paneId) => set((state) => {
        const layout = state.workspace.layout;
        if (layout.type === 'pane' && layout.paneId === paneId) {
            return {
                workspace: {
                    ...state.workspace,
                    layout: { ...layout, viewType: 'empty', viewState: {} }
                }
            };
        }
        const nextLayout = removePaneNode(layout, paneId);
        if (!nextLayout) return {};
        return {
            workspace: {
                ...state.workspace,
                layout: nextLayout
            }
        };
    }),
    setWorkspaceTransport: (partial) => set((state) => ({
        workspace: {
            ...state.workspace,
            transport: {
                ...state.workspace.transport,
                ...partial,
                position: { ...state.workspace.transport.position, ...(partial.position || {}) }
            }
        }
    })),
    setWorkspaceSelection: (partial) => set((state) => ({
        workspace: {
            ...state.workspace,
            selection: { ...state.workspace.selection, ...partial }
        }
    })),
    setWorkspaceSync: (partial) => set((state) => ({
        workspace: {
            ...state.workspace,
            sync: { ...state.workspace.sync, ...partial }
        }
    })),
    setWorkspaceFilters: (partial) => set((state) => ({
        workspace: {
            ...state.workspace,
            filters: { ...state.workspace.filters, ...partial }
        }
    })),
    setWorkspaceQuality: (mode) => set((state) => ({
        workspace: {
            ...state.workspace,
            quality: { mode }
        }
    })),
    toggleWorkspaceDebug: () => set((state) => ({
        workspace: {
            ...state.workspace,
            debug: { ...state.workspace.debug, enabled: !state.workspace.debug.enabled }
        }
    })),
    saveWorkspacePreset: (name: string) => set((state) => {
        const trimmed = name.trim();
        if (!trimmed) return {};
        const preset: WorkspacePreset = {
            id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: trimmed,
            version: state.workspace.schemaVersion,
            createdAt: Date.now(),
            layout: state.workspace.layout,
            transport: state.workspace.transport,
            sync: state.workspace.sync,
            filters: state.workspace.filters,
            quality: state.workspace.quality
        };
        const presets = [...state.workspace.presets.filter(p => p.name !== trimmed), preset];
        saveWorkspacePresets(presets);
        return {
            workspace: {
                ...state.workspace,
                presets
            }
        };
    }),
    loadWorkspacePreset: (presetId: string) => set((state) => {
        const preset = state.workspace.presets.find(p => p.id === presetId);
        if (!preset) return {};
        const paneIds = getPaneIds(preset.layout);
        const numericIds = paneIds
            .map(id => Number(id.replace(/^\D+/g, '')))
            .filter(n => Number.isFinite(n) && n > 0) as number[];
        const nextPaneId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : state.workspace.nextPaneId;
        return {
            workspace: {
                ...state.workspace,
                layout: preset.layout,
                transport: preset.transport,
                sync: preset.sync,
                filters: preset.filters,
                quality: preset.quality,
                nextPaneId
            }
        };
    }),
    deleteWorkspacePreset: (presetId: string) => set((state) => {
        const presets = state.workspace.presets.filter(p => p.id !== presetId);
        saveWorkspacePresets(presets);
        return {
            workspace: {
                ...state.workspace,
                presets
            }
        };
    }),

    setPlayingNodeStates: (states: Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>) => {
        // Shallow compare to avoid unnecessary re-renders
        const current = get().playingNodeIds;
        if (current.size === states.size) {
            let same = true;
            for (const [key, value] of states) {
                const existing = current.get(key);
                if (!existing || existing.velocity !== value.velocity ||
                    existing.channels.length !== value.channels.length ||
                    !existing.channels.every((ch, i) => ch === value.channels[i])) {
                    same = false;
                    break;
                }
                // Check tracks
                const existingTracks = existing.tracks || [];
                const newTracks = value.tracks || [];
                if (existingTracks.length !== newTracks.length || !existingTracks.every((tr, i) => tr === newTracks[i])) {
                    same = false;
                    break;
                }
                const existingParts = existing.parts || [];
                const newParts = value.parts || [];
                if (existingParts.length !== newParts.length || !existingParts.every((pt, i) => pt === newParts[i])) {
                    same = false;
                    break;
                }
            }
            if (same) return; // Skip update if no changes
        }
        set({ playingNodeIds: states });
    },
    setPlayingRatios: (ratios: Map<string, {
        ratio: string;
        velocity: number;
        channel?: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTime?: number;
        endTime?: number;
    }>) => {
        // Shallow compare to avoid unnecessary re-renders
        const current = get().playingRatios;
        if (current.size === ratios.size) {
            let same = true;
            for (const [key, value] of ratios) {
                const existing = current.get(key);
                if (!existing || existing.ratio !== value.ratio || existing.velocity !== value.velocity ||
                    existing.channel !== value.channel || existing.trackIndex !== value.trackIndex || existing.nodeId !== value.nodeId) {
                    same = false;
                    break;
                }
            }
            if (same) return; // Skip update if no changes
        }
        set((state) => {
            const nextRatioStats = new Map(state.ratioStats);
            for (const [key, value] of ratios) {
                const prev = current.get(key);
                if (!prev || prev.ratio !== value.ratio) {
                    const count = nextRatioStats.get(value.ratio) || 0;
                    nextRatioStats.set(value.ratio, count + 1);
                }
            }
            const chordRatio = computeChordRatioFromRatios(Array.from(ratios.values()).map(v => v.ratio));
            let nextChordStats = state.chordStats;
            if (chordRatio && chordRatio !== state.lastChordRatio) {
                nextChordStats = new Map(state.chordStats);
                nextChordStats.set(chordRatio, (nextChordStats.get(chordRatio) || 0) + 1);
            }
            return {
                playingRatios: ratios,
                ratioStats: nextRatioStats,
                chordStats: nextChordStats,
                lastChordRatio: chordRatio || null
            };
        });
    },
    setRetuneSnapDelay: (ms: number) => set({ retuneSnapDelayMs: ms }),
    setShowRetuneRatios: (show: boolean) => set({ showRetuneRatios: show }),
    incrementRatioStats: (ratio) => set((state) => {
        const newMap = new Map(state.ratioStats);
        const current = newMap.get(ratio) || 0;
        newMap.set(ratio, current + 1);
        return { ratioStats: newMap };
    }),
    resetRatioStats: () => set({ ratioStats: new Map(), chordStats: new Map(), lastChordRatio: null }),
    setShowRatioStats: (show) => set({ showRatioStats: show }),
    pushNotification: (notification) => set((state) => {
        const id = notification.id ?? `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const next = { ...notification, id };
        return { notifications: [...state.notifications, next] };
    }),
    dismissNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id)
    })),
    openConfirmDialog: (dialog) => set(() => ({
        activeDialog: {
            ...dialog,
            id: `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'confirm',
        },
    })),
    openPromptDialog: (dialog) => set(() => ({
        activeDialog: {
            ...dialog,
            id: `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'prompt',
        },
    })),
    closeDialog: () => set({ activeDialog: null }),
    ackStorageRecovery: () => set({ storageRecovery: null }),
}));


// Enable retuner group sync (browser tabs + native multi-instance relay).
try {
    setupRetunerGroupSync(useStore);
} catch (e) {
    log.warn('Failed to initialize retuner group sync', e);
}
