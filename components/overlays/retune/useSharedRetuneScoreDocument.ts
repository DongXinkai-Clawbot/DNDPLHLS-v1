import { useEffect, useState } from 'react';
import { buildScoreFromMidi } from '../../../domain/scoreTimeline/buildFromMidi';
import type { ScoreDocument } from '../../../domain/scoreTimeline/types';
import type { MidiImportResult, MidiNoteInfo } from '../../../utils/midiFileRetune';
import { parseGeneralRatio } from '../../../musicLogic';

type SharedScoreKeyInput = {
  importResult: MidiImportResult | null | undefined;
  targetMode?: string | null;
  scale: string[];
  nodeIdByScaleIndex: (string | null)[];
  baseNote: number;
  previewSpeed: number;
};

type ScoreEventIndex = Map<string, { voiceIndex: number; eventIndex: number }>;

type SharedScoreCache = {
  key: string | null;
  scoreDoc: ScoreDocument | null;
  eventIndex: ScoreEventIndex;
  noteIndex: Map<string, MidiNoteInfo>;
  version: number;
};

const sharedCache: SharedScoreCache = {
  key: null,
  scoreDoc: null,
  eventIndex: new Map(),
  noteIndex: new Map(),
  version: 0
};

const buildCacheKey = (input: SharedScoreKeyInput) => {
  const name = input.importResult?.fileName ?? 'unknown';
  const notes = input.importResult?.notes?.length ?? 0;
  const ticks = input.importResult?.totalTicks ?? 0;
  const scaleKey = input.scale?.length ? input.scale.join('|') : '1/1';
  const nodeKey = input.nodeIdByScaleIndex?.length ? input.nodeIdByScaleIndex.join('|') : '';
  return [name, notes, ticks, input.targetMode ?? 'custom', input.baseNote, input.previewSpeed.toFixed(4), scaleKey, nodeKey].join('::');
};

const buildMidiEventId = (note: MidiNoteInfo) => {
  if (note.id) return note.id;
  const track = Number.isFinite(note.trackIndex) ? note.trackIndex : 0;
  return `track-${track}-${note.startTick}-${note.noteNumber}`;
};

const buildNoteIndex = (importResult: MidiImportResult) => {
  const map = new Map<string, MidiNoteInfo>();
  importResult.notes?.forEach((note) => {
    map.set(buildMidiEventId(note), note);
  });
  return map;
};

const buildEventIndex = (doc: ScoreDocument) => {
  const index = new Map<string, { voiceIndex: number; eventIndex: number }>();
  doc.voices.forEach((voice, voiceIndex) => {
    voice.events.forEach((event, eventIndex) => {
      index.set(event.id, { voiceIndex, eventIndex });
    });
  });
  return index;
};

export const useSharedRetuneScoreDocument = ({
  importResult,
  targetMode,
  effectiveTargetScale,
  baseNote,
  previewSpeed,
  playingRatios
}: {
  importResult: MidiImportResult | null | undefined;
  targetMode?: string | null;
  effectiveTargetScale: { scale: string[]; nodeIdByScaleIndex: (string | null)[] };
  baseNote: number;
  previewSpeed: number;
  playingRatios: Map<string, { ratio?: string; nodeId?: string }>;
}) => {
  const [version, setVersion] = useState(sharedCache.version);

  useEffect(() => {
    if (!importResult?.notes?.length) {
      if (sharedCache.key !== null) {
        sharedCache.key = null;
        sharedCache.scoreDoc = null;
        sharedCache.eventIndex = new Map();
        sharedCache.noteIndex = new Map();
        sharedCache.version += 1;
      }
      setVersion(sharedCache.version);
      return;
    }

    const key = buildCacheKey({
      importResult,
      targetMode,
      scale: effectiveTargetScale.scale,
      nodeIdByScaleIndex: effectiveTargetScale.nodeIdByScaleIndex,
      baseNote,
      previewSpeed
    });

    if (sharedCache.key !== key) {
      const doc = buildScoreFromMidi(importResult, {
        targetMode: (targetMode || 'custom') as any,
        scale: effectiveTargetScale.scale,
        baseNote,
        nodeIdByScaleIndex: effectiveTargetScale.nodeIdByScaleIndex,
        speed: previewSpeed
      });
      sharedCache.key = key;
      sharedCache.scoreDoc = doc;
      sharedCache.eventIndex = buildEventIndex(doc);
      sharedCache.noteIndex = buildNoteIndex(importResult);
      sharedCache.version += 1;
      setVersion(sharedCache.version);
    }
  }, [importResult, targetMode, effectiveTargetScale, baseNote, previewSpeed]);

  useEffect(() => {
    const doc = sharedCache.scoreDoc;
    if (!doc || playingRatios.size === 0) return;
    let changed = false;
    for (const [noteId, entry] of playingRatios) {
      if (!entry.ratio) continue;
      const loc = sharedCache.eventIndex.get(noteId);
      if (!loc) continue;
      const event = doc.voices[loc.voiceIndex]?.events[loc.eventIndex];
      if (!event) continue;
      const nextRatio = entry.ratio;
      if (event.ratio !== nextRatio || (entry.nodeId && event.nodeId !== entry.nodeId)) {
        event.ratio = nextRatio;
        event.ratioFraction = parseGeneralRatio(nextRatio);
        if (entry.nodeId) event.nodeId = entry.nodeId;
        changed = true;
      }
    }
    if (changed) {
      sharedCache.version += 1;
      setVersion(sharedCache.version);
    }
  }, [playingRatios]);

  return {
    scoreDoc: sharedCache.scoreDoc,
    eventIndex: sharedCache.eventIndex,
    noteIndex: sharedCache.noteIndex,
    version
  };
};
