import { clamp, createRng } from './utils';

const noiseBufferCache = new WeakMap<AudioContext, Map<number, AudioBuffer>>();
const randomHoldBufferCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
const pulseWaveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();
const wavetableCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();
const bandLimitedWaveCache = new WeakMap<AudioContext, Map<string, PeriodicWave>>();
export type SampleLoadErrorCode = 'CORS' | 'NotFound' | 'DecodeError' | 'Timeout' | 'Network' | 'Aborted';

export class SampleLoadError extends Error {
  code: SampleLoadErrorCode;
  status?: number;
  constructor(code: SampleLoadErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type SampleCacheEntry = { promise: Promise<AudioBuffer>; size: number; lastUsed: number };
const sampleBufferCache = new WeakMap<AudioContext, Map<string, SampleCacheEntry>>();
const reversedSampleCache = new WeakMap<AudioBuffer, AudioBuffer>();
const pingPongSampleCache = new WeakMap<AudioBuffer, Map<string, AudioBuffer>>();
const impulseCache = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
const tanhCurveCache = new Map<number, Float32Array<ArrayBuffer>>();
const saturationCurveCache = new Map<string, Float32Array<ArrayBuffer>>();
const SAMPLE_CACHE_MAX_ENTRIES = 48;
const SAMPLE_CACHE_MAX_BYTES = 64 * 1024 * 1024;
const MAX_BANDLIMITED_HARMONICS = 2048;

const nowStamp = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const estimateBufferBytes = (buffer: AudioBuffer) => {
  return buffer.length * buffer.numberOfChannels * 4;
};

const evictSampleCache = (cache: Map<string, SampleCacheEntry>) => {
  let totalBytes = 0;
  cache.forEach((entry) => {
    totalBytes += entry.size;
  });
  if (cache.size <= SAMPLE_CACHE_MAX_ENTRIES && totalBytes <= SAMPLE_CACHE_MAX_BYTES) return;

  const entries = Array.from(cache.entries()).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (const [key, entry] of entries) {
    cache.delete(key);
    totalBytes -= entry.size;
    if (cache.size <= SAMPLE_CACHE_MAX_ENTRIES && totalBytes <= SAMPLE_CACHE_MAX_BYTES) break;
  }
};

export const getNoiseBuffer = (ctx: AudioContext, seed: number) => {
  let cache = noiseBufferCache.get(ctx);
  if (!cache) {
    cache = new Map();
    noiseBufferCache.set(ctx, cache);
  }
  if (cache.has(seed)) return cache.get(seed)!;
  const seconds = 1.2;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = createRng(seed);
  for (let i = 0; i < length; i++) {
    data[i] = (rand() * 2 - 1) * 0.9;
  }
  cache.set(seed, buffer);
  return buffer;
};

export const getRandomHoldBuffer = (ctx: AudioContext, seed: number, rateHz: number = 4) => {
  const clampedRate = clamp(rateHz, 0.1, 40);
  let cache = randomHoldBufferCache.get(ctx);
  if (!cache) {
    cache = new Map();
    randomHoldBufferCache.set(ctx, cache);
  }
  const key = `${seed}-${clampedRate.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;

  const seconds = 2;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = createRng(seed);
  const stepSamples = Math.max(1, Math.floor(ctx.sampleRate / clampedRate));
  let i = 0;
  while (i < length) {
    const value = rand() * 2 - 1;
    const end = Math.min(length, i + stepSamples);
    for (let j = i; j < end; j++) data[j] = value;
    i = end;
  }
  cache.set(key, buffer);
  return buffer;
};

export const getPulseWave = (ctx: AudioContext, duty: number) => {
  const clamped = clamp(duty, 0.05, 0.95);
  let cache = pulseWaveCache.get(ctx);
  if (!cache) {
    cache = new Map();
    pulseWaveCache.set(ctx, cache);
  }
  const key = clamped.toFixed(3);
  if (cache.has(key)) return cache.get(key)!;
  const harmonics = 64;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * clamped);
  }
  const wave = ctx.createPeriodicWave(real, imag);
  cache.set(key, wave);
  return wave;
};

const buildBandLimitedHarmonics = (waveform: string, harmonics: number, duty: number) => {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  if (waveform === 'sine') {
    imag[1] = 1;
    return { real, imag };
  }
  const dutyClamped = clamp(duty, 0.05, 0.95);
  for (let n = 1; n <= harmonics; n++) {
    if (waveform === 'square') {
      if (n % 2 === 0) continue;
      imag[n] = 4 / (Math.PI * n);
    } else if (waveform === 'triangle') {
      if (n % 2 === 0) continue;
      const sign = (n % 4 === 1) ? 1 : -1;
      imag[n] = sign * (8 / (Math.PI * Math.PI)) / (n * n);
    } else if (waveform === 'sawtooth') {
      const sign = (n % 2 === 0) ? -1 : 1;
      imag[n] = sign * (2 / (Math.PI * n));
    } else if (waveform === 'pulse') {
      imag[n] = (2 / (Math.PI * n)) * Math.sin(Math.PI * n * dutyClamped);
    } else {
      imag[n] = 0;
    }
  }
  return { real, imag };
};

export const getBandLimitedWave = (
  ctx: AudioContext,
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'pulse',
  frequency: number,
  duty: number = 0.5
) => {
  const safeFreq = Math.max(1, frequency);
  const maxHarmonics = Math.max(1, Math.min(MAX_BANDLIMITED_HARMONICS, Math.floor((ctx.sampleRate / 2) / safeFreq)));
  const dutyKey = waveform === 'pulse' ? clamp(duty, 0.05, 0.95) : 0.5;
  const key = `${waveform}|${maxHarmonics}|${dutyKey.toFixed(3)}`;
  let cache = bandLimitedWaveCache.get(ctx);
  if (!cache) {
    cache = new Map();
    bandLimitedWaveCache.set(ctx, cache);
  }
  if (cache.has(key)) return cache.get(key)!;
  const { real, imag } = buildBandLimitedHarmonics(waveform, maxHarmonics, dutyKey);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  cache.set(key, wave);
  return wave;
};

export const hashNumberArray = (arr: number[]) => {
  let hash = 2166136261;
  for (let i = 0; i < arr.length; i++) {
    const v = Number.isFinite(arr[i]) ? Math.round(arr[i] * 1e6) : 0;
    hash ^= v;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const getWavetableKey = (real: number[], imag: number[]) => {
  return `${real.length}|${imag.length}|${hashNumberArray(real)}|${hashNumberArray(imag)}`;
};

export const getWavetableWave = (ctx: AudioContext, wavetable?: { real: number[]; imag: number[] }) => {
  if (!wavetable || !Array.isArray(wavetable.real) || !Array.isArray(wavetable.imag)) return null;
  const real = wavetable.real;
  const imag = wavetable.imag;
  const key = getWavetableKey(real, imag);
  let cache = wavetableCache.get(ctx);
  if (!cache) {
    cache = new Map();
    wavetableCache.set(ctx, cache);
  }
  if (cache.has(key)) return cache.get(key)!;
  const realArr = new Float32Array(real);
  const imagArr = new Float32Array(imag);
  const wave = ctx.createPeriodicWave(realArr, imagArr, { disableNormalization: false });
  cache.set(key, wave);
  return wave;
};

export const getSampleBuffer = (
  ctx: AudioContext,
  data?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; retries?: number; cacheKey?: string }
) => {
  if (!data) return Promise.reject(new SampleLoadError('Network', 'No sample data.'));
  const cacheKey = options?.cacheKey || data;
  let cache = sampleBufferCache.get(ctx);
  if (!cache) {
    cache = new Map();
    sampleBufferCache.set(ctx, cache);
  }
  const cached = cache.get(cacheKey);
  if (cached) {
    cached.lastUsed = nowStamp();
    return cached.promise;
  }
  const fetchWithTimeout = async (url: string, timeoutMs: number, signal?: AbortSignal) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new SampleLoadError('Aborted', 'Sample request aborted.');
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        if (res.status === 404) throw new SampleLoadError('NotFound', `Sample not found: ${res.status}`, res.status);
        throw new SampleLoadError('Network', `Failed to load sample: ${res.status}`, res.status);
      }
      return await res.arrayBuffer();
    } catch (err: any) {
      if (err instanceof SampleLoadError) throw err;
      if (controller.signal.aborted) {
        throw new SampleLoadError(signal?.aborted ? 'Aborted' : 'Timeout', 'Sample request aborted or timed out.');
      }
      const message = err?.message || 'Fetch failed';
      if (/failed to fetch/i.test(message)) {
        throw new SampleLoadError('CORS', 'Sample request blocked (CORS/network).');
      }
      throw new SampleLoadError('Network', message);
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  };
  const entry: SampleCacheEntry = { promise: Promise.resolve(null as any), size: 0, lastUsed: nowStamp() };
  const retries = Math.max(0, options?.retries ?? 1);
  const timeoutMs = Math.max(2000, options?.timeoutMs ?? 12000);
  const promise = (async () => {
    let attempt = 0;
    while (true) {
      try {
        const buf = await fetchWithTimeout(data, timeoutMs, options?.signal);
        try {
          return await ctx.decodeAudioData(buf);
        } catch (err: any) {
          throw new SampleLoadError('DecodeError', err?.message || 'Decode failed.');
        }
      } catch (err) {
        if (attempt >= retries) throw err;
      }
      attempt += 1;
    }
  })()
    .then((buffer) => {
      entry.size = estimateBufferBytes(buffer);
      entry.lastUsed = nowStamp();
      evictSampleCache(cache!);
      return buffer;
    })
    .catch((err) => {
      cache!.delete(cacheKey);
      throw err;
    });

  entry.promise = promise;
  cache.set(cacheKey, entry);
  evictSampleCache(cache);
  return promise;
};

export const prefetchSampleBuffers = async (
  ctx: AudioContext,
  urls: string[],
  options?: { timeoutMs?: number; retries?: number }
) => {
  const tasks = urls.map((url) => getSampleBuffer(ctx, url, { timeoutMs: options?.timeoutMs, retries: options?.retries }));
  return Promise.allSettled(tasks);
};

export const getReversedBuffer = (ctx: AudioContext, buffer: AudioBuffer) => {
  if (reversedSampleCache.has(buffer)) return reversedSampleCache.get(buffer)!;
  const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = reversed.getChannelData(c);
    for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
      dst[i] = src[j];
    }
  }
  reversedSampleCache.set(buffer, reversed);
  return reversed;
};

export const getPingPongBuffer = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  loopStartSec: number,
  loopEndSec: number
) => {
  const start = clamp(loopStartSec, 0, buffer.duration);
  const end = clamp(loopEndSec, start, buffer.duration);
  if (end <= start) return buffer;
  const key = `${Math.round(start * 1000)}-${Math.round(end * 1000)}`;
  let cache = pingPongSampleCache.get(buffer);
  if (!cache) {
    cache = new Map();
    pingPongSampleCache.set(buffer, cache);
  }
  if (cache.has(key)) return cache.get(key)!;

  const rate = buffer.sampleRate;
  const startSample = Math.floor(start * rate);
  const endSample = Math.max(startSample + 1, Math.floor(end * rate));
  const segLength = endSample - startSample;
  const outLength = segLength * 2;
  const ping = ctx.createBuffer(buffer.numberOfChannels, outLength, rate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = ping.getChannelData(c);
    for (let i = 0; i < segLength; i++) {
      dst[i] = src[startSample + i];
      dst[segLength + i] = src[endSample - 1 - i];
    }
  }
  cache.set(key, ping);
  return ping;
};

// C2: Saturation Curve Generator
export const getSaturationCurve = (type: string, drive: number): Float32Array<ArrayBuffer> => {
  // Cache key needs type now
  const safeDrive = clamp(drive, 0.1, 10);
  const key = `${type}-${safeDrive.toFixed(2)}`;

  const cached = saturationCurveCache.get(key);
  if (cached) return cached;
  const samples = 4096;
  const curve = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    let y = x;

    switch (type) {
      case 'tanh':
        y = Math.tanh(x * safeDrive);
        break;
      case 'soft-clip':
        // x - x^3/3 logic
        if (Math.abs(x * safeDrive) < 1.5) {
          const val = x * safeDrive;
          y = val - (val * val * val) / 3;
        } else {
          y = Math.sign(x) * 1;
        }
        // Normalize max?
        y = Math.tanh(y); // Smooth tail
        break;
      case 'hard-clip':
        y = clamp(x * safeDrive, -1, 1);
        break;
      case 'diode': {
        const v = x * safeDrive;
        y = v >= 0 ? (1 - Math.exp(-v)) : -0.3 * (1 - Math.exp(v));
        break;
      }
      case 'wavefold': {
        const v = x * safeDrive;
        const folded = Math.abs(((v + 1) % 4) - 2) - 1;
        y = clamp(folded, -1, 1);
        break;
      }
      case 'sine-fold':
        y = Math.sin(x * safeDrive);
        break;
      case 'bit-crush':
        // Quantized steps
        const levels = Math.max(2, 16 / safeDrive);
        y = Math.round(x * levels) / levels;
        break;
      default:
        y = Math.tanh(x * safeDrive);
    }

    curve[i] = y;
  }
  saturationCurveCache.set(key, curve);
  return curve;
};

// D2: Simple Impulse Response (reusing existing or upgrading?)
// Existing getImpulseBuffer was simple noise. upgrading.
export const getImpulseBuffer = (
  ctx: AudioContext,
  decay: number,
  damping: number = 8000,
  preDelayMs: number = 0,
  stereoWidth: number = 1,
  tone: number = 0
) => {
  const key = `${decay.toFixed(2)}-${Math.round(damping)}-${preDelayMs}-${stereoWidth.toFixed(2)}-${tone.toFixed(2)}`;
  let cache = impulseCache.get(ctx);
  if (!cache) {
    cache = new Map();
    impulseCache.set(ctx, cache);
  }
  if (cache.has(key)) return cache.get(key)!;

  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * Math.max(0.1, decay)));
  const impulse = ctx.createBuffer(2, length, rate);
  const preDelaySamples = Math.floor((preDelayMs / 1000) * rate);
  const cutoff = clamp(damping, 200, Math.max(400, rate / 2 - 100));
  const dt = 1 / rate;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);

  for (let c = 0; c < 2; c++) {
    const channel = impulse.getChannelData(c);
    // Early reflections: short taps before tail
    const earlyTimesMs = [0, 7, 11, 17, 23, 31];
    earlyTimesMs.forEach((t, idx) => {
      const sample = Math.min(length - 1, preDelaySamples + Math.floor((t / 1000) * rate));
      const gain = (1 / (idx + 1)) * 0.6;
      const widthSign = c === 0 ? 1 : -1;
      const widthScale = 1 + (stereoWidth - 1) * (idx % 2 === 0 ? 0.5 : 1);
      channel[sample] += gain * widthScale * widthSign;
    });
    let prev = 0;
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        channel[i] = 0;
        continue;
      }
      const tIndex = i - preDelaySamples;
      const noise = (Math.random() * 2 - 1);
      prev = prev + alpha * (noise - prev); // one-pole lowpass for damping
      const env = Math.pow(1 - (tIndex / Math.max(1, (length - preDelaySamples))), Math.max(0.5, decay));
      const toneGain = 1 + tone * 0.25;
      channel[i] += prev * env * toneGain;
    }
  }
  cache.set(key, impulse);
  return impulse;
};

export const getTanhCurve = (drive: number): Float32Array<ArrayBuffer> => {
  return getSaturationCurve('tanh', drive);
};
