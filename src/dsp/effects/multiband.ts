import { BiquadFilter, FilterType } from './filter';
import { Compressor } from './compressor';

class LRCrossover {
  private lp1: BiquadFilter;
  private lp2: BiquadFilter;
  private hp1: BiquadFilter;
  private hp2: BiquadFilter;

  constructor(frequency: number, sampleRate: number) {
    this.lp1 = new BiquadFilter(sampleRate);
    this.lp2 = new BiquadFilter(sampleRate);
    this.hp1 = new BiquadFilter(sampleRate);
    this.hp2 = new BiquadFilter(sampleRate);
    this.setFrequency(frequency);
  }

  public setFrequency(frequency: number): void {
    const Q = 0.707;
    this.lp1.configure(FilterType.LowPass, frequency, Q);
    this.lp2.configure(FilterType.LowPass, frequency, Q);
    this.hp1.configure(FilterType.HighPass, frequency, Q);
    this.hp2.configure(FilterType.HighPass, frequency, Q);
  }

  public process(input: number): { low: number, high: number } {
    const l1 = this.lp1.process(input);
    const low = this.lp2.process(l1);
    
    const h1 = this.hp1.process(input);
    const high = this.hp2.process(h1);
    
    return { low, high };
  }
}

export class MultiBandCompressor {
  public lowComp: Compressor;
  public midComp: Compressor;
  public highComp: Compressor;
  
  private xoLow: LRCrossover;
  private xoHigh: LRCrossover;
  private sampleRate: number;

  constructor(sampleRate: number = 44100) {
    this.sampleRate = sampleRate;
    
    this.lowComp = new Compressor(sampleRate);
    this.midComp = new Compressor(sampleRate);
    this.highComp = new Compressor(sampleRate);

    this.xoLow = new LRCrossover(200, sampleRate); // Low/Mid split at 200Hz
    this.xoHigh = new LRCrossover(2000, sampleRate); // Mid/High split at 2kHz
  }

  public setCrossoverFrequencies(lowMid: number, midHigh: number): void {
    this.xoLow.setFrequency(lowMid);
    this.xoHigh.setFrequency(midHigh);
  }

  public process(input: number): number {
    // Split into 3 bands
    // 1. Split Input -> Low + (Mid+High) using xoLow?
    // Wait, if xoLow is 200Hz:
    // Low output is < 200Hz.
    // High output is > 200Hz.
    
    // 2. Split (Mid+High) -> Mid + High using xoHigh (2kHz).
    // Low output is < 2kHz (but > 200Hz effectively).
    // High output is > 2kHz.
    
    const split1 = this.xoLow.process(input);
    const lowBand = split1.low;
    const midHighBand = split1.high;
    
    const split2 = this.xoHigh.process(midHighBand);
    const midBand = split2.low;
    const highBand = split2.high;
    
    // Compress each band
    const lowOut = this.lowComp.process(lowBand);
    const midOut = this.midComp.process(midBand);
    const highOut = this.highComp.process(highBand);
    
    // Sum
    return lowOut + midOut + highOut;
  }
}
