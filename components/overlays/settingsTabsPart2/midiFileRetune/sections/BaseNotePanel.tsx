import React from 'react';

type BaseNotePanelProps = {
    baseNote: number;
    onChange: (value: number) => void;
};

export const BaseNotePanel = ({ baseNote, onChange }: BaseNotePanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-1">
            <div className="flex items-center justify-between">
                <label className="text-[9px] text-gray-500 uppercase font-bold">Center Note (Key 0)</label>
                <input
                    type="number"
                    min="0"
                    max="127"
                    value={baseNote}
                    onChange={(e) => onChange(Math.max(0, Math.min(127, parseInt(e.target.value, 10) || 60)))}
                    className="w-14 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                    title="MIDI note number (0-127)"
                />
            </div>
            <div className="text-[8px] text-gray-600">60=C4, 69=A4. MIDI note {baseNote} = 1/1 of target scale</div>
        </div>
    );
};
