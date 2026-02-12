import React from 'react';

type MidiInputSectionProps = Record<string, any>;

export const MidiInputSection = (props: MidiInputSectionProps) => {
    const {
        settings,
        handleSettingChange,
        devices,
        contentCollapsed,
        lastNote,
    } = props;

    return (
        <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer p-1 hover:bg-white/5 rounded transition-colors">
                            <input
                                type="checkbox"
                                checked={settings.midi.enabled}
                                onChange={(e) => handleSettingChange({ midi: { ...settings.midi, enabled: e.target.checked } })}
                                className="w-4 h-4 accent-blue-500 rounded"
                            />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Enable MIDI Input</span>
                        </label>
        
                        <div className={`space-y-3 transition-all duration-300 ${contentCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' : 'max-h-[2400px] opacity-100'}`}>
                            <div>
                                <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Input Device</label>
                                <select
                                    value={settings.midi.inputName}
                                    onChange={(e) => handleSettingChange({ midi: { ...settings.midi, inputName: e.target.value } })}
                                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                                >
                                    <option value="">-- All Devices --</option>
                                    {devices.map(d => (
                                        <option key={d.id} value={d.name || d.id}>{d.name || "Unknown Device"}</option>
                                    ))}
                                </select>
                            </div>
        
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Center Key (1/1)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={settings.midi.centerNote}
                                            onChange={(e) => handleSettingChange({ midi: { ...settings.midi, centerNote: parseInt(e.target.value) } })}
                                            className="bg-gray-800 border border-gray-600 rounded text-center text-xs text-blue-300 font-bold w-12 py-1"
                                        />
                                        <span className="text-[10px] text-gray-400 font-mono">
                                            {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][settings.midi.centerNote % 12]}
                                            {Math.floor(settings.midi.centerNote / 12) - 1}
                                        </span>
                                        {lastNote !== null && (
                                            <button
                                                onClick={() => handleSettingChange({ midi: { ...settings.midi, centerNote: lastNote } })}
                                                className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-700 animate-pulse"
                                            >
                                                Set to Pressed ({lastNote})
                                            </button>
                                        )}
                                    </div>
                                </div>
        
                                <div className="flex-1">
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Channel</label>
                                    <select
                                        value={settings.midi.channel}
                                        onChange={(e) => handleSettingChange({ midi: { ...settings.midi, channel: parseInt(e.target.value) } })}
                                        className="w-full bg-gray-800 border border-gray-600 text-xs text-white rounded p-1 outline-none"
                                    >
                                        <option value={0}>All (Omni)</option>
                                        {[...Array(16)].map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                                    </select>
                                </div>
                            </div>
        
                            <div className="pt-2">
                                <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Key Filtering (Mute Keys)</label>
                                <select
                                    value={settings.midi.keyFilter}
                                    onChange={(e) => handleSettingChange({ midi: { ...settings.midi, keyFilter: e.target.value } })}
                                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                                >
                                    <option value="all">Standard 12 (All Physical Keys)</option>
                                    <option value="white">White Keys Only (Black keys cannot work or sound)</option>
                                    <option value="black">Black Keys Only (White keys cannot work or sound)</option>
                                </select>
                                <p className="text-[8px] text-gray-600 mt-1 italic">Note: Silences keys based on your selection to focus on specific scale subsets.</p>
                            </div>
        
                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={settings.midi.velocitySensitivity}
                                    onChange={(e) => handleSettingChange({ midi: { ...settings.midi, velocitySensitivity: e.target.checked } })}
                                    className="w-3 h-3 accent-green-500"
                                />
                                <span className="text-[9px] text-gray-400 font-bold uppercase">Use Velocity (Volume)</span>
                            </label>
                        </div>
                    </div>
    );
};
