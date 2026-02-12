import React from 'react';
import type { CustomPrimeConfig } from '../../../types';
import { SimpleSymbolPicker } from '../../common/SimpleSymbolPicker';
import { isPrime } from '../../../musicLogic';

export const CustomPrimeNotationRow: React.FC<{
    cp: CustomPrimeConfig;
    globalSettings: any;
    handleSettingChange: (key: string, value: any) => void;
}> = ({ cp, globalSettings, handleSettingChange }) => {
    const isComposite = !isPrime(cp.prime);

    const updateSymbol = (type: 'up' | 'down', value: string) => {
        const updated = (globalSettings.customPrimes || []).map((c: CustomPrimeConfig) =>
            c.prime === cp.prime
                ? { ...c, symbol: { ...(c.symbol || { up: '', down: '' }), [type]: value } }
                : c
        );
        handleSettingChange('customPrimes', updated);
    };

    const updatePlacement = (mode: 'left' | 'right' | 'split') => {
        const updated = (globalSettings.customPrimes || []).map((c: CustomPrimeConfig) =>
            c.prime === cp.prime
                ? { ...c, symbol: { ...(c.symbol || { up: '', down: '' }), placement: mode } }
                : c
        );
        handleSettingChange('customPrimes', updated);
    };

    const accidentalControls = (
        <>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label htmlFor={`symbol-up-${cp.prime}`} className="text-[8px] text-green-500 uppercase block mb-1 font-bold">Up</label>
                    <SimpleSymbolPicker
                        type="up"
                        prime={cp.prime}
                        currentValue={cp.symbol?.up || ''}
                        onUpdate={(value) => updateSymbol('up', value)}
                    />
                </div>
                <div>
                    <label htmlFor={`symbol-down-${cp.prime}`} className="text-[8px] text-red-500 uppercase block mb-1 font-bold">Down</label>
                    <SimpleSymbolPicker
                        type="down"
                        prime={cp.prime}
                        currentValue={cp.symbol?.down || ''}
                        onUpdate={(value) => updateSymbol('down', value)}
                    />
                </div>
            </div>

            <div className="flex justify-between items-center mt-2 bg-gray-900/50 p-1 rounded">
                <span className="text-[8px] text-gray-500 uppercase font-bold">Placement</span>
                <div className="flex bg-black rounded p-0.5 border border-gray-700 gap-0.5">
                    {['split', 'left', 'right'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => updatePlacement(mode as any)}
                            className={`px-1.5 py-0.5 text-[8px] font-bold uppercase rounded ${cp.symbol?.placement === mode ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                            title={`Set placement to ${mode}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );

    return (
        <div className="bg-black/40 border border-purple-900/40 rounded p-2">
            <div className="flex items-center gap-2 mb-2">
                <input
                    type="color"
                    value={cp.color}
                    onChange={(e) => {
                        const updated = (globalSettings.customPrimes || []).map((c: CustomPrimeConfig) =>
                            c.prime === cp.prime ? { ...c, color: e.target.value } : c
                        );
                        handleSettingChange('customPrimes', updated);
                    }}
                    className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                    title="Change color"
                />
                <span className="text-xs font-mono font-bold flex-1" style={{ color: cp.color }}>
                    {isPrime(cp.prime) ? 'Prime' : 'Odd Limit'} {cp.prime.toLocaleString()}
                </span>
            </div>
            {isComposite ? (
                <details className="group">
                    <summary className="cursor-pointer text-[9px] text-purple-300 uppercase font-bold tracking-widest">
                        Accidentals (Optional)
                    </summary>
                    <div className="mt-2">
                        {accidentalControls}
                    </div>
                </details>
            ) : (
                accidentalControls
            )}
        </div>
    );
};
