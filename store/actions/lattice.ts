import type { AppSettings, EdgeData, NodeData } from '../../types';
import {
  applyLatticeDisplayMapping,
  buildLatticeDisplayKey,
  buildLatticeTopologyKey,
  generateLattice
} from '../../utils/lattice';
import { buildNodeSearchIndex } from '../../utils/nodeSearchIndex';
import { deserializeLattice } from '../../utils/lattice/deserialization';
import type { SerializedLattice } from '../../utils/lattice/serialization';
import { createLogger } from '../../utils/logger';

const log = createLogger('lattice/regenerate');

const CACHE_LIMIT = 4;
const latticeCache = new Map<string, { nodes: NodeData[]; edges: EdgeData[] }>();
let latticeGenerationId = 0;
let workerRequestId = 0;
const workerRequests = new Map<number, { resolve: (payload: SerializedLattice) => void; reject: (error: Error) => void }>();
let latticeWorker: Worker | null = null;

const getCachedLattice = (key: string) => {
  const cached = latticeCache.get(key);
  if (!cached) return null;
  latticeCache.delete(key);
  latticeCache.set(key, cached);
  return cached;
};

const storeCachedLattice = (key: string, payload: { nodes: NodeData[]; edges: EdgeData[] }) => {
  latticeCache.set(key, payload);
  if (latticeCache.size > CACHE_LIMIT) {
    const oldestKey = latticeCache.keys().next().value;
    if (oldestKey) latticeCache.delete(oldestKey);
  }
};

const ensureWorker = () => {
  if (typeof Worker === 'undefined') return null;
  if (latticeWorker) return latticeWorker;

  latticeWorker = new Worker(new URL('../../utils/lattice/latticeWorker.ts', import.meta.url), { type: 'module' });
  latticeWorker.onmessage = (event) => {
    const data = event.data as { id: number; payload?: SerializedLattice; error?: { message: string; stack?: string } };
    const pending = workerRequests.get(data.id);
    if (!pending) return;
    workerRequests.delete(data.id);
    if (data.error) {
      const err = new Error(data.error.message);
      if (data.error.stack) err.stack = data.error.stack;
      pending.reject(err);
      return;
    }
    if (!data.payload) {
      pending.reject(new Error('Worker returned empty payload'));
      return;
    }
    pending.resolve(data.payload);
  };
  latticeWorker.onerror = (event) => {
    log.error('Worker error', event);
  };
  latticeWorker.onmessageerror = (event) => {
    log.error('Worker message error', event);
  };

  return latticeWorker;
};

const requestWorkerLattice = (settings: AppSettings) => {
  const worker = ensureWorker();
  if (!worker) {
    return Promise.reject(new Error('Worker unavailable'));
  }
  const id = workerRequestId += 1;
  return new Promise<SerializedLattice>((resolve, reject) => {
    workerRequests.set(id, { resolve, reject });
    worker.postMessage({ id, settings });
  });
};

const applyDefaultVisuals = (settings: AppSettings, nodes: NodeData[]) => {
  if (!settings.visuals) return settings;
  const count = nodes.length;
  const newVisuals = { ...settings.visuals };

  if (count < 5000) {
    newVisuals.lineRenderingMode = 'quality';
    newVisuals.nodeShape = 'sphere';
  } else {
    newVisuals.lineRenderingMode = 'performance';
    newVisuals.nodeShape = 'lowpoly';
  }

  return { ...settings, visuals: newVisuals };
};

const commitLatticeState = (
  set: any,
  settings: AppSettings,
  nodes: NodeData[],
  edges: EdgeData[],
  topologyKey: string,
  displayKey: string,
  restoreSelectionId?: string | null,
  restoreReferenceId?: string | null
) => {
  // Try to restore selection from new nodes
  let nextSelectedNode = null;
  let nextReferenceNode = null;

  if (restoreSelectionId) {
    nextSelectedNode = nodes.find(n => n.id === restoreSelectionId) || null;
  }
  if (restoreReferenceId) {
    nextReferenceNode = nodes.find(n => n.id === restoreReferenceId) || null;
  }

  const nodeSearchIndex = buildNodeSearchIndex(nodes);
  set({
    nodes,
    nodeSearchIndex,
    edges,
    settings,
    latticeTopologyKey: topologyKey,
    latticeDisplayKey: displayKey,
    activeMaxPrimeLimit: settings.maxPrimeLimit,
    isGenerating: false,
    error: null,
    selectedNode: nextSelectedNode,
    referenceNode: nextReferenceNode,
    nearbyNodes: [],
    nearestGen0Nodes: [],
    nearestGen1Node: null,
    highlightedPath: [],
    affiliatedLineNodeIds: [],
    affiliatedLineLimit: null,
    selectionHistory: [],
    historyIndex: -1
  });
};

const remapDisplayOnlyState = (state: any, settings: AppSettings) => {
  const nextNodes = state.nodes.slice() as NodeData[];
  applyLatticeDisplayMapping(nextNodes, settings);

  // Preserve selected/reference identity but ensure the hook subscribers re-render (new refs).
  let nextSelectedNode = state.selectedNode as NodeData | null;
  let nextReferenceNode = state.referenceNode as NodeData | null;

  if (nextSelectedNode) {
    const idx = nextNodes.findIndex(n => n.id === nextSelectedNode!.id);
    if (idx >= 0) {
      const refreshed = { ...nextNodes[idx] };
      nextNodes[idx] = refreshed;
      nextSelectedNode = refreshed;
    } else {
      const tmp = [{ ...nextSelectedNode }] as NodeData[];
      applyLatticeDisplayMapping(tmp, settings);
      nextSelectedNode = tmp[0];
    }
  }

  if (nextReferenceNode) {
    const idx = nextNodes.findIndex(n => n.id === nextReferenceNode!.id);
    if (idx >= 0) {
      const refreshed = { ...nextNodes[idx] };
      nextNodes[idx] = refreshed;
      nextReferenceNode = refreshed;
    } else {
      const tmp = [{ ...nextReferenceNode }] as NodeData[];
      applyLatticeDisplayMapping(tmp, settings);
      nextReferenceNode = tmp[0];
    }
  }

  const nextComparisonNodes = state.comparisonNodes?.length
    ? (state.comparisonNodes.slice() as NodeData[])
    : state.comparisonNodes;
  if (Array.isArray(nextComparisonNodes)) applyLatticeDisplayMapping(nextComparisonNodes, settings);

  const nextCustomKeyboard = state.customKeyboard?.length
    ? (state.customKeyboard.slice() as NodeData[])
    : state.customKeyboard;
  if (Array.isArray(nextCustomKeyboard)) applyLatticeDisplayMapping(nextCustomKeyboard, settings);

  const nextSavedChords = Array.isArray(state.savedChords)
    ? state.savedChords.map((c: any) => {
      const nodes = Array.isArray(c.nodes) ? (c.nodes.slice() as NodeData[]) : [];
      if (nodes.length) applyLatticeDisplayMapping(nodes, settings);
      return { ...c, nodes };
    })
    : state.savedChords;

  const nextSavedKeyboards = Array.isArray(state.savedKeyboards)
    ? state.savedKeyboards.map((k: any) => {
      const nodes = Array.isArray(k.nodes) ? (k.nodes.slice() as NodeData[]) : [];
      if (nodes.length) applyLatticeDisplayMapping(nodes, settings);
      return { ...k, nodes };
    })
    : state.savedKeyboards;

  return {
    nextNodes,
    nextNodeSearchIndex: buildNodeSearchIndex(nextNodes),
    nextSelectedNode,
    nextReferenceNode,
    nextComparisonNodes,
    nextCustomKeyboard,
    nextSavedChords,
    nextSavedKeyboards
  };
};

export const handleRegenerateLattice = (set: any, get: any, applyDefaults = false, recordHistory = false) => {
  log.info('Starting regeneration', { applyDefaults, recordHistory });
  latticeGenerationId += 1;
  const generationId = latticeGenerationId;
  set({ isGenerating: true, error: null });

  setTimeout(() => {
    if (generationId !== latticeGenerationId) return;
    const current = get();
    const { settings } = current;

    const topologyKey = buildLatticeTopologyKey(settings);
    const displayKey = buildLatticeDisplayKey(settings);

    // Fast-path: only display settings changed (notation/transposition), keep topology and preserve state.
    if (
      current.latticeTopologyKey &&
      current.latticeTopologyKey === topologyKey &&
      current.latticeDisplayKey !== displayKey &&
      Array.isArray(current.nodes) &&
      current.nodes.length > 0
    ) {
      log.debug('Display-only update (no topology regen)');
      set((s: any) => {
        const remapped = remapDisplayOnlyState(s, settings);
        return {
          nodes: remapped.nextNodes,
          nodeSearchIndex: remapped.nextNodeSearchIndex,
          selectedNode: remapped.nextSelectedNode,
          referenceNode: remapped.nextReferenceNode,
          comparisonNodes: remapped.nextComparisonNodes,
          customKeyboard: remapped.nextCustomKeyboard,
          savedChords: remapped.nextSavedChords,
          savedKeyboards: remapped.nextSavedKeyboards,
          latticeTopologyKey: topologyKey,
          latticeDisplayKey: displayKey,
          isGenerating: false,
          error: null
        };
      });
      return;
    }

    log.debug('Current settings', {
      rootLimits: settings.rootLimits,
      maxPrimeLimit: settings.maxPrimeLimit,
      expansionA: settings.expansionA,
      expansionB: settings.expansionB,
      expansionC: settings.expansionC,
      expansionD: settings.expansionD,
      expansionE: settings.expansionE
    });

    const cached = getCachedLattice(topologyKey);
    if (cached) {
      log.debug('Using cached lattice');
      // Ensure cached nodes reflect the *current* display settings.
      const nodes = cached.nodes.slice();
      applyLatticeDisplayMapping(nodes, settings);

      const finalSettings = applyDefaults ? applyDefaultVisuals(settings, nodes) : settings;
      commitLatticeState(set, finalSettings, nodes, cached.edges, topologyKey, displayKey, current.selectedNode?.id, current.referenceNode?.id);
      log.info('Regeneration complete (cache hit)');
      return;
    }

    const finalize = (nodes: NodeData[], edges: EdgeData[]) => {
      // Cache by topology key (display mapping applied on commit).
      storeCachedLattice(topologyKey, { nodes, edges });

      // Apply display mapping for current session (worker may have used stale mapping if settings changed mid-flight).
      const nextNodes = nodes.slice();
      applyLatticeDisplayMapping(nextNodes, settings);

      const finalSettings = applyDefaults ? applyDefaultVisuals(settings, nextNodes) : settings;
      commitLatticeState(set, finalSettings, nextNodes, edges, topologyKey, displayKey, current.selectedNode?.id, current.referenceNode?.id);
      log.info('Regeneration complete', { nodeCount: nextNodes.length, edgeCount: edges.length });
    };

    const runFallback = (error: unknown) => {
      log.warn('Worker generation failed, falling back to main thread', error);
      try {
        const result = generateLattice(settings);
        if (generationId !== latticeGenerationId) return;
        finalize(result.nodes, result.edges);
      } catch (err: any) {
        if (generationId !== latticeGenerationId) return;
        log.error('Generation error', err);
        set({ isGenerating: false, error: err?.message || 'Unknown generation error' });
      }
    };

    requestWorkerLattice(settings)
      .then((payload) => {
        if (generationId !== latticeGenerationId) return;
        const { nodes, edges } = deserializeLattice(payload);
        finalize(nodes, edges);
      })
      .catch((error) => {
        if (generationId !== latticeGenerationId) return;
        runFallback(error);
      });
  }, 10);
};
