import { DEFAULT_TIMBRE_PATCHES, TIMBRE_PATCH_SCHEMA_VERSION } from '../timbrePresets';
import { migrateTimbrePatch as migratePatchCore } from '../timbreEngine/patchMigrations';
import {
  isTimbreModSource,
  isTimbreModTarget,
  TIMBRE_MOD_SOURCES,
  TIMBRE_MOD_TARGETS
} from '../timbreEngine/paramRegistry';
import type {
  TimbreMacro,
  TimbreMacroRoute,
  TimbreModRoute,
  TimbreModSource,
  TimbreModTarget,
  TimbrePatch
} from '../types';

const cloneDeep = <T,>(data: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

export const createPatchId = () => `timbre - ${Date.now()} -${Math.random().toString(36).slice(2, 6)} `;

export const ensureTable = (table: number[] | undefined, size: number) => {
  const next = Array.isArray(table) ? [...table] : [];
  while (next.length < size) next.push(-1);
  if (next.length > size) next.length = size;
  return next;
};

export const ensureMacro = (macro: Partial<TimbreMacro>, index: number): TimbreMacro => ({
  id: macro.id || `macro${index + 1} `,
  name: macro.name || `Macro ${index + 1} `,
  value: Number.isFinite(macro.value) ? (macro.value as number) : 0,
  min: Number.isFinite(macro.min) ? (macro.min as number) : 0,
  max: Number.isFinite(macro.max) ? (macro.max as number) : 1,
  curve: macro.curve || 'linear',
  source: macro.source,
  routes: Array.isArray(macro.routes) ? macro.routes.map(ensureMacroRoute) : []
});

export const ensureMacroRoute = (route: Partial<TimbreMacroRoute>): TimbreMacroRoute => ({
  target: isTimbreModTarget(String(route.target ?? ''))
    ? (route.target as TimbreModTarget)
    : (TIMBRE_MOD_TARGETS[0] || 'overallGain'),
  depth: Number.isFinite(route.depth) ? (route.depth as number) : 0,
  curve: route.curve || 'linear',
  bipolar: route.bipolar ?? false,
  offset: Number.isFinite(route.offset) ? (route.offset as number) : 0,
  scale: Number.isFinite(route.scale) ? (route.scale as number) : 1,
  clampMin: Number.isFinite(route.clampMin) ? (route.clampMin as number) : undefined,
  clampMax: Number.isFinite(route.clampMax) ? (route.clampMax as number) : undefined,
  deadzone: Number.isFinite(route.deadzone) ? (route.deadzone as number) : 0,
  invert: route.invert ?? false,
  smoothingMs: Number.isFinite(route.smoothingMs) ? (route.smoothingMs as number) : 0,
  blendMode: route.blendMode || route.combineMode || 'sum',
  combineMode: route.combineMode || route.blendMode,
  curveAmount: Number.isFinite(route.curveAmount) ? (route.curveAmount as number) : undefined,
  curveSteps: Number.isFinite(route.curveSteps) ? (route.curveSteps as number) : undefined
});

export const ensureRoute = (route: Partial<TimbreModRoute>, index: number): TimbreModRoute => ({
  id: route.id || `mod - ${Date.now()} -${index} `,
  source: isTimbreModSource(String(route.source ?? ''))
    ? (route.source as TimbreModSource)
    : (TIMBRE_MOD_SOURCES[0] || 'velocity'),
  target: isTimbreModTarget(String(route.target ?? ''))
    ? (route.target as TimbreModTarget)
    : (TIMBRE_MOD_TARGETS[0] || 'overallGain'),
  depth: Number.isFinite(route.depth) ? (route.depth as number) : 0,
  curve: route.curve || 'linear',
  bipolar: route.bipolar ?? false,
  offset: Number.isFinite(route.offset) ? (route.offset as number) : 0,
  scale: Number.isFinite(route.scale) ? (route.scale as number) : 1,
  clampMin: Number.isFinite(route.clampMin) ? (route.clampMin as number) : undefined,
  clampMax: Number.isFinite(route.clampMax) ? (route.clampMax as number) : undefined,
  deadzone: Number.isFinite(route.deadzone) ? (route.deadzone as number) : 0,
  invert: route.invert ?? false,
  smoothingMs: Number.isFinite(route.smoothingMs) ? (route.smoothingMs as number) : 0,
  blendMode: route.blendMode || route.combineMode || 'sum',
  combineMode: route.combineMode || route.blendMode,
  curveAmount: Number.isFinite(route.curveAmount) ? (route.curveAmount as number) : undefined,
  curveSteps: Number.isFinite(route.curveSteps) ? (route.curveSteps as number) : undefined,
  phaseOffset: Number.isFinite(route.phaseOffset) ? (route.phaseOffset as number) : 0
});

const stripMigration = <T extends Partial<TimbrePatch>>(patch: T): T => {
  if (!patch || typeof patch !== 'object') return patch;
  if (!('migration' in patch)) return patch;
  const { migration: _migration, ...rest } = patch as any;
  return rest as T;
};

export const migrateTimbrePatch = (
  raw: Partial<TimbrePatch>,
  options?: { migrate?: boolean; debug?: boolean; includeMigration?: boolean; includeMigrationBackup?: boolean }
) => {
  const result = migratePatchCore(raw, options);
  const patch = stripMigration(result.patch as Partial<TimbrePatch>);
  if (result.migration && (options?.includeMigration || options?.debug)) {
    const migration = options?.includeMigrationBackup
      ? result.migration
      : { ...result.migration, backup: undefined };
    return {
      ...patch,
      migration
    } as Partial<TimbrePatch>;
  }
  return patch;
};

export const normalizeTimbrePatch = (
  raw: Partial<TimbrePatch>,
  options?: { migrate?: boolean; debug?: boolean; includeMigration?: boolean; includeMigrationBackup?: boolean }
): TimbrePatch => {
  const migrated = migrateTimbrePatch(raw, options);
  const template = cloneDeep(DEFAULT_TIMBRE_PATCHES[0]);
  const merged: TimbrePatch = {
    ...template,
    ...migrated,
    schemaVersion: TIMBRE_PATCH_SCHEMA_VERSION,
    id: migrated.id || createPatchId(),
    name: migrated.name || template.name,
    tags: migrated.tags || template.tags,
    folder: migrated.folder || template.folder,
    voice: { ...template.voice, ...(migrated.voice || {}) },
    performance: { ...template.performance, ...(migrated.performance || {}) },
    routing: { ...template.routing, ...(migrated.routing || {}) },
    macros: Array.isArray(migrated.macros) ? migrated.macros.map(ensureMacro) : template.macros.map(ensureMacro),
    modMatrix: Array.isArray(migrated.modMatrix) ? migrated.modMatrix.map(ensureRoute) : []
  };

  merged.voice.oscBank = { ...template.voice.oscBank, ...(migrated.voice?.oscBank || {}) };
  merged.voice.harmonic = { ...template.voice.harmonic, ...(migrated.voice?.harmonic || {}) };
  merged.voice.harmonic.table = ensureTable(merged.voice.harmonic.table, merged.voice.harmonic.tableSize);
  merged.voice.unison = { ...template.voice.unison, ...(migrated.voice?.unison || {}) };
  merged.voice.noise = { ...template.voice.noise, ...(migrated.voice?.noise || {}) };
  merged.voice.sample = { ...template.voice.sample, ...(migrated.voice?.sample || {}) };
  merged.voice.sample.layers = Array.isArray(merged.voice.sample.layers) ? merged.voice.sample.layers : [];
  merged.voice.sample.releaseSamples = Array.isArray(merged.voice.sample.releaseSamples) ? merged.voice.sample.releaseSamples : [];
  merged.voice.sample.legatoTransitions = Array.isArray(merged.voice.sample.legatoTransitions) ? merged.voice.sample.legatoTransitions : [];
  merged.voice.vaOsc = { ...template.voice.vaOsc, ...(migrated.voice?.vaOsc || {}) };
  merged.voice.vaOsc.osc1 = { ...template.voice.vaOsc.osc1, ...(migrated.voice?.vaOsc?.osc1 || {}) };
  merged.voice.vaOsc.osc2 = { ...template.voice.vaOsc.osc2, ...(migrated.voice?.vaOsc?.osc2 || {}) };
  merged.voice.vaOsc.subOsc = { ...template.voice.vaOsc.subOsc, ...(migrated.voice?.vaOsc?.subOsc || {}) };
  merged.voice.vaOsc.noiseOsc = { ...template.voice.vaOsc.noiseOsc, ...(migrated.voice?.vaOsc?.noiseOsc || {}) };
  merged.voice.envelopes = { ...template.voice.envelopes, ...(migrated.voice?.envelopes || {}) };
  merged.voice.envelopes.amp = { ...template.voice.envelopes.amp, ...(migrated.voice?.envelopes?.amp || {}) };
  merged.voice.envelopes.filter = { ...template.voice.envelopes.filter, ...(migrated.voice?.envelopes?.filter || {}) };
  merged.voice.envelopes.spectralDecay = { ...template.voice.envelopes.spectralDecay, ...(migrated.voice?.envelopes?.spectralDecay || {}) };
  merged.voice.filter = { ...template.voice.filter, ...(migrated.voice?.filter || {}) };
  merged.voice.filter.comb = { ...template.voice.filter.comb, ...(migrated.voice?.filter?.comb || {}) };
  merged.voice.filter.formant = { ...template.voice.filter.formant, ...(migrated.voice?.filter?.formant || {}) };
  if (migrated.voice?.filter?.envAmount === undefined && migrated.voice?.envelopes?.filter?.amount !== undefined) {
    merged.voice.filter.envAmount = migrated.voice.envelopes.filter.amount;
  }
  merged.voice.masterFilter = { ...template.voice.masterFilter, ...(migrated.voice?.masterFilter || {}) };
  merged.voice.eq = { ...template.voice.eq, ...(migrated.voice?.eq || {}) };
  merged.voice.fm = { ...template.voice.fm, ...(migrated.voice?.fm || {}) };
  merged.voice.fmOperators = { ...template.voice.fmOperators, ...(migrated.voice?.fmOperators || {}) };
  if (Array.isArray(migrated.voice?.fmOperators?.operators)) {
    const ops = migrated.voice.fmOperators!.operators;
    merged.voice.fmOperators.operators = [
      { ...template.voice.fmOperators.operators[0], ...ops[0] },
      { ...template.voice.fmOperators.operators[1], ...ops[1] },
      { ...template.voice.fmOperators.operators[2], ...ops[2] },
      { ...template.voice.fmOperators.operators[3], ...ops[3] }
    ];
  }
  merged.voice.ringMod = { ...template.voice.ringMod, ...(migrated.voice?.ringMod || {}) };
  merged.voice.mseg = { ...template.voice.mseg, ...(migrated.voice?.mseg || {}) };
  merged.voice.mseg.points = Array.isArray(merged.voice.mseg.points) && merged.voice.mseg.points.length > 0
    ? merged.voice.mseg.points
    : template.voice.mseg.points;
  merged.voice.nonlinearity = { ...template.voice.nonlinearity, ...(migrated.voice?.nonlinearity || {}) };
  merged.voice.space = { ...template.voice.space, ...(migrated.voice?.space || {}) };
  merged.voice.space.reverb = { ...template.voice.space.reverb, ...(migrated.voice?.space?.reverb || {}) };
  merged.voice.space.resonance = { ...template.voice.space.resonance, ...(migrated.voice?.space?.resonance || {}) };
  merged.voice.sympathetic = { ...template.voice.sympathetic, ...(migrated.voice?.sympathetic || {}) };
  merged.voice.mechanicalNoise = { ...template.voice.mechanicalNoise, ...(migrated.voice?.mechanicalNoise || {}) };
  merged.voice.chorus = { ...template.voice.chorus, ...(migrated.voice?.chorus || {}) };
  merged.voice.phaser = { ...template.voice.phaser, ...(migrated.voice?.phaser || {}) };
  merged.voice.delay = { ...template.voice.delay, ...(migrated.voice?.delay || {}) };
  merged.voice.bitcrush = { ...template.voice.bitcrush, ...(migrated.voice?.bitcrush || {}) };
  merged.voice.granular = { ...template.voice.granular, ...(migrated.voice?.granular || {}) };
  merged.voice.compressor = { ...template.voice.compressor, ...(migrated.voice?.compressor || {}) };
  merged.voice.limiter = { ...template.voice.limiter, ...(migrated.voice?.limiter || {}) };
  merged.voice.lfo = { ...template.voice.lfo, ...(migrated.voice?.lfo || {}) };
  merged.voice.lfo.lfo1 = { ...template.voice.lfo.lfo1, ...(migrated.voice?.lfo?.lfo1 || {}) };
  merged.voice.lfo.lfo2 = { ...template.voice.lfo.lfo2, ...(migrated.voice?.lfo?.lfo2 || {}) };
  merged.voice.lfo.lfo3 = { ...template.voice.lfo.lfo3, ...(migrated.voice?.lfo?.lfo3 || {}) };
  merged.voice.lfo.lfo4 = { ...template.voice.lfo.lfo4, ...(migrated.voice?.lfo?.lfo4 || {}) };
  merged.voice.karplus = { ...template.voice.karplus, ...(migrated.voice?.karplus || {}) };
  merged.voice.oscBank.sync = { ...template.voice.oscBank.sync, ...(migrated.voice?.oscBank?.sync || {}) };

  if (Array.isArray(migrated.layers)) {
    merged.layers = migrated.layers.map(layer => ({
      id: layer.id || `layer-${Math.random().toString(36).slice(2, 6)}`,
      name: layer.name,
      sourceType: layer.sourceType,
      level: Number.isFinite(layer.level) ? layer.level : 1,
      pan: Number.isFinite(layer.pan) ? layer.pan : 0,
      tuneCents: Number.isFinite(layer.tuneCents) ? layer.tuneCents : 0,
      mute: layer.mute ?? false,
      solo: layer.solo ?? false,
      voiceOverride: layer.voiceOverride,
      send: layer.send
    }));
  }

  return merged;
};
