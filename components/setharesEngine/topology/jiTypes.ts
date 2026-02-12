export type WeightMode = 'tenney' | 'euler' | 'flat';
export type WeightNormalization = 'max' | 'l1';
export type ZNormalization = 'sqrt' | 'gamma';

export type RatioTarget = {
  id: string;
  text: string;
  ratio: number;
  weight: number;
  num: number;
  den: number;
  label?: string;
};

export type JITopologyConfig = {
  beta: number;
  nMin: number;
  nMax: number;
  baseStep: number;
  cPeriod: number;
  epsilon: number;
  gamma: number;
  p: number;
  weightMode: WeightMode;
  weightNormalization: WeightNormalization;
  zNormalization: ZNormalization;
  enableBase: boolean;
  enablePeaks: boolean;
  enableDense: boolean;
  denseOffsets: number[];
  mergeEps: number;
  colorSigma: number;
  colorSharpen: number;
  yPhysCurve: number;
  yCogCurve: number;
  targets: RatioTarget[];
};

export type JITopologyResult = {
  n: Float32Array;
  z_pure: Float32Array;
  y_phys: Float32Array;
  y_cog: Float32Array;
  rgb: Uint32Array;
  flags: Uint8Array;
  stats: {
    pointCount: number;
    peakCount: number;
    baseCount: number;
    denseCount: number;
    zMin: number;
    zMax: number;
    computeMs: number;
  };
};

