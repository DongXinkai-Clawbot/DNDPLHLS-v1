import React from 'react';

type RetuneSpeedPanelProps = {
    speedValue: number;
    speedTargets: { preview: boolean; wav: boolean; midi: boolean };
    onSpeedChange: (value: number) => void;
    onToggleTarget: (key: 'preview' | 'wav' | 'midi') => void;
    min: number;
    max: number;
    step: number;
};

export const RetuneSpeedPanel = ({ speedValue, speedTargets, onSpeedChange, onToggleTarget, min, max, step }: RetuneSpeedPanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
                <label className="text-[9px] text-gray-500 uppercase font-bold">Retune Speed</label>
                <div className="flex items-center gap-1">
                    <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        value={speedValue}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className="w-16 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                    />
                    <span className="text-[9px] text-gray-500">x</span>
                </div>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={speedValue}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
            />
            <div className="flex flex-wrap gap-2 text-[8px] text-gray-500">
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={speedTargets.preview}
                        onChange={() => onToggleTarget('preview')}
                        className="accent-emerald-500"
                    />
                    Preview
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={speedTargets.wav}
                        onChange={() => onToggleTarget('wav')}
                        className="accent-emerald-500"
                    />
                    WAV
                </label>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={speedTargets.midi}
                        onChange={() => onToggleTarget('midi')}
                        className="accent-emerald-500"
                    />
                    MIDI Tempo
                </label>
            </div>
            <div className="text-[8px] text-gray-600">Applies to retuned output only.</div>
        </div>
    );
};
