
import type { SolverInput } from './index';
type MtsInput = Pick<SolverInput, "scaleSize" | "baseMidiNote" | "baseFrequencyHz" | "cycleCents">;


const MIDI_NOTE_0_FREQ = 8.175798915643707; 

const encodeFreqWord = (freqHz: number): [number, number, number] => {
  if (!(freqHz > 0) || !Number.isFinite(freqHz)) return [0x7F, 0x7F, 0x7F];
  const midiFloat = 69 + 12 * Math.log2(freqHz / 440.0);
  let semitone = Math.floor(midiFloat);
  if (semitone < 0) semitone = 0;
  if (semitone > 127) semitone = 127;

  const frac = midiFloat - semitone; 
  let frac14 = Math.round(frac * 16384); 
  if (frac14 < 0) frac14 = 0;
  if (frac14 > 16383) frac14 = 16383;

  const yy = (frac14 >> 7) & 0x7F;
  const zz = frac14 & 0x7F;
  const xx = semitone & 0x7F;
  return [xx, yy, zz];
};

const toAscii16 = (name: string): number[] => {
  const s = (name || '').padEnd(16, ' ').slice(0, 16);
  return Array.from(s).map(ch => ch.charCodeAt(0) & 0x7F);
};

const checksumXor7bit = (bytes: number[]): number => {
  
  let x = 0;
  for (const b of bytes) x ^= (b & 0x7F);
  return x & 0x7F;
};

export const buildMtsSingleNoteTuning = (
  input: MtsInput,
  centsByDegree: number[],
  deviceId: number = 0x7F,
  program: number = 0x00
): Uint8Array[] => {
  const N = input.scaleSize;
  const messages: Uint8Array[] = [];

  for (let midi = 0; midi < 128; midi++) {
    const stepsFromBase = midi - input.baseMidiNote;
    const degree = ((stepsFromBase % N) + N) % N;
    const octaves = Math.floor((stepsFromBase - degree) / N);
    const cents = centsByDegree[degree] + octaves * input.cycleCents;
    const freq = input.baseFrequencyHz * Math.pow(2, cents / 1200);

    const [xx, yy, zz] = encodeFreqWord(freq);

    const msg = new Uint8Array([
      0xF0,                     
      0x7F,                     
      deviceId & 0x7F,          
      0x08,                     
      0x02,                     
      program & 0x7F,           
      0x01,                     
      midi & 0x7F,              
      xx,                       
      yy,                       
      zz,                       
      0xF7                      
    ]);

    messages.push(msg);
  }

  return messages;
};

export const buildMtsSingleNoteTuningCombined = (
  input: MtsInput,
  centsByDegree: number[],
  deviceId: number = 0x7F,
  program: number = 0x00
): Uint8Array => {
  const messages = buildMtsSingleNoteTuning(input, centsByDegree, deviceId, program);
  const totalLen = messages.reduce((acc, m) => acc + m.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const msg of messages) {
    combined.set(msg, offset);
    offset += msg.length;
  }
  return combined;
};

export const buildMtsBulkDump = (
  input: MtsInput,
  centsByDegree: number[],
  tuningName: string,
  deviceId: number = 0x7F,          
  program: number = 0x00            
): Uint8Array => {
  const N = input.scaleSize;

  const freqs: number[] = [];
  for (let midi = 0; midi < 128; midi++) {
    const stepsFromBase = midi - input.baseMidiNote;
    const degree = ((stepsFromBase % N) + N) % N;
    const octaves = Math.floor((stepsFromBase - degree) / N);
    const cents = centsByDegree[degree] + octaves * input.cycleCents;
    const freq = input.baseFrequencyHz * Math.pow(2, cents / 1200);
    freqs.push(freq);
  }

  const data: number[] = [];
  for (const f of freqs) {
    const [xx, yy, zz] = encodeFreqWord(f);
    data.push(xx, yy, zz);
  }

  const header = [0xF0, 0x7E, deviceId & 0x7F, 0x08, 0x01, program & 0x7F];
  const nameBytes = toAscii16(tuningName);

  const chkBytes = [0x7E, deviceId & 0x7F, 0x08, 0x01, program & 0x7F, ...nameBytes, ...data];
  const chk = checksumXor7bit(chkBytes);

  const out = [...header, ...nameBytes, ...data, chk, 0xF7];
  return new Uint8Array(out);
};
