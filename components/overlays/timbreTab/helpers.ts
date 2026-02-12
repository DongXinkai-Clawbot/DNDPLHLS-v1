import {
    createPatchId,
    ensureMacro,
    ensureRoute,
    ensureTable,
    normalizeTimbrePatch
} from '../../../utils/timbrePatch';

export const mapRange = (x: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export const cloneDeep = <T,>(data: T): T => {
    if (typeof structuredClone === 'function') return structuredClone(data);
    return JSON.parse(JSON.stringify(data));
};

export const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
export { createPatchId, ensureMacro, ensureRoute, ensureTable };

export const patternToValues = (pattern: string | undefined, length: number = 16) => {
    if (!pattern) return Array(length).fill(0);
    const vals = pattern.split(',').map(s => parseFloat(s.trim()));
    while (vals.length < length) vals.push(0);
    return vals.slice(0, length);
};

export const normalizePatch = normalizeTimbrePatch;
