/// <reference lib="webworker" />
import { evalVector, buildMathContext } from './math/unifiedEvaluator';

type VectorFieldRequest = {
  id: string;
  objId: string;
  expression: string;
  bindings: Record<string, number>;
  view: { xMin: number; xMax: number; yMin: number; yMax: number };
  resolution: number;
  complexComponent?: 're' | 'im' | 'abs' | 'arg';
};

type VectorFieldPoint = { x: number; y: number; dx: number; dy: number };

const ctxFor = (bindings: Record<string, number>, x: number, y: number) =>
  buildMathContext({ ...bindings, x, y });

const clampResolution = (n: number) => {
  if (!Number.isFinite(n)) return 16;
  return Math.min(64, Math.max(4, Math.round(n)));
};

self.onmessage = (event: MessageEvent<VectorFieldRequest>) => {
  const { id, objId, expression, bindings, view, resolution, complexComponent } = event.data;
  const res = clampResolution(resolution);
  const points: VectorFieldPoint[] = [];
  const dx = (view.xMax - view.xMin) / Math.max(1, res - 1);
  const dy = (view.yMax - view.yMin) / Math.max(1, res - 1);

  for (let j = 0; j < res; j++) {
    const y = view.yMin + j * dy;
    for (let i = 0; i < res; i++) {
      const x = view.xMin + i * dx;
      const ctx = ctxFor(bindings, x, y);
      const vec = evalVector(expression, ctx, complexComponent || 'abs');
      if (!vec.isValid) continue;
      if (!Number.isFinite(vec.x) || !Number.isFinite(vec.y)) continue;
      points.push({ x, y, dx: vec.x, dy: vec.y });
    }
  }

  self.postMessage({ id, objId, points, resolution: res });
};
