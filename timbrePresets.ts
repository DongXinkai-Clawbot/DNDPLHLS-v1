import type { TimbrePatch, TimbreSettings, TimbreVoiceSettings, TimbreMacro } from './types';

export const TIMBRE_PATCH_SCHEMA_VERSION = 4;

const emptyTable = (size: number) => new Array(size).fill(-1);

const baseMacros = (): TimbreMacro[] => ([
  { id: 'macro1', name: 'Macro 1', value: 0.5, min: 0, max: 1, curve: 'linear' },
  { id: 'macro2', name: 'Macro 2', value: 0.5, min: 0, max: 1, curve: 'linear' }
]);

const baseVoice = (): TimbreVoiceSettings => ({
  gain: 0.6,
  oscBank: {
    enabled: true,
    sync: { enabled: false, ratio: 2 },
    oscillators: [
      { id: 'osc1', type: 'sine', gain: 1.0 }
    ]
  },
  harmonic: {
    enabled: false,
    mode: 'parametric',
    harmonicCount: 24,
    rolloff: 1.2,
    brightness: 0,
    oddEven: 0,
    groupWeights: [1, 1, 1, 1],
    groupDecay: [1, 1.1, 1.2, 1.4],
    jitter: 0,
    phaseMode: 'locked',
    phaseSpread: 0,
    inharmonicity: 0,
    inharmonicityCurve: 1,
    mask: 'all',
    pattern: '',
    table: emptyTable(32),
    tableSize: 32,
    normalize: true,
    lockEnergy: true,
    mix: 1
  },
  unison: {
    enabled: false,
    voices: 2,
    detune: 12,
    spread: 0.6,
    phase: 0.5,
    blend: 0
  },
  noise: {
    enabled: false,
    burstAmount: 0.25,
    burstDecayMs: 90,
    sustainAmount: 0,
    filterHz: 8000,
    highpassHz: 120,
    color: 0,
    stereoWidth: 0,
    mix: 0.4
  },
  sample: {
    enabled: false,
    masterGain: 0.8,
    layers: [],
    velocityCurve: 'linear',
    roundRobinMode: 'cycle',
    releaseSamples: [],
    releaseMix: 0.5,
    legatoTransitions: []
  },
  vaOsc: {
    enabled: false,
    osc1: { waveform: 'sawtooth', octave: 0, semitone: 0, cent: 0, level: 0.8, pan: 0, pwmDepth: 0, pwmSource: 'lfo1' },
    osc2: { waveform: 'sawtooth', octave: 0, semitone: 0, cent: 0, level: 0.6, pan: 0, pwmDepth: 0, pwmSource: 'lfo1' },
    subOsc: { waveform: 'sine', octave: -1, semitone: 0, cent: 0, level: 0.4, pan: 0, pwmDepth: 0, pwmSource: 'lfo1' },
    noiseOsc: { waveform: 'square', octave: 0, semitone: 0, cent: 0, level: 0, pan: 0, pwmDepth: 0, pwmSource: 'lfo1' },
    syncOsc2: false
  },
  envelopes: {
    amp: { attackMs: 6, holdMs: 0, decayMs: 140, sustain: 0.7, releaseMs: 240, curve: 'linear' },
    filter: { enabled: false, attackMs: 6, holdMs: 0, decayMs: 180, sustain: 0.5, releaseMs: 200, amount: 0.2, curve: 'linear' },
    spectralDecay: { amount: 0.35, curve: 1.0, maxMultiplier: 3.5 }
  },
  filter: {
    enabled: false,
    type: 'lowpass',
    slope: 12,
    cutoffHz: 2000,
    q: 0.7,
    keyTracking: 0.25,
    keyTrackingBaseHz: 261.63,
    envAmount: 0.2,
    lfoAmount: 0,
    comb: { mix: 0, freqHz: 440, feedback: 0.3, dampingHz: 6000 },
    formant: { mix: 0.5, morph: 0, vowel: 'a', peaks: [] }
  },
  masterFilter: {
    enabled: false,
    type: 'lowpass',
    cutoffHz: 20000,
    resonance: 0,
    mix: 1
  },
  eq: {
    enabled: false,
    lowGain: 0,
    midGain: 0,
    highGain: 0,
    lowFreq: 150,
    midFreq: 1000,
    highFreq: 6000,
    midQ: 1
  },
  fm: {
    enabled: false,
    waveform: 'sine',
    ratio: 1,
    depth: 0.0,
    target: 'osc'
  },
  fmOperators: {
    enabled: false,
    algorithm: 'algo1',
    operators: [
      { ratio: 1, detuneCents: 0, level: 0.6, feedback: 0 },
      { ratio: 1, detuneCents: 0, level: 0.5, feedback: 0 },
      { ratio: 1, detuneCents: 0, level: 0.4, feedback: 0 },
      { ratio: 1, detuneCents: 0, level: 0.4, feedback: 0 }
    ],
    safeMode: true
  },
  ringMod: {
    enabled: false,
    waveform: 'sine',
    ratio: 1,
    depth: 0.4,
    mix: 0
  },
  mseg: {
    enabled: false,
    amount: 1,
    points: [
      { timeMs: 0, value: 0 },
      { timeMs: 80, value: 1 },
      { timeMs: 240, value: 0.6 },
      { timeMs: 400, value: 0 }
    ]
  },
  nonlinearity: {
    enabled: false,
    type: 'tanh',
    drive: 1,
    mix: 0,
    compensation: 1,
    autoGain: true,
    outputTrim: 0
  },
  space: {
    reverb: { enabled: false, mix: 0.15, decay: 1.6, preDelayMs: 18, size: 0.5, color: 10000, stereoWidth: 1, modDepth: 0, modSpeed: 0.5, dampingHz: 5000, earlyMix: 0, earlyDelayMs: 12 },
    resonance: { enabled: false, mix: 0.2, delayMs: 24, feedback: 0.25, dampingHz: 3500 }
  },
  sympathetic: {
    enabled: false,
    amount: 0.2,
    decay: 0.5,
    color: 0.2
  },
  mechanicalNoise: {
    enabled: false,
    keyNoise: 0.15,
    releaseNoise: 0.15,
    breathNoise: 0.1,
    bowNoise: 0.1,
    color: 'white',
    hpHz: 80,
    lpHz: 12000
  },
  chorus: { enabled: false, mix: 0.4, depth: 0.3, rate: 0.5, delay: 0.02, feedback: 0.4, spread: 0.5, sync: false, syncDivision: '1/4' },
  phaser: { enabled: false, mix: 0.5, depth: 0.6, rate: 0.2, feedback: 0.5, baseHz: 500, stages: 4, sync: false, syncDivision: '1/4' },
  delay: { enabled: false, mix: 0.3, timeMs: 300, feedback: 0.4, stereoOffsetMs: 20, pingPong: false, sync: false, syncDivision: '1/4', filterHz: 8000, filterHighpassHz: 40, stereoWidth: 1, ducking: 0, color: 8000, modDepth: 0, modRate: 0.5, type: 'stereo' },
  bitcrush: { enabled: false, bitDepth: 12, sampleRateReduce: 1, jitter: 0, mix: 0.2 },
  granular: { enabled: false, sourceUrl: '', grainSizeMs: 60, density: 8, position: 0.5, positionJitter: 0.2, pitch: 0, spray: 0.2, windowType: 'hann', freeze: false, mix: 0 },
  compressor: { enabled: false, threshold: -24, ratio: 4, attackMs: 10, releaseMs: 100, gain: 4 },
  limiter: { enabled: true, preGain: 0, mix: 1, threshold: -0.1, releaseMs: 50 },
  lfo: {
    lfo1: { enabled: false, waveform: 'sine', rateHz: 4.5, tempoSync: false, syncDivision: '1/4', phase: 0, fadeInMs: 0, oneShot: false, retrigger: true, curve: 'linear' },
    lfo2: { enabled: false, waveform: 'sine', rateHz: 0.35, tempoSync: false, syncDivision: '1/4', phase: 0, fadeInMs: 0, oneShot: false, retrigger: true, curve: 'linear' },
    lfo3: { enabled: false, waveform: 'sine', rateHz: 1.1, tempoSync: false, syncDivision: '1/8', phase: 0, fadeInMs: 0, oneShot: false, retrigger: true, curve: 'linear' },
    lfo4: { enabled: false, waveform: 'sine', rateHz: 0.12, tempoSync: false, syncDivision: '1/16', phase: 0, fadeInMs: 0, oneShot: false, retrigger: true, curve: 'linear' }
  },
  karplus: {
    enabled: false,
    mix: 0.35,
    feedback: 0.6,
    dampingHz: 3200,
    delayMs: 12,
    trackPitch: true,
    exciterAmount: 0.5,
    exciterDecayMs: 70
  }
});

const baseRouting = () => ({
  enableOscBank: true,
  enableHarmonic: true,
  enableNoise: true,
  enableKarplus: true,
  enableFilter: true,
  enableEq: true,
  enableFm: true,
  enableRingMod: true,
  enableMseg: true,
  enableNonlinearity: true,
  enableSpace: true,
  enableChorus: true,
  enablePhaser: true,
  enableDelay: true,
  enableBitcrush: true,
  enableGranular: true,
  enableCompressor: true,
  enableLimiter: true
});

const basePerformance = () => ({
  polyphony: 16, 
  maxPartials: 24,
  portamentoMs: 0,
  velocityCurve: 'linear' as const,
  releaseMode: 'normal' as const,
  voiceSteal: 'release-first' as const,
  pitchBendRangeSemitones: 2,
  rebuildCrossfadeMs: 20
});

export const DEFAULT_TIMBRE_PATCHES: TimbrePatch[] = [
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-pure-sine',
    name: 'Pure Sine',
    tags: ['basic'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: true, oscillators: [{ id: 'osc1', type: 'sine', gain: 1.0 }] },
      harmonic: { ...baseVoice().harmonic, enabled: false },
      noise: { ...baseVoice().noise, enabled: false },
      filter: { ...baseVoice().filter, enabled: false },
      nonlinearity: { ...baseVoice().nonlinearity, enabled: false },
      space: { ...baseVoice().space, reverb: { ...baseVoice().space.reverb, enabled: false } },
      karplus: { ...baseVoice().karplus, enabled: false }
    },
    performance: { ...basePerformance(), maxPartials: 12 },
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-harmonic-warm',
    name: 'Harmonic Warm',
    tags: ['harmonic', 'warm'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: true, oscillators: [{ id: 'osc1', type: 'triangle', gain: 0.5 }] },
      harmonic: {
        ...baseVoice().harmonic,
        enabled: true,
        rolloff: 1.4,
        brightness: -0.2,
        oddEven: 0.2,
        groupWeights: [1.2, 1, 0.7, 0.4],
        mix: 0.8
      },
      filter: { ...baseVoice().filter, enabled: true, cutoffHz: 1800, q: 0.8, keyTracking: 0.35 }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-bright-harmonic',
    name: 'Bright Harmonic',
    tags: ['bright'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: true, oscillators: [{ id: 'osc1', type: 'sawtooth', gain: 0.35 }] },
      harmonic: {
        ...baseVoice().harmonic,
        enabled: true,
        rolloff: 0.9,
        brightness: 0.6,
        oddEven: -0.1,
        groupWeights: [1, 1, 1.1, 1.2],
        mix: 0.9
      },
      filter: { ...baseVoice().filter, enabled: true, cutoffHz: 4200, q: 0.6, keyTracking: 0.4 }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-metallic-inharmonic',
    name: 'Metallic Inharmonic',
    tags: ['metal', 'inharmonic'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: false, oscillators: [] },
      harmonic: {
        ...baseVoice().harmonic,
        enabled: true,
        rolloff: 0.8,
        brightness: 0.5,
        jitter: 0.2,
        inharmonicity: 0.55,
        inharmonicityCurve: 1,
        groupWeights: [0.8, 1, 1.1, 1.1],
        mix: 1
      },
      filter: { ...baseVoice().filter, enabled: true, type: 'bandpass', cutoffHz: 1800, q: 1.2, keyTracking: 0.2 },
      nonlinearity: { ...baseVoice().nonlinearity, enabled: true, drive: 1.3, mix: 0.35, compensation: 0.8 },
      space: {
        reverb: { ...baseVoice().space.reverb, enabled: true, mix: 0.25, decay: 1.8, preDelayMs: 12 },
        resonance: { ...baseVoice().space.resonance, enabled: true, mix: 0.3, delayMs: 28, feedback: 0.4, dampingHz: 2600 }
      }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-pluck-excited',
    name: 'Pluck Excited',
    tags: ['pluck'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: true, oscillators: [{ id: 'osc1', type: 'triangle', gain: 0.35 }] },
      harmonic: { ...baseVoice().harmonic, enabled: true, rolloff: 1.8, brightness: -0.1, mix: 0.45 },
      noise: { ...baseVoice().noise, enabled: true, burstAmount: 0.7, burstDecayMs: 80, sustainAmount: 0.05, mix: 0.55 },
      envelopes: {
        ...baseVoice().envelopes,
        amp: { attackMs: 2, decayMs: 180, sustain: 0.2, releaseMs: 120 },
        filter: { enabled: true, attackMs: 2, decayMs: 160, sustain: 0.2, releaseMs: 120, amount: 0.5 }
      },
      filter: { ...baseVoice().filter, enabled: true, cutoffHz: 2200, q: 0.9, keyTracking: 0.45 },
      karplus: { ...baseVoice().karplus, enabled: true, mix: 0.55, feedback: 0.7, dampingHz: 2800, trackPitch: true }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-soft-saturated',
    name: 'Soft Saturated',
    tags: ['soft', 'saturated'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: {
        enabled: true,
        oscillators: [
          { id: 'osc1', type: 'triangle', gain: 0.6 },
          { id: 'osc2', type: 'sine', gain: 0.35, detuneCents: -3 }
        ]
      },
      nonlinearity: { ...baseVoice().nonlinearity, enabled: true, drive: 1.6, mix: 0.4, compensation: 0.75 },
      filter: { ...baseVoice().filter, enabled: true, cutoffHz: 1600, q: 0.8, keyTracking: 0.25 }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-space-resonant',
    name: 'Space Resonant',
    tags: ['space'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      oscBank: { enabled: true, oscillators: [{ id: 'osc1', type: 'sawtooth', gain: 0.35 }] },
      harmonic: { ...baseVoice().harmonic, enabled: true, rolloff: 1.1, brightness: 0.2, mix: 0.7 },
      space: {
        reverb: { ...baseVoice().space.reverb, enabled: true, mix: 0.45, decay: 2.6, preDelayMs: 40 },
        resonance: { ...baseVoice().space.resonance, enabled: true, mix: 0.25, delayMs: 36, feedback: 0.35, dampingHz: 3000 }
      }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  },
  {
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: 'timbre-karplus-hybrid',
    name: 'Karplus Hybrid',
    tags: ['karplus'],
    folder: 'Core',
    voice: {
      ...baseVoice(),
      harmonic: { ...baseVoice().harmonic, enabled: true, rolloff: 1.6, brightness: -0.1, mix: 0.5 },
      karplus: { ...baseVoice().karplus, enabled: true, mix: 0.45, feedback: 0.75, dampingHz: 2600, trackPitch: true },
      envelopes: {
        ...baseVoice().envelopes,
        amp: { attackMs: 3, decayMs: 220, sustain: 0.35, releaseMs: 200 }
      }
    },
    performance: basePerformance(),
    macros: baseMacros(),
    modMatrix: [],
    routing: baseRouting()
  }
];

export const DEFAULT_TIMBRE_SETTINGS: TimbreSettings = {
  engineMode: 'basic',
  activePatchId: DEFAULT_TIMBRE_PATCHES[0].id,
  patches: DEFAULT_TIMBRE_PATCHES,
  mapping: {
    globalEnabled: true,
    byNoteLabel: false,
    byContext: false,
    noteKeyMode: 'full',
    noteKeyMap: {},
    contextMap: {
      click: DEFAULT_TIMBRE_PATCHES[0].id,
      keyboard: DEFAULT_TIMBRE_PATCHES[1].id,
      sequence: DEFAULT_TIMBRE_PATCHES[2].id
    }
  },
  performance: {
    maxPolyphony: 32, 
    maxPartials: 64,
    autoReduce: true,
    qualityMode: 'balanced',
    voiceSteal: 'release-first'
  },
  lastError: null
};

