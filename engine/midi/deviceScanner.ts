
import type { WebMidi } from '../../types';
import type { MidiDeviceInfo, DeviceScanResult } from './deviceManager';
import { isCompatibleDevice } from './deviceManager';
import { createLogger } from '../../utils/logger';

export interface DeviceScannerOptions {
  
  scanInterval?: number;
  
  compatiblePatterns?: string[];
}

const log = createLogger('midi/device-scanner');

export class DeviceScanner {
  private midiAccess: WebMidi.MIDIAccess;
  private knownDevices: Set<string>;
  private compatiblePatterns: RegExp[];
  private scanInterval: number;
  private intervalId: ReturnType<typeof setInterval> | null;
  private lastScanResult: DeviceScanResult | null;

  constructor(midiAccess: WebMidi.MIDIAccess, options?: DeviceScannerOptions) {
    this.midiAccess = midiAccess;
    this.knownDevices = new Set();
    this.scanInterval = options?.scanInterval ?? 2000;
    this.intervalId = null;
    this.lastScanResult = null;

    this.compatiblePatterns = [
      /ARIUS/i,
      /Digital\s+Piano/i,
      /Yamaha\s+USB/i,
    ];

    if (options?.compatiblePatterns) {
      for (const pattern of options.compatiblePatterns) {
        try {
          this.compatiblePatterns.push(new RegExp(pattern, 'i'));
        } catch (error) {
          log.warn('Invalid pattern', { pattern, error });
        }
      }
    }
  }

  startScanning(callback: (result: DeviceScanResult) => void): void {
    if (this.intervalId !== null) {
      log.warn('Already scanning');
      return;
    }

    const initialResult = this.scanOnce();
    callback(initialResult);

    this.intervalId = setInterval(() => {
      const result = this.scanOnce();
      
      if (result.changes.added.length > 0 || result.changes.removed.length > 0) {
        callback(result);
      }
    }, this.scanInterval);
  }

  stopScanning(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  scanOnce(): DeviceScanResult {
    const inputs: MidiDeviceInfo[] = [];
    const outputs: MidiDeviceInfo[] = [];

    const inputPorts = Array.from(this.midiAccess.inputs.values());
    for (const port of inputPorts) {
      const deviceInfo = this.extractDeviceInfo(port, 'input');
      inputs.push(deviceInfo);
    }

    const outputPorts = Array.from(this.midiAccess.outputs.values());
    for (const port of outputPorts) {
      const deviceInfo = this.extractDeviceInfo(port, 'output');
      outputs.push(deviceInfo);
    }

    const allDevices = [...inputs, ...outputs];

    const changes = this.detectChanges(allDevices);

    this.knownDevices.clear();
    for (const device of allDevices) {
      this.knownDevices.add(device.id);
    }

    const result: DeviceScanResult = {
      inputs,
      outputs,
      changes,
    };

    this.lastScanResult = result;
    return result;
  }

  isCompatibleDevice(name: string): boolean {
    return isCompatibleDevice(name);
  }

  getLastScanResult(): DeviceScanResult | null {
    return this.lastScanResult;
  }

  isScanning(): boolean {
    return this.intervalId !== null;
  }

  private extractDeviceInfo(
    port: WebMidi.MIDIInput | WebMidi.MIDIOutput,
    type: 'input' | 'output'
  ): MidiDeviceInfo {
    const name = port.name || 'Unknown Device';
    const manufacturer = (port as any).manufacturer || 'Unknown';
    const state = (port as any).state === 'connected' ? 'connected' : 'disconnected';

    return {
      id: port.id,
      name,
      manufacturer,
      type,
      state,
      isCompatible: this.isCompatibleDevice(name),
      lastSeen: Date.now(),
    };
  }

  private detectChanges(current: MidiDeviceInfo[]): DeviceScanResult['changes'] {
    const currentIds = new Set(current.map(d => d.id));
    const added: MidiDeviceInfo[] = [];
    const removed: string[] = [];

    for (const device of current) {
      if (!this.knownDevices.has(device.id)) {
        added.push(device);
      }
    }

    for (const knownId of this.knownDevices) {
      if (!currentIds.has(knownId)) {
        removed.push(knownId);
      }
    }

    return { added, removed };
  }

  getStatistics(): {
    isScanning: boolean;
    scanInterval: number;
    knownDeviceCount: number;
    lastScanTime: number | null;
  } {
    return {
      isScanning: this.isScanning(),
      scanInterval: this.scanInterval,
      knownDeviceCount: this.knownDevices.size,
      lastScanTime: this.lastScanResult?.inputs[0]?.lastSeen ?? null,
    };
  }

  setScanInterval(intervalMs: number): void {
    if (intervalMs < 100) {
      log.warn('Scan interval too low, using minimum 100ms');
      intervalMs = 100;
    }

    this.scanInterval = intervalMs;

    if (this.intervalId !== null) {
      const wasScanning = true;
      this.stopScanning();
      
      log.info('Scan interval updated. Restart scanning to apply.');
    }
  }

  dispose(): void {
    this.stopScanning();
    this.knownDevices.clear();
    this.lastScanResult = null;
  }
}

export function createDeviceScanner(
  midiAccess: WebMidi.MIDIAccess,
  options?: DeviceScannerOptions
): DeviceScanner {
  return new DeviceScanner(midiAccess, options);
}
