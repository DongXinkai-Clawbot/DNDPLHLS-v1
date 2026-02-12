import React, { useMemo, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { useStore } from '../../store';
import { formatRatioForDisplay } from '../../musicLogic';
import type { NodeData, PrimeLimit, PanelId } from '../../types';

import { FullScreenModal } from '../common/FullScreenModal';
import SetharesExperiment from '../setharesEngine/SetharesExperiment';
import { AdaptiveTemperamentSolver } from '../overlays/simple/AdaptiveTemperamentSolver';

export type MobileSettingsTabId =
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
  | 'library';

type MobileControlCenterProps = {
  onOpenPanel: (panel: PanelId) => void;
  onOpenSettingsTab: (tab: MobileSettingsTabId) => void;
  onOpenScore: () => void;
};

type AdvancedToolId = 'sethares' | 'temperament';

const sectionClass = 'bg-black/40 border border-gray-700 rounded-xl p-3 space-y-2';
const sectionTitleClass = 'text-[10px] uppercase font-black tracking-widest text-gray-400';

const buttonBase =
  'min-h-[44px] rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors';

const ghostButton = `${buttonBase} border-gray-700 bg-black/40 text-gray-200`;

export const MobileControlCenter = ({ onOpenPanel, onOpenSettingsTab, onOpenScore }: MobileControlCenterProps) => {
  const {
    settings,
    updateSettings,
    activeMaxPrimeLimit,
    navAxisHorizontal,
    navAxisVertical,
    setNavAxisHorizontal,
    setNavAxisVertical,
    undoSelection,
    redoSelection,
    historyIndex,
    selectionHistoryLen,
    selectNode,
    nodes,
    selectedNode,
    togglePureUIMode,
    isPureUIMode,
    triggerLocate,
    triggerCameraReset,
    toggleIsolationMode,
    isIsolationMode,
    toggleGravity,
    isGravityEnabled,
    showRatioStats,
    setShowRatioStats
  } = useStore(
    (state) => ({
      settings: state.settings,
      updateSettings: state.updateSettings,
      activeMaxPrimeLimit: state.activeMaxPrimeLimit,
      navAxisHorizontal: state.navAxisHorizontal,
      navAxisVertical: state.navAxisVertical,
      setNavAxisHorizontal: state.setNavAxisHorizontal,
      setNavAxisVertical: state.setNavAxisVertical,
      undoSelection: state.undoSelection,
      redoSelection: state.redoSelection,
      historyIndex: state.historyIndex,
      selectionHistoryLen: state.selectionHistory.length,
      selectNode: state.selectNode,
      nodes: state.nodes,
      selectedNode: state.selectedNode,
      togglePureUIMode: state.togglePureUIMode,
      isPureUIMode: state.isPureUIMode,
      triggerLocate: state.triggerLocate,
      triggerCameraReset: state.triggerCameraReset,
      toggleIsolationMode: state.toggleIsolationMode,
      isIsolationMode: state.isIsolationMode,
      toggleGravity: state.toggleGravity,
      isGravityEnabled: state.isGravityEnabled,
      showRatioStats: state.showRatioStats,
      setShowRatioStats: state.setShowRatioStats
    }),
    shallow
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [advancedTool, setAdvancedTool] = useState<AdvancedToolId | null>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const lower = searchQuery.toLowerCase().trim();
    if (lower.length === 0) return [];

    const isNumber = !Number.isNaN(parseFloat(lower)) && !lower.includes('/') && !lower.includes(':');
    const targetCents = isNumber ? parseFloat(lower) : null;

    if (targetCents !== null) {
      const ranked = nodes
        .map((n) => ({ node: n, diff: Math.abs(n.cents - targetCents) }))
        .sort((a, b) => a.diff - b.diff);
      const near = ranked.filter((r) => r.diff < 50);
      const pick = (near.length > 0 ? near : ranked).slice(0, 12);
      return pick.map((r) => r.node);
    }

    const results = nodes.filter((n) => {
      return n.name.toLowerCase().includes(lower) || `${n.ratio.n}/${n.ratio.d}`.includes(lower);
    });
    results.sort((a, b) => a.name.length - b.name.length);
    return results.slice(0, 12);
  }, [searchQuery, nodes]);

  const axisPrimes = useMemo(() => {
    const standardPrimes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const customPrimes = (settings.customPrimes || []).map((cp) => cp.prime);
    let maxPrime = 0;

    nodes.forEach((node) => {
      const vec = node.primeVector as Record<number, number>;
      for (const key in vec) {
        if (!Object.prototype.hasOwnProperty.call(vec, key)) continue;
        const prime = Number(key);
        if (!Number.isFinite(prime)) continue;
        if (vec[prime] === 0) continue;
        if (prime > maxPrime) maxPrime = prime;
      }
    });

    settings.rootLimits?.forEach((p) => {
      const val = Number(p);
      if (Number.isFinite(val) && val > maxPrime) maxPrime = val;
    });

    customPrimes.forEach((p) => {
      if (p > maxPrime) maxPrime = p;
    });

    if (activeMaxPrimeLimit > maxPrime) maxPrime = activeMaxPrimeLimit;

    const list = new Set<number>();
    standardPrimes.forEach((p) => {
      if (p <= maxPrime) list.add(p);
    });
    customPrimes.forEach((p) => list.add(p));
    if (Number.isFinite(navAxisHorizontal)) list.add(navAxisHorizontal);
    if (Number.isFinite(navAxisVertical)) list.add(navAxisVertical);

    return Array.from(list).sort((a, b) => a - b) as PrimeLimit[];
  }, [
    nodes,
    settings.customPrimes,
    settings.rootLimits,
    activeMaxPrimeLimit,
    navAxisHorizontal,
    navAxisVertical
  ]);

  const searchRatioMode = settings.visuals?.ratioDisplay?.contexts?.search || 'fraction';
  const searchAutoPowerDigits = settings.visuals?.ratioDisplay?.autoPowerDigits ?? 14;

  const customSymbols = useMemo(() => {
    if (!settings.customPrimes) return undefined;
    const map: Record<number, string> = {};
    let hasSymbols = false;
    settings.customPrimes.forEach((cp) => {
      if (cp.symbol?.up) {
        map[cp.prime] = cp.symbol.up;
        hasSymbols = true;
      }
    });
    return hasSymbols ? map : undefined;
  }, [settings.customPrimes]);

  const locateOrigin = () => {
    const rootNode = nodes.find((n: NodeData) => {
      const v = n.primeVector as Record<number, number>;
      return [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].every((p) => (v[p] ?? 0) === 0);
    });
    if (rootNode) selectNode(rootNode);
  };

  const handleSearchSelect = (node: NodeData) => {
    selectNode(node);
    setSearchQuery('');
  };

  const SETTINGS_TABS: Array<{ id: MobileSettingsTabId; label: string }> = [
    { id: 'gen', label: 'Lattice' },
    { id: 'audio', label: 'Audio' },
    { id: 'timbre', label: 'Timbre' },
    { id: 'vis', label: 'Visual' },
    { id: 'midi', label: 'MIDI' },
    { id: 'tools', label: 'Tools' },
    { id: 'math', label: 'Math' },
    { id: 'sym', label: 'Symbols' },
    { id: 'keys', label: 'Keys' },
    { id: 'theory', label: 'Theory' },
    { id: 'midiretune', label: 'Retune' },
    { id: 'retuner', label: 'External' },
    { id: 'library', label: 'Library' },
    { id: 'help', label: 'Help' }
  ];

  return (
    <div className="flex flex-col gap-4">
      <FullScreenModal
        isOpen={advancedTool === 'sethares'}
        title="Sethares Engine"
        onClose={() => setAdvancedTool(null)}
      >
        <div className="border border-indigo-500/40 bg-black/40 rounded-xl p-2 shadow-xl">
          <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: 'min(90vh, 1000px)' }}>
            <SetharesExperiment />
          </div>
        </div>
      </FullScreenModal>

      <FullScreenModal
        isOpen={advancedTool === 'temperament'}
        title="Adaptive Temperament Solver"
        onClose={() => setAdvancedTool(null)}
      >
        <AdaptiveTemperamentSolver settings={settings} />
      </FullScreenModal>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Quick Actions</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onOpenScore} className={ghostButton}>
            Score
          </button>
          <button
            type="button"
            onClick={togglePureUIMode}
            className={`${buttonBase} ${
              isPureUIMode
                ? 'bg-blue-700/60 border-blue-500 text-white'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            Pure UI
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ autoCameraFocus: !settings.autoCameraFocus })}
            className={`${buttonBase} ${
              settings.autoCameraFocus
                ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            Camera Auto
          </button>
          <button type="button" onClick={triggerCameraReset} className={ghostButton}>
            Reset Camera
          </button>
          <button
            type="button"
            onClick={triggerLocate}
            disabled={!selectedNode}
            className={`${ghostButton} disabled:opacity-40`}
          >
            Focus Selected
          </button>
          <button type="button" onClick={locateOrigin} className={ghostButton}>
            Origin
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ isArActive: !settings.isArActive })}
            className={`${buttonBase} ${
              settings.isArActive
                ? 'bg-purple-900/40 border-purple-500 text-purple-200'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            AR Mode
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Advanced Tools</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setAdvancedTool('sethares')} className={ghostButton}>
            Sethares
          </button>
          <button type="button" onClick={() => setAdvancedTool('temperament')} className={ghostButton}>
            Temperament
          </button>
        </div>
        <div className="text-[10px] text-gray-500">
          Fullscreen tools are optimized for mobile so complex controls stay readable and stable.
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Search</div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search note, ratio, or cents"
            className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => searchResults[0] && handleSearchSelect(searchResults[0])}
            className="min-h-[44px] rounded-lg border border-blue-700 bg-blue-700/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          >
            Go
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="max-h-48 overflow-y-auto custom-scrollbar rounded-lg border border-gray-800 bg-black/50">
            {searchResults.map((result) => {
              const ratioStr = formatRatioForDisplay(result.ratio, result.primeVector, {
                mode: searchRatioMode,
                autoPowerDigits: searchAutoPowerDigits,
                customSymbols
              });
              return (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSearchSelect(result)}
                  className="w-full text-left px-3 py-2 border-b border-gray-800 last:border-0 hover:bg-white/5"
                >
                  <div className="text-sm font-black text-blue-300 truncate">{ratioStr}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">
                    {result.name || `${result.cents.toFixed(2)}c`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Axes</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">X</span>
            <select
              value={navAxisHorizontal}
              onChange={(e) => setNavAxisHorizontal(parseInt(e.target.value, 10) as PrimeLimit)}
              className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            >
              {axisPrimes.map((prime) => (
                <option key={prime} value={prime}>
                  {prime}L
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-black tracking-widest text-gray-500">Y</span>
            <select
              value={navAxisVertical}
              onChange={(e) => setNavAxisVertical(parseInt(e.target.value, 10) as PrimeLimit)}
              className="bg-black border border-gray-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500"
            >
              {axisPrimes.map((prime) => (
                <option key={prime} value={prime}>
                  {prime}L
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Selection</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={undoSelection}
            disabled={historyIndex <= 0}
            className={`${ghostButton} disabled:opacity-40`}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={redoSelection}
            disabled={historyIndex >= selectionHistoryLen - 1}
            className={`${ghostButton} disabled:opacity-40`}
          >
            Next
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Modes</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => toggleIsolationMode()}
            className={`${buttonBase} ${
              isIsolationMode
                ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            Isolation
          </button>
          <button
            type="button"
            onClick={() => toggleGravity()}
            className={`${buttonBase} ${
              isGravityEnabled
                ? 'bg-rose-900/40 border-rose-500 text-rose-200'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            Gravity
          </button>
          <button
            type="button"
            onClick={() => setShowRatioStats(!showRatioStats)}
            className={`${buttonBase} ${
              showRatioStats
                ? 'bg-indigo-900/40 border-indigo-500 text-indigo-200'
                : 'bg-gray-900 border-gray-700 text-gray-300'
            }`}
          >
            Ratio Stats
          </button>
          <button type="button" onClick={() => onOpenSettingsTab('midiretune')} className={ghostButton}>
            Retune
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Panels</div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onOpenPanel('info')} className={ghostButton}>
            Tuning
          </button>
          <button type="button" onClick={() => onOpenPanel('keyboard')} className={ghostButton}>
            Keyboard
          </button>
          <button type="button" onClick={() => onOpenPanel('comparison')} className={ghostButton}>
            Comparison
          </button>
          <button type="button" onClick={() => onOpenPanel('progression')} className={ghostButton}>
            Sequencer
          </button>
          <button type="button" onClick={() => onOpenPanel('mathlab')} className={ghostButton}>
            Math Lab
          </button>
          <button type="button" onClick={() => onOpenPanel('theory')} className={ghostButton}>
            Theory
          </button>
          <button type="button" onClick={() => onOpenPanel('midi-device')} className={ghostButton}>
            MIDI Device
          </button>
          <button type="button" onClick={() => onOpenPanel('settings')} className={ghostButton}>
            Settings
          </button>
        </div>
      </div>

      <div className={sectionClass}>
        <div className={sectionTitleClass}>Settings Tabs</div>
        <div className="grid grid-cols-2 gap-2">
          {SETTINGS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenSettingsTab(t.id)}
              className={ghostButton}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
