import { useCallback, useEffect, useState } from 'react';
import { getAudioContext, unlockAudioContext } from '../audioEngine';
import { createLogger } from '../utils/logger';

const log = createLogger('audio/controller');

export const useAudioController = () => {
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const syncAudioState = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      setIsAudioUnlocked(true);
      return;
    }
    const ctx = getAudioContext();
    setIsAudioUnlocked(ctx.state === 'running');
  }, []);

  const handleStartAudio = useCallback(() => {
    unlockAudioContext();
    const silentMp3 =
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAAAAMA==';
    const audio = new Audio();
    audio.src = silentMp3;
    audio.loop = false;
    audio.volume = 0.01;
    audio.play().then(() => log.info('Audio unlocked')).catch(e => log.warn('Audio unlock failed', e.message));

    if (typeof window === 'undefined') {
      setIsAudioUnlocked(true);
      return;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      setIsAudioUnlocked(true);
      return;
    }
    const ctx = getAudioContext();
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      ctx.resume().catch(() => {}).finally(() => setTimeout(syncAudioState, 50));
    } else {
      syncAudioState();
    }
  }, [syncAudioState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      setIsAudioUnlocked(true);
      return;
    }
    const ctx = getAudioContext();
    const handleStateChange = () => syncAudioState();
    const handleUnlock = () => {
      unlockAudioContext();
      setTimeout(syncAudioState, 50);
    };
    syncAudioState();
    ctx.addEventListener('statechange', handleStateChange);
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('touchend', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock);
    return () => {
      ctx.removeEventListener('statechange', handleStateChange);
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('touchend', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, [syncAudioState]);

  return { isAudioUnlocked, handleStartAudio };
};
