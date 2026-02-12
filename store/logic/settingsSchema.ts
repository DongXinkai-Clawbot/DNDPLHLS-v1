import type { AppSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';

export const SETTINGS_SCHEMA_VERSION = 2;

type PersistedEnvelope<T> = {
  v: number;
  data: T;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const filterSettings = (data: Record<string, unknown>): Partial<AppSettings> => {
  const allowed = new Set<string>(Object.keys(DEFAULT_SETTINGS));
  const filtered: Partial<AppSettings> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (allowed.has(key)) {
      (filtered as any)[key] = value;
    }
  });
  return filtered;
};

export const wrapSettingsPayload = (data: Partial<AppSettings>): PersistedEnvelope<Partial<AppSettings>> => ({
  v: SETTINGS_SCHEMA_VERSION,
  data,
});

export const parseSettingsPayload = (raw: string, reviver?: (key: string, value: any) => any) => {
  const parsed = JSON.parse(raw, reviver);
  if (isPlainObject(parsed) && 'data' in parsed) {
    const v = typeof (parsed as any).v === 'number' ? (parsed as any).v : 1;
    return { version: v, data: (parsed as any).data };
  }
  return { version: 1, data: parsed };
};

export const migrateSettingsPayload = (version: number, data: any): any => {
  if (version <= 1) {
    return data;
  }
  return data;
};

export const validateSettingsPayload = (data: any) => {
  if (!isPlainObject(data)) {
    return { ok: false as const, reason: 'Settings payload is not an object.' };
  }
  const filtered = filterSettings(data);
  if (Object.keys(filtered).length === 0) {
    return { ok: false as const, reason: 'Settings payload missing known keys.' };
  }
  return { ok: true as const, data: filtered };
};
