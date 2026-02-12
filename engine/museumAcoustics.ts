import { getAudioContext } from '../audioEngine';

export type AcousticProfileId = 'spine' | 'gallery' | 'finale' | 'exit';

type Profile = {
  id: AcousticProfileId;
  
  rt60: number; 
  
  irLength: number; 
  
  wet: number; 
  dry: number; 
  
  lowpassHz: number;
  
  ambient: {
    gain: number;
    lowpassHz: number;
    highpassHz: number;
  };
  
  step: {
    gain: number;
    lowpassHz: number;
    highpassHz: number;
  };
};

const PROFILES: Record<AcousticProfileId, Profile> = {
  
  spine: {
    id: 'spine',
    rt60: 0.85,
    irLength: 1.0,
    wet: 0.16,
    dry: 1.0,
    lowpassHz: 14000,
    ambient: { gain: 0.016, lowpassHz: 12000, highpassHz: 90 },
    step: { gain: 0.06, lowpassHz: 9000, highpassHz: 180 }
  },
  
  gallery: {
    id: 'gallery',
    rt60: 0.65,
    irLength: 0.85,
    wet: 0.12,
    dry: 0.95,
    lowpassHz: 6500,
    ambient: { gain: 0.013, lowpassHz: 7500, highpassHz: 120 },
    step: { gain: 0.05, lowpassHz: 4500, highpassHz: 120 }
  },
  
  finale: {
    id: 'finale',
    rt60: 1.55,
    irLength: 1.9,
    wet: 0.24,
    dry: 1.0,
    lowpassHz: 12000,
    ambient: { gain: 0.018, lowpassHz: 14000, highpassHz: 80 },
    step: { gain: 0.065, lowpassHz: 10000, highpassHz: 140 }
  },
  
  exit: {
    id: 'exit',
    rt60: 0.45,
    irLength: 0.7,
    wet: 0.08,
    dry: 0.9,
    lowpassHz: 5200,
    ambient: { gain: 0.008, lowpassHz: 4800, highpassHz: 140 },
    step: { gain: 0.045, lowpassHz: 3600, highpassHz: 160 }
  }
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function makeSyntheticIR(ctx: AudioContext, lengthSec: number, rt60Sec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(lengthSec * sr));
  const ir = ctx.createBuffer(2, length, sr);

  const k = Math.log(1000) / Math.max(0.15, rt60Sec);

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    
    let seed = 1234567 + ch * 8191;
    const rnd = () => {
      
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 0xffffffff) * 2 - 1;
    };

    const taps = [
      { t: 0.015, g: 0.55 },
      { t: 0.028, g: 0.32 },
      { t: 0.041, g: 0.22 },
      { t: 0.058, g: 0.15 }
    ];
    for (const tap of taps) {
      const i = Math.floor(tap.t * sr);
      if (i > 0 && i < length) data[i] += tap.g * (0.6 + 0.4 * rnd());
    }

    for (let i = 0; i < length; i++) {
      const t = i / sr;
      const env = Math.exp(-k * t);
      
      const n = rnd();
      const n2 = i > 0 ? data[i - 1] : 0;
      data[i] += (0.7 * n + 0.3 * n2) * env;
    }

    let max = 0;
    for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
    const norm = max > 0 ? 0.35 / max : 1;
    for (let i = 0; i < length; i++) data[i] *= norm;
  }

  return ir;
}

function makeNoiseBuffer(ctx: AudioContext, lengthSec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(lengthSec * sr));
  const b = ctx.createBuffer(1, length, sr);
  const d = b.getChannelData(0);
  let seed = 246813579;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 0.15);
    d[i] = rnd() * env;
  }
  return b;
}

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  dry: GainNode;
  wet: GainNode;
  wetIn: GainNode;
  convA: ConvolverNode;
  convB: ConvolverNode;
  convAGain: GainNode;
  convBGain: GainNode;
  wetLP: BiquadFilterNode;
  ambientSrc: AudioBufferSourceNode;
  ambientGain: GainNode;
  ambientLP: BiquadFilterNode;
  ambientHP: BiquadFilterNode;
  activeConv: 'A' | 'B';
  profile: AcousticProfileId;
  irCache: Partial<Record<AcousticProfileId, AudioBuffer>>;
};

let engine: Engine | null = null;

function ensureEngine(): Engine {
  if (engine) return engine;

  const ctx = getAudioContext();

  const master = ctx.createGain();
  master.gain.value = 0.95;
  master.connect(ctx.destination);

  const dry = ctx.createGain();
  const wet = ctx.createGain();
  dry.connect(master);
  wet.connect(master);

  const wetIn = ctx.createGain();
  wetIn.gain.value = 1;

  const convA = ctx.createConvolver();
  const convB = ctx.createConvolver();
  const convAGain = ctx.createGain();
  const convBGain = ctx.createGain();
  convAGain.gain.value = 1;
  convBGain.gain.value = 0;

  const wetLP = ctx.createBiquadFilter();
  wetLP.type = 'lowpass';
  wetLP.frequency.value = 12000;
  wetLP.Q.value = 0.55;

  wetIn.connect(convA);
  wetIn.connect(convB);
  convA.connect(convAGain);
  convB.connect(convBGain);
  convAGain.connect(wetLP);
  convBGain.connect(wetLP);
  wetLP.connect(wet);

  const ambientSrc = ctx.createBufferSource();
  ambientSrc.buffer = makeNoiseBuffer(ctx, 2.0);
  ambientSrc.loop = true;
  const ambientHP = ctx.createBiquadFilter();
  ambientHP.type = 'highpass';
  ambientHP.frequency.value = 80;
  ambientHP.Q.value = 0.7;
  const ambientLP = ctx.createBiquadFilter();
  ambientLP.type = 'lowpass';
  ambientLP.frequency.value = 12000;
  ambientLP.Q.value = 0.6;
  const ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  ambientSrc.connect(ambientHP);
  ambientHP.connect(ambientLP);
  ambientLP.connect(ambientGain);
  ambientGain.connect(master);
  ambientSrc.start();

  engine = {
    ctx,
    master,
    dry,
    wet,
    wetIn,
    convA,
    convB,
    convAGain,
    convBGain,
    wetLP,
    ambientSrc,
    ambientGain,
    ambientLP,
    ambientHP,
    activeConv: 'A',
    profile: 'spine',
    irCache: {}
  };

  setAcousticProfile('spine', 0);

  return engine;
}

export function resumeMuseumAcoustics(): void {
  const e = ensureEngine();
  if (e.ctx.state === 'suspended' || (e.ctx.state as string) === 'interrupted') {
    e.ctx.resume().catch(() => void 0);
  }
}

function getIR(e: Engine, profileId: AcousticProfileId): AudioBuffer {
  const cached = e.irCache[profileId];
  if (cached) return cached;
  const p = PROFILES[profileId];
  const ir = makeSyntheticIR(e.ctx, p.irLength, p.rt60);
  e.irCache[profileId] = ir;
  return ir;
}

export function setAcousticProfile(profileId: AcousticProfileId, transitionMs = 900): void {
  const e = ensureEngine();
  if (e.profile === profileId) return;

  const ctx = e.ctx;
  const now = ctx.currentTime;
  const t = Math.max(0, transitionMs) / 1000;
  const p = PROFILES[profileId];

  e.wet.gain.cancelScheduledValues(now);
  e.dry.gain.cancelScheduledValues(now);
  e.wetLP.frequency.cancelScheduledValues(now);
  e.ambientGain.gain.cancelScheduledValues(now);
  e.ambientLP.frequency.cancelScheduledValues(now);
  e.ambientHP.frequency.cancelScheduledValues(now);

  e.wet.gain.setTargetAtTime(clamp(p.wet, 0, 1), now, 0.12);
  e.dry.gain.setTargetAtTime(clamp(p.dry, 0, 1), now, 0.12);
  e.wetLP.frequency.setTargetAtTime(clamp(p.lowpassHz, 800, 20000), now, 0.12);
  e.ambientGain.gain.setTargetAtTime(clamp(p.ambient.gain, 0, 0.2), now, 0.18);
  e.ambientLP.frequency.setTargetAtTime(clamp(p.ambient.lowpassHz, 800, 20000), now, 0.18);
  e.ambientHP.frequency.setTargetAtTime(clamp(p.ambient.highpassHz, 20, 20000), now, 0.18);

  const nextIR = getIR(e, profileId);
  const fadeToA = e.activeConv === 'B';

  const inGain = fadeToA ? e.convAGain : e.convBGain;
  const outGain = fadeToA ? e.convBGain : e.convAGain;
  const inConv = fadeToA ? e.convA : e.convB;

  inConv.buffer = nextIR;

  inGain.gain.cancelScheduledValues(now);
  outGain.gain.cancelScheduledValues(now);

  inGain.gain.setValueAtTime(inGain.gain.value, now);
  outGain.gain.setValueAtTime(outGain.gain.value, now);

  inGain.gain.linearRampToValueAtTime(1, now + t);
  outGain.gain.linearRampToValueAtTime(0, now + t);

  e.activeConv = fadeToA ? 'A' : 'B';
  e.profile = profileId;
}

function makeFootstepBuffer(ctx: AudioContext, durSec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(durSec * sr));
  const b = ctx.createBuffer(1, length, sr);
  const d = b.getChannelData(0);
  let seed = 987654321;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 28) + 0.35 * Math.exp(-Math.max(0, t - 0.035) * 40);
    d[i] = rnd() * env;
  }

  let max = 0;
  for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(d[i]));
  const norm = max > 0 ? 0.9 / max : 1;
  for (let i = 0; i < length; i++) d[i] *= norm;

  return b;
}

const footstepCache: Partial<Record<AcousticProfileId, AudioBuffer>> = {};

function getFootstepBuffer(e: Engine, profileId: AcousticProfileId): AudioBuffer {
  const cached = footstepCache[profileId];
  if (cached) return cached;
  const dur = profileId === 'finale' ? 0.16 : profileId === 'exit' ? 0.13 : 0.14;
  const b = makeFootstepBuffer(e.ctx, dur);
  footstepCache[profileId] = b;
  return b;
}

export function playFootstep(profileId: AcousticProfileId, velocity01: number): void {
  const e = ensureEngine();
  resumeMuseumAcoustics();

  const ctx = e.ctx;
  const now = ctx.currentTime;
  const p = PROFILES[profileId];

  const src = ctx.createBufferSource();
  src.buffer = getFootstepBuffer(e, profileId);

  const g = ctx.createGain();
  const v = clamp(velocity01, 0, 1);
  const target = p.step.gain * (0.4 + 0.9 * v);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(target, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(p.step.highpassHz, now);
  hp.Q.value = 0.7;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(p.step.lowpassHz, now);
  lp.Q.value = 0.65;

  src.connect(hp);
  hp.connect(lp);
  lp.connect(g);

  const sendMul = profileId === 'gallery' ? 0.75 : profileId === 'finale' ? 1.05 : profileId === 'exit' ? 0.6 : 0.95;
  const dryMul = profileId === 'gallery' ? 0.92 : profileId === 'exit' ? 0.85 : 1.0;

  const drySend = ctx.createGain();
  drySend.gain.value = dryMul;
  const wetSend = ctx.createGain();
  wetSend.gain.value = sendMul;

  g.connect(drySend);
  g.connect(wetSend);
  drySend.connect(e.dry);
  wetSend.connect(e.wetIn);

  src.start(now);
  src.stop(now + 0.22);

  src.onended = () => {
    try {
      src.disconnect();
      hp.disconnect();
      lp.disconnect();
      g.disconnect();
      drySend.disconnect();
      wetSend.disconnect();
    } catch {
      
    }
  };
}

export const museumAcoustics = {
  ensure: ensureEngine,
  resume: resumeMuseumAcoustics,
  setProfile: setAcousticProfile,
  playFootstep
};
