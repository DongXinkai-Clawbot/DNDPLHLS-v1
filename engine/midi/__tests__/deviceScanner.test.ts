import fc from 'fast-check';
import { DeviceScanner, createDeviceScanner } from '../deviceScanner';
import type { WebMidi } from '../../../types';

class MockMIDIAccess implements Partial<WebMidi.MIDIAccess> {
  inputs: Map<string, WebMidi.MIDIInput>;
  outputs: Map<string, WebMidi.MIDIOutput>;
  onstatechange: ((e: any) => void) | null = null;

  constructor() {
    this.inputs = new Map();
    this.outputs = new Map();
  }

  addInput(id: string, name: string, manufacturer: string = 'Test'): void {
    const input: Partial<WebMidi.MIDIInput> = {
      id,
      name,
      manufacturer,
      state: 'connected',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;
    this.inputs.set(id, input as WebMidi.MIDIInput);
  }

  addOutput(id: string, name: string, manufacturer: string = 'Test'): void {
    const output: Partial<WebMidi.MIDIOutput> = {
      id,
      name,
      manufacturer,
      state: 'connected',
      send: jest.fn(),
    } as any;
    this.outputs.set(id, output as WebMidi.MIDIOutput);
  }

  removeInput(id: string): void {
    this.inputs.delete(id);
  }

  removeOutput(id: string): void {
    this.outputs.delete(id);
  }

  clear(): void {
    this.inputs.clear();
    this.outputs.clear();
  }
}

describe('DeviceScanner Tests', () => {
  let mockAccess: MockMIDIAccess;

  beforeEach(() => {
    mockAccess = new MockMIDIAccess();
  });

  afterEach(() => {
    mockAccess.clear();
  });

  describe('Property 2: Device Detection Timing', () => {
    test('should detect device connection within scan interval', async () => {
      const scanInterval = 100; 
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess, { scanInterval });

      let detectionTime: number | null = null;
      const connectionTime = Date.now();

      scanner.startScanning((result) => {
        if (result.changes.added.length > 0 && detectionTime === null) {
          detectionTime = Date.now();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      mockAccess.addInput('test-device-1', 'Test Device');

      await new Promise(resolve => setTimeout(resolve, 2000));

      scanner.stopScanning();
      scanner.dispose();

      expect(detectionTime).not.toBeNull();
      if (detectionTime !== null) {
        const detectionDelay = detectionTime - connectionTime;
        expect(detectionDelay).toBeLessThan(2000); 
      }
    });

    test('should detect device disconnection within scan interval', async () => {
      const scanInterval = 100;
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess, { scanInterval });

      mockAccess.addInput('test-device-1', 'Test Device');

      let detectionTime: number | null = null;
      let disconnectionTime: number = 0;

      scanner.startScanning((result) => {
        if (result.changes.removed.length > 0 && detectionTime === null) {
          detectionTime = Date.now();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      disconnectionTime = Date.now();
      mockAccess.removeInput('test-device-1');

      await new Promise(resolve => setTimeout(resolve, 2000));

      scanner.stopScanning();
      scanner.dispose();

      expect(detectionTime).not.toBeNull();
      if (detectionTime !== null) {
        const detectionDelay = detectionTime - disconnectionTime;
        expect(detectionDelay).toBeLessThan(2000);
      }
    });

    test('should respect configured scan interval', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 5000 }),
          (scanInterval) => {
            const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess, { scanInterval });
            const stats = scanner.getStatistics();
            scanner.dispose();
            
            return stats.scanInterval === scanInterval;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 3: Compatible Device List Completeness', () => {
    test('should identify all compatible devices in scan result', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              name: fc.constantFrom(
                'Yamaha ARIUS YDP-144',
                'Roland Digital Piano',
                'Yamaha USB MIDI',
                'Generic MIDI Keyboard',
                'Korg microKEY'
              ),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (devices) => {
            mockAccess.clear();
            
            const uniqueDevices = devices.map((d, i) => ({
              ...d,
              id: `${d.id}-${i}`,
            }));
            
            for (const device of uniqueDevices) {
              mockAccess.addInput(device.id, device.name);
            }

            const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
            const result = scanner.scanOnce();
            scanner.dispose();

            const expectedCompatible = uniqueDevices.filter(d => 
              isCompatibleDevice(d.name)
            ).length;

            const actualCompatible = result.inputs.filter(d => 
              d.isCompatible
            ).length;

            return expectedCompatible === actualCompatible;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should not include non-compatible devices as compatible', () => {
      const nonCompatibleNames = [
        'Generic MIDI Keyboard',
        'Korg microKEY',
        'Roland FP-30',
        'Arturia KeyStep',
        'Novation Launchkey',
      ];

      for (const name of nonCompatibleNames) {
        mockAccess.clear();
        mockAccess.addInput('test-id', name);

        const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
        const result = scanner.scanOnce();
        scanner.dispose();

        expect(result.inputs[0].isCompatible).toBe(false);
      }
    });

    test('should include all compatible devices as compatible', () => {
      const compatibleNames = [
        'Yamaha ARIUS YDP-144',
        'Roland Digital Piano FP-90',
        'Yamaha USB MIDI Interface',
        'Kawai Digital Piano ES920',
        'Casio ARIUS AP-470',
      ];

      for (const name of compatibleNames) {
        mockAccess.clear();
        mockAccess.addInput('test-id', name);

        const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
        const result = scanner.scanOnce();
        scanner.dispose();

        expect(result.inputs[0].isCompatible).toBe(true);
      }
    });
  });

  describe('Property 4: Device List Updates', () => {
    test('should add newly connected devices to the list', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (newDevices) => {
            mockAccess.clear();
            
            const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
            
            const initialResult = scanner.scanOnce();
            const initialCount = initialResult.inputs.length;

            const uniqueDevices = newDevices.map((d, i) => ({
              ...d,
              id: `${d.id}-${i}`,
            }));

            for (const device of uniqueDevices) {
              mockAccess.addInput(device.id, device.name);
            }

            const afterResult = scanner.scanOnce();
            scanner.dispose();

            return (
              afterResult.changes.added.length === uniqueDevices.length &&
              afterResult.inputs.length === initialCount + uniqueDevices.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should remove disconnected devices from the list', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (devices) => {
            mockAccess.clear();
            
            const uniqueDevices = devices.map((d, i) => ({
              ...d,
              id: `${d.id}-${i}`,
            }));
            
            for (const device of uniqueDevices) {
              mockAccess.addInput(device.id, device.name);
            }

            const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
            
            const initialResult = scanner.scanOnce();
            const initialCount = initialResult.inputs.length;

            for (const device of uniqueDevices) {
              mockAccess.removeInput(device.id);
            }

            const afterResult = scanner.scanOnce();
            scanner.dispose();

            return (
              afterResult.changes.removed.length === uniqueDevices.length &&
              afterResult.inputs.length === 0
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly track both additions and removals', () => {
      mockAccess.clear();
      
      mockAccess.addInput('device-1', 'Device 1');
      mockAccess.addInput('device-2', 'Device 2');

      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
      
      scanner.scanOnce();

      mockAccess.removeInput('device-1');
      mockAccess.addInput('device-3', 'Device 3');

      const result = scanner.scanOnce();
      scanner.dispose();

      expect(result.changes.added.length).toBe(1);
      expect(result.changes.removed.length).toBe(1);
      expect(result.inputs.length).toBe(2);
      expect(result.changes.added[0].id).toBe('device-3');
      expect(result.changes.removed[0]).toBe('device-1');
    });
  });

  describe('DeviceScanner unit tests', () => {
    test('should create scanner with default options', () => {
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
      const stats = scanner.getStatistics();
      
      expect(stats.scanInterval).toBe(2000); 
      expect(stats.isScanning).toBe(false);
      
      scanner.dispose();
    });

    test('should create scanner with custom options', () => {
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess, {
        scanInterval: 500,
        compatiblePatterns: ['Custom.*Pattern'],
      });
      
      const stats = scanner.getStatistics();
      expect(stats.scanInterval).toBe(500);
      
      scanner.dispose();
    });

    test('should start and stop scanning', () => {
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
      
      expect(scanner.isScanning()).toBe(false);
      
      scanner.startScanning(() => {});
      expect(scanner.isScanning()).toBe(true);
      
      scanner.stopScanning();
      expect(scanner.isScanning()).toBe(false);
      
      scanner.dispose();
    });

    test('should detect both input and output devices', () => {
      mockAccess.addInput('input-1', 'Test Input');
      mockAccess.addOutput('output-1', 'Test Output');

      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
      const result = scanner.scanOnce();
      
      expect(result.inputs.length).toBe(1);
      expect(result.outputs.length).toBe(1);
      expect(result.inputs[0].type).toBe('input');
      expect(result.outputs[0].type).toBe('output');
      
      scanner.dispose();
    });

    test('should handle empty device list', () => {
      const scanner = createDeviceScanner(mockAccess as unknown as WebMidi.MIDIAccess);
      const result = scanner.scanOnce();
      
      expect(result.inputs.length).toBe(0);
      expect(result.outputs.length).toBe(0);
      expect(result.changes.added.length).toBe(0);
      expect(result.changes.removed.length).toBe(0);
      
      scanner.dispose();
    });
  });
});

