import { buildUnipolarCurve } from '../engineUtils';
import { applyAdsr } from '../envelopes';
import { clamp } from '../utils';
import { getSaturationCurve } from '../buffers';
import type { VoiceRuntime } from './types';

export const buildProcessingChain = (state: VoiceRuntime) => {
  const {
    ctx,
    patch,
    voice,
    now,
    nodes,
    sourceBus,
    freq,
    vel
  } = state;

  let chain: AudioNode = sourceBus;

  if (patch.routing.enableEq && voice.eq.enabled) {
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = voice.eq.lowFreq;
    lowShelf.gain.value = voice.eq.lowGain;

    const peaking = ctx.createBiquadFilter();
    peaking.type = 'peaking';
    peaking.frequency.value = voice.eq.midFreq;
    peaking.gain.value = voice.eq.midGain;
    peaking.Q.value = voice.eq.midQ;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = voice.eq.highFreq;
    highShelf.gain.value = voice.eq.highGain;

    chain.connect(lowShelf);
    lowShelf.connect(peaking);
    peaking.connect(highShelf);
    chain = highShelf;
    nodes.push(lowShelf, peaking, highShelf);
  }

  if (patch.routing.enableRingMod && voice.ringMod.enabled) {
    const ringOsc = ctx.createOscillator();
    ringOsc.type = voice.ringMod.waveform as OscillatorType;
    ringOsc.frequency.setValueAtTime(freq * voice.ringMod.ratio, now);
    if (state.pitchBendGain) {
      try { state.pitchBendGain.connect(ringOsc.detune); } catch { }
    }

    const rmMod = ctx.createGain();
    rmMod.gain.value = 0;

    const wet = ctx.createGain();
    wet.gain.setValueAtTime(clamp(voice.ringMod.mix, 0, 1), now);
    state.ringMixParam = wet.gain;
    const dry = ctx.createGain();
    dry.gain.setValueAtTime(1 - clamp(voice.ringMod.mix, 0, 1), now);
    const outMix = ctx.createGain();

    chain.connect(dry);
    chain.connect(rmMod);
    ringOsc.connect(rmMod.gain);
    rmMod.connect(wet);
    dry.connect(outMix);
    wet.connect(outMix);
    chain = outMix;

    ringOsc.start(now);
    stopFns.push(() => { try { ringOsc.stop(); } catch { } });
    nodes.push(ringOsc, wet, dry, outMix, rmMod);
  }

  let envFilterSig: ConstantSourceNode | null = null;
  let envFilterOut: AudioNode | null = null;

  if (state.wantsEnvFilter) {
    envFilterSig = ctx.createConstantSource();
    envFilterSig.offset.setValueAtTime(0, now);
    envFilterSig.start(now);
    applyAdsr(envFilterSig.offset, now, voice.envelopes.filter, 1);
    envFilterOut = envFilterSig;
    const filtCurve = voice.envelopes.filter.curve ?? 'linear';
    if (filtCurve !== 'linear' || voice.envelopes.filter.curveAmount || voice.envelopes.filter.curveSteps) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = buildUnipolarCurve(filtCurve, {
        pow: voice.envelopes.filter.curveAmount,
        steps: voice.envelopes.filter.curveSteps
      });
      envFilterSig.connect(shaper);
      envFilterOut = shaper;
      nodes.push(shaper);
    }
    nodes.push(envFilterSig);
  }
  state.envFilterSig = envFilterSig;
  state.envFilterOut = envFilterOut;

  if (patch.routing.enableFilter && voice.filter.enabled) {
    if (voice.filter.type === 'comb') {
      const comb = voice.filter.comb ?? { mix: 0.2, freqHz: 440, feedback: 0.3, dampingHz: 6000 };
      const delay = ctx.createDelay(0.05);
      const freqHz = clamp(comb.freqHz, 40, 20000);
      delay.delayTime.setValueAtTime(1 / freqHz, now);

      const feedback = ctx.createGain();
      feedback.gain.setValueAtTime(clamp(comb.feedback, 0, 0.99), now);

      const damping = ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.setValueAtTime(clamp(comb.dampingHz, 200, 12000), now);

      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(clamp(comb.mix, 0, 1), now);
      state.combMixParam = wet.gain;
      const dry = ctx.createGain();
      dry.gain.setValueAtTime(1 - clamp(comb.mix, 0, 1), now);
      const outMix = ctx.createGain();

      chain.connect(delay);
      delay.connect(wet);
      chain.connect(dry);
      wet.connect(outMix);
      dry.connect(outMix);
      chain = outMix;

      nodes.push(delay, feedback, damping, wet, dry, outMix);
    } else if (voice.filter.type === 'formant') {
      const formant = voice.filter.formant ?? { mix: 0.5, morph: 0, peaks: [] };
      const vowelMap: Record<string, Array<{ freq: number; q: number; gain: number }>> = {
        a: [{ freq: 800, q: 6, gain: 6 }, { freq: 1200, q: 7, gain: 4 }, { freq: 2500, q: 8, gain: 3 }],
        e: [{ freq: 500, q: 6, gain: 6 }, { freq: 1700, q: 7, gain: 4 }, { freq: 2500, q: 8, gain: 3 }],
        i: [{ freq: 300, q: 6, gain: 6 }, { freq: 2200, q: 7, gain: 4 }, { freq: 3000, q: 8, gain: 3 }],
        o: [{ freq: 500, q: 6, gain: 6 }, { freq: 900, q: 7, gain: 4 }, { freq: 2600, q: 8, gain: 3 }],
        u: [{ freq: 350, q: 6, gain: 6 }, { freq: 800, q: 7, gain: 4 }, { freq: 2200, q: 8, gain: 3 }]
      };
      const basePeaks = formant.peaks && formant.peaks.length > 0
        ? formant.peaks
        : (vowelMap[formant.vowel || 'a'] || vowelMap.a);
      const morphTarget = vowelMap['i'];
      const morph = clamp(formant.morph ?? 0, 0, 1);
      const resolvedPeaks = basePeaks.slice(0, 5).map((peak, idx) => {
        const target = morphTarget[idx % morphTarget.length];
        return {
          freq: peak.freq + (target.freq - peak.freq) * morph,
          q: peak.q + (target.q - peak.q) * morph,
          gain: peak.gain + (target.gain - peak.gain) * morph
        };
      });

      let formantIn: AudioNode = chain;
      state.formantFreqParams = [];
      resolvedPeaks.forEach((peak) => {
        const eq = ctx.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.setValueAtTime(clamp(peak.freq, 200, 5000), now);
        eq.Q.setValueAtTime(clamp(peak.q, 0.1, 20), now);
        eq.gain.setValueAtTime(clamp(peak.gain, -12, 18), now);
        state.formantFreqParams.push(eq.frequency);
        formantIn.connect(eq);
        formantIn = eq;
        nodes.push(eq);
      });

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(clamp(formant.mix ?? 0.5, 0, 1), now);
      state.formantMixParam = wet.gain;
      const dry = ctx.createGain();
      dry.gain.setValueAtTime(1 - clamp(formant.mix ?? 0.5, 0, 1), now);
      const outMix = ctx.createGain();

      chain.connect(dry);
      formantIn.connect(wet);
      wet.connect(outMix);
      dry.connect(outMix);
      chain = outMix;
      nodes.push(wet, dry, outMix);
    } else {
      const slope = voice.filter.slope || 12;
      const stages = slope === 24 ? 2 : 1;

      let trackFactor = 1;
      if (voice.filter.keyTracking !== 0) {
        const base = voice.filter.keyTrackingBaseHz ?? 261.63;
        const semitones = 12 * Math.log2(freq / base);
        trackFactor = Math.pow(2, (semitones * voice.filter.keyTracking) / 12);
      }
      const cutoffBase = clamp(voice.filter.cutoffHz * trackFactor, 10, 20000);

      let input = chain;
      let lastFilter: BiquadFilterNode;
      const filterType = (voice.filter.type === 'svf' ? 'lowpass' : voice.filter.type) as BiquadFilterType;

      for (let i = 0; i < stages; i++) {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType || 'lowpass';
        filter.Q.value = Math.max(0.1, voice.filter.q);
        filter.frequency.setValueAtTime(cutoffBase, now);

        const envAmount = (voice.filter.envAmount ?? voice.envelopes.filter.amount ?? 0);
        if (envFilterOut && envAmount !== 0) {
          const depthCents = envAmount * 12000;
          const modGain = ctx.createGain();
          modGain.gain.value = depthCents;
          envFilterOut.connect(modGain);
          modGain.connect(filter.detune);
          nodes.push(modGain);
        }

        input.connect(filter);
        lastFilter = filter;
        input = filter;
        nodes.push(filter);
      }
      chain = lastFilter!;
      state.filterCutoffParam = (chain as BiquadFilterNode).detune;
      state.filterQParam = (chain as BiquadFilterNode).Q;
    }
  }

  if (patch.routing.enableNonlinearity && voice.nonlinearity.enabled) {
    const drive = Math.max(0.1, voice.nonlinearity.drive);
    const type = voice.nonlinearity.type || 'tanh';

    const preGain = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.curve = getSaturationCurve(type, 1);
    preGain.gain.setValueAtTime(drive, now);
    state.driveParam = preGain.gain;

    shaper.oversample = '4x';

    const wet = ctx.createGain();
    let comp = 1;
    if (voice.nonlinearity.autoGain) {
      if (type === 'tanh') comp = 1 / Math.sqrt(drive);
      else if (type === 'soft-clip') comp = 1 / (1 + drive * 0.4);
      else if (type === 'hard-clip') comp = 1 / drive;
      else comp = 1 / Math.sqrt(drive);
    } else {
      comp = voice.nonlinearity.compensation ?? 1;
    }
    wet.gain.value = clamp(voice.nonlinearity.mix, 0, 1) * comp;

    const dry = ctx.createGain();
    dry.gain.value = 1 - clamp(voice.nonlinearity.mix, 0, 1);

    const outMix = ctx.createGain();

    chain.connect(preGain);
    preGain.connect(shaper);
    shaper.connect(wet);

    chain.connect(dry);

    wet.connect(outMix);
    dry.connect(outMix);
    let satOut: AudioNode = outMix;
    const trimDb = voice.nonlinearity.outputTrim ?? 0;
    if (trimDb !== 0) {
      const trim = ctx.createGain();
      trim.gain.value = Math.pow(10, trimDb / 20);
      outMix.connect(trim);
      satOut = trim;
      nodes.push(trim);
    }
    chain = satOut;
    nodes.push(preGain, shaper, wet, dry, outMix);
  }

  const envAmpSig = ctx.createConstantSource();
  envAmpSig.offset.setValueAtTime(0, now);
  envAmpSig.start(now);
  const releaseEnv = applyAdsr(envAmpSig.offset, now, voice.envelopes.amp, 1);
  let envAmpOut: AudioNode = envAmpSig;
  const ampCurve = voice.envelopes.amp.curve ?? 'linear';
  if (ampCurve !== 'linear' || voice.envelopes.amp.curveAmount || voice.envelopes.amp.curveSteps) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = buildUnipolarCurve(ampCurve, {
      pow: voice.envelopes.amp.curveAmount,
      steps: voice.envelopes.amp.curveSteps
    });
    envAmpSig.connect(shaper);
    envAmpOut = shaper;
    nodes.push(shaper);
  }
  nodes.push(envAmpSig);

  const ampGain = ctx.createGain();
  state.baseGain = clamp(voice.gain * vel * 0.25, 0, 1);
  ampGain.gain.setValueAtTime(0, now);

  const velGain = ctx.createGain();
  velGain.gain.setValueAtTime(state.baseGain, now);
  envAmpOut.connect(velGain);
  velGain.connect(ampGain.gain);
  nodes.push(velGain);

  chain.connect(ampGain);
  nodes.push(ampGain);

  let postAmp: AudioNode = ampGain;

  let msegSig: ConstantSourceNode | null = null;

  if (state.wantsMseg) {
    msegSig = ctx.createConstantSource();
    msegSig.start(now);
    const points = voice.mseg.points || [];
    if (points.length === 0) {
      msegSig.offset.setValueAtTime(0, now);
    } else {
      msegSig.offset.setValueAtTime(clamp(points[0].value, 0, 1), now);
      let t = now;
      points.forEach((pt, idx) => {
        if (idx === 0) return;
        t += Math.max(0, pt.timeMs) / 1000;
        msegSig!.offset.linearRampToValueAtTime(clamp(pt.value, 0, 1), t);
      });
    }
    nodes.push(msegSig);
  }

  if (patch.routing.enableMseg && voice.mseg.enabled && msegSig) {
    const amount = clamp(voice.mseg.amount, 0, 1);
    const dryBase = 1 - amount;

    const vca = ctx.createGain();
    vca.gain.value = 0;

    const dryConst = ctx.createConstantSource();
    dryConst.offset.value = dryBase;
    dryConst.start(now);
    dryConst.connect(vca.gain);
    nodes.push(dryConst);

    const wetGain = ctx.createGain();
    wetGain.gain.value = amount;
    state.msegAmountParam = wetGain.gain;
    msegSig.connect(wetGain);
    wetGain.connect(vca.gain);
    nodes.push(wetGain);

    postAmp.connect(vca);
    postAmp = vca;
    nodes.push(vca);
  }

  state.chain = chain;
  state.postAmp = postAmp;
  state.envAmpSig = envAmpSig;
  state.envAmpOut = envAmpOut;
  state.releaseEnv = releaseEnv;
  state.ampGainNode = ampGain;
  state.msegSig = msegSig;
};
