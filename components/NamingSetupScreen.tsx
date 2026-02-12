import React, { useState } from 'react';
import { shallow } from 'zustand/shallow';
import { DEFAULT_SETTINGS } from '../constants';
import { useStore } from '../store';
import { SymTab } from './overlays/settingsTabsPart2/SymTab';

type NamingSetupScreenProps = {
  onClose: () => void;
};

export const NamingSetupScreen = ({ onClose }: NamingSetupScreenProps) => {
  const { settings, updateSettings, setNamingSetupOpen } = useStore(
    (s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
      setNamingSetupOpen: s.setNamingSetupOpen
    }),
    shallow
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const visuals = settings.visuals || DEFAULT_SETTINGS.visuals;
  const labelMode = visuals.latticeLabelMode || DEFAULT_SETTINGS.visuals.latticeLabelMode;
  const surfaceEnabled = !!visuals.nodeSurfaceRatioLabelsEnabled;
  const surfaceMode = visuals.nodeSurfaceRatioLabelMode || 'ratio';
  const surfaceEmphasize = !!visuals.nodeSurfaceRatioEmphasizePrimes;

  const setVisuals = (partial: any) => {
    updateSettings({ visuals: { ...visuals, ...partial } });
  };

  const setLabelMode = (mode: 'name' | 'ratio' | 'both') => {
    updateSettings({
      simpleLabelMode: mode,
      visuals: { ...visuals, latticeLabelMode: mode }
    });
  };

  const finishSetup = () => {
    updateSettings({ namingSetupCompleted: true });
    setNamingSetupOpen(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 text-gray-100">
      <div className="h-full overflow-y-auto custom-scrollbar px-4 py-6 md:px-8 md:py-10">
        <div className="max-w-4xl mx-auto bg-gray-900/70 border border-gray-800 rounded-xl p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <div className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">Naming Setup</div>
            <div className="text-xl font-black">How should node names appear?</div>
            <div className="text-[10px] text-gray-400">
              You can change these later using the small Aa button next to Help in Config.
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Label Content</div>
            <div className="flex flex-wrap gap-2">
              {(['name', 'ratio', 'both'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLabelMode(mode)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${
                    labelMode === mode
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-gray-500">
              Applies to lattice labels in both Simple and Advanced modes.
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Surface Labels</div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={surfaceEnabled}
                  onChange={(e) => setVisuals({ nodeSurfaceRatioLabelsEnabled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-[9px] text-gray-400 uppercase font-bold">Enable</span>
              </label>
            </div>
            {surfaceEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/40 border border-gray-800 rounded p-2">
                  <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Mode</label>
                  <select
                    value={surfaceMode}
                    onChange={(e) => setVisuals({ nodeSurfaceRatioLabelMode: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5"
                  >
                    <option value="ratio">Ratio</option>
                    <option value="harmonic">Harmonic</option>
                  </select>
                </div>
                <div className="bg-black/40 border border-gray-800 rounded p-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={surfaceEmphasize}
                      onChange={(e) => setVisuals({ nodeSurfaceRatioEmphasizePrimes: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span className="text-[9px] text-gray-400 uppercase font-bold">Emphasize Primes</span>
                  </label>
                  <div className="text-[9px] text-gray-500 mt-1">
                    Highlights primes when using harmonic mode.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-indigo-200"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Naming Rules
            </button>
            {showAdvanced && (
              <div className="bg-black/40 border border-gray-800 rounded p-4">
                <SymTab settings={settings} updateSettings={updateSettings} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={finishSetup}
              className="px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={finishSetup}
              className="px-4 py-2 rounded-full bg-gray-800 text-gray-300 text-[10px] font-black uppercase tracking-widest hover:text-white"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
