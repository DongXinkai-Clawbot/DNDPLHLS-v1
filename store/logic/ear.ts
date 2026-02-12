
import type { AppState, EarAttemptRecord, EarReviewItem, EarSessionSummary, EarQuestion, EarTrainingPart2PersistedV1, EarTaskType } from '../../types';
import { generateQuestion, buildQuestionFromSignature, getSignatureKey } from '../../components/overlays/ear/EarLogic';
import { calculateCents, normalizeOctave, parseGeneralRatio } from '../../musicLogic';
import { saveEarData } from './persistence';
import { DEFAULT_PERSISTED_EAR } from './constants';

const splitRatioTokens = (value: string) => value
    .split(/[\s,;|]+/)
    .map(t => t.trim())
    .filter(Boolean);

const parseChordRatioTokens = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2 && parts.every(p => /^-?\d+(\.\d+)?$/.test(p))) {
            const base = parseFloat(parts[0]);
            if (Number.isFinite(base) && base !== 0) {
                return parts.slice(1).map(p => `${p}/${base}`);
            }
        }
    }
    return splitRatioTokens(trimmed);
};

const normalizeChordRatioText = (value: string) => {
    const tokens = parseChordRatioTokens(value);
    const entries: { ratio: string; cents: number }[] = [];
    tokens.forEach(token => {
        const frac = parseGeneralRatio(token);
        if (frac.n <= 0n || frac.d <= 0n) return;
        const norm = normalizeOctave(frac);
        const ratioStr = `${norm.ratio.n}/${norm.ratio.d}`;
        if (ratioStr === '1/1') return;
        entries.push({ ratio: ratioStr, cents: calculateCents(norm.ratio) });
    });
    const unique = new Map<string, number>();
    entries.forEach(e => {
        if (!unique.has(e.ratio)) unique.set(e.ratio, e.cents);
    });
    return Array.from(unique.entries())
        .sort((a, b) => a[1] - b[1])
        .map(([ratio]) => ratio)
        .join('|');
};

export const startEarSession = (set: any, get: any) => {
    set((s: AppState) => {
        const q = generateQuestion(s.earTraining.settings.difficulty, s.earTraining.settings, { questionIndex: 0, recentKeys: [] });
        return {
            earTraining: {
                ...s.earTraining,
                isActive: true,
                mode: 'normal',
                phase: 'listen',
                currentQuestion: q,
                currentQuestionStartedAt: Date.now(),
                currentReplays: 0,
                selectedAnswerId: null,
                sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] },
                ui: { panel: 'train' }
            }
        };
    });
};

export const startReviewSession = (set: any, get: any, source: 'mistakes' | 'due') => {
    const s: AppState = get();
    let queue: string[] = [];
    if (source === 'mistakes') {
        const items = [...s.earTraining.persisted.reviewItems].sort((a, b) => b.lapses - a.lapses);
        queue = items.slice(0, 20).map(i => i.key);
    } else {
        const now = Date.now();
        const due = s.earTraining.persisted.reviewItems.filter(i => i.dueAt <= now);
        queue = due.slice(0, 20).map(i => i.key);
    }

    if (queue.length === 0) {
        s.pushNotification?.({ level: 'info', title: 'Review', message: 'No items due for review.' });
        return;
    }

    const firstKey = queue[0];
    const item = s.earTraining.persisted.reviewItems.find(i => i.key === firstKey);
    let q: any = null;
    if (item) {
        q = buildQuestionFromSignature(item.signature, s.earTraining.settings);
    }

    if (!q) {
        q = generateQuestion('auto', s.earTraining.settings, { questionIndex: 0, recentKeys: [] });
    }

    set(() => ({
        earTraining: {
            ...s.earTraining,
            isActive: true,
            mode: 'review',
            reviewQueue: queue,
            phase: 'listen',
            currentQuestion: q,
            currentQuestionStartedAt: Date.now(),
            currentReplays: 0,
            selectedAnswerId: null,
            sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] },
            ui: { panel: 'train' }
        }
    }));
};

export const startPracticeSignature = (set: any, get: any, sig: any) => {
    set((s: AppState) => {
        const q = buildQuestionFromSignature(sig, s.earTraining.settings);
        return {
            earTraining: {
                ...s.earTraining,
                isActive: true,
                mode: 'normal',
                phase: 'listen',
                currentQuestion: q,
                currentQuestionStartedAt: Date.now(),
                currentReplays: 0,
                selectedAnswerId: null,
                sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] },
                ui: { panel: 'train' }
            }
        };
    });
};

export const stopEarSession = (set: any, get: any) => {
    set((s: AppState) => ({
        landingMode: s.earTraining.returnTo === 'advanced' ? 'advanced' : 'none',
        isSetupComplete: s.earTraining.returnTo === 'advanced',
        earTraining: { ...s.earTraining, isActive: false, phase: 'idle', currentQuestion: null, returnTo: null }
    }));
};

export const backToEarSettings = (set: any, get: any) => {
    set((s: AppState) => ({
        earTraining: {
            ...s.earTraining,
            isActive: true,
            mode: 'normal',
            phase: 'idle',
            currentQuestion: null,
            currentQuestionStartedAt: 0,
            currentReplays: 0,
            selectedAnswerId: null,
            sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] },
            reviewQueue: []
        }
    }));
};

export const submitEarAnswer = (set: any, get: any, answerId: string) => {
    set((s: AppState) => {
        const q = s.earTraining.currentQuestion;
        if (!q) return s;
        const normalizeRestTokens = (value: string) => value.replace(/\b(r|rest)\b/gi, 'rest');
        const normalizeText = (value: string, taskType: EarTaskType, signature?: EarQuestion['signature']) => {
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
        const isText = q.answerMode === 'text';
        const selectedOption = q.options.find(o => o.id === answerId);
        const correctOption = q.options.find(o => o.isCorrect);
        const expectedAnswer = q.expectedAnswer ?? '';
        const isCorrect = isText
            ? normalizeText(answerId, q.type, q.signature) === normalizeText(expectedAnswer, q.type, q.signature)
            : !!selectedOption?.isCorrect;

        const now = Date.now();
        const timeMs = now - s.earTraining.currentQuestionStartedAt;

        const attempt: EarAttemptRecord = {
            id: Math.random().toString(36).slice(2),
            ts: now,
            mode: s.earTraining.mode,
            taskType: q.type,
            difficulty: q.difficulty,
            signature: q.signature,
            chosenId: answerId,
            correctId: isText ? (expectedAnswer || 'unknown') : (correctOption?.id || "unknown"),
            chosenLabel: isText ? (answerId.trim() || "Unknown") : (selectedOption?.label || "Unknown"),
            correctLabel: isText ? (expectedAnswer || "Unknown") : (correctOption?.label || "Unknown"),
            isCorrect,
            timeMs,
            replays: s.earTraining.currentReplays
        };

        const newStats = { ...s.earTraining.sessionStats };
        newStats.totalQuestions++;
        if (isCorrect) {
            newStats.correctCount++;
            newStats.currentStreak++;
            newStats.bestStreak = Math.max(newStats.bestStreak, newStats.currentStreak);
        } else {
            newStats.currentStreak = 0;
        }
        newStats.history.push(attempt);

        const newPersisted = { ...s.earTraining.persisted };
        newPersisted.attempts = [attempt, ...newPersisted.attempts].slice(0, 5000);

        const sigKey = getSignatureKey(q.signature);
        const existingItemIndex = newPersisted.reviewItems.findIndex(i => i.key === sigKey);
        let item: EarReviewItem;

        if (existingItemIndex > -1) {
            item = { ...newPersisted.reviewItems[existingItemIndex] };
            newPersisted.reviewItems.splice(existingItemIndex, 1);
        } else {
            item = {
                key: sigKey,
                signature: q.signature,
                stage: 0,
                dueAt: 0,
                lapses: 0,
                seen: 0
            };
        }

        item.seen++;

        const intervals = [1, 3, 7, 14, 30];
        const dayMs = 86400000;

        if (!isCorrect) {
            item.stage = 0;
            item.lapses++;
            item.lastResult = 'wrong';
            item.dueAt = now + dayMs;
        } else {
            const isHard = timeMs > 6000 || attempt.replays >= 2;
            if (isHard) {
                item.lastResult = 'hard';
                item.dueAt = now + dayMs;
            } else {
                item.lastResult = timeMs < 2500 && attempt.replays === 0 ? 'easy' : 'ok';
                item.stage = Math.min(item.stage + 1, intervals.length - 1);
                item.dueAt = now + (intervals[item.stage] * dayMs);
            }
        }

        newPersisted.reviewItems.push(item);
        saveEarData(newPersisted);

        return {
            earTraining: {
                ...s.earTraining,
                phase: 'feedback',
                selectedAnswerId: answerId,
                sessionStats: newStats,
                persisted: newPersisted
            }
        };
    });
};

export const nextEarQuestion = (set: any, get: any) => {
    set((s: AppState) => {
        const limit = s.earTraining.settings.sessionLength;
        
        if (s.earTraining.mode === 'normal' && limit > 0 && s.earTraining.sessionStats.totalQuestions >= limit) {
            const summary: EarSessionSummary = {
                id: `sess-${Date.now()}`,
                tsStart: 0,
                tsEnd: Date.now(),
                mode: s.earTraining.mode,
                total: s.earTraining.sessionStats.totalQuestions,
                correct: s.earTraining.sessionStats.correctCount,
                accuracy: s.earTraining.sessionStats.totalQuestions > 0 ? s.earTraining.sessionStats.correctCount / s.earTraining.sessionStats.totalQuestions : 0,
                avgTimeMs: 0,
                avgReplays: 0
            };

            const newPersisted = { ...s.earTraining.persisted };
            newPersisted.sessions = [summary, ...newPersisted.sessions].slice(0, 50);
            saveEarData(newPersisted);

            return { earTraining: { ...s.earTraining, phase: 'summary', persisted: newPersisted } };
        }

        if (s.earTraining.mode === 'review') {
            if (s.earTraining.reviewQueue.length === 0) {
                return { earTraining: { ...s.earTraining, phase: 'summary' } };
            }
        }

        let nextDiff = s.earTraining.settings.difficulty;
        if (nextDiff === 'auto' && s.earTraining.mode === 'normal') {
            if (s.earTraining.sessionStats.currentStreak > 2) nextDiff = 'hard';
            else if (s.earTraining.sessionStats.currentStreak > 0) nextDiff = 'medium';
            else nextDiff = 'easy';
        }

        let q: EarQuestion;
        let nextQueue = s.earTraining.reviewQueue;

        if (s.earTraining.mode === 'review') {
            const key = s.earTraining.reviewQueue[0];
            nextQueue = s.earTraining.reviewQueue.slice(1);
            const item = s.earTraining.persisted.reviewItems.find(i => i.key === key);
            if (item) {
                q = buildQuestionFromSignature(item.signature, s.earTraining.settings);
            } else {
                const recentKeys = s.earTraining.sessionStats.history.map(h => getSignatureKey(h.signature));
                q = generateQuestion(nextDiff, s.earTraining.settings, {
                    questionIndex: s.earTraining.sessionStats.totalQuestions,
                    recentKeys
                });
            }
        } else {
            const recentKeys = s.earTraining.sessionStats.history.map(h => getSignatureKey(h.signature));
            q = generateQuestion(nextDiff, s.earTraining.settings, {
                questionIndex: s.earTraining.sessionStats.totalQuestions,
                recentKeys
            });
        }

        return {
            earTraining: {
                ...s.earTraining,
                phase: 'listen',
                currentQuestion: q,
                currentQuestionStartedAt: Date.now(),
                currentReplays: 0,
                selectedAnswerId: null,
                reviewQueue: nextQueue
            }
        };
    });
};

const mergePro = (base: any, partial: any): any => {
    if (!partial) return base;
    const out = { ...(base ?? {}), ...(partial ?? {}) };
    if (partial.registerDrift) out.registerDrift = { ...(base?.registerDrift ?? {}), ...(partial.registerDrift ?? {}) };
    if (partial.tuning) out.tuning = { ...(base?.tuning ?? {}), ...(partial.tuning ?? {}) };
    if (partial.timbre) out.timbre = { ...(base?.timbre ?? {}), ...(partial.timbre ?? {}) };
    if (partial.sequence) out.sequence = { ...(base?.sequence ?? {}), ...(partial.sequence ?? {}) };
    if (partial.referenceTone) out.referenceTone = { ...(base?.referenceTone ?? {}), ...(partial.referenceTone ?? {}) };
    if (partial.content) {
        out.content = { ...(base?.content ?? {}), ...(partial.content ?? {}) };
        Object.keys(partial.content).forEach((key) => {
            out.content[key] = { ...(base?.content?.[key] ?? {}), ...(partial.content?.[key] ?? {}) };
        });
    }
    if (partial.audio) {
        out.audio = { ...(base?.audio ?? {}), ...(partial.audio ?? {}) };
        if (partial.audio.limiter) out.audio.limiter = { ...(base?.audio?.limiter ?? {}), ...(partial.audio.limiter ?? {}) };
        if (partial.audio.customSynth) out.audio.customSynth = { ...(base?.audio?.customSynth ?? {}), ...(partial.audio.customSynth ?? {}) };
    }
    if (partial.adaptive) out.adaptive = { ...(base?.adaptive ?? {}), ...(partial.adaptive ?? {}) };
    return out;
};

export const updateEarSettings = (set: any, get: any, partial: any) => {
    set((s: AppState) => {
        const newSettings = { ...s.earTraining.settings, ...partial };
        if (partial.taskWeights) newSettings.taskWeights = { ...s.earTraining.settings.taskWeights, ...partial.taskWeights };
        if (partial.playback) newSettings.playback = { ...s.earTraining.settings.playback, ...partial.playback };
        if (partial.pitch) newSettings.pitch = { ...s.earTraining.settings.pitch, ...partial.pitch };
        if (partial.timbre) newSettings.timbre = { ...s.earTraining.settings.timbre, ...partial.timbre };
        if (partial.pro) newSettings.pro = mergePro(s.earTraining.settings.pro, partial.pro);

        const newPersisted = { ...s.earTraining.persisted, settings: newSettings };
        saveEarData(newPersisted);

        return { earTraining: { ...s.earTraining, settings: newSettings, persisted: newPersisted } };
    });
};

const normalizePersisted = (data: any): any => {
    if (!data || typeof data !== 'object') return null;
    if (data.v !== 1) return null;
    if (!Array.isArray(data.attempts)) data.attempts = [];
    if (!Array.isArray(data.reviewItems)) data.reviewItems = [];
    if (!Array.isArray(data.sessions)) data.sessions = [];
    return data;
};

export const exportEarTrainingData = (get: any) => {
    const s: AppState = get();
    
    return {
        ...s.earTraining.persisted,
        v: 1 as const,
        updatedAt: Date.now(),
        settings: s.earTraining.settings
    };
};

export const importEarTrainingData = (set: any, get: any, incoming: any, mode: 'merge' | 'replace') => {
    const data = normalizePersisted((typeof structuredClone === 'function') ? structuredClone(incoming) : JSON.parse(JSON.stringify(incoming)));
    if (!data) throw new Error('Invalid EarTrainingPersistedV1 JSON.');

    set((s: AppState) => {
        const current = s.earTraining.persisted;

        const mergeByKey = <T extends { key: string }>(a: T[], b: T[]): T[] => {
            const map = new Map<string, T>();
            for (const item of a) map.set(item.key, item);
            for (const item of b) {
                const prev = map.get(item.key);
                
                map.set(item.key, prev ? ({ ...prev, ...item } as T) : item);
            }
            return Array.from(map.values());
        };

        const mergedPersisted = mode === 'replace'
            ? data
            : {
                ...current,
                
                attempts: [...current.attempts, ...data.attempts],
                reviewItems: mergeByKey(current.reviewItems, data.reviewItems),
                sessions: [...current.sessions, ...data.sessions],
                updatedAt: Date.now()
            };

        saveEarData(mergedPersisted);

        return {
            earTraining: {
                ...s.earTraining,
                
                settings: mode === 'replace' ? data.settings : s.earTraining.settings,
                persisted: mergedPersisted
            }
        };
    });
};

export const resetEarTrainingData = (set: any, get: any) => {
    set((s: AppState) => {
        saveEarData(DEFAULT_PERSISTED_EAR);
        return {
            earTraining: {
                ...s.earTraining,
                persisted: DEFAULT_PERSISTED_EAR,
                reviewQueue: [],
                sessionStats: { totalQuestions: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, history: [] }
            }
        };
    });
};

export const deleteReviewItem = (set: any, get: any, key: string) => {
    set((s: AppState) => {
        const newPersisted = { ...s.earTraining.persisted };
        newPersisted.reviewItems = newPersisted.reviewItems.filter(i => i.key !== key);
        saveEarData(newPersisted);
        return { earTraining: { ...s.earTraining, persisted: newPersisted } };
    });
};

export const setEarTrainingPersistedPart2 = (set: any, get: any, part2: EarTrainingPart2PersistedV1) => {
    set((s: AppState) => {
        
        const newPersisted = { ...s.earTraining.persisted, part2, updatedAt: Date.now() };
        saveEarData(newPersisted);
        return { earTraining: { ...s.earTraining, persisted: newPersisted } };
    });
};
