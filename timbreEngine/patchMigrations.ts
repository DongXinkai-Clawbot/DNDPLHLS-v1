import type { TimbrePatch } from '../types';
import { DEFAULT_TIMBRE_PATCHES, TIMBRE_PATCH_SCHEMA_VERSION } from '../timbrePresets';

export type TimbreMigrationLog = {
  fromVersion: number;
  toVersion: number;
  notes: string[];
  timestamp: string;
  backup?: any;
  applied?: string[];
};

const cloneDeep = <T,>(data: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

type MigrationContext = {
  template: TimbrePatch;
  notes: string[];
  applied: string[];
};

type MigrationStep = {
  from: number;
  to: number;
  id: string;
  apply: (patch: Partial<TimbrePatch>, ctx: MigrationContext) => Partial<TimbrePatch>;
};

const ensureVoiceDefaults = (patch: Partial<TimbrePatch>, template: TimbrePatch) => {
  const next = cloneDeep(patch);
  if (!next.voice) next.voice = cloneDeep(template.voice);
  if (!next.performance) next.performance = cloneDeep(template.performance);
  if (!next.routing) next.routing = cloneDeep(template.routing);
  return next;
};

const migrateV1ToV2: MigrationStep = {
  from: 1,
  to: 2,
  id: 'v1->v2',
  apply: (patch, ctx) => {
    const next = ensureVoiceDefaults(patch, ctx.template);
    if (next.performance) {
      next.performance = {
        ...next.performance,
        voiceSteal: next.performance.voiceSteal ?? 'release-first',
        pitchBendRangeSemitones: next.performance.pitchBendRangeSemitones ?? 2,
        rebuildCrossfadeMs: next.performance.rebuildCrossfadeMs ?? 20
      };
    }
    if (Array.isArray(next.macros)) {
      next.macros = next.macros.map((macro) => ({
        ...macro,
        routes: Array.isArray(macro.routes) ? macro.routes : []
      }));
    }
    if (next.voice?.filter && next.voice.filter.envAmount === undefined && next.voice.envelopes?.filter?.amount !== undefined) {
      next.voice.filter.envAmount = next.voice.envelopes.filter.amount;
    }
    ctx.notes.push('Applied v2 defaults for performance fields, macro routes, and filter env amount.');
    return next;
  }
};

const migrateV2ToV3: MigrationStep = {
  from: 2,
  to: 3,
  id: 'v2->v3',
  apply: (patch, ctx) => {
    const next = ensureVoiceDefaults(patch, ctx.template);
    if (next.voice) {
      next.voice = {
        ...ctx.template.voice,
        ...next.voice,
        sample: next.voice.sample ?? cloneDeep(ctx.template.voice.sample),
        vaOsc: next.voice.vaOsc ?? cloneDeep(ctx.template.voice.vaOsc),
        fmOperators: next.voice.fmOperators ?? cloneDeep(ctx.template.voice.fmOperators),
        mechanicalNoise: next.voice.mechanicalNoise ?? cloneDeep(ctx.template.voice.mechanicalNoise),
        sympathetic: next.voice.sympathetic ?? cloneDeep(ctx.template.voice.sympathetic)
      } as any;
    }
    ctx.notes.push('Applied v3 defaults for sample engine, VA osc, FM operators, mechanical noise, and sympathetic resonance.');
    return next;
  }
};

const migrateV3ToV4: MigrationStep = {
  from: 3,
  to: 4,
  id: 'v3->v4',
  apply: (patch, ctx) => {
    const next = ensureVoiceDefaults(patch, ctx.template);
    if (next.voice) {
      next.voice = {
        ...ctx.template.voice,
        ...next.voice,
        filter: {
          ...ctx.template.voice.filter,
          ...next.voice.filter,
          comb: next.voice.filter?.comb ?? cloneDeep(ctx.template.voice.filter.comb),
          formant: next.voice.filter?.formant ?? cloneDeep(ctx.template.voice.filter.formant)
        },
        bitcrush: next.voice.bitcrush ?? cloneDeep(ctx.template.voice.bitcrush),
        granular: next.voice.granular ?? cloneDeep(ctx.template.voice.granular)
      } as any;
      if (next.voice.bitcrush && next.voice.bitcrush.bitDepth === undefined && typeof next.voice.bitcrush.depth === 'number') {
        const depth = Math.max(0, Math.min(1, next.voice.bitcrush.depth));
        next.voice.bitcrush.bitDepth = Math.round(2 + (1 - depth) * 14);
      }
      if (next.voice.bitcrush && next.voice.bitcrush.sampleRateReduce === undefined && typeof next.voice.bitcrush.sampleRate === 'number') {
        const sr = Math.max(0, Math.min(1, next.voice.bitcrush.sampleRate));
        next.voice.bitcrush.sampleRateReduce = Math.round(1 + sr * 15);
      }
    }
    if (next.routing) {
      next.routing = {
        ...ctx.template.routing,
        ...next.routing,
        enableBitcrush: next.routing.enableBitcrush ?? true,
        enableGranular: next.routing.enableGranular ?? true
      };
    }
    ctx.notes.push('Applied v4 defaults for filter comb/formant, granular, and bitcrush settings.');
    return next;
  }
};

const MIGRATIONS: MigrationStep[] = [migrateV1ToV2, migrateV2ToV3, migrateV3ToV4];

export const migrateTimbrePatch = (
  raw: Partial<TimbrePatch>,
  options?: { migrate?: boolean; debug?: boolean; preserveUnknown?: boolean }
) => {
  const migrate = options?.migrate !== false;
  if (!migrate) {
    return {
      patch: raw,
      migration: {
        fromVersion: raw.schemaVersion ?? 0,
        toVersion: raw.schemaVersion ?? 0,
        notes: ['Migration disabled (read-only preview mode).'],
        applied: [],
        timestamp: new Date().toISOString(),
        backup: options?.preserveUnknown ? cloneDeep(raw) : undefined
      } as TimbreMigrationLog
    };
  }

  const template = DEFAULT_TIMBRE_PATCHES[0];
  const fromVersion = Number.isFinite(raw.schemaVersion) ? (raw.schemaVersion as number) : 0;
  const targetVersion = TIMBRE_PATCH_SCHEMA_VERSION;
  if (fromVersion >= targetVersion) {
    return { patch: raw, migration: null as TimbreMigrationLog | null };
  }

  const ctx: MigrationContext = { template, notes: [], applied: [] };
  let next = cloneDeep(raw);
  const backup = cloneDeep(raw);
  let current = fromVersion;

  while (current < targetVersion) {
    const step = MIGRATIONS.find(m => m.from === current);
    if (!step) {
      ctx.notes.push(`No migration step found for v${current} -> v${current + 1}; preserving fields.`);
      current += 1;
      continue;
    }
    next = step.apply(next, ctx);
    ctx.applied.push(step.id);
    current = step.to;
  }

  next.schemaVersion = targetVersion;
  const migration: TimbreMigrationLog = {
    fromVersion,
    toVersion: targetVersion,
    notes: ctx.notes,
    applied: ctx.applied,
    timestamp: new Date().toISOString(),
    backup
  };

  if (options?.debug) {
    // Debug-only logging to avoid noisy output in production.
    console.debug('[timbre] patch migration', migration);
  }

  return { patch: next, migration };
};
