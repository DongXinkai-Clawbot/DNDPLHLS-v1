import type { HuntBeatGrid } from './types';
import { uniqSorted } from './utils';

export const isCompoundMeter = (numerator: number, denominator: number) => {
  return denominator >= 8 && numerator % 3 === 0 && numerator >= 6;
};

export const buildBeatGrid = (
  measureIndex: number,
  startTick: number,
  endTick: number,
  ticksPerQuarter: number,
  numerator: number,
  denominator: number
): HuntBeatGrid => {
  const ticksPerBeat = (ticksPerQuarter * 4) / Math.max(1, denominator);
  const beatCount = Math.max(1, Math.floor(numerator));
  const isCompound = isCompoundMeter(numerator, denominator);
  const beatBoundaries: number[] = [];
  for (let i = 0; i <= beatCount; i += 1) {
    beatBoundaries.push(startTick + i * ticksPerBeat);
  }

  const strongBoundaries: number[] = [startTick];
  const secondaryBoundaries: number[] = [];
  const allowedGroups: Array<{ start: number; end: number; level: number }> = [];

  if (isCompound) {
    const groupSize = 3;
    for (let i = 0; i < beatCount; i += groupSize) {
      const groupStart = startTick + i * ticksPerBeat;
      const groupEnd = startTick + Math.min(beatCount, i + groupSize) * ticksPerBeat;
      strongBoundaries.push(groupStart);
      allowedGroups.push({ start: groupStart, end: groupEnd, level: 1 });
    }
  } else {
    if (beatCount >= 4 && beatCount % 2 === 0) {
      const mid = startTick + (beatCount / 2) * ticksPerBeat;
      strongBoundaries.push(mid);
    }
    for (let i = 0; i < beatCount; i += 1) {
      const bStart = startTick + i * ticksPerBeat;
      const bEnd = startTick + (i + 1) * ticksPerBeat;
      if (i > 0) secondaryBoundaries.push(bStart);
      allowedGroups.push({ start: bStart, end: bEnd, level: 1 });
    }
  }

  const forbiddenBoundaries = uniqSorted(
    beatBoundaries
      .slice(1, -1)
      .filter((t) => t > startTick && t < endTick)
  );

  return {
    measureIndex,
    startTick,
    endTick,
    ticksPerBeat,
    beatCount,
    isCompound,
    strongBoundaries: uniqSorted(strongBoundaries.filter((t) => t >= startTick && t <= endTick)),
    secondaryBoundaries: uniqSorted(secondaryBoundaries.filter((t) => t >= startTick && t <= endTick)),
    beatBoundaries: uniqSorted(beatBoundaries.filter((t) => t >= startTick && t <= endTick)),
    forbiddenBoundaries,
    allowedGroups
  };
};

export const findSplitPoints = (grid: HuntBeatGrid, startTick: number, endTick: number) => {
  const points = grid.forbiddenBoundaries.filter((t) => t > startTick && t < endTick);
  return uniqSorted(points);
};
