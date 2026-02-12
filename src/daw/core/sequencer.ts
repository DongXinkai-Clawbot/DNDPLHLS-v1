
/**
 * Represents a musical time in bars, beats, and sixteenths.
 */
export interface MusicalTime {
  bar: number;
  beat: number;
  sixteenth: number;
}

/**
 * Represents a quantization grid setting.
 */
export type QuantizationGrid = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/64';

/**
 * Configuration for quantization logic.
 */
export interface QuantizationSettings {
  enabled: boolean;
  grid: QuantizationGrid;
  strength: number; // 0.0 to 1.0
  swing: number; // 0.0 to 1.0
}

/**
 * Represents a single note event.
 */
export interface NoteEvent {
  id: string;
  pitch: number; // MIDI note number or frequency based on mode
  startTime: number; // In pulses or seconds
  duration: number; // In pulses or seconds
  velocity: number; // 0-127
  channel: number; // MIDI channel 1-16
  selected: boolean;
  muted: boolean;
}

/**
 * Represents a point in an automation curve.
 */
export interface AutomationPoint {
  id: string;
  time: number;
  value: number;
  curveType: 'linear' | 'exponential' | 'step';
}

/**
 * Represents an automation curve for a parameter.
 */
export interface AutomationCurve {
  id: string;
  parameterId: string;
  points: AutomationPoint[];
}

/**
 * Represents a clip containing musical data or audio.
 */
export interface Clip {
  id: string;
  trackId: string;
  name: string;
  startTime: number;
  duration: number;
  offset: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  notes: NoteEvent[];
  automation: AutomationCurve[];
  type: 'midi' | 'audio';
  audioBuffer?: AudioBuffer; // For audio clips
}

/**
 * Represents a track in the sequencer.
 */
export interface Track {
  id: string;
  name: string;
  type: 'midi' | 'audio' | 'group' | 'return';
  color: string;
  clips: Clip[];
  volume: number; // 0.0 to 1.0 (or dB)
  pan: number; // -1.0 to 1.0
  muted: boolean;
  soloed: boolean;
  recordArmed: boolean;
  pluginChain: string[]; // IDs of plugins
}

/**
 * The core Sequencer Engine responsible for managing tracks, clips, and playback logic.
 */
export class SequencerEngine {
  private tracks: Map<string, Track>;
  private bpm: number;
  private timeSignature: [number, number];
  private ppq: number; // Pulses per quarter note
  private playbackPosition: number; // Current playback position in pulses
  private isPlaying: boolean;
  
  constructor() {
    this.tracks = new Map();
    this.bpm = 120;
    this.timeSignature = [4, 4];
    this.ppq = 960;
    this.playbackPosition = 0;
    this.isPlaying = false;
  }

  /**
   * Adds a new track to the sequencer.
   * @param name Name of the track.
   * @param type Type of the track.
   * @returns The created Track object.
   */
  public addTrack(name: string, type: Track['type'] = 'midi'): Track {
    const track: Track = {
      id: crypto.randomUUID(),
      name,
      type,
      color: this.getRandomColor(),
      clips: [],
      volume: 0.8,
      pan: 0,
      muted: false,
      soloed: false,
      recordArmed: false,
      pluginChain: [],
    };
    this.tracks.set(track.id, track);
    return track;
  }

  /**
   * Removes a track by ID.
   * @param trackId ID of the track to remove.
   */
  public removeTrack(trackId: string): void {
    this.tracks.delete(trackId);
  }

  /**
   * Gets a track by ID.
   * @param trackId ID of the track.
   * @returns The Track object or undefined if not found.
   */
  public getTrack(trackId: string): Track | undefined {
    return this.tracks.get(trackId);
  }

  /**
   * Creates a new clip on a track.
   * @param trackId ID of the track.
   * @param startTime Start time in pulses.
   * @param duration Duration in pulses.
   * @returns The created Clip object.
   */
  public addClip(trackId: string, startTime: number, duration: number): Clip {
    const track = this.getTrack(trackId);
    if (!track) {
      throw new Error(`Track with ID ${trackId} not found.`);
    }

    const clip: Clip = {
      id: crypto.randomUUID(),
      trackId,
      name: `Clip ${track.clips.length + 1}`,
      startTime,
      duration,
      offset: 0,
      loop: false,
      loopStart: 0,
      loopEnd: duration,
      notes: [],
      automation: [],
      type: track.type === 'audio' ? 'audio' : 'midi',
    };

    track.clips.push(clip);
    return clip;
  }

  /**
   * Adds a note to a clip.
   * @param clipId ID of the clip.
   * @param note Note event to add.
   */
  public addNoteToClip(trackId: string, clipId: string, note: Omit<NoteEvent, 'id'>): NoteEvent {
    const track = this.getTrack(trackId);
    if (!track) throw new Error(`Track ${trackId} not found`);
    
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) throw new Error(`Clip ${clipId} not found`);

    const newNote: NoteEvent = {
      ...note,
      id: crypto.randomUUID(),
    };
    clip.notes.push(newNote);
    return newNote;
  }

  /**
   * Quantizes notes in a clip based on settings.
   * @param clipId ID of the clip.
   * @param settings Quantization settings.
   */
  public quantizeClip(trackId: string, clipId: string, settings: QuantizationSettings): void {
    if (!settings.enabled) return;

    const track = this.getTrack(trackId);
    if (!track) return;
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    const gridTicks = this.getGridTicks(settings.grid);

    clip.notes.forEach(note => {
      const nearestGrid = Math.round(note.startTime / gridTicks) * gridTicks;
      const delta = nearestGrid - note.startTime;
      note.startTime += delta * settings.strength;
      // Handle swing later
    });
  }

  /**
   * Converts grid string to pulses.
   */
  private getGridTicks(grid: QuantizationGrid): number {
    const wholeNote = this.ppq * 4;
    switch (grid) {
      case '1/1': return wholeNote;
      case '1/2': return wholeNote / 2;
      case '1/4': return wholeNote / 4;
      case '1/8': return wholeNote / 8;
      case '1/16': return wholeNote / 16;
      case '1/32': return wholeNote / 32;
      case '1/64': return wholeNote / 64;
      default: return wholeNote / 4;
    }
  }

  private getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  public setBpm(bpm: number): void {
    if (bpm > 0) this.bpm = bpm;
  }

  public getBpm(): number {
    return this.bpm;
  }
}
