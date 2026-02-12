import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { parseMidiForRetune, retuneMidiToScale } from '../../../../utils/midiFileRetune';
import { renderMidiToAudio, type RenderProgress } from '../../../../utils/midiAudioRenderer';
import { useStore } from '../../../../store/storeImpl';
import type { ScalaArchiveScale } from '../../../../utils/scalaArchive';
import { buildOutputName } from './utils';
import { useMidiRetuneCustomScale } from './useMidiRetuneCustomScale';
import { generateDemoMidi } from '../../../../utils/generateDemoMidi';
import { useMidiFileRetuneTargets } from './useMidiFileRetuneTargets';
import { useMidiFileRetunePlayback } from './useMidiFileRetunePlayback';

const RETUNE_SPEED_MIN = 0.25;
const RETUNE_SPEED_MAX = 4;
const RETUNE_SPEED_STEP = 0.05;
const clampRetuneSpeed = (value: number) => Math.min(RETUNE_SPEED_MAX, Math.max(RETUNE_SPEED_MIN, value));
const TRACK_COLOR_PRESETS = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
    '#8b5cf6', '#d946ef', '#f43f5e', '#fb7185',
    '#fcd34d', '#a3e635', '#22d3ee', '#818cf8'
];
const TRACK_MATERIALS = ['basic', 'lambert', 'phong', 'standard', 'toon', 'normal'] as const;

export type MidiFileRetuneLogic = ReturnType<typeof useMidiFileRetuneLogic>;

export const useMidiFileRetuneLogic = ({ settings, savedMidiScales }: { settings: any; savedMidiScales: any[] }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        importResult, targetMode, selectedScaleId, scalaScaleId, scalaSource,
        edoDivisions, baseNote, outputUrl, outputName, summary, restrictToNodes,
        retuneSpeed, retuneSpeedTargets, retuneTrackStyles, retuneTrackVisualsEnabled, retuneTrackEffect,
        autoSwitchToLattice
    } = useStore(state => state.midiRetuner);
    const updateState = useStore(state => state.setMidiRetunerState);
    const nodes = useStore(state => state.nodes);
    const setPlayingNodeStates = useStore(state => state.setPlayingNodeStates);
    const setPlayingRatios = useStore(state => state.setPlayingRatios);
    const retuneSnapDelayMs = useStore(state => state.retuneSnapDelayMs);
    const setRetuneSnapDelay = useStore(state => state.setRetuneSnapDelay);
    const triggerCameraReset = useStore(s => s.triggerCameraReset);
    const isPureUIMode = useStore(state => state.isPureUIMode);
    const setPureUIMode = useStore(state => state.setPureUIMode);
    const regenerateLattice = useStore(state => state.regenerateLattice);
    const updateSettings = useStore(state => state.updateSettings);

    const layoutMode = settings?.visuals?.layoutMode || 'lattice';
    const playbackVisualizationMode = settings?.playbackVisualizationMode || 'SCROLLER';
    const playbackRing = settings?.playbackRing || { scale: 1, showAllLabels: true, showPreferredNames: false, rotationDeg: 0, showUpcoming: false, showDebug: false };
    const speedTargets = retuneSpeedTargets || { preview: true, wav: true, midi: false };
    const speedValue = clampRetuneSpeed(Number.isFinite(retuneSpeed) ? retuneSpeed : 1);
    const previewSpeed = speedTargets.preview ? speedValue : 1;
    const resolvedBaseNote = Number.isFinite(baseNote) ? baseNote : 69;
    const resolvedBaseFrequency = useMemo(() => {
        if (!importResult?.tuning) return 440;
        const freqs = importResult.tuning.noteFrequencies;
        if (Array.isArray(freqs) && Number.isFinite(freqs[resolvedBaseNote])) {
            return freqs[resolvedBaseNote] as number;
        }
        const tuningBaseNote = Number.isFinite(importResult.tuning.baseNote) ? importResult.tuning.baseNote : 69;
        const tuningBaseFreq = Number.isFinite(importResult.tuning.baseFrequency) ? importResult.tuning.baseFrequency : 440;
        return tuningBaseFreq * Math.pow(2, (resolvedBaseNote - tuningBaseNote) / 12);
    }, [importResult, resolvedBaseNote]);
    const trackCount = importResult?.trackCount ?? 0;
    const partPairs = useMemo(() => {
        if (!importResult?.notes?.length) return [] as Array<{ trackIndex: number; channel: number }>;
        const map = new Map<string, { trackIndex: number; channel: number }>();
        importResult.notes.forEach((note: any) => {
            const trackIndex = Number.isFinite(note.trackIndex) ? note.trackIndex : 0;
            const channel = Number.isFinite(note.channel) ? note.channel : 0;
            const key = `${trackIndex}:${channel}`;
            if (!map.has(key)) map.set(key, { trackIndex, channel });
        });
        return Array.from(map.values()).sort((a, b) => {
            if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
            return a.channel - b.channel;
        });
    }, [importResult]);
    const partCount = partPairs.length;
    const visualGroupCount = partCount > 0 ? partCount : trackCount;
    const visualGroupLabel = partCount > 0 ? 'Part' : 'Track';
    const visualGroupLabels = useMemo(() => {
        if (partPairs.length > 0) {
            return partPairs.map((pair, index) => `Part ${index + 1} (T${pair.trackIndex + 1} Ch ${pair.channel + 1})`);
        }
        if (trackCount > 0) {
            return Array.from({ length: trackCount }, (_, index) => `Track ${index + 1}`);
        }
        return [] as string[];
    }, [partPairs, trackCount]);
    const resolvedTrackStyles = useMemo(() => {
        const existing = Array.isArray(retuneTrackStyles) ? retuneTrackStyles : [];
        const count = Math.max(visualGroupCount, existing.length);
        const styles = [] as Array<{ color: string; material: string; textureUrl?: string }>;
        for (let i = 0; i < count; i++) {
            const fallback = {
                color: TRACK_COLOR_PRESETS[i % TRACK_COLOR_PRESETS.length],
                material: 'standard',
                textureUrl: ''
            };
            styles.push({ ...fallback, ...(existing[i] || {}) });
        }
        return styles;
    }, [retuneTrackStyles, visualGroupCount]);

    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [audioWaveform, setAudioWaveform] = useState<OscillatorType>('triangle');
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioName, setAudioName] = useState<string>('retuned.wav');
    const [audioRendering, setAudioRendering] = useState(false);
    const [audioProgress, setAudioProgress] = useState<RenderProgress | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [disableLatticeVisuals, setDisableLatticeVisuals] = useState(false);

    const [loadedScalaScale, setLoadedScalaScale] = useState<ScalaArchiveScale | null>(null);

    const [extensionMode, setExtensionMode] = useState<'temporary' | 'permanent' | 'replacement'>('temporary');
    const [showExtensionConfirm, setShowExtensionConfirm] = useState(false);
    const [extensionPanelCollapsed, setExtensionPanelCollapsed] = useState(false);

    const handleScalaSelect = useCallback((id: string | null, scale: ScalaArchiveScale | null) => {
        updateState({ scalaScaleId: id });
        setLoadedScalaScale(scale);
    }, [updateState]);

    const {
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
        formatRatioInput
    } = useMidiRetuneCustomScale({ settings });

    useEffect(() => {
        if (savedMidiScales.length > 0) {
            const exists = selectedScaleId && savedMidiScales.some(s => s.id === selectedScaleId);
            if (!exists) {
                updateState({ selectedScaleId: savedMidiScales[0].id });
            }
        }
    }, [savedMidiScales, selectedScaleId, updateState]);

    const targets = useMidiFileRetuneTargets({
        settings,
        nodes,
        layoutMode,
        targetMode,
        retuneCustomScale,
        savedMidiScales,
        selectedScaleId,
        scalaSource,
        loadedScalaScale,
        edoDivisions,
        restrictToNodes,
        showStats,
        importResult,
        resolvedBaseNote,
        resolvedBaseFrequency,
        extensionMode,
        updateState,
        updateSettings,
        regenerateLattice,
        setShowExtensionConfirm,
        setExtensionPanelCollapsed
    });

    const playback = useMidiFileRetunePlayback({
        importResult,
        targetMode,
        effectiveTargetScale: targets.effectiveTargetScale,
        restrictToNodes,
        previewSpeed,
        audioWaveform,
        resolvedBaseNote,
        resolvedBaseFrequency,
        disableLatticeVisuals,
        nodes,
        retuneSnapDelayMs,
        setPlayingNodeStates,
        setPlayingRatios,
        updateState,
        isPureUIMode,
        setPureUIMode,
        triggerCameraReset,
        autoSwitchToLattice,
        setRetuneSnapDelay
    });

    const handleSpeedChange = (next: number) => {
        if (!Number.isFinite(next)) return;
        updateState({ retuneSpeed: clampRetuneSpeed(next) });
    };

    const handleSpeedTargetToggle = (key: 'preview' | 'wav' | 'midi') => {
        updateState({
            retuneSpeedTargets: {
                ...speedTargets,
                [key]: !speedTargets[key]
            }
        });
    };

    const updateTrackStyle = (index: number, partial: { color?: string; material?: string; textureUrl?: string }) => {
        const next = [...resolvedTrackStyles];
        next[index] = { ...next[index], ...partial };
        updateState({ retuneTrackStyles: next });
    };

    const handleTrackVisualsToggle = () => {
        updateState({ retuneTrackVisualsEnabled: !retuneTrackVisualsEnabled });
    };

    const handleTrackEffectChange = (effect: string) => {
        updateState({ retuneTrackEffect: effect });
    };

    const handleHideLatticeToggle = (value: boolean) => {
        setDisableLatticeVisuals(value);
        if (value && playbackVisualizationMode !== 'HUNT205_RING') {
            updateSettings({ playbackVisualizationMode: 'HUNT205_RING' });
        }
    };

    const handlePlaybackModeChange = (mode: 'SCROLLER' | 'HUNT205_RING') => {
        updateSettings({ playbackVisualizationMode: mode });
    };

    const handlePlaybackRingChange = (partial: { scale?: number; showAllLabels?: boolean; showPreferredNames?: boolean; rotationDeg?: number; showUpcoming?: boolean; showDebug?: boolean }) => {
        updateSettings({ playbackRing: { ...playbackRing, ...partial } });
    };

    const handleFile = async (file: File) => {
        setError(null);
        updateState({ summary: null });
        if (outputUrl) {
            URL.revokeObjectURL(outputUrl);
            updateState({ outputUrl: null });
        }
        try {
            const buffer = await file.arrayBuffer();
            const result = parseMidiForRetune(new Uint8Array(buffer), file.name);
            updateState({ importResult: result, outputName: buildOutputName(file.name) });
        } catch (e: any) {
            setError(e?.message || 'Failed to load MIDI file.');
            updateState({ importResult: null });
        }
    };

    const handleLoadDemo = async () => {
        setError(null);
        updateState({ summary: null });
        if (outputUrl) {
            URL.revokeObjectURL(outputUrl);
            updateState({ outputUrl: null });
        }
        try {
            const bytes = generateDemoMidi();
            const result = parseMidiForRetune(bytes, 'demo_progression.mid');
            updateState({
                importResult: result,
                outputName: 'demo_progression_retuned.mid',
                targetMode: 'dynamic'
            });
        } catch (e: any) {
            setError('Failed to generate demo MIDI.');
        }
    };

    const handleRetune = () => {
        if (!importResult) {
            setError('Upload a MIDI file first.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const tuningName = targetMode === 'scale'
                ? (savedMidiScales.find((s) => s.id === selectedScaleId)?.name || 'Scale')
                : targetMode === 'edo'
                    ? `EDO ${edoDivisions}`
                    : targetMode === 'lattice'
                        ? `Layout Nodes (${layoutMode})`
                        : 'Custom Mapping';
            const tempoScale = speedTargets.midi ? speedValue : 1;
            const result = retuneMidiToScale(importResult, targets.effectiveTargetScale.scale, {
                tuningName,
                baseNote: resolvedBaseNote,
                baseFrequency: resolvedBaseFrequency,
                tempoScale
            });
            if (!result.bytes || result.bytes.length === 0) {
                setError('Retune failed to produce output.');
                setBusy(false);
                return;
            }
            const blob = new Blob([result.bytes], { type: 'audio/midi' });
            const url = URL.createObjectURL(blob);
            updateState({ outputUrl: url, summary: result.summary });
        } catch (e: any) {
            setError(e?.message || 'Retune failed.');
        } finally {
            setBusy(false);
        }
    };

    const handleClear = () => {
        updateState({
            importResult: null,
            summary: null,
            outputUrl: null,
            retunePreviewActive: false,
            previewIsPlaying: false,
            previewPositionSeconds: 0
        });
        setError(null);
        if (outputUrl) URL.revokeObjectURL(outputUrl);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setAudioProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportAudio = async () => {
        if (!importResult) {
            setError('Upload a MIDI file first.');
            return;
        }
        setAudioRendering(true);
        setError(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        try {
            const exportSpeed = speedTargets.wav ? speedValue : 1;
            const blob = await renderMidiToAudio(importResult, targets.effectiveTargetScale.scale, {
                waveform: audioWaveform,
                baseNote: resolvedBaseNote,
                baseFrequency: resolvedBaseFrequency,
                speed: exportSpeed,
                onProgress: setAudioProgress
            });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            const baseName = importResult.fileName?.replace(/\.mid$/i, '') || 'retuned';
            setAudioName(`${baseName}_audio.wav`);
        } catch (e: any) {
            setError(e?.message || 'Audio export failed.');
        } finally {
            setAudioRendering(false);
        }
    };

    return {
        fileInputRef,
        error,
        setError,
        busy,
        importResult,
        targetMode,
        selectedScaleId,
        scalaScaleId,
        scalaSource,
        edoDivisions,
        baseNote,
        outputUrl,
        outputName,
        summary,
        restrictToNodes,
        retuneSpeed,
        retuneSpeedTargets,
        retuneTrackStyles,
        retuneTrackVisualsEnabled,
        retuneTrackEffect,
        autoSwitchToLattice,
        updateState,
        nodes,
        retuneSnapDelayMs,
        setRetuneSnapDelay,
        layoutMode,
        playbackVisualizationMode,
        playbackRing,
        speedTargets,
        speedValue,
        previewSpeed,
        resolvedBaseNote,
        resolvedBaseFrequency,
        trackCount,
        partCount,
        visualGroupCount,
        visualGroupLabel,
        visualGroupLabels,
        resolvedTrackStyles,
        audioWaveform,
        setAudioWaveform,
        audioUrl,
        audioName,
        audioRendering,
        audioProgress,
        showStats,
        setShowStats,
        disableLatticeVisuals,
        setDisableLatticeVisuals,
        playingType: playback.playingType,
        activePreviewMode: playback.activePreviewMode,
        activePreviewSpeed: playback.activePreviewSpeed,
        seekTick: playback.seekTick,
        isSeeking: playback.isSeeking,
        loadedScalaScale,
        extensionMode,
        setExtensionMode,
        showExtensionConfirm,
        setShowExtensionConfirm,
        extensionPanelCollapsed,
        setExtensionPanelCollapsed,
        handleScalaSelect,
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
        layoutScale: targets.layoutScale,
        effectiveTargetScale: targets.effectiveTargetScale,
        extensionPlan: targets.extensionPlan,
        handleApplyExtension: targets.handleApplyExtension,
        retuneStats: targets.retuneStats,
        noteStats: targets.noteStats,
        sortedSavedScales: targets.sortedSavedScales,
        totalDurationSeconds: playback.totalDurationSeconds,
        clampedDisplaySeconds: playback.clampedDisplaySeconds,
        seekDisabled: playback.seekDisabled,
        formatTime: playback.formatTime,
        handlePlayOriginal: playback.handlePlayOriginal,
        handleSpeedChange,
        handleSpeedTargetToggle,
        updateTrackStyle,
        handleTrackVisualsToggle,
        handleTrackEffectChange,
        handleHideLatticeToggle,
        handlePlaybackModeChange,
        handlePlaybackRingChange,
        handlePlayRetuned: playback.handlePlayRetuned,
        handleSeekStart: playback.handleSeekStart,
        handleSeekChange: playback.handleSeekChange,
        handleSeekCommit: playback.handleSeekCommit,
        handleSnapDelayChange: playback.handleSnapDelayChange,
        handleFile,
        handleLoadDemo,
        handleRetune,
        handleClear,
        handleExportAudio,
        TRACK_MATERIALS,
        TRACK_COLOR_PRESETS,
        TRACK_EFFECTS: ['solid', 'glow', 'neon', 'pulse', 'halo'] as const
    } as const;
};

