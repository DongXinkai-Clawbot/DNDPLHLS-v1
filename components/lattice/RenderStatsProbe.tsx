import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export const RenderStatsProbe = () => {
  const framesRef = useRef(0);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    (window as any).__renderStats = { fps: 0, frames: 0 };
    return () => {
      if ((window as any).__renderStats) {
        delete (window as any).__renderStats;
      }
    };
  }, []);

  useFrame(() => {
    framesRef.current += 1;
    const now = performance.now();
    const elapsed = now - lastRef.current;
    if (elapsed >= 1000) {
      const fps = Math.round((framesRef.current * 1000) / elapsed);
      (window as any).__renderStats = { fps, frames: framesRef.current };
      framesRef.current = 0;
      lastRef.current = now;
    }
  });

  return null;
};
