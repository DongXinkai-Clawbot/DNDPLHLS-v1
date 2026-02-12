import type { AppSettings, TimbreModSource, TimbreModTarget } from '../types';
import { clamp } from './utils';
import { TIMBRE_PARAM_REGISTRY } from './paramRegistry';

export type TimbreContext = 'click' | 'keyboard' | 'sequence' | 'chord' | 'math' | 'ear';

export type TimbreVoiceExpression = Partial<{
  modWheel: number;
  aftertouch: number;
  mpePressure: number;
  mpeTimbre: number;
  cc7: number;
  cc74: number;
  pitchBend: number;
}>;

export type VoiceHandle = {
  id: string;
  noteKey: string;
  stop: (releaseOverrideMs?: number) => void;
  startedAt: number;
  baseGain: number;
  env: { attackMs: number; decayMs: number; sustain: number; releaseMs: number };
  releaseAt?: number;
  releaseLevel?: number;
  stealPending?: boolean;
  expression?: Partial<Record<keyof TimbreVoiceExpression, ConstantSourceNode>>;
};

export const ACTIVE_VOICES: VoiceHandle[] = [];
export const LAST_FREQ_BY_CONTEXT: Record<string, number> = {};
export const LAST_NOTE_ON_BY_CONTEXT: Record<string, { note: number; time: number } | undefined> = {};
let VOICE_COUNTER = 0;
export const GLOBAL_LFO_CACHE = new WeakMap<AudioContext, Map<string, {
  output: AudioNode;
  source: AudioScheduledSourceNode;
  rateHz: number;
  settingsKey: string;
  nodes: AudioNode[];
}>>();
let lastError: string | null = null;
let limiterClipCount = 0;
export const globalMods = { modWheel: 0, aftertouch: 0, mpePressure: 0, mpeTimbre: 0, cc7: 0, cc74: 0, pitchBend: 0.5 };
export const EXPRESSION_SOURCES = new Set<TimbreModSource>([
  'modWheel',
  'aftertouch',
  'mpePressure',
  'mpeTimbre',
  'cc7',
  'cc74',
  'pitchBend'
]);
export const AUDIO_PARAM_TARGETS = new Set<TimbreModTarget>(
  TIMBRE_PARAM_REGISTRY.filter(param => param.binding === 'audioParam').map(param => param.id)
);

export const setError = (message: string) => {
  lastError = message;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('timbre-engine-error', { detail: message }));
  }
};

export const reportTimbreEngineError = (message: string) => {
  setError(message);
};

export const clearTimbreEngineError = () => {
  lastError = null;
};

export const getTimbreEngineError = () => lastError;
export const getLimiterClipCounter = () => limiterClipCount;
export const resetLimiterClipCounter = () => { limiterClipCount = 0; };

export const updateTimbreModState = (partial: Partial<typeof globalMods>) => {
  globalMods.modWheel = clamp(partial.modWheel ?? globalMods.modWheel, 0, 1);
  globalMods.aftertouch = clamp(partial.aftertouch ?? globalMods.aftertouch, 0, 1);
  globalMods.mpePressure = clamp(partial.mpePressure ?? globalMods.mpePressure, 0, 1);
  globalMods.mpeTimbre = clamp(partial.mpeTimbre ?? globalMods.mpeTimbre, 0, 1);
  globalMods.cc7 = clamp(partial.cc7 ?? globalMods.cc7, 0, 1);
  globalMods.cc74 = clamp(partial.cc74 ?? globalMods.cc74, 0, 1);
  globalMods.pitchBend = clamp(partial.pitchBend ?? globalMods.pitchBend, 0, 1);
};

export const updateTimbreVoiceExpression = (noteKey: string, partial: TimbreVoiceExpression) => {
  if (!noteKey) return;
  ACTIVE_VOICES.forEach((voice) => {
    if (voice.noteKey !== noteKey || !voice.expression) return;
    (Object.keys(partial) as (keyof TimbreVoiceExpression)[]).forEach((key) => {
      const node = voice.expression?.[key];
      const value = partial[key];
      if (!node || value === undefined) return;
      try {
        node.offset.cancelScheduledValues(node.context.currentTime);
        node.offset.setTargetAtTime(clamp(value, 0, 1), node.context.currentTime, 0.01);
      } catch { }
    });
  });
};

export const resolveTimbrePatch = (settings: AppSettings, context: TimbreContext, noteKey?: string) => {
  const timbre = settings.timbre;
  if (!timbre || timbre.patches.length === 0) return null;
  const patches = timbre.patches;
  const fallback = patches.find(p => p.id === timbre.activePatchId) || patches[0];
  let selected = timbre.mapping.globalEnabled ? fallback : null;
  if (timbre.mapping.byContext) {
    const ctxKey = (context === 'chord' || context === 'sequence') ? 'sequence' : (context === 'keyboard' ? 'keyboard' : 'click');
    const ctxId = timbre.mapping.contextMap[ctxKey];
    const ctxPatch = patches.find(p => p.id === ctxId);
    if (ctxPatch) selected = ctxPatch;
  }
  if (timbre.mapping.byNoteLabel && noteKey) {
    const mappedId = timbre.mapping.noteKeyMap[noteKey];
    const mappedPatch = patches.find(p => p.id === mappedId);
    if (mappedPatch) selected = mappedPatch;
  }
  return selected ?? (timbre.mapping.globalEnabled ? fallback : null);
};

export const panicTimbreEngine = () => {
  ACTIVE_VOICES.splice(0).forEach(v => v.stop());
};

export const getActiveTimbreVoiceCount = () => ACTIVE_VOICES.length;

export const getNextVoiceSerial = () => {
  VOICE_COUNTER += 1;
  return VOICE_COUNTER;
};

export const registerActiveVoice = (voice: VoiceHandle) => {
  ACTIVE_VOICES.push(voice);
};

export const removeActiveVoice = (voiceId: string) => {
  const idx = ACTIVE_VOICES.findIndex(v => v.id === voiceId);
  if (idx >= 0) ACTIVE_VOICES.splice(idx, 1);
};

export const incrementLimiterClipCounter = () => {
  limiterClipCount += 1;
};
