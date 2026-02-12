import fc from 'fast-check';
import { ControlManager, createControlManager } from '../controlManager';
import { CC_LOCAL_CONTROL, LOCAL_CONTROL_OFF, LOCAL_CONTROL_ON } from '../deviceManager';

class MockSysExQueue {
  private messages: Array<{ channel: number; cc: number; value: number }> = [];
  private maxQueueSize: number = 256;

  enqueueCC(channel: number, cc: number, value: number): void {
    
    if (this.messages.length >= this.maxQueueSize) {
      
      this.messages.shift();
    }
    this.messages.push({ channel, cc, value });
  }

  getMessages(): Array<{ channel: number; cc: number; value: number }> {
    return [...this.messages];
  }

  clear(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  getQueueSize(): number {
    return this.messages.length;
  }

  getLastMessage(): { channel: number; cc: number; value: number } | null {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null;
  }
}

describe('ControlManager Tests', () => {
  let mockQueue: MockSysExQueue;

  beforeEach(() => {
    mockQueue = new MockSysExQueue();
  });

  afterEach(() => {
    mockQueue.clear();
  });

  describe('Property 7: Local Control Message Generation', () => {
    test('should send CC#122 to all 16 channels when setting Local Off', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControlAllChannels('off');

      const messages = mockQueue.getMessages();

      expect(messages.length).toBe(16);

      for (let i = 0; i < 16; i++) {
        expect(messages[i].channel).toBe(i + 1);
        expect(messages[i].cc).toBe(CC_LOCAL_CONTROL);
        expect(messages[i].value).toBe(LOCAL_CONTROL_OFF);
      }

      manager.dispose();
    });

    test('should send CC#122 to all 16 channels when setting Local On', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControlAllChannels('on');

      const messages = mockQueue.getMessages();

      expect(messages.length).toBe(16);

      for (let i = 0; i < 16; i++) {
        expect(messages[i].channel).toBe(i + 1);
        expect(messages[i].cc).toBe(CC_LOCAL_CONTROL);
        expect(messages[i].value).toBe(LOCAL_CONTROL_ON);
      }

      manager.dispose();
    });

    test('should generate correct message for any channel and state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 16 }),
          fc.constantFrom('on' as const, 'off' as const),
          async (channel, state) => {
            mockQueue.clear();
            const manager = createControlManager(mockQueue as any);

            await manager.sendLocalControl({ channel, state });

            const messages = mockQueue.getMessages();

            if (messages.length !== 1) return false;

            const msg = messages[0];
            const expectedValue = state === 'off' ? LOCAL_CONTROL_OFF : LOCAL_CONTROL_ON;

            const result = (
              msg.channel === channel &&
              msg.cc === CC_LOCAL_CONTROL &&
              msg.value === expectedValue
            );

            manager.dispose();
            return result;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should send to all channels when channel is 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('on' as const, 'off' as const),
          async (state) => {
            mockQueue.clear();
            const manager = createControlManager(mockQueue as any);

            await manager.sendLocalControl({ channel: 0, state });

            const messages = mockQueue.getMessages();
            const expectedValue = state === 'off' ? LOCAL_CONTROL_OFF : LOCAL_CONTROL_ON;

            if (messages.length !== 16) return false;

            const allCorrect = messages.every(msg =>
              msg.cc === CC_LOCAL_CONTROL && msg.value === expectedValue
            );

            manager.dispose();
            return allCorrect;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Local Control Command Verification', () => {
    test('should verify command was sent to specific channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 16 }),
          fc.constantFrom('on' as const, 'off' as const),
          async (channel, state) => {
            const manager = createControlManager(mockQueue as any);

            await manager.sendLocalControl({ channel, state });

            const verified = manager.verifyCommand(channel, state);

            manager.dispose();
            return verified === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should verify all channels after sending to all', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('on' as const, 'off' as const),
          async (state) => {
            const manager = createControlManager(mockQueue as any);

            await manager.sendLocalControlAllChannels(state);

            const verified = manager.verifyAllChannels(state);

            manager.dispose();
            return verified === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should track channel state correctly', async () => {
      const manager = createControlManager(mockQueue as any);

      for (let ch = 1; ch <= 16; ch++) {
        expect(manager.getChannelState(ch)).toBe('on');
      }

      await manager.sendLocalControl({ channel: 1, state: 'off' });
      expect(manager.getChannelState(1)).toBe('off');

      for (let ch = 2; ch <= 16; ch++) {
        expect(manager.getChannelState(ch)).toBe('on');
      }

      await manager.sendLocalControlAllChannels('off');
      for (let ch = 1; ch <= 16; ch++) {
        expect(manager.getChannelState(ch)).toBe('off');
      }

      manager.dispose();
    });

    test('should detect recent command sends', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControl({ channel: 1, state: 'off' });

      expect(manager.wasRecentlySent(1, 1000)).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(manager.wasRecentlySent(1, 50)).toBe(false); 
      expect(manager.wasRecentlySent(1, 200)).toBe(true); 

      manager.dispose();
    });
  });

  describe('ControlManager unit tests', () => {
    test('should create manager with default state', () => {
      const manager = createControlManager(mockQueue as any);
      const stats = manager.getStatistics();

      expect(stats.channelsOn).toBe(16); 
      expect(stats.channelsOff).toBe(0);
      expect(stats.totalCommands).toBe(0);

      manager.dispose();
    });

    test('should reject invalid channel numbers', async () => {
      const manager = createControlManager(mockQueue as any);

      await expect(
        manager.sendLocalControl({ channel: 17, state: 'off' })
      ).rejects.toThrow('Invalid channel');

      await expect(
        manager.sendLocalControl({ channel: -1, state: 'off' })
      ).rejects.toThrow('Invalid channel');

      manager.dispose();
    });

    test('should return unknown for invalid channel state query', () => {
      const manager = createControlManager(mockQueue as any);

      expect(manager.getChannelState(0)).toBe('unknown');
      expect(manager.getChannelState(17)).toBe('unknown');
      expect(manager.getChannelState(-1)).toBe('unknown');

      manager.dispose();
    });

    test('should reset all states', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControlAllChannels('off');
      expect(manager.getStatistics().channelsOff).toBe(16);

      manager.resetAllStates();
      expect(manager.getStatistics().channelsOn).toBe(16);
      expect(manager.getStatistics().channelsOff).toBe(0);

      manager.dispose();
    });

    test('should get all channel states', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControl({ channel: 1, state: 'off' });
      await manager.sendLocalControl({ channel: 2, state: 'off' });

      const states = manager.getAllChannelStates();

      expect(states.get(1)).toBe('off');
      expect(states.get(2)).toBe('off');
      expect(states.get(3)).toBe('on');

      manager.dispose();
    });

    test('should track statistics correctly', async () => {
      const manager = createControlManager(mockQueue as any);

      await manager.sendLocalControl({ channel: 1, state: 'off' });
      await manager.sendLocalControl({ channel: 2, state: 'off' });

      const stats = manager.getStatistics();

      expect(stats.channelsOff).toBe(2);
      expect(stats.channelsOn).toBe(14);
      expect(stats.totalCommands).toBe(2);
      expect(stats.lastCommandTime).not.toBeNull();

      manager.dispose();
    });
  });
});

