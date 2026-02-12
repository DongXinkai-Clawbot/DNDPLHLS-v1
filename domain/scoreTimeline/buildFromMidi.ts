import type { MidiImportResult, MidiNoteInfo } from '../../utils/midiFileRetune';
import { adjustOctave, parseGeneralRatio, simplify } from '../../musicLogic';
import type { ScoreDocument, ScoreEvent, ScoreTimeSignature, ScoreTempoInfo } from './types';

type BuildScoreOptions = {
  targetMode: 'custom' | 'scale' | 'edo' | 'lattice' | 'dynamic';
  scale: string[];
  baseNote: number;
  nodeIdByScaleIndex?: (string | null)[];
  speed?: number;
  chordEpsilonSeconds?: number;
  tempoMicrosecondsPerBeat?: number;
  timeSignature?: ScoreTimeSignature | null;
};

const DEFAULT_MICROSECONDS_PER_BEAT = 500000;
const DEFAULT_TICKS_PER_BEAT = 480;

const findEarliestEvent = (
  tracks: any[] | undefined,
  predicate: (ev: any) => boolean
) => {
  if (!tracks) return null;
  let bestTick = Number.POSITIVE_INFINITY;
  let bestEvent: any | null = null;
  tracks.forEach((track) => {
    let absTick = 0;
    track.forEach((ev: any) => {
      absTick += ev?.deltaTime || 0;
      if (predicate(ev) && absTick < bestTick) {
        bestTick = absTick;
        bestEvent = ev;
      }
    });
  });
  return bestEvent;
};

const resolveTempoInfo = (importResult: MidiImportResult, options: BuildScoreOptions): ScoreTempoInfo => {
  const ticksPerBeat = importResult.ticksPerBeat || DEFAULT_TICKS_PER_BEAT;
  let microsecondsPerBeat = options.tempoMicrosecondsPerBeat ?? DEFAULT_MICROSECONDS_PER_BEAT;
  if (options.tempoMicrosecondsPerBeat == null && importResult.midi?.tracks) {
    const earliest = findEarliestEvent(importResult.midi.tracks, (ev) => (
      ev?.type === 'setTempo' && Number.isFinite(ev.microsecondsPerBeat)
    ));
    if (earliest?.microsecondsPerBeat) {
      microsecondsPerBeat = earliest.microsecondsPerBeat;
    }
  }
  const speed = Number.isFinite(options.speed) ? Math.max(0.01, options.speed as number) : 1;
  const secondsPerTick = (microsecondsPerBeat / 1000000) / ticksPerBeat / speed;
  return { ticksPerBeat, microsecondsPerBeat, secondsPerTick, speed };
};

const resolveTimeSignature = (importResult: MidiImportResult, options: BuildScoreOptions): ScoreTimeSignature => {
  if (options.timeSignature) return options.timeSignature;
  const earliest = findEarliestEvent(importResult.midi?.tracks, (ev) => (
    ev?.type === 'timeSignature' && Number.isFinite(ev.numerator) && Number.isFinite(ev.denominator)
  ));
  if (earliest?.numerator && earliest?.denominator) {
    return { numerator: earliest.numerator, denominator: earliest.denominator };
  }
  return { numerator: 4, denominator: 4 };
};

const buildRatioForNote = (note: MidiNoteInfo, options: BuildScoreOptions) => {
  if (options.targetMode === 'dynamic') {
    return { ratio: null, ratioFraction: null, nodeId: null };
  }
  const scale = options.scale.length ? options.scale : ['1/1'];
  const scaleSize = scale.length;
  const stepsFromBase = note.noteNumber - options.baseNote;
  const scaleIndex = ((stepsFromBase % scaleSize) + scaleSize) % scaleSize;
  const octaves = Math.floor((stepsFromBase - scaleIndex) / scaleSize);
  const baseFraction = parseGeneralRatio(scale[scaleIndex] || '1/1');
  const ratioFraction = simplify(adjustOctave(baseFraction, octaves));
  const ratio = `${ratioFraction.n}/${ratioFraction.d}`;
  const nodeId = options.nodeIdByScaleIndex?.[scaleIndex] ?? null;
  return { ratio, ratioFraction, nodeId };
};

export const buildScoreFromMidi = (
  importResult: MidiImportResult,
  options: BuildScoreOptions
): ScoreDocument => {
  const tempoInfo = resolveTempoInfo(importResult, options);
  const timeSignature = resolveTimeSignature(importResult, options);
  const secondsPerTick = tempoInfo.secondsPerTick;
  const chordEpsilonSeconds = Number.isFinite(options.chordEpsilonSeconds)
    ? (options.chordEpsilonSeconds as number)
    : 0.03;
  const chordEpsilonTicks = secondsPerTick > 0
    ? Math.max(0, Math.round(chordEpsilonSeconds / secondsPerTick))
    : 0;

  const voices = new Map<string, { voiceId: string; label: string; events: ScoreEvent[] }>();
  let maxTick = Math.max(0, importResult.totalTicks || 0);

  const notes = importResult.notes || [];
  notes.forEach((note) => {
    const voiceId = `track-${note.trackIndex ?? 0}`;
    if (!voices.has(voiceId)) {
      voices.set(voiceId, {
        voiceId,
        label: `Track ${Number(note.trackIndex ?? 0) + 1}`,
        events: []
      });
    }

    const t0 = note.startTick * secondsPerTick;
    const t1 = t0 + Math.max(0, note.durationTicks * secondsPerTick);
    const { ratio, ratioFraction, nodeId } = buildRatioForNote(note, options);
    const endTick = note.startTick + Math.max(0, note.durationTicks || 0);
    if (endTick > maxTick) maxTick = endTick;

    voices.get(voiceId)!.events.push({
      id: note.id || `${voiceId}-${note.startTick}-${note.noteNumber}`,
      type: 'note' as const,
      voiceId,
      t0,
      t1,
      duration: Math.max(0, t1 - t0),
      ratio,
      ratioFraction,
      nodeId,
      midi: {
        id: note.id,
        noteNumber: note.noteNumber,
        channel: note.channel,
        trackIndex: note.trackIndex,
        startTick: note.startTick,
        durationTicks: note.durationTicks
      }
    });
  });

  const voiceList = Array.from(voices.values()).map((voice) => {
    const sorted = [...voice.events].sort((a, b) => {
      if (a.t0 !== b.t0) return a.t0 - b.t0;
      if (a.midi?.noteNumber !== b.midi?.noteNumber) return (a.midi?.noteNumber ?? 0) - (b.midi?.noteNumber ?? 0);
      return (a.midi?.channel ?? 0) - (b.midi?.channel ?? 0);
    });

    const withRests: ScoreEvent[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
      const event = sorted[i];
      withRests.push(event);
      const next = sorted[i + 1];
      if (!next) break;
      const gap = next.t0 - event.t1;
      if (gap >= 0.08) {
        withRests.push({
          id: `rest-${voice.voiceId}-${i}`,
          type: 'rest',
          voiceId: voice.voiceId,
          t0: event.t1,
          t1: next.t0,
          duration: gap
        });
      }
    }

    const noteEvents = withRests.filter((event) => event.type === 'note' && Number.isFinite(event.midi?.startTick));
    let groupIndex = 0;
    let i = 0;
    while (i < noteEvents.length) {
      const startTick = noteEvents[i].midi?.startTick ?? 0;
      let j = i + 1;
      while (j < noteEvents.length) {
        const nextTick = noteEvents[j].midi?.startTick ?? 0;
        if (Math.abs(nextTick - startTick) > chordEpsilonTicks) break;
        j += 1;
      }
      if (j - i > 1) {
        groupIndex += 1;
        const groupId = `chord-${voice.voiceId}-${groupIndex}`;
        for (let k = i; k < j; k += 1) {
          noteEvents[k].chordGroupId = groupId;
        }
      }
      i = j;
    }

    const t0s = withRests.map((event) => event.t0);
    return { voiceId: voice.voiceId, label: voice.label, events: withRests, index: { t0s } };
  });

  const totalDuration = Math.max(0, maxTick * secondsPerTick);
  const barEvents: ScoreEvent[] = [];
  if (tempoInfo && timeSignature) {
    const beatsPerBar = timeSignature.numerator * (4 / timeSignature.denominator);
    const ticksPerBar = tempoInfo.ticksPerBeat * beatsPerBar;
    if (Number.isFinite(ticksPerBar) && ticksPerBar > 0) {
      const barCount = Math.ceil(maxTick / ticksPerBar);
      for (let i = 0; i <= barCount; i += 1) {
        const tick = i * ticksPerBar;
        const t = tick * secondsPerTick;
        barEvents.push({
          id: `bar-${i}`,
          type: 'bar',
          voiceId: 'global',
          t0: t,
          t1: t,
          duration: 0
        });
      }
    }
  }

  return {
    voices: voiceList,
    events: barEvents,
    totalDuration,
    tempoInfo,
    timeSignature
  };
};
