import React from 'react';
import { MEANTONE_PRESETS, WELL_TEMPERED_PRESETS } from '../../constants';
import { notifyWarning } from '../../../../../utils/notifications';
import { RetuneStatsPanel } from './RetuneStatsPanel';

type CustomMapPanelProps = {
    retuneCustomScale: string[] | null;
    newScaleName: string;
    setNewScaleName: (name: string) => void;
    equalStepBase: number;
    setEqualStepBase: (value: number) => void;
    equalStepDivisor: number;
    setEqualStepDivisor: (value: number) => void;
    meantonePresetId: string;
    setMeantonePresetId: (value: string) => void;
    wellTemperedPresetId: string;
    setWellTemperedPresetId: (value: string) => void;
    customCommaInput: string;
    setCustomCommaInput: (value: string) => void;
    handleCustomScaleChange: (scale: string[]) => void;
    handleScaleStepChange: (index: number, value: string) => void;
    generateTETScale: (divisions: number) => void;
    generateEqualStepScale: () => void;
    applyMeantonePreset: (id: string) => void;
    applyCustomComma: (comma: string) => void;
    applyWellTemperedPreset: (id: string) => void;
    clearCustomMap: () => void;
    resetToStandardJI: () => void;
    handleSaveScale: () => void;
    handleExportMts: (scale: string[], name: string) => void;
    handlePlayRatio: (ratio: string, index: number) => void;
    handleDivisionChange: (value: number) => void;
    deleteMidiScale: (id: string) => void;
    formatRatioInput: (value: string) => string;
    savedMidiScales: any[];
    showStats: boolean;
    onToggleStats: () => void;
    retuneStats: any;
};

export const CustomMapPanel = ({
    retuneCustomScale,
    newScaleName,
    setNewScaleName,
    equalStepBase,
    setEqualStepBase,
    equalStepDivisor,
    setEqualStepDivisor,
    meantonePresetId,
    setMeantonePresetId,
    wellTemperedPresetId,
    setWellTemperedPresetId,
    customCommaInput,
    setCustomCommaInput,
    handleCustomScaleChange,
    handleScaleStepChange,
    generateTETScale,
    generateEqualStepScale,
    applyMeantonePreset,
    applyCustomComma,
    applyWellTemperedPreset,
    clearCustomMap,
    resetToStandardJI,
    handleSaveScale,
    handleExportMts,
    handlePlayRatio,
    handleDivisionChange,
    deleteMidiScale,
    formatRatioInput,
    savedMidiScales,
    showStats,
    onToggleStats,
    retuneStats
}: CustomMapPanelProps) => {
    const scale = retuneCustomScale || [];

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <p className="text-[9px] text-gray-500 italic">Manual ratio assignment (Retune Only).</p>
                <div className="flex gap-1">
                    <button onClick={() => generateTETScale(scale.length || 12)} className="text-[8px] bg-purple-900/50 hover:bg-purple-800 text-purple-200 px-2 py-1 rounded border border-purple-700">Gen {(scale.length || 12)}-TET</button>
                    <button onClick={clearCustomMap} className="text-[8px] bg-red-900/40 hover:bg-red-800 text-red-200 px-2 py-1 rounded border border-red-800">Clear</button>
                    <button onClick={() => notifyWarning('To Keyboard is not implemented for the Retune UI yet.', 'Retune')} className="text-[8px] bg-indigo-900/40 hover:bg-indigo-800 text-indigo-200 px-2 py-1 rounded border border-indigo-800 line-through opacity-50">To Keyboard</button>
                    <button onClick={resetToStandardJI} className="text-[8px] bg-gray-800 hover:bg-white hover:text-black text-gray-300 px-2 py-1 rounded border border-gray-600">Reset 12-JI</button>
                </div>
            </div>

            <div className="bg-black/40 p-2 rounded border border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase font-bold">Equal Steps (a^(n/k))</span>
                    <button
                        onClick={generateEqualStepScale}
                        className="text-[8px] bg-green-900/40 hover:bg-green-800 text-green-200 px-2 py-1 rounded border border-green-800"
                    >
                        Gen a^(n/k)
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-[9px] text-gray-500 uppercase font-bold">Base a</label>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={equalStepBase}
                        onChange={(e) => setEqualStepBase(parseFloat(e.target.value))}
                        className="w-16 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                    />
                    <label className="text-[9px] text-gray-500 uppercase font-bold ml-2">Divisor k</label>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={equalStepDivisor}
                        onChange={(e) => setEqualStepDivisor(parseFloat(e.target.value))}
                        className="w-16 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                    />
                </div>
                <p className="text-[8px] text-gray-600 italic">
                    Uses key index n = 0..steps-1 with k independent of steps for non-cycling scales.
                </p>
            </div>

            <div className="bg-black/40 p-2 rounded border border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase font-bold">Meantone Presets (12 keys)</span>
                    <button
                        onClick={() => applyMeantonePreset(meantonePresetId)}
                        className="text-[8px] bg-blue-900/40 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800"
                    >
                        Load
                    </button>
                </div>
                <select
                    value={meantonePresetId}
                    onChange={(e) => setMeantonePresetId(e.target.value)}
                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                >
                    {MEANTONE_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Custom:</span>
                    <input
                        type="text"
                        placeholder="a/b"
                        value={customCommaInput}
                        onChange={(e) => setCustomCommaInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                applyCustomComma(customCommaInput);
                            }
                        }}
                        className="w-16 bg-black border border-gray-600 text-center text-xs text-white rounded p-1 focus:border-blue-500 outline-none font-mono"
                    />
                    <span className="text-[8px] text-gray-500">-comma</span>
                    <button
                        onClick={() => applyCustomComma(customCommaInput)}
                        className="text-[8px] bg-green-900/40 hover:bg-green-800 text-green-200 px-2 py-1 rounded border border-green-800"
                    >
                        Apply
                    </button>
                </div>
                <p className="text-[8px] text-gray-600 italic">
                    Tempered fifth = (3/2) * (81/80)^(-fraction). Values normalized to one octave.
                </p>
            </div>

            <div className="bg-black/40 p-2 rounded border border-gray-800 space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 uppercase font-bold">Well-Tempered Presets (12 keys)</span>
                    <button
                        onClick={() => applyWellTemperedPreset(wellTemperedPresetId)}
                        className="text-[8px] bg-indigo-900/40 hover:bg-indigo-800 text-indigo-200 px-2 py-1 rounded border border-indigo-800"
                    >
                        Load
                    </button>
                </div>
                <select
                    value={wellTemperedPresetId}
                    onChange={(e) => setWellTemperedPresetId(e.target.value)}
                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                >
                    {WELL_TEMPERED_PRESETS.map(preset => (
                        <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                </select>
                <p className="text-[8px] text-gray-600 italic">
                    Fifth chain is tempered and mapped to chromatic order within one octave.
                </p>
            </div>

            <div className="flex justify-between items-center bg-black/40 p-2 rounded">
                <span className="text-[9px] text-gray-400 uppercase font-bold">Scale Size (Keys)</span>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => handleDivisionChange((scale.length || 12) - 1)}
                        className="w-5 h-5 bg-gray-800 border border-gray-600 rounded flex items-center justify-center text-xs text-gray-300 hover:text-white hover:bg-gray-700"
                    >
                        -
                    </button>
                    <input
                        type="number"
                        min="1" max="100"
                        value={scale.length || 12}
                        onChange={(e) => handleDivisionChange(parseInt(e.target.value))}
                        className="w-10 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                    />
                    <button
                        onClick={() => handleDivisionChange((scale.length || 12) + 1)}
                        className="w-5 h-5 bg-gray-800 border border-gray-600 rounded flex items-center justify-center text-xs text-gray-300 hover:text-white hover:bg-gray-700"
                    >
                        +
                    </button>
                    <span className="text-[10px] text-gray-500 ml-1">Steps</span>
                </div>
            </div>

            <div className="flex gap-1 mt-2">
                <input
                    type="text"
                    placeholder="Scale Name..."
                    value={newScaleName}
                    onChange={e => setNewScaleName(e.target.value)}
                    className="flex-1 bg-black border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                />
                <button onClick={handleSaveScale} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-[10px] font-bold">Save Preset</button>
            </div>

            {savedMidiScales.length > 0 && (
                <div className="bg-black/60 border border-gray-800 rounded p-2 max-h-32 overflow-y-auto custom-scrollbar">
                    <span className="text-[9px] text-gray-500 uppercase font-bold block mb-2">Saved Maps</span>
                    <div className="space-y-1">
                        {savedMidiScales.map(sc => (
                            <div key={sc.id} className="flex justify-between items-center group bg-gray-900 px-2 py-1 rounded">
                                <button
                                    onClick={(e) => { e.preventDefault(); handleCustomScaleChange([...sc.scale]); }}
                                    className="text-[10px] text-blue-300 font-bold hover:text-blue-200 truncate flex-1 text-left px-1 focus:outline-none"
                                >
                                    {sc.name} ({sc.scale.length})
                                </button>
                                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleExportMts(sc.scale, sc.name);
                                        }}
                                        className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 font-mono"
                                        title="Export MIDI Tuning Standard (SysEx)"
                                    >
                                        SYX
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMidiScale(sc.id); }}
                                        className="text-[10px] text-red-500 px-1 hover:text-red-300"
                                        title="Delete"
                                    >
                                        X
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                {scale.map((ratio: string, i: number) => (
                    <div key={i} className="flex flex-col bg-gray-900 border border-gray-700 rounded p-1 group relative">
                        <button
                            className="text-[8px] text-gray-500 font-mono text-center mb-0.5 hover:text-indigo-300 hover:bg-gray-800 rounded w-full cursor-pointer transition-colors"
                            onClick={() => handlePlayRatio(ratio, i)}
                            title="Play Note"
                        >
                            Key {i}
                        </button>
                        <input
                            type="text"
                            value={ratio}
                            onChange={(e) => handleScaleStepChange(i, e.target.value)}
                            onBlur={(e) => handleScaleStepChange(i, formatRatioInput(e.target.value))}
                            className="bg-black text-center text-[10px] text-blue-200 w-full outline-none"
                        />
                    </div>
                ))}
            </div>

            <RetuneStatsPanel
                showStats={showStats}
                onToggle={onToggleStats}
                retuneStats={retuneStats}
            />
        </div>
    );
};


