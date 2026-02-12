
import React, { useMemo, useState, useEffect } from "react";
import { generateCommas } from "./generate";
import { readWindowState, writeWindowState } from "./toolState";
import { deriveJND, jndForFreq, JNDModel } from "./jndModel";

const DEFAULT_PRIMES = [2,3,5,7,11];
const MAX_RESULTS = 1500;

function useJndModelHook(): JNDModel {
  const [m, setM] = useState<JNDModel>(()=>deriveJND());
  useEffect(()=>{ try { setM(deriveJND()); } catch {} },[]);
  return m;
}

export default function CommaSearchPanel(){
  const _st = readWindowState();
  const [centsMax, setCentsMax] = useState(_st.comma.centsMax);
  const [radiusMax, setRadiusMax] = useState(_st.comma.radiusMax);
  const [emax, setEmax] = useState(_st.comma.emax);
  const [showAll, setShowAll] = useState(_st.comma.showAll);
  const [useJND, setUseJND] = useState(_st.comma.useJND);
  const [jndFactor, setJndFactor] = useState(_st.comma.jndFactor);
  const [refHz, setRefHz] = useState(_st.comma.refHz);
  const [primes, setPrimes] = useState<number[]>(_st.comma.primes);

React.useEffect(()=>{
  try {
    writeWindowState({ comma: { centsMax, radiusMax, emax, showAll, useJND, jndFactor, refHz, primes }, simplify: readWindowState().simplify });
  } catch {}
}, [centsMax, radiusMax, emax, showAll, useJND, jndFactor, refHz, primes]);

const jndModel = useJndModelHook();

  const data = useMemo(()=> generateCommas({ primes, centsMax, radiusMax, emax, limit: MAX_RESULTS }), [primes, centsMax, radiusMax, emax]);
  const jnd = useMemo(()=> jndForFreq(jndModel, refHz) * jndFactor, [jndModel, refHz, jndFactor]);

  const filtered = useMemo(()=> (!useJND || showAll) ? data : data.filter(d=> Math.abs(d.cents) >= jnd), [data, useJND, jnd, showAll]);

  function previewComma(cents: number){
    try { (window as any).app?.previewIntervalCents?.(cents, refHz); } catch {}
  }
  function addToEarTraining(cents: number){
    try { (window as any).app?.earPart2?.addTargetCommaCents?.(cents); } catch {}
  }

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Comma Search (Near-Center, Controlled)</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded p-2">
          <h3 className="font-medium mb-2">Filters</h3>
          <label className="block text-sm">Max |cents|: {centsMax}c</label>
          <input type="range" min={5} max={120} value={centsMax} onChange={e=>setCentsMax(+e.target.value)} />
          <label className="block text-sm mt-2">Structural radius Σ|eᵢ| ≤ {radiusMax}</label>
          <input type="range" min={2} max={16} value={radiusMax} onChange={e=>setRadiusMax(+e.target.value)} />
          <label className="block text-sm mt-2">Per-prime |exponent| ≤ {emax}</label>
          <input type="range" min={2} max={12} value={emax} onChange={e=>setEmax(+e.target.value)} />
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={showAll} onChange={()=>setShowAll(!showAll)} />
            <span>Show all (out-of-range greyed)</span>
          </label>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-medium mb-2">Perceptual (JND)</h3>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useJND} onChange={()=>setUseJND(!useJND)} />
            <span>Use JND-based audibility filter</span>
          </label>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm">Reference Hz</span>
            <input className="input w-24" value={refHz} onChange={e=>setRefHz(Math.max(20, Math.min(20000, +e.target.value || 440)))} />
            <span className="text-xs text-gray-400">20–20000 Hz clamped</span>
          </div>
          <div className="mt-2">
            <label className="block text-sm">JND factor × {jndFactor.toFixed(2)} (model {jndModel.method})</label>
            <input type="range" min={0.5} max={2.0} step={0.05} value={jndFactor} onChange={e=>setJndFactor(+e.target.value)} />
            <div className="text-xs text-gray-500 mt-1">Effective threshold ≈ {jnd.toFixed(1)} cents @ {refHz} Hz</div>
          </div>
        </div>
      </div>

      <div className="mt-3 border rounded">
        <div className="flex justify-between items-center p-2">
          <h3 className="font-medium">Results ({filtered.length}/{data.length})</h3>
          <div className="text-xs text-gray-500">Sorted by |cents| → radius → prime count</div>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-black/30">
              <tr>
                <th className="text-left p-2">cents</th>
                <th className="text-left p-2">vector (prime^exp)</th>
                <th className="text-left p-2">Σ|eᵢ|</th>
                <th className="text-left p-2">#primes</th>
                <th className="text-left p-2">audible</th>
                <th className="text-left p-2">actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx)=>{
                const inaudible = useJND && Math.abs(row.cents) < jnd;
                if (!showAll && inaudible) return null;
                return (
                  <tr key={idx} className={inaudible ? "opacity-50" : ""}>
                    <td className="p-2">{row.cents.toFixed(3)}</td>
                    <td className="p-2">{Object.entries(row.vec).map(([p,e])=> `${p}^${e}`).join(" · ")}</td>
                    <td className="p-2">{row.radius}</td>
                    <td className="p-2">{row.primeCount}</td>
                    <td className="p-2"><span className={"px-2 py-0.5 rounded "+(inaudible? "bg-gray-600":"bg-green-600")}>{inaudible? "no":"yes"}</span></td>
                    <td className="p-2 flex gap-2">
                      <button className="btn btn-xs" onClick={()=>previewComma(row.cents)}>Preview</button>
                      <button className="btn btn-xs" onClick={()=>addToEarTraining(row.cents)}>Add to Training</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Additive feature. Lattice geometry is unchanged; this is a perceptual overlay & search tool.
      </p>
    </section>
  );
}
