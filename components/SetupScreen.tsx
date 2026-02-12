
import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import type { PrimeLimit } from '../types';
import { estimateNodeCount } from '../utils/lattice';

export const SetupScreen = () => {
  const completeSetup = useStore((s) => s.completeSetup);
  const [selectedLimits, setSelectedLimits] = useState<PrimeLimit[]>([3]);
  const [latticeLimit, setLatticeLimit] = useState<PrimeLimit>(11);
  const [customLimitInput, setCustomLimitInput] = useState<number>(11);
  const [expansionA, setExpansionA] = useState<number>(12);
  
  const [expansionB, setExpansionB] = useState<number>(4);
  const [expansionC, setExpansionC] = useState<number>(1);
  const [expansionD, setExpansionD] = useState<number>(0);
  const [expansionE, setExpansionE] = useState<number>(0);
  
  const [visualMode, setVisualMode] = useState<'performance' | 'quality'>('quality');
  
  const [showGenInfo, setShowGenInfo] = useState(false);
  
  const limits: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

  useEffect(() => {
      if (Number.isFinite(latticeLimit)) {
          setCustomLimitInput(Number(latticeLimit));
      }
  }, [latticeLimit]);

  const normalizeLimit = (value: number) => {
      if (!Number.isFinite(value)) return null;
      const base = Math.max(3, Math.floor(value));
      return base % 2 === 0 ? base + 1 : base;
  };
  
  const toggleLimit = (limit: PrimeLimit) => {
      setSelectedLimits(prev => {
          let next;
          if (prev.includes(limit)) {
              if (prev.length === 1) next = prev; 
              else next = prev.filter(p => p !== limit);
          } else {
              next = [...prev, limit].sort((a, b) => a - b);
          }
          
          const maxSelected = Math.max(...next);
          if (latticeLimit < maxSelected) {
              setLatticeLimit(maxSelected as PrimeLimit);
          }
          return next || prev;
      });
  };

  const setMaxLimit = (limit: PrimeLimit) => {
      
      const maxRoot = Math.max(...selectedLimits);
      if (limit < maxRoot) return; 
      setLatticeLimit(limit);
  };

  const applyCustomLimit = () => {
      const normalized = normalizeLimit(customLimitInput);
      if (normalized == null) return;
      const maxRoot = Math.max(...selectedLimits);
      const next = Math.max(maxRoot, normalized);
      setLatticeLimit(next as PrimeLimit);
  };

  const handleStart = () => {
      
      completeSetup(selectedLimits, latticeLimit, expansionA, expansionB, expansionC, expansionD, expansionE, visualMode);
  };

  const predictedCount = useMemo(() => {
      return estimateNodeCount(
          selectedLimits, 
          latticeLimit, 
          expansionA, 
          expansionB, 
          expansionC, 
          expansionD, 
          expansionE
      );
  }, [selectedLimits, latticeLimit, expansionA, expansionB, expansionC, expansionD, expansionE]);

  const isMultiAxis = selectedLimits.length > 1;

  const isHeavy = predictedCount > 50000;
  const isCritical = predictedCount > 200000;

  return (
    <div className="absolute inset-0 bg-black z-50 overflow-y-auto custom-scrollbar text-white">
      <div className="min-h-full flex flex-col items-center justify-center p-8 pb-32">
      <div className="max-w-3xl w-full text-center space-y-8 animate-fade-in py-10">
        
        <div className="space-y-4">
            <p className="text-2xl md:text-5xl font-mono uppercase tracking-widest font-bold text-blue-300 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse-slow leading-tight">
                Dynamic N-Dimensional Prime-Limit Harmonic Lattice &amp; Synthesizer
            </p>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Explore the entangled geometry of musical harmony through Just Intonation.
            </p>
            
            <div className="pt-2">
                <button 
                    onClick={handleStart}
                    className="px-8 py-3 bg-white hover:bg-gray-200 text-black font-bold rounded-full transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                >
                    <span>🚀</span>
                    <span>Quick Enter</span>
                </button>
                <p className="text-[10px] text-gray-600 mt-2">Uses default settings (3-Limit Axis, 11-Limit Branching)</p>
            </div>
        </div>

        <div className="bg-gray-900/90 border border-gray-800 rounded-xl p-8 shadow-2xl backdrop-blur-sm space-y-8 text-left">
            <div className="text-center border-b border-gray-800 pb-4 mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Or Configure Manually</span>
            </div>

            <div>
                <h2 className="text-xl font-bold mb-6 text-blue-200 uppercase tracking-widest text-center md:text-left">
                    1. Lattice Configuration (Axes & Limits)
                </h2>
                
                <div className="space-y-6">
                    <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                        <h3 className="text-sm font-bold text-gray-300 uppercase mb-3 text-left">A. Choose Original Axis Configurations (Gen 0)</h3>
                        <p className="text-xs text-gray-500 mb-4 text-left">
                            Select the Prime Limits that will act as the fundamental skeleton axes.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {limits.map(limit => {
                                const isSelected = selectedLimits.includes(limit);
                                const isExperimental = limit >= 17;
                                return (
                                    <button
                                        key={limit}
                                        onClick={() => toggleLimit(limit)}
                                        className={`
                                            relative p-3 rounded-lg border-2 transition-all duration-200
                                            flex flex-col items-center justify-center gap-1
                                            ${isSelected 
                                                ? 'border-blue-500 bg-blue-900/30 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                                                : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                            }
                                        `}
                                    >
                                        <span className="text-2xl font-mono font-bold">{limit}</span>
                                        <span className="text-[9px] uppercase font-bold tracking-wider">
                                            {limit === 3 ? 'Pythagorean' : 
                                            limit === 5 ? 'Syntonic' : 
                                            limit === 7 ? 'Septimal' : 
                                            limit === 11 ? 'Undecimal' : 
                                            limit === 13 ? 'Tridecimal' : 
                                            limit === 17 ? 'Septendecimal' : 
                                            limit === 19 ? 'Undevicesimal' :
                                            limit === 23 ? '23-Limit' :
                                            limit === 29 ? '29-Limit' :
                                            limit === 31 ? '31-Limit' : 'Vicesimal'}
                                        </span>
                                        {isExperimental && <span className="text-[8px] text-red-400 absolute top-1 right-1">(Exp)</span>}
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_5px_rgba(96,165,250,1)]"></div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
                        <h3 className="text-sm font-bold text-gray-300 uppercase mb-3 text-left">B. Max Branching Limit</h3>
                        <p className="text-xs text-gray-500 mb-4 text-left">
                            Determine the highest prime limit available for branching in Gen 1 and above.
                        </p>
                        <div className="flex gap-2 justify-center flex-wrap">
                            {limits.map(limit => {
                                const isSelected = latticeLimit === limit;
                                const maxRoot = Math.max(...selectedLimits);
                                const isDisabled = limit < maxRoot;
                                const isExperimental = limit >= 17;
                                
                                return (
                                    <button
                                        key={`max-${limit}`}
                                        onClick={() => setMaxLimit(limit)}
                                        disabled={isDisabled}
                                        className={`
                                            flex-1 min-w-[3rem] py-2 rounded font-mono font-bold text-sm border transition-all relative
                                            ${isSelected 
                                                ? 'bg-green-600 border-green-400 text-white shadow-[0_0_10px_rgba(34,197,94,0.5)]' 
                                                : isDisabled 
                                                    ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed'
                                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
                                            }
                                        `}
                                    >
                                        {limit}
                                        {isExperimental && <span className="absolute -top-2 -right-1 text-[8px] text-red-500 font-bold bg-black px-1 rounded border border-red-500">EXP</span>}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Custom Limit</span>
                            <input
                                type="number"
                                min="3"
                                step="2"
                                value={customLimitInput}
                                onChange={(e) => setCustomLimitInput(parseInt(e.target.value, 10) || 3)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        applyCustomLimit();
                                    }
                                }}
                                className="w-20 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-center text-gray-200 font-bold outline-none"
                                title="Odd limit >= 3"
                            />
                            <button
                                onClick={applyCustomLimit}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400"
                            >
                                Set
                            </button>
                            {!limits.includes(latticeLimit) && (
                                <span className="text-[10px] text-amber-300 font-bold">Current: {latticeLimit}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-8 relative z-20">
                <div className="flex items-center justify-center gap-3 mb-6 relative">
                    <svg className="w-5 h-5 text-blue-500 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        <polyline points="2 17 12 22 22 17" />
                        <polyline points="2 12 12 17 22 12" />
                    </svg>

                    <h2 className="text-xl font-bold text-blue-200 uppercase tracking-widest">
                        2. Set Original Axis Length (Gen 0)
                    </h2>

                    <button 
                        onClick={(e) => { e.preventDefault(); setShowGenInfo(!showGenInfo); }}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-serif font-bold transition-all duration-200 ${showGenInfo ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-500 text-gray-400 hover:text-white hover:border-white'}`}
                        title="Click for details about Generations"
                    >
                        i
                    </button>

                    {showGenInfo && (
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-gray-950 border border-gray-600 p-6 rounded-lg shadow-2xl z-50 w-[30rem] text-left animate-fade-in-up">
                            <div className="flex justify-between items-start mb-4 border-b border-gray-700 pb-2">
                                <h4 className="text-blue-400 font-bold uppercase text-sm tracking-wider">Lattice Generation Dynamics</h4>
                                <button 
                                    onClick={() => setShowGenInfo(false)}
                                    className="text-gray-500 hover:text-white"
                                >✕</button>
                            </div>
                            
                            <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
                                <div>
                                    <strong className="text-white block mb-1">Gen 0 (The Skeleton)</strong>
                                    <p>The fundamental highways extending from the center (1/1). Their direction is determined by the "Original Axis Configurations" selected in Step 1.</p>
                                </div>
                                
                                <div>
                                    <strong className="text-green-400 block mb-1">Gen 1</strong>
                                    <p>New lines of all limit below or equal to {latticeLimit} (Max Branching Limit) that branch off <em>every note</em> on all Gen 0 skeleton/branches.</p>
                                </div>

                                <div>
                                    <strong className="text-yellow-400 block mb-1">Gen 2</strong>
                                    <p>New lines of all limit below or equal to {latticeLimit} (Max Branching Limit) that branch off <em>every note</em> on all Gen 1 skeleton/branches.</p>
                                </div>

                                <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-md mt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-red-500 text-lg">⚠️</span>
                                        <strong className="text-red-400 text-xs uppercase">Recursive Growth</strong>
                                    </div>
                                    <p className="text-[11px] text-red-200/70">
                                        Because each generation branches off <em>every single node</em> of the previous generation, the total count grows exponentially. Be very careful with sliders.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <p className="text-sm text-gray-400 mb-6 text-center">
                    Define how many notes extend in each direction for the chosen axes (Max 1000).
                </p>
                
                <div className="flex flex-col items-center gap-4 max-w-sm mx-auto mb-8">
                    <div className="w-full flex justify-between items-center bg-gray-800 p-2 rounded">
                        <span className="text-sm text-gray-300 font-bold">Notes per direction</span>
                        <input 
                            type="number" 
                            min="5" max="1000" 
                            value={expansionA} 
                            onChange={(e) => setExpansionA(Math.min(1000, Math.max(5, parseInt(e.target.value) || 5)))}
                            className="bg-black/50 border border-gray-600 rounded px-3 py-1 text-right text-blue-400 font-bold focus:border-blue-500 outline-none w-24"
                        />
                    </div>
                    <input 
                        type="range" 
                        min="5" max="1000" 
                        value={expansionA} 
                        onChange={(e) => setExpansionA(parseInt(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                </div>

                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 relative">
                    <h3 className="text-md font-bold text-gray-300 uppercase mb-4 text-center md:text-left">Advanced Expansion Settings</h3>
                    
                    {isMultiAxis && (
                        <div className="mb-6 bg-yellow-900/30 border border-yellow-700/50 p-3 rounded-lg flex items-start gap-3">
                            <span className="text-xl">⚠️</span>
                            <div className="text-left">
                                <h4 className="text-yellow-400 font-bold text-xs uppercase mb-1">High Density Warning</h4>
                                <p className="text-[11px] text-yellow-200/80 leading-relaxed">
                                    You have multiple Original Axes selected. 
                                    If you enable <strong>Gen 2 or higher</strong>, please keep your <strong>Gen 0 Axis Length</strong> short. 
                                    The combination of Long Axes + Multiple Origins + High Generations causes explosive node growth.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs text-green-400 font-bold">Gen 1 Expansion (B)</label>
                                <span className="text-xs font-mono">{expansionB}</span>
                            </div>
                            <input type="range" min="1" max="40" value={expansionB} onChange={(e) => setExpansionB(parseInt(e.target.value))} className="w-full accent-green-500" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs text-yellow-400 font-bold">Gen 2 Expansion (C)</label>
                                <span className="text-xs font-mono">{expansionC}</span>
                            </div>
                            <input type="range" min="0" max="30" value={expansionC} onChange={(e) => setExpansionC(parseInt(e.target.value))} className="w-full accent-yellow-500" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs text-purple-400 font-bold">Gen 3 Expansion (D)</label>
                                <span className="text-xs font-mono">{expansionD}</span>
                            </div>
                            <input type="range" min="0" max="18" value={expansionD} onChange={(e) => setExpansionD(parseInt(e.target.value))} className="w-full accent-purple-500" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-xs text-pink-400 font-bold">Gen 4 Expansion (E) <span className="text-red-500 text-[9px]">(EXP)</span></label>
                                <span className="text-xs font-mono">{expansionE}</span>
                            </div>
                            <input type="range" min="0" max="15" value={expansionE} onChange={(e) => setExpansionE(parseInt(e.target.value))} className="w-full accent-pink-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-8">
                <h2 className="text-xl font-bold mb-6 text-blue-200 uppercase tracking-widest text-center md:text-left">
                    3. Visual Quality
                </h2>
                <div className="flex gap-4 justify-center max-w-md mx-auto">
                    <button
                        onClick={() => setVisualMode('quality')}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${visualMode === 'quality' ? 'border-blue-500 bg-blue-900/30 text-white shadow-lg' : 'border-gray-700 bg-gray-800/50 text-gray-500'}`}
                    >
                        <span className="font-bold">High Quality</span>
                        <span className="text-[10px] uppercase">Thick Lines • Spheres</span>
                    </button>
                    <button
                        onClick={() => setVisualMode('performance')}
                        className={`flex-1 p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${visualMode === 'performance' ? 'border-blue-500 bg-blue-900/30 text-white shadow-lg' : 'border-gray-700 bg-gray-800/50 text-gray-500'}`}
                    >
                        <span className="font-bold">Performance</span>
                        <span className="text-[10px] uppercase">Thin Lines • Low Poly</span>
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                <div className={`text-xs font-bold font-mono p-2 rounded border ${isCritical ? 'bg-red-900/50 border-red-500 text-red-200' : isHeavy ? 'bg-yellow-900/30 border-yellow-600 text-yellow-200' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                    Predicted Max Nodes: <span className="text-lg">{predictedCount.toLocaleString()}</span>
                    {isCritical && <span className="block text-[10px] mt-1 uppercase text-red-400 animate-pulse">Critical: Browser may crash</span>}
                    {predictedCount > 10000 && visualMode === 'quality' && <span className="block text-[10px] mt-1 text-yellow-400">High node count: 'Performance' mode recommended.</span>}
                </div>
                
                <button
                    onClick={handleStart}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg text-xl font-bold text-white shadow-lg transform transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                    Initialize Lattice
                </button>
            </div>
        </div>

        <p className="text-xs text-gray-600 font-mono">
            Powered by WebGL • React Three Fiber • Web Audio API
        </p>
      </div>
      </div>
    </div>
  );
};
