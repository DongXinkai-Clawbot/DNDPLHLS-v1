import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { NativeAR } from '../../nativeAR';
import type {
  NativeArCapabilities,
  NativeArOcclusionMode,
  NativeArUiMode,
  NativeArNodeSpec,
  NativeArNodePatch,
  NativeArViewportRect,
} from '../../nativeAR';

import { useStore } from '../../store';
import type { NodeData } from '../../types';
import { GEN_SIZES, UNIT_DISTANCE, getPrimeColor } from '../../constants';
import { playNote } from '../../audioEngine';
import { createLogger } from '../../utils/logger';
import { reportFatalError, reportRecoverableError } from '../../utils/errorReporting';
import { isNativeAndroid } from '../../utils/capabilities';
import { getPerformancePolicy } from '../../utils/performancePolicy';

const log = createLogger('ar/native');

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const hexToRgb01 = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized.padStart(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return { r: r / 255, g: g / 255, b: b / 255 };
};

const DEFAULT_NODE_LIMIT = 600;
const NODE_BATCH_SIZE = 200;

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (items.length === 0) return [];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const defaultMetersPerUnit = (): number => {
  // Node positions are in "lattice units" (UNIT_DISTANCE = 10 by default).
  // We map one unit-distance step to ~12cm in AR.
  const desiredStepMeters = 0.12;
  return desiredStepMeters / UNIT_DISTANCE;
};

const buildViewportRect = (el: HTMLElement | null, mode: NativeArUiMode): NativeArViewportRect => {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  if (typeof window === 'undefined') {
    return { x: 0, y: 0, width: 0, height: 0, dpr };
  }

  if (mode === 'fullscreen' || !el) {
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight, dpr };
  }

  const rect = el.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    dpr,
  };
};

const isViewportUsable = (rect: NativeArViewportRect) => {
  return rect.width >= 120 && rect.height >= 120;
};

const getNodeColorSpec = (node: NodeData, settings: any): { r: number; g: number; b: number } => {
  // Use originLimit color (consistent with lattice visuals) when available.
  const prime = node.originLimit && node.originLimit !== 0 ? node.originLimit : 3;
  const color = getPrimeColor(prime as any, settings);
  return hexToRgb01(color);
};

const buildNodeSpecs = (
  nodes: NodeData[],
  settings: any,
  metersPerUnit: number,
  maxNodes: number
): NativeArNodeSpec[] => {
  const ordered = [...nodes].sort((a, b) => {
    if (a.gen !== b.gen) return a.gen - b.gen;
    return a.cents - b.cents;
  });

  const subset = ordered.slice(0, maxNodes);

  return subset.map((node) => {
    const sizeBase = (GEN_SIZES as any)[node.gen] ?? 0.6;
    // Convert to meters. Keep nodes readable at distance.
    const radiusMeters = clamp((sizeBase * metersPerUnit) * 0.55, 0.008, 0.06);
    const { r, g, b } = getNodeColorSpec(node, settings);

    return {
      id: node.id,
      x: node.position.x * metersPerUnit,
      y: node.position.y * metersPerUnit,
      z: node.position.z * metersPerUnit,
      r: radiusMeters,
      cr: r,
      cg: g,
      cb: b,
      ca: 0.95,
    };
  });
};

export const NativeARContainer: React.FC = () => {
  const { settings, updateSettings, nodes, selectedNode, selectNode, stopAllAudioActivity } = useStore(
    (s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
      nodes: s.nodes,
      selectedNode: s.selectedNode,
      selectNode: s.selectNode,
      stopAllAudioActivity: s.stopAllAudioActivity,
    }),
    shallow
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const lastSelectedIdRef = useRef<string | null>(null);

  const [capabilities, setCapabilities] = useState<NativeArCapabilities | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [uiMode, setUiModeState] = useState<NativeArUiMode>('fullscreen');
  const [occlusionMode, setOcclusionModeState] = useState<NativeArOcclusionMode>('depth');
  const [metersPerUnit, setMetersPerUnit] = useState<number>(() => defaultMetersPerUnit());

  const [rootAnchorId, setRootAnchorId] = useState<string | null>(null);

  const lastSyncedMetersPerUnitRef = useRef<number>(0);
  const lastSyncedMaxNodesRef = useRef<number>(0);
  const lastSentSpecsRef = useRef<Map<string, NativeArNodeSpec>>(new Map());
  const panelFailureCountRef = useRef(0);
  const syncQueueRef = useRef<{ timer: number | null; inFlight: boolean; pendingAnchorId: string | null }>({
    timer: null,
    inFlight: false,
    pendingAnchorId: null,
  });
  const selectionQueueRef = useRef<{ raf: number | null; nextId: string | null }>({ raf: null, nextId: null });

  const isActive = settings.isArActive;
  const nativeAndroid = isNativeAndroid();

  const maxNodes = useMemo(() => {
    const policy = getPerformancePolicy();
    const baseLimit = Math.min(DEFAULT_NODE_LIMIT, policy.maxNodes);
    if (uiMode === 'panel') {
      return Math.min(baseLimit, Math.round(baseLimit * 0.7));
    }
    return baseLimit;
  }, [uiMode]);

  const nodeIdToNode = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const syncViewport = useCallback(async () => {
    if (!nativeAndroid || !isActive) return;
    try {
      const rect = buildViewportRect(viewportRef.current, uiMode);
      if (uiMode === 'panel' && !isViewportUsable(rect)) {
        log.warn('Panel viewport too small, falling back to fullscreen');
        setUiModeState('fullscreen');
        await NativeAR.setUiMode({ mode: 'fullscreen' });
        await NativeAR.setViewportRect(buildViewportRect(viewportRef.current, 'fullscreen'));
        return;
      }
      await NativeAR.setViewportRect(rect);
    } catch (e: any) {
      log.warn('setViewportRect failed', e);
    }
  }, [isActive, nativeAndroid, uiMode]);

  // Sync viewport on orientation change for panel mode
  useEffect(() => {
    if (!nativeAndroid || !isActive || uiMode !== 'panel') return;

    const handleOrientationChange = () => {
      log.info('Device orientation changed, resyncing AR viewport');
      syncViewport();
    };

    // Listen for both orientationchange and resize events for better coverage
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, [isActive, nativeAndroid, uiMode, syncViewport, log]);

  // Start native AR session when AR is activated.
  useEffect(() => {
    if (!nativeAndroid || !isActive) return;

    let cancelled = false;
    let sessionTimeoutId: NodeJS.Timeout | null = null;

    (async () => {
      setSessionStatus('starting');
      setErrorMessage(null);

      try {
        // Add 15s timeout for entire session startup
        // Native layer can hang on some devices, this prevents app from freezing
        const sessionStartPromise = (async () => {
          const caps = await NativeAR.getCapabilities();
          if (cancelled) return;
          setCapabilities(caps);

          if (!caps.supported) {
            setSessionStatus('error');
            setErrorMessage(caps.message || 'AR not supported on this device.');
            return;
          }

          // Pick best occlusion default (Depth when supported, otherwise Plane).
          const preferred: NativeArOcclusionMode = caps.depthSupported ? 'depth' : 'plane';
          // If user selected depth but it's not supported, fall back immediately.
          const requested: NativeArOcclusionMode = caps.depthSupported ? occlusionMode : (occlusionMode === 'depth' ? 'plane' : occlusionMode);
          if (!caps.depthSupported && occlusionMode === 'depth') setOcclusionModeState(preferred);

          const viewport = buildViewportRect(viewportRef.current, uiMode);

          // Add timeout wrapper around native calls
          await Promise.race([
            NativeAR.startSession({ uiMode, viewport, occlusionMode: requested }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Native AR session start timeout (15s)')), 15000)
            ),
          ]);

          await Promise.race([
            NativeAR.setViewportRect(viewport),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('setViewportRect timeout')), 5000)
            ),
          ]);

          await Promise.race([
            NativeAR.setOcclusionMode({ mode: requested }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('setOcclusionMode timeout')), 5000)
            ),
          ]);

          if (cancelled) return;
          setSessionStatus('running');
        })();

        await sessionStartPromise;
      } catch (e: any) {
        log.error('startSession failed', e);
        reportFatalError('Native AR', e, 'Failed to start native AR session.');
        if (!cancelled) {
          setSessionStatus('error');
          const errorMsg = e?.message || String(e);
          setErrorMessage(
            errorMsg.includes('timeout')
              ? 'AR startup timed out. Please restart and try again.'
              : errorMsg
          );
        }
      } finally {
        if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
      }
    })();

    return () => {
      cancelled = true;
      if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
      NativeAR.stopSession().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, nativeAndroid]);

  const stopNativeSession = useCallback(async () => {
    if (!nativeAndroid) return;
    try {
      await NativeAR.stopSession();
    } catch (e) {
      log.warn('stopSession failed', e);
    }
  }, [nativeAndroid]);

  const resetPlacement = useCallback(async () => {
    if (!nativeAndroid) {
      setRootAnchorId(null);
      lastSentSpecsRef.current = new Map();
      lastSyncedMetersPerUnitRef.current = 0;
      lastSyncedMaxNodesRef.current = 0;
      panelFailureCountRef.current = 0;
      return;
    }
    try {
      await NativeAR.clearNodes();
      await NativeAR.clearAnchors();
    } catch (e) {
      log.warn('resetPlacement failed', e);
    } finally {
      setRootAnchorId(null);
      lastSelectedIdRef.current = null;
      lastSentSpecsRef.current = new Map();
      lastSyncedMetersPerUnitRef.current = 0;
      lastSyncedMaxNodesRef.current = 0;
      panelFailureCountRef.current = 0;
    }
  }, [nativeAndroid]);

  const exitAR = useCallback(async () => {
    stopAllAudioActivity();
    await stopNativeSession();
    await resetPlacement();
    updateSettings({ isArActive: false });
  }, [resetPlacement, stopAllAudioActivity, stopNativeSession, updateSettings]);

  const syncNodesToNative = useCallback(
    async (anchorId: string) => {
      if (!nativeAndroid) return;
      try {
        const specs = buildNodeSpecs(nodes, settings, metersPerUnit, maxNodes);
        const lastSpecs = lastSentSpecsRef.current;
        const nextSpecs = new Map(specs.map((spec) => [spec.id, spec]));

        const isInitialSync = lastSpecs.size === 0;

        const toCreate: NativeArNodeSpec[] = [];
        const toRecreate: NativeArNodeSpec[] = [];
        const patches: NativeArNodePatch[] = [];
        const toRemoveSet = new Set<string>();

        if (isInitialSync) {
          toCreate.push(...specs);
        } else {
          for (const id of lastSpecs.keys()) {
            if (!nextSpecs.has(id)) toRemoveSet.add(id);
          }

          for (const spec of specs) {
            const prev = lastSpecs.get(spec.id);
            if (!prev) {
              toCreate.push(spec);
              continue;
            }

            if (prev.x !== spec.x || prev.y !== spec.y || prev.z !== spec.z) {
              toRemoveSet.add(spec.id);
              toRecreate.push(spec);
              continue;
            }

            const patch: NativeArNodePatch = { id: spec.id };
            if (prev.r !== spec.r) patch.r = spec.r;
            if (prev.cr !== spec.cr) patch.cr = spec.cr;
            if (prev.cg !== spec.cg) patch.cg = spec.cg;
            if (prev.cb !== spec.cb) patch.cb = spec.cb;
            if (prev.ca !== spec.ca) patch.ca = spec.ca;
            if (Object.keys(patch).length > 1) patches.push(patch);
          }
        }

        if (isInitialSync) {
          await NativeAR.clearNodes();
          for (const batch of chunkArray(toCreate, NODE_BATCH_SIZE)) {
            await NativeAR.createNodes({ anchorId, nodes: batch });
          }
        } else {
          const toRemove = Array.from(toRemoveSet);
          const createQueue = [...toCreate, ...toRecreate];
          for (const batch of chunkArray(toRemove, NODE_BATCH_SIZE)) {
            await NativeAR.removeNodes({ ids: batch });
          }
          for (const batch of chunkArray(createQueue, NODE_BATCH_SIZE)) {
            await NativeAR.createNodes({ anchorId, nodes: batch });
          }
          for (const batch of chunkArray(patches, NODE_BATCH_SIZE)) {
            await NativeAR.updateNodes({ nodes: batch });
          }
        }

        lastSentSpecsRef.current = nextSpecs;
        lastSyncedMetersPerUnitRef.current = metersPerUnit;
        lastSyncedMaxNodesRef.current = maxNodes;
      } catch (e) {
        log.warn('syncNodes failed', e);
      }
    },
    [metersPerUnit, maxNodes, nativeAndroid, nodes, settings]
  );

  const queueSyncNodes = useCallback((anchorId: string) => {
    if (!nativeAndroid) return;
    const queue = syncQueueRef.current;
    queue.pendingAnchorId = anchorId;
    if (queue.timer !== null) return;
    queue.timer = window.setTimeout(async () => {
      queue.timer = null;
      if (queue.inFlight) {
        queue.timer = window.setTimeout(() => queueSyncNodes(queue.pendingAnchorId as string), 33);
        return;
      }
      const nextAnchor = queue.pendingAnchorId;
      if (!nextAnchor) return;
      queue.inFlight = true;
      try {
        await syncNodesToNative(nextAnchor);
      } finally {
        queue.inFlight = false;
        if (queue.pendingAnchorId && queue.pendingAnchorId !== nextAnchor) {
          queue.timer = window.setTimeout(() => queueSyncNodes(queue.pendingAnchorId as string), 33);
        }
      }
    }, 33);
  }, [nativeAndroid, syncNodesToNative]);

  const updateSelectionHighlight = useCallback(
    async (nextId: string | null) => {
      if (!nativeAndroid) return;
      const queue = selectionQueueRef.current;
      queue.nextId = nextId;
      if (queue.raf) return;
      queue.raf = window.requestAnimationFrame(async () => {
        queue.raf = null;
        const next = queue.nextId;
        const prevId = lastSelectedIdRef.current;
        if (prevId === next) return;
        const patches: NativeArNodePatch[] = [];
        if (prevId) patches.push({ id: prevId, selected: false });
        if (next) patches.push({ id: next, selected: true });
        lastSelectedIdRef.current = next;
        if (!patches.length) return;
        try {
          await NativeAR.updateNodes({ nodes: patches });
        } catch (e) {
          log.warn('updateNodes (selection) failed', e);
        }
      });
    },
    [nativeAndroid]
  );

  const handleTap = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (!nativeAndroid || sessionStatus !== 'running') return;

      const rect = buildViewportRect(viewportRef.current, uiMode);
      if (!rect.width || !rect.height) return;
      const localX = e.clientX - rect.x;
      const localY = e.clientY - rect.y;
      if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) return;
      const nx = clamp(localX / rect.width, 0, 1);
      const ny = clamp(localY / rect.height, 0, 1);

      // Placement mode
      if (!rootAnchorId) {
        try {
          const res = await NativeAR.addAnchorFromHit({ nx, ny });
          setRootAnchorId(res.anchorId);
          panelFailureCountRef.current = 0;
          await syncNodesToNative(res.anchorId);
        } catch (err: any) {
          log.warn('addAnchorFromHit failed', err);
          reportRecoverableError('Native AR', err, 'Failed to place anchor. Please try again.');
          if (uiMode === 'panel') {
            panelFailureCountRef.current += 1;
            if (panelFailureCountRef.current >= 2) {
              setUiModeState('fullscreen');
              panelFailureCountRef.current = 0;
              try {
                await NativeAR.setUiMode({ mode: 'fullscreen' });
                await syncViewport();
                setErrorMessage('Panel mode disabled due to placement mismatch.');
              } catch (e) {
                log.warn('fallback to fullscreen failed', e);
              }
            }
          }
        }
        return;
      }

      // Selection mode
      try {
        const { nodeId } = await NativeAR.pickNode({ nx, ny });
        if (!nodeId) return;
        const node = nodeIdToNode.get(nodeId);
        if (!node) return;

        playNote(node, settings);
        selectNode(node, false, true, false);
        await updateSelectionHighlight(node.id);
      } catch (err) {
        log.warn('pickNode failed', err);
        reportRecoverableError('Native AR', err, 'Failed to select node.');
      }
    },
    [nativeAndroid, nodeIdToNode, rootAnchorId, selectNode, sessionStatus, settings, syncNodesToNative, updateSelectionHighlight]
  );

  // Keep viewport in sync on resize/orientation change.
  useEffect(() => {
    if (!nativeAndroid || !isActive) return;
    syncViewport();

    const onResize = () => syncViewport();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncViewport()) : null;
    if (observer && viewportRef.current) observer.observe(viewportRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (observer) observer.disconnect();
    };
  }, [isActive, nativeAndroid, syncViewport, uiMode]);

  useEffect(() => {
    return () => {
      const syncQueue = syncQueueRef.current;
      if (syncQueue.timer) window.clearTimeout(syncQueue.timer);
      syncQueue.timer = null;
      const selectionQueue = selectionQueueRef.current;
      if (selectionQueue.raf) window.cancelAnimationFrame(selectionQueue.raf);
      selectionQueue.raf = null;
    };
  }, []);

  // Re-sync nodes when the lattice changes (new node set) or when scale/maxNodes changes.
  useEffect(() => {
    if (!nativeAndroid || !isActive) return;
    if (!rootAnchorId) return;

    queueSyncNodes(rootAnchorId);
  }, [isActive, maxNodes, metersPerUnit, nativeAndroid, nodes, queueSyncNodes, rootAnchorId]);

  // Update selection highlight when state changes from other UI (keyboard, nav, etc.)
  useEffect(() => {
    if (!nativeAndroid || !isActive) return;
    const next = selectedNode?.id || null;
    updateSelectionHighlight(next);
  }, [isActive, nativeAndroid, selectedNode?.id, updateSelectionHighlight]);

  const toggleUiMode = useCallback(async () => {
    const next: NativeArUiMode = uiMode === 'fullscreen' ? 'panel' : 'fullscreen';
    setUiModeState(next);
    try {
      await NativeAR.setUiMode({ mode: next });
      await syncViewport();
    } catch (e) {
      log.warn('setUiMode failed', e);
    }
  }, [syncViewport, uiMode]);

  const cycleOcclusion = useCallback(async () => {
    const caps = capabilities;
    const supportedDepth = !!caps?.depthSupported;

    const next: NativeArOcclusionMode =
      occlusionMode === 'off' ? 'plane'
        : occlusionMode === 'plane' ? (supportedDepth ? 'depth' : 'off')
          : 'off';

    setOcclusionModeState(next);
    try {
      await NativeAR.setOcclusionMode({ mode: next });
    } catch (e) {
      log.warn('setOcclusionMode failed', e);
    }
  }, [capabilities, occlusionMode]);

  const arHud = (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      <div className="pointer-events-auto absolute flex gap-2" style={{
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        left: 'calc(12px + env(safe-area-inset-left, 0px))',
      }}>
        <button
          type="button"
          onClick={exitAR}
          className="min-h-[44px] rounded-full border border-red-500 bg-red-700/80 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur"
        >
          Exit AR
        </button>
      </div>

      <div className="pointer-events-auto absolute flex gap-2" style={{
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
        right: 'calc(12px + env(safe-area-inset-right, 0px))',
      }}>
        <button
          type="button"
          onClick={toggleUiMode}
          className="min-h-[44px] rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur"
        >
          {uiMode === 'fullscreen' ? 'Panel' : 'Fullscreen'}
        </button>
        <button
          type="button"
          onClick={cycleOcclusion}
          className="min-h-[44px] rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur"
          title="Toggle occlusion: Off → Plane → Depth"
        >
          Occl: {occlusionMode.toUpperCase()}
        </button>
      </div>

      <div className="pointer-events-auto absolute flex flex-col gap-2" style={{
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: 'calc(12px + env(safe-area-inset-left, 0px))',
      }}>
        <button
          type="button"
          onClick={resetPlacement}
          className="min-h-[44px] rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur"
        >
          Re-Anchor
        </button>
      </div>

      <div className="pointer-events-auto absolute rounded-2xl border border-white/10 bg-black/60 p-3 text-white backdrop-blur" style={{
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        right: 'calc(12px + env(safe-area-inset-right, 0px))',
        width: '14rem',
        maxWidth: 'calc(100% - 24px - 2*env(safe-area-inset-right, 0px))',
      }}>
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">AR Scale</div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={0.004}
            max={0.03}
            step={0.001}
            value={metersPerUnit}
            onChange={(e) => setMetersPerUnit(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-[10px] font-bold tabular-nums text-gray-200">{(metersPerUnit * UNIT_DISTANCE).toFixed(2)}m</div>
        </div>
        <div className="mt-1 text-[10px] text-gray-300">
          {rootAnchorId ? 'Tap nodes to play/choose.' : 'Tap a plane to place anchor.'}
        </div>
      </div>

      {sessionStatus !== 'running' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-white/10 bg-black/80 p-6 text-center text-white shadow-xl backdrop-blur">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">Native AR</div>
            <div className="mt-2 text-sm font-bold">
              {sessionStatus === 'starting' ? 'Starting AR session…' : sessionStatus === 'error' ? 'AR Error' : 'Idle'}
            </div>
            {errorMessage && <div className="mt-2 text-[11px] text-red-300">{errorMessage}</div>}
            {capabilities?.message && !errorMessage && <div className="mt-2 text-[11px] text-gray-300">{capabilities.message}</div>}
          </div>
        </div>
      )}
    </div>
  );

  if (!nativeAndroid) {
    // Safety fallback: native AR container should never mount in web.
    return (
      <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black text-white">
        <div className="max-w-md text-center">
          <div className="text-lg font-black">Native AR unavailable</div>
          <div className="mt-2 text-sm text-gray-300">This AR mode requires the Android app build.</div>
          <button
            type="button"
            onClick={() => updateSettings({ isArActive: false })}
            className="mt-4 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xs font-black uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const panelLayout = uiMode === 'panel';

  return (
    <div className="absolute inset-0 z-[5]">
      {/* The native AR view lives behind the WebView. This element is only used
          to define the visible AR viewport area (panel mode) and to capture taps. */}
      <div
        ref={viewportRef}
        className={
          panelLayout
            ? 'absolute left-3 right-3 h-[38vh] rounded-3xl border border-white/10 bg-transparent shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
            : 'absolute inset-0 bg-transparent'
        }
        style={panelLayout ? {
          top: 'calc(12px + env(safe-area-inset-top, 0px))',
          left: 'calc(12px + env(safe-area-inset-left, 0px))',
          right: 'calc(12px + env(safe-area-inset-right, 0px))',
        } : undefined}
        onPointerDown={handleTap}
      />

      {arHud}
    </div>
  );
};
