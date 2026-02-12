import React, { useRef, useState, useEffect } from 'react';

interface Point { x: number; y: number; }

interface BranchDrawingCanvasProps {
    onSave: (points: Point[]) => void;
    onCancel: () => void;
    initialPoints?: Point[];
    limit: number;
}

export const BranchDrawingCanvas: React.FC<BranchDrawingCanvasProps> = ({ onSave, onCancel, initialPoints, limit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [points, setPoints] = useState<Point[]>(initialPoints || []);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize canvas to fit container
        canvas.width = canvas.parentElement?.clientWidth || 600;
        canvas.height = canvas.parentElement?.clientHeight || 400;

        draw(ctx);
    }, [points]);

    const draw = (ctx: CanvasRenderingContext2D) => {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Draw grid/axis
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Central Axis (Y=mid) represents the straight line
        const midY = h / 2;
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();

        ctx.strokeStyle = '#444';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let x = 0; x < w; x += 50) {
            ctx.moveTo(x, 0); ctx.lineTo(x, h);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw points
        if (points.length > 0) {
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            // Map normalized points back to canvas
            const first = points[0];
            ctx.moveTo(first.x * w, midY - (first.y * (h / 2))); // Invert Y so up is positive deviation

            for (let i = 1; i < points.length; i++) {
                const p = points[i];
                ctx.lineTo(p.x * w, midY - (p.y * (h / 2)));
            }
            ctx.stroke();
        }
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDrawing(true);
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const midY = rect.height / 2;
        const y = (midY - (e.clientY - rect.top)) / (rect.height / 2); // Normalize -1 to 1
        setPoints([{ x, y }]);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const midY = rect.height / 2;
        const y = (midY - (e.clientY - rect.top)) / (rect.height / 2);

        // Ensure points flow left to right strictly? 
        // For a branch shape, X represents distance along the branch.
        // So we strictly append if new x > last x? 
        // For freehand drawing, we just record inputs, but later we might need to sort or filter.
        // Let's just record raw for now, maybe filter duplicates.
        setPoints(prev => [...prev, { x, y }]);
    };

    const handlePointerUp = () => {
        setIsDrawing(false);
    };

    const handleSave = () => {
        // Simplify points?
        // Sort by X?
        const sorted = [...points].sort((a, b) => a.x - b.x);
        onSave(sorted);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-[90vw] max-w-4xl shadow-2xl flex flex-col gap-4">
                <div className="flex justify-between items-center text-white">
                    <h3 className="text-xl font-bold">Draw Branch Shape (Limit {limit})</h3>
                    <div className="text-xs text-gray-400">Draw deviation from center line. Left is start (node), Right is tip.</div>
                </div>

                <div className="flex-1 bg-black/50 border border-gray-800 rounded-lg overflow-hidden relative min-h-[400px] touch-none">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full cursor-crosshair"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition">Cancel</button>
                    <button onClick={() => setPoints([])} className="px-4 py-2 text-red-400 hover:text-white hover:bg-red-500 rounded transition">Clear</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg transition transform active:scale-95">Apply Shape</button>
                </div>
            </div>
        </div>
    );
};
