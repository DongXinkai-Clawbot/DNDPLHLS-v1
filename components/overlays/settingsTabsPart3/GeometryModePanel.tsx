import React from 'react';
import type { GeometryConfig } from '../../../types';
import { DEFAULT_SETTINGS } from '../../../constants';
import { GeometrySettings } from '../lattice/GeometrySettings';

type GeometryModePanelProps = {
    globalSettings: any;
    updateGeometry: (partial: Partial<GeometryConfig>) => void;
    resetLatticeConfig: () => void;
};

export const GeometryModePanel: React.FC<GeometryModePanelProps> = ({
    globalSettings,
    updateGeometry,
    resetLatticeConfig
}) => (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase">3D Geometry Mode Active</h3>
            <button
                onClick={() => resetLatticeConfig()}
                className="text-[9px] text-blue-400 hover:text-white border border-blue-900 px-2 py-0.5 rounded bg-blue-950/30 font-bold active:scale-95 transition-transform"
            >
                RESET CONFIG
            </button>
        </div>
        <div className="text-[10px] text-indigo-300 bg-indigo-900/20 p-2 rounded border border-indigo-800">
            Standard lattice generation is disabled. Using 3D Shape configuration.
        </div>
        <GeometrySettings config={globalSettings.geometry || DEFAULT_SETTINGS.geometry} onChange={updateGeometry} />
    </div>
);
