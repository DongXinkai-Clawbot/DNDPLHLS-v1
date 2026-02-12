
import React, { useState, useRef, useMemo } from 'react';

interface SimpleRatio {
    label: string;
    n: number;
    d: number;
}

interface Props {
    availableRatios: SimpleRatio[];
    onChange: (weights: Record<string, number>) => void;
    currentWeights?: Record<string, number>;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const DEFAULT_CORNERS = ['3/2', '5/4', '7/4', '11/8'];

const RatioSelector: React.FC<{
    value: string;
    idx: number;
    options: SimpleRatio[];
    onChange: (idx: number, val: string) => void;
}> = ({ value, idx, options, onChange }) => (
    <select
        value={value}
        onChange={e => onChange(idx, e.target.value)}
        onPointerDown={e => e.stopPropagation()} 
        className="bg-black/70 border border-gray-600 rounded text-[9px] text-gray-300 px-1 py-0.5 max-w-[70px] focus:outline-none focus:border-indigo-500 cursor-pointer pointer-events-auto"
    >
        {options.map(r => {
            const k = `${r.n}/${r.d}`;
            const displayLabel = r.label || k;
            return <option key={k} value={k}>{displayLabel.length > 12 ? k : displayLabel}</option>;
        })}
    </select>
);

export const QuadWeightPad: React.FC<Props> = ({ availableRatios, onChange, currentWeights }) => {
    
    const [cornerKeys, setCornerKeys] = useState<string[]>(() => {
        
        const available = availableRatios.map(r => `${r.n}/${r.d}`);
        return DEFAULT_CORNERS.map((def, i) =>
            available.includes(def) ? def : (available[i] || available[0] || '1/1')
        );
    });

    const [pos, setPos] = useState({ x: 0.5, y: 0.5 });

    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    const computeWeights = (x: number, y: number, corners: string[]): Record<string, number> => {
        const w: Record<string, number> = {};

        availableRatios.forEach(r => { w[`${r.n}/${r.d}`] = 0; });

        const weights: [string, number][] = [
            [corners[0], (1 - x) * (1 - y)], 
            [corners[1], x * (1 - y)],     
            [corners[2], (1 - x) * y],     
            [corners[3], x * y],         
        ];

        weights.forEach(([key, val]) => {
            
            const exists = availableRatios.find(r => `${r.n}/${r.d}` === key);
            if (exists) {
                const k = `${exists.n}/${exists.d}`;
                w[k] = (w[k] || 0) + val;
            }
        });

        return w;
    };

    const rafRef = useRef<number | null>(null);

    const updateWeights = (x: number, y: number, corners: string[]) => {
        setPos({ x, y });

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            const w = computeWeights(x, y, corners);
            onChange(w);
            rafRef.current = null;
        });
    };

    const handleMove = (clientX: number, clientY: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const puckRadius = 8; 
        
        const effectiveWidth = rect.width - puckRadius * 2;
        const effectiveHeight = rect.height - puckRadius * 2;
        const rawX = clientX - rect.left - puckRadius;
        const rawY = clientY - rect.top - puckRadius;
        const x = clamp(rawX / effectiveWidth, 0, 1);
        const y = clamp(rawY / effectiveHeight, 0, 1);
        updateWeights(x, y, cornerKeys);
    };

    const onPointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        handleMove(e.clientX, e.clientY);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (isDragging.current) handleMove(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
        isDragging.current = false;
    };

    const handleCornerChange = (idx: number, newVal: string) => {
        const next = [...cornerKeys];
        next[idx] = newVal;
        setCornerKeys(next);
        updateWeights(pos.x, pos.y, next);
    };

    const activeWeights = useMemo(() => {
        if (currentWeights) return currentWeights;
        return computeWeights(pos.x, pos.y, cornerKeys);
    }, [pos, cornerKeys, currentWeights]);

    const weightsSummary = Object.entries(activeWeights)
        .filter(([_, w]) => w > 0.05)
        .sort((a, b) => b[1] - a[1])
        .map(([k, w]) => `${k}: ${Math.round(w * 100)}%`)
        .join(' · ');

    return (
        <div className="flex flex-col gap-1.5 w-full select-none">
            <div className="flex justify-between px-0.5">
                <RatioSelector value={cornerKeys[0]} idx={0} options={availableRatios} onChange={handleCornerChange} />
                <RatioSelector value={cornerKeys[1]} idx={1} options={availableRatios} onChange={handleCornerChange} />
            </div>

            <div
                ref={containerRef}
                className="relative h-28 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden cursor-crosshair touch-none shadow-inner"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
            >
                <div className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#555 1px, transparent 1px), linear-gradient(90deg, #555 1px, transparent 1px)',
                        backgroundSize: '25% 25%'
                    }}
                />

                <div className="absolute inset-0 opacity-40 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle at ${pos.x * 100}% ${pos.y * 100}%, rgba(99, 102, 241, 0.5) 0%, transparent 50%)`
                    }}
                />

                <div className="absolute top-1 left-1 text-[8px] text-gray-500 font-mono pointer-events-none">TL</div>
                <div className="absolute top-1 right-1 text-[8px] text-gray-500 font-mono pointer-events-none">TR</div>
                <div className="absolute bottom-1 left-1 text-[8px] text-gray-500 font-mono pointer-events-none">BL</div>
                <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 font-mono pointer-events-none">BR</div>

                <div
                    className="absolute w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] border-2 border-indigo-500 pointer-events-none"
                    style={{
                        
                        left: `calc(${pos.x} * (100% - 16px))`,
                        top: `calc(${pos.y} * (100% - 16px))`
                    }}
                />

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-0.5 h-full bg-gray-500" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-full h-0.5 bg-gray-500" />
                </div>
            </div>

            <div className="flex justify-between px-0.5">
                <RatioSelector value={cornerKeys[2]} idx={2} options={availableRatios} onChange={handleCornerChange} />
                <RatioSelector value={cornerKeys[3]} idx={3} options={availableRatios} onChange={handleCornerChange} />
            </div>

            {weightsSummary && (
                <div className="text-[9px] text-indigo-300 font-mono text-center truncate">
                    {weightsSummary}
                </div>
            )}
        </div>
    );
};
