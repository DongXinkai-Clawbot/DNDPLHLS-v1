import type { JITopologyConfig, JITopologyResult, RatioTarget } from './jiTypes';
import { clamp, foldRatio, normalizeWeights } from './jiUtils';

type ComputePayload = {
  requestId: string;
  config: JITopologyConfig;
};

type WorkerMessage =
  | { type: 'compute'; payload: ComputePayload }
  | { type: 'cancel'; payload: { requestId: string } };

type CachedGrid = {
  gridKey: string;
  n: Float64Array;
  keys: Int32Array;
  baseFlags: Uint8Array;
  baseCount: number;
  peakCount: number;
  denseCount: number;
};

type CachedTargets = {
  beta: number;
  targetsKey: string;
  L: Float64Array;
  ratios: number[];
  num: number[];
  den: number[];
  targets: RatioTarget[];
};

const cache: {
  grid?: CachedGrid;
  targets?: CachedTargets;
  K?: Float64Array;
  kShape?: { n: number; m: number; key: string };
} = {};

const postError = (requestId: string, message: string) => {
  (self as unknown as Worker).postMessage({ type: 'error', payload: { requestId, message } });
};

const buildGridKey = (config: JITopologyConfig) =>
  [
    config.nMin,
    config.nMax,
    config.baseStep,
    config.enableBase ? 1 : 0,
    config.enablePeaks ? 1 : 0,
    config.enableDense ? 1 : 0,
    config.denseOffsets.join(','),
    config.mergeEps
  ].join('|');

const buildTargetsKey = (targets: RatioTarget[]) =>
  targets
    .map(t => `${t.num}/${t.den}`)
    .sort()
    .join('|');

const ensureTargets = (config: JITopologyConfig) => {
  const beta = config.beta;
  const key = buildTargetsKey(config.targets);
  if (cache.targets && cache.targets.beta !== beta) {
    cache.grid = undefined;
    cache.K = undefined;
    cache.kShape = undefined;
  }
  if (cache.targets && cache.targets.beta === beta && cache.targets.targetsKey === key) {
    return cache.targets;
  }

  const ratios: number[] = [];
  const L: number[] = [];
  const num: number[] = [];
  const den: number[] = [];
  const validTargets: RatioTarget[] = [];

  config.targets.forEach(target => {
    const folded = foldRatio(target.ratio, beta);
    if (!Number.isFinite(folded) || folded <= 0) return;
    const logVal = Math.log(folded) / Math.log(beta);
    if (!Number.isFinite(logVal) || Math.abs(logVal) < 1e-12) return;
    ratios.push(folded);
    L.push(logVal);
    num.push(Math.abs(target.num));
    den.push(Math.abs(target.den));
    validTargets.push(target);
  });

  const targets: CachedTargets = {
    beta,
    targetsKey: key,
    L: new Float64Array(L),
    ratios,
    num,
    den,
    targets: validTargets
  };

  cache.targets = targets;
  cache.K = undefined;
  cache.kShape = undefined;
  return targets;
};

const ensureGrid = (config: JITopologyConfig, targets: CachedTargets) => {
  const gridKey = buildGridKey(config);
  if (cache.grid && cache.grid.gridKey === gridKey) {
    return cache.grid;
  }

  const nMin = Math.min(config.nMin, config.nMax);
  const nMax = Math.max(config.nMin, config.nMax);
  const baseStep = Math.max(1e-6, config.baseStep);
  const mergeEps = Math.max(1e-12, config.mergeEps);
  const scale = 1_000_000;

  const flagMap = new Map<number, number>();
  let baseCount = 0;
  let peakCount = 0;
  let denseCount = 0;

  const addPoint = (value: number, flagBit: number) => {
    if (!Number.isFinite(value)) return;
    if (value < nMin - mergeEps || value > nMax + mergeEps) return;
    const snapped = Math.round(value / mergeEps) * mergeEps;
    const key = Math.round(snapped * scale);
    const prev = flagMap.get(key) ?? 0;
    flagMap.set(key, prev | flagBit);
  };

  if (config.enableBase) {
    for (let n = nMin; n <= nMax + baseStep * 0.5; n += baseStep) {
      addPoint(n, 0b100);
      baseCount += 1;
    }
  }

  if (config.enablePeaks) {
    for (let j = 0; j < targets.L.length; j++) {
      const L = targets.L[j];
      if (!Number.isFinite(L) || L <= 0) continue;
      const kMin = Math.max(1, Math.ceil(nMin * L));
      const kMax = Math.max(kMin, Math.floor(nMax * L));
      for (let k = kMin; k <= kMax; k++) {
        const nPeak = k / L;
        addPoint(nPeak, 0b010);
        peakCount += 1;
        if (config.enableDense) {
          config.denseOffsets.forEach(offset => {
            addPoint(nPeak + offset, 0);
            addPoint(nPeak - offset, 0);
            denseCount += 2;
          });
        }
      }
    }
  }

  const keys = Array.from(flagMap.keys()).sort((a, b) => a - b);
  const n = new Float64Array(keys.length);
  const keyArr = new Int32Array(keys.length);
  const baseFlags = new Uint8Array(keys.length);
  keys.forEach((key, idx) => {
    keyArr[idx] = key;
    n[idx] = key / scale;
    baseFlags[idx] = flagMap.get(key) ?? 0;
  });

  const grid: CachedGrid = {
    gridKey,
    n,
    keys: keyArr,
    baseFlags,
    baseCount,
    peakCount,
    denseCount
  };

  cache.grid = grid;
  cache.K = undefined;
  cache.kShape = undefined;
  return grid;
};

const buildKMatrix = (n: Float64Array, L: Float64Array, cacheKey: string) => {
  const N = n.length;
  const M = L.length;
  const size = N * M;
  if (size > 2_000_000) return undefined;
  if (cache.K && cache.kShape && cache.kShape.key === cacheKey && cache.kShape.n === N && cache.kShape.m === M) {
    return cache.K;
  }
  const K = new Float64Array(size);
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const ni = n[i];
    for (let j = 0; j < M; j++) {
      K[idx++] = ni * L[j];
    }
  }
  cache.K = K;
  cache.kShape = { n: N, m: M, key: cacheKey };
  return K;
};

const computeDeltaCents = (n: number, L: number, cPeriod: number) => {
  const k = n * L;
  const deltaRaw = k - Math.round(k);
  return Math.abs(deltaRaw) * (cPeriod / n);
};

const computeColorChannel = (delta: number, sigma: number, sharpen: number) => {
  if (!Number.isFinite(delta) || !Number.isFinite(sigma) || sigma <= 0) return 0;
  const x = Math.pow(delta / sigma, sharpen);
  const v = Math.exp(-(x * x));
  return clamp(v, 0, 1);
};

const colorRatioList = [3 / 2, 5 / 4, 7 / 4];

const computeTopology = (config: JITopologyConfig): JITopologyResult => {
  const start = performance.now();
  const targets = ensureTargets(config);
  const grid = ensureGrid(config, targets);

  const N = grid.n.length;
  const M = targets.L.length;
  if (N === 0) {
    return {
      n: new Float32Array(),
      z_pure: new Float32Array(),
      y_phys: new Float32Array(),
      y_cog: new Float32Array(),
      rgb: new Uint32Array(),
      flags: new Uint8Array(),
      stats: {
        pointCount: 0,
        peakCount: grid.peakCount,
        baseCount: grid.baseCount,
        denseCount: grid.denseCount,
        zMin: 0,
        zMax: 0,
        computeMs: performance.now() - start
      }
    };
  }
  const weights = normalizeWeights(
    targets.targets,
    config.weightNormalization,
    config.weightMode
  );

  const cPeriod = config.cPeriod;
  const epsilon = config.epsilon;
  const p = config.p;
  const useMax = p > 8;
  const nMin = Math.min(config.nMin, config.nMax);
  const nMax = Math.max(config.nMin, config.nMax);
  const yPhysCurve = Math.max(0.1, config.yPhysCurve);
  const yCogCurve = Math.max(0.1, config.yCogCurve);

  const zRaw = new Float64Array(N);
  const yPhys = new Float64Array(N);
  const yCog = new Float64Array(N);
  const flags = new Uint8Array(N);

  const cacheKey = `${grid.gridKey}|${targets.targetsKey}`;
  const K = buildKMatrix(grid.n, targets.L, cacheKey);

  let zMin = Infinity;
  let zMax = -Infinity;

  for (let i = 0; i < N; i++) {
    const nVal = grid.n[i];
    const t = nMax === nMin ? 0 : clamp((nVal - nMin) / (nMax - nMin), 0, 1);
    const phys = 100 * Math.pow(1 - t, yPhysCurve);
    const cog = Math.pow(t, yCogCurve);

    yPhys[i] = phys;
    yCog[i] = cog;

    let E = 0;
    if (M > 0) {
      if (useMax) {
        let maxVal = 0;
        for (let j = 0; j < M; j++) {
          const k = K ? K[i * M + j] : nVal * targets.L[j];
          const deltaRaw = k - Math.round(k);
          const delta = Math.abs(deltaRaw) * (cPeriod / nVal);
          const w = weights[j] ?? 1;
          const value = w * delta;
          if (value > maxVal) maxVal = value;
        }
        E = maxVal;
      } else {
        let sum = 0;
        for (let j = 0; j < M; j++) {
          const k = K ? K[i * M + j] : nVal * targets.L[j];
          const deltaRaw = k - Math.round(k);
          const delta = Math.abs(deltaRaw) * (cPeriod / nVal);
          const w = weights[j] ?? 1;
          sum += w * Math.pow(delta, p);
        }
        E = Math.pow(sum, 1 / p);
      }
    }

    const zScore =
      config.zNormalization === 'gamma'
        ? 1 / ((E + epsilon) * Math.pow(nVal, config.gamma))
        : Math.sqrt(nVal) / (E + epsilon);

    zRaw[i] = zScore;
    zMin = Math.min(zMin, zScore);
    zMax = Math.max(zMax, zScore);

    let f = grid.baseFlags[i] || 0;
    if (Math.abs(nVal - Math.round(nVal)) < 1e-6) {
      f |= 0b001;
    }
    flags[i] = f;
  }

  const zRange = zMax - zMin;
  const zPure = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    zPure[i] = zRange > 0 ? (zRaw[i] - zMin) / zRange : 0;
  }

  const colorL = colorRatioList.map(r => {
    const folded = foldRatio(r, config.beta);
    if (!Number.isFinite(folded) || folded <= 0) return NaN;
    return Math.log(folded) / Math.log(config.beta);
  });

  const rgb = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    const nVal = grid.n[i];
    const deltas = colorL.map(L => (Number.isFinite(L) ? computeDeltaCents(nVal, L, cPeriod) : 0));
    const r = computeColorChannel(deltas[0], config.colorSigma, config.colorSharpen);
    const b = computeColorChannel(deltas[1], config.colorSigma, config.colorSharpen);
    const g = computeColorChannel(deltas[2], config.colorSigma, config.colorSharpen);
    const r8 = Math.round(clamp(r, 0, 1) * 255);
    const g8 = Math.round(clamp(g, 0, 1) * 255);
    const b8 = Math.round(clamp(b, 0, 1) * 255);
    rgb[i] = (r8 << 16) | (g8 << 8) | b8;
  }

  const out: JITopologyResult = {
    n: new Float32Array(grid.n),
    z_pure: new Float32Array(zPure),
    y_phys: new Float32Array(yPhys),
    y_cog: new Float32Array(yCog),
    rgb,
    flags,
    stats: {
      pointCount: N,
      peakCount: grid.peakCount,
      baseCount: grid.baseCount,
      denseCount: grid.denseCount,
      zMin,
      zMax,
      computeMs: performance.now() - start
    }
  };

  return out;
};

(self as unknown as Worker).onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  if (!message) return;
  if (message.type === 'cancel') {
    return;
  }
  if (message.type !== 'compute') return;

  const { requestId, config } = message.payload;
  if (!Number.isFinite(config.beta) || config.beta <= 1) {
    postError(requestId, 'Beta must be > 1.0');
    return;
  }

  try {
    const result = computeTopology(config);
    const transfer = [
      result.n.buffer,
      result.z_pure.buffer,
      result.y_phys.buffer,
      result.y_cog.buffer,
      result.rgb.buffer,
      result.flags.buffer
    ];
    (self as unknown as Worker).postMessage({ type: 'result', payload: { requestId, result } }, transfer);
  } catch (err) {
    postError(requestId, err instanceof Error ? err.message : 'Worker compute error');
  }
};

