import React from 'react';
import { formatRatio, calculateCents, parseGeneralRatio } from '../../musicLogic';
import { useLibraryTabState } from './libraryTab/useLibraryTabState';
import { VirtualList } from '../common/VirtualList';

export const LibraryTab: React.FC = () => {
    const {
        activeSection,
        setActiveSection,
        expandedGroups,
        toggleGroup,
        searchQuery,
        setSearchQuery,
        showAddScale,
        setShowAddScale,
        newScaleName,
        setNewScaleName,
        newScaleRatios,
        setNewScaleRatios,
        scalePlaybackSpeed,
        setScalePlaybackSpeed,
        scaleWaveform,
        setScaleWaveform,
        showArchiveScales,
        setShowArchiveScales,
        archiveScaleCache,
        setArchiveLimit,
        showHiddenArchive,
        setShowHiddenArchive,
        selectedArchiveScale,
        setSelectedArchiveScale,
        archiveSortMode,
        setArchiveSortMode,
        savedScaleSortMode,
        setSavedScaleSortMode,
        intervalFilterMode,
        setIntervalFilterMode,
        selectedLimit,
        setSelectedLimit,
        selectedCategory,
        setSelectedCategory,
        intervalSortMode,
        setIntervalSortMode,
        savedChords,
        savedMidiScales,
        deleteChord,
        deleteMidiScale,
        saveMidiScale,
        playPresetChord,
        playSavedChord,
        playScale,
        handleAddScale,
        handlePlayArchiveScale,
        handleSaveArchiveScale,
        loadArchiveScale,
        handleSendToRetuner,
        handleSendToTuner,
        handleSendToKeyboard,
        handleHideArchiveScale,
        handleRestoreArchiveScale,
        filteredPresetGroups,
        filteredSavedChords,
        filteredSavedScales,
        archiveDisplayEntries,
        hiddenArchiveEntries,
        archiveHasMore,
        archiveTotalCount,
        filteredIntervals,
        findNodeForInterval,
        navigateToInterval,
        getCategoryColor,
        presetChordCount,
        setHiddenArchiveIds
    } = useLibraryTabState();

    return (
        <div className="flex flex-col h-full">
            <div className="flex bg-black rounded-lg p-0.5 border border-gray-700 mb-3">
                <button
                    onClick={() => setActiveSection('chords')}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${activeSection === 'chords' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Chords ({presetChordCount + savedChords.length})
                </button>
                <button
                    onClick={() => setActiveSection('scales')}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${activeSection === 'scales' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Scales ({savedMidiScales.length})
                </button>
                <button
                    onClick={() => setActiveSection('intervals')}
                    className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${activeSection === 'intervals' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Intervals ({filteredIntervals.length})
                </button>
            </div>

            <div className="mb-3">
                <input
                    type="text"
                    placeholder={activeSection === 'chords' ? 'Search chords...' : activeSection === 'scales' ? 'Search scales...' : 'Search intervals...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3">
                {activeSection === 'chords' && (
                    <>
                        {filteredPresetGroups.map(group => (
                            <div key={group.title} className="bg-gray-900/50 rounded-lg border border-gray-800 overflow-hidden">
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                                >
                                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-wider">{group.title}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-gray-500">{group.items.length}</span>
                                        <span className="text-gray-500 text-[10px]">{expandedGroups.has(group.title) ? '▼' : '▶'}</span>
                                    </div>
                                </button>
                                {expandedGroups.has(group.title) && (
                                    <div className="p-2 space-y-1">
                                        {group.items.map(item => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between bg-black/40 rounded px-2 py-1.5 hover:bg-black/60 transition-colors group"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs text-white font-bold truncate">{item.label}</div>
                                                    <div className="text-[10px] text-gray-500 font-mono">{item.ratios}</div>
                                                </div>
                                                <button
                                                    onClick={() => playPresetChord(item.ratios)}
                                                    className="ml-2 px-2 py-1 bg-blue-900/50 hover:bg-blue-700 text-blue-200 text-[9px] font-bold rounded border border-blue-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    ▶ Play
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        {filteredSavedChords.length > 0 && (
                            <div className="bg-green-900/20 rounded-lg border border-green-800/50 overflow-hidden">
                                <div className="px-3 py-2 bg-green-900/30 border-b border-green-800/50">
                                    <span className="text-[10px] font-black text-green-300 uppercase tracking-wider">Your Saved Chords</span>
                                </div>
                                <div className="p-2 space-y-1">
                                    {filteredSavedChords.map(chord => (
                                        <div
                                            key={chord.id}
                                            className="flex items-center justify-between bg-black/40 rounded px-2 py-1.5 hover:bg-black/60 transition-colors group"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-white font-bold truncate">{chord.name}</div>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {chord.nodes.map(n => formatRatio(n.ratio)).join(' : ')}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => playSavedChord(chord)}
                                                    className="px-2 py-1 bg-green-900/50 hover:bg-green-700 text-green-200 text-[9px] font-bold rounded border border-green-800"
                                                >
                                                    ▶
                                                </button>
                                                <button
                                                    onClick={() => deleteChord(chord.id)}
                                                    className="px-2 py-1 bg-red-900/50 hover:bg-red-700 text-red-200 text-[9px] font-bold rounded border border-red-800"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {filteredPresetGroups.length === 0 && filteredSavedChords.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-xs">No chords found matching "{searchQuery}"</div>
                        )}
                    </>
                )}

                {activeSection === 'scales' && (
                    <>
                        <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-2 mb-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-300 font-bold">Speed:</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setScalePlaybackSpeed(s => Math.max(50, s - 50))}
                                        className="text-xs bg-purple-800/50 hover:bg-purple-700 text-purple-200 px-2 py-1 rounded border border-purple-700"
                                    >
                                        −
                                    </button>
                                    <span className="text-xs font-mono text-purple-300 min-w-[3rem] text-center">
                                        {scalePlaybackSpeed}ms
                                    </span>
                                    <button
                                        onClick={() => setScalePlaybackSpeed(s => Math.min(1000, s + 50))}
                                        className="text-xs bg-purple-800/50 hover:bg-purple-700 text-purple-200 px-2 py-1 rounded border border-purple-700"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-300 font-bold">Sort Saved:</span>
                                <div className="flex bg-black border border-purple-800 rounded">
                                    <button
                                        onClick={() => setSavedScaleSortMode('name')}
                                        className={`px-2 py-1 text-[9px] font-bold uppercase ${savedScaleSortMode === 'name' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Name
                                    </button>
                                    <button
                                        onClick={() => setSavedScaleSortMode('count')}
                                        className={`px-2 py-1 text-[9px] font-bold uppercase ${savedScaleSortMode === 'count' ? 'bg-purple-700 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Count
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-purple-300 font-bold">Timbre:</span>
                                <div className="flex items-center gap-1">
                                    {(['sine', 'triangle', 'sawtooth', 'square'] as const).map(w => (
                                        <button
                                            key={w}
                                            onClick={() => setScaleWaveform(w)}
                                            className={`text-[9px] px-2 py-1 rounded border uppercase font-bold ${scaleWaveform === w ? 'bg-purple-600 text-white border-purple-500' : 'bg-purple-900/30 text-purple-300 border-purple-700 hover:bg-purple-800/50'}`}
                                        >
                                            {w.slice(0, 3)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-900/10 border border-purple-800/50 rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-[10px] font-black text-purple-300 uppercase tracking-wider">Scala Archive</div>
                                    <div className="text-[9px] text-gray-500">v93 (Jan 2025) - {archiveTotalCount} scales</div>
                                </div>
                                <button
                                    onClick={() => setShowArchiveScales(v => !v)}
                                    className={`text-[9px] px-2 py-1 rounded border uppercase font-black tracking-widest ${showArchiveScales ? 'bg-purple-700 text-white border-purple-600' : 'bg-gray-800 text-gray-300 border-gray-700'}`}
                                >
                                    {showArchiveScales ? 'Hide' : 'Show'}
                                </button>
                            </div>
                            {hiddenArchiveEntries.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowHiddenArchive(v => !v)}
                                        className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900/50 text-gray-300 uppercase font-black tracking-widest"
                                    >
                                        {showHiddenArchive ? 'Hide Hidden' : `Hidden (${hiddenArchiveEntries.length})`}
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowAddScale(!showAddScale)}
                            className="w-full py-2 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-700/50 rounded-lg text-[10px] text-purple-300 font-black uppercase tracking-wider transition-colors"
                        >
                            {showAddScale ? '− Cancel' : '+ Add Custom Scale'}
                        </button>

                        {showAddScale && (
                            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3 space-y-2">
                                <input
                                    type="text"
                                    placeholder="Scale name..."
                                    value={newScaleName}
                                    onChange={e => setNewScaleName(e.target.value)}
                                    className="w-full bg-black/60 border border-purple-700/50 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
                                />
                                <textarea
                                    placeholder="Ratios (e.g., 1/1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8)"
                                    value={newScaleRatios}
                                    onChange={e => setNewScaleRatios(e.target.value)}
                                    rows={3}
                                    className="w-full bg-black/60 border border-purple-700/50 rounded px-2 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500 resize-none font-mono"
                                />
                                <button
                                    onClick={handleAddScale}
                                    disabled={!newScaleName.trim() || !newScaleRatios.trim()}
                                    className="w-full py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[10px] font-bold rounded uppercase transition-colors"
                                >
                                    Save Scale
                                </button>
                            </div>
                        )}

                        {filteredSavedScales.length > 0 ? (
                            <div className="space-y-2">
                                {filteredSavedScales.map(scale => (
                                    <div
                                        key={scale.id}
                                        className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3 hover:bg-purple-900/30 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-white font-bold">{scale.name}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleSendToRetuner(scale.id, scale.name, scale.scale)}
                                                    className="px-2 py-0.5 bg-indigo-900/50 hover:bg-indigo-700 text-indigo-200 text-[9px] font-bold rounded border border-indigo-800"
                                                    title="Send to Retuner"
                                                >
                                                    ➜ Retune
                                                </button>
                                                <button
                                                    onClick={() => handleSendToTuner(scale.name, scale.scale)}
                                                    className="px-2 py-0.5 bg-emerald-900/50 hover:bg-emerald-700 text-emerald-200 text-[9px] font-bold rounded border border-emerald-800"
                                                    title="Send to Tuner"
                                                >
                                                    Tuner
                                                </button>
                                                <button
                                                    onClick={() => handleSendToKeyboard(scale.name, scale.scale)}
                                                    className="px-2 py-0.5 bg-cyan-900/50 hover:bg-cyan-700 text-cyan-200 text-[9px] font-bold rounded border border-cyan-800"
                                                    title="Send to Keyboard"
                                                >
                                                    Keyboard
                                                </button>
                                                <button
                                                    onClick={() => playScale(scale.scale)}
                                                    className="px-2 py-0.5 bg-purple-800/50 hover:bg-purple-700 text-purple-200 text-[9px] font-bold rounded"
                                                >
                                                    ▶ Play
                                                </button>
                                                <button
                                                    onClick={() => deleteMidiScale(scale.id)}
                                                    className="px-2 py-0.5 bg-red-900/50 hover:bg-red-700 text-red-200 text-[9px] font-bold rounded"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {scale.scale.map((ratio, i) => {
                                                let cents = 0;
                                                try {
                                                    const r = parseGeneralRatio(ratio);
                                                    cents = calculateCents(r);
                                                } catch { }
                                                return (
                                                    <span
                                                        key={i}
                                                        className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] font-mono text-purple-300"
                                                        title={`${cents.toFixed(1)}¢`}
                                                    >
                                                        {ratio}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="text-[9px] text-gray-500 mt-1">{scale.scale.length} notes</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !showAddScale && (
                                <div className="text-center py-8 text-gray-500 text-xs">
                                    {searchQuery ? `No scales found matching "${searchQuery}"` : 'No custom scales saved yet. Use the Scale Builder or add one above.'}
                                </div>
                            )
                        )}

                        {showArchiveScales && (
                            <div className="space-y-2">
                                <div className="text-[10px] font-black text-purple-300 uppercase tracking-wider">Scala Archive Scales</div>
                                {archiveDisplayEntries.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <div className="min-w-[640px] border border-purple-900/30 rounded-lg overflow-hidden">
                                            <div className="grid grid-cols-[1.2fr_1.6fr_0.4fr_1.6fr_0.8fr] bg-purple-900/40 text-purple-200 text-[9px] font-bold uppercase tracking-widest">
                                                <div className="px-2 py-1.5 border-b border-purple-700/50">Name</div>
                                                <div className="px-2 py-1.5 border-b border-purple-700/50">Description</div>
                                                <div className="px-2 py-1.5 border-b border-purple-700/50 text-center">Count</div>
                                                <div className="px-2 py-1.5 border-b border-purple-700/50">Tones</div>
                                                <div className="px-2 py-1.5 border-b border-purple-700/50 text-center">Actions</div>
                                            </div>
                                            <VirtualList
                                                items={archiveDisplayEntries}
                                                itemHeight={36}
                                                height={Math.min(360, Math.max(36, archiveDisplayEntries.length * 36))}
                                                className="max-h-[360px] overflow-y-auto"
                                                getKey={(entry) => entry.id}
                                                renderItem={(entry) => {
                                                    const cached = archiveScaleCache[entry.id];
                                                    const tones = cached ? cached.ratios.map(r => {
                                                        try {
                                                            const ratio = parseGeneralRatio(r);
                                                            return (Number(ratio.n) / Number(ratio.d)).toFixed(5);
                                                        } catch { return r; }
                                                    }).join(', ') : '-';
                                                    return (
                                                        <div
                                                            className="grid grid-cols-[1.2fr_1.6fr_0.4fr_1.6fr_0.8fr] items-center text-[9px] border-b border-purple-800/30 hover:bg-purple-900/20 group cursor-pointer h-full"
                                                            onClick={async () => {
                                                                const scale = await loadArchiveScale(entry);
                                                                if (scale) setSelectedArchiveScale(scale);
                                                            }}
                                                        >
                                                            <div className="px-2 text-white font-bold truncate" title={entry.fileName}>{entry.displayName}</div>
                                                            <div className="px-2 text-gray-400 truncate" title={cached?.description}>{cached?.description || '-'}</div>
                                                            <div className="px-2 text-center text-purple-300 font-mono">{cached?.count ?? '-'}</div>
                                                            <div className="px-2 text-gray-500 font-mono truncate" title={tones}>{tones}</div>
                                                            <div className="px-2 text-center" onClick={e => e.stopPropagation()}>
                                                                <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => handlePlayArchiveScale(entry)} className="px-1.5 py-0.5 bg-purple-800/50 hover:bg-purple-700 text-purple-200 font-bold rounded" title="Play">Play</button>
                                                                    <button onClick={async () => {
                                                                        const s = await loadArchiveScale(entry);
                                                                        if (s) handleSendToRetuner(s.id, s.displayName, s.ratios);
                                                                    }} className="px-1.5 py-0.5 bg-indigo-900/50 hover:bg-indigo-700 text-indigo-200 font-bold rounded border border-indigo-800" title="Send to Retuner">Retune</button>
                                                                    <button onClick={() => handleSaveArchiveScale(entry)} className="px-1.5 py-0.5 bg-blue-900/50 hover:bg-blue-700 text-blue-200 font-bold rounded" title="Save">Save</button>
                                                                    <button onClick={async () => {
                                                                        const s = await loadArchiveScale(entry);
                                                                        if (s) handleSendToKeyboard(s.displayName, s.ratios);
                                                                    }} className="px-1.5 py-0.5 bg-cyan-900/50 hover:bg-cyan-700 text-cyan-200 font-bold rounded border border-cyan-800" title="Send to Keyboard">KB</button>
                                                                    <button onClick={async () => {
                                                                        const s = await loadArchiveScale(entry);
                                                                        if (s) handleSendToTuner(s.displayName, s.ratios);
                                                                    }} className="px-1.5 py-0.5 bg-emerald-900/50 hover:bg-emerald-700 text-emerald-200 font-bold rounded border border-emerald-800" title="Send to Tuner">Tuner</button>
                                                                    <button onClick={() => handleHideArchiveScale(entry.id)} className="px-1.5 py-0.5 bg-gray-900/60 hover:bg-gray-800 text-gray-300 font-bold rounded" title="Hide">Hide</button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-500 text-xs">
                                        {searchQuery ? `No archive scales found matching "${searchQuery}"` : 'No archive scales available.'}
                                    </div>
                                )}
                                {selectedArchiveScale && (
                                    <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-purple-200">{selectedArchiveScale.displayName}</span>
                                            <button
                                                onClick={() => setSelectedArchiveScale(null)}
                                                className="text-[9px] px-2 py-0.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
                                            >
                                                Close
                                            </button>
                                        </div>
                                        <div className="text-[9px] text-gray-400">{selectedArchiveScale.description}</div>
                                        <div className="grid grid-cols-3 gap-2 text-[9px]">
                                            <div><span className="text-gray-500">File:</span> <span className="text-gray-300 font-mono">{selectedArchiveScale.fileName}</span></div>
                                            <div><span className="text-gray-500">Notes:</span> <span className="text-purple-300 font-mono">{selectedArchiveScale.count}</span></div>
                                            <div><span className="text-gray-500">Period:</span> <span className="text-purple-300 font-mono">{selectedArchiveScale.periodCents?.toFixed(2) ?? 1200}¢</span></div>
                                        </div>
                                        <div className="text-[9px] text-gray-500 uppercase font-bold mt-2">Ratios & Cents</div>
                                        <div className="flex flex-wrap gap-1">
                                            {selectedArchiveScale.ratios.map((ratio, i) => {
                                                let cents = 0;
                                                try {
                                                    const r = parseGeneralRatio(ratio);
                                                    cents = calculateCents(r);
                                                } catch { }
                                                return (
                                                    <span key={i} className="px-1.5 py-0.5 bg-black/50 rounded text-[9px] font-mono text-purple-300">
                                                        {ratio} <span className="text-gray-500">({cents.toFixed(1)}¢)</span>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => playScale(selectedArchiveScale.ratios)}
                                                className="text-[9px] px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold"
                                            >
                                                ▶ Play
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const name = selectedArchiveScale.description?.trim() || selectedArchiveScale.displayName;
                                                    saveMidiScale(name, selectedArchiveScale.ratios);
                                                }}
                                                className="text-[9px] px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white rounded font-bold"
                                            >
                                                + Save to Library
                                            </button>
                                            <button
                                                onClick={() => handleSendToRetuner(selectedArchiveScale.id, selectedArchiveScale.displayName, selectedArchiveScale.ratios)}
                                                className="text-[9px] px-3 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold border border-indigo-500"
                                            >
                                                ➜ Send to Retuner
                                            </button>
                                            <button
                                                onClick={() => handleSendToKeyboard(selectedArchiveScale.displayName, selectedArchiveScale.ratios)}
                                                className="text-[9px] px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-bold border border-cyan-500"
                                            >
                                                Send to Keyboard
                                            </button>
                                            <button
                                                onClick={() => handleSendToTuner(selectedArchiveScale.displayName, selectedArchiveScale.ratios)}
                                                className="text-[9px] px-3 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold border border-emerald-500"
                                            >
                                                Send to Tuner
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {archiveHasMore && (
                                    <button
                                        onClick={() => setArchiveLimit(l => l + 200)}
                                        className="w-full py-2 bg-purple-900/20 hover:bg-purple-900/40 border border-purple-700/50 rounded-lg text-[10px] text-purple-300 font-black uppercase tracking-wider transition-colors"
                                    >
                                        Load More
                                    </button>
                                )}
                            </div>
                        )}

                        {showHiddenArchive && hiddenArchiveEntries.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Hidden Archive Scales</span>
                                    <button
                                        onClick={() => setHiddenArchiveIds(new Set())}
                                        className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900/50 text-gray-300 uppercase font-black tracking-widest"
                                    >
                                        Restore All
                                    </button>
                                </div>
                                {hiddenArchiveEntries.map(entry => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-lg px-2 py-1.5"
                                    >
                                        <span className="text-xs text-gray-300 font-bold truncate">{entry.displayName}</span>
                                        <button
                                            onClick={() => handleRestoreArchiveScale(entry.id)}
                                            className="text-[9px] px-2 py-0.5 bg-green-900/50 hover:bg-green-800 text-green-200 font-bold rounded"
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {activeSection === 'intervals' && (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Filter</label>
                                <select
                                    value={intervalFilterMode}
                                    onChange={(e) => setIntervalFilterMode(e.target.value as 'all' | 'limit' | 'category')}
                                    className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white px-2 py-1"
                                >
                                    <option value="all">All Intervals</option>
                                    <option value="limit">By Prime Limit</option>
                                    <option value="category">By Category</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Sort</label>
                                <select
                                    value={intervalSortMode}
                                    onChange={(e) => setIntervalSortMode(e.target.value as 'cents' | 'name' | 'ratio' | 'limit')}
                                    className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white px-2 py-1"
                                >
                                    <option value="cents">By Cents</option>
                                    <option value="name">By Name</option>
                                    <option value="ratio">By Ratio</option>
                                    <option value="limit">By Prime Limit</option>
                                </select>
                            </div>
                        </div>

                        {intervalFilterMode === 'limit' && (
                            <div className="mb-3">
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Prime Limit</label>
                                <select
                                    value={selectedLimit}
                                    onChange={(e) => setSelectedLimit(parseInt(e.target.value))}
                                    className="w-full bg-gray-800 border border-gray-700 rounded text-xs text-white px-2 py-1"
                                >
                                    {[3, 5, 7, 11, 13, 17, 19, 23, 29, 31].map(limit => (
                                        <option key={limit} value={limit}>{limit}-limit</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {intervalFilterMode === 'category' && (
                            <div className="mb-3">
                                <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Category</label>
                                <div className="grid grid-cols-2 gap-1">
                                    {(['pure', 'harmonic', 'melodic', 'comma'] as const).map(category => (
                                        <button
                                            key={category}
                                            onClick={() => setSelectedCategory(category)}
                                            className={`px-2 py-1 rounded text-xs font-bold uppercase border transition-colors ${selectedCategory === category
                                                ? getCategoryColor(category)
                                                : 'text-gray-500 bg-gray-900/20 border-gray-700 hover:text-gray-300'
                                                }`}
                                        >
                                            {category}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {filteredIntervals.length > 200 ? (
                            <VirtualList
                                items={filteredIntervals}
                                itemHeight={84}
                                height={Math.min(520, Math.max(84, filteredIntervals.length * 84))}
                                className="max-h-[520px] overflow-y-auto"
                                getKey={(interval, index) => `${interval.ratio.n}-${interval.ratio.d}-${index}`}
                                renderItem={(interval, index) => {
                                    const node = findNodeForInterval(interval);
                                    const isInLattice = !!node;

                                    return (
                                        <div key={`${interval.ratio.n}-${interval.ratio.d}-${index}`} className="bg-gray-900/40 border border-gray-800 rounded-lg p-2 h-full overflow-hidden">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-sm font-bold text-orange-300">
                                                            {interval.ratio.n}/{interval.ratio.d}
                                                        </span>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getCategoryColor(interval.category)}`}>
                                                            {interval.category}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500 font-mono">
                                                            {interval.primeLimit}L
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-white font-medium mb-1 truncate" title={interval.name}>
                                                        {interval.name}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[9px] text-gray-400">
                                                        <span className="font-mono">{interval.cents.toFixed(2)}c</span>
                                                        <span className="font-bold">{interval.shortName}</span>
                                                        <span className="font-mono">~{(Number(interval.ratio.n) / Number(interval.ratio.d)).toFixed(4)}</span>
                                                        {!isInLattice && (
                                                            <span className="text-yellow-500">Not in lattice</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isInLattice && (
                                                    <button
                                                        onClick={() => navigateToInterval(interval)}
                                                        className="ml-2 px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-[9px] font-bold rounded border border-orange-600 shrink-0"
                                                        title="Navigate to this interval"
                                                    >
                                                        Go
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                        ) : (
                            <div className="space-y-1">
                            {filteredIntervals.map((interval, index) => {
                                const node = findNodeForInterval(interval);
                                const isInLattice = !!node;

                                return (
                                    <div key={`${interval.ratio.n}-${interval.ratio.d}-${index}`} className="bg-gray-900/40 border border-gray-800 rounded-lg p-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-mono text-sm font-bold text-orange-300">
                                                        {interval.ratio.n}/{interval.ratio.d}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${getCategoryColor(interval.category)}`}>
                                                        {interval.category}
                                                    </span>
                                                    <span className="text-[9px] text-gray-500 font-mono">
                                                        {interval.primeLimit}L
                                                    </span>
                                                </div>
                                                <div className="text-xs text-white font-medium mb-1" title={interval.name}>
                                                    {interval.name}
                                                </div>
                                                <div className="flex items-center gap-3 text-[9px] text-gray-400">
                                                    <span className="font-mono">{interval.cents.toFixed(2)}c</span>
                                                    <span className="font-bold">{interval.shortName}</span>
                                                    <span className="font-mono">~{(Number(interval.ratio.n) / Number(interval.ratio.d)).toFixed(4)}</span>
                                                    {!isInLattice && (
                                                        <span className="text-yellow-500">Not in lattice</span>
                                                    )}
                                                </div>
                                            </div>
                                            {isInLattice && (
                                                <button
                                                    onClick={() => navigateToInterval(interval)}
                                                    className="ml-2 px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white text-[9px] font-bold rounded border border-orange-600 shrink-0"
                                                    title="Navigate to this interval"
                                                >
                                                    Go
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        )}

                        {filteredIntervals.length === 0 && (
                            <div className="text-center py-8 text-gray-500 text-xs">
                                {searchQuery ? `No intervals found matching "${searchQuery}"` : 'No intervals found with current filters'}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
