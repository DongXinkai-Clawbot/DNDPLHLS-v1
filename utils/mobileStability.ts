import { createLogger } from './logger';
import { notify } from './notifications';
import { getDeviceCapabilities } from './capabilities';
import { applyPerformancePolicyToSettings, getPerformancePolicyForTier } from './performancePolicy';
import { useStore } from '../store';

const log = createLogger('mobile/stability');
const NOTICE_COOLDOWN_MS = 2 * 60 * 1000;
const CLEANUP_COOLDOWN_MS = 20 * 1000;

let initialized = false;
let lastNoticeAt = 0;
let lastCleanupAt = 0;

export const checkMobileCompatibility = () => {
  const issues: string[] = [];

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) issues.push('WebGL not supported.');
  } catch {
    issues.push('WebGL check failed.');
  }

  if (!window.AudioContext && !(window as any).webkitAudioContext) {
    issues.push('Web Audio API not supported.');
  }

  if ('memory' in performance) {
    const memInfo = (performance as any).memory;
    if (memInfo && memInfo.jsHeapSizeLimit < 512 * 1024 * 1024) {
      issues.push('Low available memory.');
    }
  }

  return {
    compatible: issues.length === 0,
    issues
  };
};

const showNotice = (title: string, message: string) => {
  const now = Date.now();
  if (now - lastNoticeAt < NOTICE_COOLDOWN_MS) return;
  lastNoticeAt = now;
  notify({
    level: 'warning',
    title,
    message,
    autoCloseMs: 0,
    actions: [
      { label: 'Reload', onClick: () => window.location.reload() },
      { label: 'Safe Mode', onClick: () => enterSafeMode() }
    ]
  });
};

const enterSafeMode = () => {
  try {
    const state = useStore.getState();
    const policy = getPerformancePolicyForTier('safe');
    const next = applyPerformancePolicyToSettings(state.settings, policy);
    state.updateSettings(next);
    showNotice('Safe mode applied', 'Performance defaults lowered. You can revert from Settings.',);
  } catch (e) {
    log.warn('Failed to apply safe mode', e);
  }
};

export const performMobileCleanup = (reason?: string) => {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_COOLDOWN_MS) return;
  lastCleanupAt = now;
  try {
    const state = useStore.getState();
    state.stopAllAudioActivity?.();
    if ((window as any).audioCache?.clear) {
      (window as any).audioCache.clear();
    }
    log.info('Cleanup performed', { reason });
  } catch (error) {
    log.warn('Cleanup failed', error);
  }
};

export const resetMobileStability = () => {
  initialized = false;
  lastNoticeAt = 0;
  lastCleanupAt = 0;
};

export const initMobileStability = (opts?: { onFatal?: (error: Error) => void }) => {
  if (initialized) return () => {};
  if (typeof window === 'undefined') return () => {};
  initialized = true;

  const caps = getDeviceCapabilities();
  if (caps.isMobile) {
    const compatibility = checkMobileCompatibility();
    if (!compatibility.compatible) {
      log.warn('Compatibility issues detected', compatibility.issues);
    }
  }

  const onError = (ev: ErrorEvent) => {
    const err = ev.error instanceof Error ? ev.error : new Error(ev.message || 'Unknown error');
    log.error('Global error', { message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno });
    if (caps.isMobile) {
      performMobileCleanup('window-error');
      showNotice('Graphics or memory issue detected', 'If the app becomes unstable, reload or enter Safe Mode.');
    }
    opts?.onFatal?.(err);
  };

  const onRejection = (ev: PromiseRejectionEvent) => {
    const reason = ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason || 'Unhandled rejection'));
    log.error('Unhandled rejection', { reason: String(ev.reason) });
    if (caps.isMobile) {
      performMobileCleanup('unhandled-rejection');
      showNotice('App error detected', 'Reload or enter Safe Mode if problems persist.');
    }
    opts?.onFatal?.(reason);
  };

  const onContextLost = (event: Event) => {
    event.preventDefault?.();
    log.warn('WebGL context lost');
    if (caps.isMobile) {
      performMobileCleanup('webgl-context-lost');
      showNotice('Graphics context lost', 'Reload to restore rendering, or enter Safe Mode.');
    }
  };

  const onMemoryWarning = () => {
    log.warn('Memory warning received');
    if (caps.isMobile) {
      performMobileCleanup('memory-warning');
      showNotice('High memory pressure', 'Reload or enter Safe Mode to reduce memory usage.');
    }
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  if (typeof document !== 'undefined') {
    document.addEventListener('webglcontextlost', onContextLost as EventListener, { passive: false });
  }
  if ('onmemorywarning' in window) {
    window.addEventListener('memorywarning', onMemoryWarning as EventListener);
  }

  const handlePageHide = () => {
    if (caps.isMobile) performMobileCleanup('pagehide');
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden' && caps.isMobile) {
      performMobileCleanup('visibility-hidden');
    }
  };
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handlePageHide);
  document.addEventListener('visibilitychange', handleVisibility);

  let memoryInterval: number | null = null;
  if (caps.isMobile && 'memory' in performance) {
    memoryInterval = window.setInterval(() => {
      const memInfo = (performance as any).memory;
      if (!memInfo) return;
      if (memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.9) {
        onMemoryWarning();
      }
    }, 30000);
  }

  return () => {
    initialized = false;
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    document.removeEventListener('webglcontextlost', onContextLost as EventListener);
    window.removeEventListener('memorywarning', onMemoryWarning as EventListener);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handlePageHide);
    document.removeEventListener('visibilitychange', handleVisibility);
    if (memoryInterval !== null) window.clearInterval(memoryInterval);
  };
};
