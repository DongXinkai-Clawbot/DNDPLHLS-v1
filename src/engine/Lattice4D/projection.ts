/**
 * @module Lattice4D
 * @description Logic for projecting 4D lattice coordinates into 3D space for visualization.
 */

import { Vector3 } from 'three';
import { ProjectionConfig, LatticeNode } from './types';

/**
 * Returns a default projection configuration optimized for clarity.
 * Uses a modified tetrahedron-like basis or orthogonal basis for primary axes.
 * P3: X axis
 * P5: Y axis
 * P7: Z axis
 * P11: Diagonal offset
 */
export const getDefaultProjection = (): ProjectionConfig => {
  return {
    axis3: new Vector3(1, 0, 0),
    axis5: new Vector3(0, 1, 0),
    axis7: new Vector3(0, 0, 1),
    // P11 projects diagonally to avoid overlapping primary grid too much
    axis11: new Vector3(0.5, 0.5, 0.5).normalize(),
    scale: 2.0, // Default spacing
  };
};

/**
 * Projects a 4D coordinate to a 3D position based on the configuration.
 * @param coords The [p3, p5, p7, p11] coordinates.
 * @param config The projection configuration.
 * @returns A Vector3 representing the 3D position.
 */
export const projectNode = (
  coords: [number, number, number, number],
  config: ProjectionConfig
): Vector3 => {
  const [p3, p5, p7, p11] = coords;
  const { axis3, axis5, axis7, axis11, scale } = config;

  const position = new Vector3()
    .addScaledVector(axis3, p3)
    .addScaledVector(axis5, p5)
    .addScaledVector(axis7, p7)
    .addScaledVector(axis11, p11)
    .multiplyScalar(scale);

  return position;
};

/**
 * Updates the 3D positions of all nodes in a lattice graph.
 * Mutates the nodes in place by adding/updating the `position` property.
 * @param nodes Array of LatticeNode objects.
 * @param config Projection configuration.
 */
export const updateNodePositions = (nodes: LatticeNode[], config: ProjectionConfig): void => {
  nodes.forEach(node => {
    node.position = projectNode(node.coordinates, config);
  });
};
