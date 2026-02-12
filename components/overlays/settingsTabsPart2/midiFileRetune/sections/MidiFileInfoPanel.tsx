import React from 'react';

type MidiFileInfoPanelProps = {
    importResult: any;
    noteStats: { count: number; min: number; max: number; channels: number } | null;
    playingType: 'original' | 'retuned' | null;
    onPlayOriginal: () => void;
};

export const MidiFileInfoPanel = ({ importResult, noteStats, playingType, onPlayOriginal }: MidiFileInfoPanelProps) => {
    if (!importResult) return null;

    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between text-[9px] text-gray-300">
                <div><span className="font-bold">File:</span> {importResult.fileName || 'MIDI'}</div>
                <button
                    onClick={onPlayOriginal}
                    className={`px-2 py-0.5 rounded border font-bold ${playingType === 'original' ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'}`}
                >
                    {playingType === 'original' ? 'Stop' : 'Play Original'}
                </button>
            </div>
            <div className="text-[9px] text-gray-300">
                <span className="font-bold">Tracks:</span> {importResult.trackCount} | <span className="font-bold">Notes:</span> {noteStats?.count || 0}
            </div>
            {noteStats && (
                <div className="text-[9px] text-gray-300">
                    <span className="font-bold">Range:</span> {noteStats.min}-{noteStats.max} | <span className="font-bold">Channels:</span> {noteStats.channels}
                </div>
            )}
            <div className="text-[9px] text-gray-300">
                <span className="font-bold">Detected tuning:</span> {importResult.tuning?.description}
            </div>
        </div>
    );
};
