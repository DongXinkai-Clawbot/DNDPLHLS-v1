import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseGeneralRatio } from '../../../musicLogic';
import { startFrequency } from '../../../audioEngine';
import type { AppSettings } from '../../../types';
import { openConfirm } from '../../../utils/notifications';

type TuningMode = 'ratio' | 'hz' | 'tet';

interface SuperpositionNote {
    id: string;
    value: string; 
    mode: TuningMode;
    amplitude: number; 
    phase: number; 
    active: boolean;
}

interface HarmonicSuperpositionProps {
    settings: AppSettings;
}

export const HarmonicSuperposition: React.FC<HarmonicSuperpositionProps> = ({ settings }) => {
    const [notes, setNotes] = useState<SuperpositionNote[]>([
        { id: '1', value: '1/1', mode: 'ratio', amplitude: 1, phase: 0, active: true },
        { id: '2', value: '3/2', mode: 'ratio', amplitude: 0.8, phase: 0, active: true }
    ]);
    const [baseFreq, setBaseFreq] = useState(440);
    const [duration, setDuration] = useState(2);
    const [instrument, setInstrument] = useState<string>('sine');
    const [zoom, setZoom] = useState(50); 
    const [offset, setOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const lastX = useRef(0);

    const [canvasHeight, setCanvasHeight] = useState(160);
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartY = useRef(0);
    const resizeStartHeight = useRef(0);
    const resizeDirection = useRef<'top' | 'bottom' | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [_, setTick] = useState(0);
    useEffect(() => {
        const handleResize = () => setTick(t => t + 1);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [fourierEnabled, setFourierEnabled] = useState(false);
    const [fourierCount, setFourierCount] = useState(8);
    const [fourierAmps, setFourierAmps] = useState<number[]>([1, 0, 0, 0, 0, 0, 0, 0]);
    const [fourierPhases, setFourierPhases] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

    const [drawMode, setDrawMode] = useState(false);
    const [drawPoints, setDrawPoints] = useState<{ x: number, y: number }[]>([]);

    const applyFourierState = (amps: number[], phases: number[]) => {
        const newNotes: SuperpositionNote[] = amps.map((amp, i) => ({
            id: `fourier-${i + 1}`,
            value: `${i + 1}/1`,
            mode: 'ratio',
            amplitude: Math.abs(amp), 
            phase: amp < 0 ? phases[i] + Math.PI : phases[i], 
            active: true
        }));
        setNotes(newNotes);
    };

    useEffect(() => {
        if (fourierEnabled) {
            applyFourierState(fourierAmps, fourierPhases);
        }
    }, [fourierEnabled]);

    const handleFourierPreset = (type: 'saw' | 'square' | 'triangle' | 'pulse') => {
        const amps = new Array(fourierCount).fill(0);
        const phases = new Array(fourierCount).fill(0);

        for (let i = 0; i < fourierCount; i++) {
            const n = i + 1;
            if (type === 'saw') {
                amps[i] = 1 / n;
            } else if (type === 'square') {
                amps[i] = n % 2 === 1 ? 1 / n : 0;
            } else if (type === 'triangle') {
                const oddIndex = (n - 1) / 2;
                if (n % 2 === 1) {
                    const sign = Math.pow(-1, oddIndex);
                    amps[i] = (1 / (n * n)) * sign;
                } else {
                    amps[i] = 0;
                }
            } else if (type === 'pulse') {
                amps[i] = 1;
            }
        }
        setFourierAmps(amps);
        setFourierPhases(phases);
        applyFourierState(amps, phases);
    };

    const updateFourierAmp = (index: number, val: number) => {
        const next = [...fourierAmps];
        next[index] = val;
        setFourierAmps(next);
        applyFourierState(next, fourierPhases);
    };

    const updateFourierPhase = (index: number, val: number) => {
        const next = [...fourierPhases];
        next[index] = val;
        setFourierPhases(next);
        applyFourierState(fourierAmps, next);
    };

    const updateNote = (id: string, updates: Partial<SuperpositionNote>) => {
        const newNotes = notes.map(n => n.id === id ? { ...n, ...updates } : n);
        setNotes(newNotes);

        if (fourierEnabled) {
            const index = notes.findIndex(n => n.id === id);
            if (index !== -1 && index < fourierCount) {
                const note = newNotes[index];
                const nextAmps = [...fourierAmps];
                const nextPhases = [...fourierPhases];

                const currentSign = nextAmps[index] < 0 ? -1 : 1;
                nextAmps[index] = note.amplitude * currentSign;
                nextPhases[index] = note.phase;

                setFourierAmps(nextAmps);
                setFourierPhases(nextPhases);
            }
        }
    };

    const performFFT = (points: { x: number, y: number }[]) => {
        if (points.length < 2) return;

        const N = 1024;
        const samples = new Float32Array(N);

        points.sort((a, b) => a.x - b.x);

        const minX = points[0].x;
        const maxX = points[points.length - 1].x;
        const width = maxX - minX;

        for (let i = 0; i < N; i++) {
            const t = i / N; 
            const targetX = minX + t * width;

            let val = 0;
            
            for (let j = 0; j < points.length - 1; j++) {
                if (points[j].x <= targetX && points[j + 1].x >= targetX) {
                    const denominator = points[j + 1].x - points[j].x;
                    if (denominator === 0) {
                        val = points[j].y;
                    } else {
                        const tSeg = (targetX - points[j].x) / denominator;
                        val = points[j].y + tSeg * (points[j + 1].y - points[j].y);
                    }
                    break;
                }
            }
            
            if (i === N - 1 && points.length > 0) val = points[points.length - 1].y;

            samples[i] = val;
        }

        const newAmps = new Array(fourierCount).fill(0);
        const newPhases = new Array(fourierCount).fill(0);

        for (let k = 1; k <= fourierCount; k++) {
            let real = 0;
            let imag = 0;
            for (let n = 0; n < N; n++) {
                
                if (!isNaN(samples[n])) {
                    const theta = (2 * Math.PI * k * n) / N;
                    real += samples[n] * Math.cos(theta);
                    imag -= samples[n] * Math.sin(theta);
                }
            }
            real *= 2 / N;
            imag *= 2 / N;

            const mag = Math.sqrt(real * real + imag * imag) || 0; 
            const phase = Math.atan2(imag, real) || 0; 

            let p = phase;
            if (p < 0) p += 2 * Math.PI;

            newAmps[k - 1] = mag;
            newPhases[k - 1] = p;
        }

        setFourierAmps(newAmps);
        setFourierPhases(newPhases);
        applyFourierState(newAmps, newPhases);
    };

    useEffect(() => {
        const move = (e: MouseEvent) => {
            if (!isResizing) return;
            const delta = e.clientY - resizeStartY.current;
            if (resizeDirection.current === 'bottom') {
                setCanvasHeight(Math.max(100, Math.min(800, resizeStartHeight.current + delta)));
            } else {
                setCanvasHeight(Math.max(100, Math.min(800, resizeStartHeight.current - delta)));
            }
        };
        const up = () => {
            if (isResizing) {
                setIsResizing(false);
                document.body.style.cursor = '';
                resizeDirection.current = null;
            }
        };
        if (isResizing) {
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        }
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
        };
    }, [isResizing]);

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        resizeDirection.current = 'bottom';
        resizeStartY.current = e.clientY;
        resizeStartHeight.current = canvasHeight;
        document.body.style.cursor = 'ns-resize';
    };

    const handleResizeTopMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        resizeDirection.current = 'top';
        resizeStartY.current = e.clientY;
        resizeStartHeight.current = canvasHeight;
        document.body.style.cursor = 'ns-resize';
    };

    const toggleDrawMode = () => {
        if (!drawMode) {
            setDrawMode(true);
            setZoom(0.5); 
            setOffset(0);
            setDrawPoints([]);
        } else {
            setDrawMode(false);
            setDrawPoints([]);
        }
    };

    const getFrequency = (note: SuperpositionNote): number => {
        try {
            if (note.mode === 'hz') {
                return parseFloat(note.value) || 0;
            } else if (note.mode === 'tet') {
                
                const parts = note.value.includes('\\') ? note.value.split('\\') : note.value.split('/');
                if (parts.length === 2) {
                    const steps = parseFloat(parts[0]);
                    const div = parseFloat(parts[1]);
                    if (div !== 0) return baseFreq * Math.pow(2, steps / div);
                }
                return baseFreq;
            } else {
                
                const { n, d } = parseGeneralRatio(note.value);
                if (d === 0n) return 0;
                return baseFreq * (Number(n) / Number(d));
            }
        } catch (e) {
            return 0;
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        const desiredWidth = Math.floor(rect.width * dpr);
        const desiredHeight = Math.floor(rect.height * dpr);

        if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
            canvas.width = desiredWidth;
            canvas.height = desiredHeight;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        const activeNotes = notes.filter(n => n.active);
        const maxTotalAmp = activeNotes.reduce((sum, n) => sum + n.amplitude, 0) || 1;

        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const verticalScale = 80; 
        const yTicks = [0, 0.5, 1.0, -0.5, -1.0, 1.5, -1.5, 2.0, -2.0];

        yTicks.forEach(tickVal => {
            
            const pixelY = height / 2 - (tickVal * verticalScale);
            if (pixelY < 0 || pixelY > height) return;

            ctx.fillStyle = '#222';
            ctx.fillRect(0, pixelY, width, 1); 

            ctx.fillStyle = '#666';
            ctx.fillText(tickVal.toFixed(1), 4, pixelY - 6);
        });

        const timeWindow = (2 / baseFreq) * zoom;
        const step = Math.pow(10, Math.floor(Math.log10(timeWindow))) / 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const startT = ((0 - offset) / width) * timeWindow;
        const endT = ((width - offset) / width) * timeWindow;
        const firstTick = Math.ceil(startT / step) * step;

        for (let t = firstTick; t < endT; t += step) {
            const x = (t / timeWindow) * width + offset;
            ctx.fillStyle = '#222';
            ctx.fillRect(x, 0, 1, height); 

            ctx.fillStyle = '#666';
            ctx.fillText((t * 1000).toFixed(1) + 'ms', x, height - 4);
        }

        if (activeNotes.length === 0) return;

        ctx.beginPath();
        ctx.strokeStyle = '#60A5FA'; 
        ctx.lineWidth = 2;

        const drawWidth = Math.ceil(width);

        for (let x = 0; x <= drawWidth; x++) {
            const t = ((x - offset) / width) * timeWindow;
            let y = 0;
            let maxAmp = 0;

            activeNotes.forEach(n => {
                const freq = getFrequency(n);
                const val = n.amplitude * Math.sin(2 * Math.PI * freq * t + n.phase);
                y += val;
                maxAmp += n.amplitude;
            });

            const normalizedY = y * verticalScale;
            const canvasY = height / 2 - normalizedY;

            if (x === 0) ctx.moveTo(x, canvasY);
            else ctx.lineTo(x, canvasY);
        }
        ctx.stroke();

        if (drawPoints.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#22C55E'; 
            ctx.lineWidth = 3;
            drawPoints.forEach((p, i) => {
                
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }

    }, [notes, baseFreq, zoom, offset, canvasHeight, _, drawPoints]); 

    const handleMouseDown = (e: React.MouseEvent) => {
        if (drawMode) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDrawPoints([{ x, y }]);
        } else {
            setIsDragging(true);
            lastX.current = e.clientX;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (drawMode && e.buttons === 1) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDrawPoints(prev => [...prev, { x, y }]);
        } else if (isDragging) {
            const delta = e.clientX - lastX.current;
            lastX.current = e.clientX;
            setOffset(prev => prev + delta);
        }
    };

    const handleMouseUp = () => {
        if (drawMode && drawPoints.length > 5) {
            
            const canvas = canvasRef.current;
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const height = rect.height; 
                const width = rect.width;   
                const verticalScale = 80;   

                const logicalPoints = drawPoints.map(p => ({
                    x: p.x / width, 
                    y: -(p.y - height / 2) / verticalScale 
                }));
                performFFT(logicalPoints);
                setDrawMode(false);
                setDrawPoints([]);
            }
        }
        setIsDragging(false);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const factor = 1.1;
            if (e.deltaY > 0) {
                setZoom(z => Math.min(200, z * factor));
            } else {
                setZoom(z => Math.max(0.1, z / factor));
            }
        };
        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    const handlePlay = () => {
        const activeNotes = notes.filter(n => n.active);
        const stops: (() => void)[] = [];

        const tempSettings = { ...settings, waveform: instrument };

        activeNotes.forEach(n => {
            const freq = getFrequency(n);
            if (freq > 0) {
                
                const stop = startFrequency(freq, tempSettings as any, 'chord', 0, undefined, { velocity: n.amplitude });
                stops.push(stop);
            }
        });

        setTimeout(() => {
            stops.forEach(s => s());
        }, duration * 1000);
    };

    const addNote = () => {
        if (notes.length >= 50) return;
        setNotes([...notes, {
            id: Date.now().toString(),
            value: '1/1',
            mode: 'ratio',
            amplitude: 0.5,
            phase: 0,
            active: true
        }]);
    };

    const removeNote = (id: string) => {
        setNotes(notes.filter(n => n.id !== id));
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 h-full">
            <div className="bg-gray-900/50 border border-gray-700 rounded p-3 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Base Freq (Hz)</label>
                    <input
                        type="number"
                        value={baseFreq}
                        onChange={e => setBaseFreq(parseFloat(e.target.value) || 440)}
                        className="bg-black border border-gray-600 rounded p-1 text-xs text-white w-20"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Duration (s)</label>
                    <input
                        type="number"
                        value={duration}
                        onChange={e => setDuration(parseFloat(e.target.value) || 2)}
                        className="bg-black border border-gray-600 rounded p-1 text-xs text-white w-16"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Timbre</label>
                    <select
                        value={instrument}
                        onChange={e => setInstrument(e.target.value)}
                        className="bg-black border border-gray-600 rounded p-1 text-xs text-white w-24"
                    >
                        <option value="sine">Sine</option>
                        <option value="triangle">Triangle</option>
                        <option value="square">Square</option>
                        <option value="sawtooth">Sawtooth</option>
                        <option value="organ">Organ</option>
                        <option value="strings">Strings</option>
                    </select>
                </div>
                <button
                    onClick={handlePlay}
                    className="bg-green-700 hover:bg-green-600 text-white px-4 py-1.5 rounded font-bold shadow-lg ml-auto"
                >
                    ▶ Play Superposition
                </button>
            </div>

            <div
                className="bg-black border border-gray-700 rounded overflow-hidden relative shrink-0 flex flex-col"
                style={{ height: canvasHeight }}
            >
                <div
                    className="h-2 bg-gray-800 hover:bg-blue-600 cursor-ns-resize flex items-center justify-center transition-colors absolute top-0 w-full opacity-50 hover:opacity-100 z-10"
                    onMouseDown={handleResizeTopMouseDown}
                >
                    <div className="w-10 h-1 bg-gray-500 rounded-full" />
                </div>
                <canvas
                    ref={canvasRef}
                    className="w-full h-full object-cover cursor-grab active:cursor-grabbing flex-1"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />
                <div className="absolute top-2 right-2 flex gap-1 pointer-events-none">
                    <span className="bg-gray-800/80 text-white px-2 rounded text-xs flex items-center shadow">
                        Drag to Pan • Scroll to Zoom
                    </span>
                </div>
                <div
                    className="h-2 bg-gray-800 hover:bg-blue-600 cursor-ns-resize flex items-center justify-center transition-colors absolute bottom-0 w-full opacity-50 hover:opacity-100 z-10"
                    onMouseDown={handleResizeMouseDown}
                >
                    <div className="w-10 h-1 bg-gray-500 rounded-full" />
                </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded p-2">
                <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={fourierEnabled}
                            onChange={e => {
                                if (e.target.checked) {
                                    openConfirm({
                                        title: 'Enable Fourier Series',
                                        message: `Warning: ${fourierCount - 1} additional oscillators will be added.`,
                                        confirmLabel: 'Enable',
                                        cancelLabel: 'Cancel',
                                        onConfirm: () => setFourierEnabled(true)
                                    });
                                } else {
                                    setFourierEnabled(false);
                                }
                            }}
                            className="w-4 h-4 accent-blue-500 rounded bg-gray-700 border-gray-600"
                        />
                        <span className="text-[10px] uppercase font-bold text-gray-400">Fourier Series Simulation</span>
                    </label>
                    {fourierEnabled && (
                        <div className="flex gap-2">
                            <button onClick={() => toggleDrawMode()} className={`text-[9px] px-2 py-0.5 rounded border ${drawMode ? 'bg-green-600 text-white border-green-400' : 'bg-gray-800 hover:bg-white hover:text-black border-gray-600'}`}>
                                {drawMode ? 'Drawing...' : '✎ Draw Wave (FFT)'}
                            </button>
                            <div className="w-px bg-gray-700 mx-1"></div>
                            <button onClick={() => handleFourierPreset('saw')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded border border-gray-600">Saw</button>
                            <button onClick={() => handleFourierPreset('square')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded border border-gray-600">Square</button>
                            <button onClick={() => handleFourierPreset('triangle')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded border border-gray-600">Tri</button>
                            <button onClick={() => handleFourierPreset('pulse')} className="text-[9px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded border border-gray-600">Pulse</button>
                        </div>
                    )}
                </div>

                {fourierEnabled && (
                    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex gap-2 items-center">
                            <span className="text-[10px] text-gray-500">Harmonics: {fourierCount}</span>
                            <input
                                type="range"
                                min="1"
                                max="32"
                                value={fourierCount}
                                onChange={e => {
                                    const c = parseInt(e.target.value);
                                    setFourierCount(c);
                                    setFourierAmps(prev => {
                                        const next = new Array(c).fill(0);
                                        prev.forEach((v, i) => { if (i < c) next[i] = v; });
                                        return next;
                                    });
                                    setFourierPhases(prev => {
                                        const next = new Array(c).fill(0);
                                        prev.forEach((v, i) => { if (i < c) next[i] = v; });
                                        return next;
                                    });
                                }}
                                className="flex-1 h-1 accent-blue-500 bg-gray-700 rounded appearance-none"
                            />
                        </div>

                        <div className="h-32 bg-black border border-gray-800 rounded relative flex items-center p-1 gap-1">
                            <div className="absolute top-1/2 left-0 w-full h-px bg-gray-700 z-0" />

                            {fourierAmps.map((amp, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center group relative h-full">
                                    <input
                                        type="number"
                                        value={amp.toFixed(2)}
                                        onChange={(e) => updateFourierAmp(i, parseFloat(e.target.value) || 0)}
                                        className="w-full text-[8px] bg-transparent text-center text-gray-400 focus:text-white outline-none mb-0.5"
                                        step="0.1"
                                    />

                                    <div className="flex-1 w-full relative flex items-center justify-center">
                                        <div
                                            className={`w-full transition-all relative ${amp >= 0 ? 'bg-blue-500' : 'bg-red-500'} opacity-80 hover:opacity-100`}
                                            style={{
                                                height: `${Math.abs(amp) * 50}%`,
                                                marginTop: amp > 0 ? 0 : `${Math.abs(amp) * 50}%`,
                                                marginBottom: amp < 0 ? 0 : `${Math.abs(amp) * 50}%`,
                                            }}
                                        />

                                        <div className="absolute inset-0 cursor-ns-resize z-10"
                                            onMouseMove={(e) => {
                                                if (e.buttons === 1) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    
                                                    const normalizedY = (e.clientY - rect.top) / rect.height;
                                                    const val = 1 - 2 * normalizedY;
                                                    updateFourierAmp(i, Math.max(-1, Math.min(1, val)));
                                                }
                                            }}
                                            onMouseDown={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const normalizedY = (e.clientY - rect.top) / rect.height;
                                                const val = 1 - 2 * normalizedY;
                                                updateFourierAmp(i, Math.max(-1, Math.min(1, val)));
                                            }}
                                        />
                                    </div>

                                    <div className="h-6 w-full relative mt-1 bg-gray-900 border-t border-gray-800 flex flex-col justify-end">
                                        <input
                                            type="number"
                                            value={(fourierPhases[i] || 0).toFixed(2)}
                                            onChange={(e) => updateFourierPhase(i, parseFloat(e.target.value) || 0)}
                                            className="w-full text-[8px] bg-transparent text-center text-gray-500 focus:text-white outline-none z-30 relative"
                                            step="0.1"
                                        />
                                        <input
                                            type="range"
                                            min="0"
                                            max={2 * Math.PI}
                                            step="0.1"
                                            value={fourierPhases[i] || 0}
                                            onChange={(e) => updateFourierPhase(i, parseFloat(e.target.value))}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                                            title={`Phase: ${(fourierPhases[i] || 0).toFixed(2)} rad`}
                                        />
                                        <div
                                            className="absolute top-0 bottom-0 w-0.5 bg-purple-500 pointer-events-none opacity-50"
                                            style={{ left: `${((fourierPhases[i] || 0) / (2 * Math.PI)) * 100}%` }}
                                        />
                                    </div>

                                    <span className="text-[8px] text-gray-600 font-mono">{i + 1}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-[9px] text-gray-500 text-center italic">
                            Top: Amplitude (±1.0) • Bottom: Phase (0-2π)
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden flex flex-col bg-gray-900/30 border border-gray-700 rounded">
                <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <span className="text-xs font-bold text-gray-400 uppercase">Oscillators ({notes.length}/50)</span>
                    <button onClick={addNote} className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                        + Add Oscillator
                    </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar p-2 space-y-2 flex-1">
                    {notes.map((note, idx) => (
                        <div key={note.id} className={`flex items-center gap-2 p-2 rounded border ${note.active ? 'bg-gray-800/60 border-gray-600' : 'bg-gray-900/60 border-gray-800 opacity-60'}`}>
                            <div className="flex flex-col gap-1 w-8 text-center">
                                <span className="text-[9px] text-gray-500 font-bold">#{idx + 1}</span>
                                <input
                                    type="checkbox"
                                    checked={note.active}
                                    onChange={e => updateNote(note.id, { active: e.target.checked })}
                                    className="w-3 h-3 accent-blue-500 self-center"
                                />
                            </div>

                            <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-4 flex flex-col gap-1">
                                    <div className="flex rounded bg-black border border-gray-700 overflow-hidden">
                                        <button
                                            onClick={() => updateNote(note.id, { mode: 'ratio', value: '1/1' })}
                                            className={`flex-1 text-[9px] py-0.5 ${note.mode === 'ratio' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            Ratio
                                        </button>
                                        <button
                                            onClick={() => updateNote(note.id, { mode: 'hz', value: '440' })}
                                            className={`flex-1 text-[9px] py-0.5 ${note.mode === 'hz' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            Hz
                                        </button>
                                        <button
                                            onClick={() => updateNote(note.id, { mode: 'tet', value: '0\\12' })}
                                            className={`flex-1 text-[9px] py-0.5 ${note.mode === 'tet' ? 'bg-blue-900 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            TET
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={note.value}
                                        onChange={e => updateNote(note.id, { value: e.target.value })}
                                        className="w-full bg-black border border-gray-600 rounded px-1 py-0.5 text-xs text-white font-mono"
                                        placeholder={note.mode === 'ratio' ? "3/2" : note.mode === 'hz' ? "440" : "7\\12"}
                                    />
                                </div>

                                <div className="col-span-3 flex flex-col gap-1">
                                    <label className="text-[9px] text-gray-500 uppercase">Amp: {note.amplitude.toFixed(2)}</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={note.amplitude}
                                        onChange={e => updateNote(note.id, { amplitude: parseFloat(e.target.value) })}
                                        className="w-full h-1 accent-blue-400 bg-gray-700 rounded appearance-none"
                                    />
                                </div>

                                <div className="col-span-3 flex flex-col gap-1">
                                    <label className="text-[9px] text-gray-500 uppercase">Phase: {(note.phase / Math.PI).toFixed(2)}π</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max={2 * Math.PI}
                                        step={0.1}
                                        value={note.phase}
                                        onChange={e => updateNote(note.id, { phase: parseFloat(e.target.value) })}
                                        className="w-full h-1 accent-purple-400 bg-gray-700 rounded appearance-none"
                                    />
                                </div>

                                <div className="col-span-2 flex flex-col items-end justify-center">
                                    <span className="text-[10px] font-mono text-gray-400">{getFrequency(note).toFixed(1)} Hz</span>
                                    <button
                                        onClick={() => removeNote(note.id)}
                                        className="text-[9px] text-red-400 hover:text-red-200 uppercase font-bold mt-1"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
