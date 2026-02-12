import React, { useState } from 'react';
import type { PrimeLimit, CustomPrimeConfig } from '../../../types';
import { isPrime, generatePrimeColor, expandCompositePrimeVector } from '../../../musicLogic';
import { CustomPrimeNotationRow } from './CustomPrimeNotationRow';
type OriginalAxisRootsPanelProps = {
    settings: any;
    globalSettings: any;
    resetLatticeConfig: () => void;
    toggleRootLimit: (limit: PrimeLimit) => void;
    handleSettingChange: (...args: any[]) => void;
    allLimits: PrimeLimit[];
    customPrimeInput: number;
    setCustomPrimeInput: React.Dispatch<React.SetStateAction<number>>;
    renderGen0LoopOptions: () => React.ReactNode;
    renderCommaSpreadingOptions: () => React.ReactNode;
    isGlobal: boolean;
};
export const OriginalAxisRootsPanel: React.FC<OriginalAxisRootsPanelProps> = ({ settings, globalSettings, resetLatticeConfig, toggleRootLimit, handleSettingChange, allLimits, customPrimeInput, setCustomPrimeInput, renderGen0LoopOptions, renderCommaSpreadingOptions, isGlobal }) => {
    const [customPrimeNotationCollapsed, setCustomPrimeNotationCollapsed] = useState(true);
    const getNextOdd = (n: number) => {
        let i = Math.max(3, Math.floor(n) + 1);
        if (i % 2 === 0) i += 1;
        return i;
    };
    const getPrevOdd = (n: number) => {
        let i = Math.max(3, Math.floor(n) - 1);
        if (i % 2 === 0) i -= 1;
        return Math.max(3, i);
    };

    const getPrimeAccidental = (p: number) => {
        const cpList: CustomPrimeConfig[] = (globalSettings.customPrimes || []);
        const cp = cpList.find(c => c.prime === p);
        const sym = (cp as any)?.symbolUp ?? (globalSettings.notationSymbols || {})[p]?.up ?? '';
        return typeof sym === 'string' ? sym : '';
    };

    const getOddLimitAccidentalName = (limit: number) => {
        const vec = expandCompositePrimeVector({ [limit]: 1 } as any);
        const parts: string[] = [];
        Object.entries(vec)
            .map(([k, v]) => [parseInt(k, 10), v] as [number, number])
            .filter(([p, v]) => Number.isFinite(p) && v > 0)
            .sort((a, b) => a[0] - b[0])
            .forEach(([p, v]) => {
                const sym = getPrimeAccidental(p);
                if (!sym) return;
                for (let i = 0; i < v; i++) parts.push(sym);
            });
        return parts.join('');
    };
    return (
        <>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase">Original Axis Roots (Gen 0)</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => resetLatticeConfig()} className="text-[9px] text-blue-400 hover:text-white border border-blue-900 px-2 py-0.5 rounded bg-blue-950/30 font-bold active:scale-95 transition-transform">
                        RESET CONFIG
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer bg-black/20 hover:bg-black/40 px-2 py-0.5 rounded border border-gray-800/50 transition-colors">
                        <input
                            type="checkbox"
                            checked={(globalSettings.geometry as any)?.ignoreOverrides === true}
                            onChange={(e) => {
                                const current = globalSettings.geometry || {};
                                handleSettingChange('geometry', { ...current, ignoreOverrides: e.target.checked });
                            }}
                            className="w-3 h-3 accent-indigo-500"
                        />
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Ignore Manual (Info Panel) Override</span>
                    </label>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex gap-2 flex-wrap items-center">
                    {allLimits.map(limit => (
                        <button key={limit} onClick={() => toggleRootLimit(limit as PrimeLimit)} className={`px-3 py-1 rounded border text-xs font-bold ${settings.rootLimits?.includes(limit as PrimeLimit) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                            {limit}
                        </button>
                    ))}
                    {(globalSettings.customPrimes || []).map((cp: CustomPrimeConfig) => {
                        const isComposite = !isPrime(cp.prime);
                        const accidentalName = isComposite ? getOddLimitAccidentalName(cp.prime) : '';
                        return (
                        <button key={cp.prime} onClick={() => {
                            const current = new Set(settings.rootLimits || []);
                            if (current.has(cp.prime)) {
                                current.delete(cp.prime);
                            } else {
                                current.add(cp.prime);
                            }
                            const next = Array.from(current).sort((a, b) => (a as number) - (b as number));
                            handleSettingChange('rootLimits', next);
                        }} className={`px-3 py-1 rounded border text-xs font-bold relative group ${(settings.rootLimits || []).includes(cp.prime) ? 'border-blue-400 text-white' : 'border-gray-600 text-gray-400'}`} style={{ backgroundColor: (settings.rootLimits || []).includes(cp.prime) ? cp.color : undefined, borderColor: cp.color }} title={`${isComposite ? 'Odd Limit' : 'Custom Prime'}: ${cp.prime.toLocaleString()}`}>
                            <span className="flex items-center gap-1">
                                <span>{cp.prime}</span>
                                {isComposite && <span className="text-[8px] text-purple-100/80 uppercase">Odd</span>}
                                {isComposite && accidentalName && <span className="text-[8px] text-purple-200/70">({accidentalName})</span>}
                            </span>
                            <span onClick={(e) => {
                                e.stopPropagation();
                                const filtered = (globalSettings.customPrimes || []).filter((c: CustomPrimeConfig) => c.prime !== cp.prime);
                                handleSettingChange('customPrimes', filtered);
                                const currentRoots = new Set(settings.rootLimits || []);
                                if (currentRoots.has(cp.prime)) {
                                    currentRoots.delete(cp.prime);
                                    handleSettingChange('rootLimits', Array.from(currentRoots));
                                }
                            }} className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 text-white text-[8px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                x
                            </span>
                        </button>
                    )})}
                    <div className="relative flex items-center bg-purple-900/50 border border-purple-600 rounded overflow-hidden h-7">
                        <input type="number" min="3" step="2" value={customPrimeInput} onChange={(e) => setCustomPrimeInput(parseInt(e.target.value) || 3)} className="w-12 px-1 bg-transparent text-xs text-center text-purple-200 font-bold outline-none appearance-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" title="Add odd limit (>1)" onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = Math.abs(customPrimeInput);
                                if (val > 1 && val % 2 === 1) {
                                    const existing = globalSettings.customPrimes || [];
                                    const hasCustom = existing.some((c: CustomPrimeConfig) => c.prime === val);
                                    const isStandard = allLimits.includes(val as PrimeLimit);
                                    let nextCustom = [...existing];

                                    if (!isStandard && !hasCustom) {
                                        const newConfig: CustomPrimeConfig = { prime: val, color: generatePrimeColor(val) };
                                        nextCustom.push(newConfig);
                                    }

                                    const factorVec = expandCompositePrimeVector({ [val]: 1 } as any);
                                    Object.keys(factorVec).forEach((key) => {
                                        const prime = parseInt(key, 10);
                                        if (!Number.isFinite(prime)) return;
                                        if (allLimits.includes(prime as PrimeLimit)) return;
                                        if (nextCustom.find((c: CustomPrimeConfig) => c.prime === prime)) return;
                                        nextCustom.push({ prime, color: generatePrimeColor(prime) });
                                    });

                                    if (nextCustom.length !== existing.length) {
                                        handleSettingChange('customPrimes', nextCustom);
                                    }
                                }
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setCustomPrimeInput(getNextOdd(customPrimeInput));
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setCustomPrimeInput(getPrevOdd(customPrimeInput));
                            }
                        }} />
                        <div className="flex flex-col border-l border-purple-600">
                            <button onClick={() => setCustomPrimeInput(getNextOdd(customPrimeInput))} className="h-3.5 px-0.5 flex items-center justify-center bg-purple-800 hover:bg-purple-700 text-[8px] text-purple-200 leading-none">
                                ^
                            </button>
                            <button onClick={() => setCustomPrimeInput(getPrevOdd(customPrimeInput))} className="h-3.5 px-0.5 flex items-center justify-center bg-purple-800 hover:bg-purple-700 text-[8px] text-purple-200 leading-none border-t border-purple-600">
                                v
                            </button>
                        </div>
                    </div>
                </div>

                {isGlobal && (globalSettings.customPrimes || []).length > 0 && (
                    <div className="mt-2 bg-purple-900/10 rounded border border-purple-800/30 overflow-hidden">
                        <div
                            className="flex items-center justify-between p-2 cursor-pointer hover:bg-purple-900/20 transition-colors"
                            onClick={() => setCustomPrimeNotationCollapsed(!customPrimeNotationCollapsed)}
                        >
                            <h3 className="text-[10px] font-bold text-purple-400 uppercase">Custom Prime Notation</h3>
                            <span className="text-purple-400 text-[10px]">{customPrimeNotationCollapsed ? '▼' : '▲'}</span>
                        </div>
                        {!customPrimeNotationCollapsed && (
                            <div className="p-2 pt-0 space-y-2">
                                <div className="space-y-2">
                                    {(globalSettings.customPrimes || []).map((cp: CustomPrimeConfig) => (
                                        <CustomPrimeNotationRow key={cp.prime} cp={cp} globalSettings={globalSettings} handleSettingChange={handleSettingChange} />
                                    ))}
                                </div>
                                <div className="text-[8px] text-purple-400/60 italic">
                                    Click the picker to select from Greek letters, arrows, and symbols, or type custom characters.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {renderGen0LoopOptions()}
                {renderCommaSpreadingOptions()}
            </div>
        </>
    );
};
