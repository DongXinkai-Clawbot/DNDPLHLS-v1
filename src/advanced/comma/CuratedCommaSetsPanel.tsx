import React, { useMemo } from "react";
import { generateCommas } from "./generate";
import { deriveJND, jndForFreq } from "./jndModel";
import { readWindowState } from "./toolState";

function pick(list: any[], n: number){ return list.slice(0,n); }

export default function CuratedCommaSetsPanel(){
  const st = readWindowState();
  const comma = st.comma;

  const model = deriveJND();
  const thr = jndForFreq(model, comma.refHz) * comma.jndFactor;

  const all = useMemo(()=> generateCommas({
    primes: comma.primes,
    centsMax: comma.centsMax,
    radiusMax: comma.radiusMax,
    emax: comma.emax,
    limit: 1500
  }), [comma.primes, comma.centsMax, comma.radiusMax, comma.emax]);

  const sets = useMemo(()=>{
    const byAbs = [...all].sort((a,b)=> Math.abs(a.cents)-Math.abs(b.cents));
    const audible = byAbs.filter(x=> Math.abs(x.cents) >= thr);
    const borderline = byAbs.filter(x=> Math.abs(x.cents) >= 0.7*thr && Math.abs(x.cents) < thr);
    const ignore = byAbs.filter(x=> Math.abs(x.cents) < 0.7*thr);
    return { audibleTop: pick(audible, 30), borderlineTop: pick(borderline, 30), ignoreTop: pick(ignore, 30) };
  }, [all, thr]);

  function addAllToTraining(list: any[]){
    try { for (const x of list) (window as any).app?.earPart2?.addTargetCommaCents?.(x.cents); } catch {}
  }

  const Bucket = ({title, desc, list}:{title:string; desc:string; list:any[]}) => (
    <div className="border rounded p-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
        <button className="btn btn-xs" onClick={()=>addAllToTraining(list)}>Add all to Training</button>
      </div>
      <div className="max-h-48 overflow-auto mt-2">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/30">
            <tr><th className="text-left p-1">cents</th><th className="text-left p-1">vector</th></tr>
          </thead>
          <tbody>
            {list.map((x,i)=>(
              <tr key={i} className="border-t border-white/5">
                <td className="p-1">{x.cents.toFixed(3)}</td>
                <td className="p-1">{Object.entries(x.vec).map(([p,e])=>`${p}^${e}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Auto-Curated Comma Sets</h2>
      <p className="text-sm text-gray-400 mb-3">
        Deterministic buckets from current filters and JND threshold (≈ {thr.toFixed(1)} cents @ {comma.refHz} Hz).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Bucket title="Most Audible Near-Center" desc="Above your JND threshold." list={sets.audibleTop} />
        <Bucket title="Borderline (Training Targets)" desc="Near threshold; ideal for training." list={sets.borderlineTop} />
        <Bucket title="Safe-to-Ignore Micro-Commas" desc="Below threshold; candidates for simplification." list={sets.ignoreTop} />
      </div>
      <p className="text-xs text-gray-500 mt-2">Additive only.</p>
    </section>
  );
}
