import type { AppSettings, TimbreCurve, TimbreModRoute, TimbreModSource } from '../types';
import { applyCurve, clamp } from './utils';
import type { VoiceHandle } from './engineState';

export const estimateVoiceLevel = (voice: VoiceHandle, now: number) => {
  const env = voice.env;
  const t = Math.max(0, now - voice.startedAt);
  const a = Math.max(0.001, env.attackMs / 1000);
  const d = Math.max(0.001, env.decayMs / 1000);
  const s = clamp(env.sustain, 0, 1);
  let level = s;

  if (voice.releaseAt !== undefined) {
    const tr = Math.max(0, now - voice.releaseAt);
    const r = Math.max(0.001, env.releaseMs / 1000);
    const startLevel = Number.isFinite(voice.releaseLevel) ? (voice.releaseLevel as number) : s;
    level = startLevel * Math.exp(-tr / Math.max(0.001, r / 3));
  } else if (t < a) {
    level = t / a;
  } else if (t < a + d) {
    const decayPos = (t - a) / d;
    level = 1 - (1 - s) * decayPos;
  } else {
    level = s;
  }
  return clamp(level * voice.baseGain, 0, 1);
};

export const pickVoiceToSteal = (
  voices: VoiceHandle[],
  strategy: 'oldest' | 'quietest' | 'release-first',
  now: number
) => {
  let best: VoiceHandle | null = null;
  let bestScore = -Infinity;
  voices.forEach((voice) => {
    if (voice.stealPending) return;
    const age = now - voice.startedAt;
    const isReleased = voice.releaseAt !== undefined;
    const level = estimateVoiceLevel(voice, now);
    let score = 0;
    if (strategy === 'oldest') {
      score = age;
    } else if (strategy === 'quietest') {
      score = (1 - level) * 1000 + age * 0.001;
    } else {
      score = (isReleased ? 1000 : 0) + (1 - level) * 500 + age * 0.001;
    }
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  });
  return best;
};

export const resolveTempoBpm = (settings: AppSettings) => {
  const anySettings = settings as any;
  const bpm = anySettings.progressionBpm
    ?? anySettings.playback?.bpm
    ?? anySettings.mathLab?.playback?.bpm
    ?? anySettings.mathLab?.bpm
    ?? 120;
  return clamp(Number.isFinite(bpm) ? bpm : 120, 20, 300);
};

export const divisionToHz = (bpm: number, division?: string) => {
  if (!division) return bpm / 60;
  const parts = division.split('/');
  const denom = Number.parseFloat(parts[1] || '4');
  if (!Number.isFinite(denom) || denom <= 0) return bpm / 60;
  return (bpm / 60) * (denom / 4);
};

export const divisionToSeconds = (bpm: number, division?: string) => {
  const hz = divisionToHz(bpm, division);
  return hz > 0 ? 1 / hz : 0.5;
};

export const isBipolarSource = (source: TimbreModSource) => (
  source === 'lfo1' || source === 'lfo2' || source === 'lfo3' || source === 'lfo4'
  || source === 'randomHold' || source === 'randomSmooth'
);

export const buildUnipolarCurve = (curve: TimbreCurve | undefined, opts: { pow?: number; steps?: number } = {}) => {
  const samples = 1024;
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const u = clamp(x, 0, 1);
    arr[i] = applyCurve(u, curve ?? 'linear', opts);
  }
  return arr;
};

export const buildBipolarCurve = (curve: TimbreCurve | undefined, opts: { pow?: number; steps?: number } = {}) => {
  const samples = 1024;
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const u = (x + 1) / 2;
    const shaped = applyCurve(u, curve ?? 'linear', opts);
    arr[i] = shaped * 2 - 1;
  }
  return arr;
};

export const buildRouteCurve = (route: TimbreModRoute, inputBipolar: boolean, targetScale = 1) => {
  const samples = 1024;
  const arr = new Float32Array(samples);
  const deadzone = clamp(route.deadzone ?? 0, 0, 0.99);
  const curve = route.curve ?? 'linear';
  const curveOpts = { pow: route.curveAmount, steps: route.curveSteps };
  const outBipolar = route.bipolar ?? inputBipolar;
  const scale = (route.scale ?? 1) * route.depth * targetScale;
  const offset = route.offset ?? 0;
  const clampMin = route.clampMin;
  const clampMax = route.clampMax;

  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    let val = x;

    if (inputBipolar) {
      let mag = Math.abs(val);
      if (deadzone > 0) {
        if (mag < deadzone) mag = 0;
        else mag = (mag - deadzone) / (1 - deadzone);
      }
      val = Math.sign(val) * mag;
      if (route.invert) val = -val;
      const u = applyCurve((val + 1) / 2, curve, curveOpts);
      val = outBipolar ? (u * 2 - 1) : u;
    } else {
      let u = clamp(val, 0, 1);
      if (deadzone > 0) {
        if (u < deadzone) u = 0;
        else u = (u - deadzone) / (1 - deadzone);
      }
      if (route.invert) u = 1 - u;
      u = applyCurve(u, curve, curveOpts);
      val = outBipolar ? (u * 2 - 1) : u;
    }

    let out = val * scale + offset;
    if (clampMin !== undefined) out = Math.max(out, clampMin);
    if (clampMax !== undefined) out = Math.min(out, clampMax);
    arr[i] = out;
  }
  return arr;
};

export const ABS_CURVE = (() => {
  const samples = 1024;
  const arr = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    arr[i] = Math.abs(x);
  }
  return arr;
})();

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, DB: 1,
  D: 2, 'D#': 3, EB: 3,
  E: 4,
  F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8,
  A: 9, 'A#': 10, BB: 10,
  B: 11
};

export const parseRootKeyToHz = (rootKey?: string, fallbackHz: number = 440) => {
  if (!rootKey) return fallbackHz;
  const trimmed = String(rootKey).trim();
  if (!trimmed) return fallbackHz;
  if (/^\d+$/.test(trimmed)) {
    const midi = parseInt(trimmed, 10);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  const match = trimmed.toUpperCase().match(/^([A-G])([#B]?)(-?\d+)$/);
  if (!match) return fallbackHz;
  const key = `${match[1]}${match[2] || ''}`;
  const semitone = NOTE_TO_SEMITONE[key];
  if (!Number.isFinite(semitone)) return fallbackHz;
  const octave = parseInt(match[3], 10);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export const frequencyToMidi = (frequency: number) => {
  if (!Number.isFinite(frequency) || frequency <= 0) return 69;
  return Math.round(69 + 12 * Math.log2(frequency / 440));
};

export const resolveFmAlgorithm = (algorithm: string) => {
  switch (algorithm) {
    case 'algo2':
      return { carriers: [0, 2], routes: [{ from: 3, to: 2 }, { from: 1, to: 0 }] };
    case 'algo3':
      return { carriers: [0], routes: [{ from: 3, to: 2 }, { from: 2, to: 0 }, { from: 1, to: 0 }] };
    case 'algo4':
      return { carriers: [0], routes: [{ from: 3, to: 1 }, { from: 1, to: 0 }, { from: 2, to: 0 }] };
    case 'algo5':
      return { carriers: [0], routes: [{ from: 3, to: 0 }, { from: 2, to: 0 }, { from: 1, to: 0 }] };
    case 'algo6':
      return { carriers: [0, 2], routes: [{ from: 3, to: 2 }, { from: 1, to: 0 }] };
    case 'algo7':
      return { carriers: [0], routes: [{ from: 3, to: 1 }, { from: 2, to: 1 }, { from: 1, to: 0 }] };
    case 'algo8':
      return { carriers: [0, 1, 2, 3], routes: [] };
    case 'algo1':
    default:
      return { carriers: [0], routes: [{ from: 3, to: 2 }, { from: 2, to: 1 }, { from: 1, to: 0 }] };
  }
};
