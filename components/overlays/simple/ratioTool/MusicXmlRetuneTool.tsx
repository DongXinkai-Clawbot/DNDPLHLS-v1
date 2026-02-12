import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { formatRatio, getFrequency, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio, simplify } from '../../../../musicLogic';
import type { NodeData } from '../../../../types';
import { startFrequency } from '../../../../audioEngine';
import { DEFAULT_SETTINGS } from '../../../../constants';
import type { RatioDisplayMode, ScoreDocument, ScoreEvent } from '../../../../domain/scoreTimeline/types';
import { buildHChromaScale, type LayoutScale } from '../../settingsTabsPart2/midiFileRetune/utils';

import { extractMusicXmlFromMxl } from '../../../../domain/musicxml/parseMxl';
import { parseMusicXmlString } from '../../../../domain/musicxml/parseMusicXml';
import { buildScoreDocumentFromMusicXml, type RetunedEventInfo } from '../../../../domain/musicxml/buildScoreDocument';
import { retuneMusicXml, type MusicXmlRetuneMode } from '../../../../domain/musicxml/retuneMusicXml';
import type { ScalaArchiveScale } from '../../../../utils/scalaArchive';

import type { MusicXmlImportResult } from '../../../../domain/musicxml/types';
import { useStore } from '../../../../store/storeImpl';
import { MusicXmlRetunePanel } from './musicXmlRetune/MusicXmlRetunePanel';
import { applyRatioOverrides, buildRetuneScaleFromLibrary, clamp, lerp, lerpHue01, midiNoteToFrequency, mixHSL, mixRgbFromWeights, normalizeFrac, parseScaleText, primaryWeightsFromHue, spectrumColorFromFrac, useRafLoop, buildHChromaEventLabelMap } from './musicXmlRetune/helpers';
import type { ScorePresentationMode, HChromaLabelMode, HChromaEventLabel } from './musicXmlRetune/MusicXmlJiScoreViewer';

type Props = {
  nodes?: NodeData[];
  settings?: any;
};
export const MusicXmlRetuneTool = ({ nodes = [], settings }: Props) => {
  const [fileName, setFileName] = useState<string>('');
  const [importResult, setImportResult] = useState<MusicXmlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savedMidiScales = useStore(s => s.savedMidiScales);
  const saveMidiScale = useStore(s => s.saveMidiScale);
  const updateSettings = useStore(s => s.updateSettings);
  const [selectedLibraryScaleId, setSelectedLibraryScaleId] = useState<string>('');
  const [showScalaPicker, setShowScalaPicker] = useState(false);

  const [mode, setModeRaw] = useState<MusicXmlRetuneMode>('retune');
  const playbackVisualizationMode = settings?.playbackVisualizationMode || 'SCROLLER';
  const playbackRing = settings?.playbackRing || { scale: 1, showAllLabels: true, showPreferredNames: false, rotationDeg: 0, showUpcoming: false, showDebug: false };
  const ratioDisplay = settings?.visuals?.ratioDisplay || (DEFAULT_SETTINGS.visuals as any).ratioDisplay;
  const ratioFormatMode = (ratioDisplay?.contexts?.musicXmlRetune || 'auto') as 'fraction' | 'primePowers' | 'auto';
  const ratioAutoPowerDigits = Number.isFinite(ratioDisplay?.autoPowerDigits) ? ratioDisplay.autoPowerDigits : 14;

  const ratioCustomSymbols = useMemo(() => {
    if (!settings?.customPrimes) return undefined;
    const map: Record<number, string> = {};
    settings.customPrimes.forEach((cp: any) => {
      if (cp?.symbol?.up) map[cp.prime] = cp.symbol.up;
    });
    return map;
  }, [settings?.customPrimes]);

  // Safer mode switching to prevent audio thread lockup


  // Initial selection
  useEffect(() => {
    if (savedMidiScales.length > 0 && !selectedLibraryScaleId) {
      setSelectedLibraryScaleId(savedMidiScales[0].id);
    }
  }, [savedMidiScales, selectedLibraryScaleId]);

  // Scale + tuning params
  const [baseNote, setBaseNote] = useState(69);
  const [baseFrequency, setBaseFrequency] = useState(440);
  const [sourceA4, setSourceA4] = useState(440);
  const [playSpeed, setPlaySpeed] = useState(1);

  const [customScaleText, setCustomScaleText] = useState('1/1 16/15 9/8 6/5 5/4 4/3 45/32 3/2 8/5 5/3 9/5 15/8');
  const [displayMode, setDisplayMode] = useState<RatioDisplayMode>('fraction');
  const [presentationMode, setPresentationMode] = useState<ScorePresentationMode>('ratio');
  const [hChromaLabelMode, setHChromaLabelMode] = useState<HChromaLabelMode>('harmonic');
  const [showOctaveFolding, setShowOctaveFolding] = useState(true);

  const [pxPerSecond, setPxPerSecond] = useState(120);
  const [preSeconds, setPreSeconds] = useState(6);
  const [postSeconds, setPostSeconds] = useState(12);
  const [laneHeight, setLaneHeight] = useState(56);
  const [showBars, setShowBars] = useState(true);
  const [showBeats, setShowBeats] = useState(false);
  const [stretchMeasures, setStretchMeasures] = useState(false);
  const [measureScaleOverrides, setMeasureScaleOverrides] = useState<Record<number, number>>({});

  // Dynamic tuning params
  const [dynTolerance, setDynTolerance] = useState(45);
  const [dynCandidateLimit, setDynCandidateLimit] = useState(8);
  const [dynDeviationWeight, setDynDeviationWeight] = useState(1);
  const [dynIntervalWeight, setDynIntervalWeight] = useState(1);
  const [dynNoteWeight, setDynNoteWeight] = useState(0.25);

  // Visual playback
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const playStartRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const audioTimeoutsRef = useRef<number[]>([]);
  const activeAudioStopsRef = useRef<Array<(t?: number) => void>>([]);

  const stopAudioPlayback = useCallback(() => {
    audioTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    audioTimeoutsRef.current = [];
    activeAudioStopsRef.current.forEach((stop) => {
      try {
        stop();
      } catch { }
    });
    activeAudioStopsRef.current = [];
  }, []);

  // Safer mode switching to prevent audio thread lockup
  const handleModeChange = useCallback((nextMode: MusicXmlRetuneMode) => {
    if (playing) {
      stopAudioPlayback();
      setPlaying(false);
    }
    // Small timeout to let React/Audio engine clear state before heavy retune calculation
    setTimeout(() => {
      setModeRaw(nextMode);
    }, 10);
  }, [playing, stopAudioPlayback]);

  const [hiddenVoiceIds, setHiddenVoiceIds] = useState<Set<string>>(new Set());

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setBusy(true);
    setImportResult(null);
    setHiddenVoiceIds(new Set());
    setMeasureScaleOverrides({});
    stopAudioPlayback();
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const buf = await file.arrayBuffer();
      let xmlText = '';
      if (ext === 'mxl') {
        const extracted = await extractMusicXmlFromMxl(buf);
        xmlText = extracted.xmlText;
      } else {
        xmlText = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf));
      }
      const parsed = parseMusicXmlString(xmlText, { ticksPerQuarter: 480, sourceType: ext === 'mxl' ? 'mxl' : 'xml' });
      setImportResult(parsed);
      setFileName(file.name);
      setPlayhead(0);
      setPlaying(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to parse MusicXML/MXL');
    } finally {
      setBusy(false);
    }
  }, [stopAudioPlayback]);

  const handleImportScala = useCallback((id: string | null, scale: ScalaArchiveScale | null) => {
    if (scale) {
      // Save to library
      const name = scale.displayName || 'Imported Scala';
      saveMidiScale(name, scale.ratios);
      // Try to find the newly saved scale ID
      // Since saving is sync, we can probably find it immediately or need a small effect
      // For now, we rely on the component re-rendering with the new list
      setShowScalaPicker(false);
    }
  }, [saveMidiScale]);

  // Auto-select latest imported scale if it matches
  useEffect(() => {
    if (savedMidiScales.length > 0) {
      // If we just imported something, it might be the last one
      // But we don't want to auto-switch freely. 
      // Only switch if we don't have a valid selection?
      // Or maybe check if the last added one matches our 'just imported' intent?
      // Simpler: if selectedLibraryScaleId is empty, select first.
      if (!selectedLibraryScaleId) {
        setSelectedLibraryScaleId(savedMidiScales[0].id);
      }
    }
  }, [savedMidiScales, selectedLibraryScaleId]);

  const onFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await handleFile(file);
    },
    [handleFile]
  );

  const { scale: customScale, errors: customScaleErrors } = useMemo(() => parseScaleText(customScaleText), [customScaleText]);

  const retuneScale = useMemo(() => buildRetuneScaleFromLibrary(savedMidiScales, selectedLibraryScaleId), [savedMidiScales, selectedLibraryScaleId]);

  const [scoreDoc, setScoreDoc] = useState<any>(null); // Replace with proper type if available, e.g. ScoreDocument
  const [baseTuning, setBaseTuning] = useState<Map<string, RetunedEventInfo> | null>(null);
  const [ratioOverrides, setRatioOverrides] = useState<Record<string, string>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [ratioInput, setRatioInput] = useState<string>('');
  const [ratioError, setRatioError] = useState<string | null>(null);

  useEffect(() => {
    if (!importResult) {
      setBaseTuning(null);
      setScoreDoc(null);
      return;
    }

    setBusy(true);
    // Defer processing to prevent UI lockup
    const timer = setTimeout(() => {
      try {
        const tuning = retuneMusicXml(importResult, {
          mode,
          customScale,
          retuneScale,
          latticeNodes: nodes,
          baseNote,
          baseFrequency,
          sourceA4,
          dynamic: {
            toleranceCents: dynTolerance,
            candidateLimit: dynCandidateLimit,
            deviationWeight: dynDeviationWeight,
            intervalWeight: dynIntervalWeight,
            noteWeight: dynNoteWeight
          }
        });
        setBaseTuning(tuning);
      } catch (e) {
        console.error("Retuning failed", e);
        setError("Retuning calculation failed");
      } finally {
        setBusy(false);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [importResult, mode, customScale, retuneScale, nodes, baseNote, baseFrequency, sourceA4, dynTolerance, dynCandidateLimit, dynDeviationWeight, dynIntervalWeight, dynNoteWeight]);

  const effectiveTuning = useMemo(() => {
    if (!baseTuning) return null;
    return applyRatioOverrides(baseTuning, ratioOverrides);
  }, [baseTuning, ratioOverrides]);

  useEffect(() => {
    if (!importResult || !effectiveTuning) {
      setScoreDoc(null);
      return;
    }
    const doc = buildScoreDocumentFromMusicXml(importResult, effectiveTuning, {
      speed: playSpeed,
      baseNote
    });
    setScoreDoc(doc);
  }, [importResult, effectiveTuning, playSpeed, baseNote]);

  const eventById = useMemo(() => {
    const map = new Map<string, ScoreEvent>();
    if (!scoreDoc) return map;
    scoreDoc.voices.forEach((voice: any) => {
      voice.events.forEach((event: any) => {
        map.set(event.id, event);
      });
    });
    return map;
  }, [scoreDoc]);

  useEffect(() => {
    if (!selectedEventId) {
      setRatioInput('');
      setRatioError(null);
      return;
    }
    const event = eventById.get(selectedEventId);
    setRatioInput(event?.ratio ?? '');
    setRatioError(null);
  }, [eventById, selectedEventId]);

  const handleApplyRatioOverride = useCallback(() => {
    if (!selectedEventId) return;
    const raw = ratioInput.trim();
    if (!raw) {
      setRatioOverrides((prev) => {
        const next = { ...prev };
        delete next[selectedEventId];
        return next;
      });
      setRatioError(null);
      return;
    }
    try {
      const frac = simplify(parseGeneralRatio(raw));
      const canonical = `${frac.n}/${frac.d}`;
      setRatioOverrides((prev) => ({ ...prev, [selectedEventId]: canonical }));
      setRatioInput(canonical);
      setRatioError(null);
    } catch (e) {
      setRatioError('Invalid ratio. Use a/b format like 7/6.');
    }
  }, [ratioInput, selectedEventId]);

  const handleClearRatioOverride = useCallback(() => {
    if (!selectedEventId) return;
    setRatioOverrides((prev) => {
      const next = { ...prev };
      delete next[selectedEventId];
      return next;
    });
    const event = eventById.get(selectedEventId);
    setRatioInput(event?.ratio ?? '');
    setRatioError(null);
  }, [eventById, selectedEventId]);

  const updateRatioDisplay = useCallback((patch: { autoPowerDigits?: number; contexts?: { musicXmlRetune?: string } }) => {
    const current = settings?.visuals?.ratioDisplay || (DEFAULT_SETTINGS.visuals as any).ratioDisplay;
    const next = {
      ...current,
      ...patch,
      contexts: { ...(current?.contexts || {}), ...(patch?.contexts || {}) }
    };
    updateSettings({ visuals: { ...settings.visuals, ratioDisplay: next } });
  }, [settings.visuals, updateSettings]);

  const hChromaScale = useMemo(() => {
    const baseA = clamp(Number(settings?.visuals?.hChromaBase ?? 2), 1.01, 50);
    const limit = clamp(Number(settings?.visuals?.hChromaLimit ?? 47), 1, 256);
    return buildHChromaScale(baseA, limit, settings?.visuals?.hChromaCustomScale);
  }, [settings?.visuals?.hChromaBase, settings?.visuals?.hChromaLimit, settings?.visuals?.hChromaCustomScale]);

  const hChromaColorForRatio = useMemo(() => {
    const visuals = settings?.visuals || {};
    const baseA = clamp(Number(visuals.hChromaBase ?? 2), 1.01, 50);
    const lnA = Math.log(baseA);
    const primaryA = new THREE.Color(visuals.hChromaPrimaryA ?? '#ff0000');
    const primaryB = new THREE.Color(visuals.hChromaPrimaryB ?? '#0000ff');
    const primaryC = new THREE.Color(visuals.hChromaPrimaryC ?? '#ffff00');
    const anchors = (() => {
      const startFrac = normalizeFrac(Math.log(2) / lnA);
      const yellowFrac = normalizeFrac(Math.log(5) / lnA);
      const blueFrac = normalizeFrac(Math.log(3) / lnA);
      const yellowT = ((yellowFrac - startFrac) % 1 + 1) % 1;
      const blueT = ((blueFrac - startFrac) % 1 + 1) % 1;
      return { startFrac, yellowT, blueT };
    })();
    const colorMode = visuals.hChromaColorMode ?? 'pure';

    return (ratioValue: number) => {
      if (!Number.isFinite(ratioValue) || ratioValue <= 0 || !Number.isFinite(lnA)) return null;
      const frac = normalizeFrac(Math.log(ratioValue) / lnA);
      const primaries = { a: primaryA, b: primaryB, c: primaryC };
      let color: THREE.Color;
      if (colorMode === 'primaryRatio') {
        const weights = primaryWeightsFromHue(frac * 360);
        color = mixRgbFromWeights(weights, primaries);
      } else {
        color = spectrumColorFromFrac(frac, anchors, primaries);
      }
      return `#${color.getHexString()}`;
    };
  }, [
    settings?.visuals?.hChromaBase,
    settings?.visuals?.hChromaPrimaryA,
    settings?.visuals?.hChromaPrimaryB,
    settings?.visuals?.hChromaPrimaryC,
    settings?.visuals?.hChromaColorMode
  ]);

  const hChromaLabels = useMemo(() => {
    if (presentationMode !== 'h-chroma') return new Map<string, HChromaEventLabel>();
    return buildHChromaEventLabelMap(scoreDoc, hChromaScale);
  }, [presentationMode, scoreDoc, hChromaScale]);

  const totalDuration = scoreDoc?.totalDuration || 0;

  const noteEvents = useMemo(() => {
    if (!scoreDoc) return [] as ScoreEvent[];
    const events: ScoreEvent[] = [];
    scoreDoc.voices.forEach((voice: any) => {
      voice.events.forEach((event: any) => {
        if (event.type !== 'note') return;
        if (!Number.isFinite(event.t0) || !Number.isFinite(event.t1)) return;
        events.push(event);
      });
    });
    return events.sort((a, b) => a.t0 - b.t0);
  }, [scoreDoc]);

  const startAudioPlayback = useCallback(
    (fromSeconds: number) => {
      if (!scoreDoc || noteEvents.length === 0) return;
      stopAudioPlayback();
      const baseHz = Number.isFinite(baseFrequency) && baseFrequency > 0
        ? baseFrequency
        : (settings?.baseFrequency ?? 440);
      const a4Hz = Number.isFinite(sourceA4) && sourceA4 > 0 ? sourceA4 : 440;
      const baseSettings = settings ?? DEFAULT_SETTINGS;
      const playSettings = { ...baseSettings, baseFrequency: baseHz };
      const startAt = Math.max(0, fromSeconds);
      const resolveFrequency = (event: ScoreEvent) => {
        if (event.ratioFraction) {
          return getFrequency(baseHz, event.ratioFraction);
        }
        if (event.ratio) {
          try {
            const f = parseGeneralRatio(event.ratio);
            if (f.n > 0n && f.d > 0n) return getFrequency(baseHz, f);
          } catch { }
        }
        const midiNote = event.midi?.noteNumber;
        if (Number.isFinite(midiNote)) {
          return midiNoteToFrequency(midiNote as number, a4Hz);
        }
        return null;
      };

      noteEvents.forEach((event) => {
        if (event.t1 <= startAt) return;
        const offset = Math.max(0, startAt - event.t0);
        const duration = Math.max(0, event.duration - offset);
        if (duration <= 0) return;
        const delayMs = Math.max(0, (event.t0 - startAt) * 1000);
        const startId = window.setTimeout(() => {
          const freq = resolveFrequency(event);
          if (!freq || !Number.isFinite(freq)) return;
          const stop = startFrequency(freq, playSettings as any, 'sequence', 0, undefined, { velocity: 0.85 }, event.ratio || event.nodeId || event.id);
          activeAudioStopsRef.current.push(stop);
          const stopId = window.setTimeout(() => {
            stop();
            activeAudioStopsRef.current = activeAudioStopsRef.current.filter((s) => s !== stop);
          }, Math.max(20, duration * 1000));
          audioTimeoutsRef.current.push(stopId);
        }, delayMs);
        audioTimeoutsRef.current.push(startId);
      });
    },
    [scoreDoc, noteEvents, stopAudioPlayback, baseFrequency, sourceA4, settings]
  );

  const startVisualPlay = useCallback(() => {
    if (!scoreDoc) return;
    setPlaying(true);
    playStartRef.current = performance.now();
    playOffsetRef.current = playhead;
    startAudioPlayback(playhead);
  }, [scoreDoc, playhead, startAudioPlayback]);

  const stopVisualPlay = useCallback(() => {
    setPlaying(false);
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  useRafLoop(playing, (t) => {
    const elapsed = (t - playStartRef.current) / 1000;
    const next = playOffsetRef.current + elapsed;
    if (next >= totalDuration) {
      setPlayhead(totalDuration);
      stopAudioPlayback();
      setPlaying(false);
      return;
    }
    setPlayhead(next);
  });

  const onSeek = useCallback((t: number) => {
    const clamped = clamp(t, 0, totalDuration);
    setPlayhead(clamped);
    if (playing) {
      playStartRef.current = performance.now();
      playOffsetRef.current = clamped;
      startAudioPlayback(clamped);
    }
  }, [totalDuration, playing, startAudioPlayback]);

  useEffect(() => {
    stopAudioPlayback();
    setPlaying(false);
  }, [scoreDoc, stopAudioPlayback]);

  useEffect(() => () => stopAudioPlayback(), [stopAudioPlayback]);

  const panelProps = {
    onFileInput,
    busy,
    fileName,
    error,
    importResult,
    scoreDoc,
    totalDuration,
    mode,
    handleModeChange,
    playing,
    stopVisualPlay,
    startVisualPlay,
    onSeek,
    playSpeed,
    setPlaySpeed,
    baseNote,
    setBaseNote,
    baseFrequency,
    setBaseFrequency,
    sourceA4,
    setSourceA4,
    presentationMode,
    setPresentationMode,
    displayMode,
    setDisplayMode,
    hChromaLabelMode,
    setHChromaLabelMode,
    showOctaveFolding,
    setShowOctaveFolding,
    showBars,
    setShowBars,
    showBeats,
    setShowBeats,
    stretchMeasures,
    setStretchMeasures,
    measureScaleOverrides,
    setMeasureScaleOverrides,
    customScaleText,
    setCustomScaleText,
    customScale,
    customScaleErrors,
    showScalaPicker,
    setShowScalaPicker,
    handleImportScala,
    selectedLibraryScaleId,
    setSelectedLibraryScaleId,
    savedMidiScales,
    retuneScale,
    dynTolerance,
    setDynTolerance,
    dynCandidateLimit,
    setDynCandidateLimit,
    dynDeviationWeight,
    setDynDeviationWeight,
    dynIntervalWeight,
    setDynIntervalWeight,
    dynNoteWeight,
    setDynNoteWeight,
    pxPerSecond,
    setPxPerSecond,
    preSeconds,
    setPreSeconds,
    postSeconds,
    setPostSeconds,
    laneHeight,
    setLaneHeight,
    playhead,
    selectedEventId,
    setSelectedEventId,
    eventById,
    ratioInput,
    setRatioInput,
    handleApplyRatioOverride,
    handleClearRatioOverride,
    ratioError,
    hiddenVoiceIds,
    setHiddenVoiceIds,
    hChromaLabels,
    hChromaColorForRatio,
    ratioFormatMode,
    ratioAutoPowerDigits,
    ratioCustomSymbols,
    onRatioFormatModeChange: (mode: 'fraction' | 'primePowers' | 'auto') =>
      updateRatioDisplay({ contexts: { musicXmlRetune: mode } }),
    onRatioAutoPowerDigitsChange: (value: number) =>
      updateRatioDisplay({ autoPowerDigits: Math.max(6, Math.min(50, Math.round(value))) }),
    playbackVisualizationMode,
    ringSettings: playbackRing,
    onPlaybackModeChange: (next: 'SCROLLER' | 'HUNT205_RING') => updateSettings({ playbackVisualizationMode: next }),
    onPlaybackRingChange: (partial: { scale?: number; showAllLabels?: boolean; showPreferredNames?: boolean; rotationDeg?: number; showUpcoming?: boolean; showDebug?: boolean }) =>
      updateSettings({ playbackRing: { ...playbackRing, ...partial } })
  };

  return <MusicXmlRetunePanel {...panelProps} />;
};
