/**
 * @module Lattice4D
 * @description Main React component for visualizing the 4D Harmonic Lattice.
 * Uses React Three Fiber for WebGL rendering.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { HarmonicLatticeGraph } from './LatticeGraph';
import { getDefaultProjection, updateNodePositions } from './projection';
import { LatticeNode, LatticeEdge, ProjectionConfig } from './types';

// Constants for visualization
const NODE_SIZE = 0.15;
const EDGE_WIDTH = 0.05;
const COLOR_PALETTE = {
  P3: '#FF6B6B', // Red
  P5: '#4ECDC4', // Teal
  P7: '#FFE66D', // Yellow
  P11: '#1A535C', // Dark Blue
  ROOT: '#FFFFFF', // White
  DEFAULT: '#CCCCCC', // Gray
};

interface LatticeProps {
  limits?: [number, number, number, number];
  projectionConfig?: ProjectionConfig;
  showCommas?: boolean;
}

const NodeView: React.FC<{ node: LatticeNode; isComma?: boolean }> = ({ node, isComma }) => {
  const position = node.position || new THREE.Vector3();
  const isRoot = node.id === '0,0,0,0';
  
  // Simple color mapping based on primary factor
  let color = COLOR_PALETTE.DEFAULT;
  if (isRoot) color = COLOR_PALETTE.ROOT;
  else if (isComma) color = '#FF00FF'; // Magenta for commas
  else if (Math.abs(node.coordinates[0]) > 0) color = COLOR_PALETTE.P3;
  else if (Math.abs(node.coordinates[1]) > 0) color = COLOR_PALETTE.P5;
  else if (Math.abs(node.coordinates[2]) > 0) color = COLOR_PALETTE.P7;
  else if (Math.abs(node.coordinates[3]) > 0) color = COLOR_PALETTE.P11;

  // Hover state could be added here
  const scale = isComma ? NODE_SIZE * 1.5 : NODE_SIZE;
  
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[scale, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isComma ? 0.5 : 0.2} />
      </mesh>
      {/* Label only for low complexity nodes to avoid clutter */}
      {(node.complexity && node.complexity < 4) || isComma ? (
        <Text
          position={[0, scale + 0.1, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {`${node.ratio.toFixed(2)} (${Math.round(node.cents)}c)`}
        </Text>
      ) : null}
    </group>
  );
};

const EdgeView: React.FC<{ edge: LatticeEdge; nodes: Map<string, LatticeNode> }> = ({ edge, nodes }) => {
  const source = nodes.get(edge.sourceId);
  const target = nodes.get(edge.targetId);

  if (!source || !target || !source.position || !target.position) return null;

  const start = source.position;
  const end = target.position;
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  
  // Cylinder for edge
  // Position is midpoint
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Rotation to align cylinder with direction
  // Default cylinder is along Y axis. We need to rotate it to match direction.
  const lookAt = new THREE.Matrix4().lookAt(start, end, new THREE.Vector3(0, 1, 0));
  // This is tricky in R3F without strict quaternion math.
  // Actually, we can use <Line> from drei for simplicity, but let's try strict geometry first for robustness.
  // Or just use lookAt on the mesh.

  return (
    <mesh position={midPoint} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())}>
      <cylinderGeometry args={[EDGE_WIDTH, EDGE_WIDTH, length, 8]} />
      <meshStandardMaterial color="#555" transparent opacity={0.6} />
    </mesh>
  );
};

/**
 * Main visualizer component.
 */
export const Lattice4D: React.FC<LatticeProps> = ({
  limits = [2, 1, 1, 0],
  projectionConfig,
  showCommas = false,
}) => {
  const [graph, setGraph] = useState<HarmonicLatticeGraph>(() => new HarmonicLatticeGraph(limits));
  const [nodes, setNodes] = useState<LatticeNode[]>([]);
  const [edges, setEdges] = useState<LatticeEdge[]>([]);
  const [commas, setCommas] = useState<Set<string>>(new Set());

  // Initialize projection
  const config = useMemo(() => projectionConfig || getDefaultProjection(), [projectionConfig]);

  useEffect(() => {
    // Regenerate graph when limits change
    const newGraph = new HarmonicLatticeGraph(limits);
    newGraph.generate();
    
    const generatedNodes = newGraph.getNodes();
    updateNodePositions(generatedNodes, config);
    
    setGraph(newGraph);
    setNodes(generatedNodes);
    setEdges(newGraph.getEdges());

    if (showCommas) {
      const commaNodes = newGraph.findCommas(25);
      setCommas(new Set(commaNodes.map(n => n.id)));
    } else {
      setCommas(new Set());
    }
  }, [limits, config, showCommas]);

  // Map for quick lookup in EdgeView
  const nodeMap = useMemo(() => {
    const map = new Map<string, LatticeNode>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', background: '#111' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 60 }}>
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        
        <group>
          {nodes.map(node => (
            <NodeView key={node.id} node={node} isComma={commas.has(node.id)} />
          ))}
          {edges.map((edge, i) => (
            <EdgeView key={`${edge.sourceId}-${edge.targetId}-${i}`} edge={edge} nodes={nodeMap} />
          ))}
        </group>

        <OrbitControls makeDefault />
        <gridHelper args={[20, 20, 0x444444, 0x222222]} />
      </Canvas>
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontFamily: 'monospace' }}>
        <h3>Lattice 4D Visualizer</h3>
        <p>Nodes: {nodes.length}</p>
        <p>Edges: {edges.length}</p>
      </div>
    </div>
  );
};
