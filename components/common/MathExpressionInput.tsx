import React, { useEffect, useRef, useState } from 'react';
import { MathSymbolPopover } from './MathSymbolPopover';

export type MathExpressionInputProps = {
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    multiline?: boolean;
    rows?: number;
    /**
     * If provided, this will be called when the user inserts a symbol that benefits from
     * "advanced symbols" preprocessing (π, √, ∫, ≤, etc.).
     */
    onRequestEnableAdvancedSymbols?: () => void;
    /**
     * Customize the trigger button label.
     */
    symbolTriggerLabel?: string;
};

/**
 * A controlled input/textarea for math expressions, with an optional symbol palette.
 *
 * Critical behavior:
 * - Insert symbols at the current caret position.
 * - Preserve focus (symbol clicks should not blur the field).
 * - Restore caret to a sensible place after insertion.
 */
export const MathExpressionInput = ({
    value,
    onChange,
    disabled,
    placeholder,
    className,
    multiline,
    rows,
    onRequestEnableAdvancedSymbols,
    symbolTriggerLabel,
}: MathExpressionInputProps) => {
    const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [pendingCaret, setPendingCaret] = useState<number | null>(null);

    useEffect(() => {
        if (pendingCaret == null) return;
        const el = ref.current;
        if (!el) {
            setPendingCaret(null);
            return;
        }
        // Defer until React has applied the new value.
        requestAnimationFrame(() => {
            try {
                el.focus();
                el.setSelectionRange(pendingCaret, pendingCaret);
            } catch {
                // Some mobile browsers can throw if selection isn't supported.
            } finally {
                setPendingCaret(null);
            }
        });
    }, [pendingCaret, value]);

    const insertAtCaret = (insert: string, cursorBack = 0) => {
        if (disabled) return;
        const el = ref.current;
        if (!el) return;

        const start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
        const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;
        const next = value.slice(0, start) + insert + value.slice(end);
        const caret = Math.max(0, Math.min(next.length, start + insert.length - (cursorBack || 0)));

        onChange(next);
        setPendingCaret(caret);
    };

    const Field: any = multiline ? 'textarea' : 'input';
    const fieldProps = multiline ? { rows: rows ?? 3 } : {};

    return (
        <div className="flex items-start gap-2 w-full">
            <Field
                ref={ref as any}
                value={value}
                disabled={!!disabled}
                placeholder={placeholder}
                onChange={(e: any) => onChange(e.target.value)}
                className={className}
                {...fieldProps}
            />
            <MathSymbolPopover
                disabled={disabled}
                triggerLabel={symbolTriggerLabel}
                onInsert={(text, cursorBack, requiresAdvanced) => {
                    if (requiresAdvanced && onRequestEnableAdvancedSymbols) {
                        onRequestEnableAdvancedSymbols();
                    }
                    insertAtCaret(text, cursorBack);
                }}
            />
        </div>
    );
};
