import React, { useRef, useState, useEffect } from 'react';
import { TimbreMsegPoint } from '../../typesPart1';

interface TimbreMsegEditorProps {
    points: TimbreMsegPoint[];
    onChange: (points: TimbreMsegPoint[]) => void;
    height?: number;
    color?: string;
}

export const TimbreMsegEditor = ({ points, onChange, height = 120, color = '#10b981' }: TimbreMsegEditorProps) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);

    const MAX_TIME = 2000; 
    
    const totalTime = points.reduce((acc, p) => acc + (p.timeMs || 0), 0);
    const VIEW_WIDTH_MS = Math.max(totalTime + 500, 2000);

    const mapX = (ms: number) => (ms / VIEW_WIDTH_MS) * 100; 
    const mapY = (val: number) => (1 - val) * 100; 

    const handlePointerDown = (e: React.PointerEvent, idx: number) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragIdx(idx);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragIdx(null);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragIdx === null || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width; 
        const y = 1 - (e.clientY - rect.top) / rect.height; 

        const nextPoints = [...points];
        const pt = { ...nextPoints[dragIdx] };

        pt.value = Math.max(0, Math.min(1, y));

        let prevTime = 0;
        for (let i = 0; i < dragIdx; i++) prevTime += points[i].timeMs;

        const newAbsTime = x * VIEW_WIDTH_MS;
        const newDelta = Math.max(0, newAbsTime - prevTime); 

        pt.timeMs = dragIdx === 0 ? 0 : newDelta; 
        if (dragIdx === 0) pt.timeMs = 0;

        nextPoints[dragIdx] = pt;
        onChange(nextPoints);
    };

    const handleSvgClick = (e: React.MouseEvent) => {
        
        if (e.detail === 2) {
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1 - (e.clientY - rect.top) / rect.height;

            const clickTime = x * VIEW_WIDTH_MS;
            
            let accum = 0;
            let insertIdx = points.length;
            for (let i = 0; i < points.length; i++) {
                accum += points[i].timeMs;
                if (accum > clickTime) {
                    insertIdx = i;
                    break;
                }
            }

            let prevTime = 0;
            for (let i = 0; i < insertIdx; i++) prevTime += points[i].timeMs;

            const newDelta = Math.max(0, clickTime - prevTime);
            const newPoint = { timeMs: newDelta, value: Math.max(0, Math.min(1, y)) };

            const nextPoints = [...points];
            nextPoints.splice(insertIdx, 0, newPoint);

            if (insertIdx < points.length) {
                const nextAbs = accum; 
                const nextDelta = Math.max(0, nextAbs - clickTime);
                nextPoints[insertIdx + 1] = { ...nextPoints[insertIdx + 1], timeMs: nextDelta };
            }

            onChange(nextPoints);
        }
    };

    const removePoint = (e: React.MouseEvent, idx: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (points.length <= 2) return; 
        const nextPoints = [...points];
        
        if (idx < points.length - 1 && idx > 0) {
            nextPoints[idx + 1] = { ...nextPoints[idx + 1], timeMs: nextPoints[idx + 1].timeMs + points[idx].timeMs };
        }
        nextPoints.splice(idx, 1);
        onChange(nextPoints);
    };

    let d = '';
    let accumTime = 0;
    points.forEach((p, i) => {
        accumTime += p.timeMs;
        const xKey = mapX(accumTime);
        const yKey = mapY(p.value);
        if (i === 0) d += `M ${xKey} ${yKey}`;
        else d += ` L ${xKey} ${yKey}`;
    });

    return (
        <div className="w-full bg-black/40 border border-gray-800 rounded select-none relative overflow-hidden" style={{ height }}>
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="overflow-visible"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onClick={handleSvgClick}
            >
                <line x1="0" y1="25" x2="100" y2="25" stroke="#333" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#333" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="#333" strokeWidth="0.5" />

                <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
          
                <path d={`${d} V 100 H 0 Z`} fill={color} fillOpacity="0.1" stroke="none" />

                {points.map((p, i) => {
                    let t = 0;
                    for (let k = 0; k <= i; k++) t += points[k].timeMs;
                    const cx = mapX(t);
                    const cy = mapY(p.value);
                    return (
                        <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={dragIdx === i ? 2.5 : 1.5}
                            fill={dragIdx === i ? '#fff' : color}
                            stroke="#000"
                            strokeWidth="0.5"
                            className="cursor-pointer hover:fill-white"
                            onPointerDown={(e) => handlePointerDown(e, i)}
                            onContextMenu={(e) => removePoint(e, i)}
                        />
                    );
                })}
            </svg>

            <div className="absolute top-1 right-1 text-[8px] text-gray-500 pointer-events-none">
                Double-click to add • Right-click to remove
            </div>
        </div>
    );
};
