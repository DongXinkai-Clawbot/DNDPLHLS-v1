import { Vector3 } from 'three';
import type { NodeData, EdgeData } from '../../types';
import type { SerializedLattice, SerializedNode } from './serialization';

const buildNode = (node: SerializedNode, positions: Float32Array): NodeData => {
  const offset = node.posIndex * 3;
  const position = new Vector3(
    positions[offset] || 0,
    positions[offset + 1] || 0,
    positions[offset + 2] || 0
  );
  const { posIndex, ...rest } = node;
  return { ...(rest as Omit<NodeData, 'position'>), position };
};

export const deserializeLattice = (
  payload: SerializedLattice
): { nodes: NodeData[]; edges: EdgeData[] } => {
  const positions = payload.positions;
  const nodes = payload.nodes.map((node) => buildNode(node, positions));
  return { nodes, edges: payload.edges };
};
