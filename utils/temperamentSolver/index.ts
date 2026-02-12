
export type OctaveModel = 'perfect' | 'stretched' | 'non_octave';

export type SolverMode = 'ModeA' | 'ModeB';

export type CurveShape = 'symmetrical' | 'gradual';

export interface RatioSpec {
  n: number;
  d: number;
  label?: string;
  tolerance?: number;         
}

export interface AdvancedIntervalSpec {
  degree: number;             
  n: number;
  d: number;
  label?: string;
  toleranceCents: number;
  priority: number;
  maxErrorCents?: number;     
}

export interface AdvancedConstraintsInput {
  enabled: boolean;
  intervals: AdvancedIntervalSpec[];
  octave?: {
    toleranceCents: number;
    priority: number;
    maxErrorCents?: number;
  };
}

export interface KeySpecificity {
  tonic: number;              
  flats: number;              
  sharps: number;             
}

export interface SolverInput {
  scaleSize: number;          
  baseFrequencyHz: number;    
  baseMidiNote: number;       
  octaveModel: OctaveModel;
  cycleCents: number;         
  targets: RatioSpec[];       
  globalToleranceCents: number;
  keySpecificity: KeySpecificity;
  constrainMinor3rds?: boolean;

  wolfPlacement: 'auto' | 'manual';
  wolfEdgeIndex?: number;     

  mode: SolverMode;
  meantoneWeight: number;     
  curveShape: CurveShape;

  targetWeights?: Record<string, number>;
  octaWeighting?: OctaWeighting;

  octaveStiffness?: number;

  advancedConstraints?: AdvancedConstraintsInput;
}

export interface OctaWeighting {
  enabled?: boolean;
  x?: number;
  y?: number;
  z?: number;
  targets?: OctaAnchor[];
}

export interface Rank2Constraint {
  label: string;
  n: number;                    
  d: number;                    
  weight: number;               
  idealCents: number;           
  generatorSteps: number;       
  periodSteps: number;          
}

export type OctaAnchor = { id: string; n: number; d: number; label: string };

export const OCTA_ANCHORS: OctaAnchor[] = [
  { id: 'v000', n: 3, d: 2, label: 'Anchor v000' },
  { id: 'v001', n: 4, d: 3, label: 'Anchor v001' },
  { id: 'v100', n: 5, d: 4, label: 'Anchor v100' },
  { id: 'v101', n: 6, d: 5, label: 'Anchor v101' },
  { id: 'v010', n: 7, d: 4, label: 'Anchor v010' },
  { id: 'v011', n: 7, d: 6, label: 'Anchor v011' },
  { id: 'v110', n: 11, d: 8, label: 'Anchor v110' },
  { id: 'v111', n: 13, d: 8, label: 'Anchor v111' }
];

export interface NoteResult {
  degree: number;             
  name: string;
  centsFromRoot: number;      
  centsAbsolute?: number;     
  freqHzAtRootMidi: number;   
}

export interface IntervalError {
  i: number;
  j: number;
  step: number;
  target: RatioSpec;
  targetCents: number;
  actualCents: number;
  errorCents: number; 
  weight: number;
  kind: 'P5' | 'M3' | 'm3';
  isSkeleton: boolean;
  keyTonic?: number;
  anchorId?: string;
  toleranceCents?: number;
  maxErrorCents?: number;
  priority?: number;
}

export interface BeatRateRow {
  lowDegree: number;
  highDegree: number;
  ratio: RatioSpec;
  beatHz: number;
  lowHz: number;
  highHz: number;
}

export interface SolverOutput {
  input: SolverInput;
  notes: NoteResult[];
  generatorCents?: number;          
  intervals: IntervalError[];
  maxAbsErrorCents: number;
  rmsErrorCents: number;
  beatTable: BeatRateRow[];
  sclText: string;
  kbmText: string;
  csvText: string;
  mtsBulkSyxBytes: Uint8Array;
  mtsSingleSyxBytes: Uint8Array;    

  optimizedPeriodCents?: number;    
  periodStretchCents?: number;      
  periodStretchWarning?: boolean;   
}

export const NOTE_NAMES_12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a), y = Math.abs(b);
  while (y) { const t = x % y; x = y; y = t; }
  return x || 1;
};

export const parseRatio = (s: string): RatioSpec | null => {
  const m = s.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10), d = parseInt(m[2], 10);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  const g = gcd(n, d);
  return { n: n / g, d: d / g, label: `${n / g}/${d / g}` };
};

export const ratioToCents = (r: RatioSpec): number => 1200 * Math.log2(r.n / r.d);

export const wrapToCycle = (cents: number, cycle: number): number => {
  let x = cents % cycle;
  if (x < 0) x += cycle;
  return x;
};

export const signedWrapDiff = (actual: number, target: number, cycle: number): number => {
  
  let d = (actual - target) % cycle;
  if (d > cycle / 2) d -= cycle;
  if (d < -cycle / 2) d += cycle;
  return d;
};

export const degreeName = (degree: number, N: number): string => {
  if (N === 12) return NOTE_NAMES_12[((degree % 12) + 12) % 12];
  return `deg${degree}`;
};

export const buildEqualTemperament = (N: number, cycleCents: number): number[] => {
  const step = cycleCents / N;
  return Array.from({ length: N }, (_, k) => k * step);
};

export const nearestStepForRatio = (rCents: number, N: number, cycleCents: number): number => {
  const step = cycleCents / N;
  return ((Math.round(rCents / step) % N) + N) % N;
};

export const buildKeySetOnFifths = (tonic: number, flats: number, sharps: number, N: number): number[] => {
  
  const fifthStep = nearestStepForRatio(1200 * Math.log2(3 / 2), N, 1200); 
  const out: number[] = [];
  for (let k = -flats; k <= sharps; k++) {
    const pc = ((tonic + k * fifthStep) % N + N) % N;
    out.push(pc);
  }
  return Array.from(new Set(out));
};

export const buildHarmonicSkeletonPairs = (keys: number[], N: number) => {
  
  const stepM3 = nearestStepForRatio(1200 * Math.log2(5 / 4), N, 1200);
  const stepP5 = nearestStepForRatio(1200 * Math.log2(3 / 2), N, 1200);
  const stepP4 = (N - stepP5) % N;

  const pairs: { a: number, b: number, kind: 'P5' | 'M3', keyTonic: number }[] = [];

  for (const t of keys) {
    const I = [t, (t + stepM3) % N, (t + stepP5) % N];
    const IV = [(t + stepP4) % N, (t + stepP4 + stepM3) % N, t];
    const V = [(t + stepP5) % N, (t + stepP5 + stepM3) % N, (t + 2 * stepP5) % N];

    const triads = [I, IV, V];
    for (const tri of triads) {
      const root = tri[0];
      const third = tri[1];
      const fifth = tri[2];
      
      pairs.push({ a: root, b: third, kind: 'M3', keyTonic: t });
      pairs.push({ a: root, b: fifth, kind: 'P5', keyTonic: t });
    }
  }

  const uniq = new Map<string, { a: number, b: number, kind: 'P5' | 'M3', keyTonic: number }>();
  for (const p of pairs) {
    const key = `${p.a}-${p.b}-${p.kind}-${p.keyTonic}`;
    uniq.set(key, p);
  }
  return Array.from(uniq.values());
};

export const computeOctaWeights = (x: number, y: number, z: number): Record<string, number> => {
  const cx = clamp(x, 0, 1);
  const cy = clamp(y, 0, 1);
  const cz = clamp(z, 0, 1);
  const w000 = (1 - cx) * (1 - cy) * (1 - cz);
  const w001 = (1 - cx) * (1 - cy) * cz;
  const w010 = (1 - cx) * cy * (1 - cz);
  const w011 = (1 - cx) * cy * cz;
  const w100 = cx * (1 - cy) * (1 - cz);
  const w101 = cx * (1 - cy) * cz;
  const w110 = cx * cy * (1 - cz);
  const w111 = cx * cy * cz;
  return {
    v000: w000,
    v001: w001,
    v010: w010,
    v011: w011,
    v100: w100,
    v101: w101,
    v110: w110,
    v111: w111
  };
};
