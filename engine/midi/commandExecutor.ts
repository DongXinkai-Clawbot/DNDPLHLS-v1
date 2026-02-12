
import type { SysExQueue } from './sysexQueue';
import type { IRetunerTransport } from '../retuner/retunerEngine';
import type { PanicOptions } from './deviceManager';
import {
  CC_ALL_NOTES_OFF,
  CC_RESET_ALL_CONTROLLERS,
  PITCH_BEND_CENTER,
  createDefaultPanicOptions,
} from './deviceManager';
import { recordMidiMessage } from './diagnostics';
import { createLogger } from '../../utils/logger';

const log = createLogger('midi/command-executor');

export class CommandExecutor {
  private sysexQueue: SysExQueue;
  private transport: IRetunerTransport;
  private lastPanicTime: number | null;
  private panicCount: number;

  constructor(sysexQueue: SysExQueue, transport: IRetunerTransport) {
    this.sysexQueue = sysexQueue;
    this.transport = transport;
    this.lastPanicTime = null;
    this.panicCount = 0;
  }

  async executePanic(options?: Partial<PanicOptions>): Promise<void> {
    const startTime = Date.now();
    const opts = { ...createDefaultPanicOptions(), ...options };

    if (opts.clearQueue) {
      this.sysexQueue.clear();
    }

    if (opts.sendAllNotesOff) {
      await this.sendAllNotesOff();
    }

    if (opts.sendResetControllers) {
      await this.sendResetAllControllers();
    }

    if (opts.resetPitchBend) {
      await this.resetPitchBend();
    }

    try {
      this.transport.sendAllNotesOff?.();
    } catch (error) {
      log.warn('Transport sendAllNotesOff failed', error);
    }

    this.lastPanicTime = Date.now();
    this.panicCount++;

    const executionTime = Date.now() - startTime;
    if (executionTime > 100) {
      log.warn('Panic took longer than expected', { executionTime });
    }
  }

  async sendAllNotesOff(): Promise<void> {
    await this.sendToAllChannels((channel) => {
      return [0xB0 | ((channel - 1) & 0x0F), CC_ALL_NOTES_OFF, 0];
    });
  }

  async sendResetAllControllers(): Promise<void> {
    await this.sendToAllChannels((channel) => {
      return [0xB0 | ((channel - 1) & 0x0F), CC_RESET_ALL_CONTROLLERS, 0];
    });
  }

  async resetPitchBend(): Promise<void> {
    const lsb = PITCH_BEND_CENTER & 0x7F;
    const msb = (PITCH_BEND_CENTER >> 7) & 0x7F;

    await this.sendToAllChannels((channel) => {
      return [0xE0 | ((channel - 1) & 0x0F), lsb, msb];
    });
  }

  getStatistics(): {
    panicCount: number;
    lastPanicTime: number | null;
    timeSinceLastPanic: number | null;
  } {
    const timeSinceLastPanic = this.lastPanicTime 
      ? Date.now() - this.lastPanicTime 
      : null;

    return {
      panicCount: this.panicCount,
      lastPanicTime: this.lastPanicTime,
      timeSinceLastPanic,
    };
  }

  resetStatistics(): void {
    this.panicCount = 0;
    this.lastPanicTime = null;
  }

  private async sendToAllChannels(
    createMessage: (channel: number) => number[]
  ): Promise<void> {
    
    for (let channel = 1; channel <= 16; channel++) {
      const message = createMessage(channel);
      try {
        recordMidiMessage('out', message);
        this.transport.sendMidi(message);
      } catch (error) {
        log.error(`Failed to send to channel ${channel}`, error);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1));
  }

  dispose(): void {
    this.resetStatistics();
  }
}

export function createCommandExecutor(
  sysexQueue: SysExQueue,
  transport: IRetunerTransport
): CommandExecutor {
  return new CommandExecutor(sysexQueue, transport);
}
