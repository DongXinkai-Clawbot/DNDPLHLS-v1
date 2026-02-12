
import { EventEmitter } from './browserEventEmitter';
import type { WebMidi } from '../../types';
import { MidiDeviceInfo, DeviceConfiguration, DeviceState, DeviceScanResult } from './deviceManager';
import { DeviceScanner, createDeviceScanner } from './deviceScanner';
import { ControlManager, createControlManager } from './controlManager';
import { CommandExecutor, createCommandExecutor } from './commandExecutor';
import { TuningMapSync, TuningMap, createTuningMapSync } from './tuningMapSync';
import { DeviceConfigurationManager } from './deviceConfiguration';
import { SysExQueue } from './sysexQueue';
import { IRetunerTransport } from '../retuner/retunerEngine';
import { recordMidiMessage, setMidiDiagnosticsState } from './diagnostics';
import { createLogger } from '../../utils/logger';

export interface MidiDeviceManagerEvents {
  'device-connected': (device: MidiDeviceInfo) => void;
  'device-disconnected': (deviceId: string) => void;
  'device-list-updated': (devices: MidiDeviceInfo[]) => void;
  'local-control-changed': (state: 'on' | 'off') => void;
  'panic-executed': () => void;
  'error': (error: Error) => void;
  'configuration-changed': (config: DeviceConfiguration) => void;
}

export interface PerformanceMetrics {
  inputLatency: number; 
  queueSize: number;
  scanDuration: number; 
  lastScanTime: Date | null;
  messageCount: {
    realtime: number;
    bulk: number;
  };
}

const log = createLogger('midi/device-manager');

export class MidiDeviceManager extends EventEmitter {
  private devices: Map<string, MidiDeviceInfo>;
  private deviceStates: Map<string, DeviceState>;
  private config: DeviceConfiguration;
  private scanner: DeviceScanner | null = null;
  private controlManager: ControlManager;
  private commandExecutor: CommandExecutor;
  private tuningMapSync: TuningMapSync;
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private sysexQueue: SysExQueue;
  private transport: IRetunerTransport;
  private currentTuningMap: TuningMap | null = null;
  private onStateChangeHandler: ((event: any) => void) | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private isInitialized: boolean = false;
  private performanceMetrics: PerformanceMetrics;

  constructor(
    sysexQueue: SysExQueue,
    transport: IRetunerTransport,
    options?: {
      scanInterval?: number;
      maxRetries?: number;
    }
  ) {
    super();
    this.devices = new Map();
    this.deviceStates = new Map();
    this.sysexQueue = sysexQueue;
    this.transport = transport;
    this.maxRetries = options?.maxRetries ?? 3;

    this.config = {
      selectedDeviceId: null,
      localControlState: 'unknown',
      channelMode: 'omni',
      activeChannel: 1,
      tuningMapId: null,
    };

    this.performanceMetrics = {
      inputLatency: 0,
      queueSize: 0,
      scanDuration: 0,
      lastScanTime: null,
      messageCount: {
        realtime: 0,
        bulk: 0,
      },
    };

    this.controlManager = createControlManager(sysexQueue);
    this.commandExecutor = createCommandExecutor(sysexQueue, transport);
    this.tuningMapSync = createTuningMapSync();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      setMidiDiagnosticsState('requesting');
      
      if (typeof navigator !== 'undefined' && navigator.requestMIDIAccess) {
        const access = await navigator.requestMIDIAccess({ sysex: true });
        this.midiAccess = access as any as WebMidi.MIDIAccess;
      } else {
        throw new Error('Web MIDI API not available');
      }

      this.scanner = createDeviceScanner(this.midiAccess, {
        scanInterval: 2000,
      });

      this.scanner.startScanning((result) => {
        this.handleScanResult(result);
      });

      this.onStateChangeHandler = () => {
        if (!this.scanner) return;
        try {
          const result = this.scanner.scanOnce();
          this.handleScanResult(result);
        } catch (e) {
          log.warn('MIDI state change scan failed', e);
        }
      };
      if (typeof this.midiAccess.addEventListener === 'function') {
        this.midiAccess.addEventListener('statechange', this.onStateChangeHandler as EventListener);
      } else {
        this.midiAccess.onstatechange = this.onStateChangeHandler;
      }

      this.loadConfiguration();

      this.isInitialized = true;
      setMidiDiagnosticsState('ready');
    } catch (error) {
      setMidiDiagnosticsState('error', (error as Error)?.message);
      this.emit('error', error as Error);
      throw error;
    }
  }

  async scanDevices(): Promise<MidiDeviceInfo[]> {
    if (!this.scanner) {
      throw new Error('Device manager not initialized');
    }

    const startTime = performance.now();
    const result = this.scanner.scanOnce();
    const endTime = performance.now();
    
    this.performanceMetrics.scanDuration = endTime - startTime;
    this.performanceMetrics.lastScanTime = new Date();
    
    if (this.performanceMetrics.scanDuration > 1000) {
      log.warn('Device scan took too long', {
        durationMs: Number(this.performanceMetrics.scanDuration.toFixed(2))
      });
    }
    
    return [...result.inputs, ...result.outputs];
  }

  getDevices(): MidiDeviceInfo[] {
    return Array.from(this.devices.values());
  }

  getSelectedDevice(): MidiDeviceInfo | null {
    if (!this.config.selectedDeviceId) {
      return null;
    }
    return this.devices.get(this.config.selectedDeviceId) ?? null;
  }

  async selectDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    this.config.selectedDeviceId = deviceId;
    this.emit('configuration-changed', this.config);
    this.saveConfiguration();

    this.updateDeviceHistory(device);
  }

  async setLocalControl(state: 'on' | 'off'): Promise<void> {
    try {
      await this.controlManager.sendLocalControlAllChannels(state);
      this.config.localControlState = state;
      this.emit('local-control-changed', state);
      this.emit('configuration-changed', this.config);
      this.saveConfiguration();
    } catch (error) {
      await this.handleError(error as Error, 'setLocalControl');
    }
  }

  getLocalControlState(): 'on' | 'off' | 'unknown' {
    return this.config.localControlState;
  }

  setChannelMode(mode: 'omni' | 'single', channel?: number): void {
    this.config.channelMode = mode;
    if (mode === 'single' && channel !== undefined) {
      if (channel < 1 || channel > 16) {
        throw new Error('Invalid channel: must be 1-16');
      }
      this.config.activeChannel = channel;
    }
    this.emit('configuration-changed', this.config);
    this.saveConfiguration();
  }

  getChannelMode(): { mode: 'omni' | 'single'; channel: number } {
    return {
      mode: this.config.channelMode,
      channel: this.config.activeChannel,
    };
  }

  processMidiMessage(message: ArrayLike<number>, timestamp?: number): boolean {
    if (message.length === 0) {
      return false;
    }
    recordMidiMessage('in', message);

    if (timestamp !== undefined) {
      const now = performance.now();
      this.performanceMetrics.inputLatency = now - timestamp;
      
      if (this.performanceMetrics.inputLatency > 5) {
        log.warn('MIDI input latency exceeded threshold', {
          latencyMs: Number(this.performanceMetrics.inputLatency.toFixed(2))
        });
      }
    }

    const statusByte = message[0];
    const messageType = statusByte & 0xF0;
    const channel = (statusByte & 0x0F) + 1; 

    const isRealtime = this.isRealtimeMessage(statusByte);
    if (isRealtime) {
      this.performanceMetrics.messageCount.realtime++;
    } else {
      this.performanceMetrics.messageCount.bulk++;
    }

    this.performanceMetrics.queueSize = this.sysexQueue.getQueueSize();
    
    if (this.performanceMetrics.queueSize > 100) {
      log.warn('SysEx queue size exceeded threshold', {
        queueSize: this.performanceMetrics.queueSize
      });
    }

    if (statusByte >= 0xF0) {
      return true;
    }

    if (messageType >= 0x80 && messageType <= 0xE0) {
      if (this.config.channelMode === 'omni') {
        
        return true;
      } else {
        
        return channel === this.config.activeChannel;
      }
    }

    return true;
  }

  private isRealtimeMessage(statusByte: number): boolean {
    const messageType = statusByte & 0xF0;
    return (
      messageType === 0x80 || 
      messageType === 0x90 || 
      messageType === 0xA0 || 
      messageType === 0xD0 || 
      messageType === 0xE0    
    );
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  resetPerformanceMetrics(): void {
    this.performanceMetrics.messageCount.realtime = 0;
    this.performanceMetrics.messageCount.bulk = 0;
  }

  async executePanic(): Promise<void> {
    try {
      await this.commandExecutor.executePanic({
        sendAllNotesOff: true,
        sendResetControllers: true,
        resetPitchBend: true,
        clearQueue: true,
      });
      this.emit('panic-executed');
    } catch (error) {
      await this.handleError(error as Error, 'executePanic');
    }
  }

  async loadTuningMap(file: File): Promise<void> {
    try {
      const content = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();

      let tuningMap: TuningMap;

      if (extension === 'ute') {
        tuningMap = await this.tuningMapSync.parseUTE(content);
      } else if (extension === 'uinst') {
        tuningMap = await this.tuningMapSync.parseUINST(content);
      } else {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      const validation = this.tuningMapSync.validateTuningMap(tuningMap);
      if (!validation.valid) {
        throw new Error(`Invalid tuning map: ${validation.errors.join(', ')}`);
      }

      this.currentTuningMap = tuningMap;
      this.config.tuningMapId = tuningMap.id;
      this.emit('configuration-changed', this.config);
      this.saveConfiguration();
    } catch (error) {
      await this.handleError(error as Error, 'loadTuningMap');
    }
  }

  async saveTuningMap(filename: string): Promise<void> {
    if (!this.currentTuningMap) {
      throw new Error('No tuning map loaded');
    }

    try {
      const extension = filename.split('.').pop()?.toLowerCase();
      let content: string;

      if (extension === 'ute') {
        content = await this.tuningMapSync.exportUTE(this.currentTuningMap);
      } else if (extension === 'uinst') {
        content = await this.tuningMapSync.exportUINST(this.currentTuningMap);
      } else {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      await this.handleError(error as Error, 'saveTuningMap');
    }
  }

  getTuningMap(): TuningMap | null {
    return this.currentTuningMap;
  }

  saveConfiguration(): void {
    DeviceConfigurationManager.saveConfiguration(this.config, this.getDeviceHistory());
  }

  loadConfiguration(): void {
    const loaded = DeviceConfigurationManager.loadConfiguration();
    if (loaded) {
      this.config = loaded;

      if (this.config.selectedDeviceId && !this.devices.has(this.config.selectedDeviceId)) {
        this.emit('error', new Error('Previously selected device not available'));
      }
    }
  }

  private async handleError(error: Error, operation: string): Promise<void> {
    log.error(`Error in ${operation}`, error);

    if (operation === 'setLocalControl' && this.retryCount < this.maxRetries) {
      this.retryCount++;
      log.info(`Retrying ${operation}`, { attempt: this.retryCount, maxRetries: this.maxRetries });
      
      const delay = Math.pow(2, this.retryCount - 1) * 10;
      await new Promise(resolve => setTimeout(resolve, delay));
      
    } else {
      this.retryCount = 0;
      this.emit('error', error);
    }
  }

  private handleScanResult(result: DeviceScanResult): void {
    
    for (const device of [...result.inputs, ...result.outputs]) {
      this.devices.set(device.id, device);
      
      if (!this.deviceStates.has(device.id)) {
        this.deviceStates.set(device.id, {
          deviceInfo: device,
          configuration: { ...this.config },
          connectionStatus: {
            connected: true,
            lastConnected: new Date(),
            lastDisconnected: null,
            reconnectAttempts: 0,
          },
          statistics: {
            messagesReceived: 0,
            messagesSent: 0,
            errors: 0,
            lastActivity: null,
          },
        });
      }
    }

    for (const device of result.changes.added) {
      this.emit('device-connected', device);
    }

    for (const deviceId of result.changes.removed) {
      const state = this.deviceStates.get(deviceId);
      if (state) {
        state.connectionStatus.connected = false;
        state.connectionStatus.lastDisconnected = new Date();
      }
      this.devices.delete(deviceId);
      this.emit('device-disconnected', deviceId);
    }

    this.emit('device-list-updated', Array.from(this.devices.values()));
  }

  private updateDeviceHistory(device: MidiDeviceInfo): void {
    
    this.saveConfiguration();
  }

  private getDeviceHistory(): Array<{ id: string; name: string; lastUsed: Date }> {
    
    return [];
  }

  dispose(): void {
    if (this.scanner) {
      this.scanner.stopScanning();
      this.scanner.dispose();
    }
    if (this.midiAccess && this.onStateChangeHandler) {
      if (typeof this.midiAccess.removeEventListener === 'function') {
        this.midiAccess.removeEventListener('statechange', this.onStateChangeHandler as EventListener);
      }
      if (this.midiAccess.onstatechange === this.onStateChangeHandler) {
        this.midiAccess.onstatechange = null;
      }
    }
    this.onStateChangeHandler = null;
    this.controlManager.dispose();
    this.commandExecutor.dispose();
    setMidiDiagnosticsState('idle');
    this.devices.clear();
    this.deviceStates.clear();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  getDebugInfo(): {
    devices: MidiDeviceInfo[];
    config: DeviceConfiguration;
    deviceStates: Map<string, DeviceState>;
    isInitialized: boolean;
    performanceMetrics: PerformanceMetrics;
  } {
    return {
      devices: Array.from(this.devices.values()),
      config: this.config,
      deviceStates: this.deviceStates,
      isInitialized: this.isInitialized,
      performanceMetrics: this.performanceMetrics,
    };
  }
}

export function createMidiDeviceManager(
  sysexQueue: SysExQueue,
  transport: IRetunerTransport,
  options?: {
    scanInterval?: number;
    maxRetries?: number;
  }
): MidiDeviceManager {
  return new MidiDeviceManager(sysexQueue, transport, options);
}
