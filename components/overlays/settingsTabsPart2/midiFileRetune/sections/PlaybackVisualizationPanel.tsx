import React from 'react';

type PlaybackVisualizationPanelProps = {
  playbackVisualizationMode: 'SCROLLER' | 'HUNT205_RING';
  ringSettings: {
    scale: number;
    showAllLabels: boolean;
    showPreferredNames: boolean;
    rotationDeg: number;
    showUpcoming: boolean;
    showDebug: boolean;
  };
  onModeChange: (mode: 'SCROLLER' | 'HUNT205_RING') => void;
  onRingChange: (partial: { scale?: number; showAllLabels?: boolean; showPreferredNames?: boolean; rotationDeg?: number; showUpcoming?: boolean; showDebug?: boolean }) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PlaybackVisualizationPanel = ({
  playbackVisualizationMode,
  ringSettings,
  onModeChange,
  onRingChange
}: PlaybackVisualizationPanelProps) => {
  const scale = clamp(Number.isFinite(ringSettings.scale) ? ringSettings.scale : 1, 0.8, 1.2);
  const preferredMode = !!ringSettings.showPreferredNames;
  const rotationDeg = Number.isFinite(ringSettings.rotationDeg) ? ringSettings.rotationDeg : 0;

  return (
    <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[9px] text-gray-500 uppercase font-bold">Playback Visualization</label>
        <div className="flex gap-1">
          <button
            onClick={() => onModeChange('SCROLLER')}
            className={`px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-widest ${
              playbackVisualizationMode === 'SCROLLER'
                ? 'bg-emerald-700/50 border-emerald-400 text-emerald-100'
                : 'bg-black/30 border-gray-700 text-gray-400'
            }`}
          >
            Scroller
          </button>
          <button
            onClick={() => onModeChange('HUNT205_RING')}
            className={`px-2 py-1 rounded border text-[9px] font-bold uppercase tracking-widest ${
              playbackVisualizationMode === 'HUNT205_RING'
                ? 'bg-emerald-700/50 border-emerald-400 text-emerald-100'
                : 'bg-black/30 border-gray-700 text-gray-400'
            }`}
          >
            Hunt205 Ring
          </button>
        </div>
      </div>
      <div className="text-[8px] text-gray-600">Switches the primary playback follow view in Pure UI mode.</div>

      {playbackVisualizationMode === 'HUNT205_RING' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Ring Rotation</span>
            <span className="text-[9px] text-emerald-200 font-mono">{rotationDeg.toFixed(1)}°</span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={0.5}
            value={rotationDeg}
            onChange={(e) => onRingChange({ rotationDeg: parseFloat(e.target.value) })}
            className="w-full h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
          />
          <div className="text-[8px] text-gray-600">
            Rotate the entire Hunt205 ring to align with your reference image.
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500 uppercase font-bold">Ring Scale</span>
            <span className="text-[9px] text-emerald-200 font-mono">{scale.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.2}
            step={0.02}
            value={scale}
            onChange={(e) => onRingChange({ scale: parseFloat(e.target.value) })}
            className="w-full h-1.5 accent-emerald-500 appearance-none bg-gray-700 rounded cursor-pointer"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-1 text-[9px] ${preferredMode ? 'text-gray-700 opacity-60' : 'text-gray-500'}`}>
              <input
                type="checkbox"
                checked={ringSettings.showAllLabels}
                onChange={(e) => onRingChange({ showAllLabels: e.target.checked, showPreferredNames: e.target.checked ? false : ringSettings.showPreferredNames })}
                disabled={preferredMode}
                className="accent-emerald-500"
              />
              Show all labels
            </label>
            <label className="flex items-center gap-1 text-[9px] text-gray-500">
              <input
                type="checkbox"
                checked={ringSettings.showUpcoming}
                onChange={(e) => onRingChange({ showUpcoming: e.target.checked })}
                className="accent-emerald-500"
              />
              Show upcoming
            </label>
            <label className="flex items-center gap-1 text-[9px] text-gray-500">
              <input
                type="checkbox"
                checked={ringSettings.showDebug}
                onChange={(e) => onRingChange({ showDebug: e.target.checked })}
                className="accent-emerald-500"
              />
              Debug overlay
            </label>
            <label className="flex items-center gap-1 text-[9px] text-gray-500">
              <input
                type="checkbox"
                checked={preferredMode}
                onChange={(e) => onRingChange({ showPreferredNames: e.target.checked, showAllLabels: e.target.checked ? false : true })}
                className="accent-emerald-500"
              />
              Simplify to preferred names
            </label>
          </div>
          <div className="text-[8px] text-gray-600">
            Preferred names collapse the ring to a single label per tone (Hunt System 52 list) and disables full enharmonic labels.
          </div>
        </div>
      )}
    </div>
  );
};
