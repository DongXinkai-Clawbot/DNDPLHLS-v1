import { clamp } from '../utils';
import { estimateVoiceLevel } from '../engineUtils';
import { createSampleSource } from '../samplePlayer';
import { resolveReleaseSample } from '../sampleMapping';
import { ACTIVE_VOICES, registerActiveVoice } from '../engineState';
import type { VoiceHandle } from '../engineState';
import type { VoiceRuntime } from './types';

export const finalizeVoice = (state: VoiceRuntime) => {
  const {
    ctx,
    voice,
    patch,
    now,
    nodes,
    stopFns,
    sampleStops,
    sampleAbort,
    granularStop,
    granularAbort,
    midiNote,
    vel,
    freq,
    postAmp,
    releaseEnv,
    filterReleaseEnv
  } = state;

  const envSnapshot = {
    attackMs: voice.envelopes.amp.attackMs,
    decayMs: voice.envelopes.amp.decayMs,
    sustain: voice.envelopes.amp.sustain,
    releaseMs: voice.envelopes.amp.releaseMs
  };

  const voiceHandle: VoiceHandle = {
    id: state.voiceId,
    noteKey: state.noteKey,
    stop: () => { },
    startedAt: now,
    baseGain: state.baseGain,
    env: envSnapshot,
    expression: Object.keys(state.expressionNodes).length > 0 ? state.expressionNodes : undefined
  };

  let cleanupScheduled = false;
  const stop = (releaseOverrideMs?: number) => {
    if (state.stopped && releaseOverrideMs === undefined) return;
    const nowTime = ctx.currentTime;

    if (!state.stopped) {
      state.stopped = true;
      const level = estimateVoiceLevel(voiceHandle, nowTime);
      voiceHandle.releaseAt = nowTime;
      voiceHandle.releaseLevel = level;
    }

    if (sampleStops.length > 0) {
      sampleStops.forEach(stopFn => stopFn());
    }
    try { sampleAbort.abort(); } catch { }
    if (granularStop) {
      try { granularStop(); } catch { }
    }
    try { granularAbort.abort(); } catch { }

    if (state.sourceSignals?.releaseAge) {
      const rs = state.sourceSignals.releaseAge as ConstantSourceNode;
      try {
        rs.offset.cancelScheduledValues(nowTime);
        rs.offset.setValueAtTime(0, nowTime);
        rs.offset.linearRampToValueAtTime(1, nowTime + 1);
      } catch { }
    }

    if (voice.sample?.enabled && voice.sample.releaseSamples?.length) {
      const releaseRegion = resolveReleaseSample(voice.sample.releaseSamples, midiNote, vel);
      if (releaseRegion) {
        createSampleSource(ctx, {
          url: releaseRegion.url,
          gain: clamp(voice.sample.releaseMix ?? 0.5, 0, 1),
          pan: 0,
          tuneCents: 0,
          rootKey: voice.sample.layers?.[0]?.rootKey,
          startOffsetMs: releaseRegion.startOffsetMs,
          endTrimMs: releaseRegion.endTrimMs,
          loopMode: 'off'
        }, {
          freqHz: freq,
          velocity: vel,
          masterGain: clamp(voice.sample.masterGain, 0, 1.5),
          fadeInMs: 1,
          headroomDb: -3
        }).then((releaseSrc) => {
          const releaseGain = ctx.createGain();
          releaseGain.gain.setValueAtTime(1, ctx.currentTime);
          releaseSrc.output.connect(releaseGain);
          releaseGain.connect(postAmp);
          setTimeout(() => {
            try { releaseSrc.stop(ctx.currentTime + 0.01); } catch { }
            try { releaseGain.disconnect(); } catch { }
          }, 600);
          nodes.push(releaseGain);
        }).catch(() => {});
      }
    }

    const r = releaseOverrideMs ?? (patch.performance.releaseMode === 'cut' ? 40 : voice.envelopes.amp.releaseMs);
    releaseEnv(r);
    if (filterReleaseEnv) filterReleaseEnv(r);

    if (!cleanupScheduled) {
      cleanupScheduled = true;
      const cleanupDelay = Math.max(60, r + 120);
      setTimeout(() => {
        const idx = ACTIVE_VOICES.findIndex(v => v.id === state.voiceId);
        if (idx >= 0) ACTIVE_VOICES.splice(idx, 1);
        try { stopFns.forEach(fn => fn()); } catch { }
        try { nodes.forEach(n => (n as any).disconnect && (n as any).disconnect()); } catch { }
      }, cleanupDelay);
    }
  };

  voiceHandle.stop = stop;
  registerActiveVoice(voiceHandle);
  return stop;
};
