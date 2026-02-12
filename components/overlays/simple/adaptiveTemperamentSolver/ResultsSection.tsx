import React from 'react';
import { playSimultaneous } from '../../../../audioEngine';
import type { AppSettings } from '../../../../types';
import type { ScalaMatchResult } from '../../../../utils/scalaArchive';
import type { SolverOutput } from '../../../../utils/temperamentSolver';
import { fmt, makeDummyNode } from './utils';

type ResultsSectionProps = {
  status: string;
  result: SolverOutput | null;
  globalTol: number;
  radarRef: React.RefObject<HTMLCanvasElement>;
  heatRef: React.RefObject<HTMLCanvasElement>;
  onEnlargeChart: (chart: 'radar' | 'heatmap') => void;
  isPlayingScale: boolean;
  playEntireScale: () => void;
  stopScalePlayback: () => void;
  playDegreeDyad: (deg: number) => void;
  settings: AppSettings;
  exportFiles: (kind: 'scl' | 'kbm' | 'csv' | 'syx-bulk' | 'syx-single') => void;
  scaleName: string;
  setScaleName: (value: string) => void;
  saveToCustomMapping: () => void;
  applyToMidiMapping: () => void;
  scalaMatch: ScalaMatchResult | null;
  scalaMatchStatus: string;
};

export const ResultsSection: React.FC<ResultsSectionProps> = ({
  status,
  result,
  globalTol,
  radarRef,
  heatRef,
  onEnlargeChart,
  isPlayingScale,
  playEntireScale,
  stopScalePlayback,
  playDegreeDyad,
  settings,
  exportFiles,
  scaleName,
  setScaleName,
  saveToCustomMapping,
  applyToMidiMapping,
  scalaMatch,
  scalaMatchStatus
}) => (
  <>
    {/* Status */}
    {status && <div className={`text-[11px] font-mono px-3 py-2 rounded-xl border ${result ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}>{status}</div>}

    {/* Results */}
    {
      result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Visuals */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between"><div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Visual Analytics</div><div className="text-[10px] font-mono text-gray-400">max |err| ≤{fmt(result.maxAbsErrorCents, 2)}¢</div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2 relative group">
                <canvas ref={radarRef} className="w-full" style={{ height: 240 }} />
                <button
                  onClick={() => onEnlargeChart('radar')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-indigo-600 text-white rounded px-2 py-1 text-[9px] font-bold"
                >
                  🔍 Enlarge
                </button>
              </div>
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2 relative group">
                <canvas ref={heatRef} className="w-full" style={{ height: 240 }} />
                <button
                  onClick={() => onEnlargeChart('heatmap')}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 hover:bg-indigo-600 text-white rounded px-2 py-1 text-[9px] font-bold"
                >
                  🔍 Enlarge
                </button>
              </div>
            </div>
          </div>

          {/* Audio & Beat Table */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Aural Verification</div>

            {/* Play entire scale button */}
            <div className="flex gap-2">
              <button
                onClick={isPlayingScale ? stopScalePlayback : playEntireScale}
                className={`flex-1 ${isPlayingScale ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white border border-white/20 rounded-xl px-3 py-2 text-[11px] font-black uppercase transition-colors`}
              >
                {isPlayingScale ? '■Stop Scale' : '▶Play Entire Scale'}
              </button>
            </div>

            <div className="text-[9px] text-gray-500 leading-tight">
              Play individual dyads (root + degree):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[0, 2, 4, 7, 9, 11].filter(v => v < result.input.scaleSize).map(deg => (
                <button key={deg} onClick={() => playDegreeDyad(deg)} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-2 py-2 text-[10px] font-black uppercase">▶Deg {deg}</button>
              ))}
            </div>
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Beat Rate Table</div>
                <div className="text-[9px] text-gray-500 font-mono">(Beat Hz = tuning "wobble" speed)</div>
              </div>
              <div className="text-[8px] text-gray-600 mb-1">Lower beat = purer interval. Frequencies show actual dyad pitches.</div>
              <div className="max-h-48 overflow-auto custom-scrollbar">
                {result.beatTable.map((r, idx) => (
                  <div key={idx} onClick={() => {
                    const ratio = r.highHz / r.lowHz;
                    const nLo = makeDummyNode(0, 'Lo');
                    const nHi = makeDummyNode(1200 * Math.log2(ratio), 'Hi');
                    playSimultaneous(nLo, nHi, { ...settings, baseFrequency: r.lowHz });
                  }} className="flex items-center justify-between gap-2 py-1 border-b border-gray-800 last:border-b-0 cursor-pointer hover:bg-indigo-900/30 px-1 rounded">
                    <span className="text-[10px] text-gray-200 font-mono w-20 truncate">{r.lowDegree}–{r.highDegree} ({r.ratio.label || `${r.ratio.n}/${r.ratio.d}`})</span>
                    <span className="text-[9px] text-gray-500 font-mono">{fmt(r.lowHz, 1)}–{fmt(r.highHz, 1)}Hz</span>
                    <span className={`text-[10px] font-mono font-bold ${r.beatHz < 1 ? 'text-emerald-400' : r.beatHz < 3 ? 'text-yellow-400' : 'text-orange-400'}`}>±{fmt(r.beatHz, 2)}Hz</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Exports</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportFiles('scl')} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase">.scl</button>
                <button onClick={() => exportFiles('kbm')} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase">.kbm</button>
                <button onClick={() => exportFiles('csv')} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase">.csv</button>
                <button onClick={() => exportFiles('syx-bulk')} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase" title="MTS Bulk Tuning Dump (0x08 0x01) - Moog, Dave Smith, Novation">MTS Bulk</button>
                <button onClick={() => exportFiles('syx-single')} className="bg-gray-800 hover:bg-white hover:text-black border border-gray-700 rounded-xl px-3 py-2 text-[10px] font-black uppercase" title="MTS Single Note Tuning (0x08 0x02) - Legacy Yamaha/Roland">MTS Single</button>
              </div>
            </div>

            {/* Save to Custom Mapping */}
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-xl p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-purple-300 mb-2">Save to Custom Mapping</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Scale name (optional)..."
                  value={scaleName}
                  onChange={e => setScaleName(e.target.value)}
                  className="flex-1 bg-black/60 border border-purple-700/50 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder:text-gray-500 outline-none focus:border-purple-500"
                />
                <button
                  onClick={saveToCustomMapping}
                  className="bg-purple-800 hover:bg-purple-600 text-white border border-purple-600 rounded-xl px-4 py-2 text-[10px] font-black uppercase whitespace-nowrap"
                  title="Save scale to Saved Scales list"
                >
                  💾 Save
                </button>
                <button
                  onClick={applyToMidiMapping}
                  className="bg-indigo-800 hover:bg-indigo-600 text-white border border-indigo-600 rounded-xl px-4 py-2 text-[10px] font-black uppercase whitespace-nowrap"
                  title="Apply scale directly to active MIDI mapping"
                >
                  ⚡Apply Now
                </button>
              </div>
              <div className="text-[9px] text-gray-500 mt-1">Saves the generated temperament to Custom Mapping for use with MIDI input.</div>
            </div>

            {/* Scala archive match */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Closest Scala Archive</div>
                {scalaMatch && (
                  <div className="text-[9px] text-gray-500 font-mono">score {fmt(scalaMatch.score, 1)}</div>
                )}
              </div>
              {scalaMatchStatus && (
                <div className="text-[9px] text-gray-500">{scalaMatchStatus}</div>
              )}
              {!scalaMatchStatus && scalaMatch && (
                <>
                  <div className="text-xs text-white font-bold truncate">{scalaMatch.entry.displayName}</div>
                  <div className="text-[9px] text-gray-500 font-mono truncate">{scalaMatch.entry.fileName}</div>
                  {scalaMatch.scale.description && (
                    <div className="text-[9px] text-gray-500 mt-1">{scalaMatch.scale.description}</div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[9px] text-gray-500 mt-2">
                    <span>{scalaMatch.scale.count} notes</span>
                    <span>period {fmt(scalaMatch.scale.periodCents, 1)} cents</span>
                    <span>pitch {fmt(scalaMatch.details.pitchErrorCents, 1)} cents</span>
                    {scalaMatch.details.stepErrorCents !== null && (
                      <span>steps {fmt(scalaMatch.details.stepErrorCents, 1)} cents</span>
                    )}
                    <span>period diff {fmt(scalaMatch.details.periodDiffCents, 1)} cents</span>
                  </div>
                </>
              )}
              {!scalaMatchStatus && !scalaMatch && (
                <div className="text-[9px] text-gray-500 italic">No archive match found.</div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Generated Scale Data</div>
                <div className="max-h-56 overflow-auto custom-scrollbar">
                  {result.notes.map((n, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-1 border-b border-gray-800 last:border-b-0">
                      <span className="text-[10px] text-gray-200 font-mono">{i} · {n.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{fmt(n.freqHzAtRootMidi, 3)} Hz · {fmt(n.centsFromRoot, 3)}¢</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Target Error Summary</div>
                <div className="max-h-56 overflow-auto custom-scrollbar">
                  {result.intervals.map((e, idx) => {
                    const tol = e.toleranceCents ?? e.target.tolerance ?? globalTol;
                    const errAbs = Math.abs(e.errorCents);
                    const toneClass = errAbs < 2 ? 'text-green-400' : errAbs < tol ? 'text-yellow-400' : 'text-red-400';
                    return (
                      <div key={idx} className="flex items-center justify-between gap-3 py-1 border-b border-gray-800 last:border-b-0">
                        <span className="text-[10px] text-gray-200 font-mono">{e.target.label || `${e.target.n}/${e.target.d}`} (step {e.step})</span>
                        <span className={`text-[10px] font-mono ${toneClass}`}>{e.errorCents >= 0 ? '+' : ''}{fmt(e.errorCents, 3)}¢</span>
                      </div>
                    );
                  })}
                  {result.intervals.length === 0 && <div className="text-[10px] text-gray-500 italic p-2">No target intervals enabled.</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  </>
);
