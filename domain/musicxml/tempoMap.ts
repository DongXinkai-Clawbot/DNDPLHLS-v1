import type { MusicXmlTempoEvent } from './types';

export type TempoSegment = {
  startTick: number;
  endTick: number;
  microsecondsPerQuarter: number;
  secondsAtStart: number;
  secondsPerTick: number;
};

const DEFAULT_MICROSECONDS_PER_QUARTER = 500000; // 120 BPM

/**
 * Builds a piecewise-linear tick->seconds map from MusicXML tempo events.
 *
 * - MusicXML tempo is expressed in beats per minute. For score-partwise, it is usually quarter-note BPM.
 * - We treat "per-minute" and <sound tempo="..."> as quarter-note BPM.
 */
export const buildTempoMap = (
  tempoEvents: MusicXmlTempoEvent[],
  ticksPerQuarter: number,
  speed: number = 1
): TempoSegment[] => {
  const tpq = Math.max(1, Math.floor(ticksPerQuarter || 480));
  const s = Number.isFinite(speed) ? Math.max(0.01, speed) : 1;

  const sorted = [...(tempoEvents || [])]
    .filter((e) => Number.isFinite(e.tick) && e.tick >= 0)
    .sort((a, b) => a.tick - b.tick);

  const normalized: MusicXmlTempoEvent[] = [];
  // Ensure tick 0 exists.
  if (!sorted.length || sorted[0].tick !== 0) {
    normalized.push({ tick: 0, bpm: 120, microsecondsPerQuarter: DEFAULT_MICROSECONDS_PER_QUARTER });
  }
  sorted.forEach((e) => {
    if (normalized.length && normalized[normalized.length - 1].tick === e.tick) return;
    const us = Number.isFinite(e.microsecondsPerQuarter) && e.microsecondsPerQuarter > 0
      ? e.microsecondsPerQuarter
      : DEFAULT_MICROSECONDS_PER_QUARTER;
    normalized.push({ tick: Math.floor(e.tick), bpm: e.bpm, microsecondsPerQuarter: us });
  });

  let secondsAtStart = 0;
  const segments: TempoSegment[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const cur = normalized[i];
    const next = normalized[i + 1];
    const startTick = Math.max(0, Math.floor(cur.tick));
    const endTick = next ? Math.max(startTick, Math.floor(next.tick)) : Number.POSITIVE_INFINITY;
    const microsecondsPerQuarter = cur.microsecondsPerQuarter || DEFAULT_MICROSECONDS_PER_QUARTER;
    const secondsPerTick = (microsecondsPerQuarter / 1000000) / tpq / s;

    segments.push({ startTick, endTick, microsecondsPerQuarter, secondsAtStart, secondsPerTick });

    if (Number.isFinite(endTick)) {
      const deltaTicks = endTick - startTick;
      secondsAtStart += deltaTicks * secondsPerTick;
    }
  }
  return segments;
};

export const tickToSeconds = (segments: TempoSegment[], tick: number): number => {
  if (!segments.length) return 0;
  const t = Math.max(0, tick || 0);
  // Linear scan is fine; tempo event counts are small.
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (t >= seg.startTick) {
      return seg.secondsAtStart + (t - seg.startTick) * seg.secondsPerTick;
    }
  }
  const first = segments[0];
  return first.secondsAtStart + (t - first.startTick) * first.secondsPerTick;
};

export const secondsToTick = (segments: TempoSegment[], seconds: number): number => {
  if (!segments.length) return 0;
  const s = Math.max(0, seconds || 0);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    const segEndSeconds = Number.isFinite(seg.endTick)
      ? seg.secondsAtStart + (seg.endTick - seg.startTick) * seg.secondsPerTick
      : Number.POSITIVE_INFINITY;
    if (s >= seg.secondsAtStart && s < segEndSeconds) {
      return seg.startTick + (s - seg.secondsAtStart) / seg.secondsPerTick;
    }
  }
  const first = segments[0];
  return first.startTick + (s - first.secondsAtStart) / first.secondsPerTick;
};
