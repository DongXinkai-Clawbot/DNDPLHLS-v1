import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import { GM_WAVEFORMS, GM_INSTRUMENTS } from '../../gmConstants';
import { getAudioContext, getMasterDestination, getRecordingSupport, startNote, startRecording, stopRecording } from '../../audioEngine';
import { formatRatio, parseMathExpression, parseAdvancedMath, getPrimeVectorFromRatio, calculateCents, normalizeOctave } from '../../musicLogic';
import { notifyError } from '../../utils/notifications';
import { reportFatalError } from '../../utils/errorReporting';
import { Vector3 } from 'three';
import type { NodeData, PrimeLimit, AppSettings } from '../../types';
import { useDeviceType } from '../../hooks/useDeviceType';
import { AUTO_BIND_KEYS } from '../../store/logic/constants';
import { VirtualList } from '../common/VirtualList';

interface VirtualKeyboardProps {
    settingsOverride?: AppSettings;
}

type StandardKey = {
    id: string;
    midi: number;
    label: string;
    noteIndex: number;
    isBlack: boolean;
    whiteIndex: number;
    node: NodeData;
};

const parseStepIndexList = (text: string, steps: number) => {
    const tokens = (text || '')
        .split(/[^0-9-]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    const nums = tokens.map((t) => parseInt(t, 10)).filter((n) => Number.isFinite(n));
    const set = new Set<number>();
    nums.forEach((n) => {
        if (n >= 0 && n < steps) set.add(n);
    });
    return set;
};

export const VirtualKeyboard = ({ settingsOverride }: VirtualKeyboardProps) => {
    const { isMobile } = useDeviceType();
    const {
        customKeyboard,
        keyBindings,
        removeFromKeyboard,
        shiftKeyboardOctave,
        bindKey,
        unbindKey,
        settings: storeSettings,
        updateSettings,
        saveKeyboard,
        loadKeyboard,
        deleteKeyboard,
        savedKeyboards,
        clearKeyboard,
        duplicateKeyboardWithFactor,
        isRecording,
        setRecording,
        playingNodeIds,
        setPlayingNodeStates,
        addToKeyboard,
        customSampleNames,
        disableWasdInKeyboard,
        setDisableWasdInKeyboard,
        keyboardLayout,
        setKeyboardLayout,
        keyboardHoldNotes,
        setKeyboardHoldNotes
    } = useStore((s) => ({
        customKeyboard: s.customKeyboard,
        keyBindings: s.keyBindings,
        removeFromKeyboard: s.removeFromKeyboard,
        shiftKeyboardOctave: s.shiftKeyboardOctave,
        bindKey: s.bindKey,
        unbindKey: s.unbindKey,
        settings: s.settings,
        updateSettings: s.updateSettings,
        saveKeyboard: s.saveKeyboard,
        loadKeyboard: s.loadKeyboard,
        deleteKeyboard: s.deleteKeyboard,
        savedKeyboards: s.savedKeyboards,
        clearKeyboard: s.clearKeyboard,
        duplicateKeyboardWithFactor: s.duplicateKeyboardWithFactor,
        isRecording: s.isRecording,
        setRecording: s.setRecording,
        playingNodeIds: s.playingNodeIds,
        setPlayingNodeStates: s.setPlayingNodeStates,
        addToKeyboard: s.addToKeyboard,
        customSampleNames: s.customSampleNames,
        disableWasdInKeyboard: s.disableWasdInKeyboard,
        setDisableWasdInKeyboard: s.setDisableWasdInKeyboard,
        keyboardLayout: s.keyboardLayout,
        setKeyboardLayout: s.setKeyboardLayout,
        keyboardHoldNotes: s.keyboardHoldNotes,
        setKeyboardHoldNotes: s.setKeyboardHoldNotes
    }), shallow);

    const setNodePlaying = useCallback((nodeId: string, isPlaying: boolean) => {
        const newMap = new Map(playingNodeIds);
        if (isPlaying) {
            newMap.set(nodeId, { channels: [0], velocity: 100 });
        } else {
            newMap.delete(nodeId);
        }
        setPlayingNodeStates(newMap);
    }, [playingNodeIds, setPlayingNodeStates]);

    const settings = settingsOverride || storeSettings;
    const timbrePatches = settings.timbre?.patches || [];
    const waveformList = ['sine', 'triangle', 'square', 'sawtooth', 'custom-synth', ...(customSampleNames || []), 'organ', 'epiano', 'strings', 'pad', 'brass', 'bell', 'nes', 'synth-bass'];
    const instrumentOptions = [
        ...waveformList.map((w) => ({ value: w, label: w })),
        ...GM_INSTRUMENTS.map((inst) => ({ value: `gm-${inst.id}`, label: `GM: ${inst.name}` })),
        ...timbrePatches.map((p: any) => ({ value: `timbre:${p.id}`, label: `Timbre: ${p.name}` }))
    ];
    const customKeyMap = useMemo(() => new Map(customKeyboard.map((node) => [node.id, node])), [customKeyboard]);

    const [bindingNodeId, setBindingNodeId] = useState<string | null>(null);
    const activeVoicesRef = useRef<Record<string, () => void>>({});
    const standardVoicesRef = useRef<Record<string, () => void>>({});
    const dragStateRef = useRef<Map<number, { layout: 'custom' | 'standard'; keyId: string }>>(new Map());
    const pressedKeysRef = useRef<Map<string, { layout: 'custom' | 'standard'; keyId: string }>>(new Map());
    const continuousVoicesRef = useRef<Map<number, { stop: () => void; setFrequency: (freq: number) => void }>>(new Map());
    const standardKeyboardRef = useRef<HTMLDivElement | null>(null);
    const [standardPlaying, setStandardPlaying] = useState<Set<string>>(new Set());
    const [standardStartNote, setStandardStartNote] = useState(21);
    const [standardEndNote, setStandardEndNote] = useState(108);
    const [standardLabelMode, setStandardLabelMode] = useState<'none' | 'c' | 'all'>('c');
    const [continuousPitch, setContinuousPitch] = useState(false);
    const [standardStepsPerOctave, setStandardStepsPerOctave] = useState(12);
    const [standardReferenceStep, setStandardReferenceStep] = useState(69);
    const [standardBlackIndicesText, setStandardBlackIndicesText] = useState('1,3,6,8,10');
    const [standardWhiteIndicesText, setStandardWhiteIndicesText] = useState('');

    const [showSaveUI, setShowSaveUI] = useState(false);
    const [kbName, setKbName] = useState("");
    const [showSavedList, setShowSavedList] = useState(false);
    const [showAudioSettings, setShowAudioSettings] = useState(false);

    const audioLabel = isMobile ? '🎵' : '🎵 AUDIO';
    const recordingSupport = useMemo(() => getRecordingSupport(), []);
    const recordLabel = isRecording ? (isMobile ? 'STOP' : '● STOP REC') : (isMobile ? 'REC' : '○ RECORD');
    const recordDisabled = !recordingSupport.supported;
    const recordDisabledReason = recordingSupport.reason || 'Recording not supported on this device.';
    const keySizeClass = isMobile ? 'w-14 h-20' : 'w-20 h-32';
    const keyNameClass = isMobile ? 'text-xs' : 'text-xs';
    const keyRatioClass = isMobile ? 'text-xs' : 'text-[10px]';
    const keyBindClass = isMobile ? 'text-[8px]' : 'text-[10px]';

    const [viewMode, setViewMode] = useState<'keys' | 'add' | 'duplicate'>('keys');
    const [addRatioNum, setAddRatioNum] = useState("");
    const [addRatioDen, setAddRatioDen] = useState("");
    const [addNoteName, setAddNoteName] = useState("");

    const [dupFactorNum, setDupFactorNum] = useState("2");
    const [dupFactorDen, setDupFactorDen] = useState("1");
    const keyBindingsMap = useMemo(() => {
        const map = new Map<string, string>();
        Object.entries(keyBindings).forEach(([nodeId, key]) => {
            if (!key) return;
            map.set(key.toLowerCase(), nodeId);
        });
        return map;
    }, [keyBindings]);

    const stopCustomVoices = useCallback(() => {
        Object.entries(activeVoicesRef.current).forEach(([id, stop]) => {
            if (stop && typeof stop === 'function') stop();
            setNodePlaying(id, false);
        });
        activeVoicesRef.current = {};
        dragStateRef.current.clear();
        pressedKeysRef.current.clear();
        continuousVoicesRef.current.forEach((voice) => voice.stop());
        continuousVoicesRef.current.clear();
    }, [setNodePlaying]);

    const stopStandardVoices = useCallback(() => {
        Object.entries(standardVoicesRef.current).forEach(([, stop]) => {
            if (stop && typeof stop === 'function') stop();
        });
        standardVoicesRef.current = {};
        setStandardPlaying(new Set());
        dragStateRef.current.clear();
        pressedKeysRef.current.clear();
        continuousVoicesRef.current.forEach((voice) => voice.stop());
        continuousVoicesRef.current.clear();
    }, []);

    useEffect(() => {
        return () => {
            stopCustomVoices();
            stopStandardVoices();
        };
    }, [stopCustomVoices, stopStandardVoices]);

    useEffect(() => {
        if (keyboardLayout !== 'custom' && viewMode !== 'keys') {
            setViewMode('keys');
        }
        stopCustomVoices();
        stopStandardVoices();
    }, [keyboardLayout, viewMode, stopCustomVoices, stopStandardVoices]);

    const prevHoldRef = useRef(keyboardHoldNotes);
    useEffect(() => {
        if (prevHoldRef.current && !keyboardHoldNotes) {
            stopCustomVoices();
            stopStandardVoices();
        }
        prevHoldRef.current = keyboardHoldNotes;
    }, [keyboardHoldNotes, stopCustomVoices, stopStandardVoices]);

    useEffect(() => {
        if (!continuousPitch) {
            continuousVoicesRef.current.forEach((voice) => voice.stop());
            continuousVoicesRef.current.clear();
        }
    }, [continuousPitch]);

    useEffect(() => {
        if (keyboardLayout !== 'standard') {
            setContinuousPitch(false);
        }
    }, [keyboardLayout]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            if (!bindingNodeId) return;

            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                setBindingNodeId(null);
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                unbindKey(bindingNodeId);
                setBindingNodeId(null);
            } else {
                const k = e.key.toLowerCase();
                bindKey(bindingNodeId, k);
                setBindingNodeId(null);
            }
        };

        if (bindingNodeId) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [bindingNodeId, bindKey, unbindKey]);

    const startCustomVoice = useCallback((node: NodeData) => {
        if (activeVoicesRef.current[node.id]) {
            activeVoicesRef.current[node.id]();
        }
        activeVoicesRef.current[node.id] = startNote(node, settings, 'keyboard');
        setNodePlaying(node.id, true);
    }, [setNodePlaying, settings]);

    const stopCustomVoice = useCallback((nodeId: string) => {
        if (activeVoicesRef.current[nodeId]) {
            activeVoicesRef.current[nodeId]();
            delete activeVoicesRef.current[nodeId];
        }
        setNodePlaying(nodeId, false);
    }, [setNodePlaying]);

    const resolveContinuousWaveform = useCallback(() => {
        const pick = (value: string | undefined) => {
            if (!value) return null;
            if (value.startsWith('timbre:') || value === 'custom-synth') return null;
            return value;
        };
        const inst = pick(settings.instrumentKeyboard) || pick(settings.waveform) || 'sine';
        if (inst === 'sine' || inst === 'triangle' || inst === 'square' || inst === 'sawtooth') return inst;
        if (inst === 'organ' || inst === 'bell') return 'sine';
        if (inst === 'pad' || inst === 'epiano') return 'triangle';
        if (inst === 'nes') return 'square';
        if (inst === 'strings' || inst === 'brass' || inst === 'synth-bass') return 'sawtooth';
        return 'sine';
    }, [settings.instrumentKeyboard, settings.waveform]);

    const startContinuousTone = useCallback((freq: number) => {
        const ctx = getAudioContext();
        if (!ctx) return null;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => { });
        }
        const now = ctx.currentTime;
        const safe = Number.isFinite(freq) ? Math.max(20, Math.min(20000, freq)) : 440;
        const gain = ctx.createGain();
        const osc = ctx.createOscillator();
        const masterDestination = getMasterDestination();
        osc.type = resolveContinuousWaveform();
        osc.frequency.setValueAtTime(safe, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (masterDestination) {
            gain.connect(masterDestination);
        }
        osc.start(now);

        const setFrequency = (nextFreq: number) => {
            const f = Number.isFinite(nextFreq) ? Math.max(20, Math.min(20000, nextFreq)) : 440;
            osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
        };
        const stop = () => {
            const t = ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value || 0.2), t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc.stop(t + 0.12);
            setTimeout(() => {
                try { osc.disconnect(); } catch (e) { }
                try { gain.disconnect(); } catch (e) { }
            }, 200);
        };
        return { stop, setFrequency };
    }, [resolveContinuousWaveform]);

    const handleKeyPointerDown = (e: React.PointerEvent, node: NodeData) => {
        e.preventDefault();
        if (keyboardHoldNotes) {
            if (activeVoicesRef.current[node.id]) {
                stopCustomVoice(node.id);
            } else {
                startCustomVoice(node);
            }
            return;
        }
        startCustomVoice(node);
        dragStateRef.current.set(e.pointerId, { layout: 'custom', keyId: node.id });
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) { }
    };

    const handleKeyPointerMove = (e: React.PointerEvent) => {
        if (keyboardHoldNotes) return;
        const drag = dragStateRef.current.get(e.pointerId);
        if (!drag || drag.layout !== 'custom') return;
        const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)
            ?.closest('[data-kb-key-type="custom"]') as HTMLElement | null;
        const nextId = hit?.getAttribute('data-kb-key-id') || '';
        if (!nextId || nextId === drag.keyId) return;
        const nextNode = customKeyMap.get(nextId);
        if (!nextNode) return;
        stopCustomVoice(drag.keyId);
        startCustomVoice(nextNode);
        dragStateRef.current.set(e.pointerId, { layout: 'custom', keyId: nextId });
    };

    const handleKeyPointerLeave = (e: React.PointerEvent, node: NodeData) => {
        if (keyboardHoldNotes) return;
        if (dragStateRef.current.has(e.pointerId)) return;
        handleKeyPointerUp(e, node);
    };

    const handleKeyPointerUp = (e: React.PointerEvent, node: NodeData) => {
        e.preventDefault();
        if (keyboardHoldNotes) return;
        const drag = dragStateRef.current.get(e.pointerId);
        if (drag && drag.layout === 'custom') {
            stopCustomVoice(drag.keyId);
            dragStateRef.current.delete(e.pointerId);
        } else {
            stopCustomVoice(node.id);
        }
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) { }
    };

    const setStandardKeyPlaying = useCallback((keyId: string, isPlaying: boolean) => {
        setStandardPlaying((prev) => {
            const next = new Set(prev);
            if (isPlaying) next.add(keyId);
            else next.delete(keyId);
            return next;
        });
    }, []);

    const startStandardVoice = useCallback((key: StandardKey) => {
        const id = key.id;
        if (standardVoicesRef.current[id]) {
            standardVoicesRef.current[id]();
        }
        standardVoicesRef.current[id] = startNote(key.node, settings, 'keyboard');
        setStandardKeyPlaying(id, true);
    }, [setStandardKeyPlaying, settings]);

    const stopStandardVoice = useCallback((keyId: string) => {
        if (standardVoicesRef.current[keyId]) {
            standardVoicesRef.current[keyId]();
            delete standardVoicesRef.current[keyId];
        }
        setStandardKeyPlaying(keyId, false);
    }, [setStandardKeyPlaying]);

    useEffect(() => {
        const handleGlobalPointerUp = () => {
            if (keyboardHoldNotes) return;
            // Stop any active custom voices when pointer is released anywhere
            dragStateRef.current.forEach((drag) => {
                if (drag.layout === 'custom') {
                    stopCustomVoice(drag.keyId);
                }
            });
            dragStateRef.current.clear();
        };

        window.addEventListener('pointerup', handleGlobalPointerUp);
        window.addEventListener('mouseup', handleGlobalPointerUp);
        window.addEventListener('touchend', handleGlobalPointerUp);

        return () => {
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            window.removeEventListener('mouseup', handleGlobalPointerUp);
            window.removeEventListener('touchend', handleGlobalPointerUp);
        };
    }, [keyboardHoldNotes, stopCustomVoice]);

    const handleStandardPointerDown = (e: React.PointerEvent, key: StandardKey) => {
        e.preventDefault();
        if (continuousPitch) {
            const cents = getStandardContinuousCents(e.clientX);
            if (cents !== null) {
                const freq = settings.baseFrequency * Math.pow(2, cents / 1200);
                const voice = startContinuousTone(freq);
                if (voice) continuousVoicesRef.current.set(e.pointerId, voice);
            }
        } else if (keyboardHoldNotes) {
            if (standardVoicesRef.current[key.id]) {
                stopStandardVoice(key.id);
            } else {
                startStandardVoice(key);
            }
        } else {
            startStandardVoice(key);
            dragStateRef.current.set(e.pointerId, { layout: 'standard', keyId: key.id });
        }
        if (continuousPitch || !keyboardHoldNotes) {
            try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (err) { }
        }
    };

    const handleStandardPointerMove = (e: React.PointerEvent) => {
        if (continuousPitch) {
            const cents = getStandardContinuousCents(e.clientX);
            if (cents === null) return;
            const voice = continuousVoicesRef.current.get(e.pointerId);
            if (!voice) return;
            const freq = settings.baseFrequency * Math.pow(2, cents / 1200);
            voice.setFrequency(freq);
            return;
        }
        if (keyboardHoldNotes) return;
        const drag = dragStateRef.current.get(e.pointerId);
        if (!drag || drag.layout !== 'standard') return;
        const hit = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)
            ?.closest('[data-kb-key-type="standard"]') as HTMLElement | null;
        const nextId = hit?.getAttribute('data-kb-key-id') || '';
        if (!nextId || nextId === drag.keyId) return;
        const nextKey = standardKeyMap.get(nextId);
        if (!nextKey) return;
        stopStandardVoice(drag.keyId);
        startStandardVoice(nextKey);
        dragStateRef.current.set(e.pointerId, { layout: 'standard', keyId: nextId });
    };

    const handleStandardPointerLeave = (e: React.PointerEvent, key: StandardKey) => {
        if (continuousPitch || keyboardHoldNotes) return;
        if (dragStateRef.current.has(e.pointerId)) return;
        handleStandardPointerUp(e, key);
    };

    const handleStandardPointerUp = (e: React.PointerEvent, key: StandardKey) => {
        e.preventDefault();
        if (continuousPitch) {
            const voice = continuousVoicesRef.current.get(e.pointerId);
            if (voice) voice.stop();
            continuousVoicesRef.current.delete(e.pointerId);
            try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) { }
            return;
        }
        if (keyboardHoldNotes) {
            try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) { }
            return;
        }
        const drag = dragStateRef.current.get(e.pointerId);
        if (drag && drag.layout === 'standard') {
            stopStandardVoice(drag.keyId);
            dragStateRef.current.delete(e.pointerId);
        } else {
            stopStandardVoice(key.id);
        }
        try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) { }
    };

    const handleSave = () => {
        if (!kbName.trim()) return;
        saveKeyboard(kbName, customKeyboard, keyBindings);
        setKbName("");
        setShowSaveUI(false);
    };

    const handleManualAdd = () => {
        try {

            let numFrac: { n: bigint; d: bigint }, denFrac: { n: bigint; d: bigint };

            if (addRatioNum.includes('.')) {

                const decimal = parseFloat(addRatioNum);
                if (isNaN(decimal)) throw new Error("Invalid decimal number");

                const decimalPlaces = (addRatioNum.split('.')[1] || '').length;
                const denominator = Math.pow(10, Math.min(decimalPlaces, 8));
                const numerator = decimal * denominator;

                numFrac = {
                    n: BigInt(Math.floor(numerator) as number),
                    d: BigInt(Math.floor(denominator) as number)
                };
            } else {
                numFrac = parseAdvancedMath(addRatioNum || "1");
            }

            if (addRatioDen.includes('.')) {

                const decimal = parseFloat(addRatioDen);
                if (isNaN(decimal)) throw new Error("Invalid decimal number");

                const decimalPlaces = (addRatioDen.split('.')[1] || '').length;
                const denominator = Math.pow(10, Math.min(decimalPlaces, 8));
                const numerator = decimal * denominator;

                denFrac = {
                    n: BigInt(Math.floor(numerator) as number),
                    d: BigInt(Math.floor(denominator) as number)
                };
            } else {
                denFrac = parseAdvancedMath(addRatioDen || "1");
            }

            const finalN: bigint = numFrac.n * denFrac.d;
            const finalD: bigint = numFrac.d * denFrac.n;

            const { ratio, octaves } = normalizeOctave({ n: finalN, d: finalD });

            if (ratio.d === 0n || ratio.n === 0n) throw new Error("Invalid Ratio");

            const vector = getPrimeVectorFromRatio(ratio.n, ratio.d);
            const cents = calculateCents(ratio);

            const ratioFloat = Number(ratio.n) / Number(ratio.d);

            const newNode: NodeData = {
                id: `manual-${Date.now()}`,
                position: new Vector3(),
                primeVector: vector,
                ratio: ratio,
                ratioFloat: ratioFloat,
                octave: octaves,
                cents: cents,
                gen: 0,
                originLimit: 0,
                parentId: null,
                name: addNoteName || "Custom"
            };

            addToKeyboard(newNode);
            setAddRatioNum("");
            setAddRatioDen("");
            setAddNoteName("");
            setViewMode('keys');
        } catch (e) {
            notifyError('Invalid ratio expression.', 'Keyboard');
        }
    };

    const handleRecordToggle = async () => {
        if (isRecording) {
            const blob = await stopRecording();
            setRecording(false);
            if (blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const mime = blob.type || recordingSupport.mimeType || 'audio/webm';
                const ext = mime.includes('mp4')
                    ? 'm4a'
                    : mime.includes('aac')
                        ? 'aac'
                        : mime.includes('mpeg')
                            ? 'mp3'
                            : 'webm';
                a.href = url;
                a.download = `recording-${new Date().getTime()}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } else {
            if (!recordingSupport.supported) {
                reportFatalError('Recording', recordDisabledReason);
                return;
            }
            const result = startRecording();
            if (result.ok) {
                setRecording(true);
            } else {
                reportFatalError('Recording', result.error || recordDisabledReason);
            }
        }
    };

    const basePrimeVector = useMemo(() => getPrimeVectorFromRatio(1n, 1n), []);
    const ratioOne = useMemo(() => ({ n: 1n, d: 1n }), []);
    const stepsPerOctave = useMemo(
        () => Math.max(2, Math.min(72, Math.floor(standardStepsPerOctave))),
        [standardStepsPerOctave]
    );
    const rawBlackIndexSet = useMemo(
        () => parseStepIndexList(standardBlackIndicesText, stepsPerOctave),
        [standardBlackIndicesText, stepsPerOctave]
    );
    const whiteIndexSet = useMemo(
        () => parseStepIndexList(standardWhiteIndicesText, stepsPerOctave),
        [standardWhiteIndicesText, stepsPerOctave]
    );
    const blackIndexSet = useMemo(() => {
        if (rawBlackIndexSet.size === 0 && stepsPerOctave === 12 && whiteIndexSet.size === 0) {
            return new Set([1, 3, 6, 8, 10]);
        }
        return rawBlackIndexSet;
    }, [rawBlackIndexSet, stepsPerOctave, whiteIndexSet]);

    const standardKeys = useMemo(() => {
        const startStep = Math.max(0, Math.min(127, Math.floor(Math.min(standardStartNote, standardEndNote))));
        const endStep = Math.max(0, Math.min(127, Math.floor(Math.max(standardStartNote, standardEndNote))));
        const refStep = Math.max(0, Math.min(127, Math.floor(standardReferenceStep)));
        const keys: StandardKey[] = [];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        let whiteIndex = 0;
        for (let step = startStep; step <= endStep; step += 1) {
            const noteIndex = ((step % stepsPerOctave) + stepsPerOctave) % stepsPerOctave;
            let isBlack = false;
            if (whiteIndexSet.size > 0 && rawBlackIndexSet.size > 0) {
                isBlack = rawBlackIndexSet.has(noteIndex) ? true : !whiteIndexSet.has(noteIndex);
            } else if (whiteIndexSet.size > 0) {
                isBlack = !whiteIndexSet.has(noteIndex);
            } else {
                isBlack = blackIndexSet.has(noteIndex);
            }
            const octave = Math.floor(step / stepsPerOctave) - 1;
            const label = stepsPerOctave === 12
                ? `${noteNames[noteIndex]}${octave}`
                : `S${step}`;
            const ratioFloat = Math.pow(2, (step - refStep) / stepsPerOctave);
            const cents = ((step - refStep) * 1200) / stepsPerOctave;
            const keyId = `std-${step}`;
            const node: NodeData = {
                id: keyId,
                position: new Vector3(),
                primeVector: { ...basePrimeVector },
                ratio: ratioOne,
                ratioFloat,
                octave: 0,
                cents,
                gen: 0,
                originLimit: 0,
                parentId: null,
                name: label
            };
            keys.push({
                id: keyId,
                midi: step,
                label,
                noteIndex,
                isBlack,
                whiteIndex,
                node
            });
            if (!isBlack) whiteIndex += 1;
        }
        return keys;
    }, [basePrimeVector, ratioOne, standardStartNote, standardEndNote, stepsPerOctave, standardReferenceStep, blackIndexSet, rawBlackIndexSet, whiteIndexSet]);

    const standardKeyMap = useMemo(() => new Map(standardKeys.map((key) => [key.id, key])), [standardKeys]);
    const standardKeyBindings = useMemo(() => {
        const map = new Map<string, string>();
        if (standardKeys.length === 0) return map;
        const c3Midi = 48;
        let startIdx = 0;
        if (stepsPerOctave === 12) {
            const cIndex = standardKeys.findIndex((k) => k.midi >= c3Midi && k.noteIndex === 0);
            if (cIndex >= 0) startIdx = cIndex;
            else {
                const nextIndex = standardKeys.findIndex((k) => k.midi >= c3Midi);
                if (nextIndex >= 0) startIdx = nextIndex;
            }
        } else {
            const nextIndex = standardKeys.findIndex((k) => k.midi >= c3Midi);
            if (nextIndex >= 0) startIdx = nextIndex;
        }
        const orderedKeys = startIdx === 0
            ? standardKeys
            : [...standardKeys.slice(startIdx), ...standardKeys.slice(0, startIdx)];
        const maxCount = Math.min(AUTO_BIND_KEYS.length, orderedKeys.length);
        for (let i = 0; i < maxCount; i += 1) {
            map.set(AUTO_BIND_KEYS[i], orderedKeys[i].id);
        }
        return map;
    }, [standardKeys, stepsPerOctave]);

    const whiteKeys = useMemo(() => standardKeys.filter((k) => !k.isBlack), [standardKeys]);
    const blackKeys = useMemo(() => standardKeys.filter((k) => k.isBlack), [standardKeys]);
    const whiteKeyCount = whiteKeys.length;

    const standardWhiteWidth = isMobile ? 22 : 28;
    const standardWhiteHeight = isMobile ? 110 : 160;
    const standardBlackWidth = standardWhiteWidth * 0.6;
    const standardBlackHeight = standardWhiteHeight * 0.6;

    const standardContinuousPoints = useMemo(() => {
        const points = standardKeys.map((key) => {
            const centerX = key.isBlack
                ? key.whiteIndex * standardWhiteWidth
                : key.whiteIndex * standardWhiteWidth + standardWhiteWidth / 2;
            return { x: centerX, cents: key.node.cents };
        });
        points.sort((a, b) => a.x - b.x);
        return points;
    }, [standardKeys, standardWhiteWidth]);

    const getStandardContinuousCents = useCallback((clientX: number) => {
        const container = standardKeyboardRef.current;
        if (!container || standardContinuousPoints.length === 0) return null;
        const rect = container.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
        let lo = 0;
        let hi = standardContinuousPoints.length - 1;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            if (standardContinuousPoints[mid].x < x) lo = mid + 1;
            else hi = mid;
        }
        if (lo <= 0) return standardContinuousPoints[0].cents;
        const right = standardContinuousPoints[lo];
        const left = standardContinuousPoints[lo - 1];
        const span = right.x - left.x;
        if (span <= 0) return right.cents;
        const t = (x - left.x) / span;
        return left.cents + (right.cents - left.cents) * t;
    }, [standardContinuousPoints]);

    useEffect(() => {
        const isTypingTarget = (target: EventTarget | null) => {
            if (!target) return false;
            const el = target as HTMLElement;
            if (el.isContentEditable) return true;
            const tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        };
        const normalizeKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key.toLowerCase());
        const releaseAll = () => {
            pressedKeysRef.current.forEach((entry) => {
                if (entry.layout === 'custom') stopCustomVoice(entry.keyId);
                else stopStandardVoice(entry.keyId);
            });
            pressedKeysRef.current.clear();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (bindingNodeId) return;
            if (e.repeat) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (isTypingTarget(e.target)) return;
            const key = normalizeKey(e.key);
            if (!keyboardHoldNotes && pressedKeysRef.current.has(key)) return;

            if (keyboardLayout === 'custom') {
                const nodeId = keyBindingsMap.get(key);
                if (!nodeId) return;
                const node = customKeyMap.get(nodeId);
                if (!node) return;
                if (keyboardHoldNotes) {
                    if (activeVoicesRef.current[nodeId]) {
                        stopCustomVoice(nodeId);
                        pressedKeysRef.current.delete(key);
                    } else {
                        startCustomVoice(node);
                        pressedKeysRef.current.set(key, { layout: 'custom', keyId: nodeId });
                    }
                } else {
                    startCustomVoice(node);
                    pressedKeysRef.current.set(key, { layout: 'custom', keyId: nodeId });
                }
                e.preventDefault();
                return;
            }

            const standardId = standardKeyBindings.get(key);
            if (!standardId) return;
            const standardKey = standardKeyMap.get(standardId);
            if (!standardKey) return;
            if (keyboardHoldNotes) {
                if (standardVoicesRef.current[standardId]) {
                    stopStandardVoice(standardId);
                    pressedKeysRef.current.delete(key);
                } else {
                    startStandardVoice(standardKey);
                    pressedKeysRef.current.set(key, { layout: 'standard', keyId: standardId });
                }
            } else {
                startStandardVoice(standardKey);
                pressedKeysRef.current.set(key, { layout: 'standard', keyId: standardId });
            }
            e.preventDefault();
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (bindingNodeId) return;
            if (keyboardHoldNotes) return;
            const key = normalizeKey(e.key);
            const entry = pressedKeysRef.current.get(key);
            if (!entry) return;
            if (entry.layout === 'custom') stopCustomVoice(entry.keyId);
            else stopStandardVoice(entry.keyId);
            pressedKeysRef.current.delete(key);
            e.preventDefault();
        };
        const handleVisibility = () => {
            if (document.hidden) releaseAll();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', releaseAll);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', releaseAll);
            document.removeEventListener('visibilitychange', handleVisibility);
            releaseAll();
        };
    }, [
        bindingNodeId,
        keyboardLayout,
        keyBindingsMap,
        customKeyMap,
        standardKeyBindings,
        standardKeyMap,
        startCustomVoice,
        startStandardVoice,
        stopCustomVoice,
        stopStandardVoice,
        keyboardHoldNotes
    ]);

    return (
        <div className="flex flex-col h-full w-full bg-gray-900/50" data-virtual-keyboard>
            <div className={`flex justify-between items-center w-full px-2 py-1 border-b border-gray-800 bg-gray-900 ${isMobile ? 'h-11 overflow-x-auto' : 'h-12'} shrink-0 gap-2`}>
                <div className={`flex items-center ml-2 ${isMobile ? 'gap-2 shrink-0' : 'gap-4'}`}>
                    {viewMode === 'keys' && (
                        <>
                            <button onClick={() => setShowAudioSettings(!showAudioSettings)} className={`font-black uppercase whitespace-nowrap ${showAudioSettings ? 'text-blue-400' : 'text-gray-500'} hover:text-white transition-colors ${isMobile ? 'text-[10px]' : 'text-xs'}`} title="Audio Settings">
                                {audioLabel}
                            </button>
                            <button
                                onClick={() => setDisableWasdInKeyboard(!disableWasdInKeyboard)}
                                className={`font-black uppercase whitespace-nowrap transition-colors ${disableWasdInKeyboard ? 'text-amber-300' : 'text-gray-500 hover:text-white'} ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                title="Disable WASD movement while using the keyboard panel"
                            >
                                {disableWasdInKeyboard ? 'WASD LOCK' : 'WASD MOVE'}
                            </button>
                            <button
                                onClick={() => setKeyboardHoldNotes(!keyboardHoldNotes)}
                                className={`font-black uppercase whitespace-nowrap transition-colors ${keyboardHoldNotes ? 'text-emerald-300' : 'text-gray-500 hover:text-white'} ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                title="Latch notes on/off so you can stack bigger chords"
                            >
                                {keyboardHoldNotes ? 'HOLD ON' : 'HOLD OFF'}
                            </button>
                            <div className="flex items-center rounded-lg border border-gray-700 bg-black/40 p-0.5">
                                <button
                                    onClick={() => setKeyboardLayout('custom')}
                                    className={`font-black uppercase rounded-md transition-colors ${keyboardLayout === 'custom' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'} ${isMobile ? 'text-[9px] px-2 py-1' : 'text-[10px] px-2.5 py-1'}`}
                                >
                                    Custom
                                </button>
                                <button
                                    onClick={() => setKeyboardLayout('standard')}
                                    className={`font-black uppercase rounded-md transition-colors ${keyboardLayout === 'standard' ? 'bg-blue-700 text-white' : 'text-gray-400 hover:text-white'} ${isMobile ? 'text-[9px] px-2 py-1' : 'text-[10px] px-2.5 py-1'}`}
                                >
                                    88-Key
                                </button>
                            </div>
                            {keyboardLayout === 'standard' && (
                                <button
                                    onClick={() => setContinuousPitch(!continuousPitch)}
                                    className={`font-black uppercase whitespace-nowrap transition-colors ${continuousPitch ? 'text-cyan-300' : 'text-gray-500 hover:text-white'} ${isMobile ? 'text-[10px]' : 'text-xs'}`}
                                    title="Continuous pitch mode (no discrete boundaries)"
                                >
                                    {continuousPitch ? 'CONTINUOUS' : 'DISCRETE'}
                                </button>
                            )}
                            {keyboardLayout === 'custom' && (
                                <>
                                    <button onClick={() => setViewMode('add')} className={`font-black text-green-500 hover:text-white border border-green-900/50 rounded-lg bg-green-900/20 active:scale-95 transition-all ${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}>
                                        + NOTE
                                    </button>
                                    <button
                                        onClick={() => setViewMode('duplicate')}
                                        className={`font-black text-purple-400 hover:text-white border border-purple-900/50 rounded-lg bg-purple-900/20 active:scale-95 transition-all ${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}
                                        title="Duplicate all keys with a pitch factor"
                                    >
                                        ⊕ DUP
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className={`flex items-center mr-2 ${isMobile ? 'gap-2 shrink-0' : 'gap-3'}`} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    {viewMode === 'keys' ? (
                        <>
                            <button
                                onClick={handleRecordToggle}
                                disabled={recordDisabled}
                                title={recordDisabled ? recordDisabledReason : 'Toggle recording'}
                                className={`font-black rounded-lg border transition-all active:scale-95 whitespace-nowrap ${isRecording ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'} ${recordDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isMobile ? 'text-[10px] px-2.5 py-1' : 'text-xs px-4 py-1.5'}`}
                            >
                                {recordLabel}
                            </button>

                            {keyboardLayout === 'custom' && (
                                <>
                                    <div className="relative">
                                        <button onClick={() => setShowSavedList(!showSavedList)} className={`font-black text-blue-400 hover:text-white border border-blue-900/50 rounded-lg bg-blue-900/20 active:scale-95 transition-all ${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}>
                                            LOAD
                                        </button>
                                        {showSavedList && (
                                            <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[60] max-h-48 overflow-y-auto">
                                                {savedKeyboards.length === 0 && <div className="p-3 text-xs text-gray-500 italic">No saved layouts.</div>}
                                                {savedKeyboards.length > 0 && (
                                                    savedKeyboards.length > 200 ? (
                                                        <VirtualList
                                                            items={savedKeyboards}
                                                            itemHeight={36}
                                                            height={192}
                                                            className="max-h-48 overflow-y-auto"
                                                            getKey={(kb) => kb.id}
                                                            renderItem={(kb) => (
                                                                <div className="flex justify-between items-center p-2.5 hover:bg-blue-900/30 border-b border-gray-800 last:border-0 group">
                                                                    <button onClick={() => { loadKeyboard(kb); setShowSavedList(false); }} className="text-xs text-left text-gray-300 flex-1 truncate font-black uppercase tracking-tighter">{kb.name}</button>
                                                                    <button onClick={() => deleteKeyboard(kb.id)} className="text-sm text-red-500 px-2 opacity-0 group-hover:opacity-100 hover:text-red-300">x</button>
                                                                </div>
                                                            )}
                                                        />
                                                    ) : (
                                                        savedKeyboards.map(kb => (
                                                            <div key={kb.id} className="flex justify-between items-center p-2.5 hover:bg-blue-900/30 border-b border-gray-800 last:border-0 group">
                                                                <button onClick={() => { loadKeyboard(kb); setShowSavedList(false); }} className="text-xs text-left text-gray-300 flex-1 truncate font-black uppercase tracking-tighter">{kb.name}</button>
                                                                <button onClick={() => deleteKeyboard(kb.id)} className="text-sm text-red-500 px-2 opacity-0 group-hover:opacity-100 hover:text-red-300">x</button>
                                                            </div>
                                                        ))
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={() => setShowSaveUI(true)} className={`font-black text-gray-200 hover:text-white border border-blue-500 rounded-lg bg-blue-900/30 active:scale-95 transition-all uppercase ${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}>Save</button>
                                    <button onClick={clearKeyboard} className={`font-black text-white bg-red-950/80 hover:bg-red-800 border border-red-900 rounded-lg active:scale-95 transition-all uppercase ${isMobile ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'}`}>CLR</button>
                                </>
                            )}
                        </>
                    ) : (
                        <button onClick={() => setViewMode('keys')} className={`font-black text-gray-300 hover:text-white border border-gray-600 rounded-lg active:scale-95 transition-all uppercase ${isMobile ? 'text-[10px] px-3 py-1' : 'text-xs px-4 py-1.5'}`}>← BACK</button>
                    )}
                </div>
            </div>

            {viewMode === 'add' ? (
                <div className="p-6 bg-gray-900 text-sm text-gray-300 space-y-4 flex-1 overflow-y-auto custom-scrollbar" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    <h3 className="font-black text-white uppercase mb-3 tracking-widest text-base">Add Manual Note</h3>
                    <div className="flex gap-4 items-center">
                        <label className="w-20 font-bold uppercase text-xs text-gray-500">Name:</label>
                        <input type="text" value={addNoteName} onKeyDown={e => e.stopPropagation()} onChange={e => setAddNoteName(e.target.value)} className="bg-black border border-gray-700 rounded-xl p-2.5 flex-1 text-white outline-none focus:border-blue-500" placeholder="e.g. Wolf 5th" />
                    </div>
                    <div className="flex gap-4 items-center">
                        <label className="w-20 font-bold uppercase text-xs text-gray-500">Ratio:</label>
                        <input type="text" value={addRatioNum} onKeyDown={e => e.stopPropagation()} onChange={e => setAddRatioNum(e.target.value)} className="bg-black border border-gray-700 rounded-xl p-2.5 w-24 text-center text-white outline-none focus:border-blue-500 font-mono" placeholder="1.25" />
                        <span className="text-gray-500 font-black text-xl">/</span>
                        <input type="text" value={addRatioDen} onKeyDown={e => e.stopPropagation()} onChange={e => setAddRatioDen(e.target.value)} className="bg-black border border-gray-700 rounded-xl p-2.5 w-24 text-center text-white outline-none focus:border-blue-500 font-mono" placeholder="1" />
                    </div>
                    <div className="text-xs text-gray-500 italic">
                        Supports decimals up to 8 places (e.g., 1.25, 3.14159265) and math expressions (e.g., pi, sqrt(2), 2^(7/12))
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleManualAdd} className="bg-green-700 hover:bg-green-600 text-white px-8 py-3 rounded-xl font-black uppercase shadow-lg transition-all active:scale-95">Add Note</button>
                    </div>
                </div>
            ) : viewMode === 'duplicate' ? (
                <div className="p-6 bg-gray-900 text-sm text-gray-300 space-y-4 flex-1 overflow-y-auto custom-scrollbar" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    <h3 className="font-black text-white uppercase mb-3 tracking-widest text-base">Duplicate All Keys</h3>
                    <p className="text-xs text-gray-500 mb-4">
                        Creates copies of all existing keys multiplied by a frequency factor.
                        Use <span className="text-purple-400">2/1</span> for octave up, <span className="text-purple-400">1/2</span> for octave down,
                        <span className="text-purple-400">3/2</span> for a fifth, or any ratio like <span className="text-purple-400">a^(k/n)</span>.
                    </p>
                    <div className="flex gap-4 items-center">
                        <label className="w-28 font-bold uppercase text-xs text-gray-500">Factor:</label>
                        <input
                            type="text"
                            value={dupFactorNum}
                            onKeyDown={e => e.stopPropagation()}
                            onChange={e => setDupFactorNum(e.target.value)}
                            className="bg-black border border-gray-700 rounded-xl p-2.5 w-24 text-center text-white outline-none focus:border-purple-500 font-mono"
                            placeholder="2.0"
                        />
                        <span className="text-gray-500 font-black text-xl">/</span>
                        <input
                            type="text"
                            value={dupFactorDen}
                            onKeyDown={e => e.stopPropagation()}
                            onChange={e => setDupFactorDen(e.target.value)}
                            className="bg-black border border-gray-700 rounded-xl p-2.5 w-24 text-center text-white outline-none focus:border-purple-500 font-mono"
                            placeholder="1"
                        />
                    </div>
                    <div className="text-xs text-gray-500 italic mb-2">
                        Supports decimals up to 8 places and math expressions
                    </div>
                    <div className="flex gap-2 flex-wrap mt-3">
                        <button onClick={() => { setDupFactorNum("2"); setDupFactorDen("1"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">+1 Oct (2/1)</button>
                        <button onClick={() => { setDupFactorNum("1"); setDupFactorDen("2"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">-1 Oct (1/2)</button>
                        <button onClick={() => { setDupFactorNum("3"); setDupFactorDen("2"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">5th (3/2)</button>
                        <button onClick={() => { setDupFactorNum("4"); setDupFactorDen("3"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">4th (4/3)</button>
                        <button onClick={() => { setDupFactorNum("5"); setDupFactorDen("4"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">M3 (5/4)</button>
                        <button onClick={() => { setDupFactorNum("3"); setDupFactorDen("1"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">Tritave (3/1)</button>
                        <button onClick={() => { setDupFactorNum("1.5"); setDupFactorDen("1"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">5th (1.5)</button>
                        <button onClick={() => { setDupFactorNum("1.25"); setDupFactorDen("1"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">M3 (1.25)</button>
                        <button onClick={() => { setDupFactorNum("0.5"); setDupFactorDen("1"); }} className="text-[10px] px-2 py-1 bg-purple-900/30 border border-purple-700/50 rounded-lg text-purple-300 hover:bg-purple-800/40 transition-colors">-1 Oct (0.5)</button>
                    </div>
                    <div className="flex justify-between pt-4">
                        <button onClick={() => setViewMode('keys')} className="text-gray-400 hover:text-white px-4 py-2 font-black uppercase text-xs transition-colors">← Back</button>
                        <button
                            onClick={() => {
                                try {

                                    let numFrac: { n: bigint; d: bigint }, denFrac: { n: bigint; d: bigint };

                                    if (dupFactorNum.includes('.')) {

                                        const decimal = parseFloat(dupFactorNum);
                                        if (isNaN(decimal)) throw new Error("Invalid decimal number");

                                        const decimalPlaces = (dupFactorNum.split('.')[1] || '').length;
                                        const denominator = Math.pow(10, Math.min(decimalPlaces, 8));
                                        const numerator = decimal * denominator;

                                        numFrac = {
                                            n: BigInt(Math.floor(numerator) as number),
                                            d: BigInt(Math.floor(denominator) as number)
                                        };
                                    } else {
                                        numFrac = parseAdvancedMath(dupFactorNum || "1");
                                    }

                                    if (dupFactorDen.includes('.')) {

                                        const decimal = parseFloat(dupFactorDen);
                                        if (isNaN(decimal)) throw new Error("Invalid decimal number");

                                        const decimalPlaces = (dupFactorDen.split('.')[1] || '').length;
                                        const denominator = Math.pow(10, Math.min(decimalPlaces, 8));
                                        const numerator = decimal * denominator;

                                        denFrac = {
                                            n: BigInt(Math.floor(numerator) as number),
                                            d: BigInt(Math.floor(denominator) as number)
                                        };
                                    } else {
                                        denFrac = parseAdvancedMath(dupFactorDen || "1");
                                    }

                                    const finalN: bigint = numFrac.n * denFrac.d;
                                    const finalD: bigint = numFrac.d * denFrac.n;
                                    if (finalD === 0n || finalN === 0n) {
                                        notifyError('Invalid factor.', 'Keyboard');
                                        return;
                                    }
                                    duplicateKeyboardWithFactor(finalN, finalD);
                                    setViewMode('keys');
                                } catch (e) {
                                    notifyError('Invalid factor expression.', 'Keyboard');
                                }
                            }}
                            disabled={customKeyboard.length === 0}
                            className={`px-8 py-3 rounded-xl font-black uppercase shadow-lg transition-all active:scale-95 ${customKeyboard.length === 0 ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-600 text-white'}`}
                        >
                            Duplicate {customKeyboard.length} Key{customKeyboard.length !== 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {showSaveUI && (
                        <div className="p-3 bg-gray-900 border-b border-gray-800 flex gap-2">
                            <input
                                type="text"
                                value={kbName}
                                onChange={e => setKbName(e.target.value)}
                                placeholder="New layout name..."
                                className="flex-1 bg-black border border-gray-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
                                autoFocus
                                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') handleSave(); }}
                            />
                            <button onClick={handleSave} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-black uppercase transition-all active:scale-95">SAVE</button>
                            <button onClick={() => setShowSaveUI(false)} className="text-xs text-gray-500 px-3 font-bold hover:text-white uppercase">CANCEL</button>
                        </div>
                    )}

                    {showAudioSettings && (
                        <div className="p-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Instrument</span>
                                <select
                                    value={settings.instrumentKeyboard}
                                    onChange={e => updateSettings({ instrumentKeyboard: e.target.value as any })}
                                    className="bg-black border border-gray-700 text-blue-400 text-xs font-black rounded-lg px-2 py-1.5 outline-none"
                                >
                                    {instrumentOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col flex-1 max-w-xs">
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Hold Sustain</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono text-gray-400 font-bold w-10">{settings.playDurationDual}s</span>
                                    <input type="range" min="0.5" max="10" step="0.5" value={settings.playDurationDual} onChange={e => updateSettings({ playDurationDual: parseFloat(e.target.value) })} className="flex-1 h-1.5 accent-blue-500" />
                                </div>
                            </div>
                            <button onClick={() => setShowAudioSettings(false)} className="text-[10px] text-gray-500 font-black hover:text-white uppercase tracking-tighter">✕ CLOSE</button>
                        </div>
                    )}

                    {keyboardLayout === 'standard' ? (
                        <div className={`${isMobile ? 'p-2' : 'p-3'} w-full overflow-x-auto overflow-y-hidden`} style={{ touchAction: 'pan-x' }}>
                            <div
                                ref={standardKeyboardRef}
                                className="relative"
                                style={{
                                    width: whiteKeyCount * standardWhiteWidth,
                                    height: standardWhiteHeight
                                }}
                            >
                                <div className="absolute inset-0 flex">
                                    {whiteKeys.map((key) => {
                                        const isPlaying = standardPlaying.has(key.id);
                                        const showLabel = standardLabelMode === 'all' || (standardLabelMode === 'c' && key.noteIndex === 0);
                                        return (
                                            <div
                                                key={key.id}
                                                data-kb-key-type="standard"
                                                data-kb-key-id={key.id}
                                                className={`relative border border-gray-600 box-border cursor-pointer select-none ${isPlaying ? 'bg-cyan-200 text-gray-900' : 'bg-white text-gray-900'} transition-colors`}
                                                style={{ width: standardWhiteWidth, height: standardWhiteHeight, touchAction: 'none' }}
                                                onPointerDown={(e) => handleStandardPointerDown(e, key)}
                                                onPointerMove={(e) => handleStandardPointerMove(e)}
                                                onPointerUp={(e) => handleStandardPointerUp(e, key)}
                                                onPointerLeave={(e) => handleStandardPointerLeave(e, key)}
                                                onPointerCancel={(e) => handleStandardPointerUp(e, key)}
                                                onContextMenu={(e) => e.preventDefault()}
                                                onDragStart={(e) => e.preventDefault()}
                                                onTouchStart={(e) => e.preventDefault()}
                                                onTouchEnd={(e) => e.preventDefault()}
                                                onTouchCancel={(e) => e.preventDefault()}
                                            >
                                                {showLabel && (
                                                    <div className="absolute bottom-1 left-0 right-0 text-[9px] text-center text-gray-700 font-black pointer-events-none">
                                                        {key.label}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {blackKeys.map((key) => {
                                    const isPlaying = standardPlaying.has(key.id);
                                    const left = key.whiteIndex * standardWhiteWidth - standardBlackWidth / 2;
                                    return (
                                        <div
                                            key={key.id}
                                            data-kb-key-type="standard"
                                            data-kb-key-id={key.id}
                                            className={`absolute top-0 z-10 rounded-sm border border-gray-900 box-border cursor-pointer select-none ${isPlaying ? 'bg-blue-600' : 'bg-black'} transition-colors`}
                                            style={{ left, width: standardBlackWidth, height: standardBlackHeight, touchAction: 'none' }}
                                            onPointerDown={(e) => handleStandardPointerDown(e, key)}
                                            onPointerMove={(e) => handleStandardPointerMove(e)}
                                            onPointerUp={(e) => handleStandardPointerUp(e, key)}
                                            onPointerLeave={(e) => handleStandardPointerLeave(e, key)}
                                            onPointerCancel={(e) => handleStandardPointerUp(e, key)}
                                            onContextMenu={(e) => e.preventDefault()}
                                            onDragStart={(e) => e.preventDefault()}
                                            onTouchStart={(e) => e.preventDefault()}
                                            onTouchEnd={(e) => e.preventDefault()}
                                            onTouchCancel={(e) => e.preventDefault()}
                                        >
                                            {standardLabelMode === 'all' && stepsPerOctave === 12 && (
                                                <div className="absolute bottom-1 left-0 right-0 text-[8px] text-center text-gray-200 opacity-70 font-black pointer-events-none">
                                                    {key.label.replace(/\d+$/, '')}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-end gap-3 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                <div>Standard Keyboard</div>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Start</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={standardStartNote}
                                        onChange={(e) => setStandardStartNote(Math.max(0, Math.min(127, Number(e.target.value))))}
                                        className="w-14 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">End</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={standardEndNote}
                                        onChange={(e) => setStandardEndNote(Math.max(0, Math.min(127, Number(e.target.value))))}
                                        className="w-14 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Labels</span>
                                    <select
                                        value={standardLabelMode}
                                        onChange={(e) => setStandardLabelMode(e.target.value as 'none' | 'c' | 'all')}
                                        className="bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                    >
                                        <option value="none">None</option>
                                        <option value="c">C Only</option>
                                        <option value="all">All</option>
                                    </select>
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Steps/Oct</span>
                                    <input
                                        type="number"
                                        min={2}
                                        max={72}
                                        value={standardStepsPerOctave}
                                        onChange={(e) => setStandardStepsPerOctave(Math.max(2, Math.min(72, Math.floor(Number(e.target.value)))) || 12)}
                                        className="w-14 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Ref Step</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={standardReferenceStep}
                                        onChange={(e) => setStandardReferenceStep(Math.max(0, Math.min(127, Math.floor(Number(e.target.value)))) || 0)}
                                        className="w-14 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">Black Steps</span>
                                    <input
                                        type="text"
                                        value={standardBlackIndicesText}
                                        onChange={(e) => setStandardBlackIndicesText(e.target.value)}
                                        placeholder="e.g. 1,3,6,8,10"
                                        className="w-32 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                        title="0-based step indices within the octave"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-gray-500">White Steps</span>
                                    <input
                                        type="text"
                                        value={standardWhiteIndicesText}
                                        onChange={(e) => setStandardWhiteIndicesText(e.target.value)}
                                        placeholder="optional, e.g. 0,2,4,5,7,9,11"
                                        className="w-40 bg-black/60 border border-gray-700 rounded px-1 py-0.5 text-[10px] text-gray-200"
                                        title="0-based step indices within the octave"
                                    />
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className={`${isMobile ? 'p-2' : 'p-3'} flex flex-wrap gap-3 overflow-y-auto content-start items-start select-none custom-scrollbar flex-1 w-full`} style={{ touchAction: 'none' }}>
                            {customKeyboard.length === 0 && (
                                <div className="text-gray-600 text-sm italic w-full text-center py-8">
                                    Bank empty. Right-click nodes in lattice or use "+ NOTE" to populate.
                                </div>
                            )}
                            {customKeyboard.map(node => {
                                const binding = keyBindings[node.id];
                                const isBinding = bindingNodeId === node.id;
                                const isPlaying = playingNodeIds.has(node.id);

                                return (
                                    <div
                                        key={node.id}
                                        data-kb-key-type="custom"
                                        data-kb-key-id={node.id}
                                        className={`
                            relative group flex flex-col items-center justify-between
                            ${keySizeClass} bg-gray-900 rounded-xl border-2
                            ${isPlaying ? 'border-cyan-400 bg-cyan-900/20 scale-105 shadow-[0_0_20px_rgba(0,255,255,0.4)]' : (isBinding ? 'border-yellow-500 animate-pulse bg-gray-800' : 'border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/50')}
                            shrink-0 p-2 transition-all cursor-pointer select-none active:scale-95 active:bg-gray-700
                        `}
                                        style={{ touchAction: 'none' }}
                                        onPointerDown={(e) => handleKeyPointerDown(e, node)}
                                        onPointerMove={(e) => handleKeyPointerMove(e)}
                                        onPointerUp={(e) => handleKeyPointerUp(e, node)}
                                        onPointerLeave={(e) => handleKeyPointerLeave(e, node)}
                                        onPointerCancel={(e) => handleKeyPointerUp(e, node)}
                                        onMouseUp={(e) => { if (!keyboardHoldNotes) stopCustomVoice(node.id); }}
                                        onTouchEnd={(e) => { if (!keyboardHoldNotes) stopCustomVoice(node.id); }}
                                    >
                                        <button
                                            onPointerDown={(e) => { e.stopPropagation(); removeFromKeyboard(node.id); }}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-900 text-white rounded-full flex items-center justify-center text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg hover:bg-red-600"
                                        >
                                            ×
                                        </button>

                                        <div className={`${keyNameClass} font-black truncate w-full text-center pointer-events-none tracking-tighter ${isPlaying ? 'text-white' : 'text-blue-300'}`} title={node.name}>
                                            {node.name}
                                        </div>

                                        <div className={`${keyRatioClass} font-mono font-bold pointer-events-none ${isPlaying ? 'text-cyan-200' : 'text-gray-600'}`}>
                                            {formatRatio(node.ratio)}
                                        </div>

                                        <div className="flex gap-2.5 items-center justify-center py-1" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); shiftKeyboardOctave(node.id, -1); }}
                                                className="w-5 h-5 text-[8px] bg-black border border-gray-700 hover:border-blue-500 rounded-md text-gray-400 flex items-center justify-center active:bg-blue-900 font-black transition-colors"
                                                title="-1 Octave"
                                            >-</button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); shiftKeyboardOctave(node.id, 1); }}
                                                className="w-5 h-5 text-[8px] bg-black border border-gray-700 hover:border-blue-500 rounded-md text-gray-400 flex items-center justify-center active:bg-blue-900 font-black transition-colors"
                                                title="+1 Octave"
                                            >+</button>
                                        </div>

                                        <button
                                            onPointerDown={(e) => { e.stopPropagation(); setBindingNodeId(node.id); }}
                                            className={`
                            w-full text-center font-black py-1.5 rounded-lg ${keyBindClass}
                            ${binding ? (isPlaying ? 'bg-cyan-500 text-white' : 'bg-blue-900/80 text-blue-200 border border-blue-500/30') : 'bg-gray-800 text-gray-500 border border-gray-700'}
                            hover:bg-blue-700 hover:text-white transition-colors uppercase tracking-tighter
                            `}
                                            title="Press a key to bind it to this note"
                                        >
                                            {isBinding ? 'WAIT' : (binding === ' ' ? 'SPACE' : (binding || 'BIND'))}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
