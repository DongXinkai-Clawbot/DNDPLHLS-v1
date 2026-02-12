import React, { useEffect } from 'react';
import { DEFAULT_SETTINGS } from '../../../constants';
import { SimpleSymbolPicker } from '../../common/SimpleSymbolPicker';
import { SYM_LIMITS } from './constants';
export const SymTab = ({ settings, updateSettings }: any) => {
    const defaultSymbols = DEFAULT_SETTINGS.notationSymbols;
    const ratioDisplay = settings.visuals?.ratioDisplay || (DEFAULT_SETTINGS.visuals as any).ratioDisplay;

    const updateRatioDisplay = (patch: any) => {
        const current = settings.visuals?.ratioDisplay || (DEFAULT_SETTINGS.visuals as any).ratioDisplay;
        const next = {
            ...current,
            ...patch,
            contexts: { ...(current?.contexts || {}), ...(patch?.contexts || {}) }
        };
        updateSettings({ visuals: { ...settings.visuals, ratioDisplay: next } });
    };

    useEffect(() => {
        if (!settings.notationSymbols) {
            updateSettings({ notationSymbols: { ...defaultSymbols } });
            return;
        }
        const hasMissing = SYM_LIMITS.some(limit => settings.notationSymbols[limit] === undefined);
        if (hasMissing) {
            updateSettings({ notationSymbols: { ...defaultSymbols, ...settings.notationSymbols } });
        }
    }, [defaultSymbols, settings.notationSymbols, updateSettings]);

    const handleChange = (limit: number, type: 'up' | 'down', value: string) => {
        const currentSyms = settings.notationSymbols[limit] || defaultSymbols[limit] || { up: '', down: '' };
        const newSyms = { ...settings.notationSymbols, [limit]: { ...currentSyms, [type]: value } };
        updateSettings({ notationSymbols: newSyms });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase">Microtonal Notation</h3>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Placement</span>
                    <div className="flex bg-black rounded p-0.5 border border-gray-700">
                        {['left', 'split', 'right'].map(mode => (
                            <button
                                key={mode}
                                onClick={() => updateSettings({ accidentalPlacement: mode })}
                                className={`px-2 py-1 text-[9px] font-bold uppercase rounded ${settings.accidentalPlacement === mode ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    {SYM_LIMITS.map(l => (
                        <div key={l} className="flex items-center gap-2 bg-gray-800/50 p-2 rounded">
                            <span className="text-xs font-bold text-gray-300 w-8">{l}</span>
                            <div className="flex-1">
                                <label className="text-[8px] text-green-500 uppercase block mb-0.5 font-bold">Up</label>
                                <SimpleSymbolPicker
                                    type="up"
                                    prime={l}
                                    currentValue={settings.notationSymbols[l]?.up || ''}
                                    onUpdate={(val) => handleChange(l, 'up', val)}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[8px] text-red-500 uppercase block mb-0.5 font-bold">Down</label>
                                <SimpleSymbolPicker
                                    type="down"
                                    prime={l}
                                    currentValue={settings.notationSymbols[l]?.down || ''}
                                    onUpdate={(val) => handleChange(l, 'down', val)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase">Ratio Display</h3>

                <div className="bg-black/30 border border-gray-800 rounded p-2 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Auto: Switch To Prime Powers</span>
                        <span className="text-[10px] text-blue-300 font-mono">{(ratioDisplay?.autoPowerDigits ?? 14)} digits</span>
                    </div>
                    <input
                        type="range"
                        min="6"
                        max="50"
                        step="1"
                        value={ratioDisplay?.autoPowerDigits ?? 14}
                        onChange={(e) => updateRatioDisplay({ autoPowerDigits: parseInt(e.target.value, 10) })}
                        className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                    />
                    <div className="text-[9px] text-gray-500">
                        Auto keeps standard fractions until the numerator/denominator would be long, then switches to prime-power form like{' '}
                        <span className="font-mono text-gray-300">3^n*5^l/2^m*7^k</span>.
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {[
                        { key: 'infoPanel', label: 'Info Panel' },
                        { key: 'nodeDeriver', label: 'n-limit JI ratio deriver' },
                        { key: 'search', label: 'Search Suggestions' },
                        { key: 'nodeLabels', label: 'Node Labels' },
                        { key: 'musicXmlRetune', label: 'MusicXML Retune' }
                    ].map((ctx: any) => (
                        <div key={ctx.key} className="bg-black/30 border border-gray-800 rounded p-2">
                            <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">{ctx.label}</label>
                            <select
                                value={(ratioDisplay?.contexts?.[ctx.key] || 'auto') as any}
                                onChange={(e) => updateRatioDisplay({ contexts: { [ctx.key]: e.target.value } })}
                                className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                            >
                                <option value="fraction">Fraction (n/d)</option>
                                <option value="primePowers">Prime Powers (a^n*b^l/...)</option>
                                <option value="auto">Auto</option>
                            </select>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
