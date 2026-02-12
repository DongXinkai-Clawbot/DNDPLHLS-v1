import React, { useState, useEffect } from 'react';
import { useLatticeStore } from '../../store/latticeStoreContext';
import type { PrimeLimit, SpiralConfig, EqualStepConfig, GeometryConfig, CurvedGeometryConfig } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { parseGeneralRatio, isPrime } from '../../musicLogic';
import { BranchLimitsPanel } from './settingsTabsPart3/BranchLimitsPanel';
import { OriginalAxisRootsPanel } from './settingsTabsPart3/OriginalAxisRootsPanel';
import { SpiralModePanel } from './settingsTabsPart3/SpiralModePanel';
import { EqualStepPanel } from './settingsTabsPart3/EqualStepPanel';
import { ExpansionDistancePanel } from './settingsTabsPart3/ExpansionDistancePanel';
import { Gen0LoopOptionsPanel } from './settingsTabsPart3/Gen0LoopOptionsPanel';
import { DisplayModePanel } from './settingsTabsPart3/DisplayModePanel';
import { CommaSpreadingPanel } from './settingsTabsPart3/CommaSpreadingPanel';
import { Gen1LoopOptionsPanel } from './settingsTabsPart3/Gen1LoopOptionsPanel';
import { SimplificationPanel } from './settingsTabsPart3/SimplificationPanel';
import { GeometryModePanel } from './settingsTabsPart3/GeometryModePanel';
import { BranchHotkeyPanel } from './settingsTabsPart3/BranchHotkeyPanel';
import { CurvedGeometryPanel } from './settingsTabsPart3/CurvedGeometryPanel';

export const GenTab = ({ settings, globalSettings, handleSettingChange, updateVisualSettings, toggleAxisLoop, toggleRootLimit, movePriority, predictedCount, isGlobal, isCompact, onInteractionStart, onInteractionEnd }: any) => {
    const resetLatticeConfig = useLatticeStore((s) => s.resetLatticeConfig);
    const unmaskNode = useLatticeStore((s) => s.unmaskNode);
    const unmaskAllNodes = useLatticeStore((s) => s.unmaskAllNodes);
    const nodes = useLatticeStore((s) => s.nodes);
    const [openLoopFinder, setOpenLoopFinder] = useState<{
        limit: PrimeLimit;
        gen: 0 | 1 | 2;
        parentLimit?: PrimeLimit;
    } | null>(null);
    const [gen1Collapsed, setGen1Collapsed] = useState(false);
    const [perGenCollapsed, setPerGenCollapsed] = useState(true);
    const [targetGen0, setTargetGen0] = useState<PrimeLimit>(3);
    const [loopOrder, setLoopOrder] = useState<'size' | 'position'>('position');
    const [spreadingCollapsed, setSpreadingCollapsed] = useState(true);
    const [nodeOverridesCollapsed, setNodeOverridesCollapsed] = useState(true);
    const spiralEnabled = !!globalSettings.spiral?.enabled;
    const geometryEnabled = !!globalSettings.geometry?.enabled;
    const curvedEnabled = !!globalSettings.curvedGeometry?.enabled;
    const isDiamond = globalSettings.visuals.layoutMode === 'diamond';
    const isHChroma = globalSettings.visuals.layoutMode === 'h-chroma';
    const isSpecialLayout = isDiamond || isHChroma;
    const [eqBase, setEqBase] = useState(globalSettings.equalStep?.base?.toString() || "2");
    const [eqDivs, setEqDivs] = useState(globalSettings.equalStep?.divisions?.toString() || "12");
    const [eqDelta, setEqDelta] = useState(globalSettings.equalStep?.deltaN?.toString() || "1");
    const [eqCircle, setEqCircle] = useState(globalSettings.equalStep?.stepsPerCircle?.toString() || "12");
    const [eqRange, setEqRange] = useState(globalSettings.equalStep?.range?.toString() || "12");
    const [eqRadius, setEqRadius] = useState(globalSettings.equalStep?.radius?.toString() || "40");
    const [customPrimeInput, setCustomPrimeInput] = useState(37);
    const allLimits: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const hChromaBranchSelected = Array.isArray(globalSettings.visuals.hChromaBranchSelected) ? globalSettings.visuals.hChromaBranchSelected : [];
    const hChromaBranchSelectedHarmonic = globalSettings.visuals.hChromaBranchSelectedHarmonic || 0;
    const hChromaBranchOverrides = globalSettings.visuals.hChromaBranchOverrides || {};
    const hChromaSelectedOverride = hChromaBranchSelectedHarmonic ? (hChromaBranchOverrides as any)[hChromaBranchSelectedHarmonic] : undefined;
    const hChromaSelectedMode = hChromaSelectedOverride?.enabled === false ? 'off' : hChromaSelectedOverride?.enabled === true ? 'override' : 'global';
    const isGen1Custom = settings.gen1Lengths && Object.keys(settings.gen1Lengths).length > 0;
    const isGen2Custom = settings.gen2Lengths && Object.keys(settings.gen2Lengths).length > 0;
    const nodeOverrideEntries = React.useMemo(() => {
        const overrides = globalSettings.geometry?.nodeBranchOverrides || {};
        return Object.entries(overrides).map(([nodeId, override]: any) => {
            const node = nodes.find((n: any) => n.id === nodeId);
            const axisOverrides = override?.axisOverrides || {};
            const axisList = Object.entries(axisOverrides)
                .map(([limit, value]: any) => ({
                    limit: parseInt(limit, 10),
                    pos: value?.pos ?? 0,
                    neg: value?.neg ?? 0
                }))
                .filter((entry) => Number.isFinite(entry.limit))
                .sort((a, b) => a.limit - b.limit);
            return {
                nodeId,
                name: node?.name || nodeId,
                override,
                axisOverrides: axisList
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [globalSettings.geometry?.nodeBranchOverrides, nodes]);

    const updateSpiral = (partial: Partial<SpiralConfig>) => {
        const current = globalSettings.spiral || DEFAULT_SETTINGS.spiral;
        handleSettingChange('spiral', { ...current, ...partial });
    };

    const updateGeometry = (partial: Partial<GeometryConfig>) => {
        const current = globalSettings.geometry || DEFAULT_SETTINGS.geometry;
        handleSettingChange('geometry', { ...current, ...partial });
    };

    const updateEqualStep = (partial: Partial<EqualStepConfig>) => {
        const current = globalSettings.equalStep || DEFAULT_SETTINGS.equalStep;
        handleSettingChange('equalStep', { ...current, ...partial });
    };

    const updateCurved = (partial: Partial<CurvedGeometryConfig>) => {
        const current = globalSettings.curvedGeometry || DEFAULT_SETTINGS.curvedGeometry;
        handleSettingChange('curvedGeometry', { ...current, ...partial });
    };

    const setDisplayMode = (mode: 'lattice' | 'pitch-field' | 'h-chroma' | 'diamond') => {
        updateVisualSettings({ layoutMode: mode }, false);
    };

    const handleDiamondLimitChange = (limit: number, commit: boolean = true) => {
        updateVisualSettings({ diamondLimit: limit }, false, commit);
    };

    const setBranchOverride = (harmonic: number, partial: {
        enabled?: boolean;
        base?: number;
        lengthPos?: number;
        lengthNeg?: number;
    }) => {
        if (!harmonic) return;
        const overrides = { ...(globalSettings.visuals.hChromaBranchOverrides || {}) } as any;
        const current = overrides[harmonic] || {};
        overrides[harmonic] = { ...current, ...partial };
        updateVisualSettings({ hChromaBranchOverrides: overrides }, false);
    };

    const setBranchOverrideMode = (harmonic: number, mode: 'global' | 'override' | 'off') => {
        if (!harmonic) return;
        const overrides = { ...(globalSettings.visuals.hChromaBranchOverrides || {}) } as any;
        if (mode === 'global') {
            delete overrides[harmonic];
        } else if (mode === 'off') {
            overrides[harmonic] = { ...(overrides[harmonic] || {}), enabled: false };
        } else {
            const base = Number.isFinite(overrides[harmonic]?.base) ? overrides[harmonic].base : (globalSettings.visuals.hChromaBranchBase ?? 0);
            const lengthPos = Number.isFinite(overrides[harmonic]?.lengthPos) ? overrides[harmonic].lengthPos : (globalSettings.visuals.hChromaBranchLengthPos ?? 0);
            const lengthNeg = Number.isFinite(overrides[harmonic]?.lengthNeg) ? overrides[harmonic].lengthNeg : (globalSettings.visuals.hChromaBranchLengthNeg ?? 0);
            overrides[harmonic] = { enabled: true, base, lengthPos, lengthNeg };
        }
        updateVisualSettings({ hChromaBranchOverrides: overrides }, false);
    };

    const handleMathInput = (field: keyof EqualStepConfig, val: string) => {
        try {
            const f = parseGeneralRatio(val);
            const num = Number(f.n) / Number(f.d);
            if (isFinite(num) && num > 0) {
                updateEqualStep({ [field]: num });
            }
        } catch (e) { }
    };

    useEffect(() => {
        if (settings.rootLimits && settings.rootLimits.length > 0) {
            if (!settings.rootLimits.includes(targetGen0)) {
                setTargetGen0(settings.rootLimits[0]);
            }
        }
    }, [settings.rootLimits, targetGen0]);

    useEffect(() => {
        const maxPrime = settings.maxPrimeLimit;
        const configs = [
            { maxKey: 'gen1MaxPrimeLimit', primeKey: 'gen1PrimeSet' },
            { maxKey: 'gen2MaxPrimeLimit', primeKey: 'gen2PrimeSet' },
            { maxKey: 'gen3MaxPrimeLimit', primeKey: 'gen3PrimeSet' },
            { maxKey: 'gen4MaxPrimeLimit', primeKey: 'gen4PrimeSet' }
        ] as const;
        configs.forEach((cfg) => {
            const override = (settings as any)[cfg.maxKey] as PrimeLimit | undefined;
            const current = (settings as any)[cfg.primeKey] as PrimeLimit[] | undefined;
            if (current === undefined) return;
            const effective = Math.min(override ?? maxPrime, maxPrime) as PrimeLimit;
            const filtered = current.filter((p) => p <= effective);
            if (filtered.length !== current.length) {
                handleSettingChange(cfg.primeKey as any, filtered, true);
            }
        });
    }, [settings.maxPrimeLimit, settings.gen1MaxPrimeLimit, settings.gen2MaxPrimeLimit, settings.gen3MaxPrimeLimit, settings.gen4MaxPrimeLimit, settings.gen1PrimeSet, settings.gen2PrimeSet, settings.gen3PrimeSet, settings.gen4PrimeSet, handleSettingChange]);

    useEffect(() => {
        if (globalSettings.equalStep) {
            setEqBase(globalSettings.equalStep.base.toString());
            setEqDivs(globalSettings.equalStep.divisions.toString());
            setEqDelta(globalSettings.equalStep.deltaN.toString());
            setEqCircle(globalSettings.equalStep.stepsPerCircle.toString());
            setEqRange(globalSettings.equalStep.range.toString());
            setEqRadius(globalSettings.equalStep.radius.toString());
        }
    }, [globalSettings.equalStep?.base, globalSettings.equalStep?.divisions, globalSettings.equalStep?.deltaN, globalSettings.equalStep?.stepsPerCircle, globalSettings.equalStep?.range, globalSettings.equalStep?.radius, globalSettings.equalStep?.enabled]);

    const findLoops = (limit: PrimeLimit) => {
        const cents = 1200 * Math.log2(limit);
        const candidates = [];
        for (let L = 2; L <= 1500; L++) {
            let diff = Math.abs(L * cents) % 1200;
            diff = Math.min(diff, 1200 - diff);
            if (diff < settings.loopTolerance) {
                candidates.push({ length: L, diff });
            }
        }
        return candidates;
    };

    const sortLoops = (candidates: { length: number; diff: number }[]) => {
        const list = [...candidates];
        if (loopOrder === 'size') {
            list.sort((a, b) => a.length - b.length);
        } else {
            list.sort((a, b) => a.diff - b.diff);
        }
        return list;
    };

    const renderGen0LoopOptions = () => (
        <Gen0LoopOptionsPanel settings={settings} globalSettings={globalSettings} openLoopFinder={openLoopFinder} setOpenLoopFinder={setOpenLoopFinder} loopOrder={loopOrder} setLoopOrder={setLoopOrder} handleSettingChange={handleSettingChange} findLoops={findLoops} sortLoops={sortLoops} toggleAxisLoop={toggleAxisLoop} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />
    );

    const renderCommaSpreadingOptions = () => (
        <CommaSpreadingPanel settings={settings} globalSettings={globalSettings} allLimits={allLimits} spreadingCollapsed={spreadingCollapsed} setSpreadingCollapsed={setSpreadingCollapsed} handleSettingChange={handleSettingChange} />
    );

    const renderGen1LoopOptions = () => (
        <Gen1LoopOptionsPanel settings={settings} globalSettings={globalSettings} allLimits={allLimits} isGen1Custom={isGen1Custom} gen1Collapsed={gen1Collapsed} setGen1Collapsed={setGen1Collapsed} targetGen0={targetGen0} setTargetGen0={setTargetGen0} openLoopFinder={openLoopFinder} setOpenLoopFinder={setOpenLoopFinder} loopOrder={loopOrder} setLoopOrder={setLoopOrder} handleSettingChange={handleSettingChange} findLoops={findLoops} sortLoops={sortLoops} toggleAxisLoop={toggleAxisLoop} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />
    );

    if (!isSpecialLayout && globalSettings.spiral?.enabled) {
        return (<SpiralModePanel globalSettings={globalSettings} updateSpiral={updateSpiral} resetLatticeConfig={resetLatticeConfig} />);
    }
    if (!isSpecialLayout && globalSettings.geometry?.enabled) {
        return (<GeometryModePanel globalSettings={globalSettings} updateGeometry={updateGeometry} resetLatticeConfig={resetLatticeConfig} />);
    }
    if (!isSpecialLayout && globalSettings.equalStep?.enabled) {
        return (<EqualStepPanel globalSettings={globalSettings} updateEqualStep={updateEqualStep} resetLatticeConfig={resetLatticeConfig} eqBase={eqBase} setEqBase={setEqBase} eqDivs={eqDivs} setEqDivs={setEqDivs} eqDelta={eqDelta} setEqDelta={setEqDelta} eqCircle={eqCircle} setEqCircle={setEqCircle} eqRange={eqRange} setEqRange={setEqRange} eqRadius={eqRadius} setEqRadius={setEqRadius} handleMathInput={handleMathInput} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />);
    }

    return (
        <div className="space-y-4">
            {isGlobal && (
                <div className="space-y-2">
                    <DisplayModePanel globalSettings={globalSettings} setDisplayMode={setDisplayMode} updateVisualSettings={updateVisualSettings} handleDiamondLimitChange={handleDiamondLimitChange} setBranchOverride={setBranchOverride} setBranchOverrideMode={setBranchOverrideMode} hChromaBranchSelected={hChromaBranchSelected} hChromaBranchSelectedHarmonic={hChromaBranchSelectedHarmonic} hChromaSelectedMode={hChromaSelectedMode} hChromaSelectedOverride={hChromaSelectedOverride} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />
                    {!isSpecialLayout && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    updateCurved({ enabled: false });
                                    updateSpiral({ enabled: true });
                                }}
                                className="p-2 bg-indigo-900/20 border border-indigo-800 rounded flex items-center justify-between text-left hover:border-indigo-500 transition-colors"
                                aria-pressed={spiralEnabled}
                            >
                                <span className="text-[9px] text-indigo-300 font-bold">Spiral Generator</span>
                                {spiralEnabled && <span className="text-[9px] font-bold text-green-200">ON</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    updateCurved({ enabled: false });
                                    updateGeometry({ enabled: true });
                                }}
                                className="p-2 bg-indigo-900/20 border border-indigo-800 rounded flex items-center justify-between text-left hover:border-indigo-500 transition-colors"
                                aria-pressed={geometryEnabled}
                            >
                                <span className="text-[9px] text-indigo-300 font-bold">3D Shape</span>
                                {geometryEnabled && <span className="text-[9px] font-bold text-indigo-200">ON</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    updateCurved({ enabled: false });
                                    updateEqualStep({ enabled: true });
                                }}
                                className="p-2 bg-blue-900/20 border border-blue-800 rounded flex items-center justify-between text-left hover:border-blue-500 transition-colors"
                                aria-pressed={!!globalSettings.equalStep?.enabled}
                            >
                                <span className="text-[9px] text-blue-300 font-bold">Equal Steps/Division</span>
                                {!!globalSettings.equalStep?.enabled && <span className="text-[9px] font-bold text-blue-200">ON</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const next = !curvedEnabled;
                                    if (next) {
                                        updateSpiral({ enabled: false });
                                        updateGeometry({ enabled: false });
                                        updateEqualStep({ enabled: false });
                                    }
                                    updateCurved({ enabled: next });
                                }}
                                className="p-2 bg-emerald-900/20 border border-emerald-800 rounded flex items-center justify-between text-left hover:border-emerald-500 transition-colors"
                                aria-pressed={curvedEnabled}
                            >
                                <span className="text-[9px] text-emerald-300 font-bold">Curved Geometry</span>
                                {curvedEnabled && <span className="text-[9px] font-bold text-emerald-200">ON</span>}
                            </button>
                        </div>
                    )}
                </div>
            )}
            {!isSpecialLayout && (
                <>
                    {isGlobal && curvedEnabled && (
                        <CurvedGeometryPanel
                            globalSettings={globalSettings}
                            updateCurved={updateCurved}
                            resetLatticeConfig={resetLatticeConfig}
                        />
                    )}
                    <OriginalAxisRootsPanel settings={settings} globalSettings={globalSettings} resetLatticeConfig={resetLatticeConfig} toggleRootLimit={toggleRootLimit} handleSettingChange={handleSettingChange} allLimits={allLimits} customPrimeInput={customPrimeInput} setCustomPrimeInput={setCustomPrimeInput} renderGen0LoopOptions={renderGen0LoopOptions} renderCommaSpreadingOptions={renderCommaSpreadingOptions} isGlobal={isGlobal} />
                    {renderGen1LoopOptions()}
                    <BranchLimitsPanel settings={settings} globalSettings={globalSettings} allLimits={allLimits} isGlobal={isGlobal} perGenCollapsed={perGenCollapsed} setPerGenCollapsed={setPerGenCollapsed} handleSettingChange={handleSettingChange} />
                </>
            )}
            {!isSpecialLayout && (
                <>
                    <ExpansionDistancePanel settings={settings} handleSettingChange={handleSettingChange} isGen1Custom={isGen1Custom} isGen2Custom={isGen2Custom} onInteractionStart={onInteractionStart} onInteractionEnd={onInteractionEnd} />
                    <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-amber-300 uppercase tracking-widest">
                                Info Panel Additions ({nodeOverrideEntries.length})
                            </h3>
                            <button
                                onClick={() => setNodeOverridesCollapsed(v => !v)}
                                className="text-[9px] text-amber-300 hover:text-white"
                            >
                                {nodeOverridesCollapsed ? 'Show' : 'Hide'}
                            </button>
                        </div>
                        {!nodeOverridesCollapsed && (
                            <div className="mt-2 space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                                {nodeOverrideEntries.length === 0 && (
                                    <div className="text-[9px] text-gray-500 italic">No node overrides yet.</div>
                                )}
                                {nodeOverrideEntries.map((entry) => {
                                    const basePos = Number.isFinite(entry.override?.pos) ? entry.override.pos : 0;
                                    const baseNeg = Number.isFinite(entry.override?.neg) ? entry.override.neg : 0;
                                    return (
                                        <div key={entry.nodeId} className="bg-black/40 border border-gray-800 rounded p-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] text-gray-200 font-bold truncate" title={entry.nodeId}>
                                                    {entry.name}
                                                </span>
                                                <span className="text-[9px] text-gray-400 font-mono shrink-0">-{baseNeg} / +{basePos}</span>
                                            </div>
                                            {entry.axisOverrides.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {entry.axisOverrides.map((axis) => {
                                                        const isOdd = axis.limit > 2 && !isPrime(axis.limit);
                                                        const label = `${isOdd ? 'Odd ' : ''}${axis.limit}L`;
                                                        return (
                                                            <span
                                                                key={`${entry.nodeId}-${axis.limit}`}
                                                                className="px-1.5 py-0.5 text-[9px] text-gray-300 bg-gray-900 border border-gray-700 rounded"
                                                            >
                                                                {label} -{axis.neg}/+{axis.pos}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {isGlobal && (
                            <BranchHotkeyPanel
                                settings={globalSettings}
                                globalSettings={globalSettings}
                                handleSettingChange={handleSettingChange}
                            />
                        )}
                        <SimplificationPanel
                            globalSettings={globalSettings}
                            handleSettingChange={handleSettingChange}
                            movePriority={movePriority}
                            onInteractionStart={onInteractionStart}
                            onInteractionEnd={onInteractionEnd}
                        />
                    </div>
                </>
            )}

            {(globalSettings.maskedNodeIds && globalSettings.maskedNodeIds.length > 0) && (
                <div className="p-3 bg-red-900/10 border border-red-900/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                            Masked Nodes ({globalSettings.maskedNodeIds.length})
                        </h3>
                        <button
                            onClick={() => unmaskAllNodes()}
                            className="text-[9px] bg-red-900/30 hover:bg-red-800 text-red-200 border border-red-800 px-2 py-1 rounded font-black uppercase"
                        >
                            Restore All
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                        {globalSettings.maskedNodeIds.map((id: string) => (
                            <div key={id} className="flex items-center gap-2 bg-black/40 border border-red-900/30 rounded px-2 py-1">
                                <span className="text-[9px] text-gray-400 font-mono">{id}</span>
                                <button
                                    onClick={() => unmaskNode(id)}
                                    className="text-[10px] text-red-400 hover:text-white font-black"
                                    title="Restore"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="text-[10px] text-gray-500 font-mono uppercase">Predicted Count: {predictedCount.toLocaleString()}</div>
        </div>
    );
};
