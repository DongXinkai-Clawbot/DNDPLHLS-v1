import React from 'react';

type TrackStyle = { color?: string; material?: string; textureUrl?: string };

type TrackVisualsPanelProps = {
    groupCount: number;
    groupLabel: string;
    groupLabels: string[];
    resolvedTrackStyles: TrackStyle[];
    trackMaterials: readonly string[];
    trackColorPresets: string[];
    trackEffects: readonly string[];
    retuneTrackEffect: string;
    retuneTrackVisualsEnabled: boolean;
    disableLatticeVisuals: boolean;
    onToggleTrackVisuals: () => void;
    onToggleHideLattice: (value: boolean) => void;
    onUpdateTrackStyle: (index: number, partial: TrackStyle) => void;
    onUpdateTrackEffect: (effect: string) => void;
};

export const TrackVisualsPanel = ({
    groupCount,
    groupLabel,
    groupLabels,
    resolvedTrackStyles,
    trackMaterials,
    trackColorPresets,
    trackEffects,
    retuneTrackEffect,
    retuneTrackVisualsEnabled,
    disableLatticeVisuals,
    onToggleTrackVisuals,
    onToggleHideLattice,
    onUpdateTrackStyle,
    onUpdateTrackEffect
}: TrackVisualsPanelProps) => {
    const resolvedLabel = groupLabel || 'Track';
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-[9px] text-gray-500 uppercase font-bold">{resolvedLabel} Visuals</label>
                <div className="flex gap-3">
                    <label className="flex items-center gap-1 text-[9px] text-gray-500" title="Disable lattice nodes for performance and auto-switch to Hunt205 ring">
                        <input
                            type="checkbox"
                            checked={!!disableLatticeVisuals}
                            onChange={(e) => onToggleHideLattice(e.target.checked)}
                            className="accent-rose-500"
                        />
                        Hide Lattice (auto ring)
                    </label>
                    <label className="flex items-center gap-1 text-[9px] text-gray-500">
                        <input
                            type="checkbox"
                            checked={!!retuneTrackVisualsEnabled}
                            onChange={onToggleTrackVisuals}
                            className="accent-emerald-500"
                        />
                        Enable {resolvedLabel}s
                    </label>
                </div>
            </div>
            {retuneTrackVisualsEnabled && (
                <>
                    <div className="text-[8px] text-gray-600">Applies in Pure Mode retune preview.</div>
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] text-gray-500 uppercase font-bold">Preview Effect</label>
                        <select
                            value={retuneTrackEffect || 'glow'}
                            onChange={(e) => onUpdateTrackEffect(e.target.value)}
                            className="bg-black border border-gray-700 text-[10px] text-white rounded px-2 py-1"
                        >
                            {trackEffects.map((effect) => (
                                <option key={effect} value={effect}>
                                    {effect.charAt(0).toUpperCase() + effect.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                    {groupCount > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {resolvedTrackStyles.slice(0, groupCount).map((style, index) => (
                                <div key={`track-${index}`} className="bg-gray-900/60 border border-gray-700 rounded p-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-gray-400 uppercase font-bold">{groupLabels[index] || `${resolvedLabel} ${index + 1}`}</span>
                                        <input
                                            type="color"
                                            value={style.color || trackColorPresets[index % trackColorPresets.length]}
                                            onChange={(e) => onUpdateTrackStyle(index, { color: e.target.value })}
                                            className="w-8 h-5 bg-black border border-gray-700 rounded"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={style.material || 'standard'}
                                            onChange={(e) => onUpdateTrackStyle(index, { material: e.target.value })}
                                            className="flex-1 bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                        >
                                            {trackMaterials.map((mat) => (
                                                <option key={mat} value={mat}>{mat}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => onUpdateTrackStyle(index, { textureUrl: '' })}
                                            className="text-[8px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Texture URL (optional)"
                                        value={style.textureUrl || ''}
                                        onChange={(e) => onUpdateTrackStyle(index, { textureUrl: e.target.value })}
                                        className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[8px] text-gray-600 italic">Upload a MIDI file to configure {resolvedLabel.toLowerCase()} visuals.</div>
                    )}
                </>
            )}
        </div>
    );
};
