import type { AppSettings, TimbrePatch } from '../types';
import { HARD_MAX_POLY } from './constants';
import { clamp } from './utils';
import { pickVoiceToSteal } from './engineUtils';
import {
  ACTIVE_VOICES,
  clearTimbreEngineError,
  reportTimbreEngineError
} from './engineState';
import { createVoiceState } from './voice/createVoiceState';
import { buildSampleSources } from './voice/buildSampleSources';
import { buildExpressionNodes } from './voice/buildExpressionNodes';
import { buildOscillators } from './voice/buildOscillators';
import { buildHarmonicSources } from './voice/buildHarmonicSources';
import { buildProcessingChain } from './voice/buildProcessingChain';
import { buildEffectsChain } from './voice/buildEffectsChain';
import { buildOutputStage } from './voice/buildOutputStage';
import { buildModulation } from './voice/buildModulation';
import { finalizeVoice } from './voice/finalizeVoice';
import type { TimbreContext, TimbreVoiceExpression } from './engineState';

export const startTimbreVoice = (
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  patch: TimbrePatch,
  settings: AppSettings,
  context: TimbreContext,
  startTime: number,
  noteKey: string,
  velocity: number,
  voiceMods?: TimbreVoiceExpression
) => {
  try {
    const now = startTime ?? ctx.currentTime;
    clearTimbreEngineError();

    const layers = Array.isArray(patch.layers) ? patch.layers : [];
    if (layers.length > 0 && !(patch as any).__layered) {
      const soloed = layers.filter(layer => layer.solo);
      const activeLayers = (soloed.length > 0 ? soloed : layers).filter(layer => !layer.mute);
      const stops: Array<() => void> = [];
      const layerNodes: AudioNode[] = [];
      activeLayers.forEach((layer, index) => {
        const layerGain = ctx.createGain();
        layerGain.gain.setValueAtTime(clamp(layer.level ?? 1, 0, 2), now);
        let layerOut: AudioNode = layerGain;
        if (ctx.createStereoPanner && Math.abs(layer.pan ?? 0) > 0.001) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = clamp(layer.pan ?? 0, -1, 1);
          layerGain.connect(panner);
          layerOut = panner;
          layerNodes.push(panner);
        }
        layerOut.connect(out);
        layerNodes.push(layerGain);

        const tune = layer.tuneCents ?? 0;
        const layerFreq = freq * Math.pow(2, tune / 1200);
        const layerPatch: TimbrePatch = {
          ...patch,
          layers: undefined,
          voice: { ...patch.voice, ...(layer.voiceOverride || {}) }
        };
        (layerPatch as any).__layered = true;
        const stopLayer = startTimbreVoice(ctx, layerGain, layerFreq, layerPatch, settings, context, startTime, `${noteKey}-layer-${index}`, velocity, voiceMods);
        stops.push(stopLayer);
      });
      return () => {
        stops.forEach(stop => stop());
        layerNodes.forEach(node => {
          try { (node as any).disconnect && (node as any).disconnect(); } catch { }
        });
      };
    }

    const maxPoly = Math.min(patch.performance.polyphony, settings.timbre.performance.maxPolyphony, HARD_MAX_POLY);
    const stealStrategy = patch.performance.voiceSteal || settings.timbre.performance.voiceSteal || 'release-first';
    const voiceCount = ACTIVE_VOICES.length + 1;
    const qualityMode = settings.timbre.performance.qualityMode ?? 'balanced';
    const autoReduce = settings.timbre.performance.autoReduce;
    const polyLoad = maxPoly > 0 ? clamp(voiceCount / maxPoly, 0, 2) : 0;
    let fxQuality: 'high' | 'balanced' | 'performance' = qualityMode;
    if (autoReduce && polyLoad > 0.65) fxQuality = qualityMode === 'high' ? 'balanced' : 'performance';
    if (autoReduce && polyLoad > 0.85) fxQuality = 'performance';
    let availableCount = ACTIVE_VOICES.length;
    let guard = 0;
    while (availableCount >= maxPoly && guard < 128) {
      const candidate = pickVoiceToSteal(ACTIVE_VOICES, stealStrategy as any, now);
      if (!candidate) break;
      candidate.stealPending = true;
      candidate.stop(15);
      availableCount -= 1;
      guard += 1;
    }

    const state = createVoiceState({
      ctx,
      out,
      freq,
      patch,
      settings,
      context,
      startTime: now,
      noteKey,
      velocity,
      voiceMods,
      fxQuality
    });
    state.voiceCount = voiceCount;

    buildSampleSources(state);
    buildExpressionNodes(state);
    buildOscillators(state);
    buildHarmonicSources(state);
    buildProcessingChain(state);
    buildEffectsChain(state);
    buildOutputStage(state);
    buildModulation(state);

    return finalizeVoice(state);
  } catch (err: any) {
    reportTimbreEngineError(err?.message || 'Timbre engine failed to start.');
    return () => { };
  }
};
