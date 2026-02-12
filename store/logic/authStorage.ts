import type { AuthState } from '../../types';
import { STORAGE_KEYS } from './storageKeys';

const AUTH_VERSION = 1;

export const DEFAULT_AUTH_STATE: AuthState = {
  status: 'signed_out',
  user: null,
  accessToken: null,
  accessExpiresAt: null,
  lastEmail: ''
};

const canUseStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export const loadAuthState = (): AuthState => {
  if (!canUseStorage()) return { ...DEFAULT_AUTH_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.auth);
    if (!raw) return { ...DEFAULT_AUTH_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== AUTH_VERSION) return { ...DEFAULT_AUTH_STATE };
    const next: AuthState = {
      status: parsed.status === 'signed_in' ? 'signed_in' : 'signed_out',
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      accessExpiresAt: Number.isFinite(parsed.accessExpiresAt) ? parsed.accessExpiresAt : null,
      lastEmail: typeof parsed.lastEmail === 'string' ? parsed.lastEmail : ''
    };
    if (next.accessExpiresAt && Date.now() / 1000 >= next.accessExpiresAt - 30) {
      return { ...DEFAULT_AUTH_STATE, lastEmail: next.lastEmail };
    }
    return next;
  } catch {
    return { ...DEFAULT_AUTH_STATE };
  }
};

export const saveAuthState = (auth: AuthState) => {
  if (!canUseStorage()) return;
  try {
    const payload = {
      v: AUTH_VERSION,
      status: auth.status,
      user: auth.user,
      accessToken: auth.accessToken,
      accessExpiresAt: auth.accessExpiresAt,
      lastEmail: auth.lastEmail || ''
    };
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(payload));
  } catch {
    // ignore storage access issues
  }
};

export const clearAuthState = () => {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEYS.auth);
  } catch {
    // ignore storage access issues
  }
};
