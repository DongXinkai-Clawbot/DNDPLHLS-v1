import React from 'react';
import { DEFAULT_SETTINGS } from '../../../constants';
export const KeysTab = ({ settings, handleShortcutChange, handleSettingChange, onInteractionStart, onInteractionEnd }: any) => {
    const limits = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const navDefaults = DEFAULT_SETTINGS.navigationControls;
    const navControls = settings.navigationControls || navDefaults;
    const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));
    const updateNavControls = (partial: any, commit: boolean = true) => {
        if (!handleSettingChange) return;
        handleSettingChange({ navigationControls: { ...navControls, ...partial } }, commit);
    };
    return (
        <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Navigation Shortcuts</h3>
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 bg-gray-800 p-2 text-[9px] text-gray-500 uppercase font-black">
                    <span>Prime Axis</span>
                    <span className="text-center">Shift+Key (Move -)</span>
                    <span className="text-right">Key (Move +)</span>
                </div>
                {limits.map(limit => {
                    const currentKey = settings.navigationShortcuts?.[limit] || '';
                    return (
                        <div key={limit} className="grid grid-cols-3 p-2 border-t border-gray-800 items-center">
                            <span className="text-xs font-bold text-blue-200">{limit}-Limit</span>
                            <div className="flex justify-center">
                                <span className="min-w-[70px] h-8 bg-black border border-gray-700 rounded text-center text-[9px] text-gray-300 font-mono uppercase flex items-center justify-center px-2">
                                    {currentKey ? `SHIFT+${currentKey.toUpperCase()}` : '-'}
                                </span>
                            </div>
                            <div className="flex justify-end">
                                <input
                                    type="text"
                                    maxLength={1}
                                    value={currentKey.toUpperCase()}
                                    onChange={(e) => handleShortcutChange(limit, e.target.value)}
                                    className="w-8 h-8 bg-black border border-gray-700 rounded text-center text-white font-mono uppercase focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-gray-500 italic mt-2">
                Use these keys to navigate along specific prime axes without using the mouse or on-screen controls.
            </p>
            <div className="pt-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Navigation Sensitivity</h3>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                            <span>Mouse Rotate (Left Drag)</span>
                            <span className="text-blue-300">{navControls.mouseRotateSpeed.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={navControls.mouseRotateSpeed}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => updateNavControls({ mouseRotateSpeed: clamp(parseFloat(e.target.value), 0.1, 10) }, false)}
                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                            <span>Mouse Pan (Right Drag)</span>
                            <span className="text-blue-300">{navControls.mousePanSpeed.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.05"
                            value={navControls.mousePanSpeed}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => updateNavControls({ mousePanSpeed: clamp(parseFloat(e.target.value), 0.1, 5) }, false)}
                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                            <span>Mouse Scroll (Zoom)</span>
                            <span className="text-blue-300">{navControls.mouseZoomSpeed.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.05"
                            value={navControls.mouseZoomSpeed}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => updateNavControls({ mouseZoomSpeed: clamp(parseFloat(e.target.value), 0.1, 5) }, false)}
                            className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                                <span>WASD Speed</span>
                                <span className="text-blue-300">{navControls.wasdBaseSpeed.toFixed(2)}x</span>
                            </div>
                            <input
                                type="range"
                                min="0.2"
                                max="5"
                                step="0.05"
                                value={navControls.wasdBaseSpeed}
                                onPointerDown={onInteractionStart}
                                onPointerUp={onInteractionEnd}
                                onChange={(e) => updateNavControls({ wasdBaseSpeed: clamp(parseFloat(e.target.value), 0.2, 5) }, false)}
                                className="w-full h-1 accent-green-500 appearance-none cursor-pointer bg-gray-700 rounded"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                                <span>Sprint Multiplier</span>
                                <span className="text-blue-300">{navControls.wasdSprintMultiplier.toFixed(1)}x</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="30"
                                step="0.5"
                                value={navControls.wasdSprintMultiplier}
                                onPointerDown={onInteractionStart}
                                onPointerUp={onInteractionEnd}
                                onChange={(e) => updateNavControls({ wasdSprintMultiplier: clamp(parseFloat(e.target.value), 1, 30) }, false)}
                                className="w-full h-1 accent-green-500 appearance-none cursor-pointer bg-gray-700 rounded"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                            <span>Double-Tap Window</span>
                            <span className="text-blue-300">{Math.round(navControls.doubleTapMs)} ms</span>
                        </div>
                        <input
                            type="range"
                            min="100"
                            max="700"
                            step="10"
                            value={navControls.doubleTapMs}
                            onPointerDown={onInteractionStart}
                            onPointerUp={onInteractionEnd}
                            onChange={(e) => updateNavControls({ doubleTapMs: clamp(parseFloat(e.target.value), 100, 700) }, false)}
                            className="w-full h-1 accent-purple-500 appearance-none cursor-pointer bg-gray-700 rounded"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
