import { clamp } from '../utils';
import { divisionToHz, divisionToSeconds } from '../engineUtils';
import { getImpulseBuffer } from '../buffers';
import type { VoiceRuntime } from './types';

export const buildEffectsChain = (state: VoiceRuntime) => {
  const {
    ctx,
    patch,
    voice,
    now,
    nodes,
    stopFns
  } = state;

  let postAmp: AudioNode = state.postAmp;

  if (patch.routing.enableChorus && voice.chorus.enabled) {
    const chorusDelay = ctx.createDelay(0.1);
    chorusDelay.delayTime.value = voice.chorus.delay;
    const chorusFeedback = ctx.createGain();
    chorusFeedback.gain.value = clamp(voice.chorus.feedback, 0, 0.95);
    state.chorusFeedbackParam = chorusFeedback.gain;

    const chorusLfo = ctx.createOscillator();
    const chorusRate = voice.chorus.sync ? divisionToHz(state.tempoBpm, voice.chorus.syncDivision) : voice.chorus.rate;
    chorusLfo.frequency.value = Math.max(0.01, chorusRate);
    state.chorusRateParam = chorusLfo.frequency;

    const chorusDepth = ctx.createGain();
    chorusDepth.gain.value = voice.chorus.depth * 0.005;
    state.chorusDepthParam = chorusDepth.gain;

    chorusLfo.connect(chorusDepth);
    chorusDepth.connect(chorusDelay.delayTime);
    chorusDelay.connect(chorusFeedback);
    chorusFeedback.connect(chorusDelay);
    chorusLfo.start(now);
    stopFns.push(() => { try { chorusLfo.stop(); } catch { } });

    const wet = ctx.createGain();
    wet.gain.value = voice.chorus.mix;
    state.chorusMixParam = wet.gain;
    const dry = ctx.createGain();
    dry.gain.value = 1 - voice.chorus.mix;
    const outMix = ctx.createGain();

    postAmp.connect(dry);
    postAmp.connect(chorusDelay);
    chorusDelay.connect(wet);
    dry.connect(outMix);
    wet.connect(outMix);
    postAmp = outMix;
    nodes.push(chorusDelay, chorusFeedback, chorusLfo, chorusDepth, wet, dry, outMix);
  }

  if (patch.routing.enablePhaser && voice.phaser.enabled) {
    const stages = voice.phaser.stages || 4;
    let phaserIn: AudioNode = postAmp;
    const lfo = ctx.createOscillator();
    const phaserRate = voice.phaser.sync ? divisionToHz(state.tempoBpm, voice.phaser.syncDivision) : voice.phaser.rate;
    lfo.frequency.value = Math.max(0.01, phaserRate);
    state.phaserRateParam = lfo.frequency;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = voice.phaser.depth * 1000;
    lfo.connect(lfoGain);
    lfo.start(now);
    stopFns.push(() => { try { lfo.stop(); } catch { } });

    let firstFilter: BiquadFilterNode | null = null;
    let lastFilter: BiquadFilterNode | null = null;
    for (let i = 0; i < stages; i++) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'allpass';
      filter.frequency.value = voice.phaser.baseHz;
      lfoGain.connect(filter.frequency);
      if (!firstFilter) firstFilter = filter;
      if (lastFilter) lastFilter.connect(filter);
      else phaserIn.connect(filter);
      lastFilter = filter;
      nodes.push(filter);
    }

    if (lastFilter) {
      if (firstFilter && voice.phaser.feedback > 0) {
        const fb = ctx.createGain();
        fb.gain.value = clamp(voice.phaser.feedback, 0, 0.95);
        state.phaserFeedbackParam = fb.gain;
        lastFilter.connect(fb);
        fb.connect(firstFilter);
        nodes.push(fb);
      }

      const wet = ctx.createGain();
      wet.gain.value = voice.phaser.mix;
      state.phaserMixParam = wet.gain;
      const dry = ctx.createGain();
      dry.gain.value = 1 - voice.phaser.mix;
      const outMix = ctx.createGain();
      postAmp.connect(dry);
      lastFilter.connect(wet);
      dry.connect(outMix);
      wet.connect(outMix);
      postAmp = outMix;
      nodes.push(wet, dry, outMix, lfo, lfoGain);
    }
  }

  if (patch.routing.enableBitcrush && voice.bitcrush.enabled) {
    const depth = clamp(voice.bitcrush.depth ?? 0.4, 0, 1);
    const bitDepth = clamp(voice.bitcrush.bitDepth ?? Math.round(2 + (1 - depth) * 14), 2, 16);
    const hold = Math.max(1, Math.round(voice.bitcrush.sampleRateReduce ?? 1));
    const jitter = clamp(voice.bitcrush.jitter ?? 0, 0, 1);

    let crushNode: AudioNode;
    if (typeof (ctx as any).createScriptProcessor === 'function' && (hold > 1 || jitter > 0 || bitDepth < 16)) {
      const processor = (ctx as any).createScriptProcessor(256, 1, 1) as ScriptProcessorNode;
      let counter = 0;
      let held = 0;
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const output = event.outputBuffer.getChannelData(0);
        const levels = Math.pow(2, bitDepth);
        for (let i = 0; i < input.length; i++) {
          if (counter <= 0) {
            held = input[i];
            const jitterOffset = jitter > 0 ? Math.floor(jitter * Math.random() * hold) : 0;
            counter = hold + jitterOffset;
          }
          counter -= 1;
          output[i] = Math.round(held * levels) / levels;
        }
      };
      crushNode = processor;
    } else {
      const steps = Math.pow(2, bitDepth);
      const shaper = ctx.createWaveShaper();
      const samples = 2048;
      const curve = new Float32Array(samples);
      for (let i = 0; i < samples; ++i) {
        const x = (i * 2) / samples - 1;
        curve[i] = Math.round(x * steps) / steps;
      }
      shaper.curve = curve;
      shaper.oversample = 'none';
      crushNode = shaper;
    }

    const wet = ctx.createGain();
    wet.gain.value = clamp(voice.bitcrush.mix, 0, 1);
    state.bitcrushMixParam = wet.gain;
    const dry = ctx.createGain();
    dry.gain.value = 1 - clamp(voice.bitcrush.mix, 0, 1);
    const outMix = ctx.createGain();

    postAmp.connect(crushNode);
    crushNode.connect(wet);
    postAmp.connect(dry);
    wet.connect(outMix);
    dry.connect(outMix);
    postAmp = outMix;
    nodes.push(crushNode, wet, dry, outMix);
  }

  if (patch.routing.enableDelay && voice.delay.enabled) {
    const delayQuality = state.fxQuality;
    const delayType = delayQuality === 'performance'
      ? 'stereo'
      : (voice.delay.type || (voice.delay.pingPong ? 'pingpong' : 'stereo'));
    const delayL = ctx.createDelay(2);
    const delayR = ctx.createDelay(2);
    const baseDelayMs = voice.delay.sync
      ? divisionToSeconds(state.tempoBpm, voice.delay.syncDivision) * 1000
      : voice.delay.timeMs;
    const width = clamp(voice.delay.stereoWidth ?? 1, 0, 2);
    delayL.delayTime.value = Math.max(0.001, baseDelayMs / 1000);
    delayR.delayTime.value = Math.max(0.001, (baseDelayMs + voice.delay.stereoOffsetMs * width) / 1000);
    state.delayTimeParams = [delayL.delayTime, delayR.delayTime];

    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    const feedbackLimit = delayQuality === 'performance' ? 0.6 : 0.95;
    const feedback = clamp(voice.delay.feedback, 0, feedbackLimit);
    fbL.gain.value = feedback;
    fbR.gain.value = feedback;
    state.delayFeedbackParam = fbL.gain;
    state.delayFeedbackParams = [fbL.gain, fbR.gain];

    const lowpassHz = voice.delay.filterHz || voice.delay.color || 20000;
    const effectiveLowpass = delayQuality === 'performance' ? Math.min(lowpassHz, 8000) : lowpassHz;
    const colorL = ctx.createBiquadFilter();
    const colorR = ctx.createBiquadFilter();
    colorL.type = 'lowpass';
    colorR.type = 'lowpass';
    colorL.frequency.value = clamp(effectiveLowpass, 50, 20000);
    colorR.frequency.value = clamp(effectiveLowpass, 50, 20000);
    state.delayFilterParam = colorL.frequency;

    const hpHz = clamp(voice.delay.filterHighpassHz ?? 0, 0, 8000);
    const hpL = ctx.createBiquadFilter();
    const hpR = ctx.createBiquadFilter();
    hpL.type = 'highpass';
    hpR.type = 'highpass';
    hpL.frequency.value = hpHz > 0 ? hpHz : 20;
    hpR.frequency.value = hpHz > 0 ? hpHz : 20;
    if (hpHz > 0) state.delayHighpassParam = hpL.frequency;

    const modDepth = delayQuality === 'performance' ? 0 : (voice.delay.modDepth || 0);
    if (modDepth > 0) {
      const modLfo = ctx.createOscillator();
      modLfo.frequency.value = voice.delay.modRate || 0.5;
      const modGain = ctx.createGain();
      modGain.gain.value = modDepth * 0.005;
      state.delayModDepthParam = modGain.gain;
      modLfo.connect(modGain);
      modGain.connect(delayL.delayTime);

      const modGainR = ctx.createGain();
      modGainR.gain.value = modDepth * 0.005;
      modLfo.connect(modGainR);
      modGainR.connect(delayR.delayTime);

      modLfo.start(now);
      stopFns.push(() => { try { modLfo.stop(); } catch { } });
      nodes.push(modLfo, modGain, modGainR);
    }

    delayL.connect(colorL);
    colorL.connect(hpL);
    hpL.connect(fbL);
    fbL.connect(delayL);

    delayR.connect(colorR);
    colorR.connect(hpR);
    hpR.connect(fbR);
    fbR.connect(delayR);

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    postAmp.connect(splitter);

    if (delayType === 'pingpong') {
      fbL.disconnect(); fbR.disconnect();
      hpL.connect(fbL); fbL.connect(delayR);
      hpR.connect(fbR); fbR.connect(delayL);
    } else if (delayType === 'cross') {
      const crossL = ctx.createGain(); crossL.gain.value = feedback * 0.5;
      const crossR = ctx.createGain(); crossR.gain.value = feedback * 0.5;
      hpL.connect(crossL); crossL.connect(delayR);
      hpR.connect(crossR); crossR.connect(delayL);
      nodes.push(crossL, crossR);
    }

    splitter.connect(delayL, 0);
    splitter.connect(delayR, 1);

    const wet = ctx.createGain();
    wet.gain.value = clamp(voice.delay.mix, 0, 1);
    state.delayMixParam = wet.gain;
    const dry = ctx.createGain();
    dry.gain.value = 1 - clamp(voice.delay.mix, 0, 1);

    delayL.connect(merger, 0, 0);
    delayR.connect(merger, 0, 1);

    if (voice.delay.ducking && voice.delay.ducking > 0) {
      const abs = ctx.createWaveShaper();
      abs.curve = new Float32Array([1, 0, 1]);
      postAmp.connect(abs);

      const followFilter = ctx.createBiquadFilter();
      followFilter.type = 'lowpass';
      followFilter.frequency.value = 10;
      abs.connect(followFilter);

      const ducker = ctx.createGain();
      const duckScale = ctx.createGain();
      duckScale.gain.value = -1 * clamp(voice.delay.ducking, 0, 1) * 4;
      followFilter.connect(duckScale);

      ducker.gain.value = 1;
      duckScale.connect(ducker.gain);

      merger.connect(ducker);
      ducker.connect(wet);
      nodes.push(abs, followFilter, ducker, duckScale);
    } else {
      merger.connect(wet);
    }

    postAmp.connect(dry);
    const outMix = ctx.createGain();
    wet.connect(outMix);
    dry.connect(outMix);
    postAmp = outMix;
    nodes.push(delayL, delayR, fbL, fbR, colorL, colorR, hpL, hpR, splitter, merger, wet, dry, outMix);
  }

  if (patch.routing.enableSpace) {
    if (voice.space.resonance.enabled && voice.space.resonance.mix > 0) {
      const delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      const damping = ctx.createBiquadFilter();
      delay.delayTime.setValueAtTime(Math.max(0.001, voice.space.resonance.delayMs / 1000), now);
      feedback.gain.setValueAtTime(clamp(voice.space.resonance.feedback, 0, 0.95), now);
      damping.type = 'lowpass';
      damping.frequency.setValueAtTime(clamp(voice.space.resonance.dampingHz, 200, 12000), now);
      delay.connect(damping);
      damping.connect(feedback);
      feedback.connect(delay);

      const wet = ctx.createGain();
      wet.gain.setValueAtTime(clamp(voice.space.resonance.mix, 0, 1), now);
      state.resonanceMixParam = wet.gain;

      postAmp.connect(delay);
      delay.connect(wet);

      const mixer = ctx.createGain();
      postAmp.connect(mixer);
      wet.connect(mixer);
      postAmp = mixer;
      nodes.push(delay, feedback, damping, wet, mixer);
    }

    if (voice.space.reverb.enabled && voice.space.reverb.mix > 0) {
      const reverbQuality = state.fxQuality;
      const size = clamp(voice.space.reverb.size ?? 0.5, 0, 1);
      const decayRaw = clamp(voice.space.reverb.decay, 0.1, 20);
      const decay = reverbQuality === 'performance'
        ? Math.min(decayRaw, 1.6)
        : reverbQuality === 'balanced'
          ? Math.min(decayRaw, 8)
          : decayRaw;
      const scaledDecay = decay * (0.6 + size * 1.4);

      const preDelay = ctx.createDelay(1);
      const basePreDelayMs = clamp(voice.space.reverb.preDelayMs ?? 0, 0, 500);
      const preDelaySec = (basePreDelayMs / 1000) + size * 0.02;
      preDelay.delayTime.setValueAtTime(preDelaySec, now);
      state.reverbPreDelayParam = preDelay.delayTime;

      const conv = ctx.createConvolver();
      const dampingHz = clamp(voice.space.reverb.dampingHz ?? 5000, 200, 16000);
      const effectiveDamping = reverbQuality === 'performance' ? Math.min(dampingHz, 5000) : dampingHz;
      try {
        const width = clamp(voice.space.reverb.stereoWidth ?? 1, 0.2, 2);
        const toneKey = clamp((voice.space.reverb.color ?? 0) / 10000, -1, 1);
        const buffer = getImpulseBuffer(ctx, scaledDecay, effectiveDamping, basePreDelayMs, width, toneKey);
        conv.buffer = buffer;
      } catch { }

      const damping = ctx.createBiquadFilter();
      damping.type = 'lowpass';
      damping.frequency.value = effectiveDamping;
      state.reverbDampingParam = damping.frequency;

      const tone = ctx.createBiquadFilter();
      const color = voice.space.reverb.color ?? 0;
      if (Math.abs(color) > 2) {
        tone.type = 'lowpass';
        tone.frequency.value = clamp(color, 200, 20000);
        tone.Q.value = 0.7;
      } else if (color !== 0) {
        if (color > 0) {
          tone.type = 'highshelf';
          tone.frequency.value = 3000;
        } else {
          tone.type = 'lowshelf';
          tone.frequency.value = 600;
        }
        tone.gain.value = clamp(color, -1, 1) * 10;
      } else {
        tone.type = 'allpass';
        tone.frequency.value = 1000;
      }

      const baseMix = clamp(voice.space.reverb.mix, 0, 1);
      const wetMix = reverbQuality === 'performance' ? Math.min(baseMix, 0.18) : baseMix;
      const wet = ctx.createGain();
      wet.gain.setValueAtTime(wetMix, now);
      state.reverbMixParam = wet.gain;

      const earlyMixRaw = clamp(voice.space.reverb.earlyMix ?? 0, 0, 1);
      const earlyMix = reverbQuality === 'performance' ? 0 : earlyMixRaw;
      const earlyDelay = ctx.createDelay(0.1);
      earlyDelay.delayTime.value = clamp((voice.space.reverb.earlyDelayMs ?? 12) / 1000, 0, 0.1);
      const earlyGain = ctx.createGain();
      earlyGain.gain.value = earlyMix;

      postAmp.connect(preDelay);
      preDelay.connect(conv);
      conv.connect(damping);
      damping.connect(tone);
      tone.connect(wet);

      if (earlyMix > 0) {
        postAmp.connect(earlyDelay);
        earlyDelay.connect(earlyGain);
      }

      const mixer = ctx.createGain();
      postAmp.connect(mixer);
      wet.connect(mixer);
      if (earlyMix > 0) earlyGain.connect(mixer);
      postAmp = mixer;

      const modDepth = reverbQuality === 'performance' ? 0 : clamp(voice.space.reverb.modDepth ?? 0, 0, 1);
      if (modDepth > 0) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(Math.max(0.05, voice.space.reverb.modSpeed || 0.4), now);
        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(modDepth * 0.02, now);
        lfo.connect(modGain);
        modGain.connect(preDelay.delayTime);
        lfo.start(now);
        stopFns.push(() => { try { lfo.stop(); } catch { } });
        nodes.push(lfo, modGain);
      }

      nodes.push(preDelay, conv, damping, tone, wet, earlyDelay, earlyGain, mixer);
    }
  }

  if (patch.routing.enableCompressor && voice.compressor.enabled) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = voice.compressor.threshold;
    comp.ratio.value = voice.compressor.ratio;
    comp.attack.value = voice.compressor.attackMs / 1000;
    comp.release.value = voice.compressor.releaseMs / 1000;

    const makeup = ctx.createGain();
    makeup.gain.value = Math.pow(10, voice.compressor.gain / 20);

    postAmp.connect(comp);
    comp.connect(makeup);
    postAmp = makeup;
    nodes.push(comp, makeup);
  }

  if (patch.routing.enableLimiter && voice.limiter.enabled) {
    const pre = ctx.createGain();
    pre.gain.value = Math.pow(10, voice.limiter.preGain / 20);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = voice.limiter.threshold;
    comp.ratio.value = 20;
    comp.attack.value = 0.001;
    comp.release.value = voice.limiter.releaseMs / 1000;

    const wet = ctx.createGain();
    wet.gain.value = voice.limiter.mix;
    const dry = ctx.createGain();
    dry.gain.value = 1 - voice.limiter.mix;
    const outMix = ctx.createGain();

    postAmp.connect(pre);
    pre.connect(comp);
    comp.connect(wet);
    postAmp.connect(dry);
    wet.connect(outMix);
    dry.connect(outMix);
    postAmp = outMix;
    nodes.push(pre, comp, wet, dry, outMix);
  }

  if (voice.masterFilter && voice.masterFilter.enabled) {
    const mf = ctx.createBiquadFilter();
    mf.type = voice.masterFilter.type || 'lowpass';
    mf.frequency.value = voice.masterFilter.cutoffHz;
    mf.Q.value = voice.masterFilter.resonance;

    const wet = ctx.createGain();
    wet.gain.value = voice.masterFilter.mix;
    const dry = ctx.createGain();
    dry.gain.value = 1 - voice.masterFilter.mix;
    const outMix = ctx.createGain();

    postAmp.connect(mf);
    mf.connect(wet);
    postAmp.connect(dry);
    wet.connect(outMix);
    dry.connect(outMix);
    postAmp = outMix;
    nodes.push(mf, wet, dry, outMix);
  }

  state.postAmp = postAmp;
};
