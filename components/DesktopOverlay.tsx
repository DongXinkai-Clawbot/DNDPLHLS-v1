import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useStore } from '../store';
import { notifySuccess } from '../utils/notifications';
import { shallow } from 'zustand/shallow';
import { formatRatio, getNoteName } from '../musicLogic';
import type { NodeData, PrimeLimit } from '../types';
import { playSimultaneous } from '../audioEngine';
import { TopBar } from './overlays/TopBar';
import { SimpleOverlay } from './overlays/SimpleOverlay';
import { PanelWindow } from './common/PanelWindow';
import { Vector3 } from 'three';
import { useAudioController } from '../hooks/useAudioController';
import { useGlobalKeyHandler } from '../hooks/useGlobalKeyHandler';
import { useMidiSystem } from '../hooks/useMidiSystem';
import { createLogger } from '../utils/logger';
import { searchNodeIndex } from '../utils/nodeSearchIndex';

const LazySettingsPanel = React.lazy(() => import('./overlays/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const LazyInfoPanel = React.lazy(() => import('./overlays/InfoPanel').then(m => ({ default: m.InfoPanel })));
const LazyVirtualKeyboard = React.lazy(() => import('./overlays/VirtualKeyboard').then(m => ({ default: m.VirtualKeyboard })));
const LazyComparisonTray = React.lazy(() => import('./overlays/ComparisonTray').then(m => ({ default: m.ComparisonTray })));
const LazyProgressionPanel = React.lazy(() => import('./overlays/ProgressionPanel').then(m => ({ default: m.ProgressionPanel })));
const LazyTheoryOverlay = React.lazy(() => import('./overlays/TheoryOverlay').then(m => ({ default: m.TheoryOverlay })));
const LazyPureRatioScorePanel = React.lazy(() => import('./overlays/PureRatioScorePanel').then(m => ({ default: m.PureRatioScorePanel })));
const LazyPureRatioHorizontalScoreOverlay = React.lazy(() => import('./overlays/PureRatioHorizontalScoreOverlay').then(m => ({ default: m.PureRatioHorizontalScoreOverlay })));
const LazyHunt205RingOverlay = React.lazy(() => import('./overlays/Hunt205RingOverlay').then(m => ({ default: m.Hunt205RingOverlay })));
const LazyEarTrainingOverlay = React.lazy(() => import('./overlays/ear/EarTrainingOverlay').then(m => ({ default: m.EarTrainingOverlay })));
const LazyMathFunctionTab = React.lazy(() => import('./overlays/math/MathFunctionTab').then(m => ({ default: m.MathFunctionTab })));
const LazyMidiDevicePanel = React.lazy(() => import('./midi/MidiDevicePanel').then(m => ({ default: m.MidiDevicePanel })));
const LazyWorkspacePanel = React.lazy(() => import('./workspace/WorkspacePanel').then(m => ({ default: m.WorkspacePanel })));
const LazyRetuneSnapPanel = React.lazy(() => import('./overlays/RetuneSnapPanel').then(m => ({ default: m.RetuneSnapPanel })));

const MidiListener = () => {
    useMidiSystem();
    return null;
};

const log = createLogger('ui/desktop-overlay');

export const DesktopOverlay = () => {
    const {
        settings,
        updateSettings,
        selectedNode,
        nodeSearchIndex,
        selectNode,
        customKeyboard,
        comparisonNodes,
        toggleKeyboard,
        toggleComparisonTray,
        isPureUIMode,
        togglePureUIMode,
        toggleSettings,
        toggleProgressionPanel,
        retunePreviewActive,
        panels,
        focusPanel,
        earTraining,
        savedKeyboards,
        setPanelState,
        updateVisualSettings,
        regenerateLattice,
        historyIndex,
        selectionHistory,
        undoSelection,
        redoSelection
    } = useStore((s) => ({
        settings: s.settings,
        updateSettings: s.updateSettings,
        selectedNode: s.selectedNode,
        nodeSearchIndex: s.nodeSearchIndex,
        selectNode: s.selectNode,
        customKeyboard: s.customKeyboard,
        comparisonNodes: s.comparisonNodes,
        toggleKeyboard: s.toggleKeyboard,
        toggleComparisonTray: s.toggleComparisonTray,
        isPureUIMode: s.isPureUIMode,
        togglePureUIMode: s.togglePureUIMode,
        toggleSettings: s.toggleSettings,
        toggleProgressionPanel: s.toggleProgressionPanel,
        panels: s.panels,
        focusPanel: s.focusPanel,
        earTraining: s.earTraining,
        savedKeyboards: s.savedKeyboards,
        setPanelState: s.setPanelState,
        updateVisualSettings: s.updateVisualSettings,
        regenerateLattice: s.regenerateLattice,
        historyIndex: s.historyIndex,
        selectionHistory: s.selectionHistory,
        undoSelection: s.undoSelection,
        redoSelection: s.redoSelection,
        retunePreviewActive: s.midiRetuner?.retunePreviewActive ?? false
    }), shallow);

    const [activeTab, setActiveTab] = useState<'gen' | 'audio' | 'timbre' | 'vis' | 'tools' | 'math' | 'midi' | 'sym' | 'help' | 'keys' | 'theory'>('gen');
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);
    const [infoSheetMode, setInfoSheetMode] = useState<'half' | 'full'>('half');
    const { isAudioUnlocked, handleStartAudio } = useAudioController();

    useEffect(() => {
        (window as any).app = {
            previewIntervalCents: (cents: number, baseHz: number) => {
                const { settings } = useStore.getState();
                const freq = baseHz * Math.pow(2, cents / 1200);

                const node = {
                    id: 'preview-comma',
                    position: new Vector3(),
                    primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
                    ratio: { n: 1n, d: 1n },
                    octave: 0,
                    cents: cents,
                    gen: 0, originLimit: 0, name: 'Preview'
                };

                const root = { ...node, cents: 0, name: 'Root' };
                playSimultaneous(root as NodeData, node as NodeData, { ...settings, baseFrequency: baseHz });
            },
            earPart2: {
                addTargetCommaCents: (cents: number) => {
                    const store = useStore.getState();
                    const currentPart2 = store.earTraining.persisted.part2;
                    if (currentPart2) {
                        const next = { ...currentPart2 };

                        next.settings = {
                            ...next.settings,
                            jnd: {
                                ...next.settings.jnd,
                                startGapCents: cents
                            }
                        };
                        store.setEarTrainingPersistedPart2(next);

                        notifySuccess(`JND start gap set to ${cents.toFixed(2)}¢`, 'Ear Training');
                    } else {
                        log.warn('Ear Training Part 2 not initialized');
                    }
                }
            }
        };

        return () => {
            delete (window as any).app;
        };
    }, []);

    useGlobalKeyHandler({ activeTab });

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedQuery(searchQuery), 160);
        return () => clearTimeout(handle);
    }, [searchQuery]);

    const searchResults = useMemo(() => {
        return searchNodeIndex(nodeSearchIndex, debouncedQuery, 10);
    }, [nodeSearchIndex, debouncedQuery]);

    const getInfoSheetHeights = React.useCallback(() => {
        const h = typeof window !== 'undefined' ? window.innerHeight : 800;
        return {
            half: Math.max(220, Math.round(h * 0.38)),
            full: Math.max(360, Math.round(h * 0.72))
        };
    }, []);

    const applyInfoSheetHeight = React.useCallback((mode: 'half' | 'full') => {
        const heights = getInfoSheetHeights();
        const targetHeight = mode === 'full' ? heights.full : heights.half;
        setPanelState('info', { isCollapsed: false, height: targetHeight });
    }, [getInfoSheetHeights, setPanelState]);

    const infoSummary = useMemo(() => {
        if (!selectedNode) return "No selection";

        const mergedSymbols = { ...settings.notationSymbols };
        if (settings.customPrimes) {
            settings.customPrimes.forEach(cp => {
                if (cp.symbol) mergedSymbols[cp.prime] = cp.symbol;
            });
        }

        const name = getNoteName(selectedNode.primeVector, mergedSymbols, settings.accidentalPlacement);
        return `${name} | ${formatRatio(selectedNode.ratio)} | ${selectedNode.cents.toFixed(2)}c`;
    }, [selectedNode, settings.notationSymbols, settings.customPrimes, settings.accidentalPlacement]);

    useEffect(() => {
        if (!panels.info?.isOpen || panels.info.isCollapsed) return;
        const heights = getInfoSheetHeights();
        const targetHeight = infoSheetMode === 'full' ? heights.full : heights.half;
        if (panels.info.height !== targetHeight) {
            setPanelState('info', { height: targetHeight });
        }
    }, [panels.info?.isOpen, panels.info?.isCollapsed, panels.info?.height, infoSheetMode, getInfoSheetHeights, setPanelState]);

    useEffect(() => {
        if (!menuOpen) return;
        const handlePointer = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('[data-fab-root]')) return;
            setMenuOpen(false);
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        window.addEventListener('pointerdown', handlePointer);
        window.addEventListener('keydown', handleKey);
        return () => {
            window.removeEventListener('pointerdown', handlePointer);
            window.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    const toggleInfoSheetSize = React.useCallback(() => {
        if (!panels.info?.isOpen) return;
        if (panels.info.isCollapsed) {
            applyInfoSheetHeight(infoSheetMode);
            return;
        }
        const next = infoSheetMode === 'half' ? 'full' : 'half';
        setInfoSheetMode(next);
        applyInfoSheetHeight(next);
    }, [panels.info?.isOpen, panels.info?.isCollapsed, infoSheetMode, applyInfoSheetHeight]);

    const infoToggleLabel = panels.info?.isCollapsed
        ? 'Expand'
        : (infoSheetMode === 'half' ? 'Full' : 'Half');

    const nodeSpacing = settings.visuals.globalScale ?? 1;
    const nodeRatioEnabled = !!settings.visuals.nodeSurfaceRatioLabelsEnabled;
    const nodeRatioPlacement = settings.visuals.nodeSurfaceRatioPlacement || 'surface';
    const nodeRatioMode: 'off' | 'surface' | 'above' = nodeRatioEnabled ? nodeRatioPlacement : 'off';

    const gen0Length = useMemo(() => {
        const roots = settings.rootLimits?.length ? settings.rootLimits : [3];
        const primary = roots[0] as PrimeLimit;
        const range = settings.gen0Ranges?.[primary];
        if (range) return Math.max(range.neg, range.pos);
        const perAxis = settings.gen0Lengths?.[primary];
        if (typeof perAxis === 'number') return perAxis;
        return settings.expansionA ?? 12;
    }, [settings.rootLimits, settings.gen0Ranges, settings.gen0Lengths, settings.expansionA]);

    const setNodeRatioMode = (mode: 'off' | 'surface' | 'above') => {
        if (mode === 'off') {
            updateVisualSettings({ nodeSurfaceRatioLabelsEnabled: false });
        } else {
            updateVisualSettings({
                nodeSurfaceRatioLabelsEnabled: true,
                nodeSurfaceRatioPlacement: mode
            });
        }
    };

    const updateGen0Length = (value: number) => {
        const next = Math.max(0, Math.min(1500, Math.round(value)));
        const roots = settings.rootLimits?.length ? settings.rootLimits : [3];
        const nextRanges = { ...(settings.gen0Ranges || {}) };
        const nextLengths = { ...(settings.gen0Lengths || {}) };
        roots.forEach(limit => {
            nextRanges[limit] = { neg: next, pos: next };
            nextLengths[limit] = next;
        });
        updateSettings({ expansionA: next, gen0Ranges: nextRanges, gen0Lengths: nextLengths });
        regenerateLattice(false, true);
    };

    const toggleAR = async () => {

        updateSettings({ isArActive: !settings.isArActive });
    };

    const menuActions = [
        {
            id: 'progression',
            label: 'Sequencer',
            active: panels.progression.isOpen,
            visible: true,
            onClick: () => { toggleProgressionPanel(); setMenuOpen(false); }
        },
        {
            id: 'keyboard',
            label: 'Keyboard',
            active: panels.keyboard.isOpen,
            visible: customKeyboard.length > 0 || savedKeyboards.length > 0,
            onClick: () => { toggleKeyboard(); setMenuOpen(false); }
        },
        {
            id: 'comparison',
            label: `Compare${comparisonNodes.length ? ` (${comparisonNodes.length})` : ''}`,
            active: panels.comparison.isOpen,
            visible: comparisonNodes.length > 0,
            onClick: () => { toggleComparisonTray(); setMenuOpen(false); }
        },
        {
            id: 'midi-device',
            label: 'MIDI Device',
            active: panels['midi-device'].isOpen,
            visible: true,
            onClick: () => { setPanelState('midi-device', { isOpen: !panels['midi-device'].isOpen }); setMenuOpen(false); }
        },
        {
            id: 'workspace',
            label: panels.workspace?.isOpen ? 'Workspace (On)' : 'Workspace',
            active: !!panels.workspace?.isOpen,
            visible: true,
            onClick: () => { setPanelState('workspace', { isOpen: !panels.workspace?.isOpen }); setMenuOpen(false); }
        },
        {
            id: 'ar',
            label: settings.isArActive ? 'AR (On)' : 'AR',
            active: settings.isArActive,
            visible: true,
            onClick: () => { toggleAR(); setMenuOpen(false); }
        },
        {
            id: 'config',
            label: 'Config',
            active: panels.settings.isOpen,
            visible: true,
            onClick: () => { toggleSettings(true); setMenuOpen(false); }
        }
    ].filter(action => action.visible);

    const infoHeaderContent = (
        <div className="flex items-center gap-2 ml-2">
            <div className="hidden sm:flex w-10 h-1 rounded-full bg-gray-700/80" />
            <span className="text-[10px] text-gray-400 truncate max-w-[220px]">{infoSummary}</span>
            <button
                onClick={(e) => { e.stopPropagation(); toggleInfoSheetSize(); }}
                className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[9px] text-gray-300 hover:text-white uppercase font-black tracking-widest"
                title="Toggle details height"
            >
                {infoToggleLabel}
            </button>
        </div>
    );

    const hideMenu = !!(panels.info?.isOpen && !panels.info.isCollapsed && infoSheetMode === 'full');

    const menuButton = (
        <div className="relative pointer-events-auto" data-fab-root>
            <button
                onClick={() => setMenuOpen(v => !v)}
                className={`w-11 h-11 md:w-12 md:h-12 rounded-full border shadow-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${menuOpen ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-900/80 text-gray-200 border-gray-700 hover:bg-gray-800'}`}
                title="Quick Actions"
                aria-expanded={menuOpen}
            >
                {menuOpen ? 'Close' : 'Menu'}
            </button>
            {menuOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 flex flex-col gap-1.5 bg-gray-900/95 border border-gray-700 rounded-2xl p-2 shadow-2xl backdrop-blur z-50">
                    {menuActions.map(action => (
                        <button
                            key={action.id}
                            onClick={action.onClick}
                            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${action.active ? 'bg-gray-800 border-blue-500 text-blue-200' : 'bg-black/40 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'}`}
                        >
                            <span>{action.label}</span>
                            {action.active && <span className="text-[9px] text-blue-300">On</span>}
                        </button>
                    ))}
                    <div className="lg:hidden grid grid-cols-2 gap-1.5 mt-1 pt-1 border-t border-gray-700">
                        <button
                            onClick={undoSelection}
                            disabled={historyIndex <= 0}
                            className="bg-black/40 border border-gray-700 hover:bg-gray-800 disabled:opacity-30 rounded-lg px-2 py-2 text-gray-300 text-[9px] font-black uppercase tracking-wider"
                        >
                            Prev Sel
                        </button>
                        <button
                            onClick={redoSelection}
                            disabled={historyIndex >= selectionHistory.length - 1}
                            className="bg-black/40 border border-gray-700 hover:bg-gray-800 disabled:opacity-30 rounded-lg px-2 py-2 text-gray-300 text-[9px] font-black uppercase tracking-wider"
                        >
                            Next Sel
                        </button>
                        <button
                            onClick={() => updateSettings({ autoCameraFocus: !settings.autoCameraFocus })}
                            className={`col-span-2 px-2 py-2 rounded-lg border text-[9px] font-black uppercase tracking-wider ${settings.autoCameraFocus ? 'bg-blue-900/40 border-blue-500 text-blue-200' : 'bg-black/40 border-gray-700 text-gray-300'}`}
                        >
                            {settings.autoCameraFocus ? "Camera: Auto" : "Camera: Fixed"}
                        </button>
                        <button
                            onClick={togglePureUIMode}
                            className="col-span-2 bg-black/40 border border-gray-700 hover:bg-gray-800 rounded-lg px-2 py-2 text-gray-300 text-[9px] font-black uppercase tracking-wider"
                        >
                            Toggle Pure UI
                        </button>
                    </div>

                    <div className="mt-1 rounded-xl border border-gray-700 bg-black/40 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Gen 0 Length (+/-)</span>
                            <span className="text-[9px] text-blue-200 font-mono">{gen0Length}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1500"
                            step="1"
                            value={gen0Length}
                            onChange={(e) => updateGen0Length(parseInt(e.target.value, 10))}
                            className="w-full h-1.5 accent-blue-500 appearance-none bg-gray-700 rounded cursor-pointer"
                        />
                    </div>
                    <div className="rounded-xl border border-gray-700 bg-black/40 px-3 py-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Node Ratios</span>
                            <span className="text-[9px] text-blue-200 font-mono">{nodeRatioMode}</span>
                        </div>
                        <div className="flex gap-1">
                            {(['off', 'surface', 'above'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setNodeRatioMode(mode)}
                                    className={`flex-1 px-2 py-1 rounded border text-[9px] font-black uppercase tracking-widest transition-colors ${nodeRatioMode === mode ? 'bg-blue-700/60 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                                >
                                    {mode === 'off' ? 'Off' : mode === 'surface' ? 'Surface' : 'Above'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-700 bg-black/40 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest">Node Spacing</span>
                            <span className="text-[9px] text-blue-200 font-mono">{nodeSpacing.toFixed(2)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.2"
                            max="2.5"
                            step="0.05"
                            value={nodeSpacing}
                            onChange={(e) => updateVisualSettings({ globalScale: parseFloat(e.target.value) })}
                            className="w-full h-1.5 accent-blue-500 appearance-none bg-gray-700 rounded cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
    );

    const menuSlot = hideMenu ? null : menuButton;
    const panelFallback = <div className="p-3 text-[10px] text-gray-500">Loading...</div>;
    const playbackVisualizationMode = settings?.playbackVisualizationMode ?? 'SCROLLER';

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden z-10">
            <MidiListener />
            {!isAudioUnlocked && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 pointer-events-auto backdrop-blur-md">
                    <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
                        <h2 className="text-xl font-bold text-white">Audio Setup</h2>
                        <p className="text-sm text-gray-400 text-center max-w-xs">Direct interaction required for Web Audio activation.</p>
                        <button onClick={handleStartAudio} onTouchEnd={(e) => { e.preventDefault(); handleStartAudio(); }} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-xl font-bold text-white shadow-lg transition-transform active:scale-95">TAP TO START</button>
                    </div>
                </div>
            )}

            {earTraining.isActive && (
                <Suspense fallback={null}>
                    <LazyEarTrainingOverlay />
                </Suspense>
            )}

            {!earTraining.isActive && (
                <Suspense fallback={null}>
                    <LazyHunt205RingOverlay />
                </Suspense>
            )}

            {!earTraining.isActive && settings.isSimpleMode ? <SimpleOverlay /> : (!earTraining.isActive && isPureUIMode ? (
                <>
                <Suspense fallback={null}>
                    <LazyRetuneSnapPanel />
                </Suspense>
                <Suspense fallback={null}>
                    <LazyPureRatioHorizontalScoreOverlay />
                </Suspense>
                <div className="absolute bottom-4 right-4 pointer-events-auto flex flex-col gap-2">
                        {retunePreviewActive && (
                            <div className="flex items-center gap-1 rounded-full border border-gray-700 bg-black/70 p-1 shadow-lg">
                                <button
                                    type="button"
                                    onClick={() => updateSettings({ playbackVisualizationMode: 'SCROLLER' })}
                                    className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-colors ${
                                        playbackVisualizationMode === 'SCROLLER'
                                            ? 'bg-emerald-600 text-white'
                                            : 'text-gray-300 hover:text-white'
                                    }`}
                                    title="Show ratio score scroller"
                                >
                                    Scroller
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateSettings({ playbackVisualizationMode: 'HUNT205_RING' })}
                                    className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-colors ${
                                        playbackVisualizationMode === 'HUNT205_RING'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-300 hover:text-white'
                                    }`}
                                    title="Show Hunt205 ring"
                                >
                                    Hunt205 Ring
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={togglePureUIMode}
                            className="w-10 h-10 rounded-full bg-black/70 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 flex items-center justify-center shadow-lg"
                            title="Exit Pure UI"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943-9.543-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        </button>
                    </div>
                </>
            ) : (!earTraining.isActive && (
                <>
                    <div
                        className="w-full px-3 md:px-4 pointer-events-none z-30"
                        style={{ paddingTop: 'max(12px, env(safe-area-inset-top) + 12px)' }}
                    >
                        <TopBar
                            searchResults={searchResults}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            onSearch={() => {
                                const results = searchNodeIndex(nodeSearchIndex, searchQuery, 10);
                                if (results.length > 0) selectNode(results[0]);
                                setSearchQuery("");
                            }}
                            menuSlot={menuSlot}
                        />
                    </div>

                    {panels.settings?.isOpen && (
                        <PanelWindow id="settings">
                            <Suspense fallback={panelFallback}>
                                <LazySettingsPanel
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.info?.isOpen && (
                        <PanelWindow id="info" minHeight={150} collapsedHeight={56} headerContent={infoHeaderContent}>
                            <Suspense fallback={panelFallback}>
                                <LazyInfoPanel />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.keyboard?.isOpen && (
                        <PanelWindow id="keyboard">
                            <Suspense fallback={panelFallback}>
                                <LazyVirtualKeyboard />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.comparison?.isOpen && (
                        <PanelWindow id="comparison">
                            <Suspense fallback={panelFallback}>
                                <LazyComparisonTray />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.progression?.isOpen && (
                        <PanelWindow id="progression">
                            <Suspense fallback={panelFallback}>
                                <LazyProgressionPanel />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.mathlab?.isOpen && (
                        <PanelWindow id="mathlab">
                            <Suspense fallback={panelFallback}>
                                <LazyMathFunctionTab />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.workspace?.isOpen && (
                        <PanelWindow id="workspace" minWidth={560} minHeight={360}>
                            <Suspense fallback={panelFallback}>
                                <LazyWorkspacePanel />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels['midi-device']?.isOpen && (
                        <PanelWindow id="midi-device">
                            <Suspense fallback={panelFallback}>
                                <LazyMidiDevicePanel />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.theory?.isOpen && (
                        <PanelWindow id="theory">
                            <Suspense fallback={panelFallback}>
                                <LazyTheoryOverlay onClose={() => setPanelState('theory', { isOpen: false })} />
                            </Suspense>
                        </PanelWindow>
                    )}

                    {panels.score?.isOpen && (
                        <PanelWindow id="score" minWidth={320} minHeight={360}>
                            <Suspense fallback={panelFallback}>
                                <LazyPureRatioScorePanel isEmbedded />
                            </Suspense>
                        </PanelWindow>
                    )}
                </>
            )))}
        </div>
    );
};
