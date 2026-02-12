import type { SynthPatch, WaveformShape } from '../../types';
import { pulseWaveCache, sampleCache } from './cache';
import { getAudioProfile } from './context';
import { SoundFontEngine } from '../../utils/soundFontEngine';

export const safeFreq = (v: number): number => (Number.isFinite(v) ? Math.max(20, Math.min(v, 20000)) : 440);

const getPulseWave = (ctx: AudioContext, duty: number): PeriodicWave => {
  const clamped = Math.max(0.05, Math.min(0.95, duty));
  const key = clamped.toFixed(3);
  const cached = pulseWaveCache.get(key);
  if (cached) return cached;
  const harmonics = 64;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * clamped);
  }
  const wave = ctx.createPeriodicWave(real, imag);
  pulseWaveCache.set(key, wave);
  return wave;
};

// Clamp utility
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function setupVoice(
  ctx: AudioContext,
  out: AudioNode,
  freq: number,
  type: WaveformShape,
  start: number,
  patch?: SynthPatch
) {
  const safeP = (v: number) => Number.isFinite(v) && v > 0 ? v : 0.001;
  const safeGain = (v: number) => Number.isFinite(v) && v >= 0 ? v : 0;

  // Handle GM instruments
  if (typeof type === 'string' && type.startsWith('gm-')) {
    const programId = parseInt(type.replace('gm-', ''), 10);
    const sfEngine = SoundFontEngine.getInstance();

    // Initialize if needed (though ideally initiated earlier)
    sfEngine.init(ctx);

    // For now, SoundFontEngine handles its own gain/routing to destination
    // Ideally we should route it to `out`, but SpessaSynth's connection might be global or specific.
    // Our wrapper connects to ctx.destination.
    // TODO: Improve routing in SoundFontEngine to accept an output node.

    // Play the note
    // Convert freq to MIDI note
    const midiNote = Math.round(69 + 12 * Math.log2(freq / 440));
    // Default velocity 100 for now, or derive from gain if passed?
    // setupVoice signature doesn't pass velocity explicitly, usually part of patch or derived.
    const velocity = patch ? Math.min(127, Math.floor(patch.gain * 127)) : 100;

    sfEngine.playNote(midiNote, velocity, programId, 0); // 0 duration = manual note off required

    return {
      stop: (t: number = ctx.currentTime) => {
        sfEngine.noteOff(midiNote);
      },
      update: (p: any) => {
        // Param updates not fully supported for GM yet
      }
    };
  }

  // Calculate safe frequency
  const f = safeFreq(freq);

  const master = ctx.createGain();
  master.connect(out);
  const nodes: AudioNode[] = [master];
  const oscs: any[] = [];

  if (type === 'custom-synth' && patch) {
    const clamp = (v: number, lo: number, hi: number) => {
      const c = Math.max(lo, Math.min(hi, v));
      return Number.isFinite(c) ? c : lo;
    };
    const env = patch.env;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, start);
    const a = Math.max(0.0, env.attackMs / 1000);
    const d = Math.max(0.0, env.decayMs / 1000);
    const r = Math.max(0.0, env.releaseMs / 1000);
    const sustain = clamp(env.sustain, 0, 1);
    const filterBase = patch.filter?.enabled ? clamp(patch.filter.cutoffHz, 20, 20000) : null;
    const filterEnvAmount = patch.filter?.enabled ? (patch.filter.envAmount ?? 0) : 0;

    gainNode.gain.exponentialRampToValueAtTime(clamp(patch.gain, 0.0002, 1), start + a);
    gainNode.gain.exponentialRampToValueAtTime(clamp(patch.gain * sustain, 0.0002, 1), start + a + d);

    let post: AudioNode = gainNode;
    let filter: BiquadFilterNode | null = null;
    if (patch.filter?.enabled) {
      filter = ctx.createBiquadFilter();
      filter.type = patch.filter.type as any;
      filter.frequency.setValueAtTime(filterBase ?? 1800, start);
      filter.Q.setValueAtTime(clamp(patch.filter.q, 0.0001, 100), start);
      if (filterBase !== null && filterEnvAmount !== 0) {
        const peak = clamp(filterBase * (1 + filterEnvAmount), 20, 20000);
        const sustainFreq = clamp(filterBase * (1 + filterEnvAmount * sustain), 20, 20000);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, peak), start + a);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, sustainFreq), start + a + d);
      }
      gainNode.connect(filter);
      post = filter;
    }

    const profile = getAudioProfile();
    const unisonMax = profile?.unisonMax ?? 8;
    const unisonVoices = patch.unison?.enabled ? Math.max(1, Math.min(unisonMax, patch.unison.voices)) : 1;
    const detuneSpread = patch.unison?.enabled ? patch.unison.detuneCents : 0;
    const stereoSpread = patch.unison?.enabled ? clamp(patch.unison.stereoSpread, 0, 1) : 0;

    const mkNoise = () => {
      const bufferSize = 2 * ctx.sampleRate;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      return src;
    };

    const pitchTargets: AudioParam[] = [];
    const voicesStops: (() => void)[] = [];
    for (let v = 0; v < unisonVoices; v++) {
      const voiceGain = ctx.createGain();
      voiceGain.gain.value = 1 / unisonVoices;
      const panner = (ctx.createStereoPanner ? ctx.createStereoPanner() : null) as StereoPannerNode | null;
      if (panner) {
        const pan = unisonVoices === 1 ? 0 : ((v / (unisonVoices - 1)) * 2 - 1) * stereoSpread;
        panner.pan.setValueAtTime(pan, start);
        voiceGain.connect(panner);
        panner.connect(gainNode);
        nodes.push(panner);
      } else {
        voiceGain.connect(gainNode);
      }
      nodes.push(voiceGain);

      const oscStops: (() => void)[] = [];
      for (const o of patch.osc) {
        const og = ctx.createGain();
        og.gain.value = clamp(o.gain ?? 0.7, 0, 1);
        nodes.push(og);
        og.connect(voiceGain);
        if (o.type === 'noise') {
          const nsrc = mkNoise();
          nsrc.connect(og);
          nsrc.start(start);
          oscStops.push(() => {
            try {
              nsrc.stop();
            } catch { }
          });
          oscs.push(nsrc);
        } else {
          const osc = ctx.createOscillator();
          osc.type = (o.type === 'pulse' ? 'square' : o.type) as any;
          const det =
            (o.detuneCents ?? 0) +
            (unisonVoices === 1 ? 0 : ((v - (unisonVoices - 1) / 2) * detuneSpread) / Math.max(1, unisonVoices - 1));
          osc.detune.setValueAtTime(clamp(det, -12000, 12000), start);
          osc.frequency.setValueAtTime(safeFreq(freq), start);
          if (o.type === 'pulse') {
            const duty = clamp(o.pulseWidth ?? 0.5, 0.05, 0.95);
            osc.setPeriodicWave(getPulseWave(ctx, duty));
          }
          pitchTargets.push(osc.detune);
          osc.connect(og);
          osc.start(start);
          oscStops.push(() => {
            try {
              osc.stop();
            } catch { }
          });
          oscs.push(osc);
        }
      }
      voicesStops.push(() => oscStops.forEach((f) => f()));
    }

    if (patch.lfo?.enabled) {
      const lfo = ctx.createOscillator();
      lfo.type = patch.lfo.waveform as any;
      lfo.frequency.setValueAtTime(Math.max(0.01, patch.lfo.rateHz), start);
      const lfoGain = ctx.createGain();
      const lfoDepth = Number.isFinite(patch.lfo.depth) ? patch.lfo.depth : 0;
      lfoGain.gain.setValueAtTime(patch.lfo.target === 'amp' ? clamp(lfoDepth, 0, 1) : lfoDepth, start);
      lfo.connect(lfoGain);
      if (patch.lfo.target === 'amp') {
        lfoGain.connect(gainNode.gain);
      } else if (patch.lfo.target === 'filter' && filter) {
        lfoGain.connect(filter.frequency);
      } else if (patch.lfo.target === 'pitch' && pitchTargets.length > 0) {
        pitchTargets.forEach((param) => lfoGain.connect(param));
      } else {
        lfoGain.connect(gainNode.gain);
      }
      lfo.start(start);
      voicesStops.push(() => {
        try {
          lfo.stop();
        } catch { }
      });
      oscs.push(lfo);
      nodes.push(lfoGain);
    }

    post.connect(master);
    const stop = (stopTime?: number) => {
      const t = Math.max(ctx.currentTime, stopTime ?? ctx.currentTime);

      gainNode.gain.cancelScheduledValues(t);
      gainNode.gain.setValueAtTime(Math.max(0.0002, gainNode.gain.value), t);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + r);
      if (filter && filterBase !== null && filterEnvAmount !== 0) {
        filter.frequency.cancelScheduledValues(t);
        const current = Math.max(20, filter.frequency.value || filterBase);
        filter.frequency.setValueAtTime(current, t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterBase), t + r);
      }
      const cleanupDelayMs = Math.max(60, r * 1000 + 80);
      setTimeout(() => {
        try {
          voicesStops.forEach((f) => f());
        } catch { }
        try {
          nodes.forEach((n) => (n as any).disconnect && (n as any).disconnect());
        } catch { }
      }, cleanupDelayMs);
    };
    return { stop: (t: number) => stop(t) };
  }

  if (sampleCache[type]) {
    const src = ctx.createBufferSource();
    src.buffer = sampleCache[type];

    src.playbackRate.value = freq / 261.63;
    src.connect(master);
    oscs.push(src);
  } else {
    const createOsc = (t: OscillatorType, f: number, g: number) => {
      const o = ctx.createOscillator();
      o.type = t;
      o.frequency.value = safeFreq(f);
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn);
      gn.connect(master);
      oscs.push(o);
      nodes.push(gn);
      return o;
    };

    if (type === 'organ') {
      [1, 2, 3, 4, 6].forEach((h, i) => createOsc('sine', freq * h, 0.3 / (i + 1)));
    } else if (type === 'epiano') {
      const c = createOsc('sine', freq, 1);
      const m = ctx.createOscillator();
      m.frequency.value = freq * 4.0;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(freq * 2, start);
      mg.gain.exponentialRampToValueAtTime(1, start + 0.8);
      m.connect(mg);
      mg.connect(c.frequency);
      oscs.push(m);
    } else if (type === 'strings') {
      [-3, 0, 3].forEach((d) => {
        const o = createOsc('sawtooth', freq, 0.15);
        o.detune.value = d;
      });
    } else if (type === 'brass') {
      const o = createOsc('sawtooth', freq, 0.5);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(freq, start);
      f.frequency.exponentialRampToValueAtTime(freq * 6, start + 0.05);
      f.frequency.exponentialRampToValueAtTime(freq * 2, start + 0.4);
      o.disconnect();
      o.connect(f);
      f.connect(master);
      nodes.push(f);
    } else if (type === 'bell') {
      [1, 2.1, 3.5, 4.2, 5.7].forEach((r, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq * r;
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(0.2 / (i + 1), start);
        gn.gain.exponentialRampToValueAtTime(0.001, start + 2.0 / r);
        o.connect(gn);
        gn.connect(master);
        oscs.push(o);
        nodes.push(gn);
      });
    } else if (type === 'nes') {
      createOsc('square', freq, 0.3);
      const n = ctx.createOscillator();
      n.type = 'triangle';
      n.frequency.value = freq * 0.5;
      const ng = ctx.createGain();
      ng.gain.value = 0.3;
      n.connect(ng);
      ng.connect(master);
      oscs.push(n);
      nodes.push(ng);
    } else if (type === 'pad') {
      createOsc('triangle', freq, 0.4);
      const o2 = createOsc('triangle', freq * 1.001, 0.3);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.5;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.1;
      lfo.connect(lfoG);
      lfoG.connect(master.gain);
      oscs.push(lfo);
    } else if (type === 'synth-bass') {
      createOsc('sawtooth', freq, 0.6);
      createOsc('square', freq * 0.5, 0.4);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 400;
      f.Q.value = 10;
      master.disconnect();
      master.connect(f);
      f.connect(out);
      nodes.push(f);
    } else if (
      [
        'clarinet',
        'oboe',
        'bassoon',
        'trumpet',
        'flute',
        'cello',
        'violin',
        'vibraphone',
        'marimba',
        'steel-drum',
        'kalimba',
        'koto',
        'sitar',
        'voice-ooh',
      ].includes(type)
    ) {
      const wave = type === 'clarinet' ? 'square' : type === 'flute' ? 'sine' : 'sawtooth';
      createOsc(wave, freq, 0.6);
    } else createOsc((type as any) || 'sine', freq, 0.6);
  }
  oscs.forEach((o) => o.start && o.start(start));
  return {
    stop: (t: number) => {
      const stopTime = Math.max(ctx.currentTime, t);
      oscs.forEach((o) => {
        try {
          o.stop(stopTime);
        } catch (e) { }
      });
      const cleanupDelayMs = Math.max(80, (stopTime - ctx.currentTime + 0.25) * 1000);
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.disconnect();
          } catch (e) { }
        });
        oscs.forEach((o) => {
          try {
            o.disconnect();
          } catch (e) { }
        });
      }, cleanupDelayMs);
    },
  };
};
