import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from '../../store';
import { DEFAULT_INTERACTION_STATE, DEFAULT_RATIO_CONTEXT, NotationSystem } from '../../domain/notation';
import type { InteractionState, RenderView, SyncStatus, TemporalState } from '../../domain/notation';
import { EDO_PRESETS } from '../../constants';
import { startFrequency } from '../../audioEngine';
import { getFrequency, parseGeneralRatio } from '../../musicLogic';
import { generateEdoScale, type MidiNoteInfo } from '../../utils/midiFileRetune';
import { loadScalaScale, type ScalaArchiveScale } from '../../utils/scalaArchive';
import { buildHChromaScale, buildNodeScale, snapScaleToLayout } from './settingsTabsPart2/midiFileRetune/utils';

const DEFAULT_TEXT = '1 2 3 4 | 5 6 7 1.';
const STORAGE_KEY = 'pure-ratio-score-input-v1';

const readStoredScoreInput = () => {
  if (typeof window === 'undefined') return DEFAULT_TEXT;
  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_TEXT;
    return stored.trim().length > 0 ? stored : DEFAULT_TEXT;
  } catch {
    return DEFAULT_TEXT;
  }
};

const coerceBaseNote = (value: number | undefined) => (
  Number.isFinite(value) ? (value as number) : 69
);

const toScaleFraction = (ratio: string) => {
  const parsed = parseGeneralRatio(ratio || '');
  if (parsed.n === 0n || parsed.d === 0n) {
    return DEFAULT_RATIO_CONTEXT.scaleMap[1];
  }
  return parsed;
};

const buildScaleMap = (scale: string[]) => {
  if (!scale.length) return DEFAULT_RATIO_CONTEXT.scaleMap;
  const map: Record<number, { n: bigint; d: bigint }> = {};
  scale.forEach((ratio, index) => {
    map[index + 1] = toScaleFraction(ratio);
  });
  return map;
};

const buildMidiNotation = (notes: MidiNoteInfo[], scaleSize: number, baseNote: number) => {
  if (!notes.length || scaleSize <= 0) return '';
  const sorted = [...notes].sort((a, b) => {
    if (a.startTick !== b.startTick) return a.startTick - b.startTick;
    if (a.noteNumber !== b.noteNumber) return a.noteNumber - b.noteNumber;
    return (a.trackIndex ?? 0) - (b.trackIndex ?? 0);
  });

  const parts: string[] = [];
  let idx = 0;
  while (idx < sorted.length) {
    const startTick = sorted[idx].startTick;
    const chordTokens: string[] = [];

    while (idx < sorted.length && sorted[idx].startTick === startTick) {
      const note = sorted[idx];
      const stepsFromBase = note.noteNumber - baseNote;
      const degreeIndex = ((stepsFromBase % scaleSize) + scaleSize) % scaleSize;
      const octaves = Math.floor((stepsFromBase - degreeIndex) / scaleSize);
      const octaveMarks = octaves > 0 ? '.'.repeat(octaves) : octaves < 0 ? ','.repeat(-octaves) : '';
      chordTokens.push(`${degreeIndex + 1}${octaveMarks}`);
      idx += 1;
    }

    if (chordTokens.length === 1) {
      parts.push(chordTokens[0]);
    } else if (chordTokens.length > 1) {
      parts.push(`[${chordTokens.join(' ')}]`);
    }
  }

  return parts.join(' ');
};

type PureRatioScorePanelProps = {
  onClose?: () => void;
  isCompact?: boolean;
  isEmbedded?: boolean;
};

type PlayingRatioEntry = {
  ratio: string;
  velocity: number;
  channel?: number;
  trackIndex?: number;
  nodeId?: string;
};

export const PureRatioScorePanel = ({ onClose, isCompact, isEmbedded }: PureRatioScorePanelProps) => {
  const {
    selectedNode,
    baseFrequency,
    nodes,
    selectNode,
    playingRatios,
    setPlayingRatios,
    retunePreviewActive,
    settings,
    midiImportResult,
    midiTargetMode,
    midiSelectedScaleId,
    midiScalaScaleId,
    midiScalaSource,
    midiEdoDivisions,
    midiBaseNote,
    midiRestrictToNodes,
    midiCustomScale,
    savedMidiScales
  } = useStore(
    (s) => ({
      selectedNode: s.selectedNode,
      baseFrequency: s.settings.baseFrequency,
      nodes: s.nodes,
      selectNode: s.selectNode,
      playingRatios: s.playingRatios,
      setPlayingRatios: s.setPlayingRatios,
      retunePreviewActive: s.midiRetuner?.retunePreviewActive,
      settings: s.settings,
      midiImportResult: s.midiRetuner?.importResult,
      midiTargetMode: s.midiRetuner?.targetMode,
      midiSelectedScaleId: s.midiRetuner?.selectedScaleId,
      midiScalaScaleId: s.midiRetuner?.scalaScaleId,
      midiScalaSource: s.midiRetuner?.scalaSource,
      midiEdoDivisions: s.midiRetuner?.edoDivisions,
      midiBaseNote: s.midiRetuner?.baseNote,
      midiRestrictToNodes: s.midiRetuner?.restrictToNodes,
      midiCustomScale: s.midiRetuner?.retuneCustomScale,
      savedMidiScales: s.savedMidiScales
    }),
    shallow
  );

  const systemRef = useRef<NotationSystem | null>(null);
  if (!systemRef.current) {
    systemRef.current = new NotationSystem({
      ratioContext: DEFAULT_RATIO_CONTEXT,
      interaction: DEFAULT_INTERACTION_STATE
    });
  }

  const system = systemRef.current;
  const listRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLatticeSelectionIdRef = useRef<string | null>(null);
  const suppressLatticeFollowRef = useRef<string | null>(null);
  const suppressRetuneFollowRef = useRef(false);
  const lastRetuneRatioRef = useRef<string | null>(null);
  const activeAudioStopRef = useRef<((stopTime?: number) => void) | null>(null);
  const activeAudioTimeoutRef = useRef<number | null>(null);
  const autoAudioArmedRef = useRef(false);

  const hasMidiImport = !!midiImportResult?.notes?.length;
  const sourceOverrideRef = useRef(false);
  const [loadedScalaScale, setLoadedScalaScale] = useState<ScalaArchiveScale | null>(null);

  const [manualInputText, setManualInputText] = useState(() => readStoredScoreInput());
  const [sourceMode, setSourceMode] = useState<'manual' | 'midi'>(() => (hasMidiImport ? 'midi' : 'manual'));
  const [controls, setControls] = useState<InteractionState>(DEFAULT_INTERACTION_STATE);
  const [renderView, setRenderView] = useState<RenderView | null>(null);
  const [temporal, setTemporal] = useState<TemporalState | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(90);
  const [followLattice, setFollowLattice] = useState(false);
  const [followRetune, setFollowRetune] = useState(false);

  const layoutMode = settings?.visuals?.layoutMode || 'lattice';
  const nodeScale = useMemo(() => buildNodeScale(nodes), [nodes]);
  const hChromaScale = useMemo(() => {
    const baseA = Math.max(1.01, Number(settings?.visuals?.hChromaBase ?? 2));
    const limit = Number(settings?.visuals?.hChromaLimit ?? 47);
    return buildHChromaScale(baseA, limit, settings?.visuals?.hChromaCustomScale);
  }, [settings?.visuals?.hChromaBase, settings?.visuals?.hChromaLimit, settings?.visuals?.hChromaCustomScale]);
  const layoutScale = useMemo(
    () => (layoutMode === 'h-chroma' ? hChromaScale : nodeScale),
    [layoutMode, hChromaScale, nodeScale]
  );

  useEffect(() => {
    if (midiScalaSource !== 'archive' || !midiScalaScaleId) {
      setLoadedScalaScale(null);
      return;
    }
    let cancelled = false;
    loadScalaScale(midiScalaScaleId)
      .then((scale) => {
        if (!cancelled) setLoadedScalaScale(scale);
      })
      .catch(() => {
        if (!cancelled) setLoadedScalaScale(null);
      });
    return () => {
      cancelled = true;
    };
  }, [midiScalaSource, midiScalaScaleId]);

  const targetScale = useMemo(() => {
    let scale: string[] = [];
    let label = '';

    if (midiTargetMode === 'lattice' || midiTargetMode === 'dynamic') {
      scale = layoutScale.scale;
      label = midiTargetMode === 'dynamic' ? 'Dynamic Lattice' : 'Lattice';
    } else if (midiTargetMode === 'custom') {
      scale = midiCustomScale || [];
      label = 'Custom';
    } else if (midiTargetMode === 'scale') {
      if (midiScalaSource === 'archive') {
          if (loadedScalaScale) {
            scale = loadedScalaScale.ratios;
            label = loadedScalaScale.displayName || loadedScalaScale.fileName || 'Scala';
          } else {
          scale = [];
          label = 'Scala';
        }
      } else {
        const saved = savedMidiScales.find((s) => s.id === midiSelectedScaleId);
        scale = saved ? saved.scale : [];
        label = saved?.name || 'Saved';
      }
    } else {
      const divisions = Number.isFinite(midiEdoDivisions) ? (midiEdoDivisions as number) : 12;
      const preset = EDO_PRESETS[divisions];
      scale = preset ? [...preset] : generateEdoScale(divisions);
      label = `${divisions}-EDO`;
    }

    if (midiRestrictToNodes && scale.length && midiTargetMode !== 'lattice' && midiTargetMode !== 'dynamic') {
      const snapped = snapScaleToLayout(scale, layoutScale);
      scale = snapped.scale;
      label = label ? `${label} (snapped)` : 'Snapped';
    }

    if (!scale.length) scale = ['1/1'];

    return { scale, label };
  }, [
    midiTargetMode,
    midiCustomScale,
    midiScalaSource,
    loadedScalaScale,
    savedMidiScales,
    midiSelectedScaleId,
    midiEdoDivisions,
    midiRestrictToNodes,
    layoutScale
  ]);

  const resolvedBaseNote = coerceBaseNote(midiBaseNote);
  const midiNotationText = useMemo(() => {
    if (!midiImportResult?.notes?.length) return '';
    return buildMidiNotation(midiImportResult.notes, targetScale.scale.length, resolvedBaseNote);
  }, [midiImportResult, resolvedBaseNote, targetScale.scale.length]);

  const midiRatioContext = useMemo(() => ({
    tonic: DEFAULT_RATIO_CONTEXT.tonic,
    accidentalRatios: DEFAULT_RATIO_CONTEXT.accidentalRatios,
    octaveRatio: DEFAULT_RATIO_CONTEXT.octaveRatio,
    scaleMap: buildScaleMap(targetScale.scale)
  }), [targetScale.scale]);

  const activeText = sourceMode === 'midi' ? midiNotationText : manualInputText;
  const midiNoteCount = midiImportResult?.notes?.length ?? 0;
  const midiFileName = midiImportResult?.fileName || 'MIDI input';
  const midiScaleSuffix = targetScale.label ? ` (${targetScale.label})` : '';

  const matchNodeByPrimeVector = useCallback(
    (primeVector: Record<number, number>) => {
      if (!primeVector) return null;
      const targetKeys = Object.keys(primeVector);
      return nodes.find((node) => {
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
      }) ?? null;
    },
    [nodes]
  );

  const pickRetuneRatio = useCallback((ratios: Map<string, PlayingRatioEntry>) => {
    let best: PlayingRatioEntry | null = null;
    for (const entry of ratios.values()) {
      if (!best || entry.velocity > best.velocity) {
        best = entry;
      }
    }
    return best?.ratio ?? null;
  }, []);

  const stopActiveAudio = useCallback(() => {
    if (activeAudioTimeoutRef.current !== null) {
      window.clearTimeout(activeAudioTimeoutRef.current);
      activeAudioTimeoutRef.current = null;
    }
    if (activeAudioStopRef.current) {
      activeAudioStopRef.current();
      activeAudioStopRef.current = null;
    }
  }, []);

  useEffect(() => {
    const nextContext = sourceMode === 'midi' ? midiRatioContext : DEFAULT_RATIO_CONTEXT;
    system.setRatioContext(nextContext);
  }, [midiRatioContext, sourceMode, system]);

  useEffect(() => {
    if (sourceOverrideRef.current) {
      if (!hasMidiImport && sourceMode === 'midi') {
        setSourceMode('manual');
      }
      return;
    }
    const next = hasMidiImport ? 'midi' : 'manual';
    if (next !== sourceMode) {
      setSourceMode(next);
    }
  }, [hasMidiImport, sourceMode]);

  useEffect(() => {
    system.rendering.setConfig({ baseFrequency });
  }, [baseFrequency, system.rendering]);

  useEffect(() => {
    system.updateControls(controls);
  }, [controls, system]);

  useEffect(() => {
    const stopRender = system.on('render:view', setRenderView);
    const stopTemporal = system.on('temporal:updated', setTemporal);
    const stopSync = system.on('sync:status', setSyncStatus);
    const stopRetuneRequest = system.on('sync:request-retune', ({ ratio }) => {
      if (retunePreviewActive) return;
      const ratioLabel = `${ratio.n}/${ratio.d}`;
      const next = new Map<string, PlayingRatioEntry>();
      next.set('0-score', { ratio: ratioLabel, velocity: 1, channel: 0 });
      suppressRetuneFollowRef.current = true;
      lastRetuneRatioRef.current = ratioLabel;
      setPlayingRatios(next);
    });
    const stopLatticeRequest = system.on('sync:request-lattice', ({ primeVector }) => {
      const node = matchNodeByPrimeVector(primeVector as Record<number, number>);
      if (!node) return;
      suppressLatticeFollowRef.current = node.id;
      selectNode(node, false, false, false);
    });
    const stopAudioRequest = system.on('sync:request-audio', ({ ratio }) => {
      const safeBase = Number.isFinite(baseFrequency) ? baseFrequency : 440;
      const freq = getFrequency(safeBase, ratio);
      if (!Number.isFinite(freq) || freq <= 0) return;
      stopActiveAudio();
      activeAudioStopRef.current = startFrequency(freq, settings, 'sequence', 0, undefined, { velocity: 0.9 });
      const beatSeconds = 60 / Math.max(20, bpm);
      const durationSeconds = Math.min(4, Math.max(settings.playDurationSingle ?? 0.5, beatSeconds));
      activeAudioTimeoutRef.current = window.setTimeout(() => {
        stopActiveAudio();
      }, durationSeconds * 1000);
    });
    return () => {
      stopRender();
      stopTemporal();
      stopSync();
      stopRetuneRequest();
      stopLatticeRequest();
      stopAudioRequest();
    };
  }, [baseFrequency, bpm, matchNodeByPrimeVector, retunePreviewActive, selectNode, setPlayingRatios, settings, stopActiveAudio, system]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      system.parse(activeText);
    }, 120);
    return () => window.clearTimeout(handle);
  }, [activeText, system]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage?.setItem(STORAGE_KEY, manualInputText);
      } catch {
        // Ignore storage write errors (e.g. private mode or quota).
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [manualInputText]);

  useEffect(() => {
    if (!followLattice || !selectedNode) return;
    if (selectedNode.id === lastLatticeSelectionIdRef.current) return;
    if (selectedNode.id === suppressLatticeFollowRef.current) {
      suppressLatticeFollowRef.current = null;
      lastLatticeSelectionIdRef.current = selectedNode.id;
      return;
    }
    lastLatticeSelectionIdRef.current = selectedNode.id;
    system.handleLatticeSelection(selectedNode.ratio, true);
  }, [followLattice, selectedNode, system]);

  useEffect(() => {
    if (!followRetune || playingRatios.size === 0) return;
    if (suppressRetuneFollowRef.current) {
      suppressRetuneFollowRef.current = false;
      return;
    }
    const ratio = pickRetuneRatio(playingRatios as Map<string, PlayingRatioEntry>);
    if (!ratio || ratio === lastRetuneRatioRef.current) return;
    lastRetuneRatioRef.current = ratio;
    const fraction = parseGeneralRatio(ratio);
    system.handleRetuneConfirmed(fraction, !retunePreviewActive);
  }, [followRetune, pickRetuneRatio, playingRatios, retunePreviewActive, system]);

  useEffect(() => {
    if (!isPlaying) return;
    const start = performance.now();
    const tick = (now: number) => {
      system.updateTransport({ timeMs: now, bpm, beatUnit: 4, startTimeMs: start });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [bpm, isPlaying, system]);

  useEffect(() => {
    if (!renderView || !controls.autoScroll) return;
    if (!listRef.current) return;
    const target = listRef.current.querySelector<HTMLElement>(
      `[data-token-index="${renderView.currentIndex}"]`
    );
    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }, [controls.autoScroll, renderView]);

  useEffect(() => {
    if (controls.autoAudio) return;
    stopActiveAudio();
  }, [controls.autoAudio, stopActiveAudio]);

  useEffect(() => {
    if (!controls.autoAudio) return;
    if (!renderView || renderView.currentIndex < 0) {
      stopActiveAudio();
      return;
    }
    const token = renderView.tokens[renderView.currentIndex];
    if (!token || token.isRest || !token.isPlayable) {
      stopActiveAudio();
    }
  }, [controls.autoAudio, renderView, stopActiveAudio]);

  useEffect(() => {
    return () => stopActiveAudio();
  }, [stopActiveAudio]);

  const syncLabel = useMemo(() => {
    if (!syncStatus) return 'Idle';
    if (syncStatus.mode === 'observing') return 'Observing';
    return 'Synced';
  }, [syncStatus]);

  const syncDetail = useMemo(() => {
    if (!syncStatus) return '';
    if (typeof syncStatus.mismatchCents === 'number') {
      return `Deviation ${syncStatus.mismatchCents.toFixed(2)}c`;
    }
    return syncStatus.message || '';
  }, [syncStatus]);

  const displayTokens = useMemo(() => {
    if (!renderView) return [];
    return renderView.tokens.filter(token => token.isPlayable || token.grouping);
  }, [renderView]);

  const currentIndex = renderView?.currentIndex ?? -1;

  const handleParseNow = () => system.parse(activeText);

  const handleReset = () => {
    if (sourceMode !== 'manual') {
      sourceOverrideRef.current = true;
      setSourceMode('manual');
    }
    setManualInputText(DEFAULT_TEXT);
    system.seekToken(0);
  };

  const handlePrev = () => {
    if (currentIndex <= 0) return;
    system.seekToken(currentIndex - 1);
  };

  const handleNext = () => system.advanceToken();

  const toggleControl = (key: keyof InteractionState) => {
    if (key === 'autoAudio') {
      autoAudioArmedRef.current = false;
    }
    setControls((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSourceModeChange = (mode: 'manual' | 'midi') => {
    sourceOverrideRef.current = true;
    setSourceMode(mode);
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        if (!controls.autoAudio) {
          autoAudioArmedRef.current = true;
          setControls((current) => ({ ...current, autoAudio: true }));
        }
      } else {
        stopActiveAudio();
        if (autoAudioArmedRef.current) {
          autoAudioArmedRef.current = false;
          setControls((current) => ({ ...current, autoAudio: false }));
        }
      }
      return next;
    });
  };

  const toggleSyncPriority = () => {
    setControls((prev) => ({
      ...prev,
      syncPriority: prev.syncPriority === 'score' ? 'user' : 'score'
    }));
  };

  const sizeClass = isEmbedded
    ? 'w-full h-full'
    : (isCompact ? 'w-full' : 'w-[360px] max-w-[92vw] max-h-[80vh]');
  const chromeClass = isEmbedded
    ? 'bg-transparent border-0 shadow-none'
    : 'bg-gray-900/95 border border-gray-700 rounded-2xl shadow-2xl backdrop-blur-md';

  return (
    <div
      className={`pointer-events-auto flex flex-col min-h-0 ${sizeClass} ${chromeClass}`}
    >
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-700">
        <div>
          <div className="text-[10px] uppercase font-black tracking-widest text-gray-300">
            Pure Ratio Score
          </div>
          <div className="text-[10px] text-gray-500">
            {syncLabel}{syncDetail ? ` • ${syncDetail}` : ''}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 text-[10px] uppercase font-black tracking-widest text-gray-400 hover:text-white"
          >
            Close
          </button>
        )}
      </div>

        <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
              Notation Input
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-gray-500">Tokens: {renderView?.tokens.length ?? 0}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Source</span>
            <button
              type="button"
              onClick={() => handleSourceModeChange('manual')}
              className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                sourceMode === 'manual'
                  ? 'bg-indigo-700/60 border-indigo-500 text-indigo-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => handleSourceModeChange('midi')}
              disabled={!hasMidiImport}
              className={`px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
                sourceMode === 'midi'
                  ? 'bg-amber-700/60 border-amber-500 text-amber-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              } ${!hasMidiImport ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              MIDI Retune
            </button>
          </div>
          {sourceMode === 'midi' && (
            hasMidiImport ? (
              <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                <span className="shrink-0">MIDI: {midiFileName}</span>
                <span className="shrink-0">Notes: {midiNoteCount}</span>
                <span className="shrink-0">Scale: {targetScale.scale.length}{midiScaleSuffix}</span>
              </div>
            ) : (
              <div className="text-[10px] text-gray-500">
                Load a MIDI file in RETUNE to populate this score.
              </div>
            )
          )}
          <textarea
            value={sourceMode === 'midi' ? midiNotationText : manualInputText}
            onChange={(e) => {
              if (sourceMode !== 'manual') return;
              setManualInputText(e.target.value);
            }}
            readOnly={sourceMode !== 'manual'}
            placeholder={sourceMode === 'midi' && !hasMidiImport ? 'Load a MIDI file in RETUNE to populate this score.' : undefined}
            className={`w-full min-h-[78px] bg-black/60 border border-gray-700 rounded-lg p-2 text-[12px] font-mono outline-none focus:border-blue-500 ${
              sourceMode === 'midi' ? 'text-gray-300 cursor-not-allowed' : 'text-white'
            }`}
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleParseNow}
              className="flex-1 px-3 py-2 rounded-lg border border-blue-600 bg-blue-700/60 text-[10px] font-black uppercase tracking-widest text-white"
            >
              Parse
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Reset
            </button>
          </div>
          </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleControl('autoScroll')}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
              controls.autoScroll
                ? 'bg-indigo-700/60 border-indigo-500 text-indigo-100'
                : 'bg-black/40 border-gray-700 text-gray-300'
            }`}
          >
            Auto Scroll
          </button>
          <button
            type="button"
            onClick={() => toggleControl('autoAdvance')}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
              controls.autoAdvance
                ? 'bg-emerald-700/60 border-emerald-500 text-emerald-100'
                : 'bg-black/40 border-gray-700 text-gray-300'
            }`}
          >
            Auto Advance
          </button>
          <button
            type="button"
            onClick={() => toggleControl('showCents')}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
              controls.showCents
                ? 'bg-blue-700/60 border-blue-500 text-blue-100'
                : 'bg-black/40 border-gray-700 text-gray-300'
            }`}
          >
            Cents
          </button>
          <button
            type="button"
            onClick={() => toggleControl('showHz')}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
              controls.showHz
                ? 'bg-purple-700/60 border-purple-500 text-purple-100'
                : 'bg-black/40 border-gray-700 text-gray-300'
            }`}
          >
            Hz
          </button>
          <button
            type="button"
            onClick={() => toggleControl('showPrimeFactors')}
            className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
              controls.showPrimeFactors
                ? 'bg-amber-700/60 border-amber-500 text-amber-100'
                : 'bg-black/40 border-gray-700 text-gray-300'
            }`}
          >
            Primes
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
              Sync
            </span>
            <button
              type="button"
              onClick={toggleSyncPriority}
              className="ml-auto shrink-0 px-2 py-1 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Priority: {controls.syncPriority === 'score' ? 'Score' : 'User'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleControl('autoRetune')}
              className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                controls.autoRetune
                  ? 'bg-rose-700/60 border-rose-500 text-rose-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Auto Retune
            </button>
            <button
              type="button"
              onClick={() => toggleControl('autoLatticeSync')}
              className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                controls.autoLatticeSync
                  ? 'bg-gray-700 border-gray-500 text-gray-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Auto Lattice
            </button>
            <button
              type="button"
              onClick={() => toggleControl('autoAudio')}
              className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                controls.autoAudio
                  ? 'bg-blue-700/60 border-blue-500 text-blue-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Auto Audio
            </button>
            <button
              type="button"
              onClick={() => setFollowRetune((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                followRetune
                  ? 'bg-amber-700/60 border-amber-500 text-amber-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Follow Retune
            </button>
            <button
              type="button"
              onClick={() => setFollowLattice((prev) => !prev)}
              className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                followLattice
                  ? 'bg-emerald-700/60 border-emerald-500 text-emerald-100'
                  : 'bg-black/40 border-gray-700 text-gray-300'
              }`}
            >
              Follow Lattice
            </button>
          </div>
          {syncStatus?.mode === 'observing' && (
            <button
              type="button"
              onClick={() => system.clearOverride()}
              className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Clear Override
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
              Transport
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-gray-500">
              {temporal ? `Token ${temporal.currentTokenIndex + 1}` : 'No token'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={20}
              max={300}
              value={bpm}
              onChange={(e) => setBpm(Math.max(20, Math.min(300, Number(e.target.value) || 0)))}
              className="w-20 bg-black/60 border border-gray-700 rounded-lg px-2 py-2 text-[12px] text-white font-mono outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">BPM</span>
            <button
              type="button"
              onClick={handleTogglePlay}
              className={`ml-auto shrink-0 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${
                isPlaying
                  ? 'bg-rose-700/60 border-rose-500 text-rose-100'
                  : 'bg-emerald-700/60 border-emerald-500 text-emerald-100'
              }`}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrev}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-black uppercase tracking-widest text-gray-300"
            >
              Next
            </button>
          </div>
          {temporal && (
            <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
              Phase: {temporal.phase}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase font-black tracking-widest text-gray-400">
              Scroll View
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-gray-500">
              {renderView?.visibleRange.start ?? 0} - {renderView?.visibleRange.end ?? 0}
            </span>
          </div>
          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-lg border border-gray-800 bg-black/40"
          >
            {displayTokens.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-gray-500">
                No tokens parsed yet.
              </div>
            )}
            {displayTokens.map((token) => {
              const inRange =
                renderView &&
                token.index >= renderView.visibleRange.start &&
                token.index <= renderView.visibleRange.end;
              return (
                <div
                  key={token.tokenId}
                  data-token-index={token.index}
                  className={`px-3 py-2 border-b border-gray-800 last:border-0 ${
                    token.isCurrent ? 'bg-blue-600/30' : 'bg-transparent'
                  } ${inRange ? 'opacity-100' : 'opacity-40'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[12px] text-white font-mono">
                      <span className="text-gray-500">{token.index + 1}.</span>
                      <span>{token.symbol}</span>
                    </div>
                    <div className="text-[11px] text-blue-200 font-mono">
                      {token.ratioLabel || (token.isRest ? 'rest' : '--')}
                    </div>
                  </div>
                  {(token.extras.cents !== undefined ||
                    token.extras.hz !== undefined ||
                    token.extras.primeFactors) && (
                    <div className="mt-1 text-[10px] text-gray-500 font-mono">
                      {token.extras.cents !== undefined && `${token.extras.cents}c `}
                      {token.extras.hz !== undefined && `${token.extras.hz}Hz `}
                      {token.extras.primeFactors ? token.extras.primeFactors : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
