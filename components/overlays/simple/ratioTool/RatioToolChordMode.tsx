import React from 'react';
import type { RatioToolViewProps } from './RatioToolView';

export const RatioToolChordMode = (props: RatioToolViewProps) => {
    const {
        chordInput,
        setChordInput,
        normalizeChord,
        setNormalizeChord,
        libraryChordId,
        setLibraryChordId,
        selectedLibraryChord,
        applyLibraryChord,
        analyzeChord,
        chordResult,
        playChord,
        addChordToComparison,
        addChordToKeyboard,
        CHORD_LIBRARY_ITEMS,
        formatRatio,
    } = props as any;

    return (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2">
            <label className="text-[10px] text-gray-500 font-bold uppercase">Ratios (Comma Separated)</label>
            <textarea
                value={chordInput}
                onChange={e => setChordInput(e.target.value)}
                className="w-full h-20 bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono text-xs"
                placeholder="e.g. 1/1, 5/4, 2^700/1200, 1.25"
            />
            <div className="bg-gray-900/40 border border-gray-700 rounded p-2 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-gray-500 font-bold">Chord Library</span>
                    {selectedLibraryChord && (
                        <span className="text-[9px] text-gray-400">{selectedLibraryChord.group}</span>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        value={libraryChordId}
                        onChange={(e) => setLibraryChordId(e.target.value)}
                        className="bg-black border border-gray-700 text-[10px] rounded p-1 outline-none text-gray-200 flex-1"
                    >
                        {CHORD_LIBRARY_ITEMS.map(item => (
                            <option key={item.id} value={item.id}>
                                {item.label} ({item.group})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => applyLibraryChord('replace')}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                    >
                        Replace
                    </button>
                    <button
                        onClick={() => applyLibraryChord('append')}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded px-2 py-1 text-[10px] font-black"
                    >
                        Append
                    </button>
                </div>
                {selectedLibraryChord && (
                    <div className="text-[9px] text-gray-500 font-mono">
                        {selectedLibraryChord.label}: {selectedLibraryChord.ratios}
                    </div>
                )}
            </div>
            <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500">Max 40 notes</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={normalizeChord} onChange={e => setNormalizeChord(e.target.checked)} className="w-3 h-3 accent-blue-500 rounded" />
                        <span className="text-[9px] text-gray-400">Normalize Octaves</span>
                    </label>
                </div>
                <button onClick={analyzeChord} className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-1 rounded font-bold shadow-md">Construct</button>
            </div>

            {chordResult && chordResult.error && (
                <div className="text-red-400 p-2 bg-red-900/20 rounded border border-red-900/50">{chordResult.error}</div>
            )}

            {chordResult && !chordResult.error && chordResult.notes.length > 0 && (
                <div className="bg-gray-800/50 rounded border border-gray-700 overflow-hidden">
                    <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <span className="text-blue-300 font-bold">{chordResult.notes.length} Notes</span>
                        <button onClick={playChord} className="bg-green-700 hover:bg-green-600 text-white px-3 py-0.5 rounded text-[10px] font-bold shadow-lg">▶ Play Chord</button>
                    </div>

                    <div className="max-h-32 overflow-y-auto custom-scrollbar p-1 space-y-1">
                        {chordResult.notes.map((n, i) => (
                            <div key={i} className="flex justify-between items-center px-2 py-1 bg-gray-900/50 rounded">
                                <span className="font-mono text-gray-300">{formatRatio(n.ratio)}</span>
                                <span className="text-gray-500">{n.cents.toFixed(1)}¢</span>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 grid grid-cols-2 gap-2 border-t border-gray-700 bg-gray-900/30">
                        <button onClick={addChordToComparison} className="bg-gray-700 hover:bg-white hover:text-black py-1 rounded text-gray-300 border border-gray-600">To Compare</button>
                        <button onClick={addChordToKeyboard} className="bg-gray-700 hover:bg-white hover:text-black py-1 rounded text-gray-300 border border-gray-600">To Keyboard</button>
                    </div>

                    {/* Save to Library Section */}
                    <div className="p-2 border-t border-gray-700 bg-gray-900/30 space-y-2">
                        <div className="text-[10px] text-gray-500 uppercase font-bold">Save to Library</div>
                        <input
                            type="text"
                            value={(props as any).saveChordName || ''}
                            onChange={e => (props as any).setSaveChordName(e.target.value)}
                            placeholder="Chord name..."
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-white placeholder-gray-600"
                        />
                        <textarea
                            value={(props as any).saveChordDescription || ''}
                            onChange={e => (props as any).setSaveChordDescription(e.target.value)}
                            placeholder="Optional description..."
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-300 placeholder-gray-600 resize-none h-12"
                        />
                        <button
                            onClick={() => (props as any).saveConstructedChord?.()}
                            disabled={!(props as any).saveChordName?.trim()}
                            className={`w-full py-1 rounded text-[10px] font-bold transition-colors ${(props as any).saveChordName?.trim()
                                    ? 'bg-purple-700 hover:bg-purple-600 text-white'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            Save to Library
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
