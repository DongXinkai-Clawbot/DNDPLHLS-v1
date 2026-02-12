import { EngineConfig, computeGrid, refineWithGradient, refineWithMinima, CancelledError } from './engine';
import { buildAxis, refineAxisMidpoints, refineAxisFixed } from './sampling';

type ComputeMessage = {
  type: 'compute';
  payload: EngineConfig & { requestId: string };
};

type CancelMessage = { type: 'cancel'; payload: { requestId: string } };

type WorkerMessage = ComputeMessage | CancelMessage;

let activeRequest: string | null = null;
let lastConfigKey = '';
let tileCache = new Map<string, {
  x: number;
  y: number;
  w: number;
  h: number;
  raw: Float64Array;
  normalized: Float64Array;
  diagOriginal: Uint16Array;
  diagPruned: Uint16Array;
  diagInvalid: Uint16Array;
  diagSkipped: Uint32Array;
  diagTotal: Uint32Array;
  diagMaxPair: Float64Array;
}>();
const TILE_SIZE = 32;
let lastGridMeta: Omit<ReturnType<typeof computeGrid>, 'raw' | 'normalized'> | null = null;

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

const postProgress = (requestId: string, done: number, total: number) => {
  (self as unknown as Worker).postMessage({
    type: 'progress',
    payload: { requestId, done, total }
  });
};

const postResult = (requestId: string, result: ReturnType<typeof computeGrid>) => {
  const transfers: ArrayBuffer[] = [result.raw.buffer, result.normalized.buffer];
  if (result.diagOriginal) transfers.push(result.diagOriginal.buffer);
  if (result.diagPruned) transfers.push(result.diagPruned.buffer);
  if (result.diagInvalid) transfers.push(result.diagInvalid.buffer);
  if (result.diagSkipped) transfers.push(result.diagSkipped.buffer);
  if (result.diagTotal) transfers.push(result.diagTotal.buffer);
  if (result.diagMaxPair) transfers.push(result.diagMaxPair.buffer);
  (self as unknown as Worker).postMessage(
    {
      type: 'result',
      payload: { requestId, result }
    },
    transfers
  );
};

const postError = (requestId: string, message: string) => {
  (self as unknown as Worker).postMessage({
    type: 'error',
    payload: { requestId, message }
  });
};

const buildAxesWithRefinement = (config: EngineConfig) => {
  const sampling = config.sampling;
  const axesX = buildAxis(sampling.xRange[0], sampling.xRange[1], sampling.xSteps, sampling.logSampling);
  const axesY = buildAxis(sampling.yRange[0], sampling.yRange[1], sampling.ySteps, sampling.logSampling);
  let xs = axesX.values;
  let ys = axesY.values;
  if (sampling.refineFixed) {
    const common = [6 / 5, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 2 / 1];
    xs = refineAxisFixed(xs, common, sampling.refineBandCents, sampling.refineDensity);
    ys = refineAxisFixed(ys, common, sampling.refineBandCents, sampling.refineDensity);
  }
  return { xs, ys };
};

const computeWithRefinement = (config: EngineConfig, shouldCancel?: () => boolean) => {
  const sampling = config.sampling;

  const checkCancel = () => {
    if (shouldCancel && shouldCancel()) throw new CancelledError();
  };

  if (config.axes) {
    return computeGrid(
      config,
      (done, total) => activeRequest && postProgress(activeRequest, done, total),
      shouldCancel
    );
  }

  checkCancel();
  const axes = buildAxesWithRefinement(config);

  let xs = axes.xs;
  let ys = axes.ys;

  if (sampling.foldOctave) {
    xs = foldAxis(xs);
    ys = foldAxis(ys);
  }

  if (sampling.refineGradient || sampling.refineMinima) {
    checkCancel();
    const baseSteps = Math.max(8, sampling.refineBaseSteps || 32);
    const baseGrid = computeGrid(
      {
        ...config,
        axes: { xs: buildAxis(config.sampling.xRange[0], config.sampling.xRange[1], baseSteps, sampling.logSampling).values, ys: buildAxis(config.sampling.yRange[0], config.sampling.yRange[1], baseSteps, sampling.logSampling).values }
      },
      undefined,
      shouldCancel
    );

    checkCancel();
    if (sampling.refineGradient) {
      const refined = refineAxesByGradient(baseGrid, sampling.gradientThreshold);
      xs = mergeAxis(xs, refined.xs);
      ys = mergeAxis(ys, refined.ys);
    }

    checkCancel();
    if (sampling.refineMinima) {
      const refined = refineAxesByMinima(baseGrid, sampling.refineBandCents, sampling.refineDensity);
      xs = mergeAxis(xs, refined.xs);
      ys = mergeAxis(ys, refined.ys);
    }

    checkCancel();
  }

  return computeGrid(
    { ...config, axes: { xs, ys } },
    (done, total) => activeRequest && postProgress(activeRequest, done, total),
    shouldCancel
  );
};

const buildConfigKey = (config: EngineConfig) => {
  const key = {
    baseFreq: config.baseFreq,
    timbre: config.timbre,
    sampling: config.sampling,
    roughness: config.roughness,
    normalizationMode: config.normalizationMode,
    axes: config.axes ? { xs: config.axes.xs, ys: config.axes.ys } : null
  };
  return JSON.stringify(key);
};

const cacheTiles = (grid: ReturnType<typeof computeGrid>) => {
  tileCache.clear();
  lastGridMeta = {
    xs: grid.xs,
    ys: grid.ys,
    logX: grid.logX,
    logY: grid.logY,
    diagnostics: grid.diagnostics,
    normalizationMode: grid.normalizationMode,
    diagOriginal: grid.diagOriginal,
    diagPruned: grid.diagPruned,
    diagInvalid: grid.diagInvalid,
    diagSkipped: grid.diagSkipped,
    diagTotal: grid.diagTotal,
    diagMaxPair: grid.diagMaxPair
  };
  const width = grid.xs.length;
  const height = grid.ys.length;
  for (let y = 0; y < height; y += TILE_SIZE) {
    for (let x = 0; x < width; x += TILE_SIZE) {
      const w = Math.min(TILE_SIZE, width - x);
      const h = Math.min(TILE_SIZE, height - y);
      const raw = new Float64Array(w * h);
      const normalized = new Float64Array(w * h);
      const diagOriginal = new Uint16Array(w * h);
      const diagPruned = new Uint16Array(w * h);
      const diagInvalid = new Uint16Array(w * h);
      const diagSkipped = new Uint32Array(w * h);
      const diagTotal = new Uint32Array(w * h);
      const diagMaxPair = new Float64Array(w * h);
      for (let yy = 0; yy < h; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const src = (y + yy) * width + (x + xx);
          const dst = yy * w + xx;
          raw[dst] = grid.raw[src];
          normalized[dst] = grid.normalized[src];
          if (grid.diagOriginal) diagOriginal[dst] = grid.diagOriginal[src];
          if (grid.diagPruned) diagPruned[dst] = grid.diagPruned[src];
          if (grid.diagInvalid) diagInvalid[dst] = grid.diagInvalid[src];
          if (grid.diagSkipped) diagSkipped[dst] = grid.diagSkipped[src];
          if (grid.diagTotal) diagTotal[dst] = grid.diagTotal[src];
          if (grid.diagMaxPair) diagMaxPair[dst] = grid.diagMaxPair[src];
        }
      }
      tileCache.set(`${x}-${y}`, { x, y, w, h, raw, normalized, diagOriginal, diagPruned, diagInvalid, diagSkipped, diagTotal, diagMaxPair });
    }
  }
};

const assembleFromTiles = (grid: ReturnType<typeof computeGrid>) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const raw = new Float64Array(width * height);
  const normalized = new Float64Array(width * height);
  const diagOriginal = new Uint16Array(width * height);
  const diagPruned = new Uint16Array(width * height);
  const diagInvalid = new Uint16Array(width * height);
  const diagSkipped = new Uint32Array(width * height);
  const diagTotal = new Uint32Array(width * height);
  const diagMaxPair = new Float64Array(width * height);
  let tilesDone = 0;
  const tilesTotal = tileCache.size;
  tileCache.forEach(tile => {
    for (let yy = 0; yy < tile.h; yy++) {
      for (let xx = 0; xx < tile.w; xx++) {
        const dst = (tile.y + yy) * width + (tile.x + xx);
        const src = yy * tile.w + xx;
        raw[dst] = tile.raw[src];
        normalized[dst] = tile.normalized[src];
        diagOriginal[dst] = tile.diagOriginal[src];
        diagPruned[dst] = tile.diagPruned[src];
        diagInvalid[dst] = tile.diagInvalid[src];
        diagSkipped[dst] = tile.diagSkipped[src];
        diagTotal[dst] = tile.diagTotal[src];
        diagMaxPair[dst] = tile.diagMaxPair[src];
      }
    }
    tilesDone += 1;
    if (activeRequest) postProgress(activeRequest, tilesDone, tilesTotal);
  });
  return { raw, normalized, diagOriginal, diagPruned, diagInvalid, diagSkipped, diagTotal, diagMaxPair };
};

(self as unknown as Worker).onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    if (activeRequest === message.payload.requestId) {
      activeRequest = null;
    }
    return;
  }
  if (message.type !== 'compute') return;
  const { requestId } = message.payload;
  activeRequest = requestId;
  try {
    const configKey = buildConfigKey(message.payload);
    if (configKey === lastConfigKey && tileCache.size > 0) {
      if (!lastGridMeta) throw new Error('Tile cache missing metadata');
      const cached = assembleFromTiles({
        ...lastGridMeta,
        raw: new Float64Array(0),
        normalized: new Float64Array(0)
      });
      const result = {
        ...lastGridMeta,
        raw: cached.raw,
        normalized: cached.normalized,
        diagOriginal: cached.diagOriginal,
        diagPruned: cached.diagPruned,
        diagInvalid: cached.diagInvalid,
        diagSkipped: cached.diagSkipped,
        diagTotal: cached.diagTotal,
        diagMaxPair: cached.diagMaxPair
      };
      if (activeRequest === requestId) {
        postResult(requestId, result);
        activeRequest = null;
      }
    } else {
      const shouldCancel = () => activeRequest !== requestId;
      const result = computeWithRefinement(message.payload, shouldCancel);
      cacheTiles(result);
      lastConfigKey = configKey;
      if (activeRequest === requestId) {
        postResult(requestId, result);
        activeRequest = null;
      }
    }
  } catch (err) {
    if (err instanceof CancelledError || (err && (err as any).name === 'CancelledError')) {
      // Silent cancellation.
      activeRequest = null;
      return;
    }
    postError(requestId, err instanceof Error ? err.message : 'Unknown worker error');
    activeRequest = null;
  }
};
