import type { MusicXmlImportResult } from '../../musicxml/types';
import { voiceKeyForMusicXmlEvent } from '../../musicxml/types';
import type {
  HuntEngineConfig,
  HuntLogicalScore,
  HuntEvent,
  HuntNoteEvent,
  HuntRestEvent,
  HuntControlEvent,
  HuntMeasure
} from './types';
import { HuntLogger } from './logger';
import { buildBeatGrid } from './beatGrid';
import { stableSort } from './utils';

const defaultTimeSignature = { numerator: 4, denominator: 4 };

export const buildLogicalScore = (
  importResult: MusicXmlImportResult,
  config: HuntEngineConfig,
  logger: HuntLogger
): HuntLogicalScore => {
  const ticksPerQuarter = Math.max(1, Math.floor(config.ticksPerQuarter ?? importResult.ticksPerQuarter ?? 480));

  const partMap = new Map<string, { name: string; staffMap: Map<number, Map<string, HuntEvent[]>>; staffLines: Map<number, number | undefined> }>();

  const timeSigs = [...importResult.timeSignatureEvents].sort((a, b) => a.tick - b.tick);
  const timeSigByMeasure = new Map<number, { numerator: number; denominator: number }>();
  let currentTimeSig = timeSigs.length ? { numerator: timeSigs[0].numerator, denominator: timeSigs[0].denominator } : null;

  if (!currentTimeSig) {
    logger.error('Missing time signature in first measure; defaulting to 4/4.');
    currentTimeSig = { ...defaultTimeSignature };
  }

  // Build measure boundaries
  const measureStartTicks = [...(importResult.measureStartTicks || [])].sort((a, b) => a - b);
  if (measureStartTicks[0] !== 0) measureStartTicks.unshift(0);

  const measures: HuntMeasure[] = [];
  for (let i = 0; i < measureStartTicks.length; i += 1) {
    const startTick = measureStartTicks[i];
    const nextTick = i + 1 < measureStartTicks.length ? measureStartTicks[i + 1] : importResult.totalTicks;
    const tsEvent = timeSigs.find((ts) => ts.tick === startTick);
    if (tsEvent) {
      currentTimeSig = { numerator: tsEvent.numerator, denominator: tsEvent.denominator };
    }
    const timeSignature = currentTimeSig || { ...defaultTimeSignature };
    const endTick = Math.max(startTick, nextTick);
    const beatGrid = buildBeatGrid(i, startTick, endTick, ticksPerQuarter, timeSignature.numerator, timeSignature.denominator);
    measures.push({
      index: i,
      startTick,
      endTick,
      timeSignature,
      beatGrid,
      events: []
    });
    timeSigByMeasure.set(i, timeSignature);
  }

  // index for staff line overrides
  const staffLinesByStaff = new Map<string, number>();
  importResult.measureMeta?.forEach((meta) => {
    if (meta.staffLines) {
      Object.entries(meta.staffLines).forEach(([staffKey, lines]) => {
        const key = `${meta.partId}|${staffKey}`;
        if (!staffLinesByStaff.has(key)) {
          staffLinesByStaff.set(key, lines);
        }
      });
    }
    if (!meta.divisions || meta.divisions <= 0) {
      logger.error('Missing divisions in measure.', { measureIndex: meta.measureIndex, objectId: meta.partId });
    }
  });

  const controlEvents: HuntControlEvent[] = timeSigs.map((ts, idx) => ({
    id: `ctrl-ts-${idx}-${ts.tick}`,
    kind: 'control',
    controlType: 'timeSignature',
    partId: '__global__',
    staffIndex: 1,
    voiceId: '__global__',
    measureIndex: measures.findIndex((m) => m.startTick === ts.tick),
    startTick: ts.tick,
    durationTicks: 0,
    endTick: ts.tick,
    payload: { numerator: ts.numerator, denominator: ts.denominator }
  }));

  controlEvents.forEach((ev) => {
    if (ev.measureIndex >= 0 && measures[ev.measureIndex]) {
      measures[ev.measureIndex].events.push(ev);
    }
  });

  importResult.events.forEach((ev) => {
    const partId = ev.partId;
    const partName = ev.partName || ev.partId || 'Part';
    const staffIndex = Math.max(1, ev.staff || 1);
    const voiceId = voiceKeyForMusicXmlEvent(ev);
    const measureIndex = Number.isFinite(ev.measureIndex) ? ev.measureIndex : 0;

    if (!partMap.has(partId)) {
      partMap.set(partId, {
        name: partName,
        staffMap: new Map(),
        staffLines: new Map()
      });
    }

    const part = partMap.get(partId)!;
    if (!part.staffMap.has(staffIndex)) {
      part.staffMap.set(staffIndex, new Map());
    }
    const staffVoices = part.staffMap.get(staffIndex)!;
    if (!staffVoices.has(voiceId)) {
      staffVoices.set(voiceId, []);
    }

    const base = {
      id: ev.id,
      partId,
      staffIndex,
      voiceId,
      measureIndex,
      startTick: ev.startTick,
      durationTicks: ev.durationTicks,
      endTick: ev.endTick,
      chordMember: ev.chordMember,
      noteType: ev.noteType,
      dots: ev.dots,
      timeModification: ev.timeModification,
      tuplet: ev.tuplet,
      sourceId: ev.id
    };

    let event: HuntEvent;
    if (ev.isRest) {
      event = {
        ...base,
        kind: 'rest',
        restFullMeasure: ev.restFullMeasure
      } as HuntRestEvent;
    } else {
      event = {
        ...base,
        kind: 'note',
        pitch: ev.pitch,
        midiNote: ev.midiNote,
        tieStart: ev.tieStart,
        tieStop: ev.tieStop,
        beams: ev.beams
      } as HuntNoteEvent;
    }

    staffVoices.get(voiceId)!.push(event);
    const measure = measures[measureIndex];
    if (measure) measure.events.push(event);
  });

  measures.forEach((measure) => {
    measure.events = stableSort(measure.events, (a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id));
  });

  const parts = Array.from(partMap.entries()).map(([partId, part]) => {
    const staves = Array.from(part.staffMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([staffIndex, voiceMap]) => {
        const voices = Array.from(voiceMap.entries()).map(([voiceId, events], voiceIndex) => ({
          id: voiceId,
          voiceIndex,
          events: stableSort(events, (a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id))
        }));

        const staffLinesKey = `${partId}|${staffIndex}`;
        const staffLines = staffLinesByStaff.get(staffLinesKey);

        return {
          id: `${partId}-staff-${staffIndex}`,
          staffIndex,
          voices,
          staffLines
        };
      });

    return { id: partId, name: part.name, staves };
  });

  return {
    title: importResult.title,
    ticksPerQuarter,
    totalTicks: importResult.totalTicks,
    parts,
    measures,
    tempoEvents: importResult.tempoEvents,
    timeSignatures: importResult.timeSignatureEvents,
    ignoredElements: importResult.ignoredElements || []
  };
};
