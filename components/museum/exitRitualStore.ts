import { create } from 'zustand';

export type ExitRitualPhase = 'inactive' | 'guiding' | 'fading';

export interface ExitRitualState {
  phase: ExitRitualPhase;
  requestedAtMs: number | null;
  fadeStartAtMs: number | null;
  
  fadeAlpha: number;
  
  shouldNavigate: boolean;

  requestExit: () => void;
  cancelExit: () => void;
  reachExitEnd: () => void;
  tick: (nowMs: number) => void;
  reset: () => void;
}

const FADE_MS = 750;

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export const useExitRitualStore = create<ExitRitualState>((set, get) => ({
  phase: 'inactive',
  requestedAtMs: null,
  fadeStartAtMs: null,
  fadeAlpha: 0,
  shouldNavigate: false,

  requestExit: () => {
    const now = Date.now();
    set(() => ({
      phase: 'guiding',
      requestedAtMs: now,
      fadeStartAtMs: null,
      fadeAlpha: 0,
      shouldNavigate: false
    }));
  },

  cancelExit: () => {
    set(() => ({
      phase: 'inactive',
      requestedAtMs: null,
      fadeStartAtMs: null,
      fadeAlpha: 0,
      shouldNavigate: false
    }));
  },

  reachExitEnd: () => {
    const s = get();
    if (s.phase !== 'guiding') return;
    const now = Date.now();
    set(() => ({ phase: 'fading', fadeStartAtMs: now }));
  },

  tick: (nowMs: number) => {
    const s = get();
    if (s.phase !== 'fading') return;
    const t0 = s.fadeStartAtMs ?? nowMs;
    const a = clamp01((nowMs - t0) / FADE_MS);
    if (a !== s.fadeAlpha) set(() => ({ fadeAlpha: a }));
    if (a >= 1 && !s.shouldNavigate) {
      set(() => ({ shouldNavigate: true }));
    }
  },

  reset: () => {
    set(() => ({
      phase: 'inactive',
      requestedAtMs: null,
      fadeStartAtMs: null,
      fadeAlpha: 0,
      shouldNavigate: false
    }));
  }
}));
