import type {
  TimbreSampleSettings,
  TimbreSampleLayer,
  TimbreSampleRegion,
  TimbreSampleReleaseMap,
  TimbreSampleLegatoTransition
} from '../types';
import { clamp, applyVelocityCurve, createRng, hashString } from './utils';

export type SamplePlaybackPlan = {
  url: string;
  gain: number;
  pan: number;
  tuneCents: number;
  rootKey?: string;
  startOffsetMs?: number;
  endTrimMs?: number;
  loopMode?: 'off' | 'forward' | 'pingpong';
  loopStart?: number;
  loopEnd?: number;
  loopXfadeMs?: number;
};

const RR_STATE = new Map<string, { index: number; lastIndex: number; counter: number }>();

const normalizeRange = (range?: [number, number]) => {
  if (!range) return [0, 1] as [number, number];
  const [a, b] = range;
  if (a > 1 || b > 1) return [clamp(a / 127, 0, 1), clamp(b / 127, 0, 1)] as [number, number];
  return [clamp(a, 0, 1), clamp(b, 0, 1)] as [number, number];
};

const inRange = (value: number, range?: [number, number]) => {
  const [min, max] = normalizeRange(range);
  return value >= min && value <= max;
};

const keyInRange = (note: number, range?: [number, number]) => {
  if (!range) return true;
  return note >= range[0] && note <= range[1];
};

const groupByRR = (regions: TimbreSampleRegion[]) => {
  const groups = new Map<string, TimbreSampleRegion[]>();
  regions.forEach((region) => {
    const group = region.roundRobinGroupId || 'default';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(region);
  });
  return groups;
};

const pickRoundRobin = (
  groupId: string,
  regions: TimbreSampleRegion[],
  mode: string,
  seed: number
) => {
  if (regions.length <= 1) return regions[0];
  const state = RR_STATE.get(groupId) || { index: 0, lastIndex: -1, counter: 0 };
  state.counter += 1;
  if (mode === 'random') {
    const rng = createRng(hashString(`${seed}|${groupId}|${state.counter}`));
    const idx = Math.floor(rng() * regions.length);
    state.lastIndex = idx;
    RR_STATE.set(groupId, state);
    return regions[idx];
  }
  if (mode === 'random-no-repeat') {
    const rng = createRng(hashString(`${seed}|${groupId}|${state.counter}`));
    let idx = Math.floor(rng() * regions.length);
    if (idx === state.lastIndex) idx = (idx + 1) % regions.length;
    state.lastIndex = idx;
    RR_STATE.set(groupId, state);
    return regions[idx];
  }
  const idx = state.index % regions.length;
  state.index = idx + 1;
  RR_STATE.set(groupId, state);
  return regions[idx];
};

const selectRegionCandidates = (layer: TimbreSampleLayer, note: number, velocity: number) => {
  return layer.regions.filter((region) => keyInRange(note, layer.keyRange) && inRange(velocity, layer.velRange));
};

const pickByVelocity = (regions: TimbreSampleRegion[], velocity: number) => {
  if (regions.length <= 1) return [{ region: regions[0], weight: 1 }];
  const sorted = [...regions].sort((a, b) => {
    const aRange = normalizeRange(a.velRange || [0, 1]);
    const bRange = normalizeRange(b.velRange || [0, 1]);
    const aMid = (aRange[0] + aRange[1]) * 0.5;
    const bMid = (bRange[0] + bRange[1]) * 0.5;
    return aMid - bMid;
  });

  for (let i = 0; i < sorted.length; i++) {
    const region = sorted[i];
    const range = normalizeRange(region.velRange || [0, 1]);
    if (!inRange(velocity, range)) continue;
    const overlap = clamp(region.overlapWidth ?? 0, 0, 1);
    if (overlap > 0 && i < sorted.length - 1) {
      const next = sorted[i + 1];
      const nextRange = normalizeRange(next.velRange || [0, 1]);
      const overlapStart = range[1] - overlap;
      const overlapEnd = nextRange[0] + overlap;
      if (velocity >= overlapStart && velocity <= overlapEnd) {
        const t = clamp((velocity - overlapStart) / Math.max(0.0001, overlapEnd - overlapStart), 0, 1);
        return [
          { region, weight: 1 - t },
          { region: next, weight: t }
        ];
      }
    }
    return [{ region, weight: 1 }];
  }
  return [{ region: sorted[sorted.length - 1], weight: 1 }];
};

export const resolveSampleLayers = (
  settings: TimbreSampleSettings,
  note: number,
  velocity: number,
  seed: number = 0
) => {
  const plans: SamplePlaybackPlan[] = [];
  const curve = settings.velocityCurve || 'linear';
  const vel = applyVelocityCurve(clamp(velocity, 0, 1), curve);
  const rrMode = settings.roundRobinMode || 'cycle';

  settings.layers.slice(0, 4).forEach((layer, layerIndex) => {
    if (!layer.regions || layer.regions.length === 0) return;
    if (!keyInRange(note, layer.keyRange)) return;
    if (!inRange(vel, layer.velRange)) return;

    const candidates = selectRegionCandidates(layer, note, vel);
    if (candidates.length === 0) return;

    const velocityPicks = pickByVelocity(candidates, vel);
    velocityPicks.forEach(({ region, weight }) => {
      let picked = region;
      if (region.roundRobinGroupId) {
        const groupId = `${region.roundRobinGroupId}|${note}`;
        const group = candidates.filter(r => r.roundRobinGroupId === region.roundRobinGroupId);
        picked = pickRoundRobin(groupId, group.length ? group : [region], rrMode, seed);
      }
      plans.push({
        url: picked.url,
        gain: weight * (layer.gain ?? 1),
        pan: layer.pan ?? 0,
        tuneCents: (layer.tuneCents ?? 0),
        rootKey: layer.rootKey,
        startOffsetMs: picked.startOffsetMs,
        endTrimMs: picked.endTrimMs,
        loopMode: picked.loopMode,
        loopStart: picked.loopStart,
        loopEnd: picked.loopEnd,
        loopXfadeMs: picked.loopXfadeMs
      });
    });
  });

  return plans;
};

export const resolveReleaseSample = (
  releaseMaps: TimbreSampleReleaseMap[] | undefined,
  note: number,
  velocity: number
) => {
  if (!releaseMaps || releaseMaps.length === 0) return null;
  const vel = clamp(velocity, 0, 1);
  const candidate = releaseMaps.find((map) => keyInRange(note, map.keyRange) && inRange(vel, map.velRange));
  return candidate?.region || null;
};

export const resolveLegatoTransition = (
  transitions: TimbreSampleLegatoTransition[] | undefined,
  fromNote: number,
  toNote: number
) => {
  if (!transitions || transitions.length === 0) return null;
  const interval = Math.abs(toNote - fromNote);
  const intervalClass = interval <= 1 ? 'semitone' : interval <= 2 ? 'whole' : 'leap';
  return transitions.find((t) => {
    if (t.intervalClass && t.intervalClass !== intervalClass) return false;
    if (t.fromKeyRange && !keyInRange(fromNote, t.fromKeyRange)) return false;
    if (t.toKeyRange && !keyInRange(toNote, t.toKeyRange)) return false;
    return true;
  })?.region || null;
};
