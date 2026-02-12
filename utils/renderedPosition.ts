
import * as THREE from 'three';
import type { NodeData, AppSettings } from '../types';

export const buildNodeIndexMap = (nodes: NodeData[]) => {
  const m = new Map<string, number>();
  for (let i = 0; i < nodes.length; i++) m.set(nodes[i].id, i);
  return m;
};

export const getRootNodeForPitchField = (nodes: NodeData[]): NodeData | null => {
  return nodes.find(n => n.gen === 0 && n.originLimit === 0) ?? null;
};

export const getPitchFieldPosition = (
  node: NodeData,
  nodes: NodeData[],
  settings: AppSettings,
  nodeIndexMap?: Map<string, number>,
  rootNode?: NodeData | null
) => {
  const globalScale = settings.visuals.globalScale ?? 1;
  const centerCents = (rootNode ?? getRootNodeForPitchField(nodes))?.cents ?? 0;

  const diff = node.cents - centerCents;
  const normalizedDiff = ((diff + 600) % 1200 + 1200) % 1200 - 600;

  const radius = Math.abs(normalizedDiff) * 0.4 * globalScale;

  if (radius < 0.01) return new THREE.Vector3(0, 0, 0);

  const totalNodes = nodes.length || 1;
  const i = (nodeIndexMap?.get(node.id) ?? nodes.findIndex(n => n.id === node.id) ?? 0);

  const phi = Math.acos(1 - 2 * (i + 0.5) / totalNodes);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;

  let x = Math.cos(theta) * Math.sin(phi);
  let y = Math.sin(theta) * Math.sin(phi);
  let z = Math.cos(phi);

  if (normalizedDiff >= 0) x = Math.abs(x);
  else x = -Math.abs(x);

  return new THREE.Vector3(x, y, z).multiplyScalar(radius);
};

export const getRenderedNodePosition = (
  node: NodeData,
  nodes: NodeData[],
  settings: AppSettings,
  nodeIndexMap?: Map<string, number>,
  rootNode?: NodeData | null
) => {
  const mode = settings.visuals.layoutMode;
  if (mode === 'pitch-field') {
    return getPitchFieldPosition(node, nodes, settings, nodeIndexMap, rootNode);
  }
  
  return node.position.clone();
};
