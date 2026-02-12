import { clamp } from '../utils';
import { getNoiseBuffer, getPulseWave, getWavetableWave, getSampleBuffer, getReversedBuffer, getPingPongBuffer, getBandLimitedWave } from '../buffers';
import { isBipolarSource, parseRootKeyToHz } from '../engineUtils';
import { LAST_FREQ_BY_CONTEXT, reportTimbreEngineError } from '../engineState';
import type { VoiceRuntime } from './types';

export const buildOscillators = (state: VoiceRuntime) => {
  const {
    ctx,
    patch,
    voice,
    freq,
    now,
    seed,
    modAccum,
    nodes,
    stopFns,
    sourceBus,
    context
  } = state;

  const fmOscTargets: AudioParam[] = [];
  const fmHarmTargets: AudioParam[] = [];
  state.fmOscTargets = fmOscTargets;
  state.fmHarmTargets = fmHarmTargets;

  const glideMs = Math.max(0, patch.performance.portamentoMs);
  const lastFreqUsed = LAST_FREQ_BY_CONTEXT[context] || freq;
  LAST_FREQ_BY_CONTEXT[context] = freq;

  const syncRatio = voice.oscBank.sync?.enabled ? clamp(voice.oscBank.sync.ratio, 0.25, 8) : 1;
  const connectPitchBend = (param?: AudioParam | null) => {
    if (!state.pitchBendGain || !param) return;
    try {
      state.pitchBendGain.connect(param);
    } catch { }
  };

  if (patch.routing.enableOscBank && voice.oscBank.enabled) {
    const unisonEnabled = voice.unison?.enabled ?? false;
    const unisonVoices = unisonEnabled ? Math.max(1, Math.min(16, voice.unison.voices)) : 1;
    const unisonDetune = unisonEnabled ? voice.unison.detune : 0;
    const unisonSpread = unisonEnabled ? voice.unison.spread : 0;
    const unisonBlend = unisonEnabled ? clamp(voice.unison.blend ?? 0, 0, 1) : 0;
    const unisonPhase = unisonEnabled ? clamp(voice.unison.phase ?? 0, 0, 1) : 0;
    const maxPhaseDelay = 0.005;

    for (const oscSpec of voice.oscBank.oscillators) {
      for (let u = 0; u < unisonVoices; u++) {
        let pan = 0;
        let detuneOffset = 0;
        if (unisonVoices > 1) {
          const t = u / (unisonVoices - 1);
          pan = (t * 2 - 1) * unisonSpread;
          detuneOffset = (t * 2 - 1) * unisonDetune;
        }

        const og = ctx.createGain();
        const baseGain = clamp(oscSpec.gain, 0, 1);
        const compensation = unisonVoices > 1 ? 1 / Math.sqrt(unisonVoices) : 1;
        const gainScale = compensation * (1 - unisonBlend) + unisonBlend;
        og.gain.value = baseGain * gainScale;
        nodes.push(og);

        let outputNode: AudioNode = og;
        if (ctx.createStereoPanner && Math.abs(pan) > 0.01) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = pan;
          og.connect(panner);
          outputNode = panner;
          nodes.push(panner);
        }
        outputNode.connect(sourceBus);

        const phaseDelay = unisonEnabled && unisonPhase > 0 && unisonVoices > 1
          ? (u / (unisonVoices - 1)) * unisonPhase * maxPhaseDelay
          : 0;
        const oscStart = now + phaseDelay;

        if (oscSpec.type === 'noise') {
          const noiseBuffer = getNoiseBuffer(ctx, seed ^ 0x9e3779b9 ^ u);
          const src = ctx.createBufferSource();
          src.buffer = noiseBuffer;
          src.loop = true;
          src.connect(og);
          src.start(now);
          stopFns.push(() => { try { src.stop(); } catch { } });
        } else if (oscSpec.type === 'sample') {
          const sampleCfg = oscSpec.sample;
          if (!sampleCfg?.data) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            connectPitchBend(osc.detune);
            osc.connect(og);
            osc.start(oscStart);
            stopFns.push(() => { try { osc.stop(); } catch { } });
          } else {
            getSampleBuffer(ctx, sampleCfg.data).then((buffer) => {
              if (state.stopped) return;
              const src = ctx.createBufferSource();
              const resolvedBuffer = sampleCfg.reverse ? getReversedBuffer(ctx, buffer) : buffer;

              const isPingPong = sampleCfg.loopMode === 'pingpong';
              src.loop = isPingPong || sampleCfg.loopMode === 'loop' || (sampleCfg.loop ?? false);
              let loopStartSec = 0;
              let loopEndSec = resolvedBuffer.duration;
              if (src.loop) {
                if (sampleCfg.loopStart !== undefined) {
                  const start = sampleCfg.loopStart <= 1 ? sampleCfg.loopStart * resolvedBuffer.duration : sampleCfg.loopStart;
                  loopStartSec = Math.max(0, Math.min(resolvedBuffer.duration, start));
                }
                if (sampleCfg.loopEnd !== undefined) {
                  const end = sampleCfg.loopEnd <= 1 ? sampleCfg.loopEnd * resolvedBuffer.duration : sampleCfg.loopEnd;
                  loopEndSec = Math.max(loopStartSec, Math.min(resolvedBuffer.duration, end));
                }
              }

              let baseHz = parseRootKeyToHz(sampleCfg.rootKey, sampleCfg.baseHz || 440);
              baseHz = Math.max(20, baseHz);
              const rate = clamp(freq / baseHz, 0.01, 16);
              src.playbackRate.setValueAtTime(rate, Math.max(now, ctx.currentTime));
              connectPitchBend(src.detune);

              const modStart = modAccum.sampleStart ?? 0;
              let startOffset = 0;
              if (sampleCfg.startOffset !== undefined) {
                startOffset = sampleCfg.startOffset <= 1
                  ? sampleCfg.startOffset * resolvedBuffer.duration
                  : sampleCfg.startOffset;
              }
              if (modStart > 0) {
                startOffset += modStart * resolvedBuffer.duration;
              }
              startOffset = clamp(startOffset, 0, resolvedBuffer.duration);

              if (src.loop && isPingPong) {
                const pingBuffer = getPingPongBuffer(ctx, resolvedBuffer, loopStartSec, loopEndSec);
                src.buffer = pingBuffer;
                src.loopStart = 0;
                src.loopEnd = pingBuffer.duration;
                startOffset = clamp(startOffset - loopStartSec, 0, pingBuffer.duration);
              } else {
                src.buffer = resolvedBuffer;
                if (src.loop) {
                  src.loopStart = loopStartSec;
                  src.loopEnd = loopEndSec;
                }
              }

              if (Number.isFinite(sampleCfg.gain)) {
                og.gain.value *= clamp(sampleCfg.gain as number, 0, 2);
              }

              src.connect(og);
              src.start(Math.max(oscStart, ctx.currentTime), startOffset);
              stopFns.push(() => { try { src.stop(); } catch { } });
            }).catch((err) => {
              reportTimbreEngineError(`Sample load failed: ${(err as Error)?.message || 'unknown error'}`);
            });
          }
        } else if (oscSpec.type === 'wavetable' && oscSpec.wavetables && oscSpec.wavetables.length > 1) {
          const baseMorph = oscSpec.wavetableMorph ?? 0;
          const modMorph = modAccum.wavetableMorph ?? 0;
          const morphPos = clamp(baseMorph + modMorph, 0, 1) * (oscSpec.wavetables.length - 1);

          const idxA = Math.floor(morphPos);
          const idxB = Math.min(oscSpec.wavetables.length - 1, idxA + 1);
          const frac = morphPos - idxA;

          const tableA = oscSpec.wavetables[idxA];
          const tableB = oscSpec.wavetables[idxB];
          const len = Math.max(tableA?.real?.length || 0, tableB?.real?.length || 0, 1);
          const mixTable = {
            real: new Array(len).fill(0).map((_, i) => {
              const a = tableA?.real?.[i] ?? 0;
              const b = tableB?.real?.[i] ?? 0;
              return a + (b - a) * frac;
            }),
            imag: new Array(len).fill(0).map((_, i) => {
              const a = tableA?.imag?.[i] ?? 0;
              const b = tableB?.imag?.[i] ?? 0;
              return a + (b - a) * frac;
            })
          };

          const osc = ctx.createOscillator();
          const wave = getWavetableWave(ctx, mixTable);
          if (wave) osc.setPeriodicWave(wave);

          const det = (oscSpec.detuneCents ?? 0) + detuneOffset;
          const targetFreq = freq * syncRatio;
          osc.detune.setValueAtTime(det, now);
          connectPitchBend(osc.detune);
          if (glideMs > 0) {
            osc.frequency.setValueAtTime(lastFreqUsed * syncRatio, now);
            osc.frequency.linearRampToValueAtTime(targetFreq, now + glideMs / 1000);
          } else {
            osc.frequency.setValueAtTime(targetFreq, now);
          }
          osc.connect(og);
          osc.start(oscStart);
          fmOscTargets.push(osc.frequency);
          stopFns.push(() => { try { osc.stop(); } catch { } });
        } else {
          const osc = ctx.createOscillator();
          let oscType: OscillatorType = 'sine';
          if (oscSpec.type === 'pulse') {
            oscType = 'square';
            osc.type = oscType;
            osc.setPeriodicWave(getPulseWave(ctx, oscSpec.pulseWidth ?? 0.5));
          } else if (oscSpec.type === 'wavetable') {
            osc.type = 'sine';
            const table = oscSpec.wavetable || (oscSpec.wavetables ? oscSpec.wavetables[0] : undefined);
            const wave = getWavetableWave(ctx, table);
            if (wave) {
              osc.setPeriodicWave(wave);
            }
          } else {
            oscType = oscSpec.type as OscillatorType;
            osc.type = oscType;
          }
          const det = (oscSpec.detuneCents ?? 0) + detuneOffset;
          osc.detune.setValueAtTime(det, now);
          connectPitchBend(osc.detune);
          const targetFreq = freq * syncRatio;
          if (glideMs > 0) {
            osc.frequency.setValueAtTime(lastFreqUsed * syncRatio, now);
            osc.frequency.linearRampToValueAtTime(targetFreq, now + glideMs / 1000);
          } else {
            osc.frequency.setValueAtTime(targetFreq, now);
          }
          osc.connect(og);
          osc.start(oscStart);
          fmOscTargets.push(osc.frequency);
          stopFns.push(() => { try { osc.stop(); } catch { } });
        }
      }
    }
  }

  if (patch.routing.enableVA && voice.vaOsc?.enabled) {
    const vaSpecs = [voice.vaOsc.osc1, voice.vaOsc.osc2, voice.vaOsc.subOsc, voice.vaOsc.noiseOsc];
    const activeCount = vaSpecs.filter(spec => clamp(spec.level, 0, 2) > 0.001).length || 1;
    const vaScale = 1 / Math.sqrt(activeCount);

    const resolvePwmDuty = (spec: typeof voice.vaOsc.osc1) => {
      const depth = clamp(spec.pwmDepth ?? 0, 0, 1);
      if (depth <= 0) return 0.5;
      const source = spec.pwmSource;
      let value = source ? (state.sources[source] ?? 0.5) : 0.5;
      if (source && isBipolarSource(source)) {
        value = (value + 1) / 2;
      }
      const duty = 0.5 + (value - 0.5) * depth * 2;
      return clamp(duty, 0.05, 0.95);
    };

    const calcOscFreq = (spec: typeof voice.vaOsc.osc1) => {
      const semis = (spec.octave || 0) * 12 + (spec.semitone || 0) + (spec.cent || 0) / 100;
      return freq * Math.pow(2, semis / 12);
    };

    const createVaOsc = (spec: typeof voice.vaOsc.osc1, startAt: number) => {
      const level = clamp(spec.level, 0, 2);
      if (level <= 0.001) return;
      const targetFreq = calcOscFreq(spec);
      const lastFreqForOsc = (glideMs > 0 ? lastFreqUsed : targetFreq) * (targetFreq / freq);

      const osc = ctx.createOscillator();
      if (spec.waveform === 'sine') {
        osc.type = 'sine';
      } else {
        const duty = spec.waveform === 'pulse' ? resolvePwmDuty(spec) : 0.5;
        const wave = getBandLimitedWave(ctx, spec.waveform, targetFreq, duty);
        osc.setPeriodicWave(wave);
      }

      if (glideMs > 0) {
        osc.frequency.setValueAtTime(lastFreqForOsc, now);
        osc.frequency.linearRampToValueAtTime(targetFreq, now + glideMs / 1000);
      } else {
        osc.frequency.setValueAtTime(targetFreq, now);
      }
      connectPitchBend(osc.detune);

      const og = ctx.createGain();
      og.gain.value = level * vaScale;
      nodes.push(og);

      let outputNode: AudioNode = og;
      if (ctx.createStereoPanner && Math.abs(spec.pan || 0) > 0.001) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = clamp(spec.pan, -1, 1);
        og.connect(panner);
        outputNode = panner;
        nodes.push(panner);
      }
      osc.connect(og);
      outputNode.connect(sourceBus);

      osc.start(startAt);
      fmOscTargets.push(osc.frequency);
      stopFns.push(() => { try { osc.stop(); } catch { } });
    };

    const osc1Start = now;
    createVaOsc(voice.vaOsc.osc1, osc1Start);
    const osc2Start = voice.vaOsc.syncOsc2 ? osc1Start : now;
    createVaOsc(voice.vaOsc.osc2, osc2Start);
    createVaOsc(voice.vaOsc.subOsc, now);
    createVaOsc(voice.vaOsc.noiseOsc, now);
  }
};
