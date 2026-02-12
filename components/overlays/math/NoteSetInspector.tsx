
import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { MathNoteSet } from '../../../types';
import { computeDotPitch } from '../../../utils/mathDotPitch';
import { startNote } from '../../../audioEngine';
import { notifySuccess } from '../../../utils/notifications';
import { extractVariables, getBindingsSubset } from '../../../utils/mathVariableUtils';
import { sampleObject, resamplePolylinesByArcLength } from '../../../utils/mathLabUtils';

const DEFAULT_NOTE_SET: MathNoteSet = {
    id: 'ns-default', name: 'New Set', 
    createdAt: new Date().toISOString(), 
    updatedAt: new Date().toISOString(),
    dots: [],
    mapping: {
        sampleCount: 300,
        strategy: 'uniform_param',
        mappingMode: 'y_cents', baseFreq: 440,
        boundedRange: { min: 220, max: 880 },
        rangeMin: 20, rangeMax: 20000,
        quantize: 'none', normalizeToOctave: false,
        complexComponent: 'abs',
        primeLimit: 11,
        invalidPolicy: 'break',
        implicitResolution: undefined
    },
    playback: {
        mode: 'scale',
        order: 'x',
        speedUnit: 'bpm',
        bpm: 120,
        gate: 0.8,
        noteMs: 300,
        chordMs: 2000,
        gapMs: 200
    },
    export: {
        order: 'x',
        dedupe: true,
        normalizeToOctave: true
    }
};

export const NoteSetInspector = () => {
    const {
      mathLab,
      addMathNoteSet,
      updateMathNoteSet,
      removeMathNoteSet,
      setActiveMathNoteSet,
      setMathSampling,
      setMathUnifiedFunctionState,
      setMathEditorState,
      setCustomKeyboard,
      settings
    } = useStore((s) => ({
      mathLab: s.mathLab,
      addMathNoteSet: s.addMathNoteSet,
      updateMathNoteSet: s.updateMathNoteSet,
      removeMathNoteSet: s.removeMathNoteSet,
      setActiveMathNoteSet: s.setActiveMathNoteSet,
      setMathSampling: s.setMathSampling,
      setMathUnifiedFunctionState: s.setMathUnifiedFunctionState,
      setMathEditorState: s.setMathEditorState,
      setCustomKeyboard: s.setCustomKeyboard,
      settings: s.settings
    }), shallow);
    const noteSets = mathLab?.noteSets || [];
    const activeNoteSetId = mathLab?.activeNoteSetId;
    const view = mathLab?.view || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    const globalSampling = mathLab?.sampling;
    const objects = mathLab?.objects || [];
    const selectedObjectId = mathLab?.editor?.selectedObjectId;
    const selectedObject = objects.find(o => o.id === selectedObjectId);
    const bindings = mathLab?.unifiedFunctionState?.variableBindings || {};
    const variableDefs = mathLab?.unifiedFunctionState?.variableDefs || {};
    const snapThresholdPx = mathLab?.editor?.snapThresholdPx ?? 14;
    const snapThresholdMath = mathLab?.editor?.snapThresholdMath ?? 0.25;

    const activeSet = noteSets.find(n => n.id === activeNoteSetId);

    const variableNames = useMemo(() => {
        const src = selectedObject ? [selectedObject] : objects;
        const set = new Set<string>();
        src.forEach(obj => {
            extractVariables(obj.expression, obj.type).forEach(v => set.add(v));
        });
        return Array.from(set).sort();
    }, [objects, selectedObjectId]);

    const hasComplexOutputs = useMemo(() => {
        if (!activeSet) return false;
        const sampling = activeSet.mapping;
        const sampleCount = Math.min(48, sampling.sampleCount || 48);
        const implicitFallback = sampling.implicitResolution || Math.round(Math.sqrt(sampleCount));
        return objects.some((obj) => {
            if (!obj.visible || obj.type === 'vector_field') return false;
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution
                ? obj.implicitResolution
                : implicitFallback;
            const res = sampleObject(obj, sampleCount, view, {
                bindings: objBindings,
                complexComponent: sampling.complexComponent || 'abs',
                implicitResolution: implicitBase,
                strategy: sampling.strategy
            });
            return res.meta.complexCount > 0;
        });
    }, [activeSet?.mapping, objects, bindings, view]);
    
    const voicesRef = useRef<(() => void)[]>([]);
    const timeoutsRef = useRef<number[]>([]);
    const [dotFilter, setDotFilter] = useState<'all' | 'scale' | 'chord' | 'marker' | 'ignore' | 'invalid'>('all');
    const [dotGenMode, setDotGenMode] = useState<'replace' | 'append'>('replace');
    const [dotGenSource, setDotGenSource] = useState<'selected' | 'visible' | 'mapping' | 'group'>('mapping');
    const [dotGenGroup, setDotGenGroup] = useState('default');

    const clearScheduled = () => {
        timeoutsRef.current.forEach(id => window.clearTimeout(id));
        timeoutsRef.current = [];
    };

    const stopSet = () => {
        clearScheduled();
        voicesRef.current.forEach(f => f());
        voicesRef.current = [];
    };

    useEffect(() => {
        return () => {
            
            stopSet();
        };
    }, []);

    useEffect(() => {
        const handler = () => stopSet();
        window.addEventListener('mathlab-stop-playback', handler as EventListener);
        return () => window.removeEventListener('mathlab-stop-playback', handler as EventListener);
    }, []);

    useEffect(() => {
        stopSet();
    }, [activeNoteSetId]);

    useEffect(() => {
        if (variableNames.length === 0) return;
        const nextBindings: Record<string, number> = { ...bindings };
        const nextDefs: Record<string, { min: number; max: number; step: number }> = { ...variableDefs } as any;
        let changed = false;
        variableNames.forEach((name) => {
            if (nextBindings[name] === undefined) {
                nextBindings[name] = 1;
                changed = true;
            }
            if (!nextDefs[name]) {
                const v = nextBindings[name] ?? 1;
                nextDefs[name] = { min: v - 10, max: v + 10, step: 0.1 };
                changed = true;
            }
        });
        if (changed) {
            setMathUnifiedFunctionState({ variableBindings: nextBindings, variableDefs: nextDefs });
        }
    }, [variableNames.join('|')]);

    const handleCreate = () => {
        addMathNoteSet({ ...DEFAULT_NOTE_SET, id: `ns-${Date.now()}`, name: `Set ${noteSets.length + 1}` });
    };

    const updateMap = (p: Partial<MathNoteSet['mapping']>) => {
        if(activeSet) updateMathNoteSet(activeSet.id, { mapping: { ...activeSet.mapping, ...p } });
    };

    const updatePlay = (p: Partial<MathNoteSet['playback']>) => {
        if(activeSet) updateMathNoteSet(activeSet.id, { playback: { ...activeSet.playback, ...p } });
    };

    const updateExport = (p: Partial<MathNoteSet['export']>) => {
        if (activeSet) updateMathNoteSet(activeSet.id, { export: { ...(activeSet.export || {}), ...p } });
    };

    const getDotsByOrder = (order: 'x' | 'y' | 'custom' | 'created', dotsList: MathNoteSet['dots']) => {
        if (order === 'custom') return [...dotsList];
        if (order === 'created') {
            return dotsList
                .map((d, idx) => ({ d, idx }))
                .sort((a, b) => {
                    const ta = a.d.generatedAt ? Date.parse(a.d.generatedAt) : a.idx;
                    const tb = b.d.generatedAt ? Date.parse(b.d.generatedAt) : b.idx;
                    if (ta === tb) return a.idx - b.idx;
                    return ta - tb;
                })
                .map(item => item.d);
        }
        if (order === 'y') return [...dotsList].sort((a, b) => a.y - b.y);
        return [...dotsList].sort((a, b) => a.x - b.x);
    };

    const getPlayableDots = (mode: 'scale' | 'chord' | 'arp', dotsList: MathNoteSet['dots']) => {
        const nonMarkers = dotsList.filter(d => d.role !== 'marker' && d.role !== 'ignore');
        if (mode === 'chord') {
            const chordDots = nonMarkers.filter(d => d.role === 'chord');
            return chordDots.length > 0 ? chordDots : nonMarkers;
        }
        const scaleDots = nonMarkers.filter(d => d.role === 'scale');
        return scaleDots.length > 0 ? scaleDots : nonMarkers;
    };

    const updateBinding = (name: string, value: number) => {
        setMathUnifiedFunctionState({ variableBindings: { ...bindings, [name]: value } });
    };

    const updateVarDef = (name: string, partial: Partial<{ min: number; max: number; step: number }>) => {
        const current = variableDefs[name] || { min: (bindings[name] ?? 1) - 10, max: (bindings[name] ?? 1) + 10, step: 0.1 };
        setMathUnifiedFunctionState({ variableDefs: { ...variableDefs, [name]: { ...current, ...partial } } });
    };

    const generateDotsFromObjects = () => {
        if (!activeSet) return;
        const sampling = activeSet.mapping;
        const baseSampleCount = Math.max(10, sampling.sampleCount || 300);
        const baseStrategy = sampling.strategy || 'uniform_param';
        const complexComponent = sampling.complexComponent || 'abs';
        const implicitFallback = sampling.implicitResolution || Math.round(Math.sqrt(baseSampleCount));
        const generatedAt = new Date().toISOString();

        const selectedObj = objects.find(o => o.id === selectedObjectId);
        let sourceObjects = objects.filter(o => o.visible && o.type !== 'vector_field');
        if (dotGenSource === 'selected' && selectedObj) {
            sourceObjects = [selectedObj];
        } else if (dotGenSource === 'mapping') {
            sourceObjects = objects.filter(o => o.visible && o.mappingEnabled && o.type !== 'vector_field');
        } else if (dotGenSource === 'group') {
            const group = dotGenGroup || selectedObj?.group || 'default';
            sourceObjects = objects.filter(o => o.visible && (o.group || 'default') === group && o.type !== 'vector_field');
        }
        if (sourceObjects.length === 0) {
            sourceObjects = objects.filter(o => o.visible && o.type !== 'vector_field');
        }

        const newDots = sourceObjects.flatMap(obj => {
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const sampleCount = override?.sampleCount || baseSampleCount;
            const strategy = override?.strategy || baseStrategy;
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution ? obj.implicitResolution : implicitFallback;
            const res = sampleObject(obj, sampleCount, view, {
                bindings: objBindings,
                complexComponent,
                implicitResolution: implicitBase,
                strategy
            });

            let points = res.points;
            if (obj.type === 'implicit' && res.segments && res.segments.length > 0) {
                if (strategy === 'arc_length' || strategy === 'adaptive_curvature') {
                    points = resamplePolylinesByArcLength(res.segments, sampleCount, { minSegmentPoints: 3 });
                } else {
                    points = res.segments.flat();
                }
            }

            return points
                .filter(p => p.valid && Number.isFinite(p.x) && Number.isFinite(p.y))
                .filter(p => p.x >= view.xMin && p.x <= view.xMax && p.y >= view.yMin && p.y <= view.yMax)
                .map((p, idx) => ({
                    id: `dot-${Date.now()}-${obj.id}-${idx}`,
                    x: p.x,
                    y: p.y,
                    role: 'scale' as const,
                    label: '',
                    sourceObjectId: obj.id,
                    u: p.u,
                    generatedAt,
                    segmentId: p.segmentId
                }));
        });

        if (dotGenMode === 'append') {
            updateMathNoteSet(activeSet.id, { dots: [...activeSet.dots, ...newDots] });
        } else {
            updateMathNoteSet(activeSet.id, { dots: newDots });
        }
        if (newDots.length > 0) {
            setMathEditorState({ selectedDotId: newDots[0].id });
        }
        notifySuccess(`Generated ${newDots.length} dots from ${sourceObjects.length} objects.`, 'Math Lab');
    };

    const filteredDots = useMemo(() => {
        if (!activeSet) return [];
        if (dotFilter === 'all') return activeSet.dots;
        if (dotFilter === 'invalid') {
            return activeSet.dots.filter(d => !computeDotPitch(d, activeSet.mapping, { min: view.yMin, max: view.yMax }, settings).isValid);
        }
        return activeSet.dots.filter(d => (d.role || 'scale') === dotFilter);
    }, [activeSet?.dots, activeSet?.mapping, dotFilter, view.yMin, view.yMax, settings]);

    const playSet = () => {
        if (!activeSet) return;
        
        stopSet();

        const playDots = getPlayableDots(activeSet.playback.mode, activeSet.dots);
        const ordered = getDotsByOrder(activeSet.playback.order || 'x', playDots);

        if (activeSet.playback.mode === 'chord') {
            const chordDur = Math.max(20, activeSet.playback.chordMs || 1000);
            ordered.forEach((dot, i) => {
                const pitch = computeDotPitch(dot, activeSet.mapping, { min: view.yMin, max: view.yMax }, settings);
                if (!pitch.isValid) return;
                const node = {
                    id: `mn-${dot.id}`,
                    position: new THREE.Vector3(),
                    primeVector: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0}, 
                    ratio: pitch.ratio,
                    octave: 0,
                    cents: pitch.cents,
                    gen: 0, originLimit: 0 as const, parentId: null, name: dot.label || `Dot ${i}`
                };
                const tStart = window.setTimeout(() => {
                    const stop = startNote(node, settings, 'click');
                    voicesRef.current.push(stop);
                    const tStop = window.setTimeout(() => stop(), chordDur);
                    timeoutsRef.current.push(tStop);
                }, 0);
                timeoutsRef.current.push(tStart);
            });
            return;
        }

        let time = 0;
        const useMs = activeSet.playback.speedUnit === 'ms';
        const stepMs = useMs ? Math.max(0, activeSet.playback.noteMs) + Math.max(0, activeSet.playback.gapMs) : (60000 / Math.max(20, activeSet.playback.bpm));
        const gate = activeSet.playback.gate ?? 0.8;
        const noteMs = useMs ? Math.max(0, activeSet.playback.noteMs) : stepMs * gate;
        const gapMs = useMs ? Math.max(0, activeSet.playback.gapMs) : stepMs - noteMs;

        ordered.forEach((dot, i) => {
            const pitch = computeDotPitch(dot, activeSet.mapping, { min: view.yMin, max: view.yMax }, settings);
            if (!pitch.isValid) return;

            const node = {
                id: `mn-${dot.id}`,
                position: new THREE.Vector3(),
                primeVector: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0}, 
                ratio: pitch.ratio,
                octave: 0,
                cents: pitch.cents,
                gen: 0, originLimit: 0 as const, parentId: null, name: dot.label || `Dot ${i}`
            };

            const tStart = window.setTimeout(() => {
                const stop = startNote(node, settings, 'click');
                voicesRef.current.push(stop);
                
                const tStop = window.setTimeout(() => stop(), Math.max(10, noteMs));
                timeoutsRef.current.push(tStop);
            }, time);
            timeoutsRef.current.push(tStart);
            time += Math.max(0, noteMs + gapMs);
        });
    };

    const toKeyboard = () => {
        if (!activeSet) return;
        const exportOrder = activeSet.export?.order || activeSet.playback.order || 'x';
        const exportNormalize = activeSet.export?.normalizeToOctave ?? true;
        const exportDedupe = activeSet.export?.dedupe ?? true;
        const exportDots = getDotsByOrder(exportOrder as any, activeSet.dots).filter(d => d.role !== 'marker' && d.role !== 'ignore');
        const mapping = { ...activeSet.mapping, normalizeToOctave: exportNormalize };
        const pitchResults = exportDots.map((dot) => ({
            dot,
            pitch: computeDotPitch(dot, mapping, { min: view.yMin, max: view.yMax }, settings)
        }));
        const invalidCount = pitchResults.filter(p => !p.pitch.isValid).length;
        if (exportDots.length > 0) {
            const invalidRatio = invalidCount / exportDots.length;
            if (invalidRatio >= 0.2) {
                const proceed = window.confirm(`Export has ${Math.round(invalidRatio * 100)}% invalid dots. Continue with valid dots only?`);
                if (!proceed) return;
            }
        }

        const nodes = pitchResults
            .filter(p => p.pitch.isValid)
            .map((p, i) => ({
                id: `mn-${p.dot.id}`,
                position: new THREE.Vector3(),
                primeVector: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
                ratio: p.pitch.ratio,
                octave: 0,
                cents: p.pitch.cents,
                gen: 0,
                originLimit: 0 as const,
                parentId: null,
                name: p.dot.label || `Dot ${i}`
            })) as any[];

        const deduped = exportDedupe ? (() => {
            const seen = new Set<string>();
            const out: any[] = [];
            nodes.forEach(n => {
                const key = `${n.ratio.n.toString()}/${n.ratio.d.toString()}`;
                if (seen.has(key)) return;
                seen.add(key);
                out.push(n);
            });
            return out;
        })() : nodes;

        setCustomKeyboard(deduped as any);
        notifySuccess(`Applied ${deduped.length} dots to Keyboard.`, 'Math Lab');
    };

    const variablePanel = variableNames.length > 0 ? (
        <div className="p-2 bg-gray-800 rounded border border-gray-700 space-y-2">
            <h4 className="text-[9px] font-bold text-gray-400 uppercase">Variables</h4>
            {variableNames.map((name) => {
                const value = bindings[name] ?? 1;
                const def = variableDefs[name] || { min: value - 10, max: value + 10, step: 0.1 };
                return (
                    <div key={name} className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] text-gray-300 font-mono">{name}</span>
                            <input
                                type="number"
                                value={value}
                                step={def.step}
                                onChange={(e) => updateBinding(name, parseFloat(e.target.value))}
                                className="w-14 bg-black text-[9px] text-white rounded text-right"
                            />
                        </div>
                        <input
                            type="range"
                            min={def.min}
                            max={def.max}
                            step={def.step}
                            value={value}
                            onChange={(e) => updateBinding(name, parseFloat(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between gap-1 text-[8px] text-gray-400">
                            <input
                                type="number"
                                value={def.min}
                                onChange={(e) => updateVarDef(name, { min: parseFloat(e.target.value) })}
                                className="w-10 bg-black text-[8px] text-white rounded text-center"
                            />
                            <input
                                type="number"
                                value={def.max}
                                onChange={(e) => updateVarDef(name, { max: parseFloat(e.target.value) })}
                                className="w-10 bg-black text-[8px] text-white rounded text-center"
                            />
                            <input
                                type="number"
                                value={def.step}
                                step={0.01}
                                onChange={(e) => updateVarDef(name, { step: parseFloat(e.target.value) })}
                                className="w-10 bg-black text-[8px] text-white rounded text-center"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    ) : null;

    if (!activeSet) {
        return (
            <div className="w-64 border-l border-gray-800 bg-gray-900/50 p-4 shrink-0 flex flex-col gap-4">
                <div className="text-xs text-gray-500 text-center">No Active Note Set</div>
                <button onClick={handleCreate} className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold py-2 rounded">Create Note Set</button>

                {globalSampling && (
                    <div className="p-2 bg-gray-800 rounded border border-gray-700 space-y-2">
                        <h4 className="text-[9px] font-bold text-gray-400 uppercase">Global Sampling</h4>
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Sample Count</label>
                            <input type="number" value={globalSampling.sampleCount} onChange={e => setMathSampling({ sampleCount: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Strategy</label>
                            <select value={globalSampling.strategy} onChange={e => setMathSampling({ strategy: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                                <option value="uniform_x">Uniform X</option>
                                <option value="uniform_param">Uniform Param</option>
                                <option value="arc_length">Arc Length</option>
                                <option value="adaptive_pixel">Adaptive Pixel</option>
                                <option value="adaptive_curvature">Adaptive Curvature</option>
                            </select>
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Implicit Res</label>
                            <input
                                type="number"
                                value={globalSampling.implicitResolution || ''}
                                onChange={e => setMathSampling({ implicitResolution: e.target.value ? parseInt(e.target.value) : undefined })}
                                className="w-12 bg-black text-[9px] text-center text-white"
                                placeholder="auto"
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Invalid</label>
                            <select value={globalSampling.invalidPolicy || 'break'} onChange={e => setMathSampling({ invalidPolicy: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                                <option value="break">Break</option>
                                <option value="skip">Skip</option>
                                <option value="mark">Mark</option>
                                <option value="clamp">Clamp</option>
                            </select>
                        </div>
                        <div className="text-[8px] text-gray-500">Affects curve fidelity, dot generation, snap, export.</div>
                    </div>
                )}

                {variablePanel}
                
                <div className="flex-1 overflow-y-auto">
                    {noteSets.map(ns => (
                        <div key={ns.id} onClick={() => setActiveMathNoteSet(ns.id)} className="p-2 border border-gray-700 rounded mb-1 cursor-pointer hover:bg-gray-800 text-xs text-gray-300">
                            {ns.name} ({ns.dots.length} dots)
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-64 border-l border-gray-800 bg-gray-900/50 p-2 shrink-0 flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-2">
                <input className="bg-transparent text-xs font-bold text-white border-b border-gray-700 w-32 outline-none" value={activeSet.name} onChange={e => updateMathNoteSet(activeSet.id, { name: e.target.value })} />
                <button onClick={() => removeMathNoteSet(activeSet.id)} className="text-red-500 text-[10px] border border-red-900 px-1 rounded hover:bg-red-900">Delete</button>
            </div>

            <div className="space-y-3">
                {variablePanel}
                <div className="p-2 bg-gray-800 rounded border border-gray-700 space-y-2">
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase">Mapping</h4>
                    <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Mode</label>
	                    <select
	                        value={activeSet.mapping.mappingMode}
	                        onChange={e => updateMap({ mappingMode: e.target.value as any })}
	                        className="bg-black text-[9px] text-white rounded w-28"
	                    >
	                        <option value="y_cents">Y &gt; Cents</option>
	                        <option value="y_ratio">Y &gt; Ratio</option>
	                        <option value="y_hz">Y &gt; Hz</option>
	                        <option value="bounded">Bounded</option>
	                    </select>
	                </div>
                    
                    <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Base Freq</label>
                    <input type="number" value={activeSet.mapping.baseFreq} onChange={e => updateMap({ baseFreq: parseFloat(e.target.value) })} className="w-16 bg-black text-[9px] text-white rounded text-right" /></div>

                    {activeSet.mapping.mappingMode === 'bounded' && (
                        <div className="flex gap-1 items-center"><span className="text-[9px]">Range</span>
                        <input type="number" value={activeSet.mapping.boundedRange.min} onChange={e => updateMap({ boundedRange: { ...activeSet.mapping.boundedRange, min: parseFloat(e.target.value) } })} className="w-10 bg-black text-[9px] rounded text-center" />
                        <span className="text-[9px]">-</span>
                        <input type="number" value={activeSet.mapping.boundedRange.max} onChange={e => updateMap({ boundedRange: { ...activeSet.mapping.boundedRange, max: parseFloat(e.target.value) } })} className="w-10 bg-black text-[9px] rounded text-center" />
                        </div>
                    )}

                    {hasComplexOutputs && (
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Complex</label>
                            <select
                                value={activeSet.mapping.complexComponent || 'abs'}
                                onChange={e => updateMap({ complexComponent: e.target.value as any })}
                                className="bg-black text-[9px] text-white rounded w-28"
                            >
                                <option value="abs">abs</option>
                                <option value="re">re</option>
                                <option value="im">im</option>
                                <option value="arg">arg</option>
                            </select>
                        </div>
                    )}

                    <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Quantize</label>
                    <select value={activeSet.mapping.quantize} onChange={e => updateMap({ quantize: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28"><option value="none">None (Free)</option><option value="edo">EDO Steps</option><option value="cents_step">Cents Step</option><option value="prime_limit_fraction">JI Ratio</option></select></div>
                    
                    {activeSet.mapping.quantize === 'edo' && <div className="flex justify-between"><label className="text-[9px]">Divisions</label><input type="number" value={activeSet.mapping.edoDivisions||12} onChange={e=>updateMap({edoDivisions: parseInt(e.target.value)})} className="w-12 bg-black text-[9px] text-center" /></div>}
                    {activeSet.mapping.quantize === 'cents_step' && <div className="flex justify-between"><label className="text-[9px]">Cents Step</label><input type="number" value={activeSet.mapping.centsStep||50} onChange={e=>updateMap({centsStep: parseFloat(e.target.value)})} className="w-12 bg-black text-[9px] text-center" /></div>}
                    {activeSet.mapping.quantize === 'prime_limit_fraction' && <div className="flex justify-between"><label className="text-[9px]">Prime Limit</label><input type="number" value={activeSet.mapping.primeLimit||11} onChange={e=>updateMap({primeLimit: parseInt(e.target.value)})} className="w-12 bg-black text-[9px] text-center" /></div>}

                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="checkbox" checked={activeSet.mapping.normalizeToOctave || false} onChange={e => updateMap({ normalizeToOctave: e.target.checked })} className="w-3 h-3 accent-blue-500" />
                        <span className="text-[9px] text-gray-400">Restrict to Octave</span>
                    </label>

                    <div className="flex justify-between items-center mt-1">
                        <label className="text-[9px] text-gray-500">Sample Count</label>
                        <input type="number" value={activeSet.mapping.sampleCount} onChange={e => updateMap({ sampleCount: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Strategy</label>
                        <select value={activeSet.mapping.strategy} onChange={e => updateMap({ strategy: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="uniform_x">Uniform X</option>
                            <option value="uniform_param">Uniform Param</option>
                            <option value="arc_length">Arc Length</option>
                            <option value="adaptive_pixel">Adaptive Pixel</option>
                            <option value="adaptive_curvature">Adaptive Curvature</option>
                        </select>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Implicit Res</label>
                        <input
                            type="number"
                            value={activeSet.mapping.implicitResolution || ''}
                            onChange={e => updateMap({ implicitResolution: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="w-12 bg-black text-[9px] text-center text-white"
                            placeholder="auto"
                        />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Invalid</label>
                        <select value={activeSet.mapping.invalidPolicy || 'break'} onChange={e => updateMap({ invalidPolicy: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="break">Break</option>
                            <option value="skip">Skip</option>
                            <option value="mark">Mark</option>
                            <option value="clamp">Clamp</option>
                        </select>
                    </div>
                    <div className="text-[8px] text-gray-500 leading-snug">
                        Affects curve fidelity, dot generation, snap precision, and export mapping accuracy.
                    </div>

                    <div className="mt-1 space-y-1">
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Dot Source</label>
                            <select value={dotGenSource} onChange={e => setDotGenSource(e.target.value as any)} className="bg-black text-[9px] text-white rounded w-28">
                                <option value="selected">Selected</option>
                                <option value="visible">Visible</option>
                                <option value="mapping">Mapping</option>
                                <option value="group">Group</option>
                            </select>
                        </div>
                        {dotGenSource === 'group' && (
                            <div className="flex justify-between items-center">
                                <label className="text-[9px] text-gray-500">Group</label>
                                <input value={dotGenGroup} onChange={e => setDotGenGroup(e.target.value)} className="w-20 bg-black text-[9px] text-white rounded text-center" />
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] text-gray-500">Generate</label>
                            <select value={dotGenMode} onChange={e => setDotGenMode(e.target.value as any)} className="bg-black text-[9px] text-white rounded w-28">
                                <option value="replace">Replace</option>
                                <option value="append">Append</option>
                            </select>
                        </div>
                        <button onClick={generateDotsFromObjects} className="w-full bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-bold py-1.5 rounded">
                            Generate Dots from Objects
                        </button>
                        <div className="text-[8px] text-gray-500">Uses current sampling count/strategy.</div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                        <label className="text-[9px] text-gray-500">Snap px</label>
                        <input type="number" value={snapThresholdPx} onChange={e => setMathEditorState({ snapThresholdPx: parseFloat(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" />
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Snap math</label>
                        <input type="number" value={snapThresholdMath} onChange={e => setMathEditorState({ snapThresholdMath: parseFloat(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" />
                    </div>
                </div>

                <div className="p-2 bg-gray-800 rounded border border-gray-700 space-y-2">
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase">Playback</h4>
                    <div className="flex gap-2">
                        <button onClick={playSet} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-[10px] font-bold py-1.5 rounded">Play Sequence</button>
                        <button onClick={stopSet} className="w-8 bg-red-900 text-white text-[10px] font-bold rounded">STOP</button>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Mode</label>
                        <select value={activeSet.playback.mode} onChange={e => updatePlay({ mode: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="scale">Scale</option>
                            <option value="chord">Chord</option>
                            <option value="arp">Arp</option>
                        </select>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Order</label>
                        <select value={activeSet.playback.order} onChange={e => updatePlay({ order: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="x">By X</option>
                            <option value="y">By Y</option>
                            <option value="created">Created</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Speed Unit</label>
                        <select value={activeSet.playback.speedUnit || 'bpm'} onChange={e => updatePlay({ speedUnit: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="bpm">BPM</option>
                            <option value="ms">ms</option>
                        </select>
                    </div>
                    {activeSet.playback.speedUnit !== 'ms' && (
                        <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">BPM</label><input type="number" value={activeSet.playback.bpm} onChange={e => updatePlay({ bpm: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" /></div>
                    )}
                    {activeSet.playback.speedUnit === 'ms' && (
                        <>
                            <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Note ms</label><input type="number" value={activeSet.playback.noteMs} onChange={e => updatePlay({ noteMs: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" /></div>
                            <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Gap ms</label><input type="number" value={activeSet.playback.gapMs} onChange={e => updatePlay({ gapMs: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" /></div>
                        </>
                    )}
                    <div className="flex justify-between items-center"><label className="text-[9px] text-gray-500">Chord ms</label><input type="number" value={activeSet.playback.chordMs} onChange={e => updatePlay({ chordMs: parseInt(e.target.value) })} className="w-12 bg-black text-[9px] text-center text-white" /></div>
                </div>

                <div className="p-2 bg-gray-800 rounded border border-gray-700 space-y-2">
                    <h4 className="text-[9px] font-bold text-gray-400 uppercase">Export</h4>
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] text-gray-500">Order</label>
                        <select value={activeSet.export?.order || 'x'} onChange={e => updateExport({ order: e.target.value as any })} className="bg-black text-[9px] text-white rounded w-28">
                            <option value="x">By X</option>
                            <option value="y">By Y</option>
                            <option value="created">Created</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={activeSet.export?.dedupe ?? true} onChange={e => updateExport({ dedupe: e.target.checked })} className="w-3 h-3 accent-blue-500" />
                        <span className="text-[9px] text-gray-400">Dedupe Ratios</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={activeSet.export?.normalizeToOctave ?? true} onChange={e => updateExport({ normalizeToOctave: e.target.checked })} className="w-3 h-3 accent-blue-500" />
                        <span className="text-[9px] text-gray-400">Normalize to Octave</span>
                    </label>
                    <div className="text-[8px] text-gray-500">Uses mapping quantize + order for export.</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={toKeyboard} className="bg-blue-900/50 border border-blue-700 text-blue-100 text-[9px] py-1.5 rounded hover:bg-blue-800">To Keyboard</button>
                    <button onClick={() => setActiveMathNoteSet(null)} className="bg-gray-800 border border-gray-600 text-gray-300 text-[9px] py-1.5 rounded hover:bg-gray-700">Back to List</button>
                </div>
            </div>
            
            <div className="mt-4 flex-1">
                <div className="flex items-center justify-between mb-1">
                    <div className="text-[9px] font-bold text-gray-500 uppercase">Points ({activeSet.dots.length})</div>
                    <select
                        value={dotFilter}
                        onChange={(e) => setDotFilter(e.target.value as any)}
                        className="bg-black text-[9px] text-white rounded px-1"
                    >
                        <option value="all">All</option>
                        <option value="scale">Scale</option>
                        <option value="chord">Chord</option>
                        <option value="marker">Marker</option>
                        <option value="ignore">Ignore</option>
                        <option value="invalid">Invalid</option>
                    </select>
                </div>
                <div className="bg-black/30 border border-gray-800 rounded h-32 overflow-y-auto p-1 space-y-1">
                    {filteredDots.map((d, i) => {
                        const pitch = computeDotPitch(d, activeSet.mapping, { min: view.yMin, max: view.yMax }, settings);
                        return (
                            <div key={d.id} className="flex items-center gap-1 px-1 text-[9px] hover:bg-white/5">
                                <span className="text-gray-400 w-4">{i+1}</span>
                                <input
                                    className="bg-transparent border-b border-gray-700 text-gray-200 text-[9px] w-16 outline-none"
                                    value={d.label || ''}
                                    onChange={(e) => updateMathNoteSet(activeSet.id, { dots: activeSet.dots.map(dot => dot.id === d.id ? { ...dot, label: e.target.value } : dot) })}
                                    placeholder="Label"
                                />
                                <select
                                    value={d.role || 'scale'}
                                    onChange={(e) => updateMathNoteSet(activeSet.id, { dots: activeSet.dots.map(dot => dot.id === d.id ? { ...dot, role: e.target.value as any } : dot) })}
                                    className="bg-black text-[9px] text-white rounded"
                                >
                                    <option value="scale">scale</option>
                                    <option value="chord">chord</option>
                                    <option value="marker">marker</option>
                                    <option value="ignore">ignore</option>
                                </select>
                                <input
                                    type="color"
                                    value={d.color || '#00ff00'}
                                    onChange={(e) => updateMathNoteSet(activeSet.id, { dots: activeSet.dots.map(dot => dot.id === d.id ? { ...dot, color: e.target.value } : dot) })}
                                    className="w-4 h-4 bg-transparent border border-gray-700 rounded"
                                    title="Dot color"
                                />
                                <button
                                    onClick={() => updateMathNoteSet(activeSet.id, { dots: activeSet.dots.map(dot => dot.id === d.id ? { ...dot, locked: !dot.locked } : dot) })}
                                    className={`text-[9px] px-1 rounded border ${d.locked ? 'border-yellow-500 text-yellow-400' : 'border-gray-700 text-gray-400'}`}
                                >
                                    {d.locked ? 'Locked' : 'Lock'}
                                </button>
                                <span className="font-mono text-gray-300">{d.x.toFixed(1)}, {d.y.toFixed(1)}</span>
                                <span className={`font-mono ${pitch.isValid ? 'text-green-400' : 'text-red-500'}`}>
                                    {pitch.isValid ? `${pitch.freqHz.toFixed(0)}Hz` : (pitch.reason || 'Invalid')}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

