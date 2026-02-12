import React from 'react';
import { useMidiFileRetuneLogic } from './midiFileRetune/useMidiFileRetuneLogic';
import { MidiRetuneHeader } from './midiFileRetune/sections/MidiRetuneHeader';
import { MidiFileInfoPanel } from './midiFileRetune/sections/MidiFileInfoPanel';
import { LatticeExtensionPanel } from './midiFileRetune/sections/LatticeExtensionPanel';
import { TargetModePanel } from './midiFileRetune/sections/TargetModePanel';
import { BaseNotePanel } from './midiFileRetune/sections/BaseNotePanel';
import { RetuneSpeedPanel } from './midiFileRetune/sections/RetuneSpeedPanel';
import { AutoSwitchPanel } from './midiFileRetune/sections/AutoSwitchPanel';
import { TrackVisualsPanel } from './midiFileRetune/sections/TrackVisualsPanel';
import { AVDelayPanel } from './midiFileRetune/sections/AVDelayPanel';
import { PreviewPositionPanel } from './midiFileRetune/sections/PreviewPositionPanel';
import { PlaybackVisualizationPanel } from './midiFileRetune/sections/PlaybackVisualizationPanel';
import { RetuneActionsPanel } from './midiFileRetune/sections/RetuneActionsPanel';

type MidiFileRetuneSectionProps = {
    settings: any;
    savedMidiScales: any[];
};

const RETUNE_SPEED_MIN = 0.25;
const RETUNE_SPEED_MAX = 4;
const RETUNE_SPEED_STEP = 0.05;

export const MidiFileRetuneSection = ({ settings, savedMidiScales }: MidiFileRetuneSectionProps) => {
    const logic = useMidiFileRetuneLogic({ settings, savedMidiScales });

    return (
        <div className="p-3 bg-emerald-900/10 border border-emerald-800/50 rounded-lg space-y-3">
            <MidiRetuneHeader
                fileInputRef={logic.fileInputRef}
                onLoadDemo={logic.handleLoadDemo}
                onClear={logic.handleClear}
                onFileSelected={logic.handleFile}
            />

            {logic.error && (
                <div className="text-[9px] text-red-300 bg-red-900/30 border border-red-800 rounded p-2">{logic.error}</div>
            )}

            <MidiFileInfoPanel
                importResult={logic.importResult}
                noteStats={logic.noteStats}
                playingType={logic.playingType}
                onPlayOriginal={logic.handlePlayOriginal}
            />

            <LatticeExtensionPanel
                extensionPlan={logic.extensionPlan}
                extensionPanelCollapsed={logic.extensionPanelCollapsed}
                setExtensionPanelCollapsed={logic.setExtensionPanelCollapsed}
                extensionMode={logic.extensionMode}
                setExtensionMode={logic.setExtensionMode}
                onApplyExtension={logic.handleApplyExtension}
            />

            <TargetModePanel
                targetMode={logic.targetMode}
                onSetTargetMode={(mode) => logic.updateState({ targetMode: mode })}
                scalaSource={logic.scalaSource}
                onSelectScalaSource={(source) => logic.updateState({ scalaSource: source })}
                selectedScaleId={logic.selectedScaleId}
                sortedSavedScales={logic.sortedSavedScales}
                scalaScaleId={logic.scalaScaleId}
                onSelectScale={(id) => logic.updateState({ selectedScaleId: id })}
                onSelectScala={logic.handleScalaSelect}
                retuneCustomScale={logic.retuneCustomScale}
                newScaleName={logic.newScaleName}
                setNewScaleName={logic.setNewScaleName}
                equalStepBase={logic.equalStepBase}
                setEqualStepBase={logic.setEqualStepBase}
                equalStepDivisor={logic.equalStepDivisor}
                setEqualStepDivisor={logic.setEqualStepDivisor}
                meantonePresetId={logic.meantonePresetId}
                setMeantonePresetId={logic.setMeantonePresetId}
                wellTemperedPresetId={logic.wellTemperedPresetId}
                setWellTemperedPresetId={logic.setWellTemperedPresetId}
                customCommaInput={logic.customCommaInput}
                setCustomCommaInput={logic.setCustomCommaInput}
                handleCustomScaleChange={logic.handleCustomScaleChange}
                handleScaleStepChange={logic.handleScaleStepChange}
                generateTETScale={logic.generateTETScale}
                generateEqualStepScale={logic.generateEqualStepScale}
                applyMeantonePreset={logic.applyMeantonePreset}
                applyCustomComma={logic.applyCustomComma}
                applyWellTemperedPreset={logic.applyWellTemperedPreset}
                clearCustomMap={logic.clearCustomMap}
                resetToStandardJI={logic.resetToStandardJI}
                handleSaveScale={logic.handleSaveScale}
                handleExportMts={logic.handleExportMts}
                handlePlayRatio={logic.handlePlayRatio}
                handleDivisionChange={logic.handleDivisionChange}
                deleteMidiScale={logic.deleteMidiScale}
                formatRatioInput={logic.formatRatioInput}
                savedMidiScales={savedMidiScales}
                showStats={logic.showStats}
                onToggleStats={() => logic.setShowStats(!logic.showStats)}
                retuneStats={logic.retuneStats}
                restrictToNodes={logic.restrictToNodes}
                onToggleRestrictToNodes={(value) => logic.updateState({ restrictToNodes: value })}
                layoutScaleSize={logic.layoutScale.scale.length}
                edoDivisions={logic.edoDivisions}
                onSetEdoDivisions={(value) => logic.updateState({ edoDivisions: value })}
                layoutMode={logic.layoutMode}
            />

            <BaseNotePanel baseNote={logic.baseNote} onChange={(value) => logic.updateState({ baseNote: value })} />

            <RetuneSpeedPanel
                speedValue={logic.speedValue}
                speedTargets={logic.speedTargets}
                onSpeedChange={logic.handleSpeedChange}
                onToggleTarget={logic.handleSpeedTargetToggle}
                min={RETUNE_SPEED_MIN}
                max={RETUNE_SPEED_MAX}
                step={RETUNE_SPEED_STEP}
            />

            <AutoSwitchPanel
                autoSwitchToLattice={logic.autoSwitchToLattice}
                onToggle={(value) => logic.updateState({ autoSwitchToLattice: value })}
            />

            <TrackVisualsPanel
                groupCount={logic.visualGroupCount}
                groupLabel={logic.visualGroupLabel}
                groupLabels={logic.visualGroupLabels}
                resolvedTrackStyles={logic.resolvedTrackStyles}
                trackMaterials={logic.TRACK_MATERIALS}
                trackColorPresets={logic.TRACK_COLOR_PRESETS}
                trackEffects={logic.TRACK_EFFECTS}
                retuneTrackEffect={logic.retuneTrackEffect || 'glow'}
                retuneTrackVisualsEnabled={logic.retuneTrackVisualsEnabled}
                disableLatticeVisuals={logic.disableLatticeVisuals}
                onToggleTrackVisuals={logic.handleTrackVisualsToggle}
                onToggleHideLattice={(value) => logic.handleHideLatticeToggle(value)}
                onUpdateTrackStyle={logic.updateTrackStyle}
                onUpdateTrackEffect={logic.handleTrackEffectChange}
            />

            <AVDelayPanel
                retuneSnapDelayMs={logic.retuneSnapDelayMs}
                onChange={(ms) => logic.handleSnapDelayChange(ms)}
            />

            <PreviewPositionPanel
                clampedDisplaySeconds={logic.clampedDisplaySeconds}
                totalDurationSeconds={logic.totalDurationSeconds}
                formatTime={logic.formatTime}
                onSeekStart={logic.handleSeekStart}
                onSeekChange={logic.handleSeekChange}
                onSeekCommit={logic.handleSeekCommit}
                disabled={logic.seekDisabled}
            />

            <PlaybackVisualizationPanel
                playbackVisualizationMode={logic.playbackVisualizationMode}
                ringSettings={logic.playbackRing}
                onModeChange={logic.handlePlaybackModeChange}
                onRingChange={logic.handlePlaybackRingChange}
            />

            <RetuneActionsPanel
                busy={logic.busy}
                importResult={logic.importResult}
                playingType={logic.playingType}
                onRetune={logic.handleRetune}
                onPlayRetuned={logic.handlePlayRetuned}
                outputUrl={logic.outputUrl}
                outputName={logic.outputName}
                onExportAudio={logic.handleExportAudio}
                audioRendering={logic.audioRendering}
                audioUrl={logic.audioUrl}
                audioName={logic.audioName}
                audioWaveform={logic.audioWaveform}
                onWaveformChange={logic.setAudioWaveform}
            />

            {logic.summary && (
                <div className="text-[9px] text-gray-400">
                    Notes retuned: {logic.summary.notesRetuned} | Avg shift: {logic.summary.averageCents.toFixed(2)} cents | Max shift: {logic.summary.maxCents.toFixed(2)} cents
                </div>
            )}

            {logic.audioRendering && logic.audioProgress && (
                <div className="text-[8px] text-amber-400">
                    {logic.audioProgress.message} ({logic.audioProgress.percent.toFixed(0)}%)
                </div>
            )}
        </div>
    );
};

