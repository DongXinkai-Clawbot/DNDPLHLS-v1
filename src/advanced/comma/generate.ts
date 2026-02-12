
export type CommaVector = {
  vec: Record<number, number>;
  cents: number;
  radius: number;
  primeCount: number;
};

const LN2 = Math.log(2);
const log2 = (x:number)=> Math.log(x)/LN2;

function centsOfVec(vec: Record<number, number>): number {
  let sum = 0;
  for (const k of Object.keys(vec)) {
    const p = Number(k);
    const e = vec[p];
    if (!e) continue;
    sum += e * log2(p);
  }
  return 1200 * sum;
}

function normalizeOctave(vec: Record<number, number>): { vec: Record<number, number>, cents: number } {
  const raw = centsOfVec(vec);
  const k = Math.round(raw/1200);
  const cents = raw - 1200*k;
  const out = { ...vec };
  out[2] = (out[2]||0) - k;
  return { vec: out, cents };
}

function radiusEx2(v: Record<number, number>): number {
  let r = 0;
  for (const k of Object.keys(v)) {
    const p = Number(k);
    if (p===2) continue;
    r += Math.abs(v[p]);
  }
  return r;
}
function primeCountEx2(v: Record<number, number>): number {
  let c = 0;
  for (const k of Object.keys(v)) {
    const p = Number(k);
    if (p===2) continue;
    if (v[p]!==0) c++;
  }
  return c;
}

export interface GenerateOptions {
  primes: number[];
  centsMax: number;
  radiusMax: number;
  emax: number;
  limit: number;
}

export function* exponentVectors(primes: number[], emax: number, radiusMax: number){
  const ps = [...primes];
  if (!ps.includes(2)) ps.unshift(2);
  ps.sort((a,b)=> (a===2?-1:(b===2?1:a-b)));
  const n = ps.length;
  const exps = new Array<number>(n).fill(0);
  const out: any[] = [];
  function rec(i:number, r:number){
    if (i===n){ 
      if (exps.some(e=>e!==0)) out.push([...exps]); 
      return; 
    }
    const p = ps[i];
    const lim = Math.min(emax, 12);
    for (let e=-lim; e<=lim; e++){
      exps[i]=e;
      const nr = p===2 ? r : r+Math.abs(e);
      if (nr<=radiusMax) rec(i+1, nr);
    }
    exps[i]=0;
  }
  rec(0,0);
  for (const arr of out){
    const v: Record<number, number> = {};
    for (let i=0;i<n;i++) v[ps[i]]=arr[i];
    const norm = normalizeOctave(v);
    const r = radiusEx2(norm.vec);
    if (r<=radiusMax) {
      yield ({ vec: norm.vec, cents: norm.cents, radius: r, primeCount: primeCountEx2(norm.vec) });
    }
  }
}

export function generateCommas(opts: GenerateOptions): CommaVector[] {
  const { primes, centsMax, radiusMax, emax, limit } = opts;
  const seen = new Set<string>();
  const res: CommaVector[] = [];
  for (const v of exponentVectors(primes, emax, radiusMax)){
    if (Math.abs(v.cents) <= centsMax + 1e-9){
      const key = JSON.stringify(v.vec);
      if (!seen.has(key)){
        seen.add(key);
        res.push(v);
        if (res.length>=limit) break;
      }
    }
  }
  res.sort((a,b)=> {
    const ac=Math.abs(a.cents), bc=Math.abs(b.cents);
    if (ac!==bc) return ac-bc;
    if (a.radius!==b.radius) return a.radius-b.radius;
    if (a.primeCount!==b.primeCount) return a.primeCount-b.primeCount;
    return 0;
  });
  return res;
}
