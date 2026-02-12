import React, { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { shallow } from 'zustand/shallow';
import { useLatticeStore } from '../store/latticeStoreContext';
import type { NodeData } from '../types';
import { formatRatio, formatRatioForDisplay, isPrime } from '../musicLogic';
import { GEN_SIZES, getPrimeColor } from '../constants';
import { buildNodeIndexMap, getRenderedNodePosition } from '../utils/renderedPosition';
import { NodeInstances } from './lattice/NodeInstances';
import { StructureEdges, DetailEdges, HighlightEdges, CommaEdges, ComparisonEdges } from './lattice/EdgeInstances';
import { NavigationControls } from './lattice/Controls';
import { HChromaVisualizer } from './lattice/HChromaVisualizer';
import { RenderStatsProbe } from './lattice/RenderStatsProbe';
import { isLowEndDevice } from '../utils/mobileOptimizations';
import { createLogger } from '../utils/logger';
import { STORAGE_KEYS } from '../store/logic/storageKeys';

const log = createLogger('lattice/scene');

const Labels = () => {
    const {
        nodes,
        selectedNode,
        nearbyNodes,
        settings,
        isGravityEnabled,
        isIsolationMode,
        simpleModeStage,
        commaLines,
        customNodeTextures,
        nodeSurfaceLabelOverrides,
        nodeNameOverrides
    } = useLatticeStore(
        (s) => ({
            nodes: s.nodes,
            selectedNode: s.selectedNode,
            nearbyNodes: s.nearbyNodes,
            settings: s.settings,
            isGravityEnabled: s.isGravityEnabled,
            isIsolationMode: s.isIsolationMode,
            simpleModeStage: s.simpleModeStage,
            commaLines: s.commaLines,
            customNodeTextures: s.customNodeTextures,
            nodeSurfaceLabelOverrides: s.nodeSurfaceLabelOverrides,
            nodeNameOverrides: s.nodeNameOverrides
        }),
        shallow
    );
    const { layoutMode, globalScale, diamondLimit, labelMode, temperamentMorph } = settings.visuals;
    const { isSimpleMode, simpleLabelMode } = settings;
    const { camera } = useThree();

    const surfaceEnabled = !!settings.visuals.nodeSurfaceRatioLabelsEnabled;
    const texturedMode = settings.visuals.nodeSurfaceRatioTexturedMode || 'both';
    const surfacePlacement = settings.visuals.nodeSurfaceRatioPlacement || 'surface';
    const surfaceLabelMode = settings.visuals.nodeSurfaceRatioLabelMode || 'ratio';
    const surfaceEmphasizePrimes = !!settings.visuals.nodeSurfaceRatioEmphasizePrimes;
    const nodeLabelMode = settings.visuals?.ratioDisplay?.contexts?.nodeLabels || 'fraction';
    const autoPowerDigits = settings.visuals?.ratioDisplay?.autoPowerDigits ?? 14;
    const latticeLabelMode = settings.visuals.latticeLabelMode || 'name';

    const nodeIndexMap = useMemo(() => buildNodeIndexMap(nodes), [nodes]);
    const rootNode = useMemo(() => nodes.find(n => n.gen === 0 && n.originLimit === 0), [nodes]);

    const filterMode = settings.visuals.nodeSurfaceRatioFilterMode || 'all';
    const nearCenterCount = settings.visuals.nodeSurfaceRatioNearCenterCount ?? 50;

    const nearCenterNodes = useMemo(() => {
        if (filterMode !== 'nearCenter' && filterMode !== 'nearCenterAndMainAxis') return new Set<string>();
        
        const sorted = [...nodes].sort((a, b) => Math.abs(a.cents) - Math.abs(b.cents));
        const topN = sorted.slice(0, nearCenterCount);
        return new Set(topN.map(n => n.id));
    }, [nodes, filterMode, nearCenterCount]);

    const mainAxisNodes = useMemo(() => {
        if (filterMode !== 'mainAxis' && filterMode !== 'nearCenterAndMainAxis') return new Set<string>();
        return new Set(nodes.filter(n => n.gen === 0).map(n => n.id));
    }, [nodes, filterMode]);

    const customSymbols = useMemo(() => {
        if (!settings.customPrimes) return undefined;
        const map: Record<number, string> = {};
        let hasSymbols = false;
        settings.customPrimes.forEach(cp => {
            if (cp.symbol?.up) {
                map[cp.prime] = cp.symbol.up;
                hasSymbols = true;
            }
        });
        return hasSymbols ? map : undefined;
    }, [settings.customPrimes]);

    const resolveNodePosition = (node: NodeData) => {
        if (layoutMode === 'pitch-field') {
            return getRenderedNodePosition(node, nodes, settings, nodeIndexMap, rootNode);
        }
        return node.position;
    };

    const resolveTextureVisibility = (node: NodeData) => {
        const hasTexture = !!customNodeTextures[node.id];
        let showTexture = hasTexture;
        if (texturedMode === 'ratioOnly') showTexture = false;
        const override = nodeSurfaceLabelOverrides?.[node.id];
        if (override?.showTexture !== undefined) showTexture = !!override.showTexture && hasTexture;
        return { showTexture, override };
    };

    const getShapeRadiusFactor = (shape: string) => {
        switch (shape) {
            case 'sphere':
                return 0.6;
            case 'point':
                return 0.3;
            case 'cube':
                return 0.87;
            case 'tetra':
                return 0.8;
            case 'diamond':
                return 0.7;
            default:
                return 0.7;
        }
    };

    const getGenScale = (node: NodeData) => ((GEN_SIZES as any)[node.gen] || 0.25) * (settings.visuals.nodeScale || 1);

    const getNodeRadius = (genScale: number, showTexture: boolean, isSelectedNode: boolean) => {
        const baseFactor = showTexture ? 0.6 : getShapeRadiusFactor(settings.visuals.nodeShape);
        const visualScale = genScale * (showTexture ? 2.5 : 1.0) * (!showTexture && isSelectedNode ? 2.0 : 1.0);
        return Math.max(0.01, visualScale * baseFactor);
    };

    const nodesToLabel = useMemo(() => {
        if (surfaceEnabled) {
            if (isIsolationMode) {
                const set = new Set<NodeData>();
                if (selectedNode) set.add(selectedNode);
                nearbyNodes.forEach(n => set.add(n));
                commaLines.forEach(line => {
                    const target = nodes.find(n => n.id === line.targetId);
                    if (target) set.add(target);
                });
                return Array.from(set);
            }

            if (filterMode === 'all') {
                return nodes;
            } else if (filterMode === 'nearCenter') {
                return nodes.filter(n => nearCenterNodes.has(n.id));
            } else if (filterMode === 'mainAxis') {
                return nodes.filter(n => mainAxisNodes.has(n.id));
            } else if (filterMode === 'nearCenterAndMainAxis') {
                return nodes.filter(n => nearCenterNodes.has(n.id) || mainAxisNodes.has(n.id));
            }
            return nodes;
        }

        if (isSimpleMode) {
            if (simpleModeStage === 'tutorial') return nodes;
            if (simpleModeStage === 'manual') return nodes;
        }
        if (layoutMode === 'diamond') return nodes;

        const set = new Set<NodeData>();
        if (rootNode) set.add(rootNode);
        if (selectedNode) set.add(selectedNode);

        commaLines.forEach(line => {
            const target = nodes.find(n => n.id === line.targetId);
            if (target) set.add(target);
        });

        if (isIsolationMode) {
            nearbyNodes.forEach(n => set.add(n));
        }

        let arr = Array.from(set);
        if (isIsolationMode) {
            const nearbySet = new Set(nearbyNodes.map(n => n.id));
            const commaTargetSet = new Set(commaLines.map(l => l.targetId));
            arr = arr.filter(n => nearbySet.has(n.id) || selectedNode?.id === n.id || commaTargetSet.has(n.id));
        }

        return arr;
    }, [selectedNode, nodes, nearbyNodes, isIsolationMode, simpleModeStage, commaLines, layoutMode, rootNode, isSimpleMode, surfaceEnabled, filterMode, nearCenterNodes, mainAxisNodes]);

    if (isGravityEnabled) return null;

    if (!surfaceEnabled && !isSimpleMode && layoutMode !== 'diamond') {
        return null;
    }

    const orderedNodes = surfaceEnabled
        ? [...nodesToLabel].sort((a, b) => {
            if (selectedNode?.id === a.id) return -1;
            if (selectedNode?.id === b.id) return 1;
            const da = camera.position.distanceToSquared(a.position);
            const db = camera.position.distanceToSquared(b.position);
            return da - db;
        })
        : nodesToLabel;

    const gridSize = Math.max(0.6, (settings.visuals.nodeScale || 1) * 1.4);
    const labelGrid = new Map<string, { pos: THREE.Vector3; radius: number }[]>();
    const gridKey = (v: THREE.Vector3) => `${Math.floor(v.x / gridSize)},${Math.floor(v.y / gridSize)},${Math.floor(v.z / gridSize)}`;
    const addToGrid = (pos: THREE.Vector3, radius: number) => {
        const key = gridKey(pos);
        const bucket = labelGrid.get(key);
        if (bucket) {
            bucket.push({ pos, radius });
        } else {
            labelGrid.set(key, [{ pos, radius }]);
        }
    };
    const hasCollision = (pos: THREE.Vector3, radius: number, gap: number) => {
        const range = Math.max(1, Math.ceil(radius / gridSize));
        const gx = Math.floor(pos.x / gridSize);
        const gy = Math.floor(pos.y / gridSize);
        const gz = Math.floor(pos.z / gridSize);
        for (let dx = -range; dx <= range; dx += 1) {
            for (let dy = -range; dy <= range; dy += 1) {
                for (let dz = -range; dz <= range; dz += 1) {
                    const key = `${gx + dx},${gy + dy},${gz + dz}`;
                    const bucket = labelGrid.get(key);
                    if (!bucket) continue;
                    for (const entry of bucket) {
                        const minDist = radius + entry.radius + gap;
                        if (pos.distanceToSquared(entry.pos) < minDist * minDist) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    if (surfaceEnabled) {
        for (const node of orderedNodes) {
            const pos = resolveNodePosition(node);
            const { showTexture } = resolveTextureVisibility(node);
            const genScale = getGenScale(node);
            const radius = getNodeRadius(genScale, showTexture, selectedNode?.id === node.id);
            addToGrid(pos, radius);
        }
    }

    return (
        <group>
            {orderedNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                const pos = resolveNodePosition(node);
                const yOffset = isSelected ? (layoutMode === 'diamond' ? 2.5 : 4.5) : 3.0;

                let effectiveRatioLabel = '';
                if (temperamentMorph === 1.0) {
                    const semitones = Math.round(node.cents / 100);
                    effectiveRatioLabel = `2^(${semitones}/12)`;
                } else {
                    effectiveRatioLabel = formatRatioForDisplay(node.ratio, node.primeVector, { mode: nodeLabelMode, autoPowerDigits, customSymbols });
                }

                if (surfaceEnabled) {
                    const { showTexture, override } = resolveTextureVisibility(node);
                    let showRatio = !showTexture || texturedMode !== 'textureOnly';
                    if (override?.showRatio !== undefined) showRatio = override.showRatio;
                    if (!showRatio) return null;

                    const genScale = getGenScale(node);
                    const fontScale = settings.visuals.nodeSurfaceRatioFontScale ?? 0.55;
                    const perNodeScale = Math.min(3.0, Math.max(0.2, override?.fontScale ?? 1.0));
                    let fontSize = Math.max(0.12, genScale * fontScale * perNodeScale * (isSelected ? 1.1 : 1.0));

                    let labelText = effectiveRatioLabel;
                    let primeHighlight = false;
                    let primeValue: number | null = null;

                    if (surfaceLabelMode === 'harmonic') {
                        let harmonic = 1n;
                        for (const primeStr of Object.keys(node.primeVector || {})) {
                            const p = Number(primeStr);
                            if (!Number.isFinite(p) || p === 2) continue;
                            const exp = (node.primeVector as any)[p] || 0;
                            if (!exp) continue;
                            harmonic *= BigInt(p) ** BigInt(Math.abs(exp));
                        }
                        const harmonicText = harmonic.toString();
                        labelText = harmonicText;
                        const shrinkThreshold = 11;
                        if (harmonicText.length > shrinkThreshold) {
                            const shrink = Math.max(0.45, shrinkThreshold / harmonicText.length);
                            fontSize *= shrink;
                        }
                        if (surfaceEmphasizePrimes && harmonic <= BigInt(Number.MAX_SAFE_INTEGER)) {
                            const candidate = Number(harmonic);
                            if (Number.isFinite(candidate) && isPrime(candidate)) {
                                primeHighlight = true;
                                primeValue = candidate;
                            }
                        }
                    }

                    const approxRadius = getNodeRadius(genScale, showTexture, isSelected);
                    const textWidth = Math.max(fontSize, fontSize * Math.max(1, labelText.length) * 0.7);
                    const textHeight = fontSize * 1.2;
                    const labelRadius = Math.max(textWidth, textHeight) * 0.6;
                    const padding = Math.max(0.06, fontSize * 0.6);
                    const baseOffset = approxRadius + padding + labelRadius;

                    const dir = new THREE.Vector3();
                    if (surfacePlacement === 'above') {
                        dir.set(0, 1, 0);
                    } else {
                        dir.set(
                            camera.position.x - pos.x,
                            camera.position.y - pos.y,
                            camera.position.z - pos.z
                        );
                        dir.normalize();
                    }

                    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
                    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
                    side.normalize();

                    const gap = Math.max(0.03, fontSize * 0.45);
                    let finalPos = new THREE.Vector3(pos.x + dir.x * baseOffset, pos.y + dir.y * baseOffset, pos.z + dir.z * baseOffset);
                    let placed = false;
                    for (let attempt = 0; attempt < 6; attempt += 1) {
                        const outward = baseOffset + attempt * labelRadius * 0.6;
                        const lateral = attempt === 0 ? 0 : ((attempt % 2 === 0 ? 1 : -1) * labelRadius * 0.6);
                        const candidate = new THREE.Vector3(
                            pos.x + dir.x * outward + side.x * lateral,
                            pos.y + dir.y * outward + side.y * lateral,
                            pos.z + dir.z * outward + side.z * lateral
                        );
                        if (!hasCollision(candidate, labelRadius, gap)) {
                            finalPos = candidate;
                            placed = true;
                            break;
                        }
                    }
                    if (!placed) {
                        finalPos = new THREE.Vector3(pos.x + dir.x * baseOffset, pos.y + dir.y * baseOffset, pos.z + dir.z * baseOffset);
                    }
                    addToGrid(finalPos, labelRadius);

                    const labelColor = isSelected
                        ? "white"
                        : (primeHighlight && primeValue !== null ? getPrimeColor(primeValue as any, settings) : "#E5E7EB");

                    return (
                        <Billboard key={`surface-label-${node.id}`} position={[finalPos.x, finalPos.y, finalPos.z]} follow>
                            <Text
                                fontSize={fontSize}
                                color={labelColor}
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.12}
                                outlineColor="black"
                                renderOrder={1000}
                                material-depthTest={false}
                                material-depthWrite={false}
                            >
                                {labelText}
                            </Text>
                        </Billboard>
                    );
                }

                const nameOverride = nodeNameOverrides?.[node.id];
                const baseName = nameOverride?.lattice || node.name;

                let labelText = baseName;
                if (layoutMode === 'diamond') {
                    labelText = (labelMode === 'name') ? baseName : effectiveRatioLabel;
                } else if (isSimpleMode) {
                    if (simpleModeStage === 'tutorial') {
                        labelText = `${baseName}\n${effectiveRatioLabel}`;
                    } else {
                        if (simpleLabelMode === 'both') {
                            labelText = `${baseName}\n${effectiveRatioLabel}`;
                        } else {
                            labelText = simpleLabelMode === 'ratio' ? effectiveRatioLabel : baseName;
                        }
                    }
                } else if (latticeLabelMode === 'both') {
                    labelText = `${baseName}\n${effectiveRatioLabel}`;
                } else if (latticeLabelMode === 'ratio') {
                    labelText = effectiveRatioLabel;
                }

                return (
                    <Text
                        key={`label-${node.id}`}
                        position={[pos.x, pos.y + yOffset, pos.z]}
                        fontSize={isSelected ? 2.0 : (layoutMode === 'diamond' ? 1.5 : 1.2)}
                        color={isSelected ? "white" : "#FFD700"}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.1}
                        outlineColor="black"
                        renderOrder={1000}
                        material-depthTest={false}
                        material-depthWrite={false}
                    >
                        {labelText}
                    </Text>
                )
            })}
        </group>
    );
}

const BackgroundController = () => {
    const { scene } = useThree();
    const { backgroundImageUrl, backgroundColor } = useLatticeStore(
        (s) => ({
            backgroundImageUrl: s.settings.visuals.backgroundImageUrl,
            backgroundColor: s.settings.visuals.backgroundColor
        }),
        shallow
    );
    useEffect(() => {
        if (backgroundImageUrl) {
            scene.background = null;
        } else {
            scene.background = new THREE.Color(backgroundColor);
        }
    }, [backgroundImageUrl, backgroundColor, scene]);
    return null;
};

const WebGLContextEvents = ({ enabled }: { enabled: boolean }) => {
    const { gl } = useThree();

    useEffect(() => {
        if (!enabled) return;
        const canvas = gl.domElement;
        const handleLost = (event: Event) => {
            log.warn('WebGL context lost');
            event.preventDefault();
        };
        const handleRestored = () => {
            log.info('WebGL context restored');
            gl.setSize(canvas.clientWidth, canvas.clientHeight);
        };
        canvas.addEventListener('webglcontextlost', handleLost);
        canvas.addEventListener('webglcontextrestored', handleRestored);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleLost);
            canvas.removeEventListener('webglcontextrestored', handleRestored);
        };
    }, [enabled, gl]);

    return null;
};

type Lattice3DProps = {
    isMobile?: boolean;
};

export default function Lattice3D({ isMobile = false }: Lattice3DProps) {
    const { regenerateLattice, visuals, expansionA, spiralEnabled, selectNode } = useLatticeStore(
        (s) => ({
            regenerateLattice: s.regenerateLattice,
            visuals: s.settings.visuals,
            expansionA: s.settings.expansionA,
            spiralEnabled: !!s.settings.spiral?.enabled,
            selectNode: s.selectNode
        }),
        shallow
    );

    useEffect(() => {
        regenerateLattice();
    }, [regenerateLattice]);

    // NOTE: three@0.160 defaults to physically-correct lighting unless legacy mode is enabled.
    // If the stored brightness is 0/NaN (or if lighting is interpreted physically) the lattice can
    // appear completely black. We sanitize here so the scene remains visible and debuggable.
    const brightnessRaw = Number.isFinite(visuals.globalBrightness as any)
        ? Number(visuals.globalBrightness)
        : 1.0;
    const brightness = Math.max(0.05, brightnessRaw);
    const isSpiral = spiralEnabled;
    const isHChroma = visuals.layoutMode === 'h-chroma';
    const showDevProbe =
        import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        window.localStorage.getItem(STORAGE_KEYS.devDiagnostics) === '1';

    const extent = expansionA * 10 * (visuals.globalScale || 1.0);
    const viewDist = isSpiral ? 50000000 : Math.max(500000, extent * 5);
    const fogDist = isSpiral ? 50000000 : Math.max(4000, extent * 2.5);

    const isLowEnd = isMobile ? isLowEndDevice() : false;
    const renderScaleRaw = Number.isFinite(visuals.renderScale) ? (visuals.renderScale as number) : 1;
    const renderScale = Math.min(2, Math.max(0.5, renderScaleRaw));
    const clampDpr = (value: number) => Math.min(2, Math.max(0.5, value));
    const baseDpr: number | [number, number] = isMobile ? 1 : [1, 1.5];
    const dpr: number | [number, number] = Array.isArray(baseDpr)
        ? [clampDpr(baseDpr[0] * renderScale), clampDpr(baseDpr[1] * renderScale)]
        : clampDpr(baseDpr * renderScale);
    const cameraZ = isMobile ? 80 : 50;
    const latticeYOffset = isMobile ? 15 : 0;

    return (
        <Canvas 
            dpr={dpr} 
            camera={{ position: [0, 0, cameraZ], fov: 60, far: viewDist }} 
            frameloop="demand"
            gl={{ 
                antialias: !isLowEnd, 
                powerPreference: isMobile ? "low-power" : "high-performance", 
                alpha: true,
                preserveDrawingBuffer: false, 
                failIfMajorPerformanceCaveat: false 
            }} 
            onCreated={({ gl }) => {
                // Fix: "all black" lattice under three@0.160's non-legacy lighting + linear output.
                // Align renderer output and light model with the rest of the app (see MuseumScene).
                try {
                    gl.outputColorSpace = THREE.SRGBColorSpace;
                    // These flags are present in newer three builds; guard with `as any`.
                    (gl as any).useLegacyLights = true;
                    (gl as any).physicallyCorrectLights = false;
                    // Keep tone mapping conservative; lattice lights already scale with `brightness`.
                    gl.toneMapping = THREE.ACESFilmicToneMapping;
                    gl.toneMappingExposure = 1.0;
                } catch (e) {
                    log.warn('Failed to configure WebGL renderer for lattice', e);
                }
            }}
            onPointerMissed={(e) => { if (e.type === 'click') selectNode(null); }}
        >
            <WebGLContextEvents enabled={isMobile} />
            {showDevProbe && <RenderStatsProbe />}
            <BackgroundController />
            {visuals.enableFog && <fog attach="fog" args={[visuals.backgroundColor, 50, fogDist]} />}
            <ambientLight intensity={0.6 * brightness} />
            <pointLight position={[100, 100, 100]} intensity={1.0 * brightness} />
            <directionalLight position={[-50, 50, 50]} intensity={0.8 * brightness} />
            <group position={[0, latticeYOffset, 0]}>
                {isHChroma ? (
                    <HChromaVisualizer />
                ) : (
                    <>
                        <NodeInstances />
                        <StructureEdges />
                        <DetailEdges />
                        <HighlightEdges />
                        <CommaEdges />
                        <ComparisonEdges />
                        <Labels />
                    </>
                )}
            </group>
            <NavigationControls />
        </Canvas>
    );
}
