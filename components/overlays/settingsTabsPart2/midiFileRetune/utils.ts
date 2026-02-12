import { getPitchClassDistance, parseGeneralRatio } from '../../../../musicLogic';
import type { NodeData } from '../../../../types';

export type LayoutScale = {
    scale: string[];
    nodeIdByScaleIndex: (string | null)[];
    ratioValues: number[];
    centsValues: number[];
};

export const buildOutputName = (name: string) => {
    if (!name) return 'retuned.mid';
    const idx = name.lastIndexOf('.');
    const base = idx > 0 ? name.slice(0, idx) : name;
    return `${base}_retuned.mid`;
};

const normalizeRatioValue = (value: number) => {
  let v = value;
  if (!Number.isFinite(v) || v <= 0) return 1;
  while (v >= 2) v /= 2;
  while (v < 1) v *= 2;
  return v;
};

const formatRatioValue = (value: number) => {
    const v = normalizeRatioValue(value);
    if (Math.abs(v - 1) < 1e-12) return '1/1';
    return v.toFixed(6).replace(/\.?0+$/, '');
};

const ratioToValue = (ratio: string) => {
  try {
    const frac = parseGeneralRatio(ratio);
    const value = Number(frac.n) / Number(frac.d);
    if (!Number.isFinite(value) || value <= 0) return 1;
    return normalizeRatioValue(value);
  } catch {
    return 1;
  }
};

const buildCustomScale = (ratios: string[], idPrefix: string): LayoutScale => {
  const entries = new Map<string, { cents: number; ratioValue: number; ratioStr: string; nodeId: string; idx: number }>();
  ratios.forEach((ratio, idx) => {
    try {
      const frac = parseGeneralRatio(ratio);
      const rawValue = Number(frac.n) / Number(frac.d);
      if (!Number.isFinite(rawValue) || rawValue <= 0) return;
      const ratioValue = normalizeRatioValue(rawValue);
      const cents = 1200 * Math.log2(ratioValue);
      const key = cents.toFixed(6);
      const ratioStr = ratio.toString();
      const existing = entries.get(key);
      if (!existing || idx < existing.idx) {
        entries.set(key, { cents, ratioValue, ratioStr, nodeId: `${idPrefix}-${idx + 1}`, idx });
      }
    } catch {
      return;
    }
  });
  const sorted = Array.from(entries.values()).sort((a, b) => a.cents - b.cents);
  return {
    scale: sorted.map((item) => item.ratioStr),
    nodeIdByScaleIndex: sorted.map((item) => item.nodeId),
    ratioValues: sorted.map((item) => item.ratioValue),
    centsValues: sorted.map((item) => item.cents)
  };
};

export const buildNodeScale = (nodes: NodeData[]): LayoutScale => {
    const entries = new Map<string, { cents: number; ratioValue: number; ratioStr: string; nodeId: string; gen: number }>();
    nodes.forEach((node) => {
        const cents = ((node.cents % 1200) + 1200) % 1200;
        const ratioValue = normalizeRatioValue(Math.pow(2, cents / 1200));
        if (!Number.isFinite(ratioValue) || ratioValue <= 0) return;
        const key = cents.toFixed(6);
        const ratioStr = formatRatioValue(ratioValue);
        const existing = entries.get(key);
        if (!existing || node.gen < existing.gen) {
            entries.set(key, { cents, ratioValue, ratioStr, nodeId: node.id, gen: node.gen });
        }
    });
    const sorted = Array.from(entries.values()).sort((a, b) => a.cents - b.cents);
    return {
        scale: sorted.map((item) => item.ratioStr),
        nodeIdByScaleIndex: sorted.map((item) => item.nodeId),
        ratioValues: sorted.map((item) => item.ratioValue),
        centsValues: sorted.map((item) => item.cents)
    };
};

export const buildHChromaScale = (baseA: number, limit: number, overrideScale?: string[]): LayoutScale => {
  if (overrideScale && overrideScale.length > 0) {
    return buildCustomScale(overrideScale, 'hchroma-custom');
  }
  const entries = new Map<string, { cents: number; ratioValue: number; ratioStr: string; nodeId: string; harmonic: number }>();
  if (!Number.isFinite(baseA) || baseA <= 1) {
    return { scale: [], nodeIdByScaleIndex: [], ratioValues: [], centsValues: [] };
  }
    const lnA = Math.log(baseA);
    const count = Math.max(1, Math.floor(limit));
    for (let n = 1; n <= count; n++) {
        const turns = Math.log(n) / lnA;
        let frac = turns - Math.floor(turns);
        if (frac < 0) frac += 1;
        const ratioValue = normalizeRatioValue(Math.pow(baseA, frac));
        const cents = 1200 * Math.log2(ratioValue);
        const key = cents.toFixed(6);
        const ratioStr = formatRatioValue(ratioValue);
        const existing = entries.get(key);
        if (!existing || n < existing.harmonic) {
            entries.set(key, { cents, ratioValue, ratioStr, nodeId: `hchroma-${n}`, harmonic: n });
        }
    }
    const sorted = Array.from(entries.values()).sort((a, b) => a.cents - b.cents);
    return {
        scale: sorted.map((item) => item.ratioStr),
        nodeIdByScaleIndex: sorted.map((item) => item.nodeId),
        ratioValues: sorted.map((item) => item.ratioValue),
        centsValues: sorted.map((item) => item.cents)
    };
};

export const snapScaleToLayout = (baseScale: string[], layout: LayoutScale) => {
    if (!layout.scale.length) {
        return { scale: baseScale, nodeIdByScaleIndex: baseScale.map(() => null) };
    }
    const snappedScale: string[] = [];
    const nodeIdByScaleIndex: (string | null)[] = [];
    baseScale.forEach((ratio) => {
        const ratioValue = ratioToValue(ratio);
        const cents = 1200 * Math.log2(ratioValue);
        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < layout.centsValues.length; i++) {
            const dist = getPitchClassDistance(cents, layout.centsValues[i]);
            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = i;
            }
        }
        snappedScale.push(layout.scale[bestIndex]);
        nodeIdByScaleIndex.push(layout.nodeIdByScaleIndex[bestIndex] ?? null);
    });
    return { scale: snappedScale, nodeIdByScaleIndex };
};
