import React, { useState } from 'react';

type SymbolPickerProps = {
    type: 'up' | 'down';
    prime: number;
    currentValue: string;
    onUpdate: (value: string) => void;
};

export const SimpleSymbolPicker: React.FC<SymbolPickerProps> = ({ type, prime, currentValue, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);

    const latinLetters = ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];
    const greekUpper = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ', 'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω'];
    const symbols = ['↑', '↓', '⭡', '⭣', '▲', '▼', '△', '▽', '+', '-', '⁺', '⁻'];
    const subscript = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    const superscript = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

    const selectSymbol = (symbol: string) => {
        onUpdate(symbol);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <div className="flex gap-1">
                <input
                    id={`symbol-${type}-${prime}`}
                    type="text"
                    maxLength={3}
                    placeholder={type === 'up' ? '↑' : '↓'}
                    value={currentValue}
                    onChange={(e) => onUpdate(e.target.value)}
                    className="flex-1 bg-black/60 border border-purple-700/50 rounded px-1.5 py-1 text-[10px] text-center text-purple-200 outline-none focus:border-purple-400 font-mono"
                />
                <button
                    type="button"
                    onMouseDown={() => setIsOpen(!isOpen)}
                    className="px-1.5 bg-purple-800/50 hover:bg-purple-700 border border-purple-600 rounded text-[9px] text-purple-200"
                >
                    {isOpen ? '▴' : '▾'}
                </button>
            </div>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[998]"
                        onMouseDown={() => setIsOpen(false)}
                    />
                    <div className="absolute z-[999] mt-1 left-0 bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl p-2 w-64 max-h-64 overflow-y-auto">
                        <div className="space-y-1.5">
                            <div>
                                <div className="text-[8px] text-purple-400 font-bold mb-1">Greek Lower</div>
                                <div className="flex flex-wrap gap-1">
                                    {latinLetters.map(s => (
                                        <button key={s} type="button" onMouseDown={() => selectSymbol(s)} className="w-6 h-6 bg-gray-800 hover:bg-purple-600 border border-gray-700 rounded text-xs text-white">{s}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-[8px] text-purple-400 font-bold mb-1">Greek Upper</div>
                                <div className="flex flex-wrap gap-1">
                                    {greekUpper.map(s => (
                                        <button key={s} type="button" onMouseDown={() => selectSymbol(s)} className="w-6 h-6 bg-gray-800 hover:bg-purple-600 border border-gray-700 rounded text-xs text-white">{s}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-[8px] text-purple-400 font-bold mb-1">Arrows & Symbols</div>
                                <div className="flex flex-wrap gap-1">
                                    {symbols.map(s => (
                                        <button key={s} type="button" onMouseDown={() => selectSymbol(s)} className="w-6 h-6 bg-gray-800 hover:bg-purple-600 border border-gray-700 rounded text-xs text-white">{s}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                    <div className="text-[8px] text-purple-400 font-bold mb-1">Subscript</div>
                                    <div className="flex flex-wrap gap-1">
                                        {subscript.map(s => (
                                            <button key={s} type="button" onMouseDown={() => selectSymbol(s)} className="w-5 h-5 bg-gray-800 hover:bg-purple-600 border border-gray-700 rounded text-[10px] text-white">{s}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[8px] text-purple-400 font-bold mb-1">Superscript</div>
                                    <div className="flex flex-wrap gap-1">
                                        {superscript.map(s => (
                                            <button key={s} type="button" onMouseDown={() => selectSymbol(s)} className="w-5 h-5 bg-gray-800 hover:bg-purple-600 border border-gray-700 rounded text-[10px] text-white">{s}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
