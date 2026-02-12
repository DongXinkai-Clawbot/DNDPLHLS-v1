import React from 'react';

type ExpansionDistancePanelProps = {
    settings: any;
    handleSettingChange: (...args: any[]) => void;
    isGen1Custom: boolean;
    isGen2Custom: boolean;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export const ExpansionDistancePanel: React.FC<ExpansionDistancePanelProps> = ({
    settings,
    handleSettingChange,
    isGen1Custom,
    isGen2Custom,
    onInteractionStart,
    onInteractionEnd
}) => (
    <div className="p-2 bg-gray-800/50 rounded border border-gray-700 space-y-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase">Expansion Distance</h3>
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-300 font-bold uppercase">Gen 0 Axes (Global)</span>
                <input
                    type="number" min="0" max="1500" value={settings.expansionA}
                    onChange={e => handleSettingChange('expansionA', Math.max(0, parseInt(e.target.value) || 0), false)}
                    className="w-10 bg-black/50 border border-gray-700 rounded text-[10px] text-blue-300 text-center outline-none"
                />
            </div>
            <input
                type="range" min="0" max="60"
                value={settings.expansionA}
                onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd}
                onChange={e => handleSettingChange('expansionA', parseInt(e.target.value), false)}
                className="w-full h-1 accent-blue-500 bg-gray-700 rounded appearance-none cursor-pointer"
            />
        </div>
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className={`text-green-300 font-bold uppercase ${isGen1Custom ? 'opacity-50' : ''}`}>Gen 1 Axes (Global)</span>
                <input
                    type="number" min="0" max="60" value={settings.expansionB}
                    disabled={isGen1Custom}
                    onChange={e => handleSettingChange('expansionB', Math.max(0, parseInt(e.target.value) || 0), false)}
                    className={`w-10 bg-black/50 border border-gray-700 rounded text-[10px] text-green-300 text-center outline-none ${isGen1Custom ? 'opacity-30' : ''}`}
                />
            </div>
            <input
                type="range" min="0" max="60"
                value={settings.expansionB}
                disabled={isGen1Custom}
                onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd}
                onChange={e => {
                    const val = parseInt(e.target.value);
                    handleSettingChange('expansionB', val, false);
                }}
                className={`w-full h-1 accent-green-500 bg-gray-700 rounded appearance-none ${isGen1Custom ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            />
        </div>
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className={`text-yellow-300 font-bold uppercase ${isGen2Custom ? 'opacity-50' : ''}`}>Gen 2 {isGen2Custom ? '(Custom Active)' : ''}</span>
                <input
                    type="number" min="0" max="20" value={settings.expansionC}
                    disabled={isGen2Custom}
                    onChange={e => handleSettingChange('expansionC', Math.max(0, parseInt(e.target.value) || 0), false)}
                    className={`w-10 bg-black/50 border border-gray-700 rounded text-[10px] text-yellow-300 text-center outline-none ${isGen2Custom ? 'opacity-30' : ''}`}
                />
            </div>
            <input
                type="range" min="0" max="20"
                value={settings.expansionC}
                disabled={isGen2Custom}
                onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd}
                onChange={e => handleSettingChange('expansionC', parseInt(e.target.value), false)}
                className={`w-full h-1 accent-yellow-500 bg-gray-700 rounded appearance-none ${isGen2Custom ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            />
        </div>
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-300 font-bold uppercase">Gen 3</span>
                <input
                    type="number" min="0" max="10" value={settings.expansionD}
                    onChange={e => handleSettingChange('expansionD', Math.max(0, parseInt(e.target.value) || 0), false)}
                    className="w-10 bg-black/50 border border-gray-700 rounded text-[10px] text-purple-300 text-center outline-none"
                />
            </div>
            <input type="range" min="0" max="10" value={settings.expansionD} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => handleSettingChange('expansionD', parseInt(e.target.value), false)} className="w-full h-1 accent-purple-500 bg-gray-700 rounded appearance-none cursor-pointer" />
        </div>
        <div>
            <div className="flex justify-between text-xs mb-1">
                <span className="text-pink-300 font-bold uppercase">Gen 4</span>
                <input
                    type="number" min="0" max="8" value={settings.expansionE}
                    onChange={e => handleSettingChange('expansionE', Math.max(0, parseInt(e.target.value) || 0), false)}
                    className="w-10 bg-black/50 border border-gray-700 rounded text-[10px] text-pink-300 text-center outline-none"
                />
            </div>
            <input type="range" min="0" max="8" value={settings.expansionE} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => handleSettingChange('expansionE', parseInt(e.target.value), false)} className="w-full h-1 accent-pink-500 bg-gray-700 rounded appearance-none cursor-pointer" />
        </div>
    </div>
);
