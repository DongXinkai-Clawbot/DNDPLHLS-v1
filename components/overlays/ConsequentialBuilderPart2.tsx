
import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { ConsequentialScaleResult, ConsequentialScaleConfig, ConsequentialNote } from '../../types';

export const ConsequentialGraph = ({ 
    result, 
    display, 
    showOriginal, 
    onNoteClick 
}: { 
    result: ConsequentialScaleResult, 
    display: ConsequentialScaleConfig['display'], 
    showOriginal?: boolean,
    onNoteClick?: (note: ConsequentialNote) => void
}) => {
    const notes = result.notes;
    const [visibleCount, setVisibleCount] = useState(0);
    const animationRef = useRef<number | null>(null);

    const {
        xAxis,
        yAxis,
        showDerivative,
        derivAbsolute = false,
        derivStep = 1,
        showGraphPath = true,
        showNoteDots = true,
        drawOrder = 'graph_first',
        revealMsPerNote = 20,
        revealMaxDots = 2000,
        xSpacingMode = 'from_xaxis',
        uniformXStep = 1
    } = display;

    const graphData = useMemo(() => {
        if (notes.length === 0) return null;

        const getValue = (n: any, axis: string) => {
            if (axis === 'idx') return n.idx;
            if (axis === 'Hz') return n.freqHz;
            if (axis === 'Ratio') {
                return n.rawScalar !== undefined ? n.rawScalar : n.ratioFloat;
            }
            if (axis === 'Original') {
                return n.originalScalar !== undefined ? n.originalScalar : n.rawScalar;
            }
            if (axis === 'Cents') return n.cents;
            if (n.varsSnapshot && n.varsSnapshot[axis] !== undefined) return n.varsSnapshot[axis];
            if (axis === 'n') return n.n;
            if (axis === 'i') return n.i;
            return 0;
        };

        const getXForLayout = (n: any, i: number) => {
            if (xSpacingMode === 'uniform_step') {
                return i * (uniformXStep || 1);
            }
            return getValue(n, xAxis);
        };

        const getYRaw = (n: any) => getValue(n, yAxis);
        const getOriginalYRaw = (n: any) => getValue(n, 'Original');

        const xVals = notes.map((n, i) => getXForLayout(n, i));
        let yVals = notes.map(getYRaw);
        let origYVals = notes.map(getOriginalYRaw);

        if (showDerivative) {
            const step = Math.max(1, Math.round(derivStep || 1));
            const derivVals = [];
            for (let i = 0; i < notes.length; i++) {
                if (i < step) {
                    derivVals.push(0); 
                } else {
                    const dy = yVals[i] - yVals[i-step];
                    const dx = xVals[i] - xVals[i-step];
                    if (Math.abs(dx) < 1e-9) {
                        derivVals.push(0);
                    } else {
                        const slope = dy / dx;
                        derivVals.push(derivAbsolute ? Math.abs(slope) : slope);
                    }
                }
            }
            yVals = derivVals;
        }

        const validXVals = xVals.filter(v => Number.isFinite(v));
        const validYVals = yVals.filter(v => Number.isFinite(v));
        const validOrigYVals = origYVals.filter(v => Number.isFinite(v));

        const minX = validXVals.length ? Math.min(...validXVals) : 0;
        const maxX = validXVals.length ? Math.max(...validXVals) : 10;
        
        let minY = validYVals.length ? Math.min(...validYVals) : 0;
        let maxY = validYVals.length ? Math.max(...validYVals) : 10;
        
        if (showOriginal) {
            if (validOrigYVals.length) {
                minY = Math.min(minY, ...validOrigYVals);
                maxY = Math.max(maxY, ...validOrigYVals);
            }
        }
        
        if (maxY - minY < 0.001) { minY -= 1; maxY += 1; }
        
        if (maxX - minX < 0.001) {  }

        const W = 1000;
        const H = 200;
        const pad = 20;

        const scaleX = (v: number) => {
            const range = maxX - minX || 1;
            const px = pad + ((v - minX) / range) * (W - 2*pad);
            return Math.max(-5000, Math.min(W + 5000, px)); 
        };
        const scaleY = (v: number) => {
            const range = maxY - minY || 1;
            const py = (H - pad) - ((v - minY) / range) * (H - 2*pad);
            return Math.max(-5000, Math.min(H + 5000, py)); 
        };

        let pathD = "";
        let origPathD = "";
        let penDown = false;
        let origPenDown = false;
        
        let prevY = 0;
        let prevOrigY = 0;

        notes.forEach((n, i) => {
            const valX = xVals[i];
            const valY = yVals[i];
            const origValY = origYVals[i];
            
            if (Number.isFinite(valX) && Number.isFinite(valY)) {
                const x = scaleX(valX);
                const y = scaleY(valY);
                
                if (penDown && Math.abs(y - prevY) > H * 0.8) {
                    penDown = false;
                }

                if (!penDown) {
                    pathD += `M ${x.toFixed(1)} ${y.toFixed(1)} `;
                    penDown = true;
                } else {
                    pathD += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
                }
                prevY = y;
            } else {
                penDown = false;
            }

            if (showOriginal && Number.isFinite(valX) && Number.isFinite(origValY)) {
                const x = scaleX(valX);
                const y = scaleY(origValY);

                if (origPenDown && Math.abs(y - prevOrigY) > H * 0.8) {
                    origPenDown = false;
                }

                if (!origPenDown) {
                    origPathD += `M ${x.toFixed(1)} ${y.toFixed(1)} `;
                    origPenDown = true;
                } else {
                    origPathD += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
                }
                prevOrigY = y;
            } else {
                origPenDown = false;
            }
        });

        return { pathD, origPathD, scaleX, scaleY, xVals, yVals, W, H, pad, minY, maxY };
    }, [notes, xAxis, yAxis, showDerivative, derivAbsolute, derivStep, xSpacingMode, uniformXStep, showOriginal, result.configId]);

    useEffect(() => {
        if (animationRef.current !== null) {
            window.clearInterval(animationRef.current);
            animationRef.current = null;
        }

        const total = Math.min(notes.length, revealMaxDots || 2000);
        const ms = Math.max(0, revealMsPerNote || 0);

        if (drawOrder === 'none' || ms === 0) {
            setVisibleCount(total);
            return;
        }

        setVisibleCount(0);

        const id = window.setInterval(() => {
            setVisibleCount(prev => {
                if (prev >= total) {
                    if (animationRef.current !== null) {
                        window.clearInterval(animationRef.current);
                        animationRef.current = null;
                    }
                    return total;
                }
                return prev + 1;
            });
        }, ms);

        animationRef.current = id;

        return () => {
            if (animationRef.current !== null) {
                window.clearInterval(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [notes, drawOrder, revealMsPerNote, revealMaxDots, result.configId]);

    if (!graphData || notes.length === 0) return null;

    const { pathD, origPathD, scaleX, scaleY, xVals, yVals, W, H, pad, minY, maxY } = graphData;

    const showPathNow = showGraphPath && (
        drawOrder === 'graph_first' || 
        drawOrder === 'none' || 
        (drawOrder === 'notes_first' && visibleCount >= Math.min(notes.length, revealMaxDots || 2000))
    );

    const notesToRender = notes.slice(0, visibleCount);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
            <line x1={0} y1={H-pad} x2={W} y2={H-pad} stroke="#333" strokeWidth="1" />
            <line x1={pad} y1={0} x2={pad} y2={H} stroke="#333" strokeWidth="1" />
            
            {minY < 0 && maxY > 0 && (
                <line x1={pad} y1={scaleY(0)} x2={W-pad} y2={scaleY(0)} stroke="#444" strokeWidth="1" strokeDasharray="4" />
            )}

            {showPathNow && showOriginal && origPathD && (
                <path d={origPathD} fill="none" stroke="#22d3ee" strokeWidth="1" opacity="0.3" strokeDasharray="2" />
            )}

            {showPathNow && pathD && (
                <path d={pathD} fill="none" stroke={showDerivative ? "#fbbf24" : "#60a5fa"} strokeWidth="1.5" opacity="0.8" />
            )}
            
            {showNoteDots && notesToRender.map((n, i) => {
                const valX = xVals[i];
                const valY = yVals[i];
                if (!Number.isFinite(valX) || !Number.isFinite(valY)) return null;

                const x = scaleX(valX);
                const y = scaleY(valY);
                
                return (
                    <circle 
                        key={i} 
                        cx={x} 
                        cy={y} 
                        r={n.playable ? 3 : 1.5} 
                        fill={n.playable ? (showDerivative ? "#fbbf24" : "#60a5fa") : "#4b5563"} 
                        className={n.playable ? "cursor-pointer hover:r-5 transition-all" : ""}
                        onClick={(e) => {
                            e.stopPropagation();
                            if(n.playable && onNoteClick) onNoteClick(n);
                        }}
                    />
                );
            })}
        </svg>
    );
};
