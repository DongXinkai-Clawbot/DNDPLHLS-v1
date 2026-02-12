
import type { NodeData, Fraction } from '../types';
import { calculateCents, normalizeOctave } from '../musicLogic';

interface ScaleCandidate {
    node: NodeData;
    score: number;
    cents: number;
    normalizedRatio: Fraction;
}

export const generateScale = (
    allNodes: NodeData[],
    root: NodeData,
    size: number,
    locks: (NodeData | null)[],
    strategy: 'simple' | 'accurate' = 'simple'
): NodeData[] => {
    
    const weightSimplicity = strategy === 'simple' ? 3.0 : 0.5;
    const weightAccuracy = strategy === 'accurate' ? 3.0 : 1.0;

    const candidates: ScaleCandidate[] = allNodes.map(node => {
        
        const n = BigInt(node.ratio.n) * BigInt(root.ratio.d);
        const d = BigInt(node.ratio.d) * BigInt(root.ratio.n);
        const { ratio: norm, octaves } = normalizeOctave({ n, d });
        
        const complexity = Number(norm.n) + Number(norm.d);
        const simplicityScore = 10000 / complexity; 
        
        const cents = calculateCents(norm);
        
        return {
            node: node,
            score: simplicityScore,
            cents: cents,
            normalizedRatio: norm
        };
    });

    const result: NodeData[] = new Array(size).fill(null);
    const stepSize = 1200 / size;

    for (let i = 0; i < size; i++) {
        
        if (locks[i]) {
            result[i] = locks[i]!;
            continue;
        }

        const targetCents = i * stepSize;
        
        let best: ScaleCandidate | null = null;
        let maxScore = -Infinity;

        for (const cand of candidates) {
            let dist = Math.abs(cand.cents - targetCents);
            if (dist > 600) dist = 1200 - dist; 
            
            const tolerance = strategy === 'simple' ? (stepSize * 0.7) : (stepSize * 0.4);
            if (dist > tolerance) continue;

            const accuracyScore = (100 - dist); 
            const finalScore = (cand.score * weightSimplicity) + (accuracyScore * weightAccuracy);

            if (finalScore > maxScore) {
                maxScore = finalScore;
                best = cand;
            }
        }
        
        if (best) {
            result[i] = best.node;
        } else {
            
            result[i] = root; 
        }
    }
    
    return result;
}
