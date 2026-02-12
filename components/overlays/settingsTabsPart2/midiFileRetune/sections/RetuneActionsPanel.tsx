import React from 'react';

type RetuneActionsPanelProps = {
    busy: boolean;
    importResult: any;
    playingType: 'original' | 'retuned' | null;
    onRetune: () => void;
    onPlayRetuned: () => void;
    outputUrl: string | null;
    outputName: string | null;
    onExportAudio: () => void;
    audioRendering: boolean;
    audioUrl: string | null;
    audioName: string;
    audioWaveform: OscillatorType;
    onWaveformChange: (wave: OscillatorType) => void;
};

export const RetuneActionsPanel = ({
    busy,
    importResult,
    playingType,
    onRetune,
    onPlayRetuned,
    outputUrl,
    outputName,
    onExportAudio,
    audioRendering,
    audioUrl,
    audioName,
    audioWaveform,
    onWaveformChange
}: RetuneActionsPanelProps) => {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={onRetune}
                disabled={busy || !importResult}
                className="text-[9px] bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded font-bold disabled:opacity-50"
            >
                {busy ? 'Processing...' : 'Retune'}
            </button>
            <div className="h-4 w-px bg-gray-700 mx-1"></div>
            <button
                onClick={onPlayRetuned}
                disabled={busy || audioRendering}
                className={`text-[9px] px-3 py-1.5 rounded font-bold border ${playingType === 'retuned' ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-indigo-700 hover:bg-indigo-600 text-white border-transparent'}`}
            >
                {playingType === 'retuned' ? 'Stop' : 'Preview'}
            </button>
            {outputUrl && (
                <>
                    <a
                        href={outputUrl}
                        download={outputName || undefined}
                        className="text-[9px] bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded font-bold"
                    >
                        .midi
                    </a>
                    <button
                        onClick={onExportAudio}
                        disabled={audioRendering}
                        className="text-[9px] bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded font-bold disabled:opacity-50"
                    >
                        {audioRendering ? 'Rendering...' : '.wav'}
                    </button>
                    {audioUrl && (
                        <a
                            href={audioUrl}
                            download={audioName}
                            className="text-[9px] bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded font-bold"
                        >
                            WAV
                        </a>
                    )}
                    <div className="flex gap-0.5 ml-2">
                        {(['sine', 'triangle', 'sawtooth', 'square'] as const).map(w => (
                            <button
                                key={w}
                                onClick={() => onWaveformChange(w)}
                                className={`text-[7px] px-1 py-0.5 rounded border uppercase font-bold ${audioWaveform === w ? 'bg-amber-600 text-white border-amber-500' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                            >
                                {w.slice(0, 3)}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
