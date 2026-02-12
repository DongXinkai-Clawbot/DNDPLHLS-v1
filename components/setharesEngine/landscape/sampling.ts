import { SamplingConfig } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const buildAxis = (min: number, max: number, steps: number, logSampling: boolean) => {
  const safeSteps = Math.max(2, Math.round(steps));
  const values: number[] = [];
  const logIndex: number[] = [];
  const lo = Math.max(1e-6, min);
  const hi = Math.max(lo + 1e-6, max);
  if (logSampling) {
    const logMin = Math.log(lo);
    const logMax = Math.log(hi);
    for (let i = 0; i < safeSteps; i++) {
      const t = i / (safeSteps - 1);
      const v = Math.exp(logMin + (logMax - logMin) * t);
      values.push(v);
      logIndex.push(Math.log(v));
    }
  } else {
    for (let i = 0; i < safeSteps; i++) {
      const t = i / (safeSteps - 1);
      const v = lo + (hi - lo) * t;
      values.push(v);
      logIndex.push(Math.log(Math.max(1e-6, v)));
    }
  }
  return { values, logIndex };
};

const uniqueSorted = (values: number[]) => {
  const sorted = [...values].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const unique: number[] = [];
  sorted.forEach(v => {
    const last = unique[unique.length - 1];
    if (!last || Math.abs(last - v) > 1e-6) unique.push(v);
  });
  return unique;
};

const bandToRatio = (cents: number) => Math.pow(2, cents / 1200);

export const refineAxisFixed = (axis: number[], targets: number[], bandCents: number, density: number) => {
  if (targets.length === 0) return axis;
  const ratioBand = bandToRatio(Math.max(0.1, bandCents));
  const extra: number[] = [];
  const safeDensity = clamp(Math.round(density), 1, 12);
  targets.forEach(target => {
    const lower = target / ratioBand;
    const upper = target * ratioBand;
    for (let i = 0; i <= safeDensity; i++) {
      const t = i / safeDensity;
      const v = lower * Math.pow(upper / lower, t);
      extra.push(v);
    }
  });
  return uniqueSorted([...axis, ...extra]);
};

export const refineAxisMidpoints = (axis: number[], indices: Set<number>) => {
  const extra: number[] = [];
  for (let i = 0; i < axis.length - 1; i++) {
    if (!indices.has(i)) continue;
    const mid = Math.sqrt(axis[i] * axis[i + 1]);
    extra.push(mid);
  }
  return uniqueSorted([...axis, ...extra]);
};

export const buildSamplingAxes = (cfg: SamplingConfig) => {
  const xBase = buildAxis(cfg.xRange[0], cfg.xRange[1], cfg.xSteps, cfg.logSampling);
  const yBase = buildAxis(cfg.yRange[0], cfg.yRange[1], cfg.ySteps, cfg.logSampling);
  return { xBase, yBase };
};
