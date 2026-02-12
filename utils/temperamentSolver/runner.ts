
import type { BeatRateRow, NoteResult, SolverInput, SolverOutput } from './index';
import { solveAdvancedConstraints } from './advanced';
import { buildModeANotes, solveModeA } from './modeA';
import { solveModeB } from './modeB';
import { buildCsv, buildKbm, buildScl } from './exporters';
import { buildMtsBulkDump, buildMtsSingleNoteTuningCombined } from './mts';
import {
  buildEqualTemperament,
  degreeName,
  ratioToCents,
  signedWrapDiff,
  wrapToCycle
} from './index';

const computeStats = (intervals: any[]) => {
  let sumSq = 0;
  let sumW = 0;
  let maxAbs = 0;
  for (const it of intervals) {
    const w = it.weight ?? 1;
    const e = it.errorCents ?? 0;
    sumSq += w * e * e;
    sumW += w;
    maxAbs = Math.max(maxAbs, Math.abs(e));
  }
  const rms = Math.sqrt(sumSq / Math.max(1e-9, sumW));
  return { rms, maxAbs };
};

const beatForRatio = (lowHz: number, highHz: number, r: { n: number, d: number }) => {
  
  return Math.abs(r.n * lowHz - r.d * highHz);
};

export const computeBeatTable = (input: SolverInput, notes: NoteResult[], intervals: any[]): BeatRateRow[] => {
  const N = input.scaleSize;
  
  const freqByDeg = new Array(N).fill(0).map((_, k) => notes[k]?.freqHzAtRootMidi ?? 0);

  const rows: BeatRateRow[] = [];
  
  const sorted = [...intervals].sort((a, b) => (b.weight || 1) - (a.weight || 1));
  const picked = sorted.slice(0, Math.min(48, sorted.length));
  for (const it of picked) {
    const low = it.i;
    const high = it.j;
    const lowHz = freqByDeg[low];
    const highHz = freqByDeg[high];
    const beatHz = beatForRatio(lowHz, highHz, it.target);
    rows.push({ lowDegree: low, highDegree: high, ratio: it.target, beatHz, lowHz, highHz });
  }
  return rows;
};

export const runSolver = (input: SolverInput): SolverOutput => {
  const N = input.scaleSize;
  const cycle = input.cycleCents;

  let centsByDegree: number[] = buildEqualTemperament(N, cycle);
  let intervals: any[] = [];
  let generatorCents: number | undefined = undefined;
  let optimizedPeriodCents: number | undefined = undefined;
  let periodStretchCents: number | undefined = undefined;
  let periodStretchWarning: boolean | undefined = undefined;
  let centsAbsolute: number[] | undefined = undefined;

  if (input.advancedConstraints?.enabled) {
    const r = solveAdvancedConstraints(input);
    centsByDegree = r.notesCents;
    intervals = r.intervals;
    optimizedPeriodCents = r.optimizedPeriodCents;
    periodStretchCents = r.periodStretchCents;
    periodStretchWarning = r.periodStretchWarning;
  } else if (input.mode === 'ModeA') {
    const r = solveModeA(input);
    centsByDegree = r.notesCents;
    intervals = r.intervals;
    generatorCents = r.generatorCents;
    
    optimizedPeriodCents = r.optimizedPeriodCents;
    periodStretchCents = r.periodStretchCents;
    periodStretchWarning = r.periodStretchWarning;
    centsAbsolute = r.centsAbsolute;
  } else {
    const r = solveModeB(input);
    centsByDegree = r.notesCents;
    intervals = r.intervals;
  }

  const effectivePeriod = optimizedPeriodCents ?? cycle;

  const notes: NoteResult[] = centsByDegree.map((cents, degree) => ({
    degree,
    name: degreeName(degree, N),
    centsFromRoot: wrapToCycle(cents, effectivePeriod),
    centsAbsolute: centsAbsolute?.[degree],
    freqHzAtRootMidi: input.baseFrequencyHz * Math.pow(2, cents / 1200)
  }));

  const beatTable = computeBeatTable(input, notes, intervals);

  const { rms, maxAbs } = computeStats(intervals);

  const header = {
    Name: 'Harmonia Universalis',
    Mode: input.mode,
    OctaveModel: input.octaveModel,
    CycleCents: (optimizedPeriodCents ?? input.cycleCents).toFixed(6),
    BaseFrequencyHz: input.baseFrequencyHz.toFixed(6),
    BaseMidiNote: input.baseMidiNote.toString(),
    GeneratorCents: generatorCents !== undefined ? generatorCents.toFixed(6) : 'n/a',
    KeySpecificity: `tonic=${degreeName(input.keySpecificity.tonic, N)} flats=${input.keySpecificity.flats} sharps=${input.keySpecificity.sharps}`,
    ...(periodStretchCents !== undefined && { PeriodStretch: `${periodStretchCents >= 0 ? '+' : ''}${periodStretchCents.toFixed(3)}¢` })
  };

  const sclText = buildScl(input, centsByDegree, header);
  const kbmText = buildKbm(input, 0);
  const csvText = buildCsv(input, notes, beatTable);

  const mtsBulkSyxBytes = buildMtsBulkDump(input, centsByDegree, 'Harmonia Universalis', 0x7F, 0x00);
  const mtsSingleSyxBytes = buildMtsSingleNoteTuningCombined(input, centsByDegree, 0x7F, 0x00);

  return {
    input,
    notes,
    generatorCents,
    intervals,
    maxAbsErrorCents: maxAbs,
    rmsErrorCents: rms,
    beatTable,
    sclText,
    kbmText,
    csvText,
    mtsBulkSyxBytes,
    mtsSingleSyxBytes,
    
    optimizedPeriodCents,
    periodStretchCents,
    periodStretchWarning
  };
};
