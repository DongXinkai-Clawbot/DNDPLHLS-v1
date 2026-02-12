import {
  GridData,
  GridDiagnosticsSummary,
  NormalizationMode,
  RoughnessConstants,
  RoughnessOptions,
  SamplingConfig,
  TimbreConfig,
  TerrainScalarField
} from './types';
import { buildSpectrumTemplate, buildToneSpectrum, SpectrumTemplate, ToneSpectrum } from './timbre';
import { STANDARD_CONSTANTS, validateConstants } from './constants';
import { poolRoughness, PoolData } from './roughnessCore';
import { buildAxis, refineAxisFixed, refineAxisMidpoints } from './sampling';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class CancelledError extends Error {
  name = 'CancelledError';
  constructor(message = 'Computation cancelled') {
    super(message);
  }
}

const COMMON_INTERVALS = [6 / 5, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 2 / 1];

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

export type EngineConfig = {
  baseFreq: number;
  timbre: TimbreConfig;
  sampling: SamplingConfig;
  roughness: RoughnessOptions;
  normalizationMode: NormalizationMode;
  scalarField?: TerrainScalarField;
  constants?: RoughnessConstants;
  referencePoint?: { x: number; y: number };
  axes?: { xs: number[]; ys: number[] };
};

type PreparedTone = ToneSpectrum & { energy: number; maxAmp: number };

type PreparedBundle = {
  template: SpectrumTemplate;
  base: PreparedTone;
  xs: PreparedTone[];
  ys: PreparedTone[];
  triadScale: number;
  mergeClosePartials: boolean;
  mergeTolerance: number;
  mergeToleranceUnit: TimbreConfig['mergeToleranceUnit'];
  diag: { original: number; pruned: number; invalid: number };
};

const applyAmpThreshold = (template: SpectrumTemplate, ampThreshold: number) => {
  if (template.amps.length === 0) return template;
  const keep: number[] = [];
  for (let i = 0; i < template.amps.length; i++) {
    if (template.amps[i] >= ampThreshold) keep.push(i);
  }
  if (keep.length === template.amps.length) return template;
  const ratios = new Float64Array(keep.length);
  const amps = new Float64Array(keep.length);
  const partialIndex = new Uint16Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    const idx = keep[i];
    ratios[i] = template.ratios[idx];
    amps[i] = template.amps[idx];
    partialIndex[i] = template.partialIndex[idx];
  }
  return {
    ...template,
    ratios,
    amps,
    partialIndex,
    usedCount: keep.length
  };
};

const buildPrepared = (
  baseFreq: number,
  timbre: TimbreConfig,
  roughness: RoughnessOptions,
  axes: { xs: number[]; ys: number[] }
): PreparedBundle => {
  const template = applyAmpThreshold(buildSpectrumTemplate(timbre), roughness.ampThreshold);

  const triadScale =
    timbre.triadEnergyMode === 'linear'
      ? 1 / 3
      : timbre.triadEnergyMode === 'sqrt'
        ? 1 / Math.sqrt(3)
        : 1;

  const baseTone = buildToneSpectrum(baseFreq, template, 0, triadScale);
  const xs = axes.xs.map(x => buildToneSpectrum(baseFreq * x, template, 1, triadScale));
  const ys = axes.ys.map(y => buildToneSpectrum(baseFreq * y, template, 2, triadScale));

  const toneEnergy = (tone: ToneSpectrum) => {
    let energy = 0;
    let maxAmp = 0;
    for (let i = 0; i < tone.amps.length; i++) {
      const a = tone.amps[i];
      energy += a * a;
      if (a > maxAmp) maxAmp = a;
    }
    return { energy, maxAmp };
  };

  const baseEnergy = toneEnergy(baseTone);
  const xsPrepared: PreparedTone[] = xs.map(tone => {
    const stats = toneEnergy(tone);
    return { ...tone, energy: stats.energy, maxAmp: stats.maxAmp };
  });
  const ysPrepared: PreparedTone[] = ys.map(tone => {
    const stats = toneEnergy(tone);
    return { ...tone, energy: stats.energy, maxAmp: stats.maxAmp };
  });

  return {
    template,
    base: { ...baseTone, energy: baseEnergy.energy, maxAmp: baseEnergy.maxAmp },
    xs: xsPrepared,
    ys: ysPrepared,
    triadScale,
    mergeClosePartials: timbre.mergeClosePartials,
    mergeTolerance: timbre.mergeTolerance,
    mergeToleranceUnit: timbre.mergeToleranceUnit ?? 'ratio',
    diag: {
      original: template.originalCount,
      pruned: template.usedCount,
      invalid: template.originalCount - template.usedCount
    }
  };
};

type PoolScratch = {
  freqs: Float64Array;
  amps: Float64Array;
  toneMask: Uint8Array;
  partialIndex: Uint16Array;
  ampTone0: Float64Array;
  ampTone1: Float64Array;
  ampTone2: Float64Array;
};

const ensureScratch = (scratch: PoolScratch | null, size: number): PoolScratch => {
  if (scratch && scratch.freqs.length >= size) return scratch;
  return {
    freqs: new Float64Array(size),
    amps: new Float64Array(size),
    toneMask: new Uint8Array(size),
    partialIndex: new Uint16Array(size),
    ampTone0: new Float64Array(size),
    ampTone1: new Float64Array(size),
    ampTone2: new Float64Array(size)
  };
};

const shouldMergeFreq = (
  prevFreq: number,
  nextFreq: number,
  mergeApprox: boolean,
  tolerance: number,
  unit: TimbreConfig['mergeToleranceUnit']
) => {
  const df = Math.abs(nextFreq - prevFreq);

  // Always merge exact duplicates within a tiny absolute tolerance to keep pool stable.
  if (df <= 1e-9) return true;

  if (!mergeApprox) return false;
  const tol = Math.max(0, tolerance);

  if (tol === 0) return false;

  if (unit === 'hz') {
    return df <= tol;
  }

  // Relative units
  const ratio = nextFreq / prevFreq;
  if (!(ratio > 0)) return false;

  if (unit === 'cents') {
    const cents = 1200 * Math.log2(ratio);
    return Math.abs(cents) <= tol;
  }

  // 'ratio' (default): interpret as relative delta: |f2/f1 - 1| <= tol
  return Math.abs(ratio - 1) <= tol;
};

const mergeToneSpectra = (
  tones: [ToneSpectrum, ToneSpectrum, ToneSpectrum],
  mergeApprox: boolean,
  tolerance: number,
  toleranceUnit: TimbreConfig['mergeToleranceUnit'],
  scratch: PoolScratch
): PoolData => {
  const [a, b, c] = tones;

  const freqs = scratch.freqs;
  const amps = scratch.amps;
  const toneMask = scratch.toneMask;
  const partialIndex = scratch.partialIndex;
  const ampTone0 = scratch.ampTone0;
  const ampTone1 = scratch.ampTone1;
  const ampTone2 = scratch.ampTone2;

  let i = 0;
  let ia = 0;
  let ib = 0;
  let ic = 0;

  while (ia < a.freqs.length || ib < b.freqs.length || ic < c.freqs.length) {
    let pick: 0 | 1 | 2 = 0;
    let best = Infinity;
    if (ia < a.freqs.length) best = a.freqs[ia];
    if (ib < b.freqs.length && b.freqs[ib] < best) {
      best = b.freqs[ib];
      pick = 1;
    }
    if (ic < c.freqs.length && c.freqs[ic] < best) {
      best = c.freqs[ic];
      pick = 2;
    }

    let freq = best;
    let amp = 0;
    let mask = 0;
    let pIndex = 0;
    let toneIdx = 0;

    if (pick === 0 && ia < a.freqs.length) {
      freq = a.freqs[ia];
      amp = a.amps[ia];
      mask = a.toneMask;
      pIndex = a.partialIndex[ia];
      toneIdx = a.toneIndex;
      ia += 1;
    } else if (pick === 1 && ib < b.freqs.length) {
      freq = b.freqs[ib];
      amp = b.amps[ib];
      mask = b.toneMask;
      pIndex = b.partialIndex[ib];
      toneIdx = b.toneIndex;
      ib += 1;
    } else if (ic < c.freqs.length) {
      freq = c.freqs[ic];
      amp = c.amps[ic];
      mask = c.toneMask;
      pIndex = c.partialIndex[ic];
      toneIdx = c.toneIndex;
      ic += 1;
    }

    if (i > 0 && shouldMergeFreq(freqs[i - 1], freq, mergeApprox, tolerance, toleranceUnit)) {
      amps[i - 1] += amp;
      toneMask[i - 1] |= mask;
      partialIndex[i - 1] = Math.min(partialIndex[i - 1], pIndex);

      if (toneIdx === 0) ampTone0[i - 1] += amp;
      else if (toneIdx === 1) ampTone1[i - 1] += amp;
      else ampTone2[i - 1] += amp;
    } else {
      freqs[i] = freq;
      amps[i] = amp;
      toneMask[i] = mask;
      partialIndex[i] = pIndex;

      ampTone0[i] = toneIdx === 0 ? amp : 0;
      ampTone1[i] = toneIdx === 1 ? amp : 0;
      ampTone2[i] = toneIdx === 2 ? amp : 0;

      i += 1;
    }
  }

  return {
    freqs: freqs.subarray(0, i),
    amps: amps.subarray(0, i),
    toneMask: toneMask.subarray(0, i),
    partialIndex: partialIndex.subarray(0, i),
    length: i,
    ampTone0: ampTone0.subarray(0, i),
    ampTone1: ampTone1.subarray(0, i),
    ampTone2: ampTone2.subarray(0, i)
  };
};

const computeReference = (
  baseFreq: number,
  prepared: PreparedBundle,
  constants: RoughnessConstants,
  options: RoughnessOptions,
  point: { x: number; y: number }
) => {
  const template = prepared.template;
  const triadScale = prepared.triadScale;

  const a = buildToneSpectrum(baseFreq, template, 0, triadScale);
  const b = buildToneSpectrum(baseFreq * point.x, template, 1, triadScale);
  const c = buildToneSpectrum(baseFreq * point.y, template, 2, triadScale);

  const scratch = ensureScratch(null, (template.usedCount || template.ratios.length) * 3);

  const pool = mergeToneSpectra(
    [a, b, c],
    prepared.mergeClosePartials,
    prepared.mergeTolerance,
    prepared.mergeToleranceUnit,
    scratch
  );

  const result = poolRoughness(pool, constants, options);

  const energy = (tone: ToneSpectrum) => {
    let total = 0;
    let maxAmp = 0;
    for (let i = 0; i < tone.amps.length; i++) {
      const v = tone.amps[i];
      total += v * v;
      if (v > maxAmp) maxAmp = v;
    }
    return { total, maxAmp };
  };

  const ea = energy(a);
  const eb = energy(b);
  const ec = energy(c);
  const energyTotal = ea.total + eb.total + ec.total;
  const maxAmp = Math.max(ea.maxAmp, eb.maxAmp, ec.maxAmp);
  return { roughness: result.roughness, energy: energyTotal, maxAmp };
};

export const computeSinglePoint = (config: EngineConfig, x: number, y: number, topPairs = 0) => {
  const constants = config.constants || STANDARD_CONSTANTS;
  validateConstants(constants);

  const axes = { xs: [x], ys: [y] };
  const prepared = buildPrepared(config.baseFreq, config.timbre, config.roughness, axes);
  const scratch = ensureScratch(null, prepared.template.usedCount * 3);

  const pool = mergeToneSpectra(
    [prepared.base, prepared.xs[0], prepared.ys[0]],
    config.timbre.mergeClosePartials,
    config.timbre.mergeTolerance,
    config.timbre.mergeToleranceUnit ?? 'ratio',
    scratch
  );

  const result = poolRoughness(pool, constants, config.roughness, topPairs);
  const energy = prepared.base.energy + prepared.xs[0].energy + prepared.ys[0].energy;
  const maxAmp = Math.max(prepared.base.maxAmp, prepared.xs[0].maxAmp, prepared.ys[0].maxAmp);

  let normalized = result.roughness;
  if (config.normalizationMode === 'energy') {
    normalized = energy > 0 ? result.roughness / energy : 0;
  } else if (config.normalizationMode === 'max') {
    normalized = maxAmp > 0 ? result.roughness / (maxAmp * maxAmp) : 0;
  } else if (config.normalizationMode === 'reference') {
    const reference = computeReference(
      config.baseFreq,
      prepared,
      constants,
      config.roughness,
      config.referencePoint || { x: 1, y: 1 }
    );
    normalized = reference.roughness > 0 ? result.roughness / reference.roughness : 0;
  }

  return { raw: result.roughness, normalized, diagnostics: result };
};

const buildCellMetrics = (xs: number[], ys: number[]) => {
  const w = xs.length;
  const h = ys.length;

  const cellWidth = new Float64Array(w);
  const cellHeight = new Float64Array(h);

  for (let i = 0; i < w; i++) {
    if (w === 1) cellWidth[i] = 0;
    else if (i === 0) cellWidth[i] = xs[1] - xs[0];
    else if (i === w - 1) cellWidth[i] = xs[w - 1] - xs[w - 2];
    else cellWidth[i] = (xs[i + 1] - xs[i - 1]) / 2;
  }

  for (let j = 0; j < h; j++) {
    if (h === 1) cellHeight[j] = 0;
    else if (j === 0) cellHeight[j] = ys[1] - ys[0];
    else if (j === h - 1) cellHeight[j] = ys[h - 1] - ys[h - 2];
    else cellHeight[j] = (ys[j + 1] - ys[j - 1]) / 2;
  }

  const cellArea = new Float64Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      cellArea[j * w + i] = cellWidth[i] * cellHeight[j];
    }
  }

  return { cellWidth, cellHeight, cellArea };
};

export const computeGrid = (
  config: EngineConfig,
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean
): GridData => {
  const constants = config.constants || STANDARD_CONSTANTS;
  validateConstants(constants);

  const sampling = config.sampling;
  const baseFreq = config.baseFreq;

  const axesX = config.axes
    ? { values: config.axes.xs, logIndex: config.axes.xs.map(v => Math.log(v)) }
    : buildAxis(sampling.xRange[0], sampling.xRange[1], sampling.xSteps, sampling.logSampling);
  const axesY = config.axes
    ? { values: config.axes.ys, logIndex: config.axes.ys.map(v => Math.log(v)) }
    : buildAxis(sampling.yRange[0], sampling.yRange[1], sampling.ySteps, sampling.logSampling);

  let xs = axesX.values;
  let ys = axesY.values;

  if (!config.axes && sampling.refineFixed) {
    xs = refineAxisFixed(xs, COMMON_INTERVALS, sampling.refineBandCents, sampling.refineDensity);
    ys = refineAxisFixed(ys, COMMON_INTERVALS, sampling.refineBandCents, sampling.refineDensity);
  }

  if (sampling.foldOctave) {
    xs = uniqueSorted(xs.map(foldRatio));
    ys = uniqueSorted(ys.map(foldRatio));
  }

  const width = xs.length;
  const height = ys.length;
  const totalPoints = width * height;

  const prepared = buildPrepared(baseFreq, config.timbre, config.roughness, { xs, ys });
  const scratch = ensureScratch(null, prepared.template.usedCount * 3);

  let referenceRoughness = 1;
  if (config.normalizationMode === 'reference') {
    const reference = computeReference(
      baseFreq,
      prepared,
      constants,
      config.roughness,
      config.referencePoint || { x: 1, y: 1 }
    );
    referenceRoughness = reference.roughness > 0 ? reference.roughness : 1;
  }

  const raw = new Float64Array(totalPoints);
  const normalized = new Float64Array(totalPoints);
  const diagOriginal = new Uint16Array(totalPoints);
  const diagPruned = new Uint16Array(totalPoints);
  const diagInvalid = new Uint16Array(totalPoints);
  const diagSkipped = new Uint32Array(totalPoints);
  const diagTotal = new Uint32Array(totalPoints);
  const diagMaxPair = new Float64Array(totalPoints);
  const summary: GridDiagnosticsSummary = {
    points: totalPoints,
    originalPartials: 0,
    prunedPartials: 0,
    invalidPartials: 0,
    skippedPairs: 0,
    totalPairs: 0,
    silentPoints: 0
  };

  let minRaw = Infinity;
  let maxRaw = -Infinity;
  let minNorm = Infinity;
  let maxNorm = -Infinity;

  const checkCancel = () => {
    if (shouldCancel && shouldCancel()) throw new CancelledError();
  };

  let done = 0;
  for (let j = 0; j < height; j++) {
    checkCancel();
    const c = prepared.ys[j];
    for (let i = 0; i < width; i++) {
      const b = prepared.xs[i];
      const idx = j * width + i;

      const pool = mergeToneSpectra(
        [prepared.base, b, c],
        prepared.mergeClosePartials,
        prepared.mergeTolerance,
        prepared.mergeToleranceUnit,
        scratch
      );

      const result = poolRoughness(pool, constants, config.roughness);
      raw[idx] = result.roughness;
      diagSkipped[idx] = result.skippedPairs;
      diagTotal[idx] = result.totalPairs;
      diagMaxPair[idx] = result.maxPair;

      const energy = prepared.base.energy + b.energy + c.energy;
      const maxAmp = Math.max(prepared.base.maxAmp, b.maxAmp, c.maxAmp);
      let norm = result.roughness;
      if (config.normalizationMode === 'energy') {
        norm = energy > 0 ? result.roughness / energy : 0;
      } else if (config.normalizationMode === 'max') {
        norm = maxAmp > 0 ? result.roughness / (maxAmp * maxAmp) : 0;
      } else if (config.normalizationMode === 'reference') {
        norm = referenceRoughness > 0 ? result.roughness / referenceRoughness : 0;
      }
      normalized[idx] = norm;

      minRaw = Math.min(minRaw, raw[idx]);
      maxRaw = Math.max(maxRaw, raw[idx]);
      minNorm = Math.min(minNorm, normalized[idx]);
      maxNorm = Math.max(maxNorm, normalized[idx]);

      summary.skippedPairs += result.skippedPairs;
      summary.totalPairs += result.totalPairs;
      summary.originalPartials += prepared.diag.original * 3;
      summary.prunedPartials += prepared.diag.pruned * 3;
      summary.invalidPartials += prepared.diag.invalid * 3;
      if (prepared.diag.pruned === 0) summary.silentPoints += 1;

      diagOriginal[idx] = prepared.diag.original * 3;
      diagPruned[idx] = prepared.diag.pruned * 3;
      diagInvalid[idx] = prepared.diag.invalid * 3;

      done += 1;
      if (onProgress && done % 128 === 0) onProgress(done, totalPoints);
      if (done % 256 === 0) checkCancel();
    }
  }

  if (summary.points > 0) {
    summary.originalPartials = summary.originalPartials / summary.points;
    summary.prunedPartials = summary.prunedPartials / summary.points;
    summary.invalidPartials = summary.invalidPartials / summary.points;
  }

  const metricXs = sampling.logSampling ? xs.map(v => Math.log(v)) : xs;
  const metricYs = sampling.logSampling ? ys.map(v => Math.log(v)) : ys;
  const { cellWidth, cellHeight, cellArea } = buildCellMetrics(metricXs, metricYs);

  return {
    xs,
    ys,
    logX: xs.map(v => Math.log(v)),
    logY: ys.map(v => Math.log(v)),
    raw,
    normalized,
    scalarField: config.scalarField ?? 'normalized',
    logSampling: sampling.logSampling,
    foldOctave: sampling.foldOctave,
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
    minRaw: Number.isFinite(minRaw) ? minRaw : 0,
    maxRaw: Number.isFinite(maxRaw) ? maxRaw : 0,
    minNorm: Number.isFinite(minNorm) ? minNorm : 0,
    maxNorm: Number.isFinite(maxNorm) ? maxNorm : 0
  };
};

export type TileRequest = {
  xStart: number;
  yStart: number;
  width: number;
  height: number;
};

export const computeTile = (
  config: EngineConfig,
  tile: TileRequest,
  shouldCancel?: () => boolean
) => {
  const constants = config.constants || STANDARD_CONSTANTS;
  validateConstants(constants);

  const baseFreq = config.baseFreq;

  const axesX = config.axes
    ? { values: config.axes.xs, logIndex: config.axes.xs.map(v => Math.log(v)) }
    : buildAxis(config.sampling.xRange[0], config.sampling.xRange[1], config.sampling.xSteps, config.sampling.logSampling);
  const axesY = config.axes
    ? { values: config.axes.ys, logIndex: config.axes.ys.map(v => Math.log(v)) }
    : buildAxis(config.sampling.yRange[0], config.sampling.yRange[1], config.sampling.ySteps, config.sampling.logSampling);

  const xs = axesX.values;
  const ys = axesY.values;
  const width = xs.length;
  const height = ys.length;

  const xStart = clamp(Math.floor(tile.xStart), 0, Math.max(0, width - 1));
  const yStart = clamp(Math.floor(tile.yStart), 0, Math.max(0, height - 1));
  const tileWidth = Math.max(0, Math.min(Math.floor(tile.width), width - xStart));
  const tileHeight = Math.max(0, Math.min(Math.floor(tile.height), height - yStart));
  const tilePoints = tileWidth * tileHeight;

  const prepared = buildPrepared(baseFreq, config.timbre, config.roughness, { xs, ys });
  const scratch = ensureScratch(null, prepared.template.usedCount * 3);

  let referenceRoughness = 1;
  if (config.normalizationMode === 'reference') {
    const reference = computeReference(
      baseFreq,
      prepared,
      constants,
      config.roughness,
      config.referencePoint || { x: 1, y: 1 }
    );
    referenceRoughness = reference.roughness > 0 ? reference.roughness : 1;
  }

  const raw = new Float64Array(tilePoints);
  const normalized = new Float64Array(tilePoints);
  const diagOriginal = new Uint16Array(tilePoints);
  const diagPruned = new Uint16Array(tilePoints);
  const diagInvalid = new Uint16Array(tilePoints);
  const diagSkipped = new Uint32Array(tilePoints);
  const diagTotal = new Uint32Array(tilePoints);
  const diagMaxPair = new Float64Array(tilePoints);
  const summary: GridDiagnosticsSummary = {
    points: tilePoints,
    originalPartials: 0,
    prunedPartials: 0,
    invalidPartials: 0,
    skippedPairs: 0,
    totalPairs: 0,
    silentPoints: 0
  };

  if (tilePoints === 0) {
    return {
      tile: { xStart, yStart, width: tileWidth, height: tileHeight },
      raw,
      normalized,
      diagOriginal,
      diagPruned,
      diagInvalid,
      diagSkipped,
      diagTotal,
      diagMaxPair,
      diagnostics: summary
    };
  }

  const checkCancel = () => {
    if (shouldCancel && shouldCancel()) throw new CancelledError();
  };

  let localDone = 0;
  for (let jj = 0; jj < tileHeight; jj++) {
    checkCancel();
    const j = yStart + jj;
    const c = prepared.ys[j];
    for (let ii = 0; ii < tileWidth; ii++) {
      const i = xStart + ii;
      const b = prepared.xs[i];
      const local = jj * tileWidth + ii;

      const pool = mergeToneSpectra(
        [prepared.base, b, c],
        prepared.mergeClosePartials,
        prepared.mergeTolerance,
        prepared.mergeToleranceUnit,
        scratch
      );
      const result = poolRoughness(pool, constants, config.roughness);
      raw[local] = result.roughness;
      diagSkipped[local] = result.skippedPairs;
      diagTotal[local] = result.totalPairs;
      diagMaxPair[local] = result.maxPair;

      const energy = prepared.base.energy + b.energy + c.energy;
      const maxAmp = Math.max(prepared.base.maxAmp, b.maxAmp, c.maxAmp);
      let norm = result.roughness;
      if (config.normalizationMode === 'energy') {
        norm = energy > 0 ? result.roughness / energy : 0;
      } else if (config.normalizationMode === 'max') {
        norm = maxAmp > 0 ? result.roughness / (maxAmp * maxAmp) : 0;
      } else if (config.normalizationMode === 'reference') {
        norm = referenceRoughness > 0 ? result.roughness / referenceRoughness : 0;
      }
      normalized[local] = norm;

      summary.skippedPairs += result.skippedPairs;
      summary.totalPairs += result.totalPairs;
      summary.originalPartials += prepared.diag.original * 3;
      summary.prunedPartials += prepared.diag.pruned * 3;
      summary.invalidPartials += prepared.diag.invalid * 3;
      if (prepared.diag.pruned === 0) summary.silentPoints += 1;

      diagOriginal[local] = prepared.diag.original * 3;
      diagPruned[local] = prepared.diag.pruned * 3;
      diagInvalid[local] = prepared.diag.invalid * 3;

      localDone += 1;
      if (localDone % 512 === 0) checkCancel();
    }
  }

  return {
    tile: { xStart, yStart, width: tileWidth, height: tileHeight },
    raw,
    normalized,
    diagOriginal,
    diagPruned,
    diagInvalid,
    diagSkipped,
    diagTotal,
    diagMaxPair,
    diagnostics: summary
  };
};

export const refineWithGradient = (grid: GridData, threshold: number) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const indicesX = new Set<number>();
  const indicesY = new Set<number>();
  const idx = (i: number, j: number) => j * width + i;

  const values =
    (grid.scalarField ?? 'normalized') === 'raw'
      ? grid.raw
      : grid.normalized;

  for (let j = 0; j < height - 1; j++) {
    for (let i = 0; i < width - 1; i++) {
      const v = values[idx(i, j)];
      const vx = values[idx(i + 1, j)];
      const vy = values[idx(i, j + 1)];
      if (Math.abs(vx - v) > threshold) indicesX.add(i);
      if (Math.abs(vy - v) > threshold) indicesY.add(j);
    }
  }

  return { indicesX, indicesY };
};

export const refineWithMinima = (grid: GridData, bandCents: number, density: number) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const idx = (i: number, j: number) => j * width + i;

  const values =
    (grid.scalarField ?? 'normalized') === 'raw'
      ? grid.raw
      : grid.normalized;

  const minima: { x: number; y: number }[] = [];
  for (let j = 1; j < height - 1; j++) {
    for (let i = 1; i < width - 1; i++) {
      const v = values[idx(i, j)];
      if (
        v < values[idx(i - 1, j)] &&
        v < values[idx(i + 1, j)] &&
        v < values[idx(i, j - 1)] &&
        v < values[idx(i, j + 1)]
      ) {
        minima.push({ x: grid.xs[i], y: grid.ys[j] });
      }
    }
  }

  const refineAxis = (axis: number[], targets: number[]) => refineAxisFixed(axis, targets, bandCents, density);

  return {
    xs: refineAxis(grid.xs, minima.map(m => m.x)),
    ys: refineAxis(grid.ys, minima.map(m => m.y))
  };
};
