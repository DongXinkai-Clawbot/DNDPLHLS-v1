import { useEffect, useRef } from 'react';
import type { SolverOutput } from '../../../../utils/temperamentSolver';
import type { AdvancedIntervalItem, TargetItem } from './types';
import { drawHeatmapCanvas, drawRadarCanvas } from './visuals';

type UseSolverVisualsParams = {
  result: SolverOutput | null;
  globalTol: number;
  privilegedKeys: number[];
  targetState: Record<string, boolean>;
  targetsRaw: TargetItem[];
  individualTolerances: Record<string, number>;
  advancedModeEnabled: boolean;
  advancedIntervals: AdvancedIntervalItem[];
};

export const useSolverVisuals = ({
  result,
  globalTol,
  privilegedKeys,
  targetState,
  targetsRaw,
  individualTolerances,
  advancedModeEnabled,
  advancedIntervals
}: UseSolverVisualsParams) => {
  const radarRef = useRef<HTMLCanvasElement | null>(null);
  const heatRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!result) return;
    const canvas = radarRef.current;
    if (!canvas) return;
    drawRadarCanvas({ canvas, result });
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const canvas = heatRef.current;
    if (!canvas) return;
    drawHeatmapCanvas({
      canvas,
      result,
      globalTol,
      privilegedKeys,
      targetState,
      targetsRaw,
      individualTolerances,
      advancedModeEnabled,
      advancedIntervals
    });
  }, [result, globalTol, privilegedKeys, targetState, targetsRaw, individualTolerances, advancedModeEnabled, advancedIntervals]);

  return { radarRef, heatRef };
};
