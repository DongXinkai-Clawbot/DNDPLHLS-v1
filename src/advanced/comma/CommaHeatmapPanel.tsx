import React, { useMemo } from "react";
import { generateCommas } from "./generate";
import { deriveJND, jndForFreq } from "./jndModel";
import { readWindowState } from "./toolState";

function statusFor(centsAbs: number, thr: number){
  if (centsAbs >= thr) return "audible";
  if (centsAbs >= 0.7*thr) return "borderline";
  return "inaudible";
}

export default function CommaHeatmapPanel(){
  const st = readWindowState();
  const comma = st.comma;

  const model = deriveJND();
  const bins = model.bins;

  const commas = useMemo(()=> generateCommas({
    primes: comma.primes,
    centsMax: Math.max(comma.centsMax, 60),
    radiusMax: comma.radiusMax,
    emax: comma.emax,
    limit: 400
  }), [comma.primes, comma.centsMax, comma.radiusMax, comma.emax]);

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Comma Heatmap (Register × Audibility)</h2>
      <p className="text-sm text-gray-400 mb-2">
        Rows are near-center commas. Columns are register bins derived from Ear Training data.
        Cells indicate whether each comma is audible / borderline / inaudible at that register (JND gate).
      </p>

      <div className="overflow-auto border rounded">
        <table className="text-xs w-full">
          <thead className="sticky top-0 bg-black/40">
            <tr>
              <th className="p-2 text-left">comma (cents)</th>
              {bins.map((b,i)=>(
                <th key={i} className="p-2 text-center">
                  {Math.round(b.loHz)}–{Math.round(b.hiHz)} Hz
                  <br/><span className="text-[10px] text-gray-500">JND {b.jndCents.toFixed(1)}c</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {commas.map((c,ri)=>{
              const abs = Math.abs(c.cents);
              return (
                <tr key={ri} className="border-t border-white/5">
                  <td className="p-2 whitespace-nowrap">{c.cents.toFixed(3)}c</td>
                  {bins.map((b,ci)=>{
                    const thr = jndForFreq(model, (b.loHz+b.hiHz)/2);
                    const s = statusFor(abs, thr);
                    const cls = s==="audible" ? "bg-green-700/60" : (s==="borderline" ? "bg-yellow-700/50" : "bg-gray-700/40");
                    return (
                      <td key={ci} className={"p-2 text-center "+cls}>
                        {s==="audible" ? "✓" : (s==="borderline" ? "≈" : "·")}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-2">Informational overlay only. No lattice geometry changes.</p>
    </section>
  );
}
