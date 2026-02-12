import type { NodeData, PrimeLimit, AppState } from '../../types';
import { playNote } from '../../audioEngine';
import { calculateNearby, getPitchClassDistance } from './utils';
import { STORAGE_KEYS } from '../logic/storageKeys';

export const handleSelectNode = (
  set: any, get: any,
  node: NodeData | null,
  preserveReference = false,
  addToHistory = true,
  playAudio = true
) => {
  const state: AppState = get();

  if (!node) {

    const newPanels = { ...state.panels, info: { ...state.panels.info, isOpen: false } };
    localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));

    set({
      selectedNode: null,
      referenceNode: null,
      nearbyNodes: [],
      nearestGen0Nodes: [],
      nearestGen1Node: null,
      highlightedPath: [],
      affiliatedLineNodeIds: [],
      affiliatedLineLimit: null,
      isNodeInfoVisible: false,
      isIsolationMode: false,
      commaLines: [],
      panels: newPanels
    });
    return;
  }

  if (playAudio) {
    playNote(node, state.settings);
  }

  const { nodes, settings, selectedNode, referenceNode, selectionHistory, historyIndex } = state;

  if (selectedNode && node.id === selectedNode.id && addToHistory) {

    const newPanels = { ...state.panels, info: { ...state.panels.info, isOpen: true } };
    localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
    set({ isNodeInfoVisible: true, panels: newPanels });
    return;
  }

  let newHistory = selectionHistory;
  let newIndex = historyIndex;

  if (addToHistory) {
    if (historyIndex < selectionHistory.length - 1) {
      newHistory = selectionHistory.slice(0, historyIndex + 1);
    }
    newHistory = [...newHistory, node.id];
    newIndex = newHistory.length - 1;
  }

  const nodeMap = new Map(nodes.map((n: NodeData) => [n.id, n]));

  // Check if in geometry mode (3D Shape)
  const isGeometryMode = settings.geometry?.enabled;

  let path: string[] = [];

  if (isGeometryMode) {
    // For geometry mode: find shortest path to origin (1/1) using BFS
    // Origin is the node where all prime vector values are 0
    const findOriginId = () => {
      for (const [id, n] of nodeMap) {
        const isOrigin = Object.values(n.primeVector as Record<number, number>).every(v => v === 0);
        if (isOrigin) return id;
      }
      return null;
    };

    const originId = findOriginId();

    if (originId && originId !== node.id) {
      // Build adjacency from edges
      const edges = state.edges || [];
      const adj = new Map<string, string[]>();
      for (const e of edges) {
        if (!adj.has(e.sourceId)) adj.set(e.sourceId, []);
        if (!adj.has(e.targetId)) adj.set(e.targetId, []);
        adj.get(e.sourceId)!.push(e.targetId);
        adj.get(e.targetId)!.push(e.sourceId);
      }

      // BFS to find shortest path
      const queue: { id: string; path: string[] }[] = [{ id: node.id, path: [node.id] }];
      const visited = new Set<string>([node.id]);

      while (queue.length > 0) {
        const { id, path: currentPath } = queue.shift()!;
        if (id === originId) {
          path = currentPath;
          break;
        }
        const neighbors = adj.get(id) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ id: neighbor, path: [...currentPath, neighbor] });
          }
        }
      }

      // If no path found, fallback to just the selected node
      if (path.length === 0) path = [node.id];
    } else if (originId === node.id) {
      path = [node.id]; // Selected node is the origin
    } else {
      path = [node.id]; // No origin found
    }
  } else {
    // Standard mode: follow parentId chain
    path = [node.id];
    let curr = node;
    while (curr.parentId) {
      path.push(curr.parentId);
      const parent = nodeMap.get(curr.parentId);
      if (parent) curr = parent;
      else break;
    }
  }

  let lineNodes: NodeData[] = [];
  let axisLimit: PrimeLimit = 3;

  // In geometry mode, don't highlight the entire axis line - only the shortest path
  if (!isGeometryMode) {
    if (node.gen === 0 && node.originLimit === 0) {
      lineNodes = nodes.filter((n: NodeData) => n.gen === 0);
      axisLimit = Math.max(...settings.rootLimits, 3) as PrimeLimit;
    } else {
      axisLimit = node.originLimit === 0 ? 3 : node.originLimit;
      lineNodes = nodes.filter((n: NodeData) => {
        let match = true;
        const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;
        for (const p of primes) {
          if (p !== axisLimit) {
            if (n.primeVector[p] !== node.primeVector[p]) {
              match = false;
              break;
            }
          }
        }
        return match;
      });
    }
  }

  const lineNodeIds = lineNodes.map(n => n.id);
  const nearby = calculateNearby(
    node,
    nodes,
    settings.centsTolerance,
    settings.nearbySort,
    settings.nearbyCount
  );

  const gen0Nodes = nodes.filter((n: NodeData) => n.gen === 0 && n.id !== node.id);
  const gen1Nodes = nodes.filter((n: NodeData) => n.gen === 1 && n.id !== node.id);

  const findNearest = (candidates: NodeData[], target: NodeData): NodeData | null => {
    if (candidates.length === 0) return null;
    let best = candidates[0];
    let minDiff = getPitchClassDistance(best.cents, target.cents);

    for (let i = 1; i < candidates.length; i++) {
      const current = candidates[i];
      const diff = getPitchClassDistance(current.cents, target.cents);
      if (diff < minDiff) {
        minDiff = diff;
        best = current;
      }
    }
    return best;
  };

  const findNearestList = (candidates: NodeData[], target: NodeData, count: number): NodeData[] => {
    if (candidates.length === 0) return [];

    const withDist = candidates.map(n => ({
      node: n,
      dist: getPitchClassDistance(n.cents, target.cents)
    }));

    withDist.sort((a, b) => a.dist - b.dist);
    return withDist.slice(0, count).map(x => x.node);
  };

  const newPanels = { ...state.panels, info: { ...state.panels.info, isOpen: true } };
  localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));

  set({
    selectedNode: node,
    referenceNode: preserveReference ? referenceNode : null,
    nearbyNodes: nearby,
    nearestGen0Nodes: findNearestList(gen0Nodes, node, 3),
    nearestGen1Node: findNearest(gen1Nodes, node),
    highlightedPath: path,
    affiliatedLineNodeIds: lineNodeIds,
    affiliatedLineLimit: axisLimit,
    isNodeInfoVisible: true,
    selectionHistory: newHistory,
    historyIndex: newIndex,
    panels: newPanels
  });
};

export const undoSelection = (set: any, get: any) => {
  const { selectionHistory, historyIndex, nodes, panels } = get();
  if (historyIndex >= 0) {
    const newIndex = historyIndex - 1;

    set({ commaLines: [] });

    if (newIndex === -1) {

      set({
        selectedNode: null,
        referenceNode: null,
        nearbyNodes: [],
        nearestGen0Nodes: [],
        nearestGen1Node: null,
        highlightedPath: [],
        affiliatedLineNodeIds: [],
        affiliatedLineLimit: null,
        isNodeInfoVisible: false,
        isIsolationMode: false,
        historyIndex: -1
      });
    } else {
      const nodeId = selectionHistory[newIndex];
      const node = nodes.find((n: any) => n.id === nodeId);
      if (node) {

        handleSelectNode(set, get, node, false, false, false);
        set({ historyIndex: newIndex });
      }
    }
  }
};

export const redoSelection = (set: any, get: any) => {
  const { selectionHistory, historyIndex, nodes } = get();
  if (historyIndex < selectionHistory.length - 1) {
    const newIndex = historyIndex + 1;

    set({ commaLines: [] });

    const nodeId = selectionHistory[newIndex];
    const node = nodes.find((n: any) => n.id === nodeId);
    if (node) {
      handleSelectNode(set, get, node, false, false, false);
      set({ historyIndex: newIndex });
    }
  }
};
