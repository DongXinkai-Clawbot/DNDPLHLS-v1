import React from 'react';

type AVDelayPanelProps = {
    retuneSnapDelayMs: number;
    onChange: (ms: number) => void;
};

export const AVDelayPanel = ({ retuneSnapDelayMs, onChange }: AVDelayPanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
                <label className="text-[9px] text-gray-500 uppercase font-bold">A/V Delay Offset</label>
                <span className="text-[9px] text-indigo-300 font-mono">{retuneSnapDelayMs > 0 ? '+' : ''}{retuneSnapDelayMs}ms</span>
            </div>
            <input
                type="range"
                min="-200"
                max="200"
                step="10"
                value={retuneSnapDelayMs}
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 accent-indigo-500 appearance-none bg-gray-700 rounded cursor-pointer"
            />
            <div className="text-[8px] text-gray-600">Adjust to sync visuals with audio. Negative = visuals earlier.</div>
        </div>
    );
};
