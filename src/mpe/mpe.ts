/**
 * Represents the MPE Zone configuration.
 * Currently supports Lower Zone (Master 1, Members 2-15) and Upper Zone (Master 16, Members 2-15? No, 16 + 15..2).
 * Standard MPE: Zone 1 (Lower) uses Ch 1 as Master, Ch 2-M+1 as Members.
 * Zone 2 (Upper) uses Ch 16 as Master, Ch 16-M..15 as Members.
 */
export interface MPEZoneConfig {
  masterChannel: number; // 1 or 16
  memberChannels: number; // Number of member channels (0-15)
  pitchBendRange: number; // Semitones (usually 48 or 24)
}

/**
 * Represents the state of a single MPE note/voice.
 */
export interface MPENoteState {
  noteId: string;
  channel: number; // Member channel (2-16)
  midiNote: number; // 0-127
  velocity: number; // 0-1 (Normalized)
  pressure: number; // 0-1 (Channel Pressure / Aftertouch)
  timbre: number; // 0-1 (CC 74)
  pitchBend: number; // -1 to 1 (Normalized 14-bit)
  releaseVelocity: number; // 0-1 (Note Off velocity)
  active: boolean; // True if note is held or sustaining
  startTime: number;
}

/**
 * Manages MPE state and voice allocation.
 */
export class MPEManager {
  private config: MPEZoneConfig;
  private activeNotes: Map<number, MPENoteState>; // Keyed by Channel
  // Also need to track notes by (Channel, NoteNumber) for Poly Pressure?
  // MPE allocates one channel per note, so Channel is unique identifier for active note.
  // Standard MIDI creates multiple notes on one channel. MPE avoids this.
  // We assume strict MPE mode: 1 note per channel.
  
  constructor(config: Partial<MPEZoneConfig> = {}) {
    this.config = {
      masterChannel: 1,
      memberChannels: 15, // Use all available (2-16)
      pitchBendRange: 48,
      ...config,
    };
    this.activeNotes = new Map();
  }

  public processMidiMessage(status: number, data1: number, data2: number): void {
    const channel = (status & 0x0F) + 1; // 1-16
    const command = status & 0xF0;

    // Check if channel is in our zone
    // If Lower Zone (Master 1), Members 2 .. 1+N
    // If Upper Zone (Master 16), Members 16-N .. 15
    
    // Simplification: Assume Lower Zone Mode (Master 1)
    if (channel === this.config.masterChannel) {
      // Handle Master Channel messages (Global Pitch Bend, etc.)
      // Not implemented for this MVP
      return;
    }

    // Member Channel
    let note = this.activeNotes.get(channel);

    switch (command) {
      case 0x90: // Note On
        if (data2 > 0) {
          // Note On
          this.activeNotes.set(channel, {
            noteId: crypto.randomUUID(),
            channel,
            midiNote: data1,
            velocity: data2 / 127,
            pressure: 0,
            timbre: 0.5, // Center? Or 0? Usually 0.5 is center for bipolar, or 0 for unipolar. Let's start at 0.
            pitchBend: 0,
            releaseVelocity: 0,
            active: true,
            startTime: Date.now(), // Or audio time
          });
        } else {
          // Note Off (velocity 0)
          this.handleNoteOff(channel, data2);
        }
        break;

      case 0x80: // Note Off
        this.handleNoteOff(channel, data2);
        break;

      case 0xA0: // Poly Pressure (Key Pressure)
        // Usually not used in MPE (Channel Pressure is used instead)
        // But if sent, handled here.
        if (note && note.midiNote === data1) {
          note.pressure = data2 / 127;
        }
        break;

      case 0xD0: // Channel Pressure (Aftertouch)
        // MPE Pressure
        if (note) {
          note.pressure = data1 / 127;
        }
        break;

      case 0xE0: // Pitch Bend
        // MPE Pitch Bend
        if (note) {
          const lsb = data1;
          const msb = data2;
          const value = (msb << 7) | lsb; // 14-bit (0-16383)
          // Center is 8192
          // Normalize to -1 to 1
          note.pitchBend = (value - 8192) / 8192;
        }
        break;

      case 0xB0: // Control Change
        if (data1 === 74) { // CC 74 (MPE Timbre/Slide)
          if (note) {
            note.timbre = data2 / 127;
          }
        }
        // Handle other CCs (Mod Wheel usually global on Master, but can be per channel)
        break;
    }
  }

  private handleNoteOff(channel: number, velocity: number): void {
    const note = this.activeNotes.get(channel);
    if (note) {
      note.active = false;
      note.releaseVelocity = velocity / 127;
      // We keep it in map? Usually release phase starts.
      // Synth engine needs to know it's releasing.
      // We can remove it later when envelope finishes.
      // For now, mark inactive.
    }
  }

  public getAllNotes(): MPENoteState[] {
    return Array.from(this.activeNotes.values());
  }

  public getActiveNotes(): MPENoteState[] {
    return Array.from(this.activeNotes.values()).filter(n => n.active);
  }

  /**
   * Calculates the effective frequency for a note, applying pitch bend and range.
   */
  public getFrequency(note: MPENoteState): number {
    const semitones = note.pitchBend * this.config.pitchBendRange;
    // MIDI Note to Hz: 440 * 2^((note - 69 + bend) / 12)
    return 440 * Math.pow(2, (note.midiNote - 69 + semitones) / 12);
  }
}
