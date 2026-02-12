import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, Html, OrbitControls } from '@react-three/drei';
import { Color } from 'three';
import type { OctaAnchor } from '../../../utils/temperamentSolver';
import { computeOctaWeights } from '../../../utils/temperamentSolver';

type OctaCube3DProps = {
    x: number;
    y: number;
    z: number;
    anchors: OctaAnchor[];
    enabled: boolean;
    onUpdateAnchor: (id: string, field: 'n' | 'd', value: string) => void;
};

const VERTEX_POSITIONS: Record<string, [number, number, number]> = {
    v000: [-1, -1, -1],
    v001: [-1, -1, 1],
    v010: [-1, 1, -1],
    v011: [-1, 1, 1],
    v100: [1, -1, -1],
    v101: [1, -1, 1],
    v110: [1, 1, -1],
    v111: [1, 1, 1],
};

const CUBE_EDGES: [string, string][] = [
    
    ['v000', 'v100'],
    ['v100', 'v101'],
    ['v101', 'v001'],
    ['v001', 'v000'],
    
    ['v010', 'v110'],
    ['v110', 'v111'],
    ['v111', 'v011'],
    ['v011', 'v010'],
    
    ['v000', 'v010'],
    ['v100', 'v110'],
    ['v101', 'v111'],
    ['v001', 'v011'],
];

function weightPosFromXYZ(x: number, y: number, z: number): [number, number, number] {
    return [
        x * 2 - 1,
        y * 2 - 1,
        z * 2 - 1,
    ];
}

function weightColor(w: number): Color {
    const intensity = 0.3 + w * 0.7;
    return new Color().setHSL(0.67, 0.9, intensity * 0.6);
}

function fmtPct(v: number): string {
    return `${Math.round(v * 100)}%`;
}

type VertexSphereProps = {
    id: string;
    position: [number, number, number];
    n: number;
    d: number;
    weight: number;
    onUpdate: (id: string, n: number, d: number) => void;
};

const VertexSphere: React.FC<VertexSphereProps> = ({ id, position, n, d, weight, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [inputValue, setInputValue] = useState(`${n}/${d}`);
    const inputRef = useRef<HTMLInputElement>(null);

    const color = weightColor(weight);
    const scale = 0.08 + weight * 0.12;

    const handleStartEdit = () => {
        setInputValue(`${n}/${d}`);
        setEditing(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleCommit = () => {
        const match = inputValue.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
        if (match) {
            const newN = parseInt(match[1], 10);
            const newD = parseInt(match[2], 10);
            if (newN >= 1 && newD >= 1) {
                onUpdate(id, newN, newD);
            }
        }
        setEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCommit();
        } else if (e.key === 'Escape') {
            setEditing(false);
        }
    };

    return (
        <group position={position}>
            <mesh>
                <sphereGeometry args={[scale, 16, 16]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={weight * 0.8}
                    roughness={0.3}
                    metalness={0.5}
                />
            </mesh>
            <Html
                position={[0, 0.28, 0]}
                center
                style={{
                    pointerEvents: 'auto',
                    userSelect: 'none',
                }}
            >
                {editing ? (
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={handleCommit}
                        onKeyDown={handleKeyDown}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="w-14 bg-gray-900/95 border border-indigo-500 rounded text-[10px] text-center text-indigo-200 outline-none px-1 py-0.5"
                        placeholder="n/d"
                    />
                ) : (
                    
                    <div
                        onClick={(e) => { e.stopPropagation(); handleStartEdit(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex flex-col items-center cursor-pointer group"
                    >
                        <div
                            className="text-[11px] font-bold font-mono group-hover:text-indigo-300 transition-colors"
                            style={{
                                color: `hsl(220, 80%, ${55 + weight * 35}%)`,
                                textShadow: '0 0 4px rgba(0,0,0,0.8)'
                            }}
                        >
                            {n}/{d}
                        </div>
                        <div
                            className="text-[9px] font-mono"
                            style={{
                                color: `rgba(255,255,255,${0.4 + weight * 0.5})`,
                                textShadow: '0 0 3px rgba(0,0,0,0.9)'
                            }}
                        >
                            {fmtPct(weight)}
                        </div>
                    </div>
                )}
            </Html>
        </group>
    );
};

type WeightMarkerProps = {
    position: [number, number, number];
};

const WeightMarker: React.FC<WeightMarkerProps> = ({ position }) => {
    const ref = useRef<any>(null);

    useFrame(({ clock }) => {
        if (ref.current) {
            const t = clock.getElapsedTime();
            ref.current.scale.setScalar(0.15 + Math.sin(t * 3) * 0.02);
        }
    });

    return (
        <mesh ref={ref} position={position}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial
                color="#8B5CF6"
                emissive="#8B5CF6"
                emissiveIntensity={1.5}
                roughness={0.1}
                metalness={0.8}
                transparent
                opacity={0.9}
            />
        </mesh>
    );
};

type CubeSceneProps = {
    x: number;
    y: number;
    z: number;
    anchors: OctaAnchor[];
    onUpdateAnchor: (id: string, n: number, d: number) => void;
};

const CubeScene: React.FC<CubeSceneProps> = ({ x, y, z, anchors, onUpdateAnchor }) => {
    const weights = useMemo(() => computeOctaWeights(x, y, z), [x, y, z]);
    const weightPos = useMemo(() => weightPosFromXYZ(x, y, z), [x, y, z]);

    const anchorMap = useMemo(() => {
        const map: Record<string, OctaAnchor> = {};
        anchors.forEach(a => { map[a.id] = a; });
        return map;
    }, [anchors]);

    return (
        <>
            <ambientLight intensity={0.4} />
            <pointLight position={[5, 5, 5]} intensity={1} />
            <pointLight position={[-5, -5, -5]} intensity={0.5} color="#6366F1" />

            {CUBE_EDGES.map(([a, b], i) => (
                <Line
                    key={i}
                    points={[VERTEX_POSITIONS[a], VERTEX_POSITIONS[b]]}
                    color="#4B5563"
                    lineWidth={1}
                    transparent
                    opacity={0.6}
                />
            ))}

            {Object.entries(VERTEX_POSITIONS).map(([id, pos]) => {
                const anchor = anchorMap[id];
                const weight = weights[id] ?? 0;
                return (
                    <VertexSphere
                        key={id}
                        id={id}
                        position={pos}
                        n={anchor?.n ?? 1}
                        d={anchor?.d ?? 1}
                        weight={weight}
                        onUpdate={onUpdateAnchor}
                    />
                );
            })}

            <WeightMarker position={weightPos} />

            <Line points={[[-1.5, 0, 0], [1.5, 0, 0]]} color="#EF4444" lineWidth={0.5} transparent opacity={0.25} />
            <Line points={[[0, -1.5, 0], [0, 1.5, 0]]} color="#22C55E" lineWidth={0.5} transparent opacity={0.25} />
            <Line points={[[0, 0, -1.5], [0, 0, 1.5]]} color="#3B82F6" lineWidth={0.5} transparent opacity={0.25} />

            <OrbitControls
                enablePan={false}
                enableZoom={true}
                minDistance={4}
                maxDistance={10}
                autoRotate={false}
                makeDefault
            />
        </>
    );
};

export const OctaCube3D: React.FC<OctaCube3DProps> = ({ x, y, z, anchors, enabled, onUpdateAnchor }) => {
    
    const handleUpdate = useCallback((id: string, n: number, d: number) => {
        onUpdateAnchor(id, 'n', String(n));
        onUpdateAnchor(id, 'd', String(d));
    }, [onUpdateAnchor]);

    if (!enabled) {
        return null;
    }

    return (
        <div className="bg-gray-950/80 border border-gray-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-900/60 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                        3D Weight Cube
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">
                        ({Math.round(x * 100)}%, {Math.round(y * 100)}%, {Math.round(z * 100)}%)
                    </span>
                </div>
                <div className="text-[8px] text-gray-500">
                    Click ratio to edit
                </div>
            </div>

            <div
                className="relative w-full bg-gradient-to-br from-gray-900 via-gray-950 to-black"
                style={{ height: '300px' }}
            >
                <Canvas
                    camera={{ position: [4.5, 3.5, 4.5], fov: 42 }}
                    gl={{ antialias: true, alpha: true }}
                >
                    <CubeScene
                        x={x}
                        y={y}
                        z={z}
                        anchors={anchors}
                        onUpdateAnchor={handleUpdate}
                    />
                </Canvas>
            </div>

            <div className="px-3 py-1.5 bg-gray-900/40 border-t border-gray-800 flex justify-between items-center">
                <div className="text-[8px] text-gray-500">
                    Drag to rotate • Scroll to zoom
                </div>
                <div className="text-[8px] text-gray-500">
                    <span className="text-violet-400">●</span> = weight position
                </div>
            </div>
        </div>
    );
};

export default OctaCube3D;
