import React from 'react';
import { ScaleTuningPanel } from './ScaleTuningPanel';
import { CustomMapPanel } from './CustomMapPanel';
import { RetuneStatsPanel } from './RetuneStatsPanel';

type TargetModePanelProps = {
    targetMode: 'scale' | 'custom' | 'dynamic' | 'edo' | 'lattice';
    onSetTargetMode: (mode: 'scale' | 'custom' | 'dynamic') => void;
    scalaSource: 'saved' | 'archive';
    onSelectScalaSource: (source: 'saved' | 'archive') => void;
    selectedScaleId: string;
    sortedSavedScales: any[];
    scalaScaleId: string | null;
    onSelectScale: (id: string) => void;
    onSelectScala: (id: string | null, scale: any | null) => void;
    retuneCustomScale: string[] | null;
    newScaleName: string;
    setNewScaleName: (name: string) => void;
    equalStepBase: number;
    setEqualStepBase: (value: number) => void;
    equalStepDivisor: number;
    setEqualStepDivisor: (value: number) => void;
    meantonePresetId: string;
    setMeantonePresetId: (value: string) => void;
    wellTemperedPresetId: string;
    setWellTemperedPresetId: (value: string) => void;
    customCommaInput: string;
    setCustomCommaInput: (value: string) => void;
    handleCustomScaleChange: (scale: string[]) => void;
    handleScaleStepChange: (index: number, value: string) => void;
    generateTETScale: (divisions: number) => void;
    generateEqualStepScale: () => void;
    applyMeantonePreset: (id: string) => void;
    applyCustomComma: (comma: string) => void;
    applyWellTemperedPreset: (id: string) => void;
    clearCustomMap: () => void;
    resetToStandardJI: () => void;
    handleSaveScale: () => void;
    handleExportMts: (scale: string[], name: string) => void;
    handlePlayRatio: (ratio: string, index: number) => void;
    handleDivisionChange: (value: number) => void;
    deleteMidiScale: (id: string) => void;
    formatRatioInput: (value: string) => string;
    savedMidiScales: any[];
    showStats: boolean;
    onToggleStats: () => void;
    retuneStats: any;
    restrictToNodes: boolean;
    onToggleRestrictToNodes: (value: boolean) => void;
    layoutScaleSize: number;
    edoDivisions: number;
    onSetEdoDivisions: (value: number) => void;
    layoutMode: string;
};

export const TargetModePanel = ({
    targetMode,
    onSetTargetMode,
    scalaSource,
    onSelectScalaSource,
    selectedScaleId,
    sortedSavedScales,
    scalaScaleId,
    onSelectScale,
    onSelectScala,
    retuneCustomScale,
    newScaleName,
    setNewScaleName,
    equalStepBase,
    setEqualStepBase,
    equalStepDivisor,
    setEqualStepDivisor,
    meantonePresetId,
    setMeantonePresetId,
    wellTemperedPresetId,
    setWellTemperedPresetId,
    customCommaInput,
    setCustomCommaInput,
    handleCustomScaleChange,
    handleScaleStepChange,
    generateTETScale,
    generateEqualStepScale,
    applyMeantonePreset,
    applyCustomComma,
    applyWellTemperedPreset,
    clearCustomMap,
    resetToStandardJI,
    handleSaveScale,
    handleExportMts,
    handlePlayRatio,
    handleDivisionChange,
    deleteMidiScale,
    formatRatioInput,
    savedMidiScales,
    showStats,
    onToggleStats,
    retuneStats,
    restrictToNodes,
    onToggleRestrictToNodes,
    layoutScaleSize,
    edoDivisions,
    onSetEdoDivisions,
    layoutMode
}: TargetModePanelProps) => {
    return (
        <div className="bg-black/40 border border-gray-800 rounded p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
                <button
                    onClick={() => onSetTargetMode('scale')}
                    className={`flex-1 text-[9px] py-1 rounded font-bold ${targetMode === 'scale' ? 'bg-purple-700 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}
                >
                    Scale Tuning
                </button>
                <button
                    onClick={() => onSetTargetMode('custom')}
                    className={`flex-1 text-[9px] py-1 rounded font-bold ${targetMode === 'custom' ? 'bg-blue-700 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}
                >
                    Custom Map
                </button>
                <button
                    onClick={() => onSetTargetMode('dynamic')}
                    className={`flex-1 text-[9px] py-1 rounded font-bold ${targetMode === 'dynamic' ? 'bg-amber-700 text-white' : 'bg-gray-900 text-gray-400 border border-gray-700'}`}
                >
                    Dynamic
                </button>
            </div>

            {targetMode === 'scale' && (
                <ScaleTuningPanel
                    scalaSource={scalaSource}
                    selectedScaleId={selectedScaleId}
                    sortedSavedScales={sortedSavedScales}
                    scalaScaleId={scalaScaleId}
                    onSelectScalaSource={onSelectScalaSource}
                    onSelectScale={onSelectScale}
                    onSelectScala={onSelectScala}
                    showStats={showStats}
                    onToggleStats={onToggleStats}
                    retuneStats={retuneStats}
                />
            )}

            {targetMode === 'custom' && (
                <CustomMapPanel
                    retuneCustomScale={retuneCustomScale}
                    newScaleName={newScaleName}
                    setNewScaleName={setNewScaleName}
                    equalStepBase={equalStepBase}
                    setEqualStepBase={setEqualStepBase}
                    equalStepDivisor={equalStepDivisor}
                    setEqualStepDivisor={setEqualStepDivisor}
                    meantonePresetId={meantonePresetId}
                    setMeantonePresetId={setMeantonePresetId}
                    wellTemperedPresetId={wellTemperedPresetId}
                    setWellTemperedPresetId={setWellTemperedPresetId}
                    customCommaInput={customCommaInput}
                    setCustomCommaInput={setCustomCommaInput}
                    handleCustomScaleChange={handleCustomScaleChange}
                    handleScaleStepChange={handleScaleStepChange}
                    generateTETScale={generateTETScale}
                    generateEqualStepScale={generateEqualStepScale}
                    applyMeantonePreset={applyMeantonePreset}
                    applyCustomComma={applyCustomComma}
                    applyWellTemperedPreset={applyWellTemperedPreset}
                    clearCustomMap={clearCustomMap}
                    resetToStandardJI={resetToStandardJI}
                    handleSaveScale={handleSaveScale}
                    handleExportMts={handleExportMts}
                    handlePlayRatio={handlePlayRatio}
                    handleDivisionChange={handleDivisionChange}
                    deleteMidiScale={deleteMidiScale}
                    formatRatioInput={formatRatioInput}
                    savedMidiScales={savedMidiScales}
                    showStats={showStats}
                    onToggleStats={onToggleStats}
                    retuneStats={retuneStats}
                />
            )}

            {targetMode === 'dynamic' && (
                <div className="space-y-2">
                    <div className="text-[9px] text-gray-500">
                        Dynamic Tuning: Optimizes each chord to purest lattice nodes in real-time.
                    </div>
                    <RetuneStatsPanel showStats={showStats} onToggle={onToggleStats} retuneStats={retuneStats} />
                </div>
            )}

            {targetMode !== 'lattice' && targetMode !== 'dynamic' && (
                <label className="flex items-center gap-2 text-[9px] text-gray-500">
                    <input
                        type="checkbox"
                        checked={restrictToNodes}
                        onChange={(e) => onToggleRestrictToNodes(e.target.checked)}
                        className="accent-emerald-500"
                    />
                    Snap tuning steps to layout nodes ({layoutScaleSize})
                </label>
            )}

            {targetMode === 'edo' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <label className="text-[9px] text-gray-500 uppercase font-bold">Divisions</label>
                        <input
                            type="number"
                            min="1"
                            max="96"
                            value={edoDivisions}
                            onChange={(e) => onSetEdoDivisions(parseInt(e.target.value, 10) || 12)}
                            className="w-16 bg-black border border-gray-600 text-center text-xs text-white rounded p-1"
                        />
                        <span className="text-[9px] text-gray-500">steps</span>
                    </div>
                    <RetuneStatsPanel showStats={showStats} onToggle={onToggleStats} retuneStats={retuneStats} />
                </div>
            )}

            {targetMode === 'lattice' && (
                <div className="text-[9px] text-gray-500">
                    Using layout nodes ({layoutMode}, {layoutScaleSize} pitch classes).
                </div>
            )}
        </div>
    );
};
