
import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import { startNote } from '../../../audioEngine';
import type { NodeData, AppSettings, EarTaskType } from '../../../types';
import { calculateCents, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio } from '../../../musicLogic';
import { Vector3 } from 'three';
import EarTrainingPart2Panel from './EarTrainingPart2Panel';
import { EarTrainingDataPanel } from './EarTrainingDataPanel';
import { EarTrainingProSettingsPanel } from './EarTrainingProSettingsPanel';
import { MistakesPanel } from './earTrainingOverlay/MistakesPanel';
import { StatsPanel } from './earTrainingOverlay/StatsPanel';
import { TASK_LABELS, normalizeChordRatioText } from './earTrainingOverlay/helpers';
import { getSignatureKey } from './EarLogic';

export const EarTrainingOverlay = () => {
    const {
      earTraining,
      stopEarSession,
      backToEarSettings,
      submitEarAnswer,
      nextEarQuestion,
      settings,
      startEarSession,
      updateEarSettings,
      recordEarReplay,
      startReviewSession,
      setEarPanel,
      setEarTrainingPersistedPart2,
      startPracticeSignature,
      deleteReviewItem
    } = useStore((s) => ({
      earTraining: s.earTraining,
      stopEarSession: s.stopEarSession,
      backToEarSettings: s.backToEarSettings,
      submitEarAnswer: s.submitEarAnswer,
      nextEarQuestion: s.nextEarQuestion,
      settings: s.settings,
      startEarSession: s.startEarSession,
      updateEarSettings: s.updateEarSettings,
      recordEarReplay: s.recordEarReplay,
      startReviewSession: s.startReviewSession,
      setEarPanel: s.setEarPanel,
      setEarTrainingPersistedPart2: s.setEarTrainingPersistedPart2,
      startPracticeSignature: s.startPracticeSignature,
      deleteReviewItem: s.deleteReviewItem
    }), shallow);
    const [feedbackTxt, setFeedbackTxt] = useState<string | null>(null);
    const [showOptions, setShowOptions] = useState(true);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [textAnswer, setTextAnswer] = useState('');
    const [duoTextAnswers, setDuoTextAnswers] = useState(['', '']);
    const [leftPanelWidth, setLeftPanelWidth] = useState(66); 
    const isResizingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const activeVoices = useRef<(() => void)[]>([]);
    const timeoutsRef = useRef<number[]>([]);
    const metronomeNodeRef = useRef<NodeData | null>(null);

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingRef.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(30, Math.min(80, (x / rect.width) * 100));
            setLeftPanelWidth(percentage);
        };
        const handleMouseUp = () => {
            if (isResizingRef.current) {
                isResizingRef.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    const clearScheduled = () => {
        timeoutsRef.current.forEach(id => window.clearTimeout(id));
        timeoutsRef.current = [];
    };
    const stopAllAudio = () => {
        clearScheduled();
        activeVoices.current.forEach(f => f());
        activeVoices.current = [];
    };
    const getMetronomeNode = () => {
        if (metronomeNodeRef.current) return metronomeNodeRef.current;
        const ratio = { n: 2n, d: 1n };
        const node: NodeData = {
            id: 'metronome-click',
            position: new Vector3(0, 0, 0),
            primeVector: getPrimeVectorFromRatio(ratio.n, ratio.d),
            ratio,
            octave: 0,
            cents: calculateCents(ratio),
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: 'Metronome'
        };
        metronomeNodeRef.current = node;
        return node;
    };
    const fromAdvanced = earTraining.returnTo === 'advanced';

    useEffect(() => {
        return () => {
            stopAllAudio();
        };
    }, [])
    useEffect(() => {
        const delay = earTraining.settings.pro?.memoryDelayMs ?? 0;
        setShowOptions(delay <= 0);
        if (delay > 0) {
            const id = window.setTimeout(() => setShowOptions(true), delay);
            return () => window.clearTimeout(id);
        }
    }, [earTraining.currentQuestion?.id, earTraining.settings.pro?.memoryDelayMs]);

    useEffect(() => {
        setTextAnswer('');
        setDuoTextAnswers(['', '']);
    }, [earTraining.currentQuestion?.id]);

    const getPlaySettings = () => {
        const earTimbre = earTraining.settings.timbre;
        return {
            ...settings,
            instrumentClick: earTimbre.clickInstrument ?? settings.instrumentClick,
            instrumentChord: earTimbre.chordInstrument ?? settings.instrumentChord
        };
    };
    const resolveClickInstrument = (playSettings: AppSettings) =>
        playSettings.instrumentClick || playSettings.waveform || 'sine';

    const playNodes = (
        soundData: { nodes: NodeData[]; mode: 'sequence' | 'chord' | 'ab_test' | 'duo' | 'progression'; layers?: NodeData[][]; chords?: NodeData[][]; durations?: number[]; layerDurations?: number[][]; chordDurations?: number[]; baseFreq: number; morphA?: number; morphB?: number },
        morphOverride?: number,
        baseFreqOverride?: number,
        startDelay: number = 0,
        clearFirst: boolean = true,
        enableMetronome: boolean = false,
        forceContinuous: boolean = false
    ) => {
        if (clearFirst) {
            stopAllAudio();
        }
        const playSettings: AppSettings = getPlaySettings();
        if (morphOverride !== undefined) {
            playSettings.visuals = { ...settings.visuals, temperamentMorph: morphOverride };
        }
        if (baseFreqOverride !== undefined) {
            playSettings.baseFrequency = baseFreqOverride;
        }
        const earTimbre = earTraining.settings.timbre;
        const duoUpperInstrument = earTimbre.instrumentDuoUpper ?? playSettings.instrumentClick;
        const duoLowerInstrument = earTimbre.instrumentDuoLower ?? playSettings.instrumentClick;
        const { noteMs, gapMs, chordMs } = earTraining.settings.playback;
        const sequenceGap = forceContinuous ? 0 : gapMs;
        const effectiveGap = soundData.mode === 'sequence' ? sequenceGap : gapMs;
        const playSequence = (seq: NodeData[], initialDelay: number = 0, durations?: number[]) => {
            let delay = initialDelay;
            seq.forEach((n, idx) => {
                const durScale = durations?.[idx] ?? soundData.durations?.[idx] ?? 1;
                const duration = noteMs * durScale;
                if (!n || n.isRest) {
                    delay += duration + effectiveGap;
                    return;
                }
                const tStart = window.setTimeout(() => {
                    const stop = startNote(n, playSettings, 'click');
                    activeVoices.current.push(stop);
                    
                    const tStop = window.setTimeout(() => stop(), Math.max(30, duration));
                    timeoutsRef.current.push(tStop);
                }, delay);
                timeoutsRef.current.push(tStart);
                delay += duration + effectiveGap;
            });
        };
        const playChord = (chord: NodeData[], initialDelay: number = 0, durScale: number = 1) => {
            const tStart = window.setTimeout(() => {
                chord.forEach(n => {
                    const stop = startNote(n, playSettings, 'chord');
                    activeVoices.current.push(stop);
                    const tStop = window.setTimeout(() => stop(), Math.max(50, chordMs * durScale));
                    timeoutsRef.current.push(tStop);
                });
            }, initialDelay);
            timeoutsRef.current.push(tStart);
        };

        const beatMs = Math.max(1, noteMs + sequenceGap);
        const doCountIn = enableMetronome && (soundData.mode === 'sequence' || soundData.mode === 'duo');
        const countInBeats = doCountIn ? 4 : 0;
        const countInMs = countInBeats * beatMs;
        if (doCountIn) {
            const metroNode = getMetronomeNode();
            const tickMs = Math.max(30, Math.min(150, noteMs * 0.25));
            for (let i = 0; i < countInBeats; i++) {
                const velocity = i === 0 ? 1 : (i === 2 ? 0.85 : 0.7);
                const tStart = window.setTimeout(() => {
                    const stop = startNote(metroNode, playSettings, 'click', 0, undefined, velocity);
                    activeVoices.current.push(stop);
                    const tStop = window.setTimeout(() => stop(), tickMs);
                    timeoutsRef.current.push(tStop);
                }, startDelay + (i * beatMs));
                timeoutsRef.current.push(tStart);
            }
        }
        const playbackDelay = startDelay + countInMs;

        if (soundData.mode === 'progression' && soundData.chords) {
            let offset = playbackDelay;
            soundData.chords.forEach((chord, idx) => {
                const durScale = soundData.chordDurations?.[idx] ?? 1;
                playChord(chord, offset, durScale);
                offset += chordMs * durScale;
            });
            return;
        }

        if (soundData.mode === 'duo' && soundData.layers) {
            const layers = soundData.layers;
            layers.forEach((layer, layerIdx) => {
                const durations = soundData.layerDurations?.[layerIdx] ?? soundData.durations;
                const duoGap = forceContinuous ? 0 : gapMs;
                const layerSettings = {
                    ...playSettings,
                    instrumentClick: layerIdx === 0 ? duoUpperInstrument : duoLowerInstrument
                };
                let offset = playbackDelay;
                layer.forEach((note, idx) => {
                    const durScale = durations?.[idx] ?? 1;
                    const duration = noteMs * durScale;
                    if (!note || note.isRest) {
                        offset += (noteMs + duoGap) * durScale;
                        return;
                    }
                    const tStart = window.setTimeout(() => {
                        const stop = startNote(note, layerSettings, 'click');
                        activeVoices.current.push(stop);
                        const tStop = window.setTimeout(() => stop(), Math.max(30, duration));
                        timeoutsRef.current.push(tStop);
                    }, offset);
                    timeoutsRef.current.push(tStart);
                    offset += (noteMs + duoGap) * durScale;
                });
            });
            return;
        }

        if (soundData.mode === 'chord') {
            playChord(soundData.nodes, playbackDelay);
            return;
        }

        playSequence(soundData.nodes, playbackDelay);
    };
    const handlePlayPrompt = () => {
        
        const allowReplay = earTraining.settings.pro?.allowReplay ?? true;
        const maxReplays = earTraining.settings.pro?.maxReplays ?? 0;
        if (!allowReplay) return;
        if (maxReplays > 0 && earTraining.currentReplays >= maxReplays) return;
        recordEarReplay(); 
        if (!earTraining.currentQuestion) return;
        const q = earTraining.currentQuestion;
        const baseFreq = q.soundData.baseFreq; 
        const { noteMs, gapMs, chordMs } = earTraining.settings.playback;
        const forceContinuous = q.type === 'melody' || q.type === 'duo_melody';
        const enableMetronome = (earTraining.settings.pro?.sequence?.metronomeEnabled ?? true)
            && (q.type === 'melody' || q.type === 'duo_melody');
        stopAllAudio();
        let questionDelay = 0;
        if (q.referenceTone) {
            const refNode = q.referenceTone.node;
            const playSettings = getPlaySettings();
            const currentInst = resolveClickInstrument(playSettings);
            const refInst = currentInst === 'organ' ? 'sine' : 'organ';
            const tStart = window.setTimeout(() => {
                const stop = startNote(refNode, { ...playSettings, baseFrequency: baseFreq, instrumentClick: refInst }, 'click');
                activeVoices.current.push(stop);
                const tStop = window.setTimeout(() => stop(), noteMs);
                timeoutsRef.current.push(tStop);
            }, 0);
            timeoutsRef.current.push(tStart);
            questionDelay = noteMs + gapMs;
        }
        if (q.soundData.mode === 'ab_test') {
            playNodes(q.soundData, q.soundData.morphA, baseFreq, questionDelay, false, false, forceContinuous);
            const waitTime = questionDelay + chordMs + 500;
            const t = window.setTimeout(() => {
                playNodes(q.soundData, q.soundData.morphB, baseFreq, 0, true, false, forceContinuous);
            }, waitTime);
            timeoutsRef.current.push(t);
        } else {
            playNodes(q.soundData, undefined, baseFreq, questionDelay, false, enableMetronome, forceContinuous);
        }
    };
    const handlePlayA = () => {
        if (!earTraining.currentQuestion) return;
        const q = earTraining.currentQuestion;
        const baseFreq = q.soundData.baseFreq;
        if (q.type === 'drift') playNodes(q.soundData, q.soundData.morphA, baseFreq);
        else if (q.type === 'compare') {
            playNodes({ ...q.soundData, nodes: [q.soundData.nodes[0]], mode: 'sequence' }, undefined, baseFreq);
        }
    };
    const handlePlayB = () => {
        if (!earTraining.currentQuestion) return;
        const q = earTraining.currentQuestion;
        const baseFreq = q.soundData.baseFreq;
        if (q.type === 'drift') playNodes(q.soundData, q.soundData.morphB, baseFreq);
        else if (q.type === 'compare') {
            playNodes({ ...q.soundData, nodes: [q.soundData.nodes[1]], mode: 'sequence' }, undefined, baseFreq);
        }
    };

    const playRoot = () => {
        if (!earTraining.currentQuestion) return;
        const q = earTraining.currentQuestion;
        const baseFreq = q.soundData.baseFreq;
        const rootNode: NodeData = {
            id: 'root-preview',
            position: new Vector3(0, 0, 0),
            primeVector: getPrimeVectorFromRatio(1n, 1n),
            ratio: { n: 1n, d: 1n },
            octave: 0,
            cents: 0,
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: 'Root (1/1)'
        };
        const playSettings = getPlaySettings();
        const currentInst = resolveClickInstrument(playSettings);
        const refInst = currentInst === 'organ' ? 'sine' : 'organ';
        const stop = startNote(rootNode, { ...playSettings, baseFrequency: baseFreq, instrumentClick: refInst }, 'click');
        activeVoices.current.push(stop);
        setTimeout(() => stop(), 1000);
    };

    const normalizeRestTokens = (value: string) => value.replace(/\b(r|rest)\b/gi, 'rest');
    const normalizeAnswer = (value: string, taskType: EarTaskType, signature?: any) => {
        const withoutCents = normalizeRestTokens(value.replace(/\([^)]*c\)/gi, ''));
        if (taskType === 'chord' && signature?.chord?.answerFormat === 'ratios') {
            return normalizeChordRatioText(withoutCents);
        }
        let normalized = withoutCents.replace(/\s+/g, '').toLowerCase();
        if (taskType === 'progression') {
            normalized = normalized.replace(/(^|[;,])1\/1(@[\d.]+)?(?=([,;]|$))/g, '$1');
        }
        return normalized;
    };
    const handleAnswer = (optId: string) => {
        if (earTraining.phase !== 'answer' && earTraining.phase !== 'listen') return;
        const q = earTraining.currentQuestion;
        if (!q) return;
        const isText = q.answerMode === 'text';
        if (isText) {
            const expected = q.expectedAnswer ?? '';
            const correct = normalizeAnswer(optId, q.type, q.signature) === normalizeAnswer(expected, q.type, q.signature);
            setFeedbackTxt(correct ? "CORRECT!" : "WRONG");
        } else {
            const selected = q.options.find(o => o.id === optId);
            setFeedbackTxt(selected?.isCorrect ? "CORRECT!" : "WRONG");
        }
        submitEarAnswer(optId);
    };
    const toggleTask = (task: EarTaskType) => {
        const current = new Set(earTraining.settings.tasks);
        if (current.has(task)) {
            if (current.size > 1) current.delete(task); 
        } else {
            current.add(task);
        }
        updateEarSettings({ tasks: Array.from(current) });
    };
    
    const q = earTraining.currentQuestion;
    const textAnswerStats = React.useMemo(() => {
        if (!q?.signature) return null;
        const key = getSignatureKey(q.signature);
        const attempts = earTraining.persisted.attempts ?? [];
        let total = 0;
        let correct = 0;
        attempts.forEach(a => {
            if (!a.signature) return;
            if (getSignatureKey(a.signature) !== key) return;
            total++;
            if (a.isCorrect) correct++;
        });
        const correctRate = total > 0 ? Math.round((correct / total) * 100) : 0;
        return { population: total, correctRate };
    }, [q?.signature, earTraining.persisted.attempts]);
    const isFeedback = earTraining.phase === 'feedback';
    const isReview = earTraining.mode === 'review';
    const needsRhythm = !!(
        q?.signature?.melody?.rhythm?.length
        || q?.signature?.duoMelody?.upperRhythm?.length
        || q?.signature?.duoMelody?.lowerRhythm?.length
        || (q?.signature?.duoMelody as any)?.rhythm?.length
        || q?.signature?.progression?.rhythm?.length
    );
    const chordIsRatio = q?.type === 'chord' && q?.signature?.chord?.answerFormat === 'ratios';
    const chordIsText = q?.type === 'chord' && q?.answerMode === 'text';
    const textPlaceholder = chordIsRatio
        ? '1/1 5/4 3/2'
        : chordIsText
            ? 'Type the chord name (e.g. Major)'
            : q?.type === 'progression'
                ? (needsRhythm ? '1/1,5/4,3/2@2 ; 1/1,6/5,3/2@1 ...' : '1/1,5/4,3/2 ; 1/1,6/5,3/2 ...')
                : (q?.type === 'duo_melody'
                    ? (needsRhythm ? '1/1@1 5/4@0.5 3/2@1.5 | 1/1@0.5 4/3@1 3/2@1' : '1/1 5/4 3/2 | 1/1 4/3 3/2')
                    : (needsRhythm ? '1/1@1 9/8@0.5 5/4@1 ...' : 'Type the ratio sequence (e.g. 1/1 9/8 5/4)...'));

    return (
        <div className="absolute inset-0 bg-[#050505] flex flex-col z-[100] pointer-events-auto overflow-hidden">
            {earTraining.phase === 'idle' && (
                <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto custom-scrollbar">
                    <div
                        ref={containerRef}
                        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl shadow-2xl flex gap-0 p-6 relative"
                        style={{ display: 'flex' }}
                    >
                        <div
                            className="flex flex-col min-h-[520px] text-center space-y-4 pr-4"
                            style={{ width: `${leftPanelWidth}%`, flexShrink: 0 }}
                        >
                            <div className="flex justify-between items-center pb-4 border-b border-gray-800 shrink-0">
                                <div className="text-left">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-widest">Ear Training</h2>
                                    <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wide">MVI-3 Memory System</p>
                                </div>
                                <div className="flex gap-2">
                                    {['train', 'mistakes', 'stats', 'part2'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setEarPanel(p as any)}
                                            className={`text-[9px] px-3 py-1.5 rounded uppercase font-bold transition-all ${earTraining.ui.panel === p ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden relative min-h-0">
                                {earTraining.ui.panel === 'train' && (
                                    <div className="h-full overflow-y-auto custom-scrollbar space-y-4 pt-2">
                                        <div className="bg-black/40 p-4 rounded-xl text-left space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Difficulty</label>
                                                    <select
                                                        value={earTraining.settings.difficulty}
                                                        onChange={(e) => updateEarSettings({ difficulty: e.target.value as any })}
                                                        className="w-full bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1.5 outline-none"
                                                    >
                                                        <option value="easy">Easy</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="hard">Hard</option>
                                                        <option value="auto">Auto</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Questions</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={50}
                                                            step={1}
                                                            value={earTraining.settings.sessionLength}
                                                            onChange={(e) => {
                                                                const raw = parseInt(e.target.value || '0', 10);
                                                                const v = Math.max(0, Math.min(50, Number.isFinite(raw) ? raw : 0));
                                                                updateEarSettings({ sessionLength: v });
                                                            }}
                                                            className="w-full bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1.5 outline-none"
                                                        />
                                                        <span className="text-[9px] text-gray-500 font-mono">0=∞</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Tasks</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(['interval', 'compare', 'chord', 'drift', 'melody', 'duo_melody', 'progression'] as EarTaskType[]).map(t => (
                                                        <label key={t} className="flex items-center gap-2 cursor-pointer bg-gray-800/50 p-2 rounded hover:bg-gray-800">
                                                            <input
                                                                type="checkbox"
                                                                checked={earTraining.settings.tasks.includes(t as any)}
                                                                onChange={() => toggleTask(t as any)}
                                                                className="accent-blue-500"
                                                            />
                                                            <span className="text-xs text-gray-300 font-bold">{TASK_LABELS[t]}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <button onClick={() => setShowAdvanced(v => !v)} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-2 rounded-xl">
                                                {showAdvanced ? 'Hide Pro Settings' : 'Show Pro Settings'}
                                            </button>
                                            {showAdvanced && (
                                                <div className="bg-black/40 p-4 rounded-xl">
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Pro Settings</span>
                                                        <button
                                                            onClick={() => setShowAdvanced(false)}
                                                            className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-300 hover:text-white"
                                                        >
                                                            Collapse
                                                        </button>
                                                    </div>
                                                    <EarTrainingProSettingsPanel settings={earTraining.settings} onChange={updateEarSettings} />
                                                    <div className="pt-3">
                                                        <button
                                                            onClick={() => setShowAdvanced(false)}
                                                            className="w-full text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-300 hover:text-white"
                                                        >
                                                            Collapse Pro Settings
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2 pt-2">
                                            <button onClick={startEarSession} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95">START SESSION</button>
                                            <button onClick={() => startReviewSession('due')} className="w-full bg-indigo-900 hover:bg-indigo-800 text-indigo-100 font-bold py-3 rounded-xl border border-indigo-700 shadow-lg">REVIEW DUE ITEMS ({earTraining.persisted.reviewItems.filter((i: any) => i.dueAt <= Date.now()).length})</button>
                                        </div>
                                    </div>
                                )}
                                {earTraining.ui.panel === 'mistakes' && <MistakesPanel earTraining={earTraining} startReviewSession={startReviewSession} startPracticeSignature={startPracticeSignature} deleteReviewItem={deleteReviewItem} />}
                                {earTraining.ui.panel === 'stats' && <StatsPanel earTraining={earTraining} />}
                                {earTraining.ui.panel === 'part2' && (
                                    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar">
                                        <EarTrainingPart2Panel
                                            part2={earTraining.persisted.part2 ?? {
                                                v: 1,
                                                settings: {
                                                    enabled: false,
                                                    jnd: {
                                                        baseHz: 440,
                                                        mode: 'interval',
                                                        startGapCents: 100,
                                                        minGapCents: 0.1,
                                                        maxGapCents: 300,
                                                        stepDown: 0.85,
                                                        stepUp: 1.15,
                                                        confirmRepeats: 2,
                                                        optionsCount: 3,
                                                        waveform: 'sine'
                                                    },
                                                    intervalZone: { baseHz: 440, intervalCents: 700, rangeCents: 50, waveform: 'sine' },
                                                    continuousPitch: { targetHz: 440, centsRange: 100 }
                                                },
                                                jndSamples: [],
                                                intervalZoneSamples: [],
                                                continuousPitchSamples: [],
                                                evaluation: []
                                            }}
                                            onUpdate={setEarTrainingPersistedPart2 || (() => { })}
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="pt-4 border-t border-gray-800 shrink-0">
                                <button onClick={stopEarSession} className="text-xs text-gray-500 hover:text-white">
                                    {fromAdvanced ? "Return to Advanced" : "Exit Mode"}
                                </button>
                            </div>
                        </div>
                        <div
                            className="w-2 cursor-col-resize bg-gray-800 hover:bg-blue-600 transition-colors rounded-full mx-1 hidden lg:flex items-center justify-center group"
                            onMouseDown={handleResizeStart}
                            title="Drag to resize"
                        >
                            <div className="w-0.5 h-12 bg-gray-600 group-hover:bg-blue-300 rounded-full"></div>
                        </div>
                        <div className="min-h-[520px] flex flex-col" style={{ flex: 1 }}>
                            <EarTrainingDataPanel className="mt-0 h-full" />
                        </div>
                    </div>
                </div>
            )}

            {earTraining.phase === 'summary' && (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl max-w-md w-full shadow-2xl text-center space-y-6">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-4">Session Complete</h2>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-800 p-3 rounded-lg">
                                <div className="text-2xl font-black text-blue-400">
                                    {earTraining.sessionStats.totalQuestions > 0 ? Math.round((earTraining.sessionStats.correctCount / earTraining.sessionStats.totalQuestions) * 100) : 0}%
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Accuracy</div>
                            </div>
                            <div className="bg-gray-800 p-3 rounded-lg">
                                <div className="text-2xl font-black text-green-400">{earTraining.sessionStats.correctCount}/{earTraining.sessionStats.totalQuestions}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Score</div>
                            </div>
                            <div className="bg-gray-800 p-3 rounded-lg">
                                <div className="text-2xl font-black text-yellow-400">{earTraining.sessionStats.bestStreak}</div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Best Streak</div>
                            </div>
                        </div>
                        <button
                            onClick={startEarSession}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95 mb-2"
                        >
                            NEW SESSION
                        </button>
                        <button
                            onClick={() => startReviewSession('mistakes')}
                            className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-200 font-bold py-3 rounded-xl mb-2"
                        >
                            REVIEW MISTAKES
                        </button>
                        <button onClick={stopEarSession} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl">
                            {fromAdvanced ? "Return to Advanced" : "Main Menu"}
                        </button>
                    </div>
                    <EarTrainingDataPanel />
                </div>
            )}

            {earTraining.phase !== 'idle' && earTraining.phase !== 'summary' && q && (
                <div className="flex-1 flex flex-col">
                    <div className="p-4 flex justify-between items-center border-b border-gray-800 bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            {fromAdvanced && (
                                <button
                                    onClick={() => {
                                        stopAllAudio();
                                        backToEarSettings();
                                    }}
                                    className="text-xs font-bold text-yellow-300 hover:text-white bg-yellow-900/20 border border-yellow-700 px-3 py-1.5 rounded-full"
                                >
                                    ← Back
                                </button>
                            )}
                            {isReview && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded uppercase font-bold">Review Mode</span>}
                            <span className="text-xs font-bold bg-blue-900/50 text-blue-200 px-2 py-1 rounded">Q{earTraining.sessionStats.totalQuestions + 1}</span>
                            <span className="text-[10px] text-gray-500">Replays: {earTraining.currentReplays}</span>
                        </div>
                        <button
                            onClick={() => {
                                stopAllAudio();
                                backToEarSettings();
                            }}
                            className="text-gray-500 hover:text-white text-xl font-bold"
                        >
                            ✕
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
                        <div className="text-center space-y-4">
                            <h3 className="text-xl text-gray-300 font-medium">{q.promptText}</h3>
                            <button
                                onClick={handlePlayPrompt}
                                className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)] flex items-center justify-center text-4xl hover:scale-105 active:scale-95 transition-all text-white relative group"
                            >
                                ▶
                                {(q.type === 'melody' || q.type === 'duo_melody') && (earTraining.settings.pro?.sequence?.metronomeEnabled ?? true) && (
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 font-mono whitespace-nowrap opacity-60 group-hover:opacity-100 transition-opacity">
                                        4/4 - 1 Bar Count-in
                                    </div>
                                )}
                            </button>
                            {(q.type === 'drift' || q.type === 'compare') && (
                                <div className="flex gap-4 justify-center">
                                    <button onClick={handlePlayA} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-full text-xs font-bold">Hear A</button>
                                    <button onClick={handlePlayB} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-full text-xs font-bold">Hear B</button>
                                </div>
                            )}
                            {(q.type === 'melody' || q.type === 'duo_melody') && (
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={playRoot}
                                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border border-gray-700"
                                        title="Play Fundamental Note (1/1)"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Hear Root (1/1)
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="h-16 flex flex-col items-center justify-center">
                            {isFeedback ? (
                                <>
                                    <div className={`text-3xl font-black uppercase tracking-widest animate-in zoom-in duration-200 ${feedbackTxt === 'CORRECT!' ? 'text-green-500' : 'text-red-500'}`}>{feedbackTxt}</div>
                                    <p className="text-xs text-gray-400 mt-2 max-w-xs text-center">{q.explanation}</p>
                                </>
                            ) : (
                                <div className="text-sm text-gray-600 animate-pulse">Waiting for answer...</div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                            {showOptions ? (
                                q.answerMode === 'text' ? (
                                    q.type === 'duo_melody' ? (
                                        <div className="col-span-2 space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Upper Melody</label>
                                                    <textarea
                                                        value={duoTextAnswers[0]}
                                                        onChange={(e) => {
                                                            const newAns = [...duoTextAnswers];
                                                            newAns[0] = e.target.value;
                                                            setDuoTextAnswers(newAns);
                                                        }}
                                                        placeholder={needsRhythm ? '1/1@1 5/4@0.5 3/2@1.5...' : '1/1 5/4 3/2...'}
                                                        className="w-full min-h-[120px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Lower Melody</label>
                                                    <textarea
                                                        value={duoTextAnswers[1]}
                                                        onChange={(e) => {
                                                            const newAns = [...duoTextAnswers];
                                                            newAns[1] = e.target.value;
                                                            setDuoTextAnswers(newAns);
                                                        }}
                                                        placeholder={needsRhythm ? '1/1@0.5 4/3@1 3/2@1...' : '1/1 4/3 3/2...'}
                                                        className="w-full min-h-[120px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-blue-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                            {textAnswerStats && (
                                                <div className="text-[10px] text-gray-500 text-center">
                                                    Population: {textAnswerStats.population} | Correct Rate: {textAnswerStats.correctRate}%
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (!isFeedback) handleAnswer(duoTextAnswers.join(' | '));
                                                }}
                                                disabled={!duoTextAnswers[0].trim() || !duoTextAnswers[1].trim() || isFeedback}
                                                className="w-full bg-gray-800 border border-gray-700 text-gray-200 py-2 rounded-lg font-bold uppercase text-xs hover:bg-gray-700 disabled:opacity-40"
                                            >
                                                Submit Dual Melody
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="col-span-2 space-y-3">
                                            <textarea
                                                value={textAnswer}
                                                onChange={(e) => setTextAnswer(e.target.value)}
                                                placeholder={textPlaceholder}
                                                className="w-full min-h-[90px] bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-blue-500 outline-none"
                                            />
                                            {textAnswerStats && (
                                                <div className="text-[10px] text-gray-500 text-center">
                                                    Population: {textAnswerStats.population} | Correct Rate: {textAnswerStats.correctRate}%
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (!isFeedback) handleAnswer(textAnswer);
                                                }}
                                                disabled={!textAnswer.trim() || isFeedback}
                                                className="w-full bg-gray-800 border border-gray-700 text-gray-200 py-2 rounded-lg font-bold uppercase text-xs hover:bg-gray-700 disabled:opacity-40"
                                            >
                                                Submit Answer
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    q.options.map((opt) => {
                                        let btnClass = "bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200";
                                        if (isFeedback) {
                                            if (opt.isCorrect) btnClass = "bg-green-900/50 border-green-500 text-white";
                                            else if (earTraining.selectedAnswerId === opt.id)
                                                btnClass = "bg-red-900/50 border-red-500 text-red-200 opacity-50";
                                            else btnClass = "bg-gray-900 border-gray-800 text-gray-600 opacity-30";
                                        }
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (!isFeedback) handleAnswer(opt.id);
                                                }}
                                                className={`px-4 py-3 rounded-xl transition-all duration-150 font-semibold text-sm md:text-base w-full whitespace-pre-wrap ${btnClass} shadow-lg active:scale-95`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })
                                )
                            ) : (
                                <div className="col-span-2 text-xs text-gray-400 text-center">
                                    Memory phase… options will appear after your configured delay.
                                </div>
                            )}
                        </div>
                        {isFeedback && (
                            <button onClick={nextEarQuestion} className="bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-wider hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)] animate-in fade-in slide-in-from-bottom-4">Next Question →</button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
