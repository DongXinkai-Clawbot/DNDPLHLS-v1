
import React, { useMemo, useState } from 'react';
import { MATH_FUNCTION_PRESETS } from '../../../utils/mathPresets';
import type { MathFunctionPreset } from '../../../types';
import { sampleObject } from '../../../utils/mathLabUtils';

interface Props {
  onSelect: (preset: MathFunctionPreset) => void;
}

const chipBase = 'text-[10px] px-2 py-0.5 rounded border';
const chipOn = chipBase + ' bg-blue-700 border-blue-600 text-white';
const chipOff = chipBase + ' bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800';

const PreviewThumb = ({ preset }: { preset: MathFunctionPreset }) => {
  const { path, isValid } = useMemo(() => {
    try {
      
      const view = preset.suggestedView;
      const obj: any = {
        id: preset.id,
        type: preset.type,
        expression: preset.expression,
        params: preset.params,
        visible: true
      };
      
      const res = sampleObject(obj, 128, view);
      const points = res?.points || [];
      const segments = res?.segments;
      if ((!points || points.length < 2) && (!segments || segments.length === 0)) return { path: '', isValid: false };

      const w = 96, h = 48;
      
      const padX = (view.xMax - view.xMin) * 0.1;
      const padY = (view.yMax - view.yMin) * 0.1;
      const xMin = view.xMin - padX, xMax = view.xMax + padX;
      const yMin = view.yMin - padY, yMax = view.yMax + padY;

      const toX = (x: number) => ((x - xMin) / (xMax - xMin || 1)) * w;
      const toY = (y: number) => h - ((y - yMin) / (yMax - yMin || 1)) * h;

      let d = "";
      let penDown = false;
      let validPoints = 0;

      if (segments && segments.length > 0) {
          segments.forEach(seg => {
              penDown = false;
              seg.forEach(p => {
                  if (!p.valid || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
                      penDown = false;
                      return;
                  }
                  const sx = toX(p.x);
                  const sy = toY(p.y);
                  const csx = Math.max(-10, Math.min(w + 10, sx));
                  const csy = Math.max(-10, Math.min(h + 10, sy));
                  if (!penDown) {
                      d += `M ${csx.toFixed(1)} ${csy.toFixed(1)} `;
                      penDown = true;
                  } else {
                      d += `L ${csx.toFixed(1)} ${csy.toFixed(1)} `;
                  }
                  validPoints++;
              });
          });
      } else {
          for (let i = 0; i < points.length; i++) {
              const p = points[i];
              if (!p.valid || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
                  penDown = false;
                  continue;
              }
              
              if (penDown) {
                  const prev = points[i-1];
                  const dy = Math.abs(p.y - prev.y);
                  const viewH = view.yMax - view.yMin;
                  if (dy > viewH * 0.8) { 
                      penDown = false; 
                  }
              }

              const sx = toX(p.x);
              const sy = toY(p.y);
              
              const csx = Math.max(-10, Math.min(w + 10, sx));
              const csy = Math.max(-10, Math.min(h + 10, sy));

              if (!penDown) {
                  d += `M ${csx.toFixed(1)} ${csy.toFixed(1)} `;
                  penDown = true;
              } else {
                  d += `L ${csx.toFixed(1)} ${csy.toFixed(1)} `;
              }
              validPoints++;
          }
      }

      return { path: d, isValid: validPoints > 1 };
    } catch (e) {
      return { path: '', isValid: false };
    }
  }, [preset]);

  return (
    <div className="w-24 h-12 bg-black border border-gray-700 rounded flex items-center justify-center overflow-hidden relative">
      {isValid ? (
          <svg width="100%" height="100%" viewBox="0 0 96 48" preserveAspectRatio="none">
            <path d={path} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
          </svg>
      ) : (
          <span className="text-[9px] text-gray-600 font-mono">No Preview</span>
      )}
      <span className="absolute bottom-0 right-0 text-[8px] bg-black/60 text-gray-400 px-1">{preset.type.slice(0,3)}</span>
    </div>
  );
};

export const FunctionGallery = ({ onSelect }: Props) => {
  const [cat, setCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(20);
  const [tag, setTag] = useState<string>('All');

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of MATH_FUNCTION_PRESETS as any[]) s.add(String(p.category));
    return ['All', ...Array.from(s).sort()];
  }, []);

  const tags = useMemo(() => {
    const s = new Set<string>();
    for (const p of MATH_FUNCTION_PRESETS as any[]) {
      const ts = (p.tags || []) as string[];
      for (const t of ts) s.add(t);
    }
    return ['All', ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (MATH_FUNCTION_PRESETS as MathFunctionPreset[]).filter((p) => {
      if (cat !== 'All' && p.category !== (cat as any)) return false;
      if (tag !== 'All' && !(p.tags || []).includes(tag)) return false;
      if (!q) return true;
      const hay = `${p.name} ${p.expression} ${(p.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cat, search, tag]);

  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800 w-64 shrink-0">
      <div className="p-2 border-b border-gray-800 space-y-2">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Function Library</h4>
        <input
          className="w-full px-2 py-1 text-xs bg-black border border-gray-700 rounded text-gray-100 outline-none focus:border-blue-500"
          placeholder="Search..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setLimit(20); }}
        />
        <div className="flex gap-2">
            <select
              className="flex-1 px-1 py-1 text-[10px] bg-black border border-gray-700 rounded text-gray-300 outline-none"
              value={cat}
              onChange={(e) => { setCat(e.target.value); setLimit(20); }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="flex-1 px-1 py-1 text-[10px] bg-black border border-gray-700 rounded text-gray-300 outline-none"
              value={tag}
              onChange={(e) => { setTag(e.target.value); setLimit(20); }}
            >
              {tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {visible.map((p) => (
          <button
            key={p.id}
            className="w-full flex gap-2 items-start p-2 rounded border border-gray-800 bg-gray-900/50 hover:bg-gray-800 hover:border-gray-600 text-left transition-all group"
            onClick={() => onSelect(p)}
          >
            <PreviewThumb preset={p} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-200 truncate group-hover:text-blue-300">{p.name}</div>
              <div className="text-[9px] text-gray-500 truncate font-mono mt-0.5">{p.expression}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(p.tags || []).slice(0, 3).map(t => (
                  <span key={t} className="text-[8px] px-1 rounded bg-black border border-gray-800 text-gray-500">{t}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
        {limit < filtered.length && (
            <button className="w-full py-2 text-[10px] text-gray-400 bg-gray-900 rounded hover:text-white" onClick={() => setLimit(l => l + 20)}>
                Show More ({filtered.length - limit})
            </button>
        )}
      </div>
    </div>
  );
};
