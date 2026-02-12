
import React from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import { formatRatioForDisplay } from '../../musicLogic';
import type { PrimeLimit, NodeData } from '../../types';

export const TopBar = ({ searchResults, searchQuery, setSearchQuery, onSearch, menuSlot }: any) => {
  const {
    settings,
    updateSettings,
    settingsHistory,
    settingsFuture,
    undoSettings,
    redoSettings,
    activeMaxPrimeLimit,
    nodes,
    undoSelection,
    redoSelection,
    historyIndex,
    selectionHistory,
    selectNode,
    resetHarmonicCenter,
    navAxisHorizontal,
    navAxisVertical,
    setNavAxisHorizontal,
    setNavAxisVertical,
    comparisonNodes,
    isComparisonVisible,
    toggleComparisonTray,
    savedKeyboards,
    isKeyboardVisible,
    toggleKeyboard,
    customKeyboard,
    togglePureUIMode
  } = useStore((s) => ({
    settings: s.settings,
    updateSettings: s.updateSettings,
    settingsHistory: s.settingsHistory,
    settingsFuture: s.settingsFuture,
    undoSettings: s.undoSettings,
    redoSettings: s.redoSettings,
    activeMaxPrimeLimit: s.activeMaxPrimeLimit,
    nodes: s.nodes,
    undoSelection: s.undoSelection,
    redoSelection: s.redoSelection,
    historyIndex: s.historyIndex,
    selectionHistory: s.selectionHistory,
    selectNode: s.selectNode,
    resetHarmonicCenter: s.resetHarmonicCenter,
    navAxisHorizontal: s.navAxisHorizontal,
    navAxisVertical: s.navAxisVertical,
    setNavAxisHorizontal: s.setNavAxisHorizontal,
    setNavAxisVertical: s.setNavAxisVertical,
    comparisonNodes: s.comparisonNodes,
    isComparisonVisible: s.isComparisonVisible,
    toggleComparisonTray: s.toggleComparisonTray,
    savedKeyboards: s.savedKeyboards,
    isKeyboardVisible: s.isKeyboardVisible,
    toggleKeyboard: s.toggleKeyboard,
    customKeyboard: s.customKeyboard,
    togglePureUIMode: s.togglePureUIMode
  }), shallow);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [searchListMaxHeight, setSearchListMaxHeight] = React.useState(260);

  React.useEffect(() => {
    const calcMaxHeight = () => {
      if (typeof window === 'undefined') return;
      const rowHeight = 56;
      const available = Math.max(180, Math.floor(window.innerHeight * 0.4));
      const rows = Math.min(5, Math.max(3, Math.floor(available / rowHeight)));
      setSearchListMaxHeight(rows * rowHeight);
    };
    calcMaxHeight();
    window.addEventListener('resize', calcMaxHeight);
    return () => window.removeEventListener('resize', calcMaxHeight);
  }, []);

  const locateOriginalLine = () => {
    const rootNode = nodes.find((n: any) => {
      const v = n.primeVector || {};
      return v[3] === 0 && v[5] === 0 && v[7] === 0 && v[11] === 0 && v[13] === 0 && v[17] === 0 && v[19] === 0 && v[23] === 0 && v[29] === 0 && v[31] === 0;
    });
    if (rootNode) selectNode(rootNode);
  };

  const axisPrimes = React.useMemo(() => {
    const standardPrimes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const customPrimes = (settings.customPrimes || []).map(cp => cp.prime);
    let maxPrime = 0;

    nodes.forEach((node: NodeData) => {
      const vec = node.primeVector as Record<number, number>;
      for (const key in vec) {
        if (!Object.prototype.hasOwnProperty.call(vec, key)) continue;
        const prime = Number(key);
        if (!Number.isFinite(prime)) continue;
        if (vec[prime] === 0) continue;
        if (prime > maxPrime) maxPrime = prime;
      }
    });

    settings.rootLimits?.forEach((p: PrimeLimit) => {
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
  }, [nodes, settings.customPrimes, settings.rootLimits, activeMaxPrimeLimit, navAxisHorizontal, navAxisVertical]);

  const isTransposed = Object.values(settings?.transpositionVector ?? {}).some(val => val !== 0);

  const displayedNodeCount = React.useMemo(() => {
    if (settings.visuals.layoutMode === 'diamond') {
      const limit = settings.visuals.diamondLimit || 7;
      return nodes.filter(node => {
        let n = node.ratio.n;
        let d = node.ratio.d;
        while (n % 2n === 0n) n /= 2n;
        while (d % 2n === 0n) d /= 2n;
        const N = Number(n);
        const D = Number(d);
        if (N > limit || D > limit) return false;

        const oddNumbers = [];
        for (let i = 1; i <= limit; i += 2) oddNumbers.push(i);
        return oddNumbers.includes(N) && oddNumbers.includes(D);
      }).length;
    }
    if (settings.visuals.layoutMode === 'h-chroma') {
      return Math.max(0, Math.floor(settings.visuals.hChromaLimit || 47));
    }
    return nodes.length;
  }, [nodes, settings.visuals.layoutMode, settings.visuals.diamondLimit, settings.visuals.hChromaLimit]);

  const titleText = 'Dynamic N-Dimensional Prime-Limit Harmonic Lattice & Synthesizer';
  const limitLabel = settings.visuals.layoutMode === 'diamond'
    ? `${settings.visuals.diamondLimit || 7}-limit Tonality Diamond`
    : settings.visuals.layoutMode === 'h-chroma'
      ? `H-Chroma (≤ ${settings.visuals.hChromaLimit || 47})`
      : `${activeMaxPrimeLimit}-limit`;
  const searchRatioMode = settings.visuals?.ratioDisplay?.contexts?.search || 'fraction';
  const searchAutoPowerDigits = settings.visuals?.ratioDisplay?.autoPowerDigits ?? 14;

  const customSymbols = React.useMemo(() => {
    if (!settings.customPrimes) return undefined;
    const map: Record<number, string> = {};
    settings.customPrimes.forEach(cp => {
      if (cp.symbol?.up) {
        map[cp.prime] = cp.symbol.up;
      }
    });
    return map;
  }, [settings.customPrimes]);

  return (
    <div className="flex flex-col gap-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center justify-between gap-2 lg:contents">
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <button
              onClick={() => setStatusOpen(v => !v)}
              className="bg-black/60 px-3 py-2 rounded-2xl border border-white/10 backdrop-blur shadow-2xl text-left flex items-center gap-3 w-full lg:w-auto"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] md:text-xs font-black text-gray-200 uppercase tracking-tight leading-snug whitespace-normal break-words">
                  {titleText}
                </span>
                <span className="text-[10px] md:text-xs text-gray-300 font-black uppercase tracking-widest">
                  {limitLabel}
                </span>
              </div>
              <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest whitespace-nowrap">
                {statusOpen ? "Hide" : "Status"}
              </span>
            </button>
          </div>
          <div className="lg:hidden shrink-0">
            {menuSlot}
          </div>
        </div>

        <div className="hidden lg:flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 shadow-lg">
            <button
              onClick={undoSelection}
              disabled={historyIndex <= 0}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs font-black transition-all active:scale-90"
            >
              Prev
            </button>
            <button
              onClick={redoSelection}
              disabled={historyIndex >= selectionHistory.length - 1}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs font-black transition-all active:scale-90"
            >
              Next
            </button>
            <span className="text-[9px] text-gray-500 uppercase font-black px-1.5 self-center tracking-widest hidden md:inline">Selection</span>
          </div>

          <button
            onClick={() => updateSettings({ autoCameraFocus: !settings.autoCameraFocus })}
            className={`text-[10px] md:text-xs px-3 py-2 rounded-xl border font-black transition-all active:scale-95 shadow-md uppercase tracking-wider ${settings.autoCameraFocus ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
          >
            {settings.autoCameraFocus ? "View: Auto" : "View: Fixed"}
          </button>

          <button
            onClick={locateOriginalLine}
            className="text-[10px] md:text-xs bg-blue-700/50 hover:bg-blue-600 text-white px-3 py-2 rounded-xl border border-blue-500/50 font-black uppercase transition-all active:scale-95 shadow-lg"
          >
            Origin
          </button>

          <button
            onClick={togglePureUIMode}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-[10px] md:text-xs font-black transition-all active:scale-95 shadow-lg uppercase tracking-wider"
          >
            Pure
          </button>
          <div className="hidden lg:block">
            {menuSlot}
          </div>
        </div>

        <div className="relative flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="bg-black/80 backdrop-blur border border-white/10 px-3 py-2 rounded-2xl flex gap-2 sm:gap-4 shadow-2xl items-center justify-center sm:justify-start">
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">X</span>
              <select
                value={navAxisHorizontal}
                onChange={(e) => setNavAxisHorizontal(parseInt(e.target.value) as PrimeLimit)}
                className="bg-gray-800 text-[10px] md:text-xs font-black text-blue-400 border border-gray-700 rounded-lg outline-none px-2 py-1 transition-colors hover:bg-gray-700"
              >
                {axisPrimes.map(p => <option key={p} value={p}>{p}L</option>)}
              </select>
            </div>
            <div className="w-px h-8 bg-gray-700/50"></div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] text-gray-500 uppercase font-black tracking-widest mb-1">Y</span>
              <select
                value={navAxisVertical}
                onChange={(e) => setNavAxisVertical(parseInt(e.target.value) as PrimeLimit)}
                className="bg-gray-800 text-[10px] md:text-xs font-black text-green-400 border border-gray-700 rounded-lg outline-none px-2 py-1 transition-colors hover:bg-gray-700"
              >
                {axisPrimes.map(p => <option key={p} value={p}>{p}L</option>)}
              </select>
            </div>
          </div>

          <div className="relative flex shadow-2xl rounded-2xl group flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Search note or ratio..."
              className="bg-black/80 border border-gray-700 border-r-0 text-white px-4 py-2.5 w-full focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm backdrop-blur transition-all rounded-l-2xl"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
            />
            <button
              onClick={onSearch}
              className="bg-blue-700 hover:bg-blue-600 text-white px-5 py-2.5 rounded-r-2xl border border-gray-700 border-l-0 font-black text-xs transition-all active:scale-95 uppercase tracking-widest"
            >
              Go
            </button>

            {searchResults.length > 0 && (
              <div
                className="absolute top-full mt-2 w-full min-w-[300px] bg-black/95 border border-gray-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-y-auto custom-scrollbar backdrop-blur-xl z-50"
                style={{ maxHeight: searchListMaxHeight }}
              >
                {searchResults.map((res: any) => (
                  (() => {
                    const ratioStr = formatRatioForDisplay(res.ratio, res.primeVector, { mode: searchRatioMode, autoPowerDigits: searchAutoPowerDigits, customSymbols });
                    return (
                      <button
                        key={res.id}
                        className="block w-full text-left px-4 py-3.5 hover:bg-white/5 border-b border-white/5 last:border-0 flex items-center gap-3 transition-all group/res"
                        onClick={() => {
                          selectNode(res);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-black text-blue-400 text-lg group-hover/res:text-white transition-colors truncate" title={res.name || ratioStr}>
                            {ratioStr}
                          </span>
                          {res.name && (
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">
                              {res.name}
                            </span>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 font-mono">
                            <span className="px-1.5 py-0.5 rounded border border-white/10 bg-gray-900/60">G{res.gen ?? '-'}</span>
                            <span className="px-1.5 py-0.5 rounded border border-white/10 bg-gray-900/60">{res.cents.toFixed(2)}c</span>
                            <span className="px-1.5 py-0.5 rounded border border-white/10 bg-gray-900/60">{ratioStr}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {statusOpen && (
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 bg-black/70 border border-white/10 rounded-xl px-3 py-2">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Nodes: {displayedNodeCount}</span>
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Axes: {navAxisHorizontal}L / {navAxisVertical}L</span>
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Layout: {settings.visuals.layoutMode}</span>
          {isTransposed && (
            <span className="text-[10px] text-yellow-400 uppercase font-black tracking-widest">Transposed</span>
          )}
          <div className="flex gap-1.5 bg-blue-900/20 p-1.5 rounded-xl border border-blue-900/30 shadow-lg">
            <button
              onClick={undoSettings}
              disabled={settingsHistory.length === 0}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs font-black transition-all active:scale-90"
            >
              Undo Config
            </button>
            <button
              onClick={redoSettings}
              disabled={settingsFuture.length === 0}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 disabled:hover:bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs font-black transition-all active:scale-90"
            >
              Redo Config
            </button>
          </div>
        </div>
      )}
    </div>
  );

};
