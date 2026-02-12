
import type { PanelId, PanelState, EarTrainingSettings, EarTrainingPersistedV1 } from '../../types';

export const AUTO_BIND_KEYS = "1234567890qwertyuiopasdfghjklzxcvbnm".split("");

export const derivedCommaId = (c: any) => {
  if (!c || c.n === undefined || c.d === undefined) return "unknown";
  return `${c.n.toString()}/${c.d.toString()}`;
};

const safeWindow = typeof window === 'undefined'
  ? { innerWidth: 1024, innerHeight: 768 }
  : window;

const viewW = safeWindow.innerWidth;
const viewH = safeWindow.innerHeight;
const scoreX = Math.max(20, viewW - 420);
const scoreY = Math.max(80, Math.round(viewH * 0.12));
const workspaceW = Math.min(1100, Math.max(680, viewW - 160));
const workspaceH = Math.min(760, Math.max(420, viewH - 160));
const workspaceX = Math.max(20, Math.round((viewW - workspaceW) / 2));
const workspaceY = Math.max(60, Math.round((viewH - workspaceH) / 2));

export const INITIAL_PANELS: Record<PanelId, PanelState> = {
    settings: { id: 'settings', title: 'CONFIG', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 20, y: 80, width: 340, height: 600, zIndex: 10 },
    info: { id: 'info', title: 'DETAILS', isOpen: false, isCollapsed: true, isPinned: false, mode: 'dock-bottom', x: 0, y: 0, width: 400, height: 300, zIndex: 5 },
    keyboard: { id: 'keyboard', title: 'KEYBOARD', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 20, y: viewH - 200, width: 500, height: 160, zIndex: 8 },
    comparison: { id: 'comparison', title: 'COMPARISON', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: viewW / 2 - 170, y: viewH - 250, width: 340, height: 200, zIndex: 9 },
    progression: { id: 'progression', title: 'SEQUENCER', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 60, y: 120, width: 300, height: 400, zIndex: 7 },
    score: { id: 'score', title: 'SCORE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: scoreX, y: scoreY, width: 360, height: 520, zIndex: 13 },
    workspace: { id: 'workspace', title: 'WORKSPACE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: workspaceX, y: workspaceY, width: workspaceW, height: workspaceH, zIndex: 14 },
    theory: { id: 'theory', title: 'THEORY GUIDE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'fullscreen', x: 0, y: 0, width: viewW, height: viewH, zIndex: 20 },
    mathlab: { id: 'mathlab', title: 'MATH LAB', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 50, y: 50, width: 900, height: 600, zIndex: 12 },
    'midi-device': { id: 'midi-device', title: 'MIDI DEVICE', isOpen: false, isCollapsed: false, isPinned: false, mode: 'float', x: 80, y: 100, width: 380, height: 500, zIndex: 11 }
};

export const DEFAULT_EAR_SETTINGS: EarTrainingSettings = {
    difficulty: 'auto',
    tasks: ['interval', 'compare', 'chord', 'drift', 'melody', 'duo_melody', 'progression'],
    sessionLength: 10,
    taskWeights: {
        interval: 20,
        compare: 15,
        chord: 20,
        drift: 10,
        melody: 15,
        duo_melody: 10,
        progression: 10
    },
    playback: {
        intervalMode: 'sequence',
        noteMs: 800,
        gapMs: 1000,
        chordMs: 2000
    },
    pitch: {
        baseFreqMode: 'fixed',
        fixedBaseFreq: 440,
        randomMin: 220,
        randomMax: 660
    },
    timbre: {
        clickInstrument: 'triangle',
        chordInstrument: 'organ'
    },
    pro: {
        seedMode: 'random',
        lockedSeed: 'EAR-V2',
        optionCount: 4,
        answerMode: 'auto',
        selectionMode: 'random',
        avoidRepeatCount: 2,
        poolLimit: 0,
        shuffleOptions: true,
        allowReplay: true,
        maxReplays: 12,
        memoryDelayMs: 0,
        sequence: {
            melodyLength: 5,
            progressionLength: 3,
            rhythmMode: 'fixed',
            rhythmValues: ['1/2', '1', '3/2', '2'],
            metronomeEnabled: true,
            melodyScale: { useScale: false, activeScaleId: 'ji_major', scalePool: [] },
            duoScale: { useScale: false, activeScaleId: 'ji_major', scalePool: [] },
            duoAllowRest: false
        },
        referenceTone: { mode: 'none', ratios: ['1/1'] },
        registerDrift: { enabled: false, maxCents: 600, perQuestionCents: 30 },
        tuning: { mode: 'JI', edoDivisions: 12, temperamentMorph: 0 },
        chord: { answerFormat: 'quality', inversionMode: 'root' },
        content: {
            interval: { enabled: false, items: [] },
            chord: { enabled: false, items: [] },
            compare: { enabled: false, items: [] },
            drift: { enabled: false, items: [] },
            melody: {
                enabled: false,
                items: []
            },
            duo_melody: {
                enabled: false,
                items: []
            },
            progression: {
                enabled: false,
                items: [
                    '1/1,5/4,3/2 ; 1/1,6/5,3/2 ; 1/1,4/3,3/2'
                ]
            }
        },
        adaptive: { enabled: true, targetAccuracy: 0.75, stepUp: 0.15, stepDown: 0.25 }
    }
};

export const DEFAULT_PERSISTED_EAR: EarTrainingPersistedV1 = {
    v: 1,
    updatedAt: Date.now(),
    settings: DEFAULT_EAR_SETTINGS,
    attempts: [],
    reviewItems: [],
    sessions: [],
    part2: {
        v: 1,
        settings: {
            enabled: true,
            shareAnonymizedJnd: true,
            jnd: {
                baseHz: 440,
                mode: 'interval',
                startGapCents: 100,
                minGapCents: 0.1,
                maxGapCents: 300,
                stepDown: 0.85,
                stepUp: 1.15,
                confirmRepeats: 2,
                optionsCount: 3,
                waveform: 'sine',
                toneMs: 260,
                gapMs: 60,
                randomBase: false,
                baseHzMin: 220,
                baseHzMax: 880,
                randomGap: false
            },
            intervalZone: { baseHz: 440, intervalCents: 700, rangeCents: 50, waveform: 'sine' },
            continuousPitch: { targetHz: 440, centsRange: 100 }
        },
        jndSamples: [],
        intervalZoneSamples: [],
        continuousPitchSamples: [],
        evaluation: []
    }
};
