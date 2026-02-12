import type { NodeData, EdgeData } from '../../types';

export type SerializedNode = Omit<NodeData, 'position'> & { posIndex: number };

export type SerializedLattice = {
  nodes: SerializedNode[];
  edges: EdgeData[];
  positions: Float32Array;
};

export const serializeLattice = (nodes: NodeData[], edges: EdgeData[]): SerializedLattice => {
  const positions = new Float32Array(nodes.length * 3);
  const serializedNodes: SerializedNode[] = nodes.map((node, index) => {
    const offset = index * 3;
    positions[offset] = node.position.x;
    positions[offset + 1] = node.position.y;
    positions[offset + 2] = node.position.z;

    const { position, ...rest } = node;
    return { ...(rest as Omit<NodeData, 'position'>), posIndex: index };
  });

  return { nodes: serializedNodes, edges, positions };
};
