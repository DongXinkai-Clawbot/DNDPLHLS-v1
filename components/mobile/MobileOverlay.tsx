import React, { useCallback, useMemo, useState, Suspense } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import type { PanelId } from '../../types';
import { SimpleOverlay } from '../overlays/SimpleOverlay';
import { MobileDrawer } from './MobileDrawer';
import { MobileNavBar, MobileNavItemId } from './MobileNavBar';
import { MobileControlCenter, MobileSettingsTabId } from './MobileControlCenter';
import { useAudioController } from '../../hooks/useAudioController';
import { useGlobalKeyHandler } from '../../hooks/useGlobalKeyHandler';
import { useMidiSystem } from '../../hooks/useMidiSystem';
import { PanelWindow } from '../common/PanelWindow';

type MobilePanelKey = PanelId | 'tools';

const PANEL_TITLES: Partial<Record<MobilePanelKey, string>> = {
  settings: 'Config',
  info: 'Tuning',
  keyboard: 'Keyboard',
  comparison: 'Compare',
  progression: 'Sequencer',
  theory: 'Theory Guide',
  mathlab: 'Math Lab',
  'midi-device': 'MIDI Device',
  workspace: 'Workspace',
  tools: 'Control Center'
};

const LazySettingsPanel = React.lazy(() => import('../overlays/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const LazyVirtualKeyboard = React.lazy(() => import('../overlays/VirtualKeyboard').then(m => ({ default: m.VirtualKeyboard })));
const LazyInfoPanel = React.lazy(() => import('../overlays/InfoPanel').then(m => ({ default: m.InfoPanel })));
const LazyComparisonTray = React.lazy(() => import('../overlays/ComparisonTray').then(m => ({ default: m.ComparisonTray })));
const LazyProgressionPanel = React.lazy(() => import('../overlays/ProgressionPanel').then(m => ({ default: m.ProgressionPanel })));
const LazyMathFunctionTab = React.lazy(() => import('../overlays/math/MathFunctionTab').then(m => ({ default: m.MathFunctionTab })));
const LazyTheoryOverlay = React.lazy(() => import('../overlays/TheoryOverlay').then(m => ({ default: m.TheoryOverlay })));
const LazyEarTrainingOverlay = React.lazy(() => import('../overlays/ear/EarTrainingOverlay').then(m => ({ default: m.EarTrainingOverlay })));
const LazyRetuneSnapPanel = React.lazy(() => import('../overlays/RetuneSnapPanel').then(m => ({ default: m.RetuneSnapPanel })));
const LazyMidiDevicePanel = React.lazy(() => import('../midi/MidiDevicePanel').then(m => ({ default: m.MidiDevicePanel })));
const LazyPureRatioScorePanel = React.lazy(() => import('../overlays/PureRatioScorePanel').then(m => ({ default: m.PureRatioScorePanel })));
const LazyPureRatioHorizontalScoreOverlay = React.lazy(() => import('../overlays/PureRatioHorizontalScoreOverlay').then(m => ({ default: m.PureRatioHorizontalScoreOverlay })));
const LazyHunt205RingOverlay = React.lazy(() => import('../overlays/Hunt205RingOverlay').then(m => ({ default: m.Hunt205RingOverlay })));

export const MobileOverlay = () => {
  const {
    settings,
    panels,
    isPureUIMode,
    togglePureUIMode,
    toggleSettings,
    toggleKeyboard,
    toggleNodeInfo,
    toggleComparisonTray,
    toggleProgressionPanel,
    retunePreviewActive,
    setPanelState,
    focusPanel,
    earTraining
  } = useStore((s) => ({
    settings: s.settings,
    panels: s.panels,
    isPureUIMode: s.isPureUIMode,
    togglePureUIMode: s.togglePureUIMode,
    toggleSettings: s.toggleSettings,
    toggleKeyboard: s.toggleKeyboard,
    toggleNodeInfo: s.toggleNodeInfo,
    toggleComparisonTray: s.toggleComparisonTray,
    toggleProgressionPanel: s.toggleProgressionPanel,
    setPanelState: s.setPanelState,
    focusPanel: s.focusPanel,
    earTraining: s.earTraining,
    retunePreviewActive: s.midiRetuner?.retunePreviewActive ?? false
  }), shallow);

  const [activeTab, setActiveTab] = useState<
    | 'gen'
    | 'audio'
    | 'timbre'
    | 'vis'
    | 'tools'
    | 'math'
    | 'midi'
    | 'sym'
    | 'help'
    | 'keys'
    | 'theory'
    | 'midiretune'
    | 'retuner'
    | 'library'
  >('gen');
  const [activePanel, setActivePanel] = useState<MobilePanelKey | null>(null);
  const { isAudioUnlocked, handleStartAudio } = useAudioController();

  useMidiSystem();
  useGlobalKeyHandler({ activeTab, isEnabled: false });

  const closeAllPanels = useCallback(() => {
    if (panels.settings?.isOpen) toggleSettings(false);
    if (panels.keyboard?.isOpen) toggleKeyboard(false);
    if (panels.info?.isOpen) toggleNodeInfo(false);
    if (panels.comparison?.isOpen) toggleComparisonTray();
    if (panels.progression?.isOpen) toggleProgressionPanel();
    if (panels.mathlab?.isOpen) setPanelState('mathlab', { isOpen: false });
    if (panels.workspace?.isOpen) setPanelState('workspace', { isOpen: false });
    if (panels.theory?.isOpen) setPanelState('theory', { isOpen: false });
    if (panels['midi-device']?.isOpen) setPanelState('midi-device', { isOpen: false });
    if (panels.score?.isOpen) setPanelState('score', { isOpen: false });
  }, [
    panels,
    setPanelState,
    toggleComparisonTray,
    toggleKeyboard,
    toggleNodeInfo,
    toggleProgressionPanel,
    toggleSettings
  ]);

  const openPanel = useCallback(
    (panel: MobilePanelKey) => {
      closeAllPanels();
      switch (panel) {
        case 'settings':
          toggleSettings(true);
          break;
        case 'keyboard':
          toggleKeyboard(true);
          break;
        case 'info':
          toggleNodeInfo(true);
          break;
        case 'comparison':
          toggleComparisonTray();
          break;
        case 'progression':
          toggleProgressionPanel();
          break;
        case 'mathlab':
          setPanelState('mathlab', { isOpen: true });
          break;
        case 'theory':
          setPanelState('theory', { isOpen: true });
          break;
        case 'midi-device':
          setPanelState('midi-device', { isOpen: true });
          break;
        case 'score':
          setPanelState('score', { isOpen: true });
          break;
        case 'tools':
          break;
      }
      setActivePanel(panel);
    },
    [
      closeAllPanels,
      setPanelState,
      toggleComparisonTray,
      toggleKeyboard,
      toggleNodeInfo,
      toggleProgressionPanel,
      toggleSettings
    ]
  );

  const toggleScorePanel = useCallback(() => {
    openPanel('score');
  }, [openPanel]);

  const handleCloseDrawer = useCallback(() => {
    setActivePanel(null);
    closeAllPanels();
  }, [closeAllPanels]);

  const openSettingsTab = useCallback(
    (tab: MobileSettingsTabId) => {
      setActiveTab(tab);
      openPanel('settings');
    },
    [openPanel]
  );

  const activeNav = useMemo<MobileNavItemId | null>(() => {
    if (!activePanel) return null;
    if (activePanel === 'settings') return 'settings';
    if (activePanel === 'keyboard') return 'keyboard';
    if (activePanel === 'info') return 'tuning';
    return 'tools';
  }, [activePanel]);

  const playbackVisualizationMode = settings?.playbackVisualizationMode ?? 'SCROLLER';

  const drawerTitle = activePanel ? (
    activePanel === 'score' ? 'Score' : (PANEL_TITLES[activePanel] ?? '')
  ) : '';
  const panelFallback = <div className="p-4 text-[10px] text-gray-500">Loading...</div>;

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'settings':
        return (
          <Suspense fallback={panelFallback}>
            <LazySettingsPanel activeTab={activeTab} setActiveTab={setActiveTab} />
          </Suspense>
        );
      case 'keyboard':
        return (
          <Suspense fallback={panelFallback}>
            <LazyVirtualKeyboard />
          </Suspense>
        );
      case 'info':
        return (
          <Suspense fallback={panelFallback}>
            <LazyInfoPanel />
          </Suspense>
        );
      case 'comparison':
        return (
          <Suspense fallback={panelFallback}>
            <LazyComparisonTray />
          </Suspense>
        );
      case 'progression':
        return (
          <Suspense fallback={panelFallback}>
            <LazyProgressionPanel />
          </Suspense>
        );
      case 'mathlab':
        return (
          <Suspense fallback={panelFallback}>
            <LazyMathFunctionTab />
          </Suspense>
        );
      case 'theory':
        return (
          <Suspense fallback={panelFallback}>
            <LazyTheoryOverlay onClose={handleCloseDrawer} />
          </Suspense>
        );
      case 'midi-device':
        return (
          <Suspense fallback={panelFallback}>
            <LazyMidiDevicePanel />
          </Suspense>
        );
      case 'score':
        return (
          <Suspense fallback={panelFallback}>
            <LazyPureRatioScorePanel onClose={handleCloseDrawer} isCompact />
          </Suspense>
        );
      case 'tools':
        return (
          <MobileControlCenter
            onOpenPanel={openPanel}
            onOpenSettingsTab={openSettingsTab}
            onOpenScore={toggleScorePanel}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between overflow-hidden z-10">
      {!isAudioUnlocked && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 pointer-events-auto backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
            <h2 className="text-xl font-bold text-white">Audio Setup</h2>
            <p className="text-sm text-gray-400 text-center max-w-xs">Direct interaction required for Web Audio activation.</p>
            <button
              onClick={handleStartAudio}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleStartAudio();
              }}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-xl font-bold text-white shadow-lg transition-transform active:scale-95"
            >
              TAP TO START
            </button>
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

      {!earTraining.isActive && settings.isSimpleMode ? (
        <SimpleOverlay />
      ) : (
        !earTraining.isActive &&
        (isPureUIMode ? (
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
                    onClick={() => useStore.getState().updateSettings({ playbackVisualizationMode: 'SCROLLER' })}
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
                    onClick={() => useStore.getState().updateSettings({ playbackVisualizationMode: 'HUNT205_RING' })}
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
                onClick={togglePureUIMode}
                className="bg-black/60 backdrop-blur-md border border-white/20 p-3 rounded-full text-white/40 transition-all shadow-xl active:scale-90"
                title="Restore UI"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943-9.543-7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <MobileNavBar
              active={activeNav}
              onSelect={(id) => {
                if (id === 'settings') openPanel('settings');
                if (id === 'keyboard') openPanel('keyboard');
                if (id === 'tuning') openPanel('info');
                if (id === 'tools') openPanel('tools');
              }}
            />
            <div className="pointer-events-auto">
              <MobileDrawer isOpen={!!activePanel} onClose={handleCloseDrawer} title={drawerTitle}>
                {renderPanelContent()}
              </MobileDrawer>
            </div>
          </>
        ))
      )}
    </div>
  );
};
