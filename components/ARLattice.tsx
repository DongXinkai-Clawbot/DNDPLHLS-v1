
import React from 'react';
import { useStore } from '../store';
import { NodeInstances } from './lattice/NodeInstances';
import { StructureEdges } from './lattice/EdgeInstances';

type ARLatticeProps = {
  isPlaced: boolean;
  position: [number, number, number];
  rotation?: [number, number, number, number];
  scaleMultiplier?: number;
};

export const ARLattice = ({ isPlaced, position, rotation, scaleMultiplier }: ARLatticeProps) => {
  const settings = useStore((s) => s.settings);

  // On high-DPI mobile (DPR 2-4), scale of 0.15 becomes microscopic
  // Adjust base scale based on device pixel ratio to ensure nodes are visible
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const dprAdjustment = dpr > 2 ? Math.min(dpr * 0.5, 2) : 1; // Max 2x adjustment

  const baseScale = 0.15 * (settings.visuals.globalScale || 1) * dprAdjustment;
  // Ensure minimum scale so nodes aren't invisible
  const minScale = 0.08;
  const arScale = Math.max(baseScale * (scaleMultiplier ?? 1), minScale);

  // Show lattice preview even during scanning phase to prevent blank screen
  // Use reduced opacity during scanning to indicate it's not yet placed
  const isScanning = !isPlaced;
  const opacity = isScanning ? 0.3 : 1;

  return (
    <group position={position} quaternion={rotation} scale={[arScale, arScale, arScale]}>
      <group opacity={opacity}>
        <NodeInstances />
        {settings.visuals.edgeOpacity > 0 && <StructureEdges />}
      </group>
    </group>
  );
};
