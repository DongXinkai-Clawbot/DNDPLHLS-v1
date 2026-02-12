import type { Fraction, NodeData } from '../../types';
import { adjustOctave, parseGeneralRatio, simplify } from '../../musicLogic';
import type { ScoreDocument, ScoreEvent, ScoreTempoInfo, ScoreTimeSignature, ScoreVoice } from '../scoreTimeline/types';
import type { MusicXmlImportResult, MusicXmlNoteEvent } from './types';
import { voiceKeyForMusicXmlEvent } from './types';
import { buildTempoMap, tickToSeconds, type TempoSegment } from './tempoMap';

export type MusicXmlRetuneMode = 'custom' | 'retune' | 'dynamic';

export type RetunedEventInfo = {
  ratio: string | null;
  ratioFraction: Fraction | null;
  nodeId?: string | null;
};

export type MusicXmlScoreOptions = {
  speed?: number;
  chordEpsilonTicks?: number;
  // For underline computations etc.
  ticksPerBeatOverride?: number;
  baseNote?: number;
  partOrder?: string[];
};

type NoteMergeKey = string;

const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(value)));

const makeVoiceLabel = (ev: MusicXmlNoteEvent) => {
  const staff = Number.isFinite(ev.staff) ? Math.max(1, Math.floor(ev.staff)) : 1;
  const voice = (ev.voice || '1').trim() || '1';
  const base = ev.partName || ev.partId || 'Part';
  return `${base} · Staff ${staff} · Voice ${voice}`;
};

/**
 * Merge tied notes into a single long note per voice & pitch.
 * This prevents multi-measure ties from rendering as separate repeated events.
 */
const mergeTiesPerVoice = (voiceEvents: MusicXmlNoteEvent[]) => {
  const out: MusicXmlNoteEvent[] = [];
  const openByPitch = new Map<NoteMergeKey, MusicXmlNoteEvent>();

  const pitchKey = (ev: MusicXmlNoteEvent) => {
    if (ev.isRest) return null;
    const p = ev.pitch;
    if (!p) return null;
    // Use step/alter/octave as stable key.
    return `${p.step}:${p.alter}:${p.octave}`;
  };

  const sorted = [...voiceEvents].sort((a, b) => {
    if (a.startTick !== b.startTick) return a.startTick - b.startTick;
    const am = a.midiNote ?? 0;
    const bm = b.midiNote ?? 0;
    return am - bm;
  });

  for (const ev of sorted) {
    const key = pitchKey(ev);
    if (!key) {
      out.push(ev);
      continue;
    }

    const open = openByPitch.get(key);
    if (ev.tieStop && open) {
      // Merge into the open chain.
      open.durationTicks += ev.durationTicks;
      open.endTick = open.startTick + open.durationTicks;
      // If the chain does not continue, close it.
      if (!ev.tieStart) openByPitch.delete(key);
      continue;
    }

    // Start a new event (whether tied or not).
    const clone = { ...ev };
    out.push(clone);
    if (ev.tieStart) {
      openByPitch.set(key, clone);
    }
  }

  return out;
};

const buildTempoInfoSnapshot = (segments: TempoSegment[], ticksPerQuarter: number, speed: number): ScoreTempoInfo => {
  const first = segments[0];
  return {
    ticksPerBeat: Math.max(1, ticksPerQuarter || 480),
    microsecondsPerBeat: first?.microsecondsPerQuarter || 500000,
    secondsPerTick: first?.secondsPerTick || (500000 / 1000000) / Math.max(1, ticksPerQuarter || 480) / Math.max(0.01, speed),
    speed: Math.max(0.01, speed)
  };
};

const buildTimeSignatureSnapshot = (importResult: MusicXmlImportResult): ScoreTimeSignature => {
  const first = importResult.timeSignatureEvents?.[0];
  if (first && Number.isFinite(first.numerator) && Number.isFinite(first.denominator)) {
    return { numerator: Math.max(1, Math.floor(first.numerator)), denominator: Math.max(1, Math.floor(first.denominator)) };
  }
  return { numerator: 4, denominator: 4 };
};

const fillGapsWithSyntheticRests = (
  events: ScoreEvent[],
  voiceId: string,
  minGapSeconds: number
) => {
  if (!events.length) return events;
  const sorted = [...events].sort((a, b) => a.t0 - b.t0 || (a.midi?.noteNumber ?? 0) - (b.midi?.noteNumber ?? 0));
  const out: ScoreEvent[] = [];
  let cursor = 0;
  let restIndex = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const ev = sorted[i];
    if (ev.t0 - cursor >= minGapSeconds) {
      out.push({
        id: `rest-synth-${voiceId}-${restIndex++}`,
        type: 'rest',
        voiceId,
        t0: cursor,
        t1: ev.t0,
        duration: Math.max(0, ev.t0 - cursor)
      });
    }
    out.push(ev);
    cursor = Math.max(cursor, ev.t1);
  }
  return out;
};

/**
 * Builds a ScoreDocument suitable for rendering a horizontal JI-numbered score.
 *
 * Important: `tuningByEventId` should already contain the final retune result.
 */
export const buildScoreDocumentFromMusicXml = (
  importResult: MusicXmlImportResult,
  tuningByEventId: Map<string, RetunedEventInfo>,
  options?: MusicXmlScoreOptions
): ScoreDocument => {
  const speed = Number.isFinite(options?.speed) ? Math.max(0.01, options?.speed as number) : 1;
  const chordEpsilonTicks = Number.isFinite(options?.chordEpsilonTicks)
    ? Math.max(0, Math.floor(options?.chordEpsilonTicks as number))
    : 1;

  const segments = buildTempoMap(importResult.tempoEvents || [], importResult.ticksPerQuarter, speed);
  const tempoInfo = buildTempoInfoSnapshot(segments, importResult.ticksPerQuarter, speed);
  const timeSignature = buildTimeSignatureSnapshot(importResult);

  const partIndexById = new Map<string, number>();
  (importResult.parts || []).forEach((p, idx) => partIndexById.set(p.id, idx));

  // 1) Group MusicXML events by voiceKey
  const rawByVoice = new Map<string, MusicXmlNoteEvent[]>();
  (importResult.events || []).forEach((ev) => {
    const voiceId = voiceKeyForMusicXmlEvent(ev);
    const list = rawByVoice.get(voiceId) || [];
    list.push(ev);
    rawByVoice.set(voiceId, list);
  });

  // 2) Merge ties per voice to get clean, readable events
  const mergedByVoice = new Map<string, MusicXmlNoteEvent[]>();
  rawByVoice.forEach((list, voiceId) => {
    mergedByVoice.set(voiceId, mergeTiesPerVoice(list));
  });

  // 3) Convert to ScoreVoice list
  const voices: ScoreVoice[] = [];
  mergedByVoice.forEach((list, voiceId) => {
    const label = list[0] ? makeVoiceLabel(list[0]) : voiceId;
    const scoreEvents: ScoreEvent[] = [];

    list.forEach((ev) => {
      const t0 = tickToSeconds(segments, ev.startTick);
      const t1 = tickToSeconds(segments, ev.endTick);
      const duration = Math.max(0, t1 - t0);

      if (ev.isRest) {
        scoreEvents.push({
          id: ev.id,
          type: 'rest',
          voiceId,
          t0,
          t1,
          duration,
          midi: {
            noteNumber: 0,
            channel: 0,
            trackIndex: partIndexById.get(ev.partId) ?? 0,
            startTick: ev.startTick,
            durationTicks: ev.durationTicks
          }
        });
        return;
      }

      const tuned = tuningByEventId.get(ev.id);
      scoreEvents.push({
        id: ev.id,
        type: 'note',
        voiceId,
        t0,
        t1,
        duration,
        ratio: tuned?.ratio ?? null,
        ratioFraction: tuned?.ratioFraction ?? null,
        nodeId: tuned?.nodeId ?? null,
        midi: {
          noteNumber: clampInt(ev.midiNote ?? 0, 0, 127),
          channel: 0,
          trackIndex: partIndexById.get(ev.partId) ?? 0,
          startTick: ev.startTick,
          durationTicks: ev.durationTicks
        }
      });
    });

    // 4) Sort + fill missing gaps with synthetic rests (MusicXML often uses <forward> without explicit <rest>).
    const withSyntheticRests = fillGapsWithSyntheticRests(scoreEvents, voiceId, 0.05);

    // 5) Chord grouping by tick (same-onset notes in the same voice line)
    const noteEvents = withSyntheticRests.filter((e) => e.type === 'note' && Number.isFinite(e.midi?.startTick));
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
        const groupId = `chord-${voiceId}-${groupIndex}`;
        for (let k = i; k < j; k += 1) {
          noteEvents[k].chordGroupId = groupId;
        }
      }
      i = j;
    }

    const sorted = [...withSyntheticRests].sort((a, b) => a.t0 - b.t0);
    const t0s = sorted.map((e) => e.t0);
    voices.push({ voiceId, label, events: sorted, index: { t0s } });
  });

  // 6) Global bar markers from measure ticks
  const barEvents: ScoreEvent[] = (importResult.measureStartTicks || []).map((tick, idx) => {
    const t = tickToSeconds(segments, tick);
    return { id: `bar-${idx}`, type: 'bar', voiceId: 'global', t0: t, t1: t, duration: 0 };
  });

  // 7) Total duration
  const totalDuration = tickToSeconds(segments, Math.max(0, importResult.totalTicks || 0));

  return {
    voices: voices.sort((a, b) => (a.label || '').localeCompare(b.label || '')),
    events: barEvents,
    totalDuration,
    tempoInfo,
    timeSignature
  };
};

/**
 * Helper for building a ratio (as a simplified Fraction & "n/d" string) from a ratio text + octave shift.
 */
export const buildRatioFromScaleIndex = (scale: string[], scaleIndex: number, octaves: number) => {
  const safeScale = scale.length ? scale : ['1/1'];
  const idx = ((scaleIndex % safeScale.length) + safeScale.length) % safeScale.length;
  const base = parseGeneralRatio(safeScale[idx] || '1/1');
  const ratioFraction = simplify(adjustOctave(base, octaves));
  const ratio = `${ratioFraction.n}/${ratioFraction.d}`;
  return { ratio, ratioFraction };
};

export const buildRatioFromNode = (node: NodeData, octaveShift: number) => {
  const ratioFraction = simplify(adjustOctave(node.ratio, octaveShift));
  const ratio = `${ratioFraction.n}/${ratioFraction.d}`;
  return { ratio, ratioFraction };
};
