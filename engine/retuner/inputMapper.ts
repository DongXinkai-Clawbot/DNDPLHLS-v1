import type { NodeData } from '../../types';
import type { BaseTuningSettings, MappingMode, MappingTableEntry } from '../../domain/retuner/types';
import { parseGeneralRatio } from '../../musicLogic';

export interface MappingResult {
  targetHz: number;
  mode: MappingMode;
  nodeId?: string;
  degreeIndex?: number;
  distanceCents?: number;
  fallback?: boolean;
  label?: string;
}

export interface MapperOptions {
  mode: MappingMode;
  baseTuning: BaseTuningSettings;
  scale: string[];
  latticeNodes: NodeData[];
  mappingTable: MappingTableEntry[];
  adaptiveCache?: Map<string, MappingResult>;
}

const midiNoteToHz = (note: number, base: BaseTuningSettings): number => {
  return base.a4Hz * Math.pow(2, (note - 69) / 12);
};

const ratioToFloat = (ratio: string): number | null => {
  try {
    const frac = parseGeneralRatio(ratio);
    if (!frac || frac.d === 0n) return null;
    return Number(frac.n) / Number(frac.d);
  } catch {
    return null;
  }
};

const normalizeCents = (cents: number): number => {
  return ((cents % 1200) + 1200) % 1200;
};

const centsFromHz = (hz: number, baseHz: number): number => {
  if (!(hz > 0) || !(baseHz > 0)) return 0;
  return 1200 * Math.log2(hz / baseHz);
};

const buildLatticeIndex = (nodes: NodeData[]): Array<{ cents: number; node: NodeData }> => {
  const entries = nodes.map((node) => ({
    cents: normalizeCents(node.cents ?? 0),
    node,
  }));
  entries.sort((a, b) => a.cents - b.cents);
  return entries;
};

const findNearestNode = (entries: Array<{ cents: number; node: NodeData }>, targetCents: number): { node: NodeData; distance: number } | null => {
  if (entries.length === 0) return null;
  let lo = 0;
  let hi = entries.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (entries[mid].cents < targetCents) lo = mid;
    else hi = mid;
  }
  const cand = [entries[lo], entries[hi]];
  let best = cand[0];
  let bestDist = Math.abs(targetCents - cand[0].cents);
  for (const c of cand) {
    const d = Math.abs(targetCents - c.cents);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  // Also consider wrap-around
  const wrapLow = entries[0];
  const wrapHigh = entries[entries.length - 1];
  const wrapDistLow = Math.abs(targetCents + 1200 - wrapHigh.cents);
  const wrapDistHigh = Math.abs(wrapLow.cents + 1200 - targetCents);
  if (wrapDistLow < bestDist) {
    best = wrapHigh;
    bestDist = wrapDistLow;
  }
  if (wrapDistHigh < bestDist) {
    best = wrapLow;
    bestDist = wrapDistHigh;
  }
  return { node: best.node, distance: bestDist };
};

export const mapExternalNote = (
  inputNote: number,
  opts: MapperOptions
): MappingResult | null => {
  const baseHz = midiNoteToHz(opts.baseTuning.rootNote, opts.baseTuning);
  const inputHz = midiNoteToHz(inputNote, opts.baseTuning);
  const inputCents = centsFromHz(inputHz, baseHz);
  const normCents = normalizeCents(inputCents);

  if (opts.mode === 'table') {
    const match = opts.mappingTable.find((m) => m.midiNote === inputNote);
    if (match) {
      if (match.hz && match.hz > 0) {
        return { targetHz: match.hz, mode: 'table', label: match.label };
      }
      if (match.ratio) {
        const r = ratioToFloat(match.ratio);
        if (r && r > 0) {
          return { targetHz: baseHz * r, mode: 'table', label: match.label };
        }
      }
    }
    return null;
  }

  if (opts.mode === 'scale') {
    const scale = opts.scale || [];
    if (scale.length === 0) {
      return { targetHz: inputHz, mode: 'scale', fallback: true };
    }
    const degree = ((inputNote - opts.baseTuning.rootNote) % scale.length + scale.length) % scale.length;
    const octaveShift = Math.floor((inputNote - opts.baseTuning.rootNote) / scale.length);
    const ratioStr = scale[degree];
    const ratioFloat = ratioToFloat(ratioStr);
    if (!ratioFloat || !(ratioFloat > 0)) {
      return { targetHz: inputHz, mode: 'scale', fallback: true };
    }
    const targetHz = baseHz * ratioFloat * Math.pow(2, octaveShift);
    return { targetHz, mode: 'scale', degreeIndex: degree, label: ratioStr };
  }

  if (opts.mode === 'adaptive' && opts.adaptiveCache) {
    const key = `${inputNote}`;
    const cached = opts.adaptiveCache.get(key);
    if (cached) {
      return cached;
    }
  }

  const latticeIndex = buildLatticeIndex(opts.latticeNodes || []);
  const nearest = findNearestNode(latticeIndex, normCents);
  if (!nearest) {
    return { targetHz: inputHz, mode: opts.mode, fallback: true };
  }

  const ratioFloat = nearest.node.ratioFloat ?? (nearest.node.ratio ? Number(nearest.node.ratio.n) / Number(nearest.node.ratio.d) : 1);
  const octaveShift = Math.floor(inputCents / 1200);
  const targetHz = baseHz * ratioFloat * Math.pow(2, octaveShift);

  const result: MappingResult = {
    targetHz,
    mode: opts.mode,
    nodeId: nearest.node.id,
    distanceCents: nearest.distance,
    label: nearest.node.name,
  };

  if (opts.mode === 'adaptive' && opts.adaptiveCache) {
    opts.adaptiveCache.set(`${inputNote}`, result);
  }

  return result;
};
