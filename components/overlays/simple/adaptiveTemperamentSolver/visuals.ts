import type { SolverOutput } from '../../../../utils/temperamentSolver';
import { NOTE_NAMES } from './constants';
import type { AdvancedIntervalItem, TargetItem } from './types';
import { centsFromRatio, clamp } from './utils';

type DrawRadarOptions = {
  canvas: HTMLCanvasElement;
  result: SolverOutput;
};

type DrawHeatmapOptions = {
  canvas: HTMLCanvasElement;
  result: SolverOutput;
  globalTol: number;
  privilegedKeys: number[];
  targetState: Record<string, boolean>;
  targetsRaw: TargetItem[];
  individualTolerances: Record<string, number>;
  advancedModeEnabled: boolean;
  advancedIntervals: AdvancedIntervalItem[];
};

export const drawRadarCanvas = ({ canvas, result }: DrawRadarOptions) => {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(240, Math.floor(rect.width));
  const h = Math.max(220, Math.floor(rect.height));
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2; const cy = h / 2; const radius = Math.min(w, h) * 0.35;

  const O = result.input.cycleCents;
  const Nn = result.input.scaleSize;
  const maxDev = 50;
  const deviationScale = radius * 0.4; // How much the deviation extends beyond base circle

  // Draw calibration circles (deviation reference)
  const calibrationLevels = [10, 25, 50]; // cents
  ctx.globalAlpha = 0.6;
  calibrationLevels.forEach(level => {
    const rPlus = radius + (level / maxDev) * deviationScale;
    const rMinus = radius - (level / maxDev) * deviationScale;

    // Outer (positive deviation)
    ctx.strokeStyle = 'rgba(80, 160, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, rPlus, 0, Math.PI * 2); ctx.stroke();

    // Inner (negative deviation)
    ctx.strokeStyle = 'rgba(255, 120, 120, 0.25)';
    ctx.beginPath(); ctx.arc(cx, cy, rMinus, 0, Math.PI * 2); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Draw calibration labels on the right side
  ctx.fillStyle = 'rgba(80, 160, 255, 0.7)';
  ctx.font = '9px monospace';
  calibrationLevels.forEach(level => {
    const rPlus = radius + (level / maxDev) * deviationScale;
    ctx.fillText(`+${level}¢`, cx + rPlus + 3, cy + 3);
  });
  ctx.fillStyle = 'rgba(255, 120, 120, 0.7)';
  calibrationLevels.forEach(level => {
    const rMinus = radius - (level / maxDev) * deviationScale;
    if (rMinus > 20) {
      ctx.fillText(`-${level}¢`, cx + rMinus + 3, cy + 3);
    }
  });

  // Base circle (ET reference = 0 deviation)
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.fillText('0¢ (ET)', cx + radius + 3, cy - 8);

  // Draw deviation lines for each note
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

    // Spoke line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius); ctx.stroke();

    // Deviation indicator
    ctx.strokeStyle = dev >= 0 ? 'rgba(80,160,255,0.85)' : 'rgba(255,120,120,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius); ctx.lineTo(x, y); ctx.stroke();

    // Dot at end
    ctx.fillStyle = dev >= 0 ? 'rgba(80,160,255,1)' : 'rgba(255,120,120,1)';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();

    // Note label
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '10px monospace';
    const labelDist = radius * 1.18;
    const lx = cx + Math.cos(ang) * labelDist;
    const ly = cy + Math.sin(ang) * labelDist;
    ctx.fillText(note.name, lx - 6, ly + 4);
  }

  // Title
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '12px sans-serif';
  ctx.fillText('Deviance Radar (vs ET)', 10, 18);

  // Legend
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(80,160,255,0.8)';
  ctx.fillText('▲ Sharp', w - 55, h - 18);
  ctx.fillStyle = 'rgba(255,120,120,0.8)';
  ctx.fillText('▼ Flat', w - 55, h - 6);
};

export const drawHeatmapCanvas = ({
  canvas,
  result,
  globalTol,
  privilegedKeys,
  targetState,
  targetsRaw,
  individualTolerances,
  advancedModeEnabled,
  advancedIntervals
}: DrawHeatmapOptions) => {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(220, Math.floor(rect.height));
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  // Build dynamic columns based on scale size (N)
  const Nn = result.input.scaleSize;
  const columnCount = Math.min(Nn, 24); // Max 24 columns for readability
  const degreeLabels: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    if (Nn === 12) {
      degreeLabels.push(NOTE_NAMES[i]);
    } else {
      degreeLabels.push(`${i}`);
    }
  }

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

  // Build dynamic interval rows based on enabled target ratios
  const enabledTargets = targetsRaw.filter(t => targetState[t.id]);
  const intervalRows = advancedModeEnabled
    ? (advancedIntervalRows.length > 0
      ? advancedIntervalRows
      : [{ label: '3/2', n: 3, d: 2, tolerance: globalTol }, { label: '5/4', n: 5, d: 4, tolerance: globalTol }])
    : (enabledTargets.length > 0
      ? enabledTargets.map(t => ({
        label: `${t.n}/${t.d}`,
        n: t.n,
        d: t.d,
        tolerance: individualTolerances[`${t.n}/${t.d}`] ?? globalTol
      }))
      : [
        { label: '3/2', n: 3, d: 2, tolerance: globalTol },
        { label: '5/4', n: 5, d: 4, tolerance: globalTol },
      ]);

  // Calculate dynamic left margin based on longest label
  const longestLabel = intervalRows.reduce((max, r) => Math.max(max, r.label.length), 0);
  const leftMargin = Math.max(35, longestLabel * 7 + 20);

  // Calculate cell dimensions to fit within canvas
  const availableWidth = w - leftMargin - 5; // 5px right padding
  const availableHeight = h - 45; // Header + some bottom padding
  const cellW = Math.max(12, Math.floor(availableWidth / columnCount));
  const cellH = Math.max(16, Math.floor(availableHeight / Math.max(intervalRows.length, 1)));
  const O = result.input.cycleCents;
  const stepCents = O / Nn;

  // Continuous color gradient for error visualization
  // Green (perfect) -> Yellow (acceptable) -> Orange (marginal) -> Red (poor)
  const colorFor = (errAbs: number, tol: number) => {
    // Normalize error to 0-1 range based on tolerance
    // 0 = perfect, 0.4 = green zone, 1.0 = tolerance limit, >1 = over tolerance
    const maxDisplay = tol * 2; // Show gradient up to 2x tolerance
    const normalized = Math.min(errAbs / maxDisplay, 1);

    // Define color stops: green -> yellow -> orange -> red
    // 0.0 = pure green (80, 220, 140)
    // 0.2 = green-yellow (160, 220, 100)
    // 0.4 = yellow (240, 210, 90)
    // 0.6 = orange (255, 160, 70)
    // 0.8 = red-orange (255, 100, 60)
    // 1.0 = red (255, 70, 70)

    let r: number, g: number, b: number;

    if (normalized <= 0.2) {
      // Green to green-yellow
      const t = normalized / 0.2;
      r = 80 + t * 80;      // 80 -> 160
      g = 220;              // 220 -> 220
      b = 140 - t * 40;     // 140 -> 100
    } else if (normalized <= 0.4) {
      // Green-yellow to yellow
      const t = (normalized - 0.2) / 0.2;
      r = 160 + t * 80;     // 160 -> 240
      g = 220 - t * 10;     // 220 -> 210
      b = 100 - t * 10;     // 100 -> 90
    } else if (normalized <= 0.6) {
      // Yellow to orange
      const t = (normalized - 0.4) / 0.2;
      r = 240 + t * 15;     // 240 -> 255
      g = 210 - t * 50;     // 210 -> 160
      b = 90 - t * 20;      // 90 -> 70
    } else if (normalized <= 0.8) {
      // Orange to red-orange
      const t = (normalized - 0.6) / 0.2;
      r = 255;              // 255
      g = 160 - t * 60;     // 160 -> 100
      b = 70 - t * 10;      // 70 -> 60
    } else {
      // Red-orange to red
      const t = (normalized - 0.8) / 0.2;
      r = 255;              // 255
      g = 100 - t * 30;     // 100 -> 70
      b = 60 + t * 10;      // 60 -> 70
    }

    return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},0.92)`;
  };
  const wrap = (v: number) => ((v % O) + O) % O;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '12px sans-serif';
  ctx.fillText('Interval Quality Heatmap', 10, 16);

  // Draw row labels (interval names and tolerances)
  ctx.font = cellW < 16 ? '8px monospace' : '10px monospace';
  intervalRows.forEach((row, r) => {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(row.label, 4, 38 + r * cellH + cellH * 0.55);
    if (cellH > 20) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '7px monospace';
      ctx.fillText(`±${row.tolerance}`, 4, 38 + r * cellH + cellH * 0.85);
      ctx.font = cellW < 16 ? '8px monospace' : '10px monospace';
    }
  });

  // Draw column labels (degree numbers) - only show every Nth label if too cramped
  const labelSkip = cellW < 14 ? Math.ceil(14 / cellW) : 1;
  ctx.font = cellW < 14 ? '7px monospace' : '9px monospace';
  degreeLabels.forEach((k, c) => {
    if (c % labelSkip !== 0) return;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const labelX = leftMargin + c * cellW + 1;
    ctx.fillText(k, labelX, 30);
  });

  intervalRows.forEach((row, r) => {
    const ideal = centsFromRatio(row.n, row.d, O);
    const step = Math.max(1, Math.min(Nn - 1, Math.round(ideal / stepCents)));
    for (let c = 0; c < columnCount; c++) {
      if (c >= Nn) continue;
      const tonic = c;
      const j = (tonic + step) % Nn;
      const actual = wrap(result.notes[j].centsFromRoot - result.notes[tonic].centsFromRoot);
      const ide = wrap(ideal);
      let err = actual - ide;
      if (err > O / 2) err -= O; if (err < -O / 2) err += O;
      const errAbs = Math.abs(err);

      ctx.fillStyle = colorFor(errAbs, row.tolerance);
      ctx.fillRect(leftMargin + c * cellW, 36 + r * cellH, cellW - 1, cellH - 1);

      // Privileged key border
      if (privilegedKeys.includes(tonic)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(leftMargin + c * cellW + 0.5, 36 + r * cellH + 0.5, cellW - 2, cellH - 2);
      }

      // Show error value for larger cells
      if (cellW > 20 && cellH > 16) {
        ctx.fillStyle = errAbs < row.tolerance * 0.5 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';
        ctx.font = '7px monospace';
        ctx.fillText(`${err >= 0 ? '+' : ''}${err.toFixed(0)}`, leftMargin + c * cellW + 1, 36 + r * cellH + cellH - 2);
      }
    }
  });
};
