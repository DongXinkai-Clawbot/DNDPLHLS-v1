
import type { NodeData, PrimeLimit, NearbySortCriteria } from '../../types';

export const getPitchClassDistance = (centsA: number, centsB: number) => {
  let diff = Math.abs(centsA - centsB);
  diff = diff % 1200;
  return Math.min(diff, 1200 - diff);
};

export const calculateNearby = (
    target: NodeData, 
    allNodes: NodeData[], 
    tolerance: number,
    sortMode: NearbySortCriteria = 'pitch',
    maxCount: number = 20
): NodeData[] => {
    
    const candidates = allNodes.filter(n => {
        if (n.id === target.id) return false;
        const dist = getPitchClassDistance(n.cents, target.cents);
        return dist <= tolerance;
    });

    candidates.sort((a, b) => {
        
        if (sortMode === 'gen') {
            if (a.gen !== b.gen) return a.gen - b.gen;
        } else if (sortMode === 'center') {
            const distA = a.position.lengthSq();
            const distB = b.position.lengthSq();
            if (Math.abs(distA - distB) > 0.1) return distA - distB;
        }
        
        const distA = getPitchClassDistance(a.cents, target.cents);
        const distB = getPitchClassDistance(b.cents, target.cents);
        return distA - distB;
    });

    return candidates.slice(0, maxCount);
};

export const getIdFromVec = (v: { [key in PrimeLimit]: number }) => 
  `3:${v[3]},5:${v[5]},7:${v[7]},11:${v[11]},13:${v[13] || 0},17:${v[17] || 0},19:${v[19] || 0},23:${v[23] || 0},29:${v[29] || 0},31:${v[31] || 0}`;
