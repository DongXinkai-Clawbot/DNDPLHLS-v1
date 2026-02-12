import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ControlProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  defaultValue?: number;
  className?: string;
  unit?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const mapRange = (x: number, inMin: number, inMax: number, outMin: number, outMax: number) => 
  (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;

export const Knob: React.FC<ControlProps & { size?: number, color?: string }> = ({
  label, value, min = 0, max = 1, step = 0.01, onChange, defaultValue = 0, className = '', size = 40, color = '#3b82f6', unit = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef<number>(0);
  const startVal = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); 
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const deltaVal = (deltaY / 100) * range; 
    let nextVal = clamp(startVal.current + deltaVal, min, max);
    
    if (step) {
      nextVal = Math.round(nextVal / step) * step;
    }
    onChange(nextVal);
  }, [min, max, step, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleDoubleClick = () => onChange(defaultValue);

  const pct = (value - min) / (max - min);
  const startAngle = 135;
  const endAngle = 405;
  const currentAngle = startAngle + (endAngle - startAngle) * pct;
  
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(currentAngle));
  const y2 = cy + r * Math.sin(toRad(currentAngle));
  
  const largeArc = currentAngle - startAngle > 180 ? 1 : 0;
  
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;

  return (
    <div className={`flex flex-col items-center select-none group ${className}`}>
      <div 
        className="relative cursor-ns-resize"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="overflow-visible">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${r * Math.PI * 1.5}`} strokeDashoffset="0" transform={`rotate(135 ${cx} ${cy})`} />
          <path d={d} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} bg-black/80 rounded-full text-white pointer-events-none`}>
           {value.toFixed(step < 0.1 ? 2 : (step < 1 ? 1 : 0))}
        </div>
      </div>
      {label && <span className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-tight text-center leading-none">{label}</span>}
    </div>
  );
};

export const Fader: React.FC<ControlProps & { height?: number }> = ({
  label, value, min = 0, max = 1, step = 0.01, onChange, defaultValue = 0, className = '', height = 100
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const updateValue = useCallback((clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();

    const pct = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
    const val = min + pct * (max - min);
    const stepped = Math.round(val / step) * step;
    onChange(stepped);
  }, [min, max, step, onChange]);

  // Use useCallback to create stable function references for event listeners
  // This prevents memory leaks from repeated listener registration/removal
  const handleMouseMove = useCallback((e: MouseEvent) => {
    updateValue(e.clientY);
  }, [updateValue]);

  const handleMouseUp = useCallback(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    updateValue(e.clientY);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp, updateValue]);

  // Ensure proper cleanup of event listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const pct = (value - min) / (max - min) * 100;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div 
        ref={trackRef}
        className="relative w-4 bg-gray-800 rounded-full cursor-pointer border border-gray-700 hover:border-gray-500 transition-colors overflow-hidden"
        style={{ height }}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(defaultValue)}
      >
        <div 
          className="absolute bottom-0 left-0 right-0 bg-blue-600 transition-all duration-75 ease-out"
          style={{ height: `${pct}%` }}
        />
        <div 
          className="absolute left-0 right-0 h-1 bg-white shadow-sm" 
          style={{ bottom: `${pct}%`, marginBottom: '-1px' }} 
        />
      </div>
      {label && <span className="text-[9px] text-gray-500 uppercase font-bold text-center leading-tight">{label}</span>}
    </div>
  );
};

export const SegmentedControl: React.FC<{
  options: string[];
  value: string;
  onChange: (val: string) => void;
  label?: string;
}> = ({ options, value, onChange, label }) => {
  return (
    <div className="flex flex-col gap-1">
       {label && <span className="text-[9px] text-gray-500 uppercase font-bold">{label}</span>}
       <div className="flex bg-gray-900 rounded border border-gray-700 p-0.5">
         {options.map(opt => (
           <button
             key={opt}
             onClick={() => onChange(opt)}
             className={`flex-1 px-2 py-1 text-[9px] uppercase font-bold rounded transition-all ${value === opt ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
           >
             {opt}
           </button>
         ))}
       </div>
    </div>
  );
};

export const ADSRGraph: React.FC<{
  a: number, d: number, s: number, r: number,
  onChange: (key: 'a'|'d'|'s'|'r', val: number) => void
}> = ({ a, d, s, r, onChange }) => {
  const w = 200;
  const h = 80;
  const padding = 10;
  
  const maxTime = 2000; 
  const timeScale = (w - padding*2) / maxTime;
  
  const x0 = padding;
  const y0 = h - padding;
  
  const xA = x0 + Math.min(a, 1000) * timeScale;
  const yA = padding; 
  
  const xD = xA + Math.min(d, 1000) * timeScale;
  const yS = h - padding - (s * (h - padding*2)); 
  
  const xR = xD + 50 * timeScale; 
  const xEnd = xR + Math.min(r, 1000) * timeScale;
  const yEnd = y0;
  
  const handleDrag = (key: 'a'|'d'|'s'|'r', e: React.MouseEvent) => {
    
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startVal = key === 'a' ? a : key === 'd' ? d : key === 's' ? s : r;
    
    const move = (ev: MouseEvent) => {
       const deltaX = ev.clientX - startX;
       const deltaY = startY - ev.clientY; 
       
       if (key === 's') {
          const deltaS = deltaY / (h - padding*2);
          onChange('s', clamp(startVal + deltaS, 0, 1));
       } else {
          
          const deltaMs = deltaX * 10; 
          onChange(key, Math.max(0, startVal + deltaMs));
       }
    };
    
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded relative overflow-hidden" style={{ width: '100%', height: h }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="adsrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.0)" />
          </linearGradient>
        </defs>
        
        <path d={`M ${x0} ${y0} L ${xA} ${yA} L ${xD} ${yS} L ${xR} ${yS} L ${xEnd} ${yEnd} Z`} fill="url(#adsrGrad)" />
        
        <path d={`M ${x0} ${y0} L ${xA} ${yA} L ${xD} ${yS} L ${xR} ${yS} L ${xEnd} ${yEnd}`} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" />
        
        <circle cx={xA} cy={yA} r="4" fill="white" className="cursor-ew-resize hover:fill-blue-200" onMouseDown={(e) => handleDrag('a', e as any)} />
        <circle cx={xD} cy={yS} r="4" fill="white" className="cursor-move hover:fill-blue-200" onMouseDown={(e) => handleDrag('s', e as any)} /> 
        <circle cx={xEnd} cy={yEnd} r="4" fill="white" className="cursor-ew-resize hover:fill-blue-200" onMouseDown={(e) => handleDrag('r', e as any)} />
      </svg>
      
      <div className="absolute bottom-1 left-1 text-[8px] text-gray-500 pointer-events-none">A: {Math.round(a)}ms</div>
      <div className="absolute bottom-1 left-1/4 text-[8px] text-gray-500 pointer-events-none">D: {Math.round(d)}ms</div>
      <div className="absolute top-1 right-1/2 text-[8px] text-gray-500 pointer-events-none">S: {s.toFixed(2)}</div>
      <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 pointer-events-none">R: {Math.round(r)}ms</div>
    </div>
  );
};

export const BarChartEditor: React.FC<{
  values: number[];
  onChange: (idx: number, val: number) => void;
  height?: number;
}> = ({ values, onChange, height = 64 }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const update = (clientX: number, clientY: number) => {
     if (!containerRef.current) return;
     const rect = containerRef.current.getBoundingClientRect();
     const x = clientX - rect.left;
     const y = clientY - rect.top;
     
     const width = rect.width / values.length;
     const idx = Math.floor(x / width);
     if (idx < 0 || idx >= values.length) return;
     
     const val = 1 - clamp(y / rect.height, 0, 1);
     onChange(idx, val);
  };

  const down = (e: React.MouseEvent) => {
    setIsDrawing(true);
    update(e.clientX, e.clientY);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  
  const move = (e: MouseEvent) => {
    update(e.clientX, e.clientY);
  };
  
  const up = () => {
    setIsDrawing(false);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };

  return (
    <div 
      ref={containerRef}
      className="flex items-end gap-[1px] bg-gray-900 border border-gray-700 rounded overflow-hidden cursor-crosshair select-none"
      style={{ height, width: '100%' }}
      onMouseDown={down}
    >
      {values.map((v, i) => (
        <div key={i} className="flex-1 bg-gray-800 hover:bg-gray-700 transition-colors relative h-full group">
           <div 
             className="absolute bottom-0 left-0 right-0 bg-blue-500 group-hover:bg-blue-400" 
             style={{ height: `${v * 100}%` }}
           />
        </div>
      ))}
    </div>
  );
};

export const XYPad: React.FC<{
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  labelX?: string;
  labelY?: string;
  size?: number;
}> = ({ x, y, onChange, labelX, labelY, size = 100 }) => {
    const ref = useRef<HTMLDivElement>(null);
    
    const update = (cx: number, cy: number) => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const nx = clamp((cx - rect.left) / rect.width, 0, 1);
        const ny = 1 - clamp((cy - rect.top) / rect.height, 0, 1); 
        onChange(nx, ny);
    };
    
    const down = (e: React.MouseEvent) => {
        update(e.clientX, e.clientY);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    };
    
    const move = (e: MouseEvent) => update(e.clientX, e.clientY);
    const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
    };
    
    return (
        <div className="relative inline-block border border-gray-700 rounded bg-gray-900 overflow-hidden" style={{ width: size, height: size }}>
            <div className="absolute inset-0 cursor-crosshair" onMouseDown={down} ref={ref}>
                <div className="absolute top-1/2 left-0 right-0 border-t border-gray-800 pointer-events-none" />
                <div className="absolute left-1/2 top-0 bottom-0 border-l border-gray-800 pointer-events-none" />
                
                <div 
                    className="absolute w-3 h-3 bg-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: `${x * 100}%`, top: `${(1-y) * 100}%` }}
                />
            </div>
            {labelX && <div className="absolute bottom-1 right-1 text-[8px] text-gray-500 pointer-events-none">{labelX}</div>}
            {labelY && <div className="absolute top-1 left-1 text-[8px] text-gray-500 pointer-events-none">{labelY}</div>}
        </div>
    );
};
