import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { computeGrid, computeSinglePoint, EngineConfig, refineWithGradient, refineWithMinima } from './engine';
import {
  annotateMinimaWithRationals,
  approximateRatio,
  buildContours,
  computeAO,
  computeGradients,
  computeNormals,
  detectMaxima,
  detectMinimaDetailed,
  estimateBasins,
  compareScaleToGrid,
  getValueAtIndex,
  sampleGrid,
  sampleGridValue,
  selectValues,
  smoothGrid,
  symmetryCheck
} from './analysis';
import { DEFAULT_ATTACK, DEFAULT_RELEASE, getAudioCtx } from '../sethares/utils';
import { buildAxis, refineAxisFixed, refineAxisMidpoints } from './sampling';
import { STANDARD_CONSTANTS, isStandardConstants, validateConstants } from './constants';
import { buildSpectrumTemplate, parseSpectrumText } from './timbre';
import { buildScaleFromMinima, buildTimbreSuggestions } from './suggestions';
import {
  GridData,
  MinimaPoint,
  NormalizationMode,
  RoughnessOptions,
  ScaleComparison,
  ScaleDefinition,
  SamplingConfig,
  Suggestion,
  TimbreConfig,
  RoughnessConstants,
  TerrainScalarField
} from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const foldRatio = (value: number) => {
  let v = value;
  if (!Number.isFinite(v) || v <= 0) return v;
  while (v > 2) v /= 2;
  while (v < 1) v *= 2;
  return v;
};

const uniqueSorted = (values: number[]) => {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const unique: number[] = [];
  sorted.forEach(v => {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(last - v) > 1e-6) unique.push(v);
  });
  return unique;
};

const COLOR_RAMPS = {
  emerald: { low: [10, 12, 16], high: [50, 240, 110] },
  magma: { low: [20, 10, 40], high: [255, 120, 40] },
  ice: { low: [10, 20, 40], high: [120, 210, 255] }
} as const;

const mixColor = (low: number[], high: number[], t: number) => {
  const tt = clamp(t, 0, 1);
  return [
    Math.round(low[0] + (high[0] - low[0]) * tt),
    Math.round(low[1] + (high[1] - low[1]) * tt),
    Math.round(low[2] + (high[2] - low[2]) * tt)
  ];
};

const applyHeightContrast = (value: number, pivot: number, contrast: number) => {
  const v = clamp(value, 0, 1);
  const p = clamp(pivot, 0, 1);
  const c = clamp(contrast, 0.25, 8);
  if (Math.abs(c - 1) < 1e-3) return v;
  // Contrast around pivot, like image contrast: out = (v - p) * c + p.
  return clamp((v - p) * c + p, 0, 1);
};

const DRAG_PIN_THRESHOLD_PX = 6;
const HOLD_AUDIO_PARTIALS = 32;
const HOLD_AUDIO_FREQ_SMOOTH = 0.02;
const HOLD_CLICK_SUPPRESS_MS = 180;
const SLICE_CLICK_PREVIEW_MS = 360;

const defaultTimbre: TimbreConfig = {
  preset: 'saw',
  partialCount: 12,
  customPartials: [],
  maxPartials: 128,
  mergeClosePartials: false,
  mergeTolerance: 1e-4,
  amplitudeNormalization: 'none',
  amplitudeCompression: 'none',
  amplitudeCompressionAmount: 2,
  triadEnergyMode: 'none',
  clampNegativeAmps: true
};

const defaultSampling: SamplingConfig = {
  xRange: [1, 2],
  yRange: [1, 2],
  xSteps: 256,
  ySteps: 256,
  logSampling: true,
  foldOctave: false,
  resolutionMode: 'auto',
  autoLowSteps: 128,
  autoHighSteps: 256,
  maxSteps: 512,
  progressiveRefine: false,
  progressiveWindow: 0.05,
  progressiveSteps: 128,
  refineFixed: true,
  refineGradient: false,
  refineMinima: false,
  refineBandCents: 14,
  refineDensity: 3,
  gradientThreshold: 0.06,
  minimaNeighborhood: 2,
  minimaSmoothing: 1,
  refineBaseSteps: 24
};

const defaultRoughness: RoughnessOptions = {
  ampThreshold: 0.001,
  epsilonContribution: 1e-4,
  enableSelfInteraction: false,
  selfInteractionWeight: 0.7,
  mergeDuplicatePartials: false,
  symmetrySampleCount: 24,
  symmetryTolerance: 1e-6,
  precisionCheck: false,
  precisionCheckSamples: 12,
  performanceMode: false,
  pairSkipEpsilon: 1e-4
};

const buildEdo = (steps: number) => Array.from({ length: steps }, (_, i) => Math.pow(2, i / steps));

const SCALE_PRESETS: ScaleDefinition[] = [
  { name: '12-EDO', ratios: buildEdo(12), kind: 'edo' },
  { name: '19-EDO', ratios: buildEdo(19), kind: 'edo' },
  { name: '31-EDO', ratios: buildEdo(31), kind: 'edo' },
  { name: '5-limit just', ratios: [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8], kind: 'just' },
  { name: '7-limit just', ratios: [1, 8 / 7, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 7 / 5, 3 / 2, 8 / 5, 5 / 3, 7 / 4, 15 / 8], kind: 'just' }
];

const parseScaleText = (text: string) => {
  const parseToken = (token: string) => {
    if (token.includes('/')) {
      const parts = token.split('/');
      if (parts.length === 2) {
        const num = Number(parts[0]);
        const den = Number(parts[1]);
        if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
          return num / den;
        }
      }
    }
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  };
  const values = text
    .split(/[\s,]+/)
    .map(token => parseToken(token.trim()))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  return values.map(foldRatio).filter(v => v >= 1 && v <= 2).sort((a, b) => a - b);
};

const RESOURCE_LIMITS = {
  maxPartials: 256
};

const GRID_POINT_CAPS = {
  quick: 256 * 256,
  balanced: 512 * 512,
  ultra: 1024 * 1024,
  extreme: 2048 * 2048
} as const;

const MAX_STEPS_LIMIT = 4096;

type GraphAgentPresetKey = keyof typeof GRID_POINT_CAPS;
type GraphSurfacePresetKey = 'smooth' | 'balanced' | 'crisp';

const GRAPH_AGENT_PRESETS: Record<GraphAgentPresetKey, {
  label: string;
  description: string;
  gridPointBudget: number;
  sampling: Partial<SamplingConfig>;
  roughness: Partial<RoughnessOptions>;
}> = {
  quick: {
    label: 'Quick Preview',
    description: 'Fast feedback with low detail for rapid iteration.',
    gridPointBudget: GRID_POINT_CAPS.quick,
    sampling: {
      resolutionMode: 'auto',
      autoLowSteps: 64,
      autoHighSteps: 128,
      maxSteps: 256,
      progressiveRefine: false,
      refineGradient: false,
      refineMinima: false,
      refineDensity: 2,
      refineBandCents: 18
    },
    roughness: { performanceMode: true }
  },
  balanced: {
    label: 'Balanced Detail',
    description: 'Good clarity with reasonable compute time.',
    gridPointBudget: GRID_POINT_CAPS.balanced,
    sampling: {
      resolutionMode: 'auto',
      autoLowSteps: 128,
      autoHighSteps: 256,
      maxSteps: 512,
      progressiveRefine: false,
      refineGradient: false,
      refineMinima: false,
      refineDensity: 3,
      refineBandCents: 14
    },
    roughness: { performanceMode: false }
  },
  ultra: {
    label: 'Ultra Detail',
    description: 'High resolution with refinement enabled.',
    gridPointBudget: GRID_POINT_CAPS.ultra,
    sampling: {
      resolutionMode: 'auto',
      autoLowSteps: 256,
      autoHighSteps: 512,
      maxSteps: 1024,
      progressiveRefine: true,
      progressiveSteps: 256,
      refineGradient: true,
      refineMinima: true,
      refineDensity: 4,
      refineBandCents: 10,
      refineBaseSteps: 32
    },
    roughness: { performanceMode: false }
  },
  extreme: {
    label: 'Extreme Detail',
    description: 'Very high resolution. Heavy CPU/RAM use.',
    gridPointBudget: GRID_POINT_CAPS.extreme,
    sampling: {
      resolutionMode: 'auto',
      autoLowSteps: 384,
      autoHighSteps: 768,
      maxSteps: 2048,
      progressiveRefine: true,
      progressiveSteps: 512,
      refineGradient: true,
      refineMinima: true,
      refineDensity: 6,
      refineBandCents: 8,
      refineBaseSteps: 48,
      gradientThreshold: 0.04
    },
    roughness: { performanceMode: false }
  }
};

const GRAPH_SURFACE_PRESETS: Record<GraphSurfacePresetKey, {
  label: string;
  description: string;
  minimaSmoothing: number;
  smoothDisplay: boolean;
}> = {
  smooth: {
    label: 'Smooth',
    description: 'Smoother surface, fewer jagged ridges.',
    minimaSmoothing: 2,
    smoothDisplay: true
  },
  balanced: {
    label: 'Balanced',
    description: 'Neutral surface detail.',
    minimaSmoothing: 1,
    smoothDisplay: false
  },
  crisp: {
    label: 'Crisp',
    description: 'Sharper ridges and more texture.',
    minimaSmoothing: 0,
    smoothDisplay: false
  }
};

const sectionClass = 'bg-black/50 border border-white/10 rounded-xl p-3 space-y-2';
const labelClass = 'text-[10px] uppercase tracking-widest text-gray-400 font-black';
const inputClass = 'min-h-[34px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px] font-mono';

type LogEntry = {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
};

type PinnedPoint = {
  id: string;
  x: number;
  y: number;
  raw: number;
  normalized: number;
  value: number;
  field: TerrainScalarField;
  timestamp: number;
  rationalX?: string;
  rationalY?: string;
  rationalErrorX?: number;
  rationalErrorY?: number;
  basinRadius?: number;
};

export const RoughnessLandscape = () => {
  const [baseFreq, setBaseFreq] = useState(220);
  const [timbre, setTimbre] = useState<TimbreConfig>(defaultTimbre);
  const [sampling, setSampling] = useState<SamplingConfig>(defaultSampling);
  const [roughness, setRoughness] = useState<RoughnessOptions>(defaultRoughness);
  const [normalizationMode, setNormalizationMode] = useState<NormalizationMode>('energy');
  const [scalarFieldMode, setScalarFieldMode] = useState<TerrainScalarField>('normalized');
  const [constants, setConstants] = useState<RoughnessConstants>(STANDARD_CONSTANTS);
  const [grid, setGrid] = useState<GridData | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState<'idle' | 'computing' | 'error'>('idle');
  const [error, setError] = useState('');
  const [autoCompute, setAutoCompute] = useState(true);
  const [useWorker, setUseWorker] = useState(true);
  const [useParallelWorkers, setUseParallelWorkers] = useState(true);
  const [workerCount, setWorkerCount] = useState(() => {
    if (typeof navigator === 'undefined' || !navigator.hardwareConcurrency) return 4;
    return clamp(Math.round(navigator.hardwareConcurrency * 0.75), 1, 8);
  });
  const [agentPreset, setAgentPreset] = useState<GraphAgentPresetKey>('balanced');
  const [surfacePreset, setSurfacePreset] = useState<GraphSurfacePresetKey>('balanced');
  const [gridPointBudget, setGridPointBudget] = useState(GRID_POINT_CAPS.balanced);
  const [meshZoom, setMeshZoom] = useState(1);
  const [heightGamma, setHeightGamma] = useState(1);
  const [zScale, setZScale] = useState(1);
  const [zClamp, setZClamp] = useState(1);
  const [colorRamp, setColorRamp] = useState<keyof typeof COLOR_RAMPS>('emerald');
  const [aoStrength, setAoStrength] = useState(0.7);
  const [viewMode, setViewMode] = useState<'heightmap' | 'mesh'>('mesh');
  const [showProjectionOverlay, setShowProjectionOverlay] = useState(true);
  const [projectionMode, setProjectionMode] = useState<'front' | 'back'>('front');
  const [heightmapFlipX, setHeightmapFlipX] = useState(false);
  const [heightmapFlipY, setHeightmapFlipY] = useState(false);
  const [heightOnlyColor, setHeightOnlyColor] = useState(false);
  const [enableLighting, setEnableLighting] = useState(true);
  const [enableAO, setEnableAO] = useState(true);
  const [lockColorRange, setLockColorRange] = useState(false);
  const [colorRangeVersion, setColorRangeVersion] = useState(0);
  const [minimaCount, setMinimaCount] = useState(12);
  const [smoothDisplay, setSmoothDisplay] = useState(false);
  const [normalizeDisplay, setNormalizeDisplay] = useState(false);
  const [showContours, setShowContours] = useState(true);
  const [showMinima, setShowMinima] = useState(true);
  const [showWorst, setShowWorst] = useState(true);
  const [customFileError, setCustomFileError] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [pinningEnabled, setPinningEnabled] = useState(false);
  const [holdChordEnabled, setHoldChordEnabled] = useState(false);
  const [holdChordVolume, setHoldChordVolume] = useState(0.2);
  const [hoverInfo, setHoverInfo] = useState<null | {
    x: number;
    y: number;
    raw: number;
    normalized: number;
    value: number;
    field: TerrainScalarField;
    timestamp: number;
  }>(null);
  const [hoverLocked, setHoverLocked] = useState(false);
  const [pinnedPoints, setPinnedPoints] = useState<PinnedPoint[]>([]);
  const [showPinnedPath, setShowPinnedPath] = useState(true);
  const [scalePresetName, setScalePresetName] = useState(SCALE_PRESETS[0]?.name || '12-EDO');
  const [customScaleText, setCustomScaleText] = useState('');
  const [scaleComparison, setScaleComparison] = useState<ScaleComparison | null>(null);
  const [scaleWorstCount, setScaleWorstCount] = useState(8);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minimaRefined, setMinimaRefined] = useState<MinimaPoint[] | null>(null);
  const [minimaRefining, setMinimaRefining] = useState(false);
  const [analysisSeed, setAnalysisSeed] = useState(0);
  const [sliceAxis, setSliceAxis] = useState<'x' | 'y'>('x');
  const [sliceRatio, setSliceRatio] = useState(1.5);
  const [sliceHover, setSliceHover] = useState<{ ratio: number; value: number } | null>(null);
  const [timbreSuggestions, setTimbreSuggestions] = useState<Suggestion[]>([]);
  const [exportMatrixMode, setExportMatrixMode] = useState<'raw' | 'normalized'>('normalized');
  const [exportMatrixFormat, setExportMatrixFormat] = useState<'binary' | 'text'>('binary');
  const [scanDelta, setScanDelta] = useState(0.5);
  const [scanSteps, setScanSteps] = useState(3);
  const [scanResults, setScanResults] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const meshHostRef = useRef<HTMLDivElement | null>(null);
  const meshSceneRef = useRef<THREE.Scene | null>(null);
  const meshCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const contourRef = useRef<THREE.LineSegments | null>(null);
  const minimaRef = useRef<THREE.Group | null>(null);
  const worstRef = useRef<THREE.Group | null>(null);
  const pinnedRef = useRef<THREE.Group | null>(null);
  const pinnedPathRef = useRef<THREE.Line | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerDownRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; dragged: boolean } | null>(null);
  const dragClearTimerRef = useRef<number | null>(null);
  const colorRangeRef = useRef<null | { rawMin: number; rawMax: number; normMin: number; normMax: number }>(null);
  const projectionPlaneRef = useRef<THREE.Mesh | null>(null);
  const projectionTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const holdActiveRef = useRef(false);
  const holdStartTimeRef = useRef<number | null>(null);
  const holdClickSuppressRef = useRef(false);
  const customFileInputRef = useRef<HTMLInputElement | null>(null);
  const holdAudioRef = useRef<null | {
    ctx: AudioContext;
    master: GainNode;
    oscillators: Array<{ osc: OscillatorNode; gain: GainNode; toneIndex: number; partialRatio: number }>;
  }>(null);
  const slicePreviewTimerRef = useRef<number | null>(null);
  const parallelWorkersRef = useRef<Worker[]>([]);
  const keyboardIndexRef = useRef<{ ix: number; iy: number } | null>(null);
  const pinCounterRef = useRef(0);
  const minimaRefineTokenRef = useRef(0);
  const pinClickTimerRef = useRef<number | null>(null);
  const computeStartRef = useRef<number | null>(null);
  const config = useMemo<EngineConfig>(() => ({
    baseFreq,
    timbre,
    sampling,
    roughness,
    normalizationMode,
    scalarField: scalarFieldMode,
    constants,
    referencePoint: { x: 1, y: 1 }
  }), [baseFreq, timbre, sampling, roughness, normalizationMode, scalarFieldMode, constants]);
  const constantsStandard = useMemo(() => isStandardConstants(constants), [constants]);
  const overridesRef = useRef<string[]>([]);
  const pushLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, { level, message, timestamp: Date.now() }].slice(-200));
  }, []);

  const applyGraphAgent = useCallback((presetKey: GraphAgentPresetKey, surfaceKey: GraphSurfacePresetKey) => {
    const preset = GRAPH_AGENT_PRESETS[presetKey];
    const surface = GRAPH_SURFACE_PRESETS[surfaceKey];
    setSampling(s => ({
      ...s,
      ...preset.sampling,
      minimaSmoothing: surface.minimaSmoothing
    }));
    setRoughness(r => ({ ...r, ...preset.roughness }));
    setGridPointBudget(preset.gridPointBudget);
    setSmoothDisplay(surface.smoothDisplay);
  }, []);

  useEffect(() => {
    if (viewMode !== 'mesh') {
      setViewMode('mesh');
    }
  }, [viewMode]);

  useEffect(() => {
    applyGraphAgent(agentPreset, surfacePreset);
  }, [agentPreset, surfacePreset, applyGraphAgent]);

  useEffect(() => {
    const allowSingleWorker = useWorker && (!useParallelWorkers || workerCount <= 1);
    if (!allowSingleWorker) {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      return;
    }
    if (workerRef.current) return;
    workerRef.current = new Worker(new URL('./roughnessWorker.ts', import.meta.url), { type: 'module' });
    const worker = workerRef.current;
    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (!payload || payload.requestId !== requestIdRef.current) return;
      if (type === 'progress') {
        setProgress({ done: payload.done, total: payload.total });
      }
      if (type === 'result') {
        setGrid(payload.result);
        setStatus('idle');
      }
      if (type === 'error') {
        setStatus('error');
        setError(payload.message || 'Worker error');
        pushLog('error', payload.message || 'Worker error');
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [useWorker, useParallelWorkers, workerCount, pushLog]);

  const resolveAxes = useCallback((overrideTimbre?: TimbreConfig) => {
    const template = buildSpectrumTemplate(overrideTimbre ?? timbre);
    const heavy = template.usedCount * 3 > 90;
    let xSteps = sampling.resolutionMode === 'auto'
      ? (heavy ? sampling.autoLowSteps : sampling.autoHighSteps)
      : sampling.xSteps;
    let ySteps = sampling.resolutionMode === 'auto'
      ? (heavy ? sampling.autoLowSteps : sampling.autoHighSteps)
      : sampling.ySteps;
    xSteps = clamp(Math.round(xSteps), 8, sampling.maxSteps);
    ySteps = clamp(Math.round(ySteps), 8, sampling.maxSteps);
    const totalPoints = xSteps * ySteps;
    const safeGridBudget = clamp(Math.round(gridPointBudget), GRID_POINT_CAPS.quick, GRID_POINT_CAPS.extreme);
    if (totalPoints > safeGridBudget) {
      const scale = Math.sqrt(safeGridBudget / totalPoints);
      const nextX = Math.max(8, Math.floor(xSteps * scale));
      const nextY = Math.max(8, Math.floor(ySteps * scale));
      if (nextX !== xSteps || nextY !== ySteps) {
        xSteps = nextX;
        ySteps = nextY;
        overridesRef.current.push(`Grid steps capped to ${xSteps} x ${ySteps}`);
        pushLog('warn', `Grid steps capped to ${xSteps} x ${ySteps} for performance.`);
      }
    }
    const axesX = buildAxis(sampling.xRange[0], sampling.xRange[1], xSteps, sampling.logSampling);
    const axesY = buildAxis(sampling.yRange[0], sampling.yRange[1], ySteps, sampling.logSampling);
    let xs = axesX.values;
    let ys = axesY.values;

    if (sampling.refineFixed) {
      const common = [6 / 5, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 2 / 1];
      xs = refineAxisFixed(xs, common, sampling.refineBandCents, sampling.refineDensity);
      ys = refineAxisFixed(ys, common, sampling.refineBandCents, sampling.refineDensity);
    }

    if (sampling.foldOctave) {
      xs = uniqueSorted(xs.map(foldRatio));
      ys = uniqueSorted(ys.map(foldRatio));
    }

    if (sampling.refineGradient || sampling.refineMinima) {
      const baseSteps = Math.max(12, sampling.refineBaseSteps);
      const baseAxesX = buildAxis(sampling.xRange[0], sampling.xRange[1], baseSteps, sampling.logSampling);
      const baseAxesY = buildAxis(sampling.yRange[0], sampling.yRange[1], baseSteps, sampling.logSampling);
      const baseGrid = computeGrid({ ...config, axes: { xs: baseAxesX.values, ys: baseAxesY.values } });
      if (sampling.refineGradient) {
        const gradient = refineWithGradient(baseGrid, sampling.gradientThreshold);
        xs = refineAxisMidpoints(xs, gradient.indicesX);
        ys = refineAxisMidpoints(ys, gradient.indicesY);
      }
      if (sampling.refineMinima) {
        const refined = refineWithMinima(baseGrid, sampling.refineBandCents, sampling.refineDensity);
        xs = refined.xs;
        ys = refined.ys;
      }
    }

    return { xs, ys };
  }, [gridPointBudget, sampling, timbre, pushLog]);

  const terminateParallelWorkers = useCallback(() => {
    parallelWorkersRef.current.forEach(worker => worker.terminate());
    parallelWorkersRef.current = [];
  }, []);

  useEffect(() => () => terminateParallelWorkers(), [terminateParallelWorkers]);

  useEffect(() => {
    if (!useWorker || !useParallelWorkers) {
      terminateParallelWorkers();
    }
  }, [useWorker, useParallelWorkers, terminateParallelWorkers]);

  const runParallelCompute = useCallback((requestId: string, configOverride?: EngineConfig) => {
    const activeConfig = configOverride ?? config;
    const { xs, ys } = resolveAxes(activeConfig.timbre);
    const width = xs.length;
    const height = ys.length;
    const totalPoints = width * height;
    if (totalPoints === 0) {
      setGrid({
        xs,
        ys,
        logX: xs.map(v => Math.log(v)),
        logY: ys.map(v => Math.log(v)),
        raw: new Float64Array(0),
        normalized: new Float64Array(0),
        scalarField: activeConfig.scalarField,
        logSampling: activeConfig.sampling.logSampling,
        foldOctave: activeConfig.sampling.foldOctave,
        cellWidth: new Float64Array(0),
        cellHeight: new Float64Array(0),
        cellArea: new Float64Array(0),
        diagnostics: {
          points: 0,
          originalPartials: 0,
          prunedPartials: 0,
          invalidPartials: 0,
          skippedPairs: 0,
          totalPairs: 0,
          silentPoints: 0
        },
        normalizationMode: activeConfig.normalizationMode,
        minRaw: 0,
        maxRaw: 0,
        minNorm: 0,
        maxNorm: 0
      });
      setStatus('idle');
      return;
    }

    const tileSize = 32;
    const tiles: Array<{ xStart: number; yStart: number; width: number; height: number }> = [];
    for (let y = 0; y < height; y += tileSize) {
      for (let x = 0; x < width; x += tileSize) {
        tiles.push({
          xStart: x,
          yStart: y,
          width: Math.min(tileSize, width - x),
          height: Math.min(tileSize, height - y)
        });
      }
    }
    const totalTiles = tiles.length;
    setProgress({ done: 0, total: totalTiles });

    const raw = new Float64Array(totalPoints);
    const normalized = new Float64Array(totalPoints);
    const diagOriginal = new Uint16Array(totalPoints);
    const diagPruned = new Uint16Array(totalPoints);
    const diagInvalid = new Uint16Array(totalPoints);
    const diagSkipped = new Uint32Array(totalPoints);
    const diagTotal = new Uint32Array(totalPoints);
    const diagMaxPair = new Float64Array(totalPoints);

    let minRaw = Infinity;
    let maxRaw = -Infinity;
    let minNorm = Infinity;
    let maxNorm = -Infinity;

    let sumOriginal = 0;
    let sumPruned = 0;
    let sumInvalid = 0;
    let sumSkipped = 0;
    let sumTotal = 0;
    let silentPoints = 0;

    const configWithAxes: EngineConfig = { ...activeConfig, axes: { xs, ys } };
    const maxWorkers = clamp(Math.round(workerCount), 1, 12);
    const poolSize = Math.min(maxWorkers, tiles.length);
    if (poolSize <= 1) {
      const result = computeGrid(configWithAxes, (done, total) => setProgress({ done, total }));
      setGrid(result);
      setStatus('idle');
      return;
    }

    terminateParallelWorkers();
    const workers = Array.from({ length: poolSize }, () =>
      new Worker(new URL('./roughnessTileWorker.ts', import.meta.url), { type: 'module' })
    );
    parallelWorkersRef.current = workers;

    let completed = 0;
    let nextIndex = 0;
    let failed = false;

    const finalize = () => {
      terminateParallelWorkers();
      const summary = {
        points: totalPoints,
        originalPartials: totalPoints > 0 ? sumOriginal / totalPoints : 0,
        prunedPartials: totalPoints > 0 ? sumPruned / totalPoints : 0,
        invalidPartials: totalPoints > 0 ? sumInvalid / totalPoints : 0,
        skippedPairs: sumSkipped,
        totalPairs: sumTotal,
        silentPoints
      };
      const metricXs = activeConfig.sampling.logSampling ? xs.map(v => Math.log(v)) : xs;
      const metricYs = activeConfig.sampling.logSampling ? ys.map(v => Math.log(v)) : ys;
      const cellWidth = new Float64Array(width);
      const cellHeight = new Float64Array(height);
      for (let i = 0; i < width; i++) {
        if (width === 1) cellWidth[i] = 0;
        else if (i === 0) cellWidth[i] = metricXs[1] - metricXs[0];
        else if (i === width - 1) cellWidth[i] = metricXs[width - 1] - metricXs[width - 2];
        else cellWidth[i] = (metricXs[i + 1] - metricXs[i - 1]) / 2;
      }
      for (let j = 0; j < height; j++) {
        if (height === 1) cellHeight[j] = 0;
        else if (j === 0) cellHeight[j] = metricYs[1] - metricYs[0];
        else if (j === height - 1) cellHeight[j] = metricYs[height - 1] - metricYs[height - 2];
        else cellHeight[j] = (metricYs[j + 1] - metricYs[j - 1]) / 2;
      }
      const cellArea = new Float64Array(width * height);
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          cellArea[j * width + i] = cellWidth[i] * cellHeight[j];
        }
      }
      const safeMinRaw = Number.isFinite(minRaw) ? minRaw : 0;
      const safeMaxRaw = Number.isFinite(maxRaw) ? maxRaw : 0;
      const safeMinNorm = Number.isFinite(minNorm) ? minNorm : 0;
      const safeMaxNorm = Number.isFinite(maxNorm) ? maxNorm : 0;
      setGrid({
        xs,
        ys,
        logX: xs.map(v => Math.log(v)),
        logY: ys.map(v => Math.log(v)),
        raw,
        normalized,
        scalarField: activeConfig.scalarField,
        logSampling: activeConfig.sampling.logSampling,
        foldOctave: activeConfig.sampling.foldOctave,
        cellWidth,
        cellHeight,
        cellArea,
        diagOriginal,
        diagPruned,
        diagInvalid,
        diagSkipped,
        diagTotal,
        diagMaxPair,
        diagnostics: summary,
        normalizationMode: config.normalizationMode,
        minRaw: safeMinRaw,
        maxRaw: safeMaxRaw,
        minNorm: safeMinNorm,
        maxNorm: safeMaxNorm
      });
      setStatus('idle');
    };

    const dispatch = (worker: Worker) => {
      if (failed) return;
      const tile = tiles[nextIndex];
      if (!tile) return;
      const tileId = nextIndex;
      nextIndex += 1;
      worker.postMessage({
        type: 'tile',
        payload: { requestId, tileId, config: configWithAxes, tile }
      });
    };

    workers.forEach(worker => {
      worker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data || {};
        if (!payload || payload.requestId !== requestId || payload.requestId !== requestIdRef.current) return;
        if (type === 'tileResult') {
          const tile = payload.tile as { xStart: number; yStart: number; width: number; height: number };
          const tileWidth = tile.width;
          const tileHeight = tile.height;
          for (let yy = 0; yy < tileHeight; yy++) {
            for (let xx = 0; xx < tileWidth; xx++) {
              const dst = (tile.yStart + yy) * width + (tile.xStart + xx);
              const src = yy * tileWidth + xx;
              const rawVal = payload.raw[src];
              const normVal = payload.normalized[src];
              raw[dst] = rawVal;
              normalized[dst] = normVal;
              if (Number.isFinite(rawVal)) {
                minRaw = Math.min(minRaw, rawVal);
                maxRaw = Math.max(maxRaw, rawVal);
              }
              if (Number.isFinite(normVal)) {
                minNorm = Math.min(minNorm, normVal);
                maxNorm = Math.max(maxNorm, normVal);
              }
              diagOriginal[dst] = payload.diagOriginal[src];
              diagPruned[dst] = payload.diagPruned[src];
              diagInvalid[dst] = payload.diagInvalid[src];
              diagSkipped[dst] = payload.diagSkipped[src];
              diagTotal[dst] = payload.diagTotal[src];
              diagMaxPair[dst] = payload.diagMaxPair[src];
            }
          }
          if (payload.diagnostics) {
            sumOriginal += payload.diagnostics.originalPartials || 0;
            sumPruned += payload.diagnostics.prunedPartials || 0;
            sumInvalid += payload.diagnostics.invalidPartials || 0;
            sumSkipped += payload.diagnostics.skippedPairs || 0;
            sumTotal += payload.diagnostics.totalPairs || 0;
            silentPoints += payload.diagnostics.silentPoints || 0;
          }
          completed += 1;
          setProgress({ done: completed, total: totalTiles });
          if (completed >= totalTiles) {
            finalize();
          } else {
            dispatch(worker);
          }
        }
        if (type === 'error') {
          failed = true;
          terminateParallelWorkers();
          setStatus('error');
          setError(payload.message || 'Tile worker error');
          pushLog('error', payload.message || 'Tile worker error');
        }
      };
      worker.onerror = () => {
        if (failed) return;
        failed = true;
        terminateParallelWorkers();
        setStatus('error');
        setError('Tile worker crashed');
        pushLog('error', 'Tile worker crashed');
      };
      dispatch(worker);
    });
  }, [config, resolveAxes, terminateParallelWorkers, workerCount, pushLog]);

  const compute = useCallback(() => {
    try {
      validateConstants(constants);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Invalid roughness constants');
      return;
    }
    overridesRef.current = [];
    let configToUse = config;
    const maxPartials = Math.min(config.timbre.maxPartials, RESOURCE_LIMITS.maxPartials);
    const safePartialCount = Math.min(config.timbre.partialCount, maxPartials);
    if (maxPartials !== config.timbre.maxPartials || safePartialCount !== config.timbre.partialCount) {
      configToUse = {
        ...config,
        timbre: {
          ...config.timbre,
          maxPartials,
          partialCount: safePartialCount
        }
      };
      const note = `Partials capped to ${safePartialCount} (max ${maxPartials}).`;
      overridesRef.current.push(note);
      pushLog('warn', note);
    }
    const templatePreview = buildSpectrumTemplate(configToUse.timbre);
    if (templatePreview.usedCount <= 1) {
      pushLog('warn', 'Spectrum has only one partial; terrain may be nearly flat.');
    }
    setStatus('computing');
    setError('');
    setProgress({ done: 0, total: 0 });
    computeStartRef.current = Date.now();
    pushLog('info', `Compute started for ${configToUse.timbre.preset} at ${baseFreq} Hz.`);
    if (sampling.progressiveRefine) {
      try {
        const coarseSteps = Math.max(16, Math.round(sampling.progressiveSteps));
        const axes = {
          xs: buildAxis(sampling.xRange[0], sampling.xRange[1], coarseSteps, sampling.logSampling).values,
          ys: buildAxis(sampling.yRange[0], sampling.yRange[1], coarseSteps, sampling.logSampling).values
        };
        const coarse = computeGrid({ ...configToUse, axes });
        setGrid(coarse);
        pushLog('info', `Progressive coarse grid ${coarseSteps} x ${coarseSteps} ready.`);
      } catch (err) {
        pushLog('warn', err instanceof Error ? err.message : 'Failed to compute progressive coarse grid.');
      }
    }
    terminateParallelWorkers();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    requestIdRef.current = requestId;
    if (useWorker) {
      if (useParallelWorkers && workerCount > 1) {
        runParallelCompute(requestId, configToUse);
        return;
      }
      if (workerRef.current) {
        const { xs, ys } = resolveAxes(configToUse.timbre);
        workerRef.current.postMessage({ type: 'compute', payload: { ...configToUse, axes: { xs, ys }, requestId } });
        return;
      }
    }
    try {
      const { xs, ys } = resolveAxes(configToUse.timbre);
      const result = computeGrid({ ...configToUse, axes: { xs, ys } }, (done, total) => {
        setProgress({ done, total });
      });
      setGrid(result);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Compute error');
    }
  }, [config, constants, resolveAxes, runParallelCompute, sampling, terminateParallelWorkers, useParallelWorkers, useWorker, workerCount, pushLog]);

  useEffect(() => {
    if (!autoCompute) return;
    const handle = setTimeout(() => {
      compute();
    }, 200);
    return () => clearTimeout(handle);
  }, [autoCompute, compute]);

  const cancelCompute = useCallback(() => {
    const requestId = requestIdRef.current;
    if (useWorker && workerRef.current) {
      workerRef.current.postMessage({ type: 'cancel', payload: { requestId } });
    }
    if (useParallelWorkers && parallelWorkersRef.current.length) {
      parallelWorkersRef.current.forEach(worker => {
        worker.postMessage({ type: 'cancel', payload: { requestId } });
      });
      terminateParallelWorkers();
    }
    requestIdRef.current = '';
    setStatus('idle');
    setProgress({ done: 0, total: 0 });
    pushLog('info', 'Compute canceled.');
  }, [pushLog, terminateParallelWorkers, useParallelWorkers, useWorker]);

  useEffect(() => {
    if (status === 'idle' && grid && computeStartRef.current) {
      const elapsed = Date.now() - computeStartRef.current;
      pushLog('info', `Compute finished in ${(elapsed / 1000).toFixed(2)}s.`);
      computeStartRef.current = null;
    }
  }, [grid, pushLog, status]);

  useEffect(() => {
    if (!grid) return;
    pushLog('info', `Grid ready: ${grid.xs.length} x ${grid.ys.length}.`);
  }, [grid, pushLog]);

  useEffect(() => {
    if (!grid) return;
    if (lockColorRange) return;
    const rawMin = grid.minRaw ?? 0;
    const rawMax = grid.maxRaw ?? 0;
    const normMin = grid.minNorm ?? 0;
    const normMax = grid.maxNorm ?? 0;
    const current = colorRangeRef.current ?? {
      rawMin,
      rawMax,
      normMin,
      normMax
    };
    current.rawMin = Math.min(current.rawMin, rawMin);
    current.rawMax = Math.max(current.rawMax, rawMax);
    current.normMin = Math.min(current.normMin, normMin);
    current.normMax = Math.max(current.normMax, normMax);
    colorRangeRef.current = current;
  }, [grid, lockColorRange]);

  useEffect(() => {
    if (!grid) return;
    const requested = roughness.symmetrySampleCount ?? (roughness.precisionCheck ? roughness.precisionCheckSamples : 0);
    if (!requested || requested <= 0) return;
    const tol = roughness.symmetryTolerance ?? 1e-6;
    const result = symmetryCheck(grid, requested, tol, scalarFieldMode);
    if (!result.passed) {
      pushLog('warn', `Symmetry check failed: max error ${result.maxError.toExponential(2)} (avg ${result.averageError.toExponential(2)}).`);
    } else if (roughness.precisionCheck) {
      pushLog('info', `Symmetry check passed (max ${result.maxError.toExponential(2)}).`);
    }
  }, [grid, pushLog, roughness.precisionCheck, roughness.precisionCheckSamples, roughness.symmetrySampleCount, roughness.symmetryTolerance, scalarFieldMode]);

  const analysis = useMemo(() => {
    if (!grid) return null;
    const gradients = computeGradients(grid, scalarFieldMode);
    const normals = computeNormals(gradients.dx, gradients.dy);
    const ao = computeAO(grid, aoStrength, scalarFieldMode);
    const minima = detectMinimaDetailed(grid, {
      neighborhood: sampling.minimaNeighborhood,
      smoothIterations: sampling.minimaSmoothing,
      useLaplacian: true,
      minLaplacian: 0,
      minDepth: 0,
      field: scalarFieldMode,
      boundaryPolicy: 'skip',
      connectivity: 8
    }).slice(0, Math.max(1, minimaCount));
    const withRationals = annotateMinimaWithRationals(minima, 32, true, 'denominator');
    const axisX = grid.logSampling ? grid.logX : grid.xs;
    const axisY = grid.logSampling ? grid.logY : grid.ys;
    const spanX = axisX.length > 1 ? axisX[axisX.length - 1] - axisX[0] : 0;
    const spanY = axisY.length > 1 ? axisY[axisY.length - 1] - axisY[0] : 0;
    const basinMaxRadius = Number.isFinite(spanX) && Number.isFinite(spanY) ? 0.5 * Math.hypot(spanX, spanY) : Infinity;
    const basins = estimateBasins(grid, withRationals, {
      thresholdStd: 0.15,
      maxRadius: basinMaxRadius,
      useEightNeighbors: true,
      field: scalarFieldMode,
      boundaryPolicy: 'skip',
      localRadius: 2
    });
    const finalMinima = minimaRefined ?? basins;
    const maxima = detectMaxima(grid, sampling.minimaNeighborhood, sampling.minimaSmoothing, scalarFieldMode).slice(0, 6);
    const minField = scalarFieldMode === 'raw' ? (grid.minRaw ?? 0) : (grid.minNorm ?? 0);
    const maxField = scalarFieldMode === 'raw' ? (grid.maxRaw ?? 1) : (grid.maxNorm ?? 1);
    const contours = showContours
      ? buildContours(grid, [0.2, 0.4, 0.6, 0.8].map(t => minField + t * (maxField - minField)), scalarFieldMode)
      : [];
    return { gradients, normals, ao, minima: finalMinima, maxima, contours };
  }, [
    grid,
    aoStrength,
    sampling.minimaNeighborhood,
    sampling.minimaSmoothing,
    minimaCount,
    scalarFieldMode,
    showContours,
    minimaRefined,
    analysisSeed
  ]);

  const displayValues = useMemo(() => {
    if (!grid) return null;
    if (!smoothDisplay) return selectValues(grid, scalarFieldMode);
    return smoothGrid(grid, 1, scalarFieldMode);
  }, [grid, smoothDisplay, scalarFieldMode]);

  const derivedScale = useMemo(() => {
    if (!analysis) return [];
    return buildScaleFromMinima(analysis.minima, 1, 12);
  }, [analysis]);

  const inharmonicSpectrum = useMemo(() => {
    const template = buildSpectrumTemplate(timbre);
    return Array.from(template.ratios).some(ratio => Math.abs(ratio - Math.round(ratio)) > 1e-6);
  }, [timbre]);

  useEffect(() => {
    setMinimaRefined(null);
  }, [grid]);

  useEffect(() => {
    setMinimaRefined(null);
  }, [analysisSeed]);

  useEffect(() => {
    setScaleComparison(null);
    setTimbreSuggestions([]);
  }, [grid]);

  useEffect(() => {
    const range = sliceAxis === 'x' ? sampling.xRange : sampling.yRange;
    setSliceRatio(prev => clamp(prev, range[0], range[1]));
  }, [sampling.xRange, sampling.yRange, sliceAxis]);

  const hoverRefineTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!scaleComparison || !scaleComparison.worst.length) return;
    const worst = scaleComparison.worst[0];
    try {
      const result = computeSinglePoint(config, worst.x, worst.y, 8);
      const topPairs = result.diagnostics.topPairs || [];
      setTimbreSuggestions(buildTimbreSuggestions(topPairs, baseFreq));
    } catch (err) {
      pushLog('warn', err instanceof Error ? err.message : 'Failed to analyze worst point.');
    }
  }, [baseFreq, config, pushLog, scaleComparison]);

  const pinPoint = useCallback((point: { x: number; y: number; raw: number; normalized: number; value: number; field: TerrainScalarField }) => {
    if (!pinningEnabled) return;
    const rx = approximateRatio(point.x, 32, true, 'denominator');
    const ry = approximateRatio(point.y, 32, true, 'denominator');
    const stamp = Date.now();
    const seq = (pinCounterRef.current = (pinCounterRef.current + 1) % 1_000_000);
    setPinnedPoints(prev => [
      ...prev,
      {
        id: `${point.x}-${point.y}-${stamp}-${seq}`,
        x: point.x,
        y: point.y,
        raw: point.raw,
        normalized: point.normalized,
        value: point.value,
        field: point.field,
        timestamp: stamp,
        rationalX: `${rx.num}/${rx.den}`,
        rationalY: `${ry.num}/${ry.den}`,
        rationalErrorX: rx.error,
        rationalErrorY: ry.error
      }
    ]);
    pushLog('info', `Pinned ratio ${point.x.toFixed(4)} / ${point.y.toFixed(4)}.`);
  }, [pinningEnabled, pushLog]);

  const pinMinima = useCallback((min: MinimaPoint) => {
    if (!grid) return;
    const raw = sampleGridValue(grid, min.x, min.y, 'raw') ?? min.roughness;
    const normalized = sampleGridValue(grid, min.x, min.y, 'normalized') ?? min.roughness;
    const value = sampleGridValue(grid, min.x, min.y, scalarFieldMode) ?? min.roughness;
    pinPoint({ x: min.x, y: min.y, raw, normalized, value, field: scalarFieldMode });
  }, [grid, pinPoint, scalarFieldMode]);

  const refineMinimaLocal = useCallback(() => {
    if (!grid || !analysis) return;
    const token = (minimaRefineTokenRef.current += 1);
    setMinimaRefining(true);

    const refined: MinimaPoint[] = [];
    const window = Math.max(0.001, sampling.progressiveWindow);
    const steps = Math.max(12, Math.round(sampling.progressiveSteps));
    const field = scalarFieldMode;
    const useLog = sampling.logSampling;
    const axisX = grid.logSampling ? grid.logX : grid.xs;
    const axisY = grid.logSampling ? grid.logY : grid.ys;
    const spanX = axisX.length > 1 ? axisX[axisX.length - 1] - axisX[0] : 0;
    const spanY = axisY.length > 1 ? axisY[axisY.length - 1] - axisY[0] : 0;
    const basinMaxRadius = Number.isFinite(spanX) && Number.isFinite(spanY) ? 0.5 * Math.hypot(spanX, spanY) : Infinity;

    const xMin = sampling.xRange[0];
    const xMax = sampling.xRange[1];
    const yMin = sampling.yRange[0];
    const yMax = sampling.yRange[1];

    const toMetric = useLog ? Math.log : (v: number) => v;
    const fromMetric = useLog ? Math.exp : (v: number) => v;
    const tXMin = toMetric(xMin);
    const tXMax = toMetric(xMax);
    const tYMin = toMetric(yMin);
    const tYMax = toMetric(yMax);

    const evalPoint = (x: number, y: number) => {
      try {
        const result = computeSinglePoint(config, x, y);
        const value = field === 'raw' ? result.raw : result.normalized;
        return Number.isFinite(value) ? value : null;
      } catch {
        return null;
      }
    };

    const refinePoint = (startX: number, startY: number, fallback: number) => {
      let sx = clamp(startX, xMin, xMax);
      let sy = clamp(startY, yMin, yMax);
      let tx = toMetric(sx);
      let ty = toMetric(sy);

      const loX = toMetric(clamp(sx - window, xMin, xMax));
      const hiX = toMetric(clamp(sx + window, xMin, xMax));
      const loY = toMetric(clamp(sy - window, yMin, yMax));
      const hiY = toMetric(clamp(sy + window, yMin, yMax));
      const boundXMin = Math.min(loX, hiX);
      const boundXMax = Math.max(loX, hiX);
      const boundYMin = Math.min(loY, hiY);
      const boundYMax = Math.max(loY, hiY);

      let delta = Math.min(Math.abs(hiX - tx), Math.abs(tx - loX), Math.abs(hiY - ty), Math.abs(ty - loY));
      if (!Number.isFinite(delta) || delta <= 0) {
        delta = Math.max((tXMax - tXMin) / 512, (tYMax - tYMin) / 512, 1e-6);
      }

      let bestX = sx;
      let bestY = sy;
      let bestV = evalPoint(bestX, bestY) ?? fallback;

      for (let iter = 0; iter < steps; iter++) {
        if (token !== minimaRefineTokenRef.current) return null;
        let improved = false;
        let nextX = bestX;
        let nextY = bestY;
        let nextV = bestV;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ntx = clamp(tx + dx * delta, boundXMin, boundXMax);
            const nty = clamp(ty + dy * delta, boundYMin, boundYMax);
            const nx = fromMetric(ntx);
            const ny = fromMetric(nty);
            const v = evalPoint(nx, ny);
            if (v === null) continue;
            if (v < nextV) {
              nextV = v;
              nextX = nx;
              nextY = ny;
              improved = true;
            }
          }
        }

        if (!improved) {
          delta *= 0.5;
          if (delta <= 1e-8) break;
        } else {
          bestX = nextX;
          bestY = nextY;
          bestV = nextV;
          tx = toMetric(bestX);
          ty = toMetric(bestY);
        }
      }

      return { x: bestX, y: bestY, roughness: bestV };
    };

    analysis.minima.slice(0, minimaCount).forEach((min, idx) => {
      if (token !== minimaRefineTokenRef.current) return;
      const result = refinePoint(min.x, min.y, min.roughness);
      if (!result) return;
      const sample = sampleGrid(grid, result.x, result.y, { field, clamp: true });
      refined.push({
        ...min,
        x: result.x,
        y: result.y,
        roughness: result.roughness,
        refined: true,
        refinePasses: (min.refinePasses ?? 0) + 1,
        refineSteps: steps,
        ix: sample?.ix ?? min.ix,
        iy: sample?.iy ?? min.iy
      });
      if (idx === 0) {
        pushLog('info', `Refined minima window ${window.toFixed(4)} with ${steps} steps.`);
      }
    });

    if (token !== minimaRefineTokenRef.current) return;
    const withRationals = annotateMinimaWithRationals(refined, 32, true, 'denominator');
    const withBasins = estimateBasins(grid, withRationals, {
      thresholdStd: 0.15,
      maxRadius: basinMaxRadius,
      useEightNeighbors: true,
      field: scalarFieldMode,
      boundaryPolicy: 'skip',
      localRadius: 2
    });
    setMinimaRefined(withBasins);
    setMinimaRefining(false);
  }, [analysis, config, grid, minimaCount, pushLog, sampling.logSampling, sampling.progressiveSteps, sampling.progressiveWindow, sampling.xRange, sampling.yRange, scalarFieldMode]);

  const refineMinimaLocalRef = useRef(refineMinimaLocal);
  useEffect(() => {
    refineMinimaLocalRef.current = refineMinimaLocal;
  }, [refineMinimaLocal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sampling.progressiveRefine || !hoverInfo || !hoverLocked) return;
    if (hoverRefineTimer.current) window.clearTimeout(hoverRefineTimer.current);
    hoverRefineTimer.current = window.setTimeout(() => {
      refineMinimaLocalRef.current();
    }, 800);
    return () => {
      if (hoverRefineTimer.current) window.clearTimeout(hoverRefineTimer.current);
    };
  }, [hoverInfo, hoverLocked, sampling.progressiveRefine]);

  const resolveScaleRatios = useCallback(() => {
    if (scalePresetName === 'Custom') {
      const parsed = parseScaleText(customScaleText);
      return parsed.length ? parsed : [];
    }
    const preset = SCALE_PRESETS.find(p => p.name === scalePresetName);
    return preset ? preset.ratios : [];
  }, [customScaleText, scalePresetName]);

  const runScaleComparison = useCallback(() => {
    if (!grid) return;
    const ratios = resolveScaleRatios();
    if (ratios.length < 2) {
      pushLog('warn', 'Scale comparison requires at least two ratios.');
      return;
    }
    const result = compareScaleToGrid(grid, ratios, scalarFieldMode, scaleWorstCount);
    setScaleComparison(result);
    pushLog('info', `Scale comparison: ${ratios.length} ratios, worst ${Math.max(1, scaleWorstCount)}.`);
  }, [grid, pushLog, resolveScaleRatios, scalarFieldMode, scaleWorstCount]);

  const runParameterScan = useCallback(() => {
    const steps = Math.max(2, Math.round(scanSteps));
    const half = Math.floor(steps / 2);
    const values = (center: number) => Array.from({ length: steps }, (_, i) => center + (i - half) * scanDelta);
    const listA = values(constants.a).filter(v => v > 0);
    const listB = values(constants.b).filter(v => v > 0);
    const axes = {
      xs: buildAxis(sampling.xRange[0], sampling.xRange[1], Math.min(32, sampling.xSteps), sampling.logSampling).values,
      ys: buildAxis(sampling.yRange[0], sampling.yRange[1], Math.min(32, sampling.ySteps), sampling.logSampling).values
    };
    const results: string[] = [];
    listA.forEach(a => {
      listB.forEach(b => {
        const grid = computeGrid({ ...config, constants: { ...constants, a, b }, axes });
        results.push(`a=${a.toFixed(3)}, b=${b.toFixed(3)} -> min ${grid.minNorm?.toFixed(5)} max ${grid.maxNorm?.toFixed(5)}`);
      });
    });
    setScanResults(results);
    pushLog('info', `Parameter scan complete (${results.length} combinations).`);
  }, [config, constants, pushLog, sampling.logSampling, sampling.xRange, sampling.xSteps, sampling.yRange, sampling.ySteps, scanDelta, scanSteps]);

  const renderHeightmap = useCallback((canvas: HTMLCanvasElement | null, force = false) => {
    if (!canvas) return;
    if (!grid || !analysis) return;
    if (!force && viewMode !== 'heightmap') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = grid.xs.length;
    const height = grid.ys.length;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const img = ctx.createImageData(width, height);
    const { low, high } = COLOR_RAMPS[colorRamp];
    const zClampValue = Math.max(0.05, zClamp);
    const field = scalarFieldMode;
    const values = displayValues || selectValues(grid, field);
    const range = colorRangeRef.current;
    const minField = field === 'raw' ? (range?.rawMin ?? grid.minRaw ?? 0) : (range?.normMin ?? grid.minNorm ?? 0);
    const maxField = field === 'raw' ? (range?.rawMax ?? grid.maxRaw ?? zClampValue) : (range?.normMax ?? grid.maxNorm ?? zClampValue);
    const min = normalizeDisplay ? minField : (field === 'raw' ? minField : 0);
    const max = normalizeDisplay ? maxField : zClampValue;
    const denom = Math.max(1e-9, max - min);
    const observedMin = minField;
    const observedMax = Math.min(max, maxField);
    const pivotValue = (observedMin + observedMax) * 0.5;
    const pivotNorm = clamp((pivotValue - min) / denom, 0, 1);
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        const value = clamp((values[idx] - min) / denom, 0, 1);
        const vCurve = applyHeightContrast(value, pivotNorm, heightGamma);
        const color = mixColor(low, high, Math.pow(vCurve, 0.8));
        let finalShade = 1;
        if (!heightOnlyColor) {
          let shade = 1;
          if (enableLighting) {
            const normal = [
              analysis.normals[idx * 3],
              analysis.normals[idx * 3 + 1],
              analysis.normals[idx * 3 + 2]
            ];
            const light = [0.4, 0.3, 0.85];
            const dot = clamp(
              normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2],
              0,
              1
            );
            shade = 0.35 + 0.65 * dot;
          }
          const ao = enableAO ? analysis.ao[idx] : 1;
          finalShade = clamp(shade * ao, 0, 1.2);
        }
        const px = heightmapFlipX ? width - 1 - i : i;
        const py = heightmapFlipY ? j : height - 1 - j;
        const p = py * width * 4 + px * 4;
        img.data[p] = clamp(color[0] * finalShade, 0, 255);
        img.data[p + 1] = clamp(color[1] * finalShade, 0, 255);
        img.data[p + 2] = clamp(color[2] * finalShade, 0, 255);
        img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const xMin = grid.xs[0];
    const xMax = grid.xs[grid.xs.length - 1];
    const yMin = grid.ys[0];
    const yMax = grid.ys[grid.ys.length - 1];
    const mapToCanvas = (xVal: number, yVal: number) => {
      const xn = (xVal - xMin) / (xMax - xMin || 1);
      const yn = (yVal - yMin) / (yMax - yMin || 1);
      const xN = heightmapFlipX ? 1 - xn : xn;
      const yN = heightmapFlipY ? yn : 1 - yn;
      return { x: xN * width, y: yN * height };
    };

    if (showContours && analysis.contours.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.6;
      analysis.contours.forEach(contour => {
        contour.segments.forEach(seg => {
          const p0 = mapToCanvas(seg.x1, seg.y1);
          const p1 = mapToCanvas(seg.x2, seg.y2);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        });
      });
    }

    if (showMinima && analysis.minima.length > 0) {
      ctx.strokeStyle = 'rgba(0,255,255,0.8)';
      analysis.minima.forEach(min => {
        const xIndex = grid.xs.findIndex(v => Math.abs(v - min.x) < 1e-6);
        const yIndex = grid.ys.findIndex(v => Math.abs(v - min.y) < 1e-6);
        if (xIndex < 0 || yIndex < 0) return;
        const x = heightmapFlipX ? width - 1 - xIndex : xIndex;
        const y = heightmapFlipY ? yIndex : height - 1 - yIndex;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    if (analysis.maxima.length > 0) {
      ctx.strokeStyle = 'rgba(255,120,120,0.8)';
      analysis.maxima.forEach(max => {
        const xIndex = grid.xs.findIndex(v => Math.abs(v - max.x) < 1e-6);
        const yIndex = grid.ys.findIndex(v => Math.abs(v - max.y) < 1e-6);
        if (xIndex < 0 || yIndex < 0) return;
        const x = heightmapFlipX ? width - 1 - xIndex : xIndex;
        const y = heightmapFlipY ? yIndex : height - 1 - yIndex;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    if (showWorst && scaleComparison?.worst?.length) {
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      scaleComparison.worst.forEach(point => {
        const xIndex = grid.xs.findIndex(v => Math.abs(v - point.x) < 1e-6);
        const yIndex = grid.ys.findIndex(v => Math.abs(v - point.y) < 1e-6);
        if (xIndex < 0 || yIndex < 0) return;
        const x = heightmapFlipX ? width - 1 - xIndex : xIndex;
        const y = heightmapFlipY ? yIndex : height - 1 - yIndex;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    if (showPinnedPath && pinnedPoints.length > 1) {
      ctx.strokeStyle = 'rgba(120,200,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      pinnedPoints.forEach((point, idx) => {
        const xIndex = grid.xs.findIndex(v => Math.abs(v - point.x) < 1e-6);
        const yIndex = grid.ys.findIndex(v => Math.abs(v - point.y) < 1e-6);
        if (xIndex < 0 || yIndex < 0) return;
        const x = heightmapFlipX ? width - 1 - xIndex : xIndex;
        const y = heightmapFlipY ? yIndex : height - 1 - yIndex;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    if (pinnedPoints.length) {
      ctx.fillStyle = 'rgba(120,200,255,0.9)';
      pinnedPoints.forEach(point => {
        const xIndex = grid.xs.findIndex(v => Math.abs(v - point.x) < 1e-6);
        const yIndex = grid.ys.findIndex(v => Math.abs(v - point.y) < 1e-6);
        if (xIndex < 0 || yIndex < 0) return;
        const x = heightmapFlipX ? width - 1 - xIndex : xIndex;
        const y = heightmapFlipY ? yIndex : height - 1 - yIndex;
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [grid, analysis, colorRamp, zClamp, heightGamma, heightOnlyColor, enableLighting, enableAO, viewMode, showContours, showMinima, displayValues, normalizeDisplay, showWorst, scaleComparison, pinnedPoints, showPinnedPath, colorRangeVersion, lockColorRange, scalarFieldMode, heightmapFlipX, heightmapFlipY]);

  useEffect(() => {
    renderHeightmap(canvasRef.current);
    if (viewMode === 'mesh' && showProjectionOverlay) {
      if (!projectionCanvasRef.current && typeof document !== 'undefined') {
        projectionCanvasRef.current = document.createElement('canvas');
      }
      renderHeightmap(projectionCanvasRef.current, true);
    }
  }, [renderHeightmap, showProjectionOverlay, viewMode]);

  const drawSlice = useCallback(() => {
    if (!grid) return;
    const canvas = sliceCanvasRef.current;
    if (!canvas) return;
    if (typeof window === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const field = scalarFieldMode;
    const minField = field === 'raw' ? (grid.minRaw ?? 0) : (grid.minNorm ?? 0);
    const maxField = field === 'raw' ? (grid.maxRaw ?? 1) : (grid.maxNorm ?? 1);
    const denom = Math.max(1e-9, maxField - minField);
    const axisValues = sliceAxis === 'x' ? grid.ys : grid.xs;
    const fixed = sliceAxis === 'x' ? clamp(sliceRatio, sampling.xRange[0], sampling.xRange[1]) : clamp(sliceRatio, sampling.yRange[0], sampling.yRange[1]);
    const samples = axisValues.map((v) => {
      const x = sliceAxis === 'x' ? fixed : v;
      const y = sliceAxis === 'x' ? v : fixed;
      const value = sampleGridValue(grid, x, y, scalarFieldMode);
      return value ?? minField;
    });
    const width = canvas.clientWidth || 260;
    const height = canvas.clientHeight || 120;
    canvas.width = width * (window.devicePixelRatio || 1);
    canvas.height = height * (window.devicePixelRatio || 1);
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#7cc8ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    samples.forEach((val, idx) => {
      const x = (idx / Math.max(1, samples.length - 1)) * width;
      const t = clamp((val - minField) / denom, 0, 1);
      const y = height - t * height;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [grid, sampling.xRange, sampling.yRange, sliceAxis, sliceRatio, scalarFieldMode]);

  useEffect(() => {
    drawSlice();
  }, [drawSlice]);

  const downloadText = useCallback((filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadBinary = useCallback((filename: string, buffer: ArrayBuffer) => {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const resetColorRange = useCallback(() => {
    if (!grid) return;
    colorRangeRef.current = {
      rawMin: grid.minRaw ?? 0,
      rawMax: grid.maxRaw ?? 0,
      normMin: grid.minNorm ?? 0,
      normMax: grid.maxNorm ?? 0
    };
    setColorRangeVersion(v => v + 1);
  }, [grid]);

  const buildReport = useCallback(() => {
    const lines: string[] = [];
    lines.push('Roughness Terrain Report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('Parameters');
    lines.push(`Base frequency: ${baseFreq}`);
    lines.push(`Preset: ${timbre.preset}`);
    lines.push(`Partial count: ${timbre.partialCount}`);
    lines.push(`Max partials: ${timbre.maxPartials}`);
    if (customFileName) lines.push(`Custom spectrum file: ${customFileName}`);
    lines.push(`Merge close partials: ${timbre.mergeClosePartials} (tol ${timbre.mergeTolerance})`);
    lines.push(`Amplitude normalization: ${timbre.amplitudeNormalization}`);
    lines.push(`Amplitude compression: ${timbre.amplitudeCompression} (amount ${timbre.amplitudeCompressionAmount})`);
    lines.push(`Triad energy mode: ${timbre.triadEnergyMode}`);
    lines.push(`Scale preset: ${scalePresetName}`);
    lines.push(`Scalar field (analysis/display): ${scalarFieldMode}`);
    lines.push(`Normalization mode: ${normalizationMode}`);
    if (normalizationMode === 'energy') {
      lines.push('Normalization basis: per-point energy (fallback to 0 when energy <= 0)');
    } else if (normalizationMode === 'max') {
      lines.push('Normalization basis: per-point max amplitude squared (fallback to 0 when max <= 0)');
    } else if (normalizationMode === 'reference') {
      lines.push('Normalization basis: reference roughness at ratio 1/1 (fallback to 1 when reference <= 0)');
    } else {
      lines.push('Normalization basis: none');
    }
    lines.push(`Performance mode: ${roughness.performanceMode ?? false}`);
    lines.push(`Graph agent: ${GRAPH_AGENT_PRESETS[agentPreset].label} / ${GRAPH_SURFACE_PRESETS[surfacePreset].label}`);
    lines.push(`Grid point budget: ${gridPointBudget}`);
    lines.push(`Mesh zoom: ${meshZoom.toFixed(2)}`);
    lines.push(`Height contrast gamma: ${heightGamma.toFixed(2)}`);
    lines.push(`Color range lock: ${lockColorRange}`);
    lines.push(`Projection plane: ${showProjectionOverlay} (${projectionMode})`);
    lines.push(`2D orientation: flipX ${heightmapFlipX}, flipY ${heightmapFlipY}`);
    if (colorRangeRef.current) {
      lines.push(`Color range raw: ${colorRangeRef.current.rawMin.toFixed(6)} - ${colorRangeRef.current.rawMax.toFixed(6)}`);
      lines.push(`Color range norm: ${colorRangeRef.current.normMin.toFixed(6)} - ${colorRangeRef.current.normMax.toFixed(6)}`);
    }
    lines.push(`Grid range X: ${sampling.xRange.join(' - ')}`);
    lines.push(`Grid range Y: ${sampling.yRange.join(' - ')}`);
    lines.push(`Grid steps: ${grid?.xs.length || sampling.xSteps} x ${grid?.ys.length || sampling.ySteps}`);
    lines.push(`Resolution mode: ${sampling.resolutionMode} (auto ${sampling.autoLowSteps}/${sampling.autoHighSteps}, max ${sampling.maxSteps})`);
    lines.push(`Log sampling: ${sampling.logSampling}`);
    lines.push(`Fold octave: ${sampling.foldOctave}`);
    lines.push(`Progressive refine: ${sampling.progressiveRefine} (window ${sampling.progressiveWindow}, steps ${sampling.progressiveSteps})`);
    lines.push(`Minima detection: neighborhood ${sampling.minimaNeighborhood}, smoothing ${sampling.minimaSmoothing}, connectivity 8, boundary skip`);
    lines.push('Basin estimation: thresholdStd 0.15, localRadius 2, maxRadius 0 (unbounded), boundary skip');
    lines.push(`Constants: a=${constants.a}, b=${constants.b}, dStar=${constants.dStar}, s1=${constants.s1}, s2=${constants.s2}`);
    lines.push('');
    if (grid) {
      lines.push('Diagnostics');
      lines.push(`Points: ${grid.diagnostics.points}`);
      lines.push(`Avg partials: ${grid.diagnostics.prunedPartials.toFixed(2)}`);
      lines.push(`Skipped pairs: ${grid.diagnostics.skippedPairs}`);
      lines.push(`Silent points: ${grid.diagnostics.silentPoints}`);
      lines.push(`Min raw/max raw: ${(grid.minRaw ?? 0).toFixed(6)} / ${(grid.maxRaw ?? 0).toFixed(6)}`);
      lines.push(`Min norm/max norm: ${(grid.minNorm ?? 0).toFixed(6)} / ${(grid.maxNorm ?? 0).toFixed(6)}`);
      lines.push('');
    }
    if (analysis?.minima.length) {
      lines.push('Top minima');
      analysis.minima.slice(0, Math.min(10, analysis.minima.length)).forEach((m, idx) => {
        lines.push(`${idx + 1}. ${m.x.toFixed(5)} / ${m.y.toFixed(5)} = ${m.roughness.toFixed(6)} (${m.rationalX || '-'} / ${m.rationalY || '-'})`);
      });
      lines.push('');
    }
    if (derivedScale.length) {
      lines.push('Derived scale ratios');
      derivedScale.forEach((ratio, idx) => {
        lines.push(`${idx + 1}. ${ratio.toFixed(6)}`);
      });
      lines.push('');
    }
    if (scaleComparison) {
      lines.push('Scale comparison');
      lines.push(`Worst count: ${scaleComparison.worst.length}`);
      lines.push(`Average roughness: ${scaleComparison.average.toFixed(6)}`);
      lines.push(`Max roughness: ${scaleComparison.maxRoughness.toFixed(6)}`);
      lines.push('');
    }
    if (timbreSuggestions.length) {
      lines.push('Timbre suggestions');
      timbreSuggestions.forEach((s) => {
        lines.push(`- ${s.title}`);
        s.details.forEach(detail => lines.push(`  * ${detail}`));
      });
      lines.push('');
    }
    if (overridesRef.current.length) {
      lines.push('Overrides');
      overridesRef.current.forEach(item => lines.push(`- ${item}`));
      lines.push('');
    }
    if (logs.length) {
      lines.push('Logs');
      logs.forEach(entry => {
        lines.push(`[${new Date(entry.timestamp).toISOString()}] ${entry.level.toUpperCase()}: ${entry.message}`);
      });
    }
    lines.push('');
    lines.push('Re-run');
    lines.push('Use the parameters above in the roughness terrain UI or the CLI helper script.');
    return lines.join('\n');
  }, [agentPreset, analysis, baseFreq, constants, customFileName, derivedScale, grid, gridPointBudget, heightGamma, heightmapFlipX, heightmapFlipY, lockColorRange, colorRangeVersion, logs, meshZoom, normalizationMode, projectionMode, roughness, sampling, scalarFieldMode, scaleComparison, scalePresetName, showProjectionOverlay, surfacePreset, timbre, timbreSuggestions]);

  const exportMatrix = useCallback(() => {
    if (!grid) return;
    const source = exportMatrixMode === 'raw' ? grid.raw : grid.normalized;
    if (exportMatrixFormat === 'binary') {
      const buffer = source.buffer.slice(0);
      downloadBinary(`roughness_${exportMatrixMode}.bin`, buffer);
      return;
    }
    const rows: string[] = [];
    rows.push(`# x:${grid.xs.join(',')}`);
    for (let j = 0; j < grid.ys.length; j++) {
      const row = [];
      for (let i = 0; i < grid.xs.length; i++) {
        row.push(source[j * grid.xs.length + i].toFixed(8));
      }
      rows.push(row.join(','));
    }
    downloadText(`roughness_${exportMatrixMode}.csv`, rows.join('\n'));
  }, [downloadBinary, downloadText, exportMatrixFormat, exportMatrixMode, grid]);

  const exportMinima = useCallback(() => {
    if (!analysis?.minima.length) return;
    const header = 'x,y,roughness,rationalX,rationalY,basinRadius';
    const rows = analysis.minima.map(m =>
      [m.x, m.y, m.roughness, m.rationalX ?? '', m.rationalY ?? '', m.basinRadius ?? ''].join(',')
    );
    downloadText('roughness_minima.csv', [header, ...rows].join('\n'));
  }, [analysis, downloadText]);

  const exportPinned = useCallback(() => {
    if (!pinnedPoints.length) return;
    const header = 'x,y,value,field,raw,normalized,rationalX,rationalY,timestamp';
    const rows = pinnedPoints.map(p =>
      [
        p.x,
        p.y,
        p.value,
        p.field,
        p.raw,
        p.normalized,
        p.rationalX ?? '',
        p.rationalY ?? '',
        new Date(p.timestamp).toISOString()
      ].join(',')
    );
    downloadText('roughness_pins.csv', [header, ...rows].join('\n'));
  }, [downloadText, pinnedPoints]);

  const exportReport = useCallback(() => {
    downloadText('roughness_report.txt', buildReport());
  }, [buildReport, downloadText]);

  const exportLogs = useCallback(() => {
    if (!logs.length) return;
    const lines = logs.map(entry => `[${new Date(entry.timestamp).toISOString()}] ${entry.level.toUpperCase()}: ${entry.message}`);
    downloadText('roughness_logs.txt', lines.join('\n'));
  }, [downloadText, logs]);

  const exportTimbre = useCallback(() => {
    const template = buildSpectrumTemplate(timbre);
    const rows: string[] = [];
    for (let i = 0; i < template.ratios.length; i++) {
      rows.push(`${template.ratios[i]},${template.amps[i]},${template.partialIndex[i]}`);
    }
    downloadText('timbre_normalized.csv', rows.join('\n'));
  }, [downloadText, timbre]);

  const resolveCanvasPoint = useCallback((target: HTMLCanvasElement, clientX: number, clientY: number) => {
    if (!grid) return null;
    const rect = target.getBoundingClientRect();
    const xNorm = clamp((clientX - rect.left) / rect.width, 0, 1);
    const yNorm = clamp((clientY - rect.top) / rect.height, 0, 1);
    const useLogCoords = grid.logSampling ?? sampling.logSampling;
    const axisX = useLogCoords ? grid.logX : grid.xs;
    const axisY = useLogCoords ? grid.logY : grid.ys;
    const axisXMin = axisX[0];
    const axisXMax = axisX[axisX.length - 1];
    const axisYMin = axisY[0];
    const axisYMax = axisY[axisY.length - 1];
    const xNormAdj = heightmapFlipX ? 1 - xNorm : xNorm;
    const yNormAdj = heightmapFlipY ? yNorm : 1 - yNorm;
    const metricX = axisXMin + xNormAdj * (axisXMax - axisXMin);
    const metricY = axisYMin + yNormAdj * (axisYMax - axisYMin);
    const x = useLogCoords ? Math.exp(metricX) : metricX;
    const y = useLogCoords ? Math.exp(metricY) : metricY;
    const sample = sampleGrid(grid, x, y, { field: scalarFieldMode, clamp: true });
    if (!sample) return null;
    const raw = sampleGridValue(grid, sample.x, sample.y, 'raw');
    const normalized = sampleGridValue(grid, sample.x, sample.y, 'normalized');
    return {
      x: sample.x,
      y: sample.y,
      raw: raw ?? sample.value,
      normalized: normalized ?? sample.value,
      value: sample.value,
      field: sample.field,
      timestamp: Date.now()
    };
  }, [grid, sampling.logSampling, scalarFieldMode, heightmapFlipX, heightmapFlipY]);

  const resolveMeshPoint = useCallback((target: HTMLDivElement, clientX: number, clientY: number) => {
    if (!grid || !meshRef.current || !meshCameraRef.current) return null;
    const rect = target.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycasterRef.current.setFromCamera(mouse, meshCameraRef.current);
    const hit = raycasterRef.current.intersectObject(meshRef.current)[0];
    if (!hit) return null;
    const local = meshRef.current.worldToLocal(hit.point.clone());
    const useLogCoords = grid.logSampling ?? sampling.logSampling;
    const axisX = useLogCoords ? grid.logX : grid.xs;
    const axisY = useLogCoords ? grid.logY : grid.ys;
    const axisXMin = Math.min(...axisX);
    const axisXMax = Math.max(...axisX);
    const axisYMin = Math.min(...axisY);
    const axisYMax = Math.max(...axisY);
    const tx = local.x / 2 + 0.5;
    const ty = local.y / 2 + 0.5;
    const metricX = axisXMin + tx * (axisXMax - axisXMin);
    const metricY = axisYMin + ty * (axisYMax - axisYMin);
    const ratioX = useLogCoords ? Math.exp(metricX) : metricX;
    const ratioY = useLogCoords ? Math.exp(metricY) : metricY;
    const sample = sampleGrid(grid, ratioX, ratioY, { field: scalarFieldMode, clamp: true });
    if (!sample) return null;
    const raw = sampleGridValue(grid, sample.x, sample.y, 'raw');
    const normalized = sampleGridValue(grid, sample.x, sample.y, 'normalized');
    return {
      x: sample.x,
      y: sample.y,
      raw: raw ?? sample.value,
      normalized: normalized ?? sample.value,
      value: sample.value,
      field: sample.field,
      timestamp: Date.now()
    };
  }, [grid, sampling.logSampling, scalarFieldMode]);

  const stopHoldChord = useCallback((release = DEFAULT_RELEASE) => {
    const state = holdAudioRef.current;
    if (!state) return;
    const now = state.ctx.currentTime;
    const fade = Math.max(0.02, release / 3);
    state.master.gain.cancelScheduledValues(now);
    state.master.gain.setTargetAtTime(0.0001, now, fade);
    state.oscillators.forEach(({ osc, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, fade);
      osc.stop(now + release + 0.05);
    });
    const master = state.master;
    holdAudioRef.current = null;
    holdActiveRef.current = false;
    holdStartTimeRef.current = null;
    setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        // ignore
      }
    }, (release + 0.1) * 1000);
  }, []);

  const startHoldChord = useCallback((point: { x: number; y: number }) => {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const template = buildSpectrumTemplate(timbre);
    const count = Math.min(template.ratios.length, HOLD_AUDIO_PARTIALS);
    if (!count) return;
    stopHoldChord(DEFAULT_RELEASE);

    const triadScale =
      timbre.triadEnergyMode === 'linear'
        ? 1 / 3
        : timbre.triadEnergyMode === 'sqrt'
          ? 1 / Math.sqrt(3)
          : 1;

    const master = ctx.createGain();
    const volume = clamp(holdChordVolume, 0, 1) * 0.3;
    master.gain.setValueAtTime(volume, ctx.currentTime);
    master.connect(ctx.destination);

    const ratios = [1, point.x, point.y];
    const oscillators: Array<{ osc: OscillatorNode; gain: GainNode; toneIndex: number; partialRatio: number }> = [];
    for (let toneIndex = 0; toneIndex < ratios.length; toneIndex++) {
      const toneRatio = ratios[toneIndex];
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = baseFreq * toneRatio * template.ratios[i];
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        const amp = template.amps[i] * triadScale;
        gain.gain.linearRampToValueAtTime(amp, ctx.currentTime + DEFAULT_ATTACK);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        oscillators.push({ osc, gain, toneIndex, partialRatio: template.ratios[i] });
      }
    }

    holdAudioRef.current = { ctx, master, oscillators };
  }, [baseFreq, holdChordVolume, timbre, stopHoldChord]);

  const updateHoldChord = useCallback((point: { x: number; y: number }) => {
    const state = holdAudioRef.current;
    if (!state) return;
    const now = state.ctx.currentTime;
    const ratios = [1, point.x, point.y];
    state.oscillators.forEach(({ osc, toneIndex, partialRatio }) => {
      const ratio = ratios[toneIndex] ?? 1;
      osc.frequency.setTargetAtTime(baseFreq * ratio * partialRatio, now, HOLD_AUDIO_FREQ_SMOOTH);
    });
  }, [baseFreq]);

  const playSliceChord = useCallback((point: { x: number; y: number }) => {
    if (slicePreviewTimerRef.current) {
      window.clearTimeout(slicePreviewTimerRef.current);
      slicePreviewTimerRef.current = null;
    }
    startHoldChord(point);
    slicePreviewTimerRef.current = window.setTimeout(() => {
      stopHoldChord();
      slicePreviewTimerRef.current = null;
    }, SLICE_CLICK_PREVIEW_MS);
  }, [startHoldChord, stopHoldChord]);

  const handleSliceHover = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!grid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const t = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const axisValues = sliceAxis === 'x' ? grid.ys : grid.xs;
    const idx = Math.round(t * (axisValues.length - 1));
    const ratio = axisValues[idx];
    const fixed = sliceAxis === 'x' ? clamp(sliceRatio, sampling.xRange[0], sampling.xRange[1]) : clamp(sliceRatio, sampling.yRange[0], sampling.yRange[1]);
    const x = sliceAxis === 'x' ? fixed : ratio;
    const y = sliceAxis === 'x' ? ratio : fixed;
    const value = sampleGridValue(grid, x, y, scalarFieldMode);
    if (value === null) return;
    setSliceHover({ ratio, value });
  }, [grid, sampling.xRange, sampling.yRange, sliceAxis, sliceRatio, scalarFieldMode]);

  const handleSliceClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!grid) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const axisValues = sliceAxis === 'x' ? grid.ys : grid.xs;
    if (!axisValues.length) return;
    const idx = Math.round(t * (axisValues.length - 1));
    const ratio = axisValues[idx];
    const fixed = sliceAxis === 'x' ? clamp(sliceRatio, sampling.xRange[0], sampling.xRange[1]) : clamp(sliceRatio, sampling.yRange[0], sampling.yRange[1]);
    const x = sliceAxis === 'x' ? fixed : ratio;
    const y = sliceAxis === 'x' ? ratio : fixed;
    const value = sampleGridValue(grid, x, y, scalarFieldMode);
    if (value === null) return;
    const raw = sampleGridValue(grid, x, y, 'raw');
    const normalized = sampleGridValue(grid, x, y, 'normalized');
    setSliceHover({ ratio, value });
    if (!hoverLocked) {
      setHoverInfo({
        x,
        y,
        raw: raw ?? value,
        normalized: normalized ?? value,
        value,
        field: scalarFieldMode,
        timestamp: Date.now()
      });
    }
    playSliceChord({ x, y });
  }, [grid, sampling.xRange, sampling.yRange, sliceAxis, sliceRatio, scalarFieldMode, hoverLocked, playSliceChord]);

  const handleHover = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!grid) return;
    if (hoverLocked && !holdActiveRef.current) return;
    const point = resolveCanvasPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) {
      if (!hoverLocked) setHoverInfo(null);
      return;
    }
    if (!hoverLocked) setHoverInfo(point);
    if (holdActiveRef.current && holdChordEnabled) {
      updateHoldChord(point);
    }
  }, [grid, hoverLocked, holdChordEnabled, resolveCanvasPoint, updateHoldChord]);

  const handleCanvasPointerDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!holdChordEnabled) return;
    const point = resolveCanvasPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    holdActiveRef.current = true;
    holdStartTimeRef.current = performance.now();
    holdClickSuppressRef.current = true;
    if (!hoverLocked) setHoverInfo(point);
    startHoldChord(point);
  }, [holdChordEnabled, hoverLocked, resolveCanvasPoint, startHoldChord]);

  const handleCanvasPointerUp = useCallback(() => {
    if (holdActiveRef.current) {
      if (holdStartTimeRef.current !== null) {
        const heldFor = performance.now() - holdStartTimeRef.current;
        if (heldFor < HOLD_CLICK_SUPPRESS_MS) {
          holdClickSuppressRef.current = false;
        } else {
          window.setTimeout(() => {
            holdClickSuppressRef.current = false;
          }, HOLD_CLICK_SUPPRESS_MS);
        }
      }
      stopHoldChord();
    }
  }, [stopHoldChord]);

  const handleCanvasClick = useCallback(() => {
    if (holdClickSuppressRef.current) {
      holdClickSuppressRef.current = false;
      return;
    }
    if (!hoverInfo) return;
    pinPoint(hoverInfo);
  }, [hoverInfo, pinPoint]);

  const handleMeshHover = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!grid) return;
    if (hoverLocked && !holdActiveRef.current) return;
    const point = resolveMeshPoint(event.currentTarget, event.clientX, event.clientY);
    if (!point) return;
    if (!hoverLocked) {
      setHoverInfo(point);
    }
    if (holdActiveRef.current && holdChordEnabled) {
      updateHoldChord(point);
    }
  }, [grid, hoverLocked, holdChordEnabled, resolveMeshPoint, updateHoldChord]);

  const pinFromScreen = useCallback((target: HTMLDivElement, clientX: number, clientY: number) => {
    const point = resolveMeshPoint(target, clientX, clientY);
    if (!point) return;
    setHoverInfo(point);
    pinPoint(point);
  }, [pinPoint, resolveMeshPoint]);

  const handleMeshClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (holdClickSuppressRef.current) {
      holdClickSuppressRef.current = false;
      return;
    }
    if (dragClearTimerRef.current) {
      window.clearTimeout(dragClearTimerRef.current);
      dragClearTimerRef.current = null;
    }
    if (dragStateRef.current?.dragged) {
      dragStateRef.current = null;
      return;
    }
    if (pinClickTimerRef.current) {
      window.clearTimeout(pinClickTimerRef.current);
      pinClickTimerRef.current = null;
    }
    const target = event.currentTarget;
    const { clientX, clientY } = event;
    pinClickTimerRef.current = window.setTimeout(() => {
      pinFromScreen(target, clientX, clientY);
      pinClickTimerRef.current = null;
    }, 200);
  }, [pinFromScreen]);

  const handleMeshDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (holdClickSuppressRef.current) {
      holdClickSuppressRef.current = false;
      return;
    }
    if (dragClearTimerRef.current) {
      window.clearTimeout(dragClearTimerRef.current);
      dragClearTimerRef.current = null;
    }
    if (dragStateRef.current?.dragged) {
      dragStateRef.current = null;
      return;
    }
    if (pinClickTimerRef.current) {
      window.clearTimeout(pinClickTimerRef.current);
      pinClickTimerRef.current = null;
    }
    pinFromScreen(event.currentTarget, event.clientX, event.clientY);
  }, [pinFromScreen]);

  const handleMeshPointerDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    pointerDownRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    if (dragClearTimerRef.current) {
      window.clearTimeout(dragClearTimerRef.current);
      dragClearTimerRef.current = null;
    }
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, dragged: false };
    if (holdChordEnabled) {
      const point = resolveMeshPoint(event.currentTarget, event.clientX, event.clientY);
      if (point) {
        holdActiveRef.current = true;
        holdStartTimeRef.current = performance.now();
        holdClickSuppressRef.current = true;
        if (!hoverLocked) setHoverInfo(point);
        startHoldChord(point);
      }
    }
  }, [holdChordEnabled, hoverLocked, resolveMeshPoint, startHoldChord]);

  const handleMeshPointerUp = useCallback(() => {
    pointerDownRef.current = false;
    lastPointerRef.current = null;
    if (dragClearTimerRef.current) {
      window.clearTimeout(dragClearTimerRef.current);
    }
    dragClearTimerRef.current = window.setTimeout(() => {
      dragStateRef.current = null;
      dragClearTimerRef.current = null;
    }, 250);
    if (holdActiveRef.current) {
      if (holdStartTimeRef.current !== null) {
        const heldFor = performance.now() - holdStartTimeRef.current;
        if (heldFor < HOLD_CLICK_SUPPRESS_MS) {
          holdClickSuppressRef.current = false;
        } else {
          window.setTimeout(() => {
            holdClickSuppressRef.current = false;
          }, HOLD_CLICK_SUPPRESS_MS);
        }
      }
      stopHoldChord();
    }
  }, [stopHoldChord]);

  const handleMeshPointerDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!pointerDownRef.current || !meshRef.current) return;
    if (!lastPointerRef.current) return;
    if (dragStateRef.current && !dragStateRef.current.dragged) {
      const dxStart = event.clientX - dragStateRef.current.startX;
      const dyStart = event.clientY - dragStateRef.current.startY;
      if (Math.hypot(dxStart, dyStart) > DRAG_PIN_THRESHOLD_PX) {
        dragStateRef.current.dragged = true;
      }
    }
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    meshRef.current.rotation.z += dx * 0.005;
    meshRef.current.rotation.x += dy * 0.005;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    if (meshRendererRef.current && meshSceneRef.current && meshCameraRef.current) {
      meshRendererRef.current.render(meshSceneRef.current, meshCameraRef.current);
    }
  }, []);

  const handleMeshWheelNative = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    const factor = direction > 0 ? 0.9 : 1.1;
    setMeshZoom(z => clamp(z * factor, 0.25, 6));
  }, []);

  useEffect(() => {
    if (!grid) return;
    keyboardIndexRef.current = {
      ix: Math.floor(grid.xs.length / 2),
      iy: Math.floor(grid.ys.length / 2)
    };
  }, [grid]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!grid) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        const current = keyboardIndexRef.current ?? { ix: 0, iy: 0 };
        let { ix, iy } = current;
        if (event.key === 'ArrowUp') iy = Math.min(grid.ys.length - 1, iy + 1);
        if (event.key === 'ArrowDown') iy = Math.max(0, iy - 1);
        if (event.key === 'ArrowLeft') ix = Math.max(0, ix - 1);
        if (event.key === 'ArrowRight') ix = Math.min(grid.xs.length - 1, ix + 1);
        keyboardIndexRef.current = { ix, iy };
        const x = grid.xs[ix];
        const y = grid.ys[iy];
        const raw = getValueAtIndex(grid, ix, iy, 'raw');
        const normalized = getValueAtIndex(grid, ix, iy, 'normalized');
        const value = getValueAtIndex(grid, ix, iy, scalarFieldMode);
        setHoverInfo({ x, y, raw, normalized, value, field: scalarFieldMode, timestamp: Date.now() });
        setHoverLocked(true);
        return;
      }
      if (event.key === 'Enter' && hoverInfo && pinningEnabled) {
        event.preventDefault();
        pinPoint(hoverInfo);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [grid, hoverInfo, pinPoint, pinningEnabled, scalarFieldMode]);

  useEffect(() => {
    if (!holdChordEnabled) {
      stopHoldChord();
    }
  }, [holdChordEnabled, stopHoldChord]);

  useEffect(() => {
    const state = holdAudioRef.current;
    if (!state) return;
    const now = state.ctx.currentTime;
    const volume = clamp(holdChordVolume, 0, 1) * 0.3;
    state.master.gain.setTargetAtTime(volume, now, 0.05);
  }, [holdChordVolume]);

  useEffect(() => {
    return () => {
      if (slicePreviewTimerRef.current) {
        window.clearTimeout(slicePreviewTimerRef.current);
        slicePreviewTimerRef.current = null;
      }
      stopHoldChord();
    };
  }, [stopHoldChord]);

  const updateMesh = useCallback(() => {
    if (viewMode !== 'mesh') return;
    if (!grid || !analysis) return;
    const host = meshHostRef.current;
    if (!host) return;
    let renderer = meshRendererRef.current;
    let scene = meshSceneRef.current;
    let camera = meshCameraRef.current;

    if (!renderer || !scene || !camera) {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor('#0b0f14');
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(0, 1.2, 1.6);
      camera.lookAt(0, 0, 0);
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(1, 1, 1);
      scene.add(ambient, dir);
      meshRendererRef.current = renderer;
      meshSceneRef.current = scene;
      meshCameraRef.current = camera;
    }
    if (renderer && renderer.domElement.parentElement !== host) {
      host.innerHTML = '';
      host.appendChild(renderer.domElement);
    }

    const width = grid.xs.length;
    const height = grid.ys.length;
    const useLogCoords = grid.logSampling ?? sampling.logSampling;
    const axisX = useLogCoords ? grid.logX : grid.xs;
    const axisY = useLogCoords ? grid.logY : grid.ys;
    const axisXMin = Math.min(...axisX);
    const axisXMax = Math.max(...axisX);
    const axisYMin = Math.min(...axisY);
    const axisYMax = Math.max(...axisY);

    const positions = new Float32Array(width * height * 3);
    const colors = new Float32Array(width * height * 3);
    const indices: number[] = [];

    const zClampValue = Math.max(0.05, zClamp);
    const field = scalarFieldMode;
    const values = displayValues || selectValues(grid, field);
    const range = colorRangeRef.current;
    const minField = field === 'raw' ? (range?.rawMin ?? grid.minRaw ?? 0) : (range?.normMin ?? grid.minNorm ?? 0);
    const maxField = field === 'raw' ? (range?.rawMax ?? grid.maxRaw ?? zClampValue) : (range?.normMax ?? grid.maxNorm ?? zClampValue);
    const min = normalizeDisplay ? minField : (field === 'raw' ? minField : 0);
    const max = normalizeDisplay ? maxField : zClampValue;
    const denom = Math.max(1e-9, max - min);

    // Use the data's actual min/max to choose a pivot within the active value range.
    // This makes contrast useful even when values occupy only a small slice of [0..1].
    const observedMin = minField;
    const observedMax = Math.min(max, maxField);
    const pivotValue = (observedMin + observedMax) * 0.5;
    const pivotNorm = clamp((pivotValue - min) / denom, 0, 1);
    const surfaceZ = (value: number, offset = 0) => {
      const vNorm = clamp((value - min) / denom, 0, 1);
      const vCurve = applyHeightContrast(vNorm, pivotNorm, heightGamma);
      return offset + vCurve * zScale;
    };
    const toCoord = (xVal: number, yVal: number) => {
      const mx = useLogCoords ? Math.log(xVal) : xVal;
      const my = useLogCoords ? Math.log(yVal) : yVal;
      const tx = (mx - axisXMin) / (axisXMax - axisXMin || 1);
      const ty = (my - axisYMin) / (axisYMax - axisYMin || 1);
      return [(tx - 0.5) * 2, (ty - 0.5) * 2];
    };
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        const tX = axisXMax - axisXMin > 0 ? (axisX[i] - axisXMin) / (axisXMax - axisXMin) : 0;
        const tY = axisYMax - axisYMin > 0 ? (axisY[j] - axisYMin) / (axisYMax - axisYMin) : 0;
        const x = (tX - 0.5) * 2;
        const y = (tY - 0.5) * 2;
        const z = surfaceZ(values[idx]);
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        const value = clamp((values[idx] - min) / denom, 0, 1);
        const vCurve = applyHeightContrast(value, pivotNorm, heightGamma);
        const color = mixColor(COLOR_RAMPS[colorRamp].low, COLOR_RAMPS[colorRamp].high, Math.pow(vCurve, 0.8));
        const ao = enableAO ? analysis.ao[idx] : 1;
        const shade = heightOnlyColor ? 1 : ao;
        colors[idx * 3] = clamp(color[0] * shade / 255, 0, 1);
        colors[idx * 3 + 1] = clamp(color[1] * shade / 255, 0, 1);
        colors[idx * 3 + 2] = clamp(color[2] * shade / 255, 0, 1);
      }
    }

    for (let j = 0; j < height - 1; j++) {
      for (let i = 0; i < width - 1; i++) {
        const a = j * width + i;
        const b = a + 1;
        const c = a + width;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    if (enableLighting && !heightOnlyColor) {
      geometry.computeVertexNormals();
    }

    let mesh = meshRef.current;
    const material = enableLighting && !heightOnlyColor
      ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });

    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 3;
      mesh.rotation.z = Math.PI / 4;
      scene!.add(mesh);
      meshRef.current = mesh;
    } else {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
      mesh.material = material;
    }

    if (showProjectionOverlay) {
      if (!projectionCanvasRef.current && typeof document !== 'undefined') {
        projectionCanvasRef.current = document.createElement('canvas');
      }
      if (projectionCanvasRef.current) {
        renderHeightmap(projectionCanvasRef.current, true);
        if (!projectionTextureRef.current) {
          projectionTextureRef.current = new THREE.CanvasTexture(projectionCanvasRef.current);
          projectionTextureRef.current.minFilter = THREE.LinearFilter;
          projectionTextureRef.current.magFilter = THREE.LinearFilter;
          projectionTextureRef.current.wrapS = THREE.ClampToEdgeWrapping;
          projectionTextureRef.current.wrapT = THREE.ClampToEdgeWrapping;
        } else {
          projectionTextureRef.current.needsUpdate = true;
        }
        const planeSize = 2;
        const planeHeight = 2;
        if (!projectionPlaneRef.current) {
          const planeGeo = new THREE.PlaneGeometry(planeSize, planeHeight);
          const planeMat = new THREE.MeshBasicMaterial({
            map: projectionTextureRef.current,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
          });
          projectionPlaneRef.current = new THREE.Mesh(planeGeo, planeMat);
          projectionPlaneRef.current.rotation.x = -Math.PI / 2;
          mesh.add(projectionPlaneRef.current);
        }
        if (projectionPlaneRef.current) {
          const geom = projectionPlaneRef.current.geometry as THREE.PlaneGeometry;
          if (geom.parameters.width !== planeSize || geom.parameters.height !== planeHeight) {
            projectionPlaneRef.current.geometry.dispose();
            projectionPlaneRef.current.geometry = new THREE.PlaneGeometry(planeSize, planeHeight);
          }
          const mat = projectionPlaneRef.current.material as THREE.MeshBasicMaterial;
          if (mat.map !== projectionTextureRef.current) {
            mat.map = projectionTextureRef.current;
            mat.needsUpdate = true;
          }
        }
        const planeDistance = 1.1;
        const planeY = projectionMode === 'back' ? planeDistance : -planeDistance;
        projectionPlaneRef.current.position.set(0, planeY, 0);
      }
    } else if (projectionPlaneRef.current) {
      projectionPlaneRef.current.parent?.remove(projectionPlaneRef.current);
      projectionPlaneRef.current.geometry.dispose();
      (projectionPlaneRef.current.material as THREE.Material).dispose();
      projectionPlaneRef.current = null;
    }

    if (contourRef.current) {
      scene!.remove(contourRef.current);
      contourRef.current.geometry.dispose();
      (contourRef.current.material as THREE.Material).dispose();
      contourRef.current = null;
    }

    if (showContours && analysis.contours.length) {
      const segments: number[] = [];
      // Tiny offset to avoid z-fighting on contour lines.
      const contourOffset = 1e-6;
      analysis.contours.forEach(contour => {
        contour.segments.forEach(seg => {
          const a2d = toCoord(seg.x1, seg.y1);
          const b2d = toCoord(seg.x2, seg.y2);
          const a = [a2d[0], a2d[1], contourOffset];
          const b = [b2d[0], b2d[1], contourOffset];
          segments.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        });
      });
      if (segments.length) {
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.35, transparent: true });
        const lines = new THREE.LineSegments(lineGeo, lineMat);
        contourRef.current = lines;
        scene!.add(lines);
      }
    }

    if (minimaRef.current) {
      minimaRef.current.parent?.remove(minimaRef.current);
      minimaRef.current.traverse(obj => {
        const meshObj = obj as THREE.Mesh;
        if (meshObj.geometry) meshObj.geometry.dispose();
        if (meshObj.material) (meshObj.material as THREE.Material).dispose();
      });
      minimaRef.current = null;
    }
    if (worstRef.current) {
      worstRef.current.parent?.remove(worstRef.current);
      worstRef.current.traverse(obj => {
        const meshObj = obj as THREE.Mesh;
        if (meshObj.geometry) meshObj.geometry.dispose();
        if (meshObj.material) (meshObj.material as THREE.Material).dispose();
      });
      worstRef.current = null;
    }
    if (pinnedRef.current) {
      pinnedRef.current.parent?.remove(pinnedRef.current);
      pinnedRef.current.traverse(obj => {
        const meshObj = obj as THREE.Mesh;
        if (meshObj.geometry) meshObj.geometry.dispose();
        if (meshObj.material) (meshObj.material as THREE.Material).dispose();
      });
      pinnedRef.current = null;
    }
    if (pinnedPathRef.current) {
      pinnedPathRef.current.parent?.remove(pinnedPathRef.current);
      pinnedPathRef.current.geometry.dispose();
      (pinnedPathRef.current.material as THREE.Material).dispose();
      pinnedPathRef.current = null;
    }

    if (showMinima && analysis.minima.length) {
      const group = new THREE.Group();
      analysis.minima.slice(0, minimaCount).forEach(min => {
        const [x, y] = toCoord(min.x, min.y);
        const z = surfaceZ(min.roughness, 0.01);
        const geom = new THREE.SphereGeometry(0.015, 12, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0x22f6ff, emissive: 0x22f6ff, emissiveIntensity: 0.4 });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.position.set(x, y, z);
        group.add(sphere);
      });
      minimaRef.current = group;
      mesh!.add(group);
    }

    if (showWorst && scaleComparison?.worst?.length) {
      const group = new THREE.Group();
      scaleComparison.worst.forEach(point => {
        const [x, y] = toCoord(point.x, point.y);
        const value = point.roughness;
        if (!Number.isFinite(value)) return;
        const z = surfaceZ(value, 0.02);
        const geom = new THREE.SphereGeometry(0.017, 12, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff4b4b, emissive: 0xff4b4b, emissiveIntensity: 0.5 });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.position.set(x, y, z);
        group.add(sphere);
      });
      worstRef.current = group;
      mesh!.add(group);
    }

    if (pinnedPoints.length) {
      const points: number[] = [];
      const group = new THREE.Group();
      pinnedPoints.forEach(point => {
        const [x, y] = toCoord(point.x, point.y);
        const sample = sampleGridValue(grid, point.x, point.y, scalarFieldMode);
        const z = surfaceZ(Number.isFinite(sample as number) ? (sample as number) : 0, 0.015);
        points.push(x, y, z);
        const geom = new THREE.SphereGeometry(0.014, 12, 12);
        const mat = new THREE.MeshStandardMaterial({ color: 0x7cc8ff, emissive: 0x7cc8ff, emissiveIntensity: 0.35 });
        const sphere = new THREE.Mesh(geom, mat);
        sphere.position.set(x, y, z);
        group.add(sphere);
      });
      if (showPinnedPath && points.length >= 6) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.8 });
        const line = new THREE.Line(geo, mat);
        pinnedPathRef.current = line;
        mesh!.add(line);
      }
      pinnedRef.current = group;
      mesh!.add(group);
    }

    const zoom = clamp(meshZoom, 0.25, 6);
    camera!.position.set(0, 1.2 / zoom, 1.6 / zoom);
    camera!.lookAt(0, 0, 0);

    const rect = host.getBoundingClientRect();
    const widthPx = rect.width || host.clientWidth || 1;
    const heightPx = rect.height || host.clientHeight || 1;
    renderer!.setSize(widthPx, heightPx);
    camera!.aspect = widthPx / heightPx;
    camera!.updateProjectionMatrix();
    renderer!.render(scene!, camera!);
  }, [grid, analysis, viewMode, meshZoom, zScale, zClamp, heightGamma, colorRamp, enableAO, enableLighting, heightOnlyColor, showContours, showMinima, minimaCount, displayValues, normalizeDisplay, showWorst, scaleComparison, pinnedPoints, showPinnedPath, sampling.logSampling, colorRangeVersion, lockColorRange, scalarFieldMode, showProjectionOverlay, projectionMode, renderHeightmap]);

  useEffect(() => {
    if (viewMode !== 'mesh') return;
    const host = meshHostRef.current;
    if (!host) return;
    const handleResize = () => updateMesh();
    const observer = new ResizeObserver(handleResize);
    observer.observe(host);
    return () => observer.disconnect();
  }, [viewMode, updateMesh]);

  useEffect(() => {
    if (viewMode !== 'mesh') return;
    const host = meshHostRef.current;
    if (!host) return;
    host.addEventListener('wheel', handleMeshWheelNative, { passive: false });
    return () => host.removeEventListener('wheel', handleMeshWheelNative);
  }, [handleMeshWheelNative, viewMode]);

  useEffect(() => {
    updateMesh();
  }, [updateMesh]);

  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach(mat => mat.dispose());
        } else {
          meshRef.current.material.dispose();
        }
      }
      if (meshRendererRef.current) {
        meshRendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div className="w-full min-h-full flex flex-col gap-3 pb-6">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 bg-black/50 border border-white/10 rounded-xl p-3 space-y-3 lg:order-2">
          <div className="text-[11px] uppercase tracking-widest text-gray-300 font-black">Roughness Terrain</div>
          <div className="relative w-full h-[360px] border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
            {viewMode === 'heightmap' ? (
              <canvas
                ref={canvasRef}
                className="block w-full h-full"
                onMouseMove={handleHover}
                onMouseDown={handleCanvasPointerDown}
                onMouseUp={handleCanvasPointerUp}
                onMouseLeave={() => {
                  if (!hoverLocked) setHoverInfo(null);
                  handleCanvasPointerUp();
                }}
                onClick={handleCanvasClick}
              />
            ) : (
              <div
                ref={meshHostRef}
                className="w-full h-full"
                onMouseMove={handleMeshHover}
                onMouseDown={handleMeshPointerDown}
                onMouseUp={handleMeshPointerUp}
                onMouseLeave={() => {
                  handleMeshPointerUp();
                  if (!hoverLocked) setHoverInfo(null);
                }}
                onMouseMoveCapture={handleMeshPointerDrag}
                onClick={handleMeshClick}
                onDoubleClick={handleMeshDoubleClick}
              />
            )}
            {viewMode === 'mesh' && showProjectionOverlay && (
              <div className="absolute right-2 top-2 text-[9px] text-gray-300 bg-black/60 border border-gray-700 rounded px-2 py-1">
                Projection: {projectionMode}
              </div>
            )}
            {status === 'computing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] text-gray-200 font-mono">
                Computing... {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
              </div>
            )}
            {hoverInfo && (
              <div className="absolute left-2 top-2 text-[10px] text-gray-200 bg-black/70 border border-gray-700 rounded px-2 py-1 space-y-0.5">
                <div>Ratio: {hoverInfo.x.toFixed(4)} / {hoverInfo.y.toFixed(4)}</div>
                <div>Value ({hoverInfo.field}): {hoverInfo.value.toFixed(5)}</div>
                <div>Timestamp: {new Date(hoverInfo.timestamp).toLocaleTimeString()}</div>
              </div>
            )}
            {!constantsStandard && (
              <div className="absolute right-2 bottom-2 text-[9px] text-amber-300 bg-black/60 border border-amber-400/60 rounded px-2 py-1">
                Non-standard constants
              </div>
            )}
            {smoothDisplay && (
              <div className="absolute left-2 bottom-2 text-[9px] text-gray-300 bg-black/60 border border-gray-700 rounded px-2 py-1">
                Smoothed view only
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-gray-300">
            <button
              type="button"
              onClick={() => setPinningEnabled(v => !v)}
              className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60"
            >
              Pinning: {pinningEnabled ? 'On' : 'Off'}
            </button>
            {pinningEnabled && (
              <button
                type="button"
                onClick={() => hoverInfo && pinPoint(hoverInfo)}
                disabled={!hoverInfo}
                className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60 disabled:opacity-40"
              >
                Pin hover
              </button>
            )}
            <button
              type="button"
              onClick={() => setHoverLocked(v => !v)}
              className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60"
            >
              Hover lock: {hoverLocked ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => setPinnedPoints([])}
              className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60"
            >
              Clear pins
            </button>
            <div className="text-gray-500">Keyboard: arrows move hover, Enter pin (when pinning is on)</div>
          </div>
          {analysis && (
            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
              <div>Grid: {grid?.xs.length} x {grid?.ys.length}</div>
              <div>Normalization: {grid?.normalizationMode}</div>
              <div>Avg partials: {grid?.diagnostics.prunedPartials.toFixed(1)} / {grid?.diagnostics.originalPartials.toFixed(1)}</div>
              <div>Avg invalid partials: {grid?.diagnostics.invalidPartials.toFixed(1)}</div>
              <div>Prune ratio: {grid?.diagnostics.originalPartials > 0 ? ((1 - grid.diagnostics.prunedPartials / grid.diagnostics.originalPartials) * 100).toFixed(1) : '0'}%</div>
              <div>Skipped pairs: {grid?.diagnostics.skippedPairs.toLocaleString()}</div>
              <div>Silent points: {grid?.diagnostics.silentPoints}</div>
            </div>
          )}
          {error && <div className="text-red-400 text-[10px]">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={sectionClass}>
              <div className={labelClass}>Minima & Ridges</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAnalysisSeed(v => v + 1)}
                  className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60 text-[10px]"
                >
                  Refresh minima
                </button>
                <button
                  type="button"
                  onClick={refineMinimaLocal}
                  disabled={minimaRefining}
                  className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60 text-[10px] disabled:opacity-40"
                >
                  {minimaRefining ? 'Refining...' : 'Refine minima'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar text-[10px] text-gray-300 space-y-1">
                {analysis?.minima.map((m, idx) => (
                  <div
                    key={`${m.x}-${m.y}-${idx}`}
                    className="flex items-center justify-between gap-2"
                    title={`Rational error: ${m.rationalErrorX?.toExponential(2) ?? '-'} / ${m.rationalErrorY?.toExponential(2) ?? '-'}`}
                  >
                    <span>{m.x.toFixed(3)} / {m.y.toFixed(3)}</span>
                    <span>{m.rationalX || '--'} / {m.rationalY || '--'}</span>
                    <span>{m.roughness.toFixed(4)}</span>
                    <span>{m.basinRadius ? `R ${m.basinRadius.toFixed(3)}` : ''}</span>
                    {pinningEnabled && (
                      <button
                        type="button"
                        onClick={() => pinMinima(m)}
                        className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-600/60 text-[9px]"
                      >
                        Pin
                      </button>
                    )}
                  </div>
                ))}
                {!analysis?.minima.length && <div className="text-gray-500">No minima detected.</div>}
              </div>
              <div className="pt-2 text-[10px] text-gray-400">
                <div className="uppercase tracking-widest text-gray-500">Ridges</div>
                <div className="space-y-1">
                  {analysis?.maxima?.map((m, idx) => (
                    <div key={`ridge-${m.x}-${m.y}-${idx}`} className="flex justify-between">
                      <span>{m.x.toFixed(3)} / {m.y.toFixed(3)}</span>
                      <span>{m.roughness.toFixed(4)}</span>
                    </div>
                  ))}
                  {!analysis?.maxima?.length && <div className="text-gray-500">No ridges detected.</div>}
                </div>
              </div>
            </div>
            <div className={sectionClass}>
              <div className={labelClass}>Scale & Suggestions</div>
              {scaleComparison ? (
                <div className="text-[10px] text-gray-300 space-y-1">
                  <div>Worst count: {scaleComparison.worst.length}</div>
                  <div>Average roughness: {scaleComparison.average.toFixed(6)}</div>
                  <div>Max roughness: {scaleComparison.maxRoughness.toFixed(6)}</div>
                  <div className="pt-1 text-gray-400">Worst points:</div>
                  <div className="space-y-1">
                    {scaleComparison.worst.map((point, idx) => (
                      <div key={`worst-${idx}`} className="flex justify-between">
                        <span>{point.x.toFixed(3)} / {point.y.toFixed(3)}</span>
                        <span>{point.roughness.toFixed(4)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-gray-500">No scale comparison yet.</div>
              )}
              <div className="pt-3 text-[10px] text-gray-400">
                <div className="uppercase tracking-widest text-gray-500">Derived scale</div>
                <div className="flex flex-wrap gap-2">
                  {derivedScale.map((ratio, idx) => (
                    <span key={`${ratio}-${idx}`} className="px-2 py-0.5 rounded bg-slate-800/70 border border-slate-600/60">
                      {ratio.toFixed(4)}
                    </span>
                  ))}
                  {!derivedScale.length && <span className="text-gray-500">No derived scale yet.</span>}
                </div>
              </div>
              {timbreSuggestions.length > 0 && (
                <div className="pt-3 text-[10px] text-gray-400 space-y-1">
                  <div className="uppercase tracking-widest text-gray-500">Timbre suggestions</div>
                  {timbreSuggestions.map((s, idx) => (
                    <div key={`sug-${idx}`}>
                      <div className="text-gray-200">{s.title}</div>
                      <ul className="ml-3 list-disc">
                        {s.details.map((detail, dIdx) => (
                          <li key={`detail-${idx}-${dIdx}`}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={sectionClass}>
              <div className={labelClass}>Slice View</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-gray-500">Axis</label>
                  <select value={sliceAxis} onChange={(e) => setSliceAxis(e.target.value as 'x' | 'y')} className={inputClass}>
                    <option value="x">Fix X, sweep Y</option>
                    <option value="y">Fix Y, sweep X</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-gray-500">Fixed Ratio</label>
                  <input type="number" value={sliceRatio} onChange={(e) => setSliceRatio(Number(e.target.value) || 1)} className={inputClass} />
                </div>
              </div>
              <canvas ref={sliceCanvasRef} className="w-full h-[120px]" onMouseMove={handleSliceHover} onClick={handleSliceClick} />
              {sliceHover && (
                <div className="text-[10px] text-gray-400">Ratio {sliceHover.ratio.toFixed(4)} → {sliceHover.value.toFixed(5)}</div>
              )}
            </div>
            <div className={sectionClass}>
              <div className={labelClass}>Pinned Points</div>
              <div className="max-h-32 overflow-y-auto text-[10px] text-gray-300 space-y-1">
                {pinnedPoints.map(point => (
                  <div key={point.id} className="flex justify-between">
                    <span>{point.x.toFixed(3)} / {point.y.toFixed(3)}</span>
                    <span>{point.rationalX || '--'} / {point.rationalY || '--'}</span>
                    <span>{point.normalized.toFixed(4)}</span>
                  </div>
                ))}
                {!pinnedPoints.length && <div className="text-gray-500">No pinned points yet.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[320px] flex flex-col gap-3 lg:order-1">
          <div className={sectionClass}>
            <div className={labelClass}>Graph Agent</div>
            <label className="text-[9px] text-gray-500">Goal</label>
            <select
              value={agentPreset}
              onChange={(e) => setAgentPreset(e.target.value as GraphAgentPresetKey)}
              className={inputClass}
            >
              {Object.entries(GRAPH_AGENT_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
            <div className="text-[9px] text-gray-500">{GRAPH_AGENT_PRESETS[agentPreset].description}</div>
            <label className="text-[9px] text-gray-500">Surface Feel</label>
            <select
              value={surfacePreset}
              onChange={(e) => setSurfacePreset(e.target.value as GraphSurfacePresetKey)}
              className={inputClass}
            >
              {Object.entries(GRAPH_SURFACE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
            <div className="text-[9px] text-gray-500">{GRAPH_SURFACE_PRESETS[surfacePreset].description}</div>
            <label className="text-[9px] text-gray-500">Resolution Cap (grid points)</label>
            <input
              type="number"
              value={gridPointBudget}
              onChange={(e) => setGridPointBudget(
                clamp(
                  Math.round(Number(e.target.value) || GRID_POINT_CAPS.balanced),
                  GRID_POINT_CAPS.quick,
                  GRID_POINT_CAPS.extreme
                )
              )}
              className={inputClass}
            />
            <div className="text-[9px] text-gray-500">
              Approx cap: {Math.round(Math.sqrt(gridPointBudget))} x {Math.round(Math.sqrt(gridPointBudget))} points
            </div>
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Compute</div>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={autoCompute} onChange={(e) => setAutoCompute(e.target.checked)} className="accent-indigo-500" />
              Auto recompute
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} className="accent-indigo-500" />
              Use worker
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={useParallelWorkers}
                onChange={(e) => setUseParallelWorkers(e.target.checked)}
                className="accent-indigo-500"
                disabled={!useWorker}
              />
              Parallel tile workers
            </label>
            <label className="text-[9px] text-gray-500">Worker Count</label>
            <input
              type="number"
              value={workerCount}
              onChange={(e) => setWorkerCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              className={inputClass}
              disabled={!useWorker || !useParallelWorkers}
            />
            <button type="button" onClick={compute} className="w-full min-h-[36px] rounded bg-indigo-900/60 border border-indigo-500/60 text-[10px] font-bold uppercase tracking-widest">
              Recompute
            </button>
            <button
              type="button"
              onClick={cancelCompute}
              disabled={!useWorker || status !== 'computing'}
              className="w-full min-h-[34px] rounded bg-gray-800/60 border border-gray-600/60 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
            >
              Cancel
            </button>
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Base & Domain</div>
            <label className="text-[10px] text-gray-500">Base Frequency (Hz)</label>
            <input type="number" value={baseFreq} onChange={(e) => setBaseFreq(Number(e.target.value) || 220)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Resolution Mode</label>
            <select value={sampling.resolutionMode} onChange={(e) => setSampling(s => ({ ...s, resolutionMode: e.target.value as SamplingConfig['resolutionMode'] }))} className={inputClass}>
              <option value="auto">Auto</option>
              <option value="fixed">Fixed</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500">X Range</label>
                <input type="text" value={sampling.xRange.join(',')} onChange={(e) => {
                  const parts = e.target.value.split(',').map(Number);
                  if (parts.length === 2) setSampling(s => ({ ...s, xRange: [parts[0] || 1, parts[1] || 2] }));
                }} className={inputClass} />
              </div>
              <div>
                <label className="text-[9px] text-gray-500">Y Range</label>
                <input type="text" value={sampling.yRange.join(',')} onChange={(e) => {
                  const parts = e.target.value.split(',').map(Number);
                  if (parts.length === 2) setSampling(s => ({ ...s, yRange: [parts[0] || 1, parts[1] || 2] }));
                }} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500">X Steps</label>
                <input type="number" value={sampling.xSteps} onChange={(e) => setSampling(s => ({ ...s, xSteps: Math.max(8, Number(e.target.value) || 48) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-[9px] text-gray-500">Y Steps</label>
                <input type="number" value={sampling.ySteps} onChange={(e) => setSampling(s => ({ ...s, ySteps: Math.max(8, Number(e.target.value) || 48) }))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500">Auto Low Steps</label>
                <input type="number" value={sampling.autoLowSteps} onChange={(e) => setSampling(s => ({ ...s, autoLowSteps: Math.max(16, Number(e.target.value) || 64) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-[9px] text-gray-500">Auto High Steps</label>
                <input type="number" value={sampling.autoHighSteps} onChange={(e) => setSampling(s => ({ ...s, autoHighSteps: Math.max(16, Number(e.target.value) || 128) }))} className={inputClass} />
              </div>
            </div>
            <label className="text-[9px] text-gray-500">Max Steps</label>
            <input
              type="number"
              value={sampling.maxSteps}
              onChange={(e) => setSampling(s => ({
                ...s,
                maxSteps: Math.min(MAX_STEPS_LIMIT, Math.max(32, Number(e.target.value) || 256))
              }))}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.logSampling} onChange={(e) => setSampling(s => ({ ...s, logSampling: e.target.checked }))} className="accent-indigo-500" />
              Log sampling (ratio space)
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.foldOctave} onChange={(e) => setSampling(s => ({ ...s, foldOctave: e.target.checked }))} className="accent-indigo-500" />
              Fold to octave (1-2)
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.progressiveRefine} onChange={(e) => setSampling(s => ({ ...s, progressiveRefine: e.target.checked }))} className="accent-indigo-500" />
              Progressive refine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-gray-500">Progressive Window</label>
                <input type="number" value={sampling.progressiveWindow} onChange={(e) => setSampling(s => ({ ...s, progressiveWindow: Math.max(0.001, Number(e.target.value) || 0.05) }))} className={inputClass} />
              </div>
              <div>
                <label className="text-[9px] text-gray-500">Progressive Steps</label>
                <input type="number" value={sampling.progressiveSteps} onChange={(e) => setSampling(s => ({ ...s, progressiveSteps: Math.max(16, Number(e.target.value) || 128) }))} className={inputClass} />
              </div>
            </div>
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Refinement</div>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.refineFixed} onChange={(e) => setSampling(s => ({ ...s, refineFixed: e.target.checked }))} className="accent-indigo-500" />
              Fixed harmonic bands
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.refineGradient} onChange={(e) => setSampling(s => ({ ...s, refineGradient: e.target.checked }))} className="accent-indigo-500" />
              Gradient refinement
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={sampling.refineMinima} onChange={(e) => setSampling(s => ({ ...s, refineMinima: e.target.checked }))} className="accent-indigo-500" />
              Minima refinement
            </label>
            <label className="text-[9px] text-gray-500">Band Width (cents)</label>
            <input type="number" value={sampling.refineBandCents} onChange={(e) => setSampling(s => ({ ...s, refineBandCents: Number(e.target.value) || 12 }))} className={inputClass} />
            <label className="text-[9px] text-gray-500">Density</label>
            <input type="number" value={sampling.refineDensity} onChange={(e) => setSampling(s => ({ ...s, refineDensity: Math.max(1, Number(e.target.value) || 2) }))} className={inputClass} />
            <label className="text-[9px] text-gray-500">Refine Base Steps</label>
            <input type="number" value={sampling.refineBaseSteps} onChange={(e) => setSampling(s => ({ ...s, refineBaseSteps: Math.max(8, Number(e.target.value) || 16) }))} className={inputClass} />
            <label className="text-[9px] text-gray-500">Gradient Threshold</label>
            <input type="number" value={sampling.gradientThreshold} onChange={(e) => setSampling(s => ({ ...s, gradientThreshold: Math.max(0.001, Number(e.target.value) || 0.05) }))} className={inputClass} />
            <label className="text-[9px] text-gray-500">Minima Neighborhood</label>
            <input type="number" value={sampling.minimaNeighborhood} onChange={(e) => setSampling(s => ({ ...s, minimaNeighborhood: Math.max(1, Number(e.target.value) || 2) }))} className={inputClass} />
            <label className="text-[9px] text-gray-500">Minima Smoothing</label>
            <input type="number" value={sampling.minimaSmoothing} onChange={(e) => setSampling(s => ({ ...s, minimaSmoothing: Math.max(0, Number(e.target.value) || 0) }))} className={inputClass} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={sectionClass}>
          <div className={labelClass}>Timbre</div>
          <label className="text-[9px] text-gray-500">Preset</label>
          <select value={timbre.preset} onChange={(e) => setTimbre(t => ({ ...t, preset: e.target.value as TimbreConfig['preset'] }))} className={inputClass}>
            <option value="saw">Saw</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="custom">Custom</option>
          </select>
          <label className="text-[9px] text-gray-500">Partial Count</label>
          <input type="number" value={timbre.partialCount} onChange={(e) => setTimbre(t => ({ ...t, partialCount: Math.max(1, Number(e.target.value) || 12) }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Max Partials</label>
          <input type="number" value={timbre.maxPartials} onChange={(e) => setTimbre(t => ({ ...t, maxPartials: Math.max(4, Number(e.target.value) || 32) }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Custom Spectrum File</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => customFileInputRef.current?.click()}
              className="px-2 py-1 rounded bg-slate-800/70 border border-slate-600/60 text-[10px]"
            >
              Choose file
            </button>
            <div className="text-[10px] text-gray-400">
              {customFileName ? `Selected: ${customFileName}` : 'No file chosen'}
            </div>
            <input
              ref={customFileInputRef}
              type="file"
              accept=".txt,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const parsed = parseSpectrumText(String(reader.result || ''));
                  if (parsed.errors.length) {
                    setCustomFileError(parsed.errors.join(' | '));
                    return;
                  }
                  setCustomFileError('');
                  setCustomFileName(file.name);
                  setTimbre(t => ({ ...t, preset: 'custom', customPartials: parsed.partials }));
                };
                reader.readAsText(file);
              }}
              className="hidden"
            />
          </div>
          {customFileError && <div className="text-[10px] text-red-400">{customFileError}</div>}
          <label className="text-[9px] text-gray-500">Merge Near Partials</label>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={timbre.mergeClosePartials} onChange={(e) => setTimbre(t => ({ ...t, mergeClosePartials: e.target.checked }))} className="accent-indigo-500" />
            <input type="number" value={timbre.mergeTolerance} onChange={(e) => setTimbre(t => ({ ...t, mergeTolerance: Number(e.target.value) || 1e-4 }))} className={inputClass} />
          </div>
          <label className="text-[9px] text-gray-500">Amplitude Normalization</label>
          <select value={timbre.amplitudeNormalization} onChange={(e) => setTimbre(t => ({ ...t, amplitudeNormalization: e.target.value as TimbreConfig['amplitudeNormalization'] }))} className={inputClass}>
            <option value="none">None</option>
            <option value="max">Max amplitude</option>
            <option value="energy">Energy</option>
          </select>
          <label className="text-[9px] text-gray-500">Amplitude Compression</label>
          <select value={timbre.amplitudeCompression} onChange={(e) => setTimbre(t => ({ ...t, amplitudeCompression: e.target.value as TimbreConfig['amplitudeCompression'] }))} className={inputClass}>
            <option value="none">None</option>
            <option value="sqrt">Sqrt</option>
            <option value="log">Log</option>
          </select>
          <label className="text-[9px] text-gray-500">Compression Amount</label>
          <input type="number" value={timbre.amplitudeCompressionAmount} onChange={(e) => setTimbre(t => ({ ...t, amplitudeCompressionAmount: Math.max(0.1, Number(e.target.value) || 1) }))} className={inputClass} />
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={timbre.clampNegativeAmps} onChange={(e) => setTimbre(t => ({ ...t, clampNegativeAmps: e.target.checked }))} className="accent-indigo-500" />
            Clamp negative amplitudes
          </label>
          <label className="text-[9px] text-gray-500">Triad Energy Scale</label>
          <select value={timbre.triadEnergyMode} onChange={(e) => setTimbre(t => ({ ...t, triadEnergyMode: e.target.value as TimbreConfig['triadEnergyMode'] }))} className={inputClass}>
            <option value="none">None</option>
            <option value="linear">One third</option>
            <option value="sqrt">Sqrt one third</option>
          </select>
          <div className="text-[10px] text-gray-400">
            Template count: {buildSpectrumTemplate(timbre).usedCount}
          </div>
          {inharmonicSpectrum && (
            <div className="text-[10px] text-amber-300">Inharmonic spectrum detected. Consider higher resolution.</div>
          )}
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Roughness Core</div>
          <label className="text-[9px] text-gray-500">Amplitude Threshold</label>
          <input type="number" value={roughness.ampThreshold} onChange={(e) => setRoughness(r => ({ ...r, ampThreshold: Number(e.target.value) || 0.001 }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Epsilon Contribution</label>
          <input type="number" value={roughness.epsilonContribution} onChange={(e) => setRoughness(r => ({ ...r, epsilonContribution: Number(e.target.value) || 1e-4 }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Pair Skip Epsilon</label>
          <input type="number" value={roughness.pairSkipEpsilon ?? 1e-4} onChange={(e) => setRoughness(r => ({ ...r, pairSkipEpsilon: Math.max(0, Number(e.target.value) || 1e-4) }))} className={inputClass} />
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={roughness.enableSelfInteraction} onChange={(e) => setRoughness(r => ({ ...r, enableSelfInteraction: e.target.checked }))} className="accent-indigo-500" />
            Self interaction
          </label>
          <label className="text-[9px] text-gray-500">Self Interaction Weight</label>
          <input type="number" value={roughness.selfInteractionWeight} onChange={(e) => setRoughness(r => ({ ...r, selfInteractionWeight: Number(e.target.value) || 1 }))} className={inputClass} />
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={roughness.mergeDuplicatePartials} onChange={(e) => setRoughness(r => ({ ...r, mergeDuplicatePartials: e.target.checked }))} className="accent-indigo-500" />
            Merge duplicate partials
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={roughness.performanceMode ?? false} onChange={(e) => setRoughness(r => ({ ...r, performanceMode: e.target.checked }))} className="accent-indigo-500" />
            Performance mode
          </label>
          <label className="text-[9px] text-gray-500">Symmetry Samples</label>
          <input
            type="number"
            value={roughness.symmetrySampleCount ?? 24}
            onChange={(e) => setRoughness(r => ({ ...r, symmetrySampleCount: Math.max(4, Number(e.target.value) || 24) }))}
            className={inputClass}
          />
          <label className="text-[9px] text-gray-500">Symmetry Tolerance</label>
          <input
            type="number"
            value={roughness.symmetryTolerance ?? 1e-6}
            onChange={(e) => setRoughness(r => ({ ...r, symmetryTolerance: Math.max(0, Number(e.target.value) || 0) }))}
            className={inputClass}
          />
          <label className="text-[9px] text-gray-500">Coeff A</label>
          <input type="number" value={constants.a} onChange={(e) => setConstants(c => ({ ...c, a: Number(e.target.value) || c.a }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Coeff B</label>
          <input type="number" value={constants.b} onChange={(e) => setConstants(c => ({ ...c, b: Number(e.target.value) || c.b }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Max Position</label>
          <input type="number" value={constants.dStar} onChange={(e) => setConstants(c => ({ ...c, dStar: Number(e.target.value) || c.dStar }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Scale S1</label>
          <input type="number" value={constants.s1} onChange={(e) => setConstants(c => ({ ...c, s1: Number(e.target.value) || c.s1 }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Scale S2</label>
          <input type="number" value={constants.s2} onChange={(e) => setConstants(c => ({ ...c, s2: Number(e.target.value) || c.s2 }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Exp Clamp Min</label>
          <input type="number" value={constants.expClampMin ?? -700} onChange={(e) => setConstants(c => ({ ...c, expClampMin: Number(e.target.value) }))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Normalization Mode</label>
          <select value={normalizationMode} onChange={(e) => setNormalizationMode(e.target.value as NormalizationMode)} className={inputClass}>
            <option value="energy">Energy (recommended)</option>
            <option value="max">Max amplitude</option>
            <option value="reference">Reference point</option>
            <option value="none">None</option>
          </select>
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Parameter Scan</div>
          <label className="text-[9px] text-gray-500">Delta</label>
          <input type="number" value={scanDelta} onChange={(e) => setScanDelta(Math.max(0.01, Number(e.target.value) || 0.5))} className={inputClass} />
          <label className="text-[9px] text-gray-500">Steps</label>
          <input type="number" value={scanSteps} onChange={(e) => setScanSteps(Math.max(2, Number(e.target.value) || 3))} className={inputClass} />
          <button type="button" onClick={runParameterScan} className="w-full min-h-[32px] rounded bg-slate-800/70 border border-slate-600/60 text-[10px] font-bold uppercase tracking-widest">
            Run Scan
          </button>
          <div className="max-h-24 overflow-y-auto text-[10px] text-gray-400 space-y-1">
            {scanResults.map((line, idx) => (
              <div key={`scan-${idx}`}>{line}</div>
            ))}
            {!scanResults.length && <div className="text-gray-600">No scan results yet.</div>}
          </div>
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Visualization</div>
          <label className="text-[9px] text-gray-500">Scalar Field</label>
          <select value={scalarFieldMode} onChange={(e) => setScalarFieldMode(e.target.value as TerrainScalarField)} className={inputClass}>
            <option value="normalized">Normalized</option>
            <option value="raw">Raw</option>
          </select>
          <label className="text-[9px] text-gray-500">Projection Plane (3D)</label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={showProjectionOverlay} onChange={(e) => setShowProjectionOverlay(e.target.checked)} className="accent-indigo-500" />
            Show projection plane
          </label>
          <label className="text-[9px] text-gray-500">Projection Plane</label>
          <select value={projectionMode} onChange={(e) => setProjectionMode(e.target.value as typeof projectionMode)} className={inputClass}>
            <option value="front">Front</option>
            <option value="back">Back</option>
          </select>
          <label className="text-[9px] text-gray-500">Projection Orientation</label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={heightmapFlipX} onChange={(e) => setHeightmapFlipX(e.target.checked)} className="accent-indigo-500" />
            Flip X (projection)
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={heightmapFlipY} onChange={(e) => setHeightmapFlipY(e.target.checked)} className="accent-indigo-500" />
            Flip Y (projection)
          </label>
          <label className="text-[9px] text-gray-500">Mesh Zoom</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMeshZoom(z => clamp(z / 1.1, 0.25, 6))}
              className="px-2 py-1 rounded bg-gray-800/70 border border-gray-600/60 text-[10px]"
            >
              -
            </button>
            <input
              type="range"
              min={0.25}
              max={6}
              step={0.05}
              value={meshZoom}
              onChange={(e) => setMeshZoom(clamp(Number(e.target.value) || 1, 0.25, 6))}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setMeshZoom(z => clamp(z * 1.1, 0.25, 6))}
              className="px-2 py-1 rounded bg-gray-800/70 border border-gray-600/60 text-[10px]"
            >
              +
            </button>
          </div>
          <input type="number" value={meshZoom} onChange={(e) => setMeshZoom(clamp(Number(e.target.value) || 1, 0.25, 6))} className={inputClass} />
          <div className="text-[9px] text-gray-500">Tip: scroll the 3D view to zoom.</div>
          <label className="text-[9px] text-gray-500">Height Contrast</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeightGamma(g => clamp(g - 0.1, 0.25, 8))}
              className="px-2 py-1 rounded bg-gray-800/70 border border-gray-600/60 text-[10px]"
            >
              -
            </button>
            <input
              type="range"
              min={0.25}
              max={8}
              step={0.05}
              value={heightGamma}
              onChange={(e) => setHeightGamma(clamp(Number(e.target.value) || 1, 0.25, 8))}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setHeightGamma(g => clamp(g + 0.1, 0.25, 8))}
              className="px-2 py-1 rounded bg-gray-800/70 border border-gray-600/60 text-[10px]"
            >
              +
            </button>
          </div>
          <input
            type="number"
            value={heightGamma}
            onChange={(e) => setHeightGamma(clamp(Number(e.target.value) || 1, 0.25, 8))}
            className={inputClass}
          />
          <div className="text-[9px] text-gray-500">1 = neutral. Higher makes troughs deeper, peaks higher, and colors more distinct.</div>
          <label className="text-[9px] text-gray-500">Z Scale</label>
          <input type="number" value={zScale} onChange={(e) => setZScale(Number(e.target.value) || 1)} className={inputClass} />
          <label className="text-[9px] text-gray-500">Z Clamp</label>
          <input type="number" value={zClamp} onChange={(e) => setZClamp(Number(e.target.value) || 1)} className={inputClass} />
          <label className="text-[9px] text-gray-500">Color Ramp</label>
          <select value={colorRamp} onChange={(e) => setColorRamp(e.target.value as keyof typeof COLOR_RAMPS)} className={inputClass}>
            <option value="emerald">Emerald</option>
            <option value="magma">Magma</option>
            <option value="ice">Ice</option>
          </select>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={lockColorRange} onChange={(e) => setLockColorRange(e.target.checked)} className="accent-indigo-500" />
            Lock color range
          </label>
          <button
            type="button"
            onClick={resetColorRange}
            className="w-full min-h-[28px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold"
          >
            Reset color range
          </button>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={heightOnlyColor} onChange={(e) => setHeightOnlyColor(e.target.checked)} className="accent-indigo-500" />
            Height-only color
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={enableLighting} onChange={(e) => setEnableLighting(e.target.checked)} className="accent-indigo-500" />
            Lighting (normals)
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={smoothDisplay} onChange={(e) => setSmoothDisplay(e.target.checked)} className="accent-indigo-500" />
            Smooth display (view only)
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={normalizeDisplay} onChange={(e) => setNormalizeDisplay(e.target.checked)} className="accent-indigo-500" />
            Normalize height (view only)
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={showContours} onChange={(e) => setShowContours(e.target.checked)} className="accent-indigo-500" />
            Show contours
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={showMinima} onChange={(e) => setShowMinima(e.target.checked)} className="accent-indigo-500" />
            Show minima markers
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={showWorst} onChange={(e) => setShowWorst(e.target.checked)} className="accent-indigo-500" />
            Show worst points
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={showPinnedPath} onChange={(e) => setShowPinnedPath(e.target.checked)} className="accent-indigo-500" />
            Show pinned path
          </label>
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={holdChordEnabled} onChange={(e) => setHoldChordEnabled(e.target.checked)} className="accent-indigo-500" />
            Hold to play chord
          </label>
          <label className="text-[9px] text-gray-500">Hold chord volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={holdChordVolume}
            onChange={(e) => setHoldChordVolume(Number(e.target.value) || 0)}
            className="w-full"
          />
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={holdChordVolume}
            onChange={(e) => setHoldChordVolume(Number(e.target.value) || 0)}
            className={inputClass}
          />
          <label className="text-[9px] text-gray-500">AO Strength</label>
          <input type="number" value={aoStrength} onChange={(e) => setAoStrength(Number(e.target.value) || 0)} className={inputClass} />
          <label className="flex items-center gap-2 text-[10px] text-gray-400">
            <input type="checkbox" checked={enableAO} onChange={(e) => setEnableAO(e.target.checked)} className="accent-indigo-500" />
            Enable AO
          </label>
          <label className="text-[9px] text-gray-500">Minima Count</label>
          <input type="number" value={minimaCount} onChange={(e) => setMinimaCount(Math.max(1, Number(e.target.value) || 10))} className={inputClass} />
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Scale Comparison</div>
          <label className="text-[9px] text-gray-500">Preset</label>
          <select value={scalePresetName} onChange={(e) => setScalePresetName(e.target.value)} className={inputClass}>
            {SCALE_PRESETS.map(preset => (
              <option key={preset.name} value={preset.name}>{preset.name}</option>
            ))}
            <option value="Custom">Custom</option>
          </select>
          {scalePresetName === 'Custom' && (
            <textarea
              value={customScaleText}
              onChange={(e) => setCustomScaleText(e.target.value)}
              className="min-h-[70px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px] font-mono"
              placeholder="Example: 1, 9/8, 5/4, 4/3"
            />
          )}
          <label className="text-[9px] text-gray-500">Worst Points</label>
          <input type="number" value={scaleWorstCount} onChange={(e) => setScaleWorstCount(Math.max(1, Number(e.target.value) || 6))} className={inputClass} />
          <div className="text-[10px] text-gray-400">Uses current scalar field.</div>
          <button type="button" onClick={runScaleComparison} className="w-full min-h-[34px] rounded bg-slate-800/70 border border-slate-600/60 text-[10px] font-bold uppercase tracking-widest">
            Compare Scale
          </button>
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Exports</div>
          <label className="text-[9px] text-gray-500">Matrix Mode</label>
          <select value={exportMatrixMode} onChange={(e) => setExportMatrixMode(e.target.value as 'raw' | 'normalized')} className={inputClass}>
            <option value="raw">Raw</option>
            <option value="normalized">Normalized</option>
          </select>
          <label className="text-[9px] text-gray-500">Matrix Format</label>
          <select value={exportMatrixFormat} onChange={(e) => setExportMatrixFormat(e.target.value as 'binary' | 'text')} className={inputClass}>
            <option value="binary">Binary</option>
            <option value="text">CSV</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportMatrix} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Matrix</button>
            <button type="button" onClick={exportMinima} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Minima</button>
            <button type="button" onClick={exportPinned} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Pins</button>
            <button type="button" onClick={exportReport} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Report</button>
            <button type="button" onClick={exportLogs} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Logs</button>
            <button type="button" onClick={exportTimbre} className="w-full min-h-[32px] rounded bg-gray-800/70 border border-gray-600/60 text-[10px] font-bold">Export Timbre</button>
          </div>
        </div>

        <div className={sectionClass}>
          <div className={labelClass}>Logs</div>
          <div className="max-h-32 overflow-y-auto text-[10px] text-gray-400 space-y-1">
            {logs.slice(-8).map((entry, idx) => (
              <div key={`${entry.timestamp}-${idx}`}>
                [{new Date(entry.timestamp).toLocaleTimeString()}] {entry.level.toUpperCase()}: {entry.message}
              </div>
            ))}
            {!logs.length && <div className="text-gray-600">No logs yet.</div>}
          </div>
        </div>
      </div>

      
    </div>
  );
};

export default RoughnessLandscape;
