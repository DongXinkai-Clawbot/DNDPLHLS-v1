import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StoreApi } from 'zustand';
import { shallow } from 'zustand/shallow';

import type { AppSettings, NodeData, WorkspaceLayoutNode, WorkspacePaneNode, WorkspaceSplitDirection, WorkspaceTemplateId, WorkspaceViewType } from '../../types';
import { useStore } from '../../store';
import { LatticeStoreProvider, useLatticeStore } from '../../store/latticeStoreContext';
import { deepCopySettings } from '../../store/logic/utils';
import { getMinSize } from '../../utils/workspaceLayout';
import { estimateNodeCount } from '../../utils/lattice';
import { HuntSystemTool } from '../overlays/simple/ratioTool/HuntSystemTool';
import { MusicXmlRetuneTool } from '../overlays/simple/ratioTool/MusicXmlRetuneTool';
import { GenTab } from '../overlays/SettingsTabsPart3';
import { VisualTab } from '../overlays/VisualTab';
import Lattice3D from '../Lattice3D';
import { createWorkspaceLatticeStore } from './workspaceLatticeStore';
import type { WorkspaceLatticeState } from './workspaceLatticeStore';

const VIEW_OPTIONS: Array<{ id: WorkspaceViewType; label: string }> = [
  { id: 'hunt', label: 'Hunt Score' },
  { id: 'ji-scroller', label: 'JI Scroller' },
  { id: 'lattice', label: 'Lattice' },
  { id: 'empty', label: 'Empty' }
];

const TEMPLATE_OPTIONS: Array<{ id: WorkspaceTemplateId; label: string }> = [
  { id: 'single', label: 'Single' },
  { id: 'split-vertical', label: 'Split Vertical' },
  { id: 'split-horizontal', label: 'Split Horizontal' },
  { id: 'grid-2x2', label: 'Grid 2x2' },
  { id: 'triple-columns', label: 'Triple Columns' }
];

type LatticeRegistry = {
  registry: Map<string, StoreApi<WorkspaceLatticeState>>;
  baseSettings: AppSettings;
  ensureStore: (groupId: string, seed?: AppSettings) => StoreApi<WorkspaceLatticeState>;
};

const LatticeRegistryContext = React.createContext<LatticeRegistry | null>(null);

const useLatticeRegistry = () => useContext(LatticeRegistryContext);

const getLatticeGroupId = (pane: WorkspacePaneNode) =>
  (pane.viewState?.latticeGroupId as string | undefined) ?? pane.paneId;

const collectLatticePanes = (node: WorkspaceLayoutNode): Array<{ paneId: string; groupId: string }> => {
  if (node.type === 'pane') {
    if (node.viewType !== 'lattice') return [];
    return [{ paneId: node.paneId, groupId: getLatticeGroupId(node) }];
  }
  return [...collectLatticePanes(node.a), ...collectLatticePanes(node.b)];
};

const normalizeRatioValue = (value: number) => {
  let v = value;
  if (!Number.isFinite(v) || v <= 0) return 1;
  while (v >= 2) v /= 2;
  while (v < 1) v *= 2;
  return v;
};

const normalizeFractionToOctave = (n: bigint, d: bigint) => {
  let num = n < 0n ? -n : n;
  let den = d < 0n ? -d : d;
  if (num === 0n || den === 0n) return { n: 0n, d: 1n };
  while (num >= den * 2n) num /= 2n;
  while (num < den) num *= 2n;
  return { n: num, d: den };
};

const buildRatioOverrideFromNodes = (nodes: NodeData[]): string[] => {
  const entries = new Map<string, { cents: number; ratio: string }>();
  nodes.forEach((node) => {
    const frac = node.frac ?? node.ratio;
    if (!frac || frac.n === 0n || frac.d === 0n) return;
    const normalized = normalizeFractionToOctave(frac.n, frac.d);
    const rawValue = Number(normalized.n) / Number(normalized.d);
    if (!Number.isFinite(rawValue) || rawValue <= 0) return;
    const ratioValue = normalizeRatioValue(rawValue);
    const cents = 1200 * Math.log2(ratioValue);
    const key = cents.toFixed(6);
    if (entries.has(key)) return;
    const ratioStr = normalized.d === 1n ? `${normalized.n}` : `${normalized.n}/${normalized.d}`;
    entries.set(key, { cents, ratio: ratioStr });
  });
  return Array.from(entries.values())
    .sort((a, b) => a.cents - b.cents)
    .map((item) => item.ratio);
};

type LatticeDuplicateRequest = {
  layoutMode: 'h-chroma' | 'pitch-field' | 'diamond';
  ratios: string[];
  linked: boolean;
};

const WorkspaceLatticeInner = ({ onDuplicate }: { onDuplicate?: (payload: LatticeDuplicateRequest) => void }) => {
  const {
    settings,
    nodes,
    updateSettings,
    updateVisualSettings,
    toggleAxisLoop
  } = useLatticeStore(
    (s) => ({
      settings: s.settings,
      nodes: s.nodes,
      updateSettings: s.updateSettings,
      updateVisualSettings: s.updateVisualSettings,
      toggleAxisLoop: s.toggleAxisLoop
    }),
    shallow
  );

  const [configOpen, setConfigOpen] = useState(false);
  const [configTab, setConfigTab] = useState<'gen' | 'vis'>('gen');
  const [duplicateTarget, setDuplicateTarget] = useState<'h-chroma' | 'pitch-field' | 'diamond'>('h-chroma');
  const [duplicateLinked, setDuplicateLinked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const predictedCount = useMemo(() => estimateNodeCount(
    settings.rootLimits,
    settings.maxPrimeLimit,
    settings.expansionA,
    settings.expansionB,
    settings.expansionC,
    settings.expansionD,
    settings.expansionE,
    settings.gen0Lengths,
    settings.gen0Ranges,
    settings.gen1Lengths,
    settings.gen1Ranges,
    settings.secondaryOrigins,
    settings.gen2Lengths,
    settings.gen2Ranges,
    settings.gen3Lengths,
    settings.gen3Ranges,
    settings.gen4Lengths,
    settings.gen4Ranges,
    settings.gen1MaxPrimeLimit,
    settings.gen2MaxPrimeLimit,
    settings.gen3MaxPrimeLimit,
    settings.gen4MaxPrimeLimit,
    settings.equalStep,
    settings.gen1PrimeSet,
    settings.gen2PrimeSet,
    settings.gen3PrimeSet,
    settings.gen4PrimeSet
  ), [
    settings.rootLimits,
    settings.maxPrimeLimit,
    settings.expansionA,
    settings.expansionB,
    settings.expansionC,
    settings.expansionD,
    settings.expansionE,
    settings.gen0Lengths,
    settings.gen0Ranges,
    settings.gen1Lengths,
    settings.gen1Ranges,
    settings.secondaryOrigins,
    settings.gen2Lengths,
    settings.gen2Ranges,
    settings.gen3Lengths,
    settings.gen3Ranges,
    settings.gen4Lengths,
    settings.gen4Ranges,
    settings.gen1MaxPrimeLimit,
    settings.gen2MaxPrimeLimit,
    settings.gen3MaxPrimeLimit,
    settings.gen4MaxPrimeLimit,
    settings.equalStep,
    settings.gen1PrimeSet,
    settings.gen2PrimeSet,
    settings.gen3PrimeSet,
    settings.gen4PrimeSet
  ]);

  const handleGenSettingChange = useCallback(
    (keyOrPartial: any, value?: any, commit: boolean = true) => {
      const isPartial = typeof keyOrPartial === 'object' && keyOrPartial !== null;
      const partial = isPartial ? keyOrPartial : { [keyOrPartial]: value };
      updateSettings(partial, commit);
    },
    [updateSettings]
  );

  const handleVisualUpdate = useCallback(
    (visualPartial: any, commit?: boolean) => {
      updateVisualSettings(visualPartial, commit);
    },
    [updateVisualSettings]
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        const url = URL.createObjectURL(e.target.files[0]);
        updateVisualSettings({ backgroundImageUrl: url });
        e.target.value = '';
      }
    },
    [updateVisualSettings]
  );

  const toggleRootLimit = useCallback(
    (limit: number) => {
      const cur = settings.rootLimits || [];
      const next = cur.includes(limit)
        ? (cur.length > 1 ? cur.filter((x) => x !== limit) : cur)
        : [...cur, limit].sort((a, b) => a - b);
      updateSettings({ rootLimits: next });
    },
    [settings.rootLimits, updateSettings]
  );

  const movePriority = useCallback(
    (idx: number, dir: 'up' | 'down') => {
      const list = [...(settings.priorityOrder || [])];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      [list[idx], list[swap]] = [list[swap], list[idx]];
      updateSettings({ priorityOrder: list });
    },
    [settings.priorityOrder, updateSettings]
  );

  const duplicateLattice = useCallback(() => {
    const ratios = buildRatioOverrideFromNodes(nodes);
    onDuplicate?.({
      layoutMode: duplicateTarget,
      ratios,
      linked: duplicateLinked
    });
  }, [nodes, duplicateTarget, duplicateLinked, onDuplicate]);

  const clearCustomScale = useCallback(() => {
    updateVisualSettings({ hChromaCustomScale: [] });
  }, [updateVisualSettings]);

  const customScaleCount = Array.isArray(settings.visuals.hChromaCustomScale)
    ? settings.visuals.hChromaCustomScale.length
    : 0;

  return (
    <div className="relative w-full h-full min-h-[220px]">
      <div className="absolute top-2 right-2 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => setConfigOpen((v) => !v)}
          className="px-2 py-1 rounded border border-gray-700 text-[9px] uppercase tracking-widest text-gray-300 bg-black/60 hover:text-white"
        >
          {configOpen ? 'Close Config' : 'Config'}
        </button>
        <label className="flex items-center gap-1 text-[9px] text-gray-300 uppercase tracking-widest border border-gray-700 bg-black/60 px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={duplicateLinked}
            onChange={(e) => setDuplicateLinked(e.target.checked)}
            className="accent-blue-500"
          />
          Link New
        </label>
        <select
          value={duplicateTarget}
          onChange={(e) => setDuplicateTarget(e.target.value as any)}
          className="bg-black border border-gray-700 rounded px-2 py-1 text-[9px] text-gray-200"
        >
          <option value="h-chroma">Duplicate to H-Chroma</option>
          <option value="pitch-field">Duplicate to Pitch Field</option>
          <option value="diamond">Duplicate to Diamond</option>
        </select>
        <button
          type="button"
          onClick={duplicateLattice}
          className="px-2 py-1 rounded border border-gray-700 text-[9px] uppercase tracking-widest text-gray-300 bg-black/60 hover:text-white disabled:opacity-40"
          disabled={!nodes.length}
        >
          Duplicate
        </button>
        {customScaleCount > 0 && (
          <button
            type="button"
            onClick={clearCustomScale}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] uppercase tracking-widest text-gray-400 bg-black/40 hover:text-white"
          >
            Clear Override ({customScaleCount})
          </button>
        )}
      </div>

      {configOpen && (
        <div className="absolute top-10 right-2 z-20 w-[360px] max-w-full max-h-[80%] overflow-auto rounded-lg border border-gray-800 bg-black/80 p-2 text-[10px] text-gray-200 pointer-events-auto">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setConfigTab('gen')}
              className={`px-2 py-1 rounded border text-[9px] uppercase tracking-widest ${configTab === 'gen' ? 'border-blue-500 text-blue-200' : 'border-gray-700 text-gray-400'}`}
            >
              Gen
            </button>
            <button
              type="button"
              onClick={() => setConfigTab('vis')}
              className={`px-2 py-1 rounded border text-[9px] uppercase tracking-widest ${configTab === 'vis' ? 'border-blue-500 text-blue-200' : 'border-gray-700 text-gray-400'}`}
            >
              Visual
            </button>
          </div>
          {configTab === 'gen' && (
            <GenTab
              settings={settings}
              globalSettings={settings}
              handleSettingChange={handleGenSettingChange}
              updateVisualSettings={handleVisualUpdate}
              toggleAxisLoop={toggleAxisLoop}
              toggleRootLimit={toggleRootLimit}
              movePriority={movePriority}
              predictedCount={predictedCount}
              isGlobal
              onInteractionStart={() => {}}
              onInteractionEnd={() => {}}
            />
          )}
          {configTab === 'vis' && (
            <VisualTab
              settings={settings}
              updateVisualSettings={handleVisualUpdate}
              handleImageUpload={handleImageUpload}
              fileInputRef={fileInputRef}
              onInteractionStart={() => {}}
              onInteractionEnd={() => {}}
            />
          )}
        </div>
      )}

      <div className="absolute inset-0">
        <Lattice3D />
      </div>
    </div>
  );
};

const WorkspaceLatticeView = ({ pane }: { pane: WorkspacePaneNode }) => {
  const latticeRegistry = useLatticeRegistry();
  const { workspace, splitWorkspacePane, setWorkspacePaneView, setWorkspacePaneState } = useStore((s) => ({
    workspace: s.workspace,
    splitWorkspacePane: s.splitWorkspacePane,
    setWorkspacePaneView: s.setWorkspacePaneView,
    setWorkspacePaneState: s.setWorkspacePaneState
  }), shallow);

  const baseSettings = latticeRegistry?.baseSettings;
  const groupId = getLatticeGroupId(pane);
  const store = latticeRegistry?.ensureStore(groupId, baseSettings);

  const handleDuplicate = useCallback(
    (payload: LatticeDuplicateRequest) => {
      if (!store || !latticeRegistry) return;
      const nextPaneId = `pane-${workspace.nextPaneId}`;
      splitWorkspacePane(pane.paneId, 'row', 'after');
      setWorkspacePaneView(nextPaneId, 'lattice');

      if (payload.linked) {
        setWorkspacePaneState(nextPaneId, { latticeGroupId: groupId });
        store.getState().updateVisualSettings({
          layoutMode: payload.layoutMode,
          hChromaCustomScale: payload.ratios
        }, true);
        return;
      }

      const seed = deepCopySettings(store.getState().settings);
      seed.visuals = {
        ...seed.visuals,
        layoutMode: payload.layoutMode,
        hChromaCustomScale: payload.ratios
      };
      const newGroupId = nextPaneId;
      latticeRegistry.registry.set(newGroupId, createWorkspaceLatticeStore(seed));
      setWorkspacePaneState(nextPaneId, { latticeGroupId: newGroupId });
    },
    [store, latticeRegistry, workspace.nextPaneId, splitWorkspacePane, pane.paneId, setWorkspacePaneView, setWorkspacePaneState, groupId]
  );

  if (!store) {
    return <div className="text-[11px] text-gray-500">Lattice store unavailable.</div>;
  }

  return (
    <LatticeStoreProvider store={store}>
      <WorkspaceLatticeInner onDuplicate={handleDuplicate} />
    </LatticeStoreProvider>
  );
};

const WorkspacePaneView = ({ pane }: { pane: WorkspacePaneNode }) => {
  const viewType = pane.viewType;
  const { settings, nodes } = useStore((s) => ({ settings: s.settings, nodes: s.nodes }), shallow);

  if (viewType === 'hunt') {
    return <HuntSystemTool settings={settings} />;
  }

  if (viewType === 'ji-scroller') {
    return <MusicXmlRetuneTool settings={settings} nodes={nodes} />;
  }

  if (viewType === 'lattice') {
    return (
      <WorkspaceLatticeView pane={pane} />
    );
  }

  return (
    <div className="text-[11px] text-gray-500">
      Empty pane. Choose a view type.
    </div>
  );
};

const WorkspacePane = ({ node }: { node: Extract<WorkspaceLayoutNode, { type: 'pane' }> }) => {
  const {
    workspace,
    setWorkspacePaneView,
    setWorkspacePaneState,
    splitWorkspacePane,
    closeWorkspacePane
  } = useStore((s) => ({
    workspace: s.workspace,
    setWorkspacePaneView: s.setWorkspacePaneView,
    setWorkspacePaneState: s.setWorkspacePaneState,
    splitWorkspacePane: s.splitWorkspacePane,
    closeWorkspacePane: s.closeWorkspacePane
  }), shallow);

  const isLatticeView = node.viewType === 'lattice';
  const latticeRegistry = useLatticeRegistry();

  const latticeGroupId = useMemo(() => getLatticeGroupId(node), [node]);
  const latticePanes = useMemo(() => collectLatticePanes(workspace.layout), [workspace.layout]);
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    latticePanes.forEach((pane) => {
      counts.set(pane.groupId, (counts.get(pane.groupId) ?? 0) + 1);
    });
    return counts;
  }, [latticePanes]);
  const isSharedGroup = (groupCounts.get(latticeGroupId) ?? 0) > 1;
  const linkOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];
    const used = new Set<string>();
    latticePanes.forEach(({ paneId, groupId }) => {
      if (groupId === latticeGroupId) return;
      if (used.has(groupId)) return;
      used.add(groupId);
      options.push({ id: groupId, label: `Link to ${paneId}` });
    });
    return options;
  }, [latticePanes, latticeGroupId]);

  const handleLinkChange = useCallback(
    (nextGroupId: string) => {
      if (!latticeRegistry) return;
      const currentGroupId = latticeGroupId;
      if (nextGroupId === currentGroupId) return;
      latticeRegistry.ensureStore(nextGroupId);
      setWorkspacePaneState(node.paneId, { latticeGroupId: nextGroupId });
    },
    [latticeRegistry, latticeGroupId, node.paneId, setWorkspacePaneState]
  );

  const handleMakeIndependent = useCallback(() => {
    if (!latticeRegistry) return;
    const currentStore = latticeRegistry.ensureStore(latticeGroupId);
    const seed = deepCopySettings(currentStore.getState().settings);
    const newGroupId = `${node.paneId}-${Date.now().toString(36)}`;
    latticeRegistry.registry.set(newGroupId, createWorkspaceLatticeStore(seed));
    setWorkspacePaneState(node.paneId, { latticeGroupId: newGroupId });
  }, [latticeRegistry, latticeGroupId, node.paneId, setWorkspacePaneState]);

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-gray-800 bg-gray-950/70 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-900/80 border-b border-gray-800 text-[10px] uppercase tracking-widest">
        <select
          value={node.viewType}
          onChange={(e) => setWorkspacePaneView(node.paneId, e.target.value as WorkspaceViewType)}
          className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
        >
          {VIEW_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        {isLatticeView && (
          <div className="flex items-center gap-1">
            {linkOptions.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const target = e.target.value;
                  if (target) handleLinkChange(target);
                  e.currentTarget.value = '';
                }}
                className="bg-black border border-gray-700 rounded px-2 py-1 text-[9px] text-gray-200"
              >
                <option value="">Link to...</option>
                {linkOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleMakeIndependent}
              className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-300 hover:text-white"
              title="Make this pane independent"
            >
              Independent
            </button>
            <span className="text-[9px] text-gray-500">
              {isSharedGroup ? 'Linked' : 'Solo'}
            </span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => splitWorkspacePane(node.paneId, 'row', 'before')}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-400 hover:text-white"
            title="Split Left"
          >
            L
          </button>
          <button
            type="button"
            onClick={() => splitWorkspacePane(node.paneId, 'row', 'after')}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-400 hover:text-white"
            title="Split Right"
          >
            R
          </button>
          <button
            type="button"
            onClick={() => splitWorkspacePane(node.paneId, 'col', 'before')}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-400 hover:text-white"
            title="Split Up"
          >
            U
          </button>
          <button
            type="button"
            onClick={() => splitWorkspacePane(node.paneId, 'col', 'after')}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-400 hover:text-white"
            title="Split Down"
          >
            D
          </button>
          <button
            type="button"
            onClick={() => closeWorkspacePane(node.paneId)}
            className="px-2 py-1 rounded border border-gray-700 text-[9px] text-gray-400 hover:text-white"
            title="Close Pane"
          >
            X
          </button>
        </div>
      </div>
      <div className={`flex-1 min-h-0 ${isLatticeView ? 'overflow-hidden p-0' : 'overflow-auto p-3'}`}>
        <WorkspacePaneView pane={node} />
      </div>
    </div>
  );
};

const Resizer = ({ direction, onDrag }: { direction: WorkspaceSplitDirection; onDrag: (pos: number) => void }) => {
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastPosRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    lastPosRef.current = direction === 'row' ? e.clientX : e.clientY;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (e) {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    lastPosRef.current = direction === 'row' ? e.clientX : e.clientY;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      if (lastPosRef.current !== null) {
        onDrag(lastPosRef.current);
      }
      rafRef.current = null;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (e) {}
  };

  const baseClass = 'bg-gray-800 hover:bg-blue-600/70 transition-colors';
  const sizeClass = direction === 'row' ? 'w-1.5 cursor-col-resize' : 'h-1.5 cursor-row-resize';

  return (
    <div
      className={`${baseClass} ${sizeClass}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
    />
  );
};

const WorkspaceSplitView = ({
  node,
  onUpdate
}: {
  node: WorkspaceLayoutNode;
  onUpdate: (next: WorkspaceLayoutNode) => void;
}) => {
  if (node.type === 'pane') {
    return <WorkspacePane node={node} />;
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const minA = useMemo(() => getMinSize(node.a), [node.a]);
  const minB = useMemo(() => getMinSize(node.b), [node.b]);

  const handleDrag = (pos: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const total = node.direction === 'row' ? rect.width : rect.height;
    if (total <= 0) return;
    const offset = node.direction === 'row' ? pos - rect.left : pos - rect.top;
    const minRatio = (node.direction === 'row' ? minA.minWidth : minA.minHeight) / total;
    const maxRatio = 1 - (node.direction === 'row' ? minB.minWidth : minB.minHeight) / total;
    const clamped = Math.max(minRatio, Math.min(maxRatio, offset / total));
    if (Number.isFinite(clamped)) {
      onUpdate({ ...node, ratio: clamped });
    }
  };

  const flexDirection = node.direction === 'row' ? 'flex-row' : 'flex-col';
  const sizeA = node.direction === 'row'
    ? { minWidth: minA.minWidth, minHeight: minA.minHeight }
    : { minWidth: minA.minWidth, minHeight: minA.minHeight };
  const sizeB = node.direction === 'row'
    ? { minWidth: minB.minWidth, minHeight: minB.minHeight }
    : { minWidth: minB.minWidth, minHeight: minB.minHeight };

  return (
    <div ref={containerRef} className={`flex ${flexDirection} w-full h-full gap-1`}>
      <div
        className="min-w-0 min-h-0"
        style={{ flexBasis: `${node.ratio * 100}%`, ...sizeA }}
      >
        <WorkspaceSplitView
          node={node.a}
          onUpdate={(next) => onUpdate({ ...node, a: next })}
        />
      </div>
      <Resizer direction={node.direction} onDrag={handleDrag} />
      <div
        className="min-w-0 min-h-0"
        style={{ flexBasis: `${(1 - node.ratio) * 100}%`, ...sizeB }}
      >
        <WorkspaceSplitView
          node={node.b}
          onUpdate={(next) => onUpdate({ ...node, b: next })}
        />
      </div>
    </div>
  );
};

export const WorkspacePanel = () => {
  const {
    workspace,
    settings,
    applyWorkspaceTemplate,
    setWorkspaceLayout,
    setWorkspaceQuality,
    setWorkspaceSync,
    toggleWorkspaceDebug,
    toggleNodeInfo,
    saveWorkspacePreset,
    loadWorkspacePreset,
    deleteWorkspacePreset
  } = useStore((s) => ({
    workspace: s.workspace,
    settings: s.settings,
    applyWorkspaceTemplate: s.applyWorkspaceTemplate,
    setWorkspaceLayout: s.setWorkspaceLayout,
    setWorkspaceQuality: s.setWorkspaceQuality,
    setWorkspaceSync: s.setWorkspaceSync,
    toggleWorkspaceDebug: s.toggleWorkspaceDebug,
    toggleNodeInfo: s.toggleNodeInfo,
    saveWorkspacePreset: s.saveWorkspacePreset,
    loadWorkspacePreset: s.loadWorkspacePreset,
    deleteWorkspacePreset: s.deleteWorkspacePreset
  }), shallow);

  const [presetName, setPresetName] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [topBarCollapsed, setTopBarCollapsed] = useState(false);
  const latticeRegistryRef = useRef<Map<string, StoreApi<WorkspaceLatticeState>>>(new Map());

  const ensureLatticeStore = useCallback(
    (groupId: string, seed?: AppSettings) => {
      const registry = latticeRegistryRef.current;
      const existing = registry.get(groupId);
      if (existing) return existing;
      const seedSettings = seed ? deepCopySettings(seed) : deepCopySettings(settings);
      const store = createWorkspaceLatticeStore(seedSettings);
      registry.set(groupId, store);
      return store;
    },
    [settings]
  );

  const latticeRegistryValue = useMemo(() => ({
    registry: latticeRegistryRef.current,
    baseSettings: settings,
    ensureStore: ensureLatticeStore
  }), [settings, ensureLatticeStore]);

  useEffect(() => {
    if (!selectedPresetId && workspace.presets.length > 0) {
      setSelectedPresetId(workspace.presets[0].id);
    }
  }, [selectedPresetId, workspace.presets]);

  const presetOptions = workspace.presets;

  return (
    <div className="flex flex-col h-full gap-3 p-3 text-xs text-gray-200">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={() => setTopBarCollapsed((v) => !v)}
          className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
        >
          {topBarCollapsed ? 'Expand Header' : 'Collapse Header'}
        </button>
        {!topBarCollapsed && (
          <>
            <div className="flex items-center gap-1">
              {TEMPLATE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applyWorkspaceTemplate(opt.id)}
                  className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => toggleNodeInfo(true)}
                className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
              >
                Info Panel
              </button>
              <select
                value={workspace.sync.mode}
                onChange={(e) => setWorkspaceSync({ mode: e.target.value as any })}
                className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              >
                <option value="hard">Hard Sync</option>
                <option value="soft">Soft Sync</option>
                <option value="focus">Focus Sync</option>
              </select>
              <select
                value={workspace.quality.mode}
                onChange={(e) => setWorkspaceQuality(e.target.value as any)}
                className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              >
                <option value="high">Quality: High</option>
                <option value="balanced">Quality: Balanced</option>
                <option value="performance">Quality: Performance</option>
              </select>
              <button
                type="button"
                onClick={toggleWorkspaceDebug}
                className={`px-2 py-1 rounded border text-[10px] uppercase tracking-widest ${workspace.debug.enabled ? 'border-blue-500 text-blue-200' : 'border-gray-700 text-gray-300'}`}
              >
                Debug
              </button>
            </div>
          </>
        )}
      </div>

      {!topBarCollapsed && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
          />
          <button
            type="button"
            onClick={() => {
              saveWorkspacePreset(presetName);
              setPresetName('');
            }}
            className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
          >
            Save Preset
          </button>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
          >
            <option value="">Select preset</option>
            {presetOptions.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => selectedPresetId && loadWorkspacePreset(selectedPresetId)}
            className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
            disabled={!selectedPresetId}
          >
            Load
          </button>
          <button
            type="button"
            onClick={() => selectedPresetId && deleteWorkspacePreset(selectedPresetId)}
            className="px-2 py-1 rounded border border-gray-700 text-[10px] uppercase tracking-widest text-gray-300 hover:text-white"
            disabled={!selectedPresetId}
          >
            Delete
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 border border-gray-800 rounded-xl bg-black/40 overflow-hidden">
        <LatticeRegistryContext.Provider value={latticeRegistryValue}>
          <WorkspaceSplitView node={workspace.layout} onUpdate={setWorkspaceLayout} />
        </LatticeRegistryContext.Provider>
      </div>

      {workspace.debug.enabled && (
        <div className="border border-gray-800 rounded-lg bg-black/40 p-2 text-[10px] text-gray-400">
          <div className="uppercase tracking-widest text-gray-500 mb-1">Debug State</div>
          <div>Transport: {workspace.transport.mode} @ m{workspace.transport.position.measureIndex} t{workspace.transport.position.tick}</div>
          <div>Selection: {workspace.selection.selectedNotes.length} note(s)</div>
          <div>Sync: {workspace.sync.mode} {workspace.sync.syncEnabled ? 'on' : 'off'}</div>
        </div>
      )}
    </div>
  );
};
