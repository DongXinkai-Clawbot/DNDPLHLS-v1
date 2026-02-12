import { NodeData, Fraction } from '../typesPart1';

const gcd = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y > 0n) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
};

const simplifyFraction = (n: bigint, d: bigint): { n: bigint, d: bigint } => {
    if (d === 0n) return { n: 0n, d: 1n }; // Should not happen
    const common = gcd(n, d);
    return { n: n / common, d: d / common };
};

const getComplexity = (n: bigint, d: bigint): number => {
    // Benedetti height: n * d
    // We use Number() because bigints can be huge, but for reasonable ratios relative to 1/1 they fit in number.
    // However, if they are huge, we cap it.
    if (n > 1000000n || d > 1000000n) return 1e9;
    return Number(n) * Number(d);
};

const divFractions = (a: Fraction, b: Fraction): { n: bigint, d: bigint } => {
    // a / b = (a.n * b.d) / (a.d * b.n)
    return { n: a.n * b.d, d: a.d * b.n };
};

type DynamicTuningWeights = {
    deviation: number;
    interval: number;
    note: number;
};

type DynamicTuningOptions = {
    targetCents?: number[];
    weights?: Partial<DynamicTuningWeights>;
    candidateLimit?: number;
    fallbackLimit?: number;
    missingPenalty?: number;
    deviationMargin?: number;
};

type Candidate = {
    node: NodeData;
    diffCents: number;
    octaveShift: number;
    ratioComplexity: number;
};

const DEFAULT_WEIGHTS: DynamicTuningWeights = {
    deviation: 1,
    interval: 1,
    note: 0.25
};

const DEFAULT_CANDIDATE_LIMIT = 8;
const DEFAULT_FALLBACK_LIMIT = 4;
const DEFAULT_MISSING_PENALTY = 10000;
const DEFAULT_DEVIATION_MARGIN = 5;

const complexityScore = (n: bigint, d: bigint): number => {
    const height = getComplexity(n, d);
    if (!Number.isFinite(height) || height <= 1) return 0;
    return Math.log10(height);
};

const getTargetCents = (note: number, baseNote: number, override?: number) => {
    if (Number.isFinite(override)) return override as number;
    return (note - baseNote) * 100;
};

const getClosestOctaveMatch = (targetCents: number, nodeCents: number) => {
    if (!Number.isFinite(targetCents) || !Number.isFinite(nodeCents)) {
        return { octaveShift: 0, diffCents: Number.POSITIVE_INFINITY };
    }
    const octaveShift = Math.round((targetCents - nodeCents) / 1200);
    const effectiveCents = nodeCents + octaveShift * 1200;
    return { octaveShift, diffCents: Math.abs(effectiveCents - targetCents) };
};

// Cache for node candidates to avoid repeated filtering
const candidateCache = new Map<string, string[]>(); // key: "baseNote-noteNumber", value: nodeIds

export const clearDynamicTuningCache = () => {
    candidateCache.clear();
};

export interface DynamicTuningResult {
    nodeIds: (string | null)[]; // Maps input note indices to node IDs
    octaveShifts: number[];
    totalComplexity: number;
}

/**
 * Finds the best combination of lattice nodes for a set of MIDI notes.
 * @param notes MIDI note numbers to tune
 * @param latticeNodes Available nodes in the lattice
 * @param baseNote MIDI note number corresponding to 1/1 (usually 69 for A4)
 * @param toleranceCents How far to search from 12-TET pitch (default 45)
 * @param fixedAssignments Map of MIDI note index (in the notes array) to fixed Node ID (for already playing notes)
 */
export const findBestTuningForChord = (
    notes: number[],
    latticeNodes: NodeData[],
    baseNote: number = 69,
    toleranceCents: number = 45,
    fixedAssignments: Map<number, string> | null = null,
    options?: DynamicTuningOptions
): DynamicTuningResult => {
    if (notes.length === 0) return { nodeIds: [], octaveShifts: [], totalComplexity: 0 };
    if (!latticeNodes.length) {
        return { nodeIds: new Array(notes.length).fill(null), octaveShifts: new Array(notes.length).fill(0), totalComplexity: 0 };
    }

    const targetCentsByNote = notes.map((note, idx) => getTargetCents(note, baseNote, options?.targetCents?.[idx]));
    const weights: DynamicTuningWeights = { ...DEFAULT_WEIGHTS, ...(options?.weights || {}) };
    const candidateLimit = Math.max(1, Math.floor(options?.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT));
    const fallbackLimit = Math.max(1, Math.floor(options?.fallbackLimit ?? DEFAULT_FALLBACK_LIMIT));
    const missingPenalty = Number.isFinite(options?.missingPenalty) ? (options?.missingPenalty as number) : DEFAULT_MISSING_PENALTY;
    const deviationMargin = Number.isFinite(options?.deviationMargin) ? (options?.deviationMargin as number) : DEFAULT_DEVIATION_MARGIN;

    // 1. Find candidates for each note
    const candidatesPerNote: Candidate[][] = [];

    // Optimization: Pre-filter lattice nodes by sorting or hashing?
    // For now simple scan is fast enough for <1000 nodes.

    notes.forEach((note, idx) => {
        const targetCents = targetCentsByNote[idx];

        // If this note index is fixed, we only consider the fixed node
        if (fixedAssignments && fixedAssignments.has(idx)) {
            const fixedId = fixedAssignments.get(idx)!;
            const fixedNode = latticeNodes.find(n => n.id === fixedId);
            if (fixedNode) {
                const match = getClosestOctaveMatch(targetCents, fixedNode.cents);
                candidatesPerNote.push([{
                    node: fixedNode,
                    diffCents: match.diffCents,
                    octaveShift: match.octaveShift,
                    ratioComplexity: complexityScore(fixedNode.ratio.n, fixedNode.ratio.d)
                }]);
                return;
            }
        }

        const candidates: Candidate[] = [];
        const fallback: Candidate[] = [];

        for (const node of latticeNodes) {
            const match = getClosestOctaveMatch(targetCents, node.cents);
            const ratioComplexity = complexityScore(node.ratio.n, node.ratio.d);
            const candidate = { node, diffCents: match.diffCents, octaveShift: match.octaveShift, ratioComplexity };

            if (match.diffCents <= toleranceCents) {
                candidates.push(candidate);
            } else {
                fallback.push(candidate);
            }
        }

        let pool = candidates;
        if (!pool.length) {
            fallback.sort((a, b) => a.diffCents - b.diffCents || a.ratioComplexity - b.ratioComplexity);
            pool = fallback.slice(0, fallbackLimit);
        }

        pool.sort((a, b) => a.diffCents - b.diffCents || a.ratioComplexity - b.ratioComplexity);
        candidatesPerNote.push(pool.slice(0, candidateLimit));
    });

    // 2. Combinatorial Search
    // If strict exhaustive search is too heavy, we can use greedy or beam search.
    // For typically chords (3-5 notes), and ~3-5 candidates each, 5^5 = 3125 checks. Fast enough.

    let bestCombination: (string | null)[] = new Array(notes.length).fill(null);
    let bestOctaveShifts: number[] = new Array(notes.length).fill(0);
    let bestDeviation = Infinity;
    let bestPurity = Infinity;

    // Helper to compute complexity of current combination
    const evaluate = (currentNodes: (Candidate | null)[]) => {
        let intervalComplexity = 0;
        let deviationSum = 0;
        let noteComplexity = 0;
        let missingCount = 0;

        for (let i = 0; i < currentNodes.length; i++) {
            const n1 = currentNodes[i];
            if (n1) {
                deviationSum += n1.diffCents * n1.diffCents;
                noteComplexity += n1.ratioComplexity;
            } else {
                missingCount += 1;
            }
            for (let j = i + 1; j < currentNodes.length; j++) {
                const n2 = currentNodes[j];
                if (n1 && n2) {
                    const interval = divFractions(n1.node.ratio, n2.node.ratio);
                    const simplified = simplifyFraction(interval.n, interval.d);
                    intervalComplexity += complexityScore(simplified.n, simplified.d);
                }
            }
        }

        const missingCost = missingCount * missingPenalty;
        const deviationCost = (deviationSum * weights.deviation) + missingCost;
        const purityCost = (intervalComplexity * weights.interval) + (noteComplexity * weights.note);
        return { deviationCost, purityCost };
    };

    // Recursive search
    const search = (depth: number, currentSelection: (Candidate | null)[]) => {
        if (depth === notes.length) {
            const { deviationCost, purityCost } = evaluate(currentSelection);
            if (purityCost + 1e-9 < bestPurity) {
                bestPurity = purityCost;
                bestDeviation = deviationCost;
                bestCombination = currentSelection.map(n => n ? n.node.id : null);
                bestOctaveShifts = currentSelection.map(n => n ? n.octaveShift : 0);
            } else if (Math.abs(purityCost - bestPurity) < 1e-9 && deviationCost < bestDeviation) {
                bestDeviation = deviationCost;
                bestCombination = currentSelection.map(n => n ? n.node.id : null);
                bestOctaveShifts = currentSelection.map(n => n ? n.octaveShift : 0);
            }
            return;
        }

        const candidates = candidatesPerNote[depth];
        if (candidates.length === 0) {
            currentSelection[depth] = null;
            search(depth + 1, currentSelection);
        } else {
            for (const cand of candidates) {
                currentSelection[depth] = cand;
                search(depth + 1, currentSelection);

                // Pruning? If partial complexity already exceeds minComplexity?
                // Only possible if complexity metric is strictly monotonic increasing.
                // Pairwise sum is monotonic.
                // if (evaluatePartial(currentSelection, depth) > minComplexity) continue; 
            }
        }
    };

    search(0, new Array(notes.length));

    return {
        nodeIds: bestCombination,
        octaveShifts: bestOctaveShifts,
        totalComplexity: bestPurity
    };
};
