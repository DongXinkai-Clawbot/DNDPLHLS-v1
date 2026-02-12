
import React from 'react';
import { Vector3 } from 'three';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import { DEFAULT_CHORDS } from '../../constants';
import { calculateCents, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio } from '../../musicLogic';
import type { PlayMode, ArpPattern, NodeData } from '../../types';

const QUICK_CHORDS = DEFAULT_CHORDS.map((chord, idx) => ({
    id: `common-${idx}`,
    name: `Common: ${chord.name}`,
    ratios: chord.ratios
}));

const buildQuickNodes = (ratios: string[], chordId: string): NodeData[] => {
    const base = new Vector3(0, 0, 0);
    return ratios.map((ratioStr, idx) => {
        const frac = parseGeneralRatio(ratioStr);
        const { ratio, octaves } = normalizeOctave(frac);
        return {
            id: `quick-${chordId}-${idx}`,
            position: base,
            primeVector: getPrimeVectorFromRatio(ratio.n, ratio.d),
            ratio,
            octave: octaves,
            cents: calculateCents(ratio),
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: ratioStr
        };
    });
};

export const ProgressionPanel = () => {
    const {
        isProgressionVisible,
        progressionSteps,
        progressionIsPlaying,
        progressionBpm,
        progressionTogglePlay,
        progressionStop,
        progressionAddStep,
        progressionAddRestStep,
        progressionRemoveStep,
        progressionMoveStep,
        progressionDuplicateStep,
        progressionUpdateStep,
        progressionSetBpm,
        progressionClearSteps,
        savedChords,
        progressionCurrentStep,
        saveChord
    } = useStore((s) => ({
        isProgressionVisible: s.isProgressionVisible,
        progressionSteps: s.progressionSteps,
        progressionIsPlaying: s.progressionIsPlaying,
        progressionBpm: s.progressionBpm,
        progressionTogglePlay: s.progressionTogglePlay,
        progressionStop: s.progressionStop,
        progressionAddStep: s.progressionAddStep,
        progressionAddRestStep: s.progressionAddRestStep,
        progressionRemoveStep: s.progressionRemoveStep,
        progressionMoveStep: s.progressionMoveStep,
        progressionDuplicateStep: s.progressionDuplicateStep,
        progressionUpdateStep: s.progressionUpdateStep,
        progressionSetBpm: s.progressionSetBpm,
        progressionClearSteps: s.progressionClearSteps,
        savedChords: s.savedChords,
        progressionCurrentStep: s.progressionCurrentStep,
        saveChord: s.saveChord
    }), shallow);

    if (!isProgressionVisible) return null;

    const handleQuickPreset = (presetId: string) => {
        const preset = QUICK_CHORDS.find(p => p.id === presetId);
        if (!preset) return;

        const existing = savedChords.find(c => c.name === preset.name);
        if (existing) {
            progressionAddStep(existing.id);
            return;
        }

        const name = preset.name;
        const nodes = buildQuickNodes(preset.ratios, presetId);
        saveChord(name, nodes);

        setTimeout(() => {
            const s = useStore.getState();
            const chord = s.savedChords.find(c => c.name === name) || s.savedChords[s.savedChords.length - 1];
            if (chord) progressionAddStep(chord.id);
        }, 10);
    };

    const tapStateRef = React.useRef<{ lastTap: number; intervals: number[] }>({ lastTap: 0, intervals: [] });

    const handleTapTempo = () => {
        const now = performance.now();
        const lastTap = tapStateRef.current.lastTap;
        if (lastTap > 0) {
            const interval = now - lastTap;
            if (interval > 200 && interval < 2000) {
                const next = [...tapStateRef.current.intervals, interval].slice(-4);
                const avg = next.reduce((a, b) => a + b, 0) / next.length;
                const bpm = Math.max(40, Math.min(240, Math.round(60000 / avg)));
                tapStateRef.current.intervals = next;
                progressionSetBpm(bpm);
            } else {
                tapStateRef.current.intervals = [];
            }
        }
        tapStateRef.current.lastTap = now;
    };

    return (
        <div className="flex flex-col h-full w-full bg-gray-900/50">
            <div className="flex flex-col h-full overflow-hidden">
                <div className="p-3 border-b border-gray-800 bg-gray-900/50 space-y-2 shrink-0">
                    <div className="flex gap-2">
                        <button 
                            onClick={progressionTogglePlay}
                            className={`flex-1 py-2 rounded text-xs font-bold uppercase transition-all shadow-lg ${progressionIsPlaying ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'bg-green-600 text-white hover:bg-green-500'}`}
                        >
                            {progressionIsPlaying ? 'II Pause' : '▶ Play'}
                        </button>
                        <button 
                            onClick={progressionStop}
                            className="w-16 py-2 rounded text-xs font-bold uppercase bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-800 hover:text-white transition-all"
                        >
                            ■ Stop
                        </button>
                        <button 
                            onClick={progressionClearSteps}
                            disabled={progressionSteps.length === 0}
                            className="w-16 py-2 rounded text-xs font-bold uppercase bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white transition-all disabled:opacity-40 disabled:hover:bg-gray-800"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex justify-between items-center bg-black/40 p-1.5 rounded border border-gray-800">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Tempo</span>
                        <div className="flex items-center gap-2">
                            <input 
                                type="range" min="40" max="240" 
                                value={progressionBpm}
                                onChange={(e) => progressionSetBpm(parseInt(e.target.value))}
                                className="w-20 h-1 accent-blue-500"
                            />
                            <span className="text-xs font-mono text-blue-300 w-8 text-right">{progressionBpm}</span>
                            <button
                                onClick={handleTapTempo}
                                className="text-[9px] bg-blue-900/40 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800 uppercase font-bold"
                            >
                                Tap
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] text-gray-500 uppercase font-bold">
                        <span>Steps</span>
                        <span className="text-gray-300 font-mono">{progressionSteps.length}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-black/20">
                    {progressionSteps.length === 0 && (
                        <div className="text-center text-gray-600 text-[10px] italic py-8">
                            Add chords from library to build a sequence.
                        </div>
                    )}
                    {progressionSteps.map((step, idx) => {
                        const chord = savedChords.find(c => c.id === step.chordId);
                        const isActive = progressionCurrentStep === idx;
                        const isArp = step.mode === 'arp';
                        const subdivision = step.subdivision || 1;
                        const subdivisionOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16];
                        const subdivisionSelectValue = subdivisionOptions.includes(subdivision) ? subdivision.toString() : 'custom';

                        return (
                            <div key={step.id} className={`p-2 rounded border transition-all flex flex-col gap-2 ${isActive ? 'bg-blue-900/40 border-blue-400 shadow-[inset_0_0_10px_rgba(59,130,246,0.3)]' : 'bg-gray-800/60 border-gray-700 hover:border-gray-600'}`}>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className={`text-[9px] font-mono w-4 ${isActive ? 'text-white font-bold' : 'text-gray-500'}`}>{idx + 1}</span>
                                        <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-blue-200'}`}>
                                            {chord ? chord.name : "Unknown Chord"}
                                        </span>
                                        {chord?.nodes?.length ? (
                                            <span className="text-[9px] text-gray-500 font-mono">({chord.nodes.length})</span>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => progressionMoveStep(idx, idx - 1)}
                                            disabled={idx === 0}
                                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:hover:border-gray-700"
                                            title="Move Up"
                                        >
                                            Up
                                        </button>
                                        <button
                                            onClick={() => progressionMoveStep(idx, idx + 1)}
                                            disabled={idx === progressionSteps.length - 1}
                                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 disabled:hover:border-gray-700"
                                            title="Move Down"
                                        >
                                            Dn
                                        </button>
                                        <button
                                            onClick={() => progressionDuplicateStep(idx)}
                                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
                                            title="Duplicate Step"
                                        >
                                            Dup
                                        </button>
                                        <button onClick={() => progressionRemoveStep(idx)} className="text-red-500 hover:text-white text-[10px] px-1">×</button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                        <label className="text-[8px] text-gray-500 uppercase font-bold">Mode</label>
                                        <select 
                                            value={step.mode || 'chord'} 
                                            onChange={(e) => progressionUpdateStep(idx, { mode: e.target.value as PlayMode })}
                                            className="bg-black border border-gray-700 text-[10px] text-white rounded px-1 outline-none h-5"
                                        >
                                            <option value="chord">Chord</option>
                                            <option value="arp">Arp</option>
                                            <option value="rest">Rest</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col">
                                        <label className="text-[8px] text-gray-500 uppercase font-bold">Duration (Beats)</label>
                                        <div className="flex items-center gap-1">
                                            <div className="flex bg-black rounded border border-gray-700 h-5">
                                                {[1, 2, 4].map(dur => (
                                                    <button 
                                                        key={dur} 
                                                        onClick={() => progressionUpdateStep(idx, { duration: dur })}
                                                        className={`flex-1 text-[8px] font-bold px-1 ${step.duration === dur ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                                    >
                                                        {dur}
                                                    </button>
                                                ))}
                                            </div>
                                            <input
                                                type="number"
                                                min="0.05"
                                                max="16"
                                                step="0.05"
                                                value={step.duration}
                                                onChange={(e) => progressionUpdateStep(idx, { duration: Math.max(0.05, parseFloat(e.target.value) || 0.05) })}
                                                className="w-12 bg-black border border-gray-700 text-[8px] text-white rounded px-1 py-0.5 text-center"
                                                title="Custom duration in beats"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {isArp && (
                                    <div className="bg-black/30 p-2 rounded border border-gray-700/50 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex flex-col">
                                                <label className="text-[8px] text-gray-500 uppercase font-bold">Pattern</label>
                                                <select 
                                                    value={step.arpPattern || 'up'} 
                                                    onChange={(e) => progressionUpdateStep(idx, { arpPattern: e.target.value as ArpPattern })}
                                                    className="bg-gray-900 border border-gray-700 text-[9px] text-blue-200 rounded px-1 outline-none h-5"
                                                >
                                                    <option value="up">Up</option>
                                                    <option value="down">Down</option>
                                                    <option value="up-down">Up-Down</option>
                                                    <option value="random">Random</option>
                                                </select>
                                            </div>
                                            <div className="flex-1 flex flex-col">
                                                <label className="text-[8px] text-gray-500 uppercase font-bold">Notes/Beat</label>
                                                <div className="flex items-center gap-1">
                                                    <select 
                                                        value={subdivisionSelectValue} 
                                                        onChange={(e) => {
                                                            if (e.target.value !== 'custom') {
                                                                progressionUpdateStep(idx, { subdivision: parseInt(e.target.value) });
                                                            }
                                                        }}
                                                        className="bg-gray-900 border border-gray-700 text-[9px] text-green-200 rounded px-1 outline-none h-5"
                                                    >
                                                        {subdivisionOptions.map(opt => (
                                                            <option key={opt} value={opt}>{opt}{opt === 3 ? ' (Trip)' : opt === 5 ? ' (5-let)' : opt === 7 ? ' (7-let)' : ''}</option>
                                                        ))}
                                                        <option value="custom">Custom</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="32"
                                                        step="1"
                                                        value={subdivision}
                                                        onChange={(e) => progressionUpdateStep(idx, { subdivision: Math.max(1, parseInt(e.target.value) || 1) })}
                                                        className="w-10 bg-black border border-gray-700 text-[9px] text-green-200 rounded px-1 outline-none h-5 text-center"
                                                        title="Notes per beat (n-let)"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[8px] text-gray-500 uppercase font-bold w-8">Gate</label>
                                            <input 
                                                type="range" min="0.1" max="1.0" step="0.1" 
                                                value={step.gate || 0.9} 
                                                onChange={(e) => progressionUpdateStep(idx, { gate: parseFloat(e.target.value) })}
                                                className="flex-1 h-1 accent-purple-500"
                                            />
                                            <span className="text-[8px] font-mono text-gray-400 w-6 text-right">{(step.gate || 0.9).toFixed(1)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-2 border-t border-gray-800 bg-gray-900 shrink-0">
                    {savedChords.length > 0 && (
                        <select 
                            className="w-full bg-blue-900/20 border border-blue-800 text-blue-200 text-xs rounded py-1.5 px-2 outline-none hover:bg-blue-900/40 transition-colors cursor-pointer"
                            onChange={(e) => {
                                if(e.target.value) {
                                    progressionAddStep(e.target.value);
                                    e.target.value = "";
                                }
                            }}
                            value=""
                        >
                            <option value="" disabled>+ Add Step (Select Chord)</option>
                            {savedChords.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                    <select
                        className={`w-full bg-gray-900/60 border border-gray-700 text-gray-200 text-xs rounded py-1.5 px-2 outline-none hover:bg-gray-900/80 transition-colors cursor-pointer ${savedChords.length > 0 ? 'mt-2' : ''}`}
                        onChange={(e) => {
                            if (e.target.value) {
                                handleQuickPreset(e.target.value);
                                e.target.value = "";
                            }
                        }}
                        value=""
                    >
                        <option value="" disabled>+ Add Step (Quick Chord)</option>
                        {QUICK_CHORDS.map(chord => (
                            <option key={chord.id} value={chord.id}>{chord.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={progressionAddRestStep}
                        className="w-full mt-2 text-[9px] text-center border p-2 rounded transition-all font-bold uppercase text-gray-300 border-gray-700 bg-black/40 hover:bg-black/60 hover:text-white"
                    >
                        + Add Rest
                    </button>
                </div>
            </div>
        </div>
    );
};
