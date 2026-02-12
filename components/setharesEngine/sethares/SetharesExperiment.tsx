import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    DEFAULT_A, DEFAULT_B, DEFAULT_PEAK_COUNT, DEFAULT_FFT_THRESHOLD,
    DEFAULT_SUSTAIN_START, DEFAULT_SUSTAIN_END, DEFAULT_DECAY_AMOUNT, DEFAULT_TIME_SLICE, DEFAULT_CB_SCALE,
    DEFAULT_MINIMA_DEPTH, DEFAULT_MINIMA_WIDTH, DEFAULT_BEAT_DEPTH, DEFAULT_MORPH_FRAMES, WAVETABLE_SAMPLES,
    Partial, Minima, RoughnessModel, AxisMode, MidiMappingMode,
    getAudioCtx, clamp, gcd, normalizeWaveform, resolvePartialWaveform,
    applySpectralDecay, extractFftPeaks, applyEnvelope
} from './utils';
import SetharesExperimentView from './SetharesExperimentView';
import { useSetharesHoverAudio } from './useSetharesHoverAudio';
import { useSetharesMidi } from './useSetharesMidi';
import { useSetharesRoughnessCurve } from './useSetharesRoughnessCurve';
import { notifyError, notifySuccess, notifyWarning } from '../../../utils/notifications';
import { useStore } from '../../../store';
import { DEFAULT_TIMBRE_PATCHES } from '../../../timbrePresets';

const buildDefaultPartials = (): Partial[] => (
    Array.from({ length: 16 }, (_, i) => ({
        index: i + 1,
        ratio: i + 1,
        amplitude: 1 / (i + 1),
        originalRatio: i + 1,
        waveform: 'sine'
    }))
);

const buildHarmonicSeriesRatios = (count: number, existingKeys?: Set<string>) => {
    if (!Number.isFinite(count) || count <= 0) return [];
    const out: Array<{ n: number; d: number }> = [];
    const seen = existingKeys ? new Set(existingKeys) : new Set<string>();
    const maxN = Math.max(128, count * 4);
    for (let n = 1; n <= maxN && out.length < count; n += 1) {
        let d = 1;
        while (n / d >= 2) d *= 2;
        const div = gcd(n, d);
        const nn = Math.max(1, Math.round(n / div));
        const dd = Math.max(1, Math.round(d / div));
        const key = `${nn}/${dd}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ n: nn, d: dd });
    }
    return out;
};

const SetharesExperiment = () => {
    const { settings, updateSettings } = useStore((s) => ({
        settings: s.settings,
        updateSettings: s.updateSettings
    }));

    const [partials, setPartials] = useState<Partial[]>(() => buildDefaultPartials());

    const [undoStack, setUndoStack] = useState<Partial[][]>([]);
    const [redoStack, setRedoStack] = useState<Partial[][]>([]);
    const partialsRef = useRef<Partial[]>(partials);
    const historyLockRef = useRef(false);
    useEffect(() => {
        partialsRef.current = partials;
    }, [partials]);

    const clonePartials = useCallback((list: Partial[]) => list.map(p => ({ ...p })), []);

    const setPartialsWithHistory = useCallback((next: Partial[] | ((prev: Partial[]) => Partial[])) => {
        setPartials(prev => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            if (!historyLockRef.current) {
                setUndoStack(stack => [...stack, clonePartials(prev)].slice(-60));
                setRedoStack([]);
                historyLockRef.current = true;
                setTimeout(() => {
                    historyLockRef.current = false;
                }, 200);
            }
            return clonePartials(resolved);
        });
    }, [clonePartials]);

    const handleUndo = useCallback(() => {
        setUndoStack(stack => {
            if (stack.length === 0) return stack;
            const previous = stack[stack.length - 1];
            setRedoStack(r => [...r, clonePartials(partialsRef.current)].slice(-60));
            setPartials(clonePartials(previous));
            return stack.slice(0, -1);
        });
    }, [clonePartials]);

    const handleRedo = useCallback(() => {
        setRedoStack(stack => {
            if (stack.length === 0) return stack;
            const next = stack[stack.length - 1];
            setUndoStack(u => [...u, clonePartials(partialsRef.current)].slice(-60));
            setPartials(clonePartials(next));
            return stack.slice(0, -1);
        });
    }, [clonePartials]);

    const resetHistory = useCallback(() => {
        setUndoStack([]);
        setRedoStack([]);
    }, []);

    const [stretch, setStretch] = useState(1.0);
    const [curveData, setCurveData] = useState<{ cents: number, r: number }[]>([]);
    const [ghostCurveData, setGhostCurveData] = useState<{ cents: number, r: number }[] | null>(null);
    const [showGhostCurve, setShowGhostCurve] = useState(false);
    const [minima, setMinima] = useState<Minima[]>([]);
    const [hoverCents, setHoverCents] = useState<number | null>(null);
    const [showTetOverlay, setShowTetOverlay] = useState(true);
    const [showHarmonicOverlay, setShowHarmonicOverlay] = useState(true);
    const [tetDivisions, setTetDivisions] = useState(12);
    const [masterVolume, setMasterVolume] = useState(0.5);
    const [baseFreq, setBaseFreq] = useState(220);
    const [snapToMinima, setSnapToMinima] = useState(false);
    const [waveform, setWaveform] = useState<OscillatorType>('sine');
    const [algoParams, setAlgoParams] = useState({ a: DEFAULT_A, b: DEFAULT_B });
    const [roughnessModel, setRoughnessModel] = useState<RoughnessModel>('sethares');
    const [cbScale, setCbScale] = useState(DEFAULT_CB_SCALE);
    const [decayAmount, setDecayAmount] = useState(DEFAULT_DECAY_AMOUNT);
    const [timeSlice, setTimeSlice] = useState(DEFAULT_TIME_SLICE);
    const [minimaFilter, setMinimaFilter] = useState({ depth: DEFAULT_MINIMA_DEPTH, width: DEFAULT_MINIMA_WIDTH });
    const [fftPeakCount, setFftPeakCount] = useState(DEFAULT_PEAK_COUNT);
    const [fftThreshold, setFftThreshold] = useState(DEFAULT_FFT_THRESHOLD);
    const [fftSetBaseFreq, setFftSetBaseFreq] = useState(true);
    const [drawMode, setDrawMode] = useState(false);
    const [combPeriod, setCombPeriod] = useState(2);
    const [combDepth, setCombDepth] = useState(1);
    const [axisMode, setAxisMode] = useState<AxisMode>('cents');
    const [triadFixedF2, setTriadFixedF2] = useState(702);
    const [heatmapGain, setHeatmapGain] = useState(2.2);
    const [beatEnabled, setBeatEnabled] = useState(true);
    const [beatDepth, setBeatDepth] = useState(DEFAULT_BEAT_DEPTH);
    const [snapModifierActive, setSnapModifierActive] = useState(false);
    const [midiEnabled, setMidiEnabled] = useState(false);
    const [midiInputs, setMidiInputs] = useState<any[]>([]);
    const [midiInputId, setMidiInputId] = useState('');
    const [midiMappingMode, setMidiMappingMode] = useState<MidiMappingMode>('chromatic');
    const [midiBaseNote, setMidiBaseNote] = useState(60);
    const [midiNoteBendRange, setMidiNoteBendRange] = useState(2);
    const [midiChannel, setMidiChannel] = useState(-1);
    const [morphFrames, setMorphFrames] = useState(DEFAULT_MORPH_FRAMES);
    const [triadHighlight, setTriadHighlight] = useState<number[] | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [timestamp, setTimestamp] = useState(new Date().toISOString());
    const [locateSignal, setLocateSignal] = useState<{ cents: number; id: number } | null>(null);

    const [maxRatioDenominator, setMaxRatioDenominator] = useState(32);
    const [harmonicCount, setHarmonicCount] = useState(8);
    const [showHarmonicAdvanced, setShowHarmonicAdvanced] = useState(false);
    const [harmonicsConfig, setHarmonicsConfig] = useState<Array<{ n: number; d: number; enabled: boolean; intensity: number }>>([
        { n: 1, d: 1, enabled: true, intensity: 0.6 },
        { n: 9, d: 8, enabled: true, intensity: 0.6 },
        { n: 5, d: 4, enabled: true, intensity: 0.6 },
        { n: 4, d: 3, enabled: true, intensity: 0.6 },
        { n: 3, d: 2, enabled: true, intensity: 0.6 },
        { n: 5, d: 3, enabled: true, intensity: 0.6 },
        { n: 15, d: 8, enabled: true, intensity: 0.6 },
        { n: 2, d: 1, enabled: true, intensity: 0.6 },
        { n: 7, d: 4, enabled: false, intensity: 0.7 },
        { n: 11, d: 8, enabled: false, intensity: 0.5 },
        { n: 13, d: 8, enabled: false, intensity: 0.5 },
        { n: 7, d: 6, enabled: false, intensity: 0.6 },
    ]);

    useEffect(() => {
        const targetCount = clamp(Math.round(harmonicCount || 1), 1, 55);
        setHarmonicsConfig(prev => {
            if (prev.length >= targetCount) return prev;
            const existingKeys = new Set(prev.map(h => `${h.n}/${h.d}`));
            const additions = buildHarmonicSeriesRatios(targetCount - prev.length, existingKeys);
            if (additions.length === 0) return prev;
            return [
                ...prev,
                ...additions.map(h => ({ ...h, enabled: true, intensity: 0.6 }))
            ];
        });
    }, [harmonicCount]);
    const [gridFollowsEdo, setGridFollowsEdo] = useState(false);
    const [maxRange, setMaxRange] = useState(1200);
    const [showVerification, setShowVerification] = useState(true);

    const [customTargets, setCustomTargets] = useState<Array<{ id: string; cents: number; roughness: number }>>([]);
    const [targetCentsInput, setTargetCentsInput] = useState('0');
    const [targetRoughnessInput, setTargetRoughnessInput] = useState('0.25');
    const [includeFundamental, setIncludeFundamental] = useState(true);
    const [customTargetContinuous, setCustomTargetContinuous] = useState(false);

    const resetEngine = useCallback(() => {
        setPartials(buildDefaultPartials());
        resetHistory();
        setStretch(1.0);
        setCurveData([]);
        setGhostCurveData(null);
        setShowGhostCurve(false);
        setMinima([]);
        setHoverCents(null);
        setMasterVolume(0.5);
        setBaseFreq(220);
        setSnapToMinima(false);
        setWaveform('sine');
        setAlgoParams({ a: DEFAULT_A, b: DEFAULT_B });
        setRoughnessModel('sethares');
        setCbScale(DEFAULT_CB_SCALE);
        setDecayAmount(DEFAULT_DECAY_AMOUNT);
        setTimeSlice(DEFAULT_TIME_SLICE);
        setMinimaFilter({ depth: DEFAULT_MINIMA_DEPTH, width: DEFAULT_MINIMA_WIDTH });
        setFftPeakCount(DEFAULT_PEAK_COUNT);
        setFftThreshold(DEFAULT_FFT_THRESHOLD);
        setFftSetBaseFreq(true);
        setDrawMode(false);
        setCombPeriod(2);
        setCombDepth(1);
        setAxisMode('cents');
        setTriadFixedF2(702);
        setHeatmapGain(2.2);
        setBeatEnabled(true);
        setBeatDepth(DEFAULT_BEAT_DEPTH);
        setSnapModifierActive(false);
        setMidiEnabled(false);
        setMidiInputId('');
        setMidiMappingMode('chromatic');
        setMidiBaseNote(60);
        setMidiNoteBendRange(2);
        setMidiChannel(-1);
        setMorphFrames(DEFAULT_MORPH_FRAMES);
        setTriadHighlight(null);
        setShowAdvanced(true);
        setIsDragging(false);
        setLocateSignal(null);
        setShowTetOverlay(true);
        setShowHarmonicOverlay(true);
        setTetDivisions(12);
        setShowVerification(true);
        setCustomTargets([]);
        setTargetCentsInput('0');
        setTargetRoughnessInput('0.25');
        setIncludeFundamental(true);
        setCustomTargetContinuous(false);
    }, [resetHistory]);

    const normalizeRoughnessInput = useCallback((value: number) => {
        if (!Number.isFinite(value)) return null;
        const raw = value > 1.5 ? value / 100 : value;
        return clamp(raw, 0, 1);
    }, []);

    const buildPartialsFromTargets = useCallback((targets: Array<{ cents: number; roughness: number }>) => {
        const cleaned = targets
            .filter(t => Number.isFinite(t.cents) && Number.isFinite(t.roughness))
            .map(t => ({ cents: t.cents, roughness: clamp(t.roughness, 0, 1) }));
        const hasFundamental = cleaned.some(t => Math.abs(t.cents) < 0.001);
        const seeded = includeFundamental && !hasFundamental
            ? [{ cents: 0, roughness: 1 }, ...cleaned]
            : cleaned;
        const ordered = seeded.sort((a, b) => a.cents - b.cents);
        return ordered.map((t, idx) => {
            const ratio = clamp(Math.pow(2, t.cents / 1200), 0.0001, 64);
            return {
                index: idx + 1,
                ratio,
                amplitude: clamp(t.roughness, 0, 1),
                originalRatio: Math.pow(ratio, 1 / stretch),
                waveform
            };
        });
    }, [includeFundamental, stretch, waveform]);

    useEffect(() => {
        if (customTargets.length === 0) return;
        const next = buildPartialsFromTargets(customTargets);
        if (next.length === 0) return;
        setPartialsWithHistory(next);
    }, [customTargets, includeFundamental, buildPartialsFromTargets, setPartialsWithHistory]);

    const addCustomTarget = useCallback(() => {
        if (targetCentsInput.trim() === '' || targetRoughnessInput.trim() === '') {
            notifyWarning('Enter both cents and roughness.', 'Sethares');
            return;
        }
        const centsVal = Number(targetCentsInput);
        const roughVal = Number(targetRoughnessInput);
        if (!Number.isFinite(centsVal)) {
            notifyWarning('Invalid cents value.', 'Sethares');
            return;
        }
        const roughness = normalizeRoughnessInput(roughVal);
        if (roughness === null) {
            notifyWarning('Invalid roughness value.', 'Sethares');
            return;
        }
        const clampedCents = clamp(centsVal, 0, maxRange);
        const id = `tgt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setCustomTargets(prev => [...prev, { id, cents: clampedCents, roughness }]);
        setTargetCentsInput('');
        setTargetRoughnessInput('');
    }, [targetCentsInput, targetRoughnessInput, normalizeRoughnessInput, maxRange]);

    const updateCustomTarget = useCallback((id: string, partial: { cents?: number; roughness?: number }) => {
        setCustomTargets(prev => prev.map(t => {
            if (t.id !== id) return t;
            const nextCents = partial.cents !== undefined ? clamp(partial.cents, 0, maxRange) : t.cents;
            const nextRough = partial.roughness !== undefined ? clamp(partial.roughness, 0, 1) : t.roughness;
            return { ...t, cents: nextCents, roughness: nextRough };
        }));
    }, [maxRange]);

    const removeCustomTarget = useCallback((id: string) => {
        setCustomTargets(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearCustomTargets = useCallback(() => {
        setCustomTargets([]);
    }, []);

    const applyCustomTargets = useCallback(() => {
        if (customTargets.length === 0) {
            notifyWarning('No custom targets to apply.', 'Sethares');
            return;
        }
        const next = buildPartialsFromTargets(customTargets);
        if (next.length === 0) {
            notifyWarning('No valid targets to apply.', 'Sethares');
            return;
        }
        setPartialsWithHistory(next);
    }, [customTargets, buildPartialsFromTargets, setPartialsWithHistory]);

    const buildTimbrePatchFromPartials = useCallback((source: Partial[]) => {
        const cloneDeep = <T,>(value: T): T => {
            if (typeof structuredClone === 'function') return structuredClone(value);
            return JSON.parse(JSON.stringify(value));
        };
        const base = cloneDeep(DEFAULT_TIMBRE_PATCHES[0]);
        const indices = source
            .map(p => Math.round(p.ratio))
            .filter(n => Number.isFinite(n) && n > 0);
        const maxIndex = Math.max(1, ...indices, 1);
        const tableSize = maxIndex <= 16 ? 16 : maxIndex <= 32 ? 32 : 64;
        const table = new Array(tableSize).fill(0);
        source.forEach(p => {
            const idx = Math.round(p.ratio);
            if (idx < 1 || idx > tableSize) return;
            table[idx - 1] = Math.max(table[idx - 1], clamp(p.amplitude, 0, 1));
        });

        const patchId = `sethares-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const patchName = `Sethares ${new Date().toISOString().slice(11, 19)}`;

        return {
            ...base,
            id: patchId,
            name: patchName,
            tags: [...(base.tags || []), 'sethares'],
            folder: 'Sethares',
            voice: {
                ...base.voice,
                oscBank: { ...base.voice.oscBank, enabled: false },
                harmonic: {
                    ...base.voice.harmonic,
                    enabled: true,
                    mode: 'table',
                    harmonicCount: tableSize,
                    tableSize,
                    table,
                    rolloff: 1,
                    brightness: 0,
                    oddEven: 0,
                    jitter: 0,
                    mix: 1
                }
            },
            performance: {
                ...base.performance,
                maxPartials: tableSize
            }
        };
    }, []);

    const saveAsTimbre = useCallback(() => {
        if (!settings?.timbre || !updateSettings) {
            notifyError('Timbre settings unavailable.', 'Sethares');
            return;
        }
        const sourcePartials = customTargets.length > 0
            ? buildPartialsFromTargets(customTargets)
            : partials;
        if (sourcePartials.length === 0) {
            notifyWarning('No partials available to save.', 'Sethares');
            return;
        }
        const patch = buildTimbrePatchFromPartials(sourcePartials);
        const nextPatches = [...settings.timbre.patches, patch];
        updateSettings({
            timbre: {
                ...settings.timbre,
                patches: nextPatches,
                activePatchId: patch.id
            }
        });
        notifySuccess(`Saved timbre: ${patch.name}`, 'Sethares');
    }, [settings, updateSettings, customTargets, buildPartialsFromTargets, partials, buildTimbrePatchFromPartials]);

    const presetInputRef = useRef<HTMLInputElement>(null);
    const legacySettingsRef = useRef<{
        roughnessModel: RoughnessModel;
        cbScale: number;
        decayAmount: number;
        timeSlice: number;
        axisMode: AxisMode;
        minimaFilter: { depth: number; width: number };
        beatEnabled: boolean;
        beatDepth: number;
        midiEnabled: boolean;
    } | null>(null);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Shift') setSnapModifierActive(true);
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Shift') setSnapModifierActive(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        setPartials(prev => prev.map(p => ({
            ...p,
            ratio: p.originalRatio ** stretch
        })));
    }, [stretch]);

    useSetharesRoughnessCurve({
        partials,
        algoParams,
        roughnessModel,
        cbScale,
        decayAmount,
        timeSlice,
        minimaFilterDepth: minimaFilter.depth,
        minimaFilterWidth: minimaFilter.width,
        isDragging,
        maxRange,
        showGhostCurve,
        stretch,
        setCurveData,
        setMinima,
        setShowGhostCurve,
        setTriadHighlight
    });

    useSetharesHoverAudio({
        hoverCents,
        partials,
        masterVolume,
        baseFreq,
        snapToMinima,
        snapModifierActive,
        minima,
        waveform,
        decayAmount,
        timeSlice,
        beatEnabled,
        beatDepth
    });

    const playTone = (ratio: number) => {
        const ctx = getAudioCtx();
        const f0 = baseFreq;
        const now = ctx.currentTime;
        const duration = 0.5;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(masterVolume * 0.2, now);
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        masterGain.connect(ctx.destination);

        const activePartials = applySpectralDecay(partials, decayAmount, timeSlice).filter(p => p.amplitude > 0.01);

        activePartials.forEach(p => {
            const osc = ctx.createOscillator();
            osc.type = resolvePartialWaveform(p, waveform);
            osc.frequency.value = f0 * p.ratio;
            const g = ctx.createGain();
            applyEnvelope(g, ctx, p.amplitude, now, now + duration);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + duration);
        });

        activePartials.forEach(p => {
            const osc = ctx.createOscillator();
            osc.type = resolvePartialWaveform(p, waveform);
            osc.frequency.value = f0 * p.ratio * ratio;
            const g = ctx.createGain();
            const baseAmp = beatEnabled ? p.amplitude * (1 - beatDepth * 0.5) : p.amplitude;
            applyEnvelope(g, ctx, baseAmp, now, now + duration);
            osc.connect(g);
            g.connect(masterGain);
            osc.start(now);
            osc.stop(now + duration);
            if (beatEnabled) {
                const beatFreq = Math.min(40, Math.max(0.5, Math.abs(f0 * p.ratio * (ratio - 1))));
                const beatOsc = ctx.createOscillator();
                beatOsc.type = 'sine';
                beatOsc.frequency.value = beatFreq;
                const beatGain = ctx.createGain();
                beatGain.gain.value = p.amplitude * beatDepth * 0.5;
                beatOsc.connect(beatGain);
                beatGain.connect(g.gain);
                beatOsc.start(now);
                beatOsc.stop(now + duration);
            }
        });
    };

    const scaleOverlays = useMemo(() => {
        if (!showTetOverlay) return [];
        const safeDivisions = clamp(Math.round(tetDivisions), 1, 72);
        return Array.from({ length: safeDivisions }, (_, i) => (i + 1) * (1200 / safeDivisions));
    }, [showTetOverlay, tetDivisions]);

    const getNearestScaleDeviation = useCallback((cents: number) => {
        if (!scaleOverlays || scaleOverlays.length === 0) return null;
        let nearest = scaleOverlays[0];
        let minDist = Math.abs(cents - nearest);
        for (let i = 1; i < scaleOverlays.length; i++) {
            const dist = Math.abs(cents - scaleOverlays[i]);
            if (dist < minDist) {
                minDist = dist;
                nearest = scaleOverlays[i];
            }
        }
        return { nearest, diff: cents - nearest };
    }, [scaleOverlays]);

    const startGhostCapture = useCallback(() => {
        setGhostCurveData(curveData);
        setShowGhostCurve(true);
    }, [curveData]);

    const playChord = (ratios: number[], duration = 0.8, stagger = 0) => {
        const ctx = getAudioCtx();
        const f0 = baseFreq;
        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(masterVolume * 0.2, now);
        const totalDuration = duration + Math.max(0, ratios.length - 1) * stagger;
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);
        masterGain.connect(ctx.destination);

        const activePartials = applySpectralDecay(partials, decayAmount, timeSlice).filter(p => p.amplitude > 0.01);
        ratios.forEach((ratio, idx) => {
            const startAt = now + idx * stagger;
            activePartials.forEach(p => {
                const osc = ctx.createOscillator();
                osc.type = resolvePartialWaveform(p, waveform);
                osc.frequency.value = f0 * p.ratio * ratio;
                const g = ctx.createGain();
                applyEnvelope(g, ctx, p.amplitude, startAt, startAt + duration);
                osc.connect(g);
                g.connect(masterGain);
                osc.start(startAt);
                osc.stop(startAt + duration);
            });
        });
    };

    const playTriad = () => {
        if (minima.length === 0) return;
        const findNearest = (targets: number[]) => {
            let best: Minima | null = null;
            let bestDist = Infinity;
            minima.forEach(m => {
                const dist = Math.min(...targets.map(t => Math.abs(m.cents - t)));
                if (dist < bestDist) {
                    bestDist = dist;
                    best = m;
                }
            });
            return best;
        };

        const third = findNearest([386, 316]);
        const fifth = findNearest([702]);

        if (!third || !fifth) return;

        const triad = [1, third.ratio, fifth.ratio];
        setTriadHighlight([0, third.cents, fifth.cents]);
        playChord(triad, 0.9, 0);
    };

    const playRandomArp = () => {
        const ordered = [...minima].sort((a, b) => a.cents - b.cents);
        const scale = [1, ...ordered.map(m => m.ratio)].filter(r => r > 1e-4);
        if (scale.length < 2) return;
        const seq = Array.from({ length: 6 }, () => scale[Math.floor(Math.random() * scale.length)]);
        setTriadHighlight(null);
        playChord(seq, 0.35, 0.18);
    };

    const handleLocateMinima = useCallback((cents: number) => {
        setHoverCents(cents);
        setLocateSignal({ cents, id: Date.now() });
    }, []);

    const exportSCL = () => {

        const sorted = [...minima].sort((a, b) => a.cents - b.cents);

        let sclContent = `! SetharesGenerated.scl\n! Generated by Sethares Tuning Engine\n${sorted.length}\n!\n`;
        sorted.forEach(m => {
            if (m.cents <= 0.1) return;

            sclContent += ` ${m.cents.toFixed(5)}\n`;
        });

        const blob = new Blob([sclContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sethares_timbre.scl';
        a.click();
        URL.revokeObjectURL(url);
    };

    const getChromaticMappedFrequency = (note: number) => {
        const scale = getScaleRatios();
        const scaleLen = scale.length;
        const stepIndex = note - midiBaseNote;
        let degree = stepIndex % scaleLen;
        let octaveOffset = Math.floor(stepIndex / scaleLen);
        if (degree < 0) {
            degree += scaleLen;
            octaveOffset -= 1;
        }
        const ratio = (scale[degree] || 1) * Math.pow(2, octaveOffset);
        return baseFreq * ratio;
    };

    const exportTUN = () => {
        let tun = `; Scala .tun v2\n; Generated by Sethares Tuning Engine\n[Scale]\nFormat=2\nBaseNote=${midiBaseNote}\nBaseFreq=${baseFreq}\nNoteCount=128\nMap=full\n`;
        for (let note = 0; note < 128; note++) {
            const freq = getChromaticMappedFrequency(note);
            tun += `Note${note}=${freq.toFixed(6)}\n`;
        }
        const blob = new Blob([tun], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sethares_timbre.tun';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportKSP = () => {
        const lines = [];
        lines.push(`{ Sethares Tuning Engine - Kontakt KSP }`);
        lines.push(`on init`);
        lines.push(`  declare !tune[128]`);
        for (let note = 0; note < 128; note++) {
            const targetFreq = getChromaticMappedFrequency(note);
            const etFreq = baseFreq * Math.pow(2, (note - midiBaseNote) / 12);
            const cents = 1200 * Math.log2(targetFreq / etFreq);
            lines.push(`  !tune[${note}] := ${cents.toFixed(3)}`);
        }
        lines.push(`end on`);
        lines.push(``);
        lines.push(`on note`);
        lines.push(`  change_tune($EVENT_ID, !tune[$EVENT_NOTE])`);
        lines.push(`end on`);
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sethares_timbre.ksp';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportWavetable = () => {
        const frames = Math.max(1, Math.round(morphFrames));
        const totalSamples = WAVETABLE_SAMPLES * frames;
        const samples = new Float32Array(totalSamples);
        for (let f = 0; f < frames; f++) {
            const t = frames === 1 ? timeSlice : f / (frames - 1);
            const framePartials = applySpectralDecay(partials, decayAmount, t);
            const frameStart = f * WAVETABLE_SAMPLES;
            let maxAbs = 0;
            for (let i = 0; i < WAVETABLE_SAMPLES; i++) {
                let value = 0;
                const phase = (2 * Math.PI * i) / WAVETABLE_SAMPLES;
                framePartials.forEach(p => {
                    value += p.amplitude * Math.sin(phase * p.ratio);
                });
                samples[frameStart + i] = value;
                maxAbs = Math.max(maxAbs, Math.abs(value));
            }
            if (maxAbs > 0) {
                const scale = 0.9 / maxAbs;
                for (let i = 0; i < WAVETABLE_SAMPLES; i++) {
                    samples[frameStart + i] *= scale;
                }
            }
        }

        const sampleRate = 44100;
        const buffer = new ArrayBuffer(44 + samples.length * 4);
        const view = new DataView(buffer);
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 4, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 3, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 32, true);
        writeString(36, 'data');
        view.setUint32(40, samples.length * 4, true);
        for (let i = 0; i < samples.length; i++) {
            view.setFloat32(44 + i * 4, samples[i], true);
        }
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sethares_wavetable.wav';
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportPreset = () => {
        const preset = {
            version: 1,
            partials: partials.map(p => ({
                index: p.index,
                ratio: Number(p.ratio.toFixed(6)),
                amplitude: Number(p.amplitude.toFixed(4)),
                originalRatio: Number(p.originalRatio.toFixed(6)),
                waveform: p.waveform
            })),
            stretch: Number(stretch.toFixed(4)),
            waveform,
            baseFreq,
            masterVolume: Number(masterVolume.toFixed(4)),
            algoParams: {
                a: Number(algoParams.a.toFixed(4)),
                b: Number(algoParams.b.toFixed(4))
            },
            scaleType: showTetOverlay ? 'custom' : 'none',
            showTetOverlay,
            showHarmonicOverlay,
            tetDivisions,
            snapToMinima,
            roughnessModel,
            cbScale: Number(cbScale.toFixed(4)),
            decayAmount: Number(decayAmount.toFixed(4)),
            timeSlice: Number(timeSlice.toFixed(4)),
            minimaFilter: {
                depth: Number(minimaFilter.depth.toFixed(4)),
                width: Number(minimaFilter.width.toFixed(2))
            },
            axisMode
        };
        const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sethares_preset.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const importPreset = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const raw = typeof reader.result === 'string' ? reader.result : '';
                const data = JSON.parse(raw || '{}');
                const importStretch = Number.isFinite(data.stretch) ? Number(data.stretch) : stretch;
                const importWaveform = normalizeWaveform(data.waveform, waveform);
                const importPartials = Array.isArray(data.partials) ? data.partials : [];
                const nextPartials = partials.map((p, i) => {
                    const incoming = importPartials[i];
                    if (!incoming) return { ...p, waveform: resolvePartialWaveform(p, importWaveform) };
                    const ratio = Number.isFinite(incoming.ratio) ? Number(incoming.ratio) : p.ratio;
                    const amplitude = Number.isFinite(incoming.amplitude) ? Number(incoming.amplitude) : p.amplitude;
                    const originalRatio = Number.isFinite(incoming.originalRatio)
                        ? Number(incoming.originalRatio)
                        : Math.pow(ratio, 1 / importStretch);
                    const wf = normalizeWaveform(incoming.waveform, importWaveform);
                    return {
                        ...p,
                        ratio,
                        amplitude: clamp(amplitude, 0, 1),
                        originalRatio,
                        waveform: wf
                    };
                });
                setStretch(importStretch);
                setWaveform(importWaveform);
                if (Number.isFinite(data.baseFreq)) setBaseFreq(Number(data.baseFreq));
                if (Number.isFinite(data.masterVolume)) setMasterVolume(clamp(Number(data.masterVolume), 0, 1));
                if (data.algoParams) {
                    const nextA = Number.isFinite(data.algoParams.a) ? Number(data.algoParams.a) : algoParams.a;
                    const nextB = Number.isFinite(data.algoParams.b) ? Number(data.algoParams.b) : algoParams.b;
                    setAlgoParams({ a: clamp(nextA, 0.5, 20), b: clamp(nextB, 0.5, 20) });
                }
                if (data.roughnessModel === 'sethares' || data.roughnessModel === 'vassilakis') {
                    setRoughnessModel(data.roughnessModel);
                }
                if (Number.isFinite(data.cbScale)) setCbScale(clamp(Number(data.cbScale), 0.1, 10));
                if (Number.isFinite(data.decayAmount)) setDecayAmount(clamp(Number(data.decayAmount), 0, 8));
                if (Number.isFinite(data.timeSlice)) setTimeSlice(clamp(Number(data.timeSlice), 0, 1));
                if (data.minimaFilter) {
                    const depth = Number.isFinite(data.minimaFilter.depth) ? Number(data.minimaFilter.depth) : minimaFilter.depth;
                    const width = Number.isFinite(data.minimaFilter.width) ? Number(data.minimaFilter.width) : minimaFilter.width;
                    setMinimaFilter({ depth: clamp(depth, 0, 1), width: clamp(width, 0, 200) });
                }
                if (typeof data.showTetOverlay === 'boolean') {
                    setShowTetOverlay(data.showTetOverlay);
                } else if (data.scaleType) {
                    setShowTetOverlay(data.scaleType !== 'none');
                }
                if (typeof data.showHarmonicOverlay === 'boolean') {
                    setShowHarmonicOverlay(data.showHarmonicOverlay);
                }
                if (Number.isFinite(data.tetDivisions)) {
                    setTetDivisions(clamp(Math.round(Number(data.tetDivisions)), 1, 72));
                }
                if (typeof data.snapToMinima === 'boolean') setSnapToMinima(data.snapToMinima);
                if (data.axisMode === 'cents' || data.axisMode === 'hz') setAxisMode(data.axisMode);
                setPartials(nextPartials);
                resetHistory();
            } catch (e) {
                notifyError('Invalid preset file.', 'Sethares');
            }
        };
        reader.readAsText(file);
    };

    const importSample = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const ctx = getAudioCtx();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
            const { baseFreq: sampleBase, peaks } = extractFftPeaks(
                audioBuffer,
                fftPeakCount,
                fftThreshold,
                DEFAULT_SUSTAIN_START,
                DEFAULT_SUSTAIN_END
            );
            if (peaks.length === 0) {
                notifyWarning('No spectral peaks found in sustain segment.', 'Sethares');
                return;
            }
            const padded = [...peaks];
            while (padded.length < fftPeakCount) {
                padded.push({ ratio: padded.length + 1, amplitude: 0 });
            }
            const nextPartials = padded.slice(0, fftPeakCount).map((p, i) => {
                const ratio = clamp(p.ratio, 0.0001, 64);
                return {
                    index: i + 1,
                    ratio,
                    amplitude: clamp(p.amplitude, 0, 1),
                    originalRatio: Math.pow(ratio, 1 / stretch),
                    waveform
                };
            });
            setPartialsWithHistory(nextPartials);
            if (fftSetBaseFreq && sampleBase > 10) {
                setBaseFreq(Math.round(clamp(sampleBase, 50, 880)));
            }
        } catch (err) {
            notifyError('Failed to import WAV sample.', 'Sethares');
        }
    };

    const applyComb = () => {
        const period = Math.max(2, Math.round(combPeriod));
        setPartialsWithHistory(prev => prev.map((p, idx) => {
            const slot = (idx + 1) % period;
            if (slot === 0) {
                const depth = clamp(combDepth, 0, 1);
                if (depth <= 0) return p;
                const floor = depth >= 0.99 ? 0.02 : 0;
                const factor = Math.max(0, Math.pow(1 - depth, 1.4));
                return { ...p, amplitude: clamp(Math.max(p.amplitude * factor, floor), 0, 1) };
            }
            return p;
        }));
    };

    const getScaleRatios = useCallback(() => {
        const ordered = [...minima].sort((a, b) => a.cents - b.cents);
        const ratios = [1, ...ordered.map(m => m.ratio)].filter(r => r > 1e-6);
        if (ratios.length <= 1) {
            return [1, ...Array.from({ length: 12 }, (_, i) => Math.pow(2, (i + 1) / 12))];
        }
        return ratios;
    }, [minima]);

    useSetharesMidi({
        midiEnabled,
        midiInputs,
        midiInputId,
        midiMappingMode,
        midiBaseNote,
        midiNoteBendRange,
        midiChannel,
        setMidiInputs,
        setMidiInputId,
        masterVolume,
        baseFreq,
        partials,
        decayAmount,
        timeSlice,
        waveform,
        getScaleRatios
    });

    const viewProps = {
        timestamp,
        showAdvanced,
        partials,
        setPartialsWithHistory,
        stretch,
        setStretch,
        waveform,
        setWaveform,
        startGhostCapture,
        setShowAdvanced,
        importSample,
        fftPeakCount,
        setFftPeakCount,
        fftThreshold,
        setFftThreshold,
        fftSetBaseFreq,
        setFftSetBaseFreq,
        drawMode,
        setDrawMode,
        combPeriod,
        setCombPeriod,
        combDepth,
        setCombDepth,
        applyComb,
        hoverCents,
        decayAmount,
        timeSlice,
        setIsDragging,
        curveData,
        minima,
        setHoverCents,
        scaleOverlays,
        showTetOverlay,
        showHarmonicOverlay,
        tetDivisions,
        ghostCurveData,
        showGhostCurve,
        baseFreq,
        setBaseFreq,
        triadHighlight,
        axisMode,
        locateSignal,
        maxRatioDenominator,
        harmonicCount,
        harmonicsConfig,
        showHarmonicAdvanced,
        gridFollowsEdo,
        maxRange,
        setShowTetOverlay,
        setTetDivisions,
        setGridFollowsEdo,
        setMaxRange,
        setMaxRatioDenominator,
        setShowHarmonicOverlay,
        setHarmonicCount,
        setShowHarmonicAdvanced,
        setHarmonicsConfig,
        minimaFilter,
        setMinimaFilter,
        exportSCL,
        exportTUN,
        exportKSP,
        exportWavetable,
        exportPreset,
        importPreset,
        morphFrames,
        setMorphFrames,
        triadFixedF2,
        setTriadFixedF2,
        heatmapGain,
        setHeatmapGain,
        playTriad,
        playRandomArp,
        playTone,
        showVerification,
        setShowVerification,
        handleLocateMinima,
        setAxisMode,
        snapToMinima,
        setSnapToMinima,
        midiEnabled,
        setMidiEnabled,
        midiInputs,
        midiInputId,
        setMidiInputId,
        midiMappingMode,
        setMidiMappingMode,
        midiBaseNote,
        setMidiBaseNote,
        midiNoteBendRange,
        setMidiNoteBendRange,
        midiChannel,
        setMidiChannel,
        presetInputRef,
        algoParams,
        setAlgoParams,
        setDecayAmount,
        setTimeSlice,
        cbScale,
        setCbScale,
        masterVolume,
        setMasterVolume,
        handleUndo,
        handleRedo,
        resetEngine,
        undoStack,
        redoStack,
        roughnessModel,
        customTargets,
        customTargetContinuous,
        targetCentsInput,
        targetRoughnessInput,
        setTargetCentsInput,
        setTargetRoughnessInput,
        addCustomTarget,
        updateCustomTarget,
        removeCustomTarget,
        clearCustomTargets,
        applyCustomTargets,
        includeFundamental,
        setIncludeFundamental,
        setCustomTargetContinuous,
        saveAsTimbre
    };

    return <SetharesExperimentView {...viewProps} />;
};

export default SetharesExperiment;
