
export type CommaSearchState = {
  centsMax: number;
  radiusMax: number;
  emax: number;
  showAll: boolean;
  useJND: boolean;
  jndFactor: number;
  refHz: number;
  primes: number[];
};

export type SimplifyState = {
  enabled: boolean;
  mode: "ghost" | "prune" | "collapse";
  useEar: boolean;
  usePerNodeFreq: boolean;
  refHz: number;
  factor: number;
};

export type ToolProfile = {
  name: string;
  createdAt: number;
  updatedAt: number;
  comma: CommaSearchState;
  simplify: SimplifyState;
};

const KEY = "CommaJNDToolProfilesV1";
const ACTIVE = "CommaJNDToolActiveProfileV1";

export function defaultComma(): CommaSearchState {
  return { centsMax: 40, radiusMax: 8, emax: 6, showAll: false, useJND: true, jndFactor: 1.0, refHz: 440, primes: [2,3,5,7,11] };
}
export function defaultSimplify(): SimplifyState {
  return { enabled: false, mode: "ghost", useEar: true, usePerNodeFreq: true, refHz: 440, factor: 1.0 };
}

export function loadProfiles(): ToolProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v;
  } catch {}
  return [];
}

export function saveProfiles(profiles: ToolProfile[]) {
  try { localStorage.setItem(KEY, JSON.stringify(profiles)); } catch {}
}

export function loadActiveName(): string | null {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}

export function saveActiveName(name: string) {
  try { localStorage.setItem(ACTIVE, name); } catch {}
}

export function getOrCreateDefaultProfile(): ToolProfile {
  const now = Date.now();
  return { name: "Default", createdAt: now, updatedAt: now, comma: defaultComma(), simplify: defaultSimplify() };
}

export function ensureProfiles(): ToolProfile[] {
  const p = loadProfiles();
  if (p.length) return p;
  const d = [getOrCreateDefaultProfile()];
  saveProfiles(d);
  saveActiveName("Default");
  return d;
}

export function findProfile(name: string): ToolProfile | null {
  const ps = ensureProfiles();
  return ps.find(x=>x.name===name) || null;
}

export function upsertProfile(profile: ToolProfile) {
  const ps = ensureProfiles();
  const idx = ps.findIndex(x=>x.name===profile.name);
  if (idx>=0) ps[idx] = profile; else ps.push(profile);
  saveProfiles(ps);
}

export function deleteProfile(name: string) {
  const ps = ensureProfiles().filter(x=>x.name!==name);
  saveProfiles(ps);
  const active = loadActiveName();
  if (active===name) saveActiveName(ps[0]?.name || "Default");
}

export function readWindowState(): { comma: CommaSearchState; simplify: SimplifyState } {
  const w = (window as any).__commaJNDToolState;
  if (w?.comma && w?.simplify) return w;
  const active = loadActiveName() || "Default";
  const p = findProfile(active) || getOrCreateDefaultProfile();
  const s = { comma: p.comma, simplify: p.simplify };
  (window as any).__commaJNDToolState = s;
  return s;
}

export function writeWindowState(next: { comma: CommaSearchState; simplify: SimplifyState }) {
  (window as any).__commaJNDToolState = next;
  const active = loadActiveName() || "Default";
  const p = findProfile(active) || getOrCreateDefaultProfile();
  const now = Date.now();
  const updated: ToolProfile = { ...p, updatedAt: now, comma: next.comma, simplify: next.simplify };
  upsertProfile(updated);
}
