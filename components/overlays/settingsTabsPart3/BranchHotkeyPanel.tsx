import React from 'react';
import { DEFAULT_SETTINGS } from '../../../constants';

type BranchHotkeyPanelProps = {
  settings: any;
  globalSettings: any;
  handleSettingChange: (...args: any[]) => void;
};

const clampInt = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

export const BranchHotkeyPanel: React.FC<BranchHotkeyPanelProps> = ({
  settings,
  globalSettings,
  handleSettingChange
}) => {
  const current = settings.branchHotkeys || DEFAULT_SETTINGS.branchHotkeys;
  const blocked =
    !!globalSettings.spiral?.enabled ||
    !!globalSettings.equalStep?.enabled ||
    !!globalSettings.geometry?.enabled;

  const updateHotkeys = (partial: Partial<typeof current>) => {
    handleSettingChange({ branchHotkeys: { ...current, ...partial } });
  };

  return (
    <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Gen N+1 Hotkeys</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!current.enabled}
            onChange={(e) => updateHotkeys({ enabled: e.target.checked })}
            className="w-3 h-3 accent-indigo-500"
          />
          <span className="text-[9px] text-gray-400 font-bold uppercase">Enable</span>
        </label>
      </div>

      {current.enabled && (
        <>
          <div className="text-[9px] text-gray-500 leading-relaxed">
            Tab + Left Click uses defaults. Tab + Right Click prompts for custom lengths and can save them.
          </div>

          {blocked && (
            <div className="text-[9px] text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded p-2">
              Disabled while Spiral, Equal Steps, or 3D Shape generators are active.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">


          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-black/30 border border-gray-800 rounded p-2">
              <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Default Left/Neg</div>
              <input
                type="number"
                min="0"
                max="999"
                value={current.defaultNeg}
                onChange={(e) => updateHotkeys({ defaultNeg: clampInt(parseInt(e.target.value, 10), 0, 999) })}
                className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 font-mono"
              />
            </div>
            <div className="bg-black/30 border border-gray-800 rounded p-2">
              <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Default Right/Pos</div>
              <input
                type="number"
                min="0"
                max="999"
                value={current.defaultPos}
                onChange={(e) => updateHotkeys({ defaultPos: clampInt(parseInt(e.target.value, 10), 0, 999) })}
                className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 font-mono"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
