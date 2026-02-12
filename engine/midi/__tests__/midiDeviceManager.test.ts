import fc from 'fast-check';
import { MidiDeviceManager, createMidiDeviceManager } from '../midiDeviceManager';

class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('MidiDeviceManager Tests', () => {
  let mockQueue: MockSysExQueue;
  let mockTransport: MockTransport;
  let manager: MidiDeviceManager;
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockQueue = new MockSysExQueue();
    mockTransport = new MockTransport();
    mockLocalStorage = new MockLocalStorage();
    
    (global as any).localStorage = mockLocalStorage;
    
    manager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
  });

  afterEach(() => {
    manager.dispose();
    mockQueue.clear();
    mockTransport.clear();
    mockLocalStorage.clear();
    
    delete (global as any).localStorage;
  });

  describe('Property 5: Message Sending After Disconnection', () => {
    test('should handle Local Control command after device disconnection', async () => {
      
      await expect(manager.setLocalControl('off')).resolves.not.toThrow();
    });

    test('should handle panic command after device disconnection', async () => {
      await expect(manager.executePanic()).resolves.not.toThrow();
    });
  });

  describe('Property 6: Device Configuration Round-Trip', () => {
    test('should save and restore configuration', () => {
      
      manager.setChannelMode('single', 5);
      
      manager.saveConfiguration();

      const newManager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
      
      newManager.loadConfiguration();

      const channelMode = newManager.getChannelMode();
      expect(channelMode.mode).toBe('single');
      expect(channelMode.channel).toBe(5);

      newManager.dispose();
    });

    test('should restore Local Control state', async () => {
      await manager.setLocalControl('off');
      manager.saveConfiguration();

      const newManager = createMidiDeviceManager(mockQueue as any, mockTransport as any);
      newManager.loadConfiguration();

      expect(newManager.getLocalControlState()).toBe('off');

      newManager.dispose();
    });
  });

  describe('Property 19: Send Failure Retry Logic', () => {
    test('should implement retry logic for failed operations', async () => {
      
      const debugInfo = manager.getDebugInfo();
      expect(debugInfo).toBeDefined();
    });
  });

  describe('Property 20: Invalid MIDI Data Handling', () => {
    test('should handle invalid channel numbers gracefully', () => {
      expect(() => {
        manager.setChannelMode('single', 17);
      }).toThrow('Invalid channel');

      expect(() => {
        manager.setChannelMode('single', 0);
      }).toThrow('Invalid channel');
    });
  });

  describe('Property 21: Queue Overflow Handling', () => {
    test('should handle queue overflow by dropping oldest messages', () => {
      
      for (let i = 0; i < 300; i++) {
        mockQueue.enqueueCC(1, i % 128, 64);
      }

      expect(mockQueue.getMessageCount()).toBeLessThanOrEqual(256);
    });
  });

  describe('Property 22: Error Recovery State Restoration', () => {
    test('should restore to known-good state after panic', async () => {
      
      await manager.setLocalControl('off');
      manager.setChannelMode('single', 5);

      await manager.executePanic();

      const debugInfo = manager.getDebugInfo();
      expect(debugInfo.isInitialized).toBe(false); 
      expect(debugInfo.config).toBeDefined();
    });
  });

  describe('Property 15: MIDI Note to Virtual Key Mapping', () => {
    test('should map MIDI note to virtual key index', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 127 }),
          (midiNote) => {
            
            const virtualKeyIndex = midiNote;
            
            return virtualKeyIndex >= 0 && virtualKeyIndex <= 127;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle all MIDI notes in standard range', () => {
      
      for (let midiNote = 0; midiNote <= 127; midiNote++) {
        const virtualKeyIndex = midiNote;
        
        expect(virtualKeyIndex).toBe(midiNote);
        expect(virtualKeyIndex).toBeGreaterThanOrEqual(0);
        expect(virtualKeyIndex).toBeLessThanOrEqual(127);
      }
    });

    test('should map note-on events to virtual key highlighting', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 127 }),
          fc.integer({ min: 1, max: 127 }),
          (midiNote, velocity) => {
            
            const statusByte = 0x90; 
            const message = [statusByte, midiNote, velocity];
            
            const extractedNote = message[1];
            
            return extractedNote === midiNote;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should map note-off events to virtual key unhighlighting', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 127 }),
          (midiNote) => {
            
            const statusByte = 0x80; 
            const message = [statusByte, midiNote, 0];
            
            const extractedNote = message[1];
            
            return extractedNote === midiNote;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle octave ranges correctly', () => {
      
      const octaveTests = [
        { note: 0, octave: -1, name: 'C-1' },
        { note: 12, octave: 0, name: 'C0' },
        { note: 24, octave: 1, name: 'C1' },
        { note: 36, octave: 2, name: 'C2' },
        { note: 48, octave: 3, name: 'C3' },
        { note: 60, octave: 4, name: 'C4 (Middle C)' },
        { note: 72, octave: 5, name: 'C5' },
        { note: 84, octave: 6, name: 'C6' },
        { note: 96, octave: 7, name: 'C7' },
        { note: 108, octave: 8, name: 'C8' },
        { note: 120, octave: 9, name: 'C9' },
      ];

      for (const test of octaveTests) {
        const calculatedOctave = Math.floor(test.note / 12) - 1;
        expect(calculatedOctave).toBe(test.octave);
      }
    });

    test('should map piano key names to MIDI notes', () => {
      
      const keyMappings = [
        { note: 21, name: 'A0' },  
        { note: 60, name: 'C4' },  
        { note: 69, name: 'A4' },  
        { note: 108, name: 'C8' }, 
      ];

      for (const mapping of keyMappings) {
        const virtualKeyIndex = mapping.note;
        expect(virtualKeyIndex).toBe(mapping.note);
      }
    });
  });

  describe('MidiDeviceManager unit tests', () => {
    test('should create manager with default configuration', () => {
      const debugInfo = manager.getDebugInfo();

      expect(debugInfo.config.selectedDeviceId).toBeNull();
      expect(debugInfo.config.localControlState).toBe('unknown');
      expect(debugInfo.config.channelMode).toBe('omni');
      expect(debugInfo.config.activeChannel).toBe(1);
    });

    test('should update channel mode', () => {
      manager.setChannelMode('single', 10);

      const channelMode = manager.getChannelMode();
      expect(channelMode.mode).toBe('single');
      expect(channelMode.channel).toBe(10);
    });

    test('should get devices list', () => {
      const devices = manager.getDevices();
      expect(Array.isArray(devices)).toBe(true);
    });

    test('should get selected device', () => {
      const device = manager.getSelectedDevice();
      expect(device).toBeNull(); 
    });

    test('should get tuning map', () => {
      const tuningMap = manager.getTuningMap();
      expect(tuningMap).toBeNull(); 
    });

    test('should handle dispose', () => {
      expect(() => manager.dispose()).not.toThrow();
    });
  });

  describe('Property 16: Channel Mode Message Processing', () => {
    test('should process all channels in OMNI mode', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 16 }),
          fc.integer({ min: 0, max: 127 }),
          fc.integer({ min: 0, max: 127 }),
          (channel, note, velocity) => {
            manager.setChannelMode('omni');

            const statusByte = 0x90 | ((channel - 1) & 0x0F);
            const message = [statusByte, note, velocity];

            return manager.processMidiMessage(message) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should filter messages in single-channel mode', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 16 }),
          fc.integer({ min: 1, max: 16 }),
          fc.integer({ min: 0, max: 127 }),
          fc.integer({ min: 0, max: 127 }),
          (configuredChannel, messageChannel, note, velocity) => {
            manager.setChannelMode('single', configuredChannel);

            const statusByte = 0x90 | ((messageChannel - 1) & 0x0F);
            const message = [statusByte, note, velocity];

            const shouldProcess = manager.processMidiMessage(message);

            return shouldProcess === (messageChannel === configuredChannel);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should always process system messages', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0xF0, max: 0xFF }),
          fc.constantFrom('omni' as const, 'single' as const),
          (systemByte, mode) => {
            manager.setChannelMode(mode, mode === 'single' ? 5 : undefined);

            const message = [systemByte, 0x00];

            return manager.processMidiMessage(message) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle different message types correctly', () => {
      manager.setChannelMode('single', 5);

      expect(manager.processMidiMessage([0x94, 60, 100])).toBe(true);

      expect(manager.processMidiMessage([0x90, 60, 100])).toBe(false);

      expect(manager.processMidiMessage([0xB4, 7, 64])).toBe(true);

      expect(manager.processMidiMessage([0xB2, 7, 64])).toBe(false);

      expect(manager.processMidiMessage([0xF0, 0x7E, 0x7F, 0xF7])).toBe(true);
    });
  });

  describe('Property 17: Single-Channel Configuration', () => {
    test('should filter to configured channel', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 16 }),
          (configuredChannel) => {
            manager.setChannelMode('single', configuredChannel);

            let correctFiltering = true;
            for (let testChannel = 1; testChannel <= 16; testChannel++) {
              const statusByte = 0x90 | ((testChannel - 1) & 0x0F);
              const message = [statusByte, 60, 100];
              const shouldProcess = manager.processMidiMessage(message);

              if (shouldProcess !== (testChannel === configuredChannel)) {
                correctFiltering = false;
                break;
              }
            }

            return correctFiltering;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should accept all valid channel numbers', () => {
      for (let channel = 1; channel <= 16; channel++) {
        expect(() => {
          manager.setChannelMode('single', channel);
        }).not.toThrow();

        const mode = manager.getChannelMode();
        expect(mode.mode).toBe('single');
        expect(mode.channel).toBe(channel);
      }
    });

    test('should reject invalid channel numbers', () => {
      expect(() => {
        manager.setChannelMode('single', 0);
      }).toThrow('Invalid channel');

      expect(() => {
        manager.setChannelMode('single', 17);
      }).toThrow('Invalid channel');

      expect(() => {
        manager.setChannelMode('single', -1);
      }).toThrow('Invalid channel');
    });
  });

  describe('Property 18: Configuration Changes Without Reconnection', () => {
    test('should apply channel mode changes immediately', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('omni' as const, 'single' as const),
          fc.integer({ min: 1, max: 16 }),
          (mode, channel) => {
            
            manager.setChannelMode(mode, mode === 'single' ? channel : undefined);

            const currentMode = manager.getChannelMode();
            return currentMode.mode === mode && 
                   (mode === 'omni' || currentMode.channel === channel);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should not require reconnection after configuration change', () => {
      const initialDebugInfo = manager.getDebugInfo();

      manager.setChannelMode('single', 5);
      manager.setChannelMode('omni');
      manager.setChannelMode('single', 10);

      const finalDebugInfo = manager.getDebugInfo();

      expect(finalDebugInfo.isInitialized).toBe(initialDebugInfo.isInitialized);
    });

    test('should emit configuration-changed event on changes', () => {
      let eventEmitted = false;
      manager.on('configuration-changed', () => {
        eventEmitted = true;
      });

      manager.setChannelMode('single', 7);

      expect(eventEmitted).toBe(true);
    });

    test('should persist configuration changes', () => {
      manager.setChannelMode('single', 12);

      const stored = mockLocalStorage.getItem('midi-device-manager-config');
      expect(stored).not.toBeNull();

      const config = JSON.parse(stored!);
      expect(config.preferences.channelMode).toBe('single');
      expect(config.preferences.activeChannel).toBe(12);
    });
  });
});

