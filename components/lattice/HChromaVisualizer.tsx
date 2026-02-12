import React from 'react';
import { Billboard, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useLatticeStore } from '../../store/latticeStoreContext';
import { startFrequency } from '../../audioEngine';
import { parseGeneralRatio } from '../../musicLogic';

type PrimaryMix = { a: number; b: number; c: number; label: string; color: THREE.Color };
type MixWeights = { a: number; b: number; c: number };
type HChromaPoint = {
  harmonic: number;
  ring: number;
  frac: number;
  turns: number;
  angle: number;
  position: THREE.Vector3;
  color: THREE.Color;
  ratioValue: number;
  ratioText: string;
  weights: MixWeights;
  complexity: number;
  mix?: PrimaryMix;
};

type HChromaBranchNode = {
  id: string;
  harmonic: number;
  exponent: number;
  base: number;
  position: THREE.Vector3;
  color: THREE.Color;
  ratioValue: number;
  valueText: string;
  formulaText: string;
  weights: MixWeights;
  complexity: number;
  mix?: PrimaryMix;
};

type HChromaBranchLine = { id: string; points: THREE.Vector3[] };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const EPS = 1e-10;
const TURN_SNAP_EPS = 1e-12;

const gcdBigInt = (a: bigint, b: bigint) => {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0n ? 1n : x;
};

const powBigInt = (base: bigint, exp: number) => {
  let e = Math.max(0, Math.trunc(exp));
  let result = 1n;
  let b = base;
  while (e > 0) {
    if (e & 1) result *= b;
    e = Math.floor(e / 2);
    if (e > 0) b *= b;
  }
  return result;
};

type HChromaCacheKey = string;
type HChromaFactorInfo = { weights: MixWeights; complexity: number };
type HChromaCaches = { primeWeights: Map<number, MixWeights>; factorWeights: Map<number, HChromaFactorInfo> };

const HCHROMA_CACHES = new Map<HChromaCacheKey, HChromaCaches>();
const MAX_HCHROMA_CACHE_KEYS = 8;

const getHChromaCaches = (key: HChromaCacheKey): HChromaCaches => {
  const existing = HCHROMA_CACHES.get(key);
  if (existing) return existing;
  const caches: HChromaCaches = { primeWeights: new Map(), factorWeights: new Map() };
  HCHROMA_CACHES.set(key, caches);
  while (HCHROMA_CACHES.size > MAX_HCHROMA_CACHE_KEYS) {
    const oldestKey = HCHROMA_CACHES.keys().next().value as HChromaCacheKey | undefined;
    if (!oldestKey) break;
    HCHROMA_CACHES.delete(oldestKey);
  }
  return caches;
};

const factorizeInteger = (n: number, onFactor: (prime: number, exponent: number) => void) => {
  let remaining = Math.max(1, Math.floor(Math.abs(n)));
  if (remaining === 1) return;
  let p = 2;
  while (p * p <= remaining) {
    if (remaining % p === 0) {
      let exponent = 0;
      while (remaining % p === 0) {
        remaining = Math.floor(remaining / p);
        exponent++;
      }
      onFactor(p, exponent);
    }
    p = p === 2 ? 3 : p + 2;
  }
  if (remaining > 1) onFactor(remaining, 1);
};

const stripFactor2 = (n: number) => {
  let v = Math.max(1, Math.floor(Math.abs(n)));
  while (v > 1 && v % 2 === 0) v = Math.floor(v / 2);
  return v;
};

const normalizeRatioValue = (value: number) => {
  let v = value;
  if (!Number.isFinite(v) || v <= 0) return 1;
  while (v >= 2) v /= 2;
  while (v < 1) v *= 2;
  return v;
};

const normalizeFractionToOctave = (n: bigint, d: bigint) => {
  let num = n < 0n ? -n : n;
  let den = d < 0n ? -d : d;
  if (num === 0n || den === 0n) return { n: 0n, d: 1n };
  while (num >= den * 2n) num /= 2n;
  while (num < den) num *= 2n;
  return { n: num, d: den };
};

const stripPow2 = (v: bigint) => {
  let out = v < 0n ? -v : v;
  while (out > 1n && out % 2n === 0n) out /= 2n;
  return out;
};

const normalizeTurns = (turns: number) => {
  let t = turns;
  const snap = Math.round(t);
  if (Math.abs(t - snap) <= TURN_SNAP_EPS) t = snap;
  let ring = Math.floor(t);
  let frac = t - ring;
  if (frac < 0) {
    frac += 1;
    ring -= 1;
  }
  if (frac <= TURN_SNAP_EPS) {
    frac = 0;
    t = ring;
  } else if (1 - frac <= TURN_SNAP_EPS) {
    ring += 1;
    frac = 0;
    t = ring;
  }
  return { ring, frac, turns: t };
};
const isHexColor = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
const toColor = (value: string | undefined, fallback: string) => {
  const raw = value && isHexColor(value) ? value : fallback;
  return new THREE.Color(raw);
};

const gcdInt = (a: number, b: number) => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
};

const reduceFraction = (num: number, den: number) => {
  const d = Math.max(1, Math.trunc(den));
  const n = Math.trunc(num);
  const g = gcdInt(n, d);
  return { num: n / g, den: d / g };
};

const formatCompact = (v: number, digits: number) => {
  if (!Number.isFinite(v)) return '0';
  const s = v.toFixed(digits);
  return s.replace(/\.?0+$/, '');
};

const quantizeFraction01 = (x: number, den: number) => {
  const v = clamp(x, 0, 1);
  const d = Math.max(1, Math.floor(den));
  const num = clamp(Math.round(v * d), 0, d);
  return reduceFraction(num, d);
};

const primaryMixFromHue = (hueDeg: number, maxDen: number) => {
  const hue = ((hueDeg % 360) + 360) % 360;
  const maxD = clamp(Math.floor(maxDen), 2, 120);
  let a = 0;
  let b = 0;
  let c = 0;
  if (hue < 120) {
    const { num, den } = quantizeFraction01(hue / 120, maxD);
    a = den - num;
    c = num;
  } else if (hue < 240) {
    const { num, den } = quantizeFraction01((hue - 120) / 120, maxD);
    c = den - num;
    b = num;
  } else {
    const { num, den } = quantizeFraction01((hue - 240) / 120, maxD);
    b = den - num;
    a = num;
  }
  return { a, b, c };
};

const primaryWeightsFromHue = (hueDeg: number) => {
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpHue01 = (h1: number, h2: number, t: number) => {
  const dh = ((h2 - h1 + 0.5) % 1) - 0.5;
  return (h1 + dh * t + 1) % 1;
};

const mixHSL = (c1: THREE.Color, c2: THREE.Color, t: number) => {
  const hsl1 = { h: 0, s: 0, l: 0 };
  const hsl2 = { h: 0, s: 0, l: 0 };
  c1.getHSL(hsl1);
  c2.getHSL(hsl2);
  const h = lerpHue01(hsl1.h, hsl2.h, t);
  const s = lerp(hsl1.s, hsl2.s, t);
  const l = lerp(hsl1.l, hsl2.l, t);
  return new THREE.Color().setHSL(h, s, l);
};

type SpectrumAnchors = {
  startFrac: number;
  yellowT: number;
  blueT: number;
};

const spectrumColorFromFrac = (
  frac: number,
  anchors: SpectrumAnchors,
  primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }
) => {

  const start = anchors.startFrac;
  const t = ((frac - start) % 1 + 1) % 1;
  const yT = clamp(anchors.yellowT, TURN_SNAP_EPS, 1 - TURN_SNAP_EPS);
  const bT = clamp(anchors.blueT, yT + TURN_SNAP_EPS, 1 - TURN_SNAP_EPS);

  if (t <= yT) {

    const u = t / yT;
    const uCurve = Math.pow(u, 1.5);
    return mixHSL(primaries.a, primaries.c, uCurve);
  }
  if (t <= bT) {

    const u = (t - yT) / (bT - yT);
    const uCurve = Math.pow(u, 0.65);
    return mixHSL(primaries.c, primaries.b, uCurve);
  }
  return mixHSL(primaries.b, primaries.a, (t - bT) / (1 - bT));
};

type RYBPalette = {
  black: THREE.Color;
  white: THREE.Color;
  red: THREE.Color;
  yellow: THREE.Color;
  blue: THREE.Color;
  orange: THREE.Color;
  green: THREE.Color;
  purple: THREE.Color;
};

type ColorMixBasis = {
  primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color };
  ryb: RYBPalette;
};

const buildRYBPalette = (primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }): RYBPalette => {
  const red = primaries.a.clone();
  const blue = primaries.b.clone();
  const yellow = primaries.c.clone();
  return {
    black: new THREE.Color(0, 0, 0),
    white: new THREE.Color(1, 1, 1),
    red,
    yellow,
    blue,
    orange: mixHSL(red, yellow, 0.5),
    green: mixHSL(yellow, blue, 0.5),
    purple: mixHSL(blue, red, 0.5)
  };
};

const rybMixColor = (r: number, y: number, b: number, pal: RYBPalette) => {
  const tR = clamp(r, 0, 1);
  const tY = clamp(y, 0, 1);
  const tB = clamp(b, 0, 1);

  const mix2 = (c0: THREE.Color, c1: THREE.Color, t: number) => ({
    r: lerp(c0.r, c1.r, t),
    g: lerp(c0.g, c1.g, t),
    b: lerp(c0.b, c1.b, t)
  });
  const mix3 = (v0: { r: number; g: number; b: number }, v1: { r: number; g: number; b: number }, t: number) => ({
    r: lerp(v0.r, v1.r, t),
    g: lerp(v0.g, v1.g, t),
    b: lerp(v0.b, v1.b, t)
  });

  const c00 = mix2(pal.black, pal.red, tR);
  const c10 = mix2(pal.yellow, pal.orange, tR);
  const c01 = mix2(pal.blue, pal.purple, tR);
  const c11 = mix2(pal.green, pal.white, tR);

  const c0 = mix3(c00, c10, tY);
  const c1 = mix3(c01, c11, tY);
  const c = mix3(c0, c1, tB);

  return new THREE.Color(c.r, c.g, c.b);
};

const mixColorFromWeights = (
  weights: MixWeights,
  basis: ColorMixBasis,
  complexity: number,
  maxComplexity: number,
  polarity: number = 1
) => {
  const wa = weights.a;
  const wb = weights.b;

  const wc = weights.c * 0.6;
  const ma = Math.abs(wa);
  const mb = Math.abs(wb);
  const mc = Math.abs(wc);
  const totalMag = ma + mb + mc;

  if (totalMag <= EPS) {
    const base = new THREE.Color(0, 0, 0);
    base.r = (basis.primaries.a.r + basis.primaries.b.r + basis.primaries.c.r) / 3;
    base.g = (basis.primaries.a.g + basis.primaries.b.g + basis.primaries.c.g) / 3;
    base.b = (basis.primaries.a.b + basis.primaries.b.b + basis.primaries.c.b) / 3;
    return base;
  }

  const rComp = ma / totalMag;
  const yComp = mc / totalMag;
  const bComp = mb / totalMag;
  const baseColor = rybMixColor(rComp, yComp, bComp, basis.ryb);
  const t = maxComplexity > 0 ? clamp(complexity / maxComplexity, 0, 1) : 0;
  const intensity = 1.0 + 0.15 * Math.pow(t, 0.8);

  baseColor.multiplyScalar(intensity);
  const maxChannel = Math.max(baseColor.r, baseColor.g, baseColor.b);
  if (maxChannel > 1) baseColor.multiplyScalar(1 / maxChannel);
  if (polarity < 0) {
    baseColor.multiplyScalar(0.8);
  }
  baseColor.r = clamp(baseColor.r, 0, 1);
  baseColor.g = clamp(baseColor.g, 0, 1);
  baseColor.b = clamp(baseColor.b, 0, 1);
  return baseColor;
};

const reduceTriplet = (a: number, b: number, c: number) => {
  const g = gcdInt(gcdInt(a, b), c);
  return { a: a / g, b: b / g, c: c / g };
};

const formatTriplet = (weights: MixWeights, maxDen: number) => {
  const totalMag = Math.abs(weights.a) + Math.abs(weights.b) + Math.abs(weights.c);
  if (totalMag <= EPS) return '1:1:1';
  const snap = (v: number) => (Math.abs(v - Math.round(v)) < 1e-4 ? Math.round(v) : null);
  const snapped = [weights.a, weights.b, weights.c].map(snap);
  const ints = snapped.every(v => v !== null);
  if (ints) {
    const a = snapped[0] as number;
    const b = snapped[1] as number;
    const c = snapped[2] as number;
    const reduced = reduceTriplet(a, b, c);
    return `${reduced.a}:${reduced.b}:${reduced.c}`;
  }
  const scale = clamp(maxDen, 6, 64);
  let na = Math.round((weights.a / totalMag) * scale);
  let nb = Math.round((weights.b / totalMag) * scale);
  let nc = Math.round((weights.c / totalMag) * scale);
  if (na === 0 && nb === 0 && nc === 0) {
    const absA = Math.abs(weights.a);
    const absB = Math.abs(weights.b);
    const absC = Math.abs(weights.c);
    if (absA >= absB && absA >= absC) na = weights.a >= 0 ? 1 : -1;
    else if (absB >= absA && absB >= absC) nb = weights.b >= 0 ? 1 : -1;
    else nc = weights.c >= 0 ? 1 : -1;
  }
  const g = gcdInt(gcdInt(na, nb), nc);
  const denom = g > 0 ? g : 1;
  return `${Math.round(na / denom)}:${Math.round(nb / denom)}:${Math.round(nc / denom)}`;
};

const buildPrimaryMix = (
  weights: MixWeights,
  basis: ColorMixBasis,
  maxDen: number,
  complexity: number,
  maxComplexity: number,
  polarity: number = 1
): PrimaryMix => ({
  ...weights,
  label: formatTriplet(weights, maxDen),
  color: mixColorFromWeights(weights, basis, complexity, maxComplexity, polarity)
});

export const HChromaVisualizer = () => {
  const { settings, updateVisualSettings, playingNodeIds, nodes } = useLatticeStore(s => ({
    settings: s.settings,
    updateVisualSettings: s.updateVisualSettings,
    playingNodeIds: s.playingNodeIds,
    nodes: s.nodes
  }));
  const visuals = settings.visuals;

  const baseA = clamp(Number(visuals.hChromaBase ?? 2), 1.01, 50);
  const limit = clamp(Math.floor(Number(visuals.hChromaLimit ?? 47)), 1, 5000);
  const colorMode = (visuals.hChromaColorMode ?? 'pure') as 'pure' | 'primaryRatio';
  const labelMode = (visuals.hChromaLabelMode ?? 'harmonic') as 'harmonic' | 'ratio' | 'both' | 'none';
  const showPrimaryTriplet = Boolean(visuals.hChromaShowPrimaryTriplet);
  const customRatios = Array.isArray(visuals.hChromaCustomScale) ? visuals.hChromaCustomScale.filter(Boolean) : [];
  const useCustomRatios = customRatios.length > 0;
  const primaryColors = React.useMemo(() => ({
    a: new THREE.Color(visuals.hChromaPrimaryA ?? '#ff0000'),
    b: new THREE.Color(visuals.hChromaPrimaryB ?? '#0000ff'),
    c: new THREE.Color(visuals.hChromaPrimaryC ?? '#ffff00')
  }), [visuals.hChromaPrimaryA, visuals.hChromaPrimaryB, visuals.hChromaPrimaryC]);
  const colorBasis = React.useMemo<ColorMixBasis>(() => ({
    primaries: primaryColors,
    ryb: buildRYBPalette(primaryColors)
  }), [primaryColors]);
  const spectrumAnchors = React.useMemo<SpectrumAnchors>(() => {
    const lnA = Math.log(baseA);
    const startFrac = normalizeTurns(Math.log(2) / lnA).frac;
    const yellowFrac = normalizeTurns(Math.log(5) / lnA).frac;
    const blueFrac = normalizeTurns(Math.log(3) / lnA).frac;
    const yellowT = ((yellowFrac - startFrac) % 1 + 1) % 1;
    const blueT = ((blueFrac - startFrac) % 1 + 1) % 1;
    return { startFrac, yellowT, blueT };
  }, [baseA]);
  const radius = clamp(Number(visuals.hChromaRadius ?? 36), 4, 2000) * (visuals.globalScale ?? 1);
  const heightScale = clamp(Number(visuals.hChromaHeightScale ?? 18), 1, 5000) * (visuals.globalScale ?? 1);
  const primaryDen = 12;
  const branchEnabled = Boolean(visuals.hChromaBranchEnabled);

  const branchScope = (visuals.hChromaBranchScope ?? 'all') as 'all' | 'selected';
  const branchBase = Number.isFinite(visuals.hChromaBranchBase) ? (visuals.hChromaBranchBase as number) : 0;

  const branchLengthPos = Math.max(0, Math.floor(visuals.hChromaBranchLengthPos ?? (branchEnabled ? 1 : 0)));
  const branchLengthNeg = Math.max(0, Math.floor(visuals.hChromaBranchLengthNeg ?? (branchEnabled ? 1 : 0)));
  const branchSpacing = clamp(Number(visuals.hChromaBranchSpacing ?? 6), 3, 5000) * (visuals.globalScale ?? 1);
  const branchSelected = Array.isArray(visuals.hChromaBranchSelected) ? visuals.hChromaBranchSelected : [];
  const branchOverrides = visuals.hChromaBranchOverrides || {};
  const spectrumSplitEnabled = Boolean(visuals.hChromaSpectrumSplitEnabled);
  const spectrumDepth = clamp(Math.floor(Number(visuals.hChromaSpectrumDepth ?? 2)), 1, 10);
  const selectedHarmonic = visuals.hChromaBranchSelectedHarmonic;
  const labelScale = clamp(Number(visuals.globalScale ?? 1), 0.25, 8);

  const [hovered, setHovered] = React.useState<HChromaPoint | null>(null);
  const nodeById = React.useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const cacheKey = React.useMemo(() => `${baseA}|${colorMode}|${primaryDen}`, [baseA, colorMode, primaryDen]);
  const caches = React.useMemo(() => getHChromaCaches(cacheKey), [cacheKey]);

  const getPrimeWeights = React.useCallback((prime: number, lnA: number) => {
    const cache = caches.primeWeights;
    const cached = cache.get(prime);
    if (cached) return cached;
    let weights: MixWeights;

    if (prime === 2) weights = { a: 1, b: 0, c: 0 };
    else if (prime === 3) weights = { a: 0, b: 1, c: 0 };
    else if (prime === 5) weights = { a: 0, b: 0, c: 1 };
    else if (prime === 7) weights = { a: 1, b: 0, c: 1 };
    else if (prime === 11) weights = { a: 0, b: 1, c: 1 };
    else if (prime === 13) weights = { a: 1, b: 1, c: 0 };
    else {

      const turns = Math.log(prime) / lnA;
      const frac = normalizeTurns(turns).frac;
      const hue = frac * 360;
      weights = colorMode === 'primaryRatio' ? primaryMixFromHue(hue, primaryDen) : primaryWeightsFromHue(hue);
    }
    cache.set(prime, weights);
    return weights;
  }, [caches, colorMode, primaryDen]);

  const getAdditiveWeights = React.useCallback((n: number) => {
    const memo = new Map<number, MixWeights>();
    const compute = (x: number): MixWeights => {
      if (memo.has(x)) return memo.get(x)!;
      let res: MixWeights;
      if (x <= 1) res = { a: 0, b: 0, c: 0 };
      else if (x === 2) res = { a: 1, b: 0, c: 0 };
      else if (x === 3) res = { a: 0, b: 1, c: 0 };
      else if (x === 5) res = { a: 0, b: 0, c: 1 };
      else {
        const n1 = Math.floor(x / 2);
        const n2 = Math.ceil(x / 2);
        const w1 = compute(n1);
        const w2 = compute(n2);
        res = { a: w1.a + w2.a, b: w1.b + w2.b, c: w1.c + w2.c };
      }
      memo.set(x, res);
      return res;
    };
    return compute(n);
  }, []);

  const { points, maxComplexity } = React.useMemo(() => {
    type RawPoint = Omit<HChromaPoint, 'color' | 'mix' | 'weights' | 'complexity'> & { weights: MixWeights; complexity: number; order: number };
    const raw: RawPoint[] = [];
    let maxComplexityLocal = 1;
    const lnA = Math.log(baseA);
    const factorCache = caches.factorWeights;

    const harmonicWeights = (n: number): { weights: MixWeights; complexity: number } => {
      const w = getAdditiveWeights(n);
      const complexity = w.a + w.b + w.c;
      return { weights: w, complexity };
    };

    if (useCustomRatios) {
      const entries = new Map<string, RawPoint>();
      customRatios.forEach((ratio, idx) => {
        try {
          const frac = parseGeneralRatio(ratio);
          if (frac.n === 0n || frac.d === 0n) return;
          const normalized = normalizeFractionToOctave(frac.n, frac.d);
          const ratioValueRaw = Number(normalized.n) / Number(normalized.d);
          if (!Number.isFinite(ratioValueRaw) || ratioValueRaw <= 0) return;
          const ratioValue = normalizeRatioValue(ratioValueRaw);
          const turnInfo = normalizeTurns(Math.log(ratioValue) / lnA);
          const turns = turnInfo.turns;
          const ring = turnInfo.ring;
          const fracTurn = turnInfo.frac;
          const angle = fracTurn * Math.PI * 2;
          const x = radius * Math.cos(angle);
          const z = radius * Math.sin(angle);
          const y = turns * heightScale;
          const harmonicRaw = Number(stripPow2(normalized.n));
          const harmonic = Number.isFinite(harmonicRaw) && harmonicRaw > 0 ? Math.round(harmonicRaw) : idx + 1;
          const { weights, complexity } = harmonicWeights(harmonic);
          if (complexity > maxComplexityLocal) maxComplexityLocal = complexity;
          const ratioText = normalized.d === 1n ? `${normalized.n}` : `${normalized.n}/${normalized.d}`;
          const centsKey = (1200 * Math.log2(ratioValue)).toFixed(6);
          if (!entries.has(centsKey)) {
            entries.set(centsKey, {
              harmonic,
              ring,
              frac: fracTurn,
              turns,
              angle,
              position: new THREE.Vector3(x, y, z),
              ratioValue,
              ratioText,
              weights,
              complexity,
              order: ratioValue
            });
          }
        } catch {
          return;
        }
      });
      const ordered = Array.from(entries.values()).sort((a, b) => a.order - b.order);
      ordered.forEach((entry) => raw.push(entry));
    } else {
      for (let n = 1; n <= limit; n++) {
        const turnInfo = normalizeTurns(Math.log(n) / lnA);
        const turns = turnInfo.turns;
        const ring = turnInfo.ring;
        const frac = turnInfo.frac;
        const angle = frac * Math.PI * 2;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const y = turns * heightScale;

        const { weights, complexity } = harmonicWeights(n);
        if (complexity > maxComplexityLocal) maxComplexityLocal = complexity;

        const ratioValue = Math.pow(baseA, frac);
        const ratioText = formatCompact(ratioValue, 6);

        raw.push({
          harmonic: n,
          ring,
          frac,
          turns,
          angle,
          position: new THREE.Vector3(x, y, z),
          ratioValue,
          ratioText,
          weights,
          complexity,
          order: ratioValue
        });
      }
    }
    const out: HChromaPoint[] = raw.map((p) => {
      let mix: PrimaryMix | undefined;
      if (colorMode === 'primaryRatio' || showPrimaryTriplet) {
        mix = buildPrimaryMix(p.weights, colorBasis, primaryDen, p.complexity, maxComplexityLocal);
      }
      const color = colorMode === 'pure'
        ? spectrumColorFromFrac(p.frac, spectrumAnchors, primaryColors)
        : mix
          ? mix.color
          : mixColorFromWeights(p.weights, colorBasis, p.complexity, maxComplexityLocal);
      if (!mix && showPrimaryTriplet) {
        mix = buildPrimaryMix(p.weights, colorBasis, primaryDen, p.complexity, maxComplexityLocal);
      }
      return {
        harmonic: p.harmonic,
        ring: p.ring,
        frac: p.frac,
        turns: p.turns,
        angle: p.angle,
        position: p.position,
        color,
        ratioValue: p.ratioValue,
        ratioText: p.ratioText,
        weights: p.weights,
        complexity: p.complexity,
        mix
      };
    });
    return { points: out, maxComplexity: maxComplexityLocal };
  }, [baseA, limit, radius, heightScale, colorMode, primaryDen, showPrimaryTriplet, colorBasis, primaryColors, spectrumAnchors, caches, getAdditiveWeights, customRatios, useCustomRatios]);

  const activeHarmonics = React.useMemo(() => {
    if (!playingNodeIds || playingNodeIds.size === 0) return new Set<number>();
    const active = new Set<number>();
    const lnA = Math.log(baseA);
    const ids = Array.from(playingNodeIds.keys());
    const getFrac = (ratioValue: number) => {
      const turns = Math.log(ratioValue) / lnA;
      let frac = turns - Math.floor(turns);
      if (frac < 0) frac += 1;
      return frac;
    };
    ids.forEach((id) => {
      if (id.startsWith('hchroma-')) {
        const harmonic = parseInt(id.slice('hchroma-'.length), 10);
        if (Number.isFinite(harmonic)) active.add(harmonic);
        return;
      }
      const node = nodeById.get(id);
      if (!node) return;
      const ratioValue = Math.pow(2, node.cents / 1200);
      if (!Number.isFinite(ratioValue) || ratioValue <= 0) return;
      const frac = getFrac(ratioValue);
      let best: number | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const diff = Math.abs(frac - points[i].frac);
        const dist = Math.min(diff, 1 - diff);
        if (dist < bestDist) {
          bestDist = dist;
          best = points[i].harmonic;
        }
      }
      if (best !== null) active.add(best);
    });
    return active;
  }, [playingNodeIds, nodeById, points, baseA]);

  const branches = React.useMemo(() => {
    const nodes: HChromaBranchNode[] = [];
    const lines: HChromaBranchLine[] = [];
    if (!branchEnabled || useCustomRatios) return { nodes, lines };
    const lnA = Math.log(baseA);
    const selectedSet = new Set(branchSelected);
    const baseLengthPos = Math.max(0, branchLengthPos);
    const baseLengthNeg = Math.max(0, branchLengthNeg);
    const spacing = Math.max(3, branchSpacing);

    const addWeights = (base: MixWeights, add: MixWeights, mult: number) => ({
      a: base.a + add.a * mult,
      b: base.b + add.b * mult,
      c: base.c + add.c * mult
    });

    const primeWeights = (prime: number): MixWeights => getPrimeWeights(prime, lnA);

    const baseWeights = (base: number): { weights: MixWeights; complexity: number } => {
      let weights: MixWeights = { a: 0, b: 0, c: 0 };
      let complexity = 0;
      const oddPart = stripFactor2(base);
      if (oddPart === 1) return { weights, complexity };
      factorizeInteger(oddPart, (prime, exponent) => {
        weights = addWeights(weights, primeWeights(prime), exponent);
        complexity += exponent;
      });
      return { weights, complexity };
    };

    const resolveBranchBase = (harmonic: number, override?: { base?: number }) => {
      const raw = Number.isFinite(override?.base) ? (override?.base as number) : branchBase;
      if (raw > 0) return Math.max(1, Math.floor(raw));
      return Math.max(1, harmonic);
    };

    const buildBranchNode = (parent: HChromaPoint, base: number, exponent: number, position: THREE.Vector3) => {
      const parentWeights = parent.weights;
      const absExp = Math.abs(exponent);
      const ratioApprox = parent.harmonic * Math.pow(base, exponent);
      const ratioValue = Number.isFinite(ratioApprox) ? ratioApprox : 0;
      const baseInfo = baseWeights(base);
      const weights = addWeights(parentWeights, baseInfo.weights, exponent);

      const complexity = parent.complexity + baseInfo.complexity * absExp;
      const polarity = exponent < 0 ? -1 : 1;
      let mix: PrimaryMix | undefined;

      const color = parent.color;

      const basePow = powBigInt(BigInt(base), absExp);
      const baseNum = BigInt(parent.harmonic);
      let ratioNum = exponent >= 0 ? baseNum * basePow : baseNum;
      let ratioDen = exponent >= 0 ? 1n : basePow;
      const g = gcdBigInt(ratioNum, ratioDen);
      ratioNum /= g;
      ratioDen /= g;
      const valueText = ratioDen === 1n ? `${ratioNum}` : `${ratioNum}/${ratioDen}`;
      const formulaText = exponent >= 0
        ? `${parent.harmonic}*${base}^${absExp}`
        : `${parent.harmonic}/${base}^${absExp}`;
      return {
        id: `branch-${parent.harmonic}-${base}-${exponent}`,
        harmonic: parent.harmonic,
        exponent,
        base,
        position,
        color,
        ratioValue,
        valueText,
        formulaText,
        weights,
        complexity,
        mix
      };
    };

    points.forEach((p) => {
      if (branchScope === 'selected' && !selectedSet.has(p.harmonic)) return;
      const override = branchOverrides[p.harmonic];
      if (override?.enabled === false) return;
      const lengthPos = Math.max(0, Math.floor(override?.lengthPos ?? baseLengthPos));
      const lengthNeg = Math.max(0, Math.floor(override?.lengthNeg ?? baseLengthNeg));
      if (lengthPos === 0 && lengthNeg === 0) return;
      const base = resolveBranchBase(p.harmonic, override);

      const dir = new THREE.Vector3(p.position.x, 0, p.position.z);
      if (dir.lengthSq() <= EPS) {
        dir.set(1, 0, 0);
      } else {
        dir.normalize();
      }

      if (lengthPos > 0) {
        const linePts: THREE.Vector3[] = [p.position.clone()];
        for (let i = 1; i <= lengthPos; i++) {
          const offset = dir.clone().multiplyScalar(spacing * i);
          const pos = new THREE.Vector3(p.position.x + offset.x, p.position.y, p.position.z + offset.z);
          nodes.push(buildBranchNode(p, base, i, pos));
          linePts.push(pos);
        }
        lines.push({ id: `branch-line-${p.harmonic}-pos`, points: linePts });
      }

      if (lengthNeg > 0) {
        const linePts: THREE.Vector3[] = [p.position.clone()];
        for (let i = 1; i <= lengthNeg; i++) {
          const offset = dir.clone().multiplyScalar(-spacing * i);
          const pos = new THREE.Vector3(p.position.x + offset.x, p.position.y, p.position.z + offset.z);
          nodes.push(buildBranchNode(p, base, -i, pos));
          linePts.push(pos);
        }
        lines.push({ id: `branch-line-${p.harmonic}-neg`, points: linePts });
      }
    });

    return { nodes, lines };
  }, [
    branchEnabled,
    branchScope,
    branchSelected,
    branchOverrides,
    branchBase,
    branchLengthPos,
    branchLengthNeg,
    branchSpacing,
    maxComplexity,
    points,
    baseA,
    colorMode,
    primaryDen,
    showPrimaryTriplet,
    colorBasis,
    primaryColors,
    spectrumAnchors,
    getPrimeWeights,
    useCustomRatios
  ]);

  const spectrumRings = React.useMemo(() => {
    if (useCustomRatios || !spectrumSplitEnabled || !selectedHarmonic) return { nodes: [], lines: [] };

    const centerPoint = points.find(p => p.harmonic === selectedHarmonic);
    if (!centerPoint) return { nodes: [], lines: [] };

    const nodes: HChromaBranchNode[] = [];
    const lines: HChromaBranchLine[] = [];
    const factors = [2, 3, 5];
    const ringSpacing = 12 * (visuals.globalScale ?? 1);
    const lnA = Math.log(baseA);

    const addWeights = (base: MixWeights, add: MixWeights, mult: number) => ({
      a: base.a + add.a * mult,
      b: base.b + add.b * mult,
      c: base.c + add.c * mult
    });

    const createNode = (h: number, pos: THREE.Vector3, parentWeights: MixWeights, parentComplexity: number): HChromaBranchNode => {
      const turnInfo = normalizeTurns(Math.log(h) / lnA);
      const { weights: myW, complexity: myC } = { weights: getAdditiveWeights(h), complexity: 0 };

      const ratioValue = Math.pow(baseA, turnInfo.frac);

      const mix = (colorMode === 'primaryRatio' || showPrimaryTriplet)
        ? buildPrimaryMix(myW, colorBasis, primaryDen, myC, maxComplexity)
        : undefined;

      const color = colorMode === 'pure'
        ? spectrumColorFromFrac(turnInfo.frac, spectrumAnchors, primaryColors)
        : mix ? mix.color : mixColorFromWeights(myW, colorBasis, myC, maxComplexity);

      return {
        id: `spectrum-${h}`,
        harmonic: h,
        exponent: 0,
        base: 0,
        position: pos,
        color,
        ratioValue,
        valueText: `${h}`,
        formulaText: `${h}`,
        weights: myW,
        complexity: myC,
        mix
      };
    };

    const visited = new Map<number, THREE.Vector3>();
    visited.set(selectedHarmonic, centerPoint.position);

    let currentLayer = [selectedHarmonic];

    for (let d = 1; d <= spectrumDepth; d++) {
      const nextLayer: number[] = [];
      const ringRadius = d * ringSpacing;

      const layerCandidates = new Set<number>();
      currentLayer.forEach(p => {
        factors.forEach(f => layerCandidates.add(p * f));
      });

      const sortedCandidates = Array.from(layerCandidates).sort((a, b) => {
        const angleA = normalizeTurns(Math.log(a) / lnA).frac;
        const angleB = normalizeTurns(Math.log(b) / lnA).frac;
        return angleA - angleB;
      });

      sortedCandidates.forEach((h, i) => {
        if (visited.has(h)) return;

        const turn = normalizeTurns(Math.log(h) / lnA);
        const angle = turn.frac * Math.PI * 2;

        const cx = centerPoint.position.x;
        const cy = centerPoint.position.y;
        const cz = centerPoint.position.z;

        const px = cx + ringRadius * Math.cos(angle);
        const pz = cz + ringRadius * Math.sin(angle);
        const py = cy;

        const pos = new THREE.Vector3(px, py, pz);
        visited.set(h, pos);
        nextLayer.push(h);

        const node = createNode(h, pos, centerPoint.weights, centerPoint.complexity);
        nodes.push(node);

        factors.forEach(f => {
          if (h % f === 0) {
            const parent = h / f;
            if (visited.has(parent)) {
              const pPos = visited.get(parent)!;

              lines.push({
                id: `spec-line-${parent}-${h}`,
                points: [pPos, pos]
              });
            }
          }
        });
      });
      currentLayer = nextLayer;
    }

    return { nodes, lines };
  }, [spectrumSplitEnabled, spectrumDepth, selectedHarmonic, points, baseA, colorMode, primaryDen, showPrimaryTriplet, colorBasis, primaryColors, spectrumAnchors, visuals.globalScale, getAdditiveWeights, maxComplexity, useCustomRatios]);

  const maxTurns = React.useMemo(() => {
    const lnA = Math.log(baseA);
    return limit <= 1 ? 0 : Math.log(limit) / lnA;
  }, [baseA, limit]);

  const rings = React.useMemo(() => {
    const count = Math.max(0, Math.ceil(maxTurns));
    const segments = 96;
    const ringsOut: { y: number; points: THREE.Vector3[] }[] = [];
    for (let k = 0; k <= count; k++) {
      const y = k * heightScale;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(radius * Math.cos(t), y, radius * Math.sin(t)));
      }
      ringsOut.push({ y, points: pts });
    }
    return ringsOut;
  }, [maxTurns, heightScale, radius]);

  const formatHarmonicLabel = (n: number) => {
    const s = n.toString();
    if (s.length < 6) return s;

    const factors: { p: number, k: number }[] = [];
    factorizeInteger(n, (p, k) => factors.push({ p, k }));

    if (factors.length === 0) return s;

    return factors.map(f => {
      if (f.k === 1) return `${f.p}`;
      return `${f.p}^${f.k}`;
    }).join('*');
  };

  const labelForPoint = (p: HChromaPoint) => {
    if (labelMode === 'none') return '';
    const effectiveMode = useCustomRatios && labelMode === 'harmonic' ? 'ratio' : labelMode;
    const h = formatHarmonicLabel(p.harmonic);
    const r = p.ratioText;
    const triplet = showPrimaryTriplet && p.mix ? `\n[2:3:5] ${p.mix.label}` : '';
    if (effectiveMode === 'harmonic') return `${h}${triplet}`;
    if (effectiveMode === 'ratio') return `${r}${triplet}`;
    return `${h}\n${r}${triplet}`;
  };

  const labelForBranch = (b: HChromaBranchNode) => {
    if (labelMode === 'none') return '';
    const h = b.valueText;
    const r = b.formulaText;
    const triplet = showPrimaryTriplet && b.mix ? `\n[2:3:5] ${b.mix.label}` : '';
    if (labelMode === 'harmonic') return `${h}${triplet}`;
    if (labelMode === 'ratio') return `${r}${triplet}`;
    return `${h}\n(${r})${triplet}`;
  };

  const getVerificationText = (p: HChromaPoint) => {
    if (useCustomRatios) return "";
    const n = p.harmonic;
    if (n <= 5) return "";
    const n1 = Math.floor(n / 2);
    const n2 = Math.ceil(n / 2);

    const addW = p.weights;
    const addLabel = `${Math.round(addW.a)}:${Math.round(addW.b)}:${Math.round(addW.c)}`;
    return `\nSum: ${n1} + ${n2} = ${n}\nAdd.Vec: [${addLabel}]`;
  };

  const handleNodeClick = (p: HChromaPoint, e: any) => {
    e.stopPropagation();
    const baseFreq = Number.isFinite(settings.baseFrequency) ? settings.baseFrequency : 440;
    const freq = baseFreq * p.ratioValue;
    const stop = startFrequency(freq, settings, 'click', 0, undefined, 1, `h${p.harmonic}`);
    const durationMs = Math.max(0.1, settings.playDurationSingle ?? 0.6) * 1000;
    window.setTimeout(() => stop(), durationMs);

    const selected = Array.isArray(visuals.hChromaBranchSelected) ? visuals.hChromaBranchSelected : [];
    let nextSelected = selected;
    if (branchScope === 'selected') {
      if (e.shiftKey) {
        nextSelected = selected.includes(p.harmonic)
          ? selected.filter(h => h !== p.harmonic)
          : [...selected, p.harmonic];
      } else if (!selected.includes(p.harmonic)) {
        nextSelected = [...selected, p.harmonic];
      }
    }
    updateVisualSettings({
      hChromaBranchSelectedHarmonic: p.harmonic,
      hChromaBranchSelected: nextSelected
    });
  };

  const hChromaAutoRotate = false;
  const hChromaAutoRotateSpeed = 0;

  const groupRef = React.useRef<THREE.Group>(null);

  React.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = 0;
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
    }
  }, []);

  return (
    <group ref={groupRef} rotation={[0, 0, 0]}>
      {rings.map((r, idx) => (
        <Line
          key={`hchroma-ring-${idx}`}
          points={r.points}
          color={idx === 0 ? '#64748B' : '#334155'}
          lineWidth={1}
          transparent
          opacity={idx === 0 ? 0.8 : 0.45}
        />
      ))}

      <Line
        points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, maxTurns * heightScale, 0)]}
        color="#334155"
        lineWidth={1}
        transparent
        opacity={0.6}
      />

      {branches.lines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color="#1f2937"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}

      {spectrumRings.lines.map((line) => (
        <Line
          key={line.id}
          points={line.points}
          color="#4B5563"
          lineWidth={1}
          transparent
          opacity={0.4}
        />
      ))}

      {branches.nodes.map((b) => (
        <group key={b.id} position={b.position.toArray()}>
          <mesh>
            <sphereGeometry args={[0.8, 14, 14]} />
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.2} roughness={0.4} metalness={0.05} />
          </mesh>

          {labelMode !== 'none' && (
            <Billboard position={[0, 2.0 * labelScale, 0]} follow>
              <Text
                fontSize={0.75 * labelScale}
                color="#E5E7EB"
                outlineWidth={0.1 * labelScale}
                outlineColor="black"
                anchorX="center"
                anchorY="middle"
                maxWidth={36 * labelScale}
                textAlign="center"
                lineHeight={0.95}
                material-depthTest={false}
                material-depthWrite={false}
              >
                {labelForBranch(b)}
              </Text>
            </Billboard>
          )}
        </group>
      ))}

      {spectrumRings.nodes.map((b) => (
        <group key={b.id} position={b.position.toArray()}>
          <mesh>
            <cylinderGeometry args={[0.6 * labelScale, 0.6 * labelScale, 0.2 * labelScale, 16]} />
            <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.3} roughness={0.4} metalness={0.1} />
          </mesh>

          {labelMode !== 'none' && (
            <Billboard position={[0, 1.5 * labelScale, 0]} follow>
              <Text
                fontSize={0.6 * labelScale}
                color="#D1D5DB"
                outlineWidth={0.08 * labelScale}
                outlineColor="black"
                anchorX="center"
                anchorY="middle"
                maxWidth={30 * labelScale}
                textAlign="center"
                lineHeight={0.95}
                material-depthTest={false}
                material-depthWrite={false}
              >
                {labelForBranch(b)}
              </Text>
            </Billboard>
          )}
        </group>
      ))}

      {points.map(p => (
        <group
          key={`hchroma-${p.harmonic}`}
          position={p.position.toArray()}
          scale={activeHarmonics.has(p.harmonic) ? [1.35, 1.35, 1.35] : [1, 1, 1]}
        >
          <mesh
            onClick={(e) => handleNodeClick(p, e)}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(p); }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered((cur) => (cur?.harmonic === p.harmonic ? null : cur)); }}
          >
            <sphereGeometry args={[1.2, 18, 18]} />
            <meshStandardMaterial
              color={p.color}
              emissive={p.color}
              emissiveIntensity={activeHarmonics.has(p.harmonic) ? 0.9 : 0.25}
              roughness={0.35}
              metalness={0.05}
            />
          </mesh>

          {labelMode !== 'none' && (
            <Billboard position={[0, 2.4 * labelScale, 0]} follow>
              <Text
                fontSize={0.9 * labelScale}
                color="#E5E7EB"
                outlineWidth={0.12 * labelScale}
                outlineColor="black"
                anchorX="center"
                anchorY="middle"
                maxWidth={40 * labelScale}
                textAlign="center"
                lineHeight={0.95}
                material-depthTest={false}
                material-depthWrite={false}
              >
                {labelForPoint(p)}
              </Text>
            </Billboard>
          )}
        </group>
      ))}

      {hovered && (
        <Billboard position={[0, -8, 0]} follow>
          <Text
            fontSize={2.5 * labelScale}
            color="#93C5FD"
            outlineWidth={0.2 * labelScale}
            outlineColor="black"
            anchorX="center"
            anchorY="middle"
            maxWidth={100 * labelScale}
            textAlign="center"
            lineHeight={1.0}
            material-depthTest={false}
            material-depthWrite={false}
          >
            {`H ${hovered.harmonic}\n${hovered.ratioText}${showPrimaryTriplet && hovered.mix ? `\n[2:3:5] ${hovered.mix.label}` : ''}${getVerificationText(hovered)}`}
          </Text>
        </Billboard>
      )}
    </group>
  );
};
