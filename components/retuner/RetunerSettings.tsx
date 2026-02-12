
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../types';
import { RetunerType, InputType, MpeZoneType, MappingMode, ChannelFilterMode, RetunerRoute } from '../../domain/retuner/types';
import { OutputDestination, createDefaultDestination, DestinationType } from '../../domain/retuner/destination';
import { PluginManager } from './PluginManager';
import { listMidiOutputs, listMidiInputs } from '../../midiOut';

interface RetunerSettingsProps {
    settings: AppSettings;
    onUpdate: (partial: Partial<AppSettings>) => void;
}

export const RetunerSettingsPanel: React.FC<RetunerSettingsProps> = ({ settings, onUpdate }) => {
    const [midiOutputs, setMidiOutputs] = useState<{ id: string; name: string }[]>([]);
    const [midiInputs, setMidiInputs] = useState<{ id: string; name: string }[]>([]);
    const [mappingTableText, setMappingTableText] = useState<string>('');

    const r = (settings as any).retuner || {
        enabled: false,
        mode: 'none',
        destinationId: null,
        monoPolicy: 'steal',
        zone: { startChannel: 2, endChannel: 16, useGlobalChannel: true },
        stealPolicy: 'oldest',
        resetPbOnNoteOff: false,
        group: 'Off',
        input: {
            type: 'midi',
            pitchBendRangeSteps: 2,
            mappingMode: 'lattice',
            baseTuning: { a4Hz: 440, baseNote: 69, rootNote: 60 },
            sourceFilter: {
                sourceIds: [],
                channelMode: 'all',
                channelRange: { min: 1, max: 16 },
                channelList: [],
                noteRange: { min: 0, max: 127 },
            },
            mappingTable: [],
            loopbackGuard: { enabled: true, mode: 'basic', windowMs: 120 },
        },
        mpeZone: null,
        preflight: { notePolicy: 'queue', maxQueueSize: 64, queueTimeoutMs: 1000, configTimeoutMs: 2000 },
        tuningChangePolicy: { mode: 'new-notes-only', rampMs: 50 },
        routes: [],
        panicOnDestinationChange: true,
        panicOnModeChange: true,
        panicOnZoneChange: true,
        panicOnPbRangeChange: true,
    };

    const destinations: OutputDestination[] = (settings as any).retunerDestinations || [];
    const activeDestination = destinations.find(d => d.id === r.destinationId) || destinations[0] || null;
    const activeRuntime = activeDestination ? (settings as any).retunerState?.destinationStatus?.[activeDestination.id] : null;
    const diagnostics = (settings as any).retunerState?.diagnostics || {};

    useEffect(() => {
        listMidiOutputs().then(outputs => {
            setMidiOutputs(outputs.map(o => ({ id: o.id, name: o.name || o.id })));
        });
        listMidiInputs().then(inputs => {
            setMidiInputs(inputs.map(i => ({ id: i.id, name: i.name || i.id })));
        });
    }, []);

    useEffect(() => {
        const table = Array.isArray(r.input?.mappingTable) ? r.input.mappingTable : [];
        const lines = table.map((entry: any) => {
            if (entry.hz) return `${entry.midiNote}=${entry.hz}`;
            if (entry.ratio) return `${entry.midiNote}=${entry.ratio}`;
            return '';
        }).filter(Boolean);
        setMappingTableText(lines.join('\n'));
    }, [r.input?.mappingTable]);

    const updateRetuner = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, [field]: value } } as any);
    };

    const updateZone = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, zone: { ...r.zone, [field]: value } } } as any);
    };

    const updateInput = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, input: { ...r.input, [field]: value } } } as any);
    };

    const updateInputBaseTuning = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, input: { ...r.input, baseTuning: { ...r.input.baseTuning, [field]: value } } } } as any);
    };

    const updateInputSourceFilter = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, input: { ...r.input, sourceFilter: { ...r.input.sourceFilter, [field]: value } } } } as any);
    };

    const updateInputNoteRange = (field: 'min' | 'max', value: any) => {
        onUpdate({
            retuner: {
                ...r,
                input: {
                    ...r.input,
                    sourceFilter: {
                        ...r.input.sourceFilter,
                        noteRange: { ...(r.input.sourceFilter?.noteRange || { min: 0, max: 127 }), [field]: value }
                    }
                }
            }
        } as any);
    };

    const updateInputChannelRange = (field: 'min' | 'max', value: any) => {
        onUpdate({
            retuner: {
                ...r,
                input: {
                    ...r.input,
                    sourceFilter: {
                        ...r.input.sourceFilter,
                        channelRange: { ...(r.input.sourceFilter?.channelRange || { min: 1, max: 16 }), [field]: value }
                    }
                }
            }
        } as any);
    };

    const updateLoopbackGuard = (field: string, value: any) => {
        onUpdate({ retuner: { ...r, input: { ...r.input, loopbackGuard: { ...r.input.loopbackGuard, [field]: value } } } } as any);
    };

    const updateMpeZone = (updates: any) => {
        onUpdate({ retuner: { ...r, mpeZone: { ...r.mpeZone, ...updates } } } as any);
    };

    const updateRetunerState = (partial: any) => {
        const currentState = (settings as any).retunerState || {};
        onUpdate({ retunerState: { ...currentState, ...partial } } as any);
    };

    const updateDestination = (destId: string, updates: Partial<OutputDestination>) => {
        const newDestinations = destinations.map(d => 
            d.id === destId ? { ...d, ...updates } : d
        );
        onUpdate({ retunerDestinations: newDestinations } as any);
    };

    const updateRoute = (routeId: string, updates: Partial<RetunerRoute>) => {
        const routes = Array.isArray(r.routes) ? r.routes : [];
        const nextRoutes = routes.map((route: RetunerRoute) => route.id === routeId ? { ...route, ...updates } : route);
        onUpdate({ retuner: { ...r, routes: nextRoutes } } as any);
    };

    const addRoute = () => {
        const routes = Array.isArray(r.routes) ? r.routes : [];
        const next: RetunerRoute = {
            id: `route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            name: `Route ${routes.length + 1}`,
            enabled: true,
            priority: routes.length,
            destinations: r.destinationId ? [r.destinationId] : [],
            mappingMode: r.input.mappingMode,
            mappingTable: [],
            fanOut: false,
        };
        onUpdate({ retuner: { ...r, routes: [...routes, next] } } as any);
    };

    const removeRoute = (routeId: string) => {
        const routes = Array.isArray(r.routes) ? r.routes : [];
        onUpdate({ retuner: { ...r, routes: routes.filter((route: RetunerRoute) => route.id !== routeId) } } as any);
    };

    const addDestination = (type: DestinationType) => {
        const newDest = createDefaultDestination(type);
        const newDestinations = [...destinations, newDest];
        onUpdate({ 
            retunerDestinations: newDestinations,
            retuner: { ...r, destinationId: newDest.id }
        } as any);
    };

    const selectDestination = (destId: string) => {
        updateRetuner('destinationId', destId);
    };

    const toggleInputId = (id: string) => {
        const current = new Set(r.input.sourceFilter?.sourceIds || []);
        if (current.has(id)) current.delete(id);
        else current.add(id);
        updateInputSourceFilter('sourceIds', Array.from(current));
    };

    return (
        <div className="space-y-4 p-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                External / DAW Mode
                {r.enabled && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_5px_cyan]"></span>}
            </h3>

            <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-1 hover:bg-white/5 rounded transition-colors">
                    <input
                        type="checkbox"
                        checked={r.enabled}
                        onChange={e => updateRetuner('enabled', e.target.checked)}
                        className="w-4 h-4 accent-blue-500 rounded"
                    />
                    <span className="text-[10px] text-gray-300 font-bold uppercase">Enable Retuner</span>
                </label>

                {!r.enabled && <p className="text-[10px] text-gray-500 italic ml-7">Enable to use as a tuning middleware for external DAWs/Plugins.</p>}

                {r.enabled && (
                    <div className="space-y-4 pt-2">
                        <div className="flex justify-between items-center bg-black/30 border border-gray-800 p-2 rounded">
                            <span className="text-[9px] text-gray-400 uppercase font-bold">Emergency</span>
                            <button
                                onClick={() => updateRetunerState({ panicRequestId: Date.now() })}
                                className="bg-red-700 hover:bg-red-600 text-white text-[9px] rounded px-3 py-1 uppercase font-black"
                            >
                                Panic
                            </button>
                        </div>
                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Output Destination</h4>
                            <div className="bg-black/30 border border-gray-800 p-2 rounded space-y-2">
                                {destinations.length === 0 ? (
                                    <div className="text-center py-2">
                                        <p className="text-[9px] text-gray-500 mb-2">No destinations configured</p>
                                        <div className="flex flex-col gap-2 items-center">
                                            <button
                                                onClick={() => addDestination('webmidi')}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded"
                                            >
                                                + Add MIDI Output
                                            </button>
                                            <button
                                                onClick={() => addDestination('mts-esp')}
                                                className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-[10px] rounded"
                                            >
                                                + Add MTS-ESP
                                            </button>
                                            <button
                                                onClick={() => addDestination('native-host')}
                                                className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] rounded"
                                            >
                                                + Add Native Host
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <select
                                            value={r.destinationId || ''}
                                            onChange={e => selectDestination(e.target.value)}
                                            className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                                {destinations.map(d => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name} ({d.type})
                                                    </option>
                                                ))}
                                            </select>

                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => addDestination('webmidi')}
                                                className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-[9px] rounded px-2 py-1 uppercase font-bold"
                                            >
                                                + MIDI
                                            </button>
                                            <button
                                                onClick={() => addDestination('mts-esp')}
                                                className="flex-1 bg-green-700 hover:bg-green-600 text-white text-[9px] rounded px-2 py-1 uppercase font-bold"
                                            >
                                                + MTS
                                            </button>
                                            <button
                                                onClick={() => addDestination('native-host')}
                                                className="flex-1 bg-indigo-700 hover:bg-indigo-600 text-white text-[9px] rounded px-2 py-1 uppercase font-bold"
                                            >
                                                + Host
                                            </button>
                                        </div>

                                        {activeDestination && (
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                                                <span className="text-[9px] text-gray-400 uppercase font-bold">PB Range (Single Source)</span>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="96"
                                                        value={activeDestination.pitchBendRangeSemitones}
                                                        onChange={e => updateDestination(activeDestination.id, { 
                                                            pitchBendRangeSemitones: parseInt(e.target.value) || 48 
                                                        })}
                                                        className="w-14 bg-black border border-gray-700 text-right text-[10px] text-white rounded p-1"
                                                    />
                                                    <span className="text-[9px] text-gray-500">semi</span>
                                                </div>
                                            </div>
                                        )}

                                        {activeDestination && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-gray-400 uppercase font-bold">Status</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold ${
                                                        (activeRuntime?.status || activeDestination.status) === 'ready' ? 'bg-green-700 text-green-100'
                                                        : (activeRuntime?.status || activeDestination.status) === 'preflighting' ? 'bg-yellow-700 text-yellow-100'
                                                        : (activeRuntime?.status || activeDestination.status) === 'connecting' ? 'bg-blue-700 text-blue-100'
                                                        : (activeRuntime?.status || activeDestination.status) === 'error' ? 'bg-red-700 text-red-100'
                                                        : 'bg-gray-700 text-gray-200'
                                                    }`}>
                                                        {(activeRuntime?.status || activeDestination.status) || 'disconnected'}
                                                    </span>
                                                    {(activeRuntime?.lastErrorMessage || activeDestination.lastError) && (
                                                        <span className="text-[8px] text-red-400 max-w-[150px] truncate" title={(activeRuntime?.lastErrorMessage || activeDestination.lastError) as string}>
                                                            {activeRuntime?.lastErrorMessage || activeDestination.lastError}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {activeDestination?.type === 'webmidi' && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[9px] text-gray-400 uppercase font-bold">MIDI Output</span>
                                                <select
                                                    value={activeDestination.webmidi?.outputId || ''}
                                                    onChange={e => updateDestination(activeDestination.id, {
                                                        webmidi: { ...activeDestination.webmidi!, outputId: e.target.value }
                                                    })}
                                                    className="bg-black border border-gray-700 text-[10px] text-white rounded p-1 max-w-[150px]"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    <option value="">Auto (First Available)</option>
                                                    {midiOutputs.map(o => (
                                                        <option key={o.id} value={o.id}>{o.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {activeDestination?.type === 'mts-esp' && (
                                            <div className="space-y-2 text-[9px] text-gray-400">
                                                <div className="flex justify-between items-center">
                                                    <span className="uppercase font-bold">MTS Mode</span>
                                                    <select
                                                        value={activeDestination.mtsEsp?.mode || 'broadcast-only'}
                                                        onChange={e => updateDestination(activeDestination.id, {
                                                            mtsEsp: { ...activeDestination.mtsEsp!, mode: e.target.value as any }
                                                        })}
                                                        className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        <option value="broadcast-only">Broadcast Only</option>
                                                        <option value="broadcast+passthrough">Broadcast + Passthrough</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="uppercase font-bold">Broadcast Policy</span>
                                                    <select
                                                        value={activeDestination.mtsEsp?.broadcastPolicy || 'onchange'}
                                                        onChange={e => updateDestination(activeDestination.id, {
                                                            mtsEsp: { ...activeDestination.mtsEsp!, broadcastPolicy: e.target.value as any }
                                                        })}
                                                        className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                        style={{ colorScheme: 'dark' }}
                                                    >
                                                        <option value="onchange">On Change</option>
                                                        <option value="interval">Interval</option>
                                                        <option value="manual">Manual</option>
                                                    </select>
                                                </div>
                                                {activeDestination.mtsEsp?.broadcastPolicy === 'interval' && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="uppercase font-bold">Interval (ms)</span>
                                                        <input
                                                            type="number"
                                                            value={activeDestination.mtsEsp?.intervalMs ?? 1000}
                                                            onChange={e => updateDestination(activeDestination.id, {
                                                                mtsEsp: { ...activeDestination.mtsEsp!, intervalMs: parseInt(e.target.value) || 1000 }
                                                            })}
                                                            className="w-20 bg-black border border-gray-700 text-right text-[10px] text-white rounded p-1"
                                                        />
                                                    </div>
                                                )}
                                                {activeDestination.mtsEsp?.broadcastPolicy === 'manual' && (
                                                    <button
                                                        onClick={() => updateRetunerState({ mtsEspBroadcastRequestId: Date.now() })}
                                                        className="w-full bg-green-700 hover:bg-green-600 text-white text-[9px] rounded px-2 py-1 uppercase font-bold"
                                                    >
                                                        Broadcast Now
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Input Settings</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Input Type</label>
                                    <select
                                        value={r.input?.type || 'midi'}
                                        onChange={e => updateInput('type', e.target.value)}
                                        className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        <option value="midi">MIDI (Standard)</option>
                                        <option value="mpe">MPE</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">PB Range (Steps)</label>
                                    <input
                                        type="number"
                                        value={r.input?.pitchBendRangeSteps || 2}
                                        onChange={e => updateInput('pitchBendRangeSteps', parseFloat(e.target.value))}
                                        className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                                    />
                                    <p className="text-[8px] text-gray-600 mt-1 italic">Interpolates scale steps</p>
                                </div>
                            </div>

                            <div className="mt-3 space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Input Sources</div>
                                {midiInputs.length === 0 && (
                                    <div className="text-[9px] text-gray-500 italic">No MIDI inputs detected.</div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {midiInputs.map((input) => (
                                        <label key={input.id} className="flex items-center gap-2 text-[9px] text-gray-300">
                                            <input
                                                type="checkbox"
                                                checked={(r.input.sourceFilter?.sourceIds || []).includes(input.id)}
                                                onChange={() => toggleInputId(input.id)}
                                                className="w-3 h-3 accent-blue-500 rounded"
                                            />
                                            <span className="truncate" title={input.name}>{input.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-[8px] text-gray-600 italic">Empty selection = all inputs.</p>
                            </div>

                            <div className="mt-3 space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Channel Filter</div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={r.input.sourceFilter?.channelMode || 'all'}
                                        onChange={(e) => updateInputSourceFilter('channelMode', e.target.value as ChannelFilterMode)}
                                        className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        <option value="all">All Channels</option>
                                        <option value="range">Range</option>
                                        <option value="list">List</option>
                                    </select>
                                    {(r.input.sourceFilter?.channelMode === 'range') && (
                                        <>
                                            <input
                                                type="number"
                                                min="1"
                                                max="16"
                                                value={r.input.sourceFilter?.channelRange?.min ?? 1}
                                                onChange={(e) => updateInputChannelRange('min', parseInt(e.target.value) || 1)}
                                                className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            />
                                            <span className="text-[9px] text-gray-500">to</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="16"
                                                value={r.input.sourceFilter?.channelRange?.max ?? 16}
                                                onChange={(e) => updateInputChannelRange('max', parseInt(e.target.value) || 16)}
                                                className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            />
                                        </>
                                    )}
                                    {(r.input.sourceFilter?.channelMode === 'list') && (
                                        <input
                                            type="text"
                                            value={(r.input.sourceFilter?.channelList || []).join(',')}
                                            onChange={(e) => {
                                                const list = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => Number.isFinite(v));
                                                updateInputSourceFilter('channelList', list);
                                            }}
                                            className="flex-1 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            placeholder="1,2,3"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Note Range</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="127"
                                        value={r.input.sourceFilter?.noteRange?.min ?? 0}
                                        onChange={(e) => updateInputNoteRange('min', parseInt(e.target.value) || 0)}
                                        className="w-14 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                    />
                                    <span className="text-[9px] text-gray-500">to</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="127"
                                        value={r.input.sourceFilter?.noteRange?.max ?? 127}
                                        onChange={(e) => updateInputNoteRange('max', parseInt(e.target.value) || 127)}
                                        className="w-14 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                    />
                                </div>
                            </div>

                            <div className="mt-3 space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Mapping Mode</div>
                                <select
                                    value={r.input?.mappingMode || 'lattice'}
                                    onChange={(e) => updateInput('mappingMode', e.target.value as MappingMode)}
                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="scale">12TET → Scale</option>
                                    <option value="lattice">Nearest Lattice Node</option>
                                    <option value="table">Fixed Table</option>
                                    <option value="adaptive">Adaptive</option>
                                </select>
                                <div className="grid grid-cols-3 gap-2 pt-2">
                                    <div>
                                        <label className="text-[8px] text-gray-500 uppercase">A4 Hz</label>
                                        <input
                                            type="number"
                                            value={r.input.baseTuning?.a4Hz ?? 440}
                                            onChange={(e) => updateInputBaseTuning('a4Hz', parseFloat(e.target.value) || 440)}
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-gray-500 uppercase">Root Note</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="127"
                                            value={r.input.baseTuning?.rootNote ?? 60}
                                            onChange={(e) => updateInputBaseTuning('rootNote', parseInt(e.target.value) || 60)}
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[8px] text-gray-500 uppercase">Base Note</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="127"
                                            value={r.input.baseTuning?.baseNote ?? 69}
                                            onChange={(e) => updateInputBaseTuning('baseNote', parseInt(e.target.value) || 69)}
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        />
                                    </div>
                                </div>
                            </div>

                            {r.input?.mappingMode === 'table' && (
                                <div className="mt-3 space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                    <div className="text-[9px] text-gray-400 uppercase font-bold">Mapping Table</div>
                                    <textarea
                                        value={mappingTableText}
                                        onChange={(e) => setMappingTableText(e.target.value)}
                                        onBlur={() => {
                                            const entries = mappingTableText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
                                                const [noteStr, val] = line.split('=');
                                                const midiNote = parseInt(noteStr.trim());
                                                if (!Number.isFinite(midiNote)) return null;
                                                if (val.includes('/')) {
                                                    return { midiNote, ratio: val.trim() };
                                                }
                                                const hz = parseFloat(val);
                                                if (Number.isFinite(hz)) return { midiNote, hz };
                                                return null;
                                            }).filter(Boolean);
                                            updateInput('mappingTable', entries);
                                        }}
                                        className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-2 h-24"
                                        placeholder="60=1/1\n61=16/15\n62=9/8"
                                    />
                                </div>
                            )}

                            <div className="mt-3 flex items-center gap-2 bg-black/30 border border-gray-800 p-2 rounded">
                                <input
                                    type="checkbox"
                                    checked={r.input.loopbackGuard?.enabled ?? true}
                                    onChange={(e) => updateLoopbackGuard('enabled', e.target.checked)}
                                    className="w-3 h-3 accent-blue-500 rounded"
                                />
                                <span className="text-[9px] text-gray-300 font-bold uppercase">Loopback Guard</span>
                                <select
                                    value={r.input.loopbackGuard?.mode || 'basic'}
                                    onChange={(e) => updateLoopbackGuard('mode', e.target.value)}
                                    className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="basic">Basic</option>
                                    <option value="strict">Strict</option>
                                </select>
                                <input
                                    type="number"
                                    value={r.input.loopbackGuard?.windowMs ?? 120}
                                    onChange={(e) => updateLoopbackGuard('windowMs', parseInt(e.target.value) || 120)}
                                    className="w-16 ml-auto bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                />
                                <span className="text-[9px] text-gray-500">ms</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Output Mode</h4>
                            <select
                                value={r.mode}
                                onChange={e => updateRetuner('mode', e.target.value)}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 mb-2 focus:border-blue-500 outline-none"
                                style={{ colorScheme: 'dark' }}
                            >
                                <option value="none">None (Internal Synth Only)</option>
                                <option value="midi">MIDI (Mono / Pitch Bend)</option>
                                <option value="mpe">MPE (Polyphonic)</option>
                                <option value="multichannel">Multichannel (1 Channel per Note)</option>
                                <option value="mts-esp-master">MTS-ESP Master</option>
                            </select>

                            {r.mode === 'midi' && (
                                <div className="bg-black/30 border border-gray-800 p-2 rounded text-sm space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold">Mono Policy</span>
                                        <select
                                            value={r.monoPolicy}
                                            onChange={e => updateRetuner('monoPolicy', e.target.value)}
                                            className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            <option value="steal">Steal (Strict)</option>
                                            <option value="legato">Legato</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {r.mode === 'mpe' && (
                                <div className="bg-black/30 border border-gray-800 p-2 rounded text-sm space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold">MPE Zone</span>
                                        <select
                                            value={r.mpeZone?.type || 'lower'}
                                            onChange={e => updateMpeZone({ type: e.target.value as MpeZoneType })}
                                            className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            <option value="lower">Lower Zone (Ch 2-8)</option>
                                            <option value="upper">Upper Zone (Ch 9-15)</option>
                                            <option value="both">Both Zones</option>
                                        </select>
                                    </div>
                                    <div className="text-[9px] text-gray-500 italic">
                                        Lower: Global Ch 1, Members Ch 2-8<br/>
                                        Upper: Global Ch 16, Members Ch 9-15
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                                        <input
                                            type="checkbox"
                                            checked={r.zone?.useGlobalChannel ?? true}
                                            onChange={e => updateZone('useGlobalChannel', e.target.checked)}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        <span className="text-[9px] text-gray-300 font-bold uppercase">Use Global Channel</span>
                                    </label>
                                </div>
                            )}

                            {r.mode === 'multichannel' && (
                                <div className="bg-black/30 border border-gray-800 p-2 rounded text-sm space-y-2">
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Start Ch</label>
                                            <input
                                                type="number" min="1" max="16"
                                                value={r.zone.startChannel}
                                                onChange={e => updateZone('startChannel', parseInt(e.target.value))}
                                                className="w-full bg-black border border-gray-700 rounded p-1 text-[10px] text-white"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">End Ch</label>
                                            <input
                                                type="number" min="1" max="16"
                                                value={r.zone.endChannel}
                                                onChange={e => updateZone('endChannel', parseInt(e.target.value))}
                                                className="w-full bg-black border border-gray-700 rounded p-1 text-[10px] text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold">Steal Policy</span>
                                        <select
                                            value={r.stealPolicy || 'oldest'}
                                            onChange={e => updateRetuner('stealPolicy', e.target.value)}
                                            className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            <option value="oldest">Oldest</option>
                                            <option value="quietest">Quietest</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {r.mode === 'mts-esp-master' && (
                                <div className="bg-black/30 border border-green-900/50 p-2 rounded text-sm border-l-2 border-l-green-500">
                                    <p className="text-[10px] text-gray-300 font-bold uppercase mb-1">Broadcasting Tuning...</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-gray-500">Connected Clients:</span>
                                        <span className="font-mono font-bold text-green-400">
                                            {(settings as any).retunerState?.mtsEspClientCount || 0}
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 mt-2 italic">
                                        * Note: Client notes are invisible to this host.
                                        <br />
                                        * Limit: 1 Master per project.
                                    </p>
                                </div>
                            )}

                            {(r.mode === 'mpe' || r.mode === 'multichannel') && (
                                <label className="flex items-center gap-2 cursor-pointer mt-2 p-2 bg-black/20 rounded">
                                    <input
                                        type="checkbox"
                                        checked={r.resetPbOnNoteOff ?? false}
                                        onChange={e => updateRetuner('resetPbOnNoteOff', e.target.checked)}
                                        className="w-3 h-3 accent-blue-500 rounded"
                                    />
                                    <span className="text-[9px] text-gray-300 font-bold uppercase">Reset PB on Note Off</span>
                                    <span className="text-[8px] text-gray-500 italic">(only when channel empty)</span>
                                </label>
                            )}

                            {(r.mode === 'mpe' || r.mode === 'multichannel' || r.mode === 'midi') && (
                                <div className="text-orange-400 text-[9px] mt-2 italic">
                                    ⚠️ Ensure output instrument PB range matches exactly ({activeDestination?.pitchBendRangeSemitones || 48} semitones).
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Routing Matrix</h4>
                            <div className="space-y-2 bg-black/30 border border-gray-800 p-2 rounded">
                                {(r.routes || []).length === 0 && (
                                    <div className="text-[9px] text-gray-500 italic">No routes configured. Default route uses active destination.</div>
                                )}
                                {(r.routes || []).map((route: RetunerRoute) => (
                                    <div key={route.id} className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={route.enabled !== false}
                                                onChange={(e) => updateRoute(route.id, { enabled: e.target.checked })}
                                                className="w-3 h-3 accent-blue-500 rounded"
                                            />
                                            <input
                                                type="text"
                                                value={route.name || ''}
                                                onChange={(e) => updateRoute(route.id, { name: e.target.value })}
                                                className="flex-1 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                placeholder="Route name"
                                            />
                                            <input
                                                type="number"
                                                value={route.priority ?? 0}
                                                onChange={(e) => updateRoute(route.id, { priority: parseInt(e.target.value) || 0 })}
                                                className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                title="Priority"
                                            />
                                            <button
                                                onClick={() => removeRoute(route.id)}
                                                className="text-[10px] text-red-400 hover:text-red-300 px-1"
                                                title="Remove route"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[8px] text-gray-500 uppercase">Mapping</label>
                                                <select
                                                    value={route.mappingMode || r.input.mappingMode}
                                                    onChange={(e) => updateRoute(route.id, { mappingMode: e.target.value as MappingMode })}
                                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    <option value="scale">Scale</option>
                                                    <option value="lattice">Lattice</option>
                                                    <option value="table">Table</option>
                                                    <option value="adaptive">Adaptive</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[8px] text-gray-500 uppercase">Destinations</label>
                                                <select
                                                    multiple
                                                    value={route.destinations || []}
                                                    onChange={(e) => {
                                                        const next = Array.from(e.target.selectedOptions).map(o => o.value);
                                                        updateRoute(route.id, { destinations: next });
                                                    }}
                                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1 h-16"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    {destinations.map((d) => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[8px] text-gray-500 uppercase">Sources</label>
                                                <select
                                                    multiple
                                                    value={route.sourceFilter?.sourceIds || []}
                                                    onChange={(e) => {
                                                        const next = Array.from(e.target.selectedOptions).map(o => o.value);
                                                        updateRoute(route.id, { sourceFilter: { ...(route.sourceFilter || {}), sourceIds: next } });
                                                    }}
                                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1 h-16"
                                                    style={{ colorScheme: 'dark' }}
                                                >
                                                    {midiInputs.map((input) => (
                                                        <option key={input.id} value={input.id}>{input.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[8px] text-gray-500 uppercase">Ch Range</label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="16"
                                                        value={route.sourceFilter?.channelRange?.min ?? 1}
                                                        onChange={(e) => updateRoute(route.id, { sourceFilter: { ...(route.sourceFilter || {}), channelMode: 'range', channelRange: { ...(route.sourceFilter?.channelRange || { min: 1, max: 16 }), min: parseInt(e.target.value) || 1 } } })}
                                                        className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                    />
                                                    <span className="text-[9px] text-gray-500">-</span>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="16"
                                                        value={route.sourceFilter?.channelRange?.max ?? 16}
                                                        onChange={(e) => updateRoute(route.id, { sourceFilter: { ...(route.sourceFilter || {}), channelMode: 'range', channelRange: { ...(route.sourceFilter?.channelRange || { min: 1, max: 16 }), max: parseInt(e.target.value) || 16 } } })}
                                                        className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[8px] text-gray-500 uppercase">Note Range</label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="127"
                                                        value={route.sourceFilter?.noteRange?.min ?? 0}
                                                        onChange={(e) => updateRoute(route.id, { sourceFilter: { ...(route.sourceFilter || {}), noteRange: { ...(route.sourceFilter?.noteRange || { min: 0, max: 127 }), min: parseInt(e.target.value) || 0 } } })}
                                                        className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                    />
                                                    <span className="text-[9px] text-gray-500">-</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="127"
                                                        value={route.sourceFilter?.noteRange?.max ?? 127}
                                                        onChange={(e) => updateRoute(route.id, { sourceFilter: { ...(route.sourceFilter || {}), noteRange: { ...(route.sourceFilter?.noteRange || { min: 0, max: 127 }), max: parseInt(e.target.value) || 127 } } })}
                                                        className="w-12 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 text-[9px] text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={route.fanOut ?? false}
                                                    onChange={(e) => updateRoute(route.id, { fanOut: e.target.checked })}
                                                    className="w-3 h-3 accent-blue-500 rounded"
                                                />
                                                Fan-out
                                            </label>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={addRoute}
                                    className="w-full bg-gray-800 hover:bg-gray-700 text-[9px] text-gray-200 rounded px-2 py-1 uppercase font-bold"
                                >
                                    + Add Route
                                </button>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Preflight & Tuning Policy</h4>
                            <div className="space-y-2 bg-black/30 border border-gray-800 p-2 rounded text-[9px] text-gray-400">
                                <div className="flex justify-between items-center">
                                    <span className="uppercase font-bold">Note Policy</span>
                                    <select
                                        value={r.preflight?.notePolicy || 'queue'}
                                        onChange={(e) => updateRetuner('preflight', { ...r.preflight, notePolicy: e.target.value })}
                                        className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        <option value="queue">Queue</option>
                                        <option value="drop">Drop</option>
                                    </select>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="uppercase font-bold">Queue Size</span>
                                    <input
                                        type="number"
                                        value={r.preflight?.maxQueueSize ?? 64}
                                        onChange={(e) => updateRetuner('preflight', { ...r.preflight, maxQueueSize: parseInt(e.target.value) || 64 })}
                                        className="w-16 bg-black border border-gray-700 text-right text-[10px] text-white rounded p-1"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="uppercase font-bold">Config Timeout (ms)</span>
                                    <input
                                        type="number"
                                        value={r.preflight?.configTimeoutMs ?? 2000}
                                        onChange={(e) => updateRetuner('preflight', { ...r.preflight, configTimeoutMs: parseInt(e.target.value) || 2000 })}
                                        className="w-20 bg-black border border-gray-700 text-right text-[10px] text-white rounded p-1"
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="uppercase font-bold">Tuning Change</span>
                                    <select
                                        value={r.tuningChangePolicy?.mode || 'new-notes-only'}
                                        onChange={(e) => updateRetuner('tuningChangePolicy', { ...r.tuningChangePolicy, mode: e.target.value })}
                                        className="bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        <option value="new-notes-only">New Notes Only</option>
                                        <option value="immediate">Immediate</option>
                                        <option value="ramp">Ramp</option>
                                    </select>
                                </div>
                                {r.tuningChangePolicy?.mode === 'ramp' && (
                                    <div className="flex justify-between items-center">
                                        <span className="uppercase font-bold">Ramp (ms)</span>
                                        <input
                                            type="number"
                                            value={r.tuningChangePolicy?.rampMs ?? 50}
                                            onChange={(e) => updateRetuner('tuningChangePolicy', { ...r.tuningChangePolicy, rampMs: parseInt(e.target.value) || 50 })}
                                            className="w-16 bg-black border border-gray-700 text-right text-[10px] text-white rounded p-1"
                                        />
                                    </div>
                                )}
                                <div className="pt-2 space-y-1">
                                    <label className="flex items-center gap-2 text-[9px] text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={r.panicOnDestinationChange ?? true}
                                            onChange={(e) => updateRetuner('panicOnDestinationChange', e.target.checked)}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        Panic on Destination Change
                                    </label>
                                    <label className="flex items-center gap-2 text-[9px] text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={r.panicOnModeChange ?? true}
                                            onChange={(e) => updateRetuner('panicOnModeChange', e.target.checked)}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        Panic on Mode Change
                                    </label>
                                    <label className="flex items-center gap-2 text-[9px] text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={r.panicOnZoneChange ?? true}
                                            onChange={(e) => updateRetuner('panicOnZoneChange', e.target.checked)}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        Panic on Zone Change
                                    </label>
                                    <label className="flex items-center gap-2 text-[9px] text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={r.panicOnPbRangeChange ?? true}
                                            onChange={(e) => updateRetuner('panicOnPbRangeChange', e.target.checked)}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        Panic on PB Range Change
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Sync Group</h4>
                            <div className="flex justify-between items-center bg-black/30 border border-gray-800 p-2 rounded">
                                <span className="text-[9px] text-gray-400 uppercase font-bold">Group ID</span>
                                <select
                                    value={r.group}
                                    onChange={e => updateRetuner('group', e.target.value)}
                                    className="bg-black border border-gray-700 rounded p-1 w-24 text-[10px] text-white"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="Off">Off</option>
                                    <option value="A">Group A</option>
                                    <option value="B">Group B</option>
                                    <option value="C">Group C</option>
                                    <option value="D">Group D</option>
                                </select>
                            </div>
                            <p className="text-[8px] text-gray-600 mt-1 italic">
                                Syncs Tuning, Mapping, and Retuner Settings across instances.
                            </p>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Diagnostics</h4>
                            <div className="bg-black/30 border border-gray-800 p-2 rounded space-y-2">
                                <div className="flex justify-between items-center text-[9px] text-gray-400">
                                    <span>Loopback Hits</span>
                                    <span className="font-mono text-gray-200">{diagnostics.loopbackHits || 0}</span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-gray-400">
                                    <span>Last Panic</span>
                                    <span className="font-mono text-gray-200">
                                        {diagnostics.lastPanicAt ? new Date(diagnostics.lastPanicAt).toLocaleTimeString() : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[9px] text-gray-400">
                                    <span>Dropped Events</span>
                                    <span className="font-mono text-gray-200">{diagnostics.droppedEvents || 0}</span>
                                </div>
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Recent Input</div>
                                <div className="max-h-24 overflow-auto font-mono text-[8px] text-gray-400 space-y-1">
                                    {(diagnostics.inputEvents || []).slice(-6).reverse().map((evt: any, idx: number) => (
                                        <div key={`in-${idx}`}>
                                            {evt.type} ch{evt.channel} n{evt.note}
                                        </div>
                                    ))}
                                    {(diagnostics.inputEvents || []).length === 0 && <div className="italic">No input events</div>}
                                </div>
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Recent Output</div>
                                <div className="max-h-24 overflow-auto font-mono text-[8px] text-gray-400 space-y-1">
                                    {(diagnostics.outputEvents || []).slice(-6).reverse().map((evt: any, idx: number) => (
                                        <div key={`out-${idx}`}>
                                            {evt.type} ch{evt.channel} n{evt.note} → {evt.destId?.slice(0, 6)}
                                        </div>
                                    ))}
                                    {(diagnostics.outputEvents || []).length === 0 && <div className="italic">No output events</div>}
                                </div>
                                <div className="text-[9px] text-gray-500 uppercase font-bold">Preflight</div>
                                <div className="max-h-20 overflow-auto font-mono text-[8px] text-gray-400 space-y-1">
                                    {(diagnostics.preflight || []).slice(-4).reverse().map((evt: any, idx: number) => (
                                        <div key={`pf-${idx}`}>
                                            {evt.destId?.slice(0, 6)} {evt.step} {evt.status}
                                        </div>
                                    ))}
                                    {(diagnostics.preflight || []).length === 0 && <div className="italic">No preflight events</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {r.enabled && (
                <PluginManager
                    state={(settings as any).retunerState || {}}
                    onUpdateState={updateRetunerState}
                />
            )}
        </div>
    );
};
