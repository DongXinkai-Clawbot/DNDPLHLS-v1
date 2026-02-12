import type { EarQuestion, EarDifficulty, EarTrainingSettings, EarQuestionSignature } from '../../../../types';
import { calculateCents, parseGeneralRatio } from '../../../../musicLogic';
import { createLogger } from '../../../../utils/logger';
import {
    EASY_INTERVAL_SET,
    applyPoolLimit,
    buildChordOctaveShifts,
    buildReferenceTone,
    buildReferenceToneSignature,
    buildRhythmPattern,
    createNode,
    createNodeFromRatioString,
    ensureDifferentRhythms,
    formatChordAnswer,
    formatChordOptionLabel,
    formatDuoAnswer,
    formatProgressionAnswer,
    formatSequenceAnswer,
    getAnswerMode,
    getBaseFrequency,
    getChordSettings,
    getRng,
    getSequenceSettings,
    normalizeChordOctaveShifts,
    selectTaskType,
    shuffle
} from './helpers';
import {
    buildChordPool,
    buildComparePool,
    buildDuoMelodyPool,
    buildDriftPool,
    buildIntervalPool,
    buildMelodyPool,
    buildProgressionPool
} from './pools';

const log = createLogger('ear/questions');

export const getSignatureKey = (sig: EarQuestionSignature): string => {
    if (sig.interval) return `v1|int|${sig.interval.poolId}|${sig.interval.direction}`;
    if (sig.chord) return `v1|chd|${sig.chord.qualityId}|${sig.chord.inversion}`;
    if (sig.drift) return `v1|drf|${sig.drift.targetRatio}|${sig.drift.variant}`;
    if (sig.compare) return `v1|cmp|${sig.compare.aRatio}|${sig.compare.bRatio}`;
    if (sig.melody) return `v1|mel|${sig.melody.poolId}|${sig.melody.sequence.join('.')}|r:${(sig.melody.rhythm ?? []).join('.')}`;
    if (sig.duoMelody) {
        const legacyRhythm = (sig.duoMelody as any).rhythm as number[] | undefined;
        const upperKey = sig.duoMelody.upperRhythm ? `|ru:${sig.duoMelody.upperRhythm.join('.')}` : '';
        const lowerKey = sig.duoMelody.lowerRhythm ? `|rl:${sig.duoMelody.lowerRhythm.join('.')}` : '';
        const legacyKey = (!sig.duoMelody.upperRhythm && !sig.duoMelody.lowerRhythm && legacyRhythm)
            ? `|r:${legacyRhythm.join('.')}`
            : '';
        return `v1|duo|${sig.duoMelody.poolId}|${sig.duoMelody.upper.join('.')}|${sig.duoMelody.lower.join('.')}${upperKey}${lowerKey}${legacyKey}`;
    }
    if (sig.progression) return `v1|prog|${sig.progression.poolId}|${sig.progression.chords.map(c => c.join('.')).join('~')}|r:${(sig.progression.rhythm ?? []).join('.')}`;
    return `v1|unk|${sig.taskType}`;
};

export const buildQuestionFromSignature = (sig: EarQuestionSignature, settings: EarTrainingSettings): EarQuestion => {
    const baseFreq = sig.baseFreq;
    const qBase: Partial<EarQuestion> = {
        id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: sig.taskType,
        signature: sig,
        difficulty: settings.difficulty, 
    };
    const referenceTone = buildReferenceTone(sig.referenceTone);
    const referencePayload = referenceTone ? { referenceTone } : {};

    try {
        if (sig.taskType === 'interval' && sig.interval) {
            const { poolId, direction, mode, optionsOrder } = sig.interval;
            const intervalPool = buildIntervalPool(settings);
            const fallback = intervalPool[0];
            const target = intervalPool.find(i => i.id === poolId) || fallback;
            const ratioStr = sig.interval.ratioStr || target?.ratioStr || '1/1';
            const label = sig.interval.label || target?.name || ratioStr;
            const root = createNode(1, 1, "Root");
            const interval = createNodeFromRatioString(ratioStr, label);

            const options = optionsOrder.map(optId => {
                
                if (optId === poolId) return { id: poolId, label, isCorrect: true };
                
                const dist = intervalPool.find(d => d.id === optId);
                return { id: optId, label: dist ? dist.name : "Unknown", isCorrect: false };
            });

            return {
                ...qBase,
                promptText: "Identify the interval played.",
                options,
                answerMode: sig.answerMode ?? getAnswerMode(settings, 'interval'),
                expectedAnswer: label,
                ...referencePayload,
                soundData: {
                    nodes: [root, interval],
                    mode: mode,
                    baseFreq: baseFreq
                },
                explanation: `${label} corresponds to the ratio ${ratioStr}. It is ${calculateCents(interval.ratio).toFixed(0)} cents.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'chord' && sig.chord) {
            const { qualityId, optionsOrder } = sig.chord;
            const chordPool = buildChordPool(settings);
            const fallback = chordPool[0];
            const target = chordPool.find(c => c.id === qualityId) || fallback;
            const ratios = sig.chord.ratios || target?.ratios || [];
            const label = sig.chord.label || target?.name || ratios.join(',');
            const answerFormat = sig.chord.answerFormat ?? getChordSettings(settings).answerFormat;
            const octaveShifts = normalizeChordOctaveShifts(ratios, sig.chord.octaveShifts);
            const root = createNode(1, 1, "Root");
            root.octave += octaveShifts[0] ?? 0;
            const nodes = [root, ...ratios.map((r, idx) => {
                const node = createNodeFromRatioString(r);
                node.octave += octaveShifts[idx + 1] ?? 0;
                return node;
            })];

            const options = optionsOrder.map(optId => {
                if (optId === qualityId) {
                    const formattedLabel = formatChordOptionLabel(label, ratios);
                    return { id: qualityId, label: formattedLabel, isCorrect: true };
                }
                const dist = chordPool.find(d => d.id === optId);
                const distLabel = dist ? formatChordOptionLabel(dist.name, dist.ratios) : "Unknown";
                return { id: optId, label: distLabel, isCorrect: false };
            });

            return {
                ...qBase,
                promptText: answerFormat === 'ratios'
                    ? "Transcribe the chord ratios (separate ratios)."
                    : "Identify the chord quality.",
                options,
                answerMode: answerFormat === 'ratios' ? 'text' : (sig.answerMode ?? getAnswerMode(settings, 'chord')),
                expectedAnswer: answerFormat === 'ratios' ? formatChordAnswer(ratios) : label,
                ...referencePayload,
                soundData: { nodes, mode: 'chord', baseFreq },
                explanation: answerFormat === 'ratios'
                    ? `Target ratios: ${formatChordAnswer(ratios)}.`
                    : `${label} is built from ratios like ${ratios[0] || '1/1'}.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'drift' && sig.drift) {
            const { targetRatio, correctAnswer, morphA, morphB } = sig.drift;
            const root = createNode(1, 1, "Root");
            
            const interval = createNodeFromRatioString(targetRatio, "Target");

            return {
                ...qBase,
                promptText: "Which version is PURE (Just Intonation)?",
                options: [
                    { id: 'A', label: "Version A", isCorrect: correctAnswer === 'A' },
                    { id: 'B', label: "Version B", isCorrect: correctAnswer === 'B' }
                ],
                answerMode: 'choice',
                ...referencePayload,
                soundData: {
                    nodes: [root, interval],
                    mode: 'ab_test',
                    morphA, morphB, baseFreq
                },
                explanation: `The pure ${targetRatio} interval has no beating. Equal Temperament introduces beating.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'compare' && sig.compare) {
            const { aRatio, bRatio, correctAnswer } = sig.compare;
            const nodeA = createNodeFromRatioString(aRatio, "A");
            const nodeB = createNodeFromRatioString(bRatio, "B");

            const centA = calculateCents(nodeA.ratio);
            const centB = calculateCents(nodeB.ratio);

            return {
                ...qBase,
                promptText: "Which note is HIGHER in pitch?",
                options: [
                    { id: 'A', label: "Sound A", isCorrect: correctAnswer === 'A' },
                    { id: 'B', label: "Sound B", isCorrect: correctAnswer === 'B' }
                ],
                answerMode: 'choice',
                ...referencePayload,
                soundData: {
                    nodes: [nodeA, nodeB],
                    mode: 'sequence',
                    baseFreq
                },
                explanation: `Sound A: ${centA.toFixed(1)}¢, Sound B: ${centB.toFixed(1)}¢.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'melody' && sig.melody) {
            const sequence = sig.melody.sequence;
            const rhythm = sig.melody.rhythm;
            const nodes = sequence.map(r => createNodeFromRatioString(r));
            const answerMode = sig.answerMode ?? getAnswerMode(settings, 'melody');
            const expected = formatSequenceAnswer(sequence, rhythm, true);
            const melodyPool = buildMelodyPool(settings);
            const options = sig.melody.optionsOrder.map(optId => {
                if (optId === sig.melody?.poolId) return { id: optId, label: expected, isCorrect: true };
                const dist = melodyPool.find(m => m.id === optId);
                const label = dist ? formatSequenceAnswer(dist.sequence, dist.rhythm ?? rhythm, true) : "Unknown";
                return { id: optId, label, isCorrect: false };
            });

            return {
                ...qBase,
                promptText: "Transcribe the melody (ratios/cents; include rhythm if present).",
                options,
                answerMode,
                expectedAnswer: expected,
                ...referencePayload,
                soundData: { nodes, mode: 'sequence', baseFreq, durations: rhythm },
                explanation: `Target: ${expected}.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'duo_melody' && sig.duoMelody) {
            const upper = sig.duoMelody.upper;
            const lower = sig.duoMelody.lower;
            const upperNodes = upper.map(r => createNodeFromRatioString(r));
            const lowerNodes = lower.map(r => createNodeFromRatioString(r));
            const answerMode = sig.answerMode ?? getAnswerMode(settings, 'duo_melody');
            const legacyRhythm = (sig.duoMelody as any).rhythm as number[] | undefined;
            const upperRhythm = sig.duoMelody.upperRhythm ?? legacyRhythm;
            const lowerRhythm = sig.duoMelody.lowerRhythm ?? legacyRhythm;
            const expected = formatDuoAnswer(upper, lower, upperRhythm, lowerRhythm, true);
            const upperDurations = upperRhythm;
            const lowerDurations = lowerRhythm;
            const layerDurations = (upperDurations || lowerDurations)
                ? [
                    upperDurations ?? new Array(upper.length).fill(1),
                    lowerDurations ?? new Array(lower.length).fill(1)
                ]
                : undefined;
            const duoPool = buildDuoMelodyPool(settings);
            const options = sig.duoMelody.optionsOrder.map(optId => {
                if (optId === sig.duoMelody?.poolId) return { id: optId, label: expected, isCorrect: true };
                const dist = duoPool.find(m => m.id === optId);
                const label = dist
                    ? formatDuoAnswer(
                        dist.upper,
                        dist.lower,
                        dist.upperRhythm ?? upperRhythm,
                        dist.lowerRhythm ?? lowerRhythm,
                        true
                    )
                    : "Unknown";
                return { id: optId, label, isCorrect: false };
            });

            return {
                ...qBase,
                promptText: "Transcribe both melodies (upper | lower, ratios/cents; include rhythm if present).",
                options,
                answerMode,
                expectedAnswer: expected,
                ...referencePayload,
                soundData: {
                    nodes: upperNodes,
                    mode: 'duo',
                    layers: [upperNodes, lowerNodes],
                    layerDurations,
                    baseFreq
                },
                explanation: `Target: ${expected}.`
            } as EarQuestion;
        }
        else if (sig.taskType === 'progression' && sig.progression) {
            const chords = sig.progression.chords;
            const rhythm = sig.progression.rhythm;
            const chordNodes = chords.map(chord => {
                const root = createNode(1, 1, "Root");
                return [root, ...chord.map(r => createNodeFromRatioString(r))];
            });
            const answerMode = sig.answerMode ?? getAnswerMode(settings, 'progression');
            const expected = formatProgressionAnswer(chords, rhythm);
            const progPool = buildProgressionPool(settings);
            const options = sig.progression.optionsOrder.map(optId => {
                if (optId === sig.progression?.poolId) return { id: optId, label: expected, isCorrect: true };
                const dist = progPool.find(p => p.id === optId);
                const label = dist ? formatProgressionAnswer(dist.chords, dist.rhythm) : "Unknown";
                return { id: optId, label, isCorrect: false };
            });

            return {
                ...qBase,
                promptText: "Transcribe the chord progression.",
                options,
                answerMode,
                expectedAnswer: expected,
                ...referencePayload,
                soundData: { nodes: chordNodes[0] || [], mode: 'progression', chords: chordNodes, baseFreq, chordDurations: rhythm },
                explanation: `Target: ${expected}.`
            } as EarQuestion;
        }
    } catch (e) {
        log.warn('Failed to reconstruct question from signature', { sig, error: e });
        
        const fallbackId = `error-${Date.now()}`;
        return {
            id: fallbackId,
            type: 'interval',
            promptText: "Error loading question. Please try again.",
            options: [],
            answerMode: 'choice',
            expectedAnswer: 'Error',
            signature: sig,
            soundData: { nodes: [], mode: 'sequence', baseFreq: 440 },
            explanation: "An error occurred while generating this question."
        } as EarQuestion;
    }

    return generateQuestion(settings.difficulty, settings);
};

export const generateQuestion = (
    difficulty: EarDifficulty,
    earSettings: EarTrainingSettings,
    context: { questionIndex?: number; recentKeys?: string[] } = {}
): EarQuestion => {
    const questionIndex = context.questionIndex ?? 0;
    const rng = getRng(earSettings, questionIndex);
    const selectionMode = earSettings.pro?.selectionMode ?? 'random';
    const poolLimit = earSettings.pro?.poolLimit ?? 0;
    const shuffleOptions = earSettings.pro?.shuffleOptions ?? true;
    const avoidRepeatCount = earSettings.pro?.avoidRepeatCount ?? 0;
    const recentKeys = context.recentKeys ?? [];
    const recentSet = new Set(recentKeys.slice(-avoidRepeatCount));

    const type = selectTaskType(earSettings, rng);
    const baseFreq = getBaseFrequency(earSettings, rng);

    const rawOptionCount = earSettings?.pro?.optionCount;
    const totalOptions = Math.max(2, typeof rawOptionCount === 'number' ? rawOptionCount : 4);
    const numDistractors = totalOptions - 1;
    const answerMode = getAnswerMode(earSettings, type);
    const sequenceSettings = getSequenceSettings(earSettings);
    const referenceTone = buildReferenceToneSignature(earSettings, rng);

    const pickNonRepeating = (builder: () => EarQuestion): EarQuestion => {
        const maxTries = 6;
        for (let i = 0; i < maxTries; i++) {
            const q = builder();
            if (!recentSet.has(getSignatureKey(q.signature))) return q;
        }
        return builder();
    };

    if (type === 'interval') {
        return pickNonRepeating(() => {
            let pool = buildIntervalPool(earSettings);
            if (difficulty === 'easy') {
                pool = pool.filter(i => EASY_INTERVAL_SET.has(i.ratioStr));
            } else if (difficulty === 'medium') {
                pool = pool.filter(i => {
                    const cents = calculateCents(parseGeneralRatio(i.ratioStr));
                    return cents >= 100 && cents <= 1000;
                });
            }
            pool = applyPoolLimit(pool, poolLimit, rng, selectionMode);
            if (pool.length < totalOptions) pool = buildIntervalPool(earSettings);

            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const distractors = shuffle(pool.filter(p => p.id !== target.id), rng).slice(0, numDistractors);
            const optionsList = answerMode === 'choice'
                ? (shuffleOptions ? shuffle([target, ...distractors], rng) : [target, ...distractors])
                : [target];
            let mode: 'sequence' | 'chord' = 'sequence';
            if (earSettings.playback.intervalMode === 'chord') mode = 'chord';
            else if (earSettings.playback.intervalMode === 'mixed') mode = rng() > 0.5 ? 'sequence' : 'chord';

            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'interval',
                baseFreq,
                answerMode,
                referenceTone: referenceTone ?? undefined,
                interval: {
                    poolId: target.id,
                    ratioStr: target.ratioStr,
                    label: target.name,
                    direction: 'up',
                    mode: mode,
                    compoundOctaves: 0,
                    distractorPoolIds: distractors.map(d => d.id),
                    optionsOrder: optionsList.map(o => o.id)
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    if (type === 'chord') {
        return pickNonRepeating(() => {
            let pool = buildChordPool(earSettings);
            pool = applyPoolLimit(pool, poolLimit, rng, selectionMode);
            if (pool.length < totalOptions) pool = buildChordPool(earSettings);

            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const candidates = pool.filter(p => p.id !== target.id);
            const distractors = shuffle(candidates, rng).slice(0, numDistractors);
            const chordSettings = getChordSettings(earSettings);
            const chordAnswerMode = chordSettings.answerFormat === 'ratios' ? 'text' : getAnswerMode(earSettings, 'chord');
            const optionsList = chordAnswerMode === 'choice'
                ? (shuffleOptions ? shuffle([target, ...distractors], rng) : [target, ...distractors])
                : [target];
            const { shifts, inversion } = buildChordOctaveShifts(target.ratios, chordSettings.inversionMode, rng);

            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'chord',
                baseFreq,
                answerMode: chordAnswerMode,
                referenceTone: referenceTone ?? undefined,
                chord: {
                    qualityId: target.id,
                    ratios: target.ratios,
                    label: target.name,
                    inversion,
                    voicing: 'close',
                    octaveShifts: shifts,
                    optionsOrder: optionsList.map(o => o.id),
                    answerFormat: chordSettings.answerFormat
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    if (type === 'melody') {
        return pickNonRepeating(() => {
            let pool = buildMelodyPool(earSettings, rng);
            pool = applyPoolLimit(pool, poolLimit, rng, selectionMode);
            if (pool.length < totalOptions) pool = buildMelodyPool(earSettings, rng);

            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const distractors = shuffle(pool.filter(p => p.id !== target.id), rng).slice(0, numDistractors);
            const optionsList = answerMode === 'choice'
                ? (shuffleOptions ? shuffle([target, ...distractors], rng) : [target, ...distractors])
                : [target];

            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'melody',
                baseFreq,
                answerMode,
                referenceTone: referenceTone ?? undefined,
                melody: {
                    poolId: target.id,
                    sequence: target.sequence,
                    rhythm: target.rhythm ?? buildRhythmPattern(target.sequence.length, sequenceSettings.rhythmMode, sequenceSettings.rhythmValues, rng),
                    optionsOrder: optionsList.map(o => o.id)
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    if (type === 'duo_melody') {
        return pickNonRepeating(() => {
            let pool = buildDuoMelodyPool(earSettings, rng);
            pool = applyPoolLimit(pool, poolLimit, rng, selectionMode);
            if (pool.length < totalOptions) pool = buildDuoMelodyPool(earSettings, rng);

            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const distractors = shuffle(pool.filter(p => p.id !== target.id), rng).slice(0, numDistractors);
            const optionsList = answerMode === 'choice'
                ? (shuffleOptions ? shuffle([target, ...distractors], rng) : [target, ...distractors])
                : [target];

            const upperRhythm = target.upperRhythm ?? buildRhythmPattern(target.upper.length, sequenceSettings.rhythmMode, sequenceSettings.rhythmValues, rng);
            const lowerRhythm = target.lowerRhythm ?? buildRhythmPattern(target.lower.length, sequenceSettings.rhythmMode, sequenceSettings.rhythmValues, rng);
            const adjustedRhythms = ensureDifferentRhythms(upperRhythm, lowerRhythm, sequenceSettings.rhythmValues, rng);

            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'duo_melody',
                baseFreq,
                answerMode,
                referenceTone: referenceTone ?? undefined,
                duoMelody: {
                    poolId: target.id,
                    upper: target.upper,
                    lower: target.lower,
                    upperRhythm: adjustedRhythms.upperRhythm,
                    lowerRhythm: adjustedRhythms.lowerRhythm,
                    optionsOrder: optionsList.map(o => o.id)
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    if (type === 'progression') {
        return pickNonRepeating(() => {
            let pool = buildProgressionPool(earSettings);
            pool = applyPoolLimit(pool, poolLimit, rng, selectionMode);
            if (pool.length < totalOptions) pool = buildProgressionPool(earSettings);

            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const distractors = shuffle(pool.filter(p => p.id !== target.id), rng).slice(0, numDistractors);
            const optionsList = answerMode === 'choice'
                ? (shuffleOptions ? shuffle([target, ...distractors], rng) : [target, ...distractors])
                : [target];

            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'progression',
                baseFreq,
                answerMode,
                referenceTone: referenceTone ?? undefined,
                progression: {
                    poolId: target.id,
                    chords: target.chords,
                    rhythm: target.rhythm ?? buildRhythmPattern(target.chords.length, sequenceSettings.rhythmMode, sequenceSettings.rhythmValues, rng),
                    optionsOrder: optionsList.map(o => o.id)
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    if (type === 'drift') {
        return pickNonRepeating(() => {
            const pool = applyPoolLimit(buildDriftPool(earSettings), poolLimit, rng, selectionMode);
            const target = selectionMode === 'cycle'
                ? pool[questionIndex % pool.length]
                : pool[Math.floor(rng() * pool.length)];
            const isAPure = rng() > 0.5;
            const signature: EarQuestionSignature = {
                v: 1,
                taskType: 'drift',
                baseFreq,
                answerMode: 'choice',
                referenceTone: referenceTone ?? undefined,
                drift: {
                    targetRatio: target.ratio,
                    severity: 'medium',
                    variant: 'purity',
                    morphA: isAPure ? 0 : 1,
                    morphB: isAPure ? 1 : 0,
                    correctAnswer: isAPure ? 'A' : 'B'
                }
            };
            return buildQuestionFromSignature(signature, earSettings);
        });
    }

    return pickNonRepeating(() => {
        const pool = applyPoolLimit(buildComparePool(earSettings), poolLimit, rng, selectionMode);
        const target = selectionMode === 'cycle'
            ? pool[questionIndex % pool.length]
            : pool[Math.floor(rng() * pool.length)];
        const isAHigher = rng() > 0.5;
        const a = isAHigher ? target.a : target.b;
        const b = isAHigher ? target.b : target.a;

        const signature: EarQuestionSignature = {
            v: 1,
            taskType: 'compare',
            baseFreq,
            answerMode: 'choice',
            referenceTone: referenceTone ?? undefined,
            compare: {
                aRatio: a,
                bRatio: b,
                correctAnswer: isAHigher ? 'A' : 'B'
            }
        };
        return buildQuestionFromSignature(signature, earSettings);
    });
};
