
import React, { useMemo, useState } from "react";
import blocks from "@/src/data/unicode_blocks.txt?raw";

type Block = { name: string; start: number; end: number; desc: string };

function parseBlocks(): Block[] {
  return blocks.split("\n").filter(l => l && !l.startsWith("#")).map(line => {
    const [name, s, e, desc] = line.split("|");
    return { name, start: parseInt(s,16), end: parseInt(e,16), desc };
  });
}

export default function UnicodePicker({ onSelect }: { onSelect: (ch: string)=>void }) {
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(1024);
  const data = useMemo(parseBlocks, []);

  const chars = useMemo(() => {
    const res: string[] = [];
    for (const b of data) {
      for (let cp=b.start; cp<=b.end; cp++) {
        const ch = String.fromCodePoint(cp);
        if (!q || ch.includes(q)) res.push(ch);
        if (res.length >= limit) return res;
      }
    }
    return res;
  }, [data, q, limit]);

  return (
    <div className="border rounded p-2">
      <div className="flex gap-2 mb-2">
        <input className="input" placeholder="Search Unicode…" value={q} onChange={e=>setQ(e.target.value)} />
        <select value={limit} onChange={e=>setLimit(+e.target.value)}>
          <option value={256}>256</option>
          <option value={1024}>1024</option>
          <option value={4096}>4096</option>
        </select>
      </div>
      <div className="grid grid-cols-12 gap-1 max-h-64 overflow-auto">
        {chars.map((ch,i)=>(
          <button key={i} className="btn btn-xs" title={`U+${ch.codePointAt(0)?.toString(16).toUpperCase()}`} onClick={()=>onSelect(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">Display-limited for performance. Search refines results.</p>
    </div>
  );
}
