
import type { AppSettings, WebMidi } from './types';
import { RetunerEngine, IRetunerTransport } from './engine/retuner/retunerEngine';
import { RetunerSettings } from './domain/retuner/types';
import { 
  OutputDestination, 
  getPitchBendRangeFromDestination,
  createDefaultDestination 
} from './domain/retuner/destination';
import { SysExQueue, createSysExQueue } from './engine/midi/sysexQueue';
import { MidiDeviceManager } from './engine/midi/midiDeviceManager';
import { SYSEX_QUEUE_DEFAULTS } from './constants';
import { createLogger } from './utils/logger';

type MidiOutConfig = {
  enabled: boolean;
  outputId: string;
  channel: number; 
};

const isBrowser = () => typeof window !== 'undefined' && typeof navigator !== 'undefined';

const log = createLogger('midi/out');

let midiAccessPromise: Promise<WebMidi.MIDIAccess | null> | null = null;

const sentRpnKeys: Set<string> = new Set();
let retunerInstance: RetunerEngine | null = null;
let sysexQueueInstance: SysExQueue | null = null;
let deviceManagerInstance: MidiDeviceManager | null = null;

// Retuner transport/queue are shared per app instance (so output config can be cached).
let transportInstance: WebMidiTransport | null = null;
let transportOutputId: string | null = null;

class WebMidiTransport implements IRetunerTransport {
  private cachedOutput: WebMidi.MIDIOutput | null = null;
  private outputPromise: Promise<WebMidi.MIDIOutput | null> | null = null;
  private queue: SysExQueue | null = null;

  constructor(private outputId: string) {}

  attachQueue(queue: SysExQueue | null): void {
    this.queue = queue;
  }

  async getOutput(): Promise<WebMidi.MIDIOutput | null> {
    if (this.cachedOutput) return this.cachedOutput;
    if (this.outputPromise) return this.outputPromise;

    this.outputPromise = (async () => {
      const access = await getMidiAccess();
      const out = access ? pickOutput(access, this.outputId) : null;
      this.cachedOutput = out;
      this.outputPromise = null;
      return out;
    })();

    return this.outputPromise;
  }

  sendMidi(bytes: number[], _priority: 'urgent' | 'config' | 'normal' = 'normal'): void {
    if (this.cachedOutput) {
      try {
        this.cachedOutput.send(bytes);
      } catch (e) {
        log.error('Send error', e);
      }
      return;
    }

    // Lazily resolve output then send.
    void this.getOutput().then(out => {
      if (!out) return;
      try {
        out.send(bytes);
      } catch {
        // ignore
      }
    });
  }

  sendMidiQueued(bytes: number[], priority: 'normal' | 'bulk' = 'normal'): void {
    if (!this.queue) {
      this.sendMidi(bytes);
      return;
    }
    this.queue.enqueue(bytes, priority === 'bulk' ? 'bulk' : 'normal');
  }

  async flushConfig(): Promise<void> {
    if (this.queue) {
      await this.queue.flush();
    }
  }

  sendAllNotesOff(): void {
    if (this.cachedOutput) {
      for (let c = 0; c < 16; c++) {
        try {
          this.cachedOutput.send([0xB0 | c, 123, 0]);
        } catch {
          // ignore
        }
      }
    }
  }

  updateOutputId(outputId: string): void {
    this.outputId = outputId;
    this.cachedOutput = null;
    this.outputPromise = null;
  }
}

const getMidiOutConfig = (s: AppSettings): MidiOutConfig => {
  const midi = s.midi as any;
  return {
    enabled: Boolean(midi?.outputEnabled),
    outputId: String(midi?.outputId || ''),
    channel: Math.min(16, Math.max(1, Math.floor(Number(midi?.outputChannel ?? 1)))),
    
  };
};

const getActiveDestination = (s: AppSettings): OutputDestination | null => {
  const retunerConfig = (s as any).retuner as RetunerSettings | undefined;
  const destinations = (s as any).retunerDestinations as OutputDestination[] | undefined;
  
  if (!destinations || destinations.length === 0) {
    
    const defaultDest = createDefaultDestination('webmidi', 'Default MIDI Output');
    
    const legacyPbRange = retunerConfig?.outputPitchBendRange 
      ?? (s.midi as any)?.outputPitchBendRange 
      ?? 48;
    defaultDest.pitchBendRangeSemitones = legacyPbRange;
    defaultDest.webmidi = {
      outputId: (s.midi as any)?.outputId ?? '',
      sendRpnOnConnect: true,
    };
    
    return defaultDest;
  }
  
  const activeId = retunerConfig?.destinationId;
  if (activeId) {
    const found = destinations.find(d => d.id === activeId);
    if (found) return found;
  }
  
  return destinations[0];
};

const getPitchBendRange = (s: AppSettings): number => {
  const destination = getActiveDestination(s);
  return getPitchBendRangeFromDestination(destination, 48);
};

export const getMidiAccess = async (): Promise<WebMidi.MIDIAccess | null> => {
  if (!isBrowser()) return null;
  if (!('requestMIDIAccess' in navigator)) return null;
  if (!midiAccessPromise) {
    midiAccessPromise = (navigator as any)
      .requestMIDIAccess({ sysex: true })
      .then((access: WebMidi.MIDIAccess) => access)
      .catch(() => null);
  }
  return midiAccessPromise;
};

export const listMidiOutputs = async (): Promise<WebMidi.MIDIOutput[]> => {
  
  if (deviceManagerInstance) {
    const devices = deviceManagerInstance.getDevices();
    const outputs = devices.filter(d => d.type === 'output' && d.state === 'connected');
    
    const access = await getMidiAccess();
    if (!access) return [];
    
    const allOutputs = Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[];
    return allOutputs.filter(out => outputs.some(d => d.id === out.id));
  }
  
  const access = await getMidiAccess();
  if (!access) return [];
  return Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[];
};

export const listMidiInputs = async (): Promise<WebMidi.MIDIInput[]> => {
  const access = await getMidiAccess();
  if (!access) return [];
  return Array.from((access as any).inputs?.values?.() || []) as WebMidi.MIDIInput[];
};

const pickOutput = (access: WebMidi.MIDIAccess, outputId: string): WebMidi.MIDIOutput | null => {
  const outputs = Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[];
  if (outputs.length === 0) return null;

  // 1) Explicit outputId (destination selection) wins.
  if (outputId) {
    const found = outputs.find(o => o.id === outputId || o.name === outputId);
    if (found) return found;
  }

  // 2) Device manager selection is next.
  if (deviceManagerInstance) {
    const selectedDevice = deviceManagerInstance.getSelectedDevice();
    if (selectedDevice && selectedDevice.type === 'output') {
      const found = outputs.find(o => o.id === selectedDevice.id);
      if (found) return found;
    }
  }

  // 3) Fallback to first available output.
  return outputs[0];
};

const ensureRawOutput = (access: WebMidi.MIDIAccess, outputId: string): WebMidi.MIDIOutput | null => {
  const output = pickOutput(access, outputId);
  if (!output) return null;
  if (rawOutputId && rawOutputId !== output.id) {
    if (rawOutput) {
      panicOutput(rawOutput);
    }
    activeNotes.clear();
    channelNoteCount.fill(0);
  }
  rawOutputId = output.id;
  rawOutput = output;
  return output;
};

const sendRpnPitchBendRange = (output: WebMidi.MIDIOutput, channel: number, semitones: number) => {
  const ch = (channel - 1) & 0x0f;
  const cc = (n: number, v: number) => output.send([0xb0 | ch, n & 0x7f, v & 0x7f]);

  cc(101, 0);
  cc(100, 0);
  cc(6, semitones & 0x7f);
  cc(38, 0);
  
  cc(101, 127);
  cc(100, 127);
};

const sendAllNotesOffToOutput = (output: WebMidi.MIDIOutput) => {
  for (let c = 0; c < 16; c++) {
    output.send([0xB0 | c, 123, 0]);
  }
};

const sendAllSoundOffToOutput = (output: WebMidi.MIDIOutput) => {
  for (let c = 0; c < 16; c++) {
    output.send([0xB0 | c, 120, 0]);
  }
};

const sendResetControllersToOutput = (output: WebMidi.MIDIOutput) => {
  for (let c = 0; c < 16; c++) {
    output.send([0xB0 | c, 121, 0]);
  }
};

const panicOutput = (output: WebMidi.MIDIOutput) => {
  try {
    sendAllSoundOffToOutput(output);
    sendResetControllersToOutput(output);
    sendAllNotesOffToOutput(output);
  } catch {
    // ignore
  }
};

const midiNoteFromHz = (hz: number) => 69 + 12 * Math.log2(hz / 440);

const clamp14 = (v: number) => Math.min(16383, Math.max(0, Math.round(v)));

const pitchBendForHz = (hz: number, note: number, bendRange: number) => {
  const noteHz = 440 * Math.pow(2, (note - 69) / 12);
  const semis = 12 * Math.log2(hz / noteHz);
  const norm = semis / bendRange; 
  const value = 8192 + norm * 8192;
  return clamp14(value);
};

interface ActiveNote {
  channel: number;
  note: number;
  hz: number;
  outputId: string;
  output: WebMidi.MIDIOutput;
}

const activeNotes: Map<string, ActiveNote> = new Map();
const channelNoteCount: number[] = new Array(16).fill(0);
let rawOutputId: string | null = null;
let rawOutput: WebMidi.MIDIOutput | null = null;

const getAvailableChannels = (s: AppSettings): number[] => {
  const midi = s.midi as any;
  
  const polyphonicMode = midi?.polyphonicChannelMode !== false;
  
  if (polyphonicMode) {
    
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  }
  
  if (midi?.outputChannels && Array.isArray(midi.outputChannels) && midi.outputChannels.length > 0) {
    return midi.outputChannels;
  }
  return [Math.min(16, Math.max(1, Math.floor(Number(midi?.outputChannel ?? 1))))];
};

const allocateChannel = (availableChannels: number[]): number => {
  if (availableChannels.length === 1) {
    return availableChannels[0];
  }
  
  for (const ch of availableChannels) {
    const count = channelNoteCount[ch - 1] || 0;
    if (count === 0) {
      return ch;
    }
  }
  
  let minCount = Infinity;
  let bestChannel = availableChannels[0];
  
  for (const ch of availableChannels) {
    const count = channelNoteCount[ch - 1] || 0;
    if (count < minCount) {
      minCount = count;
      bestChannel = ch;
    }
  }
  
  return bestChannel;
};

const generateNoteKey = (hz: number): string => {
  return `note-${hz.toFixed(4)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const startMidiOutFrequency = (hz: number, s: AppSettings, velocity01: number = 1) => {
  const cfg = getMidiOutConfig(s);
  if (!cfg.enabled) return () => {};
  if (!Number.isFinite(hz) || hz <= 0) return () => {};

  const noteState = {
    stopped: false,
    noteOnSent: false,
    output: null as WebMidi.MIDIOutput | null,
    outputId: '',
    note: 0,
  };
  
  const availableChannels = getAvailableChannels(s);
  const ch = allocateChannel(availableChannels);
  const noteKey = generateNoteKey(hz);

  const vel = Math.min(127, Math.max(1, Math.round((velocity01 || 1) * 127)));

  const pitchBendRange = getPitchBendRange(s);
  const destination = getActiveDestination(s);

  const retunerConfig = (s as any).retuner as RetunerSettings | undefined;
  if (retunerConfig?.enabled && retunerConfig?.mode !== 'none') {
    // Resolve the outputId from the active destination (webmidi destinations control the actual device).
    const destOutputId = (destination?.type === 'webmidi')
      ? (destination.webmidi?.outputId ?? '')
      : '';
    const resolvedOutputId = destOutputId || cfg.outputId;

    // Ensure a shared transport exists and points to the correct output.
    if (!transportInstance) {
      transportInstance = new WebMidiTransport(resolvedOutputId);
      transportOutputId = resolvedOutputId;
    } else if (transportOutputId !== resolvedOutputId) {
      // Prevent stuck notes when switching outputs mid-session.
      retunerInstance?.panic();
      retunerInstance?.allNotesOff();
      sysexQueueInstance?.clear();

      transportInstance.updateOutputId(resolvedOutputId);
      transportOutputId = resolvedOutputId;
    }

    // Ensure throttled queue exists for CC/RPN/SysEx bursts.
    if (!sysexQueueInstance) {
      sysexQueueInstance = createSysExQueue(transportInstance, SYSEX_QUEUE_DEFAULTS);
      transportInstance.attachQueue(sysexQueueInstance);
    } else {
      // Keep queue attached (in case transport got re-created in the future).
      transportInstance.attachQueue(sysexQueueInstance);
    }

    if (!retunerInstance) {
      retunerInstance = new RetunerEngine(transportInstance, retunerConfig, destination);
    } else {
      retunerInstance.updateSettings(retunerConfig);
      retunerInstance.updateDestination(destination);
    }

    const inputNote = Math.min(127, Math.max(0, Math.round(midiNoteFromHz(hz))));
    retunerInstance.handleNoteOn(inputNote, vel, hz);

    return () => {
      retunerInstance?.handleNoteOff(inputNote, 0, 1);
    };
  }

  const fireAndForget = async () => {
    const access = await getMidiAccess();
    if (!access) return;
    const output = ensureRawOutput(access, cfg.outputId);
    if (!output) return;

    noteState.output = output;
    noteState.outputId = output.id;
    if (noteState.stopped) return;

    const note = Math.min(127, Math.max(0, Math.round(midiNoteFromHz(hz))));
    noteState.note = note;

    const rpnKey = `${output.id}|${ch}|${pitchBendRange}`;
    if (!sentRpnKeys.has(rpnKey)) {
      sentRpnKeys.add(rpnKey);
      try {
        sendRpnPitchBendRange(output, ch, pitchBendRange);
      } catch {}
    }

    const bend = pitchBendForHz(hz, note, pitchBendRange);
    const lsb = bend & 0x7f;
    const msb = (bend >> 7) & 0x7f;
    const statusBend = 0xe0 | ((ch - 1) & 0x0f);
    const statusOn = 0x90 | ((ch - 1) & 0x0f);

    let sent = false;
    try {
      output.send([statusBend, lsb, msb]);
      output.send([statusOn, note & 0x7f, vel & 0x7f]);
      sent = true;
    } catch {}
    if (!sent) return;

    noteState.noteOnSent = true;
    activeNotes.set(noteKey, { channel: ch, note, hz, outputId: output.id, output });
    channelNoteCount[ch - 1] = (channelNoteCount[ch - 1] || 0) + 1;
    if (noteState.stopped) {
      try {
        output.send([0x80 | ((ch - 1) & 0x0f), note & 0x7f, 0]);
      } catch {}
      activeNotes.delete(noteKey);
      channelNoteCount[ch - 1] = Math.max(0, (channelNoteCount[ch - 1] || 0) - 1);
    }
  };

  void fireAndForget();

  return () => {
    if (noteState.stopped) return;
    noteState.stopped = true;

    if (!noteState.noteOnSent) return;

    const activeNote = activeNotes.get(noteKey);
    if (activeNote) {
      activeNotes.delete(noteKey);
      channelNoteCount[activeNote.channel - 1] = Math.max(0, (channelNoteCount[activeNote.channel - 1] || 0) - 1);
    }
    const output = activeNote?.output ?? noteState.output ?? rawOutput;
    if (!output) return;
    const note = activeNote?.note ?? noteState.note;
    const statusOff = 0x80 | ((ch - 1) & 0x0f);
    try {
      output.send([statusOff, note & 0x7f, 0]);
    } catch {}
  };
};

export const setDeviceManager = (manager: MidiDeviceManager | null) => {
  deviceManagerInstance = manager;
};

export const getDeviceManager = (): MidiDeviceManager | null => {
  return deviceManagerInstance;
};

export { getActiveDestination, getPitchBendRange };

export const panicMidiOut = () => {
  if (retunerInstance) {
    retunerInstance.panic();
    retunerInstance.allNotesOff();
  }
  if (transportInstance) {
    for (let c = 0; c < 16; c++) {
      transportInstance.sendMidi([0xB0 | c, 121, 0]);
    }
    transportInstance.sendAllNotesOff();
  }
  if (rawOutput) {
    panicOutput(rawOutput);
  }
  activeNotes.clear();
  channelNoteCount.fill(0);
  sysexQueueInstance?.clear();
};

export const cleanupMidiOut = () => {
  if (retunerInstance) {
    retunerInstance.allNotesOff();
    retunerInstance = null;
  }
  if (sysexQueueInstance) {
    sysexQueueInstance.stop();
    sysexQueueInstance.clear();
    sysexQueueInstance = null;
  }
  if (transportInstance) {
    // Ensure queue is detached and transport cache cleared.
    transportInstance.attachQueue(null);
  }
  transportInstance = null;
  transportOutputId = null;
  if (deviceManagerInstance) {
    deviceManagerInstance.dispose();
    deviceManagerInstance = null;
  }
  sentRpnKeys.clear();
  activeNotes.clear();
  channelNoteCount.fill(0);
  rawOutput = null;
  rawOutputId = null;
};
