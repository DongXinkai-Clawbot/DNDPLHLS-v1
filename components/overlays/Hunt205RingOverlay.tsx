import React, { useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from '../../store';
import { buildToneAngleTable, loadHunt205Layout } from '../visualization/hunt205/Hunt205LayoutLoader';
import { resolveToneBindings, type NormalizedNoteEvent } from '../visualization/hunt205/Hunt205ToneResolver';
import { Hunt205RingView } from '../visualization/hunt205/Hunt205RingView';
import { useRetuneOverlayScale } from './retune/useRetuneOverlayScale';
import { useSharedRetuneScoreDocument } from './retune/useSharedRetuneScoreDocument';
import { parseGeneralRatio } from '../../musicLogic';
import type { MidiNoteInfo } from '../../utils/midiFileRetune';

const BASE_RING_RATIO = 0.8;
const MIN_RING_RATIO = 0.7;
const MIN_RING_SCALE = 0.8;
const MAX_RING_SCALE = 1.2;
const DEFAULT_VELOCITY = 0.7;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clampSpeed = (value: number) => Math.min(4, Math.max(0.25, value));

const buildPitchFromEvent = (
  eventRatio: string | null | undefined,
  noteInfo: MidiNoteInfo | undefined,
  tuningFrequencies: number[] | undefined,
  noteNumberOverride?: number | null
) => {
  if (eventRatio) {
    try {
      const frac = parseGeneralRatio(eventRatio);
      const num = Number(frac.n);
      const den = Number(frac.d);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
        return { type: 'ratio' as const, ratio_num: num, ratio_den: den };
      }
    } catch {
      // fall through
    }
  }

  const noteNumber = Number.isFinite(noteNumberOverride)
    ? (noteNumberOverride as number)
    : (Number.isFinite(noteInfo?.noteNumber) ? (noteInfo?.noteNumber as number) : null);
  const freqFromNote = noteInfo?.frequencyHz;
  const freqFromTuning = noteNumber !== null && tuningFrequencies ? tuningFrequencies[noteNumber] : undefined;
  const hz = Number.isFinite(freqFromNote) ? (freqFromNote as number) : (Number.isFinite(freqFromTuning) ? (freqFromTuning as number) : null);

  if (hz && hz > 0) {
    return { type: 'frequency' as const, hz };
  }

  return { type: 'cents' as const, cents: 0 };
};

export const Hunt205RingOverlay = () => {
  const {
    settings,
    nodes,
    savedMidiScales,
    midiRetuner,
    playingRatios
  } = useStore(
    (s) => ({
      settings: s.settings,
      nodes: s.nodes,
      savedMidiScales: s.savedMidiScales,
      midiRetuner: s.midiRetuner,
      playingRatios: s.playingRatios
    }),
    shallow
  );

  const {
    importResult,
    targetMode,
    selectedScaleId,
    scalaScaleId,
    scalaSource,
    edoDivisions,
    baseNote,
    restrictToNodes,
    retuneCustomScale,
    retuneSpeed,
    retuneSpeedTargets,
    retunePreviewActive,
    previewIsPlaying,
    previewPositionSeconds
  } = midiRetuner || {};

  const playbackMode = settings?.playbackVisualizationMode ?? 'SCROLLER';
  const ringSettings = settings?.playbackRing || {
    scale: 1,
    showAllLabels: true,
    showPreferredNames: false,
    rotationDeg: 0,
    showUpcoming: false,
    showDebug: false
  };

  const previewActive = !!(retunePreviewActive || previewIsPlaying);
  const retuneActive = !!(previewActive && playbackMode === 'HUNT205_RING');

  const { effectiveTargetScale } = useRetuneOverlayScale({
    settings,
    nodes,
    targetMode: (targetMode || 'custom') as string,
    selectedScaleId: selectedScaleId || '',
    scalaScaleId: scalaScaleId ?? null,
    scalaSource: (scalaSource as 'saved' | 'archive') || 'saved',
    edoDivisions: Number.isFinite(edoDivisions) ? (edoDivisions as number) : 12,
    retuneCustomScale: retuneCustomScale || [],
    restrictToNodes: !!restrictToNodes,
    savedMidiScales
  });

  const resolvedBaseNote = Number.isFinite(baseNote) ? (baseNote as number) : 69;
  const resolvedBaseFrequency = useMemo(() => {
    if (!importResult?.tuning) return 440;
    const freqs = importResult.tuning.noteFrequencies;
    if (Array.isArray(freqs) && Number.isFinite(freqs[resolvedBaseNote])) {
      return freqs[resolvedBaseNote] as number;
    }
    const tuningBaseNote = Number.isFinite(importResult.tuning.baseNote) ? importResult.tuning.baseNote : 69;
    const tuningBaseFreq = Number.isFinite(importResult.tuning.baseFrequency) ? importResult.tuning.baseFrequency : 440;
    return tuningBaseFreq * Math.pow(2, (resolvedBaseNote - tuningBaseNote) / 12);
  }, [importResult, resolvedBaseNote]);

  const speedTargets = retuneSpeedTargets || { preview: true, wav: true, midi: false };
  const speedValue = clampSpeed(Number.isFinite(retuneSpeed) ? (retuneSpeed as number) : 1);
  const previewSpeed = speedTargets.preview ? speedValue : 1;

  const { scoreDoc, noteIndex, version } = useSharedRetuneScoreDocument({
    importResult,
    targetMode,
    effectiveTargetScale,
    baseNote: resolvedBaseNote,
    previewSpeed,
    playingRatios
  });

  const layout = useMemo(() => loadHunt205Layout(), []);
  const playheadMs = (Number.isFinite(previewPositionSeconds) ? (previewPositionSeconds as number) : 0) * 1000;
  const mountIdRef = useRef<number | null>(null);

  const [viewport, setViewport] = useState(() => {
    if (typeof window === 'undefined') return { width: 1024, height: 768 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const ringScale = clamp(Number.isFinite(ringSettings.scale) ? (ringSettings.scale as number) : 1, MIN_RING_SCALE, MAX_RING_SCALE);
  const ratio = Math.max(MIN_RING_RATIO, BASE_RING_RATIO * ringScale);
  const sizePx = Math.max(240, Math.floor(viewport.height * ratio));

  const debugFromQuery = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('debugRing') === '1';
  }, []);

  const showAllLabels = ringSettings.showAllLabels !== false;
  const showPreferredNames = !!ringSettings.showPreferredNames;
  const rotationDeg = Number.isFinite(ringSettings.rotationDeg) ? (ringSettings.rotationDeg as number) : 0;
  const showUpcoming = !!ringSettings.showUpcoming;
  const debugEnabled = !!ringSettings.showDebug || debugFromQuery;

  const normalizedEvents = useMemo(() => {
    if (!scoreDoc) return [] as NormalizedNoteEvent[];
    const notes: NormalizedNoteEvent[] = [];
    const tuningFreqs = importResult?.tuning?.noteFrequencies;
    scoreDoc.voices.forEach((voice, voiceIndex) => {
      voice.events.forEach((event) => {
        if (event.type !== 'note') return;
        const noteInfo = noteIndex.get(event.id);
        const velocityRaw = Number.isFinite(noteInfo?.velocity) ? (noteInfo?.velocity as number) : 0;
        const velocity = Number.isFinite(velocityRaw) ? Math.max(0, Math.min(1, velocityRaw / 127)) : DEFAULT_VELOCITY;
        notes.push({
          event_id: event.id,
          start_time_ms: event.t0 * 1000,
          end_time_ms: event.t1 * 1000,
          pitch_representation: buildPitchFromEvent(event.ratio ?? null, noteInfo, tuningFreqs, event.midi?.noteNumber),
          velocity,
          channel: noteInfo?.channel,
          voice: Number.isFinite(noteInfo?.trackIndex) ? noteInfo?.trackIndex : voiceIndex
        });
      });
    });
    return notes;
  }, [scoreDoc, noteIndex, importResult, version]);

  const eventById = useMemo(() => new Map<string, NormalizedNoteEvent>(), []);

  useEffect(() => {
    eventById.clear();
    normalizedEvents.forEach((event) => {
      eventById.set(event.event_id, event);
    });
  }, [eventById, normalizedEvents]);

  const bindings = useMemo(() => {
    if (!normalizedEvents.length) return [];
    return resolveToneBindings(normalizedEvents, layout, {
      periodCents: layout.meta?.period_cents,
      referenceHz: resolvedBaseFrequency,
      referenceCents: 0,
      log: debugEnabled
        ? (entry) => {
            const event = eventById.get(entry.eventId);
            console.debug('[Hunt205Ring][Map]', {
              event_id: entry.eventId,
              tone_id: entry.toneId,
              match_method: entry.matchMethod,
              distance_cents: entry.distanceCents,
              approx: entry.approx,
              pitch: entry.pitch,
              start_time_ms: event?.start_time_ms ?? null,
              end_time_ms: event?.end_time_ms ?? null,
              velocity: event?.velocity ?? null,
              voice: event?.voice ?? null,
              channel: event?.channel ?? null
            });
          }
        : undefined
    });
  }, [debugEnabled, eventById, layout, normalizedEvents, resolvedBaseFrequency]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mountIdRef.current === null) {
      const current = (window as any).__hunt205RingMounts ?? 0;
      const next = current + 1;
      (window as any).__hunt205RingMounts = next;
      mountIdRef.current = next;
      console.debug('[Hunt205Ring] mount', { instance: next });
    }
    return () => {
      if (mountIdRef.current !== null) {
        console.debug('[Hunt205Ring] unmount', { instance: mountIdRef.current });
      }
    };
  }, []);

  useEffect(() => {
    if (!debugEnabled) return;
    const table = buildToneAngleTable(layout);
    const sample = table.list.slice(0, 10).map((entry) => ({
      tone_id: entry.toneId,
      angle_index: entry.angleIndex,
      angle_deg: Number(entry.angleDeg.toFixed(4)),
      angle_rad: Number(entry.angleRad.toFixed(6))
    }));
    console.debug('[Hunt205Ring][Angles]', {
      tone_count: layout.tones.length,
      sample
    });
  }, [debugEnabled, layout]);

  if (!retuneActive) return null;
  if (!importResult?.notes?.length || !scoreDoc) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
      <div className="pointer-events-auto" style={{ width: `${sizePx}px`, height: `${sizePx}px` }}>
        <Hunt205RingView
          layout={layout}
          bindings={bindings}
          playheadMs={playheadMs}
          sizePx={sizePx}
          showAllLabels={showAllLabels}
          showPreferredNames={showPreferredNames}
          rotationDeg={rotationDeg}
          showUpcoming={showUpcoming}
          debugEnabled={debugEnabled}
        />
      </div>
    </div>
  );
};
