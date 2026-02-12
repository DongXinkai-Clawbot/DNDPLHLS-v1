import React, { useRef } from 'react';
import type { OctaPadProps } from './types';
import { clamp, fmtPct } from './utils';

export const OctaPad: React.FC<OctaPadProps> = ({ x, y, onChange }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  const updateFromEvent = (evt: React.PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = clamp((evt.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp(1 - (evt.clientY - rect.top) / rect.height, 0, 1);
    onChange(nx, ny);
  };

  return (
    <div className="select-none">
      <div
        ref={ref}
        className="relative w-full h-28 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-lg cursor-crosshair"
        onPointerDown={evt => {
          evt.currentTarget.setPointerCapture(evt.pointerId);
          updateFromEvent(evt);
        }}
        onPointerMove={evt => {
          if (evt.buttons === 1) updateFromEvent(evt);
        }}
      >
        <div
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-indigo-400/80 shadow"
          style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-500 font-mono mt-1">
        <span>X: {fmtPct(x, 0)}</span>
        <span>Y: {fmtPct(y, 0)}</span>
      </div>
    </div>
  );
};
