
import React, { useState } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { PrimeLimit } from '../../../types';
import { SimpleCommaSearch } from './SimpleCommaSearch';
import { ConfirmDialog } from '../ConfirmDialog';

export const SimpleManualConfig = () => {
  const {
    settings,
    updateSettings,
    regenerateLattice,
    isGenerating,
    exitToSetup
  } = useStore((s) => ({
    settings: s.settings,
    updateSettings: s.updateSettings,
    regenerateLattice: s.regenerateLattice,
    isGenerating: s.isGenerating,
    exitToSetup: s.exitToSetup
  }), shallow);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const requestExit = () => setShowExitConfirm(true);
  const performExit = () => exitToSetup('advanced');

  const toggleRoot = (limit: PrimeLimit) => {
      const current = new Set(settings.rootLimits);
      if (current.has(limit)) {
          if (current.size > 1) current.delete(limit);
      } else {
          current.add(limit);
      }
      
      const next = Array.from(current).sort((a, b) => (a as number) - (b as number)) as PrimeLimit[];
      
      updateSettings({ 
          rootLimits: next, 
          maxPrimeLimit: Math.max(...next, settings.maxPrimeLimit) as PrimeLimit 
      });
  };

  const handleExpansionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      
      updateSettings({ 
          expansionA: val, 
          gen0Lengths: { 3: val, 5: val, 7: val, 11: val, 13: val, 17: val, 19: val, 23: val, 29: val, 31: val }, 
          gen0Ranges: {} 
      });
  };

  const handleBranchingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      
      const newLengths = { ...settings.gen1Lengths };
      const limits = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as PrimeLimit[];
      
      limits.forEach(l => {
          
          if (settings.expansionB === 0) {
             if (settings.rootLimits.includes(l)) newLengths[l] = val;
          } else {
             if ((newLengths[l] || 0) > 0) newLengths[l] = val;
          }
      });

      updateSettings({ 
          expansionB: val, 
          gen1Lengths: newLengths, 
          gen1Ranges: {} 
      });
  };

  const toggleBranch = (limit: PrimeLimit) => {
      const currentLen = settings.gen1Lengths[limit] || 0;
      const targetLen = currentLen > 0 ? 0 : (settings.expansionB || 1);
      
      const newLengths = { ...settings.gen1Lengths, [limit]: targetLen };
      
      const newExpB = (targetLen > 0 && settings.expansionB === 0) ? 1 : settings.expansionB;

      updateSettings({ 
          gen1Lengths: newLengths,
          expansionB: newExpB
      });
  };

  return (
      <div className="pointer-events-auto bg-black/80 backdrop-blur border border-gray-700 rounded-xl p-4 w-72 shadow-xl absolute top-20 right-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
           <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Lattice Config</h3>
           
           <div className="space-y-4">
               <div>
                   <label className="text-[10px] text-gray-400 font-bold block mb-2">Active Dimensions (Roots)</label>
                   <div className="flex gap-2">
                       {[3, 5, 7].map(num => {
                           const l = num as PrimeLimit;
                           const isActive = settings.rootLimits.includes(l);
                           return (
                               <button 
                                  key={l}
                                  onClick={() => toggleRoot(l)}
                                  className={`flex-1 py-2 rounded text-xs font-bold border ${isActive ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}
                               >
                                   {l}-Limit
                               </button>
                           );
                       })}
                   </div>
               </div>

               <div>
                   <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                       <span>Expansion Size</span>
                       <span className="text-white">{settings.expansionA}</span>
                   </div>
                   <input 
                      type="range" min="1" max="20" step="1" 
                      value={settings.expansionA}
                      onChange={handleExpansionChange}
                      className="w-full h-1 accent-blue-500 bg-gray-700 rounded appearance-none"
                   />
               </div>

               <div>
                   <div className="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                       <span>Branching Depth</span>
                       <span className="text-white">{settings.expansionB}</span>
                   </div>
                   <input 
                      type="range" min="0" max="5" step="1" 
                      value={settings.expansionB}
                      onChange={handleBranchingChange}
                      className="w-full h-1 accent-green-500 bg-gray-700 rounded appearance-none"
                   />
                   
                   <label className="text-[9px] text-gray-500 font-bold block mt-2 mb-1">Allowed Sub-Branches</label>
                   <div className="flex gap-1">
                       {[3, 5, 7].map(num => {
                           const l = num as PrimeLimit;
                           const isEnabled = (settings.gen1Lengths[l] || 0) > 0;
                           return (
                               <button 
                                  key={l}
                                  onClick={() => toggleBranch(l)}
                                  disabled={settings.expansionB === 0}
                                  className={`flex-1 py-1 rounded text-[9px] font-bold border transition-colors ${
                                      settings.expansionB === 0 ? 'opacity-30 cursor-not-allowed border-gray-700 text-gray-600' :
                                      isEnabled ? 'bg-green-900/50 border-green-500 text-green-200' : 'bg-gray-800 border-gray-600 text-gray-500'
                                  }`}
                               >
                                   {l}L
                               </button>
                           );
                       })}
                   </div>
               </div>

               <button 
                  onClick={() => regenerateLattice(false)}
                  disabled={isGenerating}
                  className="w-full bg-white text-black font-bold text-xs py-2 rounded-lg hover:bg-gray-200 disabled:opacity-50"
               >
                  {isGenerating ? 'Updating...' : 'Regenerate Lattice'}
               </button>

               <div className="pt-2 border-t border-gray-800">
                    <button 
                        onClick={requestExit}
                        className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-400 text-[10px] font-bold rounded uppercase tracking-widest transition-all"
                    >
                        Exit to Setup
                    </button>
               </div>

               <SimpleCommaSearch />
           </div>

           <ConfirmDialog
              open={showExitConfirm}
              title="Exit to Setup"
              message={"Are you sure you want to exit to the setup screen?\nCurrent progress in Simple Mode will be lost."}
              danger
              confirmText="Exit"
              cancelText="Cancel"
              onCancel={() => setShowExitConfirm(false)}
              onConfirm={() => {
                setShowExitConfirm(false);
                performExit();
              }}
            />
      </div>
  );
};
