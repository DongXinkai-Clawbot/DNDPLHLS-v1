
import type { Vector3 } from 'three';
import type { OutputDestination } from './domain/retuner/destination';
import type { RetunerSettings, RetunerState } from './domain/retuner/types';

export type { OutputDestination } from './domain/retuner/destination';

export type StandardPrimeLimit = 3 | 5 | 7 | 11 | 13 | 17 | 19 | 23 | 29 | 31;
export type PrimeLimit = StandardPrimeLimit | number;

export interface CustomPrimeConfig {
  prime: number;
  color: string;
  symbol?: { up: string; down: string; placement?: 'left' | 'right' | 'split' };
  spacing?: number;
}

export interface Fraction { n: bigint; d: bigint; }

export type WaveformShape = 'sine' | 'triangle' | 'square' | 'sawtooth' | 'custom-synth' | 'organ' | 'epiano' | 'strings' | 'pad' | 'brass' | 'bell' | 'nes' | 'synth-bass' | 'clarinet' | 'oboe' | 'bassoon' | 'trumpet' | 'flute' | 'cello' | 'violin' | 'vibraphone' | 'marimba' | 'steel-drum' | 'kalimba' | 'koto' | 'sitar' | 'voice-ooh' | string;

export interface SynthOscillatorSpec {
  type: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pulse' | 'noise';
  gain?: number;
  detuneCents?: number;
  pulseWidth?: number;
}

export interface SynthPatch {
  name?: string;
  gain: number;
  osc: SynthOscillatorSpec[];
  env: { attackMs: number; decayMs: number; sustain: number; releaseMs: number; };
  filter?: { enabled: boolean; type: 'lowpass' | 'highpass' | 'bandpass' | 'notch'; cutoffHz: number; q: number; envAmount: number; };
  lfo?: { enabled: boolean; waveform: 'sine' | 'triangle' | 'square' | 'sawtooth'; rateHz: number; depth: number; target: 'pitch' | 'filter' | 'amp'; };
  unison?: { enabled: boolean; voices: number; detuneCents: number; stereoSpread: number; };
  glideMs?: number;
}

export type TimbreEngineMode = 'basic' | 'timbre';
export type TimbreCurve = 'linear' | 'log' | 'invert-log' | 'exp' | 'pow' | 's-curve' | 'step' | 'bipolar-s-curve';
export type TimbreQualityMode = 'high' | 'balanced' | 'performance';
export type TimbreVoiceStealStrategy = 'oldest' | 'quietest' | 'release-first';
export type TimbreModSource =
  | 'velocity'
  | 'noteRandom'
  | 'keyTracking'
  | 'modWheel'
  | 'aftertouch'
  | 'mpePressure'
  | 'mpeTimbre'
  | 'cc7'
  | 'cc74'
  | 'pitchBend'
  | 'time'
  | 'macro1' | 'macro2' | 'macro3' | 'macro4' | 'macro5' | 'macro6' | 'macro7' | 'macro8'
  | 'lfo1' | 'lfo2' | 'lfo3' | 'lfo4'
  // A3: New Sources
  | 'envAmp' | 'envFilter' | 'mseg'
  | 'randomHold' | 'randomSmooth'
  | 'noteAge' | 'releaseAge'
  | 'envelopeFollower';

export type TimbreModTarget =
  | 'overallGain'
  | 'filterCutoff'
  | 'filterType'
  | 'filterSlope'
  | 'harmonicBrightness'
  | 'oddEvenBalance'
  | 'inharmonicity'
  | 'noiseAmount'
  | 'fmDepth'
  | 'ringModMix'
  | 'msegAmount'
  | 'drive'
  | 'reverbMix'
  | 'karplusFeedback'
  | 'karplusMix'
  | 'resonanceMix'
  | 'unisonDetune'
  | 'unisonSpread'
  | 'chorusMix'
  | 'phaserMix'
  | 'delayMix'
  | 'delayFeedback'
  // A5: New Targets
  | 'harmonicRolloff'
  | 'harmonicJitter'
  | 'harmonicCount'
  | 'harmonicGroupWeight1'
  | 'harmonicGroupWeight2'
  | 'harmonicGroupWeight3'
  | 'harmonicGroupWeight4'
  | 'harmonicMaskLow'
  | 'harmonicMaskHigh'
  | 'filterQ'
  | 'filterKeyTracking'
  | 'filterLfoAmount'
  | 'filterCombMix'
  | 'filterCombFreq'
  | 'filterCombFeedback'
  | 'filterCombDamping'
  | 'formantMorph'
  | 'formantMix'
  | 'formantF1'
  | 'formantF2'
  | 'formantF3'
  | 'noiseFilterHz'
  | 'noiseHighpassHz'
  | 'noiseColor'
  | 'chorusRate'
  | 'chorusDepth'
  | 'chorusFeedback'
  | 'phaserRate'
  | 'phaserFeedback'
  | 'phaserStages'
  | 'delayTime'
  | 'delayFilterHz'
  | 'delayHighpassHz'
  | 'delayModDepth'
  | 'bitcrushMix'
  | 'bitcrushRate'
  | 'bitcrushDepth'
  | 'granularMix'
  | 'granularPosition'
  | 'granularDensity'
  | 'granularPitch'
  | 'reverbDecay'
  | 'reverbSize'
  | 'reverbPreDelay'
  | 'reverbDamping'
  | 'karplusDamping'
  | 'wavetableMorph' // B4
  | 'sampleStart'    // B5
  // Epic 1: Sample engine
  | 'sampleGain'
  | 'sampleReleaseMix'
  | 'sampleLayer1Gain'
  | 'sampleLayer2Gain'
  | 'sampleLayer3Gain'
  | 'sampleLayer4Gain'
  // Epic 3: VA Osc
  | 'vaOsc1Level'
  | 'vaOsc2Level'
  | 'vaSubLevel'
  // Epic 4: FM Operators
  | 'fmOp1Level'
  | 'fmOp2Level'
  | 'fmOp3Level'
  | 'fmOp4Level'
  | 'fmOp1Ratio'
  | 'fmOp2Ratio'
  | 'fmOp3Ratio'
  | 'fmOp4Ratio';

export interface TimbreMacroRoute {
  target: TimbreModTarget;
  depth: number;
  curve?: TimbreCurve;
  bipolar?: boolean;
  offset?: number;
  scale?: number;
  clampMin?: number;
  clampMax?: number;
  deadzone?: number;
  invert?: boolean;
  smoothingMs?: number;
  blendMode?: 'sum' | 'max' | 'min' | 'multiply' | 'avg';
  combineMode?: 'sum' | 'max' | 'min' | 'multiply' | 'avg';
  curveAmount?: number;
  curveSteps?: number;
}

export interface TimbreMacro {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  curve: TimbreCurve;
  source?: TimbreModSource;
  routes?: TimbreMacroRoute[]; // G2: Macro routing table
}

export interface TimbreModRoute {
  id: string;
  source: TimbreModSource;
  target: TimbreModTarget;
  depth: number;
  curve?: TimbreCurve;
  bipolar?: boolean; // Legacy support, prefer output mapping via deadzone/invert if applicable, but keep for now

  // A1: Advanced Route Controls
  offset?: number;      // Add after scaling
  scale?: number;       // Multiplier
  clampMin?: number;    // Hard limit min
  clampMax?: number;    // Hard limit max
  deadzone?: number;    // Input values < deadzone become 0
  invert?: boolean;     // 1 - value (unipolar) or -value (bipolar)
  smoothingMs?: number; // Lag processor
  blendMode?: 'sum' | 'max' | 'min' | 'multiply' | 'avg'; // How to combine if multiple routes target same param
  combineMode?: 'sum' | 'max' | 'min' | 'multiply' | 'avg'; // Alias for blendMode
  curveAmount?: number; // For pow curve exponent or custom shaping
  curveSteps?: number;  // For step curve quantization
  phaseOffset?: number; // 0..1 phase offset for LFO routes
}

export interface TimbreOscillatorSpec {
  id: string;
  type: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pulse' | 'noise' | 'wavetable' | 'sample';
  gain: number;
  detuneCents?: number;
  pulseWidth?: number;

  // B4: Wavetable Morph - Support array of tables?
  // Or just keep simple wavetable prop but allow engine to interpolate if multiple provided in a "WavetableGroup"?
  // For now, let's just add `wavetableMorph` parameter.
  // Actually, `wavetable` prop currently is single object. 
  // Let's extend it or add `wavetables`.
  wavetable?: { real: number[]; imag: number[] };
  wavetables?: { real: number[]; imag: number[] }[]; // B4
  wavetableMorph?: number; // 0..N-1

  // B5: Sample Engine V2
  sample?: {
    data?: string;
    baseHz: number;
    loop: boolean;
    rootKey?: string;   // B5
    loopStart?: number; // B5: 0-1 or seconds? BufferSource uses seconds. Let's use 0-1 relative for now or seconds? Standard is seconds.
    loopEnd?: number;   // B5
    loopMode?: 'oneshot' | 'loop' | 'pingpong'; // B5
    startOffset?: number; // B5: 0..1 (relative) or seconds (relative to duration)
    reverse?: boolean; // B5
    gain?: number;      // B5
  };
}

export interface TimbreOscillatorBank {
  enabled: boolean;
  sync?: { enabled: boolean; ratio: number };
  oscillators: TimbreOscillatorSpec[];
}

export interface HarmonicDesignerSettings {
  enabled: boolean;
  mode: 'parametric' | 'table' | 'hybrid';
  harmonicCount: number;
  rolloff: number;
  brightness: number;
  oddEven: number;
  groupWeights: [number, number, number, number];
  groupDecay: [number, number, number, number];
  jitter: number;

  // B2: Phase Strategy
  phase?: number; // Global offset
  phaseMode?: 'locked' | 'random' | 'randomPerNote' | 'randomPerVoice' | 'spread'; // B2
  phaseSpread?: number; // B2

  inharmonicity: number;
  inharmonicityCurve: number;

  mask: 'all' | 'no_fundamental' | 'odd' | 'even' | 'pattern' | 'bandpass' | 'multiBand' | 'formant'; // B3: Added bandpass
  pattern?: string;

  // B3: Extended Mask Config
  maskConfig?: {
    lowHz?: number;
    highHz?: number;
    bands?: { low: number; high: number; gain: number }[];
    formants?: { freq: number; width: number; gain: number }[];
  };

  table: number[];
  tableSize: number;
  normalize: boolean;
  lockEnergy: boolean;
  mix: number;
}

export interface TimbreEnvelopeSettings {
  amp: {
    attackMs: number;
    holdMs?: number;
    decayMs: number;
    sustain: number;
    releaseMs: number;
    curve?: TimbreCurve; // A2: Source curve (amp)
    curveAmount?: number;
    curveSteps?: number;
  };
  filter: {
    enabled: boolean;
    attackMs: number;
    holdMs?: number;
    decayMs: number;
    sustain: number;
    releaseMs: number;
    amount: number;
    curve?: TimbreCurve; // A2: Source curve (filter)
    curveAmount?: number;
    curveSteps?: number;
  };
  spectralDecay: {
    amount: number;
    curve: number;
    maxMultiplier: number;
  };
}

export interface TimbreNoiseSettings {
  enabled: boolean;
  burstAmount: number;
  burstDecayMs: number;
  sustainAmount: number;
  filterHz: number;
  highpassHz: number;
  color: number;
  stereoWidth: number;
  mix: number;
}

export interface TimbreFilterSettings {
  enabled: boolean;
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass' | 'peaking' | 'lowshelf' | 'highshelf' | 'svf' | 'comb' | 'formant'; // Epic 5
  slope: 12 | 24; // C1: Added slope
  cutoffHz: number;
  q: number;
  keyTracking: number;
  keyTrackingBaseHz?: number;
  lfoAmount: number;
  envAmount: number; // C1: Added envAmount (bipolar usually, reusing amount if exists in env?)
  comb?: { mix: number; freqHz: number; feedback: number; dampingHz: number };
  formant?: {
    mix: number;
    vowel?: 'a' | 'e' | 'i' | 'o' | 'u';
    morph?: number;
    peaks?: { freq: number; q: number; gain: number }[];
  };
  // Wait, envelopes.filter.amount exists. 
  // But strictly, filter settings usually host the routing amounts.
  // Let's rely on envelopes.filter.amount for now, but ensure it's bipolar check.
}

export interface TimbreNonlinearitySettings {
  enabled: boolean;
  type: 'tanh' | 'soft-clip' | 'hard-clip' | 'diode' | 'wavefold' | 'sine-fold' | 'bit-crush'; // C2: Added types
  drive: number;
  mix: number;
  compensation: number;
  autoGain: boolean; // C2: Added autoGain
  outputTrim?: number;
}

export interface TimbreReverbSettings {
  enabled: boolean;
  mix: number;
  decay: number;
  preDelayMs: number; // D2
  size: number;
  color: number; // Tone
  stereoWidth?: number;
  modDepth: number;
  modSpeed: number;
  dampingHz: number; // D2
  earlyMix?: number;
  earlyDelayMs?: number;
}

export interface TimbreResonanceSettings {
  enabled: boolean;
  mix: number;
  delayMs: number;
  feedback: number;
  dampingHz: number;
}

export interface TimbreSpaceSettings {
  reverb: TimbreReverbSettings;
  resonance: TimbreResonanceSettings;
}

export interface TimbreModLfo {
  enabled: boolean;
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'sample&hold';
  rateHz: number;
  tempoSync?: boolean;
  syncDivision?: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';
  phase?: number;
  fadeInMs?: number;
  oneShot?: boolean;
  retrigger?: boolean;
  curve?: TimbreCurve;
  curveAmount?: number;
  curveSteps?: number;
}

export interface TimbreKarplusSettings {
  enabled: boolean;
  mix: number;
  feedback: number;
  dampingHz: number;
  delayMs: number;
  trackPitch: boolean;
  exciterAmount: number;
  exciterDecayMs: number;
}

export interface TimbreFmSettings {
  enabled: boolean;
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth';
  ratio: number;
  depth: number;
  target: 'osc' | 'harmonic' | 'all';
}

export interface TimbreRingModSettings {
  enabled: boolean;
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth';
  ratio: number;
  depth: number;
  mix: number;
}

export interface TimbreMsegPoint {
  timeMs: number;
  value: number;
}

export interface TimbreMsegSettings {
  enabled: boolean;
  amount: number;
  points: TimbreMsegPoint[];
}

export interface TimbreUnisonSettings {
  enabled: boolean;
  voices: number;
  detune: number;
  spread: number;
  phase?: number;
  blend: number;
}

export interface TimbreChorusSettings {
  enabled: boolean;
  mix: number;
  depth: number;
  rate: number;
  delay: number;
  feedback: number;
  spread: number; // D3: Stereo Phase/Spread
  sync?: boolean;
  syncDivision?: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';
}

export interface TimbrePhaserSettings {
  enabled: boolean;
  mix: number;
  depth: number;
  rate: number;
  feedback: number;
  baseHz: number;
  stages: number; // D3
  sync?: boolean;
  syncDivision?: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';
}

export interface TimbreDelaySettings {
  enabled: boolean;
  mix: number;
  timeMs: number;
  feedback: number;
  stereoOffsetMs: number; // Use for width?
  pingPong: boolean; // D1
  sync: boolean; // D1
  syncDivision?: '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';
  filterHz: number; // D1 (lowpass legacy)
  filterHighpassHz?: number;
  stereoWidth?: number;
  ducking?: number;
  color: number;
  modDepth: number;
  modRate: number;
  type: 'stereo' | 'pingpong' | 'cross'; // D1: redundancy with pingPong bool? Keep 'type' as source of truth.
}

export type TimbreSampleLoopMode = 'off' | 'forward' | 'pingpong';

export interface TimbreSampleRegion {
  url: string;
  startOffsetMs?: number;
  endTrimMs?: number;
  loopMode?: TimbreSampleLoopMode;
  loopStart?: number; // seconds or 0..1 relative
  loopEnd?: number;   // seconds or 0..1 relative
  loopXfadeMs?: number;
  overlapWidth?: number; // velocity overlap width (0..1 or 0..127)
  roundRobinGroupId?: string;
  rrIndex?: number;
}

export interface TimbreSampleLayer {
  gain: number;
  pan: number;
  tuneCents: number;
  rootKey?: string;
  keyRange?: [number, number]; // midi note range
  velRange?: [number, number]; // 0..1 or 0..127
  regions: TimbreSampleRegion[];
}

export interface TimbreSampleReleaseMap {
  keyRange?: [number, number];
  velRange?: [number, number];
  region: TimbreSampleRegion;
}

export interface TimbreSampleLegatoTransition {
  fromKeyRange?: [number, number];
  toKeyRange?: [number, number];
  intervalClass?: 'semitone' | 'whole' | 'leap';
  region: TimbreSampleRegion;
}

export interface TimbreSampleSettings {
  enabled: boolean;
  masterGain: number;
  layers: TimbreSampleLayer[];
  velocityCurve?: 'linear' | 'soft' | 'hard';
  roundRobinMode?: 'cycle' | 'random' | 'random-no-repeat';
  releaseSamples?: TimbreSampleReleaseMap[];
  releaseMix?: number;
  legatoTransitions?: TimbreSampleLegatoTransition[];
}

export interface TimbreMechanicalNoiseSettings {
  enabled: boolean;
  keyNoise: number;
  releaseNoise: number;
  breathNoise: number;
  bowNoise: number;
  color: 'white' | 'pink' | 'brown';
  hpHz?: number;
  lpHz?: number;
}

export interface TimbreSympatheticSettings {
  enabled: boolean;
  amount: number;
  decay: number;
  color: number;
}

export interface TimbreVAOscSettings {
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pulse';
  octave: number;
  semitone: number;
  cent: number;
  level: number;
  pan: number;
  pwmDepth?: number;
  pwmSource?: TimbreModSource;
}

export interface TimbreVASynthSettings {
  enabled: boolean;
  osc1: TimbreVAOscSettings;
  osc2: TimbreVAOscSettings;
  subOsc: TimbreVAOscSettings;
  noiseOsc: TimbreVAOscSettings;
  syncOsc2?: boolean;
}

export interface TimbreFmOperatorSettings {
  ratio: number;
  detuneCents: number;
  level: number;
  feedback?: number;
  env?: TimbreEnvelopeSettings['amp'];
  keyScaling?: number;
}

export interface TimbreFmOperatorBank {
  enabled: boolean;
  algorithm: 'algo1' | 'algo2' | 'algo3' | 'algo4' | 'algo5' | 'algo6' | 'algo7' | 'algo8';
  operators: [TimbreFmOperatorSettings, TimbreFmOperatorSettings, TimbreFmOperatorSettings, TimbreFmOperatorSettings];
  safeMode?: boolean;
}

export interface TimbreBitcrushSettings {
  enabled: boolean;
  bitDepth?: number; // 2-16
  sampleRateReduce?: number; // 1..32 (hold factor)
  jitter?: number; // 0..1
  depth?: number; // legacy 0-1
  sampleRate?: number; // legacy 0-1
  mix: number;
}

export interface TimbreCompressorSettings {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
  gain: number;
}

export interface TimbreEqSettings {
  enabled: boolean;
  lowGain: number;
  midGain: number;
  highGain: number;
  lowFreq: number;
  midFreq: number;
  highFreq: number;
  midQ: number; // D4
}

export interface TimbreMasterFilterSettings {
  enabled: boolean;
  type: BiquadFilterType;
  cutoffHz: number;
  resonance: number;
  mix: number;
}

export interface TimbreLimiterSettings {
  enabled: boolean;
  preGain: number;
  mix: number;
  threshold: number;
  releaseMs: number;
}

export interface TimbreVoiceSettings {
  gain: number;
  oscBank: TimbreOscillatorBank;
  harmonic: HarmonicDesignerSettings;
  unison: TimbreUnisonSettings;
  noise: TimbreNoiseSettings;
  sample: TimbreSampleSettings;
  vaOsc: TimbreVASynthSettings;
  envelopes: TimbreEnvelopeSettings;
  filter: TimbreFilterSettings;
  masterFilter: TimbreMasterFilterSettings;
  eq: TimbreEqSettings;
  fm: TimbreFmSettings;
  fmOperators: TimbreFmOperatorBank;
  ringMod: TimbreRingModSettings;
  mseg: TimbreMsegSettings;
  nonlinearity: TimbreNonlinearitySettings;
  space: TimbreSpaceSettings;
  sympathetic: TimbreSympatheticSettings;
  mechanicalNoise: TimbreMechanicalNoiseSettings;
  chorus: TimbreChorusSettings;
  phaser: TimbrePhaserSettings;
  delay: TimbreDelaySettings;
  bitcrush: TimbreBitcrushSettings;
  granular?: {
    enabled: boolean;
    sourceUrl?: string;
    grainSizeMs: number;
    density: number;
    position: number;
    positionJitter: number;
    pitch: number;
    spray: number;
    windowType: 'hann' | 'tri' | 'rect';
    freeze: boolean;
    mix: number;
  };
  compressor: TimbreCompressorSettings;
  limiter: TimbreLimiterSettings;
  lfo: { lfo1: TimbreModLfo; lfo2: TimbreModLfo; lfo3: TimbreModLfo; lfo4: TimbreModLfo };
  karplus: TimbreKarplusSettings;
}

export interface TimbrePerformanceSettings {
  polyphony: number;
  maxPartials: number;
  portamentoMs: number;
  velocityCurve: 'linear' | 'soft' | 'hard';
  releaseMode: 'normal' | 'cut';
  voiceSteal?: TimbreVoiceStealStrategy; // E2
  pitchBendRangeSemitones?: number; // G1
  rebuildCrossfadeMs?: number; // E4
}

export interface TimbreRoutingSettings {
  enableOscBank: boolean;
  enableHarmonic: boolean;
  enableNoise: boolean;
  enableKarplus: boolean;
  enableFilter: boolean;
  enableEq: boolean;
  enableFm: boolean;
  enableRingMod: boolean;
  enableMseg: boolean;
  enableNonlinearity: boolean;
  enableSpace: boolean;
  enableChorus: boolean;
  enablePhaser: boolean;
  enableDelay: boolean;
  enableBitcrush: boolean;
  enableGranular: boolean;
  enableCompressor: boolean;
  enableLimiter: boolean;
}

export interface TimbrePatch {
  schemaVersion?: number; // F1
  id: string;
  name: string;
  tags: string[];
  folder?: string;
  voice: TimbreVoiceSettings;
  layers?: Array<{
    id: string;
    name?: string;
    sourceType?: 'additive' | 'va' | 'wavetable' | 'sample' | 'fm' | 'granular' | 'osc';
    level: number;
    pan: number;
    tuneCents?: number;
    mute?: boolean;
    solo?: boolean;
    voiceOverride?: Partial<TimbreVoiceSettings>;
    send?: { reverb: number; delay: number };
  }>;
  performance: TimbrePerformanceSettings;
  macros: TimbreMacro[];
  modMatrix: TimbreModRoute[];
  routing: TimbreRoutingSettings;
  migration?: {
    fromVersion: number;
    toVersion: number;
    notes: string[];
    timestamp: string;
    backup?: any;
  };
}

export interface TimbreMappingSettings {
  globalEnabled: boolean;
  byNoteLabel: boolean;
  byContext: boolean;
  noteKeyMode: 'full' | 'accidental';
  noteKeyMap: Record<string, string>;
  contextMap: { click: string; keyboard: string; sequence: string };
}

export interface TimbreSettings {
  engineMode: TimbreEngineMode;
  activePatchId: string;
  patches: TimbrePatch[];
  mapping: TimbreMappingSettings;
  performance: {
    maxPolyphony: number;
    maxPartials: number;
    autoReduce: boolean;
    qualityMode?: TimbreQualityMode;
    voiceSteal?: TimbreVoiceStealStrategy;
  };
  lastError?: string | null;
}

export interface TunerProfile {
  id: string;
  name: string;
  baseFrequency: number;
  mappingMode: 'ratios' | 'edo' | 'equal-step';
  divisions: number;
  ratios: string[];
  edoDivisions?: number;
  equalStepBase?: number;
  equalStepDivisions?: number;
}

export interface TunerSettings {
  enabled: boolean;
  activeProfileId: string;
  profiles: TunerProfile[];
  showRatio: boolean;
  showCents: boolean;
  showHz: boolean;
}

export interface NodeData {
  id: string;
  position: Vector3;
  primeVector: { [key in PrimeLimit]: number };
  ratio: Fraction;
  octave: number;
  cents: number;
  gen: number;
  originLimit: PrimeLimit | 0;
  parentId?: string | null;
  name: string;
  playable?: boolean;
  isRest?: boolean;
  varsSnapshot?: Record<string, number>;
  rawValue?: string;
  rawScalar?: number;
  originalScalar?: number;
  ratioFloat?: number;
  freqHz?: number;
  frac?: { n: bigint, d: bigint };
  stepIndex?: number;
}

export interface EdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  limit: PrimeLimit;
  gen: number;
}

export type NodeShape = 'sphere' | 'cube' | 'diamond' | 'tetra' | 'point' | 'lowpoly';
export type NodeMaterial = 'basic' | 'lambert' | 'phong' | 'standard' | 'toon' | 'normal';
export type PriorityCriteria = 'gen' | 'limit' | 'origin';
export type NearbySortCriteria = 'pitch' | 'gen' | 'center';
export type LandingMode = 'none' | 'simple' | 'advanced' | 'tutorial' | 'ear';
export type SimpleModeStage = 'prompt' | 'tutorial' | 'manual' | 'electives';
export type RatioDisplayMode = 'fraction' | 'primePowers' | 'auto';
export type PlaybackVisualizationMode = 'SCROLLER' | 'HUNT205_RING';
export interface PlaybackRingSettings {
  scale: number;
  showAllLabels: boolean;
  showPreferredNames: boolean;
  rotationDeg: number;
  showUpcoming: boolean;
  showDebug: boolean;
}
export type HuntDebugLabelMode = 'none' | 'brief' | 'full';
export type HuntMicroLineMode = 'off' | 'auto' | 'on';
export type HuntSlotLabelDisplay = 'off' | 'hover' | 'debug';
export type HuntSlotLabelMode = 'none' | 'brief' | 'full';
export type HuntZeroPitch = 'C0' | 'A4' | 'custom';

export interface HuntSettings {
  refPitchName: string;
  refPitchHz: number;
  zeroPitch: HuntZeroPitch;
  a4InC0Cents: number;
  debugEnabled: boolean;
  debugLabelMode: HuntDebugLabelMode;
  staffZoom: number;
  voiceColorsEnabled: boolean;
  voiceColors: Record<string, string>;
  staffDisplay: {
    slotStepPx: number;
    visibleZMin: number | null;
    visibleZMax: number | null;
    staffLineCount: number;
    showStaffLines: boolean;
    staffMainLineEvery: number;
    regionLineCount: number;
    regionLineZIndices: number[];
    showRegionLines: boolean;
    microLineCount: number;
    microLineMode: HuntMicroLineMode;
    microLineOpacity: number;
    microLineThickness: number;
    microLineVisibleZoomThreshold: number;
    showLedgerLines: boolean;
    ledgerLengthFactor: number;
    ledgerFadeK: number;
    ledgerMinOpacity: number;
    ledgerMaxCount: number;
    clefScale: number;
    clefOffsetLinesTreble: number;
    clefOffsetLinesBass: number;
    showSlotLabels: HuntSlotLabelDisplay;
    labelMode: HuntSlotLabelMode;
    labelFontSize: number;
    labelColor: string;
  };
}

export interface NotationSymbols {
  [key: number]: { up: string; down: string; placement?: 'left' | 'right' | 'split' };
}

export interface NavigationControlSettings {
  mouseRotateSpeed: number;
  mouseZoomSpeed: number;
  mousePanSpeed: number;
  wasdBaseSpeed: number;
  wasdSprintMultiplier: number;
  doubleTapMs: number;
}

export interface NodeBranchHotkeySettings {
  enabled: boolean;
  requireShift: boolean;
  requireCapsLock: boolean;
  defaultNeg: number;
  defaultPos: number;
}

export interface OriginConfig {
  id: string;
  name: string;
  primeVector: { [key in PrimeLimit]: number };
  rootLimits: PrimeLimit[];
  expansionA: number;
  gen0MaxLength?: number;
  gen0MaxDisplayLength?: number;
  gen0CustomizeEnabled?: boolean;
  gen0Lengths: { [key in PrimeLimit]?: number };
  gen0Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } };
  expansionB: number;
  gen1Lengths: { [key in PrimeLimit]?: number };
  gen1Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } };

  gen2Lengths?: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: number } };
  gen2Ranges?: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: { neg: number, pos: number } } };
  gen3Lengths?: { [key in PrimeLimit]?: number };
  gen3Ranges?: { [key in PrimeLimit]?: { neg: number, pos: number } };
  gen4Lengths?: { [key in PrimeLimit]?: number };
  gen4Ranges?: { [key in PrimeLimit]?: { neg: number, pos: number } };
  expansionC: number;
  expansionD: number;
  expansionE: number;
  maxPrimeLimit: PrimeLimit;
  gen1MaxPrimeLimit?: PrimeLimit;
  gen2MaxPrimeLimit?: PrimeLimit;
  gen3MaxPrimeLimit?: PrimeLimit;
  gen4MaxPrimeLimit?: PrimeLimit;
  gen1PrimeSet?: PrimeLimit[];
  gen2PrimeSet?: PrimeLimit[];
  gen3PrimeSet?: PrimeLimit[];
  gen4PrimeSet?: PrimeLimit[];
  axisLooping?: { [key in PrimeLimit]?: number | null };
  commaSpreadingEnabled?: { [key in PrimeLimit]?: boolean };
  loopTolerance?: number;
}

export interface SpiralConfig {
  enabled: boolean;
  axis: PrimeLimit;
  length: number;

  commaTolerance?: number;

  primaryStep: number;
  primaryCents: number;
  radius1: number;
  rise: number;

  secondaryStep: number;
  secondaryCents: number;
  radius2: number;
  rise2?: number;

  tertiaryStep?: number;
  tertiaryCents?: number;
  radius3?: number;
  rise3?: number;

  expansionB?: number;
  expansionC?: number;
}

export interface EqualStepConfig {
  enabled: boolean;
  base: number;
  divisions: number;
  deltaN: number;
  stepsPerCircle: number;
  range: number;
  radius: number;
  zRise: number;
  layerGap: number;
  visualizationMode: 'helix' | 'graphite';
}

export interface GeometryConfig {
  enabled: boolean;
  mode: 'rectangle' | 'sphere' | 'custom';
  // Rectangle mode settings (existing)
  limits: [PrimeLimit, PrimeLimit, PrimeLimit];
  dimensions: [number, number, number];
  useHarmonicColors?: boolean;
  spacing?: number;
  ignoreOverrides?: boolean;
  // Sphere mode settings
  sphere?: {
    limits: [PrimeLimit, PrimeLimit, PrimeLimit];
    structuringAxis: PrimeLimit; // Axis for stacking 2D planes
    radius: number;
  };
  // Branch lengths per gen level (optional expansion)
  branchLengths?: {
    [gen: number]: { pos: number; neg: number };
  };
  // Per-node branch length overrides
  nodeBranchOverrides?: {
    [nodeId: string]: {
      pos: number;
      neg: number;
      axisOverrides?: { [limit: string]: { pos: number; neg: number; customCurve?: { points: { x: number, y: number }[] } } };
    };
  };
  custom?: CustomGeometryConfig;
}

export interface CustomGeometryConfig {
  style: 'implicit' | 'parametric' | 'voxel' | 'preset';
  inputSpace: 'lattice' | 'world' | 'both';
  thresholdMode: 'lte0' | 'abs';
  epsilon: number;
  implicitExpression: string;
  voxelExpression: string;
  presetId: string;
  parametric: {
    mode: 'curve' | 'surface';
    expression: string;
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
    uSteps: number;
    vSteps: number;
    thickness: number;
  };
}

export type CurvedPitchMetric = 'log2' | 'cents' | 'primeL1' | 'primeL2' | 'primeLInf' | 'weighted';
export type CurvedDistanceMode = 'linear' | 'power' | 'log';

export interface CurvedGeometryConfig {
  enabled: boolean;
  pitchMetric: CurvedPitchMetric;
  distanceMode: CurvedDistanceMode;
  distanceScale: number;
  distanceExponent: number;
  distanceOffset: number;
  curveRadiansPerStep: number;
  autoSpacing: boolean;
  collisionPadding: number;
}

export interface AppSettings {
  isArActive: boolean;
  isSimpleMode: boolean;
  simpleLabelMode: 'name' | 'ratio' | 'both';
  namingSetupCompleted?: boolean;
  branchHotkeys?: NodeBranchHotkeySettings;
  maxPrimeLimit: PrimeLimit;
  gen1MaxPrimeLimit?: PrimeLimit;
  gen2MaxPrimeLimit?: PrimeLimit;
  gen3MaxPrimeLimit?: PrimeLimit;
  gen4MaxPrimeLimit?: PrimeLimit;
  gen1PrimeSet?: PrimeLimit[];
  gen2PrimeSet?: PrimeLimit[];
  gen3PrimeSet?: PrimeLimit[];
  gen4PrimeSet?: PrimeLimit[];
  rootLimits: PrimeLimit[];
  secondaryOrigins: OriginConfig[];
  expansionDirection: 'both' | 'positive' | 'negative';
  expansionA: number;
  gen0MaxLength: number;
  gen0MaxDisplayLength: number;
  gen0CustomizeEnabled: boolean;
  gen0Lengths: { [key in PrimeLimit]?: number };
  gen0Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } };
  expansionB: number;
  gen1Lengths: { [key in PrimeLimit]?: number };
  gen1Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } };

  gen2Lengths?: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: number } };
  gen2Ranges?: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: { neg: number, pos: number } } };
  gen3Lengths?: { [key in PrimeLimit]?: number };
  gen3Ranges?: { [key in PrimeLimit]?: { neg: number, pos: number } };
  gen4Lengths?: { [key in PrimeLimit]?: number };
  gen4Ranges?: { [key in PrimeLimit]?: { neg: number, pos: number } };
  expansionC: number;
  expansionD: number;
  expansionE: number;
  playDurationSingle: number;
  playDurationDual: number;
  baseFrequency: number;
  transpositionVector: { [key in PrimeLimit]: number };
  waveform: WaveformShape;
  instrumentClick?: WaveformShape;
  instrumentKeyboard?: WaveformShape;
  instrumentChord?: WaveformShape;
  synthPatches?: {
    enabled: boolean;
    clickPatch?: SynthPatch;
    chordPatch?: SynthPatch;
    keyboardPatch?: SynthPatch;
  };
  timbre: TimbreSettings;
  tuner?: TunerSettings;
  visuals: {
    backgroundColor: string;
    backgroundImageUrl: string | null;
    limitColors: { [key in PrimeLimit]: string };
    limitOpacities: { [key in PrimeLimit]: number };
    genOpacities: { [key: number]: number };
    maxVisibleGen: number;
    nodeShape: NodeShape;
    nodeMaterial: NodeMaterial;
    nodeScale: number;
    edgeOpacity: number;
    lineRenderingMode: 'performance' | 'quality';
    renderScale?: number;
    enableFog: boolean;
    globalScale: number;
    primeSpacings: { [key in PrimeLimit]?: number };
    layoutMode: 'lattice' | 'pitch-field' | 'h-chroma' | 'diamond';
    spiralFactor: number;
    helixFactor: number;
    diamondLimit?: number;
    temperamentMorph: number;
    showGhostGrid: boolean;
    ghostOpacity: number;
    tetDivisions: number;
    labelMode: 'ratio' | 'name';
    latticeLabelMode?: 'ratio' | 'name' | 'both';

    nodeSurfaceRatioLabelsEnabled?: boolean;
    nodeSurfaceRatioFontScale?: number;
    nodeSurfaceRatioTexturedMode?: 'both' | 'ratioOnly' | 'textureOnly';
    nodeSurfaceRatioPlacement?: 'surface' | 'above';
    nodeSurfaceRatioLabelMode?: 'ratio' | 'harmonic';
    nodeSurfaceRatioEmphasizePrimes?: boolean;

    nodeSurfaceRatioFilterMode?: 'all' | 'nearCenter' | 'mainAxis' | 'nearCenterAndMainAxis';
    nodeSurfaceRatioNearCenterCount?: number;
    ratioDisplay?: {
      autoPowerDigits?: number;
      contexts?: {
        infoPanel?: RatioDisplayMode;
        nodeDeriver?: RatioDisplayMode;
        search?: RatioDisplayMode;
        nodeLabels?: RatioDisplayMode;
        musicXmlRetune?: RatioDisplayMode;
      };
    };
    globalBrightness?: number;
    nodeColorMode?: 'limit' | 'harmonic';

    hChromaBase?: number;
    hChromaLimit?: number;
    hChromaColorMode?: 'pure' | 'primaryRatio';
    hChromaAutoRotate?: boolean;
    hChromaAutoRotateSpeed?: number;
    hChromaLabelMode?: 'harmonic' | 'ratio' | 'both' | 'none';
    hChromaShowPrimaryTriplet?: boolean;
    hChromaPrimaryA?: string;
    hChromaPrimaryB?: string;
    hChromaPrimaryC?: string;
    hChromaRadius?: number;
    hChromaHeightScale?: number;
    hChromaBranchEnabled?: boolean;
    hChromaBranchScope?: 'all' | 'selected';
    hChromaBranchBase?: number;
    hChromaBranchLengthPos?: number;
    hChromaBranchLengthNeg?: number;
    hChromaBranchSpacing?: number;
    hChromaBranchSelected?: number[];
    hChromaBranchSelectedHarmonic?: number;
    hChromaBranchOverrides?: Record<number, { enabled?: boolean; lengthPos?: number; lengthNeg?: number; base?: number }>;

    hChromaSpectrumSplitEnabled?: boolean;
    hChromaSpectrumDepth?: number;
    hChromaCustomScale?: string[];
  };
  playbackVisualizationMode: PlaybackVisualizationMode;
  playbackRing: PlaybackRingSettings;
  notationSymbols: NotationSymbols;
  accidentalPlacement: 'split' | 'left' | 'right';
  navigationShortcuts: { [key in PrimeLimit]?: string };
  navigationControls: NavigationControlSettings;
  centsTolerance: number;
  autoCameraFocus: boolean;
  deduplicateNodes: boolean;
  deduplicationTolerance: number;
  priorityOrder: PriorityCriteria[];
  ensureConnectivity: boolean;
  playUnisonOnSelect: boolean;
  nearbySort: NearbySortCriteria;
  nearbyCount: number;
  highlightNearby: boolean;
  loopTolerance: number;
  axisLooping: { [key in PrimeLimit]?: number | null };
  commaSpreadingEnabled: { [key in PrimeLimit]?: boolean };
  midi: {
    enabled: boolean;
    inputName: string;
    centerNote: number;
    channel: number;
    velocitySensitivity: boolean;
    mappingMode: 'lattice' | 'axis' | 'custom';
    restrictAxis?: number;
    mappingDivisions?: number;
    mappingScale: string[];
    keyFilter: 'all' | 'white' | 'black';
    outputEnabled?: boolean;
    outputId?: string;
    outputChannel?: number;
    outputChannels?: number[];
    outputPitchBendRange?: number;
    polyphonicChannelMode?: boolean;
  };
  midiDeviceManager?: {
    selectedDeviceId: string | null;
    localControlDefault: 'on' | 'off';
    channelMode: 'omni' | 'single';
    activeChannel: number;
    autoReconnect: boolean;
    scanInterval: number;
  };
  spiral?: SpiralConfig;
  equalStep?: EqualStepConfig;
  geometry?: GeometryConfig;
  curvedGeometry?: CurvedGeometryConfig;

  customPrimes?: CustomPrimeConfig[];

  retuner?: RetunerSettings;
  retunerState?: RetunerState;
  retunerDestinations?: OutputDestination[];

  maskedNodeIds?: string[];
  hunt: HuntSettings;
}

export interface SavedChord { id: string; name: string; description?: string; nodes: NodeData[]; }
export interface ComparisonGroup {
  id: string;
  name: string;
  nodes: NodeData[];
  color: string;
  visible: boolean;
}
export interface SavedKeyboard { id: string; name: string; nodes: NodeData[]; bindings: Record<string, string>; }
export interface Comma { id?: string; name: string; n: bigint; d: bigint; cents: number; }
export interface SavedMidiScale { id: string; name: string; scale: string[]; }
export interface SavedChordGroupCollection {
  id: string;
  name: string;
  groups: ComparisonGroup[];
  createdAt: string;
}

export type PanelId = 'settings' | 'info' | 'keyboard' | 'comparison' | 'progression' | 'theory' | 'mathlab' | 'midi-device' | 'score' | 'workspace';
export type PanelMode = 'float' | 'dock-left' | 'dock-right' | 'dock-bottom' | 'fullscreen';
export interface PanelState {
  id: PanelId;
  title: string;
  isOpen: boolean;
  isCollapsed: boolean;
  isPinned: boolean;
  mode: PanelMode;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export type PlayMode = 'chord' | 'arp' | 'rest';
export type ArpPattern = 'up' | 'down' | 'up-down' | 'random';
export interface ProgressionStep {
  id: string;
  chordId: string;
  duration: number;
  velocity: number;
  mode?: PlayMode;
  arpPattern?: ArpPattern;
  subdivision?: number;
  gate?: number;
}

export type MathObjectType = 'explicit' | 'parametric' | 'polar' | 'implicit' | 'point' | 'vector_field';
export type DotQuantizeMode = 'none' | 'edo' | 'cents_step' | 'prime_limit_fraction';

export interface MathObject {
  id: string;
  name: string;
  type: MathObjectType;
  expression: string;
  params: { min: number, max: number };
  visible: boolean;
  color: string;
  locked: boolean;
  mappingEnabled: boolean;
  tags?: string[];
  group?: string;
  order?: number;
  implicitResolutionMode?: 'auto' | 'manual';
  implicitResolution?: number;
  implicitShowAll?: boolean;
  angleUnit?: 'rad' | 'deg';
  polarNegativeMode?: 'allow' | 'clamp';
  samplingOverride?: {
    enabled?: boolean;
    sampleCount?: number;
    strategy?: 'uniform_x' | 'uniform_param' | 'arc_length' | 'adaptive_pixel' | 'adaptive_curvature';
  };
}

export interface MathViewSettings {
  xMin: number; xMax: number; yMin: number; yMax: number; grid: boolean;
}

export interface MathSamplingSettings {
  sampleCount: number;
  strategy: 'uniform_x' | 'uniform_param' | 'arc_length' | 'adaptive_pixel' | 'adaptive_curvature';
  mappingMode: 'y_ratio' | 'y_cents' | 'x_cents' | 'y_hz' | 'bounded' | 'complex';
  boundedRange: { min: number, max: number };
  complexComponent: 're' | 'im' | 'abs' | 'arg';
  implicitResolution?: number;
  invalidPolicy?: 'break' | 'skip' | 'clamp' | 'mark';
  baseFreq: number;
  rangeMin: number;
  rangeMax: number;
  quantize: DotQuantizeMode;
  edoDivisions?: number;
  centsStep?: number;
  normalizeToOctave?: boolean;
  primeLimit?: number;
}

export interface MathDot {
  id: string;
  x: number;
  y: number;
  label?: string;
  color?: string;
  role: 'scale' | 'chord' | 'marker' | 'ignore';
  locked?: boolean;
  sourceObjectId?: string;
  u?: number;
  generatedAt?: string;
  segmentId?: number;
}

export interface MathNoteSet {
  id: string; name: string; createdAt: string; updatedAt: string;
  dots: MathDot[];
  mapping: MathSamplingSettings;
  playback: {
    mode: 'scale' | 'chord' | 'arp';
    order: 'x' | 'y' | 'custom' | 'created';
    speedUnit?: 'bpm' | 'ms';
    bpm: number;
    noteMs: number;
    gapMs: number;
    chordMs: number;
    gate?: number;
  };
  timelineGrid?: { snapX: boolean; xStep: number; };
  export?: {
    order?: 'x' | 'y' | 'custom' | 'created';
    dedupe?: boolean;
    normalizeToOctave?: boolean;
  };
}

export interface MathFunctionPreset {
  id: string;
  name: string;
  category: 'Algebra' | 'Trig' | 'Exponential' | 'Logarithmic' | 'Parametric' | 'Polar' | 'Implicit' | 'Audio' | 'Special' | 'Hyperbolic' | 'Polynomial' | 'Rational';
  type: MathObjectType;
  expression: string;
  params: { min: number, max: number };
  suggestedView: MathViewSettings;
  tags?: string[];
}

export type VariableRole = 'domain' | 'parameter';
export interface VariableDef { name: string; min: number; max: number; step: number; value: number; role: VariableRole; }

export interface ConsequentialScaleConfig {
  id: string;
  name: string;
  expressionRaw: string;
  mode: 'ModeA' | 'ModeB' | 'Custom';
  importedType?: MathObjectType;
  advancedSymbols: boolean;
  derivativeOrder?: number;
  derivVar?: string;
  showOriginal?: boolean;
  mappingMode?: 'scalar_ratio' | 'parametric_y' | 'polar_r';
  domain: {
    nStart: number; nEnd: number; nStep: number;
    iStart: number; iEnd: number; iStep: number;
    iList?: number[];
    varyMode: 'Grid' | 'FixN_VaryI' | 'FixI_VaryN';
    variables?: VariableDef[];
  };
  mapping: {
    baseFreq: number;
    normalizeToOctave: boolean;
    quantizeMode: 'none' | 'edo' | 'prime_limit_fraction';
    primeLimit: PrimeLimit;
    maxDen?: number;
    edoDivisions?: number;
    centsStep?: number;
    handleNegative?: 'mask' | 'abs' | 'shift';
    linearMode?: boolean;
    linearUnit?: number;
  };
  display: {
    showOutOfRange: boolean;
    graphEnabled: boolean;
    xAxis: 'idx' | 'n' | 'i' | 'Hz' | 'Ratio' | 'Cents' | string;
    yAxis: 'idx' | 'n' | 'i' | 'Hz' | 'Ratio' | 'Cents';
    showDerivative?: boolean;
    derivAbsolute?: boolean;
    derivStep?: number;
    showGraphPath?: boolean;
    showNoteDots?: boolean;
    drawOrder?: 'notes_first' | 'graph_first' | 'none';
    revealMsPerNote?: number;
    revealMaxDots?: number;
    xSpacingMode?: 'uniform_step' | 'from_xaxis';
    uniformXStep?: number;
  };
  playback: {
    chordNoteCount: number;
    spreadOctaves: number;
    minSpacingCents: number;
    strategy: 'stack' | 'wrap';
    scaleNoteDuration?: number;
    scaleNoteGap?: number;
    speedUnit?: 'ms' | 'bpm';
    bpm?: number;
    gate?: number;
  };
}

export interface ConsequentialNote {
  idx: number;
  n: number;
  i: number;
  varsSnapshot?: Record<string, number>;
  rawValue: string;
  rawScalar?: number;
  originalScalar?: number;
  ratioFloat: number;
  freqHz: number;
  playable: boolean;
  cents: number;
  octaveShift: number;
  primeVector?: { [key in PrimeLimit]: number };
  frac?: { n: bigint, d: bigint };
}

export interface ConsequentialScaleResult {
  configId: string;
  notes: ConsequentialNote[];
  generatedAt: number;
  stats: {
    totalCount: number;
    playableCount: number;
    outOfRangeCount: number;
    minFreq: number;
    maxFreq: number;
    minCents: number;
    maxCents: number;
    invalidCount: number;
  };
}

export interface MathLabState {
  version?: number;
  objects: MathObject[];
  view: MathViewSettings;
  sampling: MathSamplingSettings;
  noteSets: MathNoteSet[];
  activeNoteSetId: string | null;
  editor: {
    tool: 'pan' | 'select' | 'add_dot' | 'delete';
    selectedDotId: string | null;
    selectedObjectId: string | null;
    hoverDotId: string | null;
    showThumbnails: boolean;
    showDotLabels: boolean;
    showDebugPitch: boolean;
    snapThresholdPx?: number;
    snapThresholdMath?: number;
    snapTarget?: 'selected' | 'visible' | 'mapping' | 'group';
    snapUseHighRes?: boolean;
    snapGroup?: string;
  };
  consequentialScales: ConsequentialScaleConfig[];
  activeConsequentialScaleId: string | null;
  consequentialCache: Record<string, ConsequentialScaleResult>;
  unifiedFunctionState?: {
    variableBindings: Record<string, number>;
    variableDefs?: Record<string, { min: number; max: number; step: number }>;
  };
}
