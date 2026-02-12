
import type { WebMidi } from '../../types';
import type { SysExQueue } from './sysexQueue';
import type { IRetunerTransport } from '../retuner/retunerEngine';
import { createLogger } from '../../utils/logger';

export interface MidiDeviceInfo {
  
  id: string;
  
  name: string;
  
  manufacturer: string;
  
  type: 'input' | 'output';
  
  state: 'connected' | 'disconnected';
  
  isCompatible: boolean;
  
  lastSeen: number;
}

export interface DeviceConfiguration {
  
  selectedDeviceId: string | null;
  
  localControlState: 'on' | 'off' | 'unknown';
  
  channelMode: 'omni' | 'single';
  
  activeChannel: number;
  
  tuningMapId: string | null;
}

export interface DeviceState {
  
  deviceInfo: MidiDeviceInfo;
  
  configuration: DeviceConfiguration;
  
  connectionStatus: {
    connected: boolean;
    lastConnected: Date | null;
    lastDisconnected: Date | null;
    reconnectAttempts: number;
  };
  
  statistics: {
    messagesReceived: number;
    messagesSent: number;
    errors: number;
    lastActivity: Date | null;
  };
}

export interface DeviceScanResult {
  
  inputs: MidiDeviceInfo[];
  
  outputs: MidiDeviceInfo[];
  
  changes: {
    added: MidiDeviceInfo[];
    removed: string[];
  };
}

export interface LocalControlCommand {
  
  channel: number;
  
  state: 'on' | 'off';
}

export interface PanicOptions {
  
  sendAllNotesOff: boolean;
  
  sendResetControllers: boolean;
  
  resetPitchBend: boolean;
  
  clearQueue: boolean;
}

export interface TuningAssignment {
  
  midiNote: number;
  
  frequency: number;
  
  cents: number;
  
  ratio?: { n: bigint; d: bigint };
  
  label?: string;
}

export interface TuningMap {
  
  id: string;
  
  name: string;
  
  format: 'ute' | 'uinst';
  
  keyAssignments: Map<number, TuningAssignment>;
  
  metadata: {
    author?: string;
    description?: string;
    created: Date;
    modified: Date;
  };
}

export const CC_LOCAL_CONTROL = 122;

export const CC_ALL_NOTES_OFF = 123;

export const CC_RESET_ALL_CONTROLLERS = 121;

export const LOCAL_CONTROL_OFF = 0;

export const LOCAL_CONTROL_ON = 127;

export const PITCH_BEND_CENTER = 8192;

export interface StoredConfiguration {
  
  version: string;
  
  lastUpdated: Date;
  
  devices: {
    selectedDeviceId: string | null;
    deviceHistory: Array<{
      id: string;
      name: string;
      lastUsed: Date;
    }>;
  };
  
  preferences: {
    localControlDefault: 'on' | 'off';
    channelMode: 'omni' | 'single';
    activeChannel: number;
    autoReconnect: boolean;
    scanInterval: number;
  };
  
  tuningMaps: {
    activeMapId: string | null;
    recentMaps: string[];
  };
}

type EventHandler = (...args: any[]) => void;

export interface MidiDeviceManagerEvents {
  'device-connected': (device: MidiDeviceInfo) => void;
  'device-disconnected': (deviceId: string) => void;
  'device-list-updated': (devices: MidiDeviceInfo[]) => void;
  'local-control-changed': (state: 'on' | 'off') => void;
  'panic-executed': () => void;
  'error': (error: Error) => void;
}

const log = createLogger('midi/device-manager-core');

export class EventEmitter<TEvents extends Record<string, EventHandler>> {
  private listeners: Map<keyof TEvents, Set<EventHandler>> = new Map();

  on<K extends keyof TEvents>(event: K, handler: TEvents[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler);
  }

  off<K extends keyof TEvents>(event: K, handler: TEvents[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  once<K extends keyof TEvents>(event: K, handler: TEvents[K]): void {
    const onceHandler = ((data: any) => {
      handler(data);
      this.off(event, onceHandler as TEvents[K]);
    }) as TEvents[K];
    this.on(event, onceHandler);
  }

  protected emit<K extends keyof TEvents>(
    event: K,
    ...args: Parameters<TEvents[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          log.error(`Error in ${String(event)} handler`, error);
        }
      });
    }
  }

  removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export function isCompatibleDevice(name: string): boolean {
  const patterns = [
    /ARIUS/i,
    /Digital\s+Piano/i,
    /Yamaha\s+USB/i,
  ];
  return patterns.some(pattern => pattern.test(name));
}

export function createDefaultConfiguration(): DeviceConfiguration {
  return {
    selectedDeviceId: null,
    localControlState: 'unknown',
    channelMode: 'omni',
    activeChannel: 1,
    tuningMapId: null,
  };
}

export function createDefaultPanicOptions(): PanicOptions {
  return {
    sendAllNotesOff: true,
    sendResetControllers: true,
    resetPitchBend: true,
    clearQueue: true,
  };
}

export function isValidChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= 1 && channel <= 16;
}

export function isValidMidiNote(note: number): boolean {
  return Number.isInteger(note) && note >= 0 && note <= 127;
}
