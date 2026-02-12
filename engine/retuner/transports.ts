import type { WebMidi } from '../../types';
import { createSysExQueue, SysExQueue } from '../midi/sysexQueue';
import { SYSEX_QUEUE_DEFAULTS } from '../../constants';
import { IRetunerTransport } from './retunerEngine';
import { createLogger } from '../../utils/logger';
import { nativeBridgeCore, midiRpc, mtsRpc } from '../../native/bridge';

const log = createLogger('retuner/transports');

const getMidiAccess = async (): Promise<WebMidi.MIDIAccess | null> => {
  if (typeof navigator === 'undefined') return null;
  if (!(navigator as any).requestMIDIAccess) return null;
  try {
    const access = await (navigator as any).requestMIDIAccess({ sysex: true });
    return access as WebMidi.MIDIAccess;
  } catch (e) {
    log.warn('requestMIDIAccess failed', e);
    return null;
  }
};

const pickOutput = (access: WebMidi.MIDIAccess, outputId: string): WebMidi.MIDIOutput | null => {
  const outputs = Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[];
  if (outputs.length === 0) return null;
  if (outputId) {
    const found = outputs.find((o) => o.id === outputId || o.name === outputId);
    if (found) return found;
  }
  return outputs[0];
};

export class WebMidiRetunerTransport implements IRetunerTransport {
  private cachedOutput: WebMidi.MIDIOutput | null = null;
  private outputPromise: Promise<WebMidi.MIDIOutput | null> | null = null;
  private queue: SysExQueue | null = null;

  constructor(private outputId: string) {}

  attachQueue(queue: SysExQueue | null): void {
    this.queue = queue;
  }

  async connect(): Promise<void> {
    const output = await this.getOutput();
    if (!output) throw new Error('OUTPUT_NOT_FOUND');
  }

  async disconnect(): Promise<void> {
    this.cachedOutput = null;
    this.outputPromise = null;
  }

  isConnected(): boolean {
    return !!this.cachedOutput;
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
        log.warn('Send failed', e);
      }
      return;
    }
    void this.getOutput().then((out) => {
      if (!out) return;
      try {
        out.send(bytes);
      } catch (e) {
        log.warn('Send failed', e);
      }
    });
  }

  sendMidiQueued(bytes: number[], priority: 'normal' | 'bulk' = 'normal'): void {
    if (!this.queue) {
      this.sendMidi(bytes, 'config');
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
    if (!this.cachedOutput) return;
    for (let c = 0; c < 16; c++) {
      try {
        this.cachedOutput.send([0xB0 | c, 123, 0]);
      } catch {
        // ignore
      }
    }
  }

  updateOutputId(outputId: string): void {
    this.outputId = outputId;
    this.cachedOutput = null;
    this.outputPromise = null;
  }

  getCapabilities(): { supportsPb: boolean; supportsMpe: boolean; supportsMts: boolean; transport?: string } {
    return { supportsPb: true, supportsMpe: true, supportsMts: false, transport: 'webmidi' };
  }
}

export class NativeHostTransport implements IRetunerTransport {
  private connected = false;

  async connect(): Promise<void> {
    if (!nativeBridgeCore.isConnected() || nativeBridgeCore.isMockMode()) {
      throw new Error('BRIDGE_DISCONNECTED');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  sendMidi(bytes: number[], _priority: 'urgent' | 'config' | 'normal' = 'normal'): void {
    void midiRpc.send(bytes).catch((e) => log.warn('Native MIDI send failed', e));
  }

  sendAllNotesOff(): void {
    for (let c = 0; c < 16; c++) {
      this.sendMidi([0xB0 | c, 123, 0], 'urgent');
    }
  }

  getCapabilities(): { supportsPb: boolean; supportsMpe: boolean; supportsMts: boolean; transport?: string } {
    return { supportsPb: true, supportsMpe: true, supportsMts: true, transport: 'native-host' };
  }
}

export class MtsEspTransport implements IRetunerTransport {
  private connected = false;

  async connect(): Promise<void> {
    if (!nativeBridgeCore.isConnected() || nativeBridgeCore.isMockMode()) {
      throw new Error('BRIDGE_DISCONNECTED');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  sendMidi(bytes: number[], _priority: 'urgent' | 'config' | 'normal' = 'normal'): void {
    void midiRpc.send(bytes).catch((e) => log.warn('MTS passthrough send failed', e));
  }

  sendAllNotesOff(): void {
    for (let c = 0; c < 16; c++) {
      this.sendMidi([0xB0 | c, 123, 0], 'urgent');
    }
  }

  async broadcastTuning(tuningTable: number[]): Promise<void> {
    await mtsRpc.broadcast(tuningTable);
  }

  async getClientCount(): Promise<number> {
    return mtsRpc.getClientCount();
  }

  getCapabilities(): { supportsPb: boolean; supportsMpe: boolean; supportsMts: boolean; transport?: string } {
    return { supportsPb: false, supportsMpe: false, supportsMts: true, transport: 'mts-esp' };
  }
}

export const createDefaultQueue = (transport: IRetunerTransport): SysExQueue => {
  return createSysExQueue(transport, SYSEX_QUEUE_DEFAULTS);
};
