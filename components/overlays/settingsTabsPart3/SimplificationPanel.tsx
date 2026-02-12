import React from 'react';

type SimplificationPanelProps = {
    globalSettings: any;
    handleSettingChange: (...args: any[]) => void;
    movePriority: (index: number, direction: 'up' | 'down') => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export const SimplificationPanel: React.FC<SimplificationPanelProps> = ({
    globalSettings,
    handleSettingChange,
    movePriority,
    onInteractionStart,
    onInteractionEnd
}) => (
    <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-lg space-y-3">
        <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-blue-300 uppercase tracking-widest">Simplification</h3>
        </div>

        <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer p-1 hover:bg-white/5 rounded transition-colors">
                <input
                    type="checkbox"
                    checked={globalSettings.deduplicateNodes}
                    onChange={(e) => handleSettingChange('deduplicateNodes', e.target.checked)}
                    className="w-3 h-3 accent-blue-500 rounded"
                />
                <span className="text-[10px] text-gray-300 font-bold uppercase">Enable</span>
            </label>

            {globalSettings.deduplicateNodes && (
                <div className="pl-6 space-y-3 animate-in slide-in-from-top-1 fade-in duration-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={globalSettings.ensureConnectivity}
                            onChange={(e) => handleSettingChange('ensureConnectivity', e.target.checked)}
                            className="w-3 h-3 accent-green-500 rounded"
                        />
                        <span className="text-[10px] text-green-300/80 uppercase font-bold">Show Pre-derived Notes (Ensure Connectivity)</span>
                    </label>

                    <div>
                        <span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Priority Order (Top = Keep)</span>
                        <div className="flex flex-col gap-1">
                            {globalSettings.priorityOrder.map((crit: any, i: number) => (
                                <div key={crit} className="flex justify-between items-center bg-black/40 border border-gray-700 rounded px-2 py-1">
                                    <span className="text-[10px] font-mono text-gray-300 uppercase">{crit}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => movePriority(i, 'up')} className="text-[8px] bg-gray-700 hover:bg-gray-600 px-1.5 py-0.5 rounded text-white" disabled={i === 0}>▲</button>
                                        <button onClick={() => movePriority(i, 'down')} className="text-[8px] bg-gray-700 hover:bg-gray-600 px-1.5 py-0.5 rounded text-white" disabled={i === globalSettings.priorityOrder.length - 1}>▼</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold"><span>Tolerance</span><span className="text-blue-400">{globalSettings.deduplicationTolerance}¢</span></div>
                        <div className="flex gap-2">
                            <input type="range" min="0" max="50" step="0.1" value={globalSettings.deduplicationTolerance} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => handleSettingChange('deduplicationTolerance', parseFloat(e.target.value), false)} className="w-full h-1 accent-blue-500 appearance-none bg-gray-700 rounded cursor-pointer mt-2" />
                            <input type="number" min="0" max="50" step="0.01" value={globalSettings.deduplicationTolerance} onChange={e => handleSettingChange('deduplicationTolerance', parseFloat(e.target.value), false)} className="w-12 bg-gray-800 border border-gray-600 rounded text-center text-xs text-blue-300 font-mono" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
