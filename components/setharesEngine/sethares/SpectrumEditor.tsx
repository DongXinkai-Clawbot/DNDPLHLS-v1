import React, { useRef, useEffect, useState } from 'react';
import { Partial, clamp, getHarmonicColor, applySpectralDecay } from './utils';

export const SpectralAlignment = ({
    partials,
    hoverCents,
    decayAmount,
    timeSlice
}: {
    partials: Partial[];
    hoverCents: number | null;
    decayAmount: number;
    timeSlice: number;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = Math.min(4, Math.max(2, window.devicePixelRatio || 1));
        const width = 520;
        const height = 120;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#070707';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#1f1f1f';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.35);
        ctx.lineTo(width, height * 0.35);
        ctx.moveTo(0, height * 0.75);
        ctx.lineTo(width, height * 0.75);
        ctx.stroke();

        if (hoverCents === null) {
            ctx.fillStyle = '#666';
            ctx.font = '10px monospace';
            ctx.fillText('Hover the dissonance curve to see spectral alignment.', 10, 18);
            return;
        }

        const ratio = Math.pow(2, hoverCents / 1200);
        const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice);
        const baseFreqs = analysisPartials.map(p => ({ f: p.ratio, a: p.amplitude }));
        const intervalFreqs = analysisPartials.map(p => ({ f: p.ratio * ratio, a: p.amplitude }));
        const maxFreq = Math.max(
            ...baseFreqs.map(p => p.f),
            ...intervalFreqs.map(p => p.f),
            2
        );
        const logMax = Math.log2(maxFreq);
        const xFromFreq = (f: number) => {
            const log = Math.log2(Math.max(1e-6, f));
            return (log / logMax) * (width - 20) + 10;
        };

        const alignmentTolerance = 5;
        const intervalMap = intervalFreqs.map(p => p.f);
        const isAligned = (f: number) => {
            for (let i = 0; i < intervalMap.length; i++) {
                const centsDiff = Math.abs(1200 * Math.log2(intervalMap[i] / f));
                if (centsDiff < alignmentTolerance) return true;
            }
            return false;
        };

        baseFreqs.forEach(p => {
            const x = xFromFreq(p.f);
            const heightScale = 40 * p.a;
            ctx.strokeStyle = isAligned(p.f) ? '#ffffff' : '#00ff41';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, height * 0.75);
            ctx.lineTo(x, height * 0.75 - heightScale);
            ctx.stroke();
        });

        intervalFreqs.forEach(p => {
            const x = xFromFreq(p.f);
            const heightScale = 40 * p.a;
            ctx.strokeStyle = '#ffb347';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, height * 0.35);
            ctx.lineTo(x, height * 0.35 - heightScale);
            ctx.stroke();
        });

        ctx.fillStyle = '#aaa';
        ctx.font = '10px monospace';
        ctx.fillText('Base Spectrum', 8, height * 0.75 + 18);
        ctx.fillText(`Interval Spectrum (${ratio.toFixed(4)}x)`, 8, height * 0.35 + 18);
    }, [partials, hoverCents, decayAmount, timeSlice]);

    return (
        <div>
            <div className="text-gray-400 text-[10px] mb-2">Spectral Mapping (Alignment Preview)</div>
            <canvas ref={canvasRef} />
        </div>
    );
};

const SpectrumEditor = ({
    partials,
    onChange,
    stretch,
    onStretchChange,
    waveform,
    onWaveformChange,
    onStartGhost,
    showAdvanced,
    onToggleAdvanced,
    onImportSample,
    fftPeakCount,
    onFftPeakCountChange,
    fftThreshold,
    onFftThresholdChange,
    fftSetBaseFreq,
    onFftSetBaseFreqChange,
    drawMode,
    onDrawModeChange,
    combPeriod,
    onCombPeriodChange,
    combDepth,
    onCombDepthChange,
    onApplyComb,
    hoverCents,
    decayAmount,
    timeSlice,
    onDragStart,
    onDragEnd
}: {
    partials: Partial[],
    onChange: (p: Partial[]) => void,
    stretch: number,
    onStretchChange: (s: number) => void,
    waveform: OscillatorType,
    onWaveformChange: (w: OscillatorType) => void,
    onStartGhost: () => void,
    showAdvanced: boolean,
    onToggleAdvanced: (v: boolean) => void,
    onImportSample: (file: File) => void,
    fftPeakCount: number,
    onFftPeakCountChange: (v: number) => void,
    fftThreshold: number,
    onFftThresholdChange: (v: number) => void,
    fftSetBaseFreq: boolean,
    onFftSetBaseFreqChange: (v: boolean) => void,
    drawMode: boolean,
    onDrawModeChange: (v: boolean) => void,
    combPeriod: number,
    onCombPeriodChange: (v: number) => void,
    combDepth: number,
    onCombDepthChange: (v: number) => void,
    onApplyComb: () => void,
    hoverCents: number | null,
    decayAmount: number,
    timeSlice: number,
    onDragStart?: () => void,
    onDragEnd?: () => void
}) => {
    
    const updateAmp = (idx: number, newAmp: number) => {
        const next = [...partials];
        next[idx] = { ...next[idx], amplitude: newAmp };
        onChange(next);
    };

    const updateRatio = (idx: number, newRatio: number) => {
        const safeRatio = clamp(newRatio, 0.0001, 64);
        const baseRatio = Math.pow(safeRatio, 1 / stretch);
        const next = [...partials];
        next[idx] = { ...next[idx], ratio: safeRatio, originalRatio: baseRatio };
        onChange(next);
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const fftInputRef = useRef<HTMLInputElement>(null);
    const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');
    const [ampZoom, setAmpZoom] = useState(1);

    const MAX_LOG_RATIO = Math.log2(64);
    const GRAPH_PADDING_PERCENT = 3;
    const BAR_WIDTH = 10;

    const getLeftPercent = (ratio: number) => {
        const log = Math.log2(Math.max(1, ratio));
        const usable = 100 - GRAPH_PADDING_PERCENT * 2;
        return GRAPH_PADDING_PERCENT + (log / MAX_LOG_RATIO) * usable;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onImportSample(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleImportClick = () => {
        fftInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onImportSample(file);
        e.currentTarget.value = '';
    };

    const stretchMin = 0.5;
    const stretchMax = 2.0;
    const minZoom = 0.5;
    const maxZoom = 2.5;
    const handleGraphWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.deltaY > 0 ? -0.1 : 0.1;
        setAmpZoom((prev) => clamp(prev + direction, minZoom, maxZoom));
    };
    const handleGraphWheelCapture = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div className="bg-black/50 border border-white/10 rounded-xl p-3 relative space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    Spectral Representation Layer
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setViewMode('graph')}
                        className={`text-[10px] px-2 py-1 rounded border font-bold ${viewMode === 'graph' ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                        Graph View
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`text-[10px] px-2 py-1 rounded border font-bold ${viewMode === 'table' ? 'bg-indigo-900/50 border-indigo-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                        Table View
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <label className="text-gray-400 text-[11px] font-mono">
                    Inharmonic Punch (S): <span className="text-indigo-400 font-bold">{stretch.toFixed(3)}</span>
                    <span className="ml-2 opacity-50 italic">
                        f_n = f_0 · n^S
                    </span>
                </label>
                <input
                    type="range" min={stretchMin} max={stretchMax} step="0.01"
                    value={stretch}
                    onChange={(e) => onStretchChange(parseFloat(e.target.value))}
                    onMouseDown={() => {
                        onStartGhost();
                        onDragStart?.();
                    }}
                    onMouseUp={onDragEnd}
                    onTouchStart={() => {
                        onStartGhost();
                        onDragStart?.();
                    }}
                    onTouchEnd={onDragEnd}
                    className="flex-1 accent-indigo-500"
                />
            </div>

            <div className="flex gap-4 items-center flex-wrap">
                <label className="flex items-center gap-2 text-gray-400 text-[11px]">
                    <span>Partial Waveform</span>
                    <select
                        value={waveform}
                        onChange={(e) => onWaveformChange(e.target.value as OscillatorType)}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[11px] [&>option]:bg-gray-900 [&>option]:text-white"
                    >
                        <option value="sine">Sine</option>
                        <option value="triangle">Triangle</option>
                        <option value="sawtooth">Sawtooth</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 text-gray-400 text-[11px] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showAdvanced}
                        onChange={(e) => onToggleAdvanced(e.target.checked)}
                        className="accent-indigo-500"
                    />
                    <span>Advanced View</span>
                </label>
                <label className="flex items-center gap-2 text-gray-400 text-[11px] cursor-pointer">
                    <input
                        type="checkbox"
                        checked={drawMode}
                        onChange={(e) => onDrawModeChange(e.target.checked)}
                        className="accent-indigo-500"
                    />
                    <span>Manual Draw</span>
                </label>
                <label className="flex items-center gap-2 text-gray-400 text-[11px]">
                    <span>Comb Period</span>
                    <input
                        type="number"
                        min="2"
                        step="1"
                        value={combPeriod}
                        onChange={(e) => onCombPeriodChange(parseInt(e.target.value, 10) || 2)}
                        className="w-14 bg-gray-900 border border-gray-700 rounded-lg p-1 text-white font-mono text-[11px]"
                    />
                </label>
                <label className="flex items-center gap-2 text-gray-400 text-[11px]">
                    <span>Comb Depth</span>
                    <span className="text-indigo-400 text-[10px]">{Math.round(combDepth * 100)}%</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={combDepth}
                        onChange={(e) => onCombDepthChange(parseFloat(e.target.value))}
                        className="w-20 accent-indigo-500"
                    />
                </label>
                <button
                    onClick={onApplyComb}
                    className="text-[10px] px-3 py-1.5 bg-indigo-900/50 border border-indigo-500/50 rounded-lg text-white font-bold hover:bg-indigo-800"
                >
                    APPLY COMB
                </button>
                <button
                    onClick={handleImportClick}
                    className="text-[10px] px-3 py-1.5 bg-red-900/30 border border-red-500/50 rounded-lg text-white font-bold hover:bg-red-800/50"
                >
                    IMPORT WAV
                </button>
                <input
                    ref={fftInputRef}
                    type="file"
                    accept=".wav,audio/wav"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
            <div className="text-gray-500 text-[10px]">
                Draw Mode: Click and drag in the graph area to paint partials.
            </div>

            {viewMode === 'table' ? (
                <div className="border border-gray-800 bg-gray-950 rounded-lg p-2">
                    <table className="w-full text-[10px] border-collapse">
                        <thead>
                            <tr className="text-gray-400 text-left">
                                <th className="p-2 border-b border-gray-800">Index</th>
                                <th className="p-2 border-b border-gray-800">Ratio</th>
                                <th className="p-2 border-b border-gray-800">Amplitude</th>
                                <th className="p-2 border-b border-gray-800">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partials.map((p, i) => (
                                <tr key={`${p.ratio}-${i}`} className="border-b border-gray-900">
                                    <td className="p-1 text-gray-500 w-11">{p.index ?? i + 1}</td>
                                    <td className="p-1">
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={Number(p.ratio.toFixed(4))}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (Number.isFinite(value)) updateRatio(i, value);
                                            }}
                                            className="w-20 bg-gray-900 border border-gray-700 rounded p-1 text-indigo-400 font-mono text-[10px]"
                                        />
                                    </td>
                                    <td className="p-1">
                                        <input
                                            type="number"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={Number(p.amplitude.toFixed(2))}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (Number.isFinite(value)) updateAmp(i, clamp(value, 0, 1));
                                            }}
                                            className="w-16 bg-gray-900 border border-gray-700 rounded p-1 text-white font-mono text-[10px]"
                                        />
                                    </td>
                                    <td className="p-1">
                                        <button
                                            onClick={() => updateAmp(i, 0)}
                                            className="text-[9px] px-2 py-1 bg-red-900/30 border border-red-500/50 rounded text-white font-bold hover:bg-red-800/50"
                                        >
                                            MUTE
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <>
                    <div
                        ref={containerRef}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onWheel={handleGraphWheel}
                        onWheelCapture={handleGraphWheelCapture}
                        className="relative w-full h-60 bg-gray-950 border border-gray-800 rounded-lg overflow-hidden"
                        style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
                    >
                        <div style={{ position: 'absolute', left: `${GRAPH_PADDING_PERCENT}%`, top: 8, bottom: 24, borderLeft: '1px solid #333', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: `${GRAPH_PADDING_PERCENT}%`, right: 10, bottom: 24, borderTop: '1px solid #333', pointerEvents: 'none' }} />
                        <div className="absolute left-1.5 top-2 text-gray-500 text-[9px] pointer-events-none" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>AMPLITUDE</div>
                        <div className="absolute right-2.5 bottom-1 text-gray-500 text-[9px] pointer-events-none">RATIO (LOG2)</div>
                        <div className="absolute right-2.5 top-2 text-gray-600 text-[9px] pointer-events-none">ZOOM {ampZoom.toFixed(2)}x</div>
                        {[1, 0.75, 0.5, 0.25, 0].map((val) => (
                            <div key={`amp-${val}`} style={{ position: 'absolute', left: `${GRAPH_PADDING_PERCENT}%`, right: 10, bottom: `${val * 100}%`, borderTop: '1px dashed #1a1a1a', pointerEvents: 'none' }}>
                                <span className="absolute text-[9px] text-gray-600" style={{ left: '-26px', top: '-6px' }}>{val.toFixed(2)}</span>
                            </div>
                        ))}
                        {[1, 2, 4, 8, 16, 32, 64].map(r => {
                            const left = getLeftPercent(r);
                            return (
                                <div key={r} style={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, borderLeft: '1px dashed #222', pointerEvents: 'none' }}>
                                    <span className="absolute top-1.5 left-0.5 text-[9px] text-gray-600">{r}/1</span>
                                </div>
                            );
                        })}

                        {partials.map((p, i) => {
                            const left = getLeftPercent(p.ratio);
                            const barColor = getHarmonicColor(p.ratio);
                            const startDrag = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                const startY = e.clientY;
                                const startAmp = p.amplitude;
                                const handleMove = (ev: MouseEvent) => {
                                    const diff = (startY - ev.clientY) / 200;
                                    const newAmp = clamp(startAmp + diff, 0, 1);
                                    updateAmp(i, newAmp);
                                };
                                const handleUp = () => {
                                    window.removeEventListener('mousemove', handleMove);
                                    window.removeEventListener('mouseup', handleUp);
                                };
                                window.addEventListener('mousemove', handleMove);
                                window.addEventListener('mouseup', handleUp);
                            };

                            return (
                                <div
                                    key={i}
                                    className="absolute bottom-0 pointer-events-none z-10 transition-all duration-100"
                                    style={{
                                        left: `${left}%`,
                                        width: `${BAR_WIDTH}px`,
                                        height: '100%',
                                        transform: 'translateX(-50%)'
                                    }}
                                >
                                    <div
                                        className="absolute bottom-0 left-0 w-full pointer-events-auto cursor-ns-resize transition-all duration-100"
                                        style={{
                                            height: `${Math.max(p.amplitude * 100 * ampZoom, 2)}%`,
                                            background: `linear-gradient(180deg, ${barColor} 0%, #0b0b0b 100%)`,
                                            boxShadow: `0 0 10px ${barColor}66`
                                        }}
                                        onMouseDown={startDrag}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            updateAmp(i, 0);
                                        }}
                                        title={`Partial ${i + 1}\nRatio: ${p.ratio.toFixed(4)}\nAmp: ${p.amplitude.toFixed(2)}`}
                                    />
                                    <div
                                        onMouseDown={startDrag}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            updateAmp(i, 0);
                                        }}
                                        className="absolute bottom-0 left-0 w-full h-1.5 bg-indigo-500/25 border-t border-indigo-500/50 pointer-events-auto cursor-ns-resize"
                                    />
                                    <div className="absolute bottom-1.5 left-1/2 text-[9px] text-gray-500 whitespace-nowrap" style={{ transform: 'translateX(-50%) rotate(-45deg)', transformOrigin: 'top center' }}>
                                        {p.ratio.toFixed(4)}
                                    </div>

                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-gray-600">
                                        {i + 1}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-[10px] text-gray-500 italic text-right">
                        * X-Axis: Log2(Ratio). Drag bars to adjust amplitude. Right-click a bar to mute.
                    </div>
                </>
            )}
        </div>
    );
};

export default SpectrumEditor;
