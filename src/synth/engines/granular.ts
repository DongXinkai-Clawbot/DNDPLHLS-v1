export interface Grain {
  id: string;
  bufferIndex: number; // Start index in source buffer
  playbackPosition: number; // Current relative position in grain (0 to duration)
  duration: number; // In samples
  playbackRate: number;
  pan: number; // -1 to 1
  gain: number;
  active: boolean;
}

export interface GranularParams {
  grainSize: number; // ms
  density: number; // grains per second
  position: number; // 0.0 to 1.0
  spread: number; // 0.0 to 1.0 (position randomness)
  pitch: number; // 1.0 = original speed
  pitchSpread: number; // 0.0 to 1.0 (pitch randomness)
  panSpread: number; // 0.0 to 1.0
}

export class GranularEngine {
  private sourceBuffer: Float32Array | null = null;
  private grains: Grain[] = [];
  private params: GranularParams;
  private sampleRate: number;
  private timeSinceLastGrain: number = 0; // In samples

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    this.params = {
      grainSize: 50, // 50ms
      density: 20, // 20 grains/sec
      position: 0.5,
      spread: 0.1,
      pitch: 1.0,
      pitchSpread: 0.0,
      panSpread: 0.5,
    };
  }

  public setBuffer(buffer: Float32Array): void {
    this.sourceBuffer = buffer;
  }

  public setParams(params: Partial<GranularParams>): void {
    this.params = { ...this.params, ...params };
  }

  public getSample(): number {
    if (!this.sourceBuffer) return 0;

    // 1. Spawn Grains
    // Calculate interval in samples: sampleRate / density
    const grainInterval = this.sampleRate / Math.max(0.1, this.params.density);
    this.timeSinceLastGrain++;

    if (this.timeSinceLastGrain >= grainInterval) {
      this.spawnGrain();
      // Reset timer with some jitter?
      // Standard granular: periodic or stochastic.
      // If density is average rate, we should add randomness to interval?
      // Let's stick to periodic for now, or add density spread.
      this.timeSinceLastGrain = 0;
      
      // Handle high density (multiple grains per sample if interval < 1? Unlikely at 44.1k)
    }

    // 2. Mix Grains
    let output = 0;
    
    // Iterate backwards to allow removal
    for (let i = this.grains.length - 1; i >= 0; i--) {
      const grain = this.grains[i];
      
      // Calculate sample from grain
      if (grain.active) {
        // Read from source buffer
        const pos = grain.bufferIndex + grain.playbackPosition;
        
        // Check bounds
        if (pos >= 0 && pos < this.sourceBuffer.length) {
          // Linear interpolation for variable pitch
          const index = Math.floor(pos);
          const frac = pos - index;
          const s0 = this.sourceBuffer[index];
          const s1 = (index + 1 < this.sourceBuffer.length) ? this.sourceBuffer[index + 1] : s0;
          const sample = s0 + (s1 - s0) * frac;
          
          // Apply Window (Hann)
          // phase 0..1 inside grain
          const phase = grain.playbackPosition / grain.duration;
          const window = 0.5 * (1 - Math.cos(2 * Math.PI * phase));
          
          output += sample * window * grain.gain;
          
          // Advance grain
          grain.playbackPosition += grain.playbackRate;
          
          // Check if grain finished
          if (grain.playbackPosition >= grain.duration) {
            grain.active = false;
          }
        } else {
          grain.active = false;
        }
      }

      if (!grain.active) {
        this.grains.splice(i, 1);
      }
    }

    return output;
  }

  private spawnGrain(): void {
    if (!this.sourceBuffer) return;

    // Calculate start position
    const bufferDuration = this.sourceBuffer.length;
    // Normalized position + random spread
    // Spread is usually bipolar around position? Or unipolar?
    // Let's assume bipolar: position +/- spread/2?
    // Or spread is max deviation.
    const randPos = (Math.random() * 2 - 1) * this.params.spread;
    let startPosNorm = this.params.position + randPos;
    startPosNorm = Math.max(0, Math.min(1, startPosNorm));
    
    const bufferIndex = Math.floor(startPosNorm * bufferDuration);
    
    // Calculate duration in samples
    const durationSamples = Math.floor((this.params.grainSize / 1000) * this.sampleRate);
    
    // Calculate pitch (playback rate)
    const randPitch = (Math.random() * 2 - 1) * this.params.pitchSpread;
    // Pitch is usually multiplicative or exponential (semitones).
    // Let's assume params.pitch is multiplier (1.0 = normal).
    // Spread modifies it.
    const playbackRate = Math.max(0.1, this.params.pitch + randPitch);

    const grain: Grain = {
      id: crypto.randomUUID(),
      bufferIndex,
      playbackPosition: 0,
      duration: durationSamples,
      playbackRate,
      pan: (Math.random() * 2 - 1) * this.params.panSpread,
      gain: 1.0, // Should normalize by density? Or user control.
      active: true,
    };
    
    this.grains.push(grain);
  }
}
