import React, { useMemo, useState } from "react";
import { useStore } from "@/store";
import { readWindowState } from "./toolState";

function downloadJSON(filename: string, data: any){
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  } catch {}
}

export default function ExportToolsPanel(){
  const nodes = useStore((s) => s.nodes);
  const [filenameBase, setFilenameBase] = useState("comma-jnd");
  const overlay = (window as any).__perceptualSimplification || {};
  const st = readWindowState();

  const summary = useMemo(()=>{
    const hidden = overlay?.hiddenIds || [];
    const reps = overlay?.repIds || [];
    const focus = overlay?.focusIds || [];
    const clusters = overlay?.clusters || {};
    return {
      enabled: !!overlay?.enabled,
      mode: overlay?.mode || "ghost",
      counts: {
        totalNodes: nodes?.length || 0,
        hidden: hidden.length,
        representatives: reps.length,
        clusters: Object.keys(clusters).length,
        focus: focus.length
      },
      jnd: overlay?.meta || {},
    };
  }, [overlay, nodes]);

  function exportMask(){
    const payload = {
      kind: "PerceptualSimplificationMaskV1",
      createdAt: Date.now(),
      toolState: st,
      overlay: {
        enabled: overlay?.enabled || false,
        mode: overlay?.mode || "ghost",
        hiddenIds: overlay?.hiddenIds || [],
        repIds: overlay?.repIds || [],
        clusters: overlay?.clusters || {},
        meta: overlay?.meta || {},
        focusIds: overlay?.focusIds || []
      },
      summary
    };
    downloadJSON(`${filenameBase}-mask.json`, payload);
  }

  function exportProfiles(){
    try {
      const key = "CommaJNDToolProfilesV1";
      const raw = localStorage.getItem(key);
      const payload = { kind: "CommaJNDProfilesV1", createdAt: Date.now(), raw: raw ? JSON.parse(raw) : [] };
      downloadJSON(`${filenameBase}-profiles.json`, payload);
    } catch {}
  }

  function exportRemediationSeed(){
    const payload = {
      kind: "EarTrainingRemediationSeedV1",
      createdAt: Date.now(),
      seedHint: `${st.comma.primes.join("-")}|c${st.comma.centsMax}|r${st.comma.radiusMax}|e${st.comma.emax}|j${st.comma.useJND?1:0}|k${st.comma.jndFactor}`,
      commaFilters: st.comma,
      suggestion: {
        focus: "borderline commas near JND",
        targetCount: 30,
        note: "This JSON is a reproducible configuration hint. Apply manually to Ear Training target lists if desired."
      }
    };
    downloadJSON(`${filenameBase}-remediation-seed.json`, payload);
  }

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Export & Reproducibility</h2>
      <p className="text-sm text-gray-400 mb-3">
        Export simplification masks and profiles so your perceptual calibration work stays reproducible and reversible.
        Exports do not alter the lattice or your main saved state.
      </p>

      <div className="border rounded p-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">Filename base</span>
          <input className="input" value={filenameBase} onChange={e=>setFilenameBase(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <button className="btn" onClick={exportMask}>Export Simplification Mask (JSON)</button>
          <button className="btn" onClick={exportProfiles}>Export Tool Profiles (JSON)</button>
          <button className="btn" onClick={exportRemediationSeed}>Export Remediation Seed (JSON)</button>
        </div>

        <div className="mt-3 text-sm">
          <div>Overlay enabled: <b>{String(summary.enabled)}</b> · mode: <b>{summary.mode}</b></div>
          <div>Total nodes: <b>{summary.counts.totalNodes}</b> · hidden: <b>{summary.counts.hidden}</b> · reps: <b>{summary.counts.representatives}</b></div>
          <div>Clusters: <b>{summary.counts.clusters}</b> · focus: <b>{summary.counts.focus}</b></div>
        </div>

        <p className="text-xs text-gray-500 mt-2">Exported JSON is meant for reproducibility and regression testing.</p>
      </div>
    </section>
  );
}
