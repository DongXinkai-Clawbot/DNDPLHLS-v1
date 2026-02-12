import React, { memo, useState, useRef, useEffect } from 'react';
import { useStore } from '../../store';
import { useDeviceType } from '../../hooks/useDeviceType';

/**
 * A floating panel to display statistics of ratio occurrences during Dynamic Tuning.
 */
export const RatioStatisticsPanel: React.FC = memo(() => {
    const { isMobile } = useDeviceType();
    const ratioStats = useStore(state => state.ratioStats);
    const chordStats = useStore(state => state.chordStats);
    const showRatioStats = useStore(state => state.showRatioStats);
    const setShowRatioStats = useStore(state => state.setShowRatioStats);
    const resetRatioStats = useStore(state => state.resetRatioStats);

    const [size, setSize] = useState({ width: 384, height: 320 });
    const isResizingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const startSizeRef = useRef({ w: 0, h: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        isResizingRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        startSizeRef.current = { w: size.width, h: size.height };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isResizingRef.current) return;
        e.preventDefault();
        e.stopPropagation();

        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y; // Positive dy means dragging down (increasing height)

        // Inverse logic for width because the panel is anchored to the RIGHT
        // Dragging right (positive dx) should SHRINK the panel (pulling right edge towards left edge? No, pulling right edge away?)
        // Wait, the panel is absolute positioned 'right-4'.
        // If we resize by dragging the LEFT edge, it would expand left.
        // But the standard UX is dragging bottom-right or bottom-left. 
        // If it's on the right side of the screen, dragging the LEFT edge to resize makes sense if it's anchored right.
        // HOWEVER, standard windows usually drag bottom-right.
        // Let's assume the user wants to drag the BOTTOM-LEFT or BOTTOM-RIGHT?
        // If anchored right, increasing width expands it to the LEFT.

        // Let's implement a resize handle on the BOTTOM-LEFT since it's on the right side?
        // Or just let's assume standard bottom-right resize but that would move the right edge.
        // Since it's css `right: 4`, increasing width pushes the left edge further left.
        // So dragging the LEFT edge to the left increases width.
        // Dragging the RIGHT edge... well the right edge is fixed by `right: 4` unless we change that.

        // Let's define the resize handle on the BOTTOM-LEFT corner for standard logic if it's pinned to the right. 
        // dragging LEFT (negative dx) -> INCREASE width.
        // dragging RIGHT (positive dx) -> DECREASE width.

        const newWidth = Math.max(250, startSizeRef.current.w - dx);
        const newHeight = Math.max(200, startSizeRef.current.h + dy);

        setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isResizingRef.current) return;
        e.preventDefault();
        isResizingRef.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // Sort stats by count (descending)
    const sortedStats = React.useMemo(() => {
        return Array.from(ratioStats.entries()).sort((a, b) => b[1] - a[1]);
    }, [ratioStats]);
    const sortedChordStats = React.useMemo(() => {
        return Array.from(chordStats.entries()).sort((a, b) => b[1] - a[1]);
    }, [chordStats]);

    const totalRatioEvents = React.useMemo(() => {
        let sum = 0;
        ratioStats.forEach(v => { sum += v; });
        return sum;
    }, [ratioStats]);

    const totalChordEvents = React.useMemo(() => {
        let sum = 0;
        chordStats.forEach(v => { sum += v; });
        return sum;
    }, [chordStats]);

    if (!showRatioStats) {
        return null;
    }

    const panelStyle: React.CSSProperties = isMobile
        ? {
            top: 'max(12px, calc(env(safe-area-inset-top) + 12px))',
            right: 'max(12px, env(safe-area-inset-right))',
            width: 'calc(100vw - 24px)',
            height: '400px'
        }
        : {
            width: size.width,
            height: size.height
        };

    return (
        <div className="absolute top-20 right-4 pointer-events-auto z-20 flex flex-col" style={panelStyle}>
            <div className="bg-black/90 backdrop-blur-md border border-gray-700/50 rounded-lg shadow-2xl flex flex-col h-full relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-700/50 p-2 shrink-0 bg-gray-900/50 rounded-t-lg select-none">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-200 font-bold uppercase tracking-wider">Performance Stats</span>
                        <div className="flex gap-2 text-[9px] text-gray-500 font-bold uppercase border-l border-gray-700 pl-3">
                            <span>Ratios: {totalRatioEvents}</span>
                            <span>Chords: {totalChordEvents}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowRatioStats(false)}
                            className="p-1 hover:bg-red-900/50 text-gray-500 hover:text-red-300 rounded transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Content columns */}
                <div className="flex-1 min-h-0 flex divide-x divide-gray-800">
                    {/* Left Column: Intervals */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                        <div className="px-2 py-1.5 bg-indigo-900/10 border-b border-indigo-900/20 shrink-0">
                            <span className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">Intervals ({ratioStats.size})</span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent p-1">
                            {sortedStats.length === 0 ? (
                                <div className="text-[10px] text-gray-600 text-center py-4 italic">No data</div>
                            ) : (
                                <div className="flex flex-col gap-0.5">
                                    {sortedStats.map(([ratio, count]) => (
                                        <div key={ratio} className="flex items-start gap-2 text-xs font-mono px-2 py-1 hover:bg-white/5 rounded group">
                                            <span className="text-indigo-200 break-all min-w-0 flex-1 leading-tight" title={ratio}>{ratio}</span>
                                            <span className="text-gray-500 group-hover:text-gray-300 shrink-0 tabular-nums text-[10px] font-bold">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Chords */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                        <div className="px-2 py-1.5 bg-emerald-900/10 border-b border-emerald-900/20 shrink-0">
                            <span className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Chords ({chordStats.size})</span>
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent p-1">
                            {sortedChordStats.length === 0 ? (
                                <div className="text-[10px] text-gray-600 text-center py-4 italic">No data</div>
                            ) : (
                                <div className="flex flex-col gap-0.5">
                                    {sortedChordStats.map(([chord, count]) => (
                                        <div key={chord} className="flex items-start gap-2 text-[10px] font-mono px-2 py-1 hover:bg-white/5 rounded group">
                                            <span className="text-emerald-200 break-all min-w-0 flex-1 leading-tight" title={chord}>{chord}</span>
                                            <span className="text-gray-500 group-hover:text-gray-300 shrink-0 tabular-nums text-[10px] font-bold">{count}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-1 border-t border-gray-700/50 bg-gray-900/30 rounded-b-lg">
                    <button
                        onClick={resetRatioStats}
                        className="w-full py-1.5 text-[10px] text-gray-500 hover:text-red-300 hover:bg-red-900/20 rounded transition-all uppercase font-black tracking-widest"
                    >
                        Reset Statistics
                    </button>
                </div>

                {/* Resize Handle (Bottom-Left since anchored Right) */}
                {!isMobile && (
                    <div
                        className="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-50 flex items-end justify-start p-1"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        {/* Visual indicator for resize handle */}
                        <div className="w-2 h-2 border-l-2 border-b-2 border-gray-500/50 rounded-bl-sm" />
                    </div>
                )}
            </div>
        </div>
    );
});

RatioStatisticsPanel.displayName = 'RatioStatisticsPanel';
