import type { Fraction, NodeData } from '../../types';
import { normalizeOctave, simplify } from '../../musicLogic';
import { buildTargetFrequencies, findNearestTargetIndex } from '../../utils/midiAudioRenderer';
import { findBestTuningForChord } from '../../utils/dynamicTuning';
import type { MusicXmlImportResult, MusicXmlNoteEvent } from './types';
import { buildRatioFromNode, buildRatioFromScaleIndex, type RetunedEventInfo } from './buildScoreDocument';

export type MusicXmlRetuneMode = 'custom' | 'retune' | 'dynamic';

export type MusicXmlRetuneOptions = {
  mode: MusicXmlRetuneMode;
  /**
   * Custom scale ratios (relative to 1/1). Only used for mode='custom'.
   */
  customScale?: string[];
  /**
   * Retune scale ratios (relative to 1/1). Only used for mode='retune'.
   */
  retuneScale?: string[];
  /**
   * Lattice nodes (required for mode='dynamic').
   */
  latticeNodes?: NodeData[];
  baseNote?: number;
  baseFrequency?: number;
  /**
   * A4 reference for the input score. Used only to compute source frequencies.
   * Default 440.
   */
  sourceA4?: number;
  dynamic?: {
    toleranceCents?: number;
    candidateLimit?: number;
    fallbackLimit?: number;
    deviationWeight?: number;
    intervalWeight?: number;
    noteWeight?: number;
    deviationMargin?: number;
    missingPenalty?: number;
  };
};

const A4_NOTE = 69;

const clampInt = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(value)));

const midiToFreq = (midiNote: number, a4: number) => {
  const val = Number.isFinite(midiNote) ? midiNote : A4_NOTE;
  return a4 * Math.pow(2, (val - A4_NOTE) / 12);
};

const normalizeScaleToPitchClass = (scale: string[]) => {
  // Keep string form, but ensure at least 1/1.
  const s = (scale || []).filter((x) => typeof x === 'string' && x.trim().length > 0);
  return s.length ? s : ['1/1'];
};

const buildTuningViaNearestScale = (
  events: MusicXmlNoteEvent[],
  scale: string[],
  baseNote: number,
  baseFrequency: number,
  sourceA4: number
): Map<string, RetunedEventInfo> => {
  const tuning = new Map<string, RetunedEventInfo>();
  const safeScale = normalizeScaleToPitchClass(scale);
  const targetFreqs = buildTargetFrequencies(safeScale, baseNote, baseFrequency);
  const scaleSize = safeScale.length;

  events.forEach((ev) => {
    if (ev.isRest || ev.midiNote == null) return;
    const src = midiToFreq(ev.midiNote, sourceA4);
    const nearest = findNearestTargetIndex(targetFreqs, src);
    const stepsFromBase = nearest.noteIndex - baseNote;
    const scaleIndex = ((stepsFromBase % scaleSize) + scaleSize) % scaleSize;
    const octaves = Math.floor((stepsFromBase - scaleIndex) / scaleSize);
    const { ratio, ratioFraction } = buildRatioFromScaleIndex(safeScale, scaleIndex, octaves);
    tuning.set(ev.id, { ratio, ratioFraction, nodeId: null });
  });
  return tuning;
};

const buildTuningViaDynamic = (
  importResult: MusicXmlImportResult,
  latticeNodes: NodeData[],
  baseNote: number,
  sourceA4: number,
  baseFrequency: number,
  opts?: MusicXmlRetuneOptions['dynamic']
): Map<string, RetunedEventInfo> => {
  const nodes = Array.isArray(latticeNodes) ? latticeNodes : [];
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const tuning = new Map<string, RetunedEventInfo>();

  const toleranceCents = Number.isFinite(opts?.toleranceCents) ? (opts?.toleranceCents as number) : 45;
  const candidateLimit = Number.isFinite(opts?.candidateLimit) ? (opts?.candidateLimit as number) : undefined;
  const fallbackLimit = Number.isFinite(opts?.fallbackLimit) ? (opts?.fallbackLimit as number) : undefined;
  const deviationMargin = Number.isFinite(opts?.deviationMargin) ? (opts?.deviationMargin as number) : undefined;
  const missingPenalty = Number.isFinite(opts?.missingPenalty) ? (opts?.missingPenalty as number) : undefined;
  const deviation = Number.isFinite(opts?.deviationWeight) ? (opts?.deviationWeight as number) : undefined;
  const interval = Number.isFinite(opts?.intervalWeight) ? (opts?.intervalWeight as number) : undefined;
  const note = Number.isFinite(opts?.noteWeight) ? (opts?.noteWeight as number) : undefined;

  const noteEvents = (importResult.events || []).filter((e) => !e.isRest && e.midiNote != null && e.durationTicks > 0);
  const sortedByStart = [...noteEvents].sort((a, b) => a.startTick - b.startTick || (a.midiNote ?? 0) - (b.midiNote ?? 0));
  const uniqueStartTicks = Array.from(new Set(sortedByStart.map((e) => e.startTick))).sort((a, b) => a - b);

  // Active set tracking for fixed-assign continuity.
  const active: MusicXmlNoteEvent[] = [];

  let addIdx = 0;
  for (const tick of uniqueStartTicks) {
    // Drop notes that have ended.
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].endTick <= tick) active.splice(i, 1);
    }

    // Add all notes starting at this tick.
    while (addIdx < sortedByStart.length && sortedByStart[addIdx].startTick === tick) {
      active.push(sortedByStart[addIdx]);
      addIdx += 1;
    }

    const notes = active.map((ev) => ev.midiNote as number);
    const targetCents = active.map((ev) => {
      const midi = ev.midiNote;
      if (Number.isFinite(midi) && Number.isFinite(sourceA4) && sourceA4 > 0 && Number.isFinite(baseFrequency) && baseFrequency > 0) {
        const freq = midiToFreq(midi as number, sourceA4);
        if (Number.isFinite(freq) && freq > 0) {
          return 1200 * Math.log2(freq / baseFrequency);
        }
      }
      if (Number.isFinite(midi)) return (midi as number - baseNote) * 100;
      return 0;
    });
    const fixedAssignments = new Map<number, string>();
    active.forEach((ev, idx) => {
      const existing = tuning.get(ev.id);
      if (existing?.nodeId) fixedAssignments.set(idx, existing.nodeId);
    });

    const result = findBestTuningForChord(
      notes,
      nodes,
      baseNote,
      toleranceCents,
      fixedAssignments.size ? fixedAssignments : null,
      {
        targetCents,
        candidateLimit,
        fallbackLimit,
        deviationMargin,
        missingPenalty,
        weights: {
          ...(deviation != null ? { deviation } : null),
          ...(interval != null ? { interval } : null),
          ...(note != null ? { note } : null)
        }
      }
    );

    for (let i = 0; i < active.length; i += 1) {
      const ev = active[i];
      const nodeId = result.nodeIds[i] || tuning.get(ev.id)?.nodeId || null;
      const octaveShift = result.octaveShifts[i] ?? 0;
      if (!nodeId) continue;
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const { ratio, ratioFraction } = buildRatioFromNode(node, octaveShift);
      tuning.set(ev.id, { ratio, ratioFraction, nodeId });
    }
  }

  // Ensure every note has a key (even if missing); renderer uses '--' fallback.
  noteEvents.forEach((ev) => {
    if (!tuning.has(ev.id)) {
      tuning.set(ev.id, { ratio: null, ratioFraction: null, nodeId: null });
    }
  });

  return tuning;
};

/**
 * Main retune entry point.
 *
 * Returns a Map(eventId -> ratio info), ready to be attached to ScoreEvents.
 */
export const retuneMusicXml = (
  importResult: MusicXmlImportResult,
  options: MusicXmlRetuneOptions
): Map<string, RetunedEventInfo> => {
  const baseNote = clampInt(Number.isFinite(options.baseNote) ? (options.baseNote as number) : 69, 0, 127);
  const baseFrequency = Number.isFinite(options.baseFrequency) && (options.baseFrequency as number) > 0
    ? (options.baseFrequency as number)
    : 440;
  const sourceA4 = Number.isFinite(options.sourceA4) && (options.sourceA4 as number) > 0
    ? (options.sourceA4 as number)
    : 440;

  const events = importResult.events || [];
  if (options.mode === 'custom') {
    return buildTuningViaNearestScale(events, options.customScale || ['1/1'], baseNote, baseFrequency, sourceA4);
  }
  if (options.mode === 'retune') {
    return buildTuningViaNearestScale(events, options.retuneScale || ['1/1'], baseNote, baseFrequency, sourceA4);
  }
  // dynamic
  return buildTuningViaDynamic(importResult, options.latticeNodes || [], baseNote, sourceA4, baseFrequency, options.dynamic);
};
