import type { AppSettings, TimbreModRoute, TimbreModSource, TimbrePatch } from '../../types';
import { applyCurve, applyVelocityCurve, clamp, computeKeyTracking, createRng, hashString } from '../utils';
import { accumulateMods, applyModToVoice } from '../modulation';
import {
  AUDIO_PARAM_TARGETS,
  EXPRESSION_SOURCES,
  LAST_NOTE_ON_BY_CONTEXT,
  getNextVoiceSerial,
  globalMods
} from '../engineState';
import type { TimbreContext, TimbreVoiceExpression } from '../engineState';
import { frequencyToMidi, resolveTempoBpm } from '../engineUtils';
import type { VoiceRuntime } from './types';

export type CreateVoiceStateInput = {
  ctx: AudioContext;
  out: AudioNode;
  freq: number;
  patch: TimbrePatch;
  settings: AppSettings;
  context: TimbreContext;
  startTime: number;
  noteKey: string;
  velocity: number;
  voiceMods?: TimbreVoiceExpression;
  fxQuality: 'high' | 'balanced' | 'performance';
};

export const createVoiceState = ({
  ctx,
  out,
  freq,
  patch,
  settings,
  context,
  startTime,
  noteKey,
  velocity,
  voiceMods,
  fxQuality
}: CreateVoiceStateInput): VoiceRuntime => {
  const now = startTime ?? ctx.currentTime;
  const voiceSerial = getNextVoiceSerial();
  const voiceId = `${patch.id}-${voiceSerial}-${now.toFixed(4)}`;

  const baseFreq = settings.baseFrequency || 440;
  const vel = applyVelocityCurve(velocity, patch.performance.velocityCurve);
  const keyTracking = computeKeyTracking(freq, baseFreq);
  const patchSeed = hashString(`${patch.id}`);
  const seed = hashString(`${patchSeed}|${noteKey}|${Math.round(freq * 100)}`);
  const voiceSeed = hashString(`${seed}|${voiceSerial}`);
  const rng = createRng(seed);
  const noteRandom = rng();
  const expressionValues: TimbreVoiceExpression = {
    modWheel: clamp(voiceMods?.modWheel ?? globalMods.modWheel, 0, 1),
    aftertouch: clamp(voiceMods?.aftertouch ?? globalMods.aftertouch, 0, 1),
    mpePressure: clamp(voiceMods?.mpePressure ?? globalMods.mpePressure, 0, 1),
    mpeTimbre: clamp(voiceMods?.mpeTimbre ?? globalMods.mpeTimbre, 0, 1),
    cc7: clamp(voiceMods?.cc7 ?? globalMods.cc7, 0, 1),
    cc74: clamp(voiceMods?.cc74 ?? globalMods.cc74, 0, 1),
    pitchBend: clamp(voiceMods?.pitchBend ?? globalMods.pitchBend, 0, 1)
  };

  const macroValues: Record<string, number> = {};
  patch.macros.forEach((macro, index) => {
    const source = macro.source;
    let value = macro.value;
    if (source === 'velocity') value = vel;
    if (source === 'noteRandom') value = noteRandom;
    if (source === 'keyTracking') value = keyTracking;
    if (source === 'modWheel') value = expressionValues.modWheel ?? 0;
    if (source === 'aftertouch') value = expressionValues.aftertouch ?? 0;
    if (source === 'mpePressure') value = expressionValues.mpePressure ?? 0;
    if (source === 'mpeTimbre') value = expressionValues.mpeTimbre ?? 0;
    if (source === 'cc7') value = expressionValues.cc7 ?? 0;
    if (source === 'cc74') value = expressionValues.cc74 ?? 0;
    if (source === 'pitchBend') value = expressionValues.pitchBend ?? 0.5;
    if (source === 'time') value = (ctx.currentTime % 4) / 4;
    const shaped = applyCurve(value, macro.curve ?? 'linear');
    const min = Number.isFinite(macro.min) ? macro.min : 0;
    const max = Number.isFinite(macro.max) ? macro.max : 1;
    const scaled = min + (max - min) * shaped;
    macroValues[`macro${index + 1}`] = clamp(scaled, 0, 1);
  });

  const sources: Record<TimbreModSource, number> = {
    velocity: vel,
    noteRandom,
    keyTracking,
    modWheel: expressionValues.modWheel ?? 0,
    aftertouch: expressionValues.aftertouch ?? 0,
    mpePressure: expressionValues.mpePressure ?? 0,
    mpeTimbre: expressionValues.mpeTimbre ?? 0,
    cc7: expressionValues.cc7 ?? 0,
    cc74: expressionValues.cc74 ?? 0,
    pitchBend: expressionValues.pitchBend ?? 0.5,
    time: (ctx.currentTime % 4) / 4,
    macro1: macroValues.macro1 ?? 0,
    macro2: macroValues.macro2 ?? 0,
    macro3: macroValues.macro3 ?? 0,
    macro4: macroValues.macro4 ?? 0,
    macro5: macroValues.macro5 ?? 0,
    macro6: macroValues.macro6 ?? 0,
    macro7: macroValues.macro7 ?? 0,
    macro8: macroValues.macro8 ?? 0,
    lfo1: 0,
    lfo2: 0,
    lfo3: 0,
    lfo4: 0,
    envAmp: 0,
    envFilter: 0,
    mseg: 0,
    randomHold: 0,
    randomSmooth: 0,
    noteAge: 0,
    releaseAge: 0,
    envelopeFollower: 0
  };

  const macroRoutes: TimbreModRoute[] = [];
  patch.macros.forEach((macro, index) => {
    const sourceId = `macro${index + 1}` as TimbreModSource;
    (macro.routes || []).forEach((route, routeIndex) => {
      macroRoutes.push({
        id: `${macro.id || sourceId}-route-${routeIndex}`,
        source: sourceId,
        target: route.target,
        depth: route.depth,
        curve: route.curve,
        bipolar: route.bipolar ?? false,
        offset: route.offset,
        scale: route.scale,
        clampMin: route.clampMin,
        clampMax: route.clampMax,
        deadzone: route.deadzone,
        invert: route.invert,
        smoothingMs: route.smoothingMs,
        blendMode: route.blendMode ?? route.combineMode,
        combineMode: route.combineMode ?? route.blendMode,
        curveAmount: route.curveAmount,
        curveSteps: route.curveSteps
      });
    });
  });
  const modMatrix = macroRoutes.length > 0 ? [...patch.modMatrix, ...macroRoutes] : patch.modMatrix;
  const { modAccum, lfoRoutes } = accumulateMods(
    { ...patch, modMatrix },
    sources,
    { dynamicSources: EXPRESSION_SOURCES, dynamicTargets: AUDIO_PARAM_TARGETS }
  );
  const voice = applyModToVoice(patch.voice, modAccum);
  const midiNote = frequencyToMidi(freq);
  const lastNote = LAST_NOTE_ON_BY_CONTEXT[context];
  const isLegato = lastNote ? (now - lastNote.time) < 0.08 : false;
  const legatoFrom = lastNote?.note ?? midiNote;
  LAST_NOTE_ON_BY_CONTEXT[context] = { note: midiNote, time: now };
  const tempoBpm = resolveTempoBpm(settings);
  const filterEnvAmount = Math.abs(voice.filter.envAmount ?? voice.envelopes.filter.amount ?? 0);
  const wantsEnvFilter = voice.envelopes.filter.enabled || filterEnvAmount > 0 || patch.modMatrix.some(r => r.source === 'envFilter');
  const wantsMseg = voice.mseg.enabled || patch.modMatrix.some(r => r.source === 'mseg');
  const wantsRandomHold = patch.modMatrix.some(r => r.source === 'randomHold' || r.source === 'randomSmooth');
  const wantsRandomSmooth = patch.modMatrix.some(r => r.source === 'randomSmooth');
  const wantsNoteAge = patch.modMatrix.some(r => r.source === 'noteAge');
  const wantsReleaseAge = patch.modMatrix.some(r => r.source === 'releaseAge');
  const wantsEnvelopeFollower = patch.modMatrix.some(r => r.source === 'envelopeFollower');
  const pitchBendRange = clamp(patch.performance.pitchBendRangeSemitones ?? 2, 0, 96);
  const expressionSourcesNeeded = new Set<TimbreModSource>();
  patch.modMatrix.forEach(route => {
    if (EXPRESSION_SOURCES.has(route.source) && AUDIO_PARAM_TARGETS.has(route.target)) {
      expressionSourcesNeeded.add(route.source);
    }
  });
  if (pitchBendRange > 0) expressionSourcesNeeded.add('pitchBend');

  const filterLfoAmount = clamp(voice.filter.lfoAmount ?? 0, 0, 1);
  if (filterLfoAmount > 0) {
    lfoRoutes.push({ source: 'lfo1', target: 'filterCutoff', depth: filterLfoAmount, curve: 'linear', bipolar: true });
  }

  const nodes: AudioNode[] = [];
  const stopFns: (() => void)[] = [];

  const sourceBus = ctx.createGain();
  sourceBus.gain.value = 1;
  nodes.push(sourceBus);

  const state: VoiceRuntime = {
    ctx,
    out,
    freq,
    patch,
    settings,
    context,
    startTime,
    noteKey,
    velocity,
    voiceMods,
    now,
    stopped: false,
    nodes,
    stopFns
  };

  state.fxQuality = fxQuality;
  state.voiceSerial = voiceSerial;
  state.voiceId = voiceId;
  state.baseFreq = baseFreq;
  state.vel = vel;
  state.keyTracking = keyTracking;
  state.patchSeed = patchSeed;
  state.seed = seed;
  state.voiceSeed = voiceSeed;
  state.rng = rng;
  state.noteRandom = noteRandom;
  state.expressionValues = expressionValues;
  state.macroValues = macroValues;
  state.sources = sources;
  state.modAccum = modAccum;
  state.lfoRoutes = lfoRoutes;
  state.voice = voice;
  state.midiNote = midiNote;
  state.isLegato = isLegato;
  state.legatoFrom = legatoFrom;
  state.tempoBpm = tempoBpm;
  state.wantsEnvFilter = wantsEnvFilter;
  state.wantsMseg = wantsMseg;
  state.wantsRandomHold = wantsRandomHold;
  state.wantsRandomSmooth = wantsRandomSmooth;
  state.wantsNoteAge = wantsNoteAge;
  state.wantsReleaseAge = wantsReleaseAge;
  state.wantsEnvelopeFollower = wantsEnvelopeFollower;
  state.pitchBendRange = pitchBendRange;
  state.expressionSourcesNeeded = expressionSourcesNeeded;

  state.filterReleaseEnv = null;
  state.noiseMixParam = null;
  state.driveParam = null;
  state.fmDepthParam = null;
  state.ringMixParam = null;
  state.msegAmountParam = null;
  state.karplusMixParam = null;
  state.karplusFeedbackParam = null;
  state.resonanceMixParam = null;
  state.reverbMixParam = null;
  state.reverbPreDelayParam = null;
  state.reverbDampingParam = null;
  state.chorusMixParam = null;
  state.chorusRateParam = null;
  state.chorusDepthParam = null;
  state.chorusFeedbackParam = null;
  state.phaserMixParam = null;
  state.phaserRateParam = null;
  state.phaserFeedbackParam = null;
  state.delayMixParam = null;
  state.delayFeedbackParam = null;
  state.delayFeedbackParams = [] as AudioParam[];
  state.delayTimeParams = [] as AudioParam[];
  state.delayFilterParam = null;
  state.delayHighpassParam = null;
  state.delayModDepthParam = null;
  state.unisonDetuneParam = null;
  state.unisonSpreadParam = null;
  state.filterCutoffParam = null;
  state.filterQParam = null;
  state.combMixParam = null;
  state.formantMixParam = null;
  state.formantFreqParams = [] as AudioParam[];
  state.noiseFilterParam = null;
  state.noiseHighpassParam = null;
  state.bitcrushMixParam = null;
  state.granularMixParam = null;

  state.expressionNodes = {};
  state.pitchBendGain = null;
  state.baseGain = 0;

  state.sourceBus = sourceBus;
  state.sampleAbort = new AbortController();
  state.sampleStops = [] as Array<() => void>;
  state.granularAbort = new AbortController();
  state.granularStop = null;

  return state;
};
