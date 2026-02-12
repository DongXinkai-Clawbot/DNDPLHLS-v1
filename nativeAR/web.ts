import type {
  NativeArCapabilities,
  NativeArPlugin,
  NativeArStartSessionOptions,
  NativeArViewportRect,
  NativeArUiMode,
  NativeArOcclusionMode,
  NativeArAnchorResult,
  NativeArNodeSpec,
  NativeArNodePatch,
} from './types';

const unsupported = async (): Promise<never> => {
  throw new Error('NativeAR is only available inside the Android app build (Capacitor).');
};

export const NativeARWeb: NativeArPlugin = {
  getCapabilities: async (): Promise<NativeArCapabilities> => ({
    supported: false,
    arCoreAvailable: false,
    depthSupported: false,
    message: 'Native AR is not available on web.'
  }),

  startSession: async (_options?: NativeArStartSessionOptions) => unsupported(),
  stopSession: async () => unsupported(),

  setUiMode: async (_options: { mode: NativeArUiMode }) => unsupported(),
  setViewportRect: async (_rect: NativeArViewportRect) => unsupported(),
  setOcclusionMode: async (_options: { mode: NativeArOcclusionMode }) => unsupported(),

  addAnchorFromHit: async (_options: { nx: number; ny: number }): Promise<NativeArAnchorResult> => unsupported(),
  removeAnchor: async (_options: { anchorId: string }) => unsupported(),
  clearAnchors: async () => unsupported(),

  createNodes: async (_options: { anchorId: string; nodes: NativeArNodeSpec[] }) => unsupported(),
  updateNodes: async (_options: { nodes: NativeArNodePatch[] }) => unsupported(),
  removeNodes: async (_options: { ids: string[] }) => unsupported(),
  clearNodes: async () => unsupported(),

  pickNode: async (_options: { nx: number; ny: number }) => unsupported(),
};
