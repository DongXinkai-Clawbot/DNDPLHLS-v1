import React, { useState } from 'react';
import { RetunerState } from '../../domain/retuner/types';
import { nativeBridge, nativeBridgeCore, type PluginInfo } from '../../native/bridge';
import { reportRecoverableError } from '../../utils/errorReporting';
import { notifyInfo } from '../../utils/notifications';

interface PluginManagerProps {
    state: RetunerState;
    onUpdateState: (partial: Partial<RetunerState>) => void;
}

export const PluginManager: React.FC<PluginManagerProps> = ({ state, onUpdateState }) => {
    const plugins = state.hostedPlugins || [];
    const availablePlugins = state.availablePlugins || [];
    const hostAvailable = nativeBridgeCore.isConnected() && !nativeBridgeCore.isMockMode();
    const hostMode = nativeBridgeCore.isMockMode() ? 'mock' : (nativeBridgeCore.isConnected() ? 'connected' : 'disconnected');
    const hostStatus = hostAvailable ? (state.pluginHostStatus || 'available') : 'unsupported';
    const hostError = state.pluginHostError || null;
    const [isBusy, setIsBusy] = useState(false);

    const updateState = (partial: Partial<RetunerState>) => onUpdateState(partial);

    const handleConnect = async () => {
        if (!hostAvailable) {
            reportRecoverableError('Plugins', 'Native host unavailable');
            return;
        }
        setIsBusy(true);
        try {
            const list = await nativeBridge.scanPlugins();
            updateState({ availablePlugins: list, pluginHostStatus: 'connected', pluginHostError: null });
            if (list.length === 0) notifyInfo('No plugins found.', 'Plugins');
        } catch (e) {
            updateState({ pluginHostStatus: 'available', pluginHostError: 'Connection failed' });
            reportRecoverableError('Plugins', e, 'Failed to connect to plugin host.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleScan = async () => {
        if (!hostAvailable) return;
        setIsBusy(true);
        try {
            const list = await nativeBridge.scanPlugins();
            updateState({ availablePlugins: list, pluginHostStatus: 'connected', pluginHostError: null });
            if (list.length === 0) notifyInfo('No plugins found.', 'Plugins');
        } catch (e) {
            updateState({ pluginHostError: 'Scan failed' });
            reportRecoverableError('Plugins', e, 'Failed to scan plugins.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleLoad = async (plugin: PluginInfo) => {
        if (!hostAvailable) return;
        if (plugins.some((p) => p.id === plugin.id)) {
            notifyInfo('Plugin already loaded.', 'Plugins');
            return;
        }
        setIsBusy(true);
        try {
            const ok = await nativeBridge.loadPlugin(plugin.path);
            if (!ok) throw new Error('Load failed');
            const nextPlugin = {
                id: plugin.id,
                name: plugin.name,
                format: plugin.format,
                manufacturer: plugin.manufacturer,
                version: plugin.version,
                editorOpen: false
            };
            updateState({ hostedPlugins: [...plugins, nextPlugin], pluginHostStatus: 'connected', pluginHostError: null });
        } catch (e) {
            reportRecoverableError('Plugins', e, `Failed to load "${plugin.name}".`);
        } finally {
            setIsBusy(false);
        }
    };

    const toggleEditor = async (id: string) => {
        const target = plugins.find((p) => p.id === id);
        if (!target) return;
        const nextOpen = !target.editorOpen;
        try {
            if (nextOpen) {
                await nativeBridge.openEditor(id);
            } else {
                await nativeBridge.closeEditor(id);
            }
            const next = plugins.map((p) => p.id === id ? { ...p, editorOpen: nextOpen } : p);
            updateState({ hostedPlugins: next });
        } catch (e) {
            reportRecoverableError('Plugins', e, 'Failed to toggle plugin editor.');
        }
    };

    const removePlugin = async (id: string) => {
        try {
            await nativeBridge.unloadPlugin(id);
        } catch (e) {
            reportRecoverableError('Plugins', e, 'Failed to unload plugin.');
        }
        const next = plugins.filter((p) => p.id !== id);
        updateState({ hostedPlugins: next });
    };

    if (hostStatus === 'unsupported') {
        return (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 opacity-70">
                <h4 className="text-[10px] font-black text-gray-500 uppercase mb-2">Hosted Plugins</h4>
                <p className="text-[9px] text-gray-500 italic">
                    Plugin hosting is unavailable in this build (host: {hostMode}).
                </p>
                <div className="bg-black/30 border border-gray-800 p-2 rounded text-center text-[10px] text-gray-500 mt-2 font-mono">
                    HOSTING DISABLED
                </div>
            </div>
        );
    }

    if (hostStatus !== 'connected') {
        return (
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3 space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase">Hosted Plugins</h4>
                <p className="text-[9px] text-gray-500">Native host detected. Connect to scan plugins.</p>
                <div className="text-[8px] text-gray-600 uppercase">Host status: {hostStatus}</div>
                {hostError && (
                    <div className="text-[9px] text-red-400">{hostError}</div>
                )}
                <button
                    onClick={handleConnect}
                    disabled={isBusy}
                    className="w-full bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 text-white rounded px-3 py-1.5 text-[9px] uppercase font-black tracking-wide transition-colors disabled:opacity-50"
                >
                    {isBusy ? 'CONNECTING...' : 'CONNECT HOST'}
                </button>
            </div>
        );
    }

    return (
        <div className="bg-indigo-900/10 border border-indigo-900/30 rounded-lg p-3 space-y-3">
            <h4 className="text-[10px] font-black text-indigo-300 uppercase flex justify-between items-center">
                <span>Hosted Plugins</span>
                <span className="text-indigo-500/50 text-[8px]">{plugins.length} Loaded</span>
            </h4>

            <div className="flex gap-2">
                <button
                    onClick={handleScan}
                    disabled={isBusy}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 rounded px-3 py-1.5 text-[9px] uppercase font-black tracking-wide transition-colors disabled:opacity-50"
                >
                    {isBusy ? 'SCANNING...' : 'SCAN'}
                </button>
            </div>

            {hostError && (
                <div className="text-[9px] text-red-400">{hostError}</div>
            )}

            <div className="space-y-1">
                <div className="text-[9px] text-gray-500 uppercase font-bold">Available Plugins</div>
                {availablePlugins.length === 0 && (
                    <div className="text-[9px] text-gray-500 italic">Run Scan to detect plugins.</div>
                )}
                {availablePlugins.map((p) => (
                    <div key={p.id} className="bg-black/30 border border-gray-800 p-2 rounded flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="font-bold text-xs text-gray-200">{p.name}</span>
                            <span className="text-[8px] text-gray-500 uppercase font-mono">{p.format}</span>
                        </div>
                        <button
                            onClick={() => handleLoad(p)}
                            disabled={isBusy}
                            className="bg-indigo-700 hover:bg-indigo-600 border border-indigo-500 text-white rounded px-2 py-1 text-[8px] uppercase font-black tracking-wide disabled:opacity-50"
                        >
                            Load
                        </button>
                    </div>
                ))}
            </div>

            <div className="space-y-1">
                {plugins.length === 0 && (
                    <div className="text-[10px] text-center text-gray-500 py-4 bg-black/20 border border-dashed border-gray-800 rounded">
                        No plugins loaded
                    </div>
                )}

                {plugins.map((p) => (
                    <div key={p.id} className="bg-black/40 border border-gray-800 p-2 rounded flex items-center justify-between group hover:border-gray-600 transition-colors">
                        <div className="flex flex-col">
                            <span className="font-bold text-xs text-gray-200">{p.name}</span>
                            <span className="text-[8px] text-gray-500 uppercase font-mono">{p.format}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => toggleEditor(p.id)}
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${p.editorOpen ? 'bg-green-500 border-green-400 shadow-[0_0_5px_lime]' : 'bg-gray-800 border-gray-600 hover:bg-gray-700'}`}
                                title={p.editorOpen ? 'Close Editor' : 'Open Editor'}
                            >
                                {p.editorOpen && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </button>
                            <button
                                onClick={() => removePlugin(p.id)}
                                className="text-gray-600 hover:text-red-400 font-bold px-1.5 text-xs transition-colors"
                                title="Unload plugin"
                            >
                                X
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
