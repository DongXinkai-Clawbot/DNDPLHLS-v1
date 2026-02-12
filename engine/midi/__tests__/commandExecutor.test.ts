import fc from 'fast-check';
import { CommandExecutor, createCommandExecutor } from '../commandExecutor';
import { CC_ALL_NOTES_OFF, CC_RESET_ALL_CONTROLLERS, PITCH_BEND_CENTER } from '../deviceManager';

class MockTransport {
  private messages: number[][] = [];
  private allNotesOffCalled: boolean = false;

  sendMidi(bytes: number[]): void {
    this.messages.push([...bytes]);
  }

  sendAllNotesOff(): void {
    this.allNotesOffCalled = true;
  }

  getMessages(): number[][] {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
    this.allNotesOffCalled = false;
  }

  wasAllNotesOffCalled(): boolean {
    return this.allNotesOffCalled;
  }
}

describe('CommandExecutor Tests', () => {
  let mockQueue: MockSysExQueue;
  let mockTransport: MockTransport;

  beforeEach(() => {
    mockQueue = new MockSysExQueue();
    mockTransport = new MockTransport();
  });

  afterEach(() => {
    mockQueue.clear();
    mockTransport.clear();
  });

  describe('Property 9: Panic Command Completeness', () => {
    test('should send All Notes Off to all 16 channels', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.sendAllNotesOff();

      const messages = mockTransport.getMessages();

      expect(messages.length).toBe(16);

      for (let i = 0; i < 16; i++) {
        const [status, cc, value] = messages[i];
        const channel = (status & 0x0F) + 1;

        expect(channel).toBe(i + 1);
        expect(cc).toBe(CC_ALL_NOTES_OFF);
        expect(value).toBe(0);
      }

      executor.dispose();
    });

    test('should send Reset All Controllers to all 16 channels', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.sendResetAllControllers();

      const messages = mockTransport.getMessages();

      expect(messages.length).toBe(16);

      for (let i = 0; i < 16; i++) {
        const [status, cc, value] = messages[i];
        const channel = (status & 0x0F) + 1;

        expect(channel).toBe(i + 1);
        expect(cc).toBe(CC_RESET_ALL_CONTROLLERS);
        expect(value).toBe(0);
      }

      executor.dispose();
    });

    test('should reset Pitch Bend to center on all 16 channels', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.resetPitchBend();

      const messages = mockTransport.getMessages();

      expect(messages.length).toBe(16);

      const expectedLsb = PITCH_BEND_CENTER & 0x7F;
      const expectedMsb = (PITCH_BEND_CENTER >> 7) & 0x7F;

      for (let i = 0; i < 16; i++) {
        const [status, lsb, msb] = messages[i];
        const channel = (status & 0x0F) + 1;

        expect(channel).toBe(i + 1);
        expect(status & 0xF0).toBe(0xE0); 
        expect(lsb).toBe(expectedLsb);
        expect(msb).toBe(expectedMsb);
      }

      executor.dispose();
    });

    test('should send all three command types during panic', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic();

      const messages = mockTransport.getMessages();

      expect(messages.length).toBe(48);

      let allNotesOffCount = 0;
      let resetControllersCount = 0;
      let pitchBendCount = 0;

      for (const msg of messages) {
        const [status, data1] = msg;
        const statusType = status & 0xF0;

        if (statusType === 0xB0) {
          
          if (data1 === CC_ALL_NOTES_OFF) allNotesOffCount++;
          else if (data1 === CC_RESET_ALL_CONTROLLERS) resetControllersCount++;
        } else if (statusType === 0xE0) {
          
          pitchBendCount++;
        }
      }

      expect(allNotesOffCount).toBe(16);
      expect(resetControllersCount).toBe(16);
      expect(pitchBendCount).toBe(16);

      executor.dispose();
    });

    test('should call transport sendAllNotesOff during panic', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic();

      expect(mockTransport.wasAllNotesOffCalled()).toBe(true);

      executor.dispose();
    });
  });

  describe('Property 10: Panic Execution Timing', () => {
    test('should execute panic within 100ms', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      const startTime = Date.now();
      await executor.executePanic();
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100);

      executor.dispose();
    });

    test('should execute panic within 100ms across multiple runs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null),
          async () => {
            const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

            const startTime = Date.now();
            await executor.executePanic();
            const endTime = Date.now();

            const executionTime = endTime - startTime;

            executor.dispose();
            mockTransport.clear();

            return executionTime < 100;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should track panic execution time in statistics', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      const statsBefore = executor.getStatistics();
      expect(statsBefore.lastPanicTime).toBeNull();

      await executor.executePanic();

      const statsAfter = executor.getStatistics();
      expect(statsAfter.lastPanicTime).not.toBeNull();
      expect(statsAfter.panicCount).toBe(1);

      executor.dispose();
    });
  });

  describe('Property 11: Panic Queue Clearing', () => {
    test('should clear queue when panic is executed with clearQueue option', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      mockQueue.enqueueCC(1, 1, 64);
      mockQueue.enqueueCC(2, 2, 64);
      mockQueue.enqueueCC(3, 3, 64);

      expect(mockQueue.getMessageCount()).toBe(3);

      await executor.executePanic({ clearQueue: true });

      expect(mockQueue.getMessageCount()).toBe(0);

      executor.dispose();
    });

    test('should not clear queue when clearQueue option is false', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      mockQueue.enqueueCC(1, 1, 64);
      mockQueue.enqueueCC(2, 2, 64);

      expect(mockQueue.getMessageCount()).toBe(2);

      await executor.executePanic({ clearQueue: false });

      expect(mockQueue.getMessageCount()).toBe(2);

      executor.dispose();
    });

    test('should clear queue regardless of queue size', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 50 }),
          async (queueSize) => {
            mockQueue.clear();
            const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

            for (let i = 0; i < queueSize; i++) {
              mockQueue.enqueueCC(1, i % 128, 64);
            }

            expect(mockQueue.getMessageCount()).toBe(queueSize);

            await executor.executePanic({ clearQueue: true });

            const result = mockQueue.getMessageCount() === 0;

            executor.dispose();
            mockTransport.clear();

            return result;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('CommandExecutor unit tests', () => {
    test('should create executor with default state', () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);
      const stats = executor.getStatistics();

      expect(stats.panicCount).toBe(0);
      expect(stats.lastPanicTime).toBeNull();
      expect(stats.timeSinceLastPanic).toBeNull();

      executor.dispose();
    });

    test('should increment panic count on each execution', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic();
      expect(executor.getStatistics().panicCount).toBe(1);

      await executor.executePanic();
      expect(executor.getStatistics().panicCount).toBe(2);

      await executor.executePanic();
      expect(executor.getStatistics().panicCount).toBe(3);

      executor.dispose();
    });

    test('should reset statistics', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic();
      expect(executor.getStatistics().panicCount).toBe(1);

      executor.resetStatistics();
      expect(executor.getStatistics().panicCount).toBe(0);
      expect(executor.getStatistics().lastPanicTime).toBeNull();

      executor.dispose();
    });

    test('should support partial panic options', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic({
        sendAllNotesOff: true,
        sendResetControllers: false,
        resetPitchBend: false,
        clearQueue: false,
      });

      const messages = mockTransport.getMessages();

      expect(messages.length).toBe(16);
      expect(messages.every(msg => msg[1] === CC_ALL_NOTES_OFF)).toBe(true);

      executor.dispose();
    });

    test('should calculate time since last panic', async () => {
      const executor = createCommandExecutor(mockQueue as any, mockTransport as any);

      await executor.executePanic();

      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = executor.getStatistics();
      expect(stats.timeSinceLastPanic).not.toBeNull();
      expect(stats.timeSinceLastPanic!).toBeGreaterThanOrEqual(50);

      executor.dispose();
    });
  });
});

