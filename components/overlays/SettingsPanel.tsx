
import React, { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import type { AppSettings, OriginConfig, PrimeLimit } from '../../types';
import { GenTab, KeysTab, AudioTab, SymTab, MidiTab } from './SettingsTabs';
import { VisualTab } from './VisualTab';
import { HelpTab } from './HelpTab';
import { estimateNodeCount } from '../../utils/lattice';
import { ConfirmDialog } from './ConfirmDialog';
import { useDeviceType } from '../../hooks/useDeviceType';

const LazyTimbreTab = React.lazy(() => import('./TimbreTab').then(m => ({ default: m.TimbreTab })));
const LazyRatioTool = React.lazy(() => import('./simple/RatioTool').then(m => ({ default: m.RatioTool })));
const LazyTheoryOverlay = React.lazy(() => import('./TheoryOverlay').then(m => ({ default: m.TheoryOverlay })));
const LazyMathFunctionTab = React.lazy(() => import('./math/MathFunctionTab').then(m => ({ default: m.MathFunctionTab })));
const LazyRetunerSettingsPanel = React.lazy(() => import('../retuner/RetunerSettings').then(m => ({ default: m.RetunerSettingsPanel })));
const LazySimpleCommaSearch = React.lazy(() => import('./simple/SimpleCommaSearch').then(m => ({ default: m.SimpleCommaSearch })));
const LazyLibraryTab = React.lazy(() => import('./LibraryTab').then(m => ({ default: m.LibraryTab })));
const LazyMidiFileRetuneSection = React.lazy(() => import('./settingsTabsPart2/MidiFileRetuneSection').then(m => ({ default: m.MidiFileRetuneSection })));

const TAB_GROUPS = [
  { id: 'lattice', label: 'Lattice', tabs: ['gen', 'vis'] },
  { id: 'sound', label: 'Sound', tabs: ['audio', 'timbre'] },
  { id: 'input', label: 'Input', tabs: ['midi', 'midiretune'] },
  { id: 'retuner', label: 'External', tabs: ['retuner'] },
  { id: 'utilities', label: 'Utilities', tabs: ['tools', 'math', 'sym', 'keys', 'library'] },
  { id: 'learn', label: 'Learn', tabs: ['theory'] }
] as const;

const TAB_LABELS: Record<string, string> = {
  gen: 'GEN',
  audio: 'AUDIO',
  timbre: 'TIMBRE',
  vis: 'VIS',
  tools: 'TOOLS',
  math: 'MATH',
  midi: 'MIDI',
  midiretune: 'RETUNE',
  keys: 'SHORTCUT',
  retuner: 'DAW/EXT',
  sym: 'SYM',
  library: 'LIBRARY',
  help: 'HELP',
  theory: 'THEORY'
};

const TAB_GROUP_BY_TAB: Record<string, string> = {
  gen: 'lattice',
  vis: 'lattice',
  audio: 'sound',
  timbre: 'sound',
  midi: 'input',
  midiretune: 'input',
  keys: 'utilities',
  retuner: 'retuner',
  tools: 'utilities',
  math: 'utilities',
  sym: 'utilities',
  library: 'utilities',
  theory: 'learn',
  help: 'learn'
};

const cloneSettings = (value: AppSettings): AppSettings => {
  return JSON.parse(JSON.stringify(value));
};

export const SettingsPanel = ({ activeTab, setActiveTab }: any) => {
  const { isMobile } = useDeviceType();
  const {
    settings,
    updateSettings,
    commitDraftSettings,
    undoSettings,
    redoSettings,
    settingsHistory,
    settingsFuture,
    regenerateLattice,
    isGenerating,
    saveSession,
    loadSession,
    nodes,
    selectNode,
    customSampleNames,
    uploadCustomSample,
    resetSettings,
    addToKeyboard,
    exitToSetup,
    openEarTrainerFromAdvanced,
    toggleSimpleMode,
    panels,
    savedMidiScales,
    setNamingSetupOpen,
    auth,
    setAuthUi
  } = useStore((s) => ({
    settings: s.settings,
    updateSettings: s.updateSettings,
    commitDraftSettings: s.commitDraftSettings,
    undoSettings: s.undoSettings,
    redoSettings: s.redoSettings,
    settingsHistory: s.settingsHistory,
    settingsFuture: s.settingsFuture,
    regenerateLattice: s.regenerateLattice,
    isGenerating: s.isGenerating,
    saveSession: s.saveSession,
    loadSession: s.loadSession,
    nodes: s.nodes,
    selectNode: s.selectNode,
    customSampleNames: s.customSampleNames,
    uploadCustomSample: s.uploadCustomSample,
    resetSettings: s.resetSettings,
    addToKeyboard: s.addToKeyboard,
    exitToSetup: s.exitToSetup,
    openEarTrainerFromAdvanced: s.openEarTrainerFromAdvanced,
    toggleSimpleMode: s.toggleSimpleMode,
    panels: s.panels,
    savedMidiScales: s.savedMidiScales,
    setNamingSetupOpen: s.setNamingSetupOpen,
    auth: s.auth,
    setAuthUi: s.setAuthUi
  }), shallow);

  const [draftSettings, setDraftSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<AppSettings[]>([]);
  const [future, setFuture] = useState<AppSettings[]>([]);
  const [changedKeys, setChangedKeys] = useState<string[]>([]);
  const changedKeysRef = useRef<Set<string>>(new Set());
  const originalSettingsRef = useRef<AppSettings | null>(null);
  const [globalMenuOpen, setGlobalMenuOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [showCommaSearch, setShowCommaSearch] = useState(false);
  const [activeTabGroup, setActiveTabGroup] = useState<string>('lattice');
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dragStartSnapshot = useRef<AppSettings | null>(null);

  const safeStringify = (value: any) => {
    try {
      return JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    } catch {
      return String(value);
    }
  };

  const buildChangedKeysList = (draft: AppSettings, baseline: AppSettings, set: Set<string>) => {
    const ordered: string[] = [];
    const draftKeys = Object.keys(draft);
    draftKeys.forEach((key) => {
      if (set.has(key)) ordered.push(key);
    });
    const draftKeySet = new Set(draftKeys);
    Object.keys(baseline).forEach((key) => {
      if (!draftKeySet.has(key) && set.has(key)) ordered.push(key);
    });
    return ordered;
  };

  const recomputeChangedKeys = (draft: AppSettings | null, baseline = originalSettingsRef.current) => {
    if (!draft || !baseline) {
      changedKeysRef.current = new Set();
      setChangedKeys([]);
      return;
    }
    const keys = new Set([...Object.keys(draft), ...Object.keys(baseline)]);
    const nextSet = new Set<string>();
    keys.forEach((key) => {
      const a = (draft as any)[key];
      const b = (baseline as any)[key];
      if (safeStringify(a) !== safeStringify(b)) {
        nextSet.add(key);
      }
    });
    changedKeysRef.current = nextSet;
    setChangedKeys(buildChangedKeysList(draft, baseline, nextSet));
  };

  useEffect(() => {

    const clone = cloneSettings(settings);
    setDraftSettings(clone);
    originalSettingsRef.current = cloneSettings(settings);
    changedKeysRef.current = new Set();
    setChangedKeys([]);
  }, [settings]);

  const handleDraftUpdate = (partial: Partial<AppSettings>, isPreview: boolean = false, commit: boolean = true) => {
    if (!draftSettings) return;

    if (commit && !dragStartSnapshot.current) {
      setHistory(prev => [...prev, cloneSettings(draftSettings)]);
      setFuture([]);
    }

    const newDraft = { ...draftSettings, ...partial };
    if (partial.visuals) {
      newDraft.visuals = { ...draftSettings.visuals, ...partial.visuals };
    }
    if (partial.secondaryOrigins) {
      newDraft.secondaryOrigins = partial.secondaryOrigins;
    }
    if (partial.midi) {
      newDraft.midi = { ...draftSettings.midi, ...partial.midi };
    }
    if (partial.equalStep) {
      newDraft.equalStep = { ...draftSettings.equalStep, ...partial.equalStep };
    }
    if (partial.timbre) {
      newDraft.timbre = {
        ...draftSettings.timbre,
        ...partial.timbre,
        mapping: { ...draftSettings.timbre.mapping, ...(partial.timbre as any).mapping },
        performance: { ...draftSettings.timbre.performance, ...(partial.timbre as any).performance }
      };
    }
    if (partial.tuner) {
      const baseTuner = draftSettings.tuner ?? settings.tuner;
      newDraft.tuner = {
        ...(baseTuner || {}),
        ...partial.tuner
      };
      if (partial.tuner.profiles) {
        newDraft.tuner.profiles = partial.tuner.profiles;
      }
    }

    setDraftSettings(newDraft);

    if (originalSettingsRef.current) {
      const baseline = originalSettingsRef.current;
      const nextSet = new Set(changedKeysRef.current);
      let changed = false;
      Object.keys(partial).forEach((key) => {
        const a = (newDraft as any)[key];
        const b = (baseline as any)[key];
        const isChanged = safeStringify(a) !== safeStringify(b);
        if (isChanged) {
          if (!nextSet.has(key)) {
            nextSet.add(key);
            changed = true;
          }
        } else if (nextSet.delete(key)) {
          changed = true;
        }
      });
      if (changed) {
        changedKeysRef.current = nextSet;
        setChangedKeys(buildChangedKeysList(newDraft, baseline, nextSet));
      }
    }

    if (isPreview) {
      updateSettings(partial);
    }
  };

  const handleUndo = () => {
    if (history.length === 0 || !draftSettings) return;
    const prev = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setFuture(f => [draftSettings, ...f]);
    setHistory(newHistory);
    setDraftSettings(prev);
    recomputeChangedKeys(prev);

    if (prev.visuals) {
      const safeVisuals = { ...prev.visuals };
      safeVisuals.layoutMode = settings.visuals.layoutMode;
      updateSettings({ visuals: safeVisuals });
    }
  };

  const handleRedo = () => {
    if (future.length === 0 || !draftSettings) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(h => [...h, draftSettings]);
    setFuture(newFuture);
    setDraftSettings(next);
    recomputeChangedKeys(next);

    if (next.visuals) {
      const safeVisuals = { ...next.visuals };
      safeVisuals.layoutMode = settings.visuals.layoutMode;
      updateSettings({ visuals: safeVisuals });
    }
  };

  const handleVisualDraftUpdate = (visualPartial: Partial<AppSettings['visuals']>, isPreview: boolean = false, commit: boolean = true) => {
    if (!draftSettings) return;
    const newVisuals = { ...draftSettings.visuals, ...visualPartial };
    handleDraftUpdate({ visuals: newVisuals }, isPreview, commit);
  };

  const handleDraftToggleLoop = (limit: PrimeLimit) => {
    if (!draftSettings) return;
    if (activeScopeId === 'root') {
      const cur = draftSettings.axisLooping?.[limit] ?? null;
      const next = cur !== null ? null : (draftSettings.gen0Lengths?.[limit] ?? draftSettings.expansionA);
      const newLooping = { ...(draftSettings.axisLooping || {}), [limit]: next };
      handleDraftUpdate({ axisLooping: newLooping }, false, true);
      return;
    }

    const origin = draftSettings.secondaryOrigins.find(o => o.id === activeScopeId);
    if (!origin) return;
    const cur = origin.axisLooping?.[limit] ?? null;
    const next = cur !== null ? null : (origin.gen0Lengths?.[limit] ?? origin.expansionA ?? draftSettings.expansionA);
    const newLooping = { ...(origin.axisLooping || {}), [limit]: next };
    const nextOrigins = draftSettings.secondaryOrigins.map(o => o.id === activeScopeId ? { ...o, axisLooping: newLooping } : o);
    handleDraftUpdate({ secondaryOrigins: nextOrigins }, false, true);
  };

  const handleInteractionStart = () => {
    if (draftSettings && !dragStartSnapshot.current) {
      dragStartSnapshot.current = cloneSettings(draftSettings);
    }
  };

  const handleInteractionEnd = () => {
    if (dragStartSnapshot.current) {
      setHistory(prev => [...prev, dragStartSnapshot.current!]);
      setFuture([]);
      dragStartSnapshot.current = null;
    }
  };

  const TAB_RESET_KEYS: Record<string, (keyof AppSettings)[]> = {
    gen: [
      'maxPrimeLimit',
      'gen1MaxPrimeLimit',
      'gen2MaxPrimeLimit',
      'gen3MaxPrimeLimit',
      'gen4MaxPrimeLimit',
      'gen1PrimeSet',
      'gen2PrimeSet',
      'gen3PrimeSet',
      'gen4PrimeSet',
      'rootLimits',
      'secondaryOrigins',
      'expansionDirection',
      'expansionA',
      'gen0Lengths',
      'gen0Ranges',
      'expansionB',
      'gen1Lengths',
      'gen1Ranges',
      'gen2Lengths',
      'gen2Ranges',
      'expansionC',
      'expansionD',
      'expansionE',
      'deduplicateNodes',
      'deduplicationTolerance',
      'priorityOrder',
      'ensureConnectivity',
      'playUnisonOnSelect',
      'nearbySort',
      'nearbyCount',
      'highlightNearby',
      'loopTolerance',
      'axisLooping',
      'branchHotkeys',
      'spiral',
      'equalStep'
    ],
    audio: [
      'baseFrequency',
      'playDurationSingle',
      'playDurationDual',
      'waveform',
      'instrumentClick',
      'instrumentKeyboard',
      'instrumentChord',
      'synthPatches',
      'tuner'
    ],
    timbre: ['timbre'],
    vis: ['visuals'],
    midi: ['midi'],
    retuner: ['midi'],
    keys: ['navigationShortcuts', 'navigationControls'],
    sym: ['notationSymbols', 'accidentalPlacement']
  };

  const resetTabSettings = () => {
    if (!draftSettings || !originalSettingsRef.current) return;
    const baseline = originalSettingsRef.current;
    const clone = (value: any) => {
      if (value === undefined || value === null) return value;
      if (typeof value === 'bigint') return value;
      if (typeof structuredClone === 'function') {
        try { return structuredClone(value); } catch (e) { }
      }
      try {
        return JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v));
      } catch (e) {
        return value;
      }
    };

    if (activeTab === 'gen' && activeScopeId !== 'root') {
      const baseOrigin = baseline.secondaryOrigins.find(o => o.id === activeScopeId);
      if (!baseOrigin) return;
      const nextOrigins = uiSettings.secondaryOrigins.map(o => o.id === activeScopeId ? clone(baseOrigin) : o);
      handleDraftUpdate({ secondaryOrigins: nextOrigins }, false, true);
      return;
    }

    const keys = TAB_RESET_KEYS[activeTab] || [];
    if (keys.length === 0) return;
    const partial: Partial<AppSettings> = {};
    keys.forEach((key) => {
      (partial as any)[key] = clone((baseline as any)[key]);
    });
    handleDraftUpdate(partial, false, true);
  };

  const applyChanges = () => {
    if (draftSettings) {
      commitDraftSettings(draftSettings);
      originalSettingsRef.current = cloneSettings(draftSettings);
      changedKeysRef.current = new Set();
      setChangedKeys([]);

      setHistory([]);
      setFuture([]);
    }
  };

  const [activeScopeId, setActiveScopeId] = useState<string>('root');
  const [debouncedCount, setDebouncedCount] = useState(0);
  const [pendingAction, setPendingAction] = useState<"defaults" | "exit" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionInputRef = useRef<HTMLInputElement>(null);

  const uiSettings = draftSettings || settings;
  const isGenTab = activeTab === 'gen';
  const currentGroupTabs = TAB_GROUPS.find(g => g.id === activeTabGroup)?.tabs || [];

  useEffect(() => {
    setActiveTabGroup(TAB_GROUP_BY_TAB[activeTab] || 'lattice');
  }, [activeTab]);

  useEffect(() => {
    if (!globalMenuOpen && !changesOpen) return;
    const handlePointer = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (globalMenuOpen && target && !target.closest('[data-config-menu]')) {
        setGlobalMenuOpen(false);
      }
      if (changesOpen && target && !target.closest('[data-changes-panel]') && !target.closest('[data-changes-toggle]')) {
        setChangesOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointer);
    return () => window.removeEventListener('pointerdown', handlePointer);
  }, [globalMenuOpen, changesOpen]);

  useEffect(() => {
    if (activeScopeId !== 'root' && !uiSettings.secondaryOrigins.find(o => o.id === activeScopeId)) {
      setActiveScopeId('root');
    }
  }, [uiSettings.secondaryOrigins, activeScopeId]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      setIsCompact(tabsCollapsed || isMobile);
      return;
    }
    const updateCompact = () => {
      const width = el.clientWidth || 0;
      setIsCompact(tabsCollapsed || (width > 0 && width < 520));
    };
    updateCompact();
    const observer = new ResizeObserver(updateCompact);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, tabsCollapsed]);


  const currentConfig = useMemo(() => activeScopeId === 'root' ? uiSettings : (uiSettings.secondaryOrigins.find(o => o.id === activeScopeId) || uiSettings), [uiSettings, activeScopeId]);

  const pendingChangesCount = changedKeys.length;
  const canResetTab = (TAB_RESET_KEYS[activeTab] || []).length > 0;
  const isSignedIn = auth.status === 'signed_in' && !!auth.user?.email;
  const userLabel = auth.user?.displayName || auth.user?.email || 'Account';
  const tabFallback = <div className="p-3 text-[10px] text-gray-500">Loading...</div>;

  const handleGenSettingChange = (keyOrPartial: keyof AppSettings | Partial<AppSettings>, value?: any, commit: boolean = true) => {
    const isPartial = typeof keyOrPartial === 'object' && keyOrPartial !== null;
    const partial = isPartial ? (keyOrPartial as Partial<AppSettings>) : { [keyOrPartial as string]: value };

    if (activeScopeId === 'root') {
      handleDraftUpdate(partial, false, commit);
    } else {
      const newOrigins = uiSettings.secondaryOrigins.map(o =>
        o.id === activeScopeId ? { ...o, ...partial } : o
      );
      handleDraftUpdate({ secondaryOrigins: newOrigins }, false, commit);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      handleVisualDraftUpdate({ backgroundImageUrl: url }, true, true);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!isGenTab) return;
    const h = setTimeout(() => {
      setDebouncedCount(estimateNodeCount(
        uiSettings.rootLimits,
        uiSettings.maxPrimeLimit,
        uiSettings.expansionA,
        uiSettings.expansionB,
        uiSettings.expansionC,
        uiSettings.expansionD,
        uiSettings.expansionE,
        uiSettings.gen0Lengths,
        uiSettings.gen0Ranges,
        uiSettings.gen1Lengths,
        uiSettings.gen1Ranges,
        uiSettings.secondaryOrigins,
        uiSettings.gen2Lengths,
        uiSettings.gen2Ranges,
        uiSettings.gen1MaxPrimeLimit,
        uiSettings.gen2MaxPrimeLimit,
        uiSettings.gen3MaxPrimeLimit,
        uiSettings.gen4MaxPrimeLimit,
        uiSettings.equalStep,
        uiSettings.gen1PrimeSet,
        uiSettings.gen2PrimeSet,
        uiSettings.gen3PrimeSet,
        uiSettings.gen4PrimeSet
      ));
    }, 300);
    return () => clearTimeout(h);
  }, [
    isGenTab,
    uiSettings.rootLimits,
    uiSettings.maxPrimeLimit,
    uiSettings.expansionA,
    uiSettings.expansionB,
    uiSettings.expansionC,
    uiSettings.expansionD,
    uiSettings.expansionE,
    uiSettings.gen0Lengths,
    uiSettings.gen0Ranges,
    uiSettings.gen1Lengths,
    uiSettings.gen1Ranges,
    uiSettings.secondaryOrigins,
    uiSettings.gen2Lengths,
    uiSettings.gen2Ranges,
    uiSettings.gen1MaxPrimeLimit,
    uiSettings.gen2MaxPrimeLimit,
    uiSettings.gen3MaxPrimeLimit,
    uiSettings.gen4MaxPrimeLimit,
    uiSettings.equalStep,
    uiSettings.gen1PrimeSet,
    uiSettings.gen2PrimeSet,
    uiSettings.gen3PrimeSet,
    uiSettings.gen4PrimeSet
  ]);

  const handleResetDefaults = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingAction("defaults");
  };

  return (
    <div ref={panelRef} className="flex flex-col h-full w-full bg-gray-900/50">
      <div className="bg-gray-900/90 border-b border-gray-700 shrink-0">
        <div className="px-3 py-2 flex flex-col gap-2">
          <div className={isMobile ? 'flex flex-col gap-4' : 'grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-3 items-center'}>
            <div className={`flex flex-wrap items-center relative ${isMobile ? 'gap-1' : 'gap-1'}`} data-config-menu>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setGlobalMenuOpen(v => !v); }}
                className={`bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 rounded font-black uppercase tracking-widest ${isMobile ? 'text-[9px] px-2 py-1' : 'text-[10px] px-1.5 py-1.5'}`}
              >
                More
              </button>
              {globalMenuOpen && (
                <div className="absolute top-full left-0 mt-2 min-w-[180px] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-2 z-20">
                  <button onClick={() => { saveSession(); setGlobalMenuOpen(false); }} className="w-full text-left text-[9px] uppercase font-black text-blue-200 bg-blue-900/40 hover:bg-blue-800 border border-blue-700 px-2 py-1.5 rounded">Backup</button>
                  <button onClick={() => { sessionInputRef.current?.click(); setGlobalMenuOpen(false); }} className="mt-1 w-full text-left text-[9px] uppercase font-black text-blue-200 bg-blue-900/40 hover:bg-blue-800 border border-blue-700 px-2 py-1.5 rounded">Restore</button>
                  <button type="button" onClick={(e) => { handleResetDefaults(e); setGlobalMenuOpen(false); }} className="mt-1 w-full text-left text-[9px] uppercase font-black text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-600 px-2 py-1.5 rounded">Defaults</button>
                </div>
              )}
              <button
                onClick={openEarTrainerFromAdvanced}
                className={`bg-yellow-900/40 hover:bg-yellow-800 text-yellow-200 border border-yellow-700 rounded font-black uppercase tracking-widest ${isMobile ? 'text-[8px] px-2 py-1' : 'text-[9px] px-1.5 py-1.5'}`}
              >
                Ear Trainer
              </button>
              <button
                onClick={toggleSimpleMode}
                className={`rounded font-black uppercase tracking-widest border ${settings.isSimpleMode ? 'bg-green-700/50 hover:bg-green-600 text-green-100 border-green-500' : 'bg-indigo-900/40 hover:bg-indigo-800 text-indigo-200 border-indigo-700'} ${isMobile ? 'text-[8px] px-2 py-1' : 'text-[9px] px-1.5 py-1.5'}`}
              >
                Simple Mode
              </button>
              <button
                onClick={() => setPendingAction("exit")}
                className={`bg-red-900/40 hover:bg-red-800 text-red-100 border border-red-800 rounded font-black uppercase tracking-widest ${isMobile ? 'text-[8px] px-2 py-1' : 'text-[9px] px-1.5 py-1.5'}`}
              >
                Exit
              </button>
              <input type="file" ref={sessionInputRef} className="hidden" autoComplete="off" onChange={(e) => e.target.files?.[0] && loadSession(e.target.files[0])} />
            </div>

            <div className={`flex flex-col gap-1 ${isGenTab ? '' : 'opacity-60'}`}>
              <span className="text-[9px] uppercase font-black text-gray-500 tracking-widest">Scope</span>
              <div className="flex items-center gap-2">
                <select value={activeScopeId} onChange={(e) => setActiveScopeId(e.target.value)} disabled={!isGenTab} className="flex-1 bg-black border border-gray-700 rounded text-xs text-white p-1.5 focus:border-blue-500 outline-none [&>option]:bg-gray-900 [&>option]:text-gray-300" style={{ colorScheme: 'dark' }}>
                  <option value="root">Global Workspace (1/1)</option>
                  {uiSettings.secondaryOrigins.map((o: OriginConfig) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {activeScopeId !== 'root' && (
                  <button onClick={() => { const n = nodes.find((x: any) => x.id === activeScopeId); if (n) selectNode(n); }} className="text-[9px] bg-blue-700 px-2.5 py-1.5 rounded font-black uppercase tracking-widest">
                    Locate
                  </button>
                )}
              </div>
              {!isGenTab && <span className="text-[9px] text-gray-500 uppercase tracking-widest">Scope applies to GEN</span>}
            </div>

            <div className={`flex flex-wrap items-center justify-start lg:justify-end ${isMobile ? 'gap-1' : 'gap-1'}`}>
              <button
                onClick={() => setAuthUi(isSignedIn ? { sidebarOpen: true, modalOpen: false } : { modalOpen: true, sidebarOpen: false })}
                className="bg-black/40 border border-gray-700 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-200 hover:text-white hover:border-gray-500"
              >
                {isSignedIn ? userLabel : 'Sign in'}
              </button>
              <div className="flex gap-1 bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-lg">
                <button
                  onClick={undoSettings}
                  disabled={settingsHistory.length === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-[9px] font-black transition-all active:scale-90"
                  title="Undo Last Applied Config (Ctrl+Z)"
                >
                  Undo
                </button>
                <button
                  onClick={redoSettings}
                  disabled={settingsFuture.length === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-[9px] font-black transition-all active:scale-90"
                  title="Redo Applied Config (Ctrl+Y)"
                >
                  Redo
                </button>
              </div>

              <div className="flex gap-1 bg-yellow-900/20 p-1.5 rounded-xl border border-yellow-900/30 shadow-lg">
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 border border-gray-600 rounded-lg px-2 py-1.5 text-[9px] text-yellow-200 font-black transition-all active:scale-90"
                >
                  Local Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 border border-gray-600 rounded-lg px-2 py-1.5 text-[9px] text-yellow-200 font-black transition-all active:scale-90"
                >
                  Local Redo
                </button>
              </div>

              <button
                type="button"
                data-changes-toggle
                onClick={() => setChangesOpen(v => !v)}
                className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-600 px-2 py-1.5 rounded font-black uppercase tracking-widest"
              >
                Changes ({pendingChangesCount})
              </button>
            </div>
          </div>

          {changesOpen && (
            <div className="bg-black/40 border border-gray-800 rounded-lg p-2 text-[9px] text-gray-400" data-changes-panel>
              {pendingChangesCount > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {changedKeys.map((key) => (
                    <span key={key} className="px-2 py-0.5 bg-gray-800 rounded text-gray-300 uppercase tracking-widest">
                      {key}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">No pending changes</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 pt-3 flex flex-col gap-2 shrink-0">
          <div className="flex items-start gap-2">
            {!tabsCollapsed ? (
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-1">
                    {TAB_GROUPS.map(group => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => {
                          setActiveTabGroup(group.id);
                          const nextTab = group.tabs[0];
                          if (nextTab && nextTab !== activeTab) setActiveTab(nextTab as any);
                        }}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${activeTabGroup === group.id ? 'bg-blue-700 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setNamingSetupOpen(true)}
                    className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors bg-gray-900 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
                    title="Naming Setup"
                  >
                    Aa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTabGroup('learn');
                      setActiveTab('help' as any);
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${activeTab === 'help' ? 'bg-emerald-700 text-white border-emerald-400' : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'}`}
                  >
                    Help
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {currentGroupTabs.map(t => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t as any)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${activeTab === t ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-700'}`}
                    >
                      {TAB_LABELS[t] || t}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 flex-1 h-7">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-2">
                  <span className="text-blue-300">{TAB_GROUPS.find(g => g.id === activeTabGroup)?.label}</span>
                  <span className="text-gray-600">/</span>
                  <span className="text-white">{TAB_LABELS[activeTab] || activeTab}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setTabsCollapsed(v => !v)}
              className="mt-0.5 px-2 py-1 rounded bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-[10px]"
              title={tabsCollapsed ? "Expand Tabs" : "Collapse Tabs"}
            >
              {tabsCollapsed ? '▼' : '▲'}
            </button>
          </div>
        </div>

        <div className={`px-3 overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-1 ${isMobile ? 'pb-[calc(env(safe-area-inset-bottom)+120px)]' : 'pb-24'}`}>
          {activeTab === 'gen' && (
            <>
              <GenTab
                settings={currentConfig}
                globalSettings={uiSettings}
                handleSettingChange={handleGenSettingChange}
                updateVisualSettings={handleVisualDraftUpdate}
                toggleAxisLoop={handleDraftToggleLoop}
                toggleRootLimit={(l: any) => { const cur = currentConfig.rootLimits; const next = cur.includes(l) ? (cur.length > 1 ? cur.filter((x: any) => x !== l) : cur) : [...cur, l].sort((a: any, b: any) => a - b); handleGenSettingChange('rootLimits', next); }}
                movePriority={(i: number, d: 'up' | 'down') => { const next = [...uiSettings.priorityOrder]; const swap = d === 'up' ? i - 1 : i + 1; if (swap >= 0 && swap < next.length) { [next[i], next[swap]] = [next[swap], next[i]]; handleDraftUpdate({ priorityOrder: next }, false); } }}
                predictedCount={debouncedCount}
                isGlobal={activeScopeId === 'root'}
                isCompact={isCompact}
                onInteractionStart={handleInteractionStart}
                onInteractionEnd={handleInteractionEnd}
              />
            </>
          )}
          {activeTab === 'math' && (
            <Suspense fallback={tabFallback}>
              <LazyMathFunctionTab />
            </Suspense>
          )}
          {activeTab === 'midi' && (
            <MidiTab settings={uiSettings} handleSettingChange={(p: any, commit: boolean = true) => handleDraftUpdate(p, false, commit)} />
          )}
          {activeTab === 'midiretune' && (
            <div className="bg-black/30 border border-gray-800 rounded-xl p-3 shadow-lg">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">MIDI FILE RETUNE</div>
              <Suspense fallback={tabFallback}>
                <LazyMidiFileRetuneSection settings={uiSettings} savedMidiScales={savedMidiScales} />
              </Suspense>
            </div>
          )}
          {activeTab === 'retuner' && (
            <Suspense fallback={tabFallback}>
              <LazyRetunerSettingsPanel settings={uiSettings} onUpdate={(p: Partial<AppSettings>) => handleDraftUpdate(p, false, true)} />
            </Suspense>
          )}
          {activeTab === 'tools' && (
            <div className="bg-black/30 border border-gray-800 rounded-xl p-2 shadow-lg">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">HARMONIC UTILITIES</div>
              <Suspense fallback={tabFallback}>
                <LazyRatioTool nodes={nodes} settings={uiSettings} updateSettings={handleDraftUpdate} regenerateLattice={regenerateLattice} selectNode={selectNode} addToKeyboard={addToKeyboard} />
              </Suspense>
            </div>
          )}
          {activeTab === 'audio' && <AudioTab settings={uiSettings} handleSettingChange={(p: any, commit: boolean = true) => handleDraftUpdate(p, false, commit)} customSampleNames={customSampleNames} uploadCustomSample={uploadCustomSample} onInteractionStart={handleInteractionStart} onInteractionEnd={handleInteractionEnd} />}
          {activeTab === 'timbre' && (
            <Suspense fallback={tabFallback}>
              <LazyTimbreTab settings={uiSettings} handleSettingChange={(p: any, commit: boolean = true) => handleDraftUpdate(p, true, commit)} onInteractionStart={handleInteractionStart} onInteractionEnd={handleInteractionEnd} />
            </Suspense>
          )}
          {activeTab === 'vis' && <VisualTab settings={uiSettings} updateVisualSettings={handleVisualDraftUpdate} handleImageUpload={handleImageUpload} fileInputRef={fileInputRef} onInteractionStart={handleInteractionStart} onInteractionEnd={handleInteractionEnd} />}
          {activeTab === 'keys' && (
            <KeysTab
              settings={uiSettings}
              handleShortcutChange={(l: number, k: string) => handleDraftUpdate({ navigationShortcuts: { ...uiSettings.navigationShortcuts, [l]: k.toLowerCase() } }, false)}
              handleSettingChange={(p: any, commit: boolean = true) => handleDraftUpdate(p, false, commit)}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          )}
          {activeTab === 'sym' && <SymTab settings={uiSettings} updateSettings={(p: any) => handleDraftUpdate(p, false)} />}
          {activeTab === 'library' && (
            <div className="bg-black/30 border border-gray-800 rounded-xl p-3 shadow-lg">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">CHORD, SCALE & INTERVAL LIBRARY</div>
              <Suspense fallback={tabFallback}>
                <LazyLibraryTab />
              </Suspense>
            </div>
          )}
          {activeTab === 'help' && <HelpTab />}
          {activeTab === 'theory' && (
            <Suspense fallback={tabFallback}>
              <LazyTheoryOverlay onClose={() => setActiveTab('gen')} />
            </Suspense>
          )}
        </div>

        {activeTab !== 'math' && (
          <div className="sticky bottom-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur px-3 py-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-end gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowCommaSearch(v => !v)}
                  className={`px-3 py-2 rounded font-black text-[10px] uppercase tracking-widest border transition-all ${showCommaSearch ? 'bg-indigo-900 border-indigo-500 text-indigo-200' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Temperament / Comma Finder"
                >
                  Commas
                </button>
                {showCommaSearch && (
                  <div className="absolute bottom-full right-0 mb-3 w-[300px] bg-black/90 backdrop-blur-xl border border-gray-600 rounded-xl shadow-2xl z-50 p-1 flex flex-col max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center p-2 border-b border-white/10 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Comma Finder</span>
                      <button onClick={() => setShowCommaSearch(false)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                    <div className="p-1">
                      <Suspense fallback={tabFallback}>
                        <LazySimpleCommaSearch />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={resetTabSettings}
                disabled={!canResetTab}
                className={`px-3 py-2 rounded font-black text-[10px] uppercase tracking-widest border transition-all ${canResetTab ? 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700' : 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'}`}
              >
                Reset
              </button>

              {pendingChangesCount > 0 && (
                <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest ml-1">
                  Modified ({pendingChangesCount})
                </span>
              )}

              <button
                onClick={applyChanges}
                disabled={isGenerating}
                className={`px-4 py-2 rounded font-black text-[10px] uppercase tracking-widest transition-all ${isGenerating ? 'bg-gray-800 text-gray-500' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95'}`}
              >
                {isGenerating ? 'Generating...' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction === "defaults" ? "Reset to Defaults" : "Exit"}
        message={pendingAction === "defaults" ? "Restore defaults?" : "Exit to Main Menu?"}
        danger
        confirmText={pendingAction === "defaults" ? "Reset" : "Exit"}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          const a = pendingAction;
          setPendingAction(null);
          if (a === "defaults") {
            setDraftSettings(null);
            setHistory([]);
            setFuture([]);
            changedKeysRef.current = new Set();
            setChangedKeys([]);
            dragStartSnapshot.current = null;
            resetSettings();
          }
          if (a === "exit") {
            exitToSetup('landing');
          }
        }}
      />
    </div>
  );
};
