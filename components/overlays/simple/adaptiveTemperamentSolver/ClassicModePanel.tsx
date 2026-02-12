import React from 'react';
import type { CurveShape, OctaAnchor, OctaveModel, SolverOutput } from '../../../../utils/temperamentSolver';
import { FIFTHS_CIRCLE } from './constants';
import type { TargetItem, UiRatioSpec } from './types';
import { fmt, fmtPct } from './utils';
import { OctaPad } from './OctaPad';
import { OctaCube3D } from '../OctaCube3D';
import { QuadWeightPad } from '../QuadWeightPad';

type ClassicModePanelProps = {
  N: number;
  setN: (value: number) => void;
  baseFrequency: number;
  setBaseFrequency: (value: number) => void;
  octaveModel: OctaveModel;
  setOctaveModel: (value: OctaveModel) => void;
  octaveCentsOverride: number;
  setOctaveCentsOverride: (value: number) => void;
  globalTol: number;
  setGlobalTol: (value: number) => void;
  targetsRaw: TargetItem[];
  targetState: Record<string, boolean>;
  setTargetState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  individualTolerances: Record<string, number>;
  setIndividualTolerances: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  customRatioText: string;
  setCustomRatioText: (value: string) => void;
  ratioSpecs: UiRatioSpec[];
  setRatioSpecs: React.Dispatch<React.SetStateAction<UiRatioSpec[]>>;
  wolfMode: 'auto' | 'manual';
  setWolfMode: (value: 'auto' | 'manual') => void;
  manualWolfIndex: number;
  setManualWolfIndex: (value: number) => void;
  wolfPositionLabels: { index: number; label: string }[];
  solverModeUi: 'regular' | 'irregular';
  setSolverModeUi: (value: 'regular' | 'irregular') => void;
  octaEnabled: boolean;
  setOctaEnabled: (value: boolean) => void;
  octaX: number;
  octaY: number;
  setOctaX: (value: number) => void;
  setOctaY: (value: number) => void;
  octaZ: number;
  setOctaZ: (value: number) => void;
  octaTargets: OctaAnchor[];
  updateOctaTarget: (id: string, field: 'n' | 'd', rawValue: string) => void;
  targetWeights: Record<string, number>;
  setTargetWeights: (value: Record<string, number>) => void;
  quadEnabled: boolean;
  setQuadEnabled: (value: boolean) => void;
  weightThirds: number;
  setWeightThirds: (value: number) => void;
  curveShape: CurveShape;
  setCurveShape: (value: CurveShape) => void;
  constrainMinor3rds: boolean;
  setConstrainMinor3rds: (value: boolean) => void;
  centerKey: string;
  setCenterKey: (value: string) => void;
  rangeFlats: number;
  setRangeFlats: (value: number) => void;
  rangeSharps: number;
  setRangeSharps: (value: number) => void;
  result: SolverOutput | null;
  octaveStiffness: number;
  setOctaveStiffness: (value: number) => void;
};

export const ClassicModePanel: React.FC<ClassicModePanelProps> = ({
  N,
  setN,
  baseFrequency,
  setBaseFrequency,
  octaveModel,
  setOctaveModel,
  octaveCentsOverride,
  setOctaveCentsOverride,
  globalTol,
  setGlobalTol,
  targetsRaw,
  targetState,
  setTargetState,
  individualTolerances,
  setIndividualTolerances,
  customRatioText,
  setCustomRatioText,
  ratioSpecs,
  setRatioSpecs,
  wolfMode,
  setWolfMode,
  manualWolfIndex,
  setManualWolfIndex,
  wolfPositionLabels,
  solverModeUi,
  setSolverModeUi,
  octaEnabled,
  setOctaEnabled,
  octaX,
  octaY,
  setOctaX,
  setOctaY,
  octaZ,
  setOctaZ,
  octaTargets,
  updateOctaTarget,
  targetWeights,
  setTargetWeights,
  quadEnabled,
  setQuadEnabled,
  weightThirds,
  setWeightThirds,
  curveShape,
  setCurveShape,
  constrainMinor3rds,
  setConstrainMinor3rds,
  centerKey,
  setCenterKey,
  rangeFlats,
  setRangeFlats,
  rangeSharps,
  setRangeSharps,
  result,
  octaveStiffness,
  setOctaveStiffness
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
    <div className="flex flex-col gap-3 lg:col-span-1">
      <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Tier 1 · Physical Topology</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-400 font-bold uppercase">Scale Size (N)<input type="number" min={5} max={72} value={N} onChange={e => setN(parseInt(e.target.value || '12', 10))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
          <label className="text-[10px] text-gray-400 font-bold uppercase">Base Freq (Hz)<input type="number" min={20} max={2000} value={baseFrequency} onChange={e => setBaseFrequency(parseFloat(e.target.value || '440'))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
        </div>
        <label className="text-[10px] text-gray-400 font-bold uppercase">Octave Model
          <select value={octaveModel} onChange={e => setOctaveModel(e.target.value as OctaveModel)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono">
            <option value="perfect">Perfect (2:1 · 1200¢)</option>
            <option value="stretched">Stretched (User)</option>
            <option value="non_octave">Non-Octave (User)</option>
          </select>
        </label>
        {octaveModel !== 'perfect' && (
          <label className="text-[10px] text-gray-400 font-bold uppercase">Cycle Cents<input type="number" value={octaveCentsOverride} onChange={e => setOctaveCentsOverride(parseFloat(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
        )}
      </div>

      {/* Tier 2 */}
      <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Tier 2 · Constraints</div>
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] text-gray-400 font-bold uppercase">Global Tolerance (¢)<input type="number" min={0.1} max={50} step={0.1} value={globalTol} onChange={e => setGlobalTol(parseFloat(e.target.value))} className="mt-1 w-28 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
          {targetsRaw.map(t => (
            <label key={t.id} className="flex items-center gap-2 bg-gray-900/60 border border-gray-800 rounded-lg px-2 py-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!targetState[t.id]} onChange={e => setTargetState(s => ({ ...s, [t.id]: e.target.checked }))} className="accent-indigo-500" />
              <span className="flex flex-col leading-tight flex-1">
                <span className="text-[10px] text-gray-200 font-bold">{t.n}/{t.d}</span>
                <span className="text-[9px] text-gray-500 font-mono">{fmt(t.centsIdeal, 1)}¢ · step {t.step}</span>
              </span>
              {!!targetState[t.id] && (
                <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[8px] text-gray-500">±</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder={String(globalTol)}
                    value={individualTolerances[`${t.n}/${t.d}`] ?? ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setIndividualTolerances(prev => ({
                        ...prev,
                        [`${t.n}/${t.d}`]: isNaN(val) ? undefined : val
                      } as any));
                    }}
                    className="w-10 bg-black border border-gray-700 rounded text-[9px] text-center text-blue-300 focus:border-blue-500 outline-none p-1"
                    title="Individual Tolerance (cents). Overrides global tolerance."
                  />
                </span>
              )}
            </label>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={customRatioText} onChange={e => setCustomRatioText(e.target.value)} placeholder="Add ratio: e.g. 11/8" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono text-xs" />
          <button onClick={() => {
            const m = customRatioText.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
            if (m) { setRatioSpecs(prev => ([...prev, { label: `${m[1]}/${m[2]}`, n: parseInt(m[1]), d: parseInt(m[2]) }])); setCustomRatioText(''); }
          }} className="bg-gray-800 px-3 py-2 rounded-lg text-[10px] font-black uppercase border border-gray-700">Add</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-gray-400 font-bold uppercase">Wolf Mode
            <select value={wolfMode} onChange={e => setWolfMode(e.target.value as 'auto' | 'manual')} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono">
              <option value="auto">Auto (Optimal)</option><option value="manual">Manual Position</option>
            </select>
          </label>
          {wolfMode === 'manual' && (
            <label className="text-[10px] text-gray-400 font-bold uppercase">Wolf Position
              <select value={manualWolfIndex} onChange={e => setManualWolfIndex(parseInt(e.target.value))} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono">
                {wolfPositionLabels.map(wp => (
                  <option key={wp.index} value={wp.index}>{wp.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>

    {/* Tier 3 */}
    <div className="lg:col-span-2">
      <div className="bg-black/50 border border-white/10 rounded-xl p-3 space-y-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Tier 3 · Optimizer</div>
        <label className="text-[10px] text-gray-400 font-bold uppercase">Mode<select value={solverModeUi} onChange={e => setSolverModeUi(e.target.value as 'regular' | 'irregular')} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono">
          <option value="regular">Mode A: Meantone (Regular)</option><option value="irregular">Mode B: Well-Temp (Irregular)</option>
        </select></label>
        {solverModeUi === 'regular' ? (
          <div className="space-y-3">
            <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Octa-Weighting</div>
                  <div className="text-[9px] text-gray-500">
                    Octa-Weighting maps 8 anchor preferences into (x,y,z), restores 8 weights, and solves a weighted LS generator with detuning feedback.
                  </div>
                </div>
                <label className="flex items-center gap-2 text-[10px] text-gray-300 font-bold uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={octaEnabled}
                    onChange={e => setOctaEnabled(e.target.checked)}
                    className="accent-indigo-500"
                  />
                  Enabled
                </label>
              </div>
              {!octaEnabled && (
                <div className="text-[9px] text-gray-500 italic">Enable to edit XYZ and activate Octa-Weighting.</div>
              )}
              {octaEnabled && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* Left column: Controls */}
                  <div className="space-y-2">
                    <OctaPad x={octaX} y={octaY} onChange={(x, y) => { setOctaX(x); setOctaY(y); }} />
                    <div className="text-[9px] text-gray-500 leading-tight">
                      X: generator bias (5ths vs 3rds). Y: prime-limit complexity (low vs high).
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Z (Interval Class)</span>
                      <span className="text-[9px] text-gray-500 font-mono">{fmtPct(octaZ, 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={octaZ}
                      onChange={e => setOctaZ(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                      <span>Structure</span>
                      <span>Color</span>
                    </div>
                    {/* Rank-2: Octave Stretch Slider */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Octave Stretch</span>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {octaveStiffness >= 0.99 ? 'Rigid' : octaveStiffness <= 0.01 ? 'Fluid' : `${Math.round((1 - octaveStiffness) * 100)}%`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={1 - octaveStiffness}
                        onChange={e => setOctaveStiffness(1 - parseFloat(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                      <div className="flex justify-between text-[9px] text-gray-500 font-mono">
                        <span>Rigid (1200¢)</span>
                        <span>Fluid</span>
                      </div>
                      {result?.periodStretchCents !== undefined && (
                        <div className={`mt-1 text-[9px] font-mono ${Math.abs(result.periodStretchCents) > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          Optimized: {fmt(result.optimizedPeriodCents ?? 1200, 1)}¢ ({result.periodStretchCents >= 0 ? '+' : ''}{fmt(result.periodStretchCents, 2)}¢)
                          {result.periodStretchWarning && (
                            <span className="ml-1 text-red-400" title="Large stretch may cause compatibility issues with standard instruments">⚠️</span>
                          )}
                        </div>
                      )}
                      <div className="text-[9px] text-gray-500 leading-tight mt-1">
                        Rank-2 mode: allows octave to stretch for better interval optimization.
                      </div>
                    </div>
                  </div>
                  {/* Right column: 3D Cube Visualization (replaces old anchor ratios grid) */}
                  <OctaCube3D
                    x={octaX}
                    y={octaY}
                    z={octaZ}
                    anchors={octaTargets}
                    enabled={octaEnabled}
                    onUpdateAnchor={updateOctaTarget}
                  />
                </div>
              )}
            </div>
            {/* Quad-Weighting Compass */}
            <div className={`bg-gray-900/40 border border-gray-800 rounded-xl p-2 ${octaEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Generator Matrix (Quad-Weighting)</div>
                  {quadEnabled && (
                    <div className="text-[9px] text-gray-500 font-mono">
                      {Object.entries(targetWeights)
                        .filter(([_, w]) => w > 0.05)
                        .slice(0, 3)
                        .map(([k, w]) => `${k}:${Math.round(w * 100)}%`)
                        .join(' ')}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-[10px] text-gray-300 font-bold uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quadEnabled}
                    onChange={e => setQuadEnabled(e.target.checked)}
                    className="accent-indigo-500"
                    disabled={octaEnabled}
                  />
                  Enabled
                </label>
              </div>

              {!quadEnabled && !octaEnabled && (
                <div className="text-[9px] text-gray-500 italic mb-1">Enable to activate specific Interval Weighting.</div>
              )}

              <div className={octaEnabled || !quadEnabled ? 'opacity-40 pointer-events-none' : ''}>
                <QuadWeightPad
                  availableRatios={ratioSpecs.map(r => ({ n: r.n, d: r.d, label: r.label }))}
                  onChange={setTargetWeights}
                  currentWeights={targetWeights}
                />
              </div>
              <div className="text-[9px] text-gray-500 leading-tight mt-2">
                {octaEnabled
                  ? 'Octa-Weighting is enabled. Quad-Weighting is ignored.'
                  : (quadEnabled ? 'Drag to balance the generator (pure 5th size) against four target ratios.' : 'Quad-Weighting is disabled.')}
              </div>
            </div>
            {/* Fallback Simple Slider */}
            <details className={`bg-gray-900/30 border border-gray-800 rounded-lg ${!quadEnabled && !octaEnabled ? 'ring-1 ring-indigo-500/50' : ''}`} open={!quadEnabled && !octaEnabled}>
              <summary className="cursor-pointer text-[10px] text-indigo-400 font-bold p-2">Simple 5ths ↔ 3rds Slider (Classic Mode)</summary>
              <div className="p-2 pt-0 space-y-1">
                <input type="range" min={0} max={1} step={0.01} value={weightThirds} onChange={e => setWeightThirds(parseFloat(e.target.value))} className="w-full accent-indigo-500" disabled={octaEnabled || quadEnabled} />
                <div className="flex justify-between text-[10px] font-mono text-gray-300"><span>5ths (Pythagorean)</span><span>{Math.round(weightThirds * 100)}% 3rds (Meantone)</span></div>
                <div className="text-[9px] text-gray-500 italic">
                  {octaEnabled ? 'Octa-Weighting is enabled. Slider is ignored.' : (quadEnabled ? 'Quad-Weighting is enabled. Slider is ignored.' : 'Active: Manual 5th/3rd Balance.')}
                </div>
              </div>
            </details>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase">Curve Shape
              <select value={curveShape} onChange={e => setCurveShape(e.target.value as CurveShape)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono">
                <option value="symmetrical">Symmetrical (Werckmeister-like)</option>
                <option value="gradual">Gradual (Vallotti/Young-like)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-300 font-bold uppercase cursor-pointer">
              <input type="checkbox" checked={constrainMinor3rds} onChange={e => setConstrainMinor3rds(e.target.checked)} className="accent-indigo-500" />
              Constrain Minor 3rds (6/5)
            </label>
            <div className="text-[9px] text-gray-500 font-mono italic">Mode B uses Iterative Reweighted Least Squares (IRLS) for approximate Minimax optimization.</div>
          </div>
        )}
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Key Specificity</div>
          <div className="text-[8px] text-gray-500 mb-2 leading-tight">
            Defines the "home keys" for this temperament. Center key gets the purest intervals;
            Flats/Sharps range determines how many keys in either direction receive optimized tuning.
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <label className="text-[10px] text-gray-400 font-bold uppercase">Center<select value={centerKey} onChange={e => setCenterKey(e.target.value)} className="mt-1 w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-mono">{FIFTHS_CIRCLE.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Flats<input type="number" min={0} max={12} value={rangeFlats} onChange={e => setRangeFlats(parseInt(e.target.value))} className="mt-1 w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
            <label className="text-[10px] text-gray-400 font-bold uppercase">Sharps<input type="number" min={0} max={12} value={rangeSharps} onChange={e => setRangeSharps(parseInt(e.target.value))} className="mt-1 w-full bg-black border border-gray-700 rounded-lg p-2 text-white font-mono" /></label>
          </div>
        </div>
      </div>
    </div>
  </div>
);
