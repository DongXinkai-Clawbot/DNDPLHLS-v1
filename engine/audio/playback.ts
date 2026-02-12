import { getFrequency } from '../../musicLogic';
import type { AppSettings, NodeData } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { getNoteKey, reportTimbreEngineError, resolveTimbrePatch, startTimbreVoice } from '../../timbreEngine';
import type { TimbreVoiceExpression } from '../../timbreEngine';
import { startMidiOutFrequency } from '../../midiOut';
import { getMasterBus, getAudioProfile, initAudio } from './context';
import { safeFreq, setupVoice } from './voice';

type StartNoteOptions = { velocity?: number; noteKey?: string; voiceMods?: TimbreVoiceExpression };

const TIMBRE_INSTRUMENT_PREFIX = 'timbre:';
const activeVoices: { id: number; startedAt: number; stop: (t?: number) => void }[] = [];
let activeVoiceId = 0;

const removeVoice = (id: number) => {
  const idx = activeVoices.findIndex((v) => v.id === id);
  if (idx >= 0) activeVoices.splice(idx, 1);
};

const registerVoice = (stopFn: (t?: number) => void) => {
  const id = ++activeVoiceId;
  let stopped = false;
  const wrappedStop = (t?: number) => {
    if (stopped) return;
    stopped = true;
    removeVoice(id);
    stopFn(t);
  };
  activeVoices.push({ id, startedAt: Date.now(), stop: wrappedStop });
  const { maxPolyphony } = getAudioProfile();
  if (Number.isFinite(maxPolyphony) && maxPolyphony > 0) {
    while (activeVoices.length > maxPolyphony) {
      let oldestIndex = 0;
      for (let i = 1; i < activeVoices.length; i++) {
        if (activeVoices[i].startedAt < activeVoices[oldestIndex].startedAt) {
          oldestIndex = i;
        }
      }
      activeVoices[oldestIndex].stop();
    }
  }
  return wrappedStop;
};

export const panicAudioPlayback = () => {
  activeVoices.splice(0).forEach((voice) => voice.stop());
};

const getInstrumentSelection = (settings: AppSettings, ctxMode: 'click' | 'keyboard' | 'chord' | 'sequence') => {
  return (
    (ctxMode === 'click'
      ? settings.instrumentClick
      : ctxMode === 'keyboard'
        ? settings.instrumentKeyboard
        : settings.instrumentChord) || settings.waveform
  );
};

const getTimbreInstrumentId = (instrument: string | undefined) => {
  if (!instrument) return null;
  return instrument.startsWith(TIMBRE_INSTRUMENT_PREFIX)
    ? instrument.slice(TIMBRE_INSTRUMENT_PREFIX.length)
    : null;
};

const getTimbrePatchById = (settings: AppSettings, id: string) => {
  const timbre = settings.timbre;
  if (!timbre || !timbre.patches || timbre.patches.length === 0) return null;
  return (
    timbre.patches.find(p => p.id === id) ||
    timbre.patches.find(p => p.id === timbre.activePatchId) ||
    timbre.patches[0] ||
    null
  );
};

export const startFrequency = (
  freq: number,
  s: AppSettings,
  ctxMode: 'click' | 'keyboard' | 'chord' | 'sequence' = 'click',
  pan: number = 0,
  startTime?: number,
  velocityOrOpts?: number | StartNoteOptions,
  noteKey?: string
) => {
  const ctx = initAudio();

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = startTime !== undefined ? startTime : ctx.currentTime;
  const safe = safeFreq(freq);
  const masterBus = getMasterBus() || ctx.destination;

  let inputNode: AudioNode;

  if (ctx.createStereoPanner && Math.abs(pan) > 0.05) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(masterBus);
    inputNode = panner;
  } else {
    inputNode = masterBus;
  }

  const gain = ctx.createGain();
  gain.connect(inputNode);
  const shouldDisconnectInput = inputNode !== masterBus && inputNode !== ctx.destination;
  const opts = typeof velocityOrOpts === 'number' ? { velocity: velocityOrOpts } : velocityOrOpts || {};
  const velocity = Math.max(0, Math.min(opts.velocity ?? 1, 1));
  const voiceMods = opts.voiceMods;
  const mappingKey = noteKey ?? opts.noteKey ?? 'hchroma';
  const voiceKey = opts.noteKey ?? mappingKey;
  const stopMidi = startMidiOutFrequency(safe, s, velocity);
  const inst = getInstrumentSelection(s, ctxMode);
  const timbreInstrumentId = getTimbreInstrumentId(inst);

  if (timbreInstrumentId) {
    const patch = getTimbrePatchById(s, timbreInstrumentId);
    if (patch) {
      const stopAudio = startTimbreVoice(ctx, gain, safe, patch, s, ctxMode, now, voiceKey, velocity, voiceMods);
      const stopVoice = (stopTime?: number) => {
        stopMidi();
        stopAudio();
      };
      return registerVoice(stopVoice);
    }
    reportTimbreEngineError('Timbre patch not found for instrument selection.');
  }

  if (s.timbre?.engineMode === 'timbre') {
    const patch = resolveTimbrePatch(s, ctxMode, mappingKey);
    if (patch) {
      const stopAudio = startTimbreVoice(ctx, gain, safe, patch, s, ctxMode, now, voiceKey, velocity, voiceMods);
      const stopVoice = (stopTime?: number) => {
        stopMidi();
        stopAudio();
      };
      return registerVoice(stopVoice);
    }
    reportTimbreEngineError('No timbre patch available for playback.');
    return registerVoice(() => stopMidi());
  }

  const safeInst = timbreInstrumentId ? s.waveform : inst;
  const synthDefaults = DEFAULT_SETTINGS.synthPatches;
  const synthPatch =
    safeInst === 'custom-synth' && (s as any).synthPatches?.enabled
      ? ctxMode === 'click'
        ? (s as any).synthPatches.clickPatch || synthDefaults?.clickPatch
        : ctxMode === 'keyboard'
          ? (s as any).synthPatches.keyboardPatch || synthDefaults?.keyboardPatch
          : (s as any).synthPatches.chordPatch || synthDefaults?.chordPatch
      : undefined;
  const resolvedInst = safeInst === 'custom-synth' && !synthPatch ? 'sine' : safeInst;
  const voice = setupVoice(ctx, gain, safe, resolvedInst as any, now, synthPatch);

  const maxGain = ctxMode === 'chord' ? 0.12 : 0.2;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(maxGain, now + 0.02);

  const stopVoice = (stopTime?: number) => {
    stopMidi();
    const end = stopTime !== undefined ? stopTime : ctx.currentTime;
    gain.gain.cancelScheduledValues(end);
    gain.gain.exponentialRampToValueAtTime(0.001, end + 0.15);
    voice.stop(end + 0.2);

    if (shouldDisconnectInput) {
      setTimeout(() => {
        try {
          (inputNode as any).disconnect();
        } catch (e) {}
      }, Math.max(80, (end - now + 0.5) * 1000));
    }
  };
  return registerVoice(stopVoice);
};

export const startNote = (
  n: NodeData,
  s: AppSettings,
  ctxMode: 'click' | 'keyboard' | 'chord' | 'sequence' = 'keyboard',
  pan: number = 0,
  startTime?: number,
  velocityOrOpts?: number | StartNoteOptions
) => {
  const ctx = initAudio();

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = startTime !== undefined ? startTime : ctx.currentTime;

  let freq = 0;
  const morph = s.visuals?.temperamentMorph || 0;

  if (morph > 0) {
    const absoluteJiCents = n.cents + n.octave * 1200;

    const divisions = s.visuals.tetDivisions || 12;
    const step = 1200 / divisions;
    const targetTetCents = Math.round(absoluteJiCents / step) * step;

    const blendedCents = absoluteJiCents * (1 - morph) + targetTetCents * morph;

    freq = s.baseFrequency * Math.pow(2, blendedCents / 1200);
  } else {
    freq = getFrequency(s.baseFrequency, n.ratio, n.ratioFloat);

    if (Math.abs(n.octave) > 0) {
      freq *= Math.pow(2, n.octave);
    }
  }

  freq = safeFreq(freq);
  const masterBus = getMasterBus() || ctx.destination;

  let inputNode: AudioNode;

  if (ctx.createStereoPanner && Math.abs(pan) > 0.05) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(masterBus);
    inputNode = panner;
  } else {
    inputNode = masterBus;
  }

  const gain = ctx.createGain();
  gain.connect(inputNode);
  const shouldDisconnectInput = inputNode !== masterBus && inputNode !== ctx.destination;
  const opts = typeof velocityOrOpts === 'number' ? { velocity: velocityOrOpts } : velocityOrOpts || {};
  const velocity = Math.max(0, Math.min(opts.velocity ?? 1, 1));
  const voiceMods = opts.voiceMods;
  const stopMidi = startMidiOutFrequency(freq, s, velocity);
  const inst = getInstrumentSelection(s, ctxMode);
  const timbreInstrumentId = getTimbreInstrumentId(inst);
  const timbreNoteKey = getNoteKey(n, s, s.timbre.mapping?.noteKeyMode || 'full');
  const voiceKey = opts.noteKey ?? timbreNoteKey;

  if (timbreInstrumentId) {
    const patch = getTimbrePatchById(s, timbreInstrumentId);
    if (patch) {
      const stopAudio = startTimbreVoice(ctx, gain, freq, patch, s, ctxMode, now, voiceKey, velocity, voiceMods);
      const stopVoice = (stopTime?: number) => {
        stopMidi();
        stopAudio();
      };
      return registerVoice(stopVoice);
    }
    reportTimbreEngineError('Timbre patch not found for instrument selection.');
  }

  if (s.timbre?.engineMode === 'timbre') {
    const patch = resolveTimbrePatch(s, ctxMode, timbreNoteKey);
    if (patch) {
      const stopAudio = startTimbreVoice(ctx, gain, freq, patch, s, ctxMode, now, voiceKey, velocity, voiceMods);
      const stopVoice = (stopTime?: number) => {
        stopMidi();
        stopAudio();
      };
      return registerVoice(stopVoice);
    }
    reportTimbreEngineError('No timbre patch available for playback.');
    return registerVoice(() => stopMidi());
  }
  const safeInst = timbreInstrumentId ? s.waveform : inst;
  const synthDefaults = DEFAULT_SETTINGS.synthPatches;
  const synthPatch =
    safeInst === 'custom-synth' && (s as any).synthPatches?.enabled
      ? ctxMode === 'click'
        ? (s as any).synthPatches.clickPatch || synthDefaults?.clickPatch
        : ctxMode === 'keyboard'
          ? (s as any).synthPatches.keyboardPatch || synthDefaults?.keyboardPatch
          : (s as any).synthPatches.chordPatch || synthDefaults?.chordPatch
      : undefined;
  const resolvedInst = safeInst === 'custom-synth' && !synthPatch ? 'sine' : safeInst;
  const voice = setupVoice(ctx, gain, freq, resolvedInst as any, now, synthPatch);

  const maxGain = ctxMode === 'chord' ? 0.12 : 0.2;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(maxGain, now + 0.02);

  const stopVoice = (stopTime?: number) => {
    stopMidi();
    const end = stopTime !== undefined ? stopTime : ctx.currentTime;
    gain.gain.cancelScheduledValues(end);
    gain.gain.exponentialRampToValueAtTime(0.001, end + 0.15);
    voice.stop(end + 0.2);

    if (shouldDisconnectInput) {
      setTimeout(() => {
        try {
          (inputNode as any).disconnect();
        } catch (e) {}
      }, Math.max(80, (end - now + 0.5) * 1000));
    }
  };
  return registerVoice(stopVoice);
};

export const playNote = (n: NodeData, s: AppSettings) => {
  const stop = startNote(n, s, 'click', 0);
  setTimeout(stop, s.playDurationSingle * 1000);
};

export const playSimultaneous = (n1: NodeData, n2: NodeData, s: AppSettings) => {
  const s1 = startNote(n1, s, 'chord', -0.6);
  const s2 = startNote(n2, s, 'chord', 0.6);
  setTimeout(() => {
    s1();
    s2();
  }, s.playDurationDual * 1000);
};
