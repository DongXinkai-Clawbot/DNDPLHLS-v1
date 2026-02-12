import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { MidiRealtimePlayer } from '../../../../utils/midiRealtimePlayer';
import { useStore } from '../../../../store/storeImpl';

const sharedPlayer = new MidiRealtimePlayer();

export const useMidiFileRetunePlayback = ({
    importResult,
    targetMode,
    effectiveTargetScale,
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
}: {
    importResult: any;
    targetMode: string;
    effectiveTargetScale: { scale: string[]; nodeIdByScaleIndex: (string | null)[]; width: number };
    restrictToNodes: boolean;
    previewSpeed: number;
    audioWaveform: OscillatorType;
    resolvedBaseNote: number;
    resolvedBaseFrequency: number;
    disableLatticeVisuals: boolean;
    nodes: any[];
    retuneSnapDelayMs: number;
    setPlayingNodeStates: (nodes: any) => void;
    setPlayingRatios: (ratios: any) => void;
    updateState: (partial: any) => void;
    isPureUIMode: boolean;
    setPureUIMode: (value: boolean) => void;
    triggerCameraReset: () => void;
    autoSwitchToLattice: boolean;
    setRetuneSnapDelay: (ms: number) => void;
}) => {
    const realtimePlayer = useRef<MidiRealtimePlayer>(sharedPlayer);
    const [playingType, setPlayingType] = useState<'original' | 'retuned' | null>(null);
    const autoPureModeRef = useRef(false);
    const manualStopRef = useRef(false);
    const lastPreviewUpdateRef = useRef<number>(-1);
    const [activePreviewMode, setActivePreviewMode] = useState<'retuned' | 'original'>('retuned');
    const [activePreviewSpeed, setActivePreviewSpeed] = useState(1);
    const [seekTick, setSeekTick] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);

    useEffect(() => {
        if (realtimePlayer.current.isPlaying) {
            const mode = realtimePlayer.current.bypassTuning ? 'original' : 'retuned';
            setPlayingType(mode);
            setActivePreviewMode(mode);
            setActivePreviewSpeed(mode === 'original' ? 1 : previewSpeed);
        }

        return () => {
            updateState({ retunePreviewActive: false, previewIsPlaying: false, previewPositionSeconds: 0 });

            if (!autoPureModeRef.current) {
                realtimePlayer.current.stop();
            }
        };
    }, [previewSpeed, updateState]);

    useEffect(() => {
        if (!playingType) {
            setActivePreviewSpeed(activePreviewMode === 'original' ? 1 : previewSpeed);
        }
    }, [previewSpeed, activePreviewMode, playingType]);

    useEffect(() => {
        setSeekTick(0);
        setIsSeeking(false);
    }, [importResult]);

    const tempoMicrosecondsPerBeat = useMemo(() => {
        if (!importResult?.midi?.tracks) return 500000;
        let bestTick = Number.POSITIVE_INFINITY;
        let microsecondsPerBeat = 500000;
        importResult.midi.tracks.forEach((track: any[]) => {
            let absTick = 0;
            track.forEach((ev: any) => {
                absTick += ev?.deltaTime || 0;
                if (ev?.type === 'setTempo' && Number.isFinite(ev.microsecondsPerBeat) && absTick < bestTick) {
                    bestTick = absTick;
                    microsecondsPerBeat = ev.microsecondsPerBeat;
                }
            });
        });
        return microsecondsPerBeat;
    }, [importResult]);

    const secondsPerTickBase = useMemo(() => {
        if (!importResult) return 0;
        const ticksPerBeat = importResult.ticksPerBeat || 480;
        return (tempoMicrosecondsPerBeat / 1000000) / ticksPerBeat;
    }, [importResult, tempoMicrosecondsPerBeat]);

    const totalTicks = importResult?.totalTicks ?? 0;

    const totalDurationSeconds = useMemo(() => {
        if (!importResult || secondsPerTickBase <= 0) return 0;
        const speed = Math.max(0.01, activePreviewSpeed);
        return Math.max(0, totalTicks * (secondsPerTickBase / speed));
    }, [importResult, totalTicks, secondsPerTickBase, activePreviewSpeed]);

    const displaySeconds = useMemo(() => {
        if (secondsPerTickBase <= 0) return 0;
        const speed = Math.max(0.01, activePreviewSpeed);
        return Math.max(0, seekTick * (secondsPerTickBase / speed));
    }, [seekTick, secondsPerTickBase, activePreviewSpeed]);

    const clampedDisplaySeconds = useMemo(() => {
        if (!Number.isFinite(displaySeconds)) return 0;
        return Math.min(totalDurationSeconds, Math.max(0, displaySeconds));
    }, [displaySeconds, totalDurationSeconds]);
    const seekDisabled = !importResult || totalDurationSeconds <= 0 || secondsPerTickBase <= 0;

    const formatTime = (value: number) => {
        if (!Number.isFinite(value) || value <= 0) return '0:00';
        const total = Math.floor(value);
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTickFromSeconds = useCallback((seconds: number, speed: number) => {
        if (secondsPerTickBase <= 0) return 0;
        return (seconds * speed) / secondsPerTickBase;
    }, [secondsPerTickBase]);

    const getSecondsFromTick = useCallback((tick: number, speed: number) => {
        if (secondsPerTickBase <= 0) return 0;
        return tick * (secondsPerTickBase / speed);
    }, [secondsPerTickBase]);

    const previewSeekToSeconds = useCallback((seconds: number) => {
        if (!importResult) return;
        realtimePlayer.current.seekToSeconds(seconds);
        const speed = Math.max(0.01, activePreviewSpeed);
        const nextTick = Math.max(0, Math.min(totalTicks, getTickFromSeconds(seconds, speed)));
        setSeekTick(nextTick);
        setIsSeeking(false);
        updateState({ previewPositionSeconds: seconds, previewIsPlaying: true });
    }, [activePreviewSpeed, getTickFromSeconds, importResult, totalTicks, updateState]);

    useEffect(() => {
        updateState({ previewSeekToSeconds });
        return () => updateState({ previewSeekToSeconds: null });
    }, [previewSeekToSeconds, updateState]);

    const previewStop = useCallback(() => {
        manualStopRef.current = true;
        realtimePlayer.current.stop();
        setPlayingType(null);
        updateState({ retunePreviewActive: false, previewIsPlaying: false });
    }, [updateState]);

    useEffect(() => {
        updateState({ previewStop });
        return () => updateState({ previewStop: null });
    }, [previewStop, updateState]);

    const handlePlaybackEnded = (options?: { exitPure?: boolean; setRetuneInactive?: boolean }) => {
        setPlayingType(null);
        if (options?.setRetuneInactive) {
            updateState({ retunePreviewActive: false, previewIsPlaying: false });
        } else {
            updateState({ previewIsPlaying: false });
        }
        if (manualStopRef.current) {
            manualStopRef.current = false;
            return;
        }
        if (options?.exitPure) {
            setPureUIMode(false);
        }

        const { preExtensionSettings, temporaryExtensionApplied } = useStore.getState().midiRetuner;
        if (temporaryExtensionApplied && preExtensionSettings) {
            const updateSettings = useStore.getState().updateSettings;
            const regenerateLattice = useStore.getState().regenerateLattice;
            updateSettings(preExtensionSettings);
            regenerateLattice(true, true);
            updateState({
                preExtensionSettings: null,
                temporaryExtensionApplied: false
            });
        }
    };

    const startPlayback = (mode: 'original' | 'retuned', startTickOverride?: number, options?: { preservePureMode?: boolean }) => {
        if (!importResult) return;
        if (mode === 'retuned' && targetMode !== 'dynamic' && !effectiveTargetScale.width) return;

        const speed = mode === 'original' ? 1 : previewSpeed;
        const safeStartTick = Math.max(0, Math.min(totalTicks, Number.isFinite(startTickOverride) ? (startTickOverride as number) : seekTick));
        const startAtSeconds = getSecondsFromTick(safeStartTick, Math.max(0.01, speed));

        if (realtimePlayer.current.isPlaying) {
            if (options?.preservePureMode && playingType === 'retuned') {
                manualStopRef.current = true;
            }
            realtimePlayer.current.stop();
        }

        setActivePreviewMode(mode);
        setActivePreviewSpeed(speed);
        setSeekTick(safeStartTick);
        setIsSeeking(false);

        if (mode === 'retuned') {
            const shouldEnterPure = targetMode === 'lattice' || targetMode === 'dynamic' || restrictToNodes;

            if (shouldEnterPure && !isPureUIMode && autoSwitchToLattice) {
                autoPureModeRef.current = true;
                setPureUIMode(true);
                triggerCameraReset();
            } else {
                autoPureModeRef.current = false;
                if (shouldEnterPure && autoSwitchToLattice) triggerCameraReset();
            }

            realtimePlayer.current.setVisualLatencyOffset(retuneSnapDelayMs / 1000);
            realtimePlayer.current.play(
                importResult,
                targetMode === 'dynamic' ? null : effectiveTargetScale.scale,
                resolvedBaseNote,
                resolvedBaseFrequency,
                audioWaveform,
                () => {
                    handlePlaybackEnded({ exitPure: shouldEnterPure, setRetuneInactive: true });
                },
                {
                    nodeIdByScaleIndex: effectiveTargetScale.nodeIdByScaleIndex,
                    ratioByScaleIndex: effectiveTargetScale.scale,
                    onVisualUpdate: disableLatticeVisuals ? undefined : setPlayingNodeStates,
                    onRatioUpdate: setPlayingRatios,
                    latticeNodes: nodes,
                    dynamicRetuning: targetMode === 'dynamic',
                    speed,
                    startAtSeconds
                }
            );
            setPlayingType('retuned');
            lastPreviewUpdateRef.current = startAtSeconds;
            updateState({ retunePreviewActive: true, previewIsPlaying: true, previewPositionSeconds: startAtSeconds });
        } else {
            realtimePlayer.current.play(
                importResult,
                null,
                69,
                440,
                audioWaveform,
                () => handlePlaybackEnded(),
                {
                    speed,
                    startAtSeconds
                }
            );
            setPlayingType('original');
        }
    };

    const handlePlayOriginal = () => {
        if (!importResult) return;
        if (playingType === 'original') {
            realtimePlayer.current.stop();
            setPlayingType(null);
            return;
        }
        startPlayback('original');
    };

    const handlePlayRetuned = () => {
        if (!importResult) return;
        if (targetMode !== 'dynamic' && !effectiveTargetScale.width) return;
        if (playingType === 'retuned') {
            realtimePlayer.current.stop();
            setPlayingType(null);
            updateState({ retunePreviewActive: false, previewIsPlaying: false });
            return;
        }
        startPlayback('retuned');
    };

    useEffect(() => {
        if (!playingType) return;
        let rafId: number | null = null;
        const update = () => {
            if (!realtimePlayer.current.isPlaying) return;
            if (!isSeeking && secondsPerTickBase > 0) {
                const speed = Math.max(0.01, activePreviewSpeed);
                const posSeconds = realtimePlayer.current.getPlaybackPositionSeconds();
                const nextTick = getTickFromSeconds(posSeconds, speed);
                setSeekTick(Math.max(0, Math.min(totalTicks, nextTick)));

                if (playingType === 'retuned') {
                    const rounded = Math.round(posSeconds * 1000) / 1000;
                    if (Math.abs(rounded - lastPreviewUpdateRef.current) >= 0.01) {
                        lastPreviewUpdateRef.current = rounded;
                        updateState({ previewPositionSeconds: rounded, previewIsPlaying: true });
                    }
                }
            }
            rafId = requestAnimationFrame(update);
        };
        rafId = requestAnimationFrame(update);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [playingType, isSeeking, secondsPerTickBase, activePreviewSpeed, totalTicks, getTickFromSeconds, updateState]);

    const handleSeekStart = () => {
        setIsSeeking(true);
    };

    const handleSeekChange = (nextSeconds: number) => {
        if (!Number.isFinite(nextSeconds)) return;
        const speed = Math.max(0.01, activePreviewSpeed);
        const nextTick = getTickFromSeconds(nextSeconds, speed);
        setSeekTick(Math.max(0, Math.min(totalTicks, nextTick)));
    };

    const handleSeekCommit = (nextSeconds: number) => {
        if (!Number.isFinite(nextSeconds)) {
            setIsSeeking(false);
            return;
        }
        const speed = Math.max(0.01, activePreviewSpeed);
        const nextTick = Math.max(0, Math.min(totalTicks, getTickFromSeconds(nextSeconds, speed)));
        setSeekTick(nextTick);
        setIsSeeking(false);
        if (playingType) {
            startPlayback(playingType, nextTick, { preservePureMode: playingType === 'retuned' });
        }
    };

    const handleSnapDelayChange = (ms: number) => {
        setRetuneSnapDelay(ms);
        realtimePlayer.current.setVisualLatencyOffset(ms / 1000);
    };

    return {
        playingType,
        activePreviewMode,
        activePreviewSpeed,
        seekTick,
        isSeeking,
        totalDurationSeconds,
        clampedDisplaySeconds,
        seekDisabled,
        formatTime,
        handlePlayOriginal,
        handlePlayRetuned,
        handleSeekStart,
        handleSeekChange,
        handleSeekCommit,
        handleSnapDelayChange
    } as const;
};

