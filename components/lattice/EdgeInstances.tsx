
import React, { useMemo, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useLatticeStore } from '../../store/latticeStoreContext';
import { getPrimeColor } from '../../constants';
import { isPrime } from '../../musicLogic';
import { buildNodeIndexMap, getRenderedNodePosition, getRootNodeForPitchField } from '../../utils/renderedPosition';

export const StructureEdges = () => {
    // Use individual selectors to prevent full re-renders
    const edges = useLatticeStore(s => s.edges);
    const nodes = useLatticeStore(s => s.nodes);
    const settings = useLatticeStore(s => s.settings);
    const isGravityEnabled = useLatticeStore(s => s.isGravityEnabled);
    const isIsolationMode = useLatticeStore(s => s.isIsolationMode);
    const selectedNode = useLatticeStore(s => s.selectedNode);
    const nearbyNodes = useLatticeStore(s => s.nearbyNodes);
    const { limitOpacities, edgeOpacity, lineRenderingMode, layoutMode } = settings.visuals;
    const { isSimpleMode } = settings;

    const structureEdges = useMemo(() => {

        if (layoutMode === 'pitch-field' || layoutMode === 'diamond') return [];

        if (lineRenderingMode === 'performance' && nodes.length > 5000) return [];

        let filteredEdges = edges.filter(e => e.gen <= 1);

        if (isSimpleMode && isIsolationMode) {
            const relevantNodeIds = new Set<string>();
            if (selectedNode) relevantNodeIds.add(selectedNode.id);
            nearbyNodes.forEach(n => relevantNodeIds.add(n.id));

            if (relevantNodeIds.size > 0) {
                filteredEdges = filteredEdges.filter(e =>
                    relevantNodeIds.has(e.sourceId) || relevantNodeIds.has(e.targetId)
                );
            }
        }

        return filteredEdges;
    }, [edges, nodes.length, lineRenderingMode, layoutMode, isSimpleMode, isIsolationMode, selectedNode, nearbyNodes]);

    const nodeMap = useMemo(() => new Map<string, THREE.Vector3>(nodes.map(n => [n.id, n.position])), [nodes]);

    if (isGravityEnabled || structureEdges.length === 0) return null;

    return (
        <group>
            {structureEdges.map(edge => {
                const start = nodeMap.get(edge.sourceId);
                const end = nodeMap.get(edge.targetId);
                if (!start || !end) return null;
                const baseOp = limitOpacities[edge.limit] ?? 1.0;
                // Dim edges in geometry mode (like Gen 1)
                const isGeometryMode = settings.geometry?.enabled;
                const opacityMultiplier = isGeometryMode ? 0.4 : 0.9;
                const isCompositeAxis = edge.limit > 2 && !isPrime(Number(edge.limit));
                const compositeOpacity = isCompositeAxis ? 0.8 : 1;
                const finalOpacity = baseOp * edgeOpacity * opacityMultiplier * compositeOpacity;
                if (finalOpacity < 0.05) return null;
                // Use thinner lines in geometry mode
                const lineWidth = isGeometryMode ? 2 : (edge.gen === 0 ? 6 : 2);
                return (
                    <Line
                        key={edge.id}
                        points={[start, end]}
                        color={getPrimeColor(edge.limit as any, settings)}
                        lineWidth={lineWidth}
                        dashed={isCompositeAxis}
                        dashSize={isCompositeAxis ? 0.8 : 1}
                        gapSize={isCompositeAxis ? 0.4 : 0.2}
                        transparent
                        opacity={finalOpacity}
                        depthWrite={false}
                        raycast={null as any}
                    />
                );
            })}
        </group>
    );
};

export const DetailEdges = () => {
    // Use individual selectors to prevent full re-renders
    const edges = useLatticeStore(s => s.edges);
    const nodes = useLatticeStore(s => s.nodes);
    const settings = useLatticeStore(s => s.settings);
    const isGravityEnabled = useLatticeStore(s => s.isGravityEnabled);
    const isIsolationMode = useLatticeStore(s => s.isIsolationMode);
    const selectedNode = useLatticeStore(s => s.selectedNode);
    const nearbyNodes = useLatticeStore(s => s.nearbyNodes);
    const geometryRef = useRef<THREE.BufferGeometry>(null);
    const { invalidate } = useThree();
    const { limitOpacities, genOpacities, edgeOpacity, lineRenderingMode, layoutMode } = settings.visuals;
    const { isSimpleMode } = settings;

    const { positions, colors } = useMemo(() => {
        if (isGravityEnabled || layoutMode === 'pitch-field' || layoutMode === 'diamond') return { positions: new Float32Array(0), colors: new Float32Array(0) };

        const nodeMap = new Map<string, THREE.Vector3>(nodes.map(n => [n.id, n.position]));
        const posArray: number[] = [];
        const colArray: number[] = [];
        const tempColor = new THREE.Color();

        const opacityMultiplier = lineRenderingMode === 'quality' ? 0.4 : 0.2;

        const relevantNodeIds = new Set<string>();
        if (isSimpleMode && isIsolationMode) {
            if (selectedNode) relevantNodeIds.add(selectedNode.id);
            nearbyNodes.forEach(n => relevantNodeIds.add(n.id));
        }

        for (const edge of edges) {

            if (lineRenderingMode === 'quality' && edge.gen <= 1) continue;

            if (isSimpleMode && isIsolationMode && relevantNodeIds.size > 0) {
                const hasRelevantNode = relevantNodeIds.has(edge.sourceId) || relevantNodeIds.has(edge.targetId);
                if (!hasRelevantNode) continue;
            }

            const start = nodeMap.get(edge.sourceId);
            const end = nodeMap.get(edge.targetId);
            if (start && end) {
                const genOp = genOpacities[edge.gen] ?? 1.0;
                const limitOp = limitOpacities[edge.limit] ?? 1.0;
                const isCompositeAxis = edge.limit > 2 && !isPrime(Number(edge.limit));
                const compositeOpacity = isCompositeAxis ? 0.75 : 1;
                const totalOp = genOp * limitOp * edgeOpacity * opacityMultiplier * compositeOpacity;
                if (totalOp < 0.01) continue;
                posArray.push(start.x, start.y, start.z);
                posArray.push(end.x, end.y, end.z);
                const c = getPrimeColor(edge.limit as any, settings);
                tempColor.set(c);
                if (isCompositeAxis) {
                    tempColor.lerp(new THREE.Color('#ffffff'), 0.2);
                }
                tempColor.multiplyScalar(totalOp);
                colArray.push(tempColor.r, tempColor.g, tempColor.b);
                colArray.push(tempColor.r, tempColor.g, tempColor.b);
            }
        }
        return { positions: new Float32Array(posArray), colors: new Float32Array(colArray) };
    }, [edges, nodes, limitOpacities, genOpacities, edgeOpacity, lineRenderingMode, isGravityEnabled, layoutMode, isSimpleMode, isIsolationMode, selectedNode, nearbyNodes, settings.customPrimes, settings.visuals.limitColors]);

    useEffect(() => {
        if (geometryRef.current) {
            geometryRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometryRef.current.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometryRef.current.attributes.position.needsUpdate = true;
            geometryRef.current.attributes.color.needsUpdate = true;
            geometryRef.current.computeBoundingSphere();
            invalidate();
        }
    }, [positions, colors, invalidate]);

    return (
        <lineSegments raycast={null as any}>
            <bufferGeometry ref={geometryRef} />
            <lineBasicMaterial vertexColors transparent={true} depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
    );
};

export const HighlightEdges = () => {
    // Use individual selectors to prevent full re-renders
    const edges = useLatticeStore(s => s.edges);
    const nodes = useLatticeStore(s => s.nodes);
    const highlightedPath = useLatticeStore(s => s.highlightedPath);
    const affiliatedLineNodeIds = useLatticeStore(s => s.affiliatedLineNodeIds);
    const settings = useLatticeStore(s => s.settings);
    const isGravityEnabled = useLatticeStore(s => s.isGravityEnabled);
    const highlightLines = useMemo(() => {
        if (isGravityEnabled || settings.visuals.layoutMode === 'pitch-field' || settings.visuals.layoutMode === 'diamond') return null;
        if (highlightedPath.length === 0 && affiliatedLineNodeIds.length === 0) return null;
        const nodeMap = new Map<string, THREE.Vector3>(nodes.map(n => [n.id, n.position]));
        const lines: React.ReactElement[] = [];

        edges.forEach(edge => {
            const isPath = highlightedPath.includes(edge.targetId) && highlightedPath.includes(edge.sourceId);
            const isAffiliated = affiliatedLineNodeIds.includes(edge.sourceId) && affiliatedLineNodeIds.includes(edge.targetId);
            if (!isPath && !isAffiliated) return;
            const start = nodeMap.get(edge.sourceId);
            const end = nodeMap.get(edge.targetId);
            if (!start || !end) return;
            const isCompositeAxis = edge.limit > 2 && !isPrime(Number(edge.limit));
            const color = isPath ? 'white' : getPrimeColor(edge.limit as any, settings);
            const dashed = !isPath && isCompositeAxis;

            lines.push(
                <Line
                    key={`hl-${edge.id}`}
                    points={[start, end]}
                    color={color}
                    lineWidth={isPath ? 5 : 2}
                    dashed={dashed}
                    dashSize={dashed ? 0.8 : 1}
                    gapSize={dashed ? 0.4 : 0.2}
                    transparent
                    opacity={isPath ? 1.0 : 0.8}
                    depthTest={false}
                    renderOrder={10}
                    raycast={null as any}
                />
            );
        });
        return lines;
    }, [edges, nodes, highlightedPath, affiliatedLineNodeIds, settings, isGravityEnabled]);

    if (isGravityEnabled) return null;
    return <group>{highlightLines}</group>;
};

export const CommaEdges = () => {
    // Use individual selectors to prevent full re-renders
    const nodes = useLatticeStore(s => s.nodes);
    const commaLines = useLatticeStore(s => s.commaLines);
    const settings = useLatticeStore(s => s.settings);

    const rootNode = useMemo(() => getRootNodeForPitchField(nodes), [nodes]);
    const nodeIndexMap = useMemo(() => buildNodeIndexMap(nodes), [nodes]);
    const nodeMap = useMemo(() => {
        const m = new Map<string, THREE.Vector3>();
        for (const n of nodes) {
            m.set(n.id, getRenderedNodePosition(n, nodes, settings, nodeIndexMap, rootNode));
        }
        return m;
    }, [nodes, settings, nodeIndexMap, rootNode]);

    if (commaLines.length === 0 || settings.visuals.layoutMode === 'diamond') return null;

    return (
        <group>
            {commaLines.map((comma, i) => {
                const start = nodeMap.get(comma.sourceId);
                const end = nodeMap.get(comma.targetId);
                if (!start || !end) return null;
                return (
                    <Line
                        key={`comma-${i}`}
                        points={[start, end]}
                        color="#00ffff"
                        lineWidth={8}
                        dashed
                        dashSize={1}
                        gapSize={0.5}
                        opacity={1.0}
                        transparent
                        depthTest={false}
                        renderOrder={20}
                    />
                );
            })}
        </group>
    );
};

export const ComparisonEdges = () => {
    // Use individual selectors to prevent full re-renders
    const comparisonNodes = useLatticeStore(s => s.comparisonNodes);
    const comparisonGroups = useLatticeStore(s => s.comparisonGroups);
    const nodes = useLatticeStore(s => s.nodes);
    const settings = useLatticeStore(s => s.settings);

    const rootNode = useMemo(() => getRootNodeForPitchField(nodes), [nodes]);
    const nodeIndexMap = useMemo(() => buildNodeIndexMap(nodes), [nodes]);

    const existingNodeIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

    const shouldRenderLegacy = comparisonNodes.length >= 2 && settings.visuals.layoutMode !== 'pitch-field' && settings.visuals.layoutMode !== 'diamond';
    const shouldRenderGroups = comparisonGroups.length > 0 && settings.visuals.layoutMode !== 'pitch-field' && settings.visuals.layoutMode !== 'diamond';

    const legacyPoints = useMemo(() => {
        if (!shouldRenderLegacy) return [];

        const validNodes = comparisonNodes.filter(n => existingNodeIds.has(n.id));
        if (validNodes.length < 2) return [];
        return validNodes.map(n => getRenderedNodePosition(n, nodes, settings, nodeIndexMap, rootNode));
    }, [comparisonNodes, nodes, settings, nodeIndexMap, rootNode, shouldRenderLegacy, existingNodeIds]);

    const groupLines = useMemo(() => {
        if (!shouldRenderGroups) return [];
        return comparisonGroups
            .filter(g => g.visible)
            .map(group => {

                const validNodes = group.nodes.filter(n => existingNodeIds.has(n.id));

                if (validNodes.length < 2) return null;
                return {
                    id: group.id,
                    color: group.color,
                    points: validNodes.map(n => getRenderedNodePosition(n, nodes, settings, nodeIndexMap, rootNode))
                };
            })
            .filter(g => g !== null) as Array<{ id: string; color: string; points: THREE.Vector3[] }>;
    }, [comparisonGroups, nodes, settings, nodeIndexMap, rootNode, shouldRenderGroups, existingNodeIds]);

    if (!shouldRenderLegacy && !shouldRenderGroups) return null;

    if (shouldRenderLegacy && legacyPoints.length < 2 && groupLines.length === 0) return null;

    return (
        <group>
            {shouldRenderLegacy && legacyPoints.length >= 2 && (
                <Line
                    points={legacyPoints}
                    color="#ff00ff"
                    lineWidth={4}
                    opacity={0.6}
                    transparent
                    depthTest={false}
                    renderOrder={15}
                />
            )}
            {groupLines.map(group => (
                <Line
                    key={group.id}
                    points={group.points}
                    color={group.color}
                    lineWidth={4}
                    opacity={0.8}
                    transparent
                    depthTest={false}
                    renderOrder={16}
                />
            ))}
        </group>
    );
};
