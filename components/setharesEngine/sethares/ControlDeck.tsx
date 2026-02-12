import React, { useState } from 'react';
import { ratioToFractionLabel } from './utils';

const ControlDeck = ({
    baseFreq, setBaseFreq,
    minimaFilter, setMinimaFilter,
    minima,
    exportSCL, exportTUN, exportKSP, exportWavetable, exportPreset, importPreset,
    morphFrames, setMorphFrames,
    triadFixedF2, setTriadFixedF2,
    heatmapGain, setHeatmapGain,
    playTriad, playRandomArp,
    playTone,
    onLocateMinima,
    axisMode, setAxisMode,
    snapToMinima, setSnapToMinima,
    midiEnabled, setMidiEnabled,
    midiInputs, midiInputId, setMidiInputId,
    midiMappingMode, setMidiMappingMode,
    midiBaseNote, setMidiBaseNote,
    midiNoteBendRange, setMidiNoteBendRange,
    midiChannel, setMidiChannel,
    presetInputRef,
    algoParams, setAlgoParams,
    decayAmount, setDecayAmount,
    timeSlice, setTimeSlice,
    cbScale, setCbScale,
    masterVolume, setMasterVolume,
    onUndo, onRedo, onReset,
    canUndo, canRedo
}: any) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'acoustic' | 'scale' | 'time'>('acoustic');
    const orderedMinima = [...(minima || [])].sort((a, b) => a.cents - b.cents);
    const formatDeviation = (cents: number) => {
        const nearest = Math.round(cents / 100) * 100;
        const diff = cents - nearest;
        const sign = diff >= 0 ? '+' : '';
        return `${sign}${diff.toFixed(1)}c`;
    };

    return (
        <div className="bg-black/50 border border-white/10 rounded-xl mt-3">
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-3 cursor-pointer flex justify-between items-center bg-black/60 gap-3 ${isExpanded ? 'border-b border-gray-800' : ''}`}
            >
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    Control Deck {isExpanded ? '[-]' : '[+]'}
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            exportSCL();
                        }}
                        className="text-[10px] px-3 py-1.5 bg-indigo-900/50 border border-indigo-500/50 rounded-lg text-white font-bold hover:bg-indigo-800 shadow-lg"
                    >
                        EXPORT .SCL
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canUndo) onUndo?.();
                        }}
                        disabled={!canUndo}
                        className={`text-[10px] px-2 py-1.5 rounded-lg font-bold ${canUndo ? 'bg-indigo-900/50 border border-indigo-500/50 text-white hover:bg-indigo-800' : 'bg-gray-900 border border-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                        UNDO
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (canRedo) onRedo?.();
                        }}
                        disabled={!canRedo}
                        className={`text-[10px] px-2 py-1.5 rounded-lg font-bold ${canRedo ? 'bg-indigo-900/50 border border-indigo-500/50 text-white hover:bg-indigo-800' : 'bg-gray-900 border border-gray-700 text-gray-500 cursor-not-allowed'}`}
                    >
                        REDO
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onReset?.();
                        }}
                        className="text-[10px] px-2 py-1.5 bg-red-900/30 border border-red-500/50 rounded-lg text-white font-bold hover:bg-red-800/50"
                    >
                        RESET
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3">
                    <div className="flex gap-2 mb-3 flex-wrap">
                        {[
                            { id: 'acoustic', label: 'ACOUSTIC' },
                            { id: 'scale', label: 'SCALE' },
                            { id: 'time', label: 'TIME/PLAY' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`text-[10px] px-2 py-1 rounded border font-bold ${activeTab === tab.id ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="border border-gray-800 bg-gray-950 rounded-lg p-3 max-h-72 overflow-y-auto custom-scrollbar">
                        {activeTab === 'acoustic' && (
                            <div className="space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2">Acoustic Constants</div>
                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Base Frequency (f0)</span>
                                    <span className="text-indigo-400">{baseFreq} Hz</span>
                                </label>
                                <input
                                    type="range" min="50" max="880" step="1"
                                    value={baseFreq}
                                    onChange={(e) => setBaseFreq(parseInt(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />

                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Roughness Coeff A</span>
                                    <span className="text-indigo-400">{algoParams.a.toFixed(2)}</span>
                                </label>
                                <input
                                    type="range" min="0.1" max="10" step="0.1"
                                    value={algoParams.a}
                                    onChange={(e) => setAlgoParams((p: any) => ({ ...p, a: parseFloat(e.target.value) }))}
                                    className="w-full accent-indigo-500"
                                />

                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Roughness Coeff B</span>
                                    <span className="text-indigo-400">{algoParams.b.toFixed(2)}</span>
                                </label>
                                <input
                                    type="range" min="0.1" max="10" step="0.1"
                                    value={algoParams.b}
                                    onChange={(e) => setAlgoParams((p: any) => ({ ...p, b: parseFloat(e.target.value) }))}
                                    className="w-full accent-indigo-500"
                                />

                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Critical Band Scale</span>
                                    <span className="text-indigo-400">{cbScale.toFixed(2)}x</span>
                                </label>
                                <input
                                    type="range" min="0.1" max="4" step="0.05"
                                    value={cbScale}
                                    onChange={(e) => setCbScale(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />
                            </div>
                        )}

                        {activeTab === 'scale' && (
                            <div className="space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2">Scale Generation</div>
                                <div className="flex gap-4 flex-wrap">
                                    <label className="flex flex-col gap-1 text-gray-400 text-[10px] flex-1 min-w-[120px]">
                                        <span>Depth Min</span>
                                        <input
                                            type="range" min="0" max="0.2" step="0.01"
                                            value={minimaFilter.depth}
                                            onChange={(e) => setMinimaFilter((prev: any) => ({ ...prev, depth: parseFloat(e.target.value) }))}
                                            className="w-full accent-indigo-500"
                                        />
                                        <span className="text-indigo-400">{minimaFilter.depth.toFixed(2)}</span>
                                    </label>
                                    <label className="flex flex-col gap-1 text-gray-400 text-[10px] flex-1 min-w-[120px]">
                                        <span>Width Min</span>
                                        <input
                                            type="range" min="0" max="80" step="1"
                                            value={minimaFilter.width}
                                            onChange={(e) => setMinimaFilter((prev: any) => ({ ...prev, width: parseFloat(e.target.value) }))}
                                            className="w-full accent-indigo-500"
                                        />
                                        <span className="text-indigo-400">{minimaFilter.width.toFixed(0)}c</span>
                                    </label>
                                </div>
                                <div className="text-gray-500 text-[10px]">
                                    Detected Minima: <span className="text-indigo-400">{minima?.length ?? 0}</span>
                                </div>

                                <label className="flex items-center gap-2 text-gray-400 text-[10px] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={snapToMinima}
                                        onChange={(e) => setSnapToMinima(e.target.checked)}
                                        className="accent-indigo-500"
                                    />
                                    <span>Snap to Minima</span>
                                </label>

                                <div className="text-gray-400 text-[10px]">Axis Mode</div>
                                <div className="flex gap-4">
                                    {(['cents', 'hz'] as const).map(mode => (
                                        <label key={mode} className="flex items-center gap-2 text-gray-400 text-[10px] cursor-pointer">
                                            <input
                                                type="radio"
                                                name="axis-mode"
                                                checked={axisMode === mode}
                                                onChange={() => setAxisMode(mode)}
                                                className="accent-indigo-500"
                                            />
                                            <span>{mode.toUpperCase()}</span>
                                        </label>
                                    ))}
                                </div>

                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2 pt-2">Generated Scale</div>
                                <div className="border border-gray-800 bg-gray-900/50 rounded-lg max-h-36 overflow-y-auto p-2 custom-scrollbar">
                                    {orderedMinima.length === 0 && (
                                        <div className="text-gray-500 text-[10px] p-2">No minima detected yet.</div>
                                    )}
                                    {orderedMinima.map((m: any, idx: number) => {
                                        const ratioLabel = ratioToFractionLabel(m.ratio, 32) || m.ratio.toFixed(4);
                                        return (
                                            <div key={`${m.cents}-${idx}`} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center mb-2 pb-2 border-b border-gray-800 last:border-b-0">
                                                <div className="text-[10px]">
                                                    <div className="text-indigo-400 font-bold">{ratioLabel}</div>
                                                    <div className="text-gray-500">{m.cents.toFixed(1)}c - Dev {formatDeviation(m.cents)}</div>
                                                </div>
                                                <button
                                                    onClick={() => playTone?.(m.ratio)}
                                                    className="text-[9px] px-2 py-1 bg-indigo-900/50 border border-indigo-500/50 rounded text-white font-bold hover:bg-indigo-800"
                                                >
                                                    PLAY
                                                </button>
                                                <button
                                                    onClick={() => onLocateMinima?.(m.cents)}
                                                    className="text-[9px] px-2 py-1 bg-blue-900/50 border border-blue-500/50 rounded text-white font-bold hover:bg-blue-800"
                                                >
                                                    LOCATE
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <details className="bg-gray-900/30 border border-gray-800 rounded-lg p-2">
                                    <summary className="cursor-pointer text-indigo-400 text-[11px] font-bold mb-2">EXPORT and PRESETS</summary>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={exportSCL} className="flex-1 text-[10px] py-1.5 bg-indigo-900/50 border border-indigo-500/50 rounded text-white font-bold hover:bg-indigo-800">EXP .SCL</button>
                                        <button onClick={exportTUN} className="flex-1 text-[10px] py-1.5 bg-blue-900/50 border border-blue-500/50 rounded text-white font-bold hover:bg-blue-800">EXP .TUN</button>
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <button onClick={exportKSP} className="flex-1 text-[10px] py-1.5 bg-yellow-900/50 border border-yellow-500/50 rounded text-white font-bold hover:bg-yellow-800">EXP .KSP</button>
                                        <button onClick={exportWavetable} className="flex-1 text-[10px] py-1.5 bg-gray-800 border border-gray-600 rounded text-white font-bold hover:bg-gray-700">EXP .WAV</button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={exportPreset} className="flex-1 text-[10px] py-1.5 bg-cyan-900/50 border border-cyan-500/50 rounded text-white font-bold hover:bg-cyan-800">SAVE PRESET</button>
                                        <button onClick={() => presetInputRef?.current?.click()} className="flex-1 text-[10px] py-1.5 bg-purple-900/50 border border-purple-500/50 rounded text-white font-bold hover:bg-purple-800">IMPORT</button>
                                        <input
                                            ref={presetInputRef}
                                            type="file"
                                            accept=".json,application/json"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) importPreset(file);
                                                e.currentTarget.value = '';
                                            }}
                                        />
                                    </div>
                                </details>

                                <details className="bg-gray-900/30 border border-gray-800 rounded-lg p-2">
                                    <summary className="cursor-pointer text-indigo-400 text-[11px] font-bold mb-2">MIDI I/O</summary>
                                    <label className="flex items-center gap-2 text-gray-400 text-[10px] mb-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={midiEnabled}
                                            onChange={(e) => setMidiEnabled(e.target.checked)}
                                            className="accent-indigo-500"
                                        />
                                        <span>Enable MIDI</span>
                                    </label>
                                    <label className="flex flex-col gap-1 text-gray-400 text-[10px] mb-2">
                                        <span>Input Device</span>
                                        <select
                                            value={midiInputId}
                                            onChange={(e) => setMidiInputId(e.target.value)}
                                            className="bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[10px]"
                                            disabled={!midiInputs || midiInputs.length === 0}
                                        >
                                            {(midiInputs || []).length === 0 && <option value="">No MIDI devices</option>}
                                            {(midiInputs || []).map((input: any) => (
                                                <option key={input.id} value={input.id}>{input.name || input.manufacturer || input.id}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-1 text-gray-400 text-[10px] mb-2">
                                        <span>Mapping Mode</span>
                                        <select
                                            value={midiMappingMode}
                                            onChange={(e) => setMidiMappingMode(e.target.value)}
                                            className="bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[10px]"
                                        >
                                            <option value="chromatic">Chromatic</option>
                                            <option value="white">White Keys</option>
                                        </select>
                                    </label>
                                    <label className="flex justify-between text-gray-400 text-[10px]">
                                        <span>Base Note</span>
                                        <span className="text-indigo-400">{midiBaseNote}</span>
                                    </label>
                                    <input
                                        type="range" min="0" max="127" step="1"
                                        value={midiBaseNote}
                                        onChange={(e) => setMidiBaseNote(parseInt(e.target.value))}
                                        className="w-full accent-indigo-500 mb-2"
                                    />
                                    <label className="flex justify-between text-gray-400 text-[10px]">
                                        <span>Bend Range</span>
                                        <span className="text-indigo-400">{midiNoteBendRange} st</span>
                                    </label>
                                    <input
                                        type="range" min="0" max="12" step="1"
                                        value={midiNoteBendRange}
                                        onChange={(e) => setMidiNoteBendRange(parseInt(e.target.value))}
                                        className="w-full accent-indigo-500 mb-2"
                                    />
                                    <label className="flex flex-col gap-1 text-gray-400 text-[10px]">
                                        <span>Channel</span>
                                        <select
                                            value={midiChannel}
                                            onChange={(e) => setMidiChannel(parseInt(e.target.value))}
                                            className="bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[10px]"
                                        >
                                            <option value={-1}>All Channels</option>
                                            {Array.from({ length: 16 }, (_, i) => (
                                                <option key={i + 1} value={i}>{i + 1}</option>
                                            ))}
                                        </select>
                                    </label>
                                </details>
                            </div>
                        )}

                        {activeTab === 'time' && (
                            <div className="space-y-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2">Time-Varying Spectra</div>
                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Decay Amount</span>
                                    <span className="text-indigo-400">{decayAmount.toFixed(2)}</span>
                                </label>
                                <input
                                    type="range" min="0" max="4" step="0.05"
                                    value={decayAmount}
                                    onChange={(e) => setDecayAmount(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />

                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Time Slice</span>
                                    <span className="text-indigo-400">{timeSlice.toFixed(2)}</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={timeSlice}
                                    onChange={(e) => setTimeSlice(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />

                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Morph Frames</span>
                                    <span className="text-indigo-400">{Math.round(morphFrames)}</span>
                                </label>
                                <input
                                    type="range" min="1" max="64" step="1"
                                    value={morphFrames}
                                    onChange={(e) => setMorphFrames(parseInt(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />

                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2 pt-2">Playback</div>
                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Master Volume</span>
                                    <span className="text-indigo-400">{Math.round(masterVolume * 100)}%</span>
                                </label>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={masterVolume}
                                    onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />
                                <div className="flex gap-2">
                                    <button onClick={playTriad} className="flex-1 text-[10px] py-1.5 bg-indigo-900/50 border border-indigo-500/50 rounded-lg text-white font-bold hover:bg-indigo-800">PLAY TRIAD</button>
                                    <button onClick={playRandomArp} className="flex-1 text-[10px] py-1.5 bg-orange-900/50 border border-orange-500/50 rounded-lg text-white font-bold hover:bg-orange-800">PLAY RANDOM ARP</button>
                                </div>

                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300 border-b border-gray-800 pb-2 pt-2">Triad Surface</div>
                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Fixed f2 (cents)</span>
                                    <span className="text-indigo-400">{triadFixedF2.toFixed(1)}c</span>
                                </label>
                                <input
                                    type="range" min="0" max="1200" step="1"
                                    value={triadFixedF2}
                                    onChange={(e) => setTriadFixedF2(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />
                                <label className="flex justify-between text-gray-400 text-[10px]">
                                    <span>Heatmap Gain</span>
                                    <span className="text-indigo-400">{heatmapGain.toFixed(1)}x</span>
                                </label>
                                <input
                                    type="range" min="0.1" max="6" step="0.1"
                                    value={heatmapGain}
                                    onChange={(e) => setHeatmapGain(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlDeck;
