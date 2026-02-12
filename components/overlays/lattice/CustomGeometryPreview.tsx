import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import { useLatticeStore } from '../../../store/latticeStoreContext';
import type { AppSettings, NodeData, PrimeLimit } from '../../../types';
import { UNIT_DISTANCE, getPrimeAxis, getPrimeColor, GEN_SIZES } from '../../../constants';

const PreviewNodes = ({ nodes, settings }: { nodes: NodeData[]; settings: AppSettings }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const instanceCount = nodes.length;
    meshRef.current.count = instanceCount;
    for (let i = 0; i < instanceCount; i++) {
      const node = nodes[i];
      const scale = Math.max(0.18, ((GEN_SIZES as any)[node.gen] || 0.25) * (settings.visuals?.nodeScale || 1) * 2.5);
      tempObj.position.copy(node.position);
      tempObj.scale.setScalar(scale);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);

      const color = getPrimeColor((node.originLimit as PrimeLimit) || 3, settings);
      tempColor.set(color);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, settings, tempObj, tempColor]);

  if (!nodes.length) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <sphereGeometry args={[0.6, 12, 12]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.25}
        metalness={0.05}
        emissive="#ffffff"
        emissiveIntensity={0.35}
      />
    </instancedMesh>
  );
};

const PreviewSolid = ({ nodes, settings, cellSize }: { nodes: NodeData[]; settings: AppSettings; cellSize: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObj = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    const instanceCount = nodes.length;
    meshRef.current.count = instanceCount;
    for (let i = 0; i < instanceCount; i++) {
      const node = nodes[i];
      tempObj.position.copy(node.position);
      tempObj.scale.setScalar(cellSize);
      tempObj.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObj.matrix);

      const color = getPrimeColor((node.originLimit as PrimeLimit) || 3, settings);
      tempColor.set(color).multiplyScalar(0.85);
      meshRef.current.setColorAt(i, tempColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [nodes, settings, tempObj, tempColor, cellSize]);

  if (!nodes.length) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, nodes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        vertexColors
        roughness={0.25}
        metalness={0.05}
        emissive="#ffffff"
        emissiveIntensity={0.55}
        transparent
        opacity={0.96}
      />
    </instancedMesh>
  );
};

const PreviewScene = ({
  nodes,
  settings,
  center,
  solidFill,
  fillScale
}: {
  nodes: NodeData[];
  settings: AppSettings;
  center: THREE.Vector3;
  solidFill: boolean;
  fillScale: number;
}) => {
  const geometry = settings.geometry || ({} as AppSettings['geometry']);
  const limits = (geometry.limits || [3, 5, 7]) as [PrimeLimit, PrimeLimit, PrimeLimit];
  const dims = geometry.dimensions || [3, 3, 3];
  const globalScale = settings.visuals?.globalScale || 1;
  const spacing = geometry.spacing ?? 1.6;
  const primeSpacings = settings.visuals?.primeSpacings || {};
  const controlsRef = useRef<any>(null);
  const baseSpacings = limits.map((limit) => (primeSpacings[limit] || 1) * UNIT_DISTANCE * globalScale * spacing);
  const cellSize = Math.max(0.5, Math.min(...baseSpacings) * fillScale);

  const axisLines = useMemo(() => {
    return limits.map((limit, idx) => {
      const half = Math.max(1, Math.floor((dims[idx] || 3) / 2));
      const stepSpacing = (primeSpacings[limit] || 1) * UNIT_DISTANCE * globalScale * spacing;
      const length = half * stepSpacing * 1.2;
      const axis = getPrimeAxis(limit).normalize();
      const a = axis.clone().multiplyScalar(-length).add(center);
      const b = axis.clone().multiplyScalar(length).add(center);
      return { limit, points: [a.toArray(), b.toArray()] as [number[], number[]] };
    });
  }, [limits, dims, globalScale, spacing, primeSpacings, center]);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  }, [center]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <pointLight position={[60, 60, 60]} intensity={1.35} />
      <directionalLight position={[0, 80, 60]} intensity={0.8} />
      <pointLight position={[-40, -20, -30]} intensity={0.6} color="#6ee7b7" />

      {axisLines.map((axis) => (
        <Line
          key={`axis-${axis.limit}`}
          points={axis.points}
          color={getPrimeColor(axis.limit, settings)}
          lineWidth={1}
          transparent
          opacity={0.65}
        />
      ))}

      {solidFill ? (
        <PreviewSolid nodes={nodes} settings={settings} cellSize={cellSize} />
      ) : (
        <PreviewNodes nodes={nodes} settings={settings} />
      )}

      <OrbitControls ref={controlsRef} enablePan enableZoom enableDamping dampingFactor={0.08} />
    </>
  );
};

export const CustomGeometryPreview: React.FC = () => {
  const nodes = useLatticeStore((s) => s.nodes);
  const settings = useLatticeStore((s) => s.settings);
  const [solidFill, setSolidFill] = useState(false);
  const [fillScale, setFillScale] = useState(0.9);

  const sampledNodes = useMemo(() => {
    if (!nodes.length) return [];
    const maxNodes = solidFill ? 8000 : 2200;
    if (nodes.length <= maxNodes) return nodes;
    const stride = Math.max(1, Math.ceil(nodes.length / maxNodes));
    return nodes.filter((_, idx) => idx % stride === 0);
  }, [nodes, solidFill]);

  const bounds = useMemo(() => {
    if (!sampledNodes.length) return { center: new THREE.Vector3(0, 0, 0), radius: 40 };
    const center = new THREE.Vector3();
    sampledNodes.forEach((n) => center.add(n.position));
    center.divideScalar(sampledNodes.length);
    let radius = 1;
    sampledNodes.forEach((n) => {
      radius = Math.max(radius, n.position.distanceTo(center));
    });
    radius = Math.max(radius, 20);
    return { center, radius };
  }, [sampledNodes]);

  const cameraPos = useMemo(() => {
    const r = bounds.radius;
    return [bounds.center.x + r * 1.4, bounds.center.y + r * 0.9, bounds.center.z + r * 1.4] as [number, number, number];
  }, [bounds]);

  return (
    <div className="w-full bg-gradient-to-br from-gray-900 via-gray-950 to-black border border-emerald-900/40 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-800/80 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest font-black text-emerald-300">Custom Shape Preview</div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={solidFill}
              onChange={(e) => setSolidFill(e.target.checked)}
              className="accent-emerald-400"
            />
            Solid fill
          </label>
          <input
            type="range"
            min={0.6}
            max={1.2}
            step={0.05}
            value={fillScale}
            onChange={(e) => setFillScale(parseFloat(e.target.value))}
            className="w-16 h-1 bg-gray-800 rounded appearance-none accent-emerald-500"
            title="Fill density"
          />
          <div className="text-[9px] text-gray-500">Drag to rotate</div>
        </div>
      </div>
      <div className="relative w-full" style={{ height: '260px' }}>
        <Canvas
          camera={{ position: cameraPos, fov: 38, near: 0.1, far: bounds.radius * 20 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <PreviewScene nodes={sampledNodes} settings={settings} center={bounds.center} solidFill={solidFill} fillScale={fillScale} />
        </Canvas>
      </div>
      <div className="px-3 py-1.5 border-t border-gray-800/80 text-[9px] text-gray-500">
        Axes show the three prime limits used for the custom lattice.
      </div>
    </div>
  );
};

export default CustomGeometryPreview;
