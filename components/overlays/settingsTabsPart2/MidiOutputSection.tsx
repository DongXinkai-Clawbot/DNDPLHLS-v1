import React from 'react';
import { panicMidiOut } from '../../../midiOut';

type MidiOutputSectionProps = Record<string, any>;

export const MidiOutputSection = (props: MidiOutputSectionProps) => {
    const {
        settings,
        handleSettingChange,
        midiOutEnabled,
        midiOutId,
        outputs,
        midiOutChannels,
        midiOutPitchBendRange,
    } = props;

    return (
        <div className="p-3 bg-purple-900/20 border border-purple-800/50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-purple-300 uppercase">MIDI Output (Hardware Synth)</h4>
                        </div>
        
                        <label className="flex items-center gap-3 cursor-pointer p-1 hover:bg-white/5 rounded transition-colors">
                            <input
                                type="checkbox"
                                checked={midiOutEnabled}
                                onChange={(e) => handleSettingChange({ midi: { ...settings.midi, outputEnabled: e.target.checked } })}
                                className="w-4 h-4 accent-purple-500 rounded"
                            />
                            <span className="text-[10px] text-gray-300 font-bold uppercase">Enable MIDI Output (Mirror Playback)</span>
                        </label>
        
                        <div className={`space-y-3 transition-all duration-300 ${!midiOutEnabled ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' : 'max-h-[600px] opacity-100'}`}>
                            <div>
                                <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Output Device</label>
                                <select
                                    value={midiOutId}
                                    onChange={(e) => handleSettingChange({ midi: { ...settings.midi, outputId: e.target.value } })}
                                    className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-purple-500 outline-none"
                                >
                                    <option value="">-- First Output --</option>
                                    {outputs.map(o => (
                                        <option key={o.id} value={o.id}>{o.name || o.id}</option>
                                    ))}
                                </select>
                                {outputs.length === 0 && (
                                    <div className="text-[9px] text-gray-500 mt-1 italic">No MIDI outputs detected. Connect a device and reload the page.</div>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-[9px] text-gray-500 italic">Emergency stop for stuck notes.</div>
                                <button
                                    type="button"
                                    onClick={() => panicMidiOut()}
                                    className="text-[9px] font-bold uppercase text-red-200 bg-red-600/20 border border-red-500/40 rounded px-2 py-1 hover:bg-red-600/30"
                                >
                                    Panic (All Notes Off)
                                </button>
                            </div>
        
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Output Channels (Multi-Select)</label>
                                    <div className="grid grid-cols-8 gap-1 bg-gray-800 border border-gray-600 rounded p-2">
                                        {[...Array(16)].map((_, i) => {
                                            const ch = i + 1;
                                            const isSelected = midiOutChannels.includes(ch);
                                            return (
                                                <button
                                                    key={ch}
                                                    onClick={() => {
                                                        let newChannels: number[];
                                                        if (isSelected) {
                                                            
                                                            newChannels = midiOutChannels.filter(c => c !== ch);
                                                            if (newChannels.length === 0) newChannels = [ch];
                                                        } else {
                                                            
                                                            newChannels = [...midiOutChannels, ch].sort((a, b) => a - b);
                                                        }
                                                        handleSettingChange({ midi: { ...settings.midi, outputChannels: newChannels } });
                                                    }}
                                                    className={`text-[9px] py-1 rounded font-bold transition-all ${isSelected
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                        }`}
                                                >
                                                    {ch}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            onClick={() => handleSettingChange({ midi: { ...settings.midi, outputChannels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] } })}
                                            className="text-[8px] text-purple-400 hover:text-purple-300"
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => handleSettingChange({ midi: { ...settings.midi, outputChannels: [1] } })}
                                            className="text-[8px] text-gray-400 hover:text-gray-300"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Pitch Bend Range (semitones)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        step="1"
                                        value={midiOutPitchBendRange}
                                        onChange={(e) => handleSettingChange({ midi: { ...settings.midi, outputPitchBendRange: parseInt(e.target.value || '2', 10) } })}
                                        className="w-full bg-gray-800 border border-gray-600 rounded text-center text-xs text-purple-200 font-bold py-1"
                                    />
                                </div>
                            </div>
        
                            <div className="flex items-center gap-2 mt-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                                <input
                                    type="checkbox"
                                    checked={(settings.midi as any).polyphonicChannelMode !== false}
                                    onChange={(e) => handleSettingChange({ midi: { ...settings.midi, polyphonicChannelMode: e.target.checked } })}
                                    className="w-4 h-4 accent-purple-500 rounded"
                                />
                                <div>
                                    <span className="text-[10px] text-purple-200 font-bold">Polyphonic Channel Mode</span>
                                    <p className="text-[8px] text-gray-500">Auto-allocates each note to a separate MIDI channel to prevent pitch bend conflicts when playing chords</p>
                                </div>
                            </div>
        
                            <div className="text-[9px] text-gray-500 italic">
                                Mirrors internal playback to your MIDI device using Note On/Off + Pitch Bend (RPN 0,0 is sent when possible).
                            </div>
                        </div>
                    </div>
    );
};
