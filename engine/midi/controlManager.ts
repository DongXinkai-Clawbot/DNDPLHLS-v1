
import type { SysExQueue } from './sysexQueue';
import type { LocalControlCommand } from './deviceManager';
import {
  CC_LOCAL_CONTROL,
  LOCAL_CONTROL_OFF,
  LOCAL_CONTROL_ON,
  isValidChannel,
} from './deviceManager';

export class ControlManager {
  private sysexQueue: SysExQueue;
  private currentState: Map<number, 'on' | 'off'>;
  private lastCommandTime: Map<number, number>;

  constructor(sysexQueue: SysExQueue) {
    this.sysexQueue = sysexQueue;
    this.currentState = new Map();
    this.lastCommandTime = new Map();

    for (let ch = 1; ch <= 16; ch++) {
      this.currentState.set(ch, 'on'); 
    }
  }

  async sendLocalControl(command: LocalControlCommand): Promise<void> {
    const { channel, state } = command;

    if (channel !== 0 && !isValidChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}. Must be 0 (all) or 1-16.`);
    }

    if (channel === 0) {
      await this.sendLocalControlAllChannels(state);
      return;
    }

    const message = this.createLocalControlMessage(channel, state);
    
    this.sysexQueue.enqueueCC(channel, CC_LOCAL_CONTROL, message[2]);

    this.currentState.set(channel, state);
    this.lastCommandTime.set(channel, Date.now());
  }

  async sendLocalControlAllChannels(state: 'on' | 'off'): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let ch = 1; ch <= 16; ch++) {
      const message = this.createLocalControlMessage(ch, state);
      
      this.sysexQueue.enqueueCC(ch, CC_LOCAL_CONTROL, message[2]);

      this.currentState.set(ch, state);
      this.lastCommandTime.set(ch, Date.now());
    }

    await new Promise(resolve => setTimeout(resolve, 10));
  }

  getChannelState(channel: number): 'on' | 'off' | 'unknown' {
    if (!isValidChannel(channel)) {
      return 'unknown';
    }

    return this.currentState.get(channel) ?? 'unknown';
  }

  getAllChannelStates(): Map<number, 'on' | 'off'> {
    return new Map(this.currentState);
  }

  wasRecentlySent(channel: number, withinMs: number = 1000): boolean {
    const lastTime = this.lastCommandTime.get(channel);
    if (!lastTime) return false;

    return (Date.now() - lastTime) < withinMs;
  }

  resetAllStates(): void {
    for (let ch = 1; ch <= 16; ch++) {
      this.currentState.set(ch, 'on');
    }
    this.lastCommandTime.clear();
  }

  getStatistics(): {
    channelsOn: number;
    channelsOff: number;
    totalCommands: number;
    lastCommandTime: number | null;
  } {
    let channelsOn = 0;
    let channelsOff = 0;

    for (const state of this.currentState.values()) {
      if (state === 'on') channelsOn++;
      else if (state === 'off') channelsOff++;
    }

    const times = Array.from(this.lastCommandTime.values());
    const lastCommandTime = times.length > 0 ? Math.max(...times) : null;

    return {
      channelsOn,
      channelsOff,
      totalCommands: this.lastCommandTime.size,
      lastCommandTime,
    };
  }

  private createLocalControlMessage(channel: number, state: 'on' | 'off'): number[] {
    
    if (!isValidChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }

    const status = 0xB0 | ((channel - 1) & 0x0F);

    const cc = CC_LOCAL_CONTROL;

    const value = state === 'off' ? LOCAL_CONTROL_OFF : LOCAL_CONTROL_ON;

    return [status, cc, value];
  }

  verifyCommand(channel: number, state: 'on' | 'off'): boolean {
    const currentState = this.getChannelState(channel);
    const recentlySent = this.wasRecentlySent(channel, 5000); 

    return currentState === state && recentlySent;
  }

  verifyAllChannels(state: 'on' | 'off'): boolean {
    for (let ch = 1; ch <= 16; ch++) {
      if (!this.verifyCommand(ch, state)) {
        return false;
      }
    }
    return true;
  }

  dispose(): void {
    this.currentState.clear();
    this.lastCommandTime.clear();
  }
}

export function createControlManager(sysexQueue: SysExQueue): ControlManager {
  return new ControlManager(sysexQueue);
}
