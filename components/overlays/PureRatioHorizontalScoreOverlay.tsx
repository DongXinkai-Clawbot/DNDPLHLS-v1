import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from '../../store';
import type { ScoreEvent, ScoreVoice, RatioDisplayMode } from '../../domain/scoreTimeline/types';
import { lowerBound, upperBound } from '../../domain/scoreTimeline/search';
import { useRetuneOverlayScale } from './retune/useRetuneOverlayScale';
import { useSharedRetuneScoreDocument } from './retune/useSharedRetuneScoreDocument';
import {
  calculateCents,
  formatPrimePowerRatioFromPrimeVector,
  formatRatio,
  getPrimeVectorFromRatio,
  normalizeOctave,
  parseGeneralRatio
} from '../../musicLogic';

const DEFAULT_PRE_SECONDS = 6;
const DEFAULT_POST_SECONDS = 12;
const DEFAULT_PX_PER_SECOND = 120;
const MIN_PX_PER_SECOND = 60;
const MAX_PX_PER_SECOND = 240;
const MIN_PRE_SECONDS = 2;
const MAX_PRE_SECONDS = 12;
const MIN_POST_SECONDS = 4;
const MAX_POST_SECONDS = 24;
const ROW_HEIGHT = 48;

const clampSpeed = (value: number) => Math.min(4, Math.max(0.25, value));

type VoiceGroup = {
  id: string;
  t0: number;
  t1: number;
  duration: number;
  events: ScoreEvent[];
};

type VoiceLane = {
  voice: ScoreVoice;
  voiceIndex: number;
  groups: VoiceGroup[];
};

type JoinLineStyle = 'solid' | 'dashed' | 'dotted' | 'glow';

type JoinLine = {
  id: string;
  x1: number;
  x2: number;
  y: number;
};

const JOIN_LINE_MIN_PX = 6;
const JOIN_LINE_MAX_PX = 28;

export const PureRatioHorizontalScoreOverlay = () => {
  const {
    isPureUIMode,
    settings,
    nodes,
    selectedNode,
    selectNode,
    playingRatios,
    savedMidiScales,
    midiRetuner,
    pureScoreOverlay,
    setPureScoreOverlay,
    setMidiRetunerState
  } = useStore(
    (s) => ({
      isPureUIMode: s.isPureUIMode,
      settings: s.settings,
      nodes: s.nodes,
      selectedNode: s.selectedNode,
      selectNode: s.selectNode,
      playingRatios: s.playingRatios,
      savedMidiScales: s.savedMidiScales,
      midiRetuner: s.midiRetuner,
      pureScoreOverlay: s.pureScoreOverlay,
      setPureScoreOverlay: s.setPureScoreOverlay,
      setMidiRetunerState: s.setMidiRetunerState
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
    previewPositionSeconds,
    previewIsPlaying
  } = midiRetuner || {};

  const playbackMode = settings?.playbackVisualizationMode ?? 'SCROLLER';
  const [viewportWidth, setViewportWidth] = useState(600);
  const [hintEventId, setHintEventId] = useState<string | null>(null);

  const { layoutMode, effectiveTargetScale } = useRetuneOverlayScale({
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

  const displayMode = pureScoreOverlay?.displayMode ?? 'fraction';
  const showBars = pureScoreOverlay?.showBars ?? true;
  const showOctaveFolding = pureScoreOverlay?.showOctaveFolding ?? true;
  const showCents = pureScoreOverlay?.showCents ?? false;
  const showHz = pureScoreOverlay?.showHz ?? false;
  const showPrimes = pureScoreOverlay?.showPrimes ?? false;
  const showJoinLine = pureScoreOverlay?.showJoinLine ?? false;
  const joinLineStyle = (pureScoreOverlay?.joinLineStyle as JoinLineStyle) ?? 'solid';
  const soloVoiceId = pureScoreOverlay?.soloVoiceId ?? null;
  const collapsed = pureScoreOverlay?.collapsed ?? false;
  const hidden = pureScoreOverlay?.hidden ?? false;
  const pxPerSecond = Number.isFinite(pureScoreOverlay?.pxPerSecond)
    ? (pureScoreOverlay?.pxPerSecond as number)
    : DEFAULT_PX_PER_SECOND;
  const preSeconds = Number.isFinite(pureScoreOverlay?.preSeconds)
    ? (pureScoreOverlay?.preSeconds as number)
    : DEFAULT_PRE_SECONDS;
  const postSeconds = Number.isFinite(pureScoreOverlay?.postSeconds)
    ? (pureScoreOverlay?.postSeconds as number)
    : DEFAULT_POST_SECONDS;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const playheadRef = useRef(0);

  const retuneActive = !!(retunePreviewActive && isPureUIMode && playbackMode === 'SCROLLER');
  const allowLayout = layoutMode === 'lattice' || layoutMode === 'h-chroma';

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

  const { scoreDoc, version: scoreVersion } = useSharedRetuneScoreDocument({
    importResult,
    targetMode,
    effectiveTargetScale,
    baseNote: resolvedBaseNote,
    previewSpeed,
    playingRatios
  });
  const docVersion = scoreVersion;

  useEffect(() => {
    return () => {
      if (hintTimeoutRef.current !== null) {
        window.clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = null;
      }
    };
  }, []);

  const hintIndex = useMemo(() => {
    const doc = scoreDoc;
    const byNodeId = new Map<string, { t0s: number[]; ids: string[] }>();
    const byRatio = new Map<string, { t0s: number[]; ids: string[] }>();
    if (!doc) return { byNodeId, byRatio };

    const push = (
      map: Map<string, { t0s: number[]; ids: string[] }>,
      key: string,
      event: ScoreEvent
    ) => {
      const entry = map.get(key) || { t0s: [], ids: [] };
      entry.t0s.push(event.t0);
      entry.ids.push(event.id);
      map.set(key, entry);
    };

    doc.voices.forEach((voice) => {
      voice.events.forEach((event) => {
        if (event.type !== 'note') return;
        if (event.nodeId) push(byNodeId, event.nodeId, event);
        if (event.ratio) push(byRatio, event.ratio, event);
      });
    });

    const sortEntries = (map: Map<string, { t0s: number[]; ids: string[] }>) => {
      map.forEach((entry, key) => {
        const merged = entry.t0s.map((t0, idx) => ({ t0, id: entry.ids[idx] }));
        merged.sort((a, b) => a.t0 - b.t0);
        map.set(key, { t0s: merged.map((item) => item.t0), ids: merged.map((item) => item.id) });
      });
    };
    sortEntries(byNodeId);
    sortEntries(byRatio);
    return { byNodeId, byRatio };
  }, [scoreDoc, docVersion]);

  useEffect(() => {
    const doc = scoreDoc;
    if (!doc || !selectedNode) {
      setHintEventId(null);
      return;
    }
    if (hintTimeoutRef.current !== null) {
      window.clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }

    const ratioKey = `${selectedNode.ratio.n}/${selectedNode.ratio.d}`;
    const lookup = hintIndex.byNodeId.get(selectedNode.id) || hintIndex.byRatio.get(ratioKey);
    if (!lookup || lookup.t0s.length === 0) {
      setHintEventId(null);
      return;
    }

    const playhead = playheadRef.current;
    const nextIdx = lowerBound(lookup.t0s, playhead);
    if (nextIdx >= lookup.ids.length) {
      setHintEventId(null);
      return;
    }

    setHintEventId(lookup.ids[nextIdx]);
    hintTimeoutRef.current = window.setTimeout(() => {
      setHintEventId(null);
    }, 800);
  }, [hintIndex, selectedNode]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateWidth = () => setViewportWidth(el.clientWidth || 600);
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const matchNodeByPrimeVector = useCallback(
    (primeVector: Record<number, number>) => {
      if (!primeVector) return null;
      const targetKeys = Object.keys(primeVector);
      return (
        nodes.find((node) => {
          const nodeVector = node.primeVector || {};
          const nodeKeys = Object.keys(nodeVector);
          const allKeys = new Set([...targetKeys, ...nodeKeys]);
          for (const key of allKeys) {
            const prime = Number(key);
            const nodeExp = (nodeVector as Record<number, number>)[prime] ?? 0;
            const targetExp = (primeVector as Record<number, number>)[prime] ?? 0;
            if (nodeExp !== targetExp) return false;
          }
          return true;
        }) ?? null
      );
    },
    [nodes]
  );

  const playheadSeconds = Number.isFinite(previewPositionSeconds) ? (previewPositionSeconds as number) : 0;
  playheadRef.current = playheadSeconds;
  const safePreSeconds = Math.max(0, preSeconds);
  const safePostSeconds = Math.max(0, postSeconds);
  const windowStart = Math.max(0, playheadSeconds - safePreSeconds);
  const windowEnd = playheadSeconds + safePostSeconds;

  const ticksPerBeat = scoreDoc?.tempoInfo?.ticksPerBeat ?? 0;
  const timelineWidth = Math.max(1, (scoreDoc?.totalDuration ?? 0) * pxPerSecond);
  const timelineOffset = viewportWidth / 2 - playheadSeconds * pxPerSecond;
  const laneHeight = ROW_HEIGHT;

  const getUnderlineCount = useCallback(
    (event: ScoreEvent) => {
      if (event.type !== 'note') return 0;
      if (!ticksPerBeat || !event.midi?.durationTicks) return 0;
      const beats = event.midi.durationTicks / ticksPerBeat;
      if (!Number.isFinite(beats) || beats <= 0 || beats >= 1) return 0;
      const count = Math.ceil(Math.log2(1 / beats));
      if (!Number.isFinite(count) || count <= 0) return 0;
      return Math.min(3, Math.max(1, count));
    },
    [ticksPerBeat]
  );

  const visibleVoices = useMemo(() => {
    if (!scoreDoc) return [] as VoiceLane[];
    const bufferSeconds = 0.2;
    const lanes = scoreDoc.voices.map((voice, voiceIndex) => {
      const groupsMap = new Map<string, VoiceGroup>();
      const t0s = voice.index?.t0s ?? voice.events.map((event) => event.t0);
      const startIdx = lowerBound(t0s, windowStart - bufferSeconds);
      const endIdx = upperBound(t0s, windowEnd + bufferSeconds);
      const slice = voice.events.slice(startIdx, endIdx);
      slice.forEach((event) => {
        if (event.t1 < windowStart || event.t0 > windowEnd) return;
        const groupId = event.chordGroupId || event.id;
        const existing = groupsMap.get(groupId);
        if (!existing) {
          groupsMap.set(groupId, {
            id: groupId,
            t0: event.t0,
            t1: event.t1,
            duration: Math.max(0, event.t1 - event.t0),
            events: [event]
          });
        } else {
          existing.events.push(event);
          existing.t0 = Math.min(existing.t0, event.t0);
          existing.t1 = Math.max(existing.t1, event.t1);
          existing.duration = Math.max(0, existing.t1 - existing.t0);
        }
      });
      const groups = Array.from(groupsMap.values()).sort((a, b) => a.t0 - b.t0);
      return { voice, voiceIndex, groups };
    });
    return soloVoiceId ? lanes.filter((lane) => lane.voice.voiceId === soloVoiceId) : lanes;
  }, [scoreDoc, scoreVersion, windowStart, windowEnd, soloVoiceId]);

  const joinLines = useMemo(() => {
    if (!showJoinLine || visibleVoices.length === 0) return [] as JoinLine[];
    const lines: JoinLine[] = [];
    visibleVoices.forEach((lane, renderIndex) => {
      const groups = lane.groups;
      if (groups.length < 2) return;
      const activeIndex = groups.findIndex((group) => playheadSeconds >= group.t0 && playheadSeconds <= group.t1);
      if (activeIndex <= 0) return;
      const current = groups[activeIndex];
      const previous = groups[activeIndex - 1];
      const endX = current.t0 * pxPerSecond;
      if (!Number.isFinite(endX)) return;
      const prevEnd = Number.isFinite(previous.t1) ? previous.t1 * pxPerSecond : endX - JOIN_LINE_MAX_PX;
      let startX = Math.max(prevEnd, endX - JOIN_LINE_MAX_PX);
      if (endX - startX < JOIN_LINE_MIN_PX) startX = endX - JOIN_LINE_MIN_PX;
      if (startX < 0) startX = 0;
      if (endX - startX < 2) return;
      const y = renderIndex * laneHeight + laneHeight / 2;
      lines.push({ id: `${lane.voice.voiceId}-${current.id}`, x1: startX, x2: endX, y });
    });
    return lines;
  }, [laneHeight, playheadSeconds, pxPerSecond, showJoinLine, visibleVoices]);

  const barMarkers = useMemo(() => {
    if (!scoreDoc || !showBars) return [] as { t: number; index: number }[];
    const barsFromDoc = (scoreDoc.events || [])
      .filter((event) => event.type === 'bar')
      .map((event) => {
        const parts = event.id.split('-');
        const index = parts.length > 1 ? Number(parts[1]) : 0;
        return { t: event.t0, index: Number.isFinite(index) ? index : 0 };
      });
    if (barsFromDoc.length > 0) {
      return barsFromDoc.filter((bar) => bar.t >= windowStart && bar.t <= windowEnd);
    }
    if (!scoreDoc.tempoInfo) return [];
    const timeSig = scoreDoc.timeSignature || { numerator: 4, denominator: 4 };
    const beatsPerBar = timeSig.numerator * (4 / timeSig.denominator);
    const ticksPerBar = scoreDoc.tempoInfo.ticksPerBeat * beatsPerBar;
    const barSeconds = ticksPerBar * scoreDoc.tempoInfo.secondsPerTick;
    if (!Number.isFinite(barSeconds) || barSeconds <= 0) return [];
    const count = Math.ceil((scoreDoc.totalDuration || 0) / barSeconds);
    const bars: { t: number; index: number }[] = [];
    for (let i = 0; i <= count; i += 1) {
      const t = i * barSeconds;
      if (t < windowStart || t > windowEnd) continue;
      bars.push({ t, index: i });
    }
    return bars;
  }, [scoreDoc, scoreVersion, showBars, windowStart, windowEnd]);

  const beatPositions = useMemo(() => {
    if (!scoreDoc?.tempoInfo || !showBars) return [];
    const beatSeconds = scoreDoc.tempoInfo.ticksPerBeat * scoreDoc.tempoInfo.secondsPerTick;
    if (!Number.isFinite(beatSeconds) || beatSeconds <= 0) return [];
    const startBeat = Math.floor(windowStart / beatSeconds);
    const endBeat = Math.ceil(windowEnd / beatSeconds);
    const barKeys = new Set(barMarkers.map((bar) => Math.round(bar.t * 1000)));
    const beats: number[] = [];
    for (let i = startBeat; i <= endBeat; i += 1) {
      const t = i * beatSeconds;
      if (t < windowStart || t > windowEnd) continue;
      if (barKeys.has(Math.round(t * 1000))) continue;
      beats.push(t);
    }
    return beats;
  }, [barMarkers, scoreDoc, showBars, windowStart, windowEnd]);

  const formatRatioLabel = useCallback(
    (event: ScoreEvent) => {
      if (event.type === 'rest') return { main: 'rest', sub: '' };
      if (!event.ratio) return { main: '--', sub: '' };
      const rawFraction = event.ratioFraction || parseGeneralRatio(event.ratio);
      const rawValue = Number(rawFraction.n) / Number(rawFraction.d);
      if (!Number.isFinite(rawValue) || rawValue <= 0) return { main: '--', sub: '' };

      let displayFraction = rawFraction;
      let octaveMarks = '';
      if (showOctaveFolding) {
        const normalized = normalizeOctave(rawFraction);
        displayFraction = normalized.ratio;
        const octaves = normalized.octaves;
        if (octaves > 0) octaveMarks = '.'.repeat(octaves);
        if (octaves < 0) octaveMarks = ','.repeat(Math.abs(octaves));
      }

      const fractionLabel = formatRatio(displayFraction);
      const decimalValue = Number(displayFraction.n) / Number(displayFraction.d);
      const decimalLabel = Number.isFinite(decimalValue) ? decimalValue.toFixed(4) : '';

      if (displayMode === 'decimal') {
        return { main: decimalLabel, sub: '' };
      }
      if (displayMode === 'both') {
        return { main: `${fractionLabel}${octaveMarks}`, sub: decimalLabel };
      }
      return { main: `${fractionLabel}${octaveMarks}`, sub: '' };
    },
    [displayMode, showOctaveFolding]
  );

  const formatExtras = useCallback(
    (event: ScoreEvent) => {
      if (event.type === 'rest') return '';
      if (!event.ratio) return '';
      const rawFraction = event.ratioFraction || parseGeneralRatio(event.ratio);
      const rawValue = Number(rawFraction.n) / Number(rawFraction.d);
      if (!Number.isFinite(rawValue) || rawValue <= 0) return '';
      const extras: string[] = [];
      if (showCents) {
        extras.push(`${calculateCents(rawFraction).toFixed(1)}c`);
      }
      if (showHz) {
        const freq = resolvedBaseFrequency * rawValue;
        if (Number.isFinite(freq)) extras.push(`${freq.toFixed(2)}Hz`);
      }
      if (showPrimes) {
        const vector = getPrimeVectorFromRatio(rawFraction.n, rawFraction.d);
        extras.push(formatPrimePowerRatioFromPrimeVector(vector));
      }
      return extras.join(' ');
    },
    [showCents, showHz, showPrimes, resolvedBaseFrequency]
  );

  const formatEventTitle = useCallback(
    (event: ScoreEvent) => {
      const label = formatRatioLabel(event);
      const extras = formatExtras(event);
      const lines = [label.main];
      if (label.sub) lines.push(label.sub);
      if (extras) lines.push(extras);
      return lines.join('\n');
    },
    [formatExtras, formatRatioLabel]
  );

  const handleEventClick = useCallback(
    (event: ScoreEvent, seekSeconds?: number) => {
      if (Number.isFinite(seekSeconds) && midiRetuner?.previewSeekToSeconds) {
        midiRetuner.previewSeekToSeconds(seekSeconds as number);
        setMidiRetunerState({ previewPositionSeconds: seekSeconds as number });
      }
      if (event.type === 'rest') return;
      if (event.nodeId) {
        const node = nodeById.get(event.nodeId);
        if (node) {
          selectNode(node, false, false, true);
          return;
        }
      }
      if (!event.ratio) return;
      const frac = event.ratioFraction || parseGeneralRatio(event.ratio);
      const vector = getPrimeVectorFromRatio(frac.n, frac.d);
      const node = matchNodeByPrimeVector(vector);
      if (node) selectNode(node, false, false, true);
    },
    [matchNodeByPrimeVector, midiRetuner, nodeById, selectNode, setMidiRetunerState]
  );

  const seekToSeconds = useCallback(
    (targetSeconds: number) => {
      const total = scoreDoc?.totalDuration ?? 0;
      const clamped = Math.max(0, Math.min(total, targetSeconds));
      if (midiRetuner?.previewSeekToSeconds) {
        midiRetuner.previewSeekToSeconds(clamped);
      }
      setMidiRetunerState({ previewPositionSeconds: clamped });
    },
    [midiRetuner, setMidiRetunerState]
  );

  const handleScoreWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!scoreDoc) return;
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      // Allow both horizontal and vertical scrolling to move timeline
      // Shift key can be used for alternative behavior in the future
      if (absX === 0 && absY === 0) return;
      e.preventDefault();

      // Prefer horizontal scroll delta if present, otherwise use vertical
      const deltaPixels = absX > 0 ? e.deltaX : (absY > 0 ? e.deltaY : 0);
      const deltaSeconds = deltaPixels / Math.max(1, pxPerSecond);
      seekToSeconds(playheadRef.current + deltaSeconds);
    },
    [pxPerSecond, seekToSeconds]
  );

  const toggleSolo = (voiceId: string) => {
    setPureScoreOverlay({ soloVoiceId: soloVoiceId === voiceId ? null : voiceId });
  };

  if (!retuneActive || !allowLayout) return null;
  if (!importResult?.notes?.length || !scoreDoc) return null;

  if (hidden) {
    return (
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-20">
        <button
          onClick={() => setPureScoreOverlay({ hidden: false })}
          className="bg-white/95 text-black border border-black/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg"
        >
          Show Score
        </button>
      </div>
    );
  }

  const totalHeight = Math.max(laneHeight * visibleVoices.length, laneHeight);
  const joinDash = joinLineStyle === 'dashed' ? '6 4' : joinLineStyle === 'dotted' ? '2 3' : undefined;
  const joinStrokeWidth = joinLineStyle === 'glow' ? 2.4 : 1.6;
  const joinStroke = 'rgba(0, 0, 0, 0.55)';
  const joinFilter = joinLineStyle === 'glow' ? 'drop-shadow(0 0 6px rgba(0,0,0,0.35))' : undefined;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto z-20 w-[min(1200px,94vw)]">
      <div className="bg-white/95 text-black border border-black/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-black/10">
          <div className="text-[10px] uppercase font-black tracking-widest">Pure Ratio Timeline</div>
          <div className="text-[10px] text-black/50">
            {previewIsPlaying ? 'Playing' : 'Paused'} • {Math.round(playheadSeconds * 100) / 100}s
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPureScoreOverlay({ showBars: !showBars })}
              className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                showBars ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
              }`}
            >
              Bars
            </button>
            <button
              onClick={() => setPureScoreOverlay({ showOctaveFolding: !showOctaveFolding })}
              className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                showOctaveFolding ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
              }`}
            >
              Octave
            </button>
            <button
              onClick={() => setPureScoreOverlay({ showCents: !showCents })}
              className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                showCents ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
              }`}
            >
              Cents
            </button>
            <button
              onClick={() => setPureScoreOverlay({ showHz: !showHz })}
              className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                showHz ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
              }`}
            >
              Hz
            </button>
            <button
              onClick={() => setPureScoreOverlay({ showPrimes: !showPrimes })}
              className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                showPrimes ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
              }`}
            >
              Primes
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPureScoreOverlay({ showJoinLine: !showJoinLine })}
                className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                  showJoinLine ? 'border-black/40 bg-black/5' : 'border-black/10 text-black/50'
                }`}
              >
                Join
              </button>
              <select
                value={joinLineStyle}
                onChange={(e) => setPureScoreOverlay({ joinLineStyle: e.target.value as JoinLineStyle })}
                disabled={!showJoinLine}
                className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                  showJoinLine ? 'border-black/20 bg-white' : 'border-black/10 bg-white/60 text-black/40'
                }`}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
                <option value="glow">Glow</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              {(['fraction', 'decimal', 'both'] as RatioDisplayMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setPureScoreOverlay({ displayMode: mode })}
                  className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase tracking-widest ${
                    displayMode === mode ? 'border-black/60 bg-black text-white' : 'border-black/10 text-black/50'
                  }`}
                >
                  {mode === 'fraction' ? 'Frac' : mode === 'decimal' ? 'Dec' : 'Both'}
                </button>
              ))}
            </div>
            {soloVoiceId && (
              <button
                onClick={() => setPureScoreOverlay({ soloVoiceId: null })}
                className="px-2 py-1 rounded-full border border-black/10 text-[9px] font-bold uppercase tracking-widest text-black/60"
              >
                All Voices
              </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-black/50">Zoom</span>
                <input
                  type="range"
                  min={MIN_PX_PER_SECOND}
                  max={MAX_PX_PER_SECOND}
                  step={10}
                  value={Math.round(pxPerSecond)}
                  onChange={(e) => {
                    const next = Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, Number(e.target.value)));
                    setPureScoreOverlay({ pxPerSecond: next });
                  }}
                  className="w-20 h-1 accent-black appearance-none bg-black/10 rounded"
                />
                <span className="text-[9px] font-mono text-black/60">{Math.round(pxPerSecond)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-black/50">Pre</span>
                <input
                  type="range"
                  min={MIN_PRE_SECONDS}
                  max={MAX_PRE_SECONDS}
                  step={1}
                  value={Math.round(preSeconds)}
                  onChange={(e) => {
                    const next = Math.max(MIN_PRE_SECONDS, Math.min(MAX_PRE_SECONDS, Number(e.target.value)));
                    setPureScoreOverlay({ preSeconds: next });
                  }}
                  className="w-16 h-1 accent-black appearance-none bg-black/10 rounded"
                />
                <span className="text-[9px] font-mono text-black/60">{Math.round(preSeconds)}s</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-black/50">Post</span>
                <input
                  type="range"
                  min={MIN_POST_SECONDS}
                  max={MAX_POST_SECONDS}
                  step={1}
                  value={Math.round(postSeconds)}
                  onChange={(e) => {
                    const next = Math.max(MIN_POST_SECONDS, Math.min(MAX_POST_SECONDS, Number(e.target.value)));
                    setPureScoreOverlay({ postSeconds: next });
                  }}
                  className="w-16 h-1 accent-black appearance-none bg-black/10 rounded"
                />
                <span className="text-[9px] font-mono text-black/60">{Math.round(postSeconds)}s</span>
              </div>
            </div>
            <button
              onClick={() => setPureScoreOverlay({ collapsed: !collapsed })}
              className="px-2 py-1 rounded-full border border-black/10 text-[9px] font-bold uppercase tracking-widest text-black/60"
            >
              {collapsed ? 'Expand' : 'Min'}
            </button>
            <button
              onClick={() => setPureScoreOverlay({ hidden: true })}
              className="px-2 py-1 rounded-full border border-black/10 text-[9px] font-bold uppercase tracking-widest text-black/60"
            >
              Hide
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="max-h-[40vh] overflow-y-auto">
            <div className="grid" style={{ gridTemplateColumns: '80px 1fr' }}>
              <div className="border-r border-black/10">
                {visibleVoices.map((lane) => {
                  const isSolo = soloVoiceId === lane.voice.voiceId;
                  return (
                    <button
                      key={lane.voice.voiceId}
                      onClick={() => toggleSolo(lane.voice.voiceId)}
                      className={`w-full px-2 text-left text-[10px] uppercase font-bold tracking-widest border-b border-black/5 ${
                        isSolo ? 'bg-yellow-100' : ''
                      }`}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {lane.voice.label || lane.voice.voiceId}
                    </button>
                  );
                })}
              </div>
              <div ref={viewportRef} className="relative overflow-hidden" onWheel={handleScoreWheel}>
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-black/30" />
                <div
                  className="relative"
                  style={{
                    height: `${totalHeight}px`
                  }}
                >
                  <div
                    className="absolute top-0 left-0"
                    style={{
                      width: `${timelineWidth}px`,
                      height: `${totalHeight}px`,
                      transform: `translateX(${timelineOffset}px)`
                    }}
                  >
                    {visibleVoices.map((lane, renderIndex) => (
                      <div
                        key={lane.voice.voiceId}
                        className="absolute left-0 right-0 border-b border-black/5"
                        style={{ top: `${renderIndex * laneHeight}px`, height: `${laneHeight}px` }}
                      />
                    ))}

                    {showBars &&
                      beatPositions.map((t) => (
                        <div
                          key={`beat-${t}`}
                          className="absolute top-0 bottom-0 w-px bg-black/10"
                          style={{ left: `${t * pxPerSecond}px` }}
                        />
                      ))}

                    {showBars &&
                      barMarkers.map((bar) => (
                        <div
                          key={`bar-${bar.index}`}
                          className="absolute top-0 bottom-0"
                          style={{ left: `${bar.t * pxPerSecond}px` }}
                        >
                          <div className="absolute top-1 left-2 text-[8px] text-black/40 font-mono">
                            #{bar.index + 1}
                          </div>
                          <div className="absolute top-0 bottom-0 w-[2px] bg-black/30" />
                        </div>
                      ))}

                    {showJoinLine && joinLines.length > 0 && (
                      <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        width={timelineWidth}
                        height={totalHeight}
                      >
                        {joinLines.map((line) => (
                          <line
                            key={line.id}
                            x1={line.x1}
                            y1={line.y}
                            x2={line.x2}
                            y2={line.y}
                            stroke={joinStroke}
                            strokeWidth={joinStrokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={joinDash}
                            style={joinFilter ? { filter: joinFilter } : undefined}
                          />
                        ))}
                      </svg>
                    )}

                    {visibleVoices.map((lane, renderIndex) =>
                      lane.groups.map((group) => {
                        const left = group.t0 * pxPerSecond;
                        const width = Math.max(18, group.duration * pxPerSecond);
                        const top = renderIndex * laneHeight + 6;
                        const isActive = playheadSeconds >= group.t0 && playheadSeconds <= group.t1;
                        const isHinted = hintEventId && group.events.some((event) => event.id === hintEventId);
                        const isRestGroup = group.events.every((event) => event.type === 'rest');
                        const groupTitle = group.events.map(formatEventTitle).join('\n');
                        return (
                          <button
                            key={group.id}
                            onClick={() => handleEventClick(group.events[0], group.t0)}
                            title={groupTitle}
                            className={`absolute px-2 py-1 rounded border text-left ${
                              isActive ? 'bg-yellow-200 border-black/40' : 'bg-white border-black/10'
                            } ${isHinted ? 'outline outline-2 outline-black/40' : ''} ${
                              isRestGroup ? 'border-dashed bg-white/70 text-black/50' : ''
                            }`}
                            style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
                          >
                            <div className="flex flex-col gap-0.5">
                              {group.events.map((event) => {
                                const label = formatRatioLabel(event);
                                const extras = formatExtras(event);
                                const underlineCount = getUnderlineCount(event);
                                return (
                                  <div key={event.id} className="leading-tight">
                                    <div className="text-[11px] font-mono font-semibold break-all">{label.main}</div>
                                    {label.sub && <div className="text-[9px] text-black/60 font-mono">{label.sub}</div>}
                                    {extras && <div className="text-[8px] text-black/40 font-mono">{extras}</div>}
                                    {underlineCount > 0 && (
                                      <div className="flex flex-col gap-[2px] pt-0.5">
                                        {Array.from({ length: underlineCount }).map((_, idx) => (
                                          <div key={`${event.id}-u-${idx}`} className="h-px w-[70%] bg-black/60" />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="px-4 py-2 text-[10px] text-black/60">
            {scoreDoc?.voices.length ?? 0} voices • {Math.round((scoreDoc?.totalDuration ?? 0) * 10) / 10}s
          </div>
        )}
      </div>
    </div>
  );
};
