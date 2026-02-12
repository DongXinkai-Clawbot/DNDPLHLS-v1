import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Minima, Partial, RoughnessModel } from './utils';
import { applySpectralDecay, calculateTotalRoughness, clamp } from './utils';

type UseSetharesRoughnessCurveParams = {
    partials: Partial[];
    algoParams: { a: number; b: number };
    roughnessModel: RoughnessModel;
    cbScale: number;
    decayAmount: number;
    timeSlice: number;
    minimaFilterDepth: number;
    minimaFilterWidth: number;
    isDragging: boolean;
    maxRange: number;
    showGhostCurve: boolean;
    stretch: number;
    setCurveData: Dispatch<SetStateAction<{ cents: number; r: number }[]>>;
    setMinima: Dispatch<SetStateAction<Minima[]>>;
    setShowGhostCurve: Dispatch<SetStateAction<boolean>>;
    setTriadHighlight: Dispatch<SetStateAction<number[] | null>>;
};

export const useSetharesRoughnessCurve = ({
    partials,
    algoParams,
    roughnessModel,
    cbScale,
    decayAmount,
    timeSlice,
    minimaFilterDepth,
    minimaFilterWidth,
    isDragging,
    maxRange,
    showGhostCurve,
    stretch,
    setCurveData,
    setMinima,
    setShowGhostCurve,
    setTriadHighlight
}: UseSetharesRoughnessCurveParams) => {
    useEffect(() => {
        const step = isDragging ? (maxRange > 1200 ? 0.7 : 0.35) : 0.1;
        const points = [];
        const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice);

        let maxR = 0;

        for (let c = 0; c <= maxRange; c += step) {
            const ratio = Math.pow(2, c / 1200);
            const r = calculateTotalRoughness(
                analysisPartials,
                ratio,
                algoParams.a,
                algoParams.b,
                roughnessModel,
                cbScale
            );
            if (r > maxR) maxR = r;
            points.push({ cents: c, r });
        }

        if (maxR > 0) {
            for (let i = 0; i < points.length; i++) {
                points[i].r /= maxR;
            }
        }

        const smoothed = [];
        for (let i = 0; i < points.length; i++) {
            let sum = 0;
            let count = 0;
            for (let k = -1; k <= 1; k++) {
                if (i + k >= 0 && i + k < points.length) {
                    sum += points[i + k].r;
                    count++;
                }
            }
            smoothed.push({ cents: points[i].cents, r: sum / count });
        }

        setCurveData(smoothed);

        const candidates: { idx: number; cents: number; r: number }[] = [];

        for (let i = 5; i < smoothed.length - 5; i++) {
            const val = smoothed[i].r;
            if (val < smoothed[i - 1].r && val < smoothed[i + 1].r) {
                if (val <= smoothed[i - 2].r && val <= smoothed[i + 2].r) {
                    candidates.push({ idx: i, cents: smoothed[i].cents, r: val });
                }
            }
        }

        const merged: typeof candidates = [];
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.cents - b.cents);
            let current = candidates[0];
            for (let i = 1; i < candidates.length; i++) {
                const next = candidates[i];
                if (next.cents - current.cents < 15) {
                    if (next.r < current.r) current = next;
                } else {
                    merged.push(current);
                    current = next;
                }
            }
            merged.push(current);
        }

        const foundMinima: Minima[] = [];
        const MAX_DENOM = 32;

        merged.forEach(cand => {
            const ratioVal = Math.pow(2, cand.cents / 1200);

            let bestErr = Infinity, bestDen = 1;
            for (let d = 1; d <= MAX_DENOM; d++) {
                const n = Math.round(ratioVal * d);
                const err = Math.abs(1200 * Math.log2((n / d) / ratioVal));
                if (err < bestErr) { bestErr = err; bestDen = d; }
            }

            let localMax = cand.r;
            const range = Math.floor(40 / step);
            for (let k = 1; k <= range; k++) {
                const left = smoothed[Math.max(0, cand.idx - k)]?.r ?? 0;
                const right = smoothed[Math.min(smoothed.length - 1, cand.idx + k)]?.r ?? 0;
                localMax = Math.max(localMax, left, right);
            }
            const depth = localMax - cand.r;

            let keep = false;

            if (cand.r < 0.25) keep = true;

            else if (bestDen <= 8 && bestErr < 6.0 && depth > 0.02) keep = true;

            else if (bestDen <= 16 && bestErr < 4.5 && depth > 0.05) keep = true;

            else if (depth > 0.15) keep = true;

            if (depth < 0.012) keep = false;

            if (cand.cents < 15 || cand.cents > 1185) keep = false;

            if (keep) {
                foundMinima.push({
                    cents: cand.cents,
                    roughness: cand.r,
                    ratio: ratioVal,
                    depth,
                    width: 0
                });
            }
        });

        setMinima(foundMinima);

    }, [partials, algoParams.a, algoParams.b, roughnessModel, cbScale, decayAmount, timeSlice, minimaFilterDepth, minimaFilterWidth, isDragging, maxRange]);

    useEffect(() => {
        if (!showGhostCurve) return;
        const handleRelease = () => setShowGhostCurve(false);
        window.addEventListener('mouseup', handleRelease);
        window.addEventListener('touchend', handleRelease);
        return () => {
            window.removeEventListener('mouseup', handleRelease);
            window.removeEventListener('touchend', handleRelease);
        };
    }, [showGhostCurve]);

    useEffect(() => {
        setTriadHighlight(null);
    }, [partials, stretch, algoParams.a, algoParams.b, roughnessModel, cbScale, decayAmount, timeSlice, minimaFilterDepth, minimaFilterWidth]);
};
