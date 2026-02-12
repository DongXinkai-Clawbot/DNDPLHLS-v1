import React from 'react';
import { computeFJS } from '../../../../utils/fjsNaming';
import type { RatioToolViewProps } from './RatioToolView';

export const RatioToolSingleMode = (props: RatioToolViewProps) => {
    const {
        inputA,
        setInputA,
        inputB,
        setInputB,
        autoNormField,
        analyze,
        normalizeSingle,
        setNormalizeSingle,
        result,
        getDummyNode,
        dummyRoot,
        playWithOverride,
        playSimultaneous,
        playSettings,
        addToComparison,
        addToKeyboard,
        selectNode,
        updateSettings,
        regenerateLattice,
    } = props as any;

    return (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex gap-2 items-center">
                <div className="flex flex-col gap-1 w-36">
                    <input
                        type="text"
                        value={inputA}
                        onChange={e => setInputA(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        onKeyUp={e => e.stopPropagation()}
                        onKeyPress={e => e.stopPropagation()}
                        className="w-full bg-gray-900 border border-gray-600 p-1.5 rounded text-center text-white font-mono"
                        placeholder="Numerator (a^k/n, *, /)"
                    />
                    <button
                        onClick={() => autoNormField('A')}
                        className="text-[9px] bg-gray-800 text-gray-400 hover:text-white rounded py-0.5 border border-gray-700 font-bold"
                        title="Scale this field by powers of 2 to land in [1, 2]"
                    >
                        2ⁿ norm
                    </button>
                </div>
                <span className="font-bold text-gray-500 text-lg self-start mt-1">/</span>
                <div className="flex flex-col gap-1 w-20">
                    <input
                        type="text"
                        value={inputB}
                        onChange={e => setInputB(e.target.value)}
                        onKeyDown={e => e.stopPropagation()}
                        onKeyUp={e => e.stopPropagation()}
                        onKeyPress={e => e.stopPropagation()}
                        className="w-full bg-gray-900 border border-gray-600 p-1.5 rounded text-center text-white font-mono"
                        placeholder="Denom"
                    />
                    <button
                        onClick={() => autoNormField('B')}
                        className="text-[9px] bg-gray-800 text-gray-400 hover:text-white rounded py-0.5 border border-gray-700 font-bold"
                        title="Scale this field by powers of 2 to land in [1, 2]"
                    >
                        2ⁿ norm
                    </button>
                </div>
                <button onClick={analyze} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded flex-1 font-bold h-[54px] self-start shadow-lg">Analyze</button>
            </div>
        
            <label className="flex items-center gap-2 cursor-pointer select-none px-1">
                <input
                    type="checkbox"
                    checked={normalizeSingle}
                    onChange={e => setNormalizeSingle(e.target.checked)}
                    className="w-3 h-3 accent-blue-500 rounded bg-gray-700 border-gray-600"
                />
                <span className="text-[10px] text-gray-400 font-bold uppercase">Restrict to Octave</span>
            </label>
        
            <div className="text-[9px] text-gray-500 italic px-1 mb-1">
                Tip: You can analyze non-base-2 ratios using expressions like <code>3^(k/n)</code>.
            </div>
        
            {result && !result.error && (
                <div className="bg-gray-800/50 p-2 rounded border border-gray-700 space-y-2">
                    <div className="flex justify-between border-b border-gray-700 pb-1 text-blue-300 font-bold"><span>Cents</span><span>{result.cents.toFixed(2)}¢</span></div>
                    <div className="flex justify-between border-b border-gray-700 pb-1 text-gray-300 font-bold items-center">
                        <span>Decimal</span>
                        <div className="flex gap-2 items-center">
                            <span className="font-mono text-xs">{result.decimal.toFixed(9)}</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(result.decimal.toFixed(9));
                                }}
                                className="text-[9px] bg-gray-700 hover:bg-white hover:text-black px-1.5 py-0.5 rounded border border-gray-600 uppercase"
                                title="Copy to Clipboard"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => playWithOverride(getDummyNode()!)} className="flex-1 bg-gray-700 hover:bg-white hover:text-black py-1 rounded text-gray-300">▶ Play</button>
                        <button onClick={() => playSimultaneous(dummyRoot, getDummyNode()!, playSettings)} className="flex-1 bg-gray-700 hover:bg-white hover:text-black py-1 rounded text-gray-300">▶ vs Root</button>
                    </div>
        
                    <div className="flex gap-2">
                        <button onClick={() => addToComparison(getDummyNode()!)} className="flex-1 bg-gray-800 hover:bg-gray-600 text-blue-200 border border-blue-900/50 py-1 rounded text-[10px]">To Compare</button>
                        <button onClick={() => addToKeyboard(getDummyNode()!)} className="flex-1 bg-gray-800 hover:bg-gray-600 text-yellow-200 border border-yellow-900/50 py-1 rounded text-[10px]">To Keyboard</button>
                    </div>
        
                    {!result.unsupported && (
                        <>
                            <div className="flex justify-between text-gray-400"><span>In Lattice:</span><span className={result.exists ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{result.exists ? "Yes" : "No"}</span></div>
                            {!result.exists && (
                                <div className="text-[10px] text-yellow-500 bg-yellow-900/20 p-2 rounded border border-yellow-800/50">
                                    This ratio is not currently generated in your lattice.
                                </div>
                            )}
                            {result.exists ?
                                <button onClick={() => selectNode(result.exists)} className="w-full bg-blue-900/50 hover:bg-blue-800 text-blue-200 py-1 rounded border border-blue-800">Locate Node</button>
                                :
                                <div className="space-y-1">
                                    {result.configChanged && <button onClick={() => { updateSettings(result.suggestedSettings); regenerateLattice(false); }} className="w-full bg-blue-700 py-1 rounded font-bold text-white">Update Lattice Config</button>}
                                </div>
                            }
                        </>
                    )}
                </div>
            )}
            {result && result.error && <div className="text-red-400 p-2 bg-red-900/20 rounded border border-red-900/50">{result.error}</div>}
        
            {result && !result.error && (() => {
                const fjs = computeFJS({ n: result.n, d: result.d });
                return (
                    <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 p-3 rounded-lg border border-indigo-700/50 space-y-2 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">FJS NAMING</span>
                            <span className="text-[9px] text-gray-500">Functional Just System</span>
                        </div>
        
                        <div className="bg-black/40 rounded-lg p-2">
                            <div className="text-[9px] text-gray-500 uppercase mb-1">Full Name</div>
                            <div className="text-sm font-bold text-white">{fjs.fullName}</div>
                        </div>
        
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/30 rounded p-2">
                                <div className="text-[9px] text-gray-500 uppercase">Pythagorean Skeleton</div>
                                <div className="text-xs text-blue-300 font-bold">{fjs.skeleton.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{fjs.skeleton.cents.toFixed(1)}¢</div>
                            </div>
        
                            <div className="bg-black/30 rounded p-2">
                                <div className="text-[9px] text-gray-500 uppercase">Comma Deviation</div>
                                <div className={`text-xs font-bold ${Math.abs(fjs.totalDeviation) < 20 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {fjs.totalDeviation > 0 ? '+' : ''}{fjs.totalDeviation.toFixed(2)}¢
                                </div>
                            </div>
                        </div>
        
                        {fjs.primeFactors.length > 0 && (
                            <div className="bg-black/30 rounded p-2">
                                <div className="text-[9px] text-gray-500 uppercase mb-1">Prime Adjustments</div>
                                <div className="flex flex-wrap gap-1">
                                    {fjs.primeFactors.map((f, i) => (
                                        <span
                                            key={i}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${f.inNumerator ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}
                                        >
                                            {f.inNumerator ? '↑' : '↓'} {f.prime}{f.exponent > 1 ? `^${f.exponent}` : ''}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
        
                        {fjs.modifiers.length > 0 && (
                            <div className="text-[9px] text-gray-400">
                                <span className="text-gray-500">Modifiers: </span>
                                {fjs.modifiers.join(' + ')}
                            </div>
                        )}
        
                        <div className="flex items-center justify-between text-[10px] border-t border-indigo-800/50 pt-2 mt-1">
                            <span className="text-gray-500">Short:</span>
                            <span className="font-mono text-indigo-300">{fjs.shortName}</span>
                        </div>
        
                        {fjs.isComma && (
                            <div className="text-[9px] text-purple-400 italic">This interval is a microtonal comma.</div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
};
