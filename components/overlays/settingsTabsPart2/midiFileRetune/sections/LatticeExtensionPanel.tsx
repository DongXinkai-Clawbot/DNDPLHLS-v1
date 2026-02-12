import React from 'react';

export type LatticeExtensionPlan = {
    missingRatios: { ratio: string }[];
    newCustomPrimes: { prime: number }[];
    exceedsGen0Limit: boolean;
    axesExceedingLimit: string[];
};

type LatticeExtensionPanelProps = {
    extensionPlan: LatticeExtensionPlan | null;
    extensionPanelCollapsed: boolean;
    setExtensionPanelCollapsed: (next: boolean) => void;
    extensionMode: 'temporary' | 'permanent' | 'replacement';
    setExtensionMode: (mode: 'temporary' | 'permanent' | 'replacement') => void;
    onApplyExtension: () => void;
};

export const LatticeExtensionPanel = ({
    extensionPlan,
    extensionPanelCollapsed,
    setExtensionPanelCollapsed,
    extensionMode,
    setExtensionMode,
    onApplyExtension
}: LatticeExtensionPanelProps) => {
    if (!extensionPlan) return null;

    return (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg overflow-hidden">
            <div
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-amber-900/30 transition-colors"
                onClick={() => setExtensionPanelCollapsed(!extensionPanelCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg">!</span>
                    <span className="text-[10px] font-bold text-amber-300 uppercase">
                        {extensionPlan.missingRatios.length} Ratio{extensionPlan.missingRatios.length > 1 ? 's' : ''} Not in Lattice
                    </span>
                </div>
                <span className="text-amber-400 text-[10px]">
                    {extensionPanelCollapsed ? 'v' : '^'}
                </span>
            </div>

            {!extensionPanelCollapsed && (
                <div className="p-3 pt-0 space-y-2">
                    <div className="max-h-20 overflow-y-auto custom-scrollbar">
                        <div className="flex flex-wrap gap-1">
                            {extensionPlan.missingRatios.slice(0, 12).map((r, i) => (
                                <span key={i} className="text-[8px] bg-amber-900/50 text-amber-200 px-1.5 py-0.5 rounded font-mono">
                                    {r.ratio}
                                </span>
                            ))}
                            {extensionPlan.missingRatios.length > 12 && (
                                <span className="text-[8px] text-amber-400 italic">
                                    +{extensionPlan.missingRatios.length - 12} more
                                </span>
                            )}
                        </div>
                    </div>

                    {extensionPlan.newCustomPrimes.length > 0 && (
                        <div className="text-[9px] text-amber-300 bg-amber-900/30 rounded px-2 py-1">
                            <span className="font-bold">New primes needed: </span>
                            {extensionPlan.newCustomPrimes.map(cp => cp.prime).join(', ')}
                        </div>
                    )}

                    {extensionPlan.exceedsGen0Limit && (
                        <div className="text-[9px] text-red-300 bg-red-900/30 rounded px-2 py-1">
                            <span className="font-bold">Warning:</span> Requires extending axis beyond 6 nodes ({extensionPlan.axesExceedingLimit.join(', ')}-axis)
                        </div>
                    )}

                    <div className="flex gap-1">
                        <button
                            onClick={() => setExtensionMode('temporary')}
                            className={`flex-1 text-[8px] py-1 rounded font-bold transition-colors ${extensionMode === 'temporary'
                                ? 'bg-amber-700 text-white'
                                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                                }`}
                            title="Adds only needed nodes, removed after playback"
                        >
                            Temp
                        </button>
                        <button
                            onClick={() => setExtensionMode('permanent')}
                            className={`flex-1 text-[8px] py-1 rounded font-bold transition-colors ${extensionMode === 'permanent'
                                ? 'bg-orange-700 text-white'
                                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                                }`}
                            title="Permanently extends lattice settings"
                        >
                            Extend
                        </button>
                        <button
                            onClick={() => setExtensionMode('replacement')}
                            className={`flex-1 text-[8px] py-1 rounded font-bold transition-colors ${extensionMode === 'replacement'
                                ? 'bg-red-700 text-white'
                                : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                                }`}
                            title="Replace entire lattice with nodes matching scale"
                        >
                            Replace
                        </button>
                    </div>

                    <button
                        onClick={onApplyExtension}
                        className={`w-full text-[9px] py-1.5 rounded font-bold transition-colors ${extensionMode === 'replacement'
                            ? 'bg-red-600 hover:bg-red-500 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                            }`}
                    >
                        {extensionMode === 'replacement' ? 'Replace Lattice' : 'Apply Extension'}
                    </button>
                </div>
            )}
        </div>
    );
};
