import React from 'react';

type ActiveToneInfo = {
  toneId: number;
  count: number;
  velocity: number;
  approxCount: number;
};

type HoverToneInfo = {
  toneId: number;
  primaryLabel: string;
  centValue: number;
  activeCount: number;
};

type HoverLabelInfo = {
  labelId: number;
  text: string;
  toneId: number;
  radialLayer: number;
  angleDeg: number;
  radius: number;
};

type EventLogEntry = {
  eventId: string;
  toneId: number;
  method: string;
  distanceCents: number;
  approx: boolean;
};

export const Hunt205DebugOverlay = ({
  activeTones,
  hoverTone,
  hoverLabel,
  recentEvents
}: {
  activeTones: ActiveToneInfo[];
  hoverTone?: HoverToneInfo | null;
  hoverLabel?: HoverLabelInfo | null;
  recentEvents: EventLogEntry[];
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-4 right-4 w-72 space-y-2">
        <div className="bg-black/70 border border-white/10 rounded-lg p-2 text-[10px] text-white/80">
          <div className="text-[10px] uppercase font-black tracking-widest text-white/70">Active Tones</div>
          {activeTones.length === 0 ? (
            <div className="text-[9px] text-white/40 mt-1">None</div>
          ) : (
            <div className="mt-1 max-h-32 overflow-y-auto">
              {activeTones.map((tone) => (
                <div key={tone.toneId} className="flex justify-between text-[9px] font-mono">
                  <span>#{tone.toneId}</span>
                  <span>v={tone.velocity.toFixed(2)}</span>
                  <span>n={tone.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-black/70 border border-white/10 rounded-lg p-2 text-[10px] text-white/80">
          <div className="text-[10px] uppercase font-black tracking-widest text-white/70">Recent Mappings</div>
          {recentEvents.length === 0 ? (
            <div className="text-[9px] text-white/40 mt-1">No events</div>
          ) : (
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {recentEvents.map((evt) => (
                <div key={evt.eventId} className="text-[9px] font-mono">
                  <div>
                    <span className="text-white/70">{evt.eventId}</span> {'->'} <span>#{evt.toneId}</span>
                    {evt.approx && <span className="text-amber-300"> ~</span>}
                  </div>
                  <div className="text-white/50">
                    method {evt.method} ¡¤ {evt.distanceCents.toFixed(2)}c
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {(hoverTone || hoverLabel) && (
        <div className="absolute left-4 top-4 bg-black/70 border border-white/10 rounded-lg p-2 text-[10px] text-white/80">
          {hoverTone && (
            <div className="mb-1">
              <div className="text-[10px] uppercase font-black tracking-widest text-white/70">Tone</div>
              <div className="font-mono">#{hoverTone.toneId} / {hoverTone.primaryLabel}</div>
              <div className="font-mono text-white/50">{hoverTone.centValue.toFixed(2)}c ¡¤ active {hoverTone.activeCount}</div>
            </div>
          )}
          {hoverLabel && (
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest text-white/70">Label</div>
              <div className="font-mono">#{hoverLabel.labelId} / {hoverLabel.text}</div>
              <div className="font-mono text-white/50">tone {hoverLabel.toneId} ¡¤ layer {hoverLabel.radialLayer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
