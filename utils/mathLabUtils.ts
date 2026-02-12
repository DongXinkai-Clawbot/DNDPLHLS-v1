
import type { MathObject } from '../types';
import { evalScalarWithComplex, evalVector, buildMathContext, preprocessExpression } from './math/unifiedEvaluator';

export interface SamplePoint {
    u: number; 
    x: number;
    y: number;
    valid: boolean;
    raw: any;
    segmentId?: number;
}

export interface SampleMeta {
    validCount: number;
    invalidCount: number;
    complexCount: number;
}

export interface SampleResult {
    points: SamplePoint[];
    segments?: SamplePoint[][];
    meta: SampleMeta;
}

const evaluateScalar = (
    expr: string,
    context: Record<string, number>,
    complexComponent: 're' | 'im' | 'abs' | 'arg' = 'abs'
) => {
    const fullContext = buildMathContext(context);
    return evalScalarWithComplex(expr, fullContext, complexComponent);
};

export const sampleExplicit = (
    obj: MathObject,
    count: number,
    opts?: { bindings?: Record<string, number>; complexComponent?: 're' | 'im' | 'abs' | 'arg' }
): SampleResult => {
    const points: SamplePoint[] = [];
    const { min, max } = obj.params;
    const step = (max - min) / Math.max(1, count - 1);
    const bindings = opts?.bindings || {};
    const complexComponent = opts?.complexComponent || 'abs';
	// Enable the app's advanced symbol preprocessor for the grapher so inputs like "π", "√",
	// "∫" etc work exactly as users expect.
	const expr = preprocessExpression(obj.expression, true).processed;
    let validCount = 0;
    let invalidCount = 0;
    let complexCount = 0;

    for (let i = 0; i < count; i++) {
        const x = min + i * step;
		const res = evaluateScalar(expr, { ...bindings, x }, complexComponent);
        if (res.isValid) {
            if (res.isComplex) complexCount++;
            validCount++;
        } else {
            invalidCount++;
        }
        points.push({ u: x, x: x, y: res.value, valid: res.isValid, raw: res.raw });
    }
    return { points, meta: { validCount, invalidCount, complexCount } };
};

export const sampleParametric = (
    obj: MathObject,
    count: number,
    opts?: { bindings?: Record<string, number>; complexComponent?: 're' | 'im' | 'abs' | 'arg' }
): SampleResult => {
    const points: SamplePoint[] = [];
    const { min, max } = obj.params;
    const step = (max - min) / Math.max(1, count - 1);
    const bindings = opts?.bindings || {};
    const complexComponent = opts?.complexComponent || 'abs';
    let validCount = 0;
    let invalidCount = 0;
	let complexCount = 0;
	const expr = preprocessExpression(obj.expression, true).processed;
    
    for (let i = 0; i < count; i++) {
        const t = min + i * step;
        
        const fullContext = buildMathContext({ ...bindings, t });
		const res = evalVector(expr, fullContext, complexComponent);
        if (res.isValid) {
            if (res.isComplex) complexCount++;
            validCount++;
        }
        else invalidCount++;
        
        points.push({ u: t, x: res.x, y: res.y, valid: res.isValid, raw: [res.x, res.y] });
    }
    return { points, meta: { validCount, invalidCount, complexCount } };
};

export const samplePolar = (
    obj: MathObject,
    count: number,
    opts?: { bindings?: Record<string, number>; complexComponent?: 're' | 'im' | 'abs' | 'arg' }
): SampleResult => {
    const points: SamplePoint[] = [];
    const { min, max } = obj.params;
    const step = (max - min) / Math.max(1, count - 1);
    const bindings = opts?.bindings || {};
    const complexComponent = opts?.complexComponent || 'abs';
    let validCount = 0;
    let invalidCount = 0;
	let complexCount = 0;
	const expr = preprocessExpression(obj.expression, true).processed;

    for (let i = 0; i < count; i++) {
        const thetaRaw = min + i * step;
        const theta = obj.angleUnit === 'deg' ? (thetaRaw * Math.PI / 180) : thetaRaw;
		const res = evaluateScalar(expr, { ...bindings, theta }, complexComponent);
        let r = res.isValid ? res.value : 0;
        if (obj.polarNegativeMode === 'clamp' && r < 0) {
            r = 0;
        }
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        if (res.isValid) {
            if (res.isComplex) complexCount++;
            validCount++;
        } else {
            invalidCount++;
        }
        points.push({ u: thetaRaw, x, y, valid: res.isValid, raw: r });
    }
    return { points, meta: { validCount, invalidCount, complexCount } };
};

export const sampleImplicit = (
    obj: MathObject,
    viewX: [number, number],
    viewY: [number, number],
    resolution: number = 50,
    opts?: { bindings?: Record<string, number>; complexComponent?: 're' | 'im' | 'abs' | 'arg' }
): SampleResult => {
    const segments: SamplePoint[][] = [];
    const dx = (viewX[1] - viewX[0]) / Math.max(1, resolution);
    const dy = (viewY[1] - viewY[0]) / Math.max(1, resolution);
    const bindings = opts?.bindings || {};
	const complexComponent = opts?.complexComponent || 'abs';
	const expr = preprocessExpression(obj.expression, true).processed;

    let validCount = 0;
    let invalidCount = 0;
    let complexCount = 0;

    const F = (x: number, y: number) => {
		const res = evaluateScalar(expr, { ...bindings, x, y }, complexComponent);
        if (res.isValid) {
            if (res.isComplex) complexCount++;
            validCount++;
            return res.value;
        }
        invalidCount++;
        return NaN;
    };

    const getEdgePoint = (edge: number, x0: number, y0: number, x1: number, y1: number, v0: number, v1: number) => {
        const denom = v0 - v1;
        const t = denom === 0 ? 0.5 : v0 / denom;
        const cx = x0 + (x1 - x0) * t;
        const cy = y0 + (y1 - y0) * t;
        return { u: 0, x: cx, y: cy, valid: true, raw: 0 } as SamplePoint;
    };

    type Segment = [SamplePoint, SamplePoint];
    const rawSegments: Segment[] = [];

    for (let j = 0; j < resolution; j++) {
        const y0 = viewY[0] + j * dy;
        const y1 = y0 + dy;
        for (let i = 0; i < resolution; i++) {
            const x0 = viewX[0] + i * dx;
            const x1 = x0 + dx;
            const v0 = F(x0, y0);
            const v1 = F(x1, y0);
            const v2 = F(x1, y1);
            const v3 = F(x0, y1);
            if (!Number.isFinite(v0) || !Number.isFinite(v1) || !Number.isFinite(v2) || !Number.isFinite(v3)) continue;
            const s0 = v0 >= 0 ? 1 : 0;
            const s1 = v1 >= 0 ? 1 : 0;
            const s2 = v2 >= 0 ? 1 : 0;
            const s3 = v3 >= 0 ? 1 : 0;
            const idx = s0 | (s1 << 1) | (s2 << 2) | (s3 << 3);

            const edge = (e: number) => {
                switch (e) {
                    case 0: return getEdgePoint(e, x0, y0, x1, y0, v0, v1); // bottom
                    case 1: return getEdgePoint(e, x1, y0, x1, y1, v1, v2); // right
                    case 2: return getEdgePoint(e, x1, y1, x0, y1, v2, v3); // top
                    case 3: return getEdgePoint(e, x0, y1, x0, y0, v3, v0); // left
                    default: return { u: 0, x: x0, y: y0, valid: true, raw: 0 };
                }
            };

            const centerVal = (v0 + v1 + v2 + v3) / 4;
            switch (idx) {
                case 0:
                case 15:
                    break;
                case 1:
                    rawSegments.push([edge(3), edge(0)]);
                    break;
                case 2:
                    rawSegments.push([edge(0), edge(1)]);
                    break;
                case 3:
                    rawSegments.push([edge(3), edge(1)]);
                    break;
                case 4:
                    rawSegments.push([edge(1), edge(2)]);
                    break;
                case 5:
                    if (centerVal >= 0) {
                        rawSegments.push([edge(3), edge(0)]);
                        rawSegments.push([edge(1), edge(2)]);
                    } else {
                        rawSegments.push([edge(3), edge(2)]);
                        rawSegments.push([edge(0), edge(1)]);
                    }
                    break;
                case 6:
                    rawSegments.push([edge(0), edge(2)]);
                    break;
                case 7:
                    rawSegments.push([edge(3), edge(2)]);
                    break;
                case 8:
                    rawSegments.push([edge(2), edge(3)]);
                    break;
                case 9:
                    rawSegments.push([edge(0), edge(2)]);
                    break;
                case 10:
                    if (centerVal >= 0) {
                        rawSegments.push([edge(0), edge(1)]);
                        rawSegments.push([edge(2), edge(3)]);
                    } else {
                        rawSegments.push([edge(3), edge(0)]);
                        rawSegments.push([edge(1), edge(2)]);
                    }
                    break;
                case 11:
                    rawSegments.push([edge(1), edge(2)]);
                    break;
                case 12:
                    rawSegments.push([edge(3), edge(1)]);
                    break;
                case 13:
                    rawSegments.push([edge(0), edge(1)]);
                    break;
                case 14:
                    rawSegments.push([edge(3), edge(0)]);
                    break;
                default:
                    break;
            }
        }
    }

    const eps = Math.max(dx, dy) * 0.01;
    const keyFor = (p: SamplePoint) => `${Math.round(p.x / eps)}:${Math.round(p.y / eps)}`;
    const endpointMap = new Map<string, { segIdx: number; end: 0 | 1 }[]>();
    rawSegments.forEach((seg, idx) => {
        const k1 = keyFor(seg[0]);
        const k2 = keyFor(seg[1]);
        if (!endpointMap.has(k1)) endpointMap.set(k1, []);
        if (!endpointMap.has(k2)) endpointMap.set(k2, []);
        endpointMap.get(k1)!.push({ segIdx: idx, end: 0 });
        endpointMap.get(k2)!.push({ segIdx: idx, end: 1 });
    });

    const used = new Set<number>();
    const consumeNext = (point: SamplePoint, forward: boolean) => {
        const k = keyFor(point);
        const list = endpointMap.get(k) || [];
        for (const item of list) {
            if (used.has(item.segIdx)) continue;
            const seg = rawSegments[item.segIdx];
            used.add(item.segIdx);
            const nextPoint = item.end === 0 ? seg[1] : seg[0];
            return nextPoint;
        }
        return null;
    };

    for (let i = 0; i < rawSegments.length; i++) {
        if (used.has(i)) continue;
        used.add(i);
        const seg = rawSegments[i];
        const line: SamplePoint[] = [seg[0], seg[1]];

        let next = consumeNext(line[line.length - 1], true);
        while (next) {
            line.push(next);
            next = consumeNext(line[line.length - 1], true);
        }

        let prev = consumeNext(line[0], false);
        while (prev) {
            line.unshift(prev);
            prev = consumeNext(line[0], false);
        }

        segments.push(line);
    }

    segments.forEach((seg, idx) => {
        seg.forEach(p => {
            p.segmentId = idx;
        });
    });
    const points = segments.flat();
    return { points, segments, meta: { validCount, invalidCount, complexCount } };
};

export const sampleObject = (
    obj: MathObject,
    count: number,
    view: { xMin: number, xMax: number, yMin: number, yMax: number },
    opts?: { bindings?: Record<string, number>; complexComponent?: 're' | 'im' | 'abs' | 'arg'; implicitResolution?: number; strategy?: 'uniform_x' | 'uniform_param' | 'arc_length' | 'adaptive_pixel' | 'adaptive_curvature' }
): SampleResult => {
    if (!obj.visible) return { points: [], meta: { validCount: 0, invalidCount: 0, complexCount: 0 } };
    
    switch (obj.type) {
        case 'explicit': {
            const res = sampleExplicit(obj, count, opts);
            if (opts?.strategy === 'arc_length' || opts?.strategy === 'adaptive_curvature') {
                return { ...res, points: resampleByArcLength(res.points, count) };
            }
            return res;
        }
        case 'parametric': {
            const res = sampleParametric(obj, count, opts);
            if (opts?.strategy === 'arc_length' || opts?.strategy === 'adaptive_curvature') {
                return { ...res, points: resampleByArcLength(res.points, count) };
            }
            return res;
        }
        case 'polar': {
            const res = samplePolar(obj, count, opts);
            if (opts?.strategy === 'arc_length' || opts?.strategy === 'adaptive_curvature') {
                return { ...res, points: resampleByArcLength(res.points, count) };
            }
            return res;
        }
        case 'implicit': {
            const resolution = Math.max(10, Math.round(opts?.implicitResolution ?? Math.sqrt(count)));
            return sampleImplicit(obj, [view.xMin, view.xMax], [view.yMin, view.yMax], resolution, opts);
        }
        case 'point':
            const res = evaluateScalar(obj.expression, opts?.bindings || {}, opts?.complexComponent || 'abs');
            if(res.isValid) return { points: [{ u: 0, x: res.value, y: 0, valid: true, raw: res.value }], meta: { validCount: 1, invalidCount: 0, complexCount: res.isComplex ? 1 : 0 } }; 
            
            const vRes = evalVector(obj.expression, buildMathContext({ ...(opts?.bindings || {}) }));
            if(vRes.isValid) return { points: [{ u: 0, x: vRes.x, y: vRes.y, valid: true, raw: [vRes.x, vRes.y] }], meta: { validCount: 1, invalidCount: 0, complexCount: 0 } };
            return { points: [], meta: { validCount: 0, invalidCount: 1, complexCount: 0 } };
        default: return { points: [], meta: { validCount: 0, invalidCount: 0, complexCount: 0 } };
    }
};

export const resampleByArcLength = (
    points: SamplePoint[],
    targetCount: number,
    opts?: { minSegmentPoints?: number; minSegmentLength?: number }
): SamplePoint[] => {
    if (points.length < 2 || targetCount <= 0) return points;

    const segments: SamplePoint[][] = [];
    let current: SamplePoint[] = [];
    for (const p of points) {
        if (!p.valid || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            if (current.length > 1) segments.push(current);
            current = [];
            continue;
        }
        current.push(p);
    }
    if (current.length > 1) segments.push(current);
    if (segments.length === 0) return points;

    const segLengths = segments.map(seg => {
        let len = 0;
        for (let i = 1; i < seg.length; i++) {
            const dx = seg[i].x - seg[i-1].x;
            const dy = seg[i].y - seg[i-1].y;
            len += Math.sqrt(dx * dx + dy * dy);
        }
        return len;
    });

    const minSegLen = opts?.minSegmentLength ?? 0;
    const filteredSegments: SamplePoint[][] = [];
    const filteredLengths: number[] = [];
    segLengths.forEach((len, idx) => {
        if (len > minSegLen) {
            filteredSegments.push(segments[idx]);
            filteredLengths.push(len);
        }
    });
    if (filteredSegments.length === 0) return points;

    const totalLen = filteredLengths.reduce((a, b) => a + b, 0);
    if (totalLen <= 0) return points;

    let minPoints = opts?.minSegmentPoints ?? 2;
    if (targetCount < filteredSegments.length * minPoints) {
        minPoints = 1;
    }

    const allocations = filteredLengths.map(len => Math.max(minPoints, Math.round((len / totalLen) * targetCount)));
    let allocated = allocations.reduce((a, b) => a + b, 0);

    while (allocated > targetCount) {
        const idx = allocations.findIndex(n => n > minPoints);
        if (idx < 0) break;
        allocations[idx] -= 1;
        allocated -= 1;
    }
    while (allocated < targetCount) {
        const idx = allocations.indexOf(Math.max(...allocations));
        allocations[idx] += 1;
        allocated += 1;
    }

    const resampleSegment = (seg: SamplePoint[], count: number, segmentId: number): SamplePoint[] => {
        if (seg.length < 2 || count <= 1) return [seg[0]];
        const lengths = [0];
        let total = 0;
        for (let i = 1; i < seg.length; i++) {
            const dx = seg[i].x - seg[i-1].x;
            const dy = seg[i].y - seg[i-1].y;
            total += Math.sqrt(dx*dx + dy*dy);
            lengths.push(total);
        }
        if (total === 0) return seg.slice(0, count);
        const step = total / (count - 1);
        const out: SamplePoint[] = [];
        let idx = 0;
        for (let i = 0; i < count; i++) {
            const targetL = i * step;
            while (idx < lengths.length - 1 && lengths[idx+1] < targetL) idx++;
            const segmentStart = lengths[idx];
            const segmentEnd = lengths[idx+1] || total;
            const segmentLen = segmentEnd - segmentStart;
            const t = segmentLen > 1e-6 ? (targetL - segmentStart) / segmentLen : 0;
            const p1 = seg[idx];
            const p2 = seg[idx+1] || seg[idx];
            out.push({
                u: p1.u + (p2.u - p1.u) * t,
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                valid: true,
                raw: p1.raw,
                segmentId
            });
        }
        return out;
    };

    const newPoints: SamplePoint[] = [];
    filteredSegments.forEach((seg, idx) => {
        const resampled = resampleSegment(seg, allocations[idx], idx);
        newPoints.push(...resampled);
        if (idx < filteredSegments.length - 1) {
            newPoints.push({ u: 0, x: 0, y: 0, valid: false, raw: null });
        }
    });
    return newPoints;
};

export const resamplePolylinesByArcLength = (
    segments: SamplePoint[][],
    targetCount: number,
    opts?: { minSegmentPoints?: number; minSegmentLength?: number }
): SamplePoint[] => {
    if (!segments || segments.length === 0) return [];
    const combined: SamplePoint[] = [];
    segments.forEach((seg, idx) => {
        combined.push(...seg);
        if (idx < segments.length - 1) {
            combined.push({ u: 0, x: 0, y: 0, valid: false, raw: null });
        }
    });
    return resampleByArcLength(combined, targetCount, opts).filter(p => p.valid);
};
