export type SendType = 'pre' | 'post';

export interface Send {
  id: string;
  destinationId: string; // ID of the return track or bus
  amount: number; // 0.0 to 1.0
  type: SendType;
  muted: boolean;
}

export interface InsertEffect {
  id: string;
  pluginId: string;
  bypassed: boolean;
  order: number;
}

export interface MixerChannel {
  id: string; // Should match Track ID
  name: string;
  volume: number; // 0.0 to 1.0 (linear gain)
  pan: number; // -1.0 (L) to 1.0 (R)
  muted: boolean;
  soloed: boolean;
  sends: Send[];
  inserts: InsertEffect[];
  outputId: string; // 'master' or Bus ID
  vcaGroupId?: string;
}

export interface VCAGroup {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  muted: boolean;
  soloed: boolean;
  members: string[]; // Channel IDs
}

export class MixerEngine {
  private channels: Map<string, MixerChannel>;
  private vcaGroups: Map<string, VCAGroup>;
  private masterChannelId: string;

  constructor() {
    this.channels = new Map();
    this.vcaGroups = new Map();
    this.masterChannelId = 'master';
    
    // Create Master Channel
    this.createChannel('master', 'Master');
  }

  /**
   * Creates a new mixer channel.
   * @param id ID of the channel (usually matches track ID).
   * @param name Name of the channel.
   */
  public createChannel(id: string, name: string): MixerChannel {
    const channel: MixerChannel = {
      id,
      name,
      volume: 0.8,
      pan: 0,
      muted: false,
      soloed: false,
      sends: [],
      inserts: [],
      outputId: 'master', // Default to master
    };
    this.channels.set(id, channel);
    return channel;
  }

  public getChannel(id: string): MixerChannel | undefined {
    return this.channels.get(id);
  }

  public removeChannel(id: string): void {
    if (id === 'master') return; // Cannot remove master
    this.channels.delete(id);
    // Also remove from VCA groups
    this.vcaGroups.forEach(group => {
      group.members = group.members.filter(m => m !== id);
    });
  }

  /**
   * Sets volume for a channel.
   * @param id Channel ID.
   * @param volume Volume level (0.0 to 1.0).
   */
  public setVolume(id: string, volume: number): void {
    const channel = this.channels.get(id);
    if (channel) {
      channel.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Sets pan for a channel.
   * @param id Channel ID.
   * @param pan Pan position (-1.0 to 1.0).
   */
  public setPan(id: string, pan: number): void {
    const channel = this.channels.get(id);
    if (channel) {
      channel.pan = Math.max(-1, Math.min(1, pan));
    }
  }

  /**
   * Adds a send to a channel.
   * @param channelId Channel ID.
   * @param destinationId Destination ID (e.g., return track).
   * @param type Send type (pre/post).
   */
  public addSend(channelId: string, destinationId: string, type: SendType = 'post'): Send {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    const send: Send = {
      id: crypto.randomUUID(),
      destinationId,
      amount: 0.5,
      type,
      muted: false,
    };
    channel.sends.push(send);
    return send;
  }

  /**
   * Creates a VCA group.
   * @param name Name of the VCA group.
   */
  public createVCAGroup(name: string): VCAGroup {
    const group: VCAGroup = {
      id: crypto.randomUUID(),
      name,
      volume: 1.0,
      muted: false,
      soloed: false,
      members: [],
    };
    this.vcaGroups.set(group.id, group);
    return group;
  }

  /**
   * Adds a channel to a VCA group.
   * @param groupId VCA Group ID.
   * @param channelId Channel ID.
   */
  public addChannelToVCA(groupId: string, channelId: string): void {
    const group = this.vcaGroups.get(groupId);
    if (!group) throw new Error(`VCA Group ${groupId} not found`);
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    if (!group.members.includes(channelId)) {
      group.members.push(channelId);
      channel.vcaGroupId = groupId;
    }
  }

  /**
   * Calculates the effective volume of a channel, considering VCA groups.
   * @param channelId Channel ID.
   */
  public getEffectiveVolume(channelId: string): number {
    const channel = this.channels.get(channelId);
    if (!channel) return 0;

    let volume = channel.volume;
    
    // Apply VCA influence
    if (channel.vcaGroupId) {
      const vca = this.vcaGroups.get(channel.vcaGroupId);
      if (vca) {
        volume *= vca.volume;
        if (vca.muted) return 0; // VCA mute kills signal
      }
    }

    if (channel.muted) return 0;

    return volume;
  }
}
