import React from 'react';

type MidiRetuneHeaderProps = {
    fileInputRef: React.RefObject<HTMLInputElement>;
    onLoadDemo: () => void;
    onClear: () => void;
    onFileSelected: (file: File) => void;
};

export const MidiRetuneHeader = ({ fileInputRef, onLoadDemo, onClear, onFileSelected }: MidiRetuneHeaderProps) => {
    return (
        <>
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-emerald-300 uppercase">MIDI File Retune</h4>
                <div className="flex gap-1">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[9px] bg-emerald-900/50 hover:bg-emerald-800 text-emerald-200 px-2 py-1 rounded border border-emerald-700 font-bold uppercase"
                    >
                        Upload
                    </button>
                    <button
                        onClick={onLoadDemo}
                        className="text-[9px] bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 px-2 py-1 rounded border border-indigo-700 font-bold uppercase"
                    >
                        Demo
                    </button>
                    <button
                        onClick={onClear}
                        className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".mid,.midi,audio/midi"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileSelected(file);
                }}
            />

            <p className="text-[9px] text-gray-500 italic">
                Notes are remapped to the nearest pitch in the selected tuning. Timing and track structure stay unchanged.
            </p>
        </>
    );
};
