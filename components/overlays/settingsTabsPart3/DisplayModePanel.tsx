import React from 'react';
import { Label, Input, Select } from '../../common/SynthPatchEditor';

type DisplayModePanelProps = {
    globalSettings: any;
    setDisplayMode: (mode: 'lattice' | 'pitch-field' | 'h-chroma' | 'diamond') => void;
    updateVisualSettings: (...args: any[]) => void;
    handleDiamondLimitChange: (limit: number, commit?: boolean) => void;
    setBranchOverride: (harmonic: number, partial: {
        enabled?: boolean;
        base?: number;
        lengthPos?: number;
        lengthNeg?: number;
    }) => void;
    setBranchOverrideMode: (harmonic: number, mode: 'global' | 'override' | 'off') => void;
    hChromaBranchSelected: number[];
    hChromaBranchSelectedHarmonic: number;
    hChromaSelectedMode: string;
    hChromaSelectedOverride: any;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export const DisplayModePanel: React.FC<DisplayModePanelProps> = ({
    globalSettings,
    setDisplayMode,
    updateVisualSettings,
    handleDiamondLimitChange,
    setBranchOverride,
    setBranchOverrideMode,
    hChromaBranchSelected,
    hChromaBranchSelectedHarmonic,
    hChromaSelectedMode,
    hChromaSelectedOverride,
    onInteractionStart,
    onInteractionEnd
}) => {
    const visuals = globalSettings.visuals || {};

    return (
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <label className="text-[10px] text-gray-500 uppercase font-black block mb-2">Display Mode</label>
            <div className="flex bg-black rounded p-0.5 border border-gray-800 mb-2">
                <button
                    onClick={() => setDisplayMode('lattice')}
                    className={`flex-1 text-[10px] py-2 rounded font-bold ${visuals.layoutMode === 'lattice' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Lattice Geometry
                </button>
                <button
                    onClick={() => setDisplayMode('pitch-field')}
                    className={`flex-1 text-[10px] py-2 rounded font-bold ${visuals.layoutMode === 'pitch-field' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Pitch Spectrum
                </button>
                <button
                    onClick={() => setDisplayMode('h-chroma')}
                    className={`flex-1 text-[10px] py-2 rounded font-bold ${visuals.layoutMode === 'h-chroma' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    H-Chroma
                </button>
                <button
                    onClick={() => setDisplayMode('diamond')}
                    className={`flex-1 text-[10px] py-2 rounded font-bold ${visuals.layoutMode === 'diamond' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Tonality Diamond
                </button>
            </div>

            {visuals.layoutMode === 'h-chroma' && (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 bg-sky-900/20 p-2 rounded border border-sky-700/50">
                            <span className="text-[10px] text-sky-300 font-bold uppercase">Base a</span>
                            <input
                                type="number"
                                min="1.01"
                                max="50"
                                step="0.01"
                                value={visuals.hChromaBase ?? 2}
                                onChange={(e) => updateVisualSettings({ hChromaBase: Math.max(1.01, parseFloat(e.target.value) || 2) }, false)}
                                className="w-full bg-black border border-gray-700 rounded text-[10px] text-white px-2 py-1 font-mono"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-sky-900/20 p-2 rounded border border-sky-700/50">
                            <span className="text-[10px] text-sky-300 font-bold uppercase">Limit</span>
                            <input
                                type="number"
                                min="1"
                                max="5000"
                                step="1"
                                value={visuals.hChromaLimit ?? 47}
                                onChange={(e) => updateVisualSettings({ hChromaLimit: Math.max(1, Math.min(5000, parseInt(e.target.value || '47', 10))) }, false)}
                                className="w-full bg-black border border-gray-700 rounded text-[10px] text-white px-2 py-1 font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex bg-black/50 rounded border border-gray-700 p-1 gap-2">
                            <span className="text-[10px] text-gray-400 font-bold uppercase self-center pl-2">Colors:</span>
                            <button
                                onClick={() => updateVisualSettings({ hChromaColorMode: 'pure' }, false)}
                                className={`flex-1 text-[9px] font-bold py-1 rounded ${visuals.hChromaColorMode === 'pure' ? 'bg-sky-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Pure
                            </button>
                            <button
                                onClick={() => updateVisualSettings({ hChromaColorMode: 'primaryRatio' }, false)}
                                className={`flex-1 text-[9px] font-bold py-1 rounded ${visuals.hChromaColorMode === 'primaryRatio' ? 'bg-sky-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Primary Ratios
                            </button>
                        </div>
                        <div className="flex bg-black/50 rounded border border-gray-700 p-1 gap-2">
                            <span className="text-[10px] text-gray-400 font-bold uppercase self-center pl-2">Labels:</span>
                            <select
                                value={visuals.hChromaLabelMode || 'harmonic'}
                                onChange={(e) => updateVisualSettings({ hChromaLabelMode: e.target.value }, false)}
                                className="flex-1 bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                            >
                                <option value="both">H + Ratio</option>
                                <option value="harmonic">H Only</option>
                                <option value="ratio">Ratio Only</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex bg-black/50 rounded border border-gray-700 p-1 gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase self-center pl-2">Auto-Rotate:</span>
                        <button
                            onClick={() => updateVisualSettings({ hChromaAutoRotate: false }, false)}
                            className={`flex-1 text-[9px] font-bold py-1 rounded ${!visuals.hChromaAutoRotate ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            Off
                        </button>
                        <button
                            onClick={() => updateVisualSettings({ hChromaAutoRotate: true }, false)}
                            className={`flex-1 text-[9px] font-bold py-1 rounded ${visuals.hChromaAutoRotate ? 'bg-sky-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            On
                        </button>
                    </div>

                    <div className="flex bg-black/50 rounded border border-gray-700 p-1 gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase self-center pl-2">Speed:</span>
                        <input
                            type="range"
                            min="0.1"
                            max="10.0"
                            step="0.1"
                            value={visuals.hChromaAutoRotateSpeed ?? 1.0}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => updateVisualSettings({ hChromaAutoRotateSpeed: parseFloat(e.target.value) }, false, false)}
                            className="flex-1 h-1 accent-sky-500 bg-gray-700 rounded self-center"
                        />
                        <span className="text-[10px] text-white font-mono w-8 text-right self-center">{(visuals.hChromaAutoRotateSpeed ?? 1.0).toFixed(1)}</span>
                    </div>

                    <div className="p-2 bg-gray-900/50 rounded border border-gray-700 space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Spectrum Split</label>
                            <div className="flex bg-black rounded p-0.5 border border-gray-700 w-24">
                                <button
                                    onClick={() => updateVisualSettings({ hChromaSpectrumSplitEnabled: false }, false)}
                                    className={`flex-1 text-[9px] py-0.5 rounded font-bold ${!visuals.hChromaSpectrumSplitEnabled ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    Off
                                </button>
                                <button
                                    onClick={() => updateVisualSettings({ hChromaSpectrumSplitEnabled: true }, false)}
                                    className={`flex-1 text-[9px] py-0.5 rounded font-bold ${visuals.hChromaSpectrumSplitEnabled ? 'bg-purple-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    On
                                </button>
                            </div>
                        </div>
                        {visuals.hChromaSpectrumSplitEnabled && (
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Ring Depth</span>
                                    <span className="text-[9px] text-blue-300 font-mono">{visuals.hChromaSpectrumDepth ?? 2}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={visuals.hChromaSpectrumDepth ?? 2}
                                    onChange={e => updateVisualSettings({ hChromaSpectrumDepth: parseInt(e.target.value, 10) }, false, false)}
                                    className="w-full h-1.5 accent-purple-500 bg-gray-700 rounded appearance-none"
                                />
                            </div>
                        )}
                        <div className="text-[9px] text-gray-500 italic px-1">
                            Select a harmonic node to view its decomposed color spectrum (x2, x3, x5).
                        </div>
                    </div>

                    <label className="flex items-center justify-between gap-2 bg-black/30 p-2 rounded border border-gray-800 cursor-pointer">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Show [2:3:5] Mix</span>
                        <input
                            type="checkbox"
                            checked={visuals.hChromaShowPrimaryTriplet ?? false}
                            onChange={(e) => updateVisualSettings({ hChromaShowPrimaryTriplet: e.target.checked }, false)}
                            className="w-3 h-3 accent-sky-500"
                        />
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded border border-gray-800">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Prime 2 (Octave)</span>
                            <input
                                type="color"
                                value={visuals.hChromaPrimaryA ?? '#ff0000'}
                                onChange={(e) => updateVisualSettings({ hChromaPrimaryA: e.target.value }, false)}
                                className="w-8 h-6 p-0 border border-gray-600 rounded bg-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded border border-gray-800">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Prime 3 (Fifth)</span>
                            <input
                                type="color"
                                value={visuals.hChromaPrimaryB ?? '#0000ff'}
                                onChange={(e) => updateVisualSettings({ hChromaPrimaryB: e.target.value }, false)}
                                className="w-8 h-6 p-0 border border-gray-600 rounded bg-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded border border-gray-800">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Prime 5 (Third)</span>
                            <input
                                type="color"
                                value={visuals.hChromaPrimaryC ?? '#ffff00'}
                                onChange={(e) => updateVisualSettings({ hChromaPrimaryC: e.target.value }, false)}
                                className="w-8 h-6 p-0 border border-gray-600 rounded bg-transparent"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 bg-black/30 p-2 rounded border border-gray-800">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">Radius</span>
                                <span className="text-[10px] text-white font-mono text-right">{Math.round(visuals.hChromaRadius ?? 36)}</span>
                            </div>
                            <input
                                type="range"
                                min="6"
                                max="200"
                                step="1"
                                value={visuals.hChromaRadius ?? 36}
                                onPointerDown={onInteractionStart}
                                onPointerUp={onInteractionEnd}
                                onChange={(e) => updateVisualSettings({ hChromaRadius: parseFloat(e.target.value) }, false, false)}
                                className="w-full h-1 accent-sky-500 bg-gray-700 rounded"
                            />
                        </div>
                        <div className="flex flex-col gap-1 bg-black/30 p-2 rounded border border-gray-800">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] text-gray-400 font-bold uppercase">Height</span>
                                <span className="text-[10px] text-white font-mono text-right">{Math.round(visuals.hChromaHeightScale ?? 18)}</span>
                            </div>
                            <input
                                type="range"
                                min="4"
                                max="60"
                                step="1"
                                value={visuals.hChromaHeightScale ?? 18}
                                onPointerDown={onInteractionStart}
                                onPointerUp={onInteractionEnd}
                                onChange={(e) => updateVisualSettings({ hChromaHeightScale: parseFloat(e.target.value) }, false, false)}
                                className="w-full h-1 accent-sky-500 bg-gray-700 rounded"
                            />
                        </div>
                    </div>

                    <div className="p-2 bg-black/30 rounded border border-gray-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Branches</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={visuals.hChromaBranchEnabled ?? false}
                                    onChange={(e) => updateVisualSettings({ hChromaBranchEnabled: e.target.checked }, false)}
                                    className="w-3 h-3 accent-sky-500"
                                />
                                <span className="text-[9px] text-gray-400 font-bold uppercase">Enable</span>
                            </label>
                        </div>
                        {(visuals.hChromaBranchEnabled ?? false) && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label>Scope</Label>
                                        <Select
                                            value={visuals.hChromaBranchScope ?? 'selected'}
                                            onChange={(e) => updateVisualSettings({ hChromaBranchScope: e.target.value }, false)}
                                        >
                                            <option value="selected">Selected</option>
                                            <option value="all">All</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Base (0 = Harmonic)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={visuals.hChromaBranchBase ?? 0}
                                            onChange={(e) => updateVisualSettings({ hChromaBranchBase: parseInt(e.target.value || '0', 10) }, false)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <Label>Len +</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={visuals.hChromaBranchLengthPos ?? 0}
                                            onChange={(e) => updateVisualSettings({ hChromaBranchLengthPos: parseInt(e.target.value || '0', 10) }, false)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Len -</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={visuals.hChromaBranchLengthNeg ?? 0}
                                            onChange={(e) => updateVisualSettings({ hChromaBranchLengthNeg: parseInt(e.target.value || '0', 10) }, false)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Spacing</Label>
                                        <Input
                                            type="number"
                                            min="3"
                                            step="1"
                                            value={visuals.hChromaBranchSpacing ?? 6}
                                            onChange={(e) => updateVisualSettings({ hChromaBranchSpacing: parseInt(e.target.value || '6', 10) }, false)}
                                        />
                                    </div>
                                </div>
                                <div className="text-[9px] text-gray-500">
                                    Click nodes to select. Shift+click toggles selection.
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {hChromaBranchSelected.length === 0 && (
                                        <span className="text-[9px] text-gray-600">No selected harmonics.</span>
                                    )}
                                    {hChromaBranchSelected.map((h) => (
                                        <button
                                            key={`hchroma-branch-${h}`}
                                            onClick={() => updateVisualSettings({ hChromaBranchSelected: hChromaBranchSelected.filter(v => v !== h) }, false)}
                                            className="px-2 py-0.5 rounded text-[9px] font-bold border bg-gray-900 border-gray-700 text-gray-300 hover:text-white"
                                        >
                                            H{h}
                                        </button>
                                    ))}
                                </div>
                                {hChromaBranchSelectedHarmonic ? (
                                    <div className="mt-2 p-2 bg-gray-900/40 border border-gray-800 rounded space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-gray-400 font-bold uppercase">Selected Harmonic</span>
                                            <span className="text-[10px] text-white font-mono">H{hChromaBranchSelectedHarmonic}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label>Branch Mode</Label>
                                                <Select
                                                    value={hChromaSelectedMode}
                                                    onChange={(e) => setBranchOverrideMode(hChromaBranchSelectedHarmonic, e.target.value as any)}
                                                >
                                                    <option value="global">Use Global</option>
                                                    <option value="override">Override</option>
                                                    <option value="off">Disable</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Override Base</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={hChromaSelectedOverride?.base ?? visuals.hChromaBranchBase ?? 0}
                                                    onChange={(e) => setBranchOverride(hChromaBranchSelectedHarmonic, { base: parseInt(e.target.value || '0', 10), enabled: true })}
                                                    disabled={hChromaSelectedMode !== 'override'}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <Label>Override Len +</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={hChromaSelectedOverride?.lengthPos ?? visuals.hChromaBranchLengthPos ?? 0}
                                                    onChange={(e) => setBranchOverride(hChromaBranchSelectedHarmonic, { lengthPos: parseInt(e.target.value || '0', 10), enabled: true })}
                                                    disabled={hChromaSelectedMode !== 'override'}
                                                />
                                            </div>
                                            <div>
                                                <Label>Override Len -</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value={hChromaSelectedOverride?.lengthNeg ?? visuals.hChromaBranchLengthNeg ?? 0}
                                                    onChange={(e) => setBranchOverride(hChromaBranchSelectedHarmonic, { lengthNeg: parseInt(e.target.value || '0', 10), enabled: true })}
                                                    disabled={hChromaSelectedMode !== 'override'}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[9px] text-gray-600">Click a node to edit branch settings.</div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="text-[9px] text-gray-500 italic">
                        H-Chroma maps harmonics to a pitch helix: height = log<sub>a</sub>(N), chroma = frac(log<sub>a</sub>(N)).
                    </div>
                </div>
            )}

            {visuals.layoutMode === 'diamond' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-yellow-900/20 p-2 rounded border border-yellow-700/50">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase">Diamond Limit</span>
                        <input
                            type="range"
                            min="3"
                            max="99"
                            step="2"
                            value={visuals.diamondLimit || 7}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => handleDiamondLimitChange(parseInt(e.target.value, 10), false)}
                            className="flex-1 h-1 accent-yellow-500"
                        />
                        <span className="text-[10px] text-white font-mono">{visuals.diamondLimit || 7}-Limit</span>
                    </div>
                    <div className="flex bg-black/50 rounded border border-gray-700 p-1 gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase self-center pl-2">Labels:</span>
                        <button
                            onClick={() => updateVisualSettings({ labelMode: 'ratio' }, true)}
                            className={`flex-1 text-[9px] font-bold py-1 rounded ${visuals.labelMode === 'ratio' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            Ratios
                        </button>
                        <button
                            onClick={() => updateVisualSettings({ labelMode: 'name' }, true)}
                            className={`flex-1 text-[9px] font-bold py-1 rounded ${visuals.labelMode === 'name' ? 'bg-yellow-700 text-white' : 'bg-gray-800 text-gray-400'}`}
                        >
                            Names
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
