import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ScoreDocument, ScoreEvent } from '../../../../../domain/scoreTimeline/types';
import type { RatioDisplayMode } from '../../../../../domain/scoreTimeline/types';
import { lowerBound, upperBound } from '../../../../../domain/scoreTimeline/search';
import { parseGeneralRatio } from '../../../../../musicLogic';
import {
  buildRatioDisplay,
  clamp,
  getBarTextScale,
  getChordTextScale,
  getNoteNameFromMidi,
  getRatioLayout,
  mixHexColors,
  rgbaFromHex
} from './helpers';
import { InstantaneousChordDisplay } from './InstantaneousChordDisplay';

export type ViewerLane = {
  voiceId: string;
  label?: string;
  groups: Array<{
    id: string;
    t0: number;
    t1: number;
    events: ScoreEvent[];
  }>;
};

export type ScorePresentationMode = 'ratio' | 'h-chroma';
export type HChromaLabelMode = 'ratio' | 'harmonic';

export type HChromaEventLabel = {
  harmonic: number | null;
  harmonicLabel: string;
  ratioLabel: string;
  ratioValue: number | null;
};

const MIN_TEXT_SCALE = 0.15;
const CHAR_WIDTH_PX = 8;
const LINE_HEIGHT_PX = 12;
const MIN_GROUP_PX = 18;

const fitTextScale = (label: string, maxWidthPx: number | null, baseScale: number) => {
  if (!maxWidthPx || maxWidthPx <= 0) return baseScale;
  if (!label) return baseScale;
  const widthScale = clamp(maxWidthPx / (Math.max(1, label.length) * CHAR_WIDTH_PX), MIN_TEXT_SCALE, 1);
  return Math.min(baseScale, widthScale);
};

const RatioLabel = ({
  event,
  displayMode,
  showOctaveFolding,
  ratioFormatMode,
  ratioAutoPowerDigits,
  ratioCustomSymbols,
  textScale = 1,
  maxWidthPx
}: {
  event: ScoreEvent;
  displayMode: RatioDisplayMode;
  showOctaveFolding: boolean;
  ratioFormatMode: 'fraction' | 'primePowers' | 'auto';
  ratioAutoPowerDigits: number;
  ratioCustomSymbols?: Record<number, string>;
  textScale?: number;
  maxWidthPx?: number | null;
}) => {
  if (event.type === 'rest') {
    const layout = getRatioLayout('0', 'main');
    const scaleStyle = textScale < 1 ? { transform: `scale(${textScale})`, transformOrigin: 'center' } : undefined;
    return <div className={`font-semibold text-center max-w-full text-gray-400 ${layout}`} title="0" style={scaleStyle}>0</div>;
  }
  if (!event.ratio) {
    const layout = getRatioLayout('--', 'main');
    const scaleStyle = textScale < 1 ? { transform: `scale(${textScale})`, transformOrigin: 'center' } : undefined;
    return <div className={`font-semibold text-center max-w-full text-gray-500 ${layout}`} title="--" style={scaleStyle}>--</div>;
  }
  const rawFraction = event.ratioFraction || parseGeneralRatio(event.ratio);
  const rawValue = Number(rawFraction.n) / Number(rawFraction.d);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    const layout = getRatioLayout('--', 'main');
    const scaleStyle = textScale < 1 ? { transform: `scale(${textScale})`, transformOrigin: 'center' } : undefined;
    return <div className={`font-semibold text-center max-w-full text-gray-500 ${layout}`} title="--" style={scaleStyle}>--</div>;
  }

  const { displayFraction, fractionLabel, compactLabel } = buildRatioDisplay(
    rawFraction,
    showOctaveFolding,
    ratioFormatMode,
    ratioAutoPowerDigits,
    ratioCustomSymbols
  );
  const decimalValue = Number(displayFraction.n) / Number(displayFraction.d);
  const decimalLabel = Number.isFinite(decimalValue) ? decimalValue.toFixed(4).replace(/\.0+$/, '') : '';

  if (displayMode === 'decimal') {
    const label = decimalLabel || compactLabel;
    const scale = fitTextScale(label, maxWidthPx ?? null, textScale);
    const scaleStyle = scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'center' } : undefined;
    const layout = getRatioLayout(label, 'main');
    return <div className={`font-semibold text-center tabular-nums max-w-full min-w-0 text-gray-200 ${layout}`} title={decimalLabel || compactLabel} style={scaleStyle}>{label}</div>;
  }
  if (displayMode === 'both') {
    const longest = Math.max(fractionLabel.length, decimalLabel.length);
    const scale = fitTextScale('0'.repeat(longest || 1), maxWidthPx ?? null, textScale);
    const scaleStyle = scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'center' } : undefined;
    const fractionLayout = getRatioLayout(fractionLabel, 'main');
    const decimalLayout = getRatioLayout(decimalLabel, 'sub');
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-full min-w-0" title={`${fractionLabel}\n${decimalLabel}`} style={scaleStyle}>
        <div className={`font-semibold text-center max-w-full min-w-0 text-gray-200 ${fractionLayout}`}>{fractionLabel}</div>
        <div className={`opacity-70 text-center tabular-nums max-w-full min-w-0 text-gray-400 ${decimalLayout}`}>{decimalLabel}</div>
      </div>
    );
  }
  const scale = fitTextScale(fractionLabel, maxWidthPx ?? null, textScale);
  const scaleStyle = scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'center' } : undefined;
  const layout = getRatioLayout(fractionLabel, 'main');
  return <div className={`font-semibold text-center max-w-full min-w-0 text-gray-200 ${layout}`} title={fractionLabel} style={scaleStyle}>{fractionLabel}</div>;
};

const HChromaLabel = ({
  event,
  labelMode,
  labels,
  textScale = 1,
  maxWidthPx
}: {
  event: ScoreEvent;
  labelMode: HChromaLabelMode;
  labels: Map<string, HChromaEventLabel>;
  textScale?: number;
  maxWidthPx?: number | null;
}) => {
  if (event.type === 'rest') {
    const layout = getRatioLayout('0', 'main');
    const scaleStyle = textScale < 1 ? { transform: `scale(${textScale})`, transformOrigin: 'center' } : undefined;
    return <div className={`font-semibold text-center max-w-full text-gray-400 ${layout}`} title="0" style={scaleStyle}>0</div>;
  }

  const info = labels.get(event.id);
  const label = labelMode === 'harmonic' ? info?.harmonicLabel : info?.ratioLabel;
  const safeLabel = label && label.length ? label : '--';
  const scale = fitTextScale(safeLabel, maxWidthPx ?? null, textScale);
  const scaleStyle = scale < 1 ? { transform: `scale(${scale})`, transformOrigin: 'center' } : undefined;
  const layout = getRatioLayout(safeLabel, 'main');
  const title = info
    ? `H${info.harmonic ?? '--'}${info.ratioLabel ? `\n${info.ratioLabel}` : ''}`
    : '--';

  return (
    <div className={`font-semibold text-center tabular-nums max-w-full text-gray-200 ${layout}`} title={title} style={scaleStyle}>
      {safeLabel}
    </div>
  );
};

export const MusicXmlJiScoreViewer = ({
  scoreDoc,
  playing,
  playhead,
  onSeek,
  onSelectEvent,
  selectedEventId,
  presentationMode,
  displayMode,
  hChromaLabelMode,
  hChromaLabels,
  hChromaColorForRatio,
  showBars,
  showBeats,
  stretchMeasures,
  measureScaleOverrides,
  pxPerSecond,
  preSeconds,
  postSeconds,
  laneHeight,
  showOctaveFolding,
  ratioFormatMode = 'auto',
  ratioAutoPowerDigits = 14,
  ratioCustomSymbols,
  hiddenVoiceIds,
  setHiddenVoiceIds
}: {
  scoreDoc: ScoreDocument;
  playing: boolean;
  playhead: number;
  onSelectEvent?: (event: ScoreEvent) => void;
  selectedEventId?: string | null;
  presentationMode: ScorePresentationMode;
  displayMode: RatioDisplayMode;
  hChromaLabelMode: HChromaLabelMode;
  hChromaLabels: Map<string, HChromaEventLabel>;
  hChromaColorForRatio: ((ratioValue: number) => string | null) | null;
  onSeek: (t: number) => void;
  showBars: boolean;
  showBeats: boolean;
  stretchMeasures?: boolean;
  measureScaleOverrides?: Record<number, number>;
  pxPerSecond: number;
  preSeconds: number;
  postSeconds: number;
  laneHeight: number;
  showOctaveFolding: boolean;
  ratioFormatMode: 'fraction' | 'primePowers' | 'auto';
  ratioAutoPowerDigits: number;
  ratioCustomSymbols?: Record<number, string>;
  hiddenVoiceIds: Set<string>;
  setHiddenVoiceIds: (ids: Set<string>) => void;
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(600);
  const [voiceOrder, setVoiceOrder] = useState<string[]>([]);
  const leftGutter = 160;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportWidth(Math.max(300, el.clientWidth || 600));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ids = scoreDoc.voices.map((v) => v.voiceId);
    setVoiceOrder((prev) => {
      if (!prev.length) return ids;
      const next = prev.filter((id) => ids.includes(id));
      ids.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  }, [scoreDoc]);

  const safePxPerSecond = Math.max(20, pxPerSecond || 120);
  const safePre = Math.max(0, preSeconds || 6);
  const safePost = Math.max(0.5, postSeconds || 12);
  const windowStart = Math.max(0, playhead - safePre);
  const windowEnd = playhead + safePost;
  const useHChroma = presentationMode === 'h-chroma';
  const orderedVoices = useMemo(() => {
    if (!voiceOrder.length) return scoreDoc.voices;
    const voiceById = new Map(scoreDoc.voices.map((voice) => [voice.voiceId, voice] as const));
    return voiceOrder.map((id) => voiceById.get(id)).filter(Boolean) as ScoreDocument['voices'];
  }, [scoreDoc, voiceOrder]);
  const hasMeasureOverrides = useMemo(() => {
    if (!measureScaleOverrides) return false;
    return Object.values(measureScaleOverrides).some((value) => Number.isFinite(value) && Math.abs((value as number) - 1) > 0.001);
  }, [measureScaleOverrides]);

  const resolveGroupColor = useCallback(
    (events: ScoreEvent[]) => {
      if (!useHChroma || !hChromaColorForRatio) return null;
      const colors: string[] = [];
      events.forEach((event) => {
        if (event.type !== 'note') return;
        const info = hChromaLabels.get(event.id);
        const ratioValue = info?.ratioValue;
        if (ratioValue == null || !Number.isFinite(ratioValue) || ratioValue <= 0) return;
        const color = hChromaColorForRatio(ratioValue);
        if (color) colors.push(color);
      });
      return mixHexColors(colors);
    },
    [useHChroma, hChromaColorForRatio, hChromaLabels]
  );

  const moveVoice = useCallback((voiceId: string, direction: -1 | 1) => {
    setVoiceOrder((prev) => {
      const index = prev.indexOf(voiceId);
      if (index < 0) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }, []);

  const lanes = useMemo(() => {
    const lanesRaw: ViewerLane[] = orderedVoices.map((voice) => {
      const groupsMap = new Map<string, { id: string; t0: number; t1: number; events: ScoreEvent[] }>();
      const t0s = voice.index?.t0s ?? voice.events.map((e) => e.t0);
      const startIdx = lowerBound(t0s, windowStart - 0.2);
      const endIdx = upperBound(t0s, windowEnd + 0.2);
      const slice = voice.events.slice(startIdx, endIdx);
      slice.forEach((event) => {
        if (event.t1 < windowStart || event.t0 > windowEnd) return;
        const groupId = event.chordGroupId || event.id;
        const existing = groupsMap.get(groupId);
        if (!existing) {
          groupsMap.set(groupId, { id: groupId, t0: event.t0, t1: event.t1, events: [event] });
        } else {
          existing.events.push(event);
          existing.t0 = Math.min(existing.t0, event.t0);
          existing.t1 = Math.max(existing.t1, event.t1);
        }
      });
      const groups = Array.from(groupsMap.values()).sort((a, b) => a.t0 - b.t0);
      return { voiceId: voice.voiceId, label: voice.label, groups };
    });
    return lanesRaw.filter((l) => !hiddenVoiceIds.has(l.voiceId));
  }, [orderedVoices, windowStart, windowEnd, hiddenVoiceIds]);
  const viewportHeight = Math.max(80, lanes.length * laneHeight);

  const measureMap = useMemo(() => {
    if (!stretchMeasures && !hasMeasureOverrides) return null;
    const bars = (scoreDoc.events || [])
      .filter((e) => e.type === 'bar')
      .map((e) => e.t0)
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);
    if (bars.length === 0) return null;
    if (bars[0] > 0) bars.unshift(0);
    const total = Math.max(0, scoreDoc.totalDuration || 0);
    if (bars[bars.length - 1] < total) bars.push(total);
    if (bars.length < 2) return null;

    const findMeasureIndex = (t: number) => {
      if (t <= bars[0]) return 0;
      if (t >= bars[bars.length - 1]) return bars.length - 2;
      let lo = 0;
      let hi = bars.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (bars[mid] <= t) lo = mid;
        else hi = mid;
      }
      return Math.min(Math.max(0, lo), bars.length - 2);
    };

    const maxGroupsPerMeasure = new Array(bars.length - 1).fill(0);
    scoreDoc.voices.forEach((voice) => {
      const groups = new Map<string, number>();
      voice.events.forEach((e) => {
        if (e.type !== 'note') return;
        const groupId = e.chordGroupId || e.id;
        const existing = groups.get(groupId);
        if (existing == null || e.t0 < existing) {
          groups.set(groupId, e.t0);
        }
      });
      const counts = new Array(bars.length - 1).fill(0);
      groups.forEach((t0) => {
        const idx = findMeasureIndex(t0);
        counts[idx] += 1;
      });
      for (let i = 0; i < counts.length; i += 1) {
        if (counts[i] > maxGroupsPerMeasure[i]) maxGroupsPerMeasure[i] = counts[i];
      }
    });

    const segments: Array<{ t0: number; t1: number; x0: number; x1: number }> = [];
    let xCursor = 0;
    for (let i = 0; i < bars.length - 1; i += 1) {
      const t0 = bars[i];
      const t1 = bars[i + 1];
      const baseWidth = Math.max(1, (t1 - t0) * safePxPerSecond);
      const minWidth = stretchMeasures ? Math.max(0, maxGroupsPerMeasure[i] * MIN_GROUP_PX) : 0;
      const width = Math.max(baseWidth, minWidth);
      const rawScale = measureScaleOverrides?.[i];
      const scale = Number.isFinite(rawScale) ? clamp(rawScale as number, 0.5, 3) : 1;
      const adjustedWidth = Math.max(8, width * scale);
      segments.push({ t0, t1, x0: xCursor, x1: xCursor + adjustedWidth });
      xCursor += adjustedWidth;
    }
    return { segments, totalWidth: xCursor };
  }, [scoreDoc, safePxPerSecond, stretchMeasures, hasMeasureOverrides, measureScaleOverrides]);

  const timeToX = useCallback(
    (t: number) => {
      if (!measureMap) return t * safePxPerSecond;
      const segments = measureMap.segments;
      if (!segments.length) return t * safePxPerSecond;
      if (t <= segments[0].t0) return segments[0].x0;
      if (t >= segments[segments.length - 1].t1) return segments[segments.length - 1].x1;
      let lo = 0;
      let hi = segments.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (segments[mid].t0 <= t) lo = mid;
        else hi = mid;
      }
      const seg = segments[Math.min(Math.max(lo, 0), segments.length - 1)];
      const span = seg.t1 - seg.t0 || 1;
      const ratio = clamp((t - seg.t0) / span, 0, 1);
      return seg.x0 + ratio * (seg.x1 - seg.x0);
    },
    [measureMap, safePxPerSecond]
  );

  const getMeasureSegment = useCallback(
    (t: number) => {
      if (!measureMap) return null;
      const segments = measureMap.segments;
      if (!segments.length) return null;
      if (t <= segments[0].t0) return segments[0];
      if (t >= segments[segments.length - 1].t1) return segments[segments.length - 1];
      let lo = 0;
      let hi = segments.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (segments[mid].t0 <= t) lo = mid;
        else hi = mid;
      }
      return segments[Math.min(Math.max(lo, 0), segments.length - 1)];
    },
    [measureMap]
  );

  const xToTime = useCallback(
    (x: number) => {
      if (!measureMap) return x / safePxPerSecond;
      const segments = measureMap.segments;
      if (!segments.length) return x / safePxPerSecond;
      if (x <= segments[0].x0) return segments[0].t0;
      if (x >= segments[segments.length - 1].x1) return segments[segments.length - 1].t1;
      let lo = 0;
      let hi = segments.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (segments[mid].x0 <= x) lo = mid;
        else hi = mid;
      }
      const seg = segments[Math.min(Math.max(lo, 0), segments.length - 1)];
      const span = seg.x1 - seg.x0 || 1;
      const ratio = clamp((x - seg.x0) / span, 0, 1);
      return seg.t0 + ratio * (seg.t1 - seg.t0);
    },
    [measureMap, safePxPerSecond]
  );

  const windowWidth = Math.max(1, timeToX(windowEnd) - timeToX(windowStart));
  const timelineWidth = Math.max(1, leftGutter + windowWidth);
  const playheadX = leftGutter + (timeToX(playhead) - timeToX(windowStart));

  const barMarkers = useMemo(() => {
    if (!showBars) return [] as { t: number; index: number }[];
    const bars = (scoreDoc.events || [])
      .filter((e) => e.type === 'bar')
      .map((e) => e.t0)
      .filter((t) => t >= windowStart && t <= windowEnd)
      .sort((a, b) => a - b);
    return bars.map((t, idx) => ({ t, index: idx }));
  }, [scoreDoc, showBars, windowStart, windowEnd]);

  const beatMarkers = useMemo(() => {
    if (!showBeats || !scoreDoc.tempoInfo) return [] as number[];
    const beatSeconds = scoreDoc.tempoInfo.ticksPerBeat * scoreDoc.tempoInfo.secondsPerTick;
    if (!Number.isFinite(beatSeconds) || beatSeconds <= 0) return [];
    const startBeat = Math.floor(windowStart / beatSeconds);
    const endBeat = Math.ceil(windowEnd / beatSeconds);
    const barKeys = new Set(barMarkers.map((b) => Math.round(b.t * 1000)));
    const beats: number[] = [];
    for (let i = startBeat; i <= endBeat; i += 1) {
      const t = i * beatSeconds;
      if (t < windowStart || t > windowEnd) continue;
      if (barKeys.has(Math.round(t * 1000))) continue;
      beats.push(t);
    }
    return beats;
  }, [showBeats, scoreDoc, barMarkers, windowStart, windowEnd]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const localX = x - leftGutter;
      if (localX < 0) return;
      const t = xToTime(timeToX(windowStart) + localX);
      onSeek(clamp(t, 0, scoreDoc.totalDuration || 0));
    },
    [leftGutter, onSeek, scoreDoc.totalDuration, timeToX, windowStart, xToTime]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const horizontalIntent = absX > absY || e.shiftKey;
      if (!horizontalIntent) return;
      e.preventDefault();
      const deltaPixels = absX > absY ? e.deltaX : e.deltaY;
      const deltaSeconds = deltaPixels / Math.max(1, safePxPerSecond);
      const next = clamp(playhead + deltaSeconds, 0, scoreDoc.totalDuration || 0);
      onSeek(next);
    },
    [playhead, safePxPerSecond, onSeek, scoreDoc.totalDuration]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="text-[12px] font-semibold text-gray-300">Voices:</div>
        <button
          className={`px-2 py-1 rounded border text-[11px] ${hiddenVoiceIds.size === 0 ? 'bg-emerald-900/50 text-emerald-200 border-emerald-700' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}
          onClick={() => setHiddenVoiceIds(new Set())}
        >
          All
        </button>
        {orderedVoices.map((v, index) => {
          const isHidden = hiddenVoiceIds.has(v.voiceId);
          const isFirst = index === 0;
          const isLast = index === orderedVoices.length - 1;
          return (
            <div key={v.voiceId} className="flex items-center gap-1">
              <div
                className={`px-2 py-1 rounded border text-[11px] ${isHidden ? 'bg-gray-900 text-gray-500 border-gray-800 line-through' : 'bg-gray-800 text-gray-300 border-gray-700'}`}
                title={v.label || v.voiceId}
              >
                {(v.label || v.voiceId).slice(0, 18)}
              </div>
              <button
                className={`px-1.5 py-1 rounded border text-[10px] ${isHidden ? 'bg-gray-900 text-gray-400 border-gray-800' : 'bg-emerald-900/50 text-emerald-200 border-emerald-700 hover:bg-emerald-800'} `}
                onClick={() => {
                  const next = new Set(hiddenVoiceIds);
                  if (next.has(v.voiceId)) next.delete(v.voiceId);
                  else next.add(v.voiceId);
                  setHiddenVoiceIds(next);
                }}
                title={isHidden ? 'Show voice' : 'Hide voice'}
              >
                {isHidden ? 'Show' : 'Hide'}
              </button>
              <button
                className="px-1.5 py-1 rounded border text-[10px] bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 disabled:opacity-40"
                onClick={() => moveVoice(v.voiceId, -1)}
                disabled={isFirst}
                title="Move voice up"
              >
                Up
              </button>
              <button
                className="px-1.5 py-1 rounded border text-[10px] bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 disabled:opacity-40"
                onClick={() => moveVoice(v.voiceId, 1)}
                disabled={isLast}
                title="Move voice down"
              >
                Down
              </button>
            </div>
          );
        })}
      </div>

      <div
        ref={viewportRef}
        className="relative w-full overflow-hidden rounded-xl border border-gray-700 bg-gray-950"
        style={{ userSelect: 'none', height: viewportHeight }}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
      >
        <div className="absolute inset-0">
          {showBars &&
            barMarkers.map((bar) => {
              const x = leftGutter + (timeToX(bar.t) - timeToX(windowStart));
              return (
                <div key={`bar-${bar.index}`} className="absolute top-0 bottom-0" style={{ left: x }}>
                  <div className="w-px h-full bg-white/10" />
                </div>
              );
            })}
          {showBeats &&
            beatMarkers.map((t, idx) => {
              const x = leftGutter + (timeToX(t) - timeToX(windowStart));
              return (
                <div key={`beat-${idx}`} className="absolute top-0 bottom-0" style={{ left: x }}>
                  <div className="w-px h-full bg-white/5" />
                </div>
              );
            })}
        </div>

        <div className="relative" style={{ width: timelineWidth, height: viewportHeight }}>
          {lanes.map((lane, laneIdx) => {
            const top = laneIdx * laneHeight;
            return (
              <div key={lane.voiceId} className="absolute left-0 right-0" style={{ top, height: laneHeight }}>
                <div className="absolute left-0 top-0 bottom-0 w-[160px] border-r border-gray-800 bg-gray-900/95 flex items-center px-2">
                  <div className="text-[11px] font-semibold text-gray-300 truncate" title={lane.label || lane.voiceId}>
                    {lane.label || lane.voiceId}
                  </div>
                </div>

                <div className="absolute left-[160px] right-0 top-0 bottom-0">
                  {lane.groups.map((group) => {
                    const x0 = timeToX(group.t0) - timeToX(windowStart);
                    let x1 = timeToX(group.t1) - timeToX(windowStart);
                    if (stretchMeasures) {
                      const seg = getMeasureSegment(group.t0);
                      if (seg) {
                        const segEndX = seg.x1 - timeToX(windowStart);
                        if (x1 > segEndX) x1 = segEndX;
                      }
                    }
                    const w = Math.max(8, x1 - x0);
                    const isChord = group.events.filter((e) => e.type === 'note').length > 1;
                    const noteCount = group.events.filter((e) => e.type === 'note').length;
                    const contentWidth = Math.max(10, w - 8);
                    const contentHeight = Math.max(10, laneHeight - 12);
                    const lineCount = !useHChroma && displayMode === 'both' ? 2 : 1;
                    const stackScale = clamp(
                      contentHeight / (Math.max(1, noteCount) * Math.max(1, lineCount) * LINE_HEIGHT_PX),
                      MIN_TEXT_SCALE,
                      1
                    );
                    const baseScale = isChord ? getChordTextScale(w, noteCount) : getBarTextScale(w);
                    const textScale = Math.min(baseScale, stackScale);
                    const groupColor = resolveGroupColor(group.events);
                    const fillColor = groupColor ? rgbaFromHex(groupColor, 0.38) : null;
                    const glowColor = groupColor ? rgbaFromHex(groupColor, 0.22) : null;
                    const barStyle = groupColor
                      ? {
                        borderColor: groupColor,
                        backgroundColor: fillColor ?? undefined,
                        boxShadow: glowColor ? `0 0 0 1px ${glowColor}` : undefined
                      }
                      : undefined;

                    return (
                      <div
                        key={group.id}
                        className="absolute"
                        style={{ left: x0, width: w, top: 6, height: laneHeight - 12 }}
                      >
                        <div className="w-full h-full rounded-md border border-gray-700 bg-gray-900 flex items-center justify-center px-1 overflow-hidden" style={barStyle}>
                          {isChord ? (
                            <div
                              className="grid items-center justify-center max-w-full min-w-0 w-full h-full"
                              style={{ gridTemplateRows: `repeat(${noteCount}, minmax(0, 1fr))` }}
                            >
                              {group.events
                                .filter((e) => e.type === 'note')
                                .map((e) => (
                                  <button
                                    key={e.id}
                                    type="button"
                                    className={`leading-none focus:outline-none min-w-0 w-full h-full overflow-hidden ${selectedEventId === e.id ? 'ring-1 ring-emerald-400 rounded-sm' : ''}`}
                                    onClick={(evt) => {
                                      evt.stopPropagation();
                                      onSelectEvent?.(e);
                                    }}
                                  >
                                    {useHChroma ? (
                                      <HChromaLabel event={e} labelMode={hChromaLabelMode} labels={hChromaLabels} textScale={textScale} maxWidthPx={contentWidth} />
                                    ) : (
                                      <RatioLabel
                                        event={e}
                                        displayMode={displayMode}
                                        showOctaveFolding={showOctaveFolding}
                                        ratioFormatMode={ratioFormatMode}
                                        ratioAutoPowerDigits={ratioAutoPowerDigits}
                                        ratioCustomSymbols={ratioCustomSymbols}
                                        textScale={textScale}
                                        maxWidthPx={contentWidth}
                                      />
                                    )}
                                  </button>
                                ))}
                            </div>
                          ) : (
                            group.events.map((e) => (
                              <button
                                key={e.id}
                                type="button"
                                className={`w-full h-full focus:outline-none ${selectedEventId === e.id ? 'ring-1 ring-emerald-400 rounded-sm' : ''}`}
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  onSelectEvent?.(e);
                                }}
                              >
                                {useHChroma ? (
                                  <HChromaLabel event={e} labelMode={hChromaLabelMode} labels={hChromaLabels} textScale={textScale} maxWidthPx={contentWidth} />
                                ) : (
                                  <RatioLabel
                                    event={e}
                                    displayMode={displayMode}
                                    showOctaveFolding={showOctaveFolding}
                                    ratioFormatMode={ratioFormatMode}
                                    ratioAutoPowerDigits={ratioAutoPowerDigits}
                                    ratioCustomSymbols={ratioCustomSymbols}
                                    textScale={textScale}
                                    maxWidthPx={contentWidth}
                                  />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute left-[160px] top-0 bottom-0">
          <div className="absolute top-0 bottom-0 w-px bg-emerald-400" style={{ left: playheadX }} />
        </div>

        <InstantaneousChordDisplay scoreDoc={scoreDoc} playhead={playhead} hiddenVoiceIds={hiddenVoiceIds} />
      </div>
    </div>
  );
};


