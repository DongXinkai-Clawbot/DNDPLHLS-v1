import React, { useMemo, useState } from 'react';

type SymbolItem = {
    /** What the user sees on the button */
    label: string;
    /** What gets inserted into the expression */
    insert: string;
    /** Move the caret left by this many characters after insertion (useful for templates like "sin()") */
    cursorBack?: number;
    /** Whether enabling "advanced symbols" preprocessing is recommended for this insert */
    requiresAdvanced?: boolean;
    title?: string;
};

type SymbolGroup = {
    name: string;
    items: SymbolItem[];
};

export type MathSymbolPopoverProps = {
    disabled?: boolean;
    /** Called when the user clicks a symbol. */
    onInsert: (text: string, cursorBack?: number, requiresAdvanced?: boolean) => void;
    /** Optional: if provided, show a compact trigger button (otherwise use default). */
    triggerLabel?: string;
};

/**
 * A compact symbol palette for expression editors.
 *
 * Design goals:
 * - Never steal focus from the input/textarea (use onMouseDown + preventDefault).
 * - Fast insertion with cursor placement.
 * - Symbols shown are chosen to be compatible with this app's expression preprocessor.
 */
export const MathSymbolPopover = ({ disabled, onInsert, triggerLabel = '∑' }: MathSymbolPopoverProps) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<string>('Constants');

    const groups: SymbolGroup[] = useMemo(
        () => [
            {
                name: 'Constants',
                items: [
                    { label: 'π', insert: 'π', requiresAdvanced: true, title: 'Pi' },
                    { label: 'τ', insert: 'τ', requiresAdvanced: true, title: 'Tau = 2π' },
                    { label: 'φ', insert: 'φ', requiresAdvanced: true, title: 'Phi (golden ratio)' },
                    { label: 'ℯ', insert: 'ℯ', requiresAdvanced: true, title: 'Euler’s number' },
                    { label: '∞', insert: '∞', requiresAdvanced: true, title: 'Infinity' },
                ],
            },
            {
                name: 'Operations',
                items: [
                    { label: '×', insert: '×', title: 'Multiply' },
                    { label: '÷', insert: '÷', title: 'Divide' },
                    { label: '·', insert: '·', title: 'Multiply (dot)' },
                    { label: '^', insert: '^', title: 'Power' },
                    { label: '²', insert: '²', requiresAdvanced: true, title: 'Square' },
                    { label: '³', insert: '³', requiresAdvanced: true, title: 'Cube' },
                    { label: '√', insert: '√()', cursorBack: 1, requiresAdvanced: true, title: 'Square root (template)' },
                    { label: '∛', insert: '∛()', cursorBack: 1, requiresAdvanced: true, title: 'Cube root (template)' },
                    { label: '≤', insert: '≤', requiresAdvanced: true, title: 'Less or equal' },
                    { label: '≥', insert: '≥', requiresAdvanced: true, title: 'Greater or equal' },
                    { label: '≠', insert: '≠', requiresAdvanced: true, title: 'Not equal' },
                    { label: '≈', insert: '≈', requiresAdvanced: true, title: 'Approx equal' },
                ],
            },
            {
                name: 'Calculus',
                items: [
                    { label: '∑', insert: '∑(1/n, n, 1, 10)', cursorBack: 0, requiresAdvanced: true, title: 'Summation template' },
                    { label: '∏', insert: '∏(n, n, 1, 6)', cursorBack: 0, requiresAdvanced: true, title: 'Product template' },
                    { label: '∫', insert: '∫(sin(x), x, 0, π, 512)', cursorBack: 0, requiresAdvanced: true, title: 'Integral template' },
                    { label: '∂', insert: '∂(sin(x), x, 0)', cursorBack: 0, requiresAdvanced: true, title: 'Derivative (finite difference) template' },
                ],
            },
            {
                name: 'Greek',
                items: [
                    { label: 'θ', insert: 'θ', requiresAdvanced: true, title: 'theta' },
                    { label: 'λ', insert: 'λ', requiresAdvanced: true, title: 'lambda' },
                    { label: 'μ', insert: 'μ', requiresAdvanced: true, title: 'mu' },
                    { label: 'σ', insert: 'σ', requiresAdvanced: true, title: 'sigma' },
                    { label: 'ω', insert: 'ω', requiresAdvanced: true, title: 'omega' },
                    { label: 'α', insert: 'α', requiresAdvanced: true, title: 'alpha' },
                    { label: 'β', insert: 'β', requiresAdvanced: true, title: 'beta' },
                    { label: 'γ', insert: 'γ', requiresAdvanced: true, title: 'gamma' },
                    { label: 'δ', insert: 'δ', requiresAdvanced: true, title: 'delta' },
                    { label: 'ε', insert: 'ε', requiresAdvanced: true, title: 'epsilon' },
                    { label: 'ρ', insert: 'ρ', requiresAdvanced: true, title: 'rho' },
                ],
            },
        ],
        []
    );

    const active = groups.find((g) => g.name === tab) || groups[0];

    const close = () => setOpen(false);

    return (
        <div className="relative">
            <button
                type="button"
                disabled={!!disabled}
                onMouseDown={(e) => {
                    // keep the expression field focused
                    e.preventDefault();
                    if (disabled) return;
                    setOpen((v) => !v);
                }}
                className={`px-2 py-1 rounded border text-[10px] font-black uppercase tracking-widest select-none ${
                    disabled
                        ? 'bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed'
                        : 'bg-black/60 border-gray-700 text-gray-200 hover:bg-black/80'
                }`}
                title="Insert math symbols"
            >
                {triggerLabel} Symbols
            </button>

            {open && (
                <>
                    {/* outside click capture */}
                    <div
                        className="fixed inset-0 z-40"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            close();
                        }}
                    />

                    <div className="absolute right-0 mt-2 z-50 w-[340px] bg-gray-950 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-800">
                            <div className="flex gap-1 flex-wrap">
                                {groups.map((g) => (
                                    <button
                                        key={g.name}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setTab(g.name);
                                        }}
                                        className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                                            tab === g.name ? 'bg-blue-700 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    close();
                                }}
                                className="text-gray-400 hover:text-white text-sm px-2"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-2">
                            <div className="grid grid-cols-6 gap-1">
                                {active.items.map((item, idx) => (
                                    <button
                                        key={`${active.name}-${idx}`}
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onInsert(item.insert, item.cursorBack, item.requiresAdvanced);
                                            close();
                                        }}
                                        className="h-10 rounded bg-gray-900 border border-gray-800 hover:border-blue-500 hover:text-white text-gray-200 text-lg flex items-center justify-center"
                                        title={item.title || item.insert}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-2 text-[9px] text-gray-500 leading-snug">
                                Tip: these symbols are designed to work with the app’s expression preprocessor (π→pi, ∫→integrate, ×→*, √→sqrt, etc.).
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
