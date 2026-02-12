import React from 'react';

type PreviewPositionPanelProps = {
    clampedDisplaySeconds: number;
    totalDurationSeconds: number;
    formatTime: (value: number) => string;
    onSeekStart: () => void;
    onSeekChange: (value: number) => void;
    onSeekCommit: (value: number) => void;
    disabled: boolean;
};

export const PreviewPositionPanel = ({
    clampedDisplaySeconds,
    totalDurationSeconds,
    formatTime,
    onSeekStart,
    onSeekChange,
    onSeekCommit,
    disabled
}: PreviewPositionPanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
                <label className="text-[9px] text-gray-500 uppercase font-bold">Preview Position</label>
                <span className="text-[9px] text-gray-400 font-mono">
                    {formatTime(clampedDisplaySeconds)} / {formatTime(totalDurationSeconds)}
                </span>
            </div>
            <input
                type="range"
                min="0"
                max={Math.max(0, totalDurationSeconds)}
                step="0.01"
                value={clampedDisplaySeconds}
                onMouseDown={onSeekStart}
                onTouchStart={onSeekStart}
                onChange={(e) => onSeekChange(parseFloat(e.target.value))}
                onMouseUp={(e) => onSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => onSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => onSeekCommit(parseFloat((e.target as HTMLInputElement).value))}
                disabled={disabled}
                className="w-full h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer disabled:opacity-50"
            />
            <div className="text-[8px] text-gray-600">Drag to seek during preview.</div>
        </div>
    );
};
