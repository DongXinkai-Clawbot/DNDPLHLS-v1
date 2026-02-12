
import { buildTargetFrequencies, findNearestTargetIndex, midiNoteToFrequency } from './midiAudioRenderer';
import { type MidiImportResult } from './midiFileRetune';
import { type NodeData } from '../typesPart1';
import { findBestTuningForChord } from './dynamicTuning';
import { createLogger } from './logger';

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_SPEED = 1;

const log = createLogger('midi/realtime-player');

const clampPlaybackSpeed = (value?: number) => {
    if (!Number.isFinite(value)) return DEFAULT_SPEED;
    const v = value as number;
    if (v <= 0) return DEFAULT_SPEED;
    return Math.min(4, Math.max(0.25, v));
};

interface ScheduledNote {
    noteNumber: number;
    startTime: number;
    endTime: number;
    nodeId: string;
}

export class MidiRealtimePlayer {
    private ctx: AudioContext | null = null;
    public isPlaying = false;
    private nextNoteIndex = 0;
    private startTime = 0;
    private scheduleAheadTime = 0.1; // Seconds to schedule ahead
    private lookahead = 25.0; // Milliseconds for setInterval lookahead
    private timerId: number | null = null;
    public visualLatencyOffset = -0.05; // Seconds to offset visuals (negative = earlier)
    private activeOscillators: Set<OscillatorNode> = new Set();

    private importResult: MidiImportResult | null = null;
    private targetFreqs: number[] = [];
    public bypassTuning = false;
    private playbackSpeed = DEFAULT_SPEED;
    private playbackNotes: any[] = [];
    private playbackMaxTick = 0;
    private startTickOffset = 0;
    private startOffsetSeconds = 0;
    private lastPlaybackSeconds = 0;
    private waveform: OscillatorType = 'triangle';
    private noteGain = 0.15;
    private baseFrequency = 440;
    private onEnded: (() => void) | null = null;
    private onNodeStateChange: ((nodeId: string, isPlaying: boolean) => void) | null = null;
    private nodeIdByScaleIndex: (string | null)[] | null = null;
    private secondsPerTick = 0;
    private activeNotes = new Map<number, { note: any; startTime: number; trackIndex?: number }>();
    private sustainNotes = new Map<number, { note: any; startTime: number; trackIndex?: number }[]>();
    private partIndexByTrackChannel = new Map<string, number>();
    private partIndexCount = 0;
    private visualQueue: { nodeId: string; startTime: number; endTime: number; channel: number; velocity: number; trackIndex?: number; partIndex?: number }[] = [];
    private currentVisuals: { nodeId: string; endTime: number; channel: number; velocity: number; trackIndex?: number; partIndex?: number }[] = [];
    private ratioQueue: {
        noteId: string;
        ratio: string;
        startTime: number;
        endTime: number;
        channel: number;
        velocity: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTimeSeconds?: number;
        endTimeSeconds?: number;
    }[] = [];
    private currentRatios: {
        noteId: string;
        ratio: string;
        endTime: number;
        channel: number;
        velocity: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTimeSeconds?: number;
        endTimeSeconds?: number;
    }[] = [];
    private lastVisualState: Map<string, string> = new Map(); // For diffing (JSON stringified value)
    private animationFrameId: number | null = null;
    private onVisualUpdate: ((states: Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>) => void) | null = null;
    private onRatioUpdate: ((ratios: Map<string, {
        ratio: string;
        velocity: number;
        channel?: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTime?: number;
        endTime?: number;
    }>) => void) | null = null;
    private ratioByScaleIndex: (string | null)[] | null = null;
    private baseNote: number = 69;
    private scaleSize: number = 0;
    private lastPlayArgs: {
        importResult: MidiImportResult;
        targetScale: string[] | null;
        baseNote: number;
        baseFreq: number;
        waveform: OscillatorType;
        onEnded: () => void;
        options?: {
            nodeIdByScaleIndex?: (string | null)[];
            ratioByScaleIndex?: (string | null)[];
            onVisualUpdate?: (states: Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>) => void;
            onRatioUpdate?: (ratios: Map<string, {
                ratio: string;
                velocity: number;
                channel?: number;
                trackIndex?: number;
                nodeId?: string;
                noteNumber?: number;
                startTick?: number;
                durationTicks?: number;
                startTime?: number;
                endTime?: number;
            }>) => void;
            onRatioStatsIncrement?: (ratio: string) => void;
            latticeNodes?: NodeData[];
            dynamicRetuning?: boolean;
            speed?: number;
            startAtSeconds?: number;
        };
    } | null = null;

    // Dynamic Tuning State
    private latticeNodes: NodeData[] = [];
    public dynamicRetuning = false;
    private scheduledNotes: ScheduledNote[] = [];
    private onRatioStatsIncrement: ((ratio: string) => void) | null = null;

    constructor() { }

    private resolveTempoMicroseconds(midi: any) {
        let bestTick = Number.POSITIVE_INFINITY;
        let microsecondsPerBeat = 500000;
        (midi?.tracks || []).forEach((track: any[]) => {
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
    }

    private buildPartIndexMap(importResult: MidiImportResult) {
        const pairs = new Map<string, { trackIndex: number; channel: number }>();
        importResult.notes.forEach((note) => {
            const trackIndex = Number.isFinite(note.trackIndex) ? note.trackIndex : 0;
            const channel = Number.isFinite(note.channel) ? note.channel : 0;
            const key = `${trackIndex}:${channel}`;
            if (!pairs.has(key)) {
                pairs.set(key, { trackIndex, channel });
            }
        });
        const ordered = Array.from(pairs.values()).sort((a, b) => {
            if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
            return a.channel - b.channel;
        });
        this.partIndexByTrackChannel = new Map(
            ordered.map((pair, index) => [`${pair.trackIndex}:${pair.channel}`, index])
        );
        this.partIndexCount = ordered.length;
    }

    private getPartIndex(trackIndex?: number, channel?: number) {
        const track = Number.isFinite(trackIndex) ? (trackIndex as number) : 0;
        const chan = Number.isFinite(channel) ? (channel as number) : 0;
        const key = `${track}:${chan}`;
        const existing = this.partIndexByTrackChannel.get(key);
        if (existing !== undefined) return existing;
        const next = this.partIndexCount;
        this.partIndexByTrackChannel.set(key, next);
        this.partIndexCount += 1;
        return next;
    }

    public play(
        importResult: MidiImportResult,
        targetScale: string[] | null,
        baseNote: number,
        baseFreq: number,
        waveform: OscillatorType,
        onEnded: () => void,
        options?: {
            nodeIdByScaleIndex?: (string | null)[];
            ratioByScaleIndex?: (string | null)[];
            onVisualUpdate?: (states: Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>) => void;
            onRatioUpdate?: (ratios: Map<string, {
                ratio: string;
                velocity: number;
                channel?: number;
                trackIndex?: number;
                nodeId?: string;
                noteNumber?: number;
                startTick?: number;
                durationTicks?: number;
                startTime?: number;
                endTime?: number;
            }>) => void;
            onRatioStatsIncrement?: (ratio: string) => void;
            latticeNodes?: NodeData[];
            dynamicRetuning?: boolean;
            speed?: number;
            startAtSeconds?: number;
        }
    ) {
        this.stop();

        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.importResult = importResult;
        this.buildPartIndexMap(importResult);
        this.waveform = waveform;
        this.onEnded = onEnded;
        this.baseNote = baseNote;
        this.baseFrequency = Number.isFinite(baseFreq) ? baseFreq : 440;
        this.scaleSize = targetScale?.length ?? 0;
        this.nodeIdByScaleIndex = options?.nodeIdByScaleIndex ?? null;
        this.ratioByScaleIndex = options?.ratioByScaleIndex ?? null;
        this.onVisualUpdate = options?.onVisualUpdate ?? null;
        this.onRatioUpdate = options?.onRatioUpdate ?? null;
        this.latticeNodes = options?.latticeNodes ?? [];
        this.dynamicRetuning = options?.dynamicRetuning ?? false;
        this.onRatioStatsIncrement = options?.onRatioStatsIncrement ?? null;
        this.playbackSpeed = clampPlaybackSpeed(options?.speed);
        this.lastPlayArgs = {
            importResult,
            targetScale,
            baseNote,
            baseFreq,
            waveform,
            onEnded,
            options
        };

        if (targetScale) {
            this.targetFreqs = buildTargetFrequencies(targetScale, baseNote, baseFreq);
            this.bypassTuning = false;
        } else if (this.dynamicRetuning) {
            this.targetFreqs = [];
            this.bypassTuning = false; // We are tuning, but dynamically
        } else {
            this.targetFreqs = [];
            this.bypassTuning = true;
        }

        // Calculate tempo
        const { ticksPerBeat, midi } = importResult;
        const microsecondsPerBeat = this.resolveTempoMicroseconds(midi);
        this.secondsPerTick = (microsecondsPerBeat / 1000000) / ticksPerBeat / this.playbackSpeed;

        const maxTick = this.getMaxTick(importResult);
        const totalDurationSeconds = maxTick * this.secondsPerTick;
        const startAtSeconds = Math.max(0, Math.min(totalDurationSeconds, options?.startAtSeconds ?? 0));
        this.startTickOffset = this.secondsPerTick > 0 ? startAtSeconds / this.secondsPerTick : 0;
        this.startOffsetSeconds = startAtSeconds;
        this.lastPlaybackSeconds = startAtSeconds;
        this.playbackNotes = this.buildPlaybackNotes(this.startTickOffset);
        this.playbackMaxTick = this.getPlaybackMaxTick(this.playbackNotes);

        this.isPlaying = true;
        this.nextNoteIndex = 0;
        this.startTime = this.ctx.currentTime + 0.1; // Start slighly in future
        this.visualQueue = [];
        this.currentVisuals = [];
        this.ratioQueue = [];
        this.currentRatios = [];
        this.scheduledNotes = [];
        this.lastVisualState = new Map();

        this.timerId = window.setInterval(() => this.scheduler(), this.lookahead);
        this.visualLoop();
    }

    public setVisualLatencyOffset(seconds: number) {
        this.visualLatencyOffset = seconds;
    }

    public getPlaybackPositionSeconds() {
        if (!this.ctx || !this.isPlaying) return this.lastPlaybackSeconds;
        const elapsed = Math.max(0, this.ctx.currentTime - this.startTime);
        const position = this.startOffsetSeconds + elapsed;
        this.lastPlaybackSeconds = position;
        return position;
    }

    public stop(options?: { silent?: boolean }) {
        if (this.ctx) {
            this.getPlaybackPositionSeconds();
        }
        this.isPlaying = false;
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }


        this.activeOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) { }
        });
        this.activeOscillators.clear();

        if (this.onVisualUpdate) {
            this.onVisualUpdate(new Map());
        }
        if (this.onRatioUpdate) {
            this.onRatioUpdate(new Map());
        }

        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }

        this.playbackNotes = [];
        this.playbackMaxTick = 0;
        this.startTickOffset = 0;
        this.startOffsetSeconds = this.lastPlaybackSeconds;

        if (!options?.silent && this.onEnded) {
            this.onEnded();
            this.onEnded = null;
        } else {
            this.onEnded = null;
        }
    }

    public seekToSeconds(seconds: number) {
        if (!Number.isFinite(seconds)) return;
        const args = this.lastPlayArgs;
        if (!args) return;
        this.stop({ silent: true });
        this.play(
            args.importResult,
            args.targetScale,
            args.baseNote,
            args.baseFreq,
            args.waveform,
            args.onEnded,
            {
                ...(args.options || {}),
                startAtSeconds: Math.max(0, seconds)
            }
        );
    }

    private getMaxTick(importResult: MidiImportResult) {
        let maxTick = Math.max(0, importResult.totalTicks || 0);
        for (const note of importResult.notes) {
            const endTick = note.startTick + note.durationTicks;
            if (endTick > maxTick) maxTick = endTick;
        }
        return maxTick;
    }

    private getPlaybackMaxTick(notes: any[]) {
        let maxTick = 0;
        for (const note of notes) {
            const endTick = note.startTick + note.durationTicks;
            if (endTick > maxTick) maxTick = endTick;
        }
        return maxTick;
    }

    private buildPlaybackNotes(startTickOffset: number) {
        if (!this.importResult) return [];
        if (startTickOffset <= 0) return [...this.importResult.notes];

        const playbackNotes: any[] = [];
        for (const note of this.importResult.notes) {
            const noteStart = note.startTick;
            const noteEnd = note.startTick + note.durationTicks;
            if (noteEnd <= startTickOffset) continue;

            const adjustedStart = Math.max(0, noteStart - startTickOffset);
            const adjustedDuration = noteEnd - Math.max(noteStart, startTickOffset);
            if (adjustedDuration <= 0) continue;

            playbackNotes.push({
                ...note,
                startTick: adjustedStart,
                durationTicks: adjustedDuration
            });
        }

        return playbackNotes;
    }

    private visualLoop() {
        if (!this.isPlaying || !this.ctx) return;

        const now = this.ctx.currentTime;

        // Track changes separately for visuals and ratios
        let visualsChanged = false;
        let ratiosChanged = false;

        // 1. Add starting notes to currentVisuals
        const remainingQueue: typeof this.visualQueue = [];
        for (const item of this.visualQueue) {
            if (item.startTime <= now) {
                this.currentVisuals.push({
                    nodeId: item.nodeId,
                    endTime: item.endTime,
                    channel: item.channel,
                    velocity: item.velocity,
                    trackIndex: item.trackIndex,
                    partIndex: item.partIndex
                });
                visualsChanged = true;
            } else {
                remainingQueue.push(item);
            }
        }
        this.visualQueue = remainingQueue;

        // 2. Remove ended notes from currentVisuals
        const activeCount = this.currentVisuals.length;
        this.currentVisuals = this.currentVisuals.filter(item => item.endTime > now);
        if (this.currentVisuals.length !== activeCount) visualsChanged = true;

        // 2b. Process ratio queue (only if callback is registered)
        if (this.onRatioUpdate) {
            const remainingRatioQueue: typeof this.ratioQueue = [];
            for (const item of this.ratioQueue) {
                if (item.startTime <= now) {
                    this.currentRatios.push({
                        noteId: item.noteId,
                        ratio: item.ratio,
                        endTime: item.endTime,
                        channel: item.channel,
                        velocity: item.velocity,
                        trackIndex: item.trackIndex,
                        nodeId: item.nodeId,
                        noteNumber: item.noteNumber,
                        startTick: item.startTick,
                        durationTicks: item.durationTicks,
                        startTimeSeconds: item.startTimeSeconds,
                        endTimeSeconds: item.endTimeSeconds
                    });

                    if (this.dynamicRetuning && this.onRatioStatsIncrement) {
                        try {
                            this.onRatioStatsIncrement(item.ratio);
                        } catch (e) {
                            log.warn('onRatioStatsIncrement error', e);
                        }
                    }

                    ratiosChanged = true;
                } else {
                    remainingRatioQueue.push(item);
                }
            }
            this.ratioQueue = remainingRatioQueue;

            // 2c. Remove ended ratios
            const ratioCount = this.currentRatios.length;
            this.currentRatios = this.currentRatios.filter(item => item.endTime > now);
            if (this.currentRatios.length !== ratioCount) ratiosChanged = true;
        }

        // 3. Dispatch visual update only if visuals changed
        if (visualsChanged && this.onVisualUpdate) {
            const state = new Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>();

            for (const item of this.currentVisuals) {
                const existing = state.get(item.nodeId);
                if (existing) {
                    if (!existing.channels.includes(item.channel)) existing.channels.push(item.channel);
                    if (item.trackIndex !== undefined) {
                        if (!existing.tracks) existing.tracks = [];
                        if (!existing.tracks.includes(item.trackIndex)) existing.tracks.push(item.trackIndex);
                    }
                    if (item.partIndex !== undefined) {
                        if (!existing.parts) existing.parts = [];
                        if (!existing.parts.includes(item.partIndex)) existing.parts.push(item.partIndex);
                    }
                    existing.velocity = Math.max(existing.velocity, item.velocity);
                } else {
                    const tracks = item.trackIndex !== undefined ? [item.trackIndex] : undefined;
                    const parts = item.partIndex !== undefined ? [item.partIndex] : undefined;
                    state.set(item.nodeId, { channels: [item.channel], velocity: item.velocity, tracks, parts });
                }
            }

            this.onVisualUpdate(state);
        }

        // 4. Dispatch ratio update only if ratios changed (throttled)
        if (ratiosChanged && this.onRatioUpdate) {
            const ratioState = new Map<string, {
                ratio: string;
                velocity: number;
                channel?: number;
                trackIndex?: number;
                nodeId?: string;
                noteNumber?: number;
                startTick?: number;
                durationTicks?: number;
                startTime?: number;
                endTime?: number;
            }>();
            for (const item of this.currentRatios) {
                const existing = ratioState.get(item.noteId);
                if (!existing || item.velocity > existing.velocity) {
                    ratioState.set(item.noteId, {
                        ratio: item.ratio,
                        velocity: item.velocity,
                        channel: item.channel,
                        trackIndex: item.trackIndex,
                        nodeId: item.nodeId,
                        noteNumber: item.noteNumber,
                        startTick: item.startTick,
                        durationTicks: item.durationTicks,
                        startTime: item.startTimeSeconds,
                        endTime: item.endTimeSeconds
                    });
                }
            }
            this.onRatioUpdate(ratioState);
        }

        this.animationFrameId = requestAnimationFrame(() => this.visualLoop());
    }

    private scheduler() {
        if (!this.ctx || !this.importResult) return;

        // Clean up old scheduled notes
        const now = this.ctx.currentTime;
        this.scheduledNotes = this.scheduledNotes.filter(n => n.endTime > now);

        // Schedule notes until the scheduleAheadTime
        while (this.nextNoteIndex < this.playbackNotes.length) {
            const note = this.playbackNotes[this.nextNoteIndex];
            const startTime = this.startTime + (note.startTick * this.secondsPerTick);

            if (startTime > now + this.scheduleAheadTime) {
                break;
            }

            // Dynamic Retuning Logic
            if (this.dynamicRetuning && this.latticeNodes.length > 0) {
                // Find concurrent notes (chord)
                const batch: any[] = [note];
                let lookAheadIndex = this.nextNoteIndex + 1;

                while (lookAheadIndex < this.playbackNotes.length) {
                    const nextNote = this.playbackNotes[lookAheadIndex];
                    const nextTime = this.startTime + (nextNote.startTick * this.secondsPerTick);

                    // Concurrency window: 30ms for chord detection
                    if (nextTime - startTime > 0.03) break;

                    // Prevent scheduling too far ahead even if concurrent? 
                    // No, if it's a chord, schedule it together.
                    // But bounded by some reasonable limit (e.g. don't schedule 5 seconds ahead)
                    if (nextTime > now + this.scheduleAheadTime + 0.1) break;

                    batch.push(nextNote);
                    lookAheadIndex++;
                }

                // Solve tuning for batch + context
                const contextNotes = this.scheduledNotes.filter(n => n.endTime > startTime && n.startTime <= startTime);

                const batchMidi = batch.map(n => n.noteNumber);
                const activeMidi = contextNotes.map(n => n.noteNumber);
                const allMidi = [...activeMidi, ...batchMidi];

                const baseFreq = Number.isFinite(this.baseFrequency) ? this.baseFrequency : 440;
                const targetCents = [...contextNotes, ...batch].map((n) => {
                    const freq = n.frequencyHz;
                    if (Number.isFinite(freq) && freq > 0 && baseFreq > 0) {
                        return 1200 * Math.log2(freq / baseFreq);
                    }
                    return (n.noteNumber - this.baseNote) * 100;
                });

                const fixedAssignments = new Map<number, string>();
                contextNotes.forEach((n, i) => fixedAssignments.set(i, n.nodeId));

                const result = findBestTuningForChord(allMidi, this.latticeNodes, this.baseNote, 45, fixedAssignments, { targetCents });

                // Schedule batch with assigned nodes
                batch.forEach((n, i) => {
                    const assignedId = result.nodeIds[activeMidi.length + i];
                    const assignedShift = result.octaveShifts[activeMidi.length + i];
                    const nTime = this.startTime + (n.startTick * this.secondsPerTick);
                    this.scheduleNote(n, nTime, assignedId, assignedShift);
                });

                this.nextNoteIndex += batch.length;

            } else {
                // Standard scheduling
                this.scheduleNote(note, startTime);
                this.nextNoteIndex++;
            }
        }

        // Check if finished
        if (this.nextNoteIndex >= this.playbackNotes.length) {
            if (this.playbackNotes.length === 0) {
                if (this.ctx.currentTime > this.startTime + 0.5) {
                    this.stop();
                }
                return;
            }
            // Find end time of last note
            const lastNote = this.playbackNotes[this.playbackNotes.length - 1];
            const endTime = this.startTime + ((lastNote.startTick + lastNote.durationTicks) * this.secondsPerTick);

            if (this.ctx.currentTime > endTime + 1.0) {
                this.stop();
            }
        }
    }

    private scheduleNote(note: any, time: number, fixedNodeId: string | null = null, fixedOctaveShift: number | null = null) {
        if (!this.ctx) return;

        const duration = Math.max(0.01, note.durationTicks * this.secondsPerTick);
        const origFreq = note.frequencyHz || midiNoteToFrequency(note.noteNumber);

        // Retune
        let retunedFreq = origFreq;
        if (!Number.isFinite(retunedFreq)) retunedFreq = 440;

        let activeNodeId: string | null = null;
        let activeRatio: string | null = null;

        if (fixedNodeId && this.latticeNodes.length > 0) {
            // Dynamic Tuning Assignment
            const node = this.latticeNodes.find(n => n.id === fixedNodeId);
            if (node) {
                // Check base frequency validity
                let baseFreq = Number.isFinite(this.baseFrequency) ? this.baseFrequency : 440;
                const octaveShift = Number.isFinite(fixedOctaveShift) ? (fixedOctaveShift as number) : 0;
                retunedFreq = baseFreq * Math.pow(2, (node.cents + octaveShift * 1200) / 1200);
                activeNodeId = node.id;
                // Ratio?
                if (node.ratio) {
                    activeRatio = `${node.ratio.n}/${node.ratio.d}`;
                }
            }
        } else if (!this.bypassTuning) {
            const nearest = findNearestTargetIndex(this.targetFreqs, origFreq);
            // Verify nearest result
            if (nearest && Number.isFinite(nearest.frequency)) {
                retunedFreq = nearest.frequency;
                if (this.scaleSize > 0) {
                    const scaleIndex = ((nearest.noteIndex - this.baseNote) % this.scaleSize + this.scaleSize) % this.scaleSize;
                    if (this.nodeIdByScaleIndex) {
                        activeNodeId = this.nodeIdByScaleIndex[scaleIndex] ?? null;
                    }
                    if (this.ratioByScaleIndex) {
                        activeRatio = this.ratioByScaleIndex[scaleIndex] ?? null;
                    }
                }
            }
        }

        // Final safety check
        if (!Number.isFinite(retunedFreq) || retunedFreq <= 0) {
            log.warn('Invalid frequency, falling back to 440', {
                frequency: retunedFreq,
                noteNumber: note.noteNumber
            });
            retunedFreq = 440;
        }

        // Oscillator
        const osc = this.ctx.createOscillator();
        osc.type = this.waveform;
        osc.frequency.value = retunedFreq;

        // Gain
        const gain = this.ctx.createGain();
        const velocity = (note.velocity ?? 100) / 127;
        const maxGain = this.noteGain * velocity;

        const attackTime = 0.01;
        const releaseTime = Math.min(0.15, duration * 0.3);
        const sustainEnd = time + duration - releaseTime;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(maxGain, time + attackTime);
        gain.gain.setValueAtTime(maxGain, Math.max(time + attackTime, sustainEnd));
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Panning
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = ((note.channel % 16) - 7.5) / 15;

        osc.connect(gain).connect(pan).connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + duration + 0.1);

        if (activeNodeId) {
            const partIndex = this.getPartIndex(note.trackIndex, note.channel);
            // Track for dynamic tuning context
            this.scheduledNotes.push({
                noteNumber: note.noteNumber,
                startTime: time,
                endTime: time + duration,
                nodeId: activeNodeId
            });

            // Add to visual queue
            this.visualQueue.push({
                nodeId: activeNodeId,
                startTime: time + this.visualLatencyOffset,
                endTime: time + duration + this.visualLatencyOffset,
                channel: note.channel,
                velocity: velocity,
                trackIndex: note.trackIndex,
                partIndex
            });
        }

        if (activeRatio) {
            // Add to ratio queue for scrolling display
            const noteId = note.id ?? `${note.noteNumber}-${note.startTick}-${note.channel}`;
            const startTickAbsolute = note.startTick + this.startTickOffset;
            const startTimeSeconds = this.startOffsetSeconds + (note.startTick * this.secondsPerTick);
            const endTimeSeconds = startTimeSeconds + duration;
            this.ratioQueue.push({
                noteId,
                ratio: activeRatio,
                startTime: time + this.visualLatencyOffset,
                endTime: time + duration + this.visualLatencyOffset,
                channel: note.channel,
                velocity: velocity,
                trackIndex: note.trackIndex,
                nodeId: activeNodeId ?? undefined,
                noteNumber: note.noteNumber,
                startTick: startTickAbsolute,
                durationTicks: note.durationTicks,
                startTimeSeconds,
                endTimeSeconds
            });
        }

        this.activeOscillators.add(osc);
        osc.onended = () => {
            this.activeOscillators.delete(osc);
        };
    }
}
