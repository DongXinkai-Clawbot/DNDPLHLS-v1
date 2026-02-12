
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { MathDot } from '../../../types';
import { sampleObject, SampleResult } from '../../../utils/mathLabUtils';
import { extractVariables, getBindingsSubset } from '../../../utils/mathVariableUtils';

interface Props {
    width?: number;
    height?: number;
}

type VectorFieldPoint = { x: number; y: number; dx: number; dy: number };
type VectorFieldSample = { points: VectorFieldPoint[]; resolution: number };

export const GraphEditor = ({ width = 800, height = 600 }: Props) => {
    const {
      mathLab,
      setMathView,
      setMathEditorState,
      updateMathNoteSet,
      setMathSampling
    } = useStore((s) => ({
      mathLab: s.mathLab,
      setMathView: s.setMathView,
      setMathEditorState: s.setMathEditorState,
      updateMathNoteSet: s.updateMathNoteSet,
      setMathSampling: s.setMathSampling
    }), shallow);
    const objects = mathLab?.objects || [];
    const view = mathLab?.view || { xMin: -10, xMax: 10, yMin: -10, yMax: 10, grid: true };
    const activeNoteSetId = mathLab?.activeNoteSetId;
    const noteSets = mathLab?.noteSets || [];
    const editor = mathLab?.editor || { tool: 'pan', selectedDotId: null, selectedObjectId: null, hoverDotId: null, showThumbnails: true, showDotLabels: true, showDebugPitch: false, snapThresholdPx: 14, snapThresholdMath: 0.25, snapTarget: 'visible', snapUseHighRes: true, snapGroup: 'default' };
    
    const activeNoteSet = noteSets.find(n => n.id === activeNoteSetId);
    const dots = activeNoteSet ? activeNoteSet.dots : [];
    const samplingSource = activeNoteSet?.mapping || mathLab?.sampling;
    const bindings = mathLab?.unifiedFunctionState?.variableBindings || {};
    const snapTarget = editor.snapTarget || 'visible';
    const snapUseHighRes = editor.snapUseHighRes !== undefined ? editor.snapUseHighRes : true;

    const [isDragging, setIsDragging] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [dragTarget, setDragTarget] = useState<'view' | string>('view'); 
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); 
    const [viewStart, setViewStart] = useState({ ...view });
    const [dotStart, setDotStart] = useState({ x: 0, y: 0 }); 
    const svgRef = useRef<SVGSVGElement>(null);
    const wheelTimerRef = useRef<number | null>(null);
    const pendingViewRef = useRef<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null);
    const sampleCacheRef = useRef(new Map<string, SampleResult>());
    const vectorWorkerRef = useRef<Worker | null>(null);
    const vectorRequestRef = useRef<Record<string, string>>({});
    const vectorSamplesRef = useRef<Record<string, VectorFieldSample>>({});
    const [vectorTick, setVectorTick] = useState(0);

    useEffect(() => {
        return () => {
            if (wheelTimerRef.current) {
                window.clearTimeout(wheelTimerRef.current);
                wheelTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const worker = new Worker(new URL('../../../utils/mathVectorFieldWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<{ id: string; objId: string; points: VectorFieldPoint[]; resolution: number }>) => {
            const { id, objId, points, resolution } = event.data;
            if (vectorRequestRef.current[objId] !== id) return;
            vectorSamplesRef.current[objId] = { points, resolution };
            setVectorTick(t => t + 1);
        };
        vectorWorkerRef.current = worker;
        return () => {
            worker.terminate();
            vectorWorkerRef.current = null;
        };
    }, []);

    useEffect(() => {
        const worker = vectorWorkerRef.current;
        if (!worker) return;
        const vectorObjects = objects.filter(o => o.visible && o.type === 'vector_field');
        const complexComponent = samplingSource?.complexComponent || 'abs';
        const densityFactor = vectorObjects.length > 4 ? 0.6 : 1;
        vectorObjects.forEach(obj => {
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const baseCount = override?.sampleCount || samplingSource?.sampleCount || 300;
            const resolution = Math.max(6, Math.round(Math.sqrt(baseCount)));
            const baseRes = isInteracting ? Math.max(4, Math.round(resolution * 0.6)) : resolution;
            const effectiveRes = Math.max(4, Math.round(baseRes * densityFactor));
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const requestId = `${obj.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            vectorRequestRef.current[obj.id] = requestId;
            worker.postMessage({
                id: requestId,
                objId: obj.id,
                expression: obj.expression,
                bindings: objBindings,
                view,
                resolution: effectiveRes,
                complexComponent
            });
        });
    }, [objects, bindings, view, samplingSource?.sampleCount, samplingSource?.complexComponent, isInteracting]);

    const toScreenX = (x: number) => ((x - view.xMin) / (view.xMax - view.xMin)) * width;
    const toScreenY = (y: number) => height - ((y - view.yMin) / (view.yMax - view.yMin)) * height;
    const fromScreenX = (sx: number) => view.xMin + (sx / width) * (view.xMax - view.xMin);
    const fromScreenY = (sy: number) => view.yMin + ((height - sy) / height) * (view.yMax - view.yMin);
    const getLocalPoint = (e: React.PointerEvent | React.WheelEvent) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        const clientX = 'clientX' in e ? e.clientX : (e as any).clientX;
        const clientY = 'clientY' in e ? e.clientY : (e as any).clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const samples = useMemo(() => {
        const cache: { [id: string]: SampleResult } = {};
        const baseCountGlobal = samplingSource?.sampleCount || 300;
        const strategyGlobal = samplingSource?.strategy || 'uniform_param';
        const complexComponent = samplingSource?.complexComponent || 'abs';
        const invalidPolicy = samplingSource?.invalidPolicy || 'break';
        const viewKey = `${view.xMin.toFixed(4)}|${view.xMax.toFixed(4)}|${view.yMin.toFixed(4)}|${view.yMax.toFixed(4)}`;
        const pixelKey = `${width}x${height}`;
        const heavyMode = isInteracting && objects.length > 20 && editor.selectedObjectId;
        objects.forEach(obj => {
            if (!obj.visible) return;
            if (obj.type === 'vector_field') return;
            if (heavyMode && obj.id !== editor.selectedObjectId) return;
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const baseCount = override?.sampleCount || baseCountGlobal;
            const strategy = override?.strategy || strategyGlobal;
            const adaptiveBase = strategy === 'adaptive_pixel'
                ? Math.max(baseCount, Math.round(width / 2))
                : (strategy === 'adaptive_curvature' ? Math.max(baseCount, Math.round(width)) : baseCount);
            const lowCount = Math.max(60, Math.min(120, Math.round(adaptiveBase * 0.4)));
            const effectiveCount = isInteracting ? lowCount : adaptiveBase;
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const bindingsKey = Object.keys(objBindings).sort().map(k => `${k}:${objBindings[k].toFixed(4)}`).join(',');
            const implicitFallback = samplingSource?.implicitResolution || Math.round(Math.sqrt(adaptiveBase));
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution ? obj.implicitResolution : implicitFallback;
            const implicitCount = Math.max(12, Math.round(isInteracting ? implicitBase * 0.5 : implicitBase));
            const key = [
                obj.id, obj.expression, obj.type, obj.params.min, obj.params.max,
                obj.implicitResolutionMode || 'auto', obj.implicitResolution || '',
                viewKey, effectiveCount, strategy, complexComponent, invalidPolicy, implicitCount,
                bindingsKey, pixelKey
            ].join('|');
            const cached = sampleCacheRef.current.get(key);
            if (cached) {
                cache[obj.id] = cached;
                return;
            }
            const res = sampleObject(obj, effectiveCount, view, {
                bindings: objBindings,
                complexComponent,
                implicitResolution: implicitCount,
                strategy
            });
            sampleCacheRef.current.set(key, res);
            cache[obj.id] = res;
        });
        return cache;
    }, [
        objects,
        view,
        samplingSource?.sampleCount,
        samplingSource?.strategy,
        samplingSource?.complexComponent,
        samplingSource?.invalidPolicy,
        samplingSource?.implicitResolution,
        bindings,
        isInteracting,
        width,
        height,
        editor.selectedObjectId
    ]);

    const handleWheel = (e: React.WheelEvent) => {
        if (dragTarget !== 'view') return;
        e.preventDefault();
        setIsInteracting(true);
        if (wheelTimerRef.current) window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = window.setTimeout(() => {
            setIsInteracting(false);
            wheelTimerRef.current = null;
        }, 180);
        const scale = e.deltaY > 0 ? 1.1 : 0.9;
        const { x: sx, y: sy } = getLocalPoint(e);
        const cx = fromScreenX(sx);
        const cy = fromScreenY(sy);
        const w = view.xMax - view.xMin;
        const h = view.yMax - view.yMin;
        
        setMathView({
            xMin: cx - (cx - view.xMin) * scale,
            xMax: cx + (view.xMax - cx) * scale,
            yMin: cy - (cy - view.yMin) * scale,
            yMax: cy + (view.yMax - cy) * scale,
        });
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture(e.pointerId);
        const { x: sx, y: sy } = getLocalPoint(e);
        const clickedDot = dots.find(d => {
            const dx = toScreenX(d.x) - sx;
            const dy = toScreenY(d.y) - sy;
            return Math.sqrt(dx*dx + dy*dy) < 8; 
        });

        if (clickedDot) {
            setMathEditorState({ selectedDotId: clickedDot.id });
            if (editor.tool === 'delete') {
                if(activeNoteSet && !clickedDot.locked) updateMathNoteSet(activeNoteSet.id, { dots: dots.filter(d => d.id !== clickedDot.id) });
            } else if (editor.tool === 'select' && !clickedDot.locked) {
                setIsDragging(true);
                setDragTarget(clickedDot.id);
                setDragStart({ x: sx, y: sy });
                setDotStart({ x: clickedDot.x, y: clickedDot.y });
            }
        } else {
            
            setMathEditorState({ selectedDotId: null });
            if (editor.tool === 'add_dot' && activeNoteSet) {
                const nx = fromScreenX(sx);
                const ny = fromScreenY(sy);
                const newDot: MathDot = {
                    id: `dot-${Date.now()}`,
                    x: nx, y: ny, role: 'scale',
                    label: ''
                };
                updateMathNoteSet(activeNoteSet.id, { dots: [...dots, newDot] });
                setMathEditorState({ selectedDotId: newDot.id });
            } else if (editor.tool === 'pan' || editor.tool === 'select') {
                setIsDragging(true);
                setDragTarget('view');
                setDragStart({ x: sx, y: sy });
                setViewStart({ ...view });
                pendingViewRef.current = null;
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        const { x: sx, y: sy } = getLocalPoint(e);

        if (dragTarget === 'view') {
            const dx = ((sx - dragStart.x) / width) * (viewStart.xMax - viewStart.xMin);
            const dy = ((sy - dragStart.y) / height) * (viewStart.yMax - viewStart.yMin);
            pendingViewRef.current = {
                xMin: viewStart.xMin - dx, xMax: viewStart.xMax - dx,
                yMin: viewStart.yMin + dy, yMax: viewStart.yMax + dy
            };
        } else if (activeNoteSet) {
            
            const dxMath = ((sx - dragStart.x) / width) * (view.xMax - view.xMin);
            const dyMath = -((sy - dragStart.y) / height) * (view.yMax - view.yMin);
            
            let nx = dotStart.x + dxMath;
            let ny = dotStart.y + dyMath;

            if (activeNoteSet.timelineGrid && activeNoteSet.timelineGrid.snapX && activeNoteSet.timelineGrid.xStep > 0) {
                const step = activeNoteSet.timelineGrid.xStep;
                nx = Math.round(nx / step) * step;
            }

            const newDots = dots.map(d => d.id === dragTarget ? { ...d, x: nx, y: ny } : d);
            updateMathNoteSet(activeNoteSet.id, { dots: newDots });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        setIsInteracting(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (dragTarget === 'view' && pendingViewRef.current) {
            setMathView(pendingViewRef.current);
            pendingViewRef.current = null;
        }
    };

    const snapDot = () => {
        if (!activeNoteSet || !editor.selectedDotId) return;
        const dot = dots.find(d => d.id === editor.selectedDotId);
        if (!dot || dot.locked) return;
        const selectedObj = objects.find(o => o.id === editor.selectedObjectId);
        const groupName = editor.snapGroup || selectedObj?.group || 'default';
        let candidates = objects.filter(o => o.visible);
        if (snapTarget === 'selected' && selectedObj) {
            candidates = [selectedObj];
        } else if (snapTarget === 'mapping') {
            candidates = objects.filter(o => o.visible && o.mappingEnabled);
        } else if (snapTarget === 'group') {
            candidates = objects.filter(o => o.visible && (o.group || 'default') === groupName);
        }
        if (candidates.length === 0) {
            candidates = objects.filter(o => o.visible);
        }

        let bestDist = Infinity;
        let bestP = null;

        const baseCountGlobal = samplingSource?.sampleCount || 300;
        const strategyGlobal = samplingSource?.strategy || 'uniform_param';
        const complexComponent = samplingSource?.complexComponent || 'abs';
        const implicitFallback = samplingSource?.implicitResolution || Math.round(Math.sqrt(baseCountGlobal));

        candidates.forEach(obj => {
            const vars = extractVariables(obj.expression, obj.type);
            const objBindings = getBindingsSubset(bindings, vars);
            const override = obj.samplingOverride?.enabled ? obj.samplingOverride : undefined;
            const baseCount = override?.sampleCount || baseCountGlobal;
            const strategy = override?.strategy || strategyGlobal;
            const snapCount = strategy === 'adaptive_pixel'
                ? Math.max(baseCount, Math.round(width / 2))
                : (strategy === 'adaptive_curvature' ? Math.max(baseCount, Math.round(width)) : baseCount);
            const implicitBase = obj.implicitResolutionMode === 'manual' && obj.implicitResolution ? obj.implicitResolution : implicitFallback;
            const res = snapUseHighRes
                ? sampleObject(obj, snapCount, view, { bindings: objBindings, complexComponent, implicitResolution: implicitBase, strategy })
                : samples[obj.id];
            const pts = res?.points;
            if (!pts) return;
            for (const p of pts) {
                if (!p.valid) continue;
                const dist = (p.x - dot.x)**2 + (p.y - dot.y)**2;
                if (dist < bestDist) {
                    bestDist = dist;
                    bestP = p;
                }
            }
        });

        const pxThreshold = editor.snapThresholdPx ?? 14;
        const mathFromPx = ((view.xMax - view.xMin) / Math.max(1, width)) * pxThreshold;
        const mathThresholdSetting = editor.snapThresholdMath;
        const mathThreshold = mathThresholdSetting !== undefined ? Math.min(mathThresholdSetting, mathFromPx) : mathFromPx;
        if (bestP && bestDist <= mathThreshold * mathThreshold) {
            updateMathNoteSet(activeNoteSet.id, { 
                dots: dots.map(d => d.id === dot.id ? { ...d, x: (bestP as any).x, y: (bestP as any).y } : d) 
            });
        }
    };

    const errorSummaries = useMemo(() => {
        const summaries: { id: string; message: string; hint?: string }[] = [];
        const complexComponent = samplingSource?.complexComponent || 'abs';
        objects.forEach(obj => {
            if (!obj.visible) return;
            if (obj.type === 'vector_field') return;
            const res = samples[obj.id];
            if (!res) return;
            const valid = res.meta.validCount;
            const complex = res.meta.complexCount;
            const invalid = res.meta.invalidCount;
            const total = Math.max(1, valid + invalid);
            const invalidPct = Math.round((invalid / total) * 100);
            const inView = res.points.filter(p => p.valid && p.x >= view.xMin && p.x <= view.xMax && p.y >= view.yMin && p.y <= view.yMax).length;
            if (obj.type === 'implicit') {
                if (!res.segments || res.segments.length === 0) {
                    const hint = complex > 0 ? `Complex output (${complexComponent})` : undefined;
                    summaries.push({ id: obj.id, message: `${obj.name || obj.id}: no contour in view`, hint });
                }
                return;
            }
            if (valid === 0) {
                const hint = complex > 0 ? `Complex output (${complexComponent})` : undefined;
                summaries.push({ id: obj.id, message: `${obj.name || obj.id}: no valid output`, hint });
            } else if (inView === 0) {
                summaries.push({ id: obj.id, message: `${obj.name || obj.id}: out of view` });
            } else if (invalidPct >= 15) {
                summaries.push({ id: obj.id, message: `${obj.name || obj.id}: ${invalidPct}% invalid` });
            } else if (complex > valid * 0.5) {
                summaries.push({ id: obj.id, message: `${obj.name || obj.id}: complex-heavy`, hint: `using ${complexComponent}` });
            }
        });
        return summaries;
    }, [objects, samples, samplingSource?.complexComponent, view]);

    const hasComplexResults = useMemo(() => {
        return objects.some(obj => {
            if (obj.type === 'vector_field') return false;
            const res = samples[obj.id];
            return res && res.meta.complexCount > 0;
        });
    }, [objects, samples]);

    return (
        <div className="relative w-full h-full bg-black cursor-crosshair">
            <svg 
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`} 
                className="w-full h-full touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onWheel={handleWheel}
            >
                <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#222" strokeWidth="1" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                <line x1="0" y1={toScreenY(0)} x2={width} y2={toScreenY(0)} stroke="#444" strokeWidth="2" />
                <line x1={toScreenX(0)} y1="0" x2={toScreenX(0)} y2={height} stroke="#444" strokeWidth="2" />

                {objects.map(obj => {
                    if (!obj.visible) return null;
                    if (obj.type === 'vector_field') {
                        const sample = vectorSamplesRef.current[obj.id];
                        if (!sample || sample.points.length === 0) return null;
                        const cellW = width / Math.max(1, sample.resolution - 1);
                        const cellH = height / Math.max(1, sample.resolution - 1);
                        const maxMag = sample.points.reduce((m, p) => {
                            const mag = Math.hypot(p.dx, p.dy);
                            return mag > m ? mag : m;
                        }, 0);
                        const scale = maxMag > 0 ? (Math.min(cellW, cellH) * 0.4) / maxMag : 0;
                        return (
                            <g key={`${obj.id}-vf-${vectorTick}`} className="pointer-events-none">
                                {sample.points.map((p, idx) => {
                                    const sx = toScreenX(p.x);
                                    const sy = toScreenY(p.y);
                                    const ex = sx + p.dx * scale;
                                    const ey = sy - p.dy * scale;
                                    return (
                                        <line
                                            key={`${obj.id}-vf-line-${idx}`}
                                            x1={sx}
                                            y1={sy}
                                            x2={ex}
                                            y2={ey}
                                            stroke={obj.color}
                                            strokeWidth={1}
                                            opacity={0.7}
                                        />
                                    );
                                })}
                            </g>
                        );
                    }
                    const res = samples[obj.id];
                    const pts = res?.points;
                    if (!pts) return null;
                    const invalidPolicy = samplingSource?.invalidPolicy || 'break';
                    
                    let d = "";
                    let penUp = true; 
                    let prevY = 0;
                    let prevX = 0;
                    const maxJump = Math.max(width, height) * 0.75;
                    if (res?.segments && res.segments.length > 0) {
                        let renderSegments = res.segments;
                        if (obj.type === 'implicit' && obj.implicitShowAll === false) {
                            let bestIdx = 0;
                            let bestLen = -1;
                            res.segments.forEach((seg, idx) => {
                                let len = 0;
                                for (let i = 1; i < seg.length; i++) {
                                    const dx = seg[i].x - seg[i - 1].x;
                                    const dy = seg[i].y - seg[i - 1].y;
                                    len += Math.hypot(dx, dy);
                                }
                                if (len > bestLen) {
                                    bestLen = len;
                                    bestIdx = idx;
                                }
                            });
                            renderSegments = res.segments[bestIdx] ? [res.segments[bestIdx]] : res.segments;
                        }
                        return renderSegments.map((seg, idx) => {
                            let segD = '';
                            let pen = true;
                            let segPrevX = 0;
                            let segPrevY = 0;
                            seg.forEach(p => {
                                if (!p.valid) {
                                    pen = true;
                                    return;
                                }
                                const sx = toScreenX(p.x);
                                const sy = toScreenY(p.y);
                                if (pen) {
                                    segD += `M ${sx} ${sy} `;
                                    pen = false;
                                } else {
                                    const dx = sx - segPrevX;
                                    const dy = sy - segPrevY;
                                    if (Math.sqrt(dx*dx + dy*dy) > maxJump) {
                                        segD += `M ${sx} ${sy} `;
                                    } else {
                                        segD += `L ${sx} ${sy} `;
                                    }
                                }
                                segPrevX = sx;
                                segPrevY = sy;
                            });
                            return (
                                <path
                                    key={`${obj.id}-seg-${idx}`}
                                    d={segD}
                                    stroke={obj.color}
                                    strokeWidth={obj.id === editor.selectedObjectId ? 3 : 1.5}
                                    fill="none"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setMathEditorState({ selectedObjectId: obj.id }); 
                                    }}
                                    className="hover:stroke-white cursor-pointer"
                                />
                            );
                        });
                    }

                    for (const p of pts) {
                        if (!p.valid) {
                            if (invalidPolicy !== 'skip' && invalidPolicy !== 'clamp') {
                                penUp = true;
                            }
                            continue;
                        }
                        const sx = toScreenX(p.x);
                        const sy = toScreenY(p.y);

                        const inBounds = sx > -1000 && sx < width + 1000 && sy > -1000 && sy < height + 1000;

                        if (!inBounds) {
                            penUp = true;
                            continue;
                        }
                        
                        if (!penUp) {
                            const dx = sx - prevX;
                            const dy = sy - prevY;
                            if (Math.sqrt(dx*dx + dy*dy) > maxJump) {
                                penUp = true;
                            }
                        }
                        if (!penUp && Math.abs(sy - prevY) > height * 0.8) {
                            penUp = true;
                        }

                        if (penUp) {
                            d += `M ${sx} ${sy} `;
                            penUp = false;
                        } else {
                            d += `L ${sx} ${sy} `;
                        }
                        prevY = sy;
                        prevX = sx;
                    }

                    const invalidMarks = invalidPolicy === 'mark'
                        ? pts.filter((p, idx) => !p.valid && Number.isFinite(p.x) && Number.isFinite(p.y) && idx % 8 === 0)
                        : [];

                    return (
                        <g key={obj.id}>
                            <path 
                                d={d} 
                                stroke={obj.color} 
                                strokeWidth={obj.id === editor.selectedObjectId ? 3 : 1.5} 
                                fill="none" 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setMathEditorState({ selectedObjectId: obj.id }); 
                                }}
                                className="hover:stroke-white cursor-pointer"
                            />
                            {invalidMarks.map((p, i) => (
                                <circle
                                    key={`${obj.id}-invalid-${i}`}
                                    cx={toScreenX(p.x)}
                                    cy={toScreenY(p.y)}
                                    r={2}
                                    fill="#f87171"
                                />
                            ))}
                        </g>
                    );
                })}

                {dots.map(dot => (
                    <g key={dot.id} transform={`translate(${toScreenX(dot.x)}, ${toScreenY(dot.y)})`}>
                        <circle 
                            r={dot.id === editor.selectedDotId ? 6 : 4} 
                            fill={dot.id === editor.selectedDotId ? "#ffff00" : (dot.color || "#00ff00")} 
                            stroke="black"
                            strokeWidth="1"
                            className="hover:r-6 transition-all"
                        />
                        {editor.showDotLabels && (
                            <text y="-8" textAnchor="middle" fill="white" fontSize="10" pointerEvents="none">
                                {dot.label || `${dot.x.toFixed(1)},${dot.y.toFixed(1)}`}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
            
            <div className="absolute top-2 right-2 flex flex-col gap-1">
                {editor.selectedDotId && (
                    <div className="bg-black/70 border border-gray-700 rounded p-2 space-y-1 text-[9px] text-gray-200">
                        <button onClick={snapDot} className="w-full text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded shadow">
                            Snap to Curve
                        </button>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-400">Target</span>
                            <select
                                value={snapTarget}
                                onChange={(e) => setMathEditorState({ snapTarget: e.target.value as any })}
                                className="bg-black text-[9px] text-white rounded px-1"
                            >
                                <option value="selected">Selected</option>
                                <option value="visible">Visible</option>
                                <option value="mapping">Mapping</option>
                                <option value="group">Group</option>
                            </select>
                        </div>
                        {snapTarget === 'group' && (
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-400">Group</span>
                                <input
                                    value={editor.snapGroup || ''}
                                    onChange={(e) => setMathEditorState({ snapGroup: e.target.value })}
                                    className="bg-black text-[9px] text-white rounded px-1 w-20"
                                />
                            </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={snapUseHighRes}
                                onChange={(e) => setMathEditorState({ snapUseHighRes: e.target.checked })}
                                className="accent-blue-500"
                            />
                            <span className="text-gray-400">High Res</span>
                        </label>
                    </div>
                )}
            </div>
            {errorSummaries.length > 0 && (
                <div className="absolute top-2 left-2 bg-black/70 border border-red-700 text-red-200 text-[10px] p-2 rounded max-w-[220px] space-y-1">
                    {errorSummaries.map((e) => (
                        <div key={e.id}>
                            <div className="font-bold">{e.message}</div>
                            {e.hint && <div className="text-[9px] text-red-300">{e.hint}</div>}
                        </div>
                    ))}
                    {hasComplexResults && (
                        <div className="text-[9px] text-gray-300 mt-1 flex items-center gap-2">
                            <span>Complex:</span>
                            <select
                                value={samplingSource?.complexComponent || 'abs'}
                                onChange={(e) => {
                                    const value = e.target.value as any;
                                    if (activeNoteSet) {
                                        updateMathNoteSet(activeNoteSet.id, { mapping: { ...activeNoteSet.mapping, complexComponent: value } });
                                    } else {
                                        setMathSampling({ complexComponent: value });
                                    }
                                }}
                                className="bg-black text-[9px] text-white rounded px-1"
                            >
                                <option value="abs">abs</option>
                                <option value="re">re</option>
                                <option value="im">im</option>
                                <option value="arg">arg</option>
                            </select>
                        </div>
                    )}
                </div>
            )}
            {editor.selectedDotId && editor.showDebugPitch && activeNoteSet && (
                <div className="absolute bottom-2 left-2 bg-black/80 text-white text-xs p-2 rounded border border-gray-700 pointer-events-none">
                    {(() => {
                        const dot = dots.find(d => d.id === editor.selectedDotId);
                        if(dot) return `x:${dot.x.toFixed(2)} y:${dot.y.toFixed(2)}`;
                        return "";
                    })()}
                </div>
            )}
        </div>
    );
};
