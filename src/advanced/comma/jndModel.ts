
export type JNDBin = { loHz:number; hiHz:number; jndCents:number; n:number };
export type JNDModel = { bins: JNDBin[]; method: string; updatedAt: number };

const DEFAULT_JND = 10;
const DEFAULT_BINS = [
  {loHz:80,hiHz:160},{loHz:160,hiHz:320},{loHz:320,hiHz:640},
  {loHz:640,hiHz:1280},{loHz:1280,hiHz:2560},{loHz:2560,hiHz:5120},
];

export function loadEarPersisted(): any | null {
  try {
    const direct = localStorage.getItem("EarTrainingPersistedV1");
    if (direct) return JSON.parse(direct);
  } catch {}
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys){
      if (/ear.*train/i.test(k)){
        try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch {}
      }
    }
  } catch {}
  return null;
}

function percentile(arr:number[], p:number): number {
  if (!arr.length) return NaN;
  const a = arr.slice().sort((x,y)=>x-y);
  const idx = Math.floor((a.length-1)*p);
  return a[idx];
}

export function deriveJND(): JNDModel {
  const bins = DEFAULT_BINS.map(b=>({ ...b, jndCents: DEFAULT_JND, n: 0 }));
  const persisted = loadEarPersisted();
  if (!persisted) return { bins, method:"fallback:constant", updatedAt: Date.now() };

  const cps = ((persisted.part2 && persisted.part2.continuousPitch) || []).filter((s:any)=> typeof s?.errorCents==="number" && typeof s?.finalHz==="number");
  if (cps.length){
    for (const b of bins){
      const errs = cps.filter((s:any)=> s.finalHz>=b.loHz && s.finalHz<b.hiHz).map((s:any)=> Math.abs(s.errorCents));
      if (errs.length>=8){
        b.jndCents = Math.max(5, Math.min(50, percentile(errs, 0.75)));
        b.n = errs.length;
      }
    }
    return { bins, method:"contPitch:p75", updatedAt: Date.now() };
  }

  const izSource = (persisted.part2 && (persisted.part2.intervalZoneSamples || persisted.part2.intervalZone)) || [];
  const iz = izSource.filter((s:any)=> typeof s?.deviationCents==="number" && typeof s?.accepted==="boolean");
  if (iz.length){
    const devs = iz.map((s:any)=> Math.abs(s.deviationCents));
    const val = Math.max(5, Math.min(50, percentile(devs, 0.75)));
    for (const b of bins){ b.jndCents = val; b.n = iz.length; }
    return { bins, method:"intervalZone:p75-uniform", updatedAt: Date.now() };
  }

  return { bins, method:"fallback:constant", updatedAt: Date.now() };
}

export function jndForFreq(model:JNDModel, hz:number): number {
  for (const b of model.bins){
    if (hz>=b.loHz && hz<b.hiHz) return b.jndCents;
  }
  return model.bins[0]?.jndCents ?? DEFAULT_JND;
}
