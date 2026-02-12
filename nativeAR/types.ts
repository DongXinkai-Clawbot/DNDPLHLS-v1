export type NativeArUiMode = 'fullscreen' | 'panel';
export type NativeArOcclusionMode = 'off' | 'plane' | 'depth';

export type NativeArTrackingState = 'TRACKING' | 'PAUSED' | 'STOPPED' | 'UNKNOWN';

export interface NativeArCapabilities {
  supported: boolean;
  /** True if Google Play Services for AR (ARCore) is installed/available. */
  arCoreAvailable: boolean;
  /** True if the device/ARCore version supports per-pixel depth data. */
  depthSupported: boolean;
  /** Optional human-readable status. */
  message?: string;
}

export interface NativeArViewportRect {
  /** Viewport origin X in CSS pixels (top-left). */
  x: number;
  /** Viewport origin Y in CSS pixels (top-left). */
  y: number;
  width: number;
  height: number;
  /** DevicePixelRatio used to convert CSS pixels to physical pixels on native side. */
  dpr: number;
}

export interface NativeArPose {
  tx: number;
  ty: number;
  tz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface NativeArAnchorResult {
  anchorId: string;
  pose: NativeArPose;
}

export interface NativeArStartSessionOptions {
  uiMode?: NativeArUiMode;
  viewport?: NativeArViewportRect;
  occlusionMode?: NativeArOcclusionMode;
}

export interface NativeArNodeSpec {
  id: string;
  /** Local position relative to anchor (meters). */
  x: number;
  y: number;
  z: number;
  /** Radius in meters. */
  r: number;
  /** Color RGB in 0..1. */
  cr: number;
  cg: number;
  cb: number;
  /** Optional alpha 0..1. */
  ca?: number;
}

export interface NativeArNodePatch {
  id: string;
  r?: number;
  cr?: number;
  cg?: number;
  cb?: number;
  ca?: number;
  selected?: boolean;
}

export interface NativeArPlugin {
  getCapabilities(): Promise<NativeArCapabilities>;

  startSession(options?: NativeArStartSessionOptions): Promise<{ started: boolean }>;
  stopSession(): Promise<{ stopped: boolean }>;

  setUiMode(options: { mode: NativeArUiMode }): Promise<void>;
  setViewportRect(rect: NativeArViewportRect): Promise<void>;
  setOcclusionMode(options: { mode: NativeArOcclusionMode }): Promise<void>;

  addAnchorFromHit(options: { nx: number; ny: number }): Promise<NativeArAnchorResult>;
  removeAnchor(options: { anchorId: string }): Promise<void>;
  clearAnchors(): Promise<void>;

  createNodes(options: { anchorId: string; nodes: NativeArNodeSpec[] }): Promise<{ count: number }>;
  updateNodes(options: { nodes: NativeArNodePatch[] }): Promise<void>;
  removeNodes(options: { ids: string[] }): Promise<void>;
  clearNodes(): Promise<void>;

  pickNode(options: { nx: number; ny: number }): Promise<{ nodeId: string | null }>;
}
