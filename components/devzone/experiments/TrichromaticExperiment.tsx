import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Line } from '@react-three/drei';
import * as THREE from 'three';

type HarmonicNode = {
    id: string;
    harmonic: number;
    position: THREE.Vector3;
    color: THREE.Color;
    layer: number; 
    parents: number[]; 
    label: string;
    ringIndex?: number;
    
    primaryComponents: { r: number, y: number, b: number };
};

const getBaseColorInfo = (angleDeg: number): { color: THREE.Color, components: { r: number, y: number, b: number } } => {
    
    let h = angleDeg % 360;
    if (h < 0) h += 360;

    let r = 0, y = 0, b = 0;
    
    if (h <= 120) { 
        const t = h / 120;
        r = 1 - t; y = t; b = 0;
    } else if (h <= 240) { 
        const t = (h - 120) / 120;
        r = 0; y = 1 - t; b = t;
    } else { 
        const t = (h - 240) / 120;
        r = t; y = 0; b = 1 - t;
    }

    let hue = 0;
    if (h <= 120) {
        hue = h * 0.5; 
    } else if (h <= 240) {
        const t = (h - 120) / 120;
        hue = 60 + t * 180; 
    } else {
        const t = (h - 240) / 120;
        hue = 240 + t * 120; 
    }
    const color = new THREE.Color().setHSL(hue / 360, 1.0, 0.5);

    return { color, components: { r, y, b } };
};

const componentsToColor = (comp: { r: number, y: number, b: number }): THREE.Color => {
    
    const total = comp.r + comp.y + comp.b;
    if (total <= 0.0001) return new THREE.Color(0,0,0);
    
    const r = comp.r / total;
    const y = comp.y / total;
    const b = comp.b / total;

    const x = r * 1 + y * (-0.5) + b * (-0.5);
    const z = r * 0 + y * (0.866) + b * (-0.866);
    
    let angle = Math.atan2(z, x) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    let hue = 0;
    if (angle <= 120) {
        hue = angle * 0.5;
    } else if (angle <= 240) {
        const t = (angle - 120) / 120;
        hue = 60 + t * 180;
    } else {
        const t = (angle - 240) / 120;
        hue = 240 + t * 120;
    }
    
     const purity = Math.sqrt(x*x + z*z);
     
     const saturation = 0.8 + (purity * 0.2); 
     const lightness = 0.5; 
     
     return new THREE.Color().setHSL(hue / 360, saturation, lightness);
 };

const generateBaseRings = (maxRings: number, radiusScale: number): HarmonicNode[] => {
    const nodes: HarmonicNode[] = [];
    
    const addRing = (ringIdx: number, values: number[]) => {
        const count = values.length;
        const radius = ringIdx * radiusScale;
        
        for (let i = 0; i < count; i++) {
            const harmonic = values[i];
            
            const angleStep = 360 / count;
            const angleDeg = (i * angleStep) % 360;
            const angleRad = (angleDeg * Math.PI) / 180;
            
            const x = radius * Math.cos(angleRad);
            const z = radius * Math.sin(angleRad);
            
            const colorAngle = (angleDeg + 240) % 360;
            const { color, components } = getBaseColorInfo(colorAngle);
            
            nodes.push({
                id: `h-${harmonic}`,
                harmonic,
                position: new THREE.Vector3(x, 0, z),
                color,
                layer: 0,
                parents: [],
                label: `${harmonic}`,
                ringIndex: ringIdx,
                primaryComponents: components
            });
        }
    };
    
    if (maxRings >= 1) addRing(1, [3, 4, 5]);
    if (maxRings >= 2) addRing(2, [6, 7, 8, 9, 10, 11]);
    
    let currentStart = 13;
    for (let r = 3; r <= maxRings; r++) {
        const count = 3 * Math.pow(2, r - 1);
        const values = [];
        for(let i=0; i<count; i++) {
            values.push(currentStart + i);
        }
        addRing(r, values);
        currentStart = values[values.length-1] + 1;
    }

    return nodes;
};

const generateMixLayers = (baseNodes: HarmonicNode[], heightStep: number, radiusScale: number): { nodes: HarmonicNode[], mValue: number } => {
    let allMixNodes: HarmonicNode[] = [];
    
    let currentLayerRings: HarmonicNode[][] = []; 
    
    let maxRingIndex = 0;
    baseNodes.forEach(n => {
        if (n.ringIndex && n.ringIndex > maxRingIndex) maxRingIndex = n.ringIndex;
    });
    
    for(let r=1; r<=maxRingIndex; r++) {
        currentLayerRings.push([]); 
    }
    
    baseNodes.forEach(n => {
        if (n.ringIndex) {
            currentLayerRings[n.ringIndex - 1].push(n);
        }
    });
    
    currentLayerRings.forEach(nodes => nodes.sort((a, b) => a.harmonic - b.harmonic));

    let layerIndex = 1;
    
    while (true) {
        
        if (currentLayerRings.length === 0) break;
        
        const nextLayerRings: HarmonicNode[][] = [];
        let producedAnyInThisLayer = false;

        if (currentLayerRings.length > 0) {
            const sourceRing = currentLayerRings[0];
            if (sourceRing.length === 3) {
                
                const comp = { r:0, y:0, b:0 };
                const parents: number[] = [];
                const avgPos = new THREE.Vector3();
                let harmonicSum = 0;
                
                sourceRing.forEach(n => {
                    comp.r += n.primaryComponents.r;
                    comp.y += n.primaryComponents.y;
                    comp.b += n.primaryComponents.b;
                    parents.push(n.harmonic);
                    harmonicSum += n.harmonic;
                    avgPos.add(n.position);
                });
                
                const pos = new THREE.Vector3(0, heightStep * layerIndex, 0);
                const c = componentsToColor(comp);
                
                const centerNode: HarmonicNode = {
                    id: `mix-L${layerIndex}-Center`,
                    harmonic: harmonicSum,
                    position: pos,
                    color: c,
                    layer: layerIndex,
                    parents: parents,
                    label: `${harmonicSum}`,
                    ringIndex: 0, 
                    primaryComponents: comp
                };
                
                allMixNodes.push(centerNode);
                
                producedAnyInThisLayer = true;
            }
        }
        
        for (let i = 1; i < currentLayerRings.length; i++) {
            const sourceRing = currentLayerRings[i];
            const count = sourceRing.length;
            
            if (count % 2 === 0) {
                const nextCount = count / 2;
                const stride = nextCount;
                const newRingNodes: HarmonicNode[] = [];
                
                const newRingIndex = i; 
                const layerRadius = newRingIndex * radiusScale;
                
                for (let k = 0; k < nextCount; k++) {
                    const n1 = sourceRing[k];
                    const n2 = sourceRing[k + stride];
                    
                    const harmonicSum = n1.harmonic + n2.harmonic;
                    
                    const comp = {
                        r: n1.primaryComponents.r + n2.primaryComponents.r,
                        y: n1.primaryComponents.y + n2.primaryComponents.y,
                        b: n1.primaryComponents.b + n2.primaryComponents.b
                    };
                    
                    const parents = [n1.harmonic, n2.harmonic];
                    
                    const angleStep = (Math.PI * 2) / nextCount;
                    const angle = k * angleStep;
                    
                    const x = layerRadius * Math.cos(angle);
                    const z = layerRadius * Math.sin(angle);
                    const y = heightStep * layerIndex;
                    
                    const pos = new THREE.Vector3(x, y, z);
                    const c = componentsToColor(comp);
                    
                    const newNode: HarmonicNode = {
                        id: `mix-L${layerIndex}-R${newRingIndex}-${k}`,
                        harmonic: harmonicSum,
                        position: pos,
                        color: c,
                        layer: layerIndex,
                        parents: parents,
                        label: `${harmonicSum}`,
                        ringIndex: newRingIndex,
                        primaryComponents: comp
                    };
                    
                    newRingNodes.push(newNode);
                    allMixNodes.push(newNode);
                }
                
                nextLayerRings.push(newRingNodes);
                producedAnyInThisLayer = true;
            }
        }
        
        if (!producedAnyInThisLayer && nextLayerRings.length === 0) break;
        
        currentLayerRings = nextLayerRings;
        layerIndex++;
        if (layerIndex > 20) break; 
    }
    
    return { nodes: allMixNodes, mValue: layerIndex - 1 };
};

const TrichromaticScene = ({ nValue, heightStep, showRatio, onMChange }: { nValue: number, heightStep: number, showRatio: boolean, onMChange: (m: number) => void }) => {
    const params = useMemo(() => ({
        radiusScale: 5,
        
    }), []);

    const { baseNodes, mixNodes, mValue } = useMemo(() => {
        const base = generateBaseRings(nValue, params.radiusScale);
        const { nodes: mix, mValue: m } = generateMixLayers(base, heightStep, params.radiusScale);
        return { baseNodes: base, mixNodes: mix, mValue: m };
    }, [nValue, heightStep, params]);

    React.useEffect(() => {
        onMChange(mValue);
    }, [mValue, onMChange]);

    const getLabel = (node: HarmonicNode) => {
        if (!showRatio) return node.label;
        const { r, y, b } = node.primaryComponents;
        return `${node.label}\nR:${r.toFixed(1)}\nY:${y.toFixed(1)}\nB:${b.toFixed(1)}`;
    };

    return (
        <group>
            <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
            <ambientLight intensity={0.5} />
            <pointLight position={[0, 50, 0]} intensity={2} />
            
            {baseNodes.map(node => (
                <group key={node.id} position={node.position}>
                    <mesh>
                        <sphereGeometry args={[0.8, 16, 16]} />
                        <meshStandardMaterial 
                            color={node.color} 
                            emissive={node.color}
                            emissiveIntensity={0.8}
                            roughness={0.2}
                            metalness={0.1}
                        />
                    </mesh>
                    <Billboard position={[0, 1.5, 0]}>
                        <Text fontSize={0.8} color="white" outlineWidth={0.05} outlineColor="black" lineHeight={1.1}>
                            {getLabel(node)}
                        </Text>
                    </Billboard>
                </group>
            ))}

            {mixNodes.map(node => (
                <group key={node.id} position={node.position}>
                    <mesh>
                        <sphereGeometry args={[0.8, 16, 16]} />
                        <meshStandardMaterial 
                            color={node.color} 
                            emissive={node.color}
                            emissiveIntensity={0.8}
                            roughness={0.2}
                            metalness={0.1}
                        />
                    </mesh>
                    <Billboard position={[0, 1.5, 0]}>
                        <Text fontSize={0.8} color="white" outlineWidth={0.05} outlineColor="black" lineHeight={1.1}>
                            {getLabel(node)}
                        </Text>
                    </Billboard>
                    
                    {node.parents.map((pid, idx) => {
                        const parent = baseNodes.find(n => n.harmonic === pid) || mixNodes.find(n => n.harmonic === pid) || 
                                     
                                     (mixNodes.find(n => n.harmonic === pid && n.layer === node.layer - 1));

                        if (!parent) return null;
                        return (
                            <Line 
                                key={`line-${node.id}-${pid}`}
                                points={[new THREE.Vector3(0,0,0), parent.position.clone().sub(node.position)]}
                                color={node.color}
                                transparent
                                opacity={0.5}
                                lineWidth={1.5}
                            />
                        );
                    })}
                </group>
            ))}
            
            <gridHelper args={[100, 100, 0x222222, 0x111111]} position={[0, -0.1, 0]} />
        </group>
    );
};

const TrichromaticExperiment = () => {
    const [nValue, setNValue] = React.useState(5);
    const [mValue, setMValue] = React.useState(0);
    const [heightStep, setHeightStep] = React.useState(10);
    const [showRatio, setShowRatio] = React.useState(false);

    return (
        <div style={{ width: '100%', height: '500px', background: '#000', border: '1px solid #333', marginTop: '1rem', position: 'relative' }}>
            <Canvas camera={{ position: [0, 40, 40], fov: 45 }}>
                <TrichromaticScene nValue={nValue} heightStep={heightStep} showRatio={showRatio} onMChange={setMValue} />
            </Canvas>
            
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #444',
                color: 'white',
                fontFamily: 'monospace'
            }}>
                <div style={{ marginBottom: '5px' }}>
                    <label>N (Rings): {nValue}</label>
                    <input 
                        type="range" 
                        min="1" 
                        max="8" 
                        step="1" 
                        value={nValue} 
                        onChange={(e) => setNValue(parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>
                <div style={{ marginBottom: '5px' }}>
                    <label>Height (h): {heightStep}</label>
                    <input 
                        type="range" 
                        min="5" 
                        max="30" 
                        step="1" 
                        value={heightStep} 
                        onChange={(e) => setHeightStep(parseInt(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>
                <div style={{ marginBottom: '5px' }}>
                    <label>
                        <input 
                            type="checkbox" 
                            checked={showRatio} 
                            onChange={(e) => setShowRatio(e.target.checked)}
                            style={{ marginRight: '5px' }}
                        />
                        Show RYB Ratio
                    </label>
                </div>
                <div style={{ color: '#0f0', fontWeight: 'bold' }}>
                    M (Generated): {mValue}
                </div>
            </div>

            <div style={{ 
                position: 'absolute', 
                bottom: '10px', 
                left: '10px', 
                color: '#fff', 
                pointerEvents: 'none',
                background: 'rgba(0,0,0,0.5)',
                padding: '5px',
                fontSize: '12px'
            }}>
                Mode: Ring Harmonic Mixing<br/>
                Base: Blue(Start) &rarr; Red &rarr; Yellow<br/>
                Mix: Equilateral Triads from Ring
            </div>
        </div>
    );
};

export default TrichromaticExperiment;
