import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

type PerfSnapshot = {
  fpsAvg: number;
  fps1Low: number;
  drawCallsMax: number;
  trianglesMax: number;
  texturesMax: number;
  geometriesMax: number;
};

const SAMPLE_CAP = 240;

export const MuseumPerformanceProbe = ({ enabled }: { enabled: boolean }) => {
  const { gl } = useThree();
  const samples = useRef<number[]>([]);
  const lastFrame = useRef<number>(performance.now());
  const maxima = useRef({
    drawCallsMax: 0,
    trianglesMax: 0,
    texturesMax: 0,
    geometriesMax: 0
  });
  const lastSnapshot = useRef<PerfSnapshot | null>(null);

  useFrame(() => {
    if (!enabled) return;
    const now = performance.now();
    const dt = Math.max(0.001, now - lastFrame.current);
    lastFrame.current = now;
    const fps = 1000 / dt;

    samples.current.push(fps);
    if (samples.current.length > SAMPLE_CAP) samples.current.shift();

    const info = gl.info;
    maxima.current.drawCallsMax = Math.max(maxima.current.drawCallsMax, info.render.calls);
    maxima.current.trianglesMax = Math.max(maxima.current.trianglesMax, info.render.triangles);
    maxima.current.texturesMax = Math.max(maxima.current.texturesMax, info.memory.textures);
    maxima.current.geometriesMax = Math.max(maxima.current.geometriesMax, info.memory.geometries);
  });

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const arr = samples.current;
      if (!arr.length) return;
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = arr.reduce((sum, v) => sum + v, 0) / arr.length;
      const idx = Math.max(0, Math.floor(sorted.length * 0.01) - 1);
      const low = sorted[idx] ?? sorted[0];
      const snapshot: PerfSnapshot = {
        fpsAvg: Number(avg.toFixed(2)),
        fps1Low: Number(low.toFixed(2)),
        drawCallsMax: maxima.current.drawCallsMax,
        trianglesMax: maxima.current.trianglesMax,
        texturesMax: maxima.current.texturesMax,
        geometriesMax: maxima.current.geometriesMax
      };
      lastSnapshot.current = snapshot;
      (window as any).museumPerf = snapshot;
    };

    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return null;
};
