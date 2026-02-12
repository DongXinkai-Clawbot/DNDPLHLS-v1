
import type { EarTaskType, NodeData, EarTrainingSettings, EarQuestionSignature, EarSelectionMode, EarTrainingContentPools } from '../../../../types';
import { calculateCents, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio, hasUnsupportedFactors } from '../../../../musicLogic';
import { Vector3 } from 'three';

const DUMMY_POS = new Vector3(0, 0, 0);

export const createNode = (n: number | bigint, d: number | bigint, name?: string): NodeData => {
    const { ratio, octaves } = normalizeOctave({ n: BigInt(n), d: BigInt(d) });
    return {
        id: `ear-${Math.random()}`,
        position: DUMMY_POS,
        primeVector: getPrimeVectorFromRatio(ratio.n, ratio.d),
        ratio: ratio,
        octave: octaves,
        cents: calculateCents(ratio),
        gen: 0,
        originLimit: 0,
        parentId: null,
        name: name || `${ratio.n}/${ratio.d}`
    };
};

const hash32 = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
};

const createRng = (seed: number) => {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return (s & 0xffffffff) / 0x100000000;
    };
};

export const getRng = (earSettings: EarTrainingSettings, questionIndex: number) => {
    if (earSettings.pro?.seedMode === 'locked') {
        const seedKey = earSettings.pro.lockedSeed || 'EAR';
        return createRng(hash32(`${seedKey}|${questionIndex}`));
    }
    return Math.random;
};

export const splitTokens = (value: string) => value
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(Boolean);

const REST_TOKEN = 'rest';

const isRestToken = (token: string) => {
    const normalized = token.trim().toLowerCase();
    return normalized === 'rest' || normalized === 'r';
};

const normalizeRestToken = (token: string) => (isRestToken(token) ? REST_TOKEN : token.trim());

const parseRatioToken = (token: string) => {
    const frac = parseGeneralRatio(token);
    return normalizeOctave(frac);
};

export const createNodeFromRatioString = (ratioStr: string, name?: string): NodeData => {
    const trimmed = ratioStr.trim();
    if (isRestToken(trimmed)) {
        const ratio = { n: 1n, d: 1n };
        return {
            id: `ear-${Math.random()}`,
            position: DUMMY_POS,
            primeVector: getPrimeVectorFromRatio(ratio.n, ratio.d),
            ratio,
            octave: 0,
            cents: 0,
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: name || 'Rest',
            isRest: true
        };
    }
    const norm = parseRatioToken(trimmed);
    return {
        id: `ear-${Math.random()}`,
        position: DUMMY_POS,
        primeVector: getPrimeVectorFromRatio(norm.ratio.n, norm.ratio.d),
        ratio: norm.ratio,
        octave: norm.octaves,
        cents: calculateCents(norm.ratio),
        gen: 0,
        originLimit: 0,
        parentId: null,
        name: name || ratioStr
    };
};

export const isWithinLimit = (ratioStr: string, limit?: number) => {
    if (!limit || limit <= 0) return true;
    try {
        const { ratio } = normalizeOctave(parseGeneralRatio(ratioStr));
        return Number(ratio.d) <= limit && Number(ratio.n) <= 200;
    } catch { return true; }
};

export const parseNamedLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return { label: '', value: '' };
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
        return {
            label: trimmed.slice(0, idx).trim(),
            value: trimmed.slice(idx + 1).trim()
        };
    }
    return { label: '', value: trimmed };
};

export const parseChordTokens = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2 && parts.every(p => /^-?\d+(\.\d+)?$/.test(p))) {
            const base = parseFloat(parts[0]);
            if (base !== 0) {
                return parts.slice(1).map(p => `${p}/${base}`);
            }
        }
    }
    return splitTokens(trimmed).filter(t => t !== '1/1' && t !== '1');
};

export const parseSequenceTokens = (value: string) => {
    const tokens = splitTokens(value);
    const sequence: string[] = [];
    const rhythm: number[] = [];
    let hasDurations = false;
    tokens.forEach(token => {
        const parts = token.split('@').map(p => p.trim()).filter(Boolean);
        const ratioStr = normalizeRestToken(parts[0] || '');
        if (!ratioStr) return;
        sequence.push(ratioStr);
        if (parts[1]) {
            const dur = parseFloat(parts[1]);
            if (Number.isFinite(dur) && dur > 0) {
                rhythm.push(dur);
                hasDurations = true;
            } else {
                rhythm.push(1);
            }
        } else {
            rhythm.push(1);
        }
    });
    return { sequence, rhythm: hasDurations ? rhythm : undefined };
};

export const parseChordTokenWithDuration = (token: string) => {
    const parts = token.split('@').map(p => p.trim()).filter(Boolean);
    const ratios = parseChordTokens(parts[0] || '');
    let duration: number | undefined;
    if (parts[1]) {
        const dur = parseFloat(parts[1]);
        if (Number.isFinite(dur) && dur > 0) duration = dur;
    }
    return { ratios, duration };
};

const formatDuration = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return '1';
    const rounded = Number(value.toFixed(3));
    return rounded.toString();
};

const formatRatioWithCents = (ratioStr: string) => {
    if (isRestToken(ratioStr)) return REST_TOKEN;
    const frac = parseGeneralRatio(ratioStr);
    if (frac.n <= 0n || frac.d <= 0n) return ratioStr;
    const norm = normalizeOctave(frac);
    const cents = calculateCents(norm.ratio);
    const rounded = Number(cents.toFixed(1));
    return `${ratioStr}(${rounded}c)`;
};

export const formatChordOptionLabel = (label: string, ratios: string[]) => {
    const trimmed = (label || '').trim();
    if (trimmed) return trimmed;
    return ratios.join(', ');
};

export const formatChordAnswer = (ratios: string[]) => {
    const out = ['1/1', ...ratios].filter(Boolean);
    return out.join(' ');
};

export const formatSequenceAnswer = (sequence: string[], rhythm?: number[], includeCents: boolean = false) => {
    const formatRatio = includeCents ? formatRatioWithCents : (r: string) => normalizeRestToken(r);
    if (!rhythm || rhythm.length === 0) return sequence.map(r => formatRatio(r)).join(' ');
    return sequence.map((r, i) => `${formatRatio(r)}@${formatDuration(rhythm[i] ?? 1)}`).join(' ');
};
export const formatDuoAnswer = (
    upper: string[],
    lower: string[],
    upperRhythm?: number[],
    lowerRhythm?: number[],
    includeCents: boolean = false
) => {
    const upperText = formatSequenceAnswer(upper, upperRhythm, includeCents);
    const lowerText = formatSequenceAnswer(lower, lowerRhythm, includeCents);
    return `${upperText} | ${lowerText}`;
};
export const formatProgressionAnswer = (chords: string[][], rhythm?: number[]) => {
    return chords.map((c, i) => {
        const base = c.join(',');
        if (rhythm && rhythm.length > 0) {
            return `${base}@${formatDuration(rhythm[i] ?? 1)}`;
        }
        return base;
    }).join(' ; ');
};

const normalizeRatioInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '1/1';
    const frac = parseGeneralRatio(trimmed);
    if (frac.n <= 0n || frac.d <= 0n) return '1/1';
    return trimmed;
};

export const buildReferenceToneSignature = (earSettings: EarTrainingSettings, rng: () => number) => {
    const ref = earSettings.pro?.referenceTone;
    const mode = ref?.mode ?? 'none';
    if (mode === 'none') return null;
    if (mode === 'fixed') return { mode: 'fixed' as const, ratioStr: '1/1', label: '1/1' };
    const pool = (ref?.ratios ?? []).map(r => normalizeRatioInput(r)).filter(Boolean);
    const ratios = pool.length > 0 ? pool : ['1/1'];
    const ratioStr = ratios[Math.floor(rng() * ratios.length)];
    return { mode: 'random' as const, ratioStr, label: ratioStr };
};

export const buildReferenceTone = (ref?: EarQuestionSignature['referenceTone']) => {
    if (!ref || ref.mode === 'none') return null;
    const ratioStr = normalizeRatioInput(ref.ratioStr ?? '1/1');
    const label = ref.label || ratioStr;
    const node = createNodeFromRatioString(ratioStr, label);
    return {
        node,
        ratioStr,
        label,
        mode: ref.mode === 'random' ? 'random' as const : 'fixed' as const
    };
};

type IntervalRatio = { ratioStr: string; n: number; d: number; cents: number };

const NAMED_INTERVALS = [
    { n: 1, d: 1, name: "Unison" },
    { n: 16, d: 15, name: "Minor 2nd (16/15)" },
    { n: 9, d: 8, name: "Major 2nd (9/8)" },
    { n: 6, d: 5, name: "Minor 3rd (6/5)" },
    { n: 5, d: 4, name: "Major 3rd (5/4)" },
    { n: 4, d: 3, name: "Perfect 4th" },
    { n: 45, d: 32, name: "Tritone (45/32)" },
    { n: 3, d: 2, name: "Perfect 5th" },
    { n: 8, d: 5, name: "Minor 6th (8/5)" },
    { n: 5, d: 3, name: "Major 6th (5/3)" },
    { n: 7, d: 4, name: "Harmonic 7th (7/4)" },
    { n: 15, d: 8, name: "Major 7th (15/8)" },
    { n: 2, d: 1, name: "Octave" }
];

export const EASY_INTERVAL_SET = new Set(['1/1', '5/4', '4/3', '3/2', '2/1', '6/5', '8/5']);

const buildIntervalRatioPool = (maxVal: number): IntervalRatio[] => {
    const ratioMap = new Map<string, IntervalRatio>();
    const gcdInt = (a: number, b: number) => {
        let x = Math.abs(a);
        let y = Math.abs(b);
        while (y !== 0) {
            const t = y;
            y = x % y;
            x = t;
        }
        return x;
    };
    for (let n = 1; n <= maxVal; n++) {
        for (let d = 1; d <= maxVal; d++) {
            if (gcdInt(n, d) !== 1) continue;
            if (hasUnsupportedFactors(BigInt(n), BigInt(d))) continue;
            const { ratio } = normalizeOctave({ n: BigInt(n), d: BigInt(d) });
            if (ratio.n <= 0n || ratio.d <= 0n) continue;
            const ratioStr = `${ratio.n}/${ratio.d}`;
            if (ratioMap.has(ratioStr)) continue;
            ratioMap.set(ratioStr, {
                ratioStr,
                n: Number(ratio.n),
                d: Number(ratio.d),
                cents: calculateCents(ratio)
            });
        }
    }
    if (!ratioMap.has('2/1')) {
        ratioMap.set('2/1', { ratioStr: '2/1', n: 2, d: 1, cents: 1200 });
    }
    return Array.from(ratioMap.values()).sort((a, b) => a.cents - b.cents);
};

export const DEFAULT_INTERVAL_RATIOS = buildIntervalRatioPool(48);
const NAMED_INTERVAL_MAP = new Map(
    NAMED_INTERVALS.map(item => [`${item.n}/${item.d}`, item.name])
);

export const buildDefaultIntervalPool = (): IntervalItem[] => {
    return DEFAULT_INTERVAL_RATIOS.map((r, idx) => ({
        id: `int_${r.n}_${r.d}_${idx}`,
        name: NAMED_INTERVAL_MAP.get(r.ratioStr) ?? r.ratioStr,
        n: r.n,
        d: r.d,
        ratioStr: r.ratioStr
    }));
};

export const COMMON_JI_RATIOS = [
    '1/1',
    '16/15',
    '10/9',
    '9/8',
    '8/7',
    '7/6',
    '6/5',
    '5/4',
    '4/3',
    '7/5',
    '3/2',
    '8/5',
    '5/3',
    '9/5',
    '7/4',
    '15/8',
    '2/1'
];

export const DEFAULT_CHORD_POOL = (() => {
    const baseRatios = COMMON_JI_RATIOS.filter(r => r !== '1/1' && r !== '2/1');
    const maxCount = 140;
    const generated: ChordItem[] = [];
    for (let i = 0; i < baseRatios.length && generated.length < maxCount; i++) {
        for (let j = i + 1; j < baseRatios.length && generated.length < maxCount; j++) {
            const a = baseRatios[i];
            const b = baseRatios[j];
            generated.push({
                id: `ch_${i}_${j}`,
                name: `${a},${b}`,
                ratios: [a, b]
            });
        }
    }
    return generated;
})();

export const getChordSettings = (settings: EarTrainingSettings) => {
    const chord = settings.pro?.chord ?? {};
    return {
        answerFormat: (chord.answerFormat ?? 'quality') as 'quality' | 'ratios',
        inversionMode: (chord.inversionMode ?? 'root') as 'root' | 'free'
    };
};

export const buildChordOctaveShifts = (ratios: string[], mode: 'root' | 'free', rng: () => number) => {
    const total = ratios.length + 1; 
    const shifts = new Array(total).fill(0);
    if (mode !== 'free' || total <= 1) {
        return { shifts, inversion: 'root' as const };
    }
    const ratiosWithRoot = ['1/1', ...ratios];
    const ordered = ratiosWithRoot.map((ratioStr, idx) => ({
        idx,
        cents: calculateCents(parseGeneralRatio(ratioStr))
    })).sort((a, b) => a.cents - b.cents);
    const inversionIndex = Math.floor(rng() * total);
    for (let i = 0; i < inversionIndex; i++) {
        const target = ordered[i];
        shifts[target.idx] = (shifts[target.idx] ?? 0) + 1;
    }
    const inversion = (inversionIndex === 0 ? 'root' : inversionIndex === 1 ? '1st' : inversionIndex === 2 ? '2nd' : '3rd') as 'root' | '1st' | '2nd' | '3rd';
    return { shifts, inversion };
};

export const normalizeChordOctaveShifts = (ratios: string[], octaveShifts?: number[]) => {
    const total = ratios.length + 1;
    if (!Array.isArray(octaveShifts)) return new Array(total).fill(0);
    if (octaveShifts.length === total) return octaveShifts;
    if (octaveShifts.length === ratios.length) return [0, ...octaveShifts];
    const out = new Array(total).fill(0);
    octaveShifts.forEach((v, idx) => {
        if (idx < out.length && Number.isFinite(v)) out[idx] = v;
    });
    return out;
};

export const DEFAULT_COMPARE_POOL = (() => {
    const ratios = DEFAULT_INTERVAL_RATIOS.filter(r => r.ratioStr !== '1/1' && r.ratioStr !== '2/1');
    const out: CompareItem[] = [];
    const step = Math.max(1, Math.floor(ratios.length / 20));
    for (let i = 0; i < ratios.length && out.length < 200; i += step) {
        for (let j = i + step; j < ratios.length && out.length < 200; j += step * 2) {
            const a = ratios[i].ratioStr;
            const b = ratios[j].ratioStr;
            out.push({ id: `cmp_${i}_${j}`, name: `${a} vs ${b}`, a, b });
        }
    }
    return out;
})();

export const DEFAULT_DRIFT_POOL = DEFAULT_INTERVAL_RATIOS
    .filter(r => r.ratioStr !== '1/1')
    .slice(0, 200)
    .map((r, idx) => ({ id: `drift_${idx}`, ratio: r.ratioStr }));

export const shuffle = <T>(array: T[], rng: () => number = Math.random): T[] => {
    const next = [...array];
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
};

export const selectTaskType = (earSettings: EarTrainingSettings, rng: () => number): EarTaskType => {
    const enabled = new Set(earSettings.tasks);
    const candidates = Object.entries(earSettings.taskWeights)
        .filter(([type, weight]) => enabled.has(type as EarTaskType) && weight > 0)
        .map(([type, weight]) => ({ type: type as EarTaskType, weight }));

    if (candidates.length === 0) return 'interval';

    const totalWeight = candidates.reduce((sum, item) => sum + item.weight, 0);
    let random = rng() * totalWeight;

    for (const item of candidates) {
        if (random < item.weight) return item.type;
        random -= item.weight;
    }
    return candidates[0].type;
};

export const getBaseFrequency = (earSettings: EarTrainingSettings, rng: () => number = Math.random): number => {
    const { baseFreqMode, fixedBaseFreq, randomMin, randomMax } = earSettings.pitch;
    if (baseFreqMode === 'random') {
        const f = randomMin + rng() * (randomMax - randomMin);
        return Math.max(20, Math.min(20000, f));
    }
    return Math.max(20, Math.min(20000, fixedBaseFreq));
};

export const getAnswerMode = (earSettings: EarTrainingSettings, task: EarTaskType): 'choice' | 'text' => {
    const mode = earSettings.pro?.answerMode ?? 'auto';
    if (task === 'compare' || task === 'drift') return 'choice';
    const rhythmMode = earSettings.pro?.sequence?.rhythmMode ?? 'fixed';
    if ((task === 'melody' || task === 'progression') && rhythmMode === 'random') return 'text';
    if (mode === 'choice' || mode === 'text') return mode;
    if (task === 'melody' || task === 'duo_melody' || task === 'progression') return 'text';
    return 'choice';
};

export const DEFAULT_SCALES = [
    { id: 'ji_major', name: "JI Major", ratios: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"] },
    { id: 'ji_minor', name: "JI Natural Minor", ratios: ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "9/5"] },
    { id: 'pyth_major', name: "Pythagorean Major", ratios: ["1/1", "9/8", "81/64", "4/3", "3/2", "27/16", "243/128"] },
    { id: 'ji_pentatonic', name: "JI Pentatonic Major", ratios: ["1/1", "9/8", "5/4", "3/2", "5/3"] },
    { id: 'blue_septimal', name: "Septimal Blues", ratios: ["1/1", "7/6", "4/3", "7/5", "3/2", "7/4"] },
    { id: 'chromatic', name: "Chromatic (12-Tone)", ratios: ["1/1", "16/15", "9/8", "6/5", "5/4", "4/3", "45/32", "3/2", "8/5", "5/3", "15/8"] } 
];

const parseRhythmFraction = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return 1;
    
    if (trimmed.includes('/')) {
        const parts = trimmed.split('/');
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
            return num / den;
        }
    }
    
    const v = parseFloat(trimmed);
    return Number.isFinite(v) && v > 0 ? v : 1;
};

const DEFAULT_RHYTHM_VALUES = ['1/2', '1', '3/2', '2']; 
const TRIPLET_RHYTHM_VALUES = ['1/3', '2/3', '1', '1/2', '2'];
const COMPLEX_RHYTHM_VALUES = ['1/4', '1/2', '3/4', '1', '5/4', '3/2', '1/3', '2/3'];

const getScaleSettings = (earSettings: EarTrainingSettings, taskType?: 'melody' | 'duo_melody') => {
    const seq = earSettings.pro?.sequence ?? {};
    const fallback = {
        useScale: seq.useScale ?? false,
        activeScaleId: seq.activeScaleId ?? 'ji_major',
        scalePool: seq.scalePool ?? []
    };
    if (!taskType) return fallback;
    const perTask = taskType === 'melody' ? seq.melodyScale : seq.duoScale;
    return { ...fallback, ...(perTask ?? {}) };
};

export const getSequenceSettings = (earSettings: EarTrainingSettings, taskType?: 'melody' | 'duo_melody') => {
    const seq = earSettings.pro?.sequence ?? {};
    const melodyLength = Math.max(2, Math.min(32, seq.melodyLength ?? 5));
    const progressionLength = Math.max(2, Math.min(32, seq.progressionLength ?? 3));
    const baseRhythmMode = seq.rhythmMode ?? 'fixed';
    const complexity = seq.rhythmComplexity ?? 'simple';

    const rhythmRaw = seq.rhythmValues ?? DEFAULT_RHYTHM_VALUES;
    let rhythmStrings: string[] = (rhythmRaw as Array<string | number>)
        .map(v => typeof v === 'number' ? v.toString() : v)
        .filter(Boolean);

    if (baseRhythmMode === 'random' && complexity !== 'custom') {
        if (complexity === 'simple') {
            rhythmStrings = DEFAULT_RHYTHM_VALUES;
        } else if (complexity === 'triplets') {
            rhythmStrings = TRIPLET_RHYTHM_VALUES;
        } else if (complexity === 'complex') {
            rhythmStrings = COMPLEX_RHYTHM_VALUES;
        }
    }

    const rhythmValues = rhythmStrings.map(parseRhythmFraction).filter(v => v > 0);
    const enforceRandomRhythm = (taskType === 'melody' || taskType === 'duo_melody')
        && (complexity === 'custom' || rhythmValues.length > 1);
    const rhythmMode = enforceRandomRhythm ? 'random' : baseRhythmMode;

    const scaleSettings = getScaleSettings(earSettings, taskType);
    return {
        melodyLength,
        progressionLength,
        rhythmMode,
        rhythmValues,
        melodyLimit: seq.melodyLimit,
        duoLimit: seq.duoLimit,
        duoAllowRest: seq.duoAllowRest ?? false,
        ...scaleSettings
    };
};

export const buildRhythmPattern = (length: number, rhythmMode: 'fixed' | 'random', rhythmValues: number[], rng: () => number) => {
    if (rhythmMode !== 'random' || rhythmValues.length === 0) return undefined;
    const pattern: number[] = [];
    for (let i = 0; i < length; i++) {
        const val = rhythmValues[Math.floor(rng() * rhythmValues.length)] ?? 1;
        pattern.push(val);
    }

    if (length > 1 && rhythmValues.length > 1) {
        
        const uniqueAvailable = new Set(rhythmValues);
        if (uniqueAvailable.size > 1) {
            const isHomogeneous = pattern.every(v => v === pattern[0]);
            if (isHomogeneous) {
                
                const idx = Math.floor(rng() * length);
                const current = pattern[idx];
                const others = rhythmValues.filter(v => v !== current);
                if (others.length > 0) {
                    pattern[idx] = others[Math.floor(rng() * others.length)];
                }
            }
        }
    }
    return pattern;
};

export const ensureDifferentRhythms = (
    upperRhythm: number[] | undefined,
    lowerRhythm: number[] | undefined,
    rhythmValues: number[],
    rng: () => number
) => {
    if (!upperRhythm || !lowerRhythm) return { upperRhythm, lowerRhythm };
    if (upperRhythm.length !== lowerRhythm.length) return { upperRhythm, lowerRhythm };
    const isSame = upperRhythm.every((val, idx) => val === lowerRhythm[idx]);
    if (!isSame) return { upperRhythm, lowerRhythm };
    if (rhythmValues.length <= 1) return { upperRhythm, lowerRhythm };

    const idx = Math.floor(rng() * lowerRhythm.length);
    const current = lowerRhythm[idx];
    const alternatives = rhythmValues.filter(v => v !== current);
    if (alternatives.length === 0) return { upperRhythm, lowerRhythm };

    const nextLower = [...lowerRhythm];
    nextLower[idx] = alternatives[Math.floor(rng() * alternatives.length)];
    return { upperRhythm, lowerRhythm: nextLower };
};

export const getActiveScaleRatios = (settings: ReturnType<typeof getSequenceSettings>) => {
    const fallback = COMMON_JI_RATIOS.filter(r => r !== '1/1');
    if (!settings.useScale) return fallback;

    const allScales = [...DEFAULT_SCALES, ...(settings.scalePool || [])];
    const scale = allScales.find(s => s.id === settings.activeScaleId) || DEFAULT_SCALES[0];

    const ratios = scale.ratios.filter(r => r !== '1/1');
    return ratios.length > 0 ? ratios : fallback; 
};

export const applyPoolLimit = <T,>(pool: T[], limit: number, rng: () => number, selectionMode: EarSelectionMode): T[] => {
    if (!limit || limit <= 0 || pool.length <= limit) return pool;
    if (selectionMode === 'cycle') return pool.slice(0, limit);
    return shuffle(pool, rng).slice(0, limit);
};

export const getCustomPoolLines = (earSettings: EarTrainingSettings, key: keyof EarTrainingContentPools) => {
    const pool = earSettings.pro?.content?.[key];
    if (!pool?.enabled) return [];
    return Array.isArray(pool.items) ? pool.items : [];
};

export type IntervalItem = { id: string; name: string; n: number; d: number; ratioStr: string };
export type ChordItem = { id: string; name: string; ratios: string[] };
export type CompareItem = { id: string; name: string; a: string; b: string };
export type DriftItem = { id: string; ratio: string };
export type MelodyItem = { id: string; name: string; sequence: string[]; rhythm?: number[] };
export type DuoMelodyItem = { id: string; name: string; upper: string[]; lower: string[]; upperRhythm?: number[]; lowerRhythm?: number[] };
export type ProgressionItem = { id: string; name: string; chords: string[][]; rhythm?: number[] };


