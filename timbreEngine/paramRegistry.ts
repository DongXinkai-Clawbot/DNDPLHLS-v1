import type { TimbreModSource, TimbreModTarget, TimbreCurve } from '../types';

export type TimbreParamControlType = 'knob' | 'select' | 'xy';
export type TimbreParamScaling = 'linear' | 'log';
export type TimbreParamCostTier = 'low' | 'mid' | 'high';
export type TimbreParamBinding = 'audioParam' | 'voice' | 'rebuild' | 'crossfade';
export type TimbreParamCategory =
  | 'osc'
  | 'harmonic'
  | 'sample'
  | 'articulation'
  | 'filter'
  | 'fx'
  | 'performance'
  | 'debug'
  | 'mod';
export type TimbreParamDisplayFormat = 'hz' | 'db' | 'ms' | 'percent' | 'semitone' | 'ratio' | 'beats' | 'unitless' | 'seconds' | 'cents';
export type TimbreParamModRateHint = 'control-rate' | 'audio-rate' | 'either';

export type TimbreParamEnumOption = { value: string; label: string };
export type TimbreParamXYSpec = { xTarget: TimbreModTarget; yTarget: TimbreModTarget; curve?: TimbreCurve };

export interface TimbreParamSpec {
  id: TimbreModTarget;
  label: string;
  category: TimbreParamCategory;
  type: TimbreParamControlType;
  min: number;
  max: number;
  step: number;
  scaling: TimbreParamScaling;
  unit?: string;
  displayFormat: TimbreParamDisplayFormat;
  tooltip?: string;
  uiOrder: number;
  modRateHint?: TimbreParamModRateHint;
  enumOptions?: TimbreParamEnumOption[];
  xySpec?: TimbreParamXYSpec;
  advanced?: boolean;
  hidden?: boolean;
  defaultValue: number;
  smoothingMs: number;
  modulatable: boolean;
  costTier: TimbreParamCostTier;
  binding: TimbreParamBinding;
}

const RAW_TIMBRE_PARAM_REGISTRY: Array<Omit<TimbreParamSpec, 'uiOrder'> & { uiOrder?: number }> = [
  { id: 'overallGain', label: 'Overall Gain', category: 'performance', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.6, smoothingMs: 20, modulatable: true, costTier: 'low', binding: 'audioParam', tooltip: 'Main output level before master effects.' },
  { id: 'filterCutoff', label: 'Filter Cutoff', category: 'filter', type: 'knob', min: 20, max: 20000, step: 1, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 2000, smoothingMs: 30, modulatable: true, costTier: 'low', binding: 'audioParam', tooltip: 'Primary filter cutoff frequency.', modRateHint: 'control-rate' },
  { id: 'filterType', label: 'Filter Type', category: 'filter', type: 'select', min: 0, max: 8, step: 1, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 0, modulatable: true, costTier: 'mid', binding: 'crossfade', tooltip: 'Switch filter type (LP/HP/BP/Notch/SVF/Comb/Formant).', enumOptions: [
    { value: 'lowpass', label: 'Low-pass' },
    { value: 'highpass', label: 'High-pass' },
    { value: 'bandpass', label: 'Band-pass' },
    { value: 'notch', label: 'Notch' },
    { value: 'svf', label: 'SVF' },
    { value: 'comb', label: 'Comb' },
    { value: 'formant', label: 'Formant' }
  ] },
  { id: 'filterSlope', label: 'Filter Slope', category: 'filter', type: 'select', min: 12, max: 24, step: 12, scaling: 'linear', unit: 'db/oct', displayFormat: 'unitless', defaultValue: 12, smoothingMs: 0, modulatable: true, costTier: 'mid', binding: 'crossfade', tooltip: 'Filter slope (12 or 24 dB/oct).', enumOptions: [
    { value: '12', label: '12 dB/oct' },
    { value: '24', label: '24 dB/oct' }
  ] },
  { id: 'harmonicBrightness', label: 'Harmonic Brightness', category: 'harmonic', type: 'knob', min: -1, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Tilts harmonic balance toward higher partials.' },
  { id: 'oddEvenBalance', label: 'Odd/Even Balance', category: 'harmonic', type: 'knob', min: -1, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Shifts energy between odd and even harmonics.' },
  { id: 'inharmonicity', label: 'Inharmonicity', category: 'harmonic', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Adds inharmonic stretch to partials.' },
  { id: 'noiseAmount', label: 'Noise Mix', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 20, modulatable: true, costTier: 'low', binding: 'audioParam', tooltip: 'Blend amount for the noise layer.' },
  { id: 'fmDepth', label: 'FM Depth', category: 'osc', type: 'knob', min: 0, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Frequency modulation intensity.' },
  { id: 'ringModMix', label: 'Ring Mod Mix', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Blend amount for ring modulation.' },
  { id: 'msegAmount', label: 'MSEG Amount', category: 'mod', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'low', binding: 'audioParam', tooltip: 'Depth of the multi-segment envelope.' },
  { id: 'drive', label: 'Drive', category: 'fx', type: 'knob', min: 0, max: 8, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Input drive into saturation.', modRateHint: 'control-rate' },
  { id: 'reverbMix', label: 'Reverb Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.15, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Wet level for the reverb.', modRateHint: 'control-rate' },
  { id: 'karplusFeedback', label: 'Karplus Feedback', category: 'osc', type: 'knob', min: 0, max: 0.99, step: 0.001, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.6, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Karplus feedback amount.' },
  { id: 'karplusMix', label: 'Karplus Mix', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.35, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Blend amount for Karplus layer.' },
  { id: 'resonanceMix', label: 'Resonance Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.2, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Mix level for resonance effect.' },
  { id: 'unisonDetune', label: 'Unison Detune', category: 'osc', type: 'knob', min: 0, max: 100, step: 0.1, scaling: 'linear', unit: 'cents', displayFormat: 'cents', defaultValue: 12, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Detune spread between unison voices.' },
  { id: 'unisonSpread', label: 'Unison Spread', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.6, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Stereo width for unison voices.' },
  { id: 'chorusMix', label: 'Chorus Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Wet level for chorus.' },
  { id: 'phaserMix', label: 'Phaser Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Wet level for phaser.' },
  { id: 'delayMix', label: 'Delay Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.3, smoothingMs: 30, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Wet level for delay.', modRateHint: 'control-rate' },
  { id: 'delayFeedback', label: 'Delay Feedback', category: 'fx', type: 'knob', min: 0, max: 0.95, step: 0.001, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 30, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Feedback amount in delay.', modRateHint: 'control-rate' },
  // A5: New Targets
  { id: 'harmonicRolloff', label: 'Harmonic Rolloff', category: 'harmonic', type: 'knob', min: 0, max: 10, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 2, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Slope of harmonic rolloff.' },
  { id: 'harmonicJitter', label: 'Harmonic Jitter', category: 'harmonic', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Random level variation per harmonic.' },
  { id: 'harmonicCount', label: 'Harmonic Count', category: 'harmonic', type: 'knob', min: 1, max: 64, step: 1, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 24, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Number of partials in harmonic model.' },
  { id: 'harmonicGroupWeight1', label: 'Harmonic Group W1', category: 'harmonic', type: 'knob', min: 0, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Weight for harmonic group 1.' },
  { id: 'harmonicGroupWeight2', label: 'Harmonic Group W2', category: 'harmonic', type: 'knob', min: 0, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Weight for harmonic group 2.' },
  { id: 'harmonicGroupWeight3', label: 'Harmonic Group W3', category: 'harmonic', type: 'knob', min: 0, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Weight for harmonic group 3.' },
  { id: 'harmonicGroupWeight4', label: 'Harmonic Group W4', category: 'harmonic', type: 'knob', min: 0, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Weight for harmonic group 4.' },
  { id: 'harmonicMaskLow', label: 'Harmonic Mask Low', category: 'harmonic', type: 'knob', min: -2, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Low cutoff for harmonic mask.' },
  { id: 'harmonicMaskHigh', label: 'Harmonic Mask High', category: 'harmonic', type: 'knob', min: -2, max: 2, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'High cutoff for harmonic mask.' },
  { id: 'filterQ', label: 'Filter Q', category: 'filter', type: 'knob', min: 0.1, max: 20, step: 0.1, scaling: 'log', unit: '', displayFormat: 'ratio', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Filter resonance amount.' },
  { id: 'filterKeyTracking', label: 'Filter KeyTrack', category: 'filter', type: 'knob', min: -1, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0.25, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Key tracking influence on cutoff.' },
  { id: 'filterCombMix', label: 'Comb Mix', category: 'filter', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Comb filter wet mix.' },
  { id: 'filterCombFreq', label: 'Comb Frequency', category: 'filter', type: 'knob', min: 40, max: 20000, step: 1, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 440, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Comb delay frequency.' },
  { id: 'filterCombFeedback', label: 'Comb Feedback', category: 'filter', type: 'knob', min: 0, max: 0.99, step: 0.001, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.3, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Comb feedback amount.' },
  { id: 'filterCombDamping', label: 'Comb Damping', category: 'filter', type: 'knob', min: 200, max: 12000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 6000, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Comb damping lowpass.' },
  { id: 'formantMorph', label: 'Formant Morph', category: 'filter', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Morph between vowel/formant shapes.' },
  { id: 'formantMix', label: 'Formant Mix', category: 'filter', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Formant filter wet mix.' },
  { id: 'formantF1', label: 'Formant F1', category: 'filter', type: 'knob', min: 200, max: 1200, step: 1, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 500, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Formant peak 1 frequency.' },
  { id: 'formantF2', label: 'Formant F2', category: 'filter', type: 'knob', min: 500, max: 3000, step: 1, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 1500, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Formant peak 2 frequency.' },
  { id: 'formantF3', label: 'Formant F3', category: 'filter', type: 'knob', min: 1200, max: 5000, step: 1, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 2500, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Formant peak 3 frequency.' },
  { id: 'noiseFilterHz', label: 'Noise Lowpass', category: 'osc', type: 'knob', min: 100, max: 20000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 20000, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Noise low-pass cutoff.' },
  { id: 'noiseHighpassHz', label: 'Noise Highpass', category: 'osc', type: 'knob', min: 10, max: 20000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 10, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Noise high-pass cutoff.' },
  { id: 'noiseColor', label: 'Noise Color', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Noise spectral tilt.' },
  { id: 'chorusRate', label: 'Chorus Rate', category: 'fx', type: 'knob', min: 0.1, max: 10, step: 0.01, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Chorus modulation rate.' },
  { id: 'chorusDepth', label: 'Chorus Depth', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Chorus modulation depth.' },
  { id: 'chorusFeedback', label: 'Chorus Feedback', category: 'fx', type: 'knob', min: 0, max: 0.95, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Chorus feedback amount.' },
  { id: 'phaserRate', label: 'Phaser Rate', category: 'fx', type: 'knob', min: 0.1, max: 10, step: 0.01, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Phaser modulation rate.' },
  { id: 'phaserFeedback', label: 'Phaser Feedback', category: 'fx', type: 'knob', min: 0, max: 0.95, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Phaser feedback amount.' },
  { id: 'phaserStages', label: 'Phaser Stages', category: 'fx', type: 'knob', min: 2, max: 12, step: 1, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 4, smoothingMs: 40, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Number of phaser stages.' },
  { id: 'delayTime', label: 'Delay Time', category: 'fx', type: 'knob', min: 0.01, max: 2.0, step: 0.01, scaling: 'log', unit: 's', displayFormat: 'seconds', defaultValue: 0.3, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Base delay time.', modRateHint: 'control-rate' },
  { id: 'delayFilterHz', label: 'Delay Lowpass', category: 'fx', type: 'knob', min: 200, max: 20000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 12000, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Delay low-pass cutoff.' },
  { id: 'delayHighpassHz', label: 'Delay Highpass', category: 'fx', type: 'knob', min: 20, max: 8000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 40, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Delay high-pass cutoff.' },
  { id: 'bitcrushMix', label: 'Bitcrush Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.2, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Bitcrush wet mix.' },
  { id: 'bitcrushRate', label: 'Bitcrush Rate', category: 'fx', type: 'knob', min: 1, max: 32, step: 1, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 1, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Downsample hold factor.', modRateHint: 'control-rate' },
  { id: 'bitcrushDepth', label: 'Bitcrush Depth', category: 'fx', type: 'knob', min: 2, max: 16, step: 1, scaling: 'linear', unit: 'bits', displayFormat: 'unitless', defaultValue: 12, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Bit depth (quantization).', modRateHint: 'control-rate' },
  { id: 'granularMix', label: 'Granular Mix', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 40, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Granular wet mix.' },
  { id: 'granularPosition', label: 'Granular Position', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.001, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'voice', tooltip: 'Grain position in sample.', modRateHint: 'control-rate' },
  { id: 'granularDensity', label: 'Granular Density', category: 'fx', type: 'knob', min: 1, max: 30, step: 1, scaling: 'linear', unit: '', displayFormat: 'unitless', defaultValue: 8, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'voice', tooltip: 'Grains per second.', modRateHint: 'control-rate' },
  { id: 'granularPitch', label: 'Granular Pitch', category: 'fx', type: 'knob', min: -12, max: 12, step: 0.1, scaling: 'linear', unit: 'semitone', displayFormat: 'semitone', defaultValue: 0, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'voice', tooltip: 'Granular pitch shift in semitones.', modRateHint: 'control-rate' },
  { id: 'reverbDecay', label: 'Reverb Decay', category: 'fx', type: 'knob', min: 0.1, max: 10, step: 0.1, scaling: 'linear', unit: 's', displayFormat: 'seconds', defaultValue: 3, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Reverb decay time.' },
  { id: 'reverbSize', label: 'Reverb Size', category: 'fx', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'audioParam', tooltip: 'Perceived room size.' },
  { id: 'reverbPreDelay', label: 'Reverb PreDelay', category: 'fx', type: 'knob', min: 0, max: 200, step: 1, scaling: 'linear', unit: 'ms', displayFormat: 'ms', defaultValue: 18, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'voice', tooltip: 'Pre-delay before reverb onset.' },
  { id: 'reverbDamping', label: 'Reverb Damping', category: 'fx', type: 'knob', min: 200, max: 16000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 5000, smoothingMs: 50, modulatable: true, costTier: 'high', binding: 'voice', tooltip: 'High-frequency damping cutoff.' },
  { id: 'karplusDamping', label: 'Karplus Damping', category: 'osc', type: 'knob', min: 100, max: 12000, step: 10, scaling: 'log', unit: 'hz', displayFormat: 'hz', defaultValue: 1000, smoothingMs: 30, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Damping filter for Karplus feedback.' },
  // B4/B5
  { id: 'wavetableMorph', label: 'WT Morph', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 20, modulatable: true, costTier: 'high', binding: 'rebuild', tooltip: 'Morph position between wavetable frames.' },
  { id: 'sampleStart', label: 'Sample Start', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0, smoothingMs: 0, modulatable: true, costTier: 'mid', binding: 'rebuild', tooltip: 'Sample start offset.' },
  // Epic 1: Sample engine controls
  { id: 'sampleGain', label: 'Sample Gain', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.8, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Master gain for sample layers.' },
  { id: 'sampleReleaseMix', label: 'Sample Release Mix', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Blend level for release samples.', modRateHint: 'control-rate' },
  { id: 'sampleLayer1Gain', label: 'Sample Layer 1', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Layer 1 gain.' },
  { id: 'sampleLayer2Gain', label: 'Sample Layer 2', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Layer 2 gain.' },
  { id: 'sampleLayer3Gain', label: 'Sample Layer 3', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Layer 3 gain.' },
  { id: 'sampleLayer4Gain', label: 'Sample Layer 4', category: 'sample', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 1, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Layer 4 gain.' },
  // Epic 3: VA oscillator levels
  { id: 'vaOsc1Level', label: 'VA Osc1 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.8, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'VA oscillator 1 level.' },
  { id: 'vaOsc2Level', label: 'VA Osc2 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.6, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'VA oscillator 2 level.' },
  { id: 'vaSubLevel', label: 'VA Sub Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'VA sub oscillator level.' },
  // Epic 4: FM operator controls
  { id: 'fmOp1Level', label: 'FM Op1 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.6, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Operator 1 output level.' },
  { id: 'fmOp2Level', label: 'FM Op2 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.5, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Operator 2 output level.' },
  { id: 'fmOp3Level', label: 'FM Op3 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Operator 3 output level.' },
  { id: 'fmOp4Level', label: 'FM Op4 Level', category: 'osc', type: 'knob', min: 0, max: 1, step: 0.01, scaling: 'linear', unit: '', displayFormat: 'percent', defaultValue: 0.4, smoothingMs: 20, modulatable: true, costTier: 'mid', binding: 'audioParam', tooltip: 'Operator 4 output level.' },
  { id: 'fmOp1Ratio', label: 'FM Op1 Ratio', category: 'osc', type: 'knob', min: 0.1, max: 16, step: 0.01, scaling: 'log', unit: '', displayFormat: 'ratio', defaultValue: 1, smoothingMs: 50, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Operator 1 frequency ratio.', modRateHint: 'control-rate' },
  { id: 'fmOp2Ratio', label: 'FM Op2 Ratio', category: 'osc', type: 'knob', min: 0.1, max: 16, step: 0.01, scaling: 'log', unit: '', displayFormat: 'ratio', defaultValue: 1, smoothingMs: 50, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Operator 2 frequency ratio.', modRateHint: 'control-rate' },
  { id: 'fmOp3Ratio', label: 'FM Op3 Ratio', category: 'osc', type: 'knob', min: 0.1, max: 16, step: 0.01, scaling: 'log', unit: '', displayFormat: 'ratio', defaultValue: 1, smoothingMs: 50, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Operator 3 frequency ratio.', modRateHint: 'control-rate' },
  { id: 'fmOp4Ratio', label: 'FM Op4 Ratio', category: 'osc', type: 'knob', min: 0.1, max: 16, step: 0.01, scaling: 'log', unit: '', displayFormat: 'ratio', defaultValue: 1, smoothingMs: 50, modulatable: true, costTier: 'mid', binding: 'voice', tooltip: 'Operator 4 frequency ratio.', modRateHint: 'control-rate' }
];

export const TIMBRE_PARAM_REGISTRY: TimbreParamSpec[] = RAW_TIMBRE_PARAM_REGISTRY.map((param, index) => ({
  ...param,
  uiOrder: param.uiOrder ?? index + 1,
  modRateHint: param.modRateHint ?? (param.binding === 'audioParam' ? 'audio-rate' : 'control-rate')
}));

export const TIMBRE_MOD_TARGETS = TIMBRE_PARAM_REGISTRY
  .filter((param) => param.modulatable)
  .map((param) => param.id) as TimbreModTarget[];

export const TIMBRE_MOD_SOURCES: TimbreModSource[] = [
  'velocity',
  'noteRandom',
  'keyTracking',
  'modWheel',
  'aftertouch',
  'mpePressure',
  'mpeTimbre',
  'cc7',
  'cc74',
  'pitchBend',
  'time',
  'macro1',
  'macro2',
  'macro3',
  'macro4',
  'macro5',
  'macro6',
  'macro7',
  'macro8',
  'lfo1',
  'lfo2',
  'lfo3',
  'lfo4',
  // A3: New Sources
  'envAmp', 'envFilter', 'mseg',
  'randomHold', 'randomSmooth',
  'noteAge', 'releaseAge',
  'envelopeFollower'
];

const modSourceIds = new Set<string>(TIMBRE_MOD_SOURCES as string[]);
const modTargetIds = new Set<string>(TIMBRE_MOD_TARGETS as string[]);

export const isTimbreModSource = (value: string): value is TimbreModSource => modSourceIds.has(value);
export const isTimbreModTarget = (value: string): value is TimbreModTarget => modTargetIds.has(value);
