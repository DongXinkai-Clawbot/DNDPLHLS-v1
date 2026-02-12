import { parseMidi, writeMidi } from 'midi-file';
import { parseGeneralRatio } from '../musicLogic';
import { buildMtsBulkDump } from './temperamentSolver/mts';

const A4_NOTE = 69;
const A4_FREQ = 440;
const DEFAULT_PITCH_BEND_RANGE = 2;
const DEFAULT_MICROSECONDS_PER_BEAT = 500000;
const MAX_MIDI_NOTE = 127;

export interface MidiEventRef {
    trackIndex: number;
    eventIndex: number;
}

export interface MidiNoteInfo {
    id: string;
    trackIndex: number;
    channel: number;
    noteNumber: number;
    velocity: number;
    startTick: number;
    durationTicks: number;
    frequencyHz: number;
    noteOn: MidiEventRef;
    noteOff: MidiEventRef | null;
}

export interface DetectedTuning {
    type: 'mts-bulk' | 'mts-single' | 'default';
    description: string;
    baseNote: number;
    baseFrequency: number;
    noteFrequencies: number[];
    usesPitchBend: boolean;
    pitchBendRangeByChannel: number[];
}

export interface MidiImportResult {
    midi: any;
    notes: MidiNoteInfo[];
    tuning: DetectedTuning;
    ticksPerBeat: number;
    trackCount: number;
    totalTicks: number;
    fileName?: string;
}

export interface RetuneSummary {
    notesRetuned: number;
    averageCents: number;
    maxCents: number;
}

export interface RetuneResult {
    bytes: Uint8Array;
    summary: RetuneSummary;
    targetNoteFrequencies: number[];
}

const clampNote = (note: number) => Math.max(0, Math.min(MAX_MIDI_NOTE, Math.floor(note)));
const clampTempoScale = (value?: number) => {
    if (!Number.isFinite(value)) return 1;
    const v = value as number;
    if (v <= 0) return 1;
    return Math.min(4, Math.max(0.25, v));
};

const normalizeSysExData = (data?: number[] | Uint8Array) => {
    if (!data) return [];
    let bytes = Array.from(data);
    if (bytes[0] === 0xF0) bytes = bytes.slice(1);
    if (bytes[bytes.length - 1] === 0xF7) bytes = bytes.slice(0, -1);
    return bytes;
};

const decodeFreqWord = (xx: number, yy: number, zz: number) => {
    const semitone = xx & 0x7f;
    const frac14 = ((yy & 0x7f) << 7) | (zz & 0x7f);
    const midiFloat = semitone + frac14 / 16384;
    return A4_FREQ * Math.pow(2, (midiFloat - A4_NOTE) / 12);
};

const defaultNoteFrequencies = () => {
    const freqs: number[] = [];
    for (let midi = 0; midi <= MAX_MIDI_NOTE; midi++) {
        freqs[midi] = A4_FREQ * Math.pow(2, (midi - A4_NOTE) / 12);
    }
    return freqs;
};

const parseMtsBulkDump = (data: number[]) => {
    if (data.length < 5 + 16 + 128 * 3) return null;
    if (data[0] !== 0x7e && data[0] !== 0x7f) return null;
    if (data[2] !== 0x08 || data[3] !== 0x01) return null;

    const nameBytes = data.slice(5, 21);
    const name = String.fromCharCode(...nameBytes).trim();
    const tuningData = data.slice(21, 21 + 128 * 3);
    if (tuningData.length < 128 * 3) return null;
    const freqs: number[] = [];
    for (let i = 0; i <= MAX_MIDI_NOTE; i++) {
        const idx = i * 3;
        freqs[i] = decodeFreqWord(tuningData[idx], tuningData[idx + 1], tuningData[idx + 2]);
    }
    return { name, freqs };
};

const parseMtsSingleNote = (data: number[]) => {
    if (data.length < 10) return null;
    if (data[0] !== 0x7e && data[0] !== 0x7f) return null;
    if (data[2] !== 0x08 || data[3] !== 0x02) return null;
    if (data[5] !== 0x01) return null;
    const noteNumber = data[6];
    if (noteNumber < 0 || noteNumber > MAX_MIDI_NOTE) return null;
    const freq = decodeFreqWord(data[7], data[8], data[9]);
    return { noteNumber, freq };
};

const detectMtsTuning = (tracks: any[]) => {
    let bulk: { name: string; freqs: number[] } | null = null;
    const singleUpdates = new Map<number, number>();

    tracks.forEach((track) => {
        track.forEach((event: any) => {
            if (event.type !== 'sysEx' && event.type !== 'dividedSysEx') return;
            const data = normalizeSysExData(event.data);
            if (!data.length) return;
            if (!bulk) {
                const bulkResult = parseMtsBulkDump(data);
                if (bulkResult) {
                    bulk = bulkResult;
                    return;
                }
            }
            const singleResult = parseMtsSingleNote(data);
            if (singleResult) {
                singleUpdates.set(singleResult.noteNumber, singleResult.freq);
            }
        });
    });

    if (bulk) {
        return {
            type: 'mts-bulk' as const,
            description: bulk.name ? `MTS Bulk Dump (${bulk.name})` : 'MTS Bulk Dump',
            noteFrequencies: bulk.freqs
        };
    }

    if (singleUpdates.size > 0) {
        const freqs = defaultNoteFrequencies();
        singleUpdates.forEach((freq, noteNumber) => {
            freqs[noteNumber] = freq;
        });
        return {
            type: 'mts-single' as const,
            description: `MTS Single Note Tuning (${singleUpdates.size})`,
            noteFrequencies: freqs
        };
    }

    return {
        type: 'default' as const,
        description: 'Default 12-TET (A4=440)',
        noteFrequencies: defaultNoteFrequencies()
    };
};

const normalizePitchBendValue = (value: number) => {
    if (value >= -8192 && value <= 8191) return value / 8192;
    if (value >= 0 && value <= 16383) return (value - 8192) / 8192;
    return 0;
};

const computePitchBendForTarget = (standardFreq: number, targetFreq: number) => {
    const maxBendCents = DEFAULT_PITCH_BEND_RANGE * 100;
    if (!(standardFreq > 0) || !(targetFreq > 0)) {
        return {
            bendValue: 8192,
            appliedCents: 0,
            actualFrequency: standardFreq
        };
    }
    const desiredCents = 1200 * Math.log2(targetFreq / standardFreq);
    const clampedCents = Math.max(-maxBendCents, Math.min(maxBendCents, desiredCents));
    let bendValue = Math.round(8192 + (clampedCents / maxBendCents) * 8192);
    bendValue = Math.max(0, Math.min(16383, bendValue));
    const appliedCents = ((bendValue - 8192) / 8192) * maxBendCents;
    const actualFrequency = standardFreq * Math.pow(2, appliedCents / 1200);
    return { bendValue, appliedCents, actualFrequency };
};

const ratioToFloat = (ratio: string) => {
    try {
        const frac = parseGeneralRatio(ratio);
        const value = Number(frac.n) / Number(frac.d);
        if (!Number.isFinite(value) || value <= 0) return 1;
        return value;
    } catch {
        return 1;
    }
};

const normalizeScaleRatios = (ratios: string[]) => {
    if (!ratios.length) return [];
    const base = ratioToFloat(ratios[0]) || 1;
    return ratios.map((ratio) => {
        let value = ratioToFloat(ratio) / base;
        if (!Number.isFinite(value) || value <= 0) value = 1;

        // Epsilon to prevent floating point jitter near 1.0 forcing an octave jump
        if (Math.abs(value - 1) < 1e-6) value = 1;

        while (value >= 2) value /= 2;
        while (value < 1) value *= 2;
        return value;
    });
};

const parseScaleRatios = (ratios: string[]) => {
    if (!ratios.length) return [1];
    return ratios.map((ratio) => ratioToFloat(ratio));
};

const buildTargetNoteFrequencies = (ratios: string[], baseNote: number, baseFrequency: number) => {
    const scaleRatios = parseScaleRatios(ratios);
    if (!scaleRatios.length) return defaultNoteFrequencies();
    const scaleSize = scaleRatios.length;
    const freqs: number[] = [];
    const safeBaseFreq = baseFrequency > 0 ? baseFrequency : A4_FREQ;
    const rootNote = clampNote(baseNote);
    for (let midi = 0; midi <= MAX_MIDI_NOTE; midi++) {
        const stepsFromBase = midi - rootNote;
        const degree = ((stepsFromBase % scaleSize) + scaleSize) % scaleSize;
        const octaves = Math.floor((stepsFromBase - degree) / scaleSize);
        freqs[midi] = safeBaseFreq * scaleRatios[degree] * Math.pow(2, octaves);
    }
    return freqs;
};

const centsDistance = (aFreq: number, bFreq: number) => {
    if (!(aFreq > 0) || !(bFreq > 0)) return 0;
    return Math.abs(1200 * Math.log2(aFreq / bFreq));
};

const findNearestNoteNumber = (targetFreqs: number[], sourceFreq: number) => {
    let bestNote = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let note = 0; note <= MAX_MIDI_NOTE; note++) {
        const diff = centsDistance(targetFreqs[note], sourceFreq);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestNote = note;
        }
    }
    return { noteNumber: bestNote, diffCents: bestDiff };
};

const isMtsSysExEvent = (event: any) => {
    if (!event || (event.type !== 'sysEx' && event.type !== 'dividedSysEx')) return false;
    const data = normalizeSysExData(event.data);
    if (data.length < 4) return false;
    if (data[0] !== 0x7e && data[0] !== 0x7f) return false;
    return data[2] === 0x08;
};

const stripMtsSysEx = (track: any[]) => {
    const next: any[] = [];
    let carryDelta = 0;
    track.forEach((event) => {
        if (isMtsSysExEvent(event)) {
            carryDelta += event.deltaTime || 0;
            return;
        }
        const deltaTime = (event.deltaTime || 0) + carryDelta;
        carryDelta = 0;
        next.push({ ...event, deltaTime });
    });
    return next;
};

const stripRetuneConflicts = (track: any[]) => {
    const next: any[] = [];
    let carryDelta = 0;
    track.forEach((event) => {
        if (isMtsSysExEvent(event) || event?.type === 'pitchBend') {
            carryDelta += event.deltaTime || 0;
            return;
        }
        const deltaTime = (event.deltaTime || 0) + carryDelta;
        carryDelta = 0;
        next.push({ ...event, deltaTime });
    });
    return next;
};

const cloneMidiData = (midi: any) => JSON.parse(JSON.stringify(midi));
const applyTempoScale = (midi: any, speed: number) => {
    if (!midi?.tracks) return;
    let foundTempo = false;
    midi.tracks = midi.tracks.map((track: any[]) => track.map((event: any) => {
        if (event?.type === 'setTempo' && Number.isFinite(event.microsecondsPerBeat)) {
            foundTempo = true;
            const scaled = Math.max(1, Math.round(event.microsecondsPerBeat / speed));
            return { ...event, microsecondsPerBeat: scaled };
        }
        return event;
    }));

    if (!foundTempo) {
        const tempoEvent = {
            deltaTime: 0,
            type: 'setTempo',
            microsecondsPerBeat: Math.max(1, Math.round(DEFAULT_MICROSECONDS_PER_BEAT / speed))
        };
        if (!midi.tracks.length) {
            midi.tracks = [[tempoEvent]];
        } else {
            midi.tracks[0] = [tempoEvent, ...midi.tracks[0]];
        }
    }
};

export const parseMidiForRetune = (bytes: Uint8Array, fileName?: string): MidiImportResult => {
    const midi = parseMidi(bytes);
    const tracks = midi.tracks || [];
    const detected = detectMtsTuning(tracks);

    const baseNote = A4_NOTE;
    const baseFrequency = detected.noteFrequencies[baseNote] || A4_FREQ;

    const pitchBendRangeByChannel = new Array(16).fill(DEFAULT_PITCH_BEND_RANGE);
    const pitchBendValueByChannel = new Array(16).fill(0);
    const rpnMsbByChannel = new Array(16).fill(127);
    const rpnLsbByChannel = new Array(16).fill(127);
    const dataEntryMsbByChannel = new Array(16).fill(DEFAULT_PITCH_BEND_RANGE);
    const dataEntryLsbByChannel = new Array(16).fill(0);
    let usesPitchBend = false;

    type TrackEventRef = { event: any; trackIndex: number; eventIndex: number; absTick: number };
    const events: TrackEventRef[] = [];
    tracks.forEach((track: any[], trackIndex: number) => {
        let absTick = 0;
        track.forEach((event: any, eventIndex: number) => {
            absTick += event.deltaTime || 0;
            events.push({ event, trackIndex, eventIndex, absTick });
        });
    });

    events.sort((a, b) => a.absTick - b.absTick || a.trackIndex - b.trackIndex || a.eventIndex - b.eventIndex);

    const activeNotes = new Map<string, MidiNoteInfo[]>();
    const notes: MidiNoteInfo[] = [];
    let totalTicks = 0;

    const getNoteFrequency = (noteNumber: number, channel: number) => {
        const baseFreq = detected.noteFrequencies[noteNumber] || (A4_FREQ * Math.pow(2, (noteNumber - A4_NOTE) / 12));
        const bend = pitchBendValueByChannel[channel] || 0;
        const bendRange = pitchBendRangeByChannel[channel] || DEFAULT_PITCH_BEND_RANGE;
        const bendCents = bend * bendRange * 100;
        return baseFreq * Math.pow(2, bendCents / 1200);
    };

    events.forEach(({ event, trackIndex, eventIndex, absTick }) => {
        totalTicks = Math.max(totalTicks, absTick);
        const channel = typeof event.channel === 'number' ? event.channel : 0;

        if (event.type === 'controller') {
            const controller = event.controllerType;
            if (controller === 101) rpnMsbByChannel[channel] = event.value;
            if (controller === 100) rpnLsbByChannel[channel] = event.value;
            if (controller === 6) dataEntryMsbByChannel[channel] = event.value;
            if (controller === 38) dataEntryLsbByChannel[channel] = event.value;

            if (rpnMsbByChannel[channel] === 0 && rpnLsbByChannel[channel] === 0) {
                const semis = dataEntryMsbByChannel[channel];
                const cents = dataEntryLsbByChannel[channel];
                if (Number.isFinite(semis) && Number.isFinite(cents)) {
                    pitchBendRangeByChannel[channel] = semis + cents / 100;
                }
            }
            return;
        }

        if (event.type === 'pitchBend') {
            usesPitchBend = true;
            pitchBendValueByChannel[channel] = normalizePitchBendValue(event.value || 0);
            return;
        }

        if (event.type === 'noteOn' && event.velocity > 0) {
            const key = `${channel}:${event.noteNumber}`;
            const list = activeNotes.get(key) || [];
            const frequencyHz = getNoteFrequency(event.noteNumber, channel);
            const note: MidiNoteInfo = {
                id: `note-${notes.length + 1}`,
                trackIndex,
                channel,
                noteNumber: event.noteNumber,
                velocity: event.velocity,
                startTick: absTick,
                durationTicks: 0,
                frequencyHz,
                noteOn: { trackIndex, eventIndex },
                noteOff: null
            };
            list.push(note);
            activeNotes.set(key, list);
            notes.push(note);
            return;
        }

        const isNoteOff = event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0);
        if (isNoteOff) {
            const key = `${channel}:${event.noteNumber}`;
            const list = activeNotes.get(key);
            if (list && list.length) {
                const note = list.shift()!;
                note.durationTicks = Math.max(0, absTick - note.startTick);
                note.noteOff = { trackIndex, eventIndex };
            }
        }
    });

    return {
        midi,
        notes,
        tuning: {
            ...detected,
            baseNote,
            baseFrequency,
            usesPitchBend,
            pitchBendRangeByChannel
        },
        ticksPerBeat: midi.header?.ticksPerBeat || midi.header?.timeDivision || 480,
        trackCount: tracks.length,
        totalTicks,
        fileName
    };
};

export const generateEdoScale = (divisions: number) => {
    const steps = Math.max(1, Math.min(96, Math.floor(divisions)));
    const ratios: string[] = [];
    for (let i = 0; i < steps; i++) {
        const value = Math.pow(2, i / steps);
        ratios.push(i === 0 ? '1/1' : value.toFixed(8));
    }
    return ratios;
};

export const retuneMidiToScale = (
    importResult: MidiImportResult,
    targetScale: string[],
    options: { tuningName?: string; includeMts?: boolean; baseNote?: number; baseFrequency?: number; tempoScale?: number } = {}
): RetuneResult => {
    const sourceScale = targetScale.length ? targetScale : ['1/1'];
    const scale = sourceScale.map((ratio) => {
        const trimmed = ratio ? ratio.trim() : '';
        return trimmed ? trimmed : '1/1';
    });
    if (!scale.length) {
        return { bytes: new Uint8Array(), summary: { notesRetuned: 0, averageCents: 0, maxCents: 0 }, targetNoteFrequencies: [] };
    }

    const baseNote = clampNote(options.baseNote ?? importResult.tuning.baseNote ?? A4_NOTE);
    const baseFrequency = options.baseFrequency ?? importResult.tuning.baseFrequency ?? A4_FREQ;
    const includeMts = options.includeMts !== false;
    const tempoScale = clampTempoScale(options.tempoScale);

    const targetFreqs = buildTargetNoteFrequencies(scale, baseNote, baseFrequency);
    const midiCopy = cloneMidiData(importResult.midi);

    let totalDiff = 0;
    let maxDiff = 0;
    let count = 0;

    // Group new bend events by track index
    const newBendEventsByTrack = new Map<number, { absTick: number; channel: number; value: number }[]>();

    // Sort notes by start time to handle polyphony allocation
    const sortedNotes = [...importResult.notes].sort((a, b) => a.startTick - b.startTick);

    // Track busy state of each of the 16 MIDI channels
    // We map Channel Index -> Tick until which it is busy
    const channelBusyUntil = new Array(16).fill(0);

    sortedNotes.forEach((note) => {
        if (!note.noteOn) return;
        const mapped = findNearestNoteNumber(targetFreqs, note.frequencyHz);

        // --- POLYPHONIC CHANNEL ALLOCATION ---
        // We want to find a channel that is free at note.startTick.
        // Preference: Keep original channel if free.
        // If busy, look for any free channel.
        // If all busy, steal the one that becomes free soonest (or just original to avoid chaos).

        const origCh = note.channel;
        let allocatedChannel = origCh;

        if (channelBusyUntil[origCh] > note.startTick) {
            // Collision! Find a free channel
            let bestCh = -1;
            for (let ch = 0; ch < 16; ch++) {
                if (channelBusyUntil[ch] <= note.startTick) {
                    bestCh = ch;
                    break;
                }
            }
            if (bestCh !== -1) {
                allocatedChannel = bestCh;
            } else {
                // All busy. We prioritize original channel or just 0? 
                // Let's stick to original to minimize damage in extreme congestion.
                // But this means Pitch Bend will conflict. 
                // Simple Round Robin might be better if we assume single timbre.
                // Let's sweep:
                const fallBackCh = (origCh + 1) % 16;
                // Simple heuristic: just find min busy time?
                // No, stick to original if everything is full, it's a fallback.
                allocatedChannel = origCh;
            }
        }

        // Mark channel as busy
        const duration = note.durationTicks || 0;
        channelBusyUntil[allocatedChannel] = note.startTick + duration;

        // Apply new channel to reference events in midiCopy
        const onTrack = midiCopy.tracks?.[note.noteOn.trackIndex];
        const onEvent = onTrack?.[note.noteOn.eventIndex];
        if (onEvent) {
            onEvent.noteNumber = mapped.noteNumber;
            onEvent.channel = allocatedChannel;
        }

        if (note.noteOff) {
            const offTrack = midiCopy.tracks?.[note.noteOff.trackIndex];
            const offEvent = offTrack?.[note.noteOff.eventIndex];
            if (offEvent) {
                offEvent.noteNumber = mapped.noteNumber;
                offEvent.channel = allocatedChannel;
            }
        }

        // Calculate Pitch Bend (Signed)
        const standardFreq = 440 * Math.pow(2, (mapped.noteNumber - 69) / 12);
        const bendInfo = computePitchBendForTarget(standardFreq, targetFreqs[mapped.noteNumber]);
        const actualDiff = centsDistance(bendInfo.actualFrequency, note.frequencyHz);
        totalDiff += actualDiff;
        maxDiff = Math.max(maxDiff, actualDiff);
        count += 1;

        // Create new bend event
        if (!newBendEventsByTrack.has(note.noteOn.trackIndex)) {
            newBendEventsByTrack.set(note.noteOn.trackIndex, []);
        }
        newBendEventsByTrack.get(note.noteOn.trackIndex)!.push({
            absTick: note.startTick,
            channel: allocatedChannel,
            value: bendInfo.bendValue
        });
    });

    // Rebuild tracks to insert Pitch Bends
    if (midiCopy.tracks) {
        midiCopy.tracks = midiCopy.tracks.map((track, tIdx) => {
            const trackBends = newBendEventsByTrack.get(tIdx) || [];

            // If no new bends, just strip old tuning/conflicting events
            if (trackBends.length === 0) {
                return stripRetuneConflicts(track);
            }

            // 1. Flatten track to absolute time events
            let absTick = 0;
            const absEvents: any[] = [];
            track.forEach((event: any) => {
                absTick += (event.deltaTime || 0);

                // Filter out existing conflicts (old bends/MTS)
                if (isMtsSysExEvent(event) || event.type === 'pitchBend') {
                    return;
                }

                absEvents.push({ ...event, original: true, absTick });
            });

            // 2. Insert new bends
            trackBends.forEach((b) => {
                absEvents.push({
                    deltaTime: 0,
                    type: 'pitchBend',
                    channel: b.channel,
                    value: b.value,
                    absTick: b.absTick,
                    original: false
                });
            });

            // 3. Sort by time
            // If times are equal, prefer Pitch Bend BEFORE Note On (priority)
            // Note On usually has original order. Pitch Bend is new. 
            // We want PB to apply to the note starting at that tick.
            absEvents.sort((a, b) => {
                if (a.absTick !== b.absTick) return a.absTick - b.absTick;
                // Priority: Pitch Bend < Note On
                const typePriority = (type: string) => (type === 'pitchBend' ? 0 : 1);
                return typePriority(a.type) - typePriority(b.type);
            });

            // 4. Convert back to delta time
            let lastTick = 0;
            return absEvents.map((e) => {
                const delta = e.absTick - lastTick;
                lastTick = e.absTick;
                const { absTick, original, ...eventData } = e;
                return { ...eventData, deltaTime: delta };
            });
        });
    }

    if (includeMts) {
        const scaleRatios = parseScaleRatios(scale);
        const centsByDegree = scaleRatios.map((value) => 1200 * Math.log2(value));
        const tuningName = options.tuningName || 'Retuned Scale';
        const syx = buildMtsBulkDump(
            {
                scaleSize: scale.length,
                baseMidiNote: baseNote,
                baseFrequencyHz: baseFrequency,
                cycleCents: 1200
            },
            centsByDegree,
            tuningName,
            0x7f,
            0x00
        );
        const syxBytes = Array.from(syx);
        const sysExEvent = {
            deltaTime: 0,
            type: 'sysEx',
            data: normalizeSysExData(syxBytes)
        };
        if (!midiCopy.tracks || !midiCopy.tracks.length) {
            midiCopy.tracks = [[sysExEvent]];
        } else {
            midiCopy.tracks[0] = [sysExEvent, ...midiCopy.tracks[0]];
        }
    }

    if (tempoScale !== 1) {
        applyTempoScale(midiCopy, tempoScale);
    }

    const bytes = Uint8Array.from(writeMidi(midiCopy));
    return {
        bytes,
        summary: {
            notesRetuned: count,
            averageCents: count ? totalDiff / count : 0,
            maxCents: maxDiff
        },
        targetNoteFrequencies: targetFreqs
    };
};
