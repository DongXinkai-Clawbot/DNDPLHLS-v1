
import type { NodeData, EdgeData, PrimeLimit, AppState } from '../../types';
import { getIdFromVec } from './utils';

const getAvailableNavigationLimits = (state: AppState): PrimeLimit[] => {
    const { settings, edges, navAxisHorizontal, navAxisVertical, navAxisDepth } = state;
    const maxPrime = settings.maxPrimeLimit;
    const limits = new Set<PrimeLimit>();
    const normalizeLimit = (limit?: PrimeLimit | number | string) => {
        const value = typeof limit === 'string' ? Number(limit) : (limit as number);
        return Number.isFinite(value) ? (value as PrimeLimit) : undefined;
    };
    const addLimit = (limit?: PrimeLimit | number | string) => {
        const value = normalizeLimit(limit);
        if (value === undefined) return;
        if (value <= maxPrime) limits.add(value as PrimeLimit);
    };

    (settings.rootLimits || []).forEach(addLimit);
    addLimit(navAxisHorizontal);
    addLimit(navAxisVertical);
    addLimit(navAxisDepth);

    for (const edge of edges as EdgeData[]) {
        if (!edge) continue;
        addLimit(edge.limit);
    }
    return Array.from(limits).sort((a, b) => (a as number) - (b as number));
};

const resolveNavigationAxes = (state: AppState) => {
    const { navAxisHorizontal, navAxisVertical, navAxisDepth } = state;
    const available = getAvailableNavigationLimits(state);
    if (available.length === 0) {
        return { hAxis: navAxisHorizontal, vAxis: navAxisVertical, dAxis: navAxisDepth };
    }
    if (available.length === 1) {
        return { hAxis: available[0], vAxis: available[0], dAxis: available[0] };
    }
    if (available.length === 2) {
        return { hAxis: available[0], vAxis: available[1], dAxis: available[0] };
    }
    const normalizeLimit = (limit?: PrimeLimit | number | string) => {
        const value = typeof limit === 'string' ? Number(limit) : (limit as number);
        return Number.isFinite(value) ? (value as PrimeLimit) : undefined;
    };
    const resolveAxis = (preferred: PrimeLimit, fallback: PrimeLimit) => {
        const normalizedPreferred = normalizeLimit(preferred);
        return normalizedPreferred !== undefined && available.includes(normalizedPreferred)
            ? normalizedPreferred
            : fallback;
    };
    let hAxis = resolveAxis(navAxisHorizontal, available[0]);
    let vAxis = resolveAxis(navAxisVertical, available.find(l => l !== hAxis) ?? available[1]);
    if (vAxis === hAxis) {
        vAxis = available.find(l => l !== hAxis) ?? hAxis;
    }
    let dAxis = resolveAxis(navAxisDepth, available.find(l => l !== hAxis && l !== vAxis) ?? vAxis);
    if (dAxis === hAxis || dAxis === vAxis) {
        dAxis = available.find(l => l !== hAxis && l !== vAxis) ?? available.find(l => l !== hAxis) ?? hAxis;
    }
    return { hAxis, vAxis, dAxis };
};

export const handleNavigateSelection = (
    set: any, get: any, 
    direction: { dx?: number, dy?: number, dz?: number } | number
) => {
    const state: AppState = get();
    const { selectedNode, nodes, activeNavigationLimit, settings } = state;
    
    if (!selectedNode) return;

    if (settings.equalStep?.enabled) {
        const config = settings.equalStep;
        const currentIndex = (selectedNode as NodeData).stepIndex ?? 0;
        let targetIndex = currentIndex;

        if (typeof direction === 'number') {
            targetIndex += direction;
        } else {
            
            if (direction.dx) targetIndex += direction.dx;
            
            if (direction.dy) targetIndex += (direction.dy * config.divisions);
        }

        targetIndex = Math.max(-config.range, Math.min(config.range, targetIndex));
        
        const targetId = `equal-step-${targetIndex}`;
        const targetNode = nodes.find((n: NodeData) => n.id === targetId);
        if (targetNode) state.selectNode(targetNode);
        return;
    }

    const sNode = selectedNode as NodeData;
    const currentVec = { ...sNode.primeVector };
    const wrapLoopedAxis = (value: number, loopLen: number) => {
        const span = loopLen * 2;
        if (!Number.isFinite(span) || span <= 0) return value;
        let wrapped = ((value + loopLen) % span + span) % span - loopLen;
        if (Math.abs(wrapped + loopLen) < 1e-9) wrapped = loopLen;
        const snapped = Math.round(wrapped);
        if (Math.abs(wrapped - snapped) < 1e-9) wrapped = snapped;
        if (Math.abs(wrapped) < 1e-9) wrapped = 0;
        return wrapped;
    };
    
    if (typeof direction === 'number') {
         currentVec[activeNavigationLimit] = (currentVec[activeNavigationLimit] || 0) + direction;
         
         if (settings.axisLooping && settings.axisLooping[activeNavigationLimit]) {
             const axis = activeNavigationLimit;
             const loopLen = settings.axisLooping[axis];
             if (Number.isFinite(loopLen) && loopLen) {
                 currentVec[axis] = wrapLoopedAxis(currentVec[axis], loopLen as number);
             } else {
                 const range = settings.gen0Ranges?.[axis];
                 const limitPos = range ? range.pos : (settings.gen0Lengths?.[axis] ?? settings.expansionA);
                 const limitNeg = range ? range.neg : (settings.gen0Lengths?.[axis] ?? settings.expansionA);
                 if (currentVec[axis] > limitPos) currentVec[axis] = -limitNeg;
                 else if (currentVec[axis] < -limitNeg) currentVec[axis] = limitPos;
             }
         }

    } else {
        const handleAxis = (axis: PrimeLimit, delta: number) => {
             currentVec[axis] = (currentVec[axis] || 0) + delta;
             if (settings.axisLooping && settings.axisLooping[axis]) {
                 const loopLen = settings.axisLooping[axis];
                 if (Number.isFinite(loopLen) && loopLen) {
                     currentVec[axis] = wrapLoopedAxis(currentVec[axis], loopLen as number);
                 } else {
                     const range = settings.gen0Ranges?.[axis];
                     const limitPos = range ? range.pos : (settings.gen0Lengths?.[axis] ?? settings.expansionA);
                     const limitNeg = range ? range.neg : (settings.gen0Lengths?.[axis] ?? settings.expansionA);
                     if (currentVec[axis] > limitPos) currentVec[axis] = -limitNeg;
                     else if (currentVec[axis] < -limitNeg) currentVec[axis] = limitPos;
                 }
             }
        };

        const { hAxis, vAxis, dAxis } = resolveNavigationAxes(state);
        if (direction.dx && direction.dx !== 0) handleAxis(hAxis, direction.dx);
        if (direction.dy && direction.dy !== 0) handleAxis(vAxis, direction.dy);
        if (direction.dz && direction.dz !== 0) handleAxis(dAxis, direction.dz);
    }
    
    const targetId = getIdFromVec(currentVec as { [key in PrimeLimit]: number });
    const targetNode = nodes.find((n: NodeData) => n.id === targetId);
    if (targetNode) state.selectNode(targetNode);
};

export const handleShortcutKey = (set: any, get: any, key: string) => {
    const { settings } = get();
    if (settings.isSimpleMode || !settings.navigationShortcuts) return;

    for (const [limitStr, shortcut] of Object.entries(settings.navigationShortcuts)) {
        if (key.toLowerCase() === (shortcut as string).toLowerCase()) {
            const limit = parseInt(limitStr) as PrimeLimit;
            if (limit <= settings.maxPrimeLimit) {
                
                set({ navAxisHorizontal: limit });
            }
        }
    }
};
