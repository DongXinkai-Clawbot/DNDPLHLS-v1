
import React, { useState, useEffect } from 'react';
import { FunctionGallery } from './FunctionGallery';
import { GraphEditor } from './GraphEditor';
import { NoteSetInspector } from './NoteSetInspector';
import { MathObjectList } from './MathObjectList';
import { ConsequentialBuilder } from '../ConsequentialBuilder';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { MathObject, MathFunctionPreset, ConsequentialScaleConfig, MathLabState } from '../../../types';
import { createLogger } from '../../../utils/logger';
import { notifySuccess, notifyWarning } from '../../../utils/notifications';
import { STORAGE_KEYS } from '../../../store/logic/storageKeys';
import { createDefaultMathLabState, migrateMathLabState, MATHLAB_SCHEMA_VERSION } from '../../../utils/mathLabSchema';

const log = createLogger('ui/math-tab');

export const MathFunctionTab = () => {
    const {
      addMathObject,
      setMathView,
      setMathEditorState,
      mathLab,
      setMathLabState,
      addConsequentialScale,
      setActiveConsequentialScale
    } = useStore((s) => ({
      addMathObject: s.addMathObject,
      setMathView: s.setMathView,
      setMathEditorState: s.setMathEditorState,
      mathLab: s.mathLab,
      setMathLabState: s.setMathLabState,
      addConsequentialScale: s.addConsequentialScale,
      setActiveConsequentialScale: s.setActiveConsequentialScale
    }), shallow);
    const editor = mathLab?.editor || { tool: 'pan', selectedDotId: null, selectedObjectId: null, hoverDotId: null, showThumbnails: true, showDotLabels: true, showDebugPitch: false };

    const [subTab, setSubTab] = useState<'grapher' | 'consequential'>('consequential');
    const [leftPanelMode, setLeftPanelMode] = useState<'library' | 'objects'>('library');
    const [importMode, setImportMode] = useState<'replace' | 'merge' | 'objects_only'>('merge');

    const [showWarning, setShowWarning] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    useEffect(() => {
        try {
            const dismissed = localStorage.getItem(STORAGE_KEYS.mathWarningDismissed);
            if (dismissed !== 'true') {
                setShowWarning(true);
            }
        } catch (e) {
            
        }
    }, []);

    useEffect(() => {
        if (subTab !== 'grapher') {
            window.dispatchEvent(new Event('mathlab-stop-playback'));
        }
    }, [subTab]);

    const handleDismissWarning = () => {
        if (dontShowAgain) {
            try {
                localStorage.setItem(STORAGE_KEYS.mathWarningDismissed, 'true');
            } catch (e) {
                log.warn('Failed to save warning preference', e);
            }
        }
        setShowWarning(false);
    };

    const handleSelectPreset = (p: MathFunctionPreset) => {
        const palette = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#14b8a6', '#f97316', '#ec4899'];
        const used = new Set((mathLab.objects || []).map(o => o.color));
        const nextColor = palette.find(c => !used.has(c)) || palette[Math.floor(Math.random() * palette.length)];
        const obj: MathObject = {
            id: `obj-${Date.now()}`,
            name: p.name || p.expression.slice(0, 24),
            type: p.type,
            expression: p.expression,
            params: p.params,
            visible: true,
            color: nextColor,
            locked: false,
            mappingEnabled: true,
            group: p.category || 'default',
            order: (mathLab.objects || []).length,
            angleUnit: 'rad',
            polarNegativeMode: 'allow'
        };
        addMathObject(obj);
        setMathView(p.suggestedView);
        setMathEditorState({ selectedObjectId: obj.id });
        setLeftPanelMode('objects'); 
    };

    const handleToolChange = (tool: any) => setMathEditorState({ tool });

    const handleExportToConsequential = (config: ConsequentialScaleConfig) => {
        addConsequentialScale(config);
        setActiveConsequentialScale(config.id);
        setSubTab('consequential');
    };

    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    const exportMathLabProject = () => {
        try {
            const payload = {
                version: MATHLAB_SCHEMA_VERSION,
                exportedAt: new Date().toISOString(),
                mathLab: mathLab
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mathlab-project-${Date.now().toString(36)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            log.warn('Failed to export MathLab project', e);
        }
    };

    const mergeMathLabState = (incoming: MathLabState) => {
        const current = mathLab || createDefaultMathLabState();
        const nextObjects = [...current.objects];
        const nextNoteSets = [...current.noteSets];
        const existingObjectIds = new Set(nextObjects.map(o => o.id));
        const existingNoteSetIds = new Set(nextNoteSets.map(n => n.id));
        const nextScales = [...(current.consequentialScales || [])];
        const existingScaleIds = new Set(nextScales.map(s => s.id));

        const appendObjects = incoming.objects.map((o, idx) => {
            let id = o.id;
            if (existingObjectIds.has(id)) {
                id = `imp-obj-${Date.now().toString(36)}-${idx}`;
            }
            existingObjectIds.add(id);
            return { ...o, id, order: nextObjects.length + idx };
        });

        const appendNoteSets = incoming.noteSets.map((n, idx) => {
            let id = n.id;
            if (existingNoteSetIds.has(id)) {
                id = `imp-set-${Date.now().toString(36)}-${idx}`;
            }
            existingNoteSetIds.add(id);
            return { ...n, id };
        });

        const appendScales = (incoming.consequentialScales || []).map((s, idx) => {
            let id = s.id;
            if (existingScaleIds.has(id)) {
                id = `imp-scale-${Date.now().toString(36)}-${idx}`;
            }
            existingScaleIds.add(id);
            return { ...s, id };
        });

        const unified = current.unifiedFunctionState || { variableBindings: {}, variableDefs: {} };
        const incomingUnified = incoming.unifiedFunctionState || { variableBindings: {}, variableDefs: {} };

        return {
            ...current,
            objects: [...nextObjects, ...appendObjects],
            noteSets: [...nextNoteSets, ...appendNoteSets],
            consequentialScales: [...nextScales, ...appendScales],
            unifiedFunctionState: {
                variableBindings: { ...incomingUnified.variableBindings, ...unified.variableBindings },
                variableDefs: { ...incomingUnified.variableDefs, ...unified.variableDefs }
            }
        };
    };

    const handleImportFile = async (file: File) => {
        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw);
            const incoming = parsed?.mathLab ? parsed.mathLab : parsed;
            const current = mathLab || createDefaultMathLabState();
            const migrated = migrateMathLabState(incoming, current);
            if (migrated.warnings.length) {
                log.warn('MathLab import warnings', migrated.warnings);
                notifyWarning(`Import warnings: ${migrated.warnings.slice(0, 2).join('; ')}`, 'Math Lab');
            }

            try {
                localStorage.setItem('ql_mathlab_backup', JSON.stringify(current));
            } catch (e) {
                log.warn('Failed to write MathLab backup', e);
            }

            if (importMode === 'replace') {
                setMathLabState(migrated.next);
            } else if (importMode === 'objects_only') {
                const merged = mergeMathLabState({
                    ...current,
                    objects: migrated.next.objects,
                    noteSets: [],
                    consequentialScales: [],
                    unifiedFunctionState: migrated.next.unifiedFunctionState
                });
                setMathLabState(merged);
            } else {
                const merged = mergeMathLabState(migrated.next);
                setMathLabState(merged);
            }
            notifySuccess('Math Lab project imported.', 'Math Lab');
        } catch (e) {
            log.warn('Failed to import MathLab project', e);
            notifyWarning('Failed to import project. Check file format.', 'Math Lab');
        }
    };

    const warningModal = showWarning ? (
        <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                className="bg-gray-900 border border-yellow-600/50 p-6 rounded-xl max-w-md w-full shadow-2xl animate-in zoom-in duration-200"
                onPointerDown={(e) => e.stopPropagation()} 
            >
                <div className="flex items-center gap-3 mb-4 text-yellow-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="text-xl font-bold">Experimental Feature</h3>
                </div>
                <p className="text-gray-300 text-xs leading-relaxed mb-6">
                    The <strong>Math Lab</strong> and <strong>Consequential Scale Builder</strong> are currently in active development.
                    <br /><br />
                    You may encounter unexpected behavior, audio glitches, or calculation errors. Complex functions may impact performance.
                </p>

                <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="rounded border-gray-600 bg-gray-800 accent-yellow-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-[10px] text-gray-400">Don't show this again</span>
                    </label>
                    <button
                        onClick={handleDismissWarning}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded text-xs transition-colors"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    const consequentialTabClass = "text-[10px] uppercase font-bold " + (subTab === "consequential" ? "text-blue-400 border-b-2 border-blue-500 px-3 py-1" : "text-gray-400 hover:text-white px-3 py-1 transition-colors");
    const grapherTabClass = "text-[10px] uppercase font-bold " + (subTab === "grapher" ? "text-blue-400 border-b-2 border-blue-500 px-3 py-1" : "text-gray-400 hover:text-white px-3 py-1 transition-colors");

    if (subTab === 'consequential') {
        return (
            <div key="consequential-view" className="flex flex-col h-full w-full bg-black overflow-hidden relative animate-in fade-in duration-300">
                {warningModal}
                <div id="config-utilities-tools" className="bg-gray-900 border-b border-gray-800 p-1 flex justify-center gap-2 shrink-0">

                    <button onClick={() => setSubTab('consequential')} className={consequentialTabClass}>Harmonic Superposition</button>
                    <button onClick={() => setSubTab('grapher')} className={grapherTabClass}>Function Grapher</button>
                </div>
                <ConsequentialBuilder />
            </div>
        )
    }

    return (
        <div key="grapher-view" className="flex flex-col h-full w-full bg-black overflow-hidden relative animate-in fade-in duration-300">
            {warningModal}
            <div id="config-utilities-tools" className="bg-gray-900 border-b border-gray-800 p-1 flex justify-center gap-2 shrink-0">

                <button onClick={() => setSubTab('consequential')} className={consequentialTabClass}>Harmonic Superposition</button>
                <button onClick={() => setSubTab('grapher')} className={grapherTabClass}>Function Grapher</button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar */}
                <div className="flex flex-col w-64 border-r border-gray-800 shrink-0 bg-gray-950">
                    <div className="flex flex-col gap-2 p-2 border-b border-gray-800">
                        <div className="flex gap-1">
                            <button onClick={exportMathLabProject} className="flex-1 text-[9px] bg-gray-800 border border-gray-700 rounded py-1 hover:text-white">Export</button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex-1 text-[9px] bg-gray-800 border border-gray-700 rounded py-1 hover:text-white">Import</button>
                        </div>
                        <div className="flex gap-1">
                            <select value={importMode} onChange={(e) => setImportMode(e.target.value as any)} className="flex-1 text-[9px] bg-black border border-gray-700 rounded px-1 py-0.5 text-gray-300">
                                <option value="merge">Merge</option>
                                <option value="replace">Replace</option>
                                <option value="objects_only">Objects Only</option>
                            </select>
                            <button onClick={() => setMathLabState(createDefaultMathLabState())} className="text-[9px] bg-red-900 border border-red-700 rounded px-2 py-0.5 hover:text-white">Reset</button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImportFile(f);
                                e.currentTarget.value = '';
                            }}
                        />
                    </div>
                    <div className="flex border-b border-gray-800">
                        <button
                            onClick={() => setLeftPanelMode('library')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase ${leftPanelMode === 'library' ? 'text-white bg-gray-800' : 'text-gray-500 hover:bg-gray-900'}`}
                        >
                            Library
                        </button>
                        <button
                            onClick={() => setLeftPanelMode('objects')}
                            className={`flex-1 py-2 text-[10px] font-bold uppercase ${leftPanelMode === 'objects' ? 'text-white bg-gray-800' : 'text-gray-500 hover:bg-gray-900'}`}
                        >
                            Objects ({mathLab.objects.length})
                        </button>
                    </div>
                    {leftPanelMode === 'library' ? (
                        <FunctionGallery onSelect={handleSelectPreset} />
                    ) : (
                        <MathObjectList onExportToConsequential={handleExportToConsequential} />
                    )}
                </div>

                {/* Center: Editor */}
                <div className="flex-1 flex flex-col relative min-w-0">
                    {/* Toolbar */}
                    <div className="bg-gray-900 border-b border-gray-800 p-2 flex justify-center gap-2 shrink-0">
                        <div className="flex bg-black rounded p-0.5 border border-gray-700">
                            {['pan', 'select', 'add_dot', 'delete'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => handleToolChange(t)}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded transition-colors ${editor.tool === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    {t.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-[10px] text-gray-400 bg-black px-2 rounded border border-gray-800 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" checked={editor.showDotLabels} onChange={e => setMathEditorState({ showDotLabels: e.target.checked })} className="accent-blue-500" />
                            Labels
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-gray-400 bg-black px-2 rounded border border-gray-800 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" checked={editor.showDebugPitch} onChange={e => setMathEditorState({ showDebugPitch: e.target.checked })} className="accent-blue-500" />
                            Pitch Info
                        </label>
                    </div>

                    <div className="flex-1 relative">
                        <GraphEditor />
                    </div>
                </div>

                {/* Right: Inspector */}
                <NoteSetInspector />
            </div>
        </div>
    );
};
