import type { TimbreModRoute, TimbreModTarget } from '../../types';
import { buildBipolarCurve, buildRouteCurve, divisionToHz, isBipolarSource, ABS_CURVE } from '../engineUtils';
import { clamp, hashString } from '../utils';
import { getRandomHoldBuffer } from '../buffers';
import { GLOBAL_LFO_CACHE } from '../engineState';
import type { VoiceRuntime } from './types';

export const buildModulation = (state: VoiceRuntime) => {
  const {
    ctx,
    now,
    nodes,
    stopFns,
    lfoTargets,
    lfoConfig
  } = state;

  const sourceSignals: Record<string, AudioNode | null> = {
    lfo1: null,
    lfo2: null,
    lfo3: null,
    lfo4: null,
    modWheel: state.expressionNodes.modWheel ?? null,
    aftertouch: state.expressionNodes.aftertouch ?? null,
    mpePressure: state.expressionNodes.mpePressure ?? null,
    mpeTimbre: state.expressionNodes.mpeTimbre ?? null,
    cc7: state.expressionNodes.cc7 ?? null,
    cc74: state.expressionNodes.cc74 ?? null,
    pitchBend: state.expressionNodes.pitchBend ?? null,
    envAmp: state.envAmpOut,
    envFilter: state.envFilterOut,
    mseg: state.msegSig,
    noteAge: null,
    releaseAge: null,
    randomHold: null,
    randomSmooth: null,
    envelopeFollower: null
  };

  const lfoState: Partial<Record<'lfo1' | 'lfo2' | 'lfo3' | 'lfo4', { node: AudioNode; rateHz: number }>> = {};

  const getLfoRateHz = (settings: any) => {
    const raw = settings?.tempoSync
      ? divisionToHz(state.tempoBpm, settings.syncDivision)
      : settings?.rateHz;
    const rate = Number.isFinite(raw) ? raw : 0.2;
    return clamp(rate, 0.01, 40);
  };

  const createLfoSource = (
    settings: any,
    rateHz: number,
    seedValue: number,
    allowOneShot: boolean,
    register: boolean
  ) => {
    const created: AudioNode[] = [];
    const waveform = settings?.waveform || 'sine';
    const oneShot = allowOneShot && settings?.oneShot;

    let source: AudioScheduledSourceNode;
    let output: AudioNode;

    if (waveform === 'sample&hold') {
      const buffer = getRandomHoldBuffer(ctx, seedValue, rateHz);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = !oneShot;
      src.playbackRate.value = 1;
      source = src;
      output = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = waveform as OscillatorType;
      osc.frequency.setValueAtTime(rateHz, now);
      source = osc;
      output = osc;
    }

    if (settings?.fadeInMs && settings.fadeInMs > 0) {
      const fade = ctx.createGain();
      fade.gain.setValueAtTime(0, now);
      fade.gain.linearRampToValueAtTime(1, now + settings.fadeInMs / 1000);
      output.connect(fade);
      output = fade;
      created.push(fade);
    }

    const curve = settings?.curve ?? 'linear';
    if (curve !== 'linear' || settings?.curveAmount || settings?.curveSteps) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = buildBipolarCurve(curve, {
        pow: settings?.curveAmount,
        steps: settings?.curveSteps
      });
      output.connect(shaper);
      output = shaper;
      created.push(shaper);
    }

    source.start(now);
    if (oneShot && rateHz > 0) {
      const stopAt = now + (1 / rateHz);
      try { source.stop(stopAt); } catch { }
    }

    if (register) {
      nodes.push(...created);
      nodes.push(source as any);
      stopFns.push(() => { try { source.stop(); } catch { } });
    }

    return { source, output, nodes: created };
  };

  const initLfo = (key: 'lfo1' | 'lfo2' | 'lfo3' | 'lfo4') => {
    if (lfoState[key]) return lfoState[key];
    const settings = lfoConfig[key];
    if (!settings?.enabled) return null;

    const rateHz = getLfoRateHz(settings);
    const allowOneShot = settings.retrigger !== false;
    const settingsKey = `${key}|${settings.waveform}|${settings.tempoSync ? 'sync' : 'free'}|${rateHz.toFixed(4)}|${settings.curve || 'linear'}|${settings.curveAmount ?? ''}|${settings.curveSteps ?? ''}|${settings.fadeInMs ?? 0}|${allowOneShot ? (settings.oneShot ? 1 : 0) : 0}`;

    if (settings.retrigger === false) {
      let cache = GLOBAL_LFO_CACHE.get(ctx);
      if (!cache) {
        cache = new Map();
        GLOBAL_LFO_CACHE.set(ctx, cache);
      }
      const cacheKey = `${state.patch.id}|${settingsKey}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        lfoState[key] = { node: cached.output, rateHz: cached.rateHz };
        return lfoState[key];
      }

      const seedValue = hashString(`${state.patch.id}|${key}|global`);
      const created = createLfoSource(settings, rateHz, seedValue, false, false);
      cache.set(cacheKey, {
        output: created.output,
        source: created.source,
        rateHz,
        settingsKey: cacheKey,
        nodes: created.nodes
      });
      lfoState[key] = { node: created.output, rateHz };
      return lfoState[key];
    }

    const seedValue = state.voiceSeed ^ hashString(`${state.patch.id}|${key}`);
    const created = createLfoSource(settings, rateHz, seedValue, true, true);
    lfoState[key] = { node: created.output, rateHz };
    return lfoState[key];
  };

  if (state.wantsNoteAge) {
    const noteAgeSig = ctx.createConstantSource();
    noteAgeSig.offset.setValueAtTime(0, now);
    noteAgeSig.offset.linearRampToValueAtTime(1, now + 1);
    noteAgeSig.start(now);
    sourceSignals.noteAge = noteAgeSig;
    nodes.push(noteAgeSig);
  }

  if (state.wantsReleaseAge) {
    const releaseAgeSig = ctx.createConstantSource();
    releaseAgeSig.offset.setValueAtTime(0, now);
    releaseAgeSig.start(now);
    sourceSignals.releaseAge = releaseAgeSig;
    nodes.push(releaseAgeSig);
  }

  if (state.wantsRandomHold) {
    const randomSeed = state.voiceSeed ^ 0x33d61a;
    const randBuffer = getRandomHoldBuffer(ctx, randomSeed, 4);
    const randSrc = ctx.createBufferSource();
    randSrc.buffer = randBuffer;
    randSrc.loop = true;
    randSrc.start(now);
    sourceSignals.randomHold = randSrc;
    nodes.push(randSrc);
    stopFns.push(() => { try { randSrc.stop(); } catch { } });

    if (state.wantsRandomSmooth) {
      const smooth = ctx.createBiquadFilter();
      smooth.type = 'lowpass';
      smooth.frequency.setValueAtTime(1.5, now);
      randSrc.connect(smooth);
      sourceSignals.randomSmooth = smooth;
      nodes.push(smooth);
    }
  }

  if (state.wantsEnvelopeFollower) {
    const rectifier = ctx.createWaveShaper();
    rectifier.curve = ABS_CURVE;
    const smooth = ctx.createBiquadFilter();
    smooth.type = 'lowpass';
    smooth.frequency.setValueAtTime(12, now);
    const followerGain = ctx.createGain();
    followerGain.gain.setValueAtTime(1, now);
    state.sourceBus.connect(rectifier);
    rectifier.connect(smooth);
    smooth.connect(followerGain);
    sourceSignals.envelopeFollower = followerGain;
    nodes.push(rectifier, smooth, followerGain);
  }

  const CONTROL_RATE_TARGETS = new Set<TimbreModTarget>(['filterCutoff', 'drive']);
  const routeOutputs = new Map<TimbreModTarget, { mode: string; node: AudioNode }[]>();

  const addRouteOutput = (target: TimbreModTarget, mode: string, node: AudioNode) => {
    if (!routeOutputs.has(target)) routeOutputs.set(target, []);
    routeOutputs.get(target)!.push({ mode, node });
  };

  const applySmoothing = (node: AudioNode, smoothingMs: number, target: TimbreModTarget) => {
    let hz: number | null = null;
    if (smoothingMs > 0) {
      const tau = smoothingMs / 1000;
      const raw = 1 / (2 * Math.PI * Math.max(0.0001, tau));
      hz = clamp(raw, 0.05, 200);
    }
    if (CONTROL_RATE_TARGETS.has(target)) {
      hz = Math.min(hz ?? 9999, 20);
    }
    if (!hz || !Number.isFinite(hz)) return node;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(hz, now);
    node.connect(lp);
    nodes.push(lp);
    return lp;
  };

  const getTargetScale = (target: TimbreModTarget) => {
    if (target === 'filterCutoff') return 1200;
    return 1;
  };

  const resolveRouteSource = (route: TimbreModRoute) => {
    const src = route.source;
    if (src === 'lfo1' || src === 'lfo2' || src === 'lfo3' || src === 'lfo4') {
      const lfoInfo = initLfo(src);
      if (!lfoInfo) return null;
      const settings = lfoConfig[src];
      const rateHz = lfoInfo.rateHz;
      const phaseRaw = (settings?.phase ?? 0) + (route.phaseOffset ?? 0);
      const phase = ((phaseRaw % 1) + 1) % 1;
      if (phase > 0 && rateHz > 0) {
        const period = 1 / Math.max(0.001, rateHz);
        const delaySec = phase * period;
        if (delaySec > 0.0001 && delaySec <= 2) {
          const delay = ctx.createDelay(2);
          delay.delayTime.setValueAtTime(delaySec, now);
          lfoInfo.node.connect(delay);
          nodes.push(delay);
          return delay;
        }
      }
      return lfoInfo.node;
    }
    return sourceSignals[src] ?? null;
  };

  state.lfoRoutes.forEach(route => {
    const targetParam = lfoTargets[route.target];
    if (!targetParam) return;
    const sourceNode = resolveRouteSource(route);
    if (!sourceNode) return;

    const inputBipolar = isBipolarSource(route.source);
    const targetScale = getTargetScale(route.target);
    const shaper = ctx.createWaveShaper();
    shaper.curve = buildRouteCurve(route, inputBipolar, targetScale);
    sourceNode.connect(shaper);
    nodes.push(shaper);

    const smoothed = applySmoothing(shaper, route.smoothingMs ?? 0, route.target);
    const mode = route.combineMode || route.blendMode || 'sum';
    addRouteOutput(route.target, mode, smoothed);
  });

  const makeConstant = (value: number) => {
    const src = ctx.createConstantSource();
    src.offset.setValueAtTime(value, now);
    src.start(now);
    nodes.push(src);
    return src;
  };

  const combineMax = (a: AudioNode, b: AudioNode) => {
    const sum = ctx.createGain();
    a.connect(sum);
    b.connect(sum);
    const diff = ctx.createGain();
    a.connect(diff);
    const neg = ctx.createGain();
    neg.gain.value = -1;
    b.connect(neg);
    neg.connect(diff);
    const abs = ctx.createWaveShaper();
    abs.curve = ABS_CURVE;
    diff.connect(abs);
    const add = ctx.createGain();
    sum.connect(add);
    abs.connect(add);
    const half = ctx.createGain();
    half.gain.value = 0.5;
    add.connect(half);
    nodes.push(sum, diff, neg, abs, add, half);
    return half;
  };

  const combineMin = (a: AudioNode, b: AudioNode) => {
    const sum = ctx.createGain();
    a.connect(sum);
    b.connect(sum);
    const diff = ctx.createGain();
    a.connect(diff);
    const neg = ctx.createGain();
    neg.gain.value = -1;
    b.connect(neg);
    neg.connect(diff);
    const abs = ctx.createWaveShaper();
    abs.curve = ABS_CURVE;
    diff.connect(abs);
    const add = ctx.createGain();
    sum.connect(add);
    const absNeg = ctx.createGain();
    absNeg.gain.value = -1;
    abs.connect(absNeg);
    absNeg.connect(add);
    const half = ctx.createGain();
    half.gain.value = 0.5;
    add.connect(half);
    nodes.push(sum, diff, neg, abs, add, absNeg, half);
    return half;
  };

  const reduceCombine = (items: AudioNode[], combiner: (a: AudioNode, b: AudioNode) => AudioNode) => {
    return items.reduce((acc, node) => (acc ? combiner(acc, node) : node), null as AudioNode | null);
  };

  const buildMultiply = (items: AudioNode[]) => {
    const base = makeConstant(1);
    let current: AudioNode = base;
    items.forEach(node => {
      const gain = ctx.createGain();
      gain.gain.value = 1;
      node.connect(gain.gain);
      current.connect(gain);
      current = gain;
      nodes.push(gain);
    });
    return current;
  };

  routeOutputs.forEach((routes, target) => {
    const targetParam = lfoTargets[target];
    if (!targetParam) return;

    const sumNodes = routes.filter(r => r.mode === 'sum').map(r => r.node);
    const avgNodes = routes.filter(r => r.mode === 'avg').map(r => r.node);
    const maxNodes = routes.filter(r => r.mode === 'max').map(r => r.node);
    const minNodes = routes.filter(r => r.mode === 'min').map(r => r.node);
    const multNodes = routes.filter(r => r.mode === 'multiply').map(r => r.node);

    let base: AudioNode | null = null;
    let hasBase = false;
    if (sumNodes.length > 0 || avgNodes.length > 0) {
      const sum = ctx.createGain();
      sum.gain.value = 1;
      sumNodes.forEach(node => node.connect(sum));
      if (avgNodes.length > 0) {
        const avgSum = ctx.createGain();
        avgSum.gain.value = 1;
        avgNodes.forEach(node => node.connect(avgSum));
        const avgScale = ctx.createGain();
        avgScale.gain.value = 1 / avgNodes.length;
        avgSum.connect(avgScale);
        avgScale.connect(sum);
        nodes.push(avgSum, avgScale);
      }
      base = sum;
      hasBase = true;
      nodes.push(sum);
    }

    if (maxNodes.length > 0) {
      const maxChain = reduceCombine(maxNodes, combineMax);
      if (maxChain) {
        base = hasBase ? combineMax(base!, maxChain) : maxChain;
        hasBase = true;
      }
    }
    if (minNodes.length > 0) {
      const minChain = reduceCombine(minNodes, combineMin);
      if (minChain) {
        base = hasBase ? combineMin(base!, minChain) : minChain;
        hasBase = true;
      }
    }
    if (multNodes.length > 0) {
      const multChain = buildMultiply(multNodes);
      if (!hasBase) {
        base = makeConstant(1);
        hasBase = true;
      }
      const multGain = ctx.createGain();
      multGain.gain.value = 1;
      multChain.connect(multGain.gain);
      base!.connect(multGain);
      base = multGain;
      nodes.push(multGain);
    }

    if (!base) {
      if (targetParam instanceof AudioParam) {
        try { targetParam.cancelScheduledValues(now); } catch { }
      }
      return;
    }

    const finalNode = base;
    if (targetParam instanceof AudioParam) {
      finalNode.connect(targetParam);
    } else if (Array.isArray(targetParam)) {
      targetParam.forEach(param => {
        try { finalNode.connect(param); } catch { }
      });
    }
  });

  state.sourceSignals = sourceSignals;
};
