
import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import type { PanelId, PanelMode } from '../../types';

interface Props {
    id: PanelId;
    children?: React.ReactNode;
    minWidth?: number;
    minHeight?: number;
    headerContent?: React.ReactNode;
    collapsedHeight?: number;
}

export const PanelWindow = ({ id, children, minWidth = 300, minHeight = 200, headerContent, collapsedHeight = 48 }: Props) => {
    const { panels, setPanelState, focusPanel } = useStore((s) => ({ panels: s.panels, setPanelState: s.setPanelState, focusPanel: s.focusPanel }), shallow);
    const state = panels[id];
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialGeom, setInitialGeom] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const pointerCaptureRef = useRef<{ el: HTMLElement | null; pointerId: number | null }>({
        el: null,
        pointerId: null
    });

    const capturePointer = (el: HTMLElement, pointerId: number) => {
        try {
            el.setPointerCapture(pointerId);
            pointerCaptureRef.current = { el, pointerId };
        } catch (e) {
            pointerCaptureRef.current = { el: null, pointerId: null };
        }
    };

    const releasePointerIfCaptured = () => {
        const { el, pointerId } = pointerCaptureRef.current;
        if (el && pointerId !== null) {
            try {
                if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
            } catch (e) {}
        }
        pointerCaptureRef.current = { el: null, pointerId: null };
    };

    useEffect(() => {
        return () => {
            releasePointerIfCaptured();
        };
    }, []);

    if (!state || !state.isOpen) return null;

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input, select, [role="slider"]')) return;
        
        focusPanel(id);
        
        if (state.mode === 'float' || state.isCollapsed) {
            e.preventDefault();
            capturePointer(e.currentTarget as HTMLElement, e.pointerId);
            
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialGeom({ x: state.x, y: state.y, w: state.width, h: state.height });
            setIsDragging(true);
        }
    };

    const handleResizeDown = (e: React.PointerEvent) => {
        focusPanel(id);
        if (state.mode !== 'float') return;
        e.preventDefault();
        e.stopPropagation();
        capturePointer(e.currentTarget as HTMLElement, e.pointerId);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialGeom({ x: state.x, y: state.y, w: state.width, h: state.height });
        setIsResizing(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging && !isResizing) return;
        e.preventDefault();

        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        if (isDragging) {
            setPanelState(id, { 
                x: initialGeom.x + dx, 
                y: initialGeom.y + dy 
            });
        } else if (isResizing) {
            setPanelState(id, {
                width: Math.max(minWidth, initialGeom.w + dx),
                height: Math.max(minHeight, initialGeom.h + dy)
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDragging && !isResizing) return;
        e.preventDefault();
        setIsDragging(false);
        setIsResizing(false);
        releasePointerIfCaptured();

        if (isDragging) {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            if (state.x < 10) setPanelState(id, { mode: 'dock-left' });
            else if (state.x > winW - state.width - 10) setPanelState(id, { mode: 'dock-right' });
            else if (state.y > winH - state.height - 10) setPanelState(id, { mode: 'dock-bottom' });
        }
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
        if (!isDragging && !isResizing) return;
        e.preventDefault();
        setIsDragging(false);
        setIsResizing(false);
        releasePointerIfCaptured();
    };

    const toggleMode = () => {
        if (state.mode === 'float') {
            setPanelState(id, { mode: 'fullscreen' });
        } else {
            setPanelState(id, { mode: 'float' });
        }
    };

    const toggleCollapse = () => {
        setPanelState(id, { isCollapsed: !state.isCollapsed });
    };

    const close = () => {
        setPanelState(id, { isOpen: false });
    };

    const getStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = { 
            zIndex: state.zIndex,
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'none' 
        };

        if (state.isCollapsed) {
            
            if (id === 'settings') {
                 return {
                    ...base,
                    position: 'fixed',
                    width: 'auto',
                    height: 'auto',
                    minWidth: '200px',
                    left: state.x,
                    top: state.y
                 };
            }

            if (state.mode === 'dock-bottom') {
                return {
                    ...base,
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `calc(${collapsedHeight}px + env(safe-area-inset-bottom))`,
                    width: '100%',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingLeft: 'env(safe-area-inset-left)',
                    paddingRight: 'env(safe-area-inset-right)'
                };
            }
            return {
                ...base,
                position: 'fixed',
                width: 'auto',
                height: 'auto',
                minWidth: '120px',
                left: state.x,
                top: state.y
            };
        }

        switch (state.mode) {
            case 'fullscreen':
                return { 
                    ...base, 
                    position: 'fixed', 
                    inset: 0, 
                    width: '100%', 
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingLeft: 'env(safe-area-inset-left)',
                    paddingRight: 'env(safe-area-inset-right)'
                };
            case 'dock-left':
                return { 
                    ...base, 
                    position: 'fixed', 
                    top: 0, 
                    bottom: 0, 
                    left: 0, 
                    width: state.width, 
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingLeft: 'env(safe-area-inset-left)'
                };
            case 'dock-right':
                return { 
                    ...base, 
                    position: 'fixed', 
                    top: 0, 
                    bottom: 0, 
                    right: 0, 
                    width: state.width, 
                    height: '100%',
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingRight: 'env(safe-area-inset-right)'
                };
            case 'dock-bottom':
                return { 
                    ...base, 
                    position: 'fixed', 
                    bottom: 0, 
                    left: 0, 
                    right: 0, 
                    height: typeof state.height === 'number' ? `calc(${state.height}px + env(safe-area-inset-bottom))` : state.height, 
                    width: '100%',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    paddingLeft: 'env(safe-area-inset-left)',
                    paddingRight: 'env(safe-area-inset-right)'
                };
            case 'float':
            default:
                return { ...base, position: 'fixed', left: state.x, top: state.y, width: state.width, height: state.height };
        }
    };

    return (
        <div 
            ref={containerRef}
            style={getStyle()}
            className={`pointer-events-auto bg-gray-950/95 backdrop-blur-md border border-gray-700 shadow-2xl rounded-lg overflow-hidden transition-all duration-100 ease-out ${state.mode !== 'float' ? (state.mode === 'dock-bottom' ? 'rounded-t-2xl rounded-b-none border-0 border-t border-gray-800' : 'rounded-none border-0 border-r border-l border-t border-gray-800') : ''}`}
            onPointerDown={() => focusPanel(id)}
        >
            <div 
                style={{ touchAction: 'none' }}
                className="flex items-center justify-between bg-gray-900/90 border-b border-gray-700 px-2 py-1.5 cursor-grab active:cursor-grabbing select-none h-9 shrink-0"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
            >
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${state.mode === 'float' ? 'bg-gray-500' : 'bg-blue-500'}`} />
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest truncate">{state.title}</span>
                    {headerContent}
                </div>
                
                <div className="flex items-center gap-1">
                    <button onClick={toggleCollapse} className="p-1 hover:bg-gray-700 rounded text-gray-400">
                        {state.isCollapsed ? '□' : '_'}
                    </button>
                    <button onClick={toggleMode} className="p-1 hover:bg-gray-700 rounded text-gray-400">
                        {state.mode === 'fullscreen' ? '❐' : '☐'}
                    </button>
                    <button onClick={close} className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded text-gray-400">
                        ✕
                    </button>
                </div>
            </div>

            {!state.isCollapsed && (
                <div className="flex-1 overflow-hidden relative" style={{ touchAction: 'auto' }}>
                    {children}
                </div>
            )}

            {!state.isCollapsed && state.mode === 'float' && (
                <div 
                    style={{ touchAction: 'none' }}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center opacity-50 hover:opacity-100"
                    onPointerDown={handleResizeDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                >
                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-br-sm" />
                </div>
            )}
        </div>
    );
};
