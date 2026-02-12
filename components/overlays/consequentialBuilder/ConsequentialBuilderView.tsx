import React from 'react';
import type { ConsequentialScaleConfig, ConsequentialScaleResult, MathFunctionPreset, MathObject, VariableDef } from '../../../types';
import { ConsequentialGraph } from '../ConsequentialBuilderPart2';
import { FunctionGallery } from '../math/FunctionGallery';
import { BufferedInput } from './BufferedInput';
import { MathExpressionInput } from '../../common/MathExpressionInput';

type ConsequentialBuilderViewProps = {
    activeId: string | null;
    localConfig: ConsequentialScaleConfig;
    result: ConsequentialScaleResult | null;
    previewExpr: string;
    iListInput: string;
    showPresets: boolean;
    showGrapherImport: boolean;
    availableVars: string[];
    grapherObjects: MathObject[];
    handleLoadPreset: (p: MathFunctionPreset) => void;
    handleImportGrapherObject: (obj: MathObject) => void;
    handleConfigChange: (partial: Partial<ConsequentialScaleConfig> | any) => void;
    handleAddVariable: () => void;
    updateVariable: (idx: number, p: Partial<VariableDef>) => void;
    removeVariable: (idx: number) => void;
    setShowPresets: React.Dispatch<React.SetStateAction<boolean>>;
    setShowGrapherImport: React.Dispatch<React.SetStateAction<boolean>>;
    setIListInput: React.Dispatch<React.SetStateAction<string>>;
    handleGenerate: (configToUse?: ConsequentialScaleConfig) => void;
    handleCreateNew: () => void;
    stopAll: () => void;
    handlePlayScale: () => void;
    handlePlayChord: () => void;
    playFreq: (freq: number, type: 'click' | 'chord') => void;
    handleSaveMidi: () => void;
    handleSaveKeyboard: () => void;
    handleCompare: () => void;
};

export const ConsequentialBuilderView = ({
    activeId,
    localConfig,
    result,
    previewExpr,
    iListInput,
    showPresets,
    showGrapherImport,
    availableVars,
    grapherObjects,
    handleLoadPreset,
    handleImportGrapherObject,
    handleConfigChange,
    handleAddVariable,
    updateVariable,
    removeVariable,
    setShowPresets,
    setShowGrapherImport,
    setIListInput,
    handleGenerate,
    handleCreateNew,
    stopAll,
    handlePlayScale,
    handlePlayChord,
    playFreq,
    handleSaveMidi,
    handleSaveKeyboard,
    handleCompare
}: ConsequentialBuilderViewProps) => {    return (
        <div className="flex h-full w-full text-white bg-gray-950 overflow-hidden relative">
            {showPresets && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-4xl h-full flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-white">Select a Function Preset</h3>
                            <button onClick={()=>setShowPresets(false)} className="text-gray-400 hover:text-white">✕Close</button>
                        </div>
                        <div className="flex-1 overflow-auto bg-black/50 rounded">
                            <FunctionGallery onSelect={handleLoadPreset} />
                        </div>
                    </div>
                </div>
            )}

            {showGrapherImport && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-lg flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white">Import from Grapher</h3>
                            <button onClick={()=>setShowGrapherImport(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar space-y-2">
                            {grapherObjects.length === 0 && <p className="text-gray-500 italic text-center">No graph objects available.</p>}
                            {grapherObjects.map(obj => (
                                <button 
                                    key={obj.id}
                                    onClick={() => handleImportGrapherObject(obj)}
                                    className="w-full text-left p-3 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors"
                                >
                                    <div className="font-bold text-blue-300">{obj.expression}</div>
                                    <div className="text-xs text-gray-500 mt-1 uppercase font-bold">{obj.type}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900/80 p-3 overflow-y-auto custom-scrollbar gap-4 shrink-0">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Expression</h3>
                        <div className="flex gap-1">
                            <button onClick={()=>setShowGrapherImport(true)} className="text-[9px] bg-gray-800 border border-gray-600 px-2 py-0.5 rounded font-bold hover:text-white" title="Import from Grapher">Import</button>
                            <button onClick={()=>setShowPresets(true)} className="text-[9px] bg-blue-700 px-2 py-0.5 rounded font-bold hover:bg-blue-600">📚 Presets</button>
                        </div>
                    </div>
                    
                    <div className="flex gap-1 mb-2">
                        {['ModeA', 'ModeB', 'Custom'].map(m => (
                            <button 
                                key={m}
                                onClick={() => {
                                    let expr = localConfig.expressionRaw;
                                    let vars = localConfig.domain.variables;
                                    let mapMode = localConfig.mappingMode;

                                    if (m === 'ModeA') { expr = '(n+i)/n'; vars = []; mapMode = 'scalar_ratio'; }
                                    if (m === 'ModeB') { expr = 'n + i/n'; vars = []; mapMode = 'scalar_ratio'; }
                                    if (m === 'Custom') {
                                        if (!vars || vars.length === 0) {
                                            vars = [{ name: 'n', value: 1, min: 1, max: 10, step: 1, role: 'domain' }];
                                            if (expr.includes('i')) expr = '1/n';
                                        }
                                    }
                                    handleConfigChange({ mode: m, expressionRaw: expr, domain: { variables: vars }, mappingMode: mapMode });
                                }}
                                className={`flex-1 py-1 text-[9px] font-bold border rounded ${localConfig.mode === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    <MathExpressionInput
                        multiline
                        rows={2}
                        value={localConfig.expressionRaw}
                        onChange={(next) => handleConfigChange({ expressionRaw: next })}
                        placeholder="e.g. √(x² + y²) or ∫(sin(x), x, 0, π, 512)"
                        className="flex-1 bg-black border border-gray-700 rounded p-2 text-xs font-mono text-blue-300 outline-none focus:border-blue-500 mb-1"
                        // In Custom mode, users frequently want symbols like π, √, ∫. Ensure the preprocessor is enabled.
                        onRequestEnableAdvancedSymbols={() => {
                            if (!localConfig.advancedSymbols) handleConfigChange({ advancedSymbols: true });
                        }}
                    />
                    
                    <details className="mb-2 bg-gray-800/50 p-2 rounded border border-gray-700/50 group">
                        <summary className="flex items-center justify-between cursor-pointer text-[9px] font-bold text-gray-400 uppercase select-none list-none">
                            <span>Advanced Derivatives</span>
                            <span className="text-[10px] group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="pt-2 space-y-2">
                            <div>
                                <label className="text-[9px] text-gray-500 block mb-1">Differentiate w.r.t Variable</label>
                                <select 
                                    value={localConfig.derivVar || 'n'} 
                                    onChange={(e) => handleConfigChange({ derivVar: e.target.value })}
                                    className="w-full bg-black border border-gray-600 text-[9px] text-white rounded p-1 outline-none"
                                >
                                    {availableVars.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Order</span>
                                    <span className="text-[9px] font-mono text-white">{localConfig.derivativeOrder || 0}</span>
                                </div>
                                <input 
                                    type="range" min="0" max="15" step="1"
                                    value={localConfig.derivativeOrder || 0}
                                    onChange={(e) => handleConfigChange({ derivativeOrder: parseInt(e.target.value) })}
                                    className="w-full h-1 accent-yellow-500 bg-gray-700 rounded cursor-pointer"
                                />
                                <p className="text-[8px] text-gray-500 mt-1 italic">
                                    {(localConfig.derivativeOrder || 0) === 0 ? "Value" : `∂^${localConfig.derivativeOrder}y / ∂{localConfig.derivVar || 'n'}^${localConfig.derivativeOrder}`}
                                </p>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input 
                                    type="checkbox" 
                                    checked={localConfig.showOriginal ?? true} 
                                    onChange={(e) => handleConfigChange({ showOriginal: e.target.checked })}
                                    className="accent-cyan-500 w-3 h-3"
                                />
                                <span className="text-[9px] text-cyan-300 font-bold">Overlay Original Graph</span>
                            </label>
                        </div>
                    </details>

                    {localConfig.mode === 'Custom' && (
                        <div className="mb-2 bg-gray-800/50 p-2 rounded border border-gray-700/50">
                            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1 block">Output Mapping</label>
                            <select 
                                value={localConfig.mappingMode || 'scalar_ratio'} 
                                onChange={(e) => handleConfigChange({ mappingMode: e.target.value })}
                                className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1 mb-2 outline-none"
                            >
                                <option value="scalar_ratio">Scalar Ratio (Standard)</option>
                                <option value="parametric_y">Parametric Y (Pitch)</option>
                                <option value="polar_r">Polar R (Magnitude)</option>
                            </select>

                            <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={!localConfig.mapping.linearMode} 
                                        onChange={(e) => handleConfigChange({ mapping: { linearMode: !e.target.checked } })}
                                        className="accent-blue-500"
                                    />
                                    <span className="text-[9px] text-gray-300">Exponential (Pitch)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={localConfig.mapping.linearMode || false} 
                                        onChange={(e) => handleConfigChange({ mapping: { linearMode: e.target.checked } })}
                                        className="accent-green-500"
                                    />
                                    <span className="text-[9px] text-gray-300">Linear (Hz Addition)</span>
                                </label>
                                {localConfig.mapping.linearMode && (
                                    <div className="flex items-center gap-2 pl-5">
                                        <span className="text-[9px] text-gray-500">1 Unit = </span>
                                        <input 
                                            type="number" 
                                            value={localConfig.mapping.linearUnit || 100}
                                            onChange={(e) => handleConfigChange({ mapping: { linearUnit: parseFloat(e.target.value) } })}
                                            className="w-12 bg-black border border-gray-600 text-[9px] text-center text-white rounded"
                                        />
                                        <span className="text-[9px] text-gray-500">Hz</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 mb-1">
                         <label className="flex items-center gap-1 cursor-pointer text-[9px] text-gray-400 flex-1">
                            <input 
                                type="checkbox" 
                                checked={localConfig.mapping.normalizeToOctave} 
                                onChange={e => handleConfigChange({ mapping: { normalizeToOctave: e.target.checked } })} 
                                className="accent-blue-500"
                            />
                            <span>Restrict to Octave</span>
                        </label>
                        <select 
                            value={localConfig.mapping.handleNegative || 'mask'} 
                            onChange={(e) => handleConfigChange({ mapping: { handleNegative: e.target.value } })}
                            className="bg-black border border-gray-700 text-[9px] text-white rounded px-1 outline-none"
                            title="Handle Negative Y values"
                        >
                            <option value="mask">Negatives: Mask (Hide)</option>
                            <option value="abs">Negatives: Absolute</option>
                            <option value="shift">Negatives: Shift (f(x)+a)</option>
                        </select>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-gray-500">
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={localConfig.advancedSymbols} onChange={e => handleConfigChange({ advancedSymbols: e.target.checked })} />
                            <span>Adv Symbols</span>
                        </label>
                        <span className="font-mono bg-gray-800 px-1 rounded truncate max-w-[100px]">{previewExpr}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Domain</h3>
                        <button onClick={handleAddVariable} className="text-[9px] border border-gray-600 px-2 py-0.5 rounded hover:bg-white hover:text-black font-bold">+ Var</button>
                    </div>
                    {localConfig.domain.variables && localConfig.domain.variables.length > 0 ? (
                        <div className="space-y-2">
                            {localConfig.domain.variables.map((v, i) => (
                                <div key={i} className="bg-gray-800/50 p-2 rounded border border-gray-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        <input className="w-8 bg-black text-xs font-bold text-center text-blue-300 rounded" value={v.name} onChange={e => updateVariable(i, {name: e.target.value})} />
                                        <select 
                                            value={v.role} 
                                            onChange={e => updateVariable(i, {role: e.target.value as any})}
                                            className="text-[9px] bg-black rounded p-0.5 text-gray-400"
                                        >
                                            <option value="domain">Iterate</option>
                                            <option value="parameter">Const</option>
                                        </select>
                                        <button onClick={()=>removeVariable(i)} className="ml-auto text-red-500 text-[10px]">×</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1">
                                        <BufferedInput className="bg-black text-[9px] text-center rounded w-full" placeholder="Min/Val" value={v.role === 'parameter' ? v.value : v.min} onChange={(val: number) => updateVariable(i, v.role==='parameter' ? {value: val} : {min: val})} />
                                        <BufferedInput className="bg-black text-[9px] text-center rounded w-full" placeholder="Max" disabled={v.role==='parameter'} value={v.max ?? ''} onChange={(val: number) => updateVariable(i, {max: val})} />
                                        <BufferedInput className="bg-black text-[9px] text-center rounded w-full" placeholder="Step" disabled={v.role==='parameter'} value={v.step ?? ''} onChange={(val: number) => updateVariable(i, {step: val})} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-gray-800 p-2 rounded border border-gray-700">
                                <span className="text-[9px] font-bold text-gray-400 block mb-1">Iterator n</span>
                                <div className="flex gap-1">
                                    <BufferedInput className="w-full bg-black text-center text-xs p-1 rounded" value={localConfig.domain.nStart} onChange={(val: number) => handleConfigChange({ domain: { nStart: val } })} />
                                    <span className="self-center text-gray-500 text-[9px]">to</span>
                                    <BufferedInput className="w-full bg-black text-center text-xs p-1 rounded" value={localConfig.domain.nEnd} onChange={(val: number) => handleConfigChange({ domain: { nEnd: val } })} />
                                </div>
                            </div>
                            <div className="bg-gray-800 p-2 rounded border border-gray-700">
                                <span className="text-[9px] font-bold text-gray-400 block mb-1">Param i</span>
                                <div className="flex gap-1">
                                    <BufferedInput className="w-full bg-black text-center text-xs p-1 rounded" value={localConfig.domain.iStart} onChange={(val: number) => handleConfigChange({ domain: { iStart: val } })} />
                                    <span className="self-center text-gray-500 text-[9px]">to</span>
                                    <BufferedInput className="w-full bg-black text-center text-xs p-1 rounded" value={localConfig.domain.iEnd} onChange={(val: number) => handleConfigChange({ domain: { iEnd: val } })} />
                                </div>
                            </div>
                            <div className="col-span-2 mb-2">
                                <label className="text-[9px] text-gray-500 font-bold block mb-1">i-List (Optional Override)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-black border border-gray-700 rounded p-1 text-xs" 
                                    placeholder="e.g. 0, 1, 1, 2, 3, 5"
                                    value={iListInput}
                                    onChange={e => setIListInput(e.target.value)}
                                />
                            </div>
                            <div className="col-span-2 flex justify-between items-center bg-gray-800 p-1 rounded mb-2">
                                <span className="text-[9px] text-gray-400 ml-1">Strategy:</span>
                                <select 
                                    value={localConfig.domain.varyMode}
                                    onChange={e => handleConfigChange({ domain: { varyMode: e.target.value } })}
                                    className="bg-black text-[9px] text-white p-1 rounded border border-gray-600 outline-none"
                                >
                                    <option value="FixI_VaryN">Fix i, Loop n</option>
                                    <option value="FixN_VaryI">Fix n, Loop i</option>
                                    <option value="Grid">Grid (n × i)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-gray-800 pt-2">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Playback Config</h3>
                    
                    <div className="flex bg-black rounded p-0.5 border border-gray-700 mb-2">
                        <button 
                            onClick={() => handleConfigChange({ playback: { speedUnit: 'ms' } })} 
                            className={`flex-1 py-1 text-[9px] font-bold rounded ${!localConfig.playback.speedUnit || localConfig.playback.speedUnit === 'ms' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                        >
                            Time (ms)
                        </button>
                        <button 
                            onClick={() => handleConfigChange({ playback: { speedUnit: 'bpm' } })} 
                            className={`flex-1 py-1 text-[9px] font-bold rounded ${localConfig.playback.speedUnit === 'bpm' ? 'bg-blue-900 text-blue-200' : 'text-gray-500'}`}
                        >
                            Tempo (BPM)
                        </button>
                    </div>

                    {localConfig.playback.speedUnit === 'bpm' ? (
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                            <div>
                                <label className="block text-gray-500 mb-1">BPM</label>
                                <BufferedInput 
                                    className="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-center text-white" 
                                    value={localConfig.playback.bpm || 120} 
                                    onChange={(val: number) => handleConfigChange({ playback: { bpm: Math.max(1, val) } })} 
                                />
                            </div>
                            <div>
                                <label className="block text-gray-500 mb-1">Gate ({Math.round((localConfig.playback.gate || 0.8)*100)}%)</label>
                                <input 
                                    type="range" min="0.1" max="1.0" step="0.05"
                                    value={localConfig.playback.gate || 0.8}
                                    onChange={(e) => handleConfigChange({ playback: { gate: parseFloat(e.target.value) } })}
                                    className="w-full h-4 accent-blue-500 bg-gray-800 rounded appearance-none cursor-pointer"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-[9px]">
                            <div>
                                <label className="block text-gray-500 mb-1">Step Dur (ms)</label>
                                <BufferedInput 
                                    className="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-center text-white" 
                                    value={localConfig.playback.scaleNoteDuration || 300} 
                                    onChange={(val: number) => handleConfigChange({ playback: { scaleNoteDuration: Math.max(10, val) } })} 
                                />
                            </div>
                            <div>
                                <label className="block text-gray-500 mb-1">Step Gap (ms)</label>
                                <BufferedInput 
                                    className="w-full bg-black border border-gray-700 rounded px-1 py-0.5 text-center text-white" 
                                    value={localConfig.playback.scaleNoteGap !== undefined ? localConfig.playback.scaleNoteGap : 100} 
                                    onChange={(val: number) => handleConfigChange({ playback: { scaleNoteGap: Math.max(0, val) } })} 
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-auto pt-4 border-t border-gray-800 space-y-2">
                    <button onClick={() => handleGenerate()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs shadow-lg">GENERATE</button>
                    {activeId === 'temp' && (
                        <button onClick={handleCreateNew} className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-2 rounded text-xs border border-gray-700">Save as New Set</button>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-black/50">
                <div className="bg-gray-900 border-b border-gray-800 p-2 flex justify-between items-center shrink-0">
                    <div className="flex gap-4 text-[10px] text-gray-400">
                        <span>Total: <b className="text-white">{result?.stats.totalCount || 0}</b></span>
                        <span>Playable: <b className="text-green-400">{result?.stats.playableCount || 0}</b></span>
                        <span>Invalid: <b className="text-red-400">{result?.stats.invalidCount || 0}</b></span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={stopAll} className="bg-red-900/50 hover:bg-red-800 text-white px-3 py-1 rounded text-xs font-bold border border-red-800">STOP</button>
                        <button onClick={handlePlayScale} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Play Scale</button>
                        <button onClick={handlePlayChord} className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold">Play Chord</button>
                    </div>
                </div>

                <div className="h-48 bg-gray-900/30 border-b border-gray-800 relative p-2 group">
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/80 p-1.5 rounded border border-gray-700 shadow-xl min-w-[140px]">
                        <div className="flex gap-2 mb-1">
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-bold text-blue-300">X</span>
                                <select 
                                    value={localConfig.display.xAxis} 
                                    onChange={(e) => handleConfigChange({ display: { xAxis: e.target.value } })}
                                    className="bg-gray-800 text-[9px] text-white border border-gray-600 rounded w-16"
                                >
                                    {availableVars.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] font-bold text-green-300">Y</span>
                                <select 
                                    value={localConfig.display.yAxis} 
                                    onChange={(e) => handleConfigChange({ display: { yAxis: e.target.value } })}
                                    className="bg-gray-800 text-[9px] text-white border border-gray-600 rounded w-16"
                                >
                                    <option value="Cents">Cents</option>
                                    <option value="Hz">Hz</option>
                                    <option value="Ratio">Ratio</option>
                                    {availableVars.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center bg-gray-800/50 px-1 rounded">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={localConfig.display.showGraphPath ?? true} 
                                    onChange={(e) => handleConfigChange({ display: { showGraphPath: e.target.checked } })}
                                    className="accent-blue-500 w-3 h-3"
                                />
                                <span className="text-[8px] text-gray-300">Path</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={localConfig.display.showNoteDots ?? true} 
                                    onChange={(e) => handleConfigChange({ display: { showNoteDots: e.target.checked } })}
                                    className="accent-blue-500 w-3 h-3"
                                />
                                <span className="text-[8px] text-gray-300">Dots</span>
                            </label>
                        </div>

                        <div className="flex gap-1 items-center">
                            <select 
                                value={localConfig.display.drawOrder || 'graph_first'}
                                onChange={e => handleConfigChange({ display: { drawOrder: e.target.value } })}
                                className="bg-gray-800 text-[8px] text-white border border-gray-600 rounded flex-1"
                            >
                                <option value="graph_first">Graph 1st</option>
                                <option value="notes_first">Notes 1st</option>
                                <option value="none">Instant</option>
                            </select>
                            <input 
                                type="number" 
                                min="0" max="500" step="10"
                                value={localConfig.display.revealMsPerNote ?? 20}
                                onChange={e => handleConfigChange({ display: { revealMsPerNote: Math.max(0, parseInt(e.target.value)) } })}
                                className="w-8 bg-black border border-gray-600 rounded text-[8px] text-center text-white"
                                title="Reveal Speed (ms/note)"
                            />
                            <span className="text-[8px] text-gray-500">ms</span>
                        </div>

                        <div className="flex gap-1 items-center bg-gray-800/50 px-1 rounded">
                            <select
                                value={localConfig.display.xSpacingMode || 'from_xaxis'}
                                onChange={(e) => handleConfigChange({ display: { xSpacingMode: e.target.value } })}
                                className="bg-transparent text-[8px] text-gray-300 outline-none border-r border-gray-600 pr-1 flex-1"
                            >
                                <option value="from_xaxis">X = Value</option>
                                <option value="uniform_step">X = Uniform</option>
                            </select>
                            {localConfig.display.xSpacingMode === 'uniform_step' && (
                                <input 
                                    type="number" 
                                    min="0.1" max="50" step="0.1"
                                    value={localConfig.display.uniformXStep ?? 1}
                                    onChange={(e) => handleConfigChange({ display: { uniformXStep: Math.max(0.1, parseFloat(e.target.value)) } })}
                                    className="w-8 bg-black border border-gray-600 rounded text-[8px] text-center text-white"
                                    title="Uniform Step Size"
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-gray-800/50 px-1 rounded mt-0.5">
                            <label className="flex items-center gap-1 cursor-pointer flex-1">
                                <input 
                                    type="checkbox" 
                                    checked={localConfig.display.showDerivative || false} 
                                    onChange={(e) => handleConfigChange({ display: { showDerivative: e.target.checked } })}
                                    className="accent-yellow-500 w-3 h-3"
                                />
                                <span className="text-[8px] font-bold text-yellow-500">ΔY/ΔX</span>
                            </label>
                            {localConfig.display.showDerivative && (
                                <>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={localConfig.display.derivAbsolute || false} 
                                            onChange={(e) => handleConfigChange({ display: { derivAbsolute: e.target.checked } })}
                                            className="accent-yellow-500 w-3 h-3"
                                        />
                                        <span className="text-[8px] font-bold text-yellow-500">Abs</span>
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1" max="50" step="1"
                                        value={localConfig.display.derivStep || 1}
                                        onChange={(e) => handleConfigChange({ display: { derivStep: parseInt(e.target.value) } })}
                                        className="w-8 bg-black border border-gray-600 rounded text-[9px] text-center text-white"
                                        title="Derivative Step Interval"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                    {result && result.notes.length > 0 ? (
                        <ConsequentialGraph 
                            result={result} 
                            display={localConfig.display} 
                            showOriginal={localConfig.showOriginal} 
                            onNoteClick={(n) => playFreq(n.freqHz, 'click')}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-gray-600 text-xs italic">Generate to view graph</div>
                    )}
                </div>

                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                    <table className="w-full text-left text-[10px] border-collapse">
                        <thead className="text-gray-500 sticky top-0 bg-gray-900 z-10">
                            <tr>
                                <th className="p-2 border-b border-gray-700">Idx</th>
                                <th className="p-2 border-b border-gray-700">Inputs</th>
                                <th className="p-2 border-b border-gray-700">Val</th>
                                <th className="p-2 border-b border-gray-700">Norm</th>
                                <th className="p-2 border-b border-gray-700">Cents</th>
                                <th className="p-2 border-b border-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result?.notes.map((note) => (
                                <tr 
                                    key={`${note.idx}`} 
                                    className="hover:bg-white/10 border-b border-gray-800/50 cursor-pointer transition-colors"
                                    onClick={() => playFreq(note.freqHz, 'click')}
                                >
                                    <td className="p-2 text-gray-500">{note.idx}</td>
                                    <td className="p-2 font-mono text-gray-400">
                                        {note.varsSnapshot ? Object.entries(note.varsSnapshot).map(([k,v])=>`${k}=${v}`).join(' ') : `n=${note.n} i=${note.i}`}
                                    </td>
                                    <td className="p-2 font-mono text-blue-300">{note.rawValue}</td>
                                    <td className="p-2 font-mono text-green-300">{isNaN(note.ratioFloat) ? '-' : note.ratioFloat.toFixed(4)}</td>
                                    <td className="p-2 text-gray-400">{isNaN(note.cents) ? '-' : note.cents.toFixed(1)}</td>
                                    <td className="p-2">
                                        {note.playable ? <span className="text-green-500">OK</span> : (isNaN(note.ratioFloat) ? <span className="text-red-500">Invalid</span> : <span className="text-yellow-500">Range</span>)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-2 bg-gray-900 border-t border-gray-800 flex justify-end gap-2 shrink-0">
                    <button onClick={handleSaveMidi} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1 rounded text-xs font-bold">Export MIDI Scale</button>
                    <button onClick={handleSaveKeyboard} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1 rounded text-xs font-bold">To Keyboard</button>
                    <button onClick={handleCompare} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1 rounded text-xs font-bold">Add to Compare</button>
                </div>
            </div>
        </div>
    );
};

