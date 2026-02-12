
import { GM_INSTRUMENTS } from '../gmConstants';

// Define the shape of SpessaSynth's synthesizer based on usage
interface SpessaSynthSynthesizer {
  programChange(channel: number, program: number): void;
  noteOn(channel: number, note: number, velocity: number): void;
  noteOff(channel: number, note: number): void;
  stopAll(): void;
  setMasterVolume(volume: number): void;
}

export class SoundFontEngine {
  private static instance: SoundFontEngine;
  private synthesizer: SpessaSynthSynthesizer | null = null;
  private audioContext: AudioContext | null = null;
  private isLoaded = false;
  private isLoading = false;
  private gainNode: GainNode | null = null;
  // Map channel to current program to optimize program changes
  private channelPrograms: number[] = new Array(16).fill(0);
  // Simple round-robin channel allocation for polyphony with different instruments?
  // Actually, standard MIDI: channel determines instrument. 
  // If we want to play multiple instruments efficiently, we should assign channels dynamically.
  // For now, let's just stick to channel 0 for simplistic usage or manage 0-15.

  private constructor() { }

  public static getInstance(): SoundFontEngine {
    if (!SoundFontEngine.instance) {
      SoundFontEngine.instance = new SoundFontEngine();
    }
    return SoundFontEngine.instance;
  }

  public async init(ctx: AudioContext) {
    if (this.audioContext === ctx && (this.isLoaded || this.isLoading)) return;
    this.audioContext = ctx;

    // Create a master gain for the synth
    this.gainNode = ctx.createGain();
    this.gainNode.connect(ctx.destination);

    await this.loadGM();
  }

  private async loadGM() {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      console.log('Loading GM DLS...');
      const url = '/gm.dls';

      // @ts-ignore
      const { Synthesizer, WebAudioUserMediaEncoder } = await import('spessasynth_lib');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url} `);
      const dlsData = await response.arrayBuffer();

      // Initialize SpessaSynth
      // Note: Constructor signature might vary slightly based on version, checking docs/examples
      // Synthesizer(targetNode, soundFontBuffer)
      this.synthesizer = new Synthesizer(this.gainNode || this.audioContext!.destination, dlsData);

      console.log('GM DLS loaded successfully');
      this.isLoaded = true;
    } catch (e) {
      console.error('Failed to load GM DLS:', e);
    } finally {
      this.isLoading = false;
    }
  }

  public playNote(note: number, velocity: number, programId: number, durationMs: number = 1000) {
    if (!this.synthesizer || !this.isLoaded) return;

    // Use channel 0 for now. If we need multi-timbral, we need channel management.
    const channel = 0;

    if (this.channelPrograms[channel] !== programId) {
      this.synthesizer.programChange(channel, programId);
      this.channelPrograms[channel] = programId;
    }

    this.synthesizer.noteOn(channel, note, velocity);

    if (durationMs > 0) {
      setTimeout(() => {
        this.synthesizer?.noteOff(channel, note);
      }, durationMs);
    }
  }

  public noteOn(note: number, velocity: number, programId: number, channel: number = 0): void {
    if (!this.synthesizer || !this.isLoaded) return;

    if (this.channelPrograms[channel] !== programId) {
      this.synthesizer.programChange(channel, programId);
      this.channelPrograms[channel] = programId;
    }

    this.synthesizer.noteOn(channel, note, velocity);
  }

  public noteOff(note: number, channel: number = 0): void {
    if (!this.synthesizer || !this.isLoaded) return;
    this.synthesizer.noteOff(channel, note);
  }
}

