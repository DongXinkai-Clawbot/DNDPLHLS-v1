import { parseGeneralRatio } from '../musicLogic';

export type ScalaArchiveEntry = {
    id: string;
    fileName: string;
    path: string;
    displayName: string;
};

export type ScalaArchiveScale = ScalaArchiveEntry & {
    description: string;
    count: number;
    ratios: string[];
    periodCents: number;
};

const scalaArchiveImports = import.meta.glob('/scl/*.scl', { as: 'raw' });

const toDisplayName = (fileName: string) => fileName.replace(/\.scl$/i, '').replace(/_/g, ' ');

export const scalaArchiveIndex: ScalaArchiveEntry[] = Object.keys(scalaArchiveImports)
    .map((path) => {
        const fileName = path.split('/').pop() || path;
        const id = fileName.replace(/\.scl$/i, '');
        return { id, fileName, path, displayName: toDisplayName(fileName) };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

const scalaArchiveById = new Map(scalaArchiveIndex.map(entry => [entry.id, entry]));

const DEFAULT_PERIOD_CENTS = 1200;
const MATCH_BATCH_SIZE = 64;
const MATCH_EPSILON = 1e-6;

const parseRatioValue = (ratioStr: string) => {
    try {
        const frac = parseGeneralRatio(ratioStr);
        return Number(frac.n) / Number(frac.d);
    } catch {
        return NaN;
    }
};

const parseScalaStep = (line: string) => {
    const trimmed = line.split('!')[0].trim();
    if (!trimmed) return null;
    const token = trimmed.split(/\s+/)[0];
    if (token.includes('/')) return token;
    const cents = parseFloat(token);
    if (!Number.isFinite(cents)) return null;
    const ratioVal = Math.pow(2, cents / 1200);
    const ratioStr = ratioVal.toFixed(8).replace(/\.?0+$/, '');
    return ratioStr;
};

const ratioToCentsValue = (ratioStr: string) => {
    const val = parseRatioValue(ratioStr);
    if (!Number.isFinite(val) || val <= 0) return NaN;
    return 1200 * Math.log2(val);
};

const normalizeCents = (cents: number[], periodCents: number): number[] => {
    const period = Number.isFinite(periodCents) && periodCents > 0 ? periodCents : DEFAULT_PERIOD_CENTS;
    const cleaned = cents
        .filter(value => Number.isFinite(value))
        .map((value) => {
            let wrapped = value % period;
            if (wrapped < 0) wrapped += period;
            if (Math.abs(wrapped - period) < MATCH_EPSILON) wrapped = 0;
            return wrapped;
        })
        .sort((a, b) => a - b);
    const unique: number[] = [];
    const eps = Math.max(MATCH_EPSILON, period * MATCH_EPSILON);
    for (const value of cleaned) {
        if (unique.length === 0 || Math.abs(value - unique[unique.length - 1]) > eps) {
            unique.push(value);
        }
    }
    if (unique.length === 0 || unique[0] > eps) unique.unshift(0);
    return unique;
};

const computeStepSizes = (positions: number[]): number[] => {
    if (positions.length === 0) return [];
    const steps: number[] = [];
    for (let i = 1; i < positions.length; i++) {
        steps.push(positions[i] - positions[i - 1]);
    }
    steps.push(1 - positions[positions.length - 1]);
    return steps;
};

const normalizeScalaRatios = (ratios: string[]) => {
    if (ratios.length === 0) return ['1/1'];
    const body = ratios.length > 1 ? ratios.slice(0, ratios.length - 1) : ratios;
    const hasUnison = body.some((ratio) => {
        if (ratio === '1/1' || ratio === '1') return true;
        const value = parseRatioValue(ratio);
        return Number.isFinite(value) && Math.abs(value - 1) < 1e-6;
    });
    return hasUnison ? body : ['1/1', ...body];
};

const readPeriodCents = (ratios: string[]) => {
    if (ratios.length === 0) return DEFAULT_PERIOD_CENTS;
    const last = ratios[ratios.length - 1];
    const cents = ratioToCentsValue(last);
    return Number.isFinite(cents) && cents > 0 ? cents : DEFAULT_PERIOD_CENTS;
};

export const loadScalaScale = async (entryOrId: ScalaArchiveEntry | string): Promise<ScalaArchiveScale | null> => {
    const entry = typeof entryOrId === 'string' ? scalaArchiveById.get(entryOrId) : entryOrId;
    if (!entry) return null;
    const importer = scalaArchiveImports[entry.path];
    if (!importer) return null;
    const raw = await importer();
    const lines = raw.split(/\r?\n/).map(line => line.trim());
    const cleaned = lines
        .map(line => line.split('!')[0].trim())
        .filter(line => line.length > 0);
    if (cleaned.length < 2) return null;
    const description = cleaned[0];
    const count = parseInt(cleaned[1], 10);
    const stepLines = cleaned.slice(2);
    const stepCount = Number.isFinite(count) ? count : stepLines.length;
    const steps = stepLines.slice(0, stepCount);
    const parsedSteps = steps.map(parseScalaStep).filter(Boolean) as string[];
    const periodCents = readPeriodCents(parsedSteps);
    const ratios = normalizeScalaRatios(parsedSteps);
    return {
        ...entry,
        description,
        count: Number.isFinite(count) ? count : ratios.length,
        ratios,
        periodCents
    };
};

type ScalaScaleFingerprint = ScalaArchiveScale & {
    cents: number[];
    positions: number[];
    steps: number[];
};

const scalaFingerprintCache = new Map<string, ScalaScaleFingerprint>();
let scalaFingerprintList: ScalaScaleFingerprint[] | null = null;
let scalaFingerprintPromise: Promise<ScalaScaleFingerprint[]> | null = null;

const buildFingerprint = (scale: ScalaArchiveScale): ScalaScaleFingerprint => {
    const periodCents = Number.isFinite(scale.periodCents) && scale.periodCents > 0
        ? scale.periodCents
        : DEFAULT_PERIOD_CENTS;
    const cents = normalizeCents(scale.ratios.map(ratioToCentsValue), periodCents);
    const positions = cents.map(value => value / periodCents);
    const steps = computeStepSizes(positions);
    return { ...scale, periodCents, cents, positions, steps };
};

const loadAllFingerprints = async () => {
    if (scalaFingerprintList) return scalaFingerprintList;
    if (scalaFingerprintPromise) return scalaFingerprintPromise;
    scalaFingerprintPromise = (async () => {
        const out: ScalaScaleFingerprint[] = [];
        for (let i = 0; i < scalaArchiveIndex.length; i += MATCH_BATCH_SIZE) {
            const batch = scalaArchiveIndex.slice(i, i + MATCH_BATCH_SIZE);
            const loaded = await Promise.all(batch.map(entry => loadScalaScale(entry)));
            for (const scale of loaded) {
                if (!scale) continue;
                const cached = scalaFingerprintCache.get(scale.id) || buildFingerprint(scale);
                scalaFingerprintCache.set(scale.id, cached);
                out.push(cached);
            }
        }
        scalaFingerprintList = out;
        return out;
    })();
    return scalaFingerprintPromise;
};

const cyclicDistanceNorm = (a: number, b: number) => {
    let diff = Math.abs(a - b) % 1;
    if (diff > 0.5) diff = 1 - diff;
    return diff;
};

const meanNearestDistance = (source: number[], target: number[]) => {
    if (source.length === 0 || target.length === 0) return 1;
    let sum = 0;
    for (const s of source) {
        let best = Infinity;
        for (const t of target) {
            const dist = cyclicDistanceNorm(s, t);
            if (dist < best) best = dist;
            if (best <= 0) break;
        }
        sum += best;
    }
    return sum / source.length;
};

const computeStepDistance = (aSteps: number[], bSteps: number[]) => {
    if (aSteps.length === 0 || aSteps.length !== bSteps.length) return null;
    const n = aSteps.length;
    let best = Infinity;
    for (let offset = 0; offset < n; offset++) {
        let sum = 0;
        for (let i = 0; i < n; i++) {
            const diff = Math.abs(aSteps[i] - bSteps[(i + offset) % n]);
            sum += diff;
        }
        best = Math.min(best, sum / n);
    }
    return best;
};

export type ScalaMatchTarget = {
    cents: number[];
    periodCents: number;
};

export type ScalaMatchDetails = {
    pitchErrorCents: number;
    stepErrorCents: number | null;
    periodDiffCents: number;
    countDiff: number;
};

export type ScalaMatchResult = {
    entry: ScalaArchiveEntry;
    scale: ScalaArchiveScale;
    score: number;
    details: ScalaMatchDetails;
};

export type ScalaMatchOptions = {
    excludeIds?: Set<string>;
};

const MATCH_WEIGHTS = {
    pitch: 1,
    step: 0.6,
    period: 0.9,
    count: 0.35
};

const PERIOD_TOLERANCE_RATIO = 0.01;
const PERIOD_TOLERANCE_MIN = 5;

const buildTargetFingerprint = (target: ScalaMatchTarget) => {
    const periodCents = Number.isFinite(target.periodCents) && target.periodCents > 0
        ? target.periodCents
        : DEFAULT_PERIOD_CENTS;
    const cents = normalizeCents(target.cents, periodCents);
    const positions = cents.map(value => value / periodCents);
    const steps = computeStepSizes(positions);
    return {
        periodCents,
        count: positions.length,
        positions,
        steps
    };
};

export const findClosestScalaScale = async (
    target: ScalaMatchTarget,
    options: ScalaMatchOptions = {}
): Promise<ScalaMatchResult | null> => {
    const fingerprints = await loadAllFingerprints();
    const targetFingerprint = buildTargetFingerprint(target);
    const eligible = options.excludeIds
        ? fingerprints.filter(scale => !options.excludeIds?.has(scale.id))
        : fingerprints;
    const periodTolerance = Math.max(PERIOD_TOLERANCE_MIN, targetFingerprint.periodCents * PERIOD_TOLERANCE_RATIO);
    const periodFiltered = eligible.filter(scale => Math.abs(scale.periodCents - targetFingerprint.periodCents) <= periodTolerance);
    const candidates = periodFiltered.length > 0 ? periodFiltered : eligible;
    let best: ScalaMatchResult | null = null;

    for (const scale of candidates) {
        const pitchDistance = (meanNearestDistance(targetFingerprint.positions, scale.positions)
            + meanNearestDistance(scale.positions, targetFingerprint.positions)) / 2;
        const pitchErrorCents = pitchDistance * targetFingerprint.periodCents;
        const stepDistance = computeStepDistance(targetFingerprint.steps, scale.steps);
        const stepErrorCents = stepDistance !== null ? stepDistance * targetFingerprint.periodCents : null;
        const periodDiffCents = Math.abs(targetFingerprint.periodCents - scale.periodCents);
        const countDiff = Math.abs(targetFingerprint.count - scale.positions.length);
        const countPenaltyCents = (countDiff / Math.max(1, Math.max(targetFingerprint.count, scale.positions.length)))
            * targetFingerprint.periodCents;
        const score = (pitchErrorCents * MATCH_WEIGHTS.pitch)
            + ((stepErrorCents ?? 0) * MATCH_WEIGHTS.step)
            + (periodDiffCents * MATCH_WEIGHTS.period)
            + (countPenaltyCents * MATCH_WEIGHTS.count);

        if (!best || score < best.score) {
            best = {
                entry: {
                    id: scale.id,
                    fileName: scale.fileName,
                    path: scale.path,
                    displayName: scale.displayName
                },
                scale,
                score,
                details: {
                    pitchErrorCents,
                    stepErrorCents,
                    periodDiffCents,
                    countDiff
                }
            };
        }
    }

    return best;
};
