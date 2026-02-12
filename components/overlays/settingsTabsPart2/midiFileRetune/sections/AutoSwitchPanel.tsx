import React from 'react';

type AutoSwitchPanelProps = {
    autoSwitchToLattice: boolean;
    onToggle: (value: boolean) => void;
};

export const AutoSwitchPanel = ({ autoSwitchToLattice, onToggle }: AutoSwitchPanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={autoSwitchToLattice}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="accent-blue-500"
                />
                <span className="text-[9px] text-gray-400 uppercase font-bold">Auto-Switch to Lattice View</span>
            </label>
            <div className="text-[8px] text-gray-600">
                When enabled, preview will automatically show the lattice with nodes lighting up. Disable to stay in config panel during preview.
            </div>
        </div>
    );
};
