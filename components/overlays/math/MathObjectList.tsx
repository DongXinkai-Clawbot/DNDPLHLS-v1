import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { MathObject, ConsequentialScaleConfig, VariableDef, MathSamplingSettings } from '../../../types';
import { evalScalarWithComplex, evalVector, buildMathContext, preprocessExpression } from '../../../utils/math/unifiedEvaluator';
import { extractVariables, getBindingsSubset } from '../../../utils/mathVariableUtils';
import { sampleObject } from '../../../utils/mathLabUtils';
import { notifyWarning } from '../../../utils/notifications';
import { MathExpressionInput } from '../../common/MathExpressionInput';

const COLOR_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#14b8a6', '#f97316', '#ec4899'];

const BufferedInput = ({ value, onChange, className, disabled }: { value: number, onChange: (v: number) => void, className?: string, disabled?: boolean }) => {
    const [temp, setTemp] = useState<string | null>(null);
    useEffect(() => setTemp(null), [value]);
    return (
        <input 
            className={className}
            value={temp !== null ? temp : value}
            onChange={(e) => {
                if (disabled) return;
                setTemp(e.target.value);
                const n = parseFloat(e.target.value);
                if (!isNaN(n) && !e.target.value.endsWith('.')) onChange(n);
            }}
            onBlur={() => setTemp(null)}
            disabled={disabled}
        />
    );
};

const buildValidation = (obj: MathObject, bindings: Record<string, number>, complexComponent: 're' | 'im' | 'abs' | 'arg' = 'abs') => {
    try {
        const expr = preprocessExpression(obj.expression, true).processed;
        if (obj.type === 'vector_field') {
            const ctx = buildMathContext({ ...bindings, x: 0, y: 0 });
            const res = evalVector(expr, ctx, complexComponent);
            return res.isValid ? { status: 'valid' as const } : { status: 'invalid' as const, message: res.error || 'Invalid vector field' };
        }
        if (obj.type === 'parametric') {
            const ctx = buildMathContext({ ...bindings, t: 0 });
            const res = evalVector(expr, ctx, complexComponent);
            return res.isValid ? { status: 'valid' as const } : { status: 'invalid' as const, message: res.error || 'Invalid vector' };
        }
        if (obj.type === 'polar') {
            const ctx = buildMathContext({ ...bindings, theta: 0 });
            const res = evalScalarWithComplex(expr, ctx, complexComponent);
            return res.isValid ? { status: 'valid' as const } : { status: 'invalid' as const, message: res.error || 'Invalid scalar' };
        }
        if (obj.type === 'implicit') {
            const ctx = buildMathContext({ ...bindings, x: 0, y: 0 });
            const res = evalScalarWithComplex(expr, ctx, complexComponent);
            return res.isValid ? { status: 'valid' as const } : { status: 'invalid' as const, message: res.error || 'Invalid implicit' };
        }
        const ctx = buildMathContext({ ...bindings, x: 0 });
        const res = evalScalarWithComplex(expr, ctx, complexComponent);
        return res.isValid ? { status: 'valid' as const } : { status: 'invalid' as const, message: res.error || 'Invalid expression' };
    } catch (e: any) {
        return { status: 'invalid' as const, message: e?.message || 'Eval error' };
    }
};

export const MathObjectList = ({ onExportToConsequential }: { onExportToConsequential: (config: ConsequentialScaleConfig) => void }) => {
    const {
      mathLab,
      updateMathObject,
      removeMathObject,
      setMathObjects
    } = useStore((s) => ({
      mathLab: s.mathLab,
      updateMathObject: s.updateMathObject,
      removeMathObject: s.removeMathObject,
      setMathObjects: s.setMathObjects
    }), shallow);
    const objects = mathLab.objects || [];
    const noteSets = mathLab.noteSets || [];
    const activeNoteSetId = mathLab.activeNoteSetId;
    const activeNoteSet = noteSets.find(n => n.id === activeNoteSetId);
    const sampling = (activeNoteSet?.mapping || mathLab.sampling) as MathSamplingSettings;

    const [filterVisibleOnly, setFilterVisibleOnly] = useState(false);
    const [filterMappingOnly, setFilterMappingOnly] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const [dragId, setDragId] = useState<string | null>(null);
    const [groupMode, setGroupMode] = useState<'group' | 'tag'>('group');
    const [validation, setValidation] = useState<Record<string, { status: 'valid' | 'invalid'; message?: string }>>({});

    const bindings = mathLab.unifiedFunctionState?.variableBindings || {};
    const variableDefs = mathLab.unifiedFunctionState?.variableDefs || {};

    const orderedObjects = useMemo(() => {
        const list = [...objects];
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return list;
    }, [objects]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const next: Record<string, { status: 'valid' | 'invalid'; message?: string }> = {};
            orderedObjects.forEach((obj) => {
                next[obj.id] = buildValidation(obj, bindings, sampling.complexComponent || 'abs');
            });
            setValidation(next);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [orderedObjects, bindings, sampling.complexComponent]);

    const filtered = useMemo(() => {
        return orderedObjects.filter((obj) => {
            if (filterVisibleOnly && !obj.visible) return false;
            if (filterMappingOnly && !obj.mappingEnabled) return false;
            return true;
        });
    }, [orderedObjects, filterVisibleOnly, filterMappingOnly]);

    const grouped = useMemo(() => {
        const map = new Map<string, MathObject[]>();
        filtered.forEach((obj) => {
            const group = groupMode === 'tag'
                ? (obj.tags && obj.tags.length > 0 ? obj.tags[0] : 'untagged')
                : (obj.group || 'default');
            if (!map.has(group)) map.set(group, []);
            map.get(group)!.push(obj);
        });
        return Array.from(map.entries());
    }, [filtered, groupMode]);

    const implicitStats = useMemo(() => {
        const stats: Record<string, { segments: number }> = {};
        const sampling = (activeNoteSet?.mapping || mathLab.sampling) as MathSamplingSettings;
        const view = mathLab.view;
        orderedObjects.forEach((obj) => {
            if (obj.type !== 'implicit') return;
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const baseCount = override?.sampleCount || sampling.sampleCount || 200;
            const implicitFallback = sampling.implicitResolution || Math.round(Math.sqrt(baseCount));
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution ? obj.implicitResolution : implicitFallback;
            const res = sampleObject(obj, baseCount, view, {
                strategy: override?.strategy || sampling.strategy,
                complexComponent: sampling.complexComponent,
                implicitResolution: implicitBase
            });
            stats[obj.id] = { segments: res.segments?.length || 0 };
        });
        return stats;
    }, [orderedObjects, activeNoteSet?.mapping, mathLab.sampling, mathLab.view]);

    const diagnostics = useMemo(() => {
        const diag: Record<string, { invalidRatio: number; complexRatio: number }> = {};
        const view = mathLab.view;
        const baseCount = Math.min(80, sampling.sampleCount || 80);
        orderedObjects.forEach((obj) => {
            if (obj.type === 'vector_field') return;
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const objCount = Math.min(80, override?.sampleCount || baseCount);
            const objStrategy = override?.strategy || sampling.strategy;
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution
                ? obj.implicitResolution
                : (sampling.implicitResolution || Math.round(Math.sqrt(objCount)));
            const res = sampleObject(obj, objCount, view, {
                bindings: objBindings,
                complexComponent: sampling.complexComponent,
                implicitResolution: implicitBase,
                strategy: objStrategy
            });
            const total = Math.max(1, res.meta.validCount + res.meta.invalidCount);
            diag[obj.id] = {
                invalidRatio: res.meta.invalidCount / total,
                complexRatio: res.meta.complexCount / total
            };
        });
        return diag;
    }, [orderedObjects, sampling.sampleCount, sampling.strategy, sampling.complexComponent, sampling.implicitResolution, bindings, mathLab.view]);

    const handleExport = (obj: MathObject) => {
        const vars: VariableDef[] = [];
        let primaryVar = 'x'; 

        if (obj.type === 'explicit' || obj.type === 'implicit') {
            primaryVar = 'x';
            vars.push({ name: 'x', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
        } else if (obj.type === 'parametric') {
            primaryVar = 't';
            vars.push({ name: 't', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
        } else if (obj.type === 'polar') {
            primaryVar = 'theta';
            vars.push({ name: 'theta', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
        }

        const sampling = (activeNoteSet?.mapping || mathLab.sampling) as MathSamplingSettings;
        const extracted = extractVariables(obj.expression, obj.type);
        extracted.forEach((k) => {
            if (k === primaryVar) return;
            const val = bindings[k] ?? 1;
            const def = variableDefs[k];
            vars.push({
                name: k,
                value: val,
                min: def?.min ?? val - 10,
                max: def?.max ?? val + 10,
                step: def?.step ?? 0.1,
                role: 'parameter'
            });
        });

        const quantizeMode = sampling.quantize === 'edo'
            ? 'edo'
            : (sampling.quantize === 'prime_limit_fraction' ? 'prime_limit_fraction' : 'none');
        if (sampling.quantize === 'cents_step') {
            notifyWarning('Cents-step quantize is not supported in Consequential. Exported as none.', 'Math Lab');
        }

        const shortCode = Date.now().toString(36).slice(-4);
        const config: ConsequentialScaleConfig = {
            id: `cs-import-${obj.id}`,
            name: `${obj.name || obj.expression.slice(0, 12)}-${shortCode}`,
            expressionRaw: obj.expression,
            mode: 'Custom',
            advancedSymbols: false,
            importedType: obj.type, 
            mappingMode: obj.type === 'parametric' ? 'parametric_y' : (obj.type === 'polar' ? 'polar_r' : 'scalar_ratio'),
            domain: {
                nStart: 1, nEnd: 10, nStep: 1,
                iStart: 0, iEnd: 0, iStep: 1,
                varyMode: 'FixI_VaryN',
                variables: vars
            },
            mapping: {
                baseFreq: sampling.baseFreq || 261.63,
                normalizeToOctave: sampling.normalizeToOctave ?? true,
                quantizeMode,
                primeLimit: sampling.primeLimit || 11,
                edoDivisions: sampling.edoDivisions,
                centsStep: sampling.centsStep
            },
            display: {
                showOutOfRange: true,
                graphEnabled: true,
                xAxis: primaryVar, 
                yAxis: 'Cents'
            },
            playback: {
                chordNoteCount: 8,
                spreadOctaves: 2,
                minSpacingCents: 70,
                strategy: 'stack'
            }
        };
        
        onExportToConsequential(config);
    };

    const cycleColor = (obj: MathObject) => {
        const idx = COLOR_PALETTE.indexOf(obj.color);
        const next = COLOR_PALETTE[(idx + 1) % COLOR_PALETTE.length];
        updateMathObject(obj.id, { color: next });
    };

    const applyColor = (obj: MathObject, color: string) => {
        updateMathObject(obj.id, { color });
    };

    const handleDrop = (targetId: string) => {
        if (!dragId || dragId === targetId) return;
        const list = [...orderedObjects];
        const from = list.findIndex(o => o.id === dragId);
        const to = list.findIndex(o => o.id === targetId);
        if (from < 0 || to < 0) return;
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
        const next = list.map((o, idx) => ({ ...o, order: idx }));
        setMathObjects(next);
        setDragId(null);
    };

    const applyRangePreset = (obj: MathObject, min: number, max: number) => {
        updateMathObject(obj.id, { params: { ...obj.params, min, max } });
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-gray-900/30">
            <div className="flex items-center gap-2 text-[9px] text-gray-400">
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={filterVisibleOnly} onChange={(e) => setFilterVisibleOnly(e.target.checked)} className="accent-blue-500" />
                    Visible
                </label>
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={filterMappingOnly} onChange={(e) => setFilterMappingOnly(e.target.checked)} className="accent-blue-500" />
                    Mapping
                </label>
                <select
                    value={groupMode}
                    onChange={(e) => setGroupMode(e.target.value as any)}
                    className="bg-black text-[9px] text-white rounded px-1"
                    title="Group by"
                >
                    <option value="group">Group</option>
                    <option value="tag">Tag</option>
                </select>
            </div>

            {grouped.length === 0 && <div className="text-gray-500 text-xs italic text-center py-4">No functions added.</div>}

            {grouped.map(([group, items]) => {
                const groupKey = `${groupMode}:${group}`;
                return (
                <div key={groupKey} className="space-y-1">
                    <button
                        className="w-full flex justify-between items-center text-[9px] uppercase font-bold text-gray-400 bg-black/40 border border-gray-800 px-2 py-1 rounded"
                        onClick={() => setCollapsedGroups((s) => ({ ...s, [groupKey]: !s[groupKey] }))}
                    >
                        <span>{group}</span>
                        <span>{collapsedGroups[groupKey] ? 'Show' : 'Hide'} ({items.length})</span>
                    </button>
                    {!collapsedGroups[groupKey] && items.map(obj => {
                        const validationState = validation[obj.id];
                        const isLocked = obj.locked;
                        const canExport = obj.type !== 'vector_field';
                        return (
                            <div
                                key={obj.id}
                                draggable
                                onDragStart={() => setDragId(obj.id)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(obj.id)}
                                className={`flex flex-col bg-gray-800/80 p-2 rounded border border-gray-700 hover:border-gray-500 ${!obj.visible ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] text-gray-500 cursor-move">::</span>
                                    <button onClick={() => updateMathObject(obj.id, { visible: !obj.visible })} className="text-xs w-5 text-center text-gray-400 hover:text-white">
                                        {obj.visible ? 'ON' : 'OFF'}
                                    </button>
                                    <button onClick={() => cycleColor(obj)} className="w-3 h-3 rounded-full border border-gray-600" style={{ backgroundColor: obj.color }} title="Cycle color" disabled={isLocked}></button>
                                    <input
                                        className="bg-transparent text-[10px] font-bold text-white outline-none border-b border-gray-700 flex-1"
                                        value={obj.name || ''}
                                        onChange={(e) => updateMathObject(obj.id, { name: e.target.value })}
                                        placeholder="Name"
                                        disabled={isLocked}
                                    />
                                    <button onClick={() => updateMathObject(obj.id, { locked: !obj.locked })} className={`text-[9px] px-1 rounded border ${isLocked ? 'border-yellow-500 text-yellow-400' : 'border-gray-700 text-gray-400'}`}>
                                        {isLocked ? 'Locked' : 'Lock'}
                                    </button>
                                    <button onClick={() => removeMathObject(obj.id)} className="text-red-500 hover:text-red-300 text-xs px-1 font-bold">X</button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <MathExpressionInput
                                        value={obj.expression}
                                        onChange={(next) => updateMathObject(obj.id, { expression: next })}
                                        placeholder="Expression..."
                                        disabled={isLocked}
                                        className="flex-1 bg-transparent text-xs font-mono outline-none text-white truncate font-bold"
                                        // The grapher supports advanced symbols via preprocessing in the evaluator.
                                        symbolTriggerLabel="∑"
                                    />
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] text-gray-500 uppercase">Group</span>
                                    <input
                                        className="bg-transparent text-[9px] text-gray-300 border-b border-gray-700 outline-none flex-1"
                                        value={obj.group || 'default'}
                                        onChange={(e) => updateMathObject(obj.id, { group: e.target.value })}
                                        disabled={isLocked}
                                    />
                                </div>
                                <div className="flex items-center gap-1 mt-1 pl-7">
                                    <span className="text-[8px] text-gray-500 uppercase mr-1">Color</span>
                                    {COLOR_PALETTE.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => applyColor(obj, c)}
                                            className={`w-3 h-3 rounded-full border ${obj.color === c ? 'border-white' : 'border-gray-600'}`}
                                            style={{ backgroundColor: c }}
                                            title={c}
                                            disabled={isLocked}
                                        />
                                    ))}
                                </div>

                                <div className="flex justify-between items-center pl-7 mt-1">
                                    <div className="flex gap-1 items-center">
                                        <span className="text-[8px] text-gray-500 uppercase font-bold mr-1">{obj.type}</span>
                                        {(obj.type === 'explicit' || obj.type === 'parametric' || obj.type === 'polar') && (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[8px] text-gray-500">[</span>
                                                <BufferedInput 
                                                    className="w-8 bg-black/50 text-[9px] text-center border border-gray-600 rounded text-gray-300 p-0.5"
                                                    value={obj.params.min}
                                                    onChange={(v) => updateMathObject(obj.id, { params: { ...obj.params, min: v } })}
                                                    disabled={isLocked}
                                                />
                                                <span className="text-[8px] text-gray-500">,</span>
                                                <BufferedInput 
                                                    className="w-8 bg-black/50 text-[9px] text-center border border-gray-600 rounded text-gray-300 p-0.5"
                                                    value={obj.params.max}
                                                    onChange={(v) => updateMathObject(obj.id, { params: { ...obj.params, max: v } })}
                                                    disabled={isLocked}
                                                />
                                                <span className="text-[8px] text-gray-500">]</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <input 
                                            type="checkbox" 
                                            checked={obj.mappingEnabled} 
                                            onChange={(e) => updateMathObject(obj.id, { mappingEnabled: e.target.checked })} 
                                            title="Use for Audio" 
                                            className="accent-blue-500 w-3 h-3" 
                                            disabled={isLocked}
                                        />
                                        <button 
                                            onClick={() => canExport && handleExport(obj)} 
                                            className={`text-[9px] px-2 py-0.5 rounded ml-1 border ${canExport ? 'bg-blue-900/50 hover:bg-blue-800 text-blue-200 border-blue-700' : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'}`}
                                            title={canExport ? "Use in Consequential Scale Builder" : "Vector fields cannot export as scales"}
                                            disabled={!canExport}
                                        >
                                            To Scale
                                        </button>
                                    </div>
                                </div>
                                {(obj.type === 'parametric' || obj.type === 'polar') && (
                                    <div className="flex items-center gap-1 pl-7 mt-1 text-[8px] text-gray-400">
                                        <span className="uppercase">{obj.type === 'polar' ? 'theta' : 't'}</span>
                                        {obj.type === 'parametric' && (
                                            <>
                                                <button
                                                    onClick={() => applyRangePreset(obj, 0, 1)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="0 to 1"
                                                >
                                                    0-1
                                                </button>
                                                <button
                                                    onClick={() => applyRangePreset(obj, -1, 1)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="-1 to 1"
                                                >
                                                    ±1
                                                </button>
                                            </>
                                        )}
                                        {obj.angleUnit === 'deg' ? (
                                            <>
                                                <button
                                                    onClick={() => applyRangePreset(obj, 0, 360)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="0 to 360°"
                                                >
                                                    0-360
                                                </button>
                                                <button
                                                    onClick={() => applyRangePreset(obj, 0, 720)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="0 to 720°"
                                                >
                                                    0-720
                                                </button>
                                                <button
                                                    onClick={() => applyRangePreset(obj, -180, 180)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="-180° to 180°"
                                                >
                                                    ±180
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => applyRangePreset(obj, 0, Math.PI * 2)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="0 to 2π"
                                                >
                                                    0-2π
                                                </button>
                                                <button
                                                    onClick={() => applyRangePreset(obj, 0, Math.PI * 4)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="0 to 4π"
                                                >
                                                    0-4π
                                                </button>
                                                <button
                                                    onClick={() => applyRangePreset(obj, -Math.PI, Math.PI)}
                                                    className="px-1 rounded border border-gray-700 hover:border-gray-500"
                                                    disabled={isLocked}
                                                    title="-π to π"
                                                >
                                                    ±π
                                                </button>
                                            </>
                                        )}
                                        {obj.type === 'polar' && (
                                            <>
                                                <span className="ml-2 text-gray-500">unit</span>
                                                <select
                                                    value={obj.angleUnit || 'rad'}
                                                    onChange={(e) => updateMathObject(obj.id, { angleUnit: e.target.value as any })}
                                                    className="bg-black text-[8px] text-white rounded"
                                                    disabled={isLocked}
                                                >
                                                    <option value="rad">rad</option>
                                                    <option value="deg">deg</option>
                                                </select>
                                                <span className="ml-2 text-gray-500">r</span>
                                                <select
                                                    value={obj.polarNegativeMode || 'allow'}
                                                    onChange={(e) => updateMathObject(obj.id, { polarNegativeMode: e.target.value as any })}
                                                    className="bg-black text-[8px] text-white rounded"
                                                    disabled={isLocked}
                                                >
                                                    <option value="allow">±</option>
                                                    <option value="clamp">clamp</option>
                                                </select>
                                            </>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pl-7 mt-1 text-[8px] text-gray-400">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!obj.samplingOverride?.enabled}
                                            onChange={(e) => updateMathObject(obj.id, { samplingOverride: { ...obj.samplingOverride, enabled: e.target.checked } })}
                                            className="accent-blue-500 w-3 h-3"
                                            disabled={isLocked}
                                        />
                                        Override Sampling
                                    </label>
                                    {obj.samplingOverride?.enabled && (
                                        <>
                                            <input
                                                type="number"
                                                className="w-12 bg-black/50 text-[8px] text-center border border-gray-600 rounded text-gray-300 p-0.5"
                                                value={obj.samplingOverride.sampleCount ?? sampling.sampleCount}
                                                onChange={(e) => updateMathObject(obj.id, { samplingOverride: { ...obj.samplingOverride, sampleCount: parseInt(e.target.value) } })}
                                                disabled={isLocked}
                                            />
                                            <select
                                                value={obj.samplingOverride.strategy ?? sampling.strategy}
                                                onChange={(e) => updateMathObject(obj.id, { samplingOverride: { ...obj.samplingOverride, strategy: e.target.value as any } })}
                                                className="bg-black text-[8px] text-white rounded"
                                                disabled={isLocked}
                                            >
                                                <option value="uniform_x">X</option>
                                                <option value="uniform_param">Param</option>
                                                <option value="arc_length">Arc</option>
                                                <option value="adaptive_pixel">Pixel</option>
                                                <option value="adaptive_curvature">Curve</option>
                                            </select>
                                        </>
                                    )}
                                </div>

                                {obj.type === 'implicit' && (
                                    <div className="mt-1 text-[9px] text-gray-400 flex items-center gap-2">
                                        <span>Resolution</span>
                                        <select
                                            value={obj.implicitResolutionMode || 'auto'}
                                            onChange={(e) => updateMathObject(obj.id, { implicitResolutionMode: e.target.value as any })}
                                            className="bg-black text-[9px] text-white rounded"
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="manual">Manual</option>
                                        </select>
                                        {obj.implicitResolutionMode === 'manual' && (
                                            <input
                                                type="range"
                                                min={20}
                                                max={200}
                                                value={obj.implicitResolution || 60}
                                                onChange={(e) => updateMathObject(obj.id, { implicitResolution: parseInt(e.target.value) })}
                                            />
                                        )}
                                        <span className="text-gray-500">Segments: {implicitStats[obj.id]?.segments ?? 0}</span>
                                        <label className="flex items-center gap-1 text-gray-500">
                                            <input
                                                type="checkbox"
                                                checked={obj.implicitShowAll ?? true}
                                                onChange={(e) => updateMathObject(obj.id, { implicitShowAll: e.target.checked })}
                                                className="accent-blue-500 w-3 h-3"
                                                disabled={isLocked}
                                            />
                                            All
                                        </label>
                                    </div>
                                )}

                                {validationState && (
                                    <div className={`mt-1 text-[9px] ${validationState.status === 'valid' ? 'text-green-400' : 'text-red-400'}`}>
                                        {validationState.status === 'valid' ? 'Valid' : `Invalid: ${validationState.message}`}
                                    </div>
                                )}
                                {diagnostics[obj.id] && diagnostics[obj.id].invalidRatio >= 0.15 && (
                                    <div className="text-[9px] text-yellow-400">
                                        {Math.round(diagnostics[obj.id].invalidRatio * 100)}% invalid samples
                                    </div>
                                )}
                                {diagnostics[obj.id] && diagnostics[obj.id].complexRatio >= 0.25 && (
                                    <div className="text-[9px] text-purple-300">
                                        Complex-heavy ({Math.round(diagnostics[obj.id].complexRatio * 100)}%)
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )})}
        </div>
    );
};
