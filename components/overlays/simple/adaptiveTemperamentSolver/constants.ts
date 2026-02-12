import type { UiRatioSpec } from './types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FIFTHS_CIRCLE = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];

export const DEFAULT_RATIOS: UiRatioSpec[] = [
  { label: '3/2 (Perfect 5th)', n: 3, d: 2, defaultOn: true },
  { label: '4/3 (Perfect 4th)', n: 4, d: 3, defaultOn: true },
  { label: '5/4 (Major 3rd)', n: 5, d: 4, defaultOn: true },
  { label: '6/5 (Minor 3rd)', n: 6, d: 5 },
  { label: '7/4 (Harmonic 7th)', n: 7, d: 4 },
  { label: '9/8 (Major 2nd)', n: 9, d: 8 },
  { label: '16/15 (Minor 2nd)', n: 16, d: 15 },
  { label: '11/8 (Neutral 4th-ish)', n: 11, d: 8 },
  { label: '13/8 (13th partial)', n: 13, d: 8 },
];
