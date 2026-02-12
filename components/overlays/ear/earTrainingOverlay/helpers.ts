import type { EarTaskType } from '../../../../types';
import { calculateCents, normalizeOctave, parseGeneralRatio } from '../../../../musicLogic';

export const TASK_LABELS: Record<EarTaskType, string> = {
    interval: 'Interval',
    compare: 'Compare',
    chord: 'Chord',
    drift: 'Drift',
    melody: 'Melody Dictation',
    duo_melody: 'Dual Melody',
    progression: 'Chord Progression'
};

export const splitRatioTokens = (value: string) => value
    .split(/[\s,;|]+/)
    .map(t => t.trim())
    .filter(Boolean);

export const parseChordRatioTokens = (value: string) => {
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

export const normalizeChordRatioText = (value: string) => {
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
