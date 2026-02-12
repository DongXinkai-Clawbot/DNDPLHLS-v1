import React from 'react';

type HeaderBarProps = {
  advancedModeEnabled: boolean;
  onToggleMode: () => void;
  onCalculate: () => void;
};

export const HeaderBar: React.FC<HeaderBarProps> = ({ advancedModeEnabled, onToggleMode, onCalculate }) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">HARMONIA UNIVERSALIS</div>
      <div className="text-white text-lg font-black tracking-tight">The Adaptive Temperament Solver</div>
      <div className="text-[11px] text-gray-400 font-mono">Advanced: Powered by Golden Section Search & Minimax Algorithms</div>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onToggleMode}
        className="bg-gray-900 hover:bg-gray-800 text-amber-300 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border border-amber-500/40 shadow-lg"
      >
        {advancedModeEnabled ? 'Classic Mode' : 'Advanced Mode'}
      </button>
      <button onClick={onCalculate} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest border border-indigo-300/30 shadow-lg active:scale-95">Calculate</button>
    </div>
  </div>
);
