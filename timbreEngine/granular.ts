import { clamp } from './utils';
import { getSampleBuffer } from './buffers';

type GranularSettings = {
  enabled: boolean;
  sourceUrl?: string;
  grainSizeMs: number;
  density: number;
  position: number;
  positionJitter: number;
  pitch: number;
  spray: number;
  windowType: 'hann' | 'tri' | 'rect';
  freeze: boolean;
  mix: number;
};

type GranularHandle = {
  output: GainNode;
  stop: () => void;
  mixParam: AudioParam;
};

const buildWindow = (type: GranularSettings['windowType'], size: number) => {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i / Math.max(1, size - 1);
    if (type === 'tri') window[i] = 1 - Math.abs(2 * t - 1);
    else if (type === 'rect') window[i] = 1;
    else window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * t);
  }
  return window;
};

export const createGranularNode = async (
  ctx: AudioContext,
  settings: GranularSettings,
  options?: { signal?: AbortSignal; quality?: 'high' | 'balanced' | 'performance' }
): Promise<GranularHandle | null> => {
  if (!settings.enabled || !settings.sourceUrl) return null;
  const buffer = await getSampleBuffer(ctx, settings.sourceUrl, { signal: options?.signal });
  const output = ctx.createGain();
  output.gain.value = clamp(settings.mix, 0, 1);

  const grainSizeMs = clamp(settings.grainSizeMs, 10, 200);
  const density = clamp(settings.density, 1, 40);
  const basePosition = clamp(settings.position, 0, 1);
  const jitter = clamp(settings.positionJitter, 0, 1);
  const pitch = clamp(settings.pitch, -24, 24);
  const spray = clamp(settings.spray, 0, 1);
  const window = buildWindow(settings.windowType, Math.max(16, Math.floor((grainSizeMs / 1000) * buffer.sampleRate)));

  const maxGrains = options?.quality === 'performance' ? 8 : options?.quality === 'balanced' ? 16 : 24;
  let active = 0;
  let stopped = false;
  let frozenPosition = basePosition;

  const scheduleGrain = (time: number) => {
    if (stopped || active >= maxGrains) return;
    active += 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    const grainDur = grainSizeMs / 1000;
    const attack = grainDur * 0.25;
    gain.gain.linearRampToValueAtTime(1, time + attack);
    gain.gain.linearRampToValueAtTime(0, time + grainDur);

    const posBase = settings.freeze ? frozenPosition : basePosition;
    const jitterOffset = (Math.random() * 2 - 1) * jitter * 0.5;
    const pos = clamp(posBase + jitterOffset, 0, 1);
    const start = pos * Math.max(0.001, buffer.duration - grainDur);
    const rate = Math.pow(2, (pitch + (Math.random() * 2 - 1) * spray * 12) / 12);
    src.playbackRate.setValueAtTime(rate, time);
    src.connect(gain);
    gain.connect(output);
    src.start(time, start, grainDur);
    src.onended = () => { active = Math.max(0, active - 1); };
  };

  const tickMs = Math.max(10, 1000 / density);
  const timer = setInterval(() => {
    const now = ctx.currentTime;
    scheduleGrain(now + 0.01);
  }, tickMs);

  return {
    output,
    mixParam: output.gain,
    stop: () => {
      stopped = true;
      clearInterval(timer);
      try { output.disconnect(); } catch { }
    }
  };
};
