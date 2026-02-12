import React from 'react';
import type { NodeData } from '../../../../types';
import type { RatioToolViewProps } from './RatioToolView';

export const RatioToolDeriveMode = (props: RatioToolViewProps) => {
    const {
        playWithOverride,
        playSettings,
        addToComparison,
        selectNode,
        derivePrime,
        setDerivePrime,
        deriveBound,
        setDeriveBound,
        deriveReveal,
        setDeriveReveal,
        deriveSteps,
        setDeriveSteps,
        deriveZoom,
        setDeriveZoom,
        deriveSpan,
        setDeriveSpan,
        ghostGridMode,
        commaMaxCents,
        setCommaMaxCents,
        showCommasOnGraph,
        setShowCommasOnGraph,
        showMonzo,
        scalePlaybackSpeed,
        setScalePlaybackSpeed,
        derived,
        filteredDerived,
        foundCommas,
        makeDerivedNode,
        playNote,
        activeTimeouts,
        stopAllPlayback,
        deriverContainerRef,
        handleDeriverMouseDown,
        handleDeriverMouseMove,
        handleDeriverMouseUp,
        handleDeriverWheel,
    } = props as any;

    return (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2">
            {(() => {
                const playDeriverScale = (steps: any[], order: 'asc' | 'desc') => {
                    stopAllPlayback();

                    const duration = scalePlaybackSpeed;
                    const noteSteps = [...steps].sort((a, b) => order === 'asc' ? a.cents - b.cents : b.cents - a.cents);

                    const sequenceSettings = { ...playSettings, playDurationSingle: duration };

                    noteSteps.forEach((s, idx) => {
                        const t = setTimeout(() => {
                            const note = s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents);
                            playNote(note, sequenceSettings);
                        }, idx * duration * 1000);
                        activeTimeouts.current.push(t);
                    });
                };

                // Play by derivation order (exponent step order)
                const playDeriverByOrder = (steps: any[], direction: 'forward' | 'backward') => {
                    stopAllPlayback();

                    const duration = scalePlaybackSpeed;
                    // Sort by exponent (derivation step order)
                    const noteSteps = [...steps].sort((a, b) =>
                        direction === 'forward' ? a.exp - b.exp : b.exp - a.exp
                    );

                    const sequenceSettings = { ...playSettings, playDurationSingle: duration };

                    noteSteps.forEach((s, idx) => {
                        const t = setTimeout(() => {
                            const note = s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents);
                            playNote(note, sequenceSettings);
                        }, idx * duration * 1000);
                        activeTimeouts.current.push(t);
                    });
                };
                return (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2">
                            <div className="bg-gray-900/40 border border-gray-700 rounded p-2 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase text-gray-500 font-bold">Axis</span>
                                    <input
                                        type="number"
                                        min="2"
                                        max="100000"
                                        value={derivePrime}
                                        onChange={(e) => setDerivePrime(Math.min(100000, Math.max(2, parseInt(e.target.value, 10))))}
                                        className="bg-black border border-gray-700 text-[10px] rounded p-1 outline-none text-gray-200 w-20 text-center"
                                    />

                                    <span className="text-[10px] uppercase text-gray-500 font-bold ml-2">Bound</span>
                                    <input
                                        type="number"
                                        min="1.5"
                                        max="16"
                                        step="0.5"
                                        value={deriveBound}
                                        onChange={e => setDeriveBound(parseFloat(e.target.value) || 2)}
                                        className="bg-black border border-gray-700 text-[10px] rounded p-1 outline-none text-gray-200 w-10 text-center"
                                    />

                                    <div className="flex items-center gap-1 ml-auto">
                                        <button
                                            onClick={() => setDeriveReveal((r) => Math.max(0, r - 1))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Reveal one fewer step"
                                        >
                                            -
                                        </button>
                                        <button
                                            onClick={() => setDeriveReveal((r) => Math.min(deriveSteps, r + 1))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Reveal one more step"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 items-end">
                                    <div className="col-span-2">
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                                            <span>Zoom</span>
                                            <span className="text-blue-300 font-mono">{deriveZoom.toFixed(2)}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="4"
                                            step="0.05"
                                            value={deriveZoom}
                                            onChange={(e) => setDeriveZoom(Math.max(0.5, Math.min(4, parseFloat(e.target.value))))}
                                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 justify-end">
                                        <button
                                            onClick={() => setDeriveZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Zoom out"
                                        >
                                            -
                                        </button>
                                        <button
                                            onClick={() => setDeriveZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Zoom in"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 items-end">
                                    <div className="col-span-2">
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                                            <span>1/1 to 2/1 Length</span>
                                            <span className="text-blue-300 font-mono">{deriveSpan.toFixed(2)}x</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.6"
                                            max="2.5"
                                            step="0.05"
                                            value={deriveSpan}
                                            onChange={(e) => setDeriveSpan(Math.max(0.6, Math.min(2.5, parseFloat(e.target.value))))}
                                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 justify-end">
                                        <button
                                            onClick={() => setDeriveSpan((s) => Math.max(0.6, Math.round((s - 0.1) * 100) / 100))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Shorter octave"
                                        >
                                            -
                                        </button>
                                        <button
                                            onClick={() => setDeriveSpan((s) => Math.min(2.5, Math.round((s + 0.1) * 100) / 100))}
                                            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                                            title="Longer octave"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                                            <span>Max Steps</span>
                                            <span className="text-blue-300 font-mono">{Math.max(0, Math.floor(deriveSteps))}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={deriveSteps}
                                            onChange={(e) => {
                                                const v = Math.max(0, parseInt(e.target.value, 10));
                                                setDeriveSteps(v);
                                                setDeriveReveal((r) => Math.min(r, v));
                                            }}
                                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                                            <span>Reveal</span>
                                            <span className="text-blue-300 font-mono">{derived.reveal}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={Math.max(0, Math.floor(deriveSteps))}
                                            step="1"
                                            value={deriveReveal}
                                            onChange={(e) => setDeriveReveal(Math.max(0, parseInt(e.target.value, 10)))}
                                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                                        />
                                    </div>
                                </div>

                                <div className="text-[9px] text-gray-500">
                                    Shows {1 + (derived.reveal * 2)} notes within one octave (top = negative steps, bottom = positive steps).
                                </div>
                            </div>
                            <div className="bg-gray-900/40 border border-gray-700 rounded p-2 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold text-yellow-500">Comma Finder</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400">Max Cents:</span>
                                        <input
                                            type="number"
                                            value={commaMaxCents}
                                            onChange={e => setCommaMaxCents(Number(e.target.value))}
                                            className="w-12 bg-black border border-gray-700 rounded px-1 text-[10px] text-white"
                                            step="0.1"
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-1 cursor-pointer bg-gray-800 rounded px-1.5 py-0.5 border border-gray-700 hover:border-gray-500 w-fit">
                                    <input
                                        type="checkbox"
                                        checked={showCommasOnGraph}
                                        onChange={e => setShowCommasOnGraph(e.target.checked)}
                                        className="w-3 h-3 accent-yellow-500 rounded bg-gray-700 border-gray-600 cursor-pointer"
                                    />
                                    <span className="text-[9px] text-gray-300 font-bold select-none">Show on Graph</span>
                                </label>
                                {foundCommas.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                        {foundCommas.map((s: any) => (
                                            <div key={s.ratioStr} className="bg-black/40 p-1.5 rounded border border-gray-800 flex justify-between items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-gray-300">{s.ratioStr}</span>
                                                    <span className="text-[9px] text-gray-500">{s.cents.toFixed(2)}¢</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-yellow-400">
                                                        {s.dist?.toFixed(2)}¢
                                                    </span>
                                                    <button
                                                        onClick={() => playWithOverride(s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents))}
                                                        className="text-[9px] bg-gray-700 hover:text-white px-1 rounded"
                                                    >
                                                        Play
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-gray-500 italic text-center p-2">No commas found within threshold.</div>
                                )}
                            </div>
                        </div>

                        <div
                            ref={deriverContainerRef}
                            className="bg-black/40 border border-gray-700 rounded p-2 overflow-auto cursor-grab active:cursor-grabbing"
                            style={{
                                resize: 'both',
                                maxWidth: '100%',
                                minWidth: '260px',
                                minHeight: '220px',
                                maxHeight: '70vh',
                                height: '360px'
                            }}
                            onMouseDown={handleDeriverMouseDown}
                            onMouseMove={handleDeriverMouseMove}
                            onMouseUp={handleDeriverMouseUp}
                            onMouseLeave={handleDeriverMouseUp}
                            onWheel={handleDeriverWheel}
                        >
                            {(() => {
                                const maxCents = 1200 * Math.log2(deriveBound);
                                const viewWidth = 1000 * deriveSpan;
                                const left = 60 * deriveSpan;
                                const right = 940 * deriveSpan;
                                const width = right - left;
                                const baseline = 110;
                                const topY = 45;
                                const bottomY = 175;
                                const xOf = (c: number) => left + (Math.max(0, Math.min(maxCents, c)) / maxCents) * width;

                                const pos = derived.pos;
                                const neg = derived.neg;

                                const commaSet = new Set(foundCommas.map(c => c.ratioStr));

                                const posPoints = pos.slice(1).map((s: any) => ({ ...s, x: xOf(s.cents), y: bottomY, label: showMonzo ? s.monzo : s.ratioStr }));
                                const negPoints = neg.slice(1).map((s: any) => ({ ...s, x: xOf(s.cents), y: topY, label: showMonzo ? s.monzo : s.ratioStr }));

                                const makeArc = (a: any, b: any, cY: number) => {
                                    const midX = (a.x + b.x) / 2;
                                    return `M ${a.x} ${a.y} Q ${midX} ${cY} ${b.x} ${b.y}`;
                                };

                                const approxTextWidth = (label: string, fontSize: number) => (Math.max(1, (label || '').length) * fontSize * 0.62) + 10;

                                const placeLabels = (
                                    points: any[],
                                    baseY: number,
                                    direction: 1 | -1,
                                    minY: number,
                                    maxY: number,
                                    fontSize: number
                                ) => {
                                    const levelGap = fontSize + 6;
                                    const maxLevels = Math.max(
                                        1,
                                        Math.floor((direction > 0 ? (maxY - baseY) : (baseY - minY)) / levelGap) + 1
                                    );

                                    const levels: Array<Array<{ min: number; max: number }>> = [];
                                    const placed = new Map<number, any>();
                                    const sorted = [...points].sort((a, b) => a.x - b.x);

                                    for (const p of sorted) {
                                        const label = String(p.label || '');
                                        const w = approxTextWidth(label, fontSize);
                                        const min = p.x - w / 2;
                                        const max = p.x + w / 2;

                                        let chosen = -1;
                                        for (let level = 0; level < maxLevels; level++) {
                                            const y = baseY + direction * level * levelGap;
                                            if (y < minY || y > maxY) continue;
                                            if (!levels[level]) levels[level] = [];
                                            const collides = levels[level].some(b => !(max < b.min || min > b.max));
                                            if (!collides) {
                                                chosen = level;
                                                levels[level].push({ min, max });
                                                placed.set(p.exp, { ...p, labelY: y, labelFont: fontSize, hidden: false });
                                                break;
                                            }
                                        }

                                        if (chosen === -1) {

                                            const smallFont = Math.max(9, fontSize - 2);
                                            const w2 = approxTextWidth(label, smallFont);
                                            const min2 = p.x - w2 / 2;
                                            const max2 = p.x + w2 / 2;
                                            let placedSmall = false;
                                            const gap2 = smallFont + 6;
                                            const maxLevels2 = Math.max(
                                                1,
                                                Math.floor((direction > 0 ? (maxY - baseY) : (baseY - minY)) / gap2) + 1
                                            );
                                            const levels2: Array<Array<{ min: number; max: number }>> = levels;
                                            for (let level = 0; level < maxLevels2; level++) {
                                                const y = baseY + direction * level * gap2;
                                                if (y < minY || y > maxY) continue;
                                                if (!levels2[level]) levels2[level] = [];
                                                const collides = levels2[level].some(b => !(max2 < b.min || min2 > b.max));
                                                if (!collides) {
                                                    levels2[level].push({ min: min2, max: max2 });
                                                    placed.set(p.exp, { ...p, labelY: y, labelFont: smallFont, hidden: false });
                                                    placedSmall = true;
                                                    break;
                                                }
                                            }
                                            if (!placedSmall) {
                                                placed.set(p.exp, { ...p, labelY: baseY, labelFont: fontSize, hidden: true });
                                            }
                                        }
                                    }

                                    return points.map(p => placed.get(p.exp) || { ...p, labelY: baseY, labelFont: fontSize, hidden: false });
                                };

                                const baseFont = derived.reveal > 12 ? 11 : 12;
                                const negLabelBaseY = topY + 22;
                                const posLabelBaseY = bottomY - 14;
                                const negLabels = placeLabels(negPoints, negLabelBaseY, 1, topY + 10, baseline - 6, baseFont);
                                const posLabels = placeLabels(posPoints, posLabelBaseY, -1, baseline + 6, bottomY - 8, baseFont);

                                return (
                                    <svg viewBox={`0 0 ${viewWidth} 220`} width={viewWidth * deriveZoom} height={220 * deriveZoom}>
                                        <defs>
                                            <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                                <path d="M0,0 L8,4 L0,8 Z" fill="#60A5FA" />
                                            </marker>
                                            <marker id="arrowGray" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                                <path d="M0,0 L8,4 L0,8 Z" fill="#9CA3AF" />
                                            </marker>
                                        </defs>

                                        {(ghostGridMode === '12tet' || ghostGridMode === 'both') && (
                                            Array.from({ length: 12 }, (_, i) => {
                                                const c = (i + 1) * 100;
                                                const x = xOf(c);
                                                return <line key={`grid-12-${i}`} x1={x} y1={topY - 10} x2={x} y2={bottomY + 10} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
                                            })
                                        )}
                                        {(ghostGridMode === '31tet' || ghostGridMode === 'both') && (
                                            Array.from({ length: 31 }, (_, i) => {
                                                const c = (i + 1) * (1200 / 31);
                                                const x = xOf(c);
                                                return <line key={`grid-31-${i}`} x1={x} y1={topY - 10} x2={x} y2={bottomY + 10} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
                                            })
                                        )}

                                        <line x1={left} y1={baseline} x2={right} y2={baseline} stroke="#334155" strokeWidth="3" />
                                        <text x={left} y={baseline + 18} fontSize="14" fill="#E5E7EB" fontFamily="monospace">1/1</text>
                                        <text x={right - 26} y={baseline + 18} fontSize="14" fill="#E5E7EB" fontFamily="monospace">{deriveBound}/1</text>

                                        {posPoints.map((p: any, idx: number) => {
                                            const prev = idx === 0 ? { x: xOf(0), y: baseline } : posPoints[idx - 1];
                                            const path = makeArc(prev, p, baseline - 60);
                                            return (
                                                <path
                                                    key={`pos-arc-${p.exp}`}
                                                    d={path}
                                                    fill="none"
                                                    stroke="#60A5FA"
                                                    strokeWidth="2"
                                                    markerEnd="url(#arrowBlue)"
                                                    opacity="0.75"
                                                />
                                            );
                                        })}

                                        {negPoints.map((p: any, idx: number) => {
                                            const prev = idx === 0 ? { x: xOf(0), y: baseline } : negPoints[idx - 1];
                                            const path = makeArc(prev, p, baseline + 60);
                                            return (
                                                <path
                                                    key={`neg-arc-${p.exp}`}
                                                    d={path}
                                                    fill="none"
                                                    stroke="#9CA3AF"
                                                    strokeWidth="2"
                                                    markerEnd="url(#arrowGray)"
                                                    opacity="0.7"
                                                />
                                            );
                                        })}

                                        <circle cx={xOf(0)} cy={baseline} r="5" fill="#E5E7EB" />

                                        {posLabels.map((p: any) => {
                                            const isComma = showCommasOnGraph && commaSet.has(p.ratioStr);
                                            return (
                                                <g key={`pos-point-${p.exp}`}>
                                                    <circle
                                                        cx={p.x}
                                                        cy={p.y}
                                                        r={isComma ? "8" : "6"}
                                                        fill={isComma ? "#FBBF24" : "#60A5FA"}
                                                        stroke={isComma ? "#D97706" : "#1D4ED8"}
                                                        strokeWidth={isComma ? "2" : "1"}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => playWithOverride((p.exists as NodeData) || makeDerivedNode(derivePrime, p.exp, p.ratio, p.cents))}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            addToComparison((p.exists as NodeData) || makeDerivedNode(derivePrime, p.exp, p.ratio, p.cents));
                                                        }}
                                                    >
                                                        <title>Click: Play • Right-click: Add to Compare</title>
                                                    </circle>
                                                    <title>{`${p.ratioStr} ${p.monzo}\nCents: ${p.cents.toFixed(2)}\nDev: ${p.deviation >= 0 ? '+' : ''}${p.deviation.toFixed(2)}\nOdd Limit: ${p.oddLimit}\nBH: ${p.benedetti.toString()}\nHD: ${p.tenney.toFixed(4)}`}</title>
                                                    {!p.hidden && (
                                                        <text x={p.x} y={p.labelY} fontSize={p.labelFont} fill="#93C5FD" fontFamily="monospace" textAnchor="middle">
                                                            {p.label}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                        {negLabels.map((p: any) => {
                                            const isComma = showCommasOnGraph && commaSet.has(p.ratioStr);
                                            return (
                                                <g key={`neg-point-${p.exp}`}>
                                                    <circle
                                                        cx={p.x}
                                                        cy={p.y}
                                                        r={isComma ? "8" : "6"}
                                                        fill={isComma ? "#FBBF24" : "#9CA3AF"}
                                                        stroke={isComma ? "#D97706" : "#374151"}
                                                        strokeWidth={isComma ? "2" : "1"}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => playWithOverride((p.exists as NodeData) || makeDerivedNode(derivePrime, p.exp, p.ratio, p.cents))}
                                                        onContextMenu={(e) => {
                                                            e.preventDefault();
                                                            addToComparison((p.exists as NodeData) || makeDerivedNode(derivePrime, p.exp, p.ratio, p.cents));
                                                        }}
                                                    >
                                                        <title>Click: Play • Right-click: Add to Compare</title>
                                                    </circle>
                                                    <title>{`${p.ratioStr} ${p.monzo}\nCents: ${p.cents.toFixed(2)}\nDev: ${p.deviation >= 0 ? '+' : ''}${p.deviation.toFixed(2)}\nOdd Limit: ${p.oddLimit}\nBH: ${p.benedetti.toString()}\nHD: ${p.tenney.toFixed(4)}`}</title>
                                                    {!p.hidden && (
                                                        <text x={p.x} y={p.labelY} fontSize={p.labelFont} fill="#D1D5DB" fontFamily="monospace" textAnchor="middle">
                                                            {p.label}
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </svg>
                                );
                            })()}
                        </div>

                        <div className="bg-gray-900/40 border border-gray-700 rounded p-2 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-black text-gray-500">Full Scale</span>
                                <span className="text-[9px] text-gray-600 font-mono">({filteredDerived.pos.length + filteredDerived.neg.length - 1} unique notes)</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 ml-auto">
                                <div className="flex items-center gap-2 bg-black/30 px-2 py-1 rounded border border-gray-800">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase">Scale Speed:</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setScalePlaybackSpeed(s => Math.max(0.1, Math.round((s - 0.1) * 10) / 10))}
                                            className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded border border-gray-700"
                                            title="Faster"
                                        >
                                            -
                                        </button>
                                        <span className="text-[9px] font-mono text-gray-300 min-w-[3rem] text-center">
                                            {scalePlaybackSpeed.toFixed(1)}s
                                        </span>
                                        <button
                                            onClick={() => setScalePlaybackSpeed(s => Math.min(2.0, Math.round((s + 0.1) * 10) / 10))}
                                            className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded border border-gray-700"
                                            title="Slower"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const combined = [...filteredDerived.pos, ...filteredDerived.neg.filter((s: any) => s.exp !== 0)];
                                            playDeriverScale(combined, 'asc');
                                        }}
                                        className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800 font-bold flex items-center gap-1"
                                        title="Play entire scale from lowest to highest"
                                    >
                                        <span>Play All Asc</span> ▲
                                    </button>
                                    <button
                                        onClick={() => {
                                            const combined = [...filteredDerived.pos, ...filteredDerived.neg.filter((s: any) => s.exp !== 0)];
                                            playDeriverScale(combined, 'desc');
                                        }}
                                        className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800 font-bold flex items-center gap-1"
                                        title="Play entire scale from highest to lowest"
                                    >
                                        <span>Play All Desc</span> ▼
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <div className="bg-gray-900/30 border border-gray-700 rounded p-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-black text-gray-500">Positive Steps (+)</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase mr-1">Cents:</span>
                                        <button
                                            onClick={() => playDeriverScale(filteredDerived.pos, 'asc')}
                                            className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded border border-blue-800 font-bold"
                                            title="Play by Cents Ascending"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => playDeriverScale(filteredDerived.pos, 'desc')}
                                            className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded border border-blue-800 font-bold"
                                            title="Play by Cents Descending"
                                        >
                                            ▼
                                        </button>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase ml-2 mr-1">Step:</span>
                                        <button
                                            onClick={() => playDeriverByOrder(filteredDerived.pos, 'forward')}
                                            className="text-[9px] bg-green-900/50 hover:bg-green-800 text-green-200 px-1.5 py-0.5 rounded border border-green-800 font-bold"
                                            title="Play by Derivation Order Forward (0→max)"
                                        >
                                            →
                                        </button>
                                        <button
                                            onClick={() => playDeriverByOrder(filteredDerived.pos, 'backward')}
                                            className="text-[9px] bg-green-900/50 hover:bg-green-800 text-green-200 px-1.5 py-0.5 rounded border border-green-800 font-bold"
                                            title="Play by Derivation Order Backward (max→0)"
                                        >
                                            ←
                                        </button>
                                        <span className="text-[10px] font-mono text-gray-400 ml-2">{derivePrime}/2</span>
                                    </div>
                                </div>

                                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                                    {filteredDerived.pos.map((s: any) => (
                                        <div key={`pos-${s.exp}`} className="bg-black/30 border border-gray-800 rounded p-2 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-blue-200">+{s.exp}</span>
                                                <span className="font-mono text-[11px] text-gray-200">{showMonzo ? s.monzo : s.ratioStr}</span>
                                                <span className="font-mono text-[10px] text-gray-500">{s.cents.toFixed(2)}c</span>
                                            </div>
                                            {showMonzo && (
                                                <div className="text-[10px] text-gray-500 font-mono">{s.ratioStr}</div>
                                            )}
                                            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                                <span>Dev: {s.deviation >= 0 ? "+" : ""}{s.deviation.toFixed(2)}c</span>
                                                <span>Odd: {s.oddLimit}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                                <span>BH: {s.benedetti.toString()}</span>
                                                <span>HD: {s.tenney.toFixed(4)}</span>
                                            </div>
                                            {s.exp !== 0 && (
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {s.intermediateStr} {s.op} → {s.ratioStr}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => playWithOverride(s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents))}
                                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded py-1 text-[10px] font-black"
                                                >
                                                    Play
                                                </button>
                                                <button
                                                    onClick={() => addToComparison(s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents))}
                                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded py-1 text-[10px] font-black"
                                                >
                                                    Compare
                                                </button>
                                                <button
                                                    onClick={() => s.exists && selectNode(s.exists)}
                                                    disabled={!s.exists}
                                                    className="flex-1 bg-blue-900/40 hover:bg-blue-800 disabled:opacity-30 text-blue-200 border border-blue-900/50 rounded py-1 text-[10px] font-black"
                                                >
                                                    Locate
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-900/30 border border-gray-700 rounded p-2">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-black text-gray-500">Negative Steps (-)</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase mr-1">Cents:</span>
                                        <button
                                            onClick={() => playDeriverScale(filteredDerived.neg, 'asc')}
                                            className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded border border-blue-800 font-bold"
                                            title="Play by Cents Ascending"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => playDeriverScale(filteredDerived.neg, 'desc')}
                                            className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-1.5 py-0.5 rounded border border-blue-800 font-bold"
                                            title="Play by Cents Descending"
                                        >
                                            ▼
                                        </button>
                                        <span className="text-[9px] text-gray-400 font-bold uppercase ml-2 mr-1">Step:</span>
                                        <button
                                            onClick={() => playDeriverByOrder(filteredDerived.neg, 'forward')}
                                            className="text-[9px] bg-green-900/50 hover:bg-green-800 text-green-200 px-1.5 py-0.5 rounded border border-green-800 font-bold"
                                            title="Play by Derivation Order Forward (0→min)"
                                        >
                                            →
                                        </button>
                                        <button
                                            onClick={() => playDeriverByOrder(filteredDerived.neg, 'backward')}
                                            className="text-[9px] bg-green-900/50 hover:bg-green-800 text-green-200 px-1.5 py-0.5 rounded border border-green-800 font-bold"
                                            title="Play by Derivation Order Backward (min→0)"
                                        >
                                            ←
                                        </button>
                                        <span className="text-[10px] font-mono text-gray-400 ml-2">2/{derivePrime}</span>
                                    </div>
                                </div>
                                <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                                    {filteredDerived.neg.map((s: any) => (
                                        <div key={`neg-${s.exp}`} className="bg-black/30 border border-gray-800 rounded p-2 space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-gray-200">{s.exp === 0 ? '0' : s.exp}</span>
                                                <span className="font-mono text-[11px] text-gray-200">{showMonzo ? s.monzo : s.ratioStr}</span>
                                                <span className="font-mono text-[10px] text-gray-500">{s.cents.toFixed(2)}c</span>
                                            </div>
                                            {showMonzo && (
                                                <div className="text-[10px] text-gray-500 font-mono">{s.ratioStr}</div>
                                            )}
                                            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                                <span>Dev: {s.deviation >= 0 ? "+" : ""}{s.deviation.toFixed(2)}c</span>
                                                <span>Odd: {s.oddLimit}</span>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                                <span>BH: {s.benedetti.toString()}</span>
                                                <span>HD: {s.tenney.toFixed(4)}</span>
                                            </div>
                                            {s.exp !== 0 && (
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {s.intermediateStr} {s.op} → {s.ratioStr}
                                                </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2">
                                                <button
                                                    onClick={() => playWithOverride(s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents))}
                                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded py-1 text-[10px] font-black"
                                                >
                                                    Play
                                                </button>
                                                <button
                                                    onClick={() => addToComparison(s.exists || makeDerivedNode(derivePrime, s.exp, s.ratio, s.cents))}
                                                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded py-1 text-[10px] font-black"
                                                >
                                                    Compare
                                                </button>
                                                <button
                                                    onClick={() => s.exists && selectNode(s.exists)}
                                                    disabled={!s.exists}
                                                    className="flex-1 bg-blue-900/40 hover:bg-blue-800 disabled:opacity-30 text-blue-200 border border-blue-900/50 rounded py-1 text-[10px] font-black"
                                                >
                                                    Locate
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>


                        </div>
                    </>
                );
            })()}
        </div>
    );
};
