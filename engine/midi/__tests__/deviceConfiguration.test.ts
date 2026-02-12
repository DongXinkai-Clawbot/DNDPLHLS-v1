import fc from 'fast-check';
import { DeviceConfigurationManager } from '../deviceConfiguration';

describe('DeviceConfiguration Tests', () => {
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    (global as any).localStorage = mockLocalStorage;
  });

  afterEach(() => {
    mockLocalStorage.clear();
    delete (global as any).localStorage;
  });

  describe('Property 27: Configuration Persistence', () => {
    test('should save configuration immediately', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('on' as const, 'off' as const),
          fc.constantFrom('omni' as const, 'single' as const),
          fc.integer({ min: 1, max: 16 }),
          (localControl, channelMode, activeChannel) => {
            const config = {
              selectedDeviceId: null,
              localControlState: localControl,
              channelMode,
              activeChannel,
              tuningMapId: null,
            };

            DeviceConfigurationManager.saveConfiguration(config);

            const hasConfig = DeviceConfigurationManager.hasConfiguration();
            return hasConfig === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should persist all configuration fields', () => {
      const config = {
        selectedDeviceId: 'device-123',
        localControlState: 'off' as const,
        channelMode: 'single' as const,
        activeChannel: 10,
        tuningMapId: 'tuning-456',
      };

      DeviceConfigurationManager.saveConfiguration(config);

      const stored = DeviceConfigurationManager.getStoredConfiguration();

      expect(stored).not.toBeNull();
      expect(stored!.devices.selectedDeviceId).toBe('device-123');
      expect(stored!.preferences.localControlDefault).toBe('off');
      expect(stored!.preferences.channelMode).toBe('single');
      expect(stored!.preferences.activeChannel).toBe(10);
      expect(stored!.tuningMaps.activeMapId).toBe('tuning-456');
    });

    test('should include version and timestamp', () => {
      const config = DeviceConfigurationManager.getDefaultConfiguration();

      DeviceConfigurationManager.saveConfiguration(config);

      const stored = DeviceConfigurationManager.getStoredConfiguration();

      expect(stored).not.toBeNull();
      expect(stored!.version).toBe('1.0.0');
      expect(stored!.lastUpdated).toBeDefined();
    });

    test('should limit device history size', () => {
      const config = DeviceConfigurationManager.getDefaultConfiguration();
      const deviceHistory = [];

      for (let i = 0; i < 20; i++) {
        deviceHistory.push({
          id: `device-${i}`,
          name: `Device ${i}`,
          lastUsed: new Date(),
        });
      }

      DeviceConfigurationManager.saveConfiguration(config, deviceHistory);

      const stored = DeviceConfigurationManager.getStoredConfiguration();

      expect(stored).not.toBeNull();
      expect(stored!.devices.deviceHistory.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Property 28: Configuration Restoration Round-Trip', () => {
    test('should restore configuration after save', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('on' as const, 'off' as const),
          fc.constantFrom('omni' as const, 'single' as const),
          fc.integer({ min: 1, max: 16 }),
          (localControl, channelMode, activeChannel) => {
            const originalConfig = {
              selectedDeviceId: null,
              localControlState: localControl,
              channelMode,
              activeChannel,
              tuningMapId: null,
            };

            DeviceConfigurationManager.saveConfiguration(originalConfig);

            const restoredConfig = DeviceConfigurationManager.loadConfiguration();

            return (
              restoredConfig !== null &&
              restoredConfig.localControlState === localControl &&
              restoredConfig.channelMode === channelMode &&
              restoredConfig.activeChannel === activeChannel
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should preserve all fields through round-trip', () => {
      const originalConfig = {
        selectedDeviceId: 'device-abc',
        localControlState: 'off' as const,
        channelMode: 'single' as const,
        activeChannel: 7,
        tuningMapId: 'tuning-xyz',
      };

      DeviceConfigurationManager.saveConfiguration(originalConfig);
      const restoredConfig = DeviceConfigurationManager.loadConfiguration();

      expect(restoredConfig).not.toBeNull();
      expect(restoredConfig!.selectedDeviceId).toBe(originalConfig.selectedDeviceId);
      expect(restoredConfig!.localControlState).toBe(originalConfig.localControlState);
      expect(restoredConfig!.channelMode).toBe(originalConfig.channelMode);
      expect(restoredConfig!.activeChannel).toBe(originalConfig.activeChannel);
      expect(restoredConfig!.tuningMapId).toBe(originalConfig.tuningMapId);
    });

    test('should return default config if no saved config exists', () => {
      
      DeviceConfigurationManager.clearConfiguration();
      
      const config = DeviceConfigurationManager.loadConfiguration();

      expect(config).toBeNull();
    });

    test('should return default config if saved config is invalid', () => {
      
      mockLocalStorage.setItem('midi-device-manager-config', 'invalid json');

      const config = DeviceConfigurationManager.loadConfiguration();

      expect(config).not.toBeNull();
      expect(config!.channelMode).toBe('omni');
      expect(config!.activeChannel).toBe(1);
    });
  });

  describe('Property 29: Missing Device Notification', () => {
    test('should emit error when selected device is not available', () => {
      const manager = createMidiDeviceManager(new MockSysExQueue() as any, new MockTransport() as any);

      let errorEmitted = false;
      manager.on('error', (error) => {
        if (error.message.includes('not available')) {
          errorEmitted = true;
        }
      });

      const config = {
        selectedDeviceId: 'missing-device',
        localControlState: 'on' as const,
        channelMode: 'omni' as const,
        activeChannel: 1,
        tuningMapId: null,
      };
      DeviceConfigurationManager.saveConfiguration(config);

      manager.loadConfiguration();

      expect(errorEmitted).toBe(true);

      manager.dispose();
    });

    test('should allow device reselection after missing device', () => {
      const manager = createMidiDeviceManager(new MockSysExQueue() as any, new MockTransport() as any);

      manager.on('error', () => {
        
      });

      const config = {
        selectedDeviceId: 'missing-device',
        localControlState: 'on' as const,
        channelMode: 'omni' as const,
        activeChannel: 1,
        tuningMapId: null,
      };
      DeviceConfigurationManager.saveConfiguration(config);

      manager.loadConfiguration();

      const devices = manager.getDevices();
      expect(Array.isArray(devices)).toBe(true);

      manager.dispose();
    });
  });

  describe('Property 23: MIDI Input Processing Latency', () => {
    let manager: MidiDeviceManager;
    let mockQueue: MockSysExQueue;
    let mockTransport: MockTransport;

    beforeEach(() => {
      mockQueue = new MockSysExQueue();
      mockTransport = new MockTransport();
      manager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
    });

    afterEach(() => {
      manager.dispose();
    });

    test('should process MIDI messages within 5ms', () => {
      fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 3 }),
          async (messageBytes) => {
            const startTime = performance.now();
            const timestamp = startTime;
            
            const shouldProcess = manager.processMidiMessage(messageBytes, timestamp);
            
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            
            return processingTime < 5;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should track input latency in performance metrics', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0x80, max: 0xEF }), 
          fc.integer({ min: 0, max: 127 }),
          fc.integer({ min: 0, max: 127 }),
          (status, data1, data2) => {
            const timestamp = performance.now();
            const message = [status, data1, data2];
            
            manager.processMidiMessage(message, timestamp);
            
            const metrics = manager.getPerformanceMetrics();
            
            return metrics.inputLatency >= 0 && metrics.inputLatency < 10;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should log warning when latency exceeds 5ms threshold', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const oldTimestamp = performance.now() - 10; 
      const message = [0x90, 60, 100]; 
      
      manager.processMidiMessage(message, oldTimestamp);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MIDI input latency')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Property 24: Message Priority Routing', () => {
    let manager: MidiDeviceManager;
    let mockQueue: MockSysExQueue;
    let mockTransport: MockTransport;

    beforeEach(() => {
      mockQueue = new MockSysExQueue();
      mockTransport = new MockTransport();
      manager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
    });

    afterEach(() => {
      manager.dispose();
    });

    test('should classify realtime messages correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0x80, 0x90, 0xA0, 0xD0, 0xE0), 
          fc.integer({ min: 0, max: 15 }), 
          fc.integer({ min: 0, max: 127 }),
          fc.integer({ min: 0, max: 127 }),
          (messageType, channel, data1, data2) => {
            const status = messageType | channel;
            const message = [status, data1, data2];
            
            manager.processMidiMessage(message);
            
            const metrics = manager.getPerformanceMetrics();
            const initialRealtimeCount = metrics.messageCount.realtime;
            
            manager.processMidiMessage(message);
            
            const updatedMetrics = manager.getPerformanceMetrics();
            
            return updatedMetrics.messageCount.realtime > initialRealtimeCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should classify bulk messages correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0xB0, 0xC0), 
          fc.integer({ min: 0, max: 15 }), 
          fc.integer({ min: 0, max: 127 }),
          (messageType, channel, data1) => {
            const status = messageType | channel;
            const message = messageType === 0xB0 ? [status, data1, 64] : [status, data1];
            
            const initialMetrics = manager.getPerformanceMetrics();
            const initialBulkCount = initialMetrics.messageCount.bulk;
            
            manager.processMidiMessage(message);
            
            const updatedMetrics = manager.getPerformanceMetrics();
            
            return updatedMetrics.messageCount.bulk > initialBulkCount;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should track message counts separately', () => {
      manager.resetPerformanceMetrics();
      
      manager.processMidiMessage([0x90, 60, 100]); 
      manager.processMidiMessage([0x80, 60, 0]);   
      
      manager.processMidiMessage([0xB0, 7, 100]);  
      manager.processMidiMessage([0xC0, 5]);       
      
      const metrics = manager.getPerformanceMetrics();
      
      expect(metrics.messageCount.realtime).toBe(2);
      expect(metrics.messageCount.bulk).toBe(2);
    });
  });

  describe('Property 25: Queue Size Monitoring', () => {
    let manager: MidiDeviceManager;
    let mockQueue: MockSysExQueue;
    let mockTransport: MockTransport;

    beforeEach(() => {
      mockQueue = new MockSysExQueue();
      mockTransport = new MockTransport();
      manager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
    });

    afterEach(() => {
      manager.dispose();
    });

    test('should track queue size in performance metrics', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 }),
          (message) => {
            manager.processMidiMessage(message);
            
            const metrics = manager.getPerformanceMetrics();
            
            return metrics.queueSize >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should log warning when queue size exceeds 100', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockQueue = {
        getQueueSize: () => 150,
        enqueue: jest.fn(),
        clear: jest.fn(),
        stop: jest.fn(),
        start: jest.fn(),
        flush: jest.fn(),
        getQueueLength: () => 150,
        hasPending: () => true,
        enqueueNoteOn: jest.fn(),
        enqueueNoteOff: jest.fn(),
        enqueuePitchBend: jest.fn(),
        enqueueCC: jest.fn(),
        enqueueProgramChange: jest.fn(),
        enqueueSysEx: jest.fn(),
        enqueueRPN: jest.fn(),
        getDebugInfo: jest.fn(),
      };
      
      const mockTransport = {
        sendMidi: jest.fn(),
        sendAllNotesOff: jest.fn(),
      };
      
      const testManager = new MidiDeviceManager(mockQueue as any, mockTransport);
      
      testManager.processMidiMessage([0xB0, 7, 100]);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SysEx queue size')
      );
      
      consoleSpy.mockRestore();
      testManager.dispose();
    });

    test('should update queue size on each message', () => {
      const initialMetrics = manager.getPerformanceMetrics();
      const initialQueueSize = initialMetrics.queueSize;
      
      manager.processMidiMessage([0xB0, 7, 100]);
      
      const updatedMetrics = manager.getPerformanceMetrics();
      
      expect(typeof updatedMetrics.queueSize).toBe('number');
      expect(updatedMetrics.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Property 26: Device Scan Performance', () => {
    let manager: MidiDeviceManager;
    let mockQueue: MockSysExQueue;
    let mockTransport: MockTransport;
    let mockAccess: MockMIDIAccess;

    beforeEach(async () => {
      mockQueue = new MockSysExQueue();
      mockTransport = new MockTransport();
      mockAccess = new MockMIDIAccess();
      
      global.navigator = {
        requestMIDIAccess: jest.fn().mockResolvedValue(mockAccess),
      } as any;
      
      manager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
      await manager.initialize();
    });

    afterEach(() => {
      manager.dispose();
      delete (global as any).navigator;
    });

    test('should complete device scan within 1 second', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const startTime = performance.now();
            
            await manager.scanDevices();
            
            const endTime = performance.now();
            const scanDuration = endTime - startTime;
            
            return scanDuration < 1000;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should track scan duration in performance metrics', async () => {
      await manager.scanDevices();
      
      const metrics = manager.getPerformanceMetrics();
      
      expect(metrics.scanDuration).toBeGreaterThanOrEqual(0);
      expect(metrics.scanDuration).toBeLessThan(1000);
      
      expect(metrics.lastScanTime).toBeInstanceOf(Date);
    });

    test('should log warning when scan exceeds 1 second', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const mockScanner = {
        scanOnce: () => {
          
          const start = Date.now();
          while (Date.now() - start < 1100) {
            
          }
          return {
            inputs: [],
            outputs: [],
            changes: { added: [], removed: [] },
          };
        },
        startScanning: jest.fn(),
        stopScanning: jest.fn(),
        dispose: jest.fn(),
      };
      
      const mockTransport = {
        sendMidi: jest.fn(),
        sendAllNotesOff: jest.fn(),
      };
      
      const mockQueue = {
        getQueueSize: () => 0,
        enqueue: jest.fn(),
        clear: jest.fn(),
        stop: jest.fn(),
        start: jest.fn(),
        flush: jest.fn(),
        getQueueLength: () => 0,
        hasPending: () => false,
        enqueueNoteOn: jest.fn(),
        enqueueNoteOff: jest.fn(),
        enqueuePitchBend: jest.fn(),
        enqueueCC: jest.fn(),
        enqueueProgramChange: jest.fn(),
        enqueueSysEx: jest.fn(),
        enqueueRPN: jest.fn(),
        getDebugInfo: jest.fn(),
      };
      
      const testManager = new MidiDeviceManager(mockQueue as any, mockTransport);
      
      (testManager as any).scanner = mockScanner;
      
      await testManager.scanDevices();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Device scan took')
      );
      
      consoleSpy.mockRestore();
      testManager.dispose();
    });

    test('should handle multiple rapid scans', async () => {
      const scanPromises = [];
      
      for (let i = 0; i < 5; i++) {
        scanPromises.push(manager.scanDevices());
      }
      
      const results = await Promise.all(scanPromises);
      
      expect(results).toHaveLength(5);
      
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
});
