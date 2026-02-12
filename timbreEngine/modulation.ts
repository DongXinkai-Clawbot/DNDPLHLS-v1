import type {
  AppSettings,
  TimbreModSource,
  TimbreModTarget,
  TimbrePatch,
  TimbreVoiceSettings,
  TimbreModRoute
} from '../types';
import { HARD_MAX_PARTIALS, HARD_MAX_POLY, PARTIAL_BUDGET, PARTIAL_BUDGET_QUALITY } from './constants';
import { applyCurve, clamp } from './utils';

const isBipolarSource = (source: TimbreModSource) => (
  source === 'lfo1' || source === 'lfo2' || source === 'lfo3' || source === 'lfo4' ||
  source === 'randomHold' || source === 'randomSmooth'
);

const BUILTIN_DYNAMIC_SOURCES = new Set<TimbreModSource>([
  'lfo1',
  'lfo2',
  'lfo3',
  'lfo4',
  'envAmp',
  'envFilter',
  'mseg',
  'noteAge',
  'releaseAge',
  'randomSmooth',
  'randomHold',
  'envelopeFollower'
]);

const shapeRouteValue = (input: number, route: TimbreModRoute, inputBipolar: boolean) => {
  let val = input;
  const deadzone = route.deadzone ?? 0;
  const outBipolar = route.bipolar ?? inputBipolar;

  if (inputBipolar) {
    let mag = Math.abs(val);
    if (deadzone > 0 && deadzone < 1) {
      if (mag < deadzone) mag = 0;
      else mag = (mag - deadzone) / (1 - deadzone);
    }
    val = Math.sign(val) * mag;
    if (route.invert) val = -val;
    const u = applyCurve((val + 1) / 2, route.curve ?? 'linear', {
      pow: route.curveAmount,
      steps: route.curveSteps
    });
    val = outBipolar ? (u * 2 - 1) : u;
  } else {
    let u = clamp(val, 0, 1);
    if (deadzone > 0 && deadzone < 1) {
      if (u < deadzone) u = 0;
      else u = (u - deadzone) / (1 - deadzone);
    }
    if (route.invert) u = 1 - u;
    u = applyCurve(u, route.curve ?? 'linear', {
      pow: route.curveAmount,
      steps: route.curveSteps
    });
    val = outBipolar ? (u * 2 - 1) : u;
  }

  return val;
};

const resolvePatternBits = (pattern?: string) => {
  if (!pattern) return null;
  const trimmed = pattern.trim();
  if (!trimmed) return null;

  if (trimmed.includes(',')) {
    const vals = trimmed.split(',').map(s => parseFloat(s.trim()));
    const bits = vals.map(v => (Number.isFinite(v) && v > 0 ? 1 : 0));
    return bits.length > 0 ? bits : null;
  }

  const hexMatch = trimmed.match(/^(0x|hex:)\s*([0-9a-f]+)$/i);
  if (hexMatch) {
    const hex = hexMatch[2];
    const bits = hex
      .split('')
      .map((ch) => parseInt(ch, 16).toString(2).padStart(4, '0'))
      .join('')
      .split('')
      .map((b) => (b === '1' ? 1 : 0));
    return bits.length > 0 ? bits : null;
  }

  const everyMatch = trimmed.match(/^(every|step|keep)\s*[:\s]?\s*(\d+)$/i);
  if (everyMatch) {
    const n = Math.max(1, parseInt(everyMatch[2], 10));
    const bits = new Array(n).fill(0);
    bits[0] = 1;
    return bits;
  }

  if (/^[01]+$/.test(trimmed)) {
    return trimmed.split('').map((b) => (b === '1' ? 1 : 0));
  }

  return null;
};

export const accumulateMods = (
  patch: TimbrePatch,
  sources: Record<TimbreModSource, number>,
  options?: {
    dynamicSources?: Set<TimbreModSource>;
    dynamicTargets?: Set<TimbreModTarget>;
  }
) => {
  const modAccum: Partial<Record<TimbreModTarget, number>> = {};
  const lfoRoutes: any[] = []; // Typed as any[] to allow extended route objects while maintaining compatibility

  // Helper for tracking blend operations
  const blends = new Map<TimbreModTarget, { val: number; mode: string }[]>();

  patch.modMatrix.forEach(route => {
    const src = route.source;
    const tgt = route.target;

    // Pass dynamic routes for audio-rate handling
    const isDynamic = BUILTIN_DYNAMIC_SOURCES.has(src);
    const allowExtraDynamic = !options?.dynamicTargets || options.dynamicTargets.has(tgt);
    const isExtraDynamic = allowExtraDynamic && options?.dynamicSources?.has(src);

    if (isDynamic || isExtraDynamic) {
      lfoRoutes.push(route);
      return;
    }

    let val = sources[src] ?? 0;
    if (!Number.isFinite(val)) return;

    // 1. Input Shaping
    val = shapeRouteValue(val, route, isBipolarSource(src));

    // 2. Transform
    val *= (route.scale ?? 1);
    val *= route.depth;
    val += (route.offset ?? 0);

    // 3. Limiting
    if (route.clampMin !== undefined) val = Math.max(val, route.clampMin);
    if (route.clampMax !== undefined) val = Math.min(val, route.clampMax);

    // 4. Collect for Blending
    const mode = route.combineMode || route.blendMode || 'sum';
    if (!blends.has(tgt)) blends.set(tgt, []);
    blends.get(tgt)!.push({ val, mode });
  });

  // Resolve Blends
  blends.forEach((items, tgt) => {
    let final = 0;
    // Separate by mode? Or sequential? 
    // Usually Mod Matrix sums everything. 
    // "Max" mode implies this route competes with others.
    // Let's implement a strategy: Sum all 'sum' types first, then apply Max/Min/Mult?
    // Or processing order dependency? 
    // Simple approach: 
    // 1. Sum all 'sum' routes.
    // 2. Apply 'max' routes (max(currentSum, maxRoute)).
    // 3. Apply 'min' routes.
    // 4. Apply 'multiply' routes.

    let sumVal = 0;
    let avgVal = 0;
    let avgCount = 0;
    let maxVal = -Infinity;
    let minVal = Infinity;
    let multVal = 1;

    let hasMax = false;
    let hasMin = false;
    let hasMult = false;

    items.forEach(item => {
      if (item.mode === 'sum') sumVal += item.val;
      else if (item.mode === 'avg') { avgVal += item.val; avgCount += 1; }
      else if (item.mode === 'max') { maxVal = Math.max(maxVal, item.val); hasMax = true; }
      else if (item.mode === 'min') { minVal = Math.min(minVal, item.val); hasMin = true; }
      else if (item.mode === 'multiply') { multVal *= item.val; hasMult = true; }
    });

    const avgResult = avgCount > 0 ? (avgVal / avgCount) : 0;
    final = sumVal + avgResult;
    let hasBase = avgCount > 0 || sumVal !== 0;
    if (hasMax) {
      final = hasBase ? Math.max(final, maxVal) : maxVal;
      hasBase = true;
    }
    if (hasMin) {
      final = hasBase ? Math.min(final, minVal) : minVal;
      hasBase = true;
    }
    if (hasMult) {
      final = (hasBase ? final : 1) * multVal;
    }

    modAccum[tgt] = final;
  });

  return { modAccum, lfoRoutes };
};

export const applyModToVoice = (voice: TimbreVoiceSettings, mods: Partial<Record<TimbreModTarget, number>>) => {
  const modded: TimbreVoiceSettings = {
    ...voice,
    harmonic: { ...voice.harmonic },
    noise: { ...voice.noise },
    sample: { ...voice.sample },
    vaOsc: { ...voice.vaOsc, osc1: { ...voice.vaOsc.osc1 }, osc2: { ...voice.vaOsc.osc2 }, subOsc: { ...voice.vaOsc.subOsc }, noiseOsc: { ...voice.vaOsc.noiseOsc } },
    filter: { ...voice.filter, comb: voice.filter.comb ? { ...voice.filter.comb } : undefined, formant: voice.filter.formant ? { ...voice.filter.formant, peaks: voice.filter.formant.peaks ? [...voice.filter.formant.peaks] : undefined } : undefined },
    fm: { ...voice.fm },
    fmOperators: { ...voice.fmOperators, operators: [...voice.fmOperators.operators] as any },
    ringMod: { ...voice.ringMod },
    mseg: { ...voice.mseg },
    nonlinearity: { ...voice.nonlinearity },
    space: { reverb: { ...voice.space.reverb }, resonance: { ...voice.space.resonance } },
    karplus: { ...voice.karplus },
    unison: { ...voice.unison },
    chorus: { ...voice.chorus },
    phaser: { ...voice.phaser },
    delay: { ...voice.delay },
    bitcrush: { ...voice.bitcrush },
    granular: voice.granular ? { ...voice.granular } : undefined
  };

  if (mods.overallGain) {
    modded.gain = clamp(modded.gain * (1 + mods.overallGain), 0, 1);
  }
  if (mods.filterCutoff) {
    const ratio = Math.pow(2, mods.filterCutoff);
    modded.filter.cutoffHz = clamp(modded.filter.cutoffHz * ratio, 20, 20000);
  }
  if (mods.filterType) {
    const types = ['lowpass', 'highpass', 'bandpass', 'notch', 'svf', 'comb', 'formant'] as const;
    const baseIndex = Math.max(0, types.indexOf(modded.filter.type as any));
    const shift = Math.round(mods.filterType);
    const idx = clamp(baseIndex + shift, 0, types.length - 1);
    modded.filter.type = types[idx];
  }
  if (mods.filterSlope) {
    const base = modded.filter.slope === 24 ? 1 : 0;
    const shift = Math.round(mods.filterSlope);
    const val = clamp(base + shift, 0, 1);
    modded.filter.slope = (val === 1 ? 24 : 12);
  }
  if (mods.harmonicBrightness) {
    modded.harmonic.brightness = clamp(modded.harmonic.brightness + mods.harmonicBrightness, -1, 1);
  }
  if (mods.oddEvenBalance) {
    modded.harmonic.oddEven = clamp(modded.harmonic.oddEven + mods.oddEvenBalance, -1, 1);
  }
  if (mods.inharmonicity) {
    modded.harmonic.inharmonicity = clamp(modded.harmonic.inharmonicity + mods.inharmonicity, 0, 1);
  }
  if (mods.harmonicCount) {
    modded.harmonic.harmonicCount = Math.max(1, Math.round(modded.harmonic.harmonicCount + mods.harmonicCount));
  }
  if (mods.harmonicGroupWeight1) {
    modded.harmonic.groupWeights[0] = clamp(modded.harmonic.groupWeights[0] + mods.harmonicGroupWeight1, 0, 2);
  }
  if (mods.harmonicGroupWeight2) {
    modded.harmonic.groupWeights[1] = clamp(modded.harmonic.groupWeights[1] + mods.harmonicGroupWeight2, 0, 2);
  }
  if (mods.harmonicGroupWeight3) {
    modded.harmonic.groupWeights[2] = clamp(modded.harmonic.groupWeights[2] + mods.harmonicGroupWeight3, 0, 2);
  }
  if (mods.harmonicGroupWeight4) {
    modded.harmonic.groupWeights[3] = clamp(modded.harmonic.groupWeights[3] + mods.harmonicGroupWeight4, 0, 2);
  }
  if (mods.harmonicMaskLow || mods.harmonicMaskHigh) {
    if (!modded.harmonic.maskConfig) modded.harmonic.maskConfig = {};
    const baseLow = modded.harmonic.maskConfig.lowHz ?? 80;
    const baseHigh = modded.harmonic.maskConfig.highHz ?? 12000;
    if (mods.harmonicMaskLow) {
      modded.harmonic.maskConfig.lowHz = clamp(baseLow * Math.pow(2, mods.harmonicMaskLow), 20, 20000);
    }
    if (mods.harmonicMaskHigh) {
      modded.harmonic.maskConfig.highHz = clamp(baseHigh * Math.pow(2, mods.harmonicMaskHigh), 40, 20000);
    }
  }
  if (mods.noiseAmount) {
    modded.noise.mix = clamp(modded.noise.mix + mods.noiseAmount, 0, 1);
  }
  if (mods.noiseColor) {
    modded.noise.color = clamp((modded.noise.color ?? 0) + mods.noiseColor, 0, 1);
  }
  if (mods.fmDepth) {
    modded.fm.depth = clamp(modded.fm.depth + mods.fmDepth, 0, 2);
  }
  if (mods.ringModMix) {
    modded.ringMod.mix = clamp(modded.ringMod.mix + mods.ringModMix, 0, 1);
  }
  if (mods.msegAmount) {
    modded.mseg.amount = clamp(modded.mseg.amount + mods.msegAmount, 0, 1);
  }
  if (mods.drive) {
    modded.nonlinearity.drive = clamp(modded.nonlinearity.drive + mods.drive, 0, 8);
  }
  if (mods.reverbMix) {
    modded.space.reverb.mix = clamp(modded.space.reverb.mix + mods.reverbMix, 0, 1);
  }
  if (mods.karplusFeedback) {
    modded.karplus.feedback = clamp(modded.karplus.feedback + mods.karplusFeedback, 0, 0.99);
  }
  if (mods.karplusMix) {
    modded.karplus.mix = clamp(modded.karplus.mix + mods.karplusMix, 0, 1);
  }
  if (mods.resonanceMix) {
    modded.space.resonance.mix = clamp(modded.space.resonance.mix + mods.resonanceMix, 0, 1);
  }
  if (mods.unisonDetune) {
    modded.unison.detune = clamp(modded.unison.detune + mods.unisonDetune, 0, 100);
  }
  if (mods.unisonSpread) {
    modded.unison.spread = clamp(modded.unison.spread + mods.unisonSpread, 0, 1);
  }
  if (mods.chorusMix) {
    modded.chorus.mix = clamp(modded.chorus.mix + mods.chorusMix, 0, 1);
  }
  if (mods.phaserMix) {
    modded.phaser.mix = clamp(modded.phaser.mix + mods.phaserMix, 0, 1);
  }
  if (mods.delayMix) {
    modded.delay.mix = clamp(modded.delay.mix + mods.delayMix, 0, 1);
  }
  if (mods.delayFeedback) {
    modded.delay.feedback = clamp(modded.delay.feedback + mods.delayFeedback, 0, 0.95);
  }

  // A5: New Targets Logic
  if (mods.harmonicRolloff) {
    modded.harmonic.rolloff = Math.max(0.1, modded.harmonic.rolloff + mods.harmonicRolloff);
  }
  if (mods.harmonicJitter) {
    modded.harmonic.jitter = clamp(modded.harmonic.jitter + mods.harmonicJitter, 0, 1);
  }
  if (mods.filterQ) {
    modded.filter.q = clamp(modded.filter.q + mods.filterQ, 0.1, 20); // Additive to Q? Or multiplicative? Usually additive for knobs.
  }
  if (mods.filterKeyTracking) {
    modded.filter.keyTracking = clamp(modded.filter.keyTracking + mods.filterKeyTracking, -1, 1);
  }
  if (mods.filterLfoAmount) {
    modded.filter.lfoAmount = clamp(modded.filter.lfoAmount + mods.filterLfoAmount, 0, 1);
  }
  if (mods.noiseFilterHz) {
    const ratio = Math.pow(2, mods.noiseFilterHz); // Treat mod as pitch offset (octaves) usually for Hz
    modded.noise.filterHz = clamp(modded.noise.filterHz * ratio, 20, 20000);
  }
  if (mods.noiseHighpassHz) {
    const ratio = Math.pow(2, mods.noiseHighpassHz);
    modded.noise.highpassHz = clamp(modded.noise.highpassHz * ratio, 20, 20000);
  }
  if (mods.chorusRate) {
    const ratio = Math.pow(2, mods.chorusRate);
    modded.chorus.rate = clamp(modded.chorus.rate * ratio, 0.01, 20);
  }
  if (mods.chorusDepth) {
    modded.chorus.depth = clamp(modded.chorus.depth + mods.chorusDepth, 0, 1);
  }
  if (mods.chorusFeedback) {
    modded.chorus.feedback = clamp(modded.chorus.feedback + mods.chorusFeedback, 0, 0.95);
  }
  if (mods.phaserRate) {
    const ratio = Math.pow(2, mods.phaserRate);
    modded.phaser.rate = clamp(modded.phaser.rate * ratio, 0.01, 20);
  }
  if (mods.phaserFeedback) {
    modded.phaser.feedback = clamp(modded.phaser.feedback + mods.phaserFeedback, 0, 0.95);
  }
  if (mods.phaserStages) {
    modded.phaser.stages = Math.max(2, Math.round(modded.phaser.stages + mods.phaserStages));
  }
  if (mods.delayTime) {
    // Delay Time is usually linear or log. If we assume the mod source is 0..1 mapped to a range? 
    // Or abstract "amount". If target is Delay Time and source is LFO, we want pitch modulation (vibrato).
    // Ideally delay time modulation should be multiplicative or small log changes.
    // Let's use ratio like cutoff.
    const ratio = Math.pow(2, mods.delayTime);
    modded.delay.timeMs = clamp(modded.delay.timeMs * ratio, 1, 5000);
  }
  if (mods.delayFilterHz) {
    const ratio = Math.pow(2, mods.delayFilterHz);
    modded.delay.filterHz = clamp(modded.delay.filterHz * ratio, 50, 20000);
  }
  if (mods.delayHighpassHz) {
    const ratio = Math.pow(2, mods.delayHighpassHz);
    modded.delay.filterHighpassHz = clamp((modded.delay.filterHighpassHz ?? 20) * ratio, 10, 8000);
  }
  if (mods.delayModDepth) {
    modded.delay.modDepth = clamp(modded.delay.modDepth + mods.delayModDepth, 0, 1);
  }
  if (mods.bitcrushMix) {
    modded.bitcrush.mix = clamp(modded.bitcrush.mix + mods.bitcrushMix, 0, 1);
  }
  if (mods.bitcrushRate) {
    modded.bitcrush.sampleRateReduce = clamp((modded.bitcrush.sampleRateReduce ?? 1) + mods.bitcrushRate, 1, 32);
  }
  if (mods.bitcrushDepth) {
    modded.bitcrush.bitDepth = clamp((modded.bitcrush.bitDepth ?? 12) + mods.bitcrushDepth, 2, 16);
  }
  if (mods.granularMix && modded.granular) {
    modded.granular.mix = clamp(modded.granular.mix + mods.granularMix, 0, 1);
  }
  if (mods.granularPosition && modded.granular) {
    modded.granular.position = clamp(modded.granular.position + mods.granularPosition, 0, 1);
  }
  if (mods.granularDensity && modded.granular) {
    modded.granular.density = clamp(modded.granular.density + mods.granularDensity, 1, 40);
  }
  if (mods.granularPitch && modded.granular) {
    modded.granular.pitch = clamp(modded.granular.pitch + mods.granularPitch, -24, 24);
  }
  if (mods.reverbDecay) {
    modded.space.reverb.decay = clamp(modded.space.reverb.decay + mods.reverbDecay, 0.1, 20);
  }
  if (mods.reverbSize) {
    modded.space.reverb.size = clamp(modded.space.reverb.size + mods.reverbSize, 0, 1);
  }
  if (mods.reverbPreDelay) {
    modded.space.reverb.preDelayMs = clamp(modded.space.reverb.preDelayMs + mods.reverbPreDelay, 0, 200);
  }
  if (mods.reverbDamping) {
    const ratio = Math.pow(2, mods.reverbDamping);
    modded.space.reverb.dampingHz = clamp(modded.space.reverb.dampingHz * ratio, 200, 16000);
  }
  if (mods.karplusDamping) {
    const ratio = Math.pow(2, mods.karplusDamping);
    modded.karplus.dampingHz = clamp(modded.karplus.dampingHz * ratio, 100, 15000);
  }

  // Epic 1: Sample modulation
  if (mods.sampleGain) {
    modded.sample.masterGain = clamp(modded.sample.masterGain + mods.sampleGain, 0, 1.5);
  }
  if (mods.sampleReleaseMix) {
    modded.sample.releaseMix = clamp((modded.sample.releaseMix ?? 0.5) + mods.sampleReleaseMix, 0, 1);
  }
  if (mods.sampleLayer1Gain && modded.sample.layers[0]) {
    modded.sample.layers[0].gain = clamp(modded.sample.layers[0].gain + mods.sampleLayer1Gain, 0, 2);
  }
  if (mods.sampleLayer2Gain && modded.sample.layers[1]) {
    modded.sample.layers[1].gain = clamp(modded.sample.layers[1].gain + mods.sampleLayer2Gain, 0, 2);
  }
  if (mods.sampleLayer3Gain && modded.sample.layers[2]) {
    modded.sample.layers[2].gain = clamp(modded.sample.layers[2].gain + mods.sampleLayer3Gain, 0, 2);
  }
  if (mods.sampleLayer4Gain && modded.sample.layers[3]) {
    modded.sample.layers[3].gain = clamp(modded.sample.layers[3].gain + mods.sampleLayer4Gain, 0, 2);
  }

  // Epic 3: VA oscillator levels
  if (mods.vaOsc1Level) modded.vaOsc.osc1.level = clamp(modded.vaOsc.osc1.level + mods.vaOsc1Level, 0, 1.5);
  if (mods.vaOsc2Level) modded.vaOsc.osc2.level = clamp(modded.vaOsc.osc2.level + mods.vaOsc2Level, 0, 1.5);
  if (mods.vaSubLevel) modded.vaOsc.subOsc.level = clamp(modded.vaOsc.subOsc.level + mods.vaSubLevel, 0, 1.5);

  // Epic 4: FM operators
  if (mods.fmOp1Level) modded.fmOperators.operators[0] = { ...modded.fmOperators.operators[0], level: clamp(modded.fmOperators.operators[0].level + mods.fmOp1Level, 0, 2) };
  if (mods.fmOp2Level) modded.fmOperators.operators[1] = { ...modded.fmOperators.operators[1], level: clamp(modded.fmOperators.operators[1].level + mods.fmOp2Level, 0, 2) };
  if (mods.fmOp3Level) modded.fmOperators.operators[2] = { ...modded.fmOperators.operators[2], level: clamp(modded.fmOperators.operators[2].level + mods.fmOp3Level, 0, 2) };
  if (mods.fmOp4Level) modded.fmOperators.operators[3] = { ...modded.fmOperators.operators[3], level: clamp(modded.fmOperators.operators[3].level + mods.fmOp4Level, 0, 2) };
  if (mods.fmOp1Ratio) modded.fmOperators.operators[0] = { ...modded.fmOperators.operators[0], ratio: clamp(modded.fmOperators.operators[0].ratio * Math.pow(2, mods.fmOp1Ratio), 0.1, 16) };
  if (mods.fmOp2Ratio) modded.fmOperators.operators[1] = { ...modded.fmOperators.operators[1], ratio: clamp(modded.fmOperators.operators[1].ratio * Math.pow(2, mods.fmOp2Ratio), 0.1, 16) };
  if (mods.fmOp3Ratio) modded.fmOperators.operators[2] = { ...modded.fmOperators.operators[2], ratio: clamp(modded.fmOperators.operators[2].ratio * Math.pow(2, mods.fmOp3Ratio), 0.1, 16) };
  if (mods.fmOp4Ratio) modded.fmOperators.operators[3] = { ...modded.fmOperators.operators[3], ratio: clamp(modded.fmOperators.operators[3].ratio * Math.pow(2, mods.fmOp4Ratio), 0.1, 16) };

  if (mods.filterCombMix) {
    if (!modded.filter.comb) modded.filter.comb = { mix: 0, freqHz: 440, feedback: 0.3, dampingHz: 6000 };
    modded.filter.comb.mix = clamp(modded.filter.comb.mix + mods.filterCombMix, 0, 1);
  }
  if (mods.filterCombFreq) {
    if (!modded.filter.comb) modded.filter.comb = { mix: 0, freqHz: 440, feedback: 0.3, dampingHz: 6000 };
    modded.filter.comb.freqHz = clamp(modded.filter.comb.freqHz * Math.pow(2, mods.filterCombFreq), 40, 20000);
  }
  if (mods.filterCombFeedback) {
    if (!modded.filter.comb) modded.filter.comb = { mix: 0, freqHz: 440, feedback: 0.3, dampingHz: 6000 };
    modded.filter.comb.feedback = clamp(modded.filter.comb.feedback + mods.filterCombFeedback, 0, 0.99);
  }
  if (mods.filterCombDamping) {
    if (!modded.filter.comb) modded.filter.comb = { mix: 0, freqHz: 440, feedback: 0.3, dampingHz: 6000 };
    modded.filter.comb.dampingHz = clamp(modded.filter.comb.dampingHz * Math.pow(2, mods.filterCombDamping), 200, 12000);
  }
  if (mods.formantMix) {
    if (!modded.filter.formant) modded.filter.formant = { mix: 0.5, morph: 0, peaks: [] };
    modded.filter.formant.mix = clamp(modded.filter.formant.mix + mods.formantMix, 0, 1);
  }
  if (mods.formantMorph) {
    if (!modded.filter.formant) modded.filter.formant = { mix: 0.5, morph: 0, peaks: [] };
    modded.filter.formant.morph = clamp((modded.filter.formant.morph ?? 0) + mods.formantMorph, 0, 1);
  }
  if (mods.formantF1 || mods.formantF2 || mods.formantF3) {
    if (!modded.filter.formant) modded.filter.formant = { mix: 0.5, morph: 0, peaks: [] };
    const peaks = modded.filter.formant.peaks || [
      { freq: 500, q: 6, gain: 6 },
      { freq: 1500, q: 7, gain: 5 },
      { freq: 2500, q: 8, gain: 4 }
    ];
    if (mods.formantF1) peaks[0].freq = clamp(peaks[0].freq * Math.pow(2, mods.formantF1), 200, 1200);
    if (mods.formantF2) peaks[1].freq = clamp(peaks[1].freq * Math.pow(2, mods.formantF2), 500, 3000);
    if (mods.formantF3) peaks[2].freq = clamp(peaks[2].freq * Math.pow(2, mods.formantF3), 1200, 5000);
    modded.filter.formant.peaks = peaks;
  }

  return modded;
};

export const computeHarmonicSpectrum = (
  voice: TimbreVoiceSettings,
  partialCount: number,
  rng: () => number,
  frequency: number, // B1: Needed for Nyquist
  sampleRate: number // B1: Needed for Nyquist
) => {
  const amplitudes: number[] = [];
  const baseAmps: number[] = [];
  const weights = voice.harmonic.groupWeights;
  const rolloff = Math.max(0.2, voice.harmonic.rolloff);

  // B1: Nyquist Limit
  const nyquist = sampleRate / 2;

  for (let k = 1; k <= partialCount; k++) {
    const harmonicFreq = frequency * k;
    if (harmonicFreq >= nyquist) {
      baseAmps.push(0); // Cutoff
      continue;
    }

    // B1 Optional: Soft rolloff near Nyquist (e.g., top 10% of range)
    // Avoids harsh alias snapping
    let antiAliasGain = 1;
    if (harmonicFreq > nyquist * 0.9) {
      const x = (harmonicFreq - nyquist * 0.9) / (nyquist * 0.1);
      antiAliasGain = Math.cos(x * Math.PI * 0.5);
    }

    const baseAmp = (1 / Math.pow(k, rolloff)) * antiAliasGain;
    baseAmps.push(baseAmp);
  }
  const baseSum = baseAmps.reduce((a, b) => a + b, 0);

  for (let k = 1; k <= partialCount; k++) {
    let amp = baseAmps[k - 1];
    if (amp <= 0) {
      amplitudes.push(0);
      continue;
    }
    const harmonicFreq = frequency * k;
    const rel = k / partialCount;

    // B3: Bandpass / MultiBand / Formant Masks
    if ((voice.harmonic.mask === 'bandpass' || voice.harmonic.mask === 'multiBand' || voice.harmonic.mask === 'formant') && voice.harmonic.maskConfig) {
      const cfg = voice.harmonic.maskConfig;
      if (voice.harmonic.mask !== 'formant') {
        if (cfg.lowHz && harmonicFreq < cfg.lowHz) amp = 0;
        if (cfg.highHz && harmonicFreq > cfg.highHz) amp = 0;
      }

      // Multi-band
      if (cfg.bands && (voice.harmonic.mask === 'multiBand' || voice.harmonic.mask === 'bandpass')) {
        let bandGain = 0;
        let inAnyBand = false;
        for (const band of cfg.bands) {
          if (harmonicFreq >= band.low && harmonicFreq <= band.high) {
            bandGain = Math.max(bandGain, band.gain);
            inAnyBand = true;
          }
        }
        if (inAnyBand) amp *= bandGain;
        else if (cfg.bands.length > 0) amp = 0; // Strict mode? Or just 0 if bands defined
      }

      // Formants (Resonant peaks)
      if (cfg.formants && (voice.harmonic.mask === 'formant' || voice.harmonic.mask === 'bandpass')) {
        let formantGain = 0;
        for (const f of cfg.formants) {
          // Simple Gaussian or Lorentzian shape
          const dist = Math.abs(harmonicFreq - f.freq);
          const width = f.width || 100;
          const g = f.gain * Math.exp(-(dist * dist) / (2 * width * width));
          formantGain += g;
        }
        if (cfg.formants.length > 0) amp *= formantGain;
      }
    }

    amp *= Math.pow(rel, voice.harmonic.brightness);
    if (k % 2 === 0) amp *= (1 - voice.harmonic.oddEven);
    else amp *= (1 + voice.harmonic.oddEven);
    const groupIndex = rel < 0.25 ? 0 : rel < 0.5 ? 1 : rel < 0.75 ? 2 : 3;
    amp *= weights[groupIndex] ?? 1;

    if (voice.harmonic.mask === 'no_fundamental' && k === 1) amp = 0;
    if (voice.harmonic.mask === 'odd' && k % 2 === 0) amp = 0;
    if (voice.harmonic.mask === 'even' && k % 2 === 1) amp = 0;
    if (voice.harmonic.mask === 'pattern' && voice.harmonic.pattern) {
      const bits = resolvePatternBits(voice.harmonic.pattern);
      if (bits && bits.length > 0) {
        const idx = (k - 1) % bits.length;
        if (bits[idx] === 0) amp = 0;
      }
    }

    if (voice.harmonic.mode === 'table' || voice.harmonic.mode === 'hybrid') {
      const override = voice.harmonic.table[k - 1];
      if (typeof override === 'number' && override >= 0) {
        amp = override;
      }
    }

    if (voice.harmonic.jitter > 0) {
      const jitter = (rng() * 2 - 1) * voice.harmonic.jitter;
      amp *= 1 + jitter;
    }

    amplitudes.push(Math.max(0, amp));
  }

  const sum = amplitudes.reduce((a, b) => a + b, 0);
  if (voice.harmonic.lockEnergy && sum > 0) {
    const scale = baseSum / sum;
    for (let i = 0; i < amplitudes.length; i++) amplitudes[i] *= scale;
  }
  if (voice.harmonic.normalize) {
    const max = Math.max(...amplitudes, 0.00001);
    for (let i = 0; i < amplitudes.length; i++) amplitudes[i] /= max;
  }

  return amplitudes;
};

export const computePartialCount = (
  patch: TimbrePatch,
  settings: AppSettings,
  sampleRate: number,
  frequency: number,
  voiceCount: number = 1
) => {
  const maxPoly = Math.min(patch.performance.polyphony, settings.timbre.performance.maxPolyphony, HARD_MAX_POLY);
  let target = Math.min(patch.performance.maxPartials, settings.timbre.performance.maxPartials, HARD_MAX_PARTIALS);

  // B1: Limit based on Nyquist
  const nyquist = sampleRate / 2;
  const maxPossible = Math.floor(nyquist / Math.max(20, frequency));
  target = Math.min(target, maxPossible);

  target = Math.min(target, patch.voice.harmonic.harmonicCount);

  const qualityMode = settings.timbre.performance.qualityMode ?? 'balanced';
  const qualityMultiplier = PARTIAL_BUDGET_QUALITY[qualityMode] ?? 1;
  const budgetBase = PARTIAL_BUDGET * qualityMultiplier;
  const polyBudget = settings.timbre.performance.autoReduce
    ? budgetBase / Math.max(1, voiceCount)
    : budgetBase;

  const freqRatio = Math.max(0.25, frequency / 220);
  const freqPenalty = clamp(1 - Math.max(0, Math.log2(freqRatio)) / 6, 0.3, 1);
  target = Math.min(target, Math.floor(polyBudget * freqPenalty));

  if (settings.timbre.performance.autoReduce && maxPoly > 0 && target * maxPoly > PARTIAL_BUDGET) {
    target = Math.max(4, Math.floor(PARTIAL_BUDGET / maxPoly));
  }
  return Math.max(1, Math.floor(target));
};
