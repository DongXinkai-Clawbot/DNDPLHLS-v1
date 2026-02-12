import { useEffect, useRef } from 'react';
import { unlockAudioContext } from '../../audioEngine';
import { getDeviceCapabilities } from '../../utils/capabilities';
import { useStore } from '../../store';
import { useExternalRetuner } from '../../hooks/useExternalRetuner';

type ServiceBootstrapProps = {
  setAppMode: (mode: 'lattice' | 'museum') => void;
  updateSettings: (partial: any) => void;
};

export const ServiceBootstrap = ({ setAppMode, updateSettings }: ServiceBootstrapProps) => {
  const lastModeRef = useRef<'lattice' | 'museum' | null>(null);
  const prevArActiveRef = useRef<boolean | null>(null);
  const stopAllAudioActivity = useStore((s) => s.stopAllAudioActivity);
  const isArActive = useStore((s) => s.settings.isArActive);
  useExternalRetuner();

  useEffect(() => {
    const handleRoute = () => {
      if (!window.location.hash && window.location.pathname.startsWith('/museum')) {
        window.location.hash = '#/museum';
      }
      const isMuseum = window.location.hash.startsWith('#/museum');
      const nextMode = isMuseum ? 'museum' : 'lattice';
      if (lastModeRef.current && lastModeRef.current !== nextMode) {
        stopAllAudioActivity();
      }
      lastModeRef.current = nextMode;
      setAppMode(nextMode);
    };
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    return () => window.removeEventListener('hashchange', handleRoute);
  }, [setAppMode, stopAllAudioActivity]);

  useEffect(() => {
    if (prevArActiveRef.current === null) {
      prevArActiveRef.current = isArActive;
      return;
    }
    if (prevArActiveRef.current && !isArActive) {
      stopAllAudioActivity();
    }
    prevArActiveRef.current = isArActive;
  }, [isArActive, stopAllAudioActivity]);

  useEffect(() => {
    const handleUnload = () => stopAllAudioActivity();
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [stopAllAudioActivity]);

  useEffect(() => {
    // AR auto-start protection: only enable on second mount to avoid race conditions
    // and only after successful store initialization
    if (typeof window === 'undefined') return;

    const caps = getDeviceCapabilities();
    if (!caps.isMobile) return;

    // Use setTimeout to defer AR init until after React render cycle completes
    // This gives the store and components time to fully initialize
    const timer = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const arParam = params.get('ar');

        // Only enable AR if explicitly requested AND store is ready
        if (arParam && ['1', 'true', 'yes', 'on'].includes(arParam.toLowerCase())) {
          // Add safety: don't enable AR if device has known issues
          if (caps.isMobile && !navigator.mediaDevices?.getUserMedia) {
            console.warn('AR requested but camera API not available');
            return;
          }

          console.log('Auto-enabling AR (from URL parameter)');
          updateSettings({ isArActive: true });
        }
      } catch (err) {
        console.error('Error processing AR parameter:', err);
        // Silently fail - don't crash the app
      }
    }, 500); // Wait 500ms for app to stabilize

    return () => clearTimeout(timer);
  }, [updateSettings]);

  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };

    const isMobile = getDeviceCapabilities().isMobile;
    const touchOptions = isMobile ? { once: true, passive: true } : { once: true };
    const clickOptions = { once: true };

    window.addEventListener('touchstart', unlock, touchOptions);
    window.addEventListener('touchend', unlock, touchOptions);
    window.addEventListener('click', unlock, clickOptions);

    const preventDefault = (e: Event) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    };
    window.addEventListener('contextmenu', preventDefault, { passive: false });

    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('contextmenu', preventDefault);
    };
  }, []);

  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      if (!el || !(el as HTMLElement).tagName) return false;
      const node = el as HTMLElement;
      const tag = node.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return node.isContentEditable;
    };

    const updateInputMode = () => {
      const active = document.activeElement;
      const isInput = isEditable(active);
      document.body.classList.toggle('input-mode', isInput);
      document.documentElement.classList.toggle('input-mode', isInput);
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditable(e.target)) {
        updateInputMode();
        const target = e.target as HTMLElement;
        if (target?.scrollIntoView) {
          setTimeout(() => {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 0);
        }
      }
    };
    const handleFocusOut = () => {
      setTimeout(updateInputMode, 0);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      document.body.classList.remove('input-mode');
      document.documentElement.classList.remove('input-mode');
    };
  }, []);

  return null;
};
