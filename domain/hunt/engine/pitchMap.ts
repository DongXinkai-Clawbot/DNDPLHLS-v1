import type { MusicXmlPitch } from '../../musicxml/types';
import { HUNT_MAP_GEOMETRY_V1, huntIndexToSlot } from '../HUNT_MAP';
import type { HuntEngineConfig, HuntPitchMapping } from './types';

const stepToSemitone: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

export const pitchToMidi = (pitch: MusicXmlPitch): number => {
  const base = stepToSemitone[pitch.step.toUpperCase()] ?? 0;
  return (pitch.octave + 1) * 12 + base + (Number.isFinite(pitch.alter) ? pitch.alter : 0);
};

export const midiToCentsAbs = (midiNote: number, config?: HuntEngineConfig) => {
  const a4InC0Cents = Number.isFinite(config?.a4InC0Cents) ? (config?.a4InC0Cents as number) : 5700;
  const baseCents = (midiNote - 12) * 100;
  if (config?.zeroPitch === 'A4') {
    return baseCents - a4InC0Cents;
  }
  if (config?.zeroPitch === 'custom') {
    return baseCents - a4InC0Cents;
  }
  return baseCents;
};

export const mapPitchToHunt = (
  pitch: MusicXmlPitch,
  config?: HuntEngineConfig
): HuntPitchMapping => {
  const map = config?.map ?? HUNT_MAP_GEOMETRY_V1;
  const midiNote = pitchToMidi(pitch);
  const centsAbs = midiToCentsAbs(midiNote, config);
  const stepCents = map.stepCents;
  const I = Math.round(centsAbs / stepCents);
  const slotInfo = huntIndexToSlot(I, map);
  const errorCents = centsAbs - I * stepCents;
  const maxError = Number.isFinite(config?.maxPitchErrorCents)
    ? (config?.maxPitchErrorCents as number)
    : stepCents / 2;
  const errorOverLimit = Math.abs(errorCents) > maxError;
  const accidental = map.inflections[slotInfo.O]?.glyph ?? 'n';
  return {
    centsAbs,
    I: slotInfo.I,
    Z: slotInfo.Z,
    O: slotInfo.O,
    zInOct: slotInfo.zInOct,
    errorCents,
    errorOverLimit,
    accidental
  };
};
