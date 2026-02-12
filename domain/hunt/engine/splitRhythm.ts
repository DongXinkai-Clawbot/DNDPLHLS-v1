import type { HuntEvent, HuntMeasure, HuntNoteEvent, HuntRestEvent } from './types';
import type { HuntEngineConfig } from './types';
import { HuntLogger } from './logger';
import { findSplitPoints } from './beatGrid';

const NOTE_TYPES = [
  { type: 'whole', beats: 4 },
  { type: 'half', beats: 2 },
  { type: 'quarter', beats: 1 },
  { type: 'eighth', beats: 0.5 },
  { type: '16th', beats: 0.25 },
  { type: '32nd', beats: 0.125 },
  { type: '64th', beats: 0.0625 }
];

const durationToNoteValue = (durationTicks: number, ticksPerQuarter: number) => {
  const epsilon = 0.001;
  for (const base of NOTE_TYPES) {
    const baseTicks = base.beats * ticksPerQuarter;
    for (let dots = 0; dots <= 2; dots += 1) {
      const dotFactor = dots === 0 ? 1 : dots === 1 ? 1.5 : 1.75;
      const target = baseTicks * dotFactor;
      if (Math.abs(durationTicks - target) <= epsilon) {
        return { noteType: base.type, dots };
      }
    }
  }
  return { noteType: 'custom', dots: 0 };
};

const cloneSegment = (
  event: HuntEvent,
  startTick: number,
  endTick: number,
  segmentIndex: number,
  totalSegments: number,
  ticksPerQuarter: number
): HuntEvent => {
  const durationTicks = Math.max(0, endTick - startTick);
  const suffix = totalSegments > 1 ? `-s${segmentIndex + 1}` : '';
  if (event.kind === 'rest') {
    const rest = event as HuntRestEvent;
    const value = durationToNoteValue(durationTicks, ticksPerQuarter);
    return {
      ...rest,
      id: `${event.id}${suffix}`,
      startTick,
      durationTicks,
      endTick,
      restType: totalSegments > 1 ? value.noteType : (rest.restType || value.noteType),
      noteType: totalSegments > 1 ? value.noteType : (rest.noteType || value.noteType),
      dots: totalSegments > 1 ? value.dots : (rest.dots ?? value.dots)
    } as HuntRestEvent;
  }

  const note = event as HuntNoteEvent;
  const value = durationToNoteValue(durationTicks, ticksPerQuarter);
  const hasSplit = totalSegments > 1;
  const isFirst = segmentIndex === 0;
  const isLast = segmentIndex === totalSegments - 1;

  return {
    ...note,
    id: `${event.id}${suffix}`,
    startTick,
    durationTicks,
    endTick,
    tieStop: hasSplit ? (isFirst ? note.tieStop : true) : note.tieStop,
    tieStart: hasSplit ? (isLast ? note.tieStart : true) : note.tieStart,
    noteType: hasSplit ? value.noteType : (note.noteType || value.noteType),
    dots: hasSplit ? value.dots : (note.dots ?? value.dots)
  } as HuntNoteEvent;
};

export const splitMeasureEvents = (
  measure: HuntMeasure,
  config: HuntEngineConfig,
  logger: HuntLogger
): HuntEvent[] => {
  const result: HuntEvent[] = [];
  const ticksPerQuarter = Math.max(1, Math.floor(config.ticksPerQuarter ?? 480));

  measure.events.forEach((event) => {
    if (event.kind === 'control') {
      result.push(event);
      return;
    }
    const isFullMeasure =
      event.startTick === measure.startTick &&
      event.endTick === measure.endTick &&
      event.durationTicks >= measure.endTick - measure.startTick;
    if (isFullMeasure) {
      result.push(event);
      return;
    }
    const splitPoints = findSplitPoints(measure.beatGrid, event.startTick, event.endTick);
    const startsOnStrong = measure.beatGrid.strongBoundaries.includes(event.startTick);
    const effectiveSplitPoints = startsOnStrong
      ? splitPoints.filter((t) => measure.beatGrid.strongBoundaries.includes(t))
      : splitPoints;
    if (!effectiveSplitPoints.length) {
      result.push(event);
      return;
    }

    if (event.tuplet) {
      logger.debug('Tuplet event split by beat grid.', {
        measureIndex: event.measureIndex,
        tick: event.startTick,
        objectId: event.id
      });
    }

    const boundaries = [event.startTick, ...effectiveSplitPoints, event.endTick];
    const totalSegments = boundaries.length - 1;
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const segStart = boundaries[i];
      const segEnd = boundaries[i + 1];
      const seg = cloneSegment(event, segStart, segEnd, i, totalSegments, ticksPerQuarter);
      // normalize noteType/dots if missing
      if (seg.kind === 'note' && (!seg.noteType || seg.noteType === 'custom')) {
        const value = durationToNoteValue(seg.durationTicks, ticksPerQuarter);
        (seg as HuntNoteEvent).noteType = value.noteType;
        (seg as HuntNoteEvent).dots = value.dots;
      }
      if (seg.kind === 'rest' && (!seg.noteType || seg.noteType === 'custom')) {
        const value = durationToNoteValue(seg.durationTicks, ticksPerQuarter);
        (seg as HuntRestEvent).noteType = value.noteType;
        (seg as HuntRestEvent).dots = value.dots;
        (seg as HuntRestEvent).restType = value.noteType;
      }
      result.push(seg);
    }
  });

  return result;
};

export const splitScoreByGrid = (
  measures: HuntMeasure[],
  config: HuntEngineConfig,
  logger: HuntLogger
): HuntMeasure[] => {
  return measures.map((measure) => {
    const events = splitMeasureEvents(measure, config, logger);
    return { ...measure, events };
  });
};
