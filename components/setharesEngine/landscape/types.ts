export type TimbrePreset = 'saw' | 'square' | 'triangle' | 'custom';

export type MergeToleranceUnit = 'ratio' | 'cents' | 'hz';

export type AmplitudePipeline = 'normalize_then_compress' | 'compress_then_normalize';

export type BasePartialStrategy = 'max' | 'one' | 'first';

export type TerrainScalarField = 'raw' | 'normalized';

export type BoundaryPolicy = 'skip' | 'mirror';

export type NeighborhoodConnectivity = 4 | 8;

export type SpectrumPartial = {
  ratio: number;
  amp: number;
  index?: number;
};

export type TimbreConfig = {
  preset: TimbrePreset;
  partialCount: number;
  customPartials: SpectrumPartial[];
  customFileName?: string;
  maxPartials: number;

  /**
   * Merge close partials during template normalization (and, optionally, when building triad pools).
   * NOTE: For pool-level merging see RoughnessOptions.mergeDuplicatePartials and TimbreConfig.mergeClosePartials.
   */
  mergeClosePartials: boolean;

  /** Merge tolerance, interpreted by mergeToleranceUnit (default: 'ratio' for backward compatibility). */
  mergeTolerance: number;
  mergeToleranceUnit?: MergeToleranceUnit;

  /** Amplitude normalization applied in the timbre template. */
  amplitudeNormalization: 'none' | 'max' | 'energy';

  /** Amplitude compression applied in the timbre template. */
  amplitudeCompression: 'none' | 'sqrt' | 'log';
  amplitudeCompressionAmount: number;

  /**
   * Controls whether normalization happens before compression or after.
   * Default is 'compress_then_normalize' to preserve legacy behaviour unless explicitly changed.
   */
  amplitudePipeline?: AmplitudePipeline;

  /** When the fundamental (ratio=1) is missing, choose how to auto-insert it. */
  basePartialStrategy?: BasePartialStrategy;

  triadEnergyMode: 'none' | 'linear' | 'sqrt';
  clampNegativeAmps: boolean;
};

export type Partial = {
  freq: number;
  amp: number;
  index: number;
  ratio?: number;
  toneIndex?: number;
  toneMask?: number;
};

export type RoughnessConstants = {
  a: number;
  b: number;
  dStar: number;
  s1: number;
  s2: number;
  expClampMin?: number;
};

export type RoughnessOptions = {
  ampThreshold: number;
  epsilonContribution: number;

  /** Include within-tone interactions. When false, only cross-tone interactions are counted. */
  enableSelfInteraction: boolean;

  /** Weight applied to within-tone interactions when enableSelfInteraction is true. */
  selfInteractionWeight: number;

  /** Merge exact duplicate partial frequencies within each tone before pairing. */
  mergeDuplicatePartials: boolean;

  collectPointDiagnostics?: boolean;
  symmetrySampleCount?: number;
  symmetryTolerance?: number;
  precisionCheck?: boolean;
  precisionCheckSamples?: number;
  performanceMode?: boolean;
  pairSkipEpsilon?: number;
};

export type NormalizationMode = 'none' | 'energy' | 'max' | 'reference';

export type SamplingConfig = {
  xRange: [number, number];
  yRange: [number, number];
  xSteps: number;
  ySteps: number;
  logSampling: boolean;
  foldOctave: boolean;
  resolutionMode: 'fixed' | 'auto';
  autoLowSteps: number;
  autoHighSteps: number;
  maxSteps: number;
  progressiveRefine: boolean;
  progressiveWindow: number;
  progressiveSteps: number;
  refineFixed: boolean;
  refineGradient: boolean;
  refineMinima: boolean;
  refineBandCents: number;
  refineDensity: number;
  gradientThreshold: number;
  minimaNeighborhood: number;
  minimaSmoothing: number;
  refineBaseSteps: number;
};

export type GridPointDiagnostics = {
  originalPartials: number;
  prunedPartials: number;
  invalidPartials: number;
  skippedPairs: number;
  totalPairs: number;
  maxPairContribution: number;
  silent: boolean;
  pairCacheHits?: number;
};

export type GridDiagnosticsSummary = {
  points: number;
  originalPartials: number;
  prunedPartials: number;
  invalidPartials: number;
  skippedPairs: number;
  totalPairs: number;
  silentPoints: number;
};

export type GridData = {
  xs: number[];
  ys: number[];
  /** Natural log of xs (monotonic), always present. */
  logX: number[];
  /** Natural log of ys (monotonic), always present. */
  logY: number[];

  /** Raw roughness values (same semantics for all modes). */
  raw: Float64Array;

  /** Normalized roughness values according to normalizationMode. */
  normalized: Float64Array;

  /** Optional analysis/display binding: which field should downstream analysis default to. */
  scalarField?: TerrainScalarField;

  /** Copy of sampling flags for downstream algorithms. */
  logSampling?: boolean;
  foldOctave?: boolean;

  /** Optional non-uniform cell metrics in linear ratio space. */
  cellWidth?: Float64Array;
  cellHeight?: Float64Array;
  cellArea?: Float64Array;

  diagOriginal?: Uint16Array;
  diagPruned?: Uint16Array;
  diagInvalid?: Uint16Array;
  diagSkipped?: Uint32Array;
  diagTotal?: Uint32Array;
  diagMaxPair?: Float64Array;
  diagnostics: GridDiagnosticsSummary;
  normalizationMode: NormalizationMode;
  minRaw?: number;
  maxRaw?: number;
  minNorm?: number;
  maxNorm?: number;
};

export type MinimaPoint = {
  x: number;
  y: number;
  /** Grid indices for stable downstream linking (avoid float matching). */
  ix?: number;
  iy?: number;

  roughness: number;
  depth: number;
  plateauSize?: number;

  labelX?: string;
  labelY?: string;
  laplacian?: number;

  basinArea?: number;
  basinRadius?: number;
  basinThreshold?: number;

  refined?: boolean;
  refinePasses?: number;
  refineSteps?: number;
  rationalX?: string;
  rationalY?: string;
  rationalErrorX?: number;
  rationalErrorY?: number;
};

export type IntervalLabel = {
  name: string;
  ratio: number;
};

export type ScaleDefinition = {
  name: string;
  ratios: number[];
  kind: 'edo' | 'just' | 'custom';
};

export type ScaleComparisonPoint = {
  x: number;
  y: number;
  roughness: number;
  normalized: number;
  label?: string;
};

export type ScaleComparison = {
  worst: ScaleComparisonPoint[];
  count: number;
  maxRoughness: number;
  average: number;
};

export type Suggestion = {
  title: string;
  details: string[];
};
