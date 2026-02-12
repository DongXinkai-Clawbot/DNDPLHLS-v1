import { Partial, SpectrumPartial, TimbreConfig, TimbrePreset } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export type SpectrumTemplate = {
  preset: TimbrePreset;
  ratios: Float64Array;
  amps: Float64Array;
  partialIndex: Uint16Array;
  originalCount: number;
  mergedCount: number;
  usedCount: number;
  mergeTolerance: number;
  mergeToleranceUnit: TimbreConfig['mergeToleranceUnit'];
  normalizedMode: TimbreConfig['amplitudeNormalization'];
  compressionMode: TimbreConfig['amplitudeCompression'];
  compressionAmount: number;
  amplitudePipeline: TimbreConfig['amplitudePipeline'];
  addedBasePartial: boolean;
  basePartialStrategy: TimbreConfig['basePartialStrategy'];
};

// Preset note: partial indices start at 1. Saw uses 1/n, square uses 1/n for odd n,
// triangle uses 1/n^2 for odd n.
const buildPresetList = (preset: TimbrePreset, partialCount: number): SpectrumPartial[] => {
  const count = Math.max(1, Math.round(partialCount));
  const list: SpectrumPartial[] = [];
  if (preset === 'square' || preset === 'triangle') {
    for (let i = 1; i <= count; i += 2) {
      const amp = preset === 'triangle' ? 1 / (i * i) : 1 / i;
      list.push({ ratio: i, amp, index: i });
    }
    return list;
  }
  for (let i = 1; i <= count; i++) {
    list.push({ ratio: i, amp: 1 / i, index: i });
  }
  return list;
};

const ensureBasePartial = (partials: SpectrumPartial[], strategy: TimbreConfig['basePartialStrategy']) => {
  const hasBase = partials.some(p => Math.abs(p.ratio - 1) < 1e-12);
  if (hasBase) return { partials, added: false };

  const strat = strategy ?? 'max';
  let amp = 1;
  if (strat === 'one') {
    amp = 1;
  } else if (strat === 'first') {
    amp = partials[0]?.amp ?? 1;
  } else {
    const maxAmp = partials.reduce((acc, p) => Math.max(acc, p.amp), 0);
    amp = maxAmp > 0 ? maxAmp : 1;
  }
  return { partials: [{ ratio: 1, amp, index: 1 }, ...partials], added: true };
};

const applyCompression = (amp: number, mode: TimbreConfig['amplitudeCompression'], amount: number) => {
  if (mode === 'sqrt') return Math.sqrt(Math.max(0, amp));
  if (mode === 'log') {
    const k = Math.max(0.0001, amount);
    return Math.log1p(k * Math.max(0, amp)) / Math.log1p(k);
  }
  return amp;
};

const normalizeInPlace = (amps: Float64Array, mode: TimbreConfig['amplitudeNormalization']) => {
  if (mode === 'max') {
    let maxAmp = 0;
    for (let i = 0; i < amps.length; i++) maxAmp = Math.max(maxAmp, amps[i]);
    if (maxAmp > 0) {
      for (let i = 0; i < amps.length; i++) amps[i] = amps[i] / maxAmp;
    }
    return;
  }
  if (mode === 'energy') {
    let energy = 0;
    for (let i = 0; i < amps.length; i++) energy += amps[i] * amps[i];
    if (energy > 0) {
      const scale = 1 / Math.sqrt(energy);
      for (let i = 0; i < amps.length; i++) amps[i] = amps[i] * scale;
    }
  }
};

const ratioDeltaToUnit = (ratioA: number, ratioB: number, unit: TimbreConfig['mergeToleranceUnit']) => {
  if (unit === 'cents') {
    return 1200 * Math.log2(ratioB / ratioA);
  }
  if (unit === 'hz') {
    // Hz threshold doesn't make sense in ratio-template space; treat as ratio delta.
    return ratioB - ratioA;
  }
  return ratioB - ratioA; // 'ratio'
};

export const normalizeSpectrumList = (
  input: SpectrumPartial[],
  config: Pick<TimbreConfig, 'mergeClosePartials' | 'mergeTolerance' | 'mergeToleranceUnit' | 'clampNegativeAmps'>
) => {
  const cleaned = input
    .filter(p => Number.isFinite(p.ratio) && p.ratio > 0 && Number.isFinite(p.amp))
    .map(p => ({
      ratio: p.ratio,
      amp: config.clampNegativeAmps ? Math.max(0, p.amp) : p.amp,
      index: p.index
    }))
    .sort((a, b) => a.ratio - b.ratio);

  if (!config.mergeClosePartials) {
    return { merged: cleaned, mergedCount: cleaned.length };
  }

  const unit = config.mergeToleranceUnit ?? 'ratio';
  const tol = Math.max(0, config.mergeTolerance);
  const merged: SpectrumPartial[] = [];
  for (const p of cleaned) {
    const last = merged[merged.length - 1];
    if (last) {
      const delta = Math.abs(ratioDeltaToUnit(last.ratio, p.ratio, unit));
      if (delta <= tol) {
        last.amp += p.amp;
        // Keep the smallest index for stable diagnostics.
        const a = last.index ?? 65535;
        const b = p.index ?? 65535;
        last.index = Math.min(a, b);
        continue;
      }
    }
    merged.push({ ...p });
  }
  return { merged, mergedCount: merged.length };
};

export const buildSpectrumTemplate = (cfg: TimbreConfig): SpectrumTemplate => {
  const maxPartials = Math.max(1, Math.round(cfg.maxPartials));
  const presetList = cfg.preset === 'custom'
    ? cfg.customPartials
    : buildPresetList(cfg.preset, cfg.partialCount);

  const originalCount = presetList.length;
  const baseStrategy = cfg.basePartialStrategy ?? 'max';
  const ensured = ensureBasePartial(presetList, baseStrategy);

  const mergedResult = normalizeSpectrumList(ensured.partials, cfg);
  const merged = mergedResult.merged.slice(0, maxPartials);

  const ratios = new Float64Array(merged.length);
  const amps = new Float64Array(merged.length);
  const partialIndex = new Uint16Array(merged.length);

  for (let i = 0; i < merged.length; i++) {
    ratios[i] = merged[i].ratio;
    amps[i] = merged[i].amp;
    partialIndex[i] = merged[i].index ? Math.min(65535, Math.max(1, merged[i].index)) : i + 1;
  }

  const pipeline = cfg.amplitudePipeline ?? 'compress_then_normalize';

  if (pipeline === 'normalize_then_compress') {
    normalizeInPlace(amps, cfg.amplitudeNormalization);
    for (let i = 0; i < amps.length; i++) {
      amps[i] = applyCompression(amps[i], cfg.amplitudeCompression, cfg.amplitudeCompressionAmount);
    }
  } else {
    for (let i = 0; i < amps.length; i++) {
      amps[i] = applyCompression(amps[i], cfg.amplitudeCompression, cfg.amplitudeCompressionAmount);
    }
    normalizeInPlace(amps, cfg.amplitudeNormalization);
  }

  return {
    preset: cfg.preset,
    ratios,
    amps,
    partialIndex,
    originalCount,
    mergedCount: mergedResult.mergedCount,
    usedCount: merged.length,
    mergeTolerance: cfg.mergeTolerance,
    mergeToleranceUnit: cfg.mergeToleranceUnit ?? 'ratio',
    normalizedMode: cfg.amplitudeNormalization,
    compressionMode: cfg.amplitudeCompression,
    compressionAmount: cfg.amplitudeCompressionAmount,
    amplitudePipeline: pipeline,
    addedBasePartial: ensured.added,
    basePartialStrategy: baseStrategy
  };
};

export const parseSpectrumText = (text: string) => {
  const lines = text.split(/\r?\n/);
  const partials: SpectrumPartial[] = [];
  const errors: string[] = [];
  lines.forEach((line, idx) => {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//')) return;
    const parts = cleaned.split(/[, \t]+/).filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: expected ratio and amplitude`);
      return;
    }
    const ratio = Number(parts[0]);
    const amp = Number(parts[1]);
    if (!Number.isFinite(ratio) || ratio <= 0) {
      const col = cleaned.indexOf(parts[0]) + 1;
      errors.push(`Line ${idx + 1}, Col ${col}: invalid ratio`);
      return;
    }
    if (!Number.isFinite(amp)) {
      const col = cleaned.indexOf(parts[1]) + 1;
      errors.push(`Line ${idx + 1}, Col ${col}: invalid amplitude`);
      return;
    }
    partials.push({ ratio, amp, index: idx + 1 });
  });
  return { partials, errors };
};

export type ToneSpectrum = {
  freqs: Float64Array;
  amps: Float64Array;
  ratios: Float64Array;
  partialIndex: Uint16Array;
  toneIndex: number;
  toneMask: number;
};

export const buildToneSpectrum = (
  baseFreq: number,
  template: SpectrumTemplate,
  toneIndex: number,
  ampScale: number
): ToneSpectrum => {
  const count = template.ratios.length;
  const freqs = new Float64Array(count);
  const amps = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    freqs[i] = baseFreq * template.ratios[i];
    amps[i] = template.amps[i] * ampScale;
  }
  return {
    freqs,
    amps,
    ratios: template.ratios,
    partialIndex: template.partialIndex,
    toneIndex,
    toneMask: 1 << toneIndex
  };
};

export const toPartials = (tone: ToneSpectrum): Partial[] => {
  const list: Partial[] = [];
  for (let i = 0; i < tone.freqs.length; i++) {
    list.push({
      freq: tone.freqs[i],
      amp: tone.amps[i],
      index: tone.partialIndex[i],
      ratio: tone.ratios[i],
      toneIndex: tone.toneIndex,
      toneMask: tone.toneMask
    });
  }
  return list;
};

