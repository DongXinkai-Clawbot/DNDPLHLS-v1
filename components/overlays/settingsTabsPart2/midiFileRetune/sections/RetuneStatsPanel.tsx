import React from 'react';

type RetuneStats = {
    ratioStats: [string, number][];
    chordStats: [string, number][];
    maxRatioCount: number;
    maxChordCount: number;
    totalNotes: number;
} | null;

type RetuneStatsPanelProps = {
    showStats: boolean;
    onToggle: () => void;
    retuneStats: RetuneStats;
};

export const RetuneStatsPanel = ({ showStats, onToggle, retuneStats }: RetuneStatsPanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-400 uppercase font-bold">Retune Stats</span>
                <button
                    onClick={onToggle}
                    className="text-[8px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2 py-1 rounded border border-gray-700"
                >
                    {showStats ? 'Hide' : 'Show'}
                </button>
            </div>
            {showStats && (
                <div className="space-y-3">
                    {retuneStats ? (
                        <>
                            <div className="text-[8px] text-gray-500">Total notes: {retuneStats.totalNotes}</div>
                            <div className="space-y-1">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">
                                    Ratios <span className="text-gray-600 font-normal">({retuneStats.ratioStats.length})</span>
                                </div>
                                {retuneStats.ratioStats.length ? (
                                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {retuneStats.ratioStats.map(([ratio, count]) => {
                                            const width = retuneStats.maxRatioCount ? Math.max(2, (count / retuneStats.maxRatioCount) * 100) : 0;
                                            return (
                                                <div key={ratio} className="flex items-center gap-2 text-[9px] text-gray-300">
                                                    <span className="w-16 font-mono truncate" title={ratio}>{ratio}</span>
                                                    <div className="flex-1 h-1.5 bg-gray-900 rounded">
                                                        <div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${width}%` }} />
                                                    </div>
                                                    <span className="w-8 text-right text-gray-400">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-[8px] text-gray-600 italic">No ratios detected.</div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="text-[9px] text-gray-500 uppercase font-bold">
                                    Chord Ratios <span className="text-gray-600 font-normal">({retuneStats.chordStats.length})</span>
                                </div>
                                {retuneStats.chordStats.length ? (
                                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                                        {retuneStats.chordStats.map(([chord, count]) => {
                                            const width = retuneStats.maxChordCount ? Math.max(2, (count / retuneStats.maxChordCount) * 100) : 0;
                                            return (
                                                <div key={chord} className="flex items-center gap-2 text-[9px] text-gray-300">
                                                    <span className="w-24 font-mono truncate" title={chord}>{chord}</span>
                                                    <div className="flex-1 h-1.5 bg-gray-900 rounded">
                                                        <div className="h-1.5 bg-indigo-500 rounded" style={{ width: `${width}%` }} />
                                                    </div>
                                                    <span className="w-8 text-right text-gray-400">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-[8px] text-gray-600 italic">No chords detected.</div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-[8px] text-gray-600 italic">Upload a MIDI file to compute stats.</div>
                    )}
                </div>
            )}
        </div>
    );
};
