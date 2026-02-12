export type HuntNameCell = {
  primary: string;
  alternates?: string[];
};

type HuntIqgpaLevel = {
  errorCents: number | '>12';
  avgJnd: number | '>2';
  target: 'HIT' | 'MISS';
  standing: 'PASS' | 'FAIL';
  iq: 'Perfect' | 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Wrong';
  grade: 'P' | 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';
  points: number;
};

const cell = (...names: string[]): HuntNameCell => ({
  primary: names[0] || '',
  alternates: names.length > 1 ? names.slice(1) : undefined
});

// Hunt System of Intonation Quality (IQ) table, mapped by absolute cent error.
export const HUNT_IQGPA_TABLE: HuntIqgpaLevel[] = [
  { errorCents: 0, avgJnd: 0, target: 'HIT', standing: 'PASS', iq: 'Perfect', grade: 'P', points: 12 },
  { errorCents: 1, avgJnd: 0.5, target: 'HIT', standing: 'PASS', iq: 'Excellent', grade: 'A+', points: 11 },
  { errorCents: 2, avgJnd: 0.5, target: 'HIT', standing: 'PASS', iq: 'Excellent', grade: 'A', points: 10 },
  { errorCents: 3, avgJnd: 0.5, target: 'HIT', standing: 'PASS', iq: 'Excellent', grade: 'A-', points: 9 },
  { errorCents: 4, avgJnd: 1, target: 'HIT', standing: 'PASS', iq: 'Good', grade: 'B+', points: 8 },
  { errorCents: 5, avgJnd: 1, target: 'HIT', standing: 'PASS', iq: 'Good', grade: 'B', points: 7 },
  { errorCents: 6, avgJnd: 1, target: 'HIT', standing: 'PASS', iq: 'Good', grade: 'B-', points: 6 },
  { errorCents: 7, avgJnd: 1.5, target: 'HIT', standing: 'PASS', iq: 'Fair', grade: 'C+', points: 5 },
  { errorCents: 8, avgJnd: 1.5, target: 'HIT', standing: 'PASS', iq: 'Fair', grade: 'C', points: 4 },
  { errorCents: 9, avgJnd: 1.5, target: 'HIT', standing: 'PASS', iq: 'Fair', grade: 'C-', points: 3 },
  { errorCents: 10, avgJnd: 2, target: 'MISS', standing: 'FAIL', iq: 'Poor', grade: 'D+', points: 2 },
  { errorCents: 11, avgJnd: 2, target: 'MISS', standing: 'FAIL', iq: 'Poor', grade: 'D', points: 1 },
  { errorCents: 12, avgJnd: 2, target: 'MISS', standing: 'FAIL', iq: 'Poor', grade: 'D-', points: 0 },
  { errorCents: '>12', avgJnd: '>2', target: 'MISS', standing: 'FAIL', iq: 'Wrong', grade: 'F', points: 0 }
];

// Preferred pitch names by comma-zone index (0..41). Uses ASCII tokens:
// approx = asymp, sim = sim, dagger = dagger, b = flat, # = sharp.
export const HUNT_PREFERRED_PITCH_NAMES: HuntNameCell[] = [
  cell('D'),
  cell('approx Eb', '+ D'),
  cell('sim Eb'),
  cell('Eb'),
  cell('+ Eb'),
  cell('dagger Eb', 'approx E'),
  cell('sim E'),
  cell('E'),
  cell('+ E'),
  cell('sim F'),
  cell('F'),
  cell('+ F'),
  cell('dagger F', 'approx F#'),
  cell('sim F#'),
  cell('F#'),
  cell('+ F#'),
  cell('sim G'),
  cell('G'),
  cell('+ G'),
  cell('approx G#', 'sim Ab'),
  cell('sim G#', 'Ab'),
  cell('G#', '+ Ab'),
  cell('+ G#', 'dagger Ab'),
  cell('sim A'),
  cell('A'),
  cell('+ A'),
  cell('sim Bb'),
  cell('Bb'),
  cell('+ Bb'),
  cell('dagger Bb', 'approx B'),
  cell('sim B'),
  cell('B'),
  cell('+ B'),
  cell('sim C'),
  cell('C'),
  cell('+ C'),
  cell('dagger C', 'approx C#'),
  cell('sim C#'),
  cell('C#'),
  cell('+ C#'),
  cell('sim D', 'dagger C#'),
  cell('D')
];

// Preferred interval names by comma-zone index (0..41).
export const HUNT_PREFERRED_INTERVAL_NAMES: HuntNameCell[] = [
  cell('P1'),
  cell('Nm2', 'L1'),
  cell('Sm2'),
  cell('m2'),
  cell('Lm2'),
  cell('Wm2', 'NM2'),
  cell('SM2'),
  cell('M2'),
  cell('LM2'),
  cell('Sm3'),
  cell('m3'),
  cell('Lm3'),
  cell('Wm3', 'NM3'),
  cell('SM3'),
  cell('M3'),
  cell('LM3'),
  cell('S4'),
  cell('P4'),
  cell('L4'),
  cell('Na4', 'Sd5'),
  cell('Sa4', 'd5'),
  cell('a4', 'Ld5'),
  cell('La4', 'Wd5'),
  cell('S5'),
  cell('P5'),
  cell('L5'),
  cell('Sm6'),
  cell('m6'),
  cell('Lm6'),
  cell('Wm6', 'NM6'),
  cell('SM6'),
  cell('M6'),
  cell('LM6'),
  cell('Sm7'),
  cell('m7'),
  cell('Lm7'),
  cell('Wm7', 'NM7'),
  cell('SM7'),
  cell('M7'),
  cell('LM7'),
  cell('S8', 'WM7'),
  cell('P8')
];

export const HUNT_COMMA_ZONES_PER_OCTAVE = 41;

export const getHuntIqgpaLevel = (errorCents: number): HuntIqgpaLevel => {
  const abs = Math.abs(errorCents);
  const direct = HUNT_IQGPA_TABLE.find((row) => typeof row.errorCents === 'number' && row.errorCents === Math.round(abs));
  if (direct) return direct;
  return HUNT_IQGPA_TABLE[HUNT_IQGPA_TABLE.length - 1];
};

export const getHuntIntervalNameForZone = (zInOct: number): HuntNameCell => {
  const size = HUNT_COMMA_ZONES_PER_OCTAVE;
  const normalized = ((zInOct % size) + size) % size;
  return HUNT_PREFERRED_INTERVAL_NAMES[normalized] || HUNT_PREFERRED_INTERVAL_NAMES[0];
};

export const getHuntPitchNameForZone = (zInOct: number): HuntNameCell => {
  const size = HUNT_COMMA_ZONES_PER_OCTAVE;
  const normalized = ((zInOct % size) + size) % size;
  return HUNT_PREFERRED_PITCH_NAMES[normalized] || HUNT_PREFERRED_PITCH_NAMES[0];
};

