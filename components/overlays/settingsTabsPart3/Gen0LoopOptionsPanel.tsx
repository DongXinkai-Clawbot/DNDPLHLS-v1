import React from 'react';
import type { PrimeLimit } from '../../../types';

type Gen0LoopOptionsPanelProps = {
    settings: any;
    globalSettings: any;
    openLoopFinder: { limit: PrimeLimit; gen: 0 | 1 | 2; parentLimit?: PrimeLimit } | null;
    setOpenLoopFinder: React.Dispatch<React.SetStateAction<{ limit: PrimeLimit; gen: 0 | 1 | 2; parentLimit?: PrimeLimit } | null>>;
    loopOrder: "size" | "position";
    setLoopOrder: React.Dispatch<React.SetStateAction<"size" | "position">>;
    handleSettingChange: (...args: any[]) => void;
    findLoops: (limit: PrimeLimit) => { length: number; diff: number }[];
    sortLoops: (candidates: { length: number; diff: number }[]) => { length: number; diff: number }[];
    toggleAxisLoop: (limit: PrimeLimit) => void;
    onInteractionStart: () => void;
    onInteractionEnd: () => void;
};

export const Gen0LoopOptionsPanel: React.FC<Gen0LoopOptionsPanelProps> = ({
    settings,
    globalSettings,
    openLoopFinder,
    setOpenLoopFinder,
    loopOrder,
    setLoopOrder,
    handleSettingChange,
    findLoops,
    sortLoops,
    toggleAxisLoop,
    onInteractionStart,
    onInteractionEnd
}) => {
    const sliderMax = settings.gen0MaxDisplayLength || 100;

    const [collapsed, setCollapsed] = React.useState(false);

    return (<div className="mt-3 p-2 bg-gray-900 border border-gray-700 rounded">
        <div className="flex justify-between items-center mb-2">
            <label className="flex items-center gap-2 cursor-pointer bg-gray-800/50 hover:bg-gray-800 px-2 py-1 rounded transition-colors w-full">
                <input
                    type="checkbox"
                    checked={settings.gen0CustomizeEnabled !== false}
                    onChange={(e) => handleSettingChange('gen0CustomizeEnabled', e.target.checked)}
                    className="w-3 h-3 accent-blue-500"
                />
                <span className="text-[10px] font-bold text-blue-400 uppercase">Customize Gen 0 Branches</span>
            </label>
            {settings.gen0CustomizeEnabled !== false && (
                <button onClick={() => setCollapsed(!collapsed)} className="text-[10px] text-blue-400 hover:text-white ml-2">
                    {collapsed ? 'Show' : 'Hide'}
                </button>
            )}
        </div>
        {settings.gen0CustomizeEnabled !== false && !collapsed && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1">

                <div className="flex items-center gap-4 bg-black/20 p-2 rounded border border-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Slider Max</span>
                        <input type="number" min="10" max="1500" value={sliderMax} onChange={(e) => { const raw = parseInt(e.target.value); if (Number.isNaN(raw)) return; const next = Math.min(1500, Math.max(10, raw)); handleSettingChange('gen0MaxDisplayLength', next, false); }} className="w-10 bg-gray-800 border border-gray-600 rounded text-[9px] text-center text-gray-300" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Tolerance</span>
                        <div className="flex items-center gap-1">
                        <input type="number" min="1" max="1200" value={settings.loopTolerance} onChange={(e) => {
                                const raw = parseFloat(e.target.value); if (Number.isNaN(raw))
                                    return; const next = Math.min(1200, Math.max(1, raw)); handleSettingChange('loopTolerance', next, false);
                            }} className="w-8 bg-gray-800 border border-gray-600 rounded text-[9px] text-center text-gray-300" />
                            <span className="text-[9px] text-gray-500">cents</span>
                        </div>
                    </div>
                </div>

                {settings.rootLimits.map((l: PrimeLimit) => { const isLooped = settings.axisLooping && settings.axisLooping[l] !== null; const currentNeg = settings.gen0Ranges?.[l]?.neg ?? (settings.gen0Lengths?.[l] ?? settings.expansionA); const currentPos = settings.gen0Ranges?.[l]?.pos ?? (settings.gen0Lengths?.[l] ?? settings.expansionA); return (<div key={l} className="flex flex-col bg-gray-800/50 p-2 rounded gap-2">                                <div className="flex justify-between items-center border-b border-gray-700 pb-1 mb-1">                                    <span className="text-xs font-bold text-blue-300">{l}-Limit Axis</span>                                    <button onClick={() => setOpenLoopFinder(openLoopFinder?.limit === l && openLoopFinder.gen === 0 ? null : { limit: l, gen: 0 })} className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-0.5 rounded border border-blue-700">                                        {(openLoopFinder?.limit === l && openLoopFinder.gen === 0) ? 'Close Finder' : 'Find Loops'}                                    </button>                                </div>                                {(openLoopFinder?.limit === l && openLoopFinder.gen === 0) && (<div className="mb-2 bg-black/50 p-2 rounded border border-gray-600">                                        <div className="flex items-center justify-between mb-2">                                            <span className="text-[9px] text-gray-400">Select a loop to apply:</span>                                            <label className="flex items-center gap-1 text-[9px] text-gray-500">                                                Order                                                <select value={loopOrder} onChange={(e) => setLoopOrder(e.target.value as 'size' | 'position')} className="bg-gray-900 border border-gray-700 rounded text-[9px] text-gray-200 px-1 py-0.5">                                                    <option value="position">Position (c err)</option>                                                    <option value="size">Size</option>                                                </select>                                            </label>                                        </div>                                        <div className="flex flex-col gap-1 max-h-[144px] overflow-y-auto custom-scrollbar pr-1">                                            {sortLoops(findLoops(l)).map((cand, idx) => (<div key={idx} className="flex items-center justify-between bg-gray-900 px-2 py-1 rounded">                                                    <span className="text-[10px] font-mono text-white">Size {cand.length} <span className="text-gray-500">({cand.diff.toFixed(1)}c err)</span></span>                                                    <div className="flex gap-1">                                                        <button onClick={() => { const neg = Math.floor(cand.length / 2); const pos = Math.ceil(cand.length / 2); const newRanges = { ...settings.gen0Ranges, [l]: { neg, pos } }; handleSettingChange('gen0Ranges', newRanges); const next = cand.length / 2; const newLooping = { ...(settings.axisLooping || {}), [l]: next }; handleSettingChange('axisLooping', newLooping); }} className="text-[9px] bg-gray-700 hover:bg-white hover:text-black px-1 rounded border border-gray-500"> Symmetric </button>                                                    </div>                                                </div>))}                                        </div>                                    </div>)}                                <div className="grid grid-cols-2 gap-2">                                    <div className="flex flex-col gap-1">                                        <div className="flex justify-between items-center">                                            <span className="text-[9px] text-gray-500 uppercase">Negative</span>                                            <input type="number" min="0" max="1500" value={currentNeg} onChange={(e) => { const val = Math.max(0, parseInt(e.target.value) || 0); const newRanges = { ...settings.gen0Ranges, [l]: { neg: val, pos: currentPos } }; handleSettingChange('gen0Ranges', newRanges, false); }} className="w-12 bg-black/50 border border-gray-700 rounded text-[10px] text-blue-300 text-center outline-none" />                                        </div>                                        <input type="range" min="0" max={sliderMax} value={Math.min(currentNeg, sliderMax)} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={(e) => { const val = parseInt(e.target.value); const newRanges = { ...settings.gen0Ranges, [l]: { neg: val, pos: currentPos } }; handleSettingChange('gen0Ranges', newRanges, false); }} className="w-full h-1 accent-blue-500" />                                    </div>                                    <div className="flex flex-col gap-1">                                        <div className="flex justify-between items-center">                                            <span className="text-[9px] text-gray-500 uppercase">Positive</span>                                            <input type="number" min="0" max="1500" value={currentPos} onChange={(e) => { const val = Math.max(0, parseInt(e.target.value) || 0); const newRanges = { ...settings.gen0Ranges, [l]: { neg: currentNeg, pos: val } }; handleSettingChange('gen0Ranges', newRanges, false); }} className="w-12 bg-black/50 border border-gray-700 rounded text-[10px] text-blue-300 text-center outline-none" />                                        </div>                                        <input type="range" min="0" max={sliderMax} value={Math.min(currentPos, sliderMax)} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={(e) => { const val = parseInt(e.target.value); const newRanges = { ...settings.gen0Ranges, [l]: { neg: currentNeg, pos: val } }; handleSettingChange('gen0Ranges', newRanges, false); }} className="w-full h-1 accent-blue-500" />                                    </div>                                </div>                                <div className="flex justify-between items-center mt-1">                                    {isLooped ? <span className="text-[9px] text-green-400">Ring Visual Enabled</span> : <span className="text-[9px] text-gray-500">Total Length: {currentNeg + currentPos}</span>}                                    <button onClick={() => toggleAxisLoop(l)} className={`px-2 py-0.5 rounded text-[9px] border ${isLooped ? 'bg-green-900/50 border-green-500 text-green-200' : 'bg-gray-700 border-gray-600 text-gray-500 hover:bg-gray-600'}`}>{isLooped ? 'Disable Ring' : 'Enable Ring Visual'}</button>                                </div>                            </div>); })}            </div>
        )}
    </div>);
};

