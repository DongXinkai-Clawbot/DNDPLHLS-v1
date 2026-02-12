
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import CommaSearchPanel from "./CommaSearchPanel";
import SimplificationPanel from "./SimplificationPanel";
import CommaHeatmapPanel from "./CommaHeatmapPanel";
import CuratedCommaSetsPanel from "./CuratedCommaSetsPanel";
import ProfilesPanel from "./ProfilesPanel";
import ClusterInspectorPanel from "./ClusterInspectorPanel";
import ExportToolsPanel from "./ExportToolsPanel";

function Launcher(){
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'comma'|'simplify'|'heatmap'|'sets'|'profiles'|'inspect'|'export'>('comma');
  return (
    <div className="fixed right-4 bottom-4 z-50">
      {!open && <button className="px-3 py-1 rounded bg-emerald-600" onClick={()=>setOpen(true)}>Comma Search</button>}
      {open && (
        <div className="w-[880px] max-w-[95vw] max-h-[85vh] overflow-auto rounded-xl shadow-2xl border border-white/10 bg-black/85 p-2 backdrop-blur">
          <div className="flex justify-between items-center px-2 py-1">
            <h3 className="font-semibold">Advanced · Comma & Perceptual Tools</h3>
            <div className="flex gap-2">
              <button className="btn btn-xs" onClick={()=>setTab('comma')}>Comma Search</button>
              <button className="btn btn-xs" onClick={()=>setTab('simplify')}>Simplify</button>
              <button className="btn btn-xs" onClick={()=>setTab('heatmap')}>Heatmap</button>
              <button className="btn btn-xs" onClick={()=>setTab('sets')}>Curated Sets</button>
              <button className="btn btn-xs" onClick={()=>setTab('profiles')}>Profiles</button>
              <button className="btn btn-xs" onClick={()=>setTab('inspect')}>Inspector</button>
              <button className="btn btn-xs" onClick={()=>setTab('export')}>Export</button>
            </div>
            <button className="btn btn-xs" onClick={()=>setOpen(false)}>Close</button>
          </div>
          {tab==='comma' ? <CommaSearchPanel /> : tab==='simplify' ? <SimplificationPanel /> : tab==='heatmap' ? <CommaHeatmapPanel /> : tab==='sets' ? <CuratedCommaSetsPanel /> : tab==='profiles' ? <ProfilesPanel /> : tab==='inspect' ? <ClusterInspectorPanel /> : <ExportToolsPanel />}
        </div>
      )}
    </div>
  );
}

function tryMount(){
  const hosts = ["#advanced-root","#advanced-tools","#advanced-ear-training","[data-advanced-root]","body"];
  for (const sel of hosts){
    const host = document.querySelector(sel);
    if (host){
      const mount = document.createElement("div");
      host.appendChild(mount);
      const root = createRoot(mount);
      root.render(<Launcher />);
      return true;
    }
  }
  return false;
}

if (typeof window!=="undefined"){
  window.addEventListener("load", ()=>{ try { tryMount(); } catch {} });
}
