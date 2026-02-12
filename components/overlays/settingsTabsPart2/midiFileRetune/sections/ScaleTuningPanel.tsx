import React from 'react';
import { ScalaArchivePicker } from '../../ScalaArchivePicker';
import { RetuneStatsPanel } from './RetuneStatsPanel';

type ScaleTuningPanelProps = {
    scalaSource: 'saved' | 'archive';
    selectedScaleId: string;
    sortedSavedScales: any[];
    scalaScaleId: string | null;
    onSelectScalaSource: (source: 'saved' | 'archive') => void;
    onSelectScale: (id: string) => void;
    onSelectScala: (id: string | null, scale: any | null) => void;
    showStats: boolean;
    onToggleStats: () => void;
    retuneStats: any;
};

export const ScaleTuningPanel = ({
    scalaSource,
    selectedScaleId,
    sortedSavedScales,
    scalaScaleId,
    onSelectScalaSource,
    onSelectScale,
    onSelectScala,
    showStats,
    onToggleStats,
    retuneStats
}: ScaleTuningPanelProps) => {
    return (
        <div className="space-y-2">
            <div className="flex gap-1">
                <button
                    onClick={() => onSelectScalaSource('saved')}
                    className={`flex-1 text-[8px] py-0.5 rounded font-bold transition-colors ${scalaSource === 'saved'
                        ? 'bg-purple-700 text-white'
                        : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                        }`}
                >
                    Saved Scales
                </button>
                <button
                    onClick={() => onSelectScalaSource('archive')}
                    className={`flex-1 text-[8px] py-0.5 rounded font-bold transition-colors ${scalaSource === 'archive'
                        ? 'bg-indigo-700 text-white'
                        : 'bg-gray-900 text-gray-500 border border-gray-800 hover:border-gray-600'
                        }`}
                >
                    Scala Archive
                </button>
            </div>

            {scalaSource === 'saved' && (
                <div className="space-y-1">
                    <select
                        value={selectedScaleId}
                        onChange={(e) => onSelectScale(e.target.value)}
                        className="w-full bg-black border border-gray-700 text-xs text-white rounded p-2 focus:border-blue-500 outline-none"
                        style={{ colorScheme: 'dark' }}
                    >
                        {sortedSavedScales.length === 0 && <option value="">No saved scales</option>}
                        {sortedSavedScales.map((scale) => (
                            <option key={scale.id} value={scale.id}>
                                {scale.name} ({scale.scale.length})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {scalaSource === 'archive' && (
                <ScalaArchivePicker
                    selectedId={scalaScaleId}
                    onSelect={onSelectScala}
                />
            )}

            <RetuneStatsPanel
                showStats={showStats}
                onToggle={onToggleStats}
                retuneStats={retuneStats}
            />
        </div>
    );
};
