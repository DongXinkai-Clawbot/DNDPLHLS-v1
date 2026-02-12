import React, { useState, useRef } from 'react';
import { GM_WAVEFORMS, GM_INSTRUMENTS } from '../../gmConstants';
import { PatchEditor, ensurePatch } from '../common/SynthPatchEditor';
import { TunerPanel } from './audio/TunerPanel';

export const AudioTab = ({ settings, handleSettingChange, customSampleNames, uploadCustomSample, onInteractionStart, onInteractionEnd }: any) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sampleName, setSampleName] = useState("");

    const waveforms = ['sine', 'triangle', 'square', 'sawtooth', 'custom-synth', ...(customSampleNames || []), 'organ', 'epiano', 'strings', 'pad', 'brass', 'bell', 'nes', 'synth-bass'];
    const timbrePatches = settings.timbre?.patches || [];
    const activeTimbreId = settings.timbre?.activePatchId || timbrePatches[0]?.id || '';
    // Create options including GM
    const waveformOptions = [
        ...waveforms.map((w) => ({ value: w, label: w })),
        ...GM_INSTRUMENTS.map((inst) => ({ value: `gm-${inst.id}`, label: `GM: ${inst.name}` }))
    ];
    const timbreOptions = timbrePatches.map((p: any) => ({ value: `timbre:${p.id}`, label: `Timbre: ${p.name}` }));
    const instrumentOptions = [...waveformOptions, ...timbreOptions];

    return (
        <div className="space-y-4">
            <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-gray-400 font-bold uppercase">Base Frequency (1/1)</span>
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            min="20"
                            max="20000"
                            step="0.1"
                            value={settings.baseFrequency}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) handleSettingChange({ baseFrequency: val }, true);
                            }}
                            className="w-16 bg-black border border-gray-600 rounded text-right px-1 text-white outline-none focus:border-blue-500 font-mono"
                        />
                        <span className="font-mono text-white">Hz</span>
                    </div>
                </div>
                <input
                    type="range"
                    min="220" max="880" step="0.1"
                    value={settings.baseFrequency}
                    onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd}
                    onChange={(e) => handleSettingChange({ baseFrequency: parseFloat(e.target.value) }, false)}
                    className="w-full h-1 accent-blue-500 appearance-none bg-gray-700 rounded cursor-pointer mt-2"
                />
            </div>

            <div className="grid grid-cols-2 gap-2">
                {[
                    { label: 'Click (Select)', key: 'instrumentClick' },
                    { label: 'Keyboard', key: 'instrumentKeyboard' },
                    { label: 'Chord Analysis', key: 'instrumentChord' }
                ].map(inst => (
                    <div key={inst.key} className="flex flex-col">
                        <label className="text-[9px] text-gray-500 font-bold uppercase mb-1">{inst.label}</label>
                        <select
                            value={settings[inst.key] || settings.waveform}
                            onChange={(e) => handleSettingChange({ [inst.key]: e.target.value })}
                            className="bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none"
                        >
                            {instrumentOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase">Timbre Engine</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={(settings.timbre?.engineMode || 'basic') === 'timbre'}
                            onChange={(e) => handleSettingChange({ timbre: { ...settings.timbre, engineMode: e.target.checked ? 'timbre' : 'basic' } })}
                            className="w-3 h-3 accent-blue-500"
                        />
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Enable</span>
                    </label>
                </div>
                {timbrePatches.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <label className="text-[9px] text-gray-500 font-bold uppercase mb-1">Active Patch</label>
                            <select
                                value={activeTimbreId}
                                onChange={(e) => handleSettingChange({ timbre: { ...settings.timbre, activePatchId: e.target.value } })}
                                className="bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none"
                            >
                                {timbrePatches.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    if (!activeTimbreId) return;
                                    const map = settings.timbre?.mapping || { globalEnabled: true, byContext: true, byNoteLabel: false, noteKeyMode: 'full', noteKeyMap: {}, contextMap: { click: activeTimbreId, keyboard: activeTimbreId, sequence: activeTimbreId } };
                                    handleSettingChange({
                                        timbre: {
                                            ...settings.timbre,
                                            engineMode: 'timbre',
                                            activePatchId: activeTimbreId,
                                            mapping: {
                                                ...map,
                                                globalEnabled: true,
                                                byContext: true,
                                                contextMap: {
                                                    ...map.contextMap,
                                                    click: activeTimbreId,
                                                    keyboard: activeTimbreId,
                                                    sequence: activeTimbreId
                                                }
                                            }
                                        }
                                    });
                                }}
                                className="w-full bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase"
                            >
                                Use In Audio
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-[9px] text-gray-500">No timbre patches available. Create one in Timbre.</div>
                )}
                <div className="text-[9px] text-gray-600">When enabled, click/keyboard/chord playback uses the Timbre engine.</div>
            </div>

            <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase">Playback Duration</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 font-bold"><span>Single</span><span className="text-white">{settings.playDurationSingle}s</span></div>
                        <input type="range" min="0.1" max="5.0" step="0.1" value={settings.playDurationSingle} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={(e) => handleSettingChange({ playDurationSingle: parseFloat(e.target.value) }, false)} className="w-full h-1 accent-green-500 appearance-none bg-gray-700 rounded" />
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-gray-500 mb-1 font-bold"><span>Chord</span><span className="text-white">{settings.playDurationDual}s</span></div>
                        <input type="range" min="0.5" max="10.0" step="0.5" value={settings.playDurationDual} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={(e) => handleSettingChange({ playDurationDual: parseFloat(e.target.value) }, false)} className="w-full h-1 accent-purple-500 appearance-none bg-gray-700 rounded" />
                    </div>
                </div>
            </div>

            <div className="p-3 bg-gray-900/80 border border-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Synthesizer Patches</h4>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.synthPatches?.enabled ?? false}
                            onChange={(e) => handleSettingChange({ synthPatches: { ...settings.synthPatches, enabled: e.target.checked } })}
                            className="w-3 h-3 accent-blue-500"
                        />
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Enable</span>
                    </label>
                </div>

                {settings.synthPatches?.enabled && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        <PatchEditor
                            title="Click / Select Patch"
                            patch={ensurePatch(settings.synthPatches.clickPatch)}
                            onPatch={(p) => handleSettingChange({ synthPatches: { ...settings.synthPatches, clickPatch: p } })}
                        />
                        <PatchEditor
                            title="Keyboard Patch"
                            patch={ensurePatch(settings.synthPatches.keyboardPatch)}
                            onPatch={(p) => handleSettingChange({ synthPatches: { ...settings.synthPatches, keyboardPatch: p } })}
                        />
                        <PatchEditor
                            title="Chord Patch"
                            patch={ensurePatch(settings.synthPatches.chordPatch)}
                            onPatch={(p) => handleSettingChange({ synthPatches: { ...settings.synthPatches, chordPatch: p } })}
                        />
                    </div>
                )}
            </div>

            <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
                <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Upload Custom Sample</label>
                <div className="flex gap-2">
                    <input type="text" placeholder="Sample Name" value={sampleName} onChange={e => setSampleName(e.target.value)} className="bg-black border border-gray-700 text-xs p-1.5 rounded text-white flex-1 outline-none focus:border-blue-500" />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase">Select File</button>
                </div>
                <input type="file" ref={fileInputRef} accept="audio/*" className="hidden" onChange={e => { if (e.target.files?.[0] && sampleName) { uploadCustomSample(sampleName, e.target.files[0]); setSampleName(""); } }} />
            </div>

            <TunerPanel
                tuner={settings.tuner}
                onChange={(next) => handleSettingChange({ tuner: next })}
            />
        </div>
    );
};
