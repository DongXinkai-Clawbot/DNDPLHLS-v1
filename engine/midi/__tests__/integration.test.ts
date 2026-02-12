
import { MidiDeviceManager, createMidiDeviceManager } from '../midiDeviceManager';
import { SysExQueue, createSysExQueue } from '../sysexQueue';
import { IRetunerTransport } from '../../retuner/retunerEngine';
import { MidiDeviceInfo } from '../deviceManager';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const createMockMIDIAccess = (devices: Array<{ id: string; name: string; type: 'input' | 'output' }>) => {
  const inputs = new Map();
  const outputs = new Map();

  devices.forEach(device => {
    const port = {
      id: device.id,
      name: device.name,
      manufacturer: 'Test Manufacturer',
      type: device.type,
      state: 'connected',
      connection: 'closed',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      open: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
    };

    if (device.type === 'input') {
      inputs.set(device.id, port);
    } else {
      outputs.set(device.id, port);
    }
  });

  return {
    inputs,
    outputs,
    sysexEnabled: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
};

class MockTransport implements IRetunerTransport {
  public sentMessages: number[][] = [];

  sendMidi(bytes: number[], _priority?: 'urgent' | 'config' | 'normal'): void {
    this.sentMessages.push([...bytes]);
  }

  sendAllNotesOff(): void {
    for (let c = 0; c < 16; c++) {
      this.sendMidi([0xB0 | c, 123, 0]);
    }
  }

  reset(): void {
    this.sentMessages = [];
  }
}

describe('MIDI Device Manager - Integration Tests', () => {
  let manager: MidiDeviceManager;
  let sysexQueue: SysExQueue;
  let transport: MockTransport;
  let mockMIDIAccess: any;

  beforeEach(() => {
    
    localStorageMock.clear();

    mockMIDIAccess = createMockMIDIAccess([
      { id: 'input-1', name: 'Yamaha ARIUS YDP-144', type: 'input' },
      { id: 'output-1', name: 'Yamaha ARIUS YDP-144', type: 'output' },
      { id: 'input-2', name: 'Generic MIDI Keyboard', type: 'input' },
      { id: 'output-2', name: 'Generic MIDI Keyboard', type: 'output' },
    ]);

    global.navigator = {
      requestMIDIAccess: jest.fn().mockResolvedValue(mockMIDIAccess),
    } as any;

    transport = new MockTransport();

    sysexQueue = createSysExQueue(transport);
    manager = createMidiDeviceManager(sysexQueue, transport, {
      scanInterval: 100,
      maxRetries: 3,
    });
  });

  afterEach(() => {
    manager.dispose();
    sysexQueue.stop();
    sysexQueue.clear();
  });

  describe('Device Detection Flow', () => {
    test('should detect and list compatible devices after initialization', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevices = devices.filter(d => d.isCompatible);

      expect(compatibleDevices.length).toBeGreaterThan(0);
      expect(compatibleDevices.some(d => d.name.includes('ARIUS'))).toBe(true);
    });

    test('should emit device-list-updated event after scan', async () => {
      const listUpdatedHandler = jest.fn();
      manager.on('device-list-updated', listUpdatedHandler);

      await manager.initialize();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(listUpdatedHandler).toHaveBeenCalled();
      const devices = listUpdatedHandler.mock.calls[0][0] as MidiDeviceInfo[];
      expect(Array.isArray(devices)).toBe(true);
    });

    test('should select device and update configuration', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        const selectedDevice = manager.getSelectedDevice();
        expect(selectedDevice).not.toBeNull();
        expect(selectedDevice?.id).toBe(compatibleDevice.id);
      }
    });
  });

  describe('Local Control Switching', () => {
    test('should send Local Control OFF command to all channels', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);
        transport.reset();

        await manager.setLocalControl('off');

        // Local control messages are queued (normal priority). Flush to make the
        // transport output deterministic for test assertions.
        await sysexQueue.flush();

        expect(transport.sentMessages.length).toBe(16);
        for (let c = 0; c < 16; c++) {
          const message = transport.sentMessages[c];
          expect(message[0]).toBe(0xB0 | c); 
          expect(message[1]).toBe(122); 
          expect(message[2]).toBe(0); 
        }
      }
    });

    test('should send Local Control ON command to all channels', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);
        transport.reset();

        await manager.setLocalControl('on');

        // Local control messages are queued (normal priority). Flush to make the
        // transport output deterministic for test assertions.
        await sysexQueue.flush();

        expect(transport.sentMessages.length).toBe(16);
        for (let c = 0; c < 16; c++) {
          const message = transport.sentMessages[c];
          expect(message[0]).toBe(0xB0 | c);
          expect(message[1]).toBe(122);
          expect(message[2]).toBe(127); 
        }
      }
    });

    test('should emit local-control-changed event', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        const localControlHandler = jest.fn();
        manager.on('local-control-changed', localControlHandler);

        await manager.setLocalControl('off');

        expect(localControlHandler).toHaveBeenCalledWith('off');
      }
    });

    test('should update Local Control state in configuration', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        await manager.setLocalControl('off');
        expect(manager.getLocalControlState()).toBe('off');

        await manager.setLocalControl('on');
        expect(manager.getLocalControlState()).toBe('on');
      }
    });
  });

  describe('Panic Button Functionality', () => {
    test('should send all panic commands', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);
        transport.reset();

        await manager.executePanic();

        expect(transport.sentMessages.length).toBeGreaterThanOrEqual(48);

        const allNotesOffMessages = transport.sentMessages.filter(
          msg => msg[1] === 123
        );
        // executePanic sends CC 123 itself *and* calls transport.sendAllNotesOff()
        // (when available) as an extra safety net.
        expect(allNotesOffMessages.length).toBe(32);

        const resetControllersMessages = transport.sentMessages.filter(
          msg => msg[1] === 121
        );
        expect(resetControllersMessages.length).toBe(16);

        const pitchBendMessages = transport.sentMessages.filter(
          msg => (msg[0] & 0xF0) === 0xE0
        );
        expect(pitchBendMessages.length).toBe(16);
      }
    });

    test('should emit panic-executed event', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        const panicHandler = jest.fn();
        manager.on('panic-executed', panicHandler);

        await manager.executePanic();

        expect(panicHandler).toHaveBeenCalled();
      }
    });

    test('should clear SysEx queue when panic is executed', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        sysexQueue.enqueue([0xF0, 0x43, 0x10, 0x4C, 0x00, 0x00, 0x7E, 0x00, 0xF7], 'bulk');
        sysexQueue.enqueue([0xF0, 0x43, 0x10, 0x4C, 0x00, 0x00, 0x7E, 0x01, 0xF7], 'bulk');

        expect(sysexQueue.getQueueSize()).toBeGreaterThan(0);

        await manager.executePanic();

        expect(sysexQueue.getQueueSize()).toBe(0);
      }
    });

    test('should execute panic within 100ms', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);

        const startTime = Date.now();
        await manager.executePanic();
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(100);
      }
    });
  });

  describe('Hot-Plug Scenarios', () => {
    test('should detect device connection', async () => {
      jest.useFakeTimers();
      try {
      await manager.initialize();

      const deviceConnectedHandler = jest.fn();
      manager.on('device-connected', deviceConnectedHandler);

      const newDevice = {
        id: 'output-3',
        name: 'Yamaha Digital Piano',
        manufacturer: 'Yamaha',
        type: 'output' as const,
        state: 'connected' as const,
        connection: 'closed' as const,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        open: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        send: jest.fn(),
      };

      mockMIDIAccess.outputs.set(newDevice.id, newDevice);

      const stateChangeHandler = mockMIDIAccess.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'statechange'
      )?.[1];

      if (stateChangeHandler) {
        stateChangeHandler({ port: newDevice });
      }

      // DeviceScanner in production polls every 2000ms; advance timers to trigger a scan.
      await jest.advanceTimersByTimeAsync(2100);

      const devices = manager.getDevices();
      const foundDevice = devices.find(d => d.id === newDevice.id);
      expect(foundDevice).toBeDefined();

      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });

    test('should detect device disconnection', async () => {
      jest.useFakeTimers();
      try {
      await manager.initialize();

      const devices = manager.getDevices();
      const deviceToDisconnect = devices.find(d => d.isCompatible && d.type === 'output');

      if (deviceToDisconnect) {
        await manager.selectDevice(deviceToDisconnect.id);

        const deviceDisconnectedHandler = jest.fn();
        manager.on('device-disconnected', deviceDisconnectedHandler);

        mockMIDIAccess.outputs.delete(deviceToDisconnect.id);

        const stateChangeHandler = mockMIDIAccess.addEventListener.mock.calls.find(
          (call: any) => call[0] === 'statechange'
        )?.[1];

        if (stateChangeHandler) {
          stateChangeHandler({
            port: { ...deviceToDisconnect, state: 'disconnected' },
          });
        }

        // DeviceScanner in production polls every 2000ms; advance timers to trigger a scan.
        await jest.advanceTimersByTimeAsync(2100);

        const selectedDevice = manager.getSelectedDevice();
        expect(selectedDevice).toBeNull();
      }

      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });

    test('should handle device reconnection', async () => {
      jest.useFakeTimers();
      try {
      await manager.initialize();

      const devices = manager.getDevices();
      const deviceToReconnect = devices.find(d => d.isCompatible && d.type === 'output');

      if (deviceToReconnect) {
        await manager.selectDevice(deviceToReconnect.id);
        // setLocalControl awaits a small timer inside the ControlManager.
        // With fake timers enabled we must advance time for the promise to resolve.
        const localControlPromise = manager.setLocalControl('off');
        await jest.advanceTimersByTimeAsync(20);
        await localControlPromise;

        mockMIDIAccess.outputs.delete(deviceToReconnect.id);
        await jest.advanceTimersByTimeAsync(2100);

        const reconnectedDevice = {
          ...deviceToReconnect,
          state: 'connected' as const,
          connection: 'closed' as const,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          open: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined),
          send: jest.fn(),
        };

        mockMIDIAccess.outputs.set(deviceToReconnect.id, reconnectedDevice);
        await jest.advanceTimersByTimeAsync(2100);

        const updatedDevices = manager.getDevices();
        const foundDevice = updatedDevices.find(d => d.id === deviceToReconnect.id);
        expect(foundDevice).toBeDefined();
        expect(foundDevice?.state).toBe('connected');
      }

      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('Configuration Persistence', () => {
    test('should persist device selection across manager instances', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);
        manager.dispose();

        const newManager = createMidiDeviceManager(sysexQueue, transport);
        await newManager.initialize();

        const debugInfo = newManager.getDebugInfo();
        expect(debugInfo.config.selectedDeviceId).toBe(compatibleDevice.id);

        newManager.dispose();
      }
    });

    test('should persist Local Control state across manager instances', async () => {
      await manager.initialize();

      const devices = manager.getDevices();
      const compatibleDevice = devices.find(d => d.isCompatible && d.type === 'output');

      if (compatibleDevice) {
        await manager.selectDevice(compatibleDevice.id);
        await manager.setLocalControl('off');
        manager.dispose();

        const newManager = createMidiDeviceManager(sysexQueue, transport);
        await newManager.initialize();

        expect(newManager.getLocalControlState()).toBe('off');

        newManager.dispose();
      }
    });

    test('should persist channel mode configuration', async () => {
      await manager.initialize();

      manager.setChannelMode('single', 5);
      manager.dispose();

      const newManager = createMidiDeviceManager(sysexQueue, transport);
      await newManager.initialize();

      const channelMode = newManager.getChannelMode();
      expect(channelMode.mode).toBe('single');
      expect(channelMode.channel).toBe(5);

      newManager.dispose();
    });
  });
});
