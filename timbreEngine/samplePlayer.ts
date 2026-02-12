import { clamp } from './utils';
import { getSampleBuffer, getPingPongBuffer } from './buffers';
import type { SamplePlaybackPlan } from './sampleMapping';

type SamplePlaybackOptions = {
  freqHz: number;
  velocity: number;
  masterGain: number;
  rootKeyFallbackHz?: number;
  signal?: AbortSignal;
  fadeInMs?: number;
  headroomDb?: number;
};

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, DB: 1,
  D: 2, 'D#': 3, EB: 3,
  E: 4, F: 5, 'F#': 6, GB: 6,
  G: 7, 'G#': 8, AB: 8,
  A: 9, 'A#': 10, BB: 10,
  B: 11
};

const parseRootKeyToHz = (rootKey?: string, fallbackHz: number = 440) => {
  if (!rootKey) return fallbackHz;
  const match = rootKey.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return fallbackHz;
  const name = `${match[1].toUpperCase()}${match[2] || ''}`;
  const semitone = NOTE_TO_SEMITONE[name];
  if (!Number.isFinite(semitone)) return fallbackHz;
  const octave = parseInt(match[3], 10);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

const applyLoopCrossfade = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  loopStart: number,
  loopEnd: number,
  xfadeMs: number
) => {
  const start = clamp(loopStart, 0, buffer.duration);
  const end = clamp(loopEnd, start, buffer.duration);
  if (xfadeMs <= 0 || end <= start) return buffer;
  const xfadeSamples = Math.max(1, Math.floor((xfadeMs / 1000) * buffer.sampleRate));
  const startSample = Math.floor(start * buffer.sampleRate);
  const endSample = Math.floor(end * buffer.sampleRate);
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src);
    const fadeStart = Math.max(startSample, endSample - xfadeSamples);
    for (let i = 0; i < xfadeSamples; i++) {
      const idxEnd = fadeStart + i;
      const idxStart = startSample + i;
      if (idxEnd >= dst.length || idxStart >= dst.length) break;
      const t = i / xfadeSamples;
      const fadeOut = 1 - t;
      const fadeIn = t;
      dst[idxEnd] = dst[idxEnd] * fadeOut + dst[idxStart] * fadeIn;
    }
  }
  return out;
};

export const createSampleSource = async (
  ctx: AudioContext,
  plan: SamplePlaybackPlan,
  options: SamplePlaybackOptions
) => {
  const buffer = await getSampleBuffer(ctx, plan.url, { signal: options.signal });
  const rootHz = parseRootKeyToHz(plan.rootKey, options.rootKeyFallbackHz || 440);
  const targetHz = Math.max(20, options.freqHz);
  const tuneRatio = Math.pow(2, (plan.tuneCents || 0) / 1200);
  const rate = clamp((targetHz / Math.max(20, rootHz)) * tuneRatio, 0.01, 16);

  const source = ctx.createBufferSource();
  let resolved = buffer;

  const loopMode = plan.loopMode || 'off';
  const loopStartSec = plan.loopStart !== undefined
    ? plan.loopStart <= 1 ? plan.loopStart * buffer.duration : plan.loopStart
    : 0;
  const loopEndSec = plan.loopEnd !== undefined
    ? plan.loopEnd <= 1 ? plan.loopEnd * buffer.duration : plan.loopEnd
    : buffer.duration;

  if (loopMode === 'pingpong') {
    resolved = getPingPongBuffer(ctx, buffer, loopStartSec, loopEndSec);
  } else if (plan.loopXfadeMs && plan.loopXfadeMs > 0) {
    resolved = applyLoopCrossfade(ctx, buffer, loopStartSec, loopEndSec, plan.loopXfadeMs);
  }

  source.buffer = resolved;
  source.playbackRate.setValueAtTime(rate, ctx.currentTime);

  if (loopMode !== 'off') {
    source.loop = true;
    if (loopMode === 'pingpong') {
      source.loopStart = 0;
      source.loopEnd = resolved.duration;
    } else {
      source.loopStart = clamp(loopStartSec, 0, resolved.duration);
      source.loopEnd = clamp(loopEndSec, source.loopStart, resolved.duration);
    }
  }

  const headroom = Math.pow(10, (options.headroomDb ?? -3) / 20);
  const vel = clamp(options.velocity, 0, 1);
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  const fade = Math.max(1, options.fadeInMs ?? 3);
  gainNode.gain.linearRampToValueAtTime(
    clamp(plan.gain * options.masterGain * vel * headroom, 0, 2),
    ctx.currentTime + fade / 1000
  );

  let outNode: AudioNode = gainNode;
  if (ctx.createStereoPanner && Math.abs(plan.pan || 0) > 0.001) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(plan.pan, -1, 1);
    gainNode.connect(panner);
    outNode = panner;
  }

  source.connect(gainNode);

  const startOffset = plan.startOffsetMs ? plan.startOffsetMs / 1000 : 0;
  const endTrimSec = plan.endTrimMs ? plan.endTrimMs / 1000 : 0;
  const maxDuration = Math.max(0, resolved.duration - endTrimSec - startOffset);
  if (source.loop) {
    source.start(ctx.currentTime, clamp(startOffset, 0, resolved.duration));
  } else {
    source.start(ctx.currentTime, clamp(startOffset, 0, resolved.duration), maxDuration);
  }

  return {
    output: outNode,
    stop: (when: number) => {
      try { source.stop(when); } catch { }
    }
  };
};
