
import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store";
import { shallow } from 'zustand/shallow';
import { getFrequency } from "@/musicLogic";
import { deriveJND, jndForFreq } from "./jndModel";
import { readWindowState, writeWindowState } from "./toolState";

type Mode = "ghost" | "prune" | "collapse";

function absCents(n: any){ return (n?.cents ?? 0) + (n?.octave ?? 0) * 1200; }

function buildClusterMap(sortedNodes: any[], getThresh: (n:any)=>number){
  
  const map: Record<string, string[]> = {};
  let rep: any = null;
  let repAbs = 0;
  let repThresh = 0;

  for (const n of sortedNodes){
    const a = absCents(n);
    const t = getThresh(n);
    if (!rep){
      rep = n; repAbs = a; repThresh = t;
      map[n.id] = [n.id];
      continue;
    }
    const diff = Math.abs(a - repAbs);
    const gate = Math.min(repThresh, t);
    if (diff < gate){
      if (!map[rep.id]) map[rep.id] = [rep.id];
      map[rep.id].push(n.id);
    } else {
      rep = n; repAbs = a; repThresh = t;
      map[n.id] = [n.id];
    }
  }
  return map;
}

export default function SimplificationPanel(){
  const _st = readWindowState();
  const {
    nodes,
    settings
  } = useStore((s) => ({
    nodes: s.nodes,
    settings: s.settings
  }), shallow);
  const [enabled, setEnabled] = useState(_st.simplify.enabled);
  const [mode, setMode] = useState<Mode>(_st.simplify.mode as Mode);
  const [useEar, setUseEar] = useState(_st.simplify.useEar);
  const [usePerNodeFreq, setUsePerNodeFreq] = useState(_st.simplify.usePerNodeFreq);
  const [refHz, setRefHz] = useState(_st.simplify.refHz);
  const [factor, setFactor] = useState(_st.simplify.factor);

React.useEffect(()=>{
  try {
    writeWindowState({ comma: readWindowState().comma, simplify: { enabled, mode, useEar, usePerNodeFreq, refHz, factor } });
  } catch {}
}, [enabled, mode, useEar, usePerNodeFreq, refHz, factor]);

const jndModel = useMemo(()=> useEar ? deriveJND() : { bins: [], method: "manual", updatedAt: Date.now() }, [useEar]);

  const clustering = useMemo(()=>{
    if (!enabled || !nodes?.length) return { reps: new Set<string>(), hidden: new Set<string>(), clusters: 0, avgThresh: 0 };
    
    const sorted = [...nodes].sort((a:any,b:any)=> absCents(a) - absCents(b));
    const reps = new Set<string>();
    const hidden = new Set<string>();
    let clusters = 0;
    let threshSum = 0;
    let threshCount = 0;

    let rep: any = null;
    let repAbs = 0;
    let repThresh = 0;

    const getThresh = (node:any): number => {
      const hz = usePerNodeFreq ? (()=>{ try { return getFrequency(settings.baseFrequency, node.ratio); } catch { return refHz; } })() : refHz;
      const base = useEar ? jndForFreq(jndModel as any, hz) : 10;
      return Math.max(1, Math.min(100, base * factor));
    };

    for (const n of sorted){
      const a = absCents(n);
      const t = getThresh(n);
      threshSum += t; threshCount++;
      if (!rep){
        rep = n; repAbs = a; repThresh = t;
        reps.add(n.id);
        clusters++;
        continue;
      }
      const diff = Math.abs(a - repAbs);
      const gate = Math.min(repThresh, t);
      if (diff < gate){
        
        hidden.add(n.id);
        
      } else {
        rep = n; repAbs = a; repThresh = t;
        reps.add(n.id);
        clusters++;
      }
    }

    return { reps, hidden, clusters, avgThresh: threshCount ? (threshSum / threshCount) : 0, clusterMap: buildClusterMap(sorted, getThresh) };
  }, [enabled, nodes, settings, useEar, usePerNodeFreq, refHz, factor, jndModel]);

  useEffect(()=>{
    const payload = {
      focusIds: ((window as any).__perceptualSimplification?.focusIds) || [],
      enabled,
      mode,
      hiddenIds: Array.from(clustering.hidden),
      repIds: Array.from(clustering.reps),
      meta: { useEar, usePerNodeFreq, refHz, factor, method: (jndModel as any).method, clusters: clustering.clusters }
    };
    (window as any).__perceptualSimplification = payload;
  }, [enabled, mode, clustering, useEar, usePerNodeFreq, refHz, factor, jndModel]);

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Perceptual Simplification (JND Overlay)</h2>

      <div className="border rounded p-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} onChange={()=>setEnabled(!enabled)} />
          <span>Enable simplification overlay</span>
        </label>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Mode</label>
            <select className="input" value={mode} onChange={e=>setMode(e.target.value as Mode)}>
              <option value="ghost">Ghost (dim & shrink near-equivalent)</option>
              <option value="prune">Prune (nearly hide near-equivalent)</option>
              <option value="collapse">Collapse (representatives only)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Phase 2: representative clustering is active. Ghost/Prune/Collapse control how hidden nodes are rendered.
            </p>
          </div>

          <div>
            <label className="block text-sm mb-1">JND source</label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useEar} onChange={()=>setUseEar(!useEar)} />
              <span>Use Ear Training-derived JND</span>
            </label>
            <div className="text-xs text-gray-500 mt-1">Model: {(jndModel as any).method || "manual"}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={usePerNodeFreq} onChange={()=>setUsePerNodeFreq(!usePerNodeFreq)} />
              <span>Register-aware threshold (per-node frequency)</span>
            </label>
            {!usePerNodeFreq && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">Reference Hz</span>
                <input className="input w-24" value={refHz} onChange={e=>setRefHz(Math.max(20, Math.min(20000, +e.target.value || 440)))} />
                <span className="text-xs text-gray-400">20–20000 Hz clamped</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm">JND factor × {factor.toFixed(2)}</label>
            <input type="range" min={0.5} max={2.0} step={0.05} value={factor} onChange={e=>setFactor(+e.target.value)} />
            <div className="text-xs text-gray-500 mt-1">Average gate ≈ {clustering.avgThresh.toFixed(1)} cents</div>
          </div>
        </div>

        <div className="mt-3 text-sm">
          <div>Clusters: <b>{enabled ? clustering.clusters : 0}</b></div>
          <div>Hidden nodes: <b>{enabled ? clustering.hidden.size : 0}</b></div>
          <div>Representatives: <b>{enabled ? clustering.reps.size : 0}</b></div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          This overlay does not delete data. It changes rendering only by dimming/shrinking/hiding near-equivalent nodes,
          based on a JND gate that can vary by register.
        </p>
      </div>
    </section>
  );
}
