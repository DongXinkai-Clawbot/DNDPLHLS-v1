
import { useEffect, useState, useRef, useCallback } from 'react';
import { MidiDeviceManager, createMidiDeviceManager } from '../engine/midi/midiDeviceManager';
import { MidiDeviceInfo, DeviceConfiguration } from '../engine/midi/deviceManager';
import { SysExQueue } from '../engine/midi/sysexQueue';
import { IRetunerTransport } from '../engine/retuner/retunerEngine';
import { createLogger } from '../utils/logger';

export interface UseMidiDeviceManagerOptions {
  sysexQueue: SysExQueue;
  transport: IRetunerTransport;
  scanInterval?: number;
  maxRetries?: number;
  autoInitialize?: boolean;
}

export interface UseMidiDeviceManagerResult {
  
  devices: MidiDeviceInfo[];
  selectedDevice: MidiDeviceInfo | null;
  
  config: DeviceConfiguration;
  localControlState: 'on' | 'off' | 'unknown';
  channelMode: { mode: 'omni' | 'single'; channel: number };
  
  selectDevice: (deviceId: string) => Promise<void>;
  setLocalControl: (state: 'on' | 'off') => Promise<void>;
  setChannelMode: (mode: 'omni' | 'single', channel?: number) => void;
  executePanic: () => Promise<void>;
  loadTuningMap: (file: File) => Promise<void>;
  saveTuningMap: (filename: string) => Promise<void>;
  
  isInitialized: boolean;
  error: Error | null;
  
  manager: MidiDeviceManager | null;
}

const log = createLogger('midi/use-device-manager');

export function useMidiDeviceManager(
  options: UseMidiDeviceManagerOptions
): UseMidiDeviceManagerResult {
  const {
    sysexQueue,
    transport,
    scanInterval,
    maxRetries,
    autoInitialize = true,
  } = options;

  const managerRef = useRef<MidiDeviceManager | null>(null);

  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MidiDeviceInfo | null>(null);
  const [config, setConfig] = useState<DeviceConfiguration>({
    selectedDeviceId: null,
    localControlState: 'unknown',
    channelMode: 'omni',
    activeChannel: 1,
    tuningMapId: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!autoInitialize) return;

    const manager = createMidiDeviceManager(sysexQueue, transport, {
      scanInterval,
      maxRetries,
    });

    managerRef.current = manager;

    const handleDeviceListUpdated = (updatedDevices: MidiDeviceInfo[]) => {
      setDevices(updatedDevices);
    };

    const handleDeviceConnected = (device: MidiDeviceInfo) => {
      log.info('Device connected', device.name);
    };

    const handleDeviceDisconnected = (deviceId: string) => {
      log.info('Device disconnected', deviceId);
      
      if (config.selectedDeviceId === deviceId) {
        setSelectedDevice(null);
      }
    };

    const handleLocalControlChanged = (state: 'on' | 'off') => {
      setConfig(prev => ({ ...prev, localControlState: state }));
    };

    const handlePanicExecuted = () => {
      log.info('Panic executed');
    };

    const handleError = (err: Error) => {
      log.error('Device manager error', err);
      setError(err);
    };

    const handleConfigurationChanged = (newConfig: DeviceConfiguration) => {
      setConfig(newConfig);
      
      const device = manager.getSelectedDevice();
      setSelectedDevice(device);
    };

    manager.on('device-list-updated', handleDeviceListUpdated);
    manager.on('device-connected', handleDeviceConnected);
    manager.on('device-disconnected', handleDeviceDisconnected);
    manager.on('local-control-changed', handleLocalControlChanged);
    manager.on('panic-executed', handlePanicExecuted);
    manager.on('error', handleError);
    manager.on('configuration-changed', handleConfigurationChanged);

    manager.initialize()
      .then(() => {
        setIsInitialized(true);
        
        const initialDevices = manager.getDevices();
        const initialDevice = manager.getSelectedDevice();
        const initialConfig = manager.getDebugInfo().config;
        
        setDevices(initialDevices);
        setSelectedDevice(initialDevice);
        setConfig(initialConfig);
      })
      .catch((err) => {
        log.error('Initialization failed', err);
        setError(err);
      });

    return () => {
      manager.off('device-list-updated', handleDeviceListUpdated);
      manager.off('device-connected', handleDeviceConnected);
      manager.off('device-disconnected', handleDeviceDisconnected);
      manager.off('local-control-changed', handleLocalControlChanged);
      manager.off('panic-executed', handlePanicExecuted);
      manager.off('error', handleError);
      manager.off('configuration-changed', handleConfigurationChanged);
      manager.dispose();
      managerRef.current = null;
    };
  }, [sysexQueue, transport, scanInterval, maxRetries, autoInitialize]);

  const selectDevice = useCallback(async (deviceId: string) => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    await managerRef.current.selectDevice(deviceId);
  }, []);

  const setLocalControl = useCallback(async (state: 'on' | 'off') => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    await managerRef.current.setLocalControl(state);
  }, []);

  const setChannelMode = useCallback((mode: 'omni' | 'single', channel?: number) => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    managerRef.current.setChannelMode(mode, channel);
  }, []);

  const executePanic = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    await managerRef.current.executePanic();
  }, []);

  const loadTuningMap = useCallback(async (file: File) => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    await managerRef.current.loadTuningMap(file);
  }, []);

  const saveTuningMap = useCallback(async (filename: string) => {
    if (!managerRef.current) {
      throw new Error('Manager not initialized');
    }
    await managerRef.current.saveTuningMap(filename);
  }, []);

  return {
    devices,
    selectedDevice,
    config,
    localControlState: config.localControlState,
    channelMode: {
      mode: config.channelMode,
      channel: config.activeChannel,
    },
    selectDevice,
    setLocalControl,
    setChannelMode,
    executePanic,
    loadTuningMap,
    saveTuningMap,
    isInitialized,
    error,
    manager: managerRef.current,
  };
}
