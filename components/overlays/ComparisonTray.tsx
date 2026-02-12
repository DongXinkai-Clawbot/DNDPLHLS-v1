
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import { formatRatio, calculateRelativeRatio, calculateCents, getChordRatio } from '../../musicLogic';
import { playNote, startNote } from '../../audioEngine';
import type { NodeData, ComparisonGroup } from '../../types';
import { VirtualList } from '../common/VirtualList';

export const ComparisonTray = () => {
    const {
      comparisonNodes,
      removeFromComparison,
      clearComparison,
      settings,
      selectNode,
      isComparisonVisible,
      toggleComparisonTray,
      saveChord,
      savedChords,
      deleteChord,
      loadChord,
      shiftComparisonOctave,
      comparisonGroups,
      addComparisonGroup,
      updateComparisonGroup,
      deleteComparisonGroup,
      toggleComparisonGroupVisibility,
      clearComparisonGroups,
      savedChordGroupCollections,
      saveChordGroupCollection,
      deleteChordGroupCollection,
      loadChordGroupCollection,
      progressionAddStep
    } = useStore((s) => ({
      comparisonNodes: s.comparisonNodes,
      removeFromComparison: s.removeFromComparison,
      clearComparison: s.clearComparison,
      settings: s.settings,
      selectNode: s.selectNode,
      isComparisonVisible: s.isComparisonVisible,
      toggleComparisonTray: s.toggleComparisonTray,
      saveChord: s.saveChord,
      savedChords: s.savedChords,
      deleteChord: s.deleteChord,
      loadChord: s.loadChord,
      shiftComparisonOctave: s.shiftComparisonOctave,
      comparisonGroups: s.comparisonGroups,
      addComparisonGroup: s.addComparisonGroup,
      updateComparisonGroup: s.updateComparisonGroup,
      deleteComparisonGroup: s.deleteComparisonGroup,
      toggleComparisonGroupVisibility: s.toggleComparisonGroupVisibility,
      clearComparisonGroups: s.clearComparisonGroups,
      savedChordGroupCollections: s.savedChordGroupCollections,
      saveChordGroupCollection: s.saveChordGroupCollection,
      deleteChordGroupCollection: s.deleteChordGroupCollection,
      loadChordGroupCollection: s.loadChordGroupCollection,
      progressionAddStep: s.progressionAddStep
    }), shallow);
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [chordName, setChordName] = useState("");
    const [showSavedList, setShowSavedList] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState("");
    const [showGroupInput, setShowGroupInput] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState("");
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

    const [showCollectionList, setShowCollectionList] = useState(false);
    const [showCollectionSaveInput, setShowCollectionSaveInput] = useState(false);
    const [collectionName, setCollectionName] = useState("");

    const activeVoices = useRef<(() => void)[]>([]);

    if (!isComparisonVisible) return null;

    const startChord = () => {
        if (comparisonNodes.length === 0) return;
        stopChord();
        comparisonNodes.forEach(node => {
            const stopFn = startNote(node, settings);
            activeVoices.current.push(stopFn);
        });
    };

    const stopChord = () => {
        activeVoices.current.forEach(stop => stop());
        activeVoices.current = [];
    };

    const playGroup = (group: ComparisonGroup) => {
        stopChord();
        group.nodes.forEach(node => {
            const stopFn = startNote(node, settings);
            activeVoices.current.push(stopFn);
        });
    };

    const handleSave = () => {
        if (!chordName.trim()) return;
        saveChord(chordName, comparisonNodes);
        setChordName("");
        setShowSaveInput(false);
    };

    const handleAddGroup = () => {
        if (comparisonNodes.length === 0) return;
        addComparisonGroup(groupNameInput.trim() || `Group ${comparisonGroups.length + 1}`, [...comparisonNodes]);
        setGroupNameInput("");
        setShowGroupInput(false);
    };

    const handleRenameGroup = (id: string) => {
        if (!editingGroupName.trim()) return;
        updateComparisonGroup(id, { name: editingGroupName.trim() });
        setEditingGroupId(null);
        setEditingGroupName("");
    };

    const loadGroupToPanel = (nodes: NodeData[]) => {
        if (!nodes || nodes.length === 0) return;
        
        useStore.setState({ comparisonNodes: [...nodes], isComparisonVisible: true });
    };

    const addGroupToSequencer = (group: ComparisonGroup) => {
        
        const existingChord = savedChords.find(c => c.name === group.name);
        if (!existingChord) {
            saveChord(group.name, group.nodes);
        }
        
        setTimeout(() => {
            const chords = useStore.getState().savedChords;
            const chord = chords.find(c => c.name === group.name);
            if (chord) {
                progressionAddStep(chord.id);
            }
        }, 50);
    };

    return (
        <div className="flex flex-col w-full h-full bg-gray-900/50">
            <div className="flex justify-between items-center w-full px-2 py-1 border-b border-gray-800 bg-gray-900/80 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Multi-Note Analysis</span>
                </div>
                <div className="flex gap-2 items-center" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                    <button
                        onMouseDown={startChord}
                        onMouseUp={stopChord}
                        onMouseLeave={stopChord}
                        onTouchStart={(e) => { e.preventDefault(); startChord(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopChord(); }}
                        className="text-[10px] bg-green-900/50 hover:bg-green-800 text-green-200 px-3 py-0.5 rounded border border-green-800 active:bg-green-600 transition-colors font-bold select-none"
                    >
                        Play All (Hold)
                    </button>

                    <div className="relative group">
                        <button onClick={() => setShowSavedList(!showSavedList)} className="text-[10px] text-blue-400 hover:text-white border border-blue-900/50 px-2 py-0.5 rounded bg-blue-900/20">
                            📂
                        </button>
                        {showSavedList && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                                {savedChords.length === 0 && <div className="p-2 text-[10px] text-gray-500">No saved chords</div>}
                                {savedChords.length > 0 && (
                                savedChords.length > 200 ? (
                                    <VirtualList
                                        items={savedChords}
                                        itemHeight={28}
                                        height={160}
                                        className="max-h-40 overflow-y-auto"
                                        getKey={(chord) => chord.id}
                                        renderItem={(chord) => (
                                            <div className="flex justify-between items-center p-1 hover:bg-gray-800 border-b border-gray-800 last:border-0">
                                                <button onClick={() => { loadChord(chord); setShowSavedList(false); }} className="text-[10px] text-left text-gray-300 flex-1 truncate">{chord.name}</button>
                                                <button onClick={() => deleteChord(chord.id)} className="text-[10px] text-red-500 px-1 hover:text-red-300">x</button>
                                            </div>
                                        )}
                                    />
                                ) : (
                                    savedChords.map(chord => (
                                        <div key={chord.id} className="flex justify-between items-center p-1 hover:bg-gray-800 border-b border-gray-800 last:border-0">
                                            <button onClick={() => { loadChord(chord); setShowSavedList(false); }} className="text-[10px] text-left text-gray-300 flex-1 truncate">{chord.name}</button>
                                            <button onClick={() => deleteChord(chord.id)} className="text-[10px] text-red-500 px-1 hover:text-red-300">x</button>
                                        </div>
                                    ))
                                )
                            )}
                            </div>
                        )}
                    </div>

                    <button onClick={() => setShowSaveInput(true)} className="text-[10px] text-gray-500 hover:text-white" title="Save Chord">💾</button>
                    <button onClick={clearComparison} className="text-[10px] text-gray-500 hover:text-white" title="Clear All">Clear</button>
                </div>
            </div>

            {showSaveInput && (
                <div className="p-2 bg-gray-800 border-b border-gray-700 flex gap-1 shrink-0">
                    <input
                        type="text"
                        value={chordName}
                        onChange={e => setChordName(e.target.value)}
                        placeholder="Chord Name..."
                        className="flex-1 bg-black border border-gray-600 rounded px-1 text-xs text-white"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                    />
                    <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-2 rounded">Save</button>
                    <button onClick={() => setShowSaveInput(false)} className="text-xs text-gray-400 px-1">Cancel</button>
                </div>
            )}

            <div className="p-2 flex flex-col items-center gap-2 overflow-y-auto custom-scrollbar flex-1">
                {comparisonNodes.length === 0 ? (
                    <div className="text-[10px] text-gray-500 py-2 italic">No notes. Add from Info Panel or click nodes.</div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar max-w-full pb-1 w-full shrink-0">
                        {comparisonNodes.map((node, index) => {
                            const prevNode = index > 0 ? comparisonNodes[index - 1] : null;
                            let relRatio = null;
                            let relCents = 0;

                            if (prevNode) {
                                relRatio = calculateRelativeRatio(prevNode, node);
                                relCents = calculateCents(relRatio);
                            } else {
                                relRatio = node.ratio;
                            }

                            return (
                                <div key={node.id} className="flex items-center shrink-0">
                                    {index > 0 && (
                                        <div className="flex flex-col items-center px-1 text-gray-500">
                                            <span className="text-[9px]">→</span>
                                            <span className="text-[9px] font-mono text-blue-300">{formatRatio(relRatio!)}</span>
                                            <span className="text-[9px] font-mono text-gray-600">{relCents.toFixed(2)}¢</span>
                                        </div>
                                    )}

                                    <div
                                        className="bg-gray-800 border border-gray-600 rounded p-2 flex flex-col min-w-[70px] cursor-pointer hover:bg-gray-700 relative group"
                                        onClick={() => selectNode(node)}
                                        title={node.name}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFromComparison(node.id); }}
                                            className="absolute -top-1 -right-1 bg-red-900 text-white w-3 h-3 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100"
                                        >
                                            ×
                                        </button>
                                        <span className="text-xs font-bold text-white truncate max-w-[70px]">{node.name}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{formatRatio(node.ratio)}</span>
                                        {index === 0 && <span className="text-[8px] text-yellow-500 uppercase mt-1">Ref</span>}
                                        <div className="flex gap-1 items-center justify-center mt-1" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
                                            <button onClick={(e) => { e.stopPropagation(); shiftComparisonOctave(node.id, -1); }} className="w-3 h-3 flex items-center justify-center text-[8px] bg-black hover:bg-gray-600 rounded text-gray-300">-</button>
                                            <button onClick={(e) => { e.stopPropagation(); shiftComparisonOctave(node.id, 1); }} className="w-3 h-3 flex items-center justify-center text-[8px] bg-black hover:bg-gray-600 rounded text-gray-300">+</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {comparisonNodes.length > 1 && (
                    <div className="w-full text-center border-t border-gray-800 pt-1 mt-auto">
                        <div className="mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Chord Ratio:</span>
                            <span className="text-xs font-mono text-green-300 select-all">{getChordRatio(comparisonNodes)}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 block">
                            Range: <span className="text-blue-300">{formatRatio(calculateRelativeRatio(comparisonNodes[0], comparisonNodes[comparisonNodes.length - 1]))}</span>
                        </span>
                        <div className="flex justify-center flex-wrap gap-2 mt-2">
                            {!showGroupInput ? (
                                <>
                                    <button
                                        onClick={() => setShowGroupInput(true)}
                                        className="text-[10px] bg-purple-900/50 hover:bg-purple-800 text-purple-200 px-3 py-1 rounded border border-purple-800 transition-colors"
                                    >
                                        + Add as Group
                                    </button>
                                    <button
                                        onClick={() => {
                                            
                                            const name = `Panel ${new Date().toLocaleTimeString()}`;
                                            saveChord(name, comparisonNodes);
                                            setTimeout(() => {
                                                const chords = useStore.getState().savedChords;
                                                const chord = chords.find(c => c.name === name);
                                                if (chord) progressionAddStep(chord.id);
                                            }, 50);
                                        }}
                                        className="text-[10px] bg-green-900/50 hover:bg-green-800 text-green-200 px-3 py-1 rounded border border-green-800 transition-colors"
                                        title="Add current panel nodes to sequencer"
                                    >
                                        🎹 Add to Seq
                                    </button>
                                </>
                            ) : (
                                <div className="flex gap-1">
                                    <input
                                        type="text"
                                        value={groupNameInput}
                                        onChange={e => setGroupNameInput(e.target.value)}
                                        placeholder="Group name..."
                                        className="bg-black border border-gray-600 rounded px-1 text-xs text-white w-24"
                                        autoFocus
                                        onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                                    />
                                    <button onClick={handleAddGroup} className="text-[10px] bg-purple-600 text-white px-2 rounded">Add</button>
                                    <button onClick={() => { setShowGroupInput(false); setGroupNameInput(""); }} className="text-[10px] text-gray-400">✕</button>
                                </div>
                            )}
                        </div>
                        <span className="text-[9px] text-gray-600 block mt-1">Shift+Enter: Quick save as group & clear panel</span>
                    </div>
                )}

                <div className="w-full border-t border-gray-800 pt-2 mt-2">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Collections</span>
                        <div className="flex gap-2 items-center">
                            <div className="relative">
                                <button
                                    onClick={() => setShowCollectionList(!showCollectionList)}
                                    className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1 border border-blue-900/30 px-2 py-0.5 rounded bg-blue-900/10"
                                    title="Load Saved Collection"
                                >
                                    📂 Load Set
                                </button>
                                {showCollectionList && (
                                    <div className="absolute bottom-full right-0 mb-1 w-64 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 max-h-48 overflow-y-auto">
                                        {(!savedChordGroupCollections || savedChordGroupCollections.length === 0) && <div className="p-2 text-[10px] text-gray-500">No saved collections</div>}
                                        {(savedChordGroupCollections || []).length > 200 ? (
                                            <VirtualList
                                                items={savedChordGroupCollections || []}
                                                itemHeight={36}
                                                height={192}
                                                className="max-h-48 overflow-y-auto"
                                                getKey={(collection) => collection.id}
                                                renderItem={(collection) => (
                                                    <div className="flex justify-between items-center p-2 hover:bg-gray-800 border-b border-gray-800 last:border-0 group">
                                                        <div className="flex flex-col flex-1 overflow-hidden cursor-pointer" onClick={() => { loadChordGroupCollection(collection); setShowCollectionList(false); }}>
                                                            <span className="text-[11px] text-gray-300 font-bold truncate group-hover:text-white">{collection.name}</span>
                                                            <span className="text-[9px] text-gray-500">{collection.groups.length} groups - {new Date(collection.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); deleteChordGroupCollection(collection.id); }} className="text-[10px] text-gray-600 hover:text-red-500 px-2 py-1">Delete</button>
                                                    </div>
                                                )}
                                            />
                                        ) : (
                                            (savedChordGroupCollections || []).map(collection => (
                                                <div key={collection.id} className="flex justify-between items-center p-2 hover:bg-gray-800 border-b border-gray-800 last:border-0 group">
                                                    <div className="flex flex-col flex-1 overflow-hidden cursor-pointer" onClick={() => { loadChordGroupCollection(collection); setShowCollectionList(false); }}>
                                                        <span className="text-[11px] text-gray-300 font-bold truncate group-hover:text-white">{collection.name}</span>
                                                        <span className="text-[9px] text-gray-500">{collection.groups.length} groups - {new Date(collection.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteChordGroupCollection(collection.id); }} className="text-[10px] text-gray-600 hover:text-red-500 px-2 py-1">Delete</button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {!showCollectionSaveInput ? (
                                <button
                                    onClick={() => setShowCollectionSaveInput(true)}
                                    className={`text-[10px] px-2 py-0.5 rounded ${comparisonGroups.length > 0 ? 'text-green-400 hover:text-white border border-green-900/30 bg-green-900/10' : 'text-gray-600 cursor-not-allowed border border-gray-800'}`}
                                    disabled={comparisonGroups.length === 0}
                                    title="Save All Groups as a Set"
                                >
                                    💾 Save Set
                                </button>
                            ) : (
                                <div className="flex gap-1 items-center bg-black border border-gray-600 rounded px-1">
                                    <input
                                        type="text"
                                        value={collectionName}
                                        onChange={e => setCollectionName(e.target.value)}
                                        placeholder="Name..."
                                        className="bg-transparent border-none text-[10px] text-white w-20 outline-none"
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                saveChordGroupCollection(collectionName);
                                                setShowCollectionSaveInput(false);
                                                setCollectionName("");
                                            }
                                        }}
                                    />
                                    <button onClick={() => {
                                        saveChordGroupCollection(collectionName);
                                        setShowCollectionSaveInput(false);
                                        setCollectionName("");
                                    }} className="text-[10px] text-green-400 hover:text-green-300">✓</button>
                                    <button onClick={() => { setShowCollectionSaveInput(false); setCollectionName(""); }} className="text-[10px] text-gray-400 hover:text-gray-300">✕</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {comparisonGroups.length > 0 && (
                    <div className="w-full border-t border-gray-800 pt-2 mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chord Groups</span>
                            <button
                                onClick={clearComparisonGroups}
                                className="text-[9px] text-red-400 hover:text-red-300"
                            >
                                Clear All
                            </button>
                        </div>
                        <div className="flex flex-col gap-1">
                            {comparisonGroups.map(group => (
                                <div key={group.id} className="flex flex-col">
                                    <div
                                        className="flex items-center gap-2 p-1.5 bg-gray-800/50 rounded border border-gray-700 hover:bg-gray-800"
                                    >
                                        <button
                                            onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                                            className="text-[10px] text-gray-400 hover:text-white px-0.5"
                                            title={expandedGroupId === group.id ? "Collapse" : "Expand to select chords"}
                                        >
                                            {expandedGroupId === group.id ? '▼' : '▶'}
                                        </button>

                                        <div
                                            className="w-3 h-3 rounded-full shrink-0 border border-white/20"
                                            style={{ backgroundColor: group.color }}
                                        />

                                        {editingGroupId === group.id ? (
                                            <input
                                                type="text"
                                                value={editingGroupName}
                                                onChange={e => setEditingGroupName(e.target.value)}
                                                onBlur={() => handleRenameGroup(group.id)}
                                                onKeyDown={e => e.key === 'Enter' && handleRenameGroup(group.id)}
                                                className="flex-1 bg-black border border-gray-600 rounded px-1 text-[10px] text-white"
                                                autoFocus
                                            />
                                        ) : (
                                            <span
                                                className="flex-1 text-[10px] text-gray-300 truncate cursor-pointer hover:text-white"
                                                onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                                                title="Click to rename"
                                            >
                                                {group.name}
                                            </span>
                                        )}

                                        <span className="text-[9px] text-gray-500">{group.nodes.length} notes</span>

                                        <button
                                            onMouseDown={() => playGroup(group)}
                                            onMouseUp={stopChord}
                                            onMouseLeave={stopChord}
                                            className="text-[10px] text-green-400 hover:text-green-300 px-1"
                                            title="Play (hold)"
                                        >
                                            ▶
                                        </button>

                                        <button
                                            onClick={() => toggleComparisonGroupVisibility(group.id)}
                                            className={`text-[10px] px-1 ${group.visible ? 'text-blue-400 hover:text-blue-300' : 'text-gray-600 hover:text-gray-400'}`}
                                            title={group.visible ? "Hide line" : "Show line"}
                                        >
                                            {group.visible ? '👁' : '👁‍🗨'}
                                        </button>

                                        <button
                                            onClick={() => deleteComparisonGroup(group.id)}
                                            className="text-[10px] text-red-500 hover:text-red-300 px-1"
                                            title="Delete group"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {expandedGroupId === group.id && (
                                        <div className="ml-4 mt-1 p-2 bg-gray-900/80 rounded border border-gray-700 space-y-1">
                                            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">
                                                Group Chords (click to load, 💾 to save to library)
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {group.nodes.map((node, idx) => (
                                                    <div
                                                        key={node.id}
                                                        className="flex items-center gap-1 bg-gray-800 px-2 py-1 rounded border border-gray-600 hover:border-gray-400"
                                                    >
                                                        <span className="text-[10px] text-gray-300">{node.name}</span>
                                                        <span className="text-[9px] text-gray-500 font-mono">{formatRatio(node.ratio)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-700">
                                                <button
                                                    onClick={() => {
                                                        saveChord(group.name, group.nodes);
                                                    }}
                                                    className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800"
                                                    title="Save entire group as a chord to library"
                                                >
                                                    💾 Save to Library
                                                </button>
                                                <button
                                                    onClick={() => loadGroupToPanel(group.nodes)}
                                                    className="text-[9px] bg-purple-900/50 hover:bg-purple-800 text-purple-200 px-2 py-1 rounded border border-purple-800"
                                                    title="Load group nodes into comparison panel"
                                                >
                                                    📂 Load to Panel
                                                </button>
                                                <button
                                                    onClick={() => addGroupToSequencer(group)}
                                                    className="text-[9px] bg-green-900/50 hover:bg-green-800 text-green-200 px-2 py-1 rounded border border-green-800"
                                                    title="Add group as step to chord sequencer"
                                                >
                                                    🎹 Add to Sequencer
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
