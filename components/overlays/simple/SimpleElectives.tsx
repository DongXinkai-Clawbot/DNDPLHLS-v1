
import React from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';

export const SimpleElectives = ({ onExit }: { onExit: () => void }) => {
  const {
    updateSettings,
    regenerateLattice,
    selectNode,
    nodes,
    settings,
    setCommaLines,
    clearComparison,
    updateVisualSettings
  } = useStore((s) => ({
    updateSettings: s.updateSettings,
    regenerateLattice: s.regenerateLattice,
    selectNode: s.selectNode,
    nodes: s.nodes,
    settings: s.settings,
    setCommaLines: s.setCommaLines,
    clearComparison: s.clearComparison,
    updateVisualSettings: s.updateVisualSettings
  }), shallow);
  const loadModule = (module: string) => {
      if (module === 'diesis') {
           clearComparison();
           updateSettings({ 
              maxPrimeLimit: 5,
              rootLimits: [5], 
              gen0Lengths: { 5: 3, 3:0, 7:0, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0 }, 
              gen0Ranges: { 5: { neg: 0, pos: 3 } },
              expansionB: 0,
              visuals: { ...settings.visuals, spiralFactor: 0 }
          });
          regenerateLattice(false);
          setTimeout(() => {
              const topThird = nodes.find(n => n.primeVector[5] === 3);
              const root = nodes.find(n => n.gen === 0 && n.originLimit === 0);
              if (topThird && root) {
                  selectNode(topThird);
                  setCommaLines([{ sourceId: topThird.id, targetId: root.id, name: "Diesis Gap (41¢)" }]);
              }
          }, 200);
      } else if (module === 'standard') {
          updateSettings({ 
              rootLimits: [3, 5], 
              maxPrimeLimit: 5,
              expansionA: 6, 
              expansionB: 2,
              expansionC: 0,
              gen0Lengths: {} as any, gen0Ranges: {}, gen1Lengths: {} as any, gen1Ranges: {},
              axisLooping: { 3: null, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
              visuals: { ...settings.visuals, spiralFactor: 0 }
          });
          regenerateLattice(false);
          setCommaLines([]);
      }
      onExit();
  };

  return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto z-50">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-white uppercase tracking-wider">Learning Modules</h2>
                  <button onClick={onExit} className="text-gray-500 hover:text-white">✕</button>
              </div>
              <div className="space-y-3">
                   <button onClick={() => loadModule('standard')} className="w-full text-left p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all group">
                      <h4 className="font-bold text-white group-hover:text-blue-400">Standard 5-Limit Field</h4>
                      <p className="text-xs text-gray-500 mt-1">Reset to the classic Just Intonation grid.</p>
                  </button>
                  <button onClick={() => loadModule('diesis')} className="w-full text-left p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-all group">
                      <h4 className="font-bold text-white group-hover:text-red-400">The Great Diesis</h4>
                      <p className="text-xs text-gray-500 mt-1">Visualize the vertical gap between 3 Major Thirds and an Octave.</p>
                  </button>
              </div>
          </div>
      </div>
  );
};
