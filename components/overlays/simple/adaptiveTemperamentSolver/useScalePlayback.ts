import { useEffect, useRef, useState } from 'react';
import { playSimultaneous } from '../../../../audioEngine';
import type { AppSettings, NodeData } from '../../../../types';
import type { SolverOutput } from '../../../../utils/temperamentSolver';
import { makeDummyNode } from './utils';

type UseScalePlaybackParams = {
  result: SolverOutput | null;
  settings: AppSettings;
};

export const useScalePlayback = ({ result, settings }: UseScalePlaybackParams) => {
  const playDyadNodes = (n1: NodeData, n2: NodeData) => {
    if (!result) return;
    playSimultaneous(n1, n2, { ...settings, baseFrequency: result.input.baseFrequencyHz });
  };

  const playDegreeDyad = (deg: number) => {
    if (!result) return;
    const rootInfo = result.notes[0];
    const targetInfo = result.notes[deg];

    // Create dummy nodes with correct frequency calculation
    // Use cents to calculate frequency directly: freq = baseFreq * 2^(cents/1200)
    const baseFreq = result.input.baseFrequencyHz;

    // For temperament solver, we need to use cents-based frequency calculation
    // Set a small morph value to force cents-based calculation in startNote
    const tempSettings = {
      ...settings,
      baseFrequency: baseFreq,
      visuals: {
        ...settings.visuals,
        temperamentMorph: 1.0  // Force cents-based calculation
      }
    };

    const n1 = makeDummyNode(rootInfo.centsFromRoot, rootInfo.name);
    const n2 = makeDummyNode(targetInfo.centsFromRoot, targetInfo.name);

    playSimultaneous(n1, n2, tempSettings);
  };

  // State for scale playback
  const [isPlayingScale, setIsPlayingScale] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);
  const currentOscillatorRef = useRef<OscillatorNode | null>(null);
  const currentGainRef = useRef<GainNode | null>(null);

  // Stop playback when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      // Stop current note
      if (currentOscillatorRef.current) {
        try {
          currentOscillatorRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
        currentOscillatorRef.current = null;
        currentGainRef.current = null;
      }

      // Clear timer
      if (playbackTimerRef.current !== null) {
        window.clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      setIsPlayingScale(false);
    };
  }, []);

  const playEntireScale = () => {
    if (!result || isPlayingScale) return;

    setIsPlayingScale(true);
    const baseFreq = result.input.baseFrequencyHz;

    const noteDuration = 400; // milliseconds per note
    let currentIndex = 0;

    const playNextNote = () => {
      if (currentIndex >= result.notes.length) {
        setIsPlayingScale(false);
        playbackTimerRef.current = null;
        currentOscillatorRef.current = null;
        currentGainRef.current = null;
        return;
      }

      // Stop previous note before playing next one
      if (currentOscillatorRef.current) {
        try {
          const now = Date.now();
          currentOscillatorRef.current.stop();
        } catch (e) {
          // Ignore if already stopped
        }
      }

      const note = result.notes[currentIndex];

      // Use audioEngine to play the note
      import('../../../../audioEngine').then(({ getAudioContext }) => {
        const ctx = getAudioContext();
        const freq = baseFreq * Math.pow(2, note.centsFromRoot / 1200);

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';

        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + (noteDuration - 50) / 1000);

        oscillator.start(now);
        oscillator.stop(now + noteDuration / 1000);

        // Store references for cleanup
        currentOscillatorRef.current = oscillator;
        currentGainRef.current = gainNode;
      });

      currentIndex++;
      playbackTimerRef.current = window.setTimeout(playNextNote, noteDuration);
    };

    playNextNote();
  };

  const stopScalePlayback = () => {
    // Stop current note
    if (currentOscillatorRef.current) {
      try {
        currentOscillatorRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      currentOscillatorRef.current = null;
      currentGainRef.current = null;
    }

    // Clear timer
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    setIsPlayingScale(false);
  };

  return { isPlayingScale, playDegreeDyad, playEntireScale, stopScalePlayback };
};
