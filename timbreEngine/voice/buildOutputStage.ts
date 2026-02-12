import { getTanhCurve } from '../buffers';
import { incrementLimiterClipCounter } from '../engineState';
import type { VoiceRuntime } from './types';

export const buildOutputStage = (state: VoiceRuntime) => {
  const { ctx, now, nodes, voice } = state;

  let output: AudioNode = state.postAmp;
  const dcBlocker = ctx.createBiquadFilter();
  dcBlocker.type = 'highpass';
  dcBlocker.frequency.setValueAtTime(15, now);
  output.connect(dcBlocker);
  output = dcBlocker;
  nodes.push(dcBlocker);

  const clipper = ctx.createWaveShaper();
  clipper.curve = getTanhCurve(1.2);
  clipper.oversample = '2x';
  output.connect(clipper);
  output = clipper;
  nodes.push(clipper);

  let finalOut: AudioNode = output;
  if (typeof (ctx as any).createScriptProcessor === 'function') {
    const meter = (ctx as any).createScriptProcessor(256, 1, 1) as ScriptProcessorNode;
    meter.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        if (Math.abs(input[i]) >= 0.99) {
          incrementLimiterClipCounter();
          break;
        }
      }
      const outputBuf = event.outputBuffer.getChannelData(0);
      outputBuf.set(input);
    };
    finalOut.connect(meter);
    finalOut = meter;
    nodes.push(meter);
  }

  finalOut.connect(state.out);

  state.output = finalOut;

  state.lfoTargets = {
    overallGain: state.ampGainNode?.gain ?? null,
    filterCutoff: state.filterCutoffParam,
    filterType: null,
    filterSlope: null,
    harmonicBrightness: null,
    oddEvenBalance: null,
    inharmonicity: null,
    noiseAmount: state.noiseMixParam,
    noiseFilterHz: state.noiseFilterParam,
    noiseHighpassHz: state.noiseHighpassParam,
    noiseColor: null,
    fmDepth: state.fmDepthParam,
    ringModMix: state.ringMixParam,
    msegAmount: state.msegAmountParam,
    drive: state.driveParam,
    reverbMix: state.reverbMixParam,
    reverbPreDelay: state.reverbPreDelayParam,
    reverbDamping: state.reverbDampingParam,
    karplusFeedback: state.karplusFeedbackParam,
    karplusMix: state.karplusMixParam,
    karplusDamping: null,
    resonanceMix: state.resonanceMixParam,
    unisonDetune: state.unisonDetuneParam,
    unisonSpread: state.unisonSpreadParam,
    chorusMix: state.chorusMixParam,
    chorusRate: state.chorusRateParam,
    chorusDepth: state.chorusDepthParam,
    chorusFeedback: state.chorusFeedbackParam,
    phaserMix: state.phaserMixParam,
    phaserRate: state.phaserRateParam,
    phaserFeedback: state.phaserFeedbackParam,
    phaserStages: null,
    delayMix: state.delayMixParam,
    delayFeedback: state.delayFeedbackParams.length ? state.delayFeedbackParams : state.delayFeedbackParam,
    delayTime: state.delayTimeParams.length ? state.delayTimeParams : null,
    delayFilterHz: state.delayFilterParam,
    delayHighpassHz: state.delayHighpassParam,
    delayModDepth: state.delayModDepthParam,
    bitcrushMix: state.bitcrushMixParam,
    bitcrushRate: null,
    bitcrushDepth: null,
    granularMix: state.granularMixParam,
    granularPosition: null,
    granularDensity: null,
    granularPitch: null,
    filterQ: state.filterQParam,
    filterKeyTracking: null,
    filterLfoAmount: null,
    filterCombMix: state.combMixParam,
    filterCombFreq: null,
    filterCombFeedback: null,
    filterCombDamping: null,
    formantMorph: null,
    formantMix: state.formantMixParam,
    formantF1: state.formantFreqParams[0] ?? null,
    formantF2: state.formantFreqParams[1] ?? null,
    formantF3: state.formantFreqParams[2] ?? null,
    harmonicRolloff: null,
    harmonicJitter: null,
    harmonicCount: null,
    harmonicGroupWeight1: null,
    harmonicGroupWeight2: null,
    harmonicGroupWeight3: null,
    harmonicGroupWeight4: null,
    harmonicMaskLow: null,
    harmonicMaskHigh: null,
    reverbDecay: null,
    reverbSize: null,
    wavetableMorph: null,
    sampleStart: null
  };

  state.lfoConfig = {
    lfo1: voice.lfo.lfo1,
    lfo2: voice.lfo.lfo2,
    lfo3: voice.lfo.lfo3,
    lfo4: voice.lfo.lfo4
  };
};
