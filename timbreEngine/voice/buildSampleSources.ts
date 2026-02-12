import { clamp } from '../utils';
import { resolveSampleLayers, resolveLegatoTransition } from '../sampleMapping';
import { createSampleSource } from '../samplePlayer';
import { createGranularNode } from '../granular';
import type { VoiceRuntime } from './types';

export const buildSampleSources = (state: VoiceRuntime) => {
  const {
    ctx,
    voice,
    patch,
    midiNote,
    vel,
    voiceSeed,
    freq,
    sampleAbort,
    sampleStops,
    sourceBus,
    isLegato,
    legatoFrom,
    nodes,
    fxQuality
  } = state;

  if (voice.sample?.enabled) {
    const plans = resolveSampleLayers(voice.sample, midiNote, vel, voiceSeed);
    plans.forEach((plan) => {
      createSampleSource(ctx, plan, {
        freqHz: freq,
        velocity: vel,
        masterGain: clamp(voice.sample.masterGain, 0, 1.5),
        signal: sampleAbort.signal,
        fadeInMs: 3,
        headroomDb: -3
      }).then((source) => {
        if (state.stopped) return;
        source.output.connect(sourceBus);
        sampleStops.push(() => source.stop(ctx.currentTime + 0.01));
      }).catch(() => {});
    });

    if (isLegato && voice.sample.legatoTransitions?.length) {
      const transition = resolveLegatoTransition(voice.sample.legatoTransitions, legatoFrom, midiNote);
      if (transition) {
        createSampleSource(ctx, {
          url: transition.url,
          gain: 0.8,
          pan: 0,
          tuneCents: 0,
          rootKey: voice.sample.layers?.[0]?.rootKey,
          startOffsetMs: transition.startOffsetMs,
          endTrimMs: transition.endTrimMs,
          loopMode: 'off'
        }, {
          freqHz: freq,
          velocity: vel,
          masterGain: clamp(voice.sample.masterGain, 0, 1.5),
          signal: sampleAbort.signal,
          fadeInMs: 1,
          headroomDb: -3
        }).then((source) => {
          if (state.stopped) return;
          source.output.connect(sourceBus);
          sampleStops.push(() => source.stop(ctx.currentTime + 0.01));
        }).catch(() => {});
      }
    }
  }

  if (patch.routing.enableGranular && voice.granular?.enabled && voice.granular.sourceUrl) {
    createGranularNode(ctx, voice.granular, { signal: state.granularAbort.signal, quality: fxQuality })
      .then((handle) => {
        if (!handle || state.stopped) return;
        handle.output.connect(sourceBus);
        state.granularMixParam = handle.mixParam;
        state.granularStop = handle.stop;
        nodes.push(handle.output);
      })
      .catch(() => {});
  }
};
