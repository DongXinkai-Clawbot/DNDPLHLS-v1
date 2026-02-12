import React from 'react';
import { MidiDevicePanel } from '../../midi/MidiDevicePanel';

type MidiDeviceManagerSectionProps = Record<string, any>;

export const MidiDeviceManagerSection = (props: MidiDeviceManagerSectionProps) => {
    const {
        settings,
        handleSettingChange,
    } = props;

    return (
        <div className="p-3 bg-cyan-900/20 border border-cyan-800/50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-cyan-300 uppercase">MIDI Device Manager</h4>
                        </div>
                        <MidiDevicePanel compact={true} />
        
                        <p className="text-[9px] text-gray-500 italic">
                            Advanced device management for compatible MIDI hardware
                        </p>
        
                        <div className="flex items-center justify-between bg-black/30 border border-gray-800 rounded p-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-400 font-bold uppercase block">Auto-Reconnect</label>
                                <p className="text-[8px] text-gray-600 mt-0.5">Automatically reconnect to previously selected device</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.midiDeviceManager?.autoReconnect ?? true}
                                onChange={(e) => handleSettingChange({
                                    midiDeviceManager: {
                                        ...(settings.midiDeviceManager || {}),
                                        autoReconnect: e.target.checked
                                    }
                                })}
                                className="w-4 h-4 accent-cyan-500 rounded"
                            />
                        </div>
        
                        <div className="bg-black/30 border border-gray-800 rounded p-2">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-gray-400 font-bold uppercase">Device Scan Interval</label>
                                <span className="text-[10px] text-cyan-300 font-mono">
                                    {((settings.midiDeviceManager?.scanInterval ?? 2000) / 1000).toFixed(1)}s
                                </span>
                            </div>
                            <input
                                type="range"
                                min="500"
                                max="5000"
                                step="100"
                                value={settings.midiDeviceManager?.scanInterval ?? 2000}
                                onChange={(e) => handleSettingChange({
                                    midiDeviceManager: {
                                        ...(settings.midiDeviceManager || {}),
                                        scanInterval: parseInt(e.target.value)
                                    }
                                })}
                                className="w-full h-1 accent-cyan-500 appearance-none cursor-pointer bg-gray-700 rounded"
                            />
                            <p className="text-[8px] text-gray-600 mt-1">How often to check for device connections/disconnections</p>
                        </div>
        
                        <div className="bg-black/30 border border-gray-800 rounded p-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase block mb-2">Default Local Control</label>
                            <div className="flex bg-black rounded p-0.5 border border-gray-700">
                                <button
                                    onClick={() => handleSettingChange({
                                        midiDeviceManager: {
                                            ...(settings.midiDeviceManager || {}),
                                            localControlDefault: 'off'
                                        }
                                    })}
                                    className={`flex-1 text-[9px] py-1.5 rounded font-bold ${(settings.midiDeviceManager?.localControlDefault ?? 'off') === 'off'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    OFF (Computer Control)
                                </button>
                                <button
                                    onClick={() => handleSettingChange({
                                        midiDeviceManager: {
                                            ...(settings.midiDeviceManager || {}),
                                            localControlDefault: 'on'
                                        }
                                    })}
                                    className={`flex-1 text-[9px] py-1.5 rounded font-bold ${(settings.midiDeviceManager?.localControlDefault ?? 'off') === 'on'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    ON (Piano Mode)
                                </button>
                            </div>
                            <p className="text-[8px] text-gray-600 mt-1">
                                OFF: Keyboard sends MIDI to computer only (for retuning)<br />
                                ON: Keyboard triggers internal sounds
                            </p>
                        </div>
        
                        <div className="bg-black/30 border border-gray-800 rounded p-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase block mb-2">Channel Mode</label>
                            <div className="flex bg-black rounded p-0.5 border border-gray-700 mb-2">
                                <button
                                    onClick={() => handleSettingChange({
                                        midiDeviceManager: {
                                            ...(settings.midiDeviceManager || {}),
                                            channelMode: 'omni'
                                        }
                                    })}
                                    className={`flex-1 text-[9px] py-1.5 rounded font-bold ${(settings.midiDeviceManager?.channelMode ?? 'omni') === 'omni'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    OMNI (All Channels)
                                </button>
                                <button
                                    onClick={() => handleSettingChange({
                                        midiDeviceManager: {
                                            ...(settings.midiDeviceManager || {}),
                                            channelMode: 'single'
                                        }
                                    })}
                                    className={`flex-1 text-[9px] py-1.5 rounded font-bold ${(settings.midiDeviceManager?.channelMode ?? 'omni') === 'single'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    SINGLE CHANNEL
                                </button>
                            </div>
                            {(settings.midiDeviceManager?.channelMode ?? 'omni') === 'single' && (
                                <div className="mt-2">
                                    <label className="text-[9px] text-gray-500 uppercase block mb-1">Active Channel</label>
                                    <select
                                        value={settings.midiDeviceManager?.activeChannel ?? 1}
                                        onChange={(e) => handleSettingChange({
                                            midiDeviceManager: {
                                                ...(settings.midiDeviceManager || {}),
                                                activeChannel: parseInt(e.target.value)
                                            }
                                        })}
                                        className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded p-1 outline-none"
                                    >
                                        {Array.from({ length: 16 }, (_, i) => i + 1).map(ch => (
                                            <option key={ch} value={ch}>Channel {ch}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <p className="text-[8px] text-gray-600 mt-1">
                                OMNI: Process messages from all channels<br />
                                SINGLE: Only process messages from selected channel
                            </p>
                        </div>
                    </div>
    );
};
