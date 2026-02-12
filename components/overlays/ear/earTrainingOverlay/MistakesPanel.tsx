import React from 'react';
import { TASK_LABELS } from './helpers';

export const MistakesPanel = ({
    earTraining,
    startReviewSession,
    startPracticeSignature,
    deleteReviewItem
}: {
    earTraining: any,
    startReviewSession: any,
    startPracticeSignature: any,
    deleteReviewItem: any
}) => {
    const { persisted } = earTraining;
    const reviewItems = [...persisted.reviewItems].sort((a: any, b: any) => b.lapses - a.lapses); 
    return (
        <div className="space-y-3 animate-in fade-in h-full flex flex-col">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-red-300 uppercase">Top Mistakes</h3>
                <button onClick={() => startReviewSession('mistakes')} className="text-[10px] bg-red-900/50 hover:bg-red-800 border border-red-700 px-3 py-1 rounded font-bold uppercase text-red-100">Review All Mistakes</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                {reviewItems.length === 0 && <p className="text-xs text-gray-500 text-center py-4">No mistakes recorded yet. Keep training!</p>}
                {reviewItems.map((item: any) => {
                    let label: string = TASK_LABELS[item.signature.taskType] || item.signature.taskType;
                    if (item.signature.interval) label = `Interval (${item.signature.interval.label || item.signature.interval.poolId})`;
                    if (item.signature.chord) label = `Chord (${item.signature.chord.label || item.signature.chord.qualityId})`;
                    if (item.signature.drift) label = `Drift ${item.signature.drift.targetRatio}`;
                    if (item.signature.melody) label = `Melody (${item.signature.melody.poolId})`;
                    if (item.signature.duoMelody) label = `Dual Melody (${item.signature.duoMelody.poolId})`;
                    if (item.signature.progression) label = `Progression (${item.signature.progression.poolId})`;
                    return (
                        <div key={item.key} className="flex justify-between items-center bg-gray-800/40 p-2 rounded border border-gray-700">
                            <div className="flex-1">
                                <div className="text-xs font-bold text-gray-300 capitalize">{label}</div>
                                <div className="text-[9px] text-gray-500">Errors: {item.lapses} | Stage: {item.stage}</div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => deleteReviewItem(item.key)}
                                    className="text-[9px] text-red-400 hover:text-red-200 px-2 py-1"
                                    title="Delete this mistake"
                                >
                                    ✕
                                </button>
                                <button
                                    onClick={() => startPracticeSignature(item.signature)}
                                    className="text-[9px] border border-gray-600 hover:bg-white hover:text-black px-2 py-1 rounded transition-colors"
                                >
                                    Practice
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
