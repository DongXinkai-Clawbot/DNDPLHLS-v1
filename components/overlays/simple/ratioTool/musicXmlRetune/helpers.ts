import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { formatPrimePowerRatioFromPrimeVector, formatRatio, formatRatioForDisplay, getPitchClassDistance, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio, simplify } from '../../../../../musicLogic';
import type { ScoreDocument, ScoreEvent } from '../../../../../domain/scoreTimeline/types';
import type { LayoutScale } from '../../../settingsTabsPart2/midiFileRetune/utils';
import type { RetunedEventInfo } from '../../../../../domain/musicxml/buildScoreDocument';

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const midiNoteToFrequency = (note: number, a4: number) => a4 * Math.pow(2, (note - 69) / 12);

export const parseScaleText = (text: string) => {
  const raw = (text || '')
    .split(/[,\n\r\t\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const scale: string[] = [];
  const errors: string[] = [];
  raw.forEach((token) => {
    try {
      const f = parseGeneralRatio(token);
      if (f.n <= 0n || f.d <= 0n) {
        errors.push(`Invalid ratio: ${token}`);
        return;
      }
      scale.push(token);
    } catch {
      errors.push(`Invalid ratio: ${token}`);
    }
  });
  return { scale: scale.length ? scale : ['1/1'], errors };
};

export const buildRetuneScaleFromLibrary = (savedMidiScales: any[], selectedId: string | null) => {
  if (!selectedId) return [];
  const found = savedMidiScales.find(s => s.id === selectedId);
  return found ? found.scale : [];
};

export const applyRatioOverrides = (
  tuning: Map<string, RetunedEventInfo>,
  overrides: Record<string, string>
) => {
  const next = new Map(tuning);
  Object.entries(overrides).forEach(([eventId, ratioText]) => {
    const raw = (ratioText || '').trim();
    if (!raw) {
      next.delete(eventId);
      return;
    }
    try {
      const frac = simplify(parseGeneralRatio(raw));
      next.set(eventId, { ratio: `${frac.n}/${frac.d}`, ratioFraction: frac, nodeId: null });
    } catch {
      // Ignore invalid overrides during mapping; UI will show error.
    }
  });
  return next;
};

export const useRafLoop = (enabled: boolean, cb: (t: number) => void) => {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = (t: number) => {
      cbRef.current(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
};


export const normalizeFrac = (turns: number) => {
  let frac = turns - Math.floor(turns);
  if (frac < 0) frac += 1;
  return frac;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpHue01 = (h1: number, h2: number, t: number) => {
  const dh = ((h2 - h1 + 0.5) % 1) - 0.5;
  return (h1 + dh * t + 1) % 1;
};

export const mixHSL = (c1: THREE.Color, c2: THREE.Color, t: number) => {
  const hsl1 = { h: 0, s: 0, l: 0 };
  const hsl2 = { h: 0, s: 0, l: 0 };
  c1.getHSL(hsl1);
  c2.getHSL(hsl2);
  const h = lerpHue01(hsl1.h, hsl2.h, t);
  const s = lerp(hsl1.s, hsl2.s, t);
  const l = lerp(hsl1.l, hsl2.l, t);
  return new THREE.Color().setHSL(h, s, l);
};

export const spectrumColorFromFrac = (
  frac: number,
  anchors: { startFrac: number; yellowT: number; blueT: number },
  primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }
) => {
  const start = anchors.startFrac;
  const t = ((frac - start) % 1 + 1) % 1;
  const yT = clamp(anchors.yellowT, 1e-12, 1 - 1e-12);
  const bT = clamp(anchors.blueT, yT + 1e-12, 1 - 1e-12);

  if (t <= yT) {
    const u = t / yT;
    return mixHSL(primaries.a, primaries.c, Math.pow(u, 1.5));
  }
  if (t <= bT) {
    const u = (t - yT) / (bT - yT);
    return mixHSL(primaries.c, primaries.b, Math.pow(u, 0.65));
  }
  return mixHSL(primaries.b, primaries.a, (t - bT) / (1 - bT));
};

export const primaryWeightsFromHue = (hueDeg: number) => {
  const hue = ((hueDeg % 360) + 360) % 360;
  let a = 0;
  let b = 0;
  let c = 0;
  if (hue < 120) {
    const t = hue / 120;
    a = 1 - t;
    c = t;
  } else if (hue < 240) {
    const t = (hue - 120) / 120;
    c = 1 - t;
    b = t;
  } else {
    const t = (hue - 240) / 120;
    b = 1 - t;
    a = t;
  }
  return { a, b, c };
};

export const mixRgbFromWeights = (
  weights: { a: number; b: number; c: number },
  primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }
) => {
  const total = Math.abs(weights.a) + Math.abs(weights.b) + Math.abs(weights.c);
  if (total <= 1e-6) return primaries.a.clone().lerp(primaries.b, 0.5).lerp(primaries.c, 0.5);
  const wa = weights.a / total;
  const wb = weights.b / total;
  const wc = weights.c / total;
  const out = new THREE.Color(0, 0, 0);
  out.r = primaries.a.r * wa + primaries.b.r * wb + primaries.c.r * wc;
  out.g = primaries.a.g * wa + primaries.b.g * wb + primaries.c.g * wc;
  out.b = primaries.a.b * wa + primaries.b.b * wb + primaries.c.b * wc;
  return out;
};

export const mixHexColors = (colors: string[]) => {
  if (!colors.length) return null;
  if (colors.length === 1) return colors[0];
  const sum = { r: 0, g: 0, b: 0 };
  colors.forEach((hex) => {
    const color = new THREE.Color(hex);
    sum.r += color.r;
    sum.g += color.g;
    sum.b += color.b;
  });
  const avg = new THREE.Color(sum.r / colors.length, sum.g / colors.length, sum.b / colors.length);
  return `#${avg.getHexString()}`;
};

export const rgbaFromHex = (hex: string, alpha: number) => {
  const color = new THREE.Color(hex);
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getRatioLayout = (label: string, size: 'main' | 'sub') => {
  const len = label.length;
  if (size === 'sub') return len > 9 ? 'text-[9px] scale-90' : 'text-[10px]';
  if (len <= 4) return 'text-[13px]';
  if (len <= 6) return 'text-[12px]';
  if (len <= 8) return 'text-[11px]';
  if (len <= 10) return 'text-[10px]';
  return 'text-[9px]';
};

export const getBarTextScale = (barWidth: number) => {
  if (barWidth >= 120) return 1;
  if (barWidth >= 80) return 0.9;
  if (barWidth >= 60) return 0.8;
  if (barWidth >= 40) return 0.7;
  return 0.6;
};

export const getChordTextScale = (barWidth: number, noteCount: number) => {
  const base = getBarTextScale(barWidth);
  if (noteCount <= 1) return base;
  const penalty = Math.min(0.25, (noteCount - 1) * 0.05);
  return Math.max(0.4, base - penalty);
};

export const buildRatioDisplay = (
  fraction: { n: bigint; d: bigint },
  showOctaveFolding: boolean,
  ratioMode: 'fraction' | 'primePowers' | 'auto',
  autoPowerDigits: number,
  customSymbols?: Record<number, string>
) => {
  const normalized = showOctaveFolding ? normalizeOctave(fraction).ratio : fraction;
  const displayFraction = simplify(normalized);
  const vector = getPrimeVectorFromRatio(displayFraction.n, displayFraction.d);
  const fractionLabel = formatRatioForDisplay(displayFraction, vector, {
    mode: ratioMode,
    autoPowerDigits,
    customSymbols
  });
  const compactLabel = formatPrimePowerRatioFromPrimeVector(vector, customSymbols) || fractionLabel;
  return { displayFraction, fractionLabel, compactLabel };
};

export const parseHChromaNodeId = (nodeId?: string | null) => {
  if (!nodeId) return null;
  if (!nodeId.startsWith('hchroma-')) return null;
  const value = parseInt(nodeId.slice('hchroma-'.length), 10);
  return Number.isFinite(value) ? value : null;
};

export const getEventPitchClassCents = (event: ScoreEvent) => {
  if (event.type !== 'note') return null;
  const rawFraction = event.ratioFraction || (event.ratio ? parseGeneralRatio(event.ratio) : null);
  if (!rawFraction) return null;
  const normalized = normalizeOctave(rawFraction).ratio;
  const value = Number(normalized.n) / Number(normalized.d);
  if (!Number.isFinite(value) || value <= 0) return null;
  return 1200 * Math.log2(value);
};

export const buildHChromaEventLabelMap = (scoreDoc: ScoreDocument | null, hChromaScale: LayoutScale) => {
  const labels = new Map<string, any>();
  if (!scoreDoc || !hChromaScale.scale.length || !hChromaScale.centsValues.length) return labels;

  const indexByNodeId = new Map<string, number>();
  hChromaScale.nodeIdByScaleIndex.forEach((nodeId, idx) => {
    if (nodeId) indexByNodeId.set(nodeId, idx);
  });
  const harmonicsByIndex = hChromaScale.nodeIdByScaleIndex.map((nodeId) => parseHChromaNodeId(nodeId));

  scoreDoc.voices.forEach((voice) => {
    voice.events.forEach((event) => {
      if (event.type !== 'note') return;

      let index = -1;
      if (event.nodeId) {
        const found = indexByNodeId.get(event.nodeId);
        if (found !== undefined) index = found;
      }

      if (index < 0) {
        const cents = getEventPitchClassCents(event);
        if (cents == null) return;
        let bestIndex = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let i = 0; i < hChromaScale.centsValues.length; i += 1) {
          const dist = getPitchClassDistance(cents, hChromaScale.centsValues[i]);
          if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
          }
        }
        index = bestIndex;
      }

      const harmonic = harmonicsByIndex[index] ?? null;
      const harmonicLabel = harmonic ? harmonic.toString() : '--';
      const ratioLabel = hChromaScale.scale[index] ?? '--';
      const ratioValue = Number.isFinite(hChromaScale.ratioValues[index]) ? hChromaScale.ratioValues[index] : null;
      labels.set(event.id, { harmonic, harmonicLabel, ratioLabel, ratioValue });
    });
  });

  return labels;
};

export const bigGcd = (a: bigint, b: bigint): bigint => {
  return b === 0n ? a : bigGcd(b, a % b);
};

export const bigLcm = (a: bigint, b: bigint): bigint => {
  if (a === 0n || b === 0n) return 0n;
  return (a * b) / bigGcd(a, b);
};

export const getNoteNameFromMidi = (midi: number | undefined) => {
  if (midi === undefined || midi === null) return '';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return notes[midi % 12] + (Math.floor(midi / 12) - 1);
};



