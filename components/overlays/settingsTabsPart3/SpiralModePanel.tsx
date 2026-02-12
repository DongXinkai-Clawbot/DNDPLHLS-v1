import React from 'react';
import type { SpiralConfig } from '../../../types';
import { DEFAULT_SETTINGS } from '../../../constants';
import { SpiralSettings } from '../lattice/SpiralSettings';

type SpiralModePanelProps = {
    globalSettings: any;
    updateSpiral: (partial: Partial<SpiralConfig>) => void;
    resetLatticeConfig: () => void;
};

export const SpiralModePanel: React.FC<SpiralModePanelProps> = ({
    globalSettings,
    updateSpiral,
    resetLatticeConfig
}) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase">Spiral Mode Active</h3>
            <button
                onClick={() => resetLatticeConfig()}
                className="text-[9px] text-blue-400 hover:text-white border border-blue-900 px-2 py-0.5 rounded bg-blue-950/30 font-bold active:scale-95 transition-transform"
            >
                RESET CONFIG
            </button>
        </div>
        <div className="text-[10px] text-blue-300 bg-blue-900/20 p-2 rounded border border-blue-800">
            Standard lattice generation is disabled. The system is generating a specialized multi-period spiral based on your configuration below.
        </div>
        <SpiralSettings config={globalSettings.spiral || DEFAULT_SETTINGS.spiral} onChange={updateSpiral} />
    </div>
);
