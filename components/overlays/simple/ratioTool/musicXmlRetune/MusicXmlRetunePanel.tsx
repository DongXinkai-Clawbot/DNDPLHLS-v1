import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ScoreEvent } from '../../../../../domain/scoreTimeline/types';
import type { RatioDisplayMode } from '../../../../../domain/scoreTimeline/types';
import type { ScorePresentationMode, HChromaLabelMode, HChromaEventLabel } from './MusicXmlJiScoreViewer';
import { ScalaArchivePicker } from '../../../settingsTabsPart2/ScalaArchivePicker';
import { MusicXmlJiScoreViewer } from './MusicXmlJiScoreViewer';
import { clamp, midiNoteToFrequency } from './helpers';
import { PlaybackVisualizationPanel } from '../../../settingsTabsPart2/midiFileRetune/sections/PlaybackVisualizationPanel';
import { loadHunt205Layout } from '../../../../visualization/hunt205/Hunt205LayoutLoader';
import { resolveToneBindings, type NormalizedNoteEvent } from '../../../../visualization/hunt205/Hunt205ToneResolver';
import { Hunt205RingView } from '../../../../visualization/hunt205/Hunt205RingView';
import { parseGeneralRatio } from '../../../../../musicLogic';

type Props = any;

export const MusicXmlRetunePanel = (props: Props) => {
  const {
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
    onRatioFormatModeChange,
    onRatioAutoPowerDigitsChange,
    playbackVisualizationMode,
    ringSettings,
    onPlaybackModeChange,
    onPlaybackRingChange
  } = props;

  const layout = useMemo(() => loadHunt205Layout(), []);
  const safeRatioAutoDigits = Number.isFinite(ratioAutoPowerDigits) ? ratioAutoPowerDigits : 14;
  const safeRatioFormatMode = (ratioFormatMode || 'auto') as 'fraction' | 'primePowers' | 'auto';
  const ringHostRef = useRef<HTMLDivElement | null>(null);
  const [ringHostWidth, setRingHostWidth] = useState(0);

  useEffect(() => {
    const host = ringHostRef.current;
    if (!host) return;
    const update = () => setRingHostWidth(Math.max(0, host.clientWidth || 0));
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => update());
      ro.observe(host);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const normalizedEvents = useMemo(() => {
    if (!scoreDoc) return [] as NormalizedNoteEvent[];
    const notes: NormalizedNoteEvent[] = [];
    scoreDoc.voices.forEach((voice: any, voiceIndex: number) => {
      voice.events.forEach((event: any) => {
        if (event.type !== 'note') return;
        const ratioFraction = event.ratioFraction;
        let pitch: NormalizedNoteEvent['pitch_representation'] | null = null;
        if (ratioFraction?.n && ratioFraction?.d) {
          const num = Number(ratioFraction.n);
          const den = Number(ratioFraction.d);
          if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
            pitch = { type: 'ratio', ratio_num: num, ratio_den: den };
          }
        } else if (event.ratio) {
          try {
            const frac = parseGeneralRatio(event.ratio);
            const num = Number(frac.n);
            const den = Number(frac.d);
            if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
              pitch = { type: 'ratio', ratio_num: num, ratio_den: den };
            }
          } catch {
            pitch = null;
          }
        }

        if (!pitch && Number.isFinite(event.midi?.noteNumber)) {
          const hz = midiNoteToFrequency(event.midi.noteNumber, sourceA4 || 440);
          if (Number.isFinite(hz) && hz > 0) {
            pitch = { type: 'frequency', hz };
          }
        }

        if (!pitch) {
          pitch = { type: 'cents', cents: 0 };
        }

        notes.push({
          event_id: event.id,
          start_time_ms: event.t0 * 1000,
          end_time_ms: event.t1 * 1000,
          pitch_representation: pitch,
          velocity: 0.7,
          channel: event.midi?.channel,
          voice: Number.isFinite(event.midi?.trackIndex) ? event.midi.trackIndex : voiceIndex
        });
      });
    });
    return notes;
  }, [scoreDoc, sourceA4]);

  const bindings = useMemo(() => {
    if (!normalizedEvents.length) return [];
    return resolveToneBindings(normalizedEvents, layout, {
      periodCents: layout.meta?.period_cents,
      referenceHz: Number.isFinite(baseFrequency) ? baseFrequency : 440,
      referenceCents: 0
    });
  }, [normalizedEvents, layout, baseFrequency]);

  const ringScale = clamp(Number.isFinite(ringSettings?.scale) ? ringSettings.scale : 1, 0.8, 1.2);
  const ringRatio = Math.max(0.7, 0.8 * ringScale);
  const viewportWidth = typeof window === 'undefined' ? 800 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const ringSize = Math.max(
    240,
    Math.floor(Math.min(ringHostWidth || viewportWidth, viewportHeight * ringRatio))
  );
  const showRing = playbackVisualizationMode === 'HUNT205_RING';
  const measureList = useMemo(() => {
    if (!scoreDoc) return [] as Array<{ index: number; t0: number; t1: number; duration: number }>;
    const bars = (scoreDoc.events || [])
      .filter((e: any) => e.type === 'bar')
      .map((e: any) => e.t0)
      .filter((t: number) => Number.isFinite(t))
      .sort((a: number, b: number) => a - b);
    if (bars.length === 0) return [];
    if (bars[0] > 0) bars.unshift(0);
    const total = Math.max(0, scoreDoc.totalDuration || totalDuration || 0);
    if (bars[bars.length - 1] < total) bars.push(total);
    if (bars.length < 2) return [];
    return bars.slice(0, -1).map((t0: number, idx: number) => {
      const t1 = bars[idx + 1];
      return { index: idx, t0, t1, duration: Math.max(0, t1 - t0) };
    });
  }, [scoreDoc, totalDuration]);

  const handleMeasureScaleChange = (index: number, value: number) => {
    if (!setMeasureScaleOverrides) return;
    const clamped = clamp(value, 0.5, 3);
    setMeasureScaleOverrides((prev: Record<number, number>) => {
      const next = { ...(prev || {}) };
      if (Math.abs(clamped - 1) < 0.001) {
        delete next[index];
      } else {
        next[index] = clamped;
      }
      return next;
    });
  };

  return (
    <div className="p-3 bg-emerald-900/10 border border-emerald-800/50 rounded-lg space-y-3">
      <div className="rounded-xl border border-gray-800 bg-black/40 p-3 text-gray-300">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] font-black text-emerald-300 uppercase">MusicXML Retune {'->'} Pure JI Numbered Score</div>
            <div className="text-[11px] opacity-70 text-gray-400">
              Upload <span className="font-semibold text-gray-300">.xml / .musicxml / .mxl</span> {'->'} choose algorithm {'->'} view a scrolling horizontal JI score.
            </div>
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-700 bg-emerald-900/50 hover:bg-emerald-800 cursor-pointer text-[12px] text-emerald-200">
            <input
              type="file"
              accept=".xml,.musicxml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml"
              className="hidden"
              onChange={onFileInput}
            />
            <span className="font-semibold">Upload</span>
            <span className="opacity-80">{busy ? 'Parsing...' : fileName ? fileName : 'No file'}</span>
          </label>
        </div>

        {error && <div className="mt-2 text-[12px] text-red-300 bg-red-900/30 p-1 rounded border border-red-800/50">{error}</div>}

        {importResult && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-gray-400">
            <div className="rounded-lg border border-gray-800 bg-black/20 p-2">
              <div className="font-semibold text-gray-300">Score</div>
              <div className="opacity-80">Title: {importResult.title || '(untitled)'}</div>
              <div className="opacity-80">Parts: {importResult.parts?.length} | Voices: {scoreDoc?.voices?.length ?? 0}</div>
              <div className="opacity-80">Events: {importResult.events?.length}</div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/20 p-2">
              <div className="font-semibold text-gray-300">Timing</div>
              <div className="opacity-80">Ticks/Quarter: {importResult.ticksPerQuarter}</div>
              <div className="opacity-80">Tempo changes: {importResult.tempoEvents?.length}</div>
              <div className="opacity-80">Duration: {totalDuration.toFixed(2)}s</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-black/40 p-3 text-gray-300">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[12px] font-semibold text-emerald-300/80 uppercase">Algorithm:</div>
            {(
              [
                { id: 'retune', label: 'Retune Scale' },
                { id: 'custom', label: 'Custom Scale' },
                { id: 'dynamic', label: 'Dynamic' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${mode === m.id ? 'bg-emerald-700 text-white border-emerald-600' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                onClick={() => handleModeChange(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold ${playing ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-emerald-900/50 text-emerald-200 border-emerald-700 hover:bg-emerald-800'}`}
              onClick={playing ? stopVisualPlay : startVisualPlay}
              disabled={!scoreDoc}
            >
              {playing ? 'Stop' : 'Play'}
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-[12px] font-semibold text-gray-300"
              onClick={() => onSeek(0)}
              disabled={!scoreDoc}
            >
              Rewind
            </button>
            <div className="flex items-center gap-2 ml-2">
              <span className="text-[11px] text-gray-400 uppercase">Speed</span>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={playSpeed}
                onChange={(e) => setPlaySpeed(clamp(Number(e.target.value), 0.25, 2))}
                className="w-24 h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
              />
              <input
                type="number"
                min={0.25}
                max={2}
                step={0.05}
                value={playSpeed}
                onChange={(e) => setPlaySpeed(clamp(Number(e.target.value), 0.25, 2))}
                className="w-14 rounded border border-gray-700 bg-black px-2 py-1 text-[11px] text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border border-gray-800 bg-black/20 p-2">
            <div className="text-[12px] font-semibold mb-2 text-gray-400 uppercase">Reference</div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Base note (1/1)</span>
                <input
                  className="w-full rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                  type="number"
                  value={baseNote}
                  min={0}
                  max={127}
                  onChange={(e) => setBaseNote(clamp(Number(e.target.value), 0, 127))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Base freq (Hz)</span>
                <input
                  className="w-full rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                  type="number"
                  value={baseFrequency}
                  min={1}
                  step={0.1}
                  onChange={(e) => setBaseFrequency(Math.max(1, Number(e.target.value)))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Source A4 (Hz)</span>
                <input
                  className="w-full rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                  type="number"
                  value={sourceA4}
                  min={1}
                  step={0.1}
                  onChange={(e) => setSourceA4(Math.max(1, Number(e.target.value)))}
                />
              </label>
            </div>

            {mode === 'retune' && (
              <div className="mt-3 rounded-lg border border-gray-800 bg-black/30 p-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-[12px] font-semibold text-gray-400 uppercase">Library Scale</div>
                  <button
                    onClick={() => setShowScalaPicker(!showScalaPicker)}
                    className="text-[10px] bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/50 uppercase font-bold"
                  >
                    {showScalaPicker ? 'Close Archive' : 'Import from Archive'}
                  </button>
                </div>

                {showScalaPicker && (
                  <div className="mb-3 p-2 bg-black/40 rounded border border-gray-700">
                    <ScalaArchivePicker selectedId={null} onSelect={handleImportScala} />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <select
                    className="w-full rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                    value={selectedLibraryScaleId}
                    onChange={(e) => setSelectedLibraryScaleId(e.target.value)}
                  >
                    {savedMidiScales.length === 0 && <option value="">No saved scales found</option>}
                    {savedMidiScales.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.scale.length} steps)</option>
                    ))}
                  </select>

                  {retuneScale.length > 0 ? (
                    <div className="mt-1 text-[11px] font-mono whitespace-nowrap overflow-x-auto custom-scrollbar opacity-80 text-gray-300">
                      {retuneScale.slice(0, 24).join('  ')}{retuneScale.length > 24 ? ' ...' : ''}
                    </div>
                  ) : (
                    <div className="text-[11px] text-red-300">Select a valid scale from your library.</div>
                  )}
                </div>
                <div className="mt-2 text-[10px] opacity-50">
                  Manage scales in the "MIDI Device" or "Retuner" panels.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-800 bg-black/20 p-2">
            <div className="text-[12px] font-semibold mb-2 text-gray-400 uppercase">Display</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Presentation</span>
                <select
                  className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                  value={presentationMode}
                  onChange={(e) => setPresentationMode(e.target.value as ScorePresentationMode)}
                >
                  <option value="ratio">Ratio</option>
                  <option value="h-chroma">H-Chroma</option>
                </select>
              </label>
              {presentationMode === 'ratio' ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] opacity-70">Mode</span>
                  <select
                    className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                    value={displayMode}
                    onChange={(e) => setDisplayMode(e.target.value as RatioDisplayMode)}
                  >
                    <option value="fraction">Fraction</option>
                    <option value="decimal">Decimal</option>
                    <option value="both">Both</option>
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] opacity-70">H-Chroma Label</span>
                  <select
                    className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                    value={hChromaLabelMode}
                    onChange={(e) => setHChromaLabelMode(e.target.value as HChromaLabelMode)}
                  >
                    <option value="harmonic">Harmonic</option>
                    <option value="ratio">Ratio</option>
                  </select>
                </label>
              )}
              {presentationMode === 'ratio' && (
                <label className="flex items-end gap-2">
                  <input type="checkbox" checked={showOctaveFolding} onChange={(e) => setShowOctaveFolding(e.target.checked)} />
                  <span className="text-[12px]">Octave folding marks</span>
                </label>
              )}
              <label className="flex items-end gap-2">
                <input type="checkbox" checked={showBars} onChange={(e) => setShowBars(e.target.checked)} />
                <span className="text-[12px]">Bars</span>
              </label>
              <label className="flex items-end gap-2">
                <input type="checkbox" checked={showBeats} onChange={(e) => setShowBeats(e.target.checked)} />
                <span className="text-[12px]">Beats</span>
              </label>
              <label className="flex items-end gap-2">
                <input type="checkbox" checked={!!stretchMeasures} onChange={(e) => setStretchMeasures(e.target.checked)} />
                <span className="text-[12px]">Stretch measures for dense notes</span>
              </label>
            </div>

            <div className="mt-3 rounded-lg border border-gray-800 bg-black/30 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-gray-400 uppercase">Ratio Display</div>
                <div className="text-[10px] text-emerald-300 font-mono">{Math.round(safeRatioAutoDigits)} digits</div>
              </div>
              <input
                type="range"
                min={6}
                max={50}
                step={1}
                value={Math.round(safeRatioAutoDigits)}
                onChange={(e) => onRatioAutoPowerDigitsChange(Number(e.target.value))}
                className="w-full h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
              />
              <div className="text-[10px] text-gray-500">
                Auto keeps standard fractions until the numerator/denominator would be long, then switches to prime-power form like{' '}
                <span className="font-mono text-gray-300">3^n*5^l/2^m*7^k</span>.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-400 uppercase">MusicXML Retune</span>
                  <select
                    className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
                    value={safeRatioFormatMode}
                    onChange={(e) => onRatioFormatModeChange(e.target.value as 'fraction' | 'primePowers' | 'auto')}
                  >
                    <option value="fraction">Fraction (n/d)</option>
                    <option value="primePowers">Prime Powers (a^n*b^l/...)</option>
                    <option value="auto">Auto</option>
                  </select>
                </label>
                <div className="text-[10px] text-gray-500 flex items-end">
                  Applies to ratio labels in this MusicXML retune view.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={mode === 'custom' ? "mt-3 rounded-lg border border-gray-800 bg-black/20 p-2" : "hidden"}>
          <div className="text-[12px] font-semibold mb-2 text-gray-400 uppercase">Custom Scale</div>
          <textarea
            className="w-full min-h-[84px] rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white font-mono focus:border-emerald-500 outline-none"
            value={customScaleText}
            onChange={(e) => setCustomScaleText(e.target.value)}
            placeholder="e.g. 1/1 16/15 9/8 6/5 ..."
          />
          <div className="mt-1 text-[11px] opacity-70">Parsed steps: {customScale.length}</div>
          {customScaleErrors.length > 0 && (
            <div className="mt-1 text-[11px] text-red-300">
              {customScaleErrors.slice(0, 6).join(' | ')}{customScaleErrors.length > 6 ? ' ...' : ''}
            </div>
          )}
        </div>

        {mode === 'dynamic' && (
          <div className="mt-3 rounded-lg border border-gray-800 bg-black/20 p-2">
            <div className="text-[12px] font-semibold mb-2 text-gray-400 uppercase">Dynamic Tuning</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Tolerance (cents)</span>
                <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={dynTolerance} onChange={(e) => setDynTolerance(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">Candidates</span>
                <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={dynCandidateLimit} onChange={(e) => setDynCandidateLimit(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">w(dev)</span>
                <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" step={0.05} value={dynDeviationWeight} onChange={(e) => setDynDeviationWeight(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">w(interval)</span>
                <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" step={0.05} value={dynIntervalWeight} onChange={(e) => setDynIntervalWeight(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] opacity-70">w(note)</span>
                <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" step={0.05} value={dynNoteWeight} onChange={(e) => setDynNoteWeight(Number(e.target.value))} />
              </label>
            </div>
            <div className="mt-1 text-[11px] opacity-70">Uses current lattice nodes as candidates. Holds assignments for sustained notes for continuity.</div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-black/40 p-3 text-gray-300">
        <div className="text-[12px] font-semibold mb-2 text-gray-400 uppercase">Viewport</div>
        <PlaybackVisualizationPanel
          playbackVisualizationMode={playbackVisualizationMode}
          ringSettings={ringSettings}
          onModeChange={onPlaybackModeChange}
          onRingChange={onPlaybackRingChange}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] opacity-70">px/sec</span>
            <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={pxPerSecond} onChange={(e) => setPxPerSecond(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] opacity-70">pre (s)</span>
            <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={preSeconds} onChange={(e) => setPreSeconds(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] opacity-70">post (s)</span>
            <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={postSeconds} onChange={(e) => setPostSeconds(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] opacity-70">lane height</span>
            <input className="rounded border border-gray-700 bg-black px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none" type="number" value={laneHeight} onChange={(e) => setLaneHeight(Number(e.target.value))} />
          </label>
        </div>

        {scoreDoc && measureList.length > 0 && (
          <div className="mt-3 rounded-lg border border-gray-800 bg-black/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-gray-400 uppercase">Measure Widths</div>
              <button
                type="button"
                onClick={() => setMeasureScaleOverrides({})}
                className="text-[10px] px-2 py-0.5 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 uppercase font-bold"
              >
                Reset All
              </button>
            </div>
            <div className="mt-1 text-[10px] text-gray-500">
              1.00 = default duration width. Adjust per-measure scale to expand or compress spacing.
            </div>
            <div className="mt-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {measureList.map((measure) => {
                const rawValue = (measureScaleOverrides && (measureScaleOverrides as any)[measure.index]) ?? 1;
                const scaleValue = clamp(Number(rawValue), 0.5, 3);
                return (
                  <div key={`measure-scale-${measure.index}`} className="flex items-center gap-2">
                    <div className="w-[64px] text-[10px] text-gray-400 font-mono shrink-0">
                      M{measure.index + 1} <span className="opacity-60">{measure.duration.toFixed(2)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.05}
                      value={scaleValue}
                      onChange={(e) => handleMeasureScaleChange(measure.index, Number(e.target.value))}
                      className="flex-1 h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
                    />
                    <input
                      type="number"
                      min={0.5}
                      max={3}
                      step={0.05}
                      value={scaleValue}
                      onChange={(e) => handleMeasureScaleChange(measure.index, Number(e.target.value))}
                      className="w-16 rounded border border-gray-700 bg-black px-2 py-1 text-[11px] text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3">
          {scoreDoc ? (
            showRing ? (
              <div ref={ringHostRef} className="flex justify-center">
                <Hunt205RingView
                  layout={layout}
                  bindings={bindings}
                  playheadMs={playhead * 1000}
                  sizePx={ringSize}
                  showAllLabels={ringSettings?.showAllLabels !== false}
                  showPreferredNames={!!ringSettings?.showPreferredNames}
                  rotationDeg={Number.isFinite(ringSettings?.rotationDeg) ? ringSettings.rotationDeg : 0}
                  showUpcoming={!!ringSettings?.showUpcoming}
                  debugEnabled={!!ringSettings?.showDebug}
                />
              </div>
            ) : (
              <MusicXmlJiScoreViewer
                scoreDoc={scoreDoc}
                playing={playing}
                playhead={playhead}
                onSeek={onSeek}
                onSelectEvent={(event: ScoreEvent) => {
                  if (event.type !== 'note') return;
                  setSelectedEventId(event.id);
                }}
                selectedEventId={selectedEventId}
                presentationMode={presentationMode}
                displayMode={displayMode}
                hChromaLabelMode={hChromaLabelMode}
                hChromaLabels={hChromaLabels as Map<string, HChromaEventLabel>}
                hChromaColorForRatio={hChromaColorForRatio}
                showBars={showBars}
                showBeats={showBeats}
                stretchMeasures={stretchMeasures}
                measureScaleOverrides={measureScaleOverrides}
                pxPerSecond={pxPerSecond}
                preSeconds={preSeconds}
                postSeconds={postSeconds}
                laneHeight={laneHeight}
                showOctaveFolding={showOctaveFolding}
                hiddenVoiceIds={hiddenVoiceIds}
                setHiddenVoiceIds={setHiddenVoiceIds}
                ratioFormatMode={ratioFormatMode}
                ratioAutoPowerDigits={ratioAutoPowerDigits}
                ratioCustomSymbols={ratioCustomSymbols}
              />
            )
          ) : (
            <div className="text-[12px] opacity-70">Upload a MusicXML/MXL file to start.</div>
          )}
        </div>

        {scoreDoc && selectedEventId && eventById.get(selectedEventId) && (
          <div className="mt-4 rounded-lg border border-gray-800 bg-black/20 p-3">
            <div className="text-[12px] font-semibold text-emerald-300 mb-2 uppercase">Edit Note Ratio</div>
            <div className="text-[11px] text-gray-400 mb-2">
              {(() => {
                const event = eventById.get(selectedEventId) as ScoreEvent;
                const tick = event?.midi?.startTick ?? 0;
                const voiceId = event?.voiceId ?? '';
                return `Event: ${selectedEventId} | Voice: ${voiceId} | Tick: ${tick}`;
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={ratioInput}
                onChange={(e) => setRatioInput(e.target.value)}
                placeholder="e.g. 7/6"
                className="min-w-[160px] flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-[12px] text-white focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={handleApplyRatioOverride}
                className="px-3 py-1.5 rounded border border-emerald-700 bg-emerald-800/60 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-700"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={handleClearRatioOverride}
                className="px-3 py-1.5 rounded border border-gray-700 bg-gray-900 text-[11px] text-gray-300 hover:bg-gray-800"
              >
                Clear
              </button>
            </div>
            {ratioError && <div className="mt-2 text-[11px] text-red-300">{ratioError}</div>}
            {!ratioError && (
              <div className="mt-2 text-[10px] text-gray-500">
                Overrides apply to the retuned score only.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

