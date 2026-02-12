
import { Vector3 } from 'three';
import type { PrimeLimit, AppSettings, StandardPrimeLimit, CustomPrimeConfig } from './types';
import { DEFAULT_TIMBRE_SETTINGS } from './timbrePresets';
import type { RetunerSettings, MpeZoneConfig } from './domain/retuner/types';
import type { OutputDestination } from './domain/retuner/destination';

export const PRIME_AXES: Record<StandardPrimeLimit, Vector3> = {
  3: new Vector3(1.0, 0.0, 0.0),
  5: new Vector3(0.1, 1.0, 0.3),
  7: new Vector3(0.0, -0.4, 1.0),
  11: new Vector3(-0.7, 0.7, -0.6),
  13: new Vector3(0.6, -0.8, -0.5),
  17: new Vector3(-0.3, 0.9, -0.9),
  19: new Vector3(0.8, 0.5, 0.3),
  23: new Vector3(-0.5, -0.8, 0.3),
  29: new Vector3(0.9, -0.1, 0.7),
  31: new Vector3(-0.8, 0.2, 0.9)
};

export const UNIT_DISTANCE = 10;

export const DEFAULT_LIMIT_COLORS: Record<StandardPrimeLimit, string> = {
  3: '#3b82f6',
  5: '#ef4444',
  7: '#22c55e',
  11: '#eab308',
  13: '#a855f7',
  17: '#ec4899',
  19: '#06b6d4',
  23: '#ea580c',
  29: '#84cc16',
  31: '#14b8a6'
};

export const STANDARD_PRIMES: StandardPrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

export const getPrimeAxis = (prime: PrimeLimit): Vector3 => {
  if (prime in PRIME_AXES) {
    return PRIME_AXES[prime as StandardPrimeLimit].clone();
  }

  const phi = (1 + Math.sqrt(5)) / 2;
  const theta = (prime * phi) % 1 * Math.PI * 2;
  const phiAngle = Math.acos(1 - 2 * ((prime * phi * phi) % 1));
  return new Vector3(
    Math.sin(phiAngle) * Math.cos(theta),
    Math.sin(phiAngle) * Math.sin(theta),
    Math.cos(phiAngle)
  );
};

export const getPrimeColor = (
  prime: PrimeLimit,
  settings?: AppSettings
): string => {

  if (settings?.customPrimes) {
    const customConfig = settings.customPrimes.find(c => c.prime === prime);
    if (customConfig) return customConfig.color;
  }

  if (settings?.visuals?.limitColors?.[prime as StandardPrimeLimit]) {
    return settings.visuals.limitColors[prime as StandardPrimeLimit];
  }

  if (prime in DEFAULT_LIMIT_COLORS) {
    return DEFAULT_LIMIT_COLORS[prime as StandardPrimeLimit];
  }

  const hue = (prime * 137.508) % 360;
  const saturation = 60 + (prime % 30);
  const lightness = 45 + (prime % 20);

  const h = hue;
  const s = saturation / 100;
  const l = lightness / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const getAllActivePrimes = (settings: AppSettings): PrimeLimit[] => {
  const standard = STANDARD_PRIMES.filter(p => p <= (settings.maxPrimeLimit as number));
  const custom = (settings.customPrimes || []).map(c => c.prime);
  return [...new Set([...standard, ...custom])].sort((a, b) => (a as number) - (b as number));
};

export const GEN_SIZES = {
  0: 1.8,
  1: 1.0,
  2: 0.6,
  3: 0.35,
  4: 0.2
};

export const LINE_WIDTHS = {
  root: 6,
  gen1: 3,
  gen2: 1,
  gen3: 0.5,
  gen4: 0.25
};

const DEFAULT_TUNER_RATIOS = [
  '1/1',
  '16/15',
  '9/8',
  '6/5',
  '5/4',
  '4/3',
  '45/32',
  '3/2',
  '8/5',
  '5/3',
  '9/5',
  '15/8'
];

export const DEFAULT_VISUALS = {
  backgroundColor: '#050505',
  backgroundImageUrl: null,
  limitColors: { ...DEFAULT_LIMIT_COLORS },
  limitOpacities: { 3: 1.0, 5: 1.0, 7: 1.0, 11: 1.0, 13: 1.0, 17: 1.0, 19: 1.0, 23: 1.0, 29: 1.0, 31: 1.0 },
  genOpacities: { 0: 1.0, 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.4 },
  maxVisibleGen: 4,
  nodeShape: 'lowpoly' as const,
  nodeMaterial: 'lambert' as const,
  nodeScale: 1.0,
  edgeOpacity: 0.3,
  lineRenderingMode: 'performance' as const,
  renderScale: 1,
  enableFog: true,
  globalScale: 1.0,
  primeSpacings: { 3: 1.0, 5: 1.0, 7: 1.0, 11: 1.0, 13: 1.0, 17: 1.0, 19: 1.0, 23: 1.0, 29: 1.0, 31: 1.0 },
  layoutMode: 'lattice' as const,
  spiralFactor: 0,
  helixFactor: 0,
  diamondLimit: 7,
  temperamentMorph: 0,
  showGhostGrid: false,
  ghostOpacity: 0.3,
  tetDivisions: 12,
  labelMode: 'ratio' as const,
  latticeLabelMode: 'name' as const,
  nodeSurfaceRatioLabelsEnabled: false,
  nodeSurfaceRatioFontScale: 0.55,
  nodeSurfaceRatioTexturedMode: 'both' as const,
  nodeSurfaceRatioPlacement: 'surface' as const,
  nodeSurfaceRatioLabelMode: 'ratio' as const,
  nodeSurfaceRatioEmphasizePrimes: false,
  nodeSurfaceRatioFilterMode: 'all' as const,
  nodeSurfaceRatioNearCenterCount: 50,
  nodeColorMode: 'limit' as const,
  ratioDisplay: {
    autoPowerDigits: 14,
    contexts: {
      infoPanel: 'auto' as const,
      nodeDeriver: 'auto' as const,
      search: 'fraction' as const,
      nodeLabels: 'fraction' as const,
      musicXmlRetune: 'auto' as const
    }
  },
  globalBrightness: 1.0,

  hChromaBase: 2,
  hChromaLimit: 47,
  hChromaColorMode: 'pure' as const,
  hChromaAutoRotate: false,
  hChromaAutoRotateSpeed: 1.0,
  hChromaLabelMode: 'harmonic' as const,
  hChromaShowPrimaryTriplet: false,
  hChromaPrimaryA: '#ff0000',
  hChromaPrimaryB: '#0000ff',
  hChromaPrimaryC: '#ffff00',
  hChromaRadius: 36,
  hChromaHeightScale: 18,
  hChromaBranchEnabled: false,
  hChromaBranchScope: 'selected' as const,
  hChromaBranchBase: 0,
  hChromaBranchLengthPos: 2,
  hChromaBranchLengthNeg: 2,
  hChromaBranchSpacing: 6,
  hChromaBranchSelected: [],
  hChromaBranchSelectedHarmonic: 0,
  hChromaBranchOverrides: {}
};

export const DEFAULT_CURVED_GEOMETRY = {
  enabled: false,
  pitchMetric: 'log2' as const,
  distanceMode: 'linear' as const,
  distanceScale: 12,
  distanceExponent: 1,
  distanceOffset: 0,
  curveRadiansPerStep: Math.PI / 16,
  autoSpacing: true,
  collisionPadding: 0.25
};

export const DEFAULT_HUNT_SETTINGS = {
  refPitchName: 'A4',
  refPitchHz: 440,
  zeroPitch: 'C0' as const,
  a4InC0Cents: 5700,
  debugEnabled: false,
  debugLabelMode: 'brief' as const,
  staffZoom: 1,
  voiceColorsEnabled: true,
  voiceColors: {},
  staffDisplay: {
    slotStepPx: 8,
    visibleZMin: null,
    visibleZMax: null,
    staffLineCount: 25,
    showStaffLines: true,
    staffMainLineEvery: 5,
    regionLineCount: 8,
    regionLineZIndices: [0, 5, 10, 15, 20, 25, 30, 35],
    showRegionLines: true,
    microLineCount: 12,
    microLineMode: 'auto' as const,
    microLineOpacity: 0.35,
    microLineThickness: 0.6,
    microLineVisibleZoomThreshold: 1.6,
    showLedgerLines: true,
    ledgerLengthFactor: 2.0,
    ledgerFadeK: 0.08,
    ledgerMinOpacity: 0.25,
    ledgerMaxCount: 24,
    clefScale: 1.55,
    clefOffsetLinesTreble: 0,
    clefOffsetLinesBass: 0,
    showSlotLabels: 'off' as const,
    labelMode: 'brief' as const,
    labelFontSize: 9,
    labelColor: '#111111'
  }
};

export const DEFAULT_NAVIGATION_CONTROLS = {
  mouseRotateSpeed: 3.0,
  mouseZoomSpeed: 1.2,
  mousePanSpeed: 0.8,
  wasdBaseSpeed: 1.0,
  wasdSprintMultiplier: 15.0,
  doubleTapMs: 300
};

export const DEFAULT_CUSTOM_GEOMETRY = {
  style: 'implicit' as const,
  inputSpace: 'both' as const,
  thresholdMode: 'lte0' as const,
  epsilon: 0.4,
  implicitExpression: 'x^2 + y^2 + z^2 - 400',
  voxelExpression: 'x^2 + y^2 + z^2 < 400',
  presetId: 'sphere',
  parametric: {
    mode: 'curve' as const,
    expression: 'x=20*cos(t), y=20*sin(t), z=0.6*t',
    uMin: -6.28,
    uMax: 6.28,
    vMin: -3.14,
    vMax: 3.14,
    uSteps: 120,
    vSteps: 48,
    thickness: 8
  }
};

export const DEFAULT_SETTINGS: AppSettings = {
  isArActive: false,
  isSimpleMode: false,
  simpleLabelMode: 'name',
  namingSetupCompleted: false,
  branchHotkeys: {
    enabled: true,
    requireShift: true,
    requireCapsLock: true,
    defaultNeg: 1,
    defaultPos: 1
  },
  maxPrimeLimit: 11,
  rootLimits: [3],
  secondaryOrigins: [],
  expansionDirection: 'both',
  expansionA: 12,
  gen0MaxLength: 1500,
  gen0MaxDisplayLength: 100,
  gen0CustomizeEnabled: true,
  gen0Lengths: { 3: 12, 5: 12, 7: 12, 11: 12, 13: 12, 17: 12, 19: 12, 23: 12, 29: 12, 31: 12 },
  gen0Ranges: {},
  expansionB: 4,
  gen1Lengths: {},
  gen1Ranges: {},

  gen2Lengths: {},
  gen2Ranges: {},
  gen3Lengths: {},
  gen3Ranges: {},
  gen4Lengths: {},
  gen4Ranges: {},
  expansionC: 1,
  expansionD: 0,
  expansionE: 0,
  playDurationSingle: 0.7,
  playDurationDual: 3.0,
  baseFrequency: 293.66,
  transpositionVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
  waveform: 'triangle',
  instrumentClick: 'triangle',
  instrumentKeyboard: 'sawtooth',
  instrumentChord: 'organ',
  synthPatches: {
    enabled: false,
    clickPatch: {
      name: 'Default Click',
      gain: 0.5,
      osc: [{ type: 'pulse', gain: 0.9, pulseWidth: 0.35 }, { type: 'sine', gain: 0.25, detuneCents: 3 }],
      env: { attackMs: 2, decayMs: 60, sustain: 0.0, releaseMs: 40 },
      filter: { enabled: true, type: 'highpass', cutoffHz: 280, q: 0.7, envAmount: 0 },
      lfo: { enabled: false, waveform: 'sine', rateHz: 5, depth: 0.2, target: 'pitch' },
      unison: { enabled: false, voices: 2, detuneCents: 6, stereoSpread: 0.4 },
      glideMs: 0
    },
    keyboardPatch: {
      name: 'Default Lead',
      gain: 0.45,
      osc: [{ type: 'sawtooth', gain: 0.55 }, { type: 'triangle', gain: 0.35, detuneCents: -2 }],
      env: { attackMs: 6, decayMs: 140, sustain: 0.5, releaseMs: 180 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1600, q: 0.9, envAmount: 0.2 },
      lfo: { enabled: false, waveform: 'sine', rateHz: 5, depth: 0.15, target: 'pitch' },
      unison: { enabled: false, voices: 2, detuneCents: 4, stereoSpread: 0.3 },
      glideMs: 0
    },
    chordPatch: {
      name: 'Default Pad',
      gain: 0.4,
      osc: [{ type: 'sawtooth', gain: 0.6 }, { type: 'triangle', gain: 0.35, detuneCents: -4 }],
      env: { attackMs: 18, decayMs: 280, sustain: 0.65, releaseMs: 360 },
      filter: { enabled: true, type: 'lowpass', cutoffHz: 1800, q: 0.9, envAmount: 0.25 },
      lfo: { enabled: true, waveform: 'sine', rateHz: 0.35, depth: 0.25, target: 'filter' },
      unison: { enabled: true, voices: 3, detuneCents: 9, stereoSpread: 0.65 },
      glideMs: 0
    }
  },
  timbre: DEFAULT_TIMBRE_SETTINGS,
  tuner: {
    enabled: false,
    activeProfileId: 'tuner-default',
    profiles: [
      {
        id: 'tuner-default',
        name: 'Default',
        baseFrequency: 440,
        mappingMode: 'ratios',
        divisions: DEFAULT_TUNER_RATIOS.length,
        ratios: [...DEFAULT_TUNER_RATIOS],
        edoDivisions: 12,
        equalStepBase: 2,
        equalStepDivisions: 12
      }
    ],
    showRatio: true,
    showCents: true,
    showHz: true
  },
  visuals: DEFAULT_VISUALS,
  playbackVisualizationMode: 'SCROLLER',
  playbackRing: {
    scale: 1,
    showAllLabels: true,
    showPreferredNames: false,
    rotationDeg: 0,
    showUpcoming: false,
    showDebug: false
  },
  notationSymbols: {
    5: { up: '~', down: '+', placement: 'right' },
    7: { up: 'γ', down: 'γ' },
    11: { up: 'ε', down: 'ε' },
    13: { up: 'θ', down: 'θ' },
    17: { up: 'κ', down: 'κ' },
    19: { up: 'σ', down: 'σ' },
    23: { up: 'τ', down: 'τ' },
    29: { up: 'μ', down: 'μ' },
    31: { up: 'ν', down: 'ν' }
  },
  accidentalPlacement: 'split',
  navigationShortcuts: {
    3: 'u',
    5: 'v',
    7: 'l',
    11: 'x',
    13: 'y',
    17: 'z',
    19: 'p',
    23: 'o',
    29: 'm',
    31: 'n'
  },
  navigationControls: { ...DEFAULT_NAVIGATION_CONTROLS },
  centsTolerance: 5,
  autoCameraFocus: true,
  deduplicateNodes: false,
  deduplicationTolerance: 5.0,
  priorityOrder: ['gen', 'limit', 'origin'],
  ensureConnectivity: true,
  playUnisonOnSelect: false,
  nearbySort: 'pitch',
  nearbyCount: 12,
  highlightNearby: true,
  loopTolerance: 30,
  axisLooping: { 3: null, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
  commaSpreadingEnabled: { 3: false, 5: false, 7: false, 11: false, 13: false, 17: false, 19: false, 23: false, 29: false, 31: false },
  midi: {
    enabled: false,
    inputName: '',
    centerNote: 60,
    channel: 0,
    velocitySensitivity: true,
    mappingMode: 'lattice',
    restrictAxis: 3,
    mappingDivisions: 12,
    mappingScale: ['1/1', '16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '9/5', '15/8'],
    keyFilter: 'all',
    outputEnabled: false,
    outputId: '',
    outputChannel: 1,
    outputPitchBendRange: 2
  },
  midiDeviceManager: {
    selectedDeviceId: null,
    localControlDefault: 'off',
    channelMode: 'omni',
    activeChannel: 1,
    autoReconnect: true,
    scanInterval: 2000
  },
  spiral: {
    enabled: false,
    axis: 3,
    length: 60,
    commaTolerance: 40,
    primaryStep: 12,
    primaryCents: 23.46,
    radius1: 40,
    secondaryStep: 0,
    secondaryCents: 0,
    radius2: 20,
    rise: 2.0,
    rise2: 2.0,
    tertiaryStep: 0,
    tertiaryCents: 0,
    radius3: 200,
    rise3: 2.0,
    expansionB: 2,
    expansionC: 0
  },
  equalStep: {
    enabled: false,
    base: 2,
    divisions: 12,
    deltaN: 1,
    stepsPerCircle: 12,
    range: 12,
    radius: 40,
    zRise: 2,
    layerGap: 10,
    visualizationMode: 'graphite'
  },
  geometry: {
    enabled: false,
    mode: 'rectangle',
    limits: [3, 5, 7],
    dimensions: [3, 3, 3],
    useHarmonicColors: true,
    spacing: 1.6,
    sphere: {
      limits: [3, 5, 7],
      structuringAxis: 3,
      radius: 3
    },
    custom: DEFAULT_CUSTOM_GEOMETRY
  },
  curvedGeometry: DEFAULT_CURVED_GEOMETRY,
  hunt: DEFAULT_HUNT_SETTINGS
};

export const AUTO_BIND_KEYS = [
  'a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'"
];

export const KNOWN_COMMAS = [
  { name: "Syntonic Comma (Didymus)", n: 81n, d: 80n, cents: 21.51 },
  { name: "Pythagorean Comma", n: 531441n, d: 524288n, cents: 23.46 },
  { name: "Schisma", n: 32805n, d: 32768n, cents: 1.95 },
  { name: "Kleisma", n: 15625n, d: 15552n, cents: 8.11 },
  { name: "Diaschisma", n: 2048n, d: 2025n, cents: 19.55 },
  { name: "Diesis (Lesser)", n: 128n, d: 125n, cents: 41.06 },
  { name: "Septimal Comma (Archytas)", n: 64n, d: 63n, cents: 27.26 },
  { name: "Septimal Kleisma", n: 225n, d: 224n, cents: 7.71 },
  { name: "Small Undecimal Comma", n: 100n, d: 99n, cents: 17.40 },
  { name: "Undecimal Comma", n: 33n, d: 32n, cents: 53.27 },
  { name: "Tridecimal Comma", n: 27n, d: 26n, cents: 65.34 },
  { name: "Greater Diesis", n: 648n, d: 625n, cents: 62.57 },
  { name: "Ragisma (4375/4374)", n: 4375n, d: 4374n, cents: 0.40 },
  { name: "Septimal Semicomma (2401/2400)", n: 2401n, d: 2400n, cents: 0.72 },
  { name: "Septimal Diesis (49/48)", n: 49n, d: 48n, cents: 35.70 },
  { name: "Porcupine Comma (250/243)", n: 250n, d: 243n, cents: 49.17 },
  { name: "Pythagorean Limma (256/243)", n: 256n, d: 243n, cents: 90.22 },
  { name: "Pythagorean Apotome (2187/2048)", n: 2187n, d: 2048n, cents: 113.69 }
];

export const EDO_PRESETS: Record<number, string[]> = {
  5: ['1/1', '9/8', '5/4', '3/2', '7/4'],
  7: ['1/1', '9/8', '5/4', '4/3', '3/2', '5/3', '15/8'],
  12: ['1/1', '16/15', '9/8', '6/5', '5/4', '4/3', '45/32', '3/2', '8/5', '5/3', '9/5', '15/8'],
  19: ['1/1', '21/20', '16/15', '10/9', '9/8', '8/7', '7/6', '6/5', '5/4', '4/3', '11/8', '7/5', '3/2', '14/9', '8/5', '5/3', '7/4', '9/5', '15/8'],
  22: ['1/1', '36/35', '16/15', '10/9', '8/7', '7/6', '6/5', '5/4', '9/7', '4/3', '7/5', '10/7', '3/2', '14/9', '11/7', '8/5', '5/3', '12/7', '7/4', '16/9', '9/5', '28/15'],
  31: ['1/1', '45/44', '21/20', '16/15', '12/11', '11/10', '10/9', '9/8', '8/7', '7/6', '32/27', '6/5', '5/4', '9/7', '4/3', '11/8', '7/5', '10/7', '3/2', '14/9', '11/7', '8/5', '5/3', '12/7', '7/4', '16/9', '9/5', '20/11', '11/6', '35/18', '15/8']
};

export const DEFAULT_CHORDS = [
  {
    name: "JI Major Triad (4:5:6)",
    ratios: ["1/1", "5/4", "3/2"]
  },
  {
    name: "JI Minor Triad (10:12:15)",
    ratios: ["1/1", "6/5", "3/2"]
  },
  {
    name: "Harmonic 7th (4:5:6:7)",
    ratios: ["1/1", "5/4", "3/2", "7/4"]
  },
  {
    name: "Lydian Tetrad (8:10:12:15)",
    ratios: ["1/1", "5/4", "3/2", "15/8"]
  },
  {
    name: "Pythagorean Major",
    ratios: ["1/1", "9/8", "81/64", "3/2"]
  },
  {
    name: "Septimal Minor (6:7:9)",
    ratios: ["1/1", "7/6", "3/2"]
  }
];

export const DEFAULT_RETUNER_SETTINGS: RetunerSettings = {
  enabled: false,
  mode: 'none',
  destinationId: null,

  // Note: outputPitchBendRange is deprecated (migrated into destinations).

  input: {
    type: 'midi',
    pitchBendRangeSteps: 2,
    mappingMode: 'lattice',
    baseTuning: { a4Hz: 440, baseNote: 69, rootNote: 60 },
    sourceFilter: {
      sourceIds: [],
      channelMode: 'all',
      channelRange: { min: 1, max: 16 },
      channelList: [],
      noteRange: { min: 0, max: 127 },
    },
    mappingTable: [],
    loopbackGuard: { enabled: true, mode: 'basic', windowMs: 120 },
  },

  monoPolicy: 'steal',
  zone: { startChannel: 2, endChannel: 8, useGlobalChannel: true, globalChannel: 1 },
  stealPolicy: 'oldest',
  resetPbOnNoteOff: false,

  mtsEsp: {
    enabled: false,
    mode: 'broadcast-only',
    broadcastPolicy: 'onchange',
    broadcastIntervalMs: 100,
  },

  // Default MPE zone config (can be overridden per-user).
  mpeZone: {
    type: 'lower',
    lower: { globalChannel: 1, memberChannels: [2, 3, 4, 5, 6, 7, 8], memberCount: 7 },
    upper: { globalChannel: 16, memberChannels: [15, 14, 13, 12, 11, 10, 9], memberCount: 7 }
  },

  routes: [],

  preflight: {
    notePolicy: 'queue',
    maxQueueSize: 64,
    queueTimeoutMs: 1000,
    configTimeoutMs: 2000,
  },

  tuningChangePolicy: {
    mode: 'new-notes-only',
    rampMs: 50,
  },

  panicOnDestinationChange: true,
  panicOnModeChange: true,
  panicOnZoneChange: true,
  panicOnPbRangeChange: true,

  group: 'Off'
};

export const DEFAULT_OUTPUT_DESTINATION: Partial<OutputDestination> = {
  pitchBendRangeSemitones: 48,
  connected: false
};

export const SYSEX_QUEUE_DEFAULTS = {
  intervalMs: 20,
  maxQueueSize: 256
};

export const MPE_ZONE_DEFAULTS: { lower: NonNullable<MpeZoneConfig['lower']>; upper: NonNullable<MpeZoneConfig['upper']> } = {
  lower: { globalChannel: 1, memberChannels: [2, 3, 4, 5, 6, 7, 8], memberCount: 7 },
  upper: { globalChannel: 16, memberChannels: [15, 14, 13, 12, 11, 10, 9], memberCount: 7 }
};

