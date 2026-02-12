
import type { AppSettings } from '../../types';

export const deepCopySettings = (settings: AppSettings): AppSettings => {
  if (typeof structuredClone === 'function') {
    return structuredClone(settings);
  }
  return JSON.parse(JSON.stringify(settings));
};

export const bigIntReplacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }
  return value;
};

export const bigIntReviver = (key: string, value: any) => {
  if (typeof value === 'string' && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};
