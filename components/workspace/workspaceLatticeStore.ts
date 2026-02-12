import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand';

import type { AppSettings, EdgeData, NodeData, SimpleModeStage } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { deepCopySettings } from '../../store/logic/utils';
import { handleRegenerateLattice } from '../../store/actions/lattice';

export type WorkspaceLatticeState = {
  settings: AppSettings;
  nodes: NodeData[];
  edges: EdgeData[];
  latticeTopologyKey: string | null;
  latticeDisplayKey: string | null;
  activeMaxPrimeLimit: number;
  selectedNode: NodeData | null;
  referenceNode: NodeData | null;
  nearbyNodes: NodeData[];
  nearestGen0Nodes: NodeData[];
  nearestGen1Node: NodeData | null;
  highlightedPath: string[];
  affiliatedLineNodeIds: string[];
  affiliatedLineLimit: number | null;
  selectionHistory: string[];
  historyIndex: number;
  isGenerating: boolean;
  error: string | null;
  customNodeTextures: Record<string, string>;
  nodeSurfaceLabelOverrides: Record<string, any>;
  nodeNameOverrides: Record<string, any>;
  isGravityEnabled: boolean;
  isIsolationMode: boolean;
  simpleModeStage: SimpleModeStage;
  commaLines: { sourceId: string; targetId: string; name: string }[];
  playingNodeIds: Map<string, { channels: number[]; velocity: number; tracks?: number[]; parts?: number[] }>;
  midiRetuner: {
    retunePreviewActive: boolean;
    retuneTrackVisualsEnabled: boolean;
    retuneTrackStyles: any[];
    retuneTrackEffect: string;
  };
  isPureUIMode: boolean;
  modifierKeys: { z: boolean; a: boolean; x: boolean; tab: boolean };
  comparisonNodes: NodeData[];
  comparisonGroups: any[];
  focusSignal: number;
  cameraResetSignal: number;
  disableWasdInKeyboard: boolean;
  panels: { keyboard: { isOpen: boolean; mode: string } };
  updateSettings: (partial: Partial<AppSettings>, commit?: boolean) => void;
  updateVisualSettings: (partial: any, commit?: boolean) => void;
  regenerateLattice: (applyDefaults?: boolean, recordHistory?: boolean) => void;
  selectNode: (node: NodeData | null, preserveReference?: boolean, addToHistory?: boolean) => void;
  addToKeyboard: (_: NodeData) => void;
  addToComparison: (_: NodeData) => void;
  toggleAxisLoop: (limit: number) => void;
  resetLatticeConfig: () => void;
  unmaskNode: (id: string) => void;
  unmaskAllNodes: () => void;
};

const mergeSettings = (prev: AppSettings, partial: Partial<AppSettings>) => {
  const next: AppSettings = {
    ...prev,
    ...partial,
    visuals: {
      ...prev.visuals,
      ...(partial.visuals || {})
    }
  };
  return next;
};

export const createWorkspaceLatticeStore = (
  baseSettings?: AppSettings
): StoreApi<WorkspaceLatticeState> => {
  const initialSettings = deepCopySettings(baseSettings || DEFAULT_SETTINGS);

  return createStore<WorkspaceLatticeState>((set, get) => ({
    settings: initialSettings,
    nodes: [],
    edges: [],
    latticeTopologyKey: null,
    latticeDisplayKey: null,
    activeMaxPrimeLimit: initialSettings.maxPrimeLimit,
    selectedNode: null,
    referenceNode: null,
    nearbyNodes: [],
    nearestGen0Nodes: [],
    nearestGen1Node: null,
    highlightedPath: [],
    affiliatedLineNodeIds: [],
    affiliatedLineLimit: null,
    selectionHistory: [],
    historyIndex: -1,
    isGenerating: false,
    error: null,
    customNodeTextures: {},
    nodeSurfaceLabelOverrides: {},
    nodeNameOverrides: {},
    isGravityEnabled: false,
    isIsolationMode: false,
    simpleModeStage: 'manual',
    commaLines: [],
    playingNodeIds: new Map(),
    midiRetuner: {
      retunePreviewActive: false,
      retuneTrackVisualsEnabled: false,
      retuneTrackStyles: [],
      retuneTrackEffect: 'glow'
    },
    isPureUIMode: false,
    modifierKeys: { z: false, a: false, x: false, tab: false },
    comparisonNodes: [],
    comparisonGroups: [],
    focusSignal: 0,
    cameraResetSignal: 0,
    disableWasdInKeyboard: false,
    panels: { keyboard: { isOpen: false, mode: 'float' } },
    updateSettings: (partial, commit = true) => {
      set((state) => ({ settings: mergeSettings(state.settings, partial) }));
      if (commit) get().regenerateLattice(false, true);
    },
    updateVisualSettings: (partial, commit = false) => {
      set((state) => ({
        settings: {
          ...state.settings,
          visuals: { ...state.settings.visuals, ...(partial || {}) }
        }
      }));
      if (commit) get().regenerateLattice(false, true);
    },
    regenerateLattice: (applyDefaults = false, recordHistory = false) => {
      handleRegenerateLattice(set, get, applyDefaults, recordHistory);
    },
    selectNode: (node) => {
      set((state) => ({
        selectedNode: node,
        referenceNode: null,
        nearbyNodes: [],
        nearestGen0Nodes: [],
        nearestGen1Node: null,
        highlightedPath: [],
        affiliatedLineNodeIds: [],
        affiliatedLineLimit: null,
        focusSignal: state.focusSignal + 1
      }));
    },
    addToKeyboard: () => {},
    addToComparison: () => {},
    toggleAxisLoop: (limit) => {
      set((state) => {
        const cur = state.settings.axisLooping?.[limit];
        const next = cur !== null ? null : (state.settings.gen0Lengths?.[limit] || state.settings.expansionA);
        return {
          settings: {
            ...state.settings,
            axisLooping: { ...state.settings.axisLooping, [limit]: next }
          }
        };
      });
      get().regenerateLattice(false, true);
    },
    resetLatticeConfig: () => {
      const nextSettings = deepCopySettings(DEFAULT_SETTINGS);
      set({ settings: nextSettings });
      get().regenerateLattice(true, false);
    },
    unmaskNode: (id: string) => {
      set((state) => {
        const current = state.settings.maskedNodeIds || [];
        if (!current.includes(id)) return {};
        return {
          settings: {
            ...state.settings,
            maskedNodeIds: current.filter((mid) => mid !== id)
          }
        };
      });
      get().regenerateLattice(false, true);
    },
    unmaskAllNodes: () => {
      set((state) => ({
        settings: {
          ...state.settings,
          maskedNodeIds: []
        }
      }));
      get().regenerateLattice(false, true);
    }
  }));
};
