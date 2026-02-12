import { create } from 'zustand';
import { Vector3 } from 'three';

export type ViewMode = 'first-person' | 'third-person';
export type MuseumMenu = 'none' | 'map' | 'comfort' | 'graphics' | 'tour';

export type TourZoneId = 'entrance_threshold' | 'gallery_1' | 'gallery_2' | 'gallery_3' | 'finale';
export type TourDoorId = 'g1' | 'g2' | 'g3' | 'finale';

export interface TourStep {
  zoneId: TourZoneId;
  label: string;
  
  minDwellMs: number;
  
  doorId?: TourDoorId;
}

export interface TourHistory {
  timesCompleted: number;
  bestTimeMs: number | null;
  lastTimeMs: number | null;
  lastFinishedAtMs: number | null;
  
  lastCompletedZones: Partial<Record<TourZoneId, boolean>>;
}

export type TourStatus = 'inactive' | 'active' | 'finished';

export interface TourState {
  status: TourStatus;
  steps: TourStep[];
  stepIndex: number;
  
  currentZoneId: TourZoneId | null;
  
  stepEnteredAtMs: number | null;
  
  stepAccumulatedMs: number;
  completed: Partial<Record<TourZoneId, boolean>>;
  startedAtMs: number | null;
  finishedAtMs: number | null;
  totalTimeMs: number | null;

  summaryAvailable: boolean;
  
  summaryViewed: boolean;
  
  plaqueOpen: boolean;
  
  plaqueNear: boolean;
}

export interface ComfortSettings {
  
  moveSpeedMultiplier: number;
  
  mouseSensitivityMultiplier: number;
  
  useSnapTurn: boolean;
  
  snapTurnDegrees: number;
  
  reduceMotion: boolean;
}

export interface MuseumUIState {
  menu: MuseumMenu;
  onboardingSeen: boolean;
  hasPointerLocked: boolean;
}

export interface MuseumState {
  avatar: {
    modelUrl: string | null;
    viewMode: ViewMode;
    position: Vector3;
  };

  activeExhibitId: string | null;
  focusedExhibitId: string | null;

  playerSpeed: number;

  comfort: ComfortSettings;

  graphics: {
    quality: 'low' | 'medium' | 'high';
    
    brightness: number;
  };

  ui: MuseumUIState;

  tour: TourState;
  
  tourHistory: TourHistory;

  pendingTeleport: Vector3 | null;

  setAvatarModelUrl: (modelUrl: string | null) => void;
  setAvatarViewMode: (viewMode: ViewMode) => void;
  setAvatarPosition: (position: Vector3) => void;

  setActiveExhibitId: (exhibitId: string | null) => void;
  setFocusedExhibitId: (exhibitId: string | null) => void;

  setPlayerSpeed: (speed: number) => void;

  setComfort: (settings: Partial<ComfortSettings>) => void;
  setGraphics: (settings: Partial<MuseumState['graphics']>) => void;

  setMenu: (menu: MuseumMenu) => void;
  setOnboardingSeen: (seen: boolean) => void;
  setHasPointerLocked: (locked: boolean) => void;

  requestTeleport: (position: Vector3) => void;
  clearTeleport: () => void;

  enterInspect: () => void;
  
  exitInspect: () => void;

  resetFocus: () => void;

  hydrateTourHistory: () => void;

  startTour: () => void;
  cancelTour: () => void;
  restartTour: () => void;
  
  openFinalePlaque: () => void;
  closeFinalePlaque: () => void;
  markSummaryViewed: () => void;
  setPlaqueNear: (near: boolean) => void;
  clearTourHistory: () => void;

  onZoneEnter: (zoneId: TourZoneId) => void;
  onZoneExit: (zoneId: TourZoneId) => void;

  tourTick: (nowMs: number) => void;

  resetMuseum: () => void;
}

const DEFAULT_SPAWN = new Vector3(0, 1.6, -2.2);

const TOUR_STORAGE_KEY = 'mm_museum_progress_v2';
const ONBOARDING_STORAGE_KEY = 'mm_museum_onboarding_seen_v1';

function loadOnboardingSeen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistOnboardingSeen(seen: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, seen ? '1' : '0');
  } catch {
    
  }
}

const TOUR_STEPS: TourStep[] = [
  { zoneId: 'entrance_threshold', label: 'Arrival', minDwellMs: 3_000, doorId: 'g1' },
  { zoneId: 'gallery_1', label: 'Gallery 1', minDwellMs: 10_000, doorId: 'g1' },
  { zoneId: 'gallery_2', label: 'Gallery 2', minDwellMs: 10_000, doorId: 'g2' },
  { zoneId: 'gallery_3', label: 'Gallery 3', minDwellMs: 10_000, doorId: 'g3' },
  { zoneId: 'finale', label: 'Finale Hall', minDwellMs: 8_000, doorId: 'finale' }
];

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function defaultTourState(): TourState {
  return {
    status: 'inactive',
    steps: TOUR_STEPS,
    stepIndex: 0,
    currentZoneId: null,
    stepEnteredAtMs: null,
    stepAccumulatedMs: 0,
    completed: {},
    startedAtMs: null,
    finishedAtMs: null,
    totalTimeMs: null,
    summaryAvailable: false,
    summaryViewed: false,
    plaqueOpen: false,
    plaqueNear: false
  };
}

function defaultTourHistory(): TourHistory {
  return {
    timesCompleted: 0,
    bestTimeMs: null,
    lastTimeMs: null,
    lastFinishedAtMs: null,
    lastCompletedZones: {}
  };
}

export const useMuseumStore = create<MuseumState>((set, get) => ({
  avatar: {
    modelUrl: null,
    viewMode: 'first-person',
    position: DEFAULT_SPAWN.clone()
  },

  activeExhibitId: null,
  focusedExhibitId: null,
  playerSpeed: 0,

  comfort: {
    moveSpeedMultiplier: 1,
    mouseSensitivityMultiplier: 1,
    useSnapTurn: false,
    snapTurnDegrees: 45,
    reduceMotion: false
  },

  graphics: {
    quality: 'medium',
    brightness: 1.0
  },

  ui: {
    menu: 'none',
    onboardingSeen: loadOnboardingSeen(),
    hasPointerLocked: false
  },

  tour: defaultTourState(),
  tourHistory: defaultTourHistory(),

  pendingTeleport: null,

  setAvatarModelUrl: (modelUrl) => set((s) => ({ avatar: { ...s.avatar, modelUrl } })),
  setAvatarViewMode: (viewMode) => set((s) => ({ avatar: { ...s.avatar, viewMode } })),
  setAvatarPosition: (position) => set((s) => ({ avatar: { ...s.avatar, position } })),

  setActiveExhibitId: (activeExhibitId) => set(() => ({ activeExhibitId })),
  setFocusedExhibitId: (focusedExhibitId) => set(() => ({ focusedExhibitId })),

  setPlayerSpeed: (playerSpeed) => set(() => ({ playerSpeed })),

  setComfort: (comfort) => set((s) => ({ comfort: { ...s.comfort, ...comfort } })),
  setGraphics: (graphics) => set((s) => ({ graphics: { ...s.graphics, ...graphics } })),

  setMenu: (menu) => set((s) => ({ ui: { ...s.ui, menu } })),
  setOnboardingSeen: (seen) => {
    persistOnboardingSeen(seen);
    set((s) => ({ ui: { ...s.ui, onboardingSeen: seen } }));
  },
  setHasPointerLocked: (locked) => set((s) => ({ ui: { ...s.ui, hasPointerLocked: locked } })),

  requestTeleport: (position) => set(() => ({ pendingTeleport: position })),
  clearTeleport: () => set(() => ({ pendingTeleport: null })),

  hydrateTourHistory: () => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(TOUR_STORAGE_KEY) : null;
    const parsed = safeParseJson<TourHistory>(raw);
    if (!parsed) return;
    
    set(() => ({ tourHistory: { ...defaultTourHistory(), ...parsed } }));
  },

  startTour: () => {
    const now = Date.now();
    const cz = get().tour.currentZoneId;
    const first = TOUR_STEPS[0];
    set((s) => ({
      tour: {
        ...s.tour,
        status: 'active',
        steps: TOUR_STEPS,
        stepIndex: 0,
        stepAccumulatedMs: 0,
        stepEnteredAtMs: cz === first.zoneId ? now : null,
        completed: {},
        startedAtMs: now,
        finishedAtMs: null,
        totalTimeMs: null,
        summaryAvailable: false,
        summaryViewed: false,
        plaqueOpen: false,
        plaqueNear: false
      },
      ui: { ...s.ui, menu: 'none' }
    }));
  },

  cancelTour: () =>
    set((s) => ({
      tour: {
        ...s.tour,
        status: 'inactive',
        stepIndex: 0,
        stepAccumulatedMs: 0,
        stepEnteredAtMs: null,
        completed: {},
        startedAtMs: null,
        finishedAtMs: null,
        totalTimeMs: null,
        summaryAvailable: false,
        summaryViewed: false,
        plaqueOpen: false,
        plaqueNear: false
      }
    })),

  restartTour: () => {
    get().cancelTour();
    get().startTour();
  },

  openFinalePlaque: () =>
    set((s) => ({
      tour: {
        ...s.tour,
        plaqueOpen: true,
        summaryViewed: true
      }
    })),

  closeFinalePlaque: () =>
    set((s) => ({
      tour: {
        ...s.tour,
        plaqueOpen: false
      }
    })),

  markSummaryViewed: () =>
    set((s) => ({
      tour: {
        ...s.tour,
        summaryViewed: true
      }
    })),

  setPlaqueNear: (near) =>
    set((s) => ({
      tour: {
        ...s.tour,
        plaqueNear: near,
        
        plaqueOpen: near ? s.tour.plaqueOpen : false
      }
    })),

  clearTourHistory: () => {
    try {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {
      
    }
    set(() => ({ tourHistory: defaultTourHistory() }));
  },

  onZoneEnter: (zoneId) => {
    const now = Date.now();
    const t = get().tour;
    set((s) => ({ tour: { ...s.tour, currentZoneId: zoneId } }));
    if (t.status !== 'active') return;
    const step = t.steps[t.stepIndex];
    if (!step) return;
    if (zoneId === step.zoneId && t.stepEnteredAtMs == null) {
      set((s) => ({ tour: { ...s.tour, stepEnteredAtMs: now } }));
    }
  },

  onZoneExit: (zoneId) => {
    const now = Date.now();
    const t = get().tour;
    
    if (t.currentZoneId === zoneId) {
      set((s) => ({ tour: { ...s.tour, currentZoneId: null } }));
    }
    if (t.status !== 'active') return;
    const step = t.steps[t.stepIndex];
    if (!step) return;
    if (zoneId === step.zoneId && t.stepEnteredAtMs != null) {
      const gained = Math.max(0, now - t.stepEnteredAtMs);
      set((s) => ({
        tour: {
          ...s.tour,
          stepEnteredAtMs: null,
          stepAccumulatedMs: s.tour.stepAccumulatedMs + gained
        }
      }));
    }
  },

  tourTick: (nowMs) => {
    const t = get().tour;
    if (t.status !== 'active') return;
    const step = t.steps[t.stepIndex];
    if (!step) return;
    if (t.currentZoneId !== step.zoneId || t.stepEnteredAtMs == null) return;

    const inZone = Math.max(0, nowMs - t.stepEnteredAtMs);
    const total = t.stepAccumulatedMs + inZone;
    if (total < step.minDwellMs) return;

    const completed = { ...t.completed, [step.zoneId]: true };
    const nextIndex = t.stepIndex + 1;

    if (nextIndex >= t.steps.length) {
      const startedAtMs = t.startedAtMs ?? nowMs;
      const totalTimeMs = Math.max(0, nowMs - startedAtMs);

      const prevHist = get().tourHistory;
      const timesCompleted = (prevHist.timesCompleted ?? 0) + 1;
      const bestTimeMs = prevHist.bestTimeMs == null ? totalTimeMs : Math.min(prevHist.bestTimeMs, totalTimeMs);
      const nextHist: TourHistory = {
        ...defaultTourHistory(),
        ...prevHist,
        timesCompleted,
        bestTimeMs,
        lastTimeMs: totalTimeMs,
        lastFinishedAtMs: nowMs,
        lastCompletedZones: completed
      };
      try {
        window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(nextHist));
      } catch {
        
      }

      set((s) => ({
        tourHistory: nextHist,
        tour: {
          ...s.tour,
          status: 'finished',
          completed,
          finishedAtMs: nowMs,
          totalTimeMs,
          summaryAvailable: true,
          summaryViewed: false,
          plaqueOpen: false,
          plaqueNear: false,
          stepEnteredAtMs: null,
          stepAccumulatedMs: 0
        }
      }));
      return;
    }

    set((s) => ({
      tour: {
        ...s.tour,
        completed,
        stepIndex: nextIndex,
        stepAccumulatedMs: 0,
        stepEnteredAtMs: null
      }
    }));
  },

  enterInspect: () => {
    const focused = get().focusedExhibitId;
    if (!focused) return;
    set(() => ({ activeExhibitId: focused, ui: { ...get().ui, menu: 'none' } }));
  },

  exitInspect: () => set(() => ({ activeExhibitId: null })),

  resetFocus: () => set(() => ({ focusedExhibitId: null })),

  resetMuseum: () =>
    set(() => ({
      avatar: { modelUrl: null, viewMode: 'first-person', position: DEFAULT_SPAWN.clone() },
      tour: defaultTourState(),
      comfort: {
        moveSpeedMultiplier: 1,
        mouseSensitivityMultiplier: 1,
        useSnapTurn: false,
        snapTurnDegrees: 45,
        reduceMotion: false
      },
      graphics: { quality: 'medium', brightness: 1.0 },
      ui: { menu: 'none', onboardingSeen: loadOnboardingSeen(), hasPointerLocked: false },
      pendingTeleport: null,
      activeExhibitId: null,
      focusedExhibitId: null,
      playerSpeed: 0
    }))
}));
