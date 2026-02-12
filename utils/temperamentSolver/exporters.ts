
import type { NoteResult, RatioSpec, SolverInput } from './index';
import { degreeName, ratioToCents, wrapToCycle } from './index';

export const centsToRatioApprox = (cents: number, maxDen: number = 1024): string => {
  
  const x = Math.pow(2, cents / 1200);
  let a0 = Math.floor(x);
  let p0 = 1, q0 = 0, p1 = a0, q1 = 1;
  let frac = x - a0;
  let iter = 0;
  while (iter < 32 && q1 <= maxDen && Math.abs(p1/q1 - x) > 1e-10 && frac !== 0) {
    frac = 1/frac;
    const a = Math.floor(frac);
    const p2 = a*p1 + p0;
    const q2 = a*q1 + q0;
    p0=p1; q0=q1; p1=p2; q1=q2;
    frac = frac - a;
    iter++;
  }
  return `${p1}/${q1}`;
};

export const buildScl = (input: SolverInput, centsByDegree: number[], header: Record<string,string>): string => {
  const N = input.scaleSize;
  const cycle = input.cycleCents;

  const lines: string[] = [];
  lines.push('! Harmonia Universalis - Adaptive Temperament Solver');
  for (const [k,v] of Object.entries(header)) lines.push(`! ${k}: ${v}`);
  lines.push('!');
  lines.push(`${header['Name'] || 'Harmonia Universalis'} (${N} notes)`);
  lines.push(`${N}`);
  for (let i=1;i<N;i++){
    const c = wrapToCycle(centsByDegree[i], cycle);
    lines.push(`${c.toFixed(6)}`);
  }
  lines.push(`${cycle.toFixed(6)}`);
  return lines.join('\n') + '\n';
};

export const buildKbm = (input: SolverInput, rootDegree: number = 0): string => {
  
  const N = input.scaleSize;
  const lines: string[] = [];
  lines.push('! Harmonia Universalis - KBM');
  lines.push('! 0..127 mapping; unmapped entries use -1');
  lines.push('!');

  lines.push(`${N}`);             
  lines.push(`0`);                
  lines.push(`127`);              
  lines.push(`${input.baseMidiNote}`);   
  lines.push(`${degreeName(rootDegree, N)}`); 
  lines.push(`${input.baseFrequencyHz.toFixed(6)}`); 
  lines.push(`${0}`);             

  for (let k=0;k<N;k++) lines.push(`${k}`);
  return lines.join('\n') + '\n';
};

export const buildCsv = (input: SolverInput, notes: NoteResult[], beatRows: any[]): string => {
  const lines: string[] = [];
  lines.push('Note,Degree,FrequencyHz,Cents,RatioApprox');
  for (const n of notes) {
    lines.push(`${n.name},${n.degree},${n.freqHzAtRootMidi.toFixed(6)},${n.centsFromRoot.toFixed(6)},${centsToRatioApprox(n.centsFromRoot)}`);
  }
  lines.push('');
  lines.push('BeatRates');
  lines.push('Low,High,Ratio,BeatHz,LowHz,HighHz');
  for (const b of beatRows) {
    lines.push(`${b.lowDegree},${b.highDegree},${b.ratio.n}/${b.ratio.d},${b.beatHz.toFixed(6)},${b.lowHz.toFixed(6)},${b.highHz.toFixed(6)}`);
  }
  return lines.join('\n') + '\n';
};
