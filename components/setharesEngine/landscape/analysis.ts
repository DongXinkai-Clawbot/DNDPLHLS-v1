import { BoundaryPolicy, GridData, IntervalLabel, MinimaPoint, NeighborhoodConnectivity, TerrainScalarField } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const resolveScalarField = (grid: GridData, field?: boolean | TerrainScalarField): TerrainScalarField => {
  if (typeof field === 'string') return field;
  if (typeof field === 'boolean') return field ? 'normalized' : 'raw';
  return grid.scalarField ?? 'normalized';
};

export const selectValues = (grid: GridData, field?: boolean | TerrainScalarField) => {
  const f = resolveScalarField(grid, field);
  return f === 'raw' ? grid.raw : grid.normalized;
};

const selectMetricAxes = (grid: GridData) => {
  const useLog = !!grid.logSampling;
  return {
    xs: useLog ? grid.logX : grid.xs,
    ys: useLog ? grid.logY : grid.ys,
    useLog
  };
};

const mirrorIndex = (idx: number, size: number) => {
  if (size <= 1) return 0;
  let i = idx;
  while (i < 0 || i >= size) {
    if (i < 0) i = -i;
    if (i >= size) i = 2 * size - 2 - i;
  }
  return i;
};

const quantile = (arr: number[], q: number) => {
  if (arr.length === 0) return NaN;
  const qq = clamp(q, 0, 1);
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * qq;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const t = pos - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
};

export const getValueAtIndex = (grid: GridData, i: number, j: number, field?: boolean | TerrainScalarField) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  if (width === 0 || height === 0) return NaN;
  const ii = clamp(i, 0, width - 1);
  const jj = clamp(j, 0, height - 1);
  const values = selectValues(grid, field);
  return values[jj * width + ii];
};

export type SampleResult = {
  value: number;
  x: number;
  y: number;
  ix: number;
  iy: number;
  i0: number;
  i1: number;
  j0: number;
  j1: number;
  wx: number;
  wy: number;
  field: TerrainScalarField;
  useLog: boolean;
};

export type SampleOptions = {
  field?: boolean | TerrainScalarField;
  clamp?: boolean;
};

export const computeGradients = (grid: GridData, field?: boolean | TerrainScalarField) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const values = selectValues(grid, field);
  const metric = selectMetricAxes(grid);
  const xs = metric.xs;
  const ys = metric.ys;

  const gradientsX = new Float32Array(width * height);
  const gradientsY = new Float32Array(width * height);
  const idx = (i: number, j: number) => j * width + i;

  for (let j = 0; j < height; j++) {
    const jm = j > 0 ? j - 1 : j;
    const jp = j < height - 1 ? j + 1 : j;
    const dy = ys[jp] - ys[jm] || 1;
    for (let i = 0; i < width; i++) {
      const im = i > 0 ? i - 1 : i;
      const ip = i < width - 1 ? i + 1 : i;
      const dx = xs[ip] - xs[im] || 1;

      gradientsX[idx(i, j)] = (values[idx(ip, j)] - values[idx(im, j)]) / dx;
      gradientsY[idx(i, j)] = (values[idx(i, jp)] - values[idx(i, jm)]) / dy;
    }
  }

  return { gradientsX, gradientsY, dx: gradientsX, dy: gradientsY };
};

export const computeNormals = (dx: ArrayLike<number>, dy: ArrayLike<number>) => {
  const len = dx.length;
  const normals = new Float64Array(len * 3);
  for (let i = 0; i < len; i++) {
    const nx = -dx[i];
    const ny = -dy[i];
    const nz = 1;
    const mag = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    normals[i * 3] = nx / mag;
    normals[i * 3 + 1] = ny / mag;
    normals[i * 3 + 2] = nz / mag;
  }
  return normals;
};

export const computeAO = (grid: GridData, strength: number, field?: boolean | TerrainScalarField) => {
  const { xs, ys } = grid;
  const values = selectValues(grid, field);
  const width = xs.length;
  const height = ys.length;
  const ao = new Float64Array(width * height);
  const idx = (i: number, j: number) => j * width + i;
  const radius = 1;
  const safeStrength = clamp(strength, 0, 2);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      let acc = 0;
      let count = 0;
      const center = values[idx(i, j)];
      for (let y = -radius; y <= radius; y++) {
        const jj = clamp(j + y, 0, height - 1);
        for (let x = -radius; x <= radius; x++) {
          const ii = clamp(i + x, 0, width - 1);
          if (ii === i && jj === j) continue;
          acc += values[idx(ii, jj)] - center;
          count += 1;
        }
      }
      const diff = count > 0 ? acc / count : 0;
      const shade = 1 - safeStrength * Math.max(0, diff);
      ao[idx(i, j)] = clamp(shade, 0.3, 1);
    }
  }
  return ao;
};

export const smoothGrid = (
  grid: GridData,
  iterations = 1,
  field?: boolean | TerrainScalarField,
  boundaryPolicy: BoundaryPolicy = 'mirror'
) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const original = selectValues(grid, field);
  let current = new Float64Array(original);
  let next = new Float64Array(current.length);

  const idx = (i: number, j: number) => j * width + i;

  for (let it = 0; it < iterations; it++) {
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let ni = i + dx;
            let nj = j + dy;
            if (boundaryPolicy === 'mirror') {
              ni = mirrorIndex(ni, width);
              nj = mirrorIndex(nj, height);
            } else {
              // skip out-of-bounds
              if (ni < 0 || ni >= width || nj < 0 || nj >= height) continue;
            }
            sum += current[idx(ni, nj)];
            count += 1;
          }
        }
        next[idx(i, j)] = count > 0 ? sum / count : current[idx(i, j)];
      }
    }
    const tmp = current;
    current = next;
    next = tmp;
  }

  return current;
};

export const detectMinima = (
  grid: GridData,
  neighborhood: number,
  smoothIterations: number,
  field?: boolean | TerrainScalarField
) => {
  const { xs, ys } = grid;
  const width = xs.length;
  const height = ys.length;
  const values = smoothIterations > 0 ? smoothGrid(grid, smoothIterations, field) : selectValues(grid, field);
  const idx = (i: number, j: number) => j * width + i;
  const minima: MinimaPoint[] = [];
  const radius = Math.max(1, Math.round(neighborhood));

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const center = values[idx(i, j)];
      let isMin = true;
      let localMax = center;
      for (let y = -radius; y <= radius; y++) {
        const jj = clamp(j + y, 0, height - 1);
        for (let x = -radius; x <= radius; x++) {
          const ii = clamp(i + x, 0, width - 1);
          if (ii === i && jj === j) continue;
          const v = values[idx(ii, jj)];
          localMax = Math.max(localMax, v);
          if (v <= center) {
            isMin = false;
            break;
          }
        }
        if (!isMin) break;
      }
      if (isMin) {
        const depth = localMax - center;
        minima.push({ x: xs[i], y: ys[j], roughness: center, depth });
      }
    }
  }

  return minima.sort((a, b) => a.roughness - b.roughness);
};

export const detectMaxima = (
  grid: GridData,
  neighborhood: number,
  smoothIterations: number,
  field?: boolean | TerrainScalarField
) => {
  const { xs, ys } = grid;
  const width = xs.length;
  const height = ys.length;
  const values = smoothIterations > 0 ? smoothGrid(grid, smoothIterations, field) : selectValues(grid, field);
  const idx = (i: number, j: number) => j * width + i;
  const maxima: MinimaPoint[] = [];
  const radius = Math.max(1, Math.round(neighborhood));

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const center = values[idx(i, j)];
      let isMax = true;
      let localMin = center;
      for (let y = -radius; y <= radius; y++) {
        const jj = clamp(j + y, 0, height - 1);
        for (let x = -radius; x <= radius; x++) {
          const ii = clamp(i + x, 0, width - 1);
          if (ii === i && jj === j) continue;
          const v = values[idx(ii, jj)];
          localMin = Math.min(localMin, v);
          if (v >= center) {
            isMax = false;
            break;
          }
        }
        if (!isMax) break;
      }
      if (isMax) {
        const depth = center - localMin;
        maxima.push({ x: xs[i], y: ys[j], roughness: center, depth });
      }
    }
  }

  return maxima.sort((a, b) => b.roughness - a.roughness);
};

export type AxisSampler = {
  axis: number[];
  uniform: boolean;
  step: number;
  min: number;
  max: number;
};

export const buildAxisSampler = (axis: number[]): AxisSampler => {
  const safe = axis.filter(v => Number.isFinite(v));
  const min = safe.length ? safe[0] : 0;
  const max = safe.length ? safe[safe.length - 1] : 0;
  if (safe.length < 2) {
    return { axis: safe, uniform: true, step: 1, min, max };
  }
  const step = (safe[safe.length - 1] - safe[0]) / (safe.length - 1);
  let uniform = true;
  for (let i = 1; i < safe.length; i++) {
    if (Math.abs(safe[i] - (safe[0] + step * i)) > Math.abs(step) * 1e-6) {
      uniform = false;
      break;
    }
  }
  return { axis: safe, uniform, step, min, max };
};

const findBracket = (sampler: AxisSampler, v: number) => {
  const { axis, uniform, step, min, max } = sampler;
  if (axis.length < 2) return null;
  if (v < min || v > max) return null;
  if (uniform) {
    const idx = clamp(Math.floor((v - min) / step), 0, axis.length - 2);
    const v0 = axis[idx];
    const v1 = axis[idx + 1];
    const t = (v - v0) / (v1 - v0 || 1);
    return { i0: idx, i1: idx + 1, t: clamp(t, 0, 1) };
  }
  let lo = 0;
  let hi = axis.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (axis[mid] <= v) lo = mid;
    else hi = mid;
  }
  const v0 = axis[lo];
  const v1 = axis[lo + 1];
  const t = (v - v0) / (v1 - v0 || 1);
  return { i0: lo, i1: lo + 1, t: clamp(t, 0, 1) };
};

export const sampleGrid = (
  grid: GridData,
  x: number,
  y: number,
  options?: SampleOptions
): SampleResult | null => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  if (width === 0 || height === 0) return null;

  const metric = selectMetricAxes(grid);
  const useLog = metric.useLog;
  if (useLog && (x <= 0 || y <= 0)) return null;

  const tx = useLog ? Math.log(x) : x;
  const ty = useLog ? Math.log(y) : y;

  const sx = buildAxisSampler(metric.xs);
  const sy = buildAxisSampler(metric.ys);

  const clampMode = options?.clamp ?? false;
  const txClamped = clampMode ? clamp(tx, sx.min, sx.max) : tx;
  const tyClamped = clampMode ? clamp(ty, sy.min, sy.max) : ty;

  const bx = findBracket(sx, txClamped);
  const by = findBracket(sy, tyClamped);
  if (!bx || !by) return null;

  const values = selectValues(grid, options?.field);
  const idx = (i: number, j: number) => j * width + i;

  const v00 = values[idx(bx.i0, by.i0)];
  const v10 = values[idx(bx.i1, by.i0)];
  const v01 = values[idx(bx.i0, by.i1)];
  const v11 = values[idx(bx.i1, by.i1)];

  const v0 = v00 * (1 - bx.t) + v10 * bx.t;
  const v1 = v01 * (1 - bx.t) + v11 * bx.t;
  const value = v0 * (1 - by.t) + v1 * by.t;

  const nearI = Math.abs(metric.xs[bx.i0] - txClamped) <= Math.abs(metric.xs[bx.i1] - txClamped) ? bx.i0 : bx.i1;
  const nearJ = Math.abs(metric.ys[by.i0] - tyClamped) <= Math.abs(metric.ys[by.i1] - tyClamped) ? by.i0 : by.i1;

  return {
    value,
    x: useLog ? Math.exp(txClamped) : txClamped,
    y: useLog ? Math.exp(tyClamped) : tyClamped,
    ix: nearI,
    iy: nearJ,
    i0: bx.i0,
    i1: bx.i1,
    j0: by.i0,
    j1: by.i1,
    wx: bx.t,
    wy: by.t,
    field: resolveScalarField(grid, options?.field),
    useLog
  };
};

export const sampleGridValue = (
  grid: GridData,
  x: number,
  y: number,
  field?: boolean | TerrainScalarField,
  clampMode = true
) => {
  const result = sampleGrid(grid, x, y, { field, clamp: clampMode });
  return result ? result.value : null;
};

export const sampleGridBilinear = (
  grid: GridData,
  x: number,
  y: number,
  field?: boolean | TerrainScalarField
) => {
  return sampleGridValue(grid, x, y, field, true);
};

export type MinimaOptions = {
  neighborhood: number;
  smoothIterations: number;
  useLaplacian: boolean;
  minLaplacian: number;
  minDepth: number;
};

const computeLaplacian = (values: Float64Array, width: number, height: number, i: number, j: number) => {
  const idx = (x: number, y: number) => y * width + x;
  const c = values[idx(i, j)];
  const left = values[idx(Math.max(0, i - 1), j)];
  const right = values[idx(Math.min(width - 1, i + 1), j)];
  const down = values[idx(i, Math.max(0, j - 1))];
  const up = values[idx(i, Math.min(height - 1, j + 1))];
  return left + right + down + up - 4 * c;
};

export const detectMinimaDetailed = (
  grid: GridData,
  options: {
    neighborhood: number;
    smoothIterations: number;
    useLaplacian: boolean;
    minLaplacian: number;
    minDepth: number;
    field?: boolean | TerrainScalarField;
    boundaryPolicy?: BoundaryPolicy;
    connectivity?: NeighborhoodConnectivity;
    depthQuantile?: number;
    plateauEps?: number;
  }
) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const idx = (i: number, j: number) => j * width + i;

  const neighborhood = Math.max(1, Math.round(options.neighborhood ?? 1));
  const smoothIterations = Math.max(0, Math.round(options.smoothIterations ?? 0));
  const boundaryPolicy: BoundaryPolicy = options.boundaryPolicy ?? 'skip';
  const connectivity: NeighborhoodConnectivity = options.connectivity ?? 4;
  const depthQ = options.depthQuantile ?? 0.9;
  const plateauEpsBase = options.plateauEps ?? 1e-12;

  const values =
    smoothIterations > 0
      ? smoothGrid(grid, smoothIterations, options.field, boundaryPolicy)
      : new Float64Array(selectValues(grid, options.field)); // copy to keep consistent semantics

  const metric = selectMetricAxes(grid);
  const mx = metric.xs;
  const my = metric.ys;

  const neighborOffsets =
    connectivity === 8
      ? [
          [-1, -1],
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1]
        ]
      : [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1]
        ];

  const laplacianAt = (i: number, j: number) => {
    const c = values[idx(i, j)];
    const im = boundaryPolicy === 'mirror' ? mirrorIndex(i - 1, width) : i - 1;
    const ip = boundaryPolicy === 'mirror' ? mirrorIndex(i + 1, width) : i + 1;
    const jm = boundaryPolicy === 'mirror' ? mirrorIndex(j - 1, height) : j - 1;
    const jp = boundaryPolicy === 'mirror' ? mirrorIndex(j + 1, height) : j + 1;

    if (boundaryPolicy === 'skip' && (im < 0 || ip >= width || jm < 0 || jp >= height)) return NaN;

    const fL = values[idx(im, j)];
    const fR = values[idx(ip, j)];
    const fD = values[idx(i, jm)];
    const fU = values[idx(i, jp)];

    const dx1 = mx[i] - mx[im];
    const dx2 = mx[ip] - mx[i];
    const dy1 = my[j] - my[jm];
    const dy2 = my[jp] - my[j];

    const d2x =
      dx1 > 0 && dx2 > 0 ? (2 * ((fR - c) / dx2 - (c - fL) / dx1)) / (dx1 + dx2) : 0;
    const d2y =
      dy1 > 0 && dy2 > 0 ? (2 * ((fU - c) / dy2 - (c - fD) / dy1)) / (dy1 + dy2) : 0;

    return d2x + d2y;
  };

  const visited = new Uint8Array(width * height);
  const minima: MinimaPoint[] = [];

  const startI = boundaryPolicy === 'skip' ? neighborhood : 0;
  const startJ = boundaryPolicy === 'skip' ? neighborhood : 0;
  const endI = boundaryPolicy === 'skip' ? width - neighborhood : width;
  const endJ = boundaryPolicy === 'skip' ? height - neighborhood : height;

  for (let j = startJ; j < endJ; j++) {
    for (let i = startI; i < endI; i++) {
      const seedId = idx(i, j);
      if (visited[seedId]) continue;

      const center = values[seedId];
      if (!Number.isFinite(center)) {
        visited[seedId] = 1;
        continue;
      }
      const eps = plateauEpsBase * Math.max(1, Math.abs(center));

      // Plateau flood-fill (connected equal-value region)
      const qI: number[] = [i];
      const qJ: number[] = [j];
      let qh = 0;
      visited[seedId] = 1;

      const plateau: number[] = [];
      let minI = i;
      let maxI = i;
      let minJ = j;
      let maxJ = j;

      while (qh < qI.length) {
        const ci = qI[qh];
        const cj = qJ[qh];
        qh += 1;

        const cid = idx(ci, cj);
        plateau.push(cid);
        minI = Math.min(minI, ci);
        maxI = Math.max(maxI, ci);
        minJ = Math.min(minJ, cj);
        maxJ = Math.max(maxJ, cj);

        for (const [dx, dy] of neighborOffsets) {
          let ni = ci + dx;
          let nj = cj + dy;
          if (boundaryPolicy === 'mirror') {
            ni = mirrorIndex(ni, width);
            nj = mirrorIndex(nj, height);
          } else {
            if (ni < 0 || ni >= width || nj < 0 || nj >= height) continue;
          }
          const nid = idx(ni, nj);
          if (visited[nid]) continue;
          const v = values[nid];
          if (Number.isFinite(v) && Math.abs(v - center) <= eps) {
            visited[nid] = 1;
            qI.push(ni);
            qJ.push(nj);
          }
        }
      }

      // If we skip boundaries, discard plateaus that touch the unsafe band.
      if (
        boundaryPolicy === 'skip' &&
        (minI < neighborhood ||
          minJ < neighborhood ||
          maxI >= width - neighborhood ||
          maxJ >= height - neighborhood)
      ) {
        continue;
      }

      // Scan the plateau's expanded neighborhood to validate it's a true minimum,
      // and to compute depth via a robust quantile.
      const scanMinI = minI - neighborhood;
      const scanMaxI = maxI + neighborhood;
      const scanMinJ = minJ - neighborhood;
      const scanMaxJ = maxJ + neighborhood;

      if (boundaryPolicy === 'skip') {
        if (scanMinI < 0 || scanMinJ < 0 || scanMaxI >= width || scanMaxJ >= height) continue;
      }

      let hasLower = false;
      let hasHigher = false;
      const neighborhoodVals: number[] = [];

      for (let sj = scanMinJ; sj <= scanMaxJ; sj++) {
        for (let si = scanMinI; si <= scanMaxI; si++) {
          let ii = si;
          let jj = sj;
          if (boundaryPolicy === 'mirror') {
            ii = mirrorIndex(ii, width);
            jj = mirrorIndex(jj, height);
          } else {
            if (ii < 0 || ii >= width || jj < 0 || jj >= height) continue;
          }
          const v = values[idx(ii, jj)];
          if (!Number.isFinite(v)) continue;
          neighborhoodVals.push(v);
          if (v < center - eps) hasLower = true;
          if (v > center + eps) hasHigher = true;
        }
      }

      if (hasLower || !hasHigher) continue;

      const depth = quantile(neighborhoodVals, depthQ) - center;
      if (!(depth >= options.minDepth)) continue;

      // Representative point: closest plateau cell to centroid in metric coords.
      let sumX = 0;
      let sumY = 0;
      for (const id of plateau) {
        const pi = id % width;
        const pj = (id / width) | 0;
        sumX += mx[pi];
        sumY += my[pj];
      }
      const cx = sumX / plateau.length;
      const cy = sumY / plateau.length;

      let repI = i;
      let repJ = j;
      let bestD = Infinity;
      for (const id of plateau) {
        const pi = id % width;
        const pj = (id / width) | 0;
        const dx = mx[pi] - cx;
        const dy = my[pj] - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          repI = pi;
          repJ = pj;
        }
      }

      let laplacian: number | undefined;
      if (options.useLaplacian) {
        const lap = laplacianAt(repI, repJ);
        if (!Number.isFinite(lap) || lap < options.minLaplacian) continue;
        laplacian = lap;
      }

      minima.push({
        x: grid.xs[repI],
        y: grid.ys[repJ],
        ix: repI,
        iy: repJ,
        roughness: center,
        depth,
        plateauSize: plateau.length,
        laplacian
      });
    }
  }

  minima.sort((a, b) => {
    if (a.roughness !== b.roughness) return a.roughness - b.roughness;
    if (a.depth !== b.depth) return b.depth - a.depth;
    const ay = a.iy ?? 0;
    const by = b.iy ?? 0;
    if (ay !== by) return ay - by;
    const ax = a.ix ?? 0;
    const bx = b.ix ?? 0;
    return ax - bx;
  });

  return minima;
};

export const estimateBasins = (
  grid: GridData,
  minima: MinimaPoint[],
  options: {
    thresholdStd: number;
    maxRadius: number;
    useEightNeighbors: boolean;
    field?: boolean | TerrainScalarField;
    boundaryPolicy?: BoundaryPolicy;
    localRadius?: number;
  }
) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const idx = (i: number, j: number) => j * width + i;

  const boundaryPolicy: BoundaryPolicy = options.boundaryPolicy ?? 'skip';
  const values = selectValues(grid, options.field);

  const neighborOffsets =
    options.useEightNeighbors
      ? [
          [-1, -1],
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1]
        ]
      : [
          [0, -1],
          [-1, 0],
          [1, 0],
          [0, 1]
        ];

  // Cell area weighting (linear ratio space).
  const cellArea =
    grid.cellArea ??
    (() => {
      const cellWidth = new Float64Array(width);
      const cellHeight = new Float64Array(height);
      for (let i = 0; i < width; i++) {
        if (width === 1) cellWidth[i] = 0;
        else if (i === 0) cellWidth[i] = grid.xs[1] - grid.xs[0];
        else if (i === width - 1) cellWidth[i] = grid.xs[width - 1] - grid.xs[width - 2];
        else cellWidth[i] = (grid.xs[i + 1] - grid.xs[i - 1]) / 2;
      }
      for (let j = 0; j < height; j++) {
        if (height === 1) cellHeight[j] = 0;
        else if (j === 0) cellHeight[j] = grid.ys[1] - grid.ys[0];
        else if (j === height - 1) cellHeight[j] = grid.ys[height - 1] - grid.ys[height - 2];
        else cellHeight[j] = (grid.ys[j + 1] - grid.ys[j - 1]) / 2;
      }
      const area = new Float64Array(width * height);
      for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
          area[idx(i, j)] = cellWidth[i] * cellHeight[j];
        }
      }
      return area;
    })();

  const metric = selectMetricAxes(grid);

  const nearestIndex = (axisMetric: number[], t: number) => {
    const n = axisMetric.length;
    if (n === 0) return 0;
    if (n === 1) return 0;
    if (t <= axisMetric[0]) return 0;
    if (t >= axisMetric[n - 1]) return n - 1;
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (axisMetric[mid] <= t) lo = mid;
      else hi = mid;
    }
    // choose closest
    return Math.abs(axisMetric[hi] - t) < Math.abs(axisMetric[lo] - t) ? hi : lo;
  };

  const total = width * height;
  const visit = new Int32Array(total);
  let token = 1;

  const thresholdScale = Math.max(0, options.thresholdStd);
  const maxRadius = options.maxRadius > 0 ? options.maxRadius : Infinity;
  const localRadius = Math.max(1, Math.round(options.localRadius ?? 2));

  const out: MinimaPoint[] = minima.map(m => ({ ...m }));

  for (let m = 0; m < out.length; m++) {
    const pt = out[m];

    let i0 = pt.ix;
    let j0 = pt.iy;
    if (i0 === undefined || j0 === undefined) {
      const tx = metric.useLog ? Math.log(pt.x) : pt.x;
      const ty = metric.useLog ? Math.log(pt.y) : pt.y;
      i0 = nearestIndex(metric.xs, tx);
      j0 = nearestIndex(metric.ys, ty);
      pt.ix = i0;
      pt.iy = j0;
    }

    i0 = clamp(i0, 0, width - 1);
    j0 = clamp(j0, 0, height - 1);

    const startId = idx(i0, j0);
    const center = values[startId];
    if (!Number.isFinite(center)) continue;
    const baseX = metric.xs[i0];
    const baseY = metric.ys[j0];

    // Local threshold from neighborhood statistics (robust).
    const localVals: number[] = [];
    for (let dy = -localRadius; dy <= localRadius; dy++) {
      for (let dx = -localRadius; dx <= localRadius; dx++) {
        let ii = i0 + dx;
        let jj = j0 + dy;
        if (boundaryPolicy === 'mirror') {
          ii = mirrorIndex(ii, width);
          jj = mirrorIndex(jj, height);
        } else {
          if (ii < 0 || ii >= width || jj < 0 || jj >= height) continue;
        }
        const v = values[idx(ii, jj)];
        if (Number.isFinite(v)) localVals.push(v);
      }
    }

    const q90 = quantile(localVals, 0.9);
    let delta = (q90 - center) * thresholdScale;

    if (!(delta > 0)) {
      // Fallback: local standard deviation.
      let mean = 0;
      for (const v of localVals) mean += v;
      mean = localVals.length > 0 ? mean / localVals.length : center;
      let varSum = 0;
      for (const v of localVals) varSum += (v - mean) * (v - mean);
      const std = localVals.length > 1 ? Math.sqrt(varSum / (localVals.length - 1)) : 0;
      delta = std * thresholdScale;
    }

    if (!(delta > 0)) delta = 0;
    const limit = center + delta;

    if (token === 2147483640) {
      visit.fill(0);
      token = 1;
    }

    const queue: number[] = [startId];
    let head = 0;
    visit[startId] = token;

    let area = 0;
    while (head < queue.length) {
      const id = queue[head++];
      area += cellArea[id];

      const ci = id % width;
      const cj = (id / width) | 0;

      for (const [dx, dy] of neighborOffsets) {
        let ni = ci + dx;
        let nj = cj + dy;
        if (boundaryPolicy === 'mirror') {
          ni = mirrorIndex(ni, width);
          nj = mirrorIndex(nj, height);
        } else {
          if (ni < 0 || ni >= width || nj < 0 || nj >= height) continue;
        }

        if (maxRadius !== Infinity) {
          const dx = metric.xs[ni] - baseX;
          const dy = metric.ys[nj] - baseY;
          if (Math.hypot(dx, dy) > maxRadius) continue;
        }

        const nid = idx(ni, nj);
        if (visit[nid] === token) continue;
        const v = values[nid];
        if (Number.isFinite(v) && v <= limit) {
          visit[nid] = token;
          queue.push(nid);
        }
      }
    }

    pt.basinThreshold = limit;
    pt.basinArea = area;
    pt.basinRadius = area > 0 ? Math.sqrt(area / Math.PI) : 0;

    token += 1;
  }

  return out;
};

export const buildContours = (
  grid: GridData,
  levels: number[],
  field?: boolean | TerrainScalarField
) => {
  const width = grid.xs.length;
  const height = grid.ys.length;
  const values = selectValues(grid, field);

  const idx = (i: number, j: number) => j * width + i;

  const contours: { level: number; segments: { x1: number; y1: number; x2: number; y2: number }[] }[] = [];

  levels.forEach(level => {
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];

    for (let j = 0; j < height - 1; j++) {
      for (let i = 0; i < width - 1; i++) {
        const v0 = values[idx(i, j)];
        const v1 = values[idx(i + 1, j)];
        const v2 = values[idx(i + 1, j + 1)];
        const v3 = values[idx(i, j + 1)];

        let mask = 0;
        if (v0 >= level) mask |= 1;
        if (v1 >= level) mask |= 2;
        if (v2 >= level) mask |= 4;
        if (v3 >= level) mask |= 8;

        if (mask === 0 || mask === 15) continue;

        const x0 = grid.xs[i];
        const x1 = grid.xs[i + 1];
        const y0 = grid.ys[j];
        const y1 = grid.ys[j + 1];

        const interp = (a: number, b: number) => (a === b ? 0.5 : (level - a) / (b - a));
        const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t, 0, 1);

        const pTop = { x: lerp(x0, x1, interp(v0, v1)), y: y0 };
        const pRight = { x: x1, y: lerp(y0, y1, interp(v1, v2)) };
        const pBottom = { x: lerp(x0, x1, interp(v3, v2)), y: y1 };
        const pLeft = { x: x0, y: lerp(y0, y1, interp(v0, v3)) };

        const addSegment = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
          segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });

        switch (mask) {
          case 1:
          case 14:
            addSegment(pLeft, pTop);
            break;
          case 2:
          case 13:
            addSegment(pTop, pRight);
            break;
          case 3:
          case 12:
            addSegment(pLeft, pRight);
            break;
          case 4:
          case 11:
            addSegment(pRight, pBottom);
            break;
          case 5:
            addSegment(pLeft, pTop);
            addSegment(pRight, pBottom);
            break;
          case 6:
          case 9:
            addSegment(pTop, pBottom);
            break;
          case 7:
          case 8:
            addSegment(pLeft, pBottom);
            break;
          case 10:
            addSegment(pTop, pRight);
            addSegment(pLeft, pBottom);
            break;
        }
      }
    }

    contours.push({ level, segments });
  });

  return contours;
};

export const mapIntervals = (minima: MinimaPoint[], intervals: IntervalLabel[], toleranceCents: number) => {
  const mapRatio = (ratio: number) => 1200 * Math.log2(ratio);
  const intervalCents = intervals.map(i => ({ name: i.name, cents: mapRatio(i.ratio) }));
  return minima.map(m => {
    const centsX = mapRatio(m.x);
    const centsY = mapRatio(m.y);
    const closest = (cents: number) => {
      let best: IntervalLabel | null = null;
      let bestDiff = Infinity;
      intervalCents.forEach((intv, idx) => {
        const diff = Math.abs(cents - intv.cents);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = intervals[idx];
        }
      });
      return bestDiff <= toleranceCents ? best?.name : undefined;
    };
    return { ...m, labelX: closest(centsX), labelY: closest(centsY) };
  });
};

export const symmetryCheck = (
  grid: GridData,
  samples: number,
  tolerance = 1e-6,
  field?: boolean | TerrainScalarField
) => {
  const w = grid.xs.length;
  const h = grid.ys.length;
  if (w < 2 || h < 2) {
    return { passed: true, maxError: 0, averageError: 0, samples: 0 };
  }

  // Use the overlapping coordinate range so (x,y) and (y,x) are both valid samples.
  const minX = grid.xs[0];
  const maxX = grid.xs[w - 1];
  const minY = grid.ys[0];
  const maxY = grid.ys[h - 1];

  const lo = Math.max(minX, minY);
  const hi = Math.min(maxX, maxY);
  if (!(hi > lo)) {
    return { passed: true, maxError: 0, averageError: 0, samples: 0 };
  }

  const useLog = !!grid.logSampling;
  const loM = useLog ? Math.log(lo) : lo;
  const hiM = useLog ? Math.log(hi) : hi;

  const lcg = (() => {
    let seed = 123456789;
    return () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  })();

  let maxError = 0;
  let sumError = 0;
  let count = 0;

  const sampleValue = (x: number, y: number) => sampleGridValue(grid, x, y, field);

  for (let k = 0; k < samples; k++) {
    const ux = lcg();
    const uy = lcg();

    const tx = loM + ux * (hiM - loM);
    const ty = loM + uy * (hiM - loM);

    const x = useLog ? Math.exp(tx) : tx;
    const y = useLog ? Math.exp(ty) : ty;

    const vxy = sampleValue(x, y);
    const vyx = sampleValue(y, x);

    if (vxy === null || vyx === null) continue;
    if (!Number.isFinite(vxy) || !Number.isFinite(vyx)) continue;

    const denom = Math.max(1e-12, Math.abs(vxy), Math.abs(vyx));
    const err = Math.abs(vxy - vyx) / denom;

    maxError = Math.max(maxError, err);
    sumError += err;
    count += 1;
  }

  const avg = count > 0 ? sumError / count : 0;
  return { passed: maxError <= tolerance, maxError, averageError: avg, samples: count };
};

export const DEFAULT_INTERVALS: IntervalLabel[] = [
  { name: 'm3', ratio: 6 / 5 },
  { name: 'M3', ratio: 5 / 4 },
  { name: 'P4', ratio: 4 / 3 },
  { name: 'P5', ratio: 3 / 2 },
  { name: 'm6', ratio: 8 / 5 },
  { name: 'M6', ratio: 5 / 3 },
  { name: 'Octave', ratio: 2 / 1 }
];

export type RationalApprox = { num: number; den: number; error: number };

export const approximateRatioByDenominator = (
  ratio: number,
  maxDen: number,
  preferSmall: boolean
): RationalApprox => {
  const maxD = Math.max(1, Math.round(maxDen));
  let best: RationalApprox = { num: 1, den: 1, error: Infinity };
  for (let den = 1; den <= maxD; den++) {
    const num = Math.round(ratio * den);
    const approx = num / den;
    const error = Math.abs(approx - ratio) / Math.max(1e-12, ratio);
    if (error < best.error - 1e-12) {
      best = { num, den, error };
    } else if (preferSmall && Math.abs(error - best.error) < 1e-6 && den < best.den) {
      best = { num, den, error };
    }
  }
  return best;
};

export const approximateRatioContinued = (
  ratio: number,
  maxDen: number,
  maxIter: number
): RationalApprox => {
  let x = ratio;
  let a0 = Math.floor(x);
  let p0 = 1;
  let q0 = 0;
  let p1 = a0;
  let q1 = 1;
  let best: RationalApprox = { num: p1, den: q1, error: Math.abs(p1 / q1 - ratio) / Math.max(1e-12, ratio) };
  for (let iter = 0; iter < Math.max(1, maxIter); iter++) {
    const frac = x - Math.floor(x);
    if (frac === 0) break;
    x = 1 / frac;
    const a = Math.floor(x);
    const p2 = a * p1 + p0;
    const q2 = a * q1 + q0;
    if (q2 > maxDen) break;
    const error = Math.abs(p2 / q2 - ratio) / Math.max(1e-12, ratio);
    best = { num: p2, den: q2, error };
    p0 = p1;
    q0 = q1;
    p1 = p2;
    q1 = q2;
  }
  return best;
};

export const approximateRatio = (
  ratio: number,
  maxDen: number,
  preferSmall: boolean,
  method: 'denominator' | 'continued'
) => {
  if (method === 'continued') {
    return approximateRatioContinued(ratio, maxDen, 24);
  }
  return approximateRatioByDenominator(ratio, maxDen, preferSmall);
};

export const annotateMinimaWithRationals = (
  minima: MinimaPoint[],
  maxDen: number,
  preferSmall: boolean,
  method: 'denominator' | 'continued'
) => {
  return minima.map(m => {
    const rx = approximateRatio(m.x, maxDen, preferSmall, method);
    const ry = approximateRatio(m.y, maxDen, preferSmall, method);
    return {
      ...m,
      rationalX: `${rx.num}/${rx.den}`,
      rationalY: `${ry.num}/${ry.den}`,
      rationalErrorX: rx.error,
      rationalErrorY: ry.error
    };
  });
};

export const compareScaleToGrid = (
  grid: GridData,
  ratios: number[],
  field?: boolean | TerrainScalarField,
  worstCount: number
) => {
  const points = [];
  for (let i = 0; i < ratios.length; i++) {
    for (let j = i + 1; j < ratios.length; j++) {
      const x = ratios[i];
      const y = ratios[j];
      const value = sampleGridValue(grid, x, y, field, true);
      if (value === null) continue;
      points.push({ x, y, roughness: value });
    }
  }
  const sorted = points.sort((a, b) => b.roughness - a.roughness);
  const worst = sorted.slice(0, Math.max(1, worstCount)).map(p => ({
    x: p.x,
    y: p.y,
    roughness: p.roughness,
    normalized: p.roughness
  }));
  const avg = points.reduce((acc, p) => acc + p.roughness, 0) / Math.max(1, points.length);
  return {
    worst,
    count: points.length,
    maxRoughness: sorted[0]?.roughness ?? 0,
    average: avg
  };
};
