import React from 'react';

export const StatsPanel = ({ earTraining }: { earTraining: any }) => {
    const { persisted } = earTraining;
    const history = persisted.attempts;
    const total = history.length;
    const correct = history.filter((a: any) => a.isCorrect).length;
    const acc = total > 0 ? (correct / total * 100).toFixed(1) : 0;
    const confusionMap = new Map<string, number>();
    history.forEach((a: any) => {
        if (!a.isCorrect && a.taskType !== 'compare') {
            const key = `${a.correctLabel} → ${a.chosenLabel}`;
            confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
        }
    });
    const confusion = Array.from(confusionMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return (
        <div className="space-y-4 animate-in fade-in">
            <div className="bg-black/30 p-3 rounded-xl border border-gray-700 grid grid-cols-2 gap-4">
                <div><h4 className="text-[10px] text-gray-500 uppercase font-bold">Accuracy</h4><span className="text-2xl font-mono text-blue-300">{acc}%</span></div>
                <div><h4 className="text-[10px] text-gray-500 uppercase font-bold">Total Attempts</h4><span className="text-2xl font-mono text-white">{total}</span></div>
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-gray-700">
                <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-2">Top Confusion Pairs</h4>
                {confusion.length === 0 ? <p className="text-xs text-gray-600 italic">No errors recorded yet.</p> : (
                    <ul className="space-y-1">
                        {confusion.map(([pair, count], i) => (
                            <li key={i} className="flex justify-between text-xs text-gray-300 border-b border-gray-800 pb-1">
                                <span>{pair}</span>
                                <span className="text-red-400 font-bold">{count}x</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="bg-black/30 p-3 rounded-xl border border-gray-700">
                <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-1">Recent Sessions</h4>
                <div className="text-[10px] text-gray-400">
                    {persisted.sessions.slice(0, 3).map((s: any) => (
                        <div key={s.id} className="flex justify-between">
                            <span>{new Date(s.tsEnd).toLocaleDateString()}</span>
                            <span>{(s.accuracy * 100).toFixed(0)}% ({s.correct}/{s.total})</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
