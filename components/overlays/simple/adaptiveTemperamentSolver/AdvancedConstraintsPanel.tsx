import React from 'react';
import { NOTE_NAMES } from './constants';
import type { AdvancedIntervalItem } from './types';
import { fmt } from './utils';

type AdvancedConstraintsPanelProps = {
  boundaryCents: number;
  boundaryRatio: number;
  boundaryNumerator: number;
  boundaryDenominator: number;
  N: number;
  baseFrequency: number;
  updateBoundaryRatio: (nextN: number, nextD: number) => void;
  setN: (value: number) => void;
  setBaseFrequency: (value: number) => void;
  newIntervalDegree: number;
  setNewIntervalDegree: (value: number) => void;
  newIntervalRatio: string;
  setNewIntervalRatio: (value: string) => void;
  newIntervalTolerance: number;
  setNewIntervalTolerance: (value: number) => void;
  newIntervalPriority: number;
  setNewIntervalPriority: (value: number) => void;
  newIntervalHardMax: string;
  setNewIntervalHardMax: (value: string) => void;
  addAdvancedInterval: () => void;
  advancedIntervals: AdvancedIntervalItem[];
  updateAdvancedInterval: (id: string, patch: Partial<AdvancedIntervalItem>) => void;
  removeAdvancedInterval: (id: string) => void;
  normalizeRatioToBoundary: (n: number, d: number) => { n: number; d: number; adjusted: boolean };
  octaveTolerance: number;
  setOctaveTolerance: (value: number) => void;
  octavePriority: number;
  setOctavePriority: (value: number) => void;
  octaveHardMax: string;
  setOctaveHardMax: (value: string) => void;
};

export const AdvancedConstraintsPanel: React.FC<AdvancedConstraintsPanelProps> = ({
  boundaryCents,
  boundaryRatio,
  boundaryNumerator,
  boundaryDenominator,
  N,
  baseFrequency,
  updateBoundaryRatio,
  setN,
  setBaseFrequency,
  newIntervalDegree,
  setNewIntervalDegree,
  newIntervalRatio,
  setNewIntervalRatio,
  newIntervalTolerance,
  setNewIntervalTolerance,
  newIntervalPriority,
  setNewIntervalPriority,
  newIntervalHardMax,
  setNewIntervalHardMax,
  addAdvancedInterval,
  advancedIntervals,
  updateAdvancedInterval,
  removeAdvancedInterval,
  normalizeRatioToBoundary,
  octaveTolerance,
  setOctaveTolerance,
  octavePriority,
  setOctavePriority,
  octaveHardMax,
  setOctaveHardMax
}) => (
  <div className="bg-black/60 border border-amber-500/30 rounded-2xl p-4 space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">Advanced Constraint Mode</div>
        <div className="text-[9px] text-gray-500">Boundary → Notes → Degree Intervals → Tolerance/Priority/Hard Max</div>
      </div>
      <div className="text-[9px] text-amber-300 font-mono">{fmt(boundaryCents, 2)}¢ boundary</div>
    </div>

    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Boundary + Notes</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Boundary Ratio (n/d)
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={2}
              value={boundaryNumerator}
              onChange={e => updateBoundaryRatio(parseInt(e.target.value || '2', 10), boundaryDenominator)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
            />
            <span className="text-gray-500 mt-2">/</span>
            <input
              type="number"
              min={1}
              value={boundaryDenominator}
              onChange={e => updateBoundaryRatio(boundaryNumerator, parseInt(e.target.value || '1', 10))}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
            />
          </div>
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Notes in Boundary (N)
          <input
            type="number"
            min={5}
            max={72}
            value={N}
            onChange={e => setN(parseInt(e.target.value || '12', 10))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Base Freq (Hz)
          <input
            type="number"
            min={20}
            max={2000}
            value={baseFrequency}
            onChange={e => setBaseFrequency(parseFloat(e.target.value || '440'))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
      </div>
      <div className="text-[9px] text-gray-500 font-mono">
        Boundary = {fmt(boundaryRatio, 4)} ratio ({fmt(boundaryCents, 2)} cents)
      </div>
    </div>

    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Add Degree Interval</div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Degree
          <select
            value={newIntervalDegree}
            onChange={e => setNewIntervalDegree(parseInt(e.target.value, 10))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          >
            {Array.from({ length: N }, (_, i) => (
              <option key={i} value={i}>{N === 12 ? NOTE_NAMES[i] : `deg${i}`}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          JI Interval (a/b)
          <input
            type="text"
            value={newIntervalRatio}
            onChange={e => setNewIntervalRatio(e.target.value)}
            placeholder="e.g. 5/4"
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Tolerance (cents)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={newIntervalTolerance}
            onChange={e => setNewIntervalTolerance(parseFloat(e.target.value || '0'))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Priority
          <input
            type="number"
            min={0}
            step={0.01}
            value={newIntervalPriority}
            onChange={e => setNewIntervalPriority(parseFloat(e.target.value || '0'))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Hard Max (cents)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={newIntervalHardMax}
            onChange={e => setNewIntervalHardMax(e.target.value)}
            placeholder="optional"
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Tolerance Drag</div>
          <input
            type="range"
            min={0}
            max={50}
            step={0.01}
            value={newIntervalTolerance}
            onChange={e => setNewIntervalTolerance(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Priority Drag</div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.01}
            value={newIntervalPriority}
            onChange={e => setNewIntervalPriority(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
      </div>
      <button
        onClick={addAdvancedInterval}
        className="bg-amber-600 hover:bg-amber-500 text-black font-black text-[10px] uppercase px-3 py-2 rounded-lg"
      >
        Add Interval
      </button>
    </div>

    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Active Constraints</div>
      {advancedIntervals.length === 0 && (
        <div className="text-[9px] text-gray-500 italic">No intervals added yet.</div>
      )}

      {advancedIntervals.map(interval => {
        const ratioText = `${interval.n}/${interval.d}`;
        return (
          <div key={interval.id} className="grid grid-cols-1 lg:grid-cols-6 gap-2 items-center bg-black/40 border border-gray-800 rounded p-2">
            <select
              value={interval.degree}
              onChange={e => updateAdvancedInterval(interval.id, { degree: parseInt(e.target.value, 10) })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono text-[10px]"
            >
              {Array.from({ length: N }, (_, i) => (
                <option key={i} value={i}>{N === 12 ? NOTE_NAMES[i] : `deg${i}`}</option>
              ))}
            </select>
            <input
              type="text"
              value={ratioText}
              onChange={e => {
                const m = e.target.value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
                if (!m) return;
                const normalized = normalizeRatioToBoundary(parseInt(m[1], 10), parseInt(m[2], 10));
                updateAdvancedInterval(interval.id, { n: normalized.n, d: normalized.d });
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono text-[10px]"
            />
            <div className="flex flex-col gap-1">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={interval.toleranceCents}
                onChange={e => updateAdvancedInterval(interval.id, { toleranceCents: parseFloat(e.target.value || '0') })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[10px]"
              />
              <input
                type="range"
                min={0}
                max={50}
                step={0.01}
                value={interval.toleranceCents}
                onChange={e => updateAdvancedInterval(interval.id, { toleranceCents: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="number"
                min={0}
                step={0.01}
                value={interval.priority}
                onChange={e => updateAdvancedInterval(interval.id, { priority: parseFloat(e.target.value || '0') })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[10px]"
              />
              <input
                type="range"
                min={0}
                max={100}
                step={0.01}
                value={interval.priority}
                onChange={e => updateAdvancedInterval(interval.id, { priority: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={interval.maxErrorCents ?? ''}
              onChange={e => updateAdvancedInterval(interval.id, { maxErrorCents: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="hard max"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono text-[10px]"
            />
            <button
              onClick={() => removeAdvancedInterval(interval.id)}
              className="bg-red-700 hover:bg-red-600 text-white text-[10px] font-black uppercase px-2 py-2 rounded"
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>

    <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">Octave Stretch Constraint</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Tolerance (cents)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={octaveTolerance}
            onChange={e => setOctaveTolerance(parseFloat(e.target.value || '0'))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Priority
          <input
            type="number"
            min={0}
            step={0.01}
            value={octavePriority}
            onChange={e => setOctavePriority(parseFloat(e.target.value || '0'))}
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
        <label className="text-[10px] text-gray-400 font-bold uppercase">
          Hard Max (cents)
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={octaveHardMax}
            onChange={e => setOctaveHardMax(e.target.value)}
            placeholder="optional"
            className="mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white font-mono"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Tolerance Drag</div>
          <input
            type="range"
            min={0}
            max={50}
            step={0.01}
            value={octaveTolerance}
            onChange={e => setOctaveTolerance(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase">Priority Drag</div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.01}
            value={octavePriority}
            onChange={e => setOctavePriority(parseFloat(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>
      </div>
    </div>
  </div>
);
