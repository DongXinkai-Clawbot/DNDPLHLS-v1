import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Minima, Partial, AxisMode, clamp, applySpectralDecay, gcd } from './utils';

const ratioToFractionWithError = (ratio: number, maxDenominator: number = 32) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return { label: '', error: Infinity };
    let bestNum = 1;
    let bestDen = 1;
    let bestErr = Math.abs(ratio - 1);
    for (let den = 1; den <= maxDenominator; den++) {
        const num = Math.round(ratio * den);
        const err = Math.abs(ratio - num / den);
        if (err < bestErr) {
            bestErr = err;
            bestNum = num;
            bestDen = den;
        }
    }
    const div = gcd(bestNum, bestDen);
    const num = Math.max(1, Math.round(bestNum / div));
    const den = Math.max(1, Math.round(bestDen / div));
    const errorCents = 1200 * Math.log2(ratio / (num / den));
    return { label: `${num}/${den}`, error: errorCents, num, den };
};

const DEFAULT_HARMONICS = [
    { n: 1, d: 1, enabled: true },
    { n: 9, d: 8, enabled: true },
    { n: 5, d: 4, enabled: true },
    { n: 4, d: 3, enabled: true },
    { n: 3, d: 2, enabled: true },
    { n: 5, d: 3, enabled: true },
    { n: 15, d: 8, enabled: true },
    { n: 2, d: 1, enabled: true }
];

const buildDefaultHarmonics = (count: number) => {
    if (!Number.isFinite(count) || count <= 0) return [];
    const next: Array<{ n: number; d: number; enabled: boolean }> = [];
    const seen = new Set<string>();
    const push = (n: number, d: number) => {
        const div = gcd(Math.round(Math.abs(n)), Math.round(Math.abs(d)));
        const nn = Math.max(1, Math.round(n / div));
        const dd = Math.max(1, Math.round(d / div));
        const key = `${nn}/${dd}`;
        if (seen.has(key)) return;
        seen.add(key);
        next.push({ n: nn, d: dd, enabled: true });
    };
    DEFAULT_HARMONICS.forEach(h => {
        if (next.length < count) push(h.n, h.d);
    });
    if (next.length >= count) return next.slice(0, count);
    const maxN = Math.max(128, count * 3);
    for (let n = 1; n <= maxN && next.length < count; n += 1) {
        let d = 1;
        while (n / d >= 2) d *= 2;
        push(n, d);
    }
    return next.slice(0, count);
};

type HarmonicConfig = { n: number; d: number; enabled: boolean; intensity?: number };

interface RoughnessCurveProps {
    data: { cents: number; r: number }[];
    minima: Minima[];
    onHover: (cents: number | null) => void;
    scaleOverlay?: number[];
    scaleType?: string;
    showTetOverlay?: boolean;
    showHarmonicOverlay?: boolean;
    tetDivisions?: number;
    ghostData?: { cents: number; r: number }[] | null;
    showGhost?: boolean;
    baseFreq: number;
    triadHighlight?: number[] | null;
    axisMode: AxisMode;
    partials: Partial[];
    decayAmount: number;
    timeSlice: number;
    externalHoverSignal?: { cents: number; id: number } | null;
    
    maxRatioDenominator?: number;
    harmonicCount?: number;
    harmonicsConfig?: HarmonicConfig[];
    
    gridFollowsEdo?: boolean;
    
    maxCents?: number;

    customTargets?: { cents: number; roughness: number }[];
    customTargetContinuous?: boolean;
}

const RoughnessCurve = ({
    data,
    minima,
    onHover,
    scaleOverlay,
    scaleType,
    showTetOverlay,
    showHarmonicOverlay,
    tetDivisions = 12,
    ghostData,
    showGhost,
    baseFreq,
    triadHighlight,
    axisMode,
    partials,
    decayAmount,
    timeSlice,
    externalHoverSignal,
    maxRatioDenominator = 32,
    harmonicCount = 8,
    harmonicsConfig,
    gridFollowsEdo = false,
    maxCents = 1200,
    customTargets,
    customTargetContinuous = false
}: RoughnessCurveProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [hoverCents, setHoverCents] = useState<number | null>(null);
    const [currentRoughness, setCurrentRoughness] = useState<number | null>(null);
    const panRef = useRef<{
        startX: number;
        startY: number;
        startMin: number;
        startMax: number;
        startMinR: number;
        startMaxR: number;
    } | null>(null);
    const hasUserPanRef = useRef(false);

    const nearestIndexByCents = (list: { cents: number }[], target: number) => {
        let lo = 0;
        let hi = list.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const val = list[mid].cents;
            if (val === target) return mid;
            if (val < target) lo = mid + 1;
            else hi = mid - 1;
        }
        const left = clamp(hi, 0, list.length - 1);
        const right = clamp(lo, 0, list.length - 1);
        const leftDiff = Math.abs(list[left].cents - target);
        const rightDiff = Math.abs(list[right].cents - target);
        return leftDiff <= rightDiff ? left : right;
    };

    const effectiveData = useMemo(() => {
        if (!customTargets || customTargets.length === 0 || data.length === 0) return data;
        const normalizedTargets = customTargets
            .filter(t => Number.isFinite(t.cents) && Number.isFinite(t.roughness))
            .map(t => ({ cents: t.cents, roughness: clamp(t.roughness, 0, 1) }))
            .sort((a, b) => a.cents - b.cents)
            .reduce<Array<{ cents: number; roughness: number }>>((acc, t) => {
                const last = acc[acc.length - 1];
                if (last && Math.abs(last.cents - t.cents) < 0.001) {
                    acc[acc.length - 1] = t;
                } else {
                    acc.push(t);
                }
                return acc;
            }, []);

        if (normalizedTargets.length === 0) return data;

        if (!customTargetContinuous || normalizedTargets.length < 2) {
            const next = data.map(pt => ({ ...pt }));
            normalizedTargets.forEach(t => {
                const idx = nearestIndexByCents(next, t.cents);
                if (idx >= 0 && idx < next.length) {
                    next[idx] = { ...next[idx], r: clamp(t.roughness, 0, 1) };
                }
            });
            return next;
        }

        const next = data.map(pt => ({ ...pt }));
        const lastIdx = normalizedTargets.length - 1;
        let seg = 0;

        for (let i = 0; i < next.length; i++) {
            const c = next[i].cents;
            if (c <= normalizedTargets[0].cents) {
                next[i].r = normalizedTargets[0].roughness;
                continue;
            }
            if (c >= normalizedTargets[lastIdx].cents) {
                next[i].r = normalizedTargets[lastIdx].roughness;
                continue;
            }
            while (seg < lastIdx - 1 && c > normalizedTargets[seg + 1].cents) {
                seg += 1;
            }
            const left = normalizedTargets[seg];
            const right = normalizedTargets[seg + 1];
            const span = right.cents - left.cents;
            const t = span <= 0 ? 0 : (c - left.cents) / span;
            next[i].r = clamp(left.roughness + t * (right.roughness - left.roughness), 0, 1);
        }

        return next;
    }, [data, customTargets, customTargetContinuous]);

    const axisMinLimit = axisMode === 'hz' ? baseFreq : 0;
    const axisMaxLimit = axisMode === 'hz' ? baseFreq * Math.pow(2, maxCents / 1200) : maxCents;
    const [viewRange, setViewRange] = useState({ min: axisMinLimit, max: axisMaxLimit });
    const [viewRangeR, setViewRangeR] = useState({ min: 0, max: 1 });

    const [logicalWidth, setLogicalWidth] = useState(1600);
    const logicalHeight = 560;
    const padding = { left: 55, right: 25, top: 35, bottom: 40 };

    const activeHarmonics = useMemo(() => {
        const safeCount = clamp(
            Math.round(Number.isFinite(harmonicCount) ? harmonicCount : (harmonicsConfig?.length ?? 8)),
            1,
            55
        );
        if (harmonicsConfig && harmonicsConfig.length > 0) {
            const limited = harmonicsConfig.slice(0, safeCount);
            return limited.filter(h => h.enabled).map(h => ({
                r: h.n / h.d,
                label: `${h.n}/${h.d}`,
                intensity: h.intensity ?? 1
            }));
        }
        return buildDefaultHarmonics(safeCount)
            .filter(h => h.enabled)
            .map(h => ({ r: h.n / h.d, label: `${h.n}/${h.d}`, intensity: 1 }));
    }, [harmonicCount, harmonicsConfig]);

    useEffect(() => {
        setViewRange({ min: axisMinLimit, max: axisMaxLimit });
    }, [axisMinLimit, axisMaxLimit]);

    useEffect(() => {
        if (hasUserPanRef.current) return;
        if (!effectiveData.length) {
            setViewRangeR({ min: 0, max: 1 });
            return;
        }
        const dataMin = Math.min(...effectiveData.map(d => d.r));
        const dataMax = Math.max(...effectiveData.map(d => d.r));
        const safeMin = clamp(Number.isFinite(dataMin) ? dataMin : 0, 0, 1);
        const safeMax = clamp(Number.isFinite(dataMax) ? dataMax : 1, 0, 1);
        if (safeMax - safeMin < 0.05) {
            const mid = (safeMin + safeMax) / 2;
            setViewRangeR({
                min: clamp(mid - 0.025, 0, 1),
                max: clamp(mid + 0.025, 0, 1)
            });
        } else {
            setViewRangeR({ min: safeMin, max: safeMax });
        }
    }, [effectiveData]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            const nextWidth = Math.max(320, Math.round(rect.width));
            setLogicalWidth(prev => (prev === nextWidth ? prev : nextWidth));
        };
        updateSize();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => updateSize());
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheelNative = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const plotW = logicalWidth - padding.left - padding.right;
            const rect = container.getBoundingClientRect();
            const scaleX = logicalWidth / rect.width;
            const rawX = (e.clientX - rect.left) * scaleX;
            const clampedX = clamp(rawX, padding.left, padding.left + plotW);

            setViewRange(prev => {
                const span = Math.max(1, prev.max - prev.min);
                const cursorAxis = prev.min + ((clampedX - padding.left) / plotW) * span;
                const zoomFactor = e.deltaY > 0 ? 1.12 : 0.9;
                const minSpan = axisMode === 'hz' ? 10 : 20;
                const maxSpan = axisMode === 'hz' ? Math.max(10, axisMaxLimit - axisMinLimit) : maxCents;
                const nextSpan = clamp(span * zoomFactor, minSpan, maxSpan);
                let nextMin = cursorAxis - (cursorAxis - prev.min) * (nextSpan / span);
                let nextMax = nextMin + nextSpan;
                if (nextMin < axisMinLimit) {
                    nextMax -= nextMin - axisMinLimit;
                    nextMin = axisMinLimit;
                }
                if (nextMax > axisMaxLimit) {
                    nextMin -= (nextMax - axisMaxLimit);
                    nextMax = axisMaxLimit;
                }
                return { min: nextMin, max: nextMax };
            });
        };

        container.addEventListener('wheel', handleWheelNative, { passive: false });
        return () => container.removeEventListener('wheel', handleWheelNative);
    }, [axisMode, axisMinLimit, axisMaxLimit, logicalWidth]);

    useEffect(() => {
        if (!externalHoverSignal) return;
        const plotW = logicalWidth - padding.left - padding.right;
        const span = Math.max(1, viewRange.max - viewRange.min);
        const axisValue = axisMode === 'hz'
            ? baseFreq * Math.pow(2, externalHoverSignal.cents / 1200)
            : externalHoverSignal.cents;
        const x = padding.left + ((axisValue - viewRange.min) / span) * plotW;
        setHoverX(clamp(x, padding.left, padding.left + plotW));
        setHoverCents(externalHoverSignal.cents);
        if (effectiveData.length > 0) {
            const idx = nearestIndexByCents(effectiveData, externalHoverSignal.cents);
            setCurrentRoughness(effectiveData[idx].r);
        }
    }, [externalHoverSignal, viewRange, axisMode, baseFreq, effectiveData, logicalWidth]);

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        const dpr = Math.min(4, Math.max(3, window.devicePixelRatio || 1));
        const targetW = logicalWidth * dpr;
        const targetH = logicalHeight * dpr;
        if (cvs.width !== targetW || cvs.height !== targetH) {
            cvs.width = targetW;
            cvs.height = targetH;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cvs.style.width = '100%';
        cvs.style.height = `${logicalHeight}px`;

        const w = logicalWidth;
        const h = logicalHeight;
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;
        const viewMin = clamp(viewRange.min, axisMinLimit, axisMaxLimit);
        const viewMax = clamp(viewRange.max, axisMinLimit, axisMaxLimit);
        const viewSpan = Math.max(1, viewMax - viewMin);

        ctx.clearRect(0, 0, w, h);

        const viewMinR = clamp(viewRangeR.min, 0, 1);
        const viewMaxR = clamp(viewRangeR.max, 0, 1);
        const rangeR = Math.max(1e-4, viewMaxR - viewMinR);

        const axisFromCents = (cents: number) => {
            if (axisMode === 'hz') return baseFreq * Math.pow(2, cents / 1200);
            return cents;
        };
        const xFromAxis = (axisValue: number) => padding.left + ((axisValue - viewMin) / viewSpan) * plotW;
        const xFromCents = (cents: number) => xFromAxis(axisFromCents(cents));
        const inView = (cents: number) => {
            const axisValue = axisFromCents(cents);
            return axisValue >= viewMin && axisValue <= viewMax;
        };
        const yFromR = (r: number) => padding.top + (1 - (r - viewMinR) / rangeR) * plotH;

        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();

        const safeDivisions = Math.max(1, Math.round(tetDivisions));
        const edoStep = 1200 / safeDivisions;
        const gridStep = axisMode === 'hz'
            ? Math.max(10, Math.round(viewSpan / 8 / 10) * 10)
            : (gridFollowsEdo ? edoStep : 100);

        for (let v = Math.ceil(viewMin / gridStep) * gridStep; v <= viewMax; v += gridStep) {
            const x = xFromAxis(v);
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotH);
        }
        ctx.stroke();

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + plotH);
        ctx.lineTo(padding.left + plotW, padding.top + plotH);
        ctx.stroke();

        const ySteps = 4;
        for (let i = 0; i <= ySteps; i++) {
            const y = padding.top + (plotH / ySteps) * i;
            ctx.strokeStyle = '#1b1b1b';
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + plotW, y);
            ctx.stroke();
            const valueR = viewMaxR - (i / ySteps) * rangeR;
            const pct = Math.round(valueR * 100);
            ctx.fillStyle = '#666';
            ctx.font = '11px monospace';
            ctx.fillText(`${pct}%`, 6, y + 4);
        }

        activeHarmonics.forEach(ratio => {
            const cents = 1200 * Math.log2(ratio.r);
            if (!inView(cents)) return;
            const x = xFromCents(cents);
            const intensity = ratio.intensity ?? 1;
            ctx.strokeStyle = `rgba(255, 120, 120, ${0.22 * intensity})`;
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotH);
            ctx.stroke();
            ctx.fillStyle = `rgba(255, 180, 180, ${0.7 * intensity})`;
            ctx.font = '11px monospace';
            ctx.fillText(ratio.label, x + 3, padding.top + plotH + 28);
        });

        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        for (let v = Math.ceil(viewMin / gridStep) * gridStep; v <= viewMax; v += gridStep) {
            const x = xFromAxis(v);
            const label = axisMode === 'hz' ? `${Math.round(v)}Hz` : `${Math.round(v)}c`;
            ctx.fillText(label, x - 12, padding.top + plotH + 16);
        }
        ctx.fillStyle = '#777';
        ctx.font = '12px monospace';
        const axisLabel = axisMode === 'hz' ? 'FREQUENCY (Hz)' : 'CENTS';
        ctx.fillText(axisLabel, padding.left + plotW - 160, padding.top + plotH + 36);
        ctx.save();
        ctx.translate(18, padding.top + plotH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('ROUGHNESS (%)', 0, 0);
        ctx.restore();

        if (showHarmonicOverlay) {
            ctx.setLineDash([]);
            activeHarmonics.forEach(ratio => {
                const cents = 1200 * Math.log2(ratio.r);
                if (!inView(cents)) return;
                const x = xFromCents(cents);
                const intensity = ratio.intensity ?? 1;
                ctx.fillStyle = `rgba(0, 255, 65, ${0.8 * intensity})`;
                ctx.font = '10px monospace';
                ctx.fillText(ratio.label, x + 4, padding.top - 12);
                ctx.beginPath();
                ctx.moveTo(x, padding.top - 8);
                ctx.lineTo(x, padding.top + 8);
                ctx.strokeStyle = `rgba(0, 255, 65, ${0.7 * intensity})`;
                ctx.lineWidth = Math.max(1, 1.5 * intensity);
                ctx.stroke();
            });
        }

        if (showTetOverlay && scaleOverlay && scaleOverlay.length > 0 && scaleType !== 'none') {
            const overlayColor = scaleType === '19tet'
                ? 'rgba(220, 180, 30, 0.65)'
                : scaleType === '31tet'
                    ? 'rgba(40, 220, 220, 0.65)'
                    : 'rgba(140, 80, 80, 0.6)';
            ctx.strokeStyle = overlayColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            scaleOverlay.forEach((cents, idx) => {
                if (!Number.isFinite(cents)) return;
                if (!inView(cents)) return;
                const x = xFromCents(cents);
                ctx.beginPath();
                ctx.moveTo(x, padding.top);
                ctx.lineTo(x, padding.top + plotH);
                ctx.stroke();
                
                ctx.fillStyle = 'rgba(200, 150, 150, 0.7)';
                ctx.font = '9px monospace';
                ctx.fillText(`${idx + 1}°`, x + 2, padding.top + 14);
            });
            ctx.setLineDash([]);
        }

        if (showGhost && ghostData && ghostData.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(180, 180, 180, 0.35)';
            ctx.lineWidth = 2;
            let started = false;
            ghostData.forEach((pt) => {
                if (!inView(pt.cents)) { started = false; return; }
                const x = xFromCents(pt.cents);
                const y = yFromR(pt.r);
                if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
            });
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.strokeStyle = '#00ff41';
        ctx.lineWidth = 2.5;
        let started = false;
        effectiveData.forEach((pt) => {
            if (!inView(pt.cents)) { started = false; return; }
            const x = xFromCents(pt.cents);
            const y = yFromR(pt.r);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        ctx.stroke();

        if (customTargets && customTargets.length > 0) {
            const sortedTargets = [...customTargets].sort((a, b) => a.cents - b.cents);
            ctx.strokeStyle = 'rgba(255, 0, 200, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            let lineStarted = false;
            sortedTargets.forEach(t => {
                if (!Number.isFinite(t.cents)) return;
                if (!inView(t.cents)) { lineStarted = false; return; }
                const x = xFromCents(t.cents);
                const y = yFromR(clamp(t.roughness, 0, 1));
                if (!lineStarted) { ctx.moveTo(x, y); lineStarted = true; } else { ctx.lineTo(x, y); }
            });
            ctx.stroke();
            ctx.setLineDash([]);

            sortedTargets.forEach(t => {
                if (!Number.isFinite(t.cents)) return;
                if (!inView(t.cents)) return;
                const x = xFromCents(t.cents);
                const y = yFromR(clamp(t.roughness, 0, 1));
                ctx.fillStyle = '#ff59d6';
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        minima.forEach(m => {
            if (!inView(m.cents)) return;

            let bestPt = { cents: m.cents, r: m.roughness };
            if (effectiveData.length > 0) {
                
                const searchRadius = 15; 
                const startIdx = Math.max(0, Math.floor(((m.cents - searchRadius) / 1200) * (effectiveData.length - 1)));
                const endIdx = Math.min(effectiveData.length - 1, Math.ceil(((m.cents + searchRadius) / 1200) * (effectiveData.length - 1)));

                for (let k = startIdx; k <= endIdx; k++) {
                    if (effectiveData[k].r < bestPt.r) {
                        bestPt = effectiveData[k];
                    }
                }
            }

            const displayCents = bestPt.cents;
            const displayRoughness = bestPt.r;
            const x = xFromCents(displayCents);
            const y = yFromR(displayRoughness);

            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#003333';
            ctx.lineWidth = 1;
            ctx.stroke();

            const ratio = Math.pow(2, displayCents / 1200);
            const ratioInfo = ratioToFractionWithError(ratio, maxRatioDenominator);
            const ratioLabel = ratioInfo.label || `${ratio.toFixed(3)}`;
            const centsLabel = `${displayCents.toFixed(1)}c`;

            ctx.fillStyle = '#55e7ff';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(ratioLabel, x + 6, y - 8);
            ctx.font = '9px monospace';
            ctx.fillStyle = '#88cccc';
            ctx.fillText(centsLabel, x + 6, y + 4);
        });

        if (hoverCents !== null) {
            const ratio = Math.pow(2, hoverCents / 1200);
            const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice);

            const LOG_FREQ_MAX = Math.log2(64);
            const xFromFreqRatio = (r: number) => {
                const log = Math.log2(Math.max(1e-6, r));
                return padding.left + (log / LOG_FREQ_MAX) * plotW;
            };

            analysisPartials.forEach(p => {
                const x = xFromFreqRatio(p.ratio);
                const hgt = p.amplitude * plotH * 0.4;
                ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
                ctx.fillRect(x - 1, padding.top + plotH - hgt, 2, hgt);
            });

            analysisPartials.forEach(p => {
                const shiftedRatio = p.ratio * ratio;
                const x = xFromFreqRatio(shiftedRatio);
                const hgt = p.amplitude * plotH * 0.4;
                ctx.fillStyle = 'rgba(255, 179, 71, 0.3)';
                ctx.fillRect(x - 1, padding.top, 2, hgt);

                analysisPartials.forEach(bp => {
                    const dist = Math.abs(Math.log2(shiftedRatio / bp.ratio));
                    if (dist < 0.02) {
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(x - 1, padding.top, 2, plotH);
                    }
                });
            });

            ctx.fillStyle = '#aaa';
            ctx.fillText('Spectral Alignment Overlay', padding.left + 10, padding.top + 20);
        }

        if (hoverX !== null && hoverCents !== null) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hoverX, padding.top);
            ctx.lineTo(hoverX, padding.top + plotH);
            ctx.stroke();

            const ratioValue = Math.pow(2, hoverCents / 1200);

            const ratioInfo = ratioToFractionWithError(ratioValue, maxRatioDenominator);
            const ratioNumeric = `${ratioValue.toFixed(4)}x`;
            const ratioLabel = ratioInfo.label ? `${ratioInfo.label} (${ratioNumeric})` : ratioNumeric;
            const errorLabel = ratioInfo.label && Number.isFinite(ratioInfo.error)
                ? `Error: ${ratioInfo.error >= 0 ? '+' : ''}${ratioInfo.error.toFixed(2)}¢`
                : '';

            const nearestDegree = Math.round(hoverCents / edoStep);
            const nearestCents = nearestDegree * edoStep;
            const deviation = hoverCents - nearestCents;
            const devLabel = `${deviation >= 0 ? '+' : ''}${deviation.toFixed(1)}c`;
            const roughLabel = currentRoughness !== null ? `${(currentRoughness * 100).toFixed(1)}%` : 'n/a';

            const tooltipW = 220;
            const tooltipH = 168;
            const tooltipX = clamp(hoverX + 10, padding.left, padding.left + plotW - tooltipW);
            const tooltipY = padding.top + 6;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(tooltipX, tooltipY, tooltipW, tooltipH);
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tooltipX, tooltipY, tooltipW, tooltipH);

            ctx.fillStyle = '#caffc4';
            ctx.font = '11px monospace';
            ctx.fillText(`${ratioLabel}`, tooltipX + 8, tooltipY + 16);
            if (errorLabel) {
                ctx.fillStyle = Math.abs(ratioInfo.error) < 5 ? '#88ff88' : '#ffaa66';
                ctx.fillText(errorLabel, tooltipX + 8, tooltipY + 30);
            }
            ctx.fillStyle = '#caffc4';
            ctx.fillText(`Roughness: ${roughLabel}`, tooltipX + 8, tooltipY + 46);
            ctx.fillText(`Nearest ${safeDivisions}-EDO: ${nearestDegree}° (${nearestCents.toFixed(1)}c)`, tooltipX + 8, tooltipY + 62);
            ctx.fillText(`Deviation: ${devLabel}`, tooltipX + 8, tooltipY + 78);

            const oscX = tooltipX + 8;
            const oscY = tooltipY + 90;
            const oscW = tooltipW - 16;
            const oscH = 70;
            ctx.fillStyle = '#000';
            ctx.fillRect(oscX, oscY, oscW, oscH);
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.6)';
            ctx.strokeRect(oscX, oscY, oscW, oscH);

            const wavePartials = applySpectralDecay(partials, decayAmount, timeSlice);
            const baseRatio = Math.pow(2, hoverCents / 1200);
            const f0 = Math.max(1, baseFreq * baseRatio);
            const samples = 180;
            const cycles = 2.5;
            const duration = cycles / f0;
            const waveform: number[] = [];
            let maxAbs = 0;
            for (let i = 0; i < samples; i++) {
                const t = (i / (samples - 1)) * duration;
                let sum = 0;
                for (let p = 0; p < wavePartials.length; p++) {
                    const partial = wavePartials[p];
                    const freq = f0 * partial.ratio;
                    sum += partial.amplitude * Math.sin(2 * Math.PI * freq * t);
                }
                maxAbs = Math.max(maxAbs, Math.abs(sum));
                waveform.push(sum);
            }
            const norm = maxAbs > 0 ? 1 / maxAbs : 1;
            ctx.beginPath();
            waveform.forEach((val, i) => {
                const x = oscX + (i / (samples - 1)) * oscW;
                const y = oscY + oscH / 2 - val * norm * (oscH * 0.42);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.strokeStyle = '#00ff41';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#666';
            ctx.font = '8px monospace';
            ctx.fillText('WAVEFORM (real-time)', oscX + 2, oscY + oscH - 3);
        }

    }, [effectiveData, minima, viewRange, viewRangeR, axisMode, showGhost, ghostData, triadHighlight, hoverX, hoverCents, partials, decayAmount, timeSlice, scaleOverlay, scaleType, baseFreq, currentRoughness, showTetOverlay, showHarmonicOverlay, tetDivisions, activeHarmonics, maxRatioDenominator, gridFollowsEdo, logicalWidth, logicalHeight, customTargets]);

    const getScaleFactor = useCallback(() => {
        const cvs = canvasRef.current;
        if (!cvs) return 1;
        const rect = cvs.getBoundingClientRect();
        return logicalWidth / rect.width;
    }, [logicalWidth]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const plotW = logicalWidth - padding.left - padding.right;
        const plotH = logicalHeight - padding.top - padding.bottom;
        const scaleFactor = getScaleFactor();
        const rawX = e.nativeEvent.offsetX * scaleFactor;
        const clampedX = clamp(rawX, padding.left, padding.left + plotW);

        if (panRef.current) {
            const span = Math.max(1, viewRange.max - viewRange.min);
            const deltaX = clampedX - panRef.current.startX;
            const deltaAxis = (deltaX / plotW) * span;
            let nextMin = panRef.current.startMin - deltaAxis;
            let nextMax = panRef.current.startMax - deltaAxis;
            if (nextMin < axisMinLimit) {
                nextMax -= nextMin - axisMinLimit;
                nextMin = axisMinLimit;
            }
            if (nextMax > axisMaxLimit) {
                nextMin -= (nextMax - axisMaxLimit);
                nextMax = axisMaxLimit;
            }
            const clampedY = clamp(e.nativeEvent.offsetY * scaleFactor, padding.top, padding.top + plotH);
            const spanR = Math.max(1e-4, viewRangeR.max - viewRangeR.min);
            const deltaY = clampedY - panRef.current.startY;
            const deltaR = (deltaY / plotH) * spanR;
            let nextMinR = panRef.current.startMinR + deltaR;
            let nextMaxR = panRef.current.startMaxR + deltaR;
            if (nextMinR < 0) {
                nextMaxR -= nextMinR;
                nextMinR = 0;
            }
            if (nextMaxR > 1) {
                nextMinR -= (nextMaxR - 1);
                nextMaxR = 1;
            }
            setViewRange({ min: nextMin, max: nextMax });
            setViewRangeR({ min: nextMinR, max: nextMaxR });
            return;
        }
        setHoverX(clampedX);

        const span = Math.max(1, viewRange.max - viewRange.min);
        const axisValue = viewRange.min + ((clampedX - padding.left) / plotW) * span;
        const cents = axisMode === 'hz'
            ? 1200 * Math.log2(Math.max(1e-6, axisValue) / Math.max(1e-6, baseFreq))
            : axisValue;
        setHoverCents(cents);

        if (effectiveData.length > 0) {
            const idx = nearestIndexByCents(effectiveData, cents);
            setCurrentRoughness(effectiveData[idx].r);
        }

        onHover(cents);
    };

    const handleMouseLeave = () => {
        setHoverX(null);
        setHoverCents(null);
        setCurrentRoughness(null);
        panRef.current = null;
        onHover(null);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const plotW = logicalWidth - padding.left - padding.right;
        const scaleFactor = getScaleFactor();
        const rawX = e.nativeEvent.offsetX * scaleFactor;
        const clampedX = clamp(rawX, padding.left, padding.left + plotW);
        const plotH = logicalHeight - padding.top - padding.bottom;
        const rawY = e.nativeEvent.offsetY * scaleFactor;
        const clampedY = clamp(rawY, padding.top, padding.top + plotH);
        setHoverX(null);
        panRef.current = {
            startX: clampedX,
            startY: clampedY,
            startMin: viewRange.min,
            startMax: viewRange.max,
            startMinR: viewRangeR.min,
            startMaxR: viewRangeR.max
        };
        hasUserPanRef.current = true;
    };

    const handleMouseUp = () => {
        panRef.current = null;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (hoverCents === null || minima.length === 0) return;
        let nearest = minima[0];
        let minDist = Math.abs(nearest.cents - hoverCents);
        for (let i = 1; i < minima.length; i++) {
            const dist = Math.abs(minima[i].cents - hoverCents);
            if (dist < minDist) {
                minDist = dist;
                nearest = minima[i];
            }
        }
        const snappedCents = nearest.cents;
        const plotW = logicalWidth - padding.left - padding.right;
        const span = Math.max(1, viewRange.max - viewRange.min);
        const axisValue = axisMode === 'hz'
            ? baseFreq * Math.pow(2, snappedCents / 1200)
            : snappedCents;
        const x = padding.left + ((axisValue - viewRange.min) / span) * plotW;
        setHoverX(clamp(x, padding.left, padding.left + plotW));
        setHoverCents(snappedCents);
        if (effectiveData.length > 0) {
            const idx = nearestIndexByCents(effectiveData, snappedCents);
            setCurrentRoughness(effectiveData[idx].r);
        }
        onHover(snappedCents);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full bg-gray-950 border border-gray-800 rounded-lg"
            style={{ overscrollBehavior: 'contain' }}
        >
            <canvas
                ref={canvasRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onContextMenu={handleContextMenu}
                className="block w-full cursor-crosshair"
                style={{ touchAction: 'none' }}
            />
        </div>
    );
};

export default RoughnessCurve;
