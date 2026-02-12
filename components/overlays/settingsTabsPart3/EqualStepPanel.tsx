import React from 'react';
import type { EqualStepConfig } from '../../../types';

type EqualStepPanelProps = {
    globalSettings: any;
    updateEqualStep: (partial: Partial<EqualStepConfig>) => void;
    resetLatticeConfig: () => void;
    eqBase: string;
    setEqBase: (value: string) => void;
    eqDivs: string;
    setEqDivs: (value: string) => void;
    eqDelta: string;
    setEqDelta: (value: string) => void;
    eqCircle: string;
    setEqCircle: (value: string) => void;
    eqRange: string;
    setEqRange: (value: string) => void;
    eqRadius: string;
    setEqRadius: (value: string) => void;
    handleMathInput: (field: keyof EqualStepConfig, val: string) => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export const EqualStepPanel: React.FC<EqualStepPanelProps> = ({
    globalSettings,
    updateEqualStep,
    resetLatticeConfig,
    eqBase,
    setEqBase,
    eqDivs,
    setEqDivs,
    eqDelta,
    setEqDelta,
    eqCircle,
    setEqCircle,
    eqRange,
    setEqRange,
    eqRadius,
    setEqRadius,
    handleMathInput,
    onInteractionStart,
    onInteractionEnd
}) => (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-gray-400 uppercase">Equal Steps/Division Generator</h3>
                    <button
                        onClick={() => resetLatticeConfig()}
                        className="text-[9px] text-blue-400 hover:text-white border border-blue-900 px-2 py-0.5 rounded bg-blue-950/30 font-bold active:scale-95 transition-transform"
                    >
                        RESET CONFIG
                    </button>
                </div>

                <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 space-y-3">
                    <div className="flex justify-between items-center bg-black/40 px-2 py-1 rounded">
                        <label className="flex items-center gap-2 cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={globalSettings.equalStep.enabled}
                                onChange={(e) => updateEqualStep({ enabled: e.target.checked })}
                                className="w-4 h-4 accent-blue-500 rounded"
                            />
                            <span className="text-[10px] font-bold text-blue-300 uppercase">Enabled</span>
                        </label>
                        <select
                            value={globalSettings.equalStep.visualizationMode || 'graphite'}
                            onChange={(e) => updateEqualStep({ visualizationMode: e.target.value as any })}
                            className="bg-black border border-gray-700 text-[10px] text-white rounded px-2 outline-none"
                        >
                            <option value="graphite">Graphite (Stacked Layers)</option>
                            <option value="helix">Helix (Continuous Spiral)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] text-gray-500 font-bold block mb-1">Base (Period)</label>
                            <input
                                type="text" value={eqBase}
                                onChange={(e) => setEqBase(e.target.value)}
                                onBlur={() => handleMathInput('base', eqBase)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 font-bold block mb-1">Divisions (k)</label>
                            <input
                                type="text" value={eqDivs}
                                onChange={(e) => setEqDivs(e.target.value)}
                                onBlur={() => handleMathInput('divisions', eqDivs)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 font-bold block mb-1">Delta n</label>
                            <input
                                type="text" value={eqDelta}
                                onChange={(e) => setEqDelta(e.target.value)}
                                onBlur={() => handleMathInput('deltaN', eqDelta)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                                title="Scaling factor for n per step index a (n = a * deltaN)"
                            />
                        </div>
                        {globalSettings.equalStep.visualizationMode === 'helix' && (
                            <div>
                                <label className="text-[9px] text-gray-500 font-bold block mb-1">Steps per Circle</label>
                                <input
                                    type="text" value={eqCircle}
                                    onChange={(e) => setEqCircle(e.target.value)}
                                    onBlur={() => handleMathInput('stepsPerCircle', eqCircle)}
                                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                                    title="Number of steps a to complete a visual 360 degree circle."
                                />
                            </div>
                        )}
                        <div>
                            <label className="text-[9px] text-gray-500 font-bold block mb-1">Range (+/- a)</label>
                            <input
                                type="text" value={eqRange}
                                onChange={(e) => setEqRange(e.target.value)}
                                onBlur={() => handleMathInput('range', eqRange)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 font-bold block mb-1">Radius</label>
                            <input
                                type="text" value={eqRadius}
                                onChange={(e) => setEqRadius(e.target.value)}
                                onBlur={() => handleMathInput('radius', eqRadius)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {globalSettings.equalStep.visualizationMode === 'helix' ? (
                            <div>
                                <label className="text-[9px] text-gray-500 font-bold block mb-1">Vertical Rise (Helix Pitch)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range" min="0" max="20" step="0.5"
                                        value={globalSettings.equalStep.zRise}
                                        onChange={(e) => updateEqualStep({ zRise: parseFloat(e.target.value) })}
                                        className="flex-1 h-1 accent-purple-500 bg-gray-700 rounded"
                                    />
                                    <span className="text-[10px] text-white w-8 text-right">{globalSettings.equalStep.zRise}</span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[9px] text-gray-500 font-bold block mb-1">Layer Gap</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="range" min="0" max="100" step="1"
                                        value={globalSettings.equalStep.layerGap || 10}
                                        onChange={(e) => updateEqualStep({ layerGap: parseFloat(e.target.value) })}
                                        className="flex-1 h-1 accent-emerald-500 bg-gray-700 rounded"
                                    />
                                    <span className="text-[10px] text-white w-8 text-right">{globalSettings.equalStep.layerGap || 10}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <p className="text-[9px] text-gray-500 italic p-2 bg-black/20 rounded border border-gray-800">
                        Formula: <code>f(a) = Base^((a*deltaN)/k)</code>. Periodic at n=k. <b>Left/Right</b> moves by step; <b>Up/Down</b> moves by full cycle layers. {globalSettings.equalStep.visualizationMode === 'graphite' && "In Graphite mode, one visual circle contains one full mathematical cycle."}
                    </p>
                </div>
            </div>
);
