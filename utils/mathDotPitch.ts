
import type { MathSamplingSettings, MathDot, Fraction } from '../types';
import { normalizeOctave } from '../musicLogic';
import { findClosestInterval } from './intervalLibrary';

interface DotPitchResult {
    freqHz: number;
    ratio: Fraction;
    cents: number;
    isValid: boolean;
    reason?: string;
}

export const computeDotPitch = (
    dot: MathDot, 
    mapping: MathSamplingSettings, 
    viewY: { min: number, max: number },
    globalSettings: any 
): DotPitchResult => {
    let yVal = dot.y;
    if (!Number.isFinite(yVal)) {
        return { freqHz: 0, ratio: { n: 0n, d: 1n }, cents: 0, isValid: false, reason: 'Invalid Y' };
    }
    
    const mode = mapping.mappingMode || 'y_cents';
    
    let rawFreq = 0;
    
    if (mode === 'y_hz') {
        rawFreq = yVal;
    } else if (mode === 'complex') {
        
        rawFreq = yVal;
    } else if (mode === 'y_ratio') {
        if (yVal <= 0) return { freqHz: 0, ratio: {n:0n,d:1n}, cents: 0, isValid: false, reason: "Ratio <= 0" };
        rawFreq = mapping.baseFreq * yVal;
    } else if (mode === 'y_cents') {
        rawFreq = mapping.baseFreq * Math.pow(2, yVal / 1200);
    } else if (mode === 'x_cents') {
        if (!Number.isFinite(dot.x)) {
            return { freqHz: 0, ratio: { n: 0n, d: 1n }, cents: 0, isValid: false, reason: 'Invalid X' };
        }
        rawFreq = mapping.baseFreq * Math.pow(2, dot.x / 1200);
    } else if (mode === 'bounded') {
        const range = viewY.max - viewY.min || 1;
        const norm = (yVal - viewY.min) / range;
        const clampedNorm = Math.max(0, Math.min(1, norm));
        const val = mapping.boundedRange.min + clampedNorm * (mapping.boundedRange.max - mapping.boundedRange.min);
        
        rawFreq = val;
    }

    if (!Number.isFinite(rawFreq)) {
        return { freqHz: rawFreq, ratio: { n: 0n, d: 1n }, cents: 0, isValid: false, reason: 'Invalid Freq' };
    }
    if (rawFreq < mapping.rangeMin || rawFreq > mapping.rangeMax) {
        return { freqHz: rawFreq, ratio: {n:0n,d:1n}, cents: 0, isValid: false, reason: `Out of Range (${rawFreq.toFixed(1)}Hz)` };
    }

    let finalFreq = rawFreq;
    let ratioFloat = finalFreq / mapping.baseFreq;

    if (mapping.quantize === 'edo' && mapping.edoDivisions) {
        const cents = 1200 * Math.log2(ratioFloat);
        const step = 1200 / mapping.edoDivisions;
        const qCents = Math.round(cents / step) * step;
        finalFreq = mapping.baseFreq * Math.pow(2, qCents / 1200);
    } else if (mapping.quantize === 'cents_step' && mapping.centsStep) {
        const cents = 1200 * Math.log2(ratioFloat);
        const qCents = Math.round(cents / mapping.centsStep) * mapping.centsStep;
        finalFreq = mapping.baseFreq * Math.pow(2, qCents / 1200);
    } else if (mapping.quantize === 'prime_limit_fraction') {
        const cents = 1200 * Math.log2(ratioFloat);
        const closest = findClosestInterval(cents, mapping.primeLimit || 11);
        const n = Number(closest.ratio.n);
        const d = Number(closest.ratio.d);
        if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) {
            finalFreq = mapping.baseFreq * (n / d);
        }
    }

    if (mapping.normalizeToOctave) {
        let r = finalFreq / mapping.baseFreq;
        if (r > 0) {
            while (r < 1) r *= 2;
            while (r >= 2) r /= 2;
            finalFreq = r * mapping.baseFreq;
        }
    }

    const precision = 10000;
    const ratioF = finalFreq / mapping.baseFreq;
    
    let normRatioF = ratioF;
    let octaves = 0;
    if (mapping.normalizeToOctave) {
        while (normRatioF < 1) { normRatioF *= 2; octaves--; }
        while (normRatioF >= 2) { normRatioF /= 2; octaves++; }
    }

    const n = Math.round(normRatioF * precision);
    const d = precision;
    const { ratio: finalRatio } = normalizeOctave({ n: BigInt(n), d: BigInt(d) });
    
    const cents = 1200 * Math.log2(finalFreq / mapping.baseFreq);

    return {
        freqHz: finalFreq,
        ratio: finalRatio,
        cents,
        isValid: true
    };
};
