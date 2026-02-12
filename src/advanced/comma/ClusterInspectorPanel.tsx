import React, { useMemo, useState } from "react";
import { useStore } from "@/store";

function absCents(n: any){ return (n?.cents ?? 0) + (n?.octave ?? 0) * 1200; }

export default function ClusterInspectorPanel(){
  const nodes = useStore((s) => s.nodes);
  const [query, setQuery] = useState("");
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  const overlay = (window as any).__perceptualSimplification || {};
  const clusters: Record<string, string[]> = overlay?.clusters || {};
  const enabled = !!overlay?.enabled;

  const nodeById = useMemo(()=>{
    const m = new Map<string, any>();
    for (const n of (nodes||[])) m.set(n.id, n);
    return m;
  }, [nodes]);

  const rows = useMemo(()=>{
    const list = Object.entries(clusters).map(([repId, memberIds])=>{
      const rep = nodeById.get(repId);
      const repC = rep ? absCents(rep) : 0;
      return { repId, repCents: repC, size: memberIds.length, members: memberIds };
    }).sort((a,b)=> Math.abs(a.repCents)-Math.abs(b.repCents));
    const q = query.trim();
    if (!q) return list;
    return list.filter(r=>{
      if (r.repId.includes(q)) return true;
      if (String(r.size).includes(q)) return true;
      if (String(r.repCents.toFixed(2)).includes(q)) return true;
      return false;
    });
  }, [clusters, nodeById, query]);

  const selected = selectedRep ? rows.find(r=>r.repId===selectedRep) : null;

  function focusCluster(repId: string){
    try {
      const ids = clusters[repId] || [repId];
      (window as any).__perceptualSimplification = {
        ...(window as any).__perceptualSimplification,
        focusIds: ids
      };
      setSelectedRep(repId);
    } catch {}
  }

  function clearFocus(){
    try {
      (window as any).__perceptualSimplification = {
        ...(window as any).__perceptualSimplification,
        focusIds: []
      };
    } catch {}
    setSelectedRep(null);
  }

  return (
    <section className="p-3">
      <h2 className="text-xl font-semibold mb-2">Cluster Inspector</h2>
      <p className="text-sm text-gray-400 mb-2">
        Inspect which nodes were treated as perceptually equivalent under the current JND gate.
        This is an additive overlay tool — it never deletes nodes.
      </p>

      {!enabled && (
        <div className="border rounded p-2 text-sm text-yellow-200/90 bg-yellow-900/20">
          Simplification overlay is currently disabled. Enable it in the <b>Simplify</b> tab to generate clusters.
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="border rounded p-2">
          <div className="flex items-center gap-2 mb-2">
            <input className="input flex-1" placeholder="Search (rep id / cents / size)" value={query} onChange={e=>setQuery(e.target.value)} />
            <button className="btn btn-xs" onClick={clearFocus}>Clear focus</button>
          </div>

          <div className="max-h-80 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-black/30">
                <tr>
                  <th className="p-2 text-left">rep cents</th>
                  <th className="p-2 text-left">cluster size</th>
                  <th className="p-2 text-left">rep id</th>
                  <th className="p-2">focus</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.repId} className={"border-t border-white/5 " + (selectedRep===r.repId ? "bg-white/5" : "")}>
                    <td className="p-2">{r.repCents.toFixed(3)}</td>
                    <td className="p-2">{r.size}</td>
                    <td className="p-2 font-mono text-xs">{r.repId}</td>
                    <td className="p-2 text-center">
                      <button className="btn btn-xs" onClick={()=>focusCluster(r.repId)}>Focus</button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td className="p-3 text-sm text-gray-500" colSpan={4}>No clusters available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-medium mb-2">Selected Cluster</h3>
          {!selected && (
            <div className="text-sm text-gray-500">Pick a cluster from the left table to inspect its members.</div>
          )}

          {selected && (
            <>
              <div className="text-sm mb-2">
                Representative: <span className="font-mono text-xs">{selected.repId}</span> · {selected.repCents.toFixed(3)}c · members {selected.size}
              </div>

              <div className="max-h-80 overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-black/30">
                    <tr><th className="p-2 text-left">member cents</th><th className="p-2 text-left">id</th></tr>
                  </thead>
                  <tbody>
                    {selected.members.map((id)=> {
                      const n = nodeById.get(id);
                      const c = n ? absCents(n) : 0;
                      return (
                        <tr key={id} className="border-t border-white/5">
                          <td className="p-2">{c.toFixed(3)}</td>
                          <td className="p-2 font-mono text-xs">{id}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Tip: Focus highlights members on the lattice (Phase 4 overlay highlight).
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
