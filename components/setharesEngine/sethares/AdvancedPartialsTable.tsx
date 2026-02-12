import React from 'react';
import { Partial, clamp } from './utils';

const AdvancedPartialsTable = ({
    partials,
    onChange,
    stretch,
    style
}: {
    partials: Partial[],
    onChange: (p: Partial[]) => void,
    stretch: number,
    style?: React.CSSProperties
}) => {
    const updateAmp = (idx: number, newAmp: number) => {
        const next = [...partials];
        next[idx] = { ...next[idx], amplitude: newAmp };
        onChange(next);
    };

    const updateRatio = (idx: number, newRatio: number) => {
        const safeRatio = clamp(newRatio, 0.0001, 64);
        const baseRatio = Math.pow(safeRatio, 1 / stretch);
        const next = [...partials];
        next[idx] = { ...next[idx], ratio: safeRatio, originalRatio: baseRatio };
        onChange(next);
    };

    const updateWaveform = (idx: number, newWaveform: OscillatorType) => {
        const next = [...partials];
        next[idx] = { ...next[idx], waveform: newWaveform };
        onChange(next);
    };

    return (
        <div className="h-full flex flex-col border-r border-gray-800 bg-black/50 overflow-hidden" style={style}>
            <div className="p-3 border-b border-gray-800 bg-black/60">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                    Advanced Partials
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full border-collapse text-[10px]">
                    <thead className="sticky top-0 bg-black/90 z-10">
                        <tr className="text-gray-400 text-left">
                            <th className="p-2 border-b border-gray-800">#</th>
                            <th className="p-2 border-b border-gray-800">Ratio</th>
                            <th className="p-2 border-b border-gray-800">Amp</th>
                            <th className="p-2 border-b border-gray-800">Wave</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partials.map((p, i) => (
                            <tr key={p.index} className="border-b border-gray-900">
                                <td className="p-1 text-gray-500 text-center">{p.index}</td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={Number(p.ratio.toFixed(4))}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (Number.isFinite(value)) {
                                                updateRatio(i, value);
                                            }
                                        }}
                                        className="w-24 min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-indigo-400 font-mono text-[11px]"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={Number(p.amplitude.toFixed(2))}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (Number.isFinite(value)) {
                                                updateAmp(i, clamp(value, 0, 1));
                                            }
                                        }}
                                        className="w-20 min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                                    />
                                </td>
                                <td className="p-1">
                                    <select
                                        value={p.waveform}
                                        onChange={(e) => updateWaveform(i, e.target.value as OscillatorType)}
                                        className="min-h-[36px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white font-mono text-[11px] [&>option]:bg-gray-900 [&>option]:text-white"
                                    >
                                        <option value="sine">Sine</option>
                                        <option value="triangle">Triangle</option>
                                        <option value="sawtooth">Saw</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdvancedPartialsTable;
