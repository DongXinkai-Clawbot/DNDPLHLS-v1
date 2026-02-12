import type { EarTrainingSettings } from '../../../../types';
import type {
    IntervalItem,
    ChordItem,
    CompareItem,
    DriftItem,
    MelodyItem,
    DuoMelodyItem,
    ProgressionItem
} from './helpers';
import { normalizeOctave, parseGeneralRatio } from '../../../../musicLogic';
import {
    COMMON_JI_RATIOS,
    DEFAULT_CHORD_POOL,
    DEFAULT_COMPARE_POOL,
    DEFAULT_DRIFT_POOL,
    DEFAULT_SCALES,
    buildDefaultIntervalPool,
    buildRhythmPattern,
    ensureDifferentRhythms,
    formatDuoAnswer,
    formatProgressionAnswer,
    formatSequenceAnswer,
    getActiveScaleRatios,
    getCustomPoolLines,
    getSequenceSettings,
    isWithinLimit,
    parseChordTokenWithDuration,
    parseChordTokens,
    parseNamedLine,
    parseSequenceTokens,
    splitTokens
} from './helpers';

export const buildIntervalPool = (earSettings: EarTrainingSettings): IntervalItem[] => {
    const custom = getCustomPoolLines(earSettings, 'interval');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const ratioStr = parsed.value || '1/1';
            const label = parsed.label || ratioStr;
            const frac = parseGeneralRatio(ratioStr);
            const norm = normalizeOctave(frac).ratio;
            return {
                id: `custom-int-${idx}`,
                name: label,
                n: Number(norm.n),
                d: Number(norm.d),
                ratioStr
            };
        });
    }
    const limit = earSettings.pro?.intervalLimit;
    const intervalScale = earSettings.pro?.sequence?.intervalScale;
    let pool = buildDefaultIntervalPool();

    if (intervalScale?.useScale) {
        const activeId = intervalScale.activeScaleId ?? 'ji_major';
        const customScales = intervalScale.scalePool ?? [];
        const scale = [...DEFAULT_SCALES, ...customScales].find(s => s.id === activeId);
        if (scale) {
            const scaleNoteSet = new Set(scale.ratios);
            pool = pool.filter(item => scaleNoteSet.has(item.ratioStr));
        }
    }

    if (limit && limit > 0) {
        return pool.filter(item => isWithinLimit(item.ratioStr, limit));
    }
    return pool;
};

export const buildChordPool = (earSettings: EarTrainingSettings): ChordItem[] => {
    const custom = getCustomPoolLines(earSettings, 'chord');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const ratios = parseChordTokens(parsed.value);
            const label = parsed.label || ratios.join(',');
            return { id: `custom-chord-${idx}`, name: label, ratios };
        }).filter(item => item.ratios.length > 0);
    }
    return DEFAULT_CHORD_POOL;
};

export const buildComparePool = (earSettings: EarTrainingSettings): CompareItem[] => {
    const custom = getCustomPoolLines(earSettings, 'compare');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const parts = parsed.value.split('|').map(p => p.trim()).filter(Boolean);
            const [a, b] = parts.length >= 2 ? parts : splitTokens(parsed.value);
            const name = parsed.label || `${a} vs ${b}`;
            return { id: `custom-cmp-${idx}`, name, a, b };
        }).filter(item => item.a && item.b);
    }
    return DEFAULT_COMPARE_POOL;
};

export const buildDriftPool = (earSettings: EarTrainingSettings): DriftItem[] => {
    const custom = getCustomPoolLines(earSettings, 'drift');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            return { id: `custom-drift-${idx}`, ratio: parsed.value || '1/1' };
        }).filter(item => item.ratio);
    }
    return DEFAULT_DRIFT_POOL;
};

export const buildMelodyPool = (earSettings: EarTrainingSettings, rng: () => number = Math.random): MelodyItem[] => {
    const custom = getCustomPoolLines(earSettings, 'melody');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const parsedSeq = parseSequenceTokens(parsed.value);
            const label = parsed.label || formatSequenceAnswer(parsedSeq.sequence, parsedSeq.rhythm, false);
            return { id: `custom-mel-${idx}`, name: label, sequence: parsedSeq.sequence, rhythm: parsedSeq.rhythm };
        }).filter(item => item.sequence.length > 0);
    }
    const seqSettings = getSequenceSettings(earSettings, 'melody');
    const melodyLength = seqSettings.melodyLength;

    const sourceRatiosRaw = getActiveScaleRatios(seqSettings) as (string | { ratioStr: string })[];

    const limit = seqSettings.melodyLimit;
    const sourceRatios = (limit && limit > 0)
        ? sourceRatiosRaw.filter(r => isWithinLimit(typeof r === 'string' ? r : r.ratioStr, limit))
        : sourceRatiosRaw;

    const ratios = sourceRatios.length > 0
        ? sourceRatios
        : COMMON_JI_RATIOS.filter(r => r !== '1/1');

    const ratioStrings = (typeof ratios[0] === 'string')
        ? ratios as string[]
        : (ratios as any[]).map(r => r.ratioStr);

    const count = Math.max(40, Math.min(240, ratioStrings.length * 4));
    const results: MelodyItem[] = [];

    for (let i = 0; i < count; i++) {
        const sequence: string[] = [];

        const poolIncludingRoot = ["1/1", ...ratioStrings];

        for (let j = 0; j < melodyLength; j++) {

            const pick = poolIncludingRoot[Math.floor(rng() * poolIncludingRoot.length)];
            sequence.push(pick);
        }

        const rhythm = buildRhythmPattern(melodyLength, seqSettings.rhythmMode, seqSettings.rhythmValues, rng);

        results.push({ id: `mel-${i}`, name: `Melody ${i + 1}`, sequence, rhythm });
    }
    return results;
};

export const buildDuoMelodyPool = (earSettings: EarTrainingSettings, rng: () => number = Math.random): DuoMelodyItem[] => {
    const custom = getCustomPoolLines(earSettings, 'duo_melody');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const parts = parsed.value.split('|').map(p => p.trim());
            const upperParsed = parseSequenceTokens(parts[0] || '');
            const lowerParsed = parseSequenceTokens(parts[1] || '');
            const upper = upperParsed.sequence;
            const lower = lowerParsed.sequence;
            const upperRhythm = upperParsed.rhythm;
            const lowerRhythm = lowerParsed.rhythm;
            const label = parsed.label || formatDuoAnswer(upper, lower, upperRhythm, lowerRhythm);
            return { id: `custom-duo-${idx}`, name: label, upper, lower, upperRhythm, lowerRhythm };
        }).filter(item => item.upper.length > 0 && item.lower.length > 0);
    }
    const seqSettings = getSequenceSettings(earSettings, 'duo_melody');
    const length = seqSettings.melodyLength;
    const allowRest = !!seqSettings.duoAllowRest;
    const restChance = allowRest ? 0.2 : 0;
    const restToken = 'rest';

    const sourceRatiosRaw = getActiveScaleRatios(seqSettings) as (string | { ratioStr: string })[];
    const limit = seqSettings.duoLimit;
    const sourceRatios = (limit && limit > 0)
        ? sourceRatiosRaw.filter(r => isWithinLimit(typeof r === 'string' ? r : r.ratioStr, limit))
        : sourceRatiosRaw;

    const ratios = (typeof sourceRatios[0] === 'string') ? sourceRatios as string[] : (sourceRatios as any[]).map(r => r.ratioStr);

    const fallbackRatios = COMMON_JI_RATIOS.filter(r => r !== '1/1');
    const effectiveRatios = ratios.length > 1 ? ratios : fallbackRatios;
    const poolIncludingRoot = ["1/1", ...effectiveRatios];

    const count = Math.max(40, Math.min(160, effectiveRatios.length * 4));
    const generated: DuoMelodyItem[] = [];

    const ratioValues = poolIncludingRoot
        .map(ratioStr => {
            const frac = parseGeneralRatio(ratioStr);
            return {
                ratioStr,
                value: Number(frac.n) / Number(frac.d)
            };
        })
        .filter(r => Number.isFinite(r.value) && r.value > 0)
        .sort((a, b) => a.value - b.value);

    if (ratioValues.length < 2) {
        ratioValues.push(
            { ratioStr: '1/1', value: 1 },
            { ratioStr: '3/2', value: 1.5 }
        );
    }
    const maxLowerIdx = Math.max(0, ratioValues.length - 2);
    const upperCandidatesByLower = ratioValues.map((_, idx) => ratioValues.slice(idx + 1));

    for (let i = 0; i < count; i++) {
        const upper: string[] = [];
        const lower: string[] = [];
        let upperNotes = 0;
        let lowerNotes = 0;
        for (let j = 0; j < length; j++) {
            const lowerIdx = Math.floor(rng() * (maxLowerIdx + 1));
            const lowerPick = ratioValues[lowerIdx];
            const upperCandidates = upperCandidatesByLower[lowerIdx];
            const upperPick = upperCandidates[Math.floor(rng() * upperCandidates.length)];
            let useRestUpper = allowRest && rng() < restChance;
            let useRestLower = allowRest && rng() < restChance;
            if (useRestUpper && useRestLower) {
                if (rng() < 0.5) useRestUpper = false;
                else useRestLower = false;
            }
            const remaining = length - j;
            if (allowRest && remaining === 1) {
                if (upperNotes === 0) useRestUpper = false;
                if (lowerNotes === 0) useRestLower = false;
                if (useRestUpper && useRestLower) useRestLower = false;
            }
            if (useRestUpper) {
                upper.push(restToken);
            } else {
                upper.push(upperPick.ratioStr);
                upperNotes++;
            }
            if (useRestLower) {
                lower.push(restToken);
            } else {
                lower.push(lowerPick.ratioStr);
                lowerNotes++;
            }
        }
        const upperRhythm = buildRhythmPattern(length, seqSettings.rhythmMode, seqSettings.rhythmValues, rng);
        const lowerRhythm = buildRhythmPattern(length, seqSettings.rhythmMode, seqSettings.rhythmValues, rng);
        const adjusted = ensureDifferentRhythms(upperRhythm, lowerRhythm, seqSettings.rhythmValues, rng);
        generated.push({
            id: `duo-${i}`,
            name: `Duo ${i + 1}`,
            upper,
            lower,
            upperRhythm: adjusted.upperRhythm,
            lowerRhythm: adjusted.lowerRhythm
        });
    }
    return generated;
};

export const buildProgressionPool = (earSettings: EarTrainingSettings): ProgressionItem[] => {
    const custom = getCustomPoolLines(earSettings, 'progression');
    if (custom.length > 0) {
        return custom.map((line, idx) => {
            const parsed = parseNamedLine(line);
            const chordStrings = parsed.value.split(';').map(p => p.trim()).filter(Boolean);
            const chords: string[][] = [];
            const rhythm: number[] = [];
            let hasRhythm = false;
            chordStrings.forEach(token => {
                const parsedChord = parseChordTokenWithDuration(token);
                if (parsedChord.ratios.length > 0) {
                    chords.push(parsedChord.ratios);
                    if (parsedChord.duration) {
                        rhythm.push(parsedChord.duration);
                        hasRhythm = true;
                    } else {
                        rhythm.push(1);
                    }
                }
            });
            const rhythmList = hasRhythm ? rhythm : undefined;
            const label = parsed.label || formatProgressionAnswer(chords, rhythmList);
            return { id: `custom-prog-${idx}`, name: label, chords, rhythm: rhythmList };
        }).filter(item => item.chords.length > 0);
    }
    const sequenceCfg = earSettings.pro?.sequence ?? {};
    const progLength = Math.max(2, Math.min(32, sequenceCfg.progressionLength ?? 3));
    const chords = buildChordPool(earSettings);
    const count = Math.max(40, Math.min(180, chords.length));
    const results: ProgressionItem[] = [];
    const stride = 2;
    for (let i = 0; i < count; i++) {
        const seq: string[][] = [];
        for (let j = 0; j < progLength; j++) {
            const chord = chords[(i + j * stride) % chords.length];
            seq.push(chord.ratios);
        }
        results.push({ id: `prog-${i}`, name: `Prog ${i + 1}`, chords: seq });
    }
    return results;
};

