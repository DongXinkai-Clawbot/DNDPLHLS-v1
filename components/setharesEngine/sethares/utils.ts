import { useRef } from 'react';
import { createLogger } from '../../../utils/logger';

export const DEFAULT_A = 3.5;
export const DEFAULT_B = 5.75;
export const DEFAULT_ATTACK = 0.01;
export const DEFAULT_RELEASE = 0.2;
export const S1 = 0.0207;
export const S2 = 18.96;
export const D_MAX = 0.24;
export const DEFAULT_PEAK_COUNT = 16;
export const DEFAULT_FFT_THRESHOLD = 0.06;
export const DEFAULT_SUSTAIN_START = 0.6;
export const DEFAULT_SUSTAIN_END = 0.9;
export const DEFAULT_DECAY_AMOUNT = 1.4;
export const DEFAULT_TIME_SLICE = 0.65;
export const DEFAULT_CB_SCALE = 1.0;
export const DEFAULT_MINIMA_DEPTH = 0.04;
export const DEFAULT_MINIMA_WIDTH = 12;
export const DEFAULT_BEAT_DEPTH = 0.5;
export const DEFAULT_MORPH_FRAMES = 16;
export const WAVETABLE_SAMPLES = 2048;
export const HEATMAP_MAX_PARTIALS = 32;

const log = createLogger('sethares/utils');

export interface Partial {
    index: number;
    ratio: number;
    amplitude: number;
    originalRatio: number; 
    waveform: OscillatorType;
}

export interface Minima {
    cents: number;
    ratio: number;
    roughness: number;
    depth?: number;
    width?: number;
}

export type RoughnessModel = 'sethares' | 'vassilakis';
export type AxisMode = 'cents' | 'hz';
export type MidiMappingMode = 'chromatic' | 'white';

let audioCtx: AudioContext | null = null;

export const getAudioCtx = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

export const calculatePairRoughness = (
    f1: number,
    f2: number,
    a1: number,
    a2: number,
    aParam: number,
    bParam: number,
    model: RoughnessModel,
    cbScale: number
) => {
    
    const fMean = (f1 + f2) / 2;
    
    const cb = (S1 * f1 + S2) * Math.max(0.05, cbScale);
    
    const freqDiff = f2 - f1;
    
    const x = freqDiff / cb; 
    
    if (model === 'vassilakis') {
        const denom = Math.pow(0.5 * (a1 + a2), 3.11);
        const ampTerm = denom > 0 ? Math.pow(a1 * a2, 0.1) / denom : 0;
        return ampTerm * (Math.exp(-aParam * x) - Math.exp(-bParam * x));
    }
    
    const amp = a1 * a2;
    const r = amp * (Math.exp(-aParam * x) - Math.exp(-bParam * x));
    
    return r;
};

export const calculateTotalRoughness = (
    partials: Partial[],
    alpha: number,
    aParam: number,
    bParam: number,
    model: RoughnessModel,
    cbScale: number
) => {
    
    const f0 = 220; 
    
    const freqsA = partials.map(p => ({ f: p.ratio * f0, a: p.amplitude }));
    const freqsB = partials.map(p => ({ f: p.ratio * f0 * alpha, a: p.amplitude }));
    
    const all = [...freqsA, ...freqsB];
    
    const pruned = all.filter(p => p.a > 0.001); 
    pruned.sort((a, b) => a.f - b.f);
    
    let totalR = 0;
    for (let i = 0; i < pruned.length; i++) {
        for (let j = i + 1; j < pruned.length; j++) {
            totalR += calculatePairRoughness(
                pruned[i].f,
                pruned[j].f,
                pruned[i].a,
                pruned[j].a,
                aParam,
                bParam,
                model,
                cbScale
            );
        }
    }
    return totalR;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const gcd = (a: number, b: number) => {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
};

export const ratioToFractionLabel = (ratio: number, maxDenominator: number = 16) => {
    if (!Number.isFinite(ratio) || ratio <= 0) return '';
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
    return `${num}/${den}`;
};

export const mixColor = (from: string, to: string, t: number) => {
    const f = from.replace('#', '');
    const tHex = to.replace('#', '');
    const fr = parseInt(f.slice(0, 2), 16);
    const fg = parseInt(f.slice(2, 4), 16);
    const fb = parseInt(f.slice(4, 6), 16);
    const tr = parseInt(tHex.slice(0, 2), 16);
    const tg = parseInt(tHex.slice(2, 4), 16);
    const tb = parseInt(tHex.slice(4, 6), 16);
    const r = Math.round(fr + (tr - fr) * t);
    const g = Math.round(fg + (tg - fg) * t);
    const b = Math.round(fb + (tb - fb) * t);
    return `rgb(${r}, ${g}, ${b})`;
};

export const getHarmonicColor = (ratio: number) => {
    const nearest = Math.round(ratio);
    const distance = Math.abs(ratio - nearest);
    const t = clamp(distance / 0.2, 0, 1);
    return mixColor('#27ff74', '#ffb347', t);
};

export const applyEnvelope = (
    gain: GainNode,
    ctx: AudioContext,
    amplitude: number,
    startTime: number,
    endTime: number,
    attack: number = DEFAULT_ATTACK,
    release: number = DEFAULT_RELEASE
) => {
    const safeAmp = Math.max(0, amplitude);
    const releaseStart = Math.max(startTime + attack, endTime - release);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(safeAmp, startTime + attack);
    gain.gain.setValueAtTime(safeAmp, releaseStart);
    gain.gain.linearRampToValueAtTime(0.0001, endTime);
};

export const resolvePartialWaveform = (partial: Partial, fallback: OscillatorType) => {
    return partial.waveform || fallback;
};

export const normalizeWaveform = (value: any, fallback: OscillatorType) => {
    return value === 'sine' || value === 'triangle' || value === 'sawtooth' ? value : fallback;
};

export const applySpectralDecay = (partials: Partial[], decayAmount: number, timeSlice: number) => {
    const t = clamp(timeSlice, 0, 1);
    const amount = Math.max(0, decayAmount);
    return partials.map(p => {
        const decay = Math.exp(-amount * (p.ratio - 1) * t);
        return { ...p, amplitude: p.amplitude * decay };
    });
};

export const nextPow2 = (value: number) => {
    let n = 1;
    while (n < value) n <<= 1;
    return n;
};

export const fftRadix2 = (re: number[], im: number[]) => {
    const n = re.length;
    let j = 0;
    for (let i = 0; i < n; i++) {
        if (i < j) {
            const tr = re[i];
            const ti = im[i];
            re[i] = re[j];
            im[i] = im[j];
            re[j] = tr;
            im[j] = ti;
        }
        let m = n >> 1;
        while (m >= 1 && j >= m) {
            j -= m;
            m >>= 1;
        }
        j += m;
    }
    for (let size = 2; size <= n; size <<= 1) {
        const half = size >> 1;
        const step = (Math.PI * 2) / size;
        for (let i = 0; i < n; i += size) {
            for (let k = 0; k < half; k++) {
                const angle = step * k;
                const cos = Math.cos(angle);
                const sin = -Math.sin(angle);
                const tre = re[i + k + half] * cos - im[i + k + half] * sin;
                const tim = re[i + k + half] * sin + im[i + k + half] * cos;
                re[i + k + half] = re[i + k] - tre;
                im[i + k + half] = im[i + k] - tim;
                re[i + k] += tre;
                im[i + k] += tim;
            }
        }
    }
};

export const extractFftPeaks = (
    buffer: AudioBuffer,
    peakCount: number,
    threshold: number,
    sustainStart: number,
    sustainEnd: number
) => {
    const channels = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }
    const length = buffer.length;
    const start = Math.max(0, Math.floor(length * clamp(sustainStart, 0, 0.95)));
    const end = Math.max(start + 1, Math.floor(length * clamp(sustainEnd, 0.05, 1)));
    const segmentLength = Math.max(1, end - start);
    const fftSize = Math.min(16384, nextPow2(segmentLength));
    const re = new Array(fftSize).fill(0);
    const im = new Array(fftSize).fill(0);
    const windowScale = 1 / fftSize;
    for (let i = 0; i < fftSize; i++) {
        const idx = start + Math.floor(i * (segmentLength / fftSize));
        let sample = 0;
        for (let c = 0; c < channels.length; c++) {
            sample += channels[c][idx] || 0;
        }
        sample /= channels.length;
        const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
        re[i] = sample * win * windowScale;
    }
    fftRadix2(re, im);

    const magnitudes = new Array(fftSize / 2).fill(0);
    let maxMag = 0;
    for (let i = 1; i < magnitudes.length - 1; i++) {
        const mag = Math.hypot(re[i], im[i]);
        magnitudes[i] = mag;
        if (mag > maxMag) maxMag = mag;
    }
    const minMag = maxMag * clamp(threshold, 0, 1);
    const peaks: { bin: number; mag: number }[] = [];
    for (let i = 2; i < magnitudes.length - 2; i++) {
        const mag = magnitudes[i];
        if (mag < minMag) continue;
        if (mag > magnitudes[i - 1] && mag > magnitudes[i + 1]) {
            peaks.push({ bin: i, mag });
        }
    }
    peaks.sort((a, b) => b.mag - a.mag);
    const selected = peaks.slice(0, Math.max(1, peakCount));
    selected.sort((a, b) => a.bin - b.bin);
    const sampleRate = buffer.sampleRate;
    const maxSelectedMag = selected.reduce((acc, p) => Math.max(acc, p.mag), 0) || 1;
    const freqs = selected.map(p => ({
        freq: (p.bin * sampleRate) / fftSize,
        amp: p.mag / maxSelectedMag
    }));
    if (freqs.length === 0) return { baseFreq: 0, peaks: [] as Array<{ ratio: number; amplitude: number }> };
    const baseFreq = freqs[0].freq || 1;
    const peakList = freqs.map(p => ({
        ratio: p.freq / baseFreq,
        amplitude: clamp(p.amp, 0, 1)
    }));
    return { baseFreq, peaks: peakList };
};

export const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        log.warn('Shader info log', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
};

export const createProgram = (gl: WebGL2RenderingContext, vsSource: string, fsSource: string) => {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        log.warn('Program info log', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
};
