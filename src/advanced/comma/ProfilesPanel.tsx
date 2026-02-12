import React, { useEffect, useMemo, useState } from "react";
import { ensureProfiles, loadActiveName, saveActiveName, loadProfiles, upsertProfile, deleteProfile, readWindowState, writeWindowState, getOrCreateDefaultProfile, ToolProfile } from "./toolState";

export default function ProfilesPanel(){
  const [profiles, setProfiles] = useState<ToolProfile[]>(()=> ensureProfiles());
  const [active, setActive] = useState<string>(()=> loadActiveName() || "Default");
  const [newName, setNewName] = useState("");

  useEffect(()=>{ setProfiles(loadProfiles()); }, []);
  useEffect(()=>{ saveActiveName(active); }, [active]);

  const current = useMemo(()=> profiles.find(p=>p.name===active) || getOrCreateDefaultProfile(), [profiles, active]);

  function refresh(){ setProfiles(loadProfiles()); }

  function applyProfile(name: string){
    const ps = loadProfiles();
    const p = ps.find(x=>x.name===name);
    if (!p) return;
    writeWindowState({ comma: p.comma, simplify: p.simplify });
    setActive(name);
    refresh();
  }

  function saveCurrent(){
    const st = readWindowState();
    const now = Date.now();
    const p: ToolProfile = { ...current, name: active, updatedAt: now, comma: st.comma, simplify: st.simplify };
    upsertProfile(p);
    refresh();
  }

  function createProfile(){
    const name = newName.trim();
    if (!name) return;
    const st = readWindowState();
    const now = Date.now();
    upsertProfile({ name, createdAt: now, updatedAt: now, comma: st.comma, simplify: st.simplify });
    setNewName("");
    setActive(name);
    refresh();
  }

  function removeProfile(name: string){
    if (name==="Default") return;
    deleteProfile(name);
    setActive(loadActiveName() || "Default");
    refresh();
  }

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Simplification Profiles</h2>
      <p className="text-sm text-gray-400 mb-2">
        Profiles save Comma Search + Simplify settings. Stored locally. Applying a profile updates the overlay tool state.
      </p>

      <div className="border rounded p-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm">Active:</span>
          <select className="input" value={active} onChange={e=>applyProfile(e.target.value)}>
            {profiles.map(p=>(<option key={p.name} value={p.name}>{p.name}</option>))}
          </select>
          <button className="btn btn-xs" onClick={saveCurrent}>Save current</button>
          <button className="btn btn-xs" onClick={refresh}>Refresh</button>

          <div className="flex gap-2 items-center ml-auto">
            <input className="input" placeholder="New profile name" value={newName} onChange={e=>setNewName(e.target.value)} />
            <button className="btn btn-xs" onClick={createProfile}>Create</button>
          </div>
        </div>

        <div className="mt-3">
          <div className="max-h-56 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/30">
                <tr><th className="p-2 text-left">name</th><th className="p-2 text-left">updated</th><th className="p-2">actions</th></tr>
              </thead>
              <tbody>
                {profiles.map(p=>(
                  <tr key={p.name} className="border-t border-white/5">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{new Date(p.updatedAt).toLocaleString()}</td>
                    <td className="p-2 text-center">
                      <button className="btn btn-xs mr-2" onClick={()=>applyProfile(p.name)}>Apply</button>
                      <button className="btn btn-xs" onClick={()=>removeProfile(p.name)} disabled={p.name==="Default"}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">Additive only. Default profile is always available.</p>
      </div>
    </section>
  );
}
