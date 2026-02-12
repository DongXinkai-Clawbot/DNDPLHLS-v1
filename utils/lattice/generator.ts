import { Vector3, Matrix4, Quaternion } from 'three';
import type { AppSettings, NodeData, EdgeData, PrimeLimit, OriginConfig, EqualStepConfig, Fraction } from '../../types';
import { PRIME_AXES, UNIT_DISTANCE, getPrimeAxis, GEN_SIZES, DEFAULT_CUSTOM_GEOMETRY } from '../../constants';
import { createLogger } from '../logger';
import { createFraction, multiply, normalizeOctave, getNoteName, calculateOctaveCentsFromPrimeVector, addVectors, getPrimeVectorFromRatio, getPitchClassDistance, isPrime, expandCompositePrimeVector } from '../../musicLogic';
import { calculateLoopComma, calculatePerStepAdjustment } from './commaCalculator';
import { evalScalar, buildMathContext } from '../math/unifiedEvaluator';

const getId = (v: { [key in PrimeLimit]: number }) => {
    if (!v) return "root";

    const keys = Object.keys(v).map(k => parseInt(k)).filter(k => !isNaN(k)).sort((a, b) => a - b);
    return keys.map(p => `${p}:${v[p as PrimeLimit] || 0}`).join(',');
};

const log = createLogger('lattice/generator');

const centsToRatio = (cents: number): Fraction => {

    const ratio = Math.pow(2, cents / 1200);

    const precision = 10000;
    const n = Math.round(ratio * precision);
    const d = precision;

    return normalizeOctave({ n: BigInt(n), d: BigInt(d) }).ratio;
};

const sumTrigSeries = (steps: number, angle: number) => {
    if (steps <= 0) return { sumCos: 0, sumSin: 0 };
    const absAngle = Math.abs(angle);
    if (absAngle < 1e-6) {
        return { sumCos: steps, sumSin: 0 };
    }
    const half = angle / 2;
    const denom = Math.sin(half);
    if (Math.abs(denom) < 1e-6) {
        return { sumCos: steps, sumSin: 0 };
    }
    const factor = Math.sin(steps * half) / denom;
    return {
        sumCos: factor * Math.cos((steps + 1) * half),
        sumSin: factor * Math.sin((steps + 1) * half)
    };
};

const computePrimeLog2 = (vec: { [key in PrimeLimit]?: number }) => {
    let log2Val = 0;
    for (const primeStr in vec) {
        const p = Number(primeStr) as PrimeLimit;
        const exp = vec[p] || 0;
        if (!exp) continue;
        log2Val += exp * Math.log2(p);
    }
    return log2Val;
};

const applyCurvedGeometry = (
    nodes: NodeData[],
    settings: AppSettings,
    curved: NonNullable<AppSettings['curvedGeometry']>
) => {
    if (!nodes.length) return nodes;

    const primeSpacings = settings.visuals?.primeSpacings || {};
    const globalScale = settings.visuals?.globalScale || 1;
    const curveStep = Number.isFinite(curved.curveRadiansPerStep) ? curved.curveRadiansPerStep : 0;
    const distanceScale = Number.isFinite(curved.distanceScale) ? curved.distanceScale : 1;
    const distanceExponent = Number.isFinite(curved.distanceExponent) ? curved.distanceExponent : 1;
    const distanceOffset = Number.isFinite(curved.distanceOffset) ? curved.distanceOffset : 0;
    const paddingMultiplier = Number.isFinite(curved.collisionPadding) ? curved.collisionPadding : 0;

    const axisCache = new Map<PrimeLimit, { axis: Vector3; bend: Vector3; stepDistance: number }>();

    const getAxisData = (prime: PrimeLimit) => {
        const cached = axisCache.get(prime);
        if (cached) return cached;
        const axis = getPrimeAxis(prime).normalize();
        let up = new Vector3(0, 1, 0);
        if (Math.abs(axis.dot(up)) > 0.85) {
            up = new Vector3(1, 0, 0);
        }
        const bend = new Vector3().crossVectors(axis, up).normalize();
        const spacing = primeSpacings?.[prime] ?? 1.0;
        const stepDistance = UNIT_DISTANCE * globalScale * spacing;
        const result = { axis, bend, stepDistance };
        axisCache.set(prime, result);
        return result;
    };

    const getPitchMetric = (vec: { [key in PrimeLimit]?: number }) => {
        const log2Val = computePrimeLog2(vec);
        let absSum = 0;
        let sumSq = 0;
        let maxAbs = 0;
        let weighted = 0;
        for (const primeStr in vec) {
            const p = Number(primeStr) as PrimeLimit;
            const exp = vec[p] || 0;
            if (!exp) continue;
            const abs = Math.abs(exp);
            absSum += abs;
            sumSq += exp * exp;
            if (abs > maxAbs) maxAbs = abs;
            weighted += abs * Math.log2(p);
        }
        switch (curved.pitchMetric) {
            case 'cents':
                return Math.abs(log2Val * 1200);
            case 'primeL1':
                return absSum;
            case 'primeL2':
                return Math.sqrt(sumSq);
            case 'primeLInf':
                return maxAbs;
            case 'weighted':
                return weighted;
            case 'log2':
            default:
                return Math.abs(log2Val);
        }
    };

    const getDistance = (metric: number) => {
        const base = Math.max(0, metric + distanceOffset);
        if (curved.distanceMode === 'log') {
            return distanceScale * Math.log1p(base) * distanceExponent * globalScale;
        }
        if (curved.distanceMode === 'power') {
            return distanceScale * Math.pow(base, distanceExponent) * globalScale;
        }
        return distanceScale * base * globalScale;
    };

    const positions = nodes.map(node => {
        const vec = node.primeVector || {};
        const pos = new Vector3(0, 0, 0);
        for (const primeStr in vec) {
            const p = Number(primeStr) as PrimeLimit;
            const exp = vec[p] || 0;
            if (!exp) continue;
            const steps = Math.abs(exp);
            if (steps === 0) continue;
            const sign = exp > 0 ? 1 : -1;
            const { axis, bend, stepDistance } = getAxisData(p);
            const { sumCos, sumSin } = sumTrigSeries(steps, curveStep * sign);
            pos.add(axis.clone().multiplyScalar(sumCos * stepDistance));
            pos.add(bend.clone().multiplyScalar(sumSin * stepDistance));
        }
        const metric = getPitchMetric(vec);
        const distance = getDistance(metric);
        const len = pos.length();
        if (len > 0 && Number.isFinite(distance)) {
            if (distance <= 0) {
                pos.set(0, 0, 0);
            } else {
                pos.multiplyScalar(distance / len);
            }
        }
        return pos;
    });

    if (curved.autoSpacing) {
        const nodeRadii = nodes.map(node => {
            const genScale = (GEN_SIZES as any)[node.gen] ?? 0.25;
            return genScale * (settings.visuals?.nodeScale || 1) * 0.6;
        });

        const hasCollision = (scale: number) => {
            if (nodes.length < 2) return false;
            let maxRadius = 0;
            nodeRadii.forEach(r => { if (r > maxRadius) maxRadius = r; });
            const cellSize = Math.max(0.0001, maxRadius * 2 * (1 + paddingMultiplier));
            const grid = new Map<string, number[]>();
            const neighborOffsets = [-1, 0, 1];

            for (let i = 0; i < positions.length; i++) {
                const pos = positions[i].clone().multiplyScalar(scale);
                const r = nodeRadii[i];
                const cellX = Math.floor(pos.x / cellSize);
                const cellY = Math.floor(pos.y / cellSize);
                const cellZ = Math.floor(pos.z / cellSize);

                for (const dx of neighborOffsets) {
                    for (const dy of neighborOffsets) {
                        for (const dz of neighborOffsets) {
                            const key = `${cellX + dx},${cellY + dy},${cellZ + dz}`;
                            const bucket = grid.get(key);
                            if (!bucket) continue;
                            for (const j of bucket) {
                                const otherPos = positions[j].clone().multiplyScalar(scale);
                                const minDist = (r + nodeRadii[j]) * (1 + paddingMultiplier);
                                if (pos.distanceToSquared(otherPos) < minDist * minDist) {
                                    return true;
                                }
                            }
                        }
                    }
                }

                const key = `${cellX},${cellY},${cellZ}`;
                if (!grid.has(key)) grid.set(key, []);
                grid.get(key)!.push(i);
            }
            return false;
        };

        let spacingScale = 1;
        const maxIters = 10;
        const scaleStep = 1.08;
        for (let iter = 0; iter < maxIters; iter++) {
            if (!hasCollision(spacingScale)) break;
            spacingScale *= scaleStep;
        }
        if (spacingScale !== 1) {
            positions.forEach(pos => pos.multiplyScalar(spacingScale));
        }
    }

    return nodes.map((node, idx) => ({
        ...node,
        position: positions[idx]
    }));
};

const evalCustomExpression = (expr: string, ctx: Record<string, number>) => {
    if (!expr || !expr.trim()) return { value: NaN, valid: false };
    const res = evalScalar(expr, buildMathContext(ctx));
    return { value: res.value, valid: res.isValid };
};

const evalVector3Expression = (expr: string, ctx: Record<string, number>) => {
    const trimmed = expr.trim();
    if (!trimmed) return { x: 0, y: 0, z: 0, valid: false };
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) return { x: 0, y: 0, z: 0, valid: false };
    const pick = (raw: string) => {
        const cleaned = raw.replace(/^[xyz]\s*=\s*/i, '');
        return evalCustomExpression(cleaned, ctx);
    };
    const resX = pick(parts[0]);
    const resY = pick(parts[1]);
    const resZ = pick(parts[2]);
    if (!resX.valid || !resY.valid || !resZ.valid) return { x: 0, y: 0, z: 0, valid: false };
    return { x: resX.value, y: resY.value, z: resZ.value, valid: true };
};

const generateEqualStep = (settings: AppSettings) => {
    const nodes = new Map<string, NodeData>();
    const edges: EdgeData[] = [];
    const config = settings.equalStep!;

    const { base, divisions, range, radius, zRise, layerGap, visualizationMode, deltaN = 1, stepsPerCircle = 12 } = config;
    const { globalScale } = settings.visuals;

    const R = radius * globalScale;
    const Rise = zRise * globalScale;
    const LG = layerGap * globalScale;

    const startIdx = -range;
    const endIdx = range;

    let prevId: string | null = null;

    const visualCycleSteps = visualizationMode === 'helix' ? stepsPerCircle : (divisions / deltaN);

    for (let a = startIdx; a <= endIdx; a++) {
        const id = `equal-step-${a}`;

        const n = a * deltaN;
        const exponent = n / divisions;
        const val = Math.pow(base, exponent);

        const cents = 1200 * (n / divisions) * Math.log2(base);

        const prec = 10000;
        const nInt = Math.round(val * prec);
        const dInt = prec;
        const ratio = normalizeOctave({ n: BigInt(nInt), d: BigInt(dInt) }).ratio;

        const theta = (2 * Math.PI * a) / (visualCycleSteps || 1);
        const x = R * Math.cos(theta);
        const y = R * Math.sin(theta);

        let z = 0;
        if (visualizationMode === 'graphite') {

            const layer = Math.floor(a / (visualCycleSteps || 1));
            z = layer * LG;
        } else {

            z = a * Rise;
        }

        const pos = new Vector3(x, y, z);
        const vec = { 3: a, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 };

        const node: NodeData = {
            id,
            position: pos,
            primeVector: vec as any,
            ratio: { n: BigInt(nInt), d: BigInt(dInt) },
            octave: 0,
            cents: cents,
            gen: 0,
            originLimit: 0,
            parentId: prevId,
            name: `Step ${a}`,
            stepIndex: a
        };

        nodes.set(id, node);

        if (prevId) {
            const edgeId = `${prevId}-${id}`;
            edges.push({ id: edgeId, sourceId: prevId, targetId: id, limit: 3, gen: 0 });
        }

        prevId = id;
    }

    return { nodes: Array.from(nodes.values()), edges };
};

export const generateLattice = (settings: AppSettings) => {

    if (settings.equalStep?.enabled) {
        return generateEqualStep(settings);
    }

    if (settings.geometry?.enabled && settings.geometry.mode !== 'sphere') {
        // Rectangle + Custom mode generation
        const { limits, dimensions } = settings.geometry;
        const geometryMode = settings.geometry.mode || 'rectangle';
        const customConfig = settings.geometry.custom || DEFAULT_CUSTOM_GEOMETRY;
        const nodes = new Map<string, NodeData>();
        const edges: EdgeData[] = [];

        const [p1, p2, p3] = limits;
        const [d1, d2, d3] = dimensions;

        const globalScale = settings.visuals?.globalScale || 1.0;
        const primeSpacings = settings.visuals?.primeSpacings;
        const geometrySpacing = settings.geometry?.spacing ?? 1.6; // Default 1.6x wider

        const addNodeByVector = (vec: { [key: number]: number }, parentGen: number = 0) => {
            const id = getId(vec as any);
            if (nodes.has(id)) return nodes.get(id)!;

            const pos = getPosFromVec(vec); // Need to rename/extract getPos logic

            let currentRatio = createFraction(1, 1);
            [p1, p2, p3].forEach((p) => {
                const val = vec[p] || 0;
                if (val > 0) currentRatio = multiply(currentRatio, createFraction(BigInt(p) ** BigInt(val), 1));
                else if (val < 0) currentRatio = multiply(currentRatio, createFraction(1, BigInt(p) ** BigInt(Math.abs(val))));
            });

            const { ratio } = normalizeOctave(currentRatio);
            const cents = calculateOctaveCentsFromPrimeVector(vec as any);

            const exp1 = vec[p1] || 0;
            const exp2 = vec[p2] || 0;
            const exp3 = vec[p3] || 0;
            const genIndex = Math.abs(exp1) + Math.abs(exp2) + Math.abs(exp3);
            const absVals = [
                { limit: p1, value: Math.abs(exp1) },
                { limit: p2, value: Math.abs(exp2) },
                { limit: p3, value: Math.abs(exp3) }
            ].sort((a, b) => {
                if (b.value !== a.value) return b.value - a.value;
                return (a.limit as number) - (b.limit as number);
            });
            const originLimit = absVals[0]?.value ? absVals[0].limit : 0;

            const node: NodeData = {
                id,
                position: pos,
                primeVector: vec as any,
                ratio,
                octave: 0,
                cents,
                gen: Math.max(parentGen, genIndex),
                originLimit,
                name: getNoteName(vec as any, settings.notationSymbols, settings.accidentalPlacement)
            };
            nodes.set(id, node);
            return node;
        };

        const getPosFromVec = (vec: { [key: number]: number }) => {
            const pos = new Vector3(0, 0, 0);
            [p1, p2, p3].forEach(p => {
                const val = vec[p] || 0;
                const spacing = primeSpacings ? (primeSpacings[p] || 1.0) : 1.0;
                const rawDistance = UNIT_DISTANCE * globalScale * spacing * geometrySpacing;
                const axis = getPrimeAxis(p).multiplyScalar(val * rawDistance);
                pos.add(axis);
            });
            return pos;
        };

        // Main grid generation
        for (let x = 0; x < d1; x++) {
            for (let y = 0; y < d2; y++) {
                for (let z = 0; z < d3; z++) {
                    const v1 = x - Math.floor(d1 / 2);
                    const v2 = y - Math.floor(d2 / 2);
                    const v3 = z - Math.floor(d3 / 2);

                    const vec: any = {};
                    if (p1) vec[p1] = v1;
                    if (p2) vec[p2] = v2;
                    if (p3) vec[p3] = v3;

                    const node = addNodeByVector(vec, 0);

                    // Add edges (only checking backward to avoid dupes in this loop, but overrides might need both ways or rely on their creation order)
                    // For base grid, standard prev-check is fine
                    if (x > 0) {
                        const prevVec = { ...vec }; if (p1) prevVec[p1]--;
                        const prev = addNodeByVector(prevVec, 0);
                        edges.push({ id: `${prev.id}-${node.id}`, sourceId: prev.id, targetId: node.id, limit: p1, gen: 0 });
                    }
                    if (y > 0) {
                        const prevVec = { ...vec }; if (p2) prevVec[p2]--;
                        const prev = addNodeByVector(prevVec, 0);
                        edges.push({ id: `${prev.id}-${node.id}`, sourceId: prev.id, targetId: node.id, limit: p2, gen: 0 });
                    }
                    if (z > 0) {
                        const prevVec = { ...vec }; if (p3) prevVec[p3]--;
                        const prev = addNodeByVector(prevVec, 0);
                        edges.push({ id: `${prev.id}-${node.id}`, sourceId: prev.id, targetId: node.id, limit: p3, gen: 0 });
                    }
                }
            }
        }

        // Process Node Branch Overrides
        const overrides = settings.geometry.nodeBranchOverrides;
        const clampBranchLen = (value: number | undefined) => {
            if (!Number.isFinite(value)) return 0;
            return Math.max(0, Math.min(50, Math.floor(value as number)));
        };
        if (overrides) {
            Object.entries(overrides).forEach(([nodeId, config]) => {
                const parentNode = nodes.get(nodeId);
                if (!parentNode) return;

                const branchGen = parentNode.gen + 1;
                const limits = [p1, p2, p3];
                const posLen = clampBranchLen((config as any).pos);
                const negLen = clampBranchLen((config as any).neg);

                limits.forEach(limit => {
                    const baseVec = { ...parentNode.primeVector };

                    // Positive direction
                    for (let i = 1; i <= posLen; i++) {
                        const nextVec = { ...baseVec, [limit]: (baseVec[limit] || 0) + i };
                        const prevVec = { ...baseVec, [limit]: (baseVec[limit] || 0) + i - 1 };

                        const nextNode = addNodeByVector(nextVec, branchGen);
                        const prevNode = nodes.get(getId(prevVec as any))!; // Should exist as we build out

                        const edgeId = `${prevNode.id}-${nextNode.id}`;
                        if (!edges.some(e => e.id === edgeId)) {
                            edges.push({ id: edgeId, sourceId: prevNode.id, targetId: nextNode.id, limit, gen: branchGen });
                        }
                    }

                    // Negative direction
                    for (let i = 1; i <= negLen; i++) {
                        const nextVec = { ...baseVec, [limit]: (baseVec[limit] || 0) - i };
                        const prevVec = { ...baseVec, [limit]: (baseVec[limit] || 0) - i + 1 };

                        const nextNode = addNodeByVector(nextVec, branchGen);
                        const prevNode = nodes.get(getId(prevVec as any))!;

                        // Edge logic needs care for ID consistency (source/target or just ID sort? unique ID handles it)
                        // Here we just ensure we link them. 
                        const edgeId = `${nextNode.id}-${prevNode.id}`; // Ensure consistent ordering or checking?
                        // Let's stick to consistent direction: smaller to larger? or just link.
                        // Standard is usually lower->higher index but here we assume link exists.

                        // For consistency with base loop which did prev->curr.
                        // Here prevNode is closer to parent (or parent itself).
                        // nextNode is further away.
                        // So link nextNode <-> prevNode.
                        const eId = `${nextNode.id}-${prevNode.id}`;
                        const eIdRev = `${prevNode.id}-${nextNode.id}`;
                        if (!edges.some(e => e.id === eId || e.id === eIdRev)) {
                            edges.push({ id: eId, sourceId: nextNode.id, targetId: prevNode.id, limit, gen: branchGen });
                        }
                    }
                });
            });
        }

        if (geometryMode === 'custom') {
            const sampleParametric = () => {
                const points: Vector3[] = [];
                const param = customConfig.parametric || DEFAULT_CUSTOM_GEOMETRY.parametric;
                const mode = param.mode || 'curve';
                const uSteps = Math.max(2, Math.floor(param.uSteps || 60));
                const vSteps = Math.max(2, Math.floor(param.vSteps || 30));
                const uMin = param.uMin ?? -6.28;
                const uMax = param.uMax ?? 6.28;
                const vMin = param.vMin ?? -3.14;
                const vMax = param.vMax ?? 3.14;
                if (mode === 'curve') {
                    for (let i = 0; i < uSteps; i++) {
                        const t = uMin + (uMax - uMin) * (i / (uSteps - 1));
                        const ctx = { t };
                        const res = evalVector3Expression(param.expression, ctx);
                        if (res.valid) points.push(new Vector3(res.x, res.y, res.z));
                    }
                } else {
                    for (let i = 0; i < uSteps; i++) {
                        const u = uMin + (uMax - uMin) * (i / (uSteps - 1));
                        for (let j = 0; j < vSteps; j++) {
                            const v = vMin + (vMax - vMin) * (j / (vSteps - 1));
                            const ctx = { u, v };
                            const res = evalVector3Expression(param.expression, ctx);
                            if (res.valid) points.push(new Vector3(res.x, res.y, res.z));
                        }
                    }
                }
                return points;
            };

            const parametricPoints = customConfig.style === 'parametric' ? sampleParametric() : [];
            const paramThickness = customConfig.parametric?.thickness ?? DEFAULT_CUSTOM_GEOMETRY.parametric.thickness;

            const matchesCustom = (node: NodeData) => {
                const vec = node.primeVector || {};
                const exp1 = vec[p1] || 0;
                const exp2 = vec[p2] || 0;
                const exp3 = vec[p3] || 0;
                const genIndex = Math.abs(exp1) + Math.abs(exp2) + Math.abs(exp3);
                const pos = node.position;

                const ctx: Record<string, number> = {
                    l1: Number(p1),
                    l2: Number(p2),
                    l3: Number(p3),
                    gen: genIndex
                };

                if (customConfig.inputSpace !== 'world') {
                    ctx.a = exp1;
                    ctx.b = exp2;
                    ctx.c = exp3;
                    ctx.p1 = exp1;
                    ctx.p2 = exp2;
                    ctx.p3 = exp3;
                    ctx.r = Math.sqrt(exp1 * exp1 + exp2 * exp2 + exp3 * exp3);
                }

                if (customConfig.inputSpace !== 'lattice') {
                    ctx.x = pos.x;
                    ctx.y = pos.y;
                    ctx.z = pos.z;
                    ctx.rw = pos.length();
                }

                if (customConfig.style === 'parametric') {
                    if (parametricPoints.length === 0) return false;
                    const threshold = Math.max(0.0001, paramThickness || 1);
                    let minDistSq = Infinity;
                    for (const pt of parametricPoints) {
                        const distSq = pt.distanceToSquared(pos);
                        if (distSq < minDistSq) minDistSq = distSq;
                        if (minDistSq <= threshold * threshold) return true;
                    }
                    return false;
                }

                const expression = customConfig.style === 'voxel'
                    ? (customConfig.voxelExpression || customConfig.implicitExpression)
                    : customConfig.implicitExpression;

                const res = evalCustomExpression(expression, ctx);
                if (!res.valid) return false;

                if (customConfig.style === 'voxel') {
                    return res.value > 0;
                }

                if (customConfig.thresholdMode === 'abs') {
                    const eps = Number.isFinite(customConfig.epsilon) ? customConfig.epsilon : 0.4;
                    return Math.abs(res.value) <= eps;
                }
                return res.value <= 0;
            };

            const kept = new Map<string, NodeData>();
            for (const node of nodes.values()) {
                if (matchesCustom(node)) kept.set(node.id, node);
            }
            const keptIds = new Set(kept.keys());
            const filteredEdges = edges.filter(e => keptIds.has(e.sourceId) && keptIds.has(e.targetId));
            return { nodes: Array.from(kept.values()), edges: filteredEdges };
        }

        return { nodes: Array.from(nodes.values()), edges };
    }

    // Sphere mode generation
    if (settings.geometry?.enabled && settings.geometry.mode === 'sphere') {
        const sphereConfig = settings.geometry.sphere;
        log.info('Sphere generator config', { sphereConfig, mode: settings.geometry.mode });
        if (!sphereConfig) {
            log.info('No sphere config, returning empty');
            return { nodes: [], edges: [] };
        }

        const { limits, structuringAxis, radius } = sphereConfig;
        const nodes = new Map<string, NodeData>();
        const edges: EdgeData[] = [];

        const globalScale = settings.visuals?.globalScale || 1.0;
        const primeSpacings = settings.visuals?.primeSpacings;
        const geometrySpacing = settings.geometry?.spacing ?? 1.6;

        // Get all three axes - structuring axis and two plane axes
        const [p1, p2, p3] = limits;
        // Determine which axes form the 2D planes (not the structuring axis)
        let planeP1: PrimeLimit, planeP2: PrimeLimit;
        if (structuringAxis === p1) {
            planeP1 = p2; planeP2 = p3;
        } else if (structuringAxis === p2) {
            planeP1 = p1; planeP2 = p3;
        } else {
            planeP1 = p1; planeP2 = p2;
        }

        const getPos = (vec: { [key: number]: number }) => {
            const pos = new Vector3(0, 0, 0);
            for (const p of limits) {
                const val = vec[p] || 0;
                const spacing = primeSpacings ? (primeSpacings[p] || 1.0) : 1.0;
                const rawDistance = UNIT_DISTANCE * globalScale * spacing * geometrySpacing;
                const axis = getPrimeAxis(p).multiplyScalar(val * rawDistance);
                pos.add(axis);
            }
            return pos;
        };

        const addSphereNode = (vec: { [key: number]: number }) => {
            const id = getId(vec as any);
            if (nodes.has(id)) return nodes.get(id)!;

            const pos = getPos(vec);

            let currentRatio = createFraction(1, 1);
            for (const p of limits) {
                const val = vec[p] || 0;
                if (val > 0) currentRatio = multiply(currentRatio, createFraction(BigInt(p) ** BigInt(val), 1));
                else if (val < 0) currentRatio = multiply(currentRatio, createFraction(1, BigInt(p) ** BigInt(Math.abs(val))));
            }

            const { ratio } = normalizeOctave(currentRatio);
            const cents = calculateOctaveCentsFromPrimeVector(vec as any);

            const expVals = limits.map((limit) => ({ limit, value: Math.abs(vec[limit] || 0) }));
            expVals.sort((a, b) => {
                if (b.value !== a.value) return b.value - a.value;
                return (a.limit as number) - (b.limit as number);
            });
            const genIndex = expVals.reduce((sum, entry) => sum + entry.value, 0);
            const originLimit = expVals[0]?.value ? expVals[0].limit : 0;

            const node: NodeData = {
                id,
                position: pos,
                primeVector: vec as any,
                ratio,
                octave: 0,
                cents,
                gen: genIndex,
                originLimit,
                name: getNoteName(vec as any, settings.notationSymbols, settings.accidentalPlacement)
            };
            nodes.set(id, node);
            return node;
        };

        // Generate sphere by stacking 2D circular planes along structuring axis
        for (let s = -radius; s <= radius; s++) {
            // For each layer, calculate the radius of the 2D circle
            const layerRadius = Math.floor(Math.sqrt(radius * radius - s * s));

            for (let a = -layerRadius; a <= layerRadius; a++) {
                for (let b = -layerRadius; b <= layerRadius; b++) {
                    // Check if point is within sphere
                    const dist = Math.sqrt(a * a + b * b + s * s);
                    if (dist > radius) continue;

                    const vec: { [key: number]: number } = {};
                    vec[structuringAxis] = s;
                    vec[planeP1] = a;
                    vec[planeP2] = b;

                    const node = addSphereNode(vec);

                    // Add edges to neighbors
                    const checkEdge = (dVec: { [key: number]: number }) => {
                        const neighborId = getId(dVec as any);
                        if (nodes.has(neighborId)) {
                            const edgeId = `${neighborId}-${node.id}`;
                            const reverseId = `${node.id}-${neighborId}`;
                            if (!edges.some(e => e.id === edgeId || e.id === reverseId)) {
                                // Determine limit based on which axis changed
                                let limit: PrimeLimit = 3;
                                for (const p of limits) {
                                    if ((dVec[p] || 0) !== (vec[p] || 0)) {
                                        limit = p;
                                        break;
                                    }
                                }
                                edges.push({ id: edgeId, sourceId: neighborId, targetId: node.id, limit, gen: 0 });
                            }
                        }
                    };

                    // Check all 6 neighbors
                    checkEdge({ ...vec, [structuringAxis]: s - 1 });
                    checkEdge({ ...vec, [planeP1]: a - 1 });
                    checkEdge({ ...vec, [planeP2]: b - 1 });
                }
            }
        }

        return { nodes: Array.from(nodes.values()), edges };
    }

    const nodes = new Map<string, NodeData>();
    const edges: EdgeData[] = [];
    const edgeSet = new Set<string>();

    const { notationSymbols: baseNotationSymbols, transpositionVector, secondaryOrigins, isSimpleMode, accidentalPlacement, customPrimes } = settings;
    const { globalScale, primeSpacings, spiralFactor, helixFactor, layoutMode, diamondLimit } = settings.visuals || { globalScale: 1.0, primeSpacings: {}, spiralFactor: 0, helixFactor: 0 };

    const notationSymbols = { ...baseNotationSymbols };
    if (customPrimes) {
        customPrimes.forEach(cp => {
            if (cp.symbol) {
                notationSymbols[cp.prime] = cp.symbol;
            }
        });
    }

    const availablePrimes: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const customPrimesArray = customPrimes ? customPrimes.map(cp => cp.prime as PrimeLimit) : [];
    const axisLimitSet = new Set<number>();
    availablePrimes.forEach(p => axisLimitSet.add(p as number));
    customPrimesArray.forEach(p => axisLimitSet.add(p as number));
    (settings.rootLimits || []).forEach(p => axisLimitSet.add(p as number));
    (secondaryOrigins || []).forEach(o => (o.rootLimits || []).forEach(p => axisLimitSet.add(p as number)));
    if (settings.geometry?.nodeBranchOverrides) {
        Object.values(settings.geometry.nodeBranchOverrides).forEach((override: any) => {
            if (!override?.axisOverrides) return;
            Object.keys(override.axisOverrides).forEach((k) => {
                const limit = parseInt(k, 10);
                if (Number.isFinite(limit)) axisLimitSet.add(limit);
            });
        });
    }
    const allPrimesPossible = Array.from(axisLimitSet).sort((a, b) => a - b) as PrimeLimit[];
    const resolveGenLimit = (gen: number, configMax: PrimeLimit, config?: OriginConfig) => {
        const getOverride = (source: any) => (
            gen === 1 ? source?.gen1MaxPrimeLimit :
                gen === 2 ? source?.gen2MaxPrimeLimit :
                    gen === 3 ? source?.gen3MaxPrimeLimit :
                        gen === 4 ? source?.gen4MaxPrimeLimit :
                            undefined
        );
        const genOverride = getOverride(config) ?? getOverride(settings);
        const effective = genOverride ?? configMax;
        return (effective < configMax ? effective : configMax) as PrimeLimit;
    };
    const primesUpTo = (limit: PrimeLimit, allowList?: PrimeLimit[]) => {
        let list = allPrimesPossible.filter(p => p <= limit && isPrime(Number(p))) as PrimeLimit[];
        if (allowList !== undefined) {
            const allowSet = new Set(allowList);
            list = list.filter(p => allowSet.has(p));
        }
        return list;
    };

    const effExpansionC = isSimpleMode ? 0 : settings.expansionC;
    const effExpansionD = isSimpleMode ? 0 : settings.expansionD;
    const effExpansionE = isSimpleMode ? 0 : settings.expansionE;

    const nodeRotations = new Map<string, Quaternion>();
    let activeAxisLooping = settings.axisLooping;
    let activeCommaSpreadingEnabled = settings.commaSpreadingEnabled;

    const addNode = (
        vec: { [key in PrimeLimit]?: number },
        gen: number,
        originLimit: PrimeLimit | 0,
        parentId: string | null,
        overridePosition?: Vector3,
        idOverride?: string
    ) => {
        if (!vec) return null;
        const fullVec = { ...vec } as { [key in PrimeLimit]: number };
        allPrimesPossible.forEach(p => { if (fullVec[p] === undefined) fullVec[p] = 0; });

        const id = idOverride || getId(fullVec);
        if (nodes.has(id)) return nodes.get(id)!;

        let pos = new Vector3();

        if (overridePosition) {
            pos = overridePosition;
        } else {

            if (settings.spiral?.enabled && parentId && nodeRotations.has(parentId)) {

                const parentRot = nodeRotations.get(parentId)!;
                const parentNode = nodes.get(parentId);

                if (parentNode) {

                    const relVec = new Vector3();
                    allPrimesPossible.forEach(p => {
                        const diff = (fullVec[p] || 0) - (parentNode.primeVector[p] || 0);
                        if (diff !== 0) {
                            const spacing = primeSpacings ? (primeSpacings[p] || 1.0) : 1.0;
                            const dist = UNIT_DISTANCE * globalScale * spacing;
                            const axis = getPrimeAxis(p).multiplyScalar(diff * dist);
                            relVec.add(axis);
                        }
                    });

                    relVec.applyQuaternion(parentRot);

                    pos.copy(parentNode.position).add(relVec);

                    nodeRotations.set(id, parentRot);
                }
            } else {

                allPrimesPossible.forEach(p => {
                    const spacing = primeSpacings ? (primeSpacings[p] || 1.0) : 1.0;
                    const rawDistance = UNIT_DISTANCE * globalScale * spacing;
                    const loopVal = activeAxisLooping ? activeAxisLooping[p] : null;
                    const val = fullVec[p] || 0;

                    if (loopVal && loopVal > 0) {
                        const theta = (val / loopVal) * Math.PI;
                        const spiralScale = 1.0 + (Math.abs(val) * (spiralFactor || 0));
                        const R = ((loopVal * rawDistance) / Math.PI) * spiralScale;
                        const axisV = getPrimeAxis(p).normalize();
                        let up = new Vector3(0, 1, 0);
                        if (Math.abs(axisV.dot(up)) > 0.9) up.set(1, 0, 0);
                        const bend = new Vector3().crossVectors(axisV, up).normalize();
                        const rise = up.clone().multiplyScalar(val * (helixFactor || 0) * globalScale * 3.0);

                        const circPos = axisV.clone().multiplyScalar(R * Math.sin(theta))
                            .add(bend.clone().multiplyScalar(R * (1 - Math.cos(theta))))
                            .add(rise);
                        pos.add(circPos);
                    } else {
                        pos.add(getPrimeAxis(p).multiplyScalar(val * rawDistance));
                    }
                });
            }
        }

        if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
            pos.set(0, 0, 0);
        }

        let currentRatio = createFraction(1, 1);
        allPrimesPossible.forEach(p => {
            const exp = fullVec[p] || 0;
            if (exp > 0) currentRatio = multiply(currentRatio, createFraction(BigInt(p) ** BigInt(exp), 1));
            else if (exp < 0) currentRatio = multiply(currentRatio, createFraction(1, BigInt(p) ** BigInt(Math.abs(exp))));
        });

        const { ratio: baseRatio, octaves } = normalizeOctave(currentRatio);
        const namingVec = addVectors(expandCompositePrimeVector(fullVec) as any, expandCompositePrimeVector(transpositionVector) as any);

        let cents = calculateOctaveCentsFromPrimeVector(fullVec);
        let ratio = baseRatio;

        if (activeAxisLooping && activeCommaSpreadingEnabled) {
            let commaSpreadingApplied = false;

            allPrimesPossible.forEach(p => {
                const loopVal = activeAxisLooping[p];
                const spreadEnabled = activeCommaSpreadingEnabled[p];

                if (loopVal && loopVal > 0 && spreadEnabled) {
                    const stepIndex = fullVec[p] || 0;
                    const comma = calculateLoopComma(p, loopVal);
                    const perStepAdjustment = calculatePerStepAdjustment(comma, loopVal);
                    cents += stepIndex * perStepAdjustment;
                    commaSpreadingApplied = true;
                }
            });

            if (commaSpreadingApplied) {
                ratio = centsToRatio(cents);
            }
        }

        const node: NodeData = {
            id,
            position: pos,
            primeVector: { ...fullVec },
            ratio,
            octave: 0,
            cents,
            gen,
            originLimit,
            parentId,
            name: getNoteName(namingVec, notationSymbols, accidentalPlacement)
        };
        nodes.set(id, node);
        return node;
    };

    const addEdge = (srcId: string, tgtId: string, limit: PrimeLimit, gen: number) => {
        const id = `${srcId}-${tgtId}`;
        const reverseId = `${tgtId}-${srcId}`;
        if (!edgeSet.has(id) && !edgeSet.has(reverseId)) {
            edgeSet.add(id);
            edges.push({ id, sourceId: srcId, targetId: tgtId, limit, gen });
        }
    };

    if (layoutMode === 'diamond') {
        const limit = diamondLimit || 7;
        const oddIdentities: bigint[] = [];
        for (let i = 1; i <= limit; i += 2) oddIdentities.push(BigInt(i));
        const spacing = 4 * globalScale;
        for (let i = 0; i < oddIdentities.length; i++) {
            for (let j = 0; j < oddIdentities.length; j++) {
                const u = oddIdentities[i];
                const v = oddIdentities[j];
                const vec = getPrimeVectorFromRatio(u, v);
                const x = (i + j) * spacing;
                const y = (i - j) * spacing;
                const pos = new Vector3(x, y, 0);
                const node = addNode(vec, 0, 0, null, pos, `diamond-${i}-${j}`);
                if (node) {
                    if (i > 0) addEdge(`diamond-${i - 1}-${j}`, node.id, 3, 0);
                    if (j > 0) addEdge(`diamond-${i}-${j - 1}`, node.id, 3, 0);
                }
            }
        }
        return { nodes: Array.from(nodes.values()), edges: edges };
    }

    if (settings.spiral?.enabled) {

        const cfg = settings.spiral;
        const axis = cfg.axis || 3;
        const length = cfg.length || 60;

        const pStep = cfg.primaryStep || 12;
        const r1 = (cfg.radius1 || 40) * globalScale;

        const sStep = cfg.secondaryStep || 0;
        const r2 = (cfg.radius2 || 20) * globalScale;

        const tStep = cfg.tertiaryStep || 0;
        const r3 = (cfg.radius3 || 200) * globalScale;

        const pDiv = pStep > 0 ? pStep : 1;
        const sDiv = sStep > 0 ? sStep : 1;
        const tDiv = tStep > 0 ? tStep : 1;

        const primaryRise = ((cfg.rise !== undefined ? cfg.rise : 60.0) / pDiv) * globalScale;
        const secondaryRise = ((cfg.rise2 !== undefined ? cfg.rise2 : 200.0) / sDiv) * globalScale;
        const tertiaryRise = ((cfg.rise3 !== undefined ? cfg.rise3 : 600.0) / tDiv) * globalScale;

        const spiralGen1Len = cfg.expansionB !== undefined ? cfg.expansionB : 2;
        const spiralGen2Len = cfg.expansionC !== undefined ? cfg.expansionC : 0;

        const startIdx = -Math.floor(length / 2);
        const endIdx = Math.ceil(length / 2);

        let prevId: string | null = null;
        let rootId: string | null = null;

        for (let i = startIdx; i <= endIdx; i++) {
            const vec = { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 } as any;
            vec[axis] = i;
            let cumulativeRot = new Quaternion();
            let pos = new Vector3();
            let zDrift = 0;

            if (tStep > 0) {
                const theta3 = (i / tStep) * Math.PI * 2;
                const q3 = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), theta3);
                cumulativeRot.multiply(q3);
                pos.add(new Vector3(r3, 0, 0).applyQuaternion(cumulativeRot));
                zDrift += i * tertiaryRise;
            }
            if (sStep > 0) {
                const theta2 = (i / sStep) * Math.PI * 2;
                const axisVec = tStep > 0 ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
                const q2 = new Quaternion().setFromAxisAngle(axisVec, theta2);
                cumulativeRot.multiply(q2);
                pos.add(new Vector3(r2, 0, 0).applyQuaternion(cumulativeRot));
                zDrift += i * secondaryRise;
            }
            const theta1 = pStep > 0 ? (i / pStep) * Math.PI * 2 : 0;
            const axisVec = (tStep > 0 || sStep > 0) ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
            const q1 = new Quaternion().setFromAxisAngle(axisVec, theta1);
            cumulativeRot.multiply(q1);
            pos.add(new Vector3(r1, 0, 0).applyQuaternion(cumulativeRot));
            zDrift += i * primaryRise;
            pos.add(new Vector3(0, 0, zDrift));

            const node = addNode(vec, 0, axis, null, pos);
            if (node) {
                nodeRotations.set(node.id, cumulativeRot);
                if (i === 0) rootId = node.id;
                const prevVec = { ...vec };
                prevVec[axis] = i - 1;
                const prevNodeId = getId(prevVec);
                if (nodes.has(prevNodeId)) addEdge(prevNodeId, node.id, axis, 0);
            }
        }

        const gen1Primes = primesUpTo(resolveGenLimit(1, settings.maxPrimeLimit), settings.gen1PrimeSet);
        const gen2Primes = primesUpTo(resolveGenLimit(2, settings.maxPrimeLimit), settings.gen2PrimeSet);
        const axisNodes = Array.from(nodes.values()).filter(n => n.gen === 0).map(n => ({ id: n.id, vec: n.primeVector, originLimit: axis }));

        const gen1Nodes: { id: string, vec: any, originLimit: number }[] = [];
        axisNodes.forEach(axNode => {
            gen1Primes.forEach(limit => {
                if (limit === axis) return;
                const len = spiralGen1Len;
                if (len <= 0) return;
                let prevId = axNode.id;
                for (let i = 1; i <= len; i++) {
                    const vPos = { ...axNode.vec, [limit]: (axNode.vec[limit] || 0) + i };
                    const node = addNode(vPos, 1, limit, prevId);
                    if (node) {
                        addEdge(prevId, node.id, limit, 1);
                        gen1Nodes.push({ id: node.id, vec: vPos, originLimit: limit });
                        prevId = node.id;
                    }
                }
                prevId = axNode.id;
                for (let i = 1; i <= len; i++) {
                    const vNeg = { ...axNode.vec, [limit]: (axNode.vec[limit] || 0) - i };
                    const node = addNode(vNeg, 1, limit, prevId);
                    if (node) {
                        addEdge(prevId, node.id, limit, 1);
                        gen1Nodes.push({ id: node.id, vec: vNeg, originLimit: limit });
                        prevId = node.id;
                    }
                }
            });
        });

        if (spiralGen2Len > 0) {
            gen1Nodes.forEach(src => {
                gen2Primes.forEach(limit => {
                    if (limit === src.originLimit) return;
                    let prevId = src.id;
                    for (let i = 1; i <= spiralGen2Len; i++) {
                        const vPos = { ...src.vec, [limit]: (src.vec[limit] || 0) + i };
                        const node = addNode(vPos, 2, limit, prevId);
                        if (node) { addEdge(prevId, node.id, limit, 2); prevId = node.id; }
                    }
                    prevId = src.id;
                    for (let i = 1; i <= spiralGen2Len; i++) {
                        const vNeg = { ...src.vec, [limit]: (src.vec[limit] || 0) - i };
                        const node = addNode(vNeg, 2, limit, prevId);
                        if (node) { addEdge(prevId, node.id, limit, 2); prevId = node.id; }
                    }
                });
            });
        }
        return { nodes: Array.from(nodes.values()), edges: edges };
    }

    const curvedConfig = settings.curvedGeometry;
    const curvedEnabled = !!curvedConfig?.enabled;

    const mainRootConfig: OriginConfig = {
        id: "root",
        name: "Global Root",
        primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
        rootLimits: settings.rootLimits || [3],
        gen0MaxDisplayLength: settings.gen0MaxDisplayLength,
        gen0CustomizeEnabled: settings.gen0CustomizeEnabled,
        expansionA: settings.expansionA,
        gen0Lengths: settings.gen0Lengths,
        gen0Ranges: settings.gen0Ranges || {},
        expansionB: settings.expansionB,
        gen1Lengths: settings.gen1Lengths,
        gen1Ranges: settings.gen1Ranges || {},
        gen2Lengths: settings.gen2Lengths,
        gen2Ranges: settings.gen2Ranges || {},
        gen3Lengths: settings.gen3Lengths,
        gen3Ranges: settings.gen3Ranges || {},
        gen4Lengths: settings.gen4Lengths,
        gen4Ranges: settings.gen4Ranges || {},
        expansionC: effExpansionC,
        expansionD: effExpansionD,
        expansionE: effExpansionE,
        maxPrimeLimit: settings.maxPrimeLimit,
        gen1MaxPrimeLimit: settings.gen1MaxPrimeLimit,
        gen2MaxPrimeLimit: settings.gen2MaxPrimeLimit,
        gen3MaxPrimeLimit: settings.gen3MaxPrimeLimit,
        gen4MaxPrimeLimit: settings.gen4MaxPrimeLimit,
        gen1PrimeSet: settings.gen1PrimeSet,
        gen2PrimeSet: settings.gen2PrimeSet,
        gen3PrimeSet: settings.gen3PrimeSet,
        gen4PrimeSet: settings.gen4PrimeSet,
        axisLooping: settings.axisLooping,
        commaSpreadingEnabled: settings.commaSpreadingEnabled,
        loopTolerance: settings.loopTolerance
    };

    const configurations = [mainRootConfig, ...(secondaryOrigins || [])];

    configurations.forEach(config => {
        if (!config) return;
        const {
            rootLimits,
            gen0Lengths,
            gen0Ranges,
            gen1Lengths,
            gen1Ranges,
            gen2Lengths,
            gen2Ranges,
            gen3Lengths,
            gen3Ranges,
            gen4Lengths,
            gen4Ranges,
            expansionA,
            expansionB,
            expansionC,
            expansionD,
            expansionE,
            maxPrimeLimit,
            primeVector: originVec,
            gen0CustomizeEnabled,
            axisLooping: configAxisLooping,
            commaSpreadingEnabled: configCommaSpreadingEnabled,
            gen1PrimeSet: configGen1PrimeSet,
            gen2PrimeSet: configGen2PrimeSet,
            gen3PrimeSet: configGen3PrimeSet,
            gen4PrimeSet: configGen4PrimeSet
        } = config;
        if (!originVec) return;
        const gen0Customize = gen0CustomizeEnabled ?? settings.gen0CustomizeEnabled ?? true;
        activeAxisLooping = configAxisLooping ?? settings.axisLooping;
        activeCommaSpreadingEnabled = configCommaSpreadingEnabled ?? settings.commaSpreadingEnabled;
        const gen1PrimeSet = configGen1PrimeSet ?? settings.gen1PrimeSet;
        const gen2PrimeSet = configGen2PrimeSet ?? settings.gen2PrimeSet;
        const gen3PrimeSet = configGen3PrimeSet ?? settings.gen3PrimeSet;
        const gen4PrimeSet = configGen4PrimeSet ?? settings.gen4PrimeSet;
        const gen1Limit = resolveGenLimit(1, maxPrimeLimit, config);
        const gen2Limit = resolveGenLimit(2, maxPrimeLimit, config);
        const gen3Limit = resolveGenLimit(3, maxPrimeLimit, config);
        const gen4Limit = resolveGenLimit(4, maxPrimeLimit, config);
        const gen1Primes = primesUpTo(gen1Limit, gen1PrimeSet);
        const gen2Primes = primesUpTo(gen2Limit, gen2PrimeSet);
        const gen3Primes = primesUpTo(gen3Limit, gen3PrimeSet);
        const gen4Primes = primesUpTo(gen4Limit, gen4PrimeSet);
        const rawLimits = rootLimits && rootLimits.length > 0 ? rootLimits : [3];
        let limitsToUse = rawLimits;
        if (curvedEnabled) {
            limitsToUse = rawLimits.filter((limit) => Math.abs(Number(limit)) % 2 === 1);
            if (limitsToUse.length === 0) {
                limitsToUse = [3];
            }
        }
        const axisNodes: { id: string, vec: any, originLimit: number }[] = [];
        const rootNode = addNode(originVec, 0, 0, null);
        if (rootNode) axisNodes.push({ id: rootNode.id, vec: originVec, originLimit: 0 });
        else return;

        limitsToUse.forEach(limit => {
            let lenNeg = expansionA;
            let lenPos = expansionA;
            const explicitZero = (gen0Lengths && gen0Lengths[limit] === 0)
                || (gen0Ranges && gen0Ranges[limit] && gen0Ranges[limit]!.neg === 0 && gen0Ranges[limit]!.pos === 0);

            if (gen0Customize !== false) {
                if (gen0Lengths && gen0Lengths[limit] !== undefined) {
                    lenNeg = gen0Lengths[limit]!;
                    lenPos = gen0Lengths[limit]!;
                }

                if (!explicitZero && activeAxisLooping && activeAxisLooping[limit as PrimeLimit] && activeAxisLooping[limit as PrimeLimit]! > 0) {
                    const loopLen = activeAxisLooping[limit as PrimeLimit]!;
                    lenNeg = Math.floor(loopLen);
                    lenPos = Math.ceil(loopLen);
                } else if (gen0Ranges && gen0Ranges[limit]) {
                    lenNeg = gen0Ranges[limit]!.neg;
                    lenPos = gen0Ranges[limit]!.pos;
                }
            }
            lenNeg = Math.max(0, lenNeg);
            lenPos = Math.max(0, lenPos);
            if (lenNeg <= 0 && lenPos <= 0) return;
            let prevId = rootNode.id;
            for (let i = 1; i <= lenPos; i++) {
                const vPos = { ...originVec, [limit]: (originVec[limit] || 0) + i };
                const node = addNode(vPos, 0, limit as PrimeLimit, prevId);
                if (node) {
                    addEdge(prevId, node.id, limit as PrimeLimit, 0);
                    axisNodes.push({ id: node.id, vec: vPos, originLimit: limit });
                    prevId = node.id;
                }
            }
            prevId = rootNode.id;
            for (let i = 1; i <= lenNeg; i++) {
                const vNeg = { ...originVec, [limit]: (originVec[limit] || 0) - i };
                const node = addNode(vNeg, 0, limit as PrimeLimit, prevId);
                if (node) {
                    addEdge(prevId, node.id, limit as PrimeLimit, 0);
                    axisNodes.push({ id: node.id, vec: vNeg, originLimit: limit });
                    prevId = node.id;
                }
            }
        });

        const clampOverride = (value: number | undefined) => {
            if (!Number.isFinite(value)) return 0;
            return Math.max(0, Math.min(50, Math.floor(value as number)));
        };

        const getAxisOverrideLimits = (nodeId: string) => {
            const override = settings.geometry?.nodeBranchOverrides?.[nodeId];
            if (!override?.axisOverrides) return [];
            const limits = Object.keys(override.axisOverrides)
                .map(k => parseInt(k, 10))
                .filter(n => Number.isFinite(n)) as PrimeLimit[];
            return limits;
        };

        // Helper to check for overrides (with optional axis-specific overrides)
        const getEffectiveLengths = (nodeId: string, limit: PrimeLimit, defaultPos: number, defaultNeg: number) => {
            if ((settings.geometry as any)?.ignoreOverrides) return { pos: defaultPos, neg: defaultNeg, hasAxisOverride: false };
            const override = settings.geometry?.nodeBranchOverrides?.[nodeId];
            if (!override) return { pos: defaultPos, neg: defaultNeg, hasAxisOverride: false };

            const axisOverride = override.axisOverrides?.[limit];
            if (axisOverride) {
                const pos = axisOverride.pos !== undefined ? clampOverride(axisOverride.pos) : defaultPos;
                const neg = axisOverride.neg !== undefined ? clampOverride(axisOverride.neg) : defaultNeg;
                return { pos, neg, hasAxisOverride: true };
            }

            const pos = override.pos !== undefined ? clampOverride(override.pos) : defaultPos;
            const neg = override.neg !== undefined ? clampOverride(override.neg) : defaultNeg;
            return { pos, neg, hasAxisOverride: false };
        };

        const mergeAxisLimits = (base: PrimeLimit[], extras: PrimeLimit[]) => {
            if (!extras.length) return base;
            const merged = new Set<PrimeLimit>(base);
            extras.forEach(l => merged.add(l));
            return Array.from(merged).sort((a, b) => a - b);
        };

        const gen1Nodes: { id: string, vec: any, originLimit: number }[] = [];
        const gen1PrimesForSheet = gen1Primes as PrimeLimit[];
        const gen2PrimesForSheet = gen2Primes as PrimeLimit[];
        const gen3PrimesForSheet = gen3Primes as PrimeLimit[];
        const gen4PrimesForSheet = gen4Primes as PrimeLimit[];
        axisNodes.forEach(axNode => {
            const axisExtras = getAxisOverrideLimits(axNode.id);
            const axisLimits = mergeAxisLimits(gen1PrimesForSheet, axisExtras);
            axisLimits.forEach(limit => {
                let lenNegDef = gen1Lengths ? (gen1Lengths[limit] ?? expansionB) : expansionB;
                let lenPosDef = lenNegDef;
                if (gen1Ranges && gen1Ranges[limit]) {
                    lenNegDef = gen1Ranges[limit]!.neg;
                    lenPosDef = gen1Ranges[limit]!.pos;
                }

                // APPLY OVERRIDE
                const { pos: lenPos, neg: lenNeg, hasAxisOverride } = getEffectiveLengths(axNode.id, limit, lenPosDef, lenNegDef);

                if (axNode.originLimit === 0) {
                    if (limitsToUse.includes(limit) && !hasAxisOverride) return;
                } else {
                    if (limit === axNode.originLimit && !hasAxisOverride) return;
                }

                if (lenPos <= 0 && lenNeg <= 0) return;

                let prevId = axNode.id;
                for (let i = 1; i <= lenPos; i++) {
                    const vPos = { ...axNode.vec, [limit]: (axNode.vec[limit] || 0) + i };
                    const node = addNode(vPos, 1, limit as PrimeLimit, prevId);
                    if (node) {
                        addEdge(prevId, node.id, limit as PrimeLimit, 1);
                        gen1Nodes.push({ id: node.id, vec: vPos, originLimit: limit });
                        prevId = node.id;
                    }
                }
                prevId = axNode.id;
                for (let i = 1; i <= lenNeg; i++) {
                    const vNeg = { ...axNode.vec, [limit]: (axNode.vec[limit] || 0) - i };
                    const node = addNode(vNeg, 1, limit as PrimeLimit, prevId);
                    if (node) {
                        addEdge(prevId, node.id, limit as PrimeLimit, 1);
                        gen1Nodes.push({ id: node.id, vec: vNeg, originLimit: limit });
                        prevId = node.id;
                    }
                }
            });
        });

        const gen2Nodes: { id: string, vec: any, originLimit: number }[] = [];
        const hasCustomGen2 = gen2Lengths && Object.keys(gen2Lengths).length > 0;

        // Re-structure to always potentially process Gen2 if override exists or if standard config exists
        // But to keep it efficient and minimal change, we iterate if standard condition met OR we can iterate blindly but check length
        // To be safe/simple: We'll iterate gen1Nodes and check lengths individually.

        gen1Nodes.forEach(src => {
            const axisExtras = getAxisOverrideLimits(src.id);
            const axisLimits = mergeAxisLimits(gen2PrimesForSheet, axisExtras);
            const isStandardSrc = gen1PrimesForSheet.includes(src.originLimit as PrimeLimit);

            axisLimits.forEach(limit => {

                let lenNegDef = isStandardSrc ? expansionC : 0;
                let lenPosDef = isStandardSrc ? expansionC : 0;

                if (gen2Lengths && gen2Lengths[src.originLimit] && gen2Lengths[src.originLimit]![limit] !== undefined) {
                    const specificLen = gen2Lengths[src.originLimit]![limit]!;
                    lenNegDef = specificLen;
                    lenPosDef = specificLen;

                    if (gen2Ranges && gen2Ranges[src.originLimit] && gen2Ranges[src.originLimit]![limit]) {
                        lenNegDef = gen2Ranges[src.originLimit]![limit]!.neg;
                        lenPosDef = gen2Ranges[src.originLimit]![limit]!.pos;
                    }
                }

                // APPLY OVERRIDE
                const { pos: lenPos, neg: lenNeg, hasAxisOverride } = getEffectiveLengths(src.id, limit, lenPosDef, lenNegDef);

                if (limit === src.originLimit && !hasAxisOverride) return;

                if (lenPos <= 0 && lenNeg <= 0) return;

                let prevIdPos = src.id;
                for (let i = 1; i <= lenPos; i++) {
                    const vPos = { ...src.vec, [limit]: (src.vec[limit] || 0) + i };
                    const node = addNode(vPos, 2, limit as PrimeLimit, prevIdPos);
                    if (node) {
                        addEdge(prevIdPos, node.id, limit as PrimeLimit, 2);
                        gen2Nodes.push({ id: node.id, vec: vPos, originLimit: limit });
                        prevIdPos = node.id;
                    }
                }
                let prevIdNeg = src.id;
                for (let i = 1; i <= lenNeg; i++) {
                    const vNeg = { ...src.vec, [limit]: (src.vec[limit] || 0) - i };
                    const node = addNode(vNeg, 2, limit as PrimeLimit, prevIdNeg);
                    if (node) {
                        addEdge(prevIdNeg, node.id, limit as PrimeLimit, 2);
                        gen2Nodes.push({ id: node.id, vec: vNeg, originLimit: limit });
                        prevIdNeg = node.id;
                    }
                }
            });
        });


        const expandNodes = (
            sourceNodes: { id: string, vec: any, originLimit: number }[],
            gen: number,
            defaultLength: number,
            primesForGen: PrimeLimit[],
            primesForPrevGen: PrimeLimit[]
        ) => {
            const targetList: { id: string, vec: any, originLimit: number }[] = [];
            sourceNodes.forEach(src => {
                const axisExtras = getAxisOverrideLimits(src.id);
                const axisLimits = mergeAxisLimits(primesForGen, axisExtras);
                const isStandardSrc = primesForPrevGen.includes(src.originLimit as PrimeLimit);

                axisLimits.forEach(limit => {
                    // APPLY OVERRIDE
                    // If src is non-standard, default length becomes 0 unless overridden
                    const effectiveDefault = isStandardSrc ? defaultLength : 0;
                    const { pos: lenPos, neg: lenNeg, hasAxisOverride } = getEffectiveLengths(src.id, limit, effectiveDefault, effectiveDefault);

                    // Retrieve custom curve if present
                    const override = (settings.geometry?.nodeBranchOverrides?.[src.id]?.axisOverrides?.[limit] as any);
                    const customCurve = override?.customCurve?.points;

                    if (limit === src.originLimit && !hasAxisOverride) return;
                    if (lenPos <= 0 && lenNeg <= 0) return;

                    // Helper to calculate custom position
                    const getCustomPos = (basePos: Vector3, i: number, maxLen: number, direction: 'pos' | 'neg') => {
                        if (!customCurve || customCurve.length < 2) return null;

                        // Normalized progress (0 to 1) along the branch
                        const t = i / Math.max(1, maxLen);

                        // Find points surrounding t
                        // Sort points by X just in case
                        // Assuming X is 0..1

                        // Simple linear interpolation
                        // This logic assumes canvas X represents progress along axis
                        // Canvas Y represents deviation

                        // Find p1, p2 where p1.x <= t <= p2.x
                        const sorted = customCurve.sort((a: any, b: any) => a.x - b.x);
                        let p1 = sorted[0];
                        let p2 = sorted[sorted.length - 1];

                        for (let k = 0; k < sorted.length - 1; k++) {
                            if (sorted[k].x <= t && sorted[k + 1].x >= t) {
                                p1 = sorted[k];
                                p2 = sorted[k + 1];
                                break;
                            }
                        }

                        const range = p2.x - p1.x;
                        const localT = range === 0 ? 0 : (t - p1.x) / range;

                        // Interpolated Y (-1 to 1 based on canvas)
                        const interpolatedY = p1.y + (p2.y - p1.y) * localT;

                        // Map to 3D
                        // Base vector is standard axis
                        // Deviation vector is... "Up"?
                        const spacing = settings.visuals?.primeSpacings?.[limit as PrimeLimit] || 1.0;
                        const dist = UNIT_DISTANCE * settings.visuals!.globalScale * spacing;

                        const axisVec = getPrimeAxis(limit as PrimeLimit).normalize();
                        // Determine an 'up' vector for deviation. 
                        // Cross with Y? If axis is Y, cross with X?
                        let up = new Vector3(0, 1, 0);
                        if (Math.abs(axisVec.dot(up)) > 0.9) up.set(1, 0, 0);
                        const deviationVec = new Vector3().crossVectors(axisVec, up).normalize();

                        // Directionality
                        const forward = axisVec.clone().multiplyScalar((direction === 'pos' ? 1 : -1) * i * dist);

                        // Deviation scale? Arbitrary multiplier for visual effect
                        const deviationScale = dist * 5; // e.g. 5 steps wide deviation?
                        const deviation = deviationVec.clone().multiplyScalar(interpolatedY * deviationScale);

                        return basePos.clone().add(forward).add(deviation);
                    };

                    let prevIdPos = src.id;
                    for (let i = 1; i <= lenPos; i++) {
                        const vPos = { ...src.vec, [limit]: (src.vec[limit] || 0) + i };
                        const customPos = getCustomPos(nodes.get(src.id)!.position, i, lenPos, 'pos');

                        const node = addNode(vPos, gen, limit as PrimeLimit, prevIdPos, customPos || undefined);
                        if (node) {
                            addEdge(prevIdPos, node.id, limit as PrimeLimit, gen);
                            targetList.push({ id: node.id, vec: vPos, originLimit: limit });
                            prevIdPos = node.id;
                        }
                    }
                    let prevIdNeg = src.id;
                    for (let i = 1; i <= lenNeg; i++) {
                        const vNeg = { ...src.vec, [limit]: (src.vec[limit] || 0) - i };
                        // Note: Custom curve logic for negative side? 
                        // Typically curve draws "forward". For negative, we might invert?
                        // For now mirror the visual deviation but go negative on axis
                        const customPos = getCustomPos(nodes.get(src.id)!.position, i, lenNeg, 'neg');

                        const node = addNode(vNeg, gen, limit as PrimeLimit, prevIdNeg, customPos || undefined);
                        if (node) {
                            addEdge(prevIdNeg, node.id, limit as PrimeLimit, gen);
                            targetList.push({ id: node.id, vec: vNeg, originLimit: limit });
                            prevIdNeg = node.id;
                        }
                    }
                });
            });
            return targetList;
        };

        let currentNodes = gen2Nodes;
        for (let gen = 3; gen <= 20; gen++) {
            if (currentNodes.length === 0) break;
            const defaultLength = gen === 3 ? expansionD : gen === 4 ? expansionE : 0;
            const primesForGen = gen <= 3 ? gen3PrimesForSheet : gen4PrimesForSheet;
            const primesForPrevGen = gen === 3 ? gen2PrimesForSheet : (gen === 4 ? gen3PrimesForSheet : gen4PrimesForSheet);

            const nextNodes = expandNodes(currentNodes, gen, defaultLength, primesForGen, primesForPrevGen);
            currentNodes = nextNodes;
        }
    });


    let finalNodes = Array.from(nodes.values());
    let finalEdges = edges;

    if (settings.deduplicateNodes) {
        finalNodes.sort((a, b) => {
            for (const criterion of settings.priorityOrder) {
                if (criterion === 'gen') {
                    if (a.gen !== b.gen) return a.gen - b.gen;
                } else if (criterion === 'limit') {
                    if (a.originLimit !== b.originLimit) return a.originLimit - b.originLimit;
                } else if (criterion === 'origin') {
                    const distA = a.position.lengthSq();
                    const distB = b.position.lengthSq();
                    if (Math.abs(distA - distB) > 0.1) return distA - distB;
                }
            }
            return 0;
        });

        const mergedMap = new Map<string, string>();
        const keptNodes: NodeData[] = [];
        const buckets = new Map<number, NodeData[]>();
        const tolerance = settings.deduplicationTolerance;
        const getBucket = (cents: number) => Math.floor(((cents % 1200) + 1200) % 1200 / tolerance);

        for (const node of finalNodes) {
            const cents = node.cents;
            const bucketId = getBucket(cents);
            let match: NodeData | null = null;
            const maxBucket = Math.floor(1199.99 / tolerance);
            const candidatesToCheck = [bucketId];
            if (bucketId === 0) candidatesToCheck.push(maxBucket); else candidatesToCheck.push(bucketId - 1);
            if (bucketId === maxBucket) candidatesToCheck.push(0); else candidatesToCheck.push(bucketId + 1);
            for (const bid of candidatesToCheck) {
                const bucket = buckets.get(bid);
                if (bucket) {
                    for (const existing of bucket) {
                        if (getPitchClassDistance(node.cents, existing.cents) <= tolerance) {
                            match = existing;
                            break;
                        }
                    }
                }
                if (match) break;
            }
            if (match) mergedMap.set(node.id, match.id);
            else {
                mergedMap.set(node.id, node.id);
                keptNodes.push(node);
                if (!buckets.has(bucketId)) buckets.set(bucketId, []);
                buckets.get(bucketId)!.push(node);
            }
        }

        const uniqueEdges = new Map<string, EdgeData>();
        for (const edge of finalEdges) {
            const src = mergedMap.get(edge.sourceId);
            const tgt = mergedMap.get(edge.targetId);
            if (src && tgt && src !== tgt) {
                const sorted = [src, tgt].sort().join('|');
                const dedupKey = `${sorted}|${edge.limit}|${edge.gen}`;
                if (!uniqueEdges.has(dedupKey)) {
                    uniqueEdges.set(dedupKey, { ...edge, sourceId: src, targetId: tgt });
                }
            }
        }
        finalNodes = keptNodes;
        finalEdges = Array.from(uniqueEdges.values());
    }
    if (settings.maskedNodeIds && settings.maskedNodeIds.length > 0) {
        const maskSet = new Set(settings.maskedNodeIds);
        finalNodes = finalNodes.filter(n => !maskSet.has(n.id));
        const nodeSet = new Set(finalNodes.map(n => n.id));
        finalEdges = finalEdges.filter(e => nodeSet.has(e.sourceId) && nodeSet.has(e.targetId));
    }

    if (curvedEnabled && curvedConfig) {
        finalNodes = applyCurvedGeometry(finalNodes, settings, curvedConfig);
    }

    return { nodes: finalNodes, edges: finalEdges };
};
