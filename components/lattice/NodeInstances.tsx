
import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useLatticeStore, useLatticeStoreApi } from '../../store/latticeStoreContext';
import { DEFAULT_SETTINGS, GEN_SIZES, getPrimeColor as getGlobalPrimeColor } from '../../constants';
import type { NodeData, NodeShape, PrimeLimit, NodeMaterial } from '../../types';
import { formatRatio, getTETCents, adjustOctave } from '../../musicLogic';
import { buildNodeIndexMap, getPitchFieldPosition, getRootNodeForPitchField } from '../../utils/renderedPosition';
import { playNote } from '../../audioEngine';
import { ConfirmDialog } from '../overlays/ConfirmDialog';

const geoSphereHigh = new THREE.SphereGeometry(0.6, 16, 16);
const geoSphereLow = new THREE.IcosahedronGeometry(0.7, 0);
const geoCube = new THREE.BoxGeometry(1, 1, 1);
const geoDiamond = new THREE.OctahedronGeometry(0.7, 0);
const geoTetra = new THREE.TetrahedronGeometry(0.8, 0);

const NodeGeometry = ({ shape }: { shape: NodeShape }) => {
    switch (shape) {
        case 'cube': return <primitive object={geoCube} attach="geometry" />;
        case 'diamond': return <primitive object={geoDiamond} attach="geometry" />;
        case 'tetra': return <primitive object={geoTetra} attach="geometry" />;
        case 'sphere': return <primitive object={geoSphereHigh} attach="geometry" />;
        case 'point': return <sphereGeometry args={[0.3, 6, 6]} />;
        case 'lowpoly': default: return <primitive object={geoSphereLow} attach="geometry" />;
    }
};

const CustomTexturedNode: React.FC<{ node: NodeData; url: string; settings: any; onSelect: (n: NodeData, p?: boolean, h?: boolean, a?: boolean) => void; onAddToKeyboard: (n: NodeData) => void }> = ({ node, url, settings, onSelect, onAddToKeyboard }) => {
    const texture = useLoader(THREE.TextureLoader, url);
    const scale = (GEN_SIZES as any)[node.gen] * settings.visuals.nodeScale * 2.5;
    return (
        <mesh
            position={node.position}
            scale={[scale, scale, scale]}
            onPointerDown={(e) => {
                e.stopPropagation();
                playNote(node, settings);
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node, false, true, false);
            }}
            onContextMenu={(e) => { e.nativeEvent.preventDefault(); e.stopPropagation(); onAddToKeyboard(node); }}
        >
            <sphereGeometry args={[0.6, 16, 16]} />
            <meshBasicMaterial map={texture} />
        </mesh>
    )
};

type TrackOverlayStyle = {
    color: string;
    material: NodeMaterial;
    texture: THREE.Texture | null;
};

type BranchPromptState = {
    node: NodeData;
    neg: string;
    pos: string;
    defaultNeg: number;
    defaultPos: number;
    saveDefaults: boolean;
    error?: string;
};

const TrackOverlayMesh = ({
    nodeIndices,
    nodes,
    baseScales,
    settings,
    nodeShape,
    nodeIndexMap,
    rootNode,
    style,
    effect
}: {
    nodeIndices: number[];
    nodes: NodeData[];
    baseScales: number[];
    settings: any;
    nodeShape: NodeShape;
    nodeIndexMap: Map<string, number>;
    rootNode: NodeData | null;
    style: TrackOverlayStyle;
    effect: string;
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.Material>(null);
    const tempObj = useMemo(() => new THREE.Object3D(), []);
    const { invalidate } = useThree();
    const effectSettings = useMemo(() => {
        switch ((effect || 'glow').toLowerCase()) {
            case 'solid':
                return { opacity: 0.85, emissive: 0.35, blending: THREE.NormalBlending, scale: 1.6 };
            case 'neon':
                return { opacity: 0.95, emissive: 1.1, blending: THREE.AdditiveBlending, scale: 1.8, forceMaterial: 'basic' as NodeMaterial };
            case 'pulse':
                return { opacity: 0.75, emissive: 0.75, blending: THREE.AdditiveBlending, scale: 1.7, pulse: true };
            case 'halo':
                return { opacity: 0.45, emissive: 0.5, blending: THREE.AdditiveBlending, scale: 2.1, forceMaterial: 'basic' as NodeMaterial };
            case 'glow':
            default:
                return { opacity: 0.9, emissive: 0.8, blending: THREE.AdditiveBlending, scale: 1.75 };
        }
    }, [effect]);

    useFrame((state) => {
        if (!effectSettings.pulse || !materialRef.current) return;
        const pulse = 0.6 + 0.25 * Math.sin(state.clock.getElapsedTime() * 4);
        (materialRef.current as any).opacity = pulse;
    });

    useEffect(() => {
        if (!meshRef.current) return;
        const layoutMode = settings.visuals?.layoutMode;
        let index = 0;
        for (const nodeIndex of nodeIndices) {
            const node = nodes[nodeIndex];
            if (!node) continue;
            const pos = layoutMode === 'pitch-field'
                ? getPitchFieldPosition(node, nodes, settings, nodeIndexMap, rootNode)
                : node.position;
            const baseScale = baseScales[nodeIndex] || 0.25;
            tempObj.position.set(pos.x, pos.y, pos.z);
            tempObj.scale.setScalar(baseScale * effectSettings.scale);
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(index, tempObj.matrix);
            index += 1;
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        invalidate();
    }, [nodeIndices, nodes, baseScales, settings, nodeIndexMap, rootNode, tempObj, effectSettings.scale, invalidate]);

    if (!nodeIndices.length) return null;

    // Use more conservative polygon offset values for mobile WebGL compatibility
    // Aggressive values (-1, -1) can cause z-fighting on Adreno/Mali GPUs
    // Mobile devices benefit from smaller offsets to avoid clipping artifacts
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const materialProps = {
        color: style.color,
        map: style.texture || null,
        transparent: true,
        opacity: effectSettings.opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: isMobile ? -0.5 : -1,
        polygonOffsetUnits: isMobile ? -2 : -1,
        blending: effectSettings.blending
    };
    const resolvedMaterial = effectSettings.forceMaterial || style.material;

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, nodeIndices.length]} frustumCulled={false}>
            <NodeGeometry shape={nodeShape} />
            {resolvedMaterial === 'basic' && <meshBasicMaterial ref={materialRef as any} {...materialProps} toneMapped={false} />}
            {resolvedMaterial === 'lambert' && <meshLambertMaterial ref={materialRef as any} {...materialProps} emissive={style.color} emissiveIntensity={effectSettings.emissive} />}
            {resolvedMaterial === 'phong' && <meshPhongMaterial ref={materialRef as any} {...materialProps} shininess={120} emissive={style.color} emissiveIntensity={effectSettings.emissive} />}
            {resolvedMaterial === 'standard' && <meshStandardMaterial ref={materialRef as any} {...materialProps} roughness={0.3} metalness={0.4} emissive={style.color} emissiveIntensity={effectSettings.emissive} />}
            {resolvedMaterial === 'toon' && <meshToonMaterial ref={materialRef as any} {...materialProps} emissive={style.color} emissiveIntensity={effectSettings.emissive} />}
            {resolvedMaterial === 'normal' && <meshNormalMaterial ref={materialRef as any} transparent opacity={effectSettings.opacity} depthWrite={false} />}
        </instancedMesh>
    );
};

const GhostNodes = ({
    positions,
    positionsVersion,
    nodes,
    selectNode,
    opacity,
    settings
}: {
    positions: Float32Array;
    positionsVersion: number;
    nodes: NodeData[];
    selectNode: (n: NodeData, p?: boolean, h?: boolean, a?: boolean) => void;
    opacity: number;
    settings: any;
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObj = useMemo(() => new THREE.Object3D(), []);
    const { invalidate } = useThree();

    const effectiveOpacity = Math.min(1.0, opacity * 1.6);

    useEffect(() => {
        if (!meshRef.current || positions.length === 0) return;
        const count = positions.length / 3;
        for (let i = 0; i < count; i++) {
            tempObj.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            tempObj.scale.setScalar(0.4);
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        invalidate();
    }, [positions, positionsVersion, tempObj, invalidate]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, positions.length / 3]}
            visible={effectiveOpacity > 0.001}
            onClick={(e) => {
                const node = nodes[e.instanceId];
                if (!node) return;
                e.stopPropagation();
                selectNode(node, false, true, false);
            }}
            onPointerDown={(e) => {
                const node = nodes[e.instanceId];
                if (!node) return;
                e.stopPropagation();
                playNote(node, settings);
            }}
        >
            <sphereGeometry args={[0.6, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={effectiveOpacity} depthWrite={false} />
        </instancedMesh>
    );
};

export const NodeInstances = () => {

    const getPerceptual = () => {
        try { return (window as any).__perceptualSimplification; } catch { return null; }
    };

    // Use individual selectors to prevent full re-renders on any store change
    const nodes = useLatticeStore(s => s.nodes);
    const selectedNode = useLatticeStore(s => s.selectedNode);
    const nearbyNodes = useLatticeStore(s => s.nearbyNodes);
    const affiliatedLineNodeIds = useLatticeStore(s => s.affiliatedLineNodeIds);
    const settings = useLatticeStore(s => s.settings);
    const updateSettings = useLatticeStore(s => s.updateSettings);
    const regenerateLattice = useLatticeStore(s => s.regenerateLattice);
    const selectNode = useLatticeStore(s => s.selectNode);
    const addToKeyboard = useLatticeStore(s => s.addToKeyboard);
    const customNodeTextures = useLatticeStore(s => s.customNodeTextures);
    const nodeSurfaceLabelOverrides = useLatticeStore(s => s.nodeSurfaceLabelOverrides);
    const isGravityEnabled = useLatticeStore(s => s.isGravityEnabled);
    const isIsolationMode = useLatticeStore(s => s.isIsolationMode);
    const playingNodeIds = useLatticeStore(s => s.playingNodeIds);
    const isPureUIMode = useLatticeStore(s => s.isPureUIMode);
    const retunePreviewActive = useLatticeStore(s => s.midiRetuner?.retunePreviewActive);
    const retuneTrackVisualsEnabled = useLatticeStore(s => s.midiRetuner?.retuneTrackVisualsEnabled);
    const retuneTrackStyles = useLatticeStore(s => s.midiRetuner?.retuneTrackStyles);
    const retuneTrackEffect = useLatticeStore(s => s.midiRetuner?.retuneTrackEffect);
    const addToComparison = useLatticeStore(s => s.addToComparison);
    const modifierKeys = useLatticeStore(s => s.modifierKeys);
    const commaLines = useLatticeStore(s => s.commaLines);
    const isGenerating = useLatticeStore(s => s.isGenerating);
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const physicsState = useRef({
        positions: new Float32Array(0),
        velocities: new Float32Array(0),
        basePositions: new Float32Array(0),
        initialized: false,
        count: 0,
        wasEnabled: false
    });
    const tempObj = useMemo(() => new THREE.Object3D(), []);
    const tempColor = useMemo(() => new THREE.Color(), []);
    // Reusable vectors to avoid allocations in useFrame
    const tempVec = useMemo(() => new THREE.Vector3(), []);
    const tempVec2 = useMemo(() => new THREE.Vector3(), []);
    const rootNode = useMemo(() => getRootNodeForPitchField(nodes), [nodes]);
    const nodeIndexMap = useMemo(() => buildNodeIndexMap(nodes), [nodes]);
    const nearbySet = useMemo(() => new Set(nearbyNodes.map(n => n.id)), [nearbyNodes]);
    const affiliatedSet = useMemo(() => new Set(affiliatedLineNodeIds), [affiliatedLineNodeIds]);
    const commaTargetSet = useMemo(() => new Set(commaLines.map(l => l.targetId)), [commaLines]);
    const commaTargetIndices = useMemo(() => {
        const indices: number[] = [];
        commaLines.forEach((line) => {
            const idx = nodeIndexMap.get(line.targetId);
            if (idx !== undefined) indices.push(idx);
        });
        return indices;
    }, [commaLines, nodeIndexMap]);

    const surfaceLabelsEnabled = !!settings.visuals.nodeSurfaceRatioLabelsEnabled;
    const texturedMode = settings.visuals.nodeSurfaceRatioTexturedMode || 'both';
    const globalHideTextures = surfaceLabelsEnabled && texturedMode === 'ratioOnly';

    const { invalidate } = useThree();
    const ghostPositionsRef = useRef<Float32Array>(new Float32Array(0));
    const [ghostVersion, setGhostVersion] = useState(0);
    const staticTransformsRef = useRef({
        positions: new Float32Array(0),
        scales: new Float32Array(0),
        count: 0
    });

    const nodeIndices = useMemo(() => {
        const map = new Map<string, number>();
        const sorted = [...nodes].sort((a, b) => {
            if (a.gen !== b.gen) return a.gen - b.gen;
            return a.name.localeCompare(b.name);
        });
        sorted.forEach((n, i) => map.set(n.id, i));
        return map;
    }, [nodes]);

    const trackOverlayEntries = useMemo(() => {
        if (!isPureUIMode || !retunePreviewActive || !retuneTrackVisualsEnabled || playingNodeIds.size === 0) return [];
        const grouped = new Map<number, Set<number>>();
        playingNodeIds.forEach((state, nodeId) => {
            const nodeIndex = nodeIndexMap.get(nodeId);
            if (nodeIndex === undefined) return;
            const groups = (state.parts && state.parts.length)
                ? state.parts
                : ((state.tracks && state.tracks.length) ? state.tracks : state.channels);
            groups.forEach((group) => {
                if (!grouped.has(group)) grouped.set(group, new Set());
                grouped.get(group)!.add(nodeIndex);
            });
        });
        return Array.from(grouped.entries()).map(([trackIndex, nodeSet]) => ({
            trackIndex,
            nodeIndices: Array.from(nodeSet)
        }));
    }, [isPureUIMode, retunePreviewActive, retuneTrackVisualsEnabled, playingNodeIds, nodeIndexMap]);

    const pointerRef = useRef({ startX: 0, startY: 0, isDown: false });
    const pendingReselectRef = useRef<string | null>(null);
    const [branchPrompt, setBranchPrompt] = useState<BranchPromptState | null>(null);
    const hotkeyConfig = settings.branchHotkeys || DEFAULT_SETTINGS.branchHotkeys;
    const hotkeyEnabled = !!hotkeyConfig?.enabled;
    const hotkeyBlocked = !!settings.spiral?.enabled || !!settings.equalStep?.enabled || !!settings.geometry?.enabled;
    const requireShift = hotkeyConfig?.requireShift !== false;
    const requireCapsLock = hotkeyConfig?.requireCapsLock !== false;

    const clampLen = (value: number, fallback: number) => {
        if (!Number.isFinite(value)) return fallback;
        return Math.max(0, Math.min(999, Math.floor(value)));
    };

    const hasCapsLock = (e: any) => {
        const native = e?.nativeEvent;
        return !!native?.getModifierState && native.getModifierState('CapsLock');
    };

    const matchesBranchHotkey = (e: any) => {
        if (!hotkeyEnabled || hotkeyBlocked) return false;
        // Hotkey is now just Tab + Click
        return !!modifierKeys.tab;
    };

    const applyBranchOverride = (node: NodeData, neg: number, pos: number, nextDefaults?: any) => {
        const geometry = settings.geometry || DEFAULT_SETTINGS.geometry;
        const overrides = geometry.nodeBranchOverrides || {};
        const nextOverrides = { ...overrides, [node.id]: { neg, pos } };
        const patch: any = { geometry: { ...geometry, nodeBranchOverrides: nextOverrides } };
        if (nextDefaults) {
            patch.branchHotkeys = nextDefaults;
        }
        pendingReselectRef.current = node.id;
        updateSettings(patch, false);
        regenerateLattice(false, true);
    };

    const openBranchPrompt = (node: NodeData) => {
        const defaultNeg = clampLen(hotkeyConfig?.defaultNeg ?? 0, 0);
        const defaultPos = clampLen(hotkeyConfig?.defaultPos ?? 0, 0);
        setBranchPrompt({
            node,
            neg: String(defaultNeg),
            pos: String(defaultPos),
            defaultNeg,
            defaultPos,
            saveDefaults: false
        });
    };

    const closeBranchPrompt = () => {
        setBranchPrompt(null);
    };

    const confirmBranchPrompt = () => {
        if (!branchPrompt) return;
        const parseInput = (raw: string, fallback: number, label: string) => {
            const trimmed = raw.trim();
            if (trimmed === '') return { value: fallback };
            const parsed = Number.parseInt(trimmed, 10);
            if (!Number.isFinite(parsed) || parsed < 0) {
                return { error: `Enter a non-negative integer for the ${label} length.` };
            }
            return { value: parsed };
        };
        const negResult = parseInput(branchPrompt.neg, branchPrompt.defaultNeg, 'left/negative');
        if (negResult.error) {
            setBranchPrompt({ ...branchPrompt, error: negResult.error });
            return;
        }
        const posResult = parseInput(branchPrompt.pos, branchPrompt.defaultPos, 'right/positive');
        if (posResult.error) {
            setBranchPrompt({ ...branchPrompt, error: posResult.error });
            return;
        }
        const neg = clampLen(negResult.value ?? branchPrompt.defaultNeg, branchPrompt.defaultNeg);
        const pos = clampLen(posResult.value ?? branchPrompt.defaultPos, branchPrompt.defaultPos);
        const nextDefaults = branchPrompt.saveDefaults
            ? { ...hotkeyConfig, defaultNeg: neg, defaultPos: pos }
            : undefined;
        applyBranchOverride(branchPrompt.node, neg, pos, nextDefaults);
        setBranchPrompt(null);
    };

    const latticeStoreApi = useLatticeStoreApi();
    useEffect(() => {
        if (isGenerating || !pendingReselectRef.current) return;
        const nodeId = pendingReselectRef.current;
        pendingReselectRef.current = null;
        const next = latticeStoreApi.getState().nodes.find((n: NodeData) => n.id === nodeId);
        if (next) selectNode(next, false, true, false);
    }, [isGenerating, selectNode, latticeStoreApi]);

    // Pre-calculate base scales for each generation to avoid repeated lookups
    const baseScales = useMemo(() => {
        const scales: number[] = [];
        for (let i = 0; i < nodes.length; i++) {
            const gen = nodes[i].gen;
            scales.push(((GEN_SIZES as any)[gen] || 0.25) * settings.visuals.nodeScale);
        }
        return scales;
    }, [nodes, settings.visuals.nodeScale]);

    const CHANNEL_COLORS = [
        '#ee2b2b', '#ee742b', '#eebd2b', '#d5ee2b',
        '#8cee2b', '#43ee2b', '#2bee5b', '#2beea5',
        '#2beeee', '#2ba5ee', '#2b5bee', '#432bee',
        '#8c2bee', '#d52bee', '#ee2bbd', '#ee2b74'
    ];

    const trackTextureUrls = useMemo(() => {
        if (!Array.isArray(retuneTrackStyles)) return [];
        const urls: string[] = [];
        const seen = new Set<string>();
        retuneTrackStyles.forEach((style) => {
            const url = style?.textureUrl;
            if (url && !seen.has(url)) {
                seen.add(url);
                urls.push(url);
            }
        });
        return urls;
    }, [retuneTrackStyles]);

    const trackTextures = useLoader(THREE.TextureLoader, trackTextureUrls);
    const trackTextureMap = useMemo(() => {
        const map = new Map<string, THREE.Texture>();
        trackTextureUrls.forEach((url, idx) => {
            const texture = trackTextures[idx];
            if (texture) {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                map.set(url, texture);
            }
        });
        return map;
    }, [trackTextureUrls, trackTextures]);

    const trackStyleMap = useMemo(() => {
        const styles = Array.isArray(retuneTrackStyles) ? retuneTrackStyles : [];
        const map = new Map<number, TrackOverlayStyle>();
        trackOverlayEntries.forEach(({ trackIndex }) => {
            const stored = styles[trackIndex];
            const color = stored?.color || CHANNEL_COLORS[trackIndex % CHANNEL_COLORS.length];
            const material = (stored?.material as NodeMaterial) || 'standard';
            const textureUrl = stored?.textureUrl;
            const texture = textureUrl ? trackTextureMap.get(textureUrl) || null : null;
            map.set(trackIndex, { color, material, texture });
        });
        return map;
    }, [retuneTrackStyles, trackOverlayEntries, trackTextureMap]);


    const getPitchFieldPos = (node: NodeData) => {
        return getPitchFieldPosition(node, nodes, settings, nodeIndexMap, rootNode);
    };

    // Optimize: Pre-calculate static colors to avoid re-running expensive harmonic logic every frame
    const baseColors = useMemo(() => {
        if (!nodes.length) return new Float32Array(0);
        const arr = new Float32Array(nodes.length * 3);
        const limitColors = settings.visuals.limitColors;
        const effectiveGen1Limit = Math.min(settings.gen1MaxPrimeLimit ?? settings.maxPrimeLimit, settings.maxPrimeLimit);

        const tempC = new THREE.Color();
        const color2 = new THREE.Color('#ff0000');
        const color3 = new THREE.Color('#0000ff');
        const color5 = new THREE.Color('#ffff00');

        const getPrimeColor = (p: number) => {
            if (p === 2) return color2;
            if (p === 3) return color3;
            if (p === 5) return color5;
            return new THREE.Color(limitColors[p as PrimeLimit] || '#ffffff');
        };

        const primes: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            let colorStr = '#ffffff';
            // Use harmonic coloring if: 1) explicitly set in visuals, or 2) geometry mode with useHarmonicColors
            const geometryHarmonicColors = settings.geometry?.enabled && settings.geometry?.useHarmonicColors !== false;
            const colorMode = geometryHarmonicColors ? 'harmonic' : (settings.visuals.nodeColorMode || 'limit');

            if (colorMode === 'harmonic') {
                // For geometry mode, always apply harmonic colors (nodes have originLimit: 0)
                // For regular mode, skip root node (originLimit === 0)
                const shouldApplyHarmonic = geometryHarmonicColors || node.originLimit !== 0;
                if (shouldApplyHarmonic) {
                    let r = 0, g = 0, b = 0;
                    let hasFactors = false;
                    primes.forEach(p => {
                        const exponent = node.primeVector[p];
                        if (exponent !== undefined && exponent !== 0) {
                            hasFactors = true;
                            const weight = Math.abs(exponent);
                            const pColor = getPrimeColor(p);
                            r += pColor.r * weight;
                            g += pColor.g * weight;
                            b += pColor.b * weight;
                        }
                    });

                    if (hasFactors) {
                        const max = Math.max(r, g, b);
                        if (max > 1) { r /= max; g /= max; b /= max; }
                        tempC.setRGB(r, g, b);
                        colorStr = '#' + tempC.getHexString();
                    } else if (geometryHarmonicColors) {
                        // Origin node in geometry mode - use white
                        colorStr = '#ffffff';
                    }
                }
            } else {
                if (node.originLimit === 0) {
                    const rootLimits = settings.rootLimits ?? [];
                    const maxRoot = rootLimits.length > 0 ? Math.max(...rootLimits) : 3;
                    colorStr = getGlobalPrimeColor(maxRoot as PrimeLimit, settings);
                } else {
                    colorStr = getGlobalPrimeColor(node.originLimit, settings);
                }
                if (node.gen === 0 && node.originLimit > 0 && node.originLimit > effectiveGen1Limit) {
                    const base = new THREE.Color(colorStr);
                    base.offsetHSL(0.08, 0.2, 0.15);
                    colorStr = `#${base.getHexString()}`;
                }
            }

            tempC.set(colorStr);
            arr[i * 3] = tempC.r;
            arr[i * 3 + 1] = tempC.g;
            arr[i * 3 + 2] = tempC.b;
        }
        return arr;
    }, [nodes, settings.visuals.limitColors, settings.rootLimits, settings.maxPrimeLimit, settings.gen1MaxPrimeLimit, settings.visuals.nodeColorMode, settings.geometry?.enabled, settings.geometry?.useHarmonicColors]);

    // Apply colors to mesh (Static + Dynamic) - OPTIMIZED LOOP
    useEffect(() => {
        if (!meshRef.current || nodes.length === 0) return;
        const count = nodes.length;
        const selectedId = selectedNode?.id;

        // Cache perceptual data outside loop
        const perceptual = getPerceptual();
        const perceptualEnabled = perceptual?.enabled;
        const hiddenIds = perceptualEnabled ? (perceptual.hiddenIds || []) : [];
        const focusIds = perceptualEnabled ? (perceptual.focusIds || []) : [];
        const whiteColor = new THREE.Color('#ffffff'); // Create once, reuse

        for (let i = 0; i < count; i++) {
            const nodeId = nodes[i].id;

            // Start with cached base color
            if (baseColors.length > i * 3 + 2) {
                tempColor.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
            } else {
                tempColor.set('#ffffff');
            }

            // Dynamic Overlays
            const playState = playingNodeIds.get(nodeId);
            if (playState) {
                const styleIndex = playState.parts?.[0] !== undefined
                    ? playState.parts[0]
                    : (playState.tracks?.[0] !== undefined
                        ? playState.tracks[0]
                        : (playState.channels[0] ?? 0));
                const storedStyles = Array.isArray(retuneTrackStyles) ? retuneTrackStyles : [];
                const trackStyleColor = (isPureUIMode && retunePreviewActive && retuneTrackVisualsEnabled)
                    ? storedStyles[styleIndex]?.color
                    : null;
                tempColor.set(trackStyleColor || CHANNEL_COLORS[styleIndex % 16]);
            } else if (selectedId === nodeId) {
                tempColor.set('#ffffff');
            } else if (commaTargetSet.has(nodeId)) {
                tempColor.set('#ff00ff');
            } else if (isIsolationMode && nearbySet.has(nodeId)) {
                tempColor.set('#F59E0B');
            } else if (affiliatedSet.has(nodeId)) {
                tempColor.offsetHSL(0, 0, 0.2);
            }

            // Perceptual Dimming - use includes instead of Set for small arrays
            if (perceptualEnabled) {
                if (hiddenIds.includes(nodeId) && selectedId !== nodeId && !playState) {
                    tempColor.multiplyScalar(0.35);
                } else if (focusIds.includes(nodeId)) {
                    tempColor.lerp(whiteColor, 0.55);
                }
            }

            meshRef.current.setColorAt(i, tempColor);
        }

        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
        invalidate();

    }, [nodes, baseColors, playingNodeIds, selectedNode, nearbySet, affiliatedSet, commaTargetSet, isIsolationMode, isPureUIMode, retunePreviewActive, retuneTrackVisualsEnabled, retuneTrackStyles, invalidate]);

    useEffect(() => {
        if (!meshRef.current || nodes.length === 0 || isGravityEnabled) return;
        physicsState.current.wasEnabled = false;

        const count = nodes.length;
        const layoutMode = settings.visuals.layoutMode;
        const morph = settings.visuals.temperamentMorph || 0;
        const showGhost = settings.visuals.showGhostGrid;
        const tetDivs = settings.visuals.tetDivisions || 12;
        const globalScale = settings.visuals.globalScale ?? 1;
        const selectedId = selectedNode?.id;
        const hasMorph = morph > 0;
        const isPitchField = layoutMode === 'pitch-field';
        const isLattice = layoutMode === 'lattice';

        let positions = staticTransformsRef.current.positions;
        let scales = staticTransformsRef.current.scales;
        if (positions.length !== count * 3) positions = new Float32Array(count * 3);
        if (scales.length !== count) scales = new Float32Array(count);
        staticTransformsRef.current.positions = positions;
        staticTransformsRef.current.scales = scales;
        staticTransformsRef.current.count = count;

        let ghostPositions = ghostPositionsRef.current;
        const needsGhost = showGhost && isLattice;
        if (needsGhost && ghostPositions.length !== count * 3) {
            ghostPositions = new Float32Array(count * 3);
        }

        for (let i = 0; i < count; i++) {
            const node = nodes[i];
            const nodeId = node.id;

            if (isPitchField) {
                const pfPos = getPitchFieldPos(node);
                tempVec.copy(pfPos);
            } else {
                tempVec.copy(node.position);
            }

            if (hasMorph || needsGhost) {
                const tetCents = getTETCents(node.cents, tetDivs);
                const jiCents = node.cents;
                tempVec2.copy(tempVec);

                if (isPitchField) {
                    const diffCents = tetCents - jiCents;
                    tempVec2.x += diffCents * 0.4 * globalScale;
                } else if (isLattice) {
                    const diffCents = tetCents - jiCents;
                    tempVec2.y += diffCents * 0.1;
                }

                if (hasMorph) {
                    tempVec.lerp(tempVec2, morph);
                }

                if (needsGhost) {
                    ghostPositions[i * 3] = tempVec2.x;
                    ghostPositions[i * 3 + 1] = tempVec2.y;
                    ghostPositions[i * 3 + 2] = tempVec2.z;
                }
            }

            positions[i * 3] = tempVec.x;
            positions[i * 3 + 1] = tempVec.y;
            positions[i * 3 + 2] = tempVec.z;

            let scale = baseScales[i] || 0.25;

            if (isIsolationMode) {
                const isTarget = selectedId === nodeId;
                const isNearby = nearbySet.has(nodeId);
                if (!isTarget && !isNearby) scale = 0;
            }

            if (settings.maskedNodeIds?.includes(nodeId)) {
                scale = 0;
            }

            const textureUrl = customNodeTextures[nodeId];
            if (textureUrl) {
                const override = nodeSurfaceLabelOverrides?.[nodeId];
                const defaultShowTexture = !globalHideTextures;
                const showTexture = override?.showTexture !== undefined ? override.showTexture : defaultShowTexture;
                if (showTexture) scale = 0;
            }

            if (scale > 0) {
                if (selectedId === nodeId) {
                    scale *= 2.0;
                } else if (!commaTargetSet.has(nodeId)) {
                    if (playingNodeIds.has(nodeId)) {
                        scale *= 2.2;
                    } else if (affiliatedSet.has(nodeId)) {
                        scale *= 1.2;
                    }
                }

                if (isPitchField && scale < 0.5) scale = 0.5;
            }

            scales[i] = scale;
            tempObj.position.copy(tempVec);
            tempObj.scale.setScalar(scale);
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObj.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;

        if (needsGhost) {
            ghostPositionsRef.current = ghostPositions;
            setGhostVersion(v => v + 1);
        } else if (ghostPositionsRef.current.length) {
            ghostPositionsRef.current = new Float32Array(0);
            setGhostVersion(v => v + 1);
        }

        invalidate();
    }, [
        nodes,
        settings.visuals.layoutMode,
        settings.visuals.temperamentMorph,
        settings.visuals.showGhostGrid,
        settings.visuals.tetDivisions,
        settings.visuals.globalScale,
        selectedNode,
        isIsolationMode,
        nearbySet,
        commaTargetSet,
        affiliatedSet,
        playingNodeIds,
        customNodeTextures,
        nodeSurfaceLabelOverrides,
        globalHideTextures,
        baseScales,
        isGravityEnabled,
        invalidate
    ]);

    useFrame((state, delta) => {
        if (!meshRef.current || nodes.length === 0) return;
        const count = nodes.length;

        if (isGravityEnabled) {
            const GRAVITY = 35;
            const SPRING = 10;
            const DAMPING = 0.90;
            const BOUNCE = 0.35;
            const FLOOR = -30 * (settings.visuals.globalScale ?? 1);

            if (!physicsState.current.initialized || physicsState.current.count !== count || !physicsState.current.wasEnabled) {
                physicsState.current.positions = new Float32Array(count * 3);
                physicsState.current.velocities = new Float32Array(count * 3);
                physicsState.current.basePositions = new Float32Array(count * 3);

                for (let i = 0; i < count; i++) {
                    const node = nodes[i];
                    const basePos = settings.visuals.layoutMode === 'pitch-field'
                        ? getPitchFieldPos(node)
                        : node.position;

                    physicsState.current.positions[i * 3 + 0] = basePos.x;
                    physicsState.current.positions[i * 3 + 1] = basePos.y;
                    physicsState.current.positions[i * 3 + 2] = basePos.z;

                    physicsState.current.basePositions[i * 3 + 0] = basePos.x;
                    physicsState.current.basePositions[i * 3 + 1] = basePos.y;
                    physicsState.current.basePositions[i * 3 + 2] = basePos.z;

                    const j = (i * 0.61803398875) % 1;
                    physicsState.current.velocities[i * 3 + 0] = (j - 0.5) * 2;
                    physicsState.current.velocities[i * 3 + 1] = (0.5 - j) * 1;
                    physicsState.current.velocities[i * 3 + 2] = (j - 0.5) * 2;
                }

                physicsState.current.count = count;
                physicsState.current.initialized = true;
                physicsState.current.wasEnabled = true;
            }

            const slowBaseFollow = Math.min(1, delta * 0.25);

            const posArr = physicsState.current.positions;
            const velArr = physicsState.current.velocities;
            const baseArr = physicsState.current.basePositions;

            const dampingFactor = Math.pow(DAMPING, delta);

            for (let i = 0; i < count; i++) {
                const ix = i * 3;

                let x = posArr[ix + 0];
                let y = posArr[ix + 1];
                let z = posArr[ix + 2];

                let vx = velArr[ix + 0];
                let vy = velArr[ix + 1];
                let vz = velArr[ix + 2];

                const node = nodes[i];
                const targetBase = settings.visuals.layoutMode === 'pitch-field'
                    ? getPitchFieldPos(node)
                    : node.position;

                baseArr[ix + 0] = baseArr[ix + 0] * (1 - slowBaseFollow) + targetBase.x * slowBaseFollow;
                baseArr[ix + 1] = baseArr[ix + 1] * (1 - slowBaseFollow) + targetBase.y * slowBaseFollow;
                baseArr[ix + 2] = baseArr[ix + 2] * (1 - slowBaseFollow) + targetBase.z * slowBaseFollow;

                const bx = baseArr[ix + 0];
                const by = baseArr[ix + 1];
                const bz = baseArr[ix + 2];

                const ax = (bx - x) * SPRING;
                const ay = (by - y) * SPRING - GRAVITY;
                const az = (bz - z) * SPRING;

                vx = (vx + ax * delta) * dampingFactor;
                vy = (vy + ay * delta) * dampingFactor;
                vz = (vz + az * delta) * dampingFactor;

                x += vx * delta;
                y += vy * delta;
                z += vz * delta;

                if (y < FLOOR) {
                    y = FLOOR;
                    if (vy < 0) vy = -vy * BOUNCE;

                    vx *= 0.8;
                    vz *= 0.8;
                }

                posArr[ix + 0] = x;
                posArr[ix + 1] = y;
                posArr[ix + 2] = z;

                velArr[ix + 0] = vx;
                velArr[ix + 1] = vy;
                velArr[ix + 2] = vz;

                const nodeId = node.id;

                let scale = baseScales[i] || 0.25;

                if (isIsolationMode) {
                    const isTarget = selectedNode?.id === nodeId;
                    const isNearby = nearbySet.has(nodeId);
                    if (!isTarget && !isNearby) scale = 0;
                }

                const textureUrl = customNodeTextures[nodeId];
                if (textureUrl) {
                    const override = nodeSurfaceLabelOverrides?.[nodeId];
                    const defaultShowTexture = !globalHideTextures;
                    const showTexture = override?.showTexture !== undefined ? override.showTexture : defaultShowTexture;
                    if (showTexture) scale = 0;
                }

                if (scale > 0) {
                    if (selectedNode?.id === nodeId) scale *= 1.8;
                    if (playingNodeIds.has(nodeId)) scale *= 1.35;
                    if (nearbySet.has(nodeId) && settings.highlightNearby) scale *= 1.2;
                }

                tempObj.position.set(x, y, z);

                const perceptual = getPerceptual();
                if (perceptual?.enabled && scale > 0) {
                    const hiddenIds = perceptual.hiddenIds || [];
                    const focusIds = perceptual.focusIds || [];
                    const mode = perceptual.mode || 'ghost';

                    if (focusIds.includes(nodeId)) {
                        scale *= 1.45;
                    }
                    if (hiddenIds.includes(nodeId)) {
                        if (mode === 'ghost') scale *= 0.35;
                        else if (mode === 'prune') scale = 0.02;
                        else if (mode === 'collapse') scale = 0.001;
                    }
                }
                tempObj.scale.setScalar(scale);

                tempObj.updateMatrix();
                meshRef.current.setMatrixAt(i, tempObj.matrix);
            }

            meshRef.current.instanceMatrix.needsUpdate = true;
            invalidate();
            return;
        }

        if (commaTargetIndices.length === 0) return;

        const positions = staticTransformsRef.current.positions;
        const scales = staticTransformsRef.current.scales;
        if (positions.length < count * 3 || scales.length < count) return;

        const selectedId = selectedNode?.id;
        const pulse = 2.5 + Math.sin(state.clock.elapsedTime * 8) * 0.4;

        for (const idx of commaTargetIndices) {
            if (idx < 0 || idx >= count) continue;
            const nodeId = nodes[idx]?.id;
            if (!nodeId || nodeId === selectedId) continue;
            const baseScale = scales[idx];
            if (!Number.isFinite(baseScale) || baseScale <= 0) continue;
            const ix = idx * 3;
            tempObj.position.set(positions[ix], positions[ix + 1], positions[ix + 2]);
            tempObj.scale.setScalar(baseScale * pulse);
            tempObj.updateMatrix();
            meshRef.current.setMatrixAt(idx, tempObj.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        invalidate();
    });

    const handlePointerDown = (e: any) => {
        pointerRef.current.startX = e.clientX;
        pointerRef.current.startY = e.clientY;
        pointerRef.current.isDown = true;

        const instanceId = e.instanceId;
        if (instanceId !== undefined && nodes[instanceId]) {
            playNote(nodes[instanceId], settings);
        }
    };

    const handlePointerCancel = (e: any) => {
        pointerRef.current.isDown = false;
    };

    const handlePointerUp = (e: any) => {
        if (!pointerRef.current.isDown) return;
        pointerRef.current.isDown = false;

        const dx = Math.abs(e.clientX - pointerRef.current.startX);
        const dy = Math.abs(e.clientY - pointerRef.current.startY);

        if (dx < 5 && dy < 5) {
            const instanceId = e.instanceId;
            const node = nodes[instanceId];

            if (node) {
                if (matchesBranchHotkey(e)) {
                    const neg = clampLen(hotkeyConfig?.defaultNeg ?? 0, 0);
                    const pos = clampLen(hotkeyConfig?.defaultPos ?? 0, 0);
                    applyBranchOverride(node, neg, pos);
                    return;
                }
                if (e.shiftKey) {
                    // Prevent Compare Panel trigger if CapsLock is active (used for extension)
                    if (!hasCapsLock(e)) {
                        let octaveShift = 0;
                        if (modifierKeys.z) octaveShift = -1;
                        if (modifierKeys.x) octaveShift = 1;

                        addToComparison(node, octaveShift);

                        playNote({ ...node, octave: node.octave + octaveShift }, settings);
                    }
                } else {

                    selectNode(node, false, true, false);
                }
            }
        }
    };

    const handleContextMenu = (e: any) => {
        e.nativeEvent.preventDefault();
        e.stopPropagation();
        const instanceId = e.instanceId;
        const node = nodes[instanceId];
        if (node) {
            if (matchesBranchHotkey(e)) {
                openBranchPrompt(node);
                return;
            }
            // Prevent Keyboard Panel trigger if CapsLock is active
            if (!hasCapsLock(e)) {
                addToKeyboard(node);
            }
        }
    };

    const matType = settings.visuals.nodeMaterial;
    const branchPromptDialog = branchPrompt ? (
        <Html fullscreen pointerEvents="auto">
            <ConfirmDialog
                open
                title="Expand Gen (n+1) Branch"
                confirmText="Apply"
                cancelText="Cancel"
                message={(
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-[10px] uppercase tracking-wide text-gray-400">
                                Left/Negative
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    inputMode="numeric"
                                    value={branchPrompt.neg}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBranchPrompt((prev) => prev ? { ...prev, neg: value, error: undefined } : prev);
                                    }}
                                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100"
                                />
                            </label>
                            <label className="text-[10px] uppercase tracking-wide text-gray-400">
                                Right/Positive
                                <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    inputMode="numeric"
                                    value={branchPrompt.pos}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setBranchPrompt((prev) => prev ? { ...prev, pos: value, error: undefined } : prev);
                                    }}
                                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-100"
                                />
                            </label>
                        </div>
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-300">
                            <input
                                type="checkbox"
                                checked={branchPrompt.saveDefaults}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setBranchPrompt((prev) => prev ? { ...prev, saveDefaults: checked } : prev);
                                }}
                                className="h-3.5 w-3.5 rounded border border-gray-600 bg-gray-900"
                            />
                            Save as hotkey defaults
                        </label>
                        {branchPrompt.error && (
                            <div className="text-[10px] text-red-300">
                                {branchPrompt.error}
                            </div>
                        )}
                    </div>
                )}
                onConfirm={confirmBranchPrompt}
                onCancel={closeBranchPrompt}
            />
        </Html>
    ) : null;

    return (
        <>
            <instancedMesh
                ref={meshRef}
                args={[undefined, undefined, nodes.length]}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={handleContextMenu}
                frustumCulled={false}
            >
                <NodeGeometry shape={settings.visuals.nodeShape} />
                {matType === 'basic' && <meshBasicMaterial />}
                {(matType === 'lambert' || !matType) && <meshLambertMaterial />}
                {matType === 'phong' && <meshPhongMaterial shininess={100} />}
                {matType === 'standard' && <meshStandardMaterial roughness={0.4} metalness={0.6} />}
                {matType === 'toon' && <meshToonMaterial />}
                {matType === 'normal' && <meshNormalMaterial />}
            </instancedMesh>
            {trackOverlayEntries.map(({ trackIndex, nodeIndices: overlayNodes }) => {
                const style = trackStyleMap.get(trackIndex);
                if (!style) return null;
                return (
                    <TrackOverlayMesh
                        key={`track-overlay-${trackIndex}`}
                        nodeIndices={overlayNodes}
                        nodes={nodes}
                        baseScales={baseScales}
                        settings={settings}
                        nodeShape={settings.visuals.nodeShape}
                        nodeIndexMap={nodeIndexMap}
                        rootNode={rootNode}
                        style={style}
                        effect={retuneTrackEffect || 'glow'}
                    />
                );
            })}
            {settings.visuals.showGhostGrid && !isGravityEnabled && settings.visuals.layoutMode === 'lattice' && (
                <GhostNodes positions={ghostPositionsRef.current} positionsVersion={ghostVersion} nodes={nodes} selectNode={selectNode} opacity={settings.visuals.ghostOpacity} settings={settings} />
            )}
            {!isGravityEnabled && Object.keys(customNodeTextures).map(id => {
                const node = nodes.find(n => n.id === id);
                if (!node) return null;
                const url = customNodeTextures[id];
                const override = nodeSurfaceLabelOverrides?.[id];
                const defaultShowTexture = !!url && !globalHideTextures;
                const showTexture = !!url && (override?.showTexture !== undefined ? override.showTexture : defaultShowTexture);
                if (!showTexture) return null;
                return <CustomTexturedNode key={id} node={node} url={url} settings={settings} onSelect={(n: any, p: any, h: any, a: any) => selectNode(n, p, h, a)} onAddToKeyboard={(n) => addToKeyboard(n)} />
            })}
            {branchPromptDialog}
        </>
    );
};
