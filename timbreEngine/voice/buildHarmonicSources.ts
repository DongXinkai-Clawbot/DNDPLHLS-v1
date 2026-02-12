import { clamp, createRng } from '../utils';
import { computeHarmonicSpectrum, computePartialCount } from '../modulation';
import { getNoiseBuffer } from '../buffers';
import { SAFE_MIN_GAIN } from '../constants';
import type { VoiceRuntime } from './types';

export const buildHarmonicSources = (state: VoiceRuntime) => {
  const {
    ctx,
    patch,
    voice,
    settings,
    freq,
    now,
    nodes,
    stopFns,
    sourceBus,
    seed,
    voiceSeed
  } = state;
  const voiceCount = state.voiceCount ?? 1;

  const connectPitchBend = (param?: AudioParam | null) => {
    if (!state.pitchBendGain || !param) return;
    try {
      state.pitchBendGain.connect(param);
    } catch { }
  };

  const fmOscTargets: AudioParam[] = state.fmOscTargets || [];
  const fmHarmTargets: AudioParam[] = state.fmHarmTargets || [];
  state.fmOscTargets = fmOscTargets;
  state.fmHarmTargets = fmHarmTargets;

  if (patch.routing.enableHarmonic && voice.harmonic.enabled) {
    const partialCount = computePartialCount(patch, settings, ctx.sampleRate, freq, voiceCount);
    const jitterSeed = createRng(seed ^ 0xa5a5a5a5);
    const amplitudes = computeHarmonicSpectrum(voice, partialCount, jitterSeed, freq, ctx.sampleRate);
    const groupDecay = voice.harmonic.groupDecay;
    const spectral = voice.envelopes.spectralDecay;

    const phaseMode = voice.harmonic.phaseMode || 'locked';
    const notePhaseRng = createRng(seed ^ 0x9999);
    const voicePhaseRng = createRng(voiceSeed ^ 0x9999);

    for (let i = 0; i < amplitudes.length; i++) {
      const amp = amplitudes[i] * voice.harmonic.mix;
      if (amp <= 0) continue;
      const k = i + 1;
      const inh = voice.harmonic.inharmonicity * Math.pow(k / partialCount, voice.harmonic.inharmonicityCurve);
      const multiplier = k * (1 + inh);
      const partFreq = freq * multiplier;

      if (partFreq > ctx.sampleRate / 2) continue;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(partFreq, now);
      connectPitchBend(osc.detune);
      fmHarmTargets.push(osc.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(SAFE_MIN_GAIN, now);
      const rel = k / partialCount;
      const groupIndex = rel < 0.25 ? 0 : rel < 0.5 ? 1 : rel < 0.75 ? 2 : 3;
      const decayScaleRaw = 1 + spectral.amount * Math.pow(rel, spectral.curve);
      const decayScale = Math.min(decayScaleRaw, Math.max(1, spectral.maxMultiplier));
      const groupScale = groupDecay[groupIndex] ?? 1;
      const env = voice.envelopes.amp;
      const a = Math.max(0.001, env.attackMs / 1000);
      const d = Math.max(0.001, (env.decayMs / decayScale / groupScale) / 1000);
      const sustain = clamp(env.sustain, 0, 1);
      g.gain.exponentialRampToValueAtTime(Math.max(SAFE_MIN_GAIN, amp), now + a);
      g.gain.exponentialRampToValueAtTime(Math.max(SAFE_MIN_GAIN, amp * sustain), now + a + d);
      osc.connect(g);
      g.connect(sourceBus);

      let phaseCycles = (voice.harmonic.phase || 0);

      if (phaseMode === 'random' || phaseMode === 'randomPerNote') {
        phaseCycles += notePhaseRng();
      } else if (phaseMode === 'randomPerVoice') {
        phaseCycles += voicePhaseRng();
      } else if (phaseMode === 'spread') {
        const spread = voice.harmonic.phaseSpread || 0;
        phaseCycles += k * spread;
      } else {
        // locked
      }

      phaseCycles = phaseCycles % 1;
      if (phaseCycles < 0) phaseCycles += 1;

      const period = 1 / partFreq;
      const timeOffset = phaseCycles * period;

      osc.start(now + timeOffset);

      stopFns.push(() => { try { osc.stop(); } catch { } });
      nodes.push(g);
    }
  }

  if (patch.routing.enableFm && voice.fm.enabled) {
    let targets: AudioParam[] = [];
    if (voice.fm.target === 'harmonic') targets = fmHarmTargets;
    else if (voice.fm.target === 'all') targets = [...fmOscTargets, ...fmHarmTargets];
    else targets = fmOscTargets;
    if (targets.length > 0) {
      const fmOsc = ctx.createOscillator();
      fmOsc.type = voice.fm.waveform as OscillatorType;
      fmOsc.frequency.setValueAtTime(Math.max(0.01, freq * Math.max(0.1, voice.fm.ratio)), now);
      connectPitchBend(fmOsc.detune);
      const fmGain = ctx.createGain();
      fmGain.gain.setValueAtTime(Math.max(0, freq * clamp(voice.fm.depth, 0, 2)), now);
      state.fmDepthParam = fmGain.gain;
      fmOsc.connect(fmGain);
      targets.forEach(param => fmGain.connect(param));
      fmOsc.start(now);
      stopFns.push(() => { try { fmOsc.stop(); } catch { } });
      nodes.push(fmOsc, fmGain);
    }
  }

  if (patch.routing.enableNoise && voice.noise.enabled) {
    const noiseMaster = ctx.createGain();
    noiseMaster.gain.value = clamp(voice.noise.mix, 0, 1);
    state.noiseMixParam = noiseMaster.gain;
    nodes.push(noiseMaster);

    const color = clamp(voice.noise.color ?? 0, 0, 1);
    const colorHz = 20000 - color * 18000;
    const lowpassHz = voice.noise.filterHz > 0
      ? Math.min(clamp(voice.noise.filterHz, 100, 20000), colorHz)
      : colorHz;
    const highpassHz = clamp(voice.noise.highpassHz ?? 0, 0, 20000);

    const width = clamp(voice.noise.stereoWidth ?? 0, 0, 1);
    const panValues = width > 0 && ctx.createStereoPanner ? [-width, width] : [0];

    panValues.forEach((panValue, idx) => {
      const noiseSeed = seed ^ 0x4f1bbcdc ^ (idx * 0x1111);
      const noiseBuffer = getNoiseBuffer(ctx, noiseSeed);
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const burstGain = ctx.createGain();
      burstGain.gain.setValueAtTime(SAFE_MIN_GAIN, now);
      burstGain.gain.exponentialRampToValueAtTime(Math.max(SAFE_MIN_GAIN, voice.noise.burstAmount), now + 0.002);
      burstGain.gain.exponentialRampToValueAtTime(SAFE_MIN_GAIN, now + Math.max(0.01, voice.noise.burstDecayMs / 1000));

      const sustainGain = ctx.createGain();
      sustainGain.gain.setValueAtTime(Math.max(SAFE_MIN_GAIN, voice.noise.sustainAmount), now);

      const noiseMix = ctx.createGain();
      noiseMix.gain.setValueAtTime(1, now);

      noiseSrc.connect(burstGain);
      noiseSrc.connect(sustainGain);
      burstGain.connect(noiseMix);
      sustainGain.connect(noiseMix);

      let noisePost: AudioNode = noiseMix;
      if (lowpassHz < 20000) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(clamp(lowpassHz, 100, 20000), now);
        state.noiseFilterParam = state.noiseFilterParam ?? lp.frequency;
        noisePost.connect(lp);
        noisePost = lp;
        nodes.push(lp);
      }
      if (highpassHz > 0) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(clamp(highpassHz, 10, 20000), now);
        state.noiseHighpassParam = state.noiseHighpassParam ?? hp.frequency;
        noisePost.connect(hp);
        noisePost = hp;
        nodes.push(hp);
      }

      if (ctx.createStereoPanner && width > 0) {
        const panNode = ctx.createStereoPanner();
        panNode.pan.value = panValue;
        noisePost.connect(panNode);
        noisePost = panNode;
        nodes.push(panNode);
      }

      noisePost.connect(noiseMaster);
      noiseSrc.start(now);
      stopFns.push(() => { try { noiseSrc.stop(); } catch { } });
      nodes.push(noiseSrc, burstGain, sustainGain, noiseMix);
    });

    noiseMaster.connect(sourceBus);
  }

  if (patch.routing.enableKarplus && voice.karplus.enabled) {
    const delay = ctx.createDelay(1);
    const feedback = ctx.createGain();
    feedback.gain.setValueAtTime(clamp(voice.karplus.feedback, 0, 0.99), now);
    state.karplusFeedbackParam = feedback.gain;
    const damping = ctx.createBiquadFilter();
    damping.type = 'lowpass';
    damping.frequency.setValueAtTime(clamp(voice.karplus.dampingHz, 200, 12000), now);
    delay.connect(damping);
    damping.connect(feedback);
    feedback.connect(delay);

    const delayTime = voice.karplus.trackPitch ? Math.max(0.001, 1 / Math.max(20, freq)) : Math.max(0.001, voice.karplus.delayMs / 1000);
    delay.delayTime.setValueAtTime(delayTime, now);

    const exciterBuffer = getNoiseBuffer(ctx, seed ^ 0x517cc1b7);
    const exciter = ctx.createBufferSource();
    exciter.buffer = exciterBuffer;
    exciter.loop = true;
    const exciterGain = ctx.createGain();
    exciterGain.gain.setValueAtTime(Math.max(SAFE_MIN_GAIN, voice.karplus.exciterAmount), now);
    exciterGain.gain.exponentialRampToValueAtTime(SAFE_MIN_GAIN, now + Math.max(0.02, voice.karplus.exciterDecayMs / 1000));
    exciter.connect(exciterGain);
    exciterGain.connect(delay);
    exciter.start(now);
    stopFns.push(() => { try { exciter.stop(); } catch { } });

    const karplusMix = ctx.createGain();
    karplusMix.gain.setValueAtTime(clamp(voice.karplus.mix, 0, 1), now);
    state.karplusMixParam = karplusMix.gain;
    delay.connect(karplusMix);
    karplusMix.connect(sourceBus);
    nodes.push(delay, feedback, damping, karplusMix);
  }
};
