import { clamp } from './utils';

export const applyAdsr = (
  param: AudioParam,
  now: number,
  env: { attackMs: number; holdMs?: number; decayMs: number; sustain: number; releaseMs: number },
  peak: number
) => {
  const a = Math.max(0.001, env.attackMs / 1000);
  const h = Math.max(0, (env.holdMs || 0) / 1000);
  const d = Math.max(0.001, env.decayMs / 1000);
  const sustain = clamp(env.sustain, 0, 1);
  const sLevel = peak * sustain;

  param.cancelScheduledValues(now);
  param.setValueAtTime(0, now);
  param.linearRampToValueAtTime(peak, now + a);
  if (h > 0) {
    param.setValueAtTime(peak, now + a);
    param.setValueAtTime(peak, now + a + h);
  }
  param.exponentialRampToValueAtTime(Math.max(0.0001, sLevel), now + a + h + d);

  return (releaseOverride?: number) => {
    const r = Math.max(0.001, (releaseOverride ?? env.releaseMs) / 1000);
    const curr = param.value;
    try {
      param.cancelScheduledValues(Math.max(now, (param as any).context.currentTime));
      param.setTargetAtTime(0, Math.max(now, (param as any).context.currentTime), r / 3);
    } catch (e) {}
  };
};

export const applyFilterEnvelope = (
  param: AudioParam,
  now: number,
  env: { attackMs: number; holdMs?: number; decayMs: number; sustain: number; releaseMs: number; amount: number },
  base: number,
  min = 20,
  max = 20000
) => {
  const a = Math.max(0.001, env.attackMs / 1000);
  const h = Math.max(0, (env.holdMs || 0) / 1000);
  const d = Math.max(0.001, env.decayMs / 1000);
  const sustain = clamp(env.sustain, 0, 1);
  const baseFreq = clamp(base, min, max);
  const peak = clamp(baseFreq * Math.pow(2, env.amount), min, max);
  const sustainFreq = clamp(baseFreq * Math.pow(2, env.amount * sustain), min, max);

  param.cancelScheduledValues(now);
  param.setValueAtTime(baseFreq, now);
  param.exponentialRampToValueAtTime(Math.max(min, peak), now + a);
  if (h > 0) {
    param.setValueAtTime(Math.max(min, peak), now + a);
    param.setValueAtTime(Math.max(min, peak), now + a + h);
  }
  param.exponentialRampToValueAtTime(Math.max(min, sustainFreq), now + a + h + d);

  return (releaseOverride?: number) => {
    const r = Math.max(0.001, (releaseOverride ?? env.releaseMs) / 1000);
    try {
      const currTime = Math.max(now, (param as any).context.currentTime);
      param.cancelScheduledValues(currTime);
      param.setTargetAtTime(baseFreq, currTime, r / 3);
    } catch (e) {}
  };
};
