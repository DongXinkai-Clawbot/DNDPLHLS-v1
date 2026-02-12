import React from 'react';
import type { SolverOutput } from '../../../../utils/temperamentSolver';
import { NOTE_NAMES } from './constants';
import type { AdvancedIntervalItem, TargetItem } from './types';
import { centsFromRatio, clamp } from './utils';

type EnlargedChartModalProps = {
  enlargedChart: 'radar' | 'heatmap' | null;
  onClose: () => void;
  result: SolverOutput | null;
  advancedModeEnabled: boolean;
  advancedIntervals: AdvancedIntervalItem[];
  targetsRaw: TargetItem[];
  targetState: Record<string, boolean>;
  individualTolerances: Record<string, number>;
  globalTol: number;
};

export const EnlargedChartModal: React.FC<EnlargedChartModalProps> = ({
  enlargedChart,
  onClose,
  result,
  advancedModeEnabled,
  advancedIntervals,
  targetsRaw,
  targetState,
  individualTolerances,
  globalTol
}) => {
  if (!enlargedChart) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-indigo-500/50 rounded-2xl p-4 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-black uppercase tracking-widest text-indigo-300">
            {enlargedChart === 'radar' ? 'Deviance Radar (vs ET)' : 'Interval Quality Heatmap'}
          </div>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-red-600 text-white rounded-lg px-3 py-1 text-[10px] font-bold"
          >
            ✖Close
          </button>
        </div>
        <div className="bg-black rounded-xl p-3 min-h-[500px] flex items-center justify-center">
          <canvas
            ref={(el) => {
              if (!el || !result) return;
              const ctx = el.getContext('2d');
              if (!ctx) return;

              const w = 800;
              const h = 600;
              el.width = w;
              el.height = h;
              el.style.width = '100%';
              el.style.maxHeight = '70vh';

              ctx.clearRect(0, 0, w, h);

              if (enlargedChart === 'radar') {
                // Draw enlarged radar
                const cx = w / 2;
                const cy = h / 2;
                const radius = Math.min(w, h) * 0.35;
                const O = result.input.cycleCents;
                const Nn = result.input.scaleSize;
                const maxDev = 50;
                const deviationScale = radius * 0.4;

                // Calibration circles
                [10, 25, 50].forEach(level => {
                  const rPlus = radius + (level / maxDev) * deviationScale;
                  const rMinus = radius - (level / maxDev) * deviationScale;
                  ctx.strokeStyle = 'rgba(80, 160, 255, 0.25)';
                  ctx.lineWidth = 1;
                  ctx.setLineDash([3, 6]);
                  ctx.beginPath(); ctx.arc(cx, cy, rPlus, 0, Math.PI * 2); ctx.stroke();
                  ctx.strokeStyle = 'rgba(255, 120, 120, 0.25)';
                  ctx.beginPath(); ctx.arc(cx, cy, rMinus, 0, Math.PI * 2); ctx.stroke();
                });
                ctx.setLineDash([]);

                // Labels
                ctx.fillStyle = 'rgba(80, 160, 255, 0.8)';
                ctx.font = '12px monospace';
                [10, 25, 50].forEach(level => {
                  const rPlus = radius + (level / maxDev) * deviationScale;
                  ctx.fillText(`+${level}¢`, cx + rPlus + 5, cy + 4);
                });
                ctx.fillStyle = 'rgba(255, 120, 120, 0.8)';
                [10, 25].forEach(level => {
                  const rMinus = radius - (level / maxDev) * deviationScale;
                  if (rMinus > 30) ctx.fillText(`-${level}¢`, cx + rMinus + 5, cy + 4);
                });

                // Base circle
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '10px monospace';
                ctx.fillText('0¢ (ET)', cx + radius + 5, cy - 10);

                // Notes
                for (let i = 0; i < Nn; i++) {
                  const note = result.notes[i];
                  const ang = (i / Nn) * Math.PI * 2 - Math.PI / 2;
                  const et = (i * O) / Nn;
                  let dev = note.centsFromRoot - et;
                  if (dev > O / 2) dev -= O;
                  if (dev < -O / 2) dev += O;

                  const r = radius + (clamp(dev, -maxDev, maxDev) / maxDev) * deviationScale;
                  const x = cx + Math.cos(ang) * r;
                  const y = cy + Math.sin(ang) * r;

                  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                  ctx.lineWidth = 1;
                  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius); ctx.stroke();

                  ctx.strokeStyle = dev >= 0 ? 'rgba(80,160,255,0.9)' : 'rgba(255,120,120,0.9)';
                  ctx.lineWidth = 3;
                  ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius); ctx.lineTo(x, y); ctx.stroke();

                  ctx.fillStyle = dev >= 0 ? 'rgba(80,160,255,1)' : 'rgba(255,120,120,1)';
                  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();

                  ctx.fillStyle = 'rgba(255,255,255,0.95)';
                  ctx.font = '14px monospace';
                  const labelDist = radius * 1.2;
                  const lx = cx + Math.cos(ang) * labelDist;
                  const ly = cy + Math.sin(ang) * labelDist;
                  ctx.fillText(note.name, lx - 8, ly + 5);

                  // Show deviation value
                  ctx.font = '10px monospace';
                  ctx.fillStyle = dev >= 0 ? 'rgba(80,160,255,0.8)' : 'rgba(255,120,120,0.8)';
                  ctx.fillText(`${dev >= 0 ? '+' : ''}${dev.toFixed(1)}`, lx - 12, ly + 18);
                }

                ctx.fillStyle = 'rgba(80,160,255,0.9)';
                ctx.font = '12px monospace';
                ctx.fillText('▲ Sharp', w - 80, h - 30);
                ctx.fillStyle = 'rgba(255,120,120,0.9)';
                ctx.fillText('▼ Flat', w - 80, h - 14);

              } else {
                // Draw enlarged heatmap
                const Nn = result.input.scaleSize;
                const columnCount = Math.min(Nn, 48);
                const advancedIntervalRows = (() => {
                  if (!advancedModeEnabled) return [];
                  const map = new Map<string, { n: number; d: number; tolSum: number; count: number }>();
                  advancedIntervals.forEach(interval => {
                    const key = `${interval.n}/${interval.d}`;
                    const existing = map.get(key);
                    if (existing) {
                      existing.tolSum += interval.toleranceCents;
                      existing.count += 1;
                    } else {
                      map.set(key, { n: interval.n, d: interval.d, tolSum: interval.toleranceCents, count: 1 });
                    }
                  });
                  return Array.from(map.entries()).map(([key, v]) => ({
                    label: key,
                    n: v.n,
                    d: v.d,
                    tolerance: v.count > 0 ? v.tolSum / v.count : globalTol
                  }));
                })();
                const enabledTargets = targetsRaw.filter(t => targetState[t.id]);
                const intervalRows = advancedModeEnabled
                  ? (advancedIntervalRows.length > 0
                    ? advancedIntervalRows
                    : [{ label: '3/2', n: 3, d: 2, tolerance: globalTol }, { label: '5/4', n: 5, d: 4, tolerance: globalTol }])
                  : (enabledTargets.length > 0
                    ? enabledTargets.map(t => ({ label: `${t.n}/${t.d}`, n: t.n, d: t.d, tolerance: individualTolerances[`${t.n}/${t.d}`] ?? globalTol }))
                    : [{ label: '3/2', n: 3, d: 2, tolerance: globalTol }, { label: '5/4', n: 5, d: 4, tolerance: globalTol }]);

                const leftMargin = 60;
                const topMargin = 50;
                const cellW = Math.max(12, (w - leftMargin - 20) / columnCount);
                const cellH = Math.max(25, (h - topMargin - 30) / Math.max(intervalRows.length, 1));
                const O = result.input.cycleCents;
                const stepCents = O / Nn;

                const colorFor = (err: number, tol: number) => {
                  const errAbs = Math.abs(err);
                  // Continuous color gradient - same as main heatmap
                  const maxDisplay = tol * 2;
                  const normalized = Math.min(errAbs / maxDisplay, 1);

                  let r: number, g: number, b: number;

                  if (normalized <= 0.2) {
                    const t = normalized / 0.2;
                    r = 80 + t * 80;
                    g = 220;
                    b = 140 - t * 40;
                  } else if (normalized <= 0.4) {
                    const t = (normalized - 0.2) / 0.2;
                    r = 160 + t * 80;
                    g = 220 - t * 10;
                    b = 100 - t * 10;
                  } else if (normalized <= 0.6) {
                    const t = (normalized - 0.4) / 0.2;
                    r = 240 + t * 15;
                    g = 210 - t * 50;
                    b = 90 - t * 20;
                  } else if (normalized <= 0.8) {
                    const t = (normalized - 0.6) / 0.2;
                    r = 255;
                    g = 160 - t * 60;
                    b = 70 - t * 10;
                  } else {
                    const t = (normalized - 0.8) / 0.2;
                    r = 255;
                    g = 100 - t * 30;
                    b = 60 + t * 10;
                  }

                  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.95)`;
                };
                const wrap = (v: number) => ((v % O) + O) % O;

                // Title
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = '14px sans-serif';
                ctx.fillText('Interval Quality Heatmap (Enlarged)', 10, 25);

                // Row labels
                ctx.font = '12px monospace';
                intervalRows.forEach((row, r) => {
                  ctx.fillStyle = 'rgba(255,255,255,0.8)';
                  ctx.fillText(row.label, 8, topMargin + r * cellH + cellH * 0.6);
                  ctx.fillStyle = 'rgba(255,255,255,0.4)';
                  ctx.font = '9px monospace';
                  ctx.fillText(`±${row.tolerance}`, 8, topMargin + r * cellH + cellH * 0.85);
                  ctx.font = '12px monospace';
                });

                // Column labels
                const labelSkip = cellW < 18 ? Math.ceil(18 / cellW) : 1;
                ctx.font = '10px monospace';
                for (let c = 0; c < columnCount; c++) {
                  if (c % labelSkip !== 0) continue;
                  ctx.fillStyle = 'rgba(255,255,255,0.7)';
                  const label = Nn === 12 ? NOTE_NAMES[c] : `${c}`;
                  ctx.fillText(label, leftMargin + c * cellW + 2, topMargin - 8);
                }

                // Cells
                intervalRows.forEach((row, r) => {
                  const ideal = centsFromRatio(row.n, row.d, O);
                  const step = Math.max(1, Math.min(Nn - 1, Math.round(ideal / stepCents)));
                  for (let c = 0; c < columnCount && c < Nn; c++) {
                    const tonic = c;
                    const j = (tonic + step) % Nn;
                    const actual = wrap(result.notes[j].centsFromRoot - result.notes[tonic].centsFromRoot);
                    const ide = wrap(ideal);
                    let err = actual - ide;
                    if (err > O / 2) err -= O;
                    if (err < -O / 2) err += O;

                    ctx.fillStyle = colorFor(err, row.tolerance);
                    ctx.fillRect(leftMargin + c * cellW, topMargin + r * cellH, cellW - 1, cellH - 1);

                    // Show error value
                    if (cellW > 16 && cellH > 20) {
                      ctx.fillStyle = Math.abs(err) < row.tolerance * 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
                      ctx.font = '9px monospace';
                      ctx.fillText(`${err >= 0 ? '+' : ''}${err.toFixed(1)}`, leftMargin + c * cellW + 2, topMargin + r * cellH + cellH - 5);
                    }
                  }
                });
              }
            }}
            className="w-full"
            style={{ maxHeight: '70vh' }}
          />
        </div>
        <div className="text-[9px] text-gray-500 mt-2 text-center">
          Click outside or press Close to exit
        </div>
      </div>
    </div>
  );
};
