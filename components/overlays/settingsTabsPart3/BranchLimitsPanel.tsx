import React, { useEffect, useState } from 'react';
import type { PrimeLimit } from '../../../types';
import { isPrime } from '../../../musicLogic';

type BranchLimitsPanelProps = {
    settings: any;
    globalSettings: any;
    allLimits: PrimeLimit[];
    isGlobal: boolean;
    perGenCollapsed: boolean;
    setPerGenCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
    handleSettingChange: (...args: any[]) => void;
};

export const BranchLimitsPanel: React.FC<BranchLimitsPanelProps> = ({
    settings,
    globalSettings,
    allLimits,
    perGenCollapsed,
    setPerGenCollapsed,
    handleSettingChange
}) => {
    const [customLimit, setCustomLimit] = useState<number>(Number(settings.maxPrimeLimit) || 11);
    const [perGenInputs, setPerGenInputs] = useState<Record<number, number>>(() => ({
        1: Number(settings.gen1MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
        2: Number(settings.gen2MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
        3: Number(settings.gen3MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
        4: Number(settings.gen4MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11)
    }));

    useEffect(() => {
        if (Number.isFinite(settings.maxPrimeLimit)) {
            setCustomLimit(Number(settings.maxPrimeLimit));
        }
    }, [settings.maxPrimeLimit]);

    useEffect(() => {
        setPerGenInputs({
            1: Number(settings.gen1MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
            2: Number(settings.gen2MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
            3: Number(settings.gen3MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11),
            4: Number(settings.gen4MaxPrimeLimit ?? settings.maxPrimeLimit ?? 11)
        });
    }, [settings.maxPrimeLimit, settings.gen1MaxPrimeLimit, settings.gen2MaxPrimeLimit, settings.gen3MaxPrimeLimit, settings.gen4MaxPrimeLimit]);

    const normalizeLimit = (value: number) => {
        if (!Number.isFinite(value)) return null;
        const base = Math.max(3, Math.floor(value));
        return base % 2 === 0 ? base + 1 : base;
    };

    const applyCustomLimit = () => {
        const normalized = normalizeLimit(customLimit);
        if (normalized == null) return;
        handleSettingChange('maxPrimeLimit', normalized as PrimeLimit);
    };

    const isCustomLimit = !allLimits.includes(settings.maxPrimeLimit as PrimeLimit);
    const customPrimeLimits = (settings.customPrimes || [])
        .map((cp: any) => cp.prime)
        .filter((p: number) => Number.isFinite(p) && isPrime(p)) as PrimeLimit[];
    const allPrimeOptions = Array.from(new Set([...allLimits, ...customPrimeLimits])).sort((a, b) => a - b) as PrimeLimit[];

    return (
        <>
            <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Branching Limit</h3>
                <div className="flex bg-gray-800 rounded border border-gray-600 p-1 flex-wrap">
                    {allLimits.map(limit => (
                        <button key={limit} onClick={() => handleSettingChange('maxPrimeLimit', limit as PrimeLimit)} className={`flex-1 min-w-[2rem] py-1 rounded text-xs font-bold ${settings.maxPrimeLimit === limit ? 'bg-green-600 text-white' : 'text-gray-400'}`}> {limit} </button>
                    ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 uppercase font-bold">Custom Limit</span>
                        <input
                            type="number"
                            min="3"
                            step="2"
                            value={customLimit}
                            onChange={(e) => setCustomLimit(parseInt(e.target.value, 10) || 3)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyCustomLimit();
                                }
                            }}
                            className="w-16 bg-gray-900 border border-gray-700 rounded text-[10px] text-gray-200 text-center font-bold outline-none"
                            title="Odd limit >= 3"
                        />
                        <button
                            onClick={applyCustomLimit}
                            className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                        >
                            Set
                        </button>
                    </div>
                    {isCustomLimit && (
                        <span className="text-[9px] text-amber-300 font-bold">Current: {settings.maxPrimeLimit}</span>
                    )}
                </div>
            </div>

        <div className="p-2 bg-gray-800/50 rounded border border-gray-700 space-y-2">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase">Per-Gen Branch Limits</h3>
                <button onClick={() => setPerGenCollapsed(v => !v)} className="text-[9px] text-blue-400 hover:text-white">
                    {perGenCollapsed ? 'Show' : 'Hide'}
                </button>
            </div>
            {!perGenCollapsed && (
                <>
                    {[1, 2, 3, 4].map((gen) => {
                        const key = `gen${gen}MaxPrimeLimit` as const;
                        const primesKey = `gen${gen}PrimeSet` as const;
                        const override = (settings as any)[key] as PrimeLimit | undefined;
                        const primeSet = (settings as any)[primesKey] as PrimeLimit[] | undefined;
                        const isOverride = override !== undefined;
                        const effective = Math.min(override ?? settings.maxPrimeLimit, settings.maxPrimeLimit) as PrimeLimit;
                        const available = allPrimeOptions.filter(limit => limit <= Math.min(settings.maxPrimeLimit, effective));
                        const customInput = perGenInputs[gen] ?? effective;
                        const hasCustomOverride = isOverride && override !== undefined && !allPrimeOptions.includes(override);
                        const isPrimeActive = (limit: PrimeLimit) => primeSet === undefined ? true : primeSet.includes(limit);
                        const togglePrime = (limit: PrimeLimit) => {
                            const base = new Set(primeSet === undefined ? available : primeSet);
                            const next = new Set(base);
                            if (next.has(limit)) next.delete(limit); else next.add(limit);
                            const arr = Array.from(next).sort((a, b) => a - b) as PrimeLimit[];
                            const normalized = arr.length === available.length ? undefined : arr;
                            handleSettingChange(primesKey, normalized, true);
                        };
                        return (
                            <div key={gen} className="flex flex-col gap-2 bg-gray-900/60 border border-gray-700 rounded p-2">
                                <div className="flex justify-between items-center">
                                    <span className={`text-[9px] font-bold uppercase ${gen === 1 ? 'text-green-300' : gen === 2 ? 'text-yellow-300' : gen === 3 ? 'text-purple-300' : 'text-pink-300'}`}>
                                        Gen {gen} Max Prime
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {!isOverride && (
                                            <span className="text-[9px] text-gray-500">Using Max: {settings.maxPrimeLimit}</span>
                                        )}
                                        <label className="flex items-center gap-2 text-[9px] text-gray-400">
                                            <input
                                                type="checkbox"
                                                checked={isOverride}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        const next = Math.min(settings.maxPrimeLimit, override ?? settings.maxPrimeLimit) as PrimeLimit;
                                                        handleSettingChange(key, next, true);
                                                    } else {
                                                        handleSettingChange({ [key]: undefined, [primesKey]: undefined }, undefined, true);
                                                    }
                                                }}
                                                className="w-3 h-3 accent-blue-500"
                                            />
                                            Override
                                        </label>
                                    </div>
                                </div>
                                {isOverride && (
                                    <>
                                        <div className="flex bg-gray-800 rounded border border-gray-700 p-1 flex-wrap">
                                            {available.map(limit => (
                                                <button
                                                    key={`${gen}-${limit}`}
                                                    onClick={() => handleSettingChange(key, limit as PrimeLimit)}
                                                    className={`flex-1 min-w-[2rem] py-1 rounded text-[9px] font-bold ${effective === limit ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                                                >
                                                    {limit}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] text-gray-500 uppercase font-bold">Custom</span>
                                                <input
                                                    type="number"
                                                    min="3"
                                                    step="2"
                                                    value={customInput}
                                                    onChange={(e) => setPerGenInputs(prev => ({ ...prev, [gen]: parseInt(e.target.value, 10) || 3 }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const normalized = normalizeLimit(customInput);
                                                            if (normalized == null) return;
                                                            const next = Math.min(normalized, settings.maxPrimeLimit);
                                                            handleSettingChange(key, next as PrimeLimit);
                                                        }
                                                    }}
                                                    className="w-16 bg-gray-900 border border-gray-700 rounded text-[9px] text-gray-200 text-center font-bold outline-none"
                                                    title="Odd limit >= 3"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const normalized = normalizeLimit(customInput);
                                                        if (normalized == null) return;
                                                        const next = Math.min(normalized, settings.maxPrimeLimit);
                                                        handleSettingChange(key, next as PrimeLimit);
                                                    }}
                                                    className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500"
                                                >
                                                    Set
                                                </button>
                                            </div>
                                            {hasCustomOverride && (
                                                <span className="text-[9px] text-amber-300 font-bold">Current: {override}</span>
                                            )}
                                        </div>
                                    </>
                                )}
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Active primes for Gen {gen}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {available.map(limit => (
                                            <label key={`allow-${gen}-${limit}`} className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-800/60 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isPrimeActive(limit as PrimeLimit)}
                                                    onChange={() => togglePrime(limit as PrimeLimit)}
                                                    className="w-3 h-3 accent-blue-500"
                                                />
                                                <span className="text-gray-200 font-bold">{limit}L</span>
                                            </label>
                                        ))}
                                    </div>
                                    {primeSet !== undefined && primeSet.length === 0 && (
                                        <span className="text-[9px] text-red-400 italic">No primes selected for this gen.</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
        </>
    );
};
