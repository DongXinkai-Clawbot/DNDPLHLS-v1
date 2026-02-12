import React, { useState } from 'react';
import SetharesExperiment from './sethares/SetharesExperiment';
import RoughnessLandscape from './landscape/RoughnessLandscape';
import JustIntonationTopology from './topology/JustIntonationTopology';

const SetharesEngine = () => {
  const [branch, setBranch] = useState<'classic' | 'terrain' | 'topology'>('classic');

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between border-b border-indigo-500/30 bg-black/70 px-3 py-2">
        <div className="text-[10px] uppercase tracking-widest text-indigo-300 font-black">
          Sethares Engine Hub
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBranch('classic')}
            className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${
              branch === 'classic'
                ? 'bg-indigo-900/60 border-indigo-500 text-white'
                : 'bg-black/50 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Classic Sethares
          </button>
          <button
            type="button"
            onClick={() => setBranch('terrain')}
            className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${
              branch === 'terrain'
                ? 'bg-emerald-900/60 border-emerald-500 text-white'
                : 'bg-black/50 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            Roughness Terrain
          </button>
          <button
            type="button"
            onClick={() => setBranch('topology')}
            className={`px-3 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${
              branch === 'topology'
                ? 'bg-indigo-900/60 border-indigo-400 text-white'
                : 'bg-black/50 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            JI Topology
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {branch === 'classic' ? <SetharesExperiment /> : branch === 'terrain' ? <RoughnessLandscape /> : <JustIntonationTopology />}
      </div>
    </div>
  );
};

export default SetharesEngine;
