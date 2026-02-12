
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { shallow } from 'zustand/shallow';
import type { NodeData } from '../../types';
import { generateScale } from '../../utils/scaleGenerator';
import { formatRatio, calculateRelativeRatio, calculateCents } from '../../musicLogic';
import { playNote, startNote } from '../../audioEngine';

export const ScaleBuilder = () => {
    const {
      nodes,
      selectedNode,
      referenceNode,
      setCustomKeyboard,
      settings,
      saveMidiScale,
      updateSettings
    } = useStore((s) => ({
      nodes: s.nodes,
      selectedNode: s.selectedNode,
      referenceNode: s.referenceNode,
      setCustomKeyboard: s.setCustomKeyboard,
      settings: s.settings,
      saveMidiScale: s.saveMidiScale,
      updateSettings: s.updateSettings
    }), shallow);
    const [size, setSize] = useState(12);
    const [rootSource, setRootSource] = useState<'global' | 'selected' | 'reference'>('global');
    const [strategy, setStrategy] = useState<'simple' | 'accurate'>('simple');
    const [generatedNotes, setGeneratedNotes] = useState<NodeData[]>([]);
    const [lockedIndices, setLockedIndices] = useState<boolean[]>(new Array(12).fill(false));
    const [presetName, setPresetName] = useState("");

    const activeTimeouts = useRef<number[]>([]);
    const activeVoices = useRef<(() => void)[]>([]);

    const stopPlaying = () => {
        activeTimeouts.current.forEach(window.clearTimeout);
        activeTimeouts.current = [];
        activeVoices.current.forEach(stop => stop());
        activeVoices.current = [];
    };

    const getRootNode = () => {
        if (rootSource === 'selected' && selectedNode) return selectedNode;
        if (rootSource === 'reference' && referenceNode) return referenceNode;
        
        return nodes.find(n => n.gen === 0 && n.originLimit === 0) || nodes[0];
    };

    const handleGenerate = () => {
        const root = getRootNode();
        if (!root) return;

        const locks = generatedNotes.length === size ? generatedNotes.map((n, i) => lockedIndices[i] ? n : null) : new Array(size).fill(null);
        
        const newScale = generateScale(nodes, root, size, locks, strategy);
        setGeneratedNotes(newScale);
        
        if (generatedNotes.length !== size) {
            setLockedIndices(new Array(size).fill(false));
        }
    };

    const updateSize = (newSize: number) => {
        const val = Math.max(1, Math.min(100, isNaN(newSize) ? 12 : newSize));
        setSize(val);
        setLockedIndices(new Array(val).fill(false));
    };

    const toggleLock = (index: number) => {
        const next = [...lockedIndices];
        next[index] = !next[index];
        setLockedIndices(next);
    };

    const playScale = () => {
        stopPlaying();
        
        let delay = 0;
        const stepDuration = 0.25; 

        generatedNotes.forEach((n) => {
            const tId = window.setTimeout(() => {
                
                activeVoices.current.forEach(stop => stop());
                activeVoices.current = [];

                const stopFn = startNote(n, settings, 'click'); 
                activeVoices.current.push(stopFn);
                
                setTimeout(() => stopFn(), stepDuration * 1000);

            }, delay);
            activeTimeouts.current.push(tId);
            delay += stepDuration * 1000;
        });
    };

    useEffect(() => {
        return () => stopPlaying();
    }, []);

    const applyToKeyboard = () => {
        setCustomKeyboard(generatedNotes);
    };

    const saveToMaps = () => {
        if (!presetName) {
            notifyError('Enter a preset name.', 'Scale Builder');
            return;
        }
        const ratioStrings = generatedNotes.map(n => {
            
            const root = getRootNode();
            const rel = calculateRelativeRatio(root, n);
            return formatRatio(rel);
        });
        saveMidiScale(presetName, ratioStrings);
        setPresetName("");
        notifySuccess('Saved to MIDI Maps.', 'Scale Builder');
    };

    const mapToMidi = () => {
        const ratioStrings = generatedNotes.map(n => {
            const root = getRootNode();
            const rel = calculateRelativeRatio(root, n);
            return formatRatio(rel);
        });
        updateSettings({ 
            midi: { 
                ...settings.midi, 
                mappingMode: 'custom', 
                mappingScale: ratioStrings,
                mappingDivisions: size
            } 
        });
        notifySuccess('Applied to MIDI Mapping settings.', 'Scale Builder');
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50 p-2 overflow-hidden">
            <div className="flex flex-col gap-2 mb-3 bg-black/40 p-2 rounded border border-gray-700">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Root</label>
                    <select 
                        value={rootSource} 
                        onChange={(e) => setRootSource(e.target.value as any)} 
                        className="bg-gray-800 text-xs text-white border border-gray-600 rounded px-1 outline-none"
                    >
                        <option value="global">Global (1/1)</option>
                        <option value="selected" disabled={!selectedNode}>Selected</option>
                        <option value="reference" disabled={!referenceNode}>Reference</option>
                    </select>
                </div>
                
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Strategy</label>
                    <select 
                        value={strategy} 
                        onChange={(e) => setStrategy(e.target.value as any)} 
                        className="bg-gray-800 text-xs text-white border border-gray-600 rounded px-1 outline-none"
                    >
                        <option value="simple">Simplicity (JI Purity)</option>
                        <option value="accurate">Accuracy (TET Proximity)</option>
                    </select>
                </div>

                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Size</label>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            {[5, 7, 12, 19].map(s => (
                                <button 
                                    key={s} 
                                    onClick={() => updateSize(s)}
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded border ${size === s ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-400 border-gray-600'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <input 
                            type="number"
                            min="1" max="100"
                            value={size}
                            onChange={(e) => updateSize(parseInt(e.target.value))}
                            className="w-10 bg-black border border-gray-600 rounded text-center text-xs text-white p-0.5 outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
                <button onClick={handleGenerate} className="bg-green-700 hover:bg-green-600 text-white text-xs font-bold py-1.5 rounded uppercase tracking-wider shadow-lg">Generate Scale</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 pr-1 mb-3">
                {generatedNotes.length === 0 && <div className="text-gray-500 text-xs text-center italic py-4">Configure and click Generate</div>}
                {generatedNotes.map((note, i) => {
                    const root = getRootNode();
                    const relRatio = calculateRelativeRatio(root, note);
                    const cents = calculateCents(relRatio);
                    const idealCents = i * (1200 / size);
                    const diff = cents - idealCents;
                    const isFallback = (i > 0 && Math.abs(cents) < 0.1) || (i > 0 && note.id === root.id);
                    
                    return (
                        <div key={i} className={`flex items-center p-1 rounded border text-xs ${isFallback ? 'bg-red-900/20 border-red-800' : 'bg-gray-800/60 border-gray-700'}`}>
                            <input 
                                type="checkbox" 
                                checked={lockedIndices[i]} 
                                onChange={() => toggleLock(i)} 
                                className="mr-2 accent-yellow-500"
                                title="Lock this slot"
                            />
                            <span className="w-4 text-gray-500 font-mono text-[10px]">{i+1}</span>
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <span className={`font-bold truncate ${isFallback ? 'text-red-400' : 'text-blue-200'}`}>
                                    {isFallback ? '(No Candidate)' : note.name}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">{formatRatio(relRatio)}</span>
                            </div>
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-[10px] font-mono text-white">{cents.toFixed(0)}¢</span>
                                <span className={`text-[9px] ${Math.abs(diff) < 15 ? 'text-green-400' : 'text-yellow-500'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                </span>
                            </div>
                            <button onClick={() => playNote(note, settings)} className="text-[10px] bg-gray-700 hover:bg-white hover:text-black px-1.5 py-0.5 rounded">▶</button>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
                <button onClick={playScale} disabled={generatedNotes.length === 0} className="bg-gray-700 hover:bg-gray-600 text-white text-[10px] py-2 rounded font-bold uppercase disabled:opacity-50">Play Scale</button>
                <button onClick={applyToKeyboard} disabled={generatedNotes.length === 0} className="bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-[10px] py-2 rounded font-bold uppercase border border-blue-800 disabled:opacity-50">To Keyboard</button>
                <div className="col-span-2 flex gap-1">
                    <input 
                        type="text" 
                        placeholder="Preset Name..." 
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        className="bg-black border border-gray-600 rounded px-2 py-1 text-xs text-white flex-1 outline-none"
                    />
                    <button onClick={saveToMaps} disabled={generatedNotes.length === 0} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 rounded text-[10px] font-bold disabled:opacity-50">Save</button>
                </div>
                <button onClick={mapToMidi} disabled={generatedNotes.length === 0} className="col-span-2 bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[10px] py-2 rounded font-bold uppercase border border-purple-800 disabled:opacity-50">Apply to MIDI Input</button>
            </div>
        </div>
    );
};
