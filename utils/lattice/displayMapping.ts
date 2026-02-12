import type { AppSettings, NodeData } from '../../types';
import { addVectors, getNoteName } from '../../musicLogic';

/**
 * Applies display-only settings (notationSymbols / accidentalPlacement / transpositionVector)
 * to an existing lattice without regenerating topology.
 *
 * Important: This mutates NodeData objects in-place for maximum performance.
 * Callers should still replace the *array reference* in Zustand to trigger re-renders.
 */
export const applyLatticeDisplayMapping = (nodes: NodeData[], settings: AppSettings) => {
  const symbols = settings.notationSymbols;
  const placement = settings.accidentalPlacement;
  const transpositionVector = settings.transpositionVector;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // Naming vector = primeVector + transpositionVector (matches generator.ts)
    const namingVec = addVectors(node.primeVector as any, transpositionVector as any);
    node.name = getNoteName(namingVec as any, symbols, placement);
  }
};
