import type { MidiImportResult } from './midiFileRetune';
import { parseGeneralRatio } from '../musicLogic';

export type RenderProgress = {
    status: 'preparing' | 'rendering' | 'encoding' | 'done' | 'error';
    percent: number;
    message: string;
};

export type RenderOptions = {
    sampleRate?: number;
    waveform?: OscillatorType;
    noteGain?: number;
    baseNote?: number;
    baseFrequency?: number;
    speed?: number;
    onProgress?: (progress: RenderProgress) => void;
};

const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_WAVEFORM: OscillatorType = 'triangle';
const DEFAULT_NOTE_GAIN = 0.15;

const A4_NOTE = 69;
const A4_FREQ = 440;
const DEFAULT_SPEED = 1;

const clampSpeed = (value?: number) => {
    if (!Number.isFinite(value)) return DEFAULT_SPEED;
    const v = value as number;
    if (v <= 0) return DEFAULT_SPEED;
    return Math.min(4, Math.max(0.25, v));
};

export const midiNoteToFrequency = (noteNumber: number): number => {
    return A4_FREQ * Math.pow(2, (noteNumber - A4_NOTE) / 12);
};

export const buildTargetFrequencies = (scale: string[], baseNote: number, baseFreq: number): number[] => {
    const floats: number[] = [];
    for (const r of scale) {
        try {
            const frac = parseGeneralRatio(r);
            floats.push(Number(frac.n) / Number(frac.d));
        } catch {
            floats.push(1);
        }
    }
    if (floats.length === 0) floats.push(1);

    const freqs: number[] = [];
    for (let n = 0; n <= 127; n++) {
        const octaveShift = Math.floor((n - baseNote) / floats.length);
        const idx = ((n - baseNote) % floats.length + floats.length) % floats.length;
        const freq = baseFreq * floats[idx] * Math.pow(2, octaveShift);
        freqs.push(freq);
    }
    return freqs;
};

export const findNearestFrequency = (targetFreqs: number[], sourceFreq: number): number => {
    return findNearestTargetIndex(targetFreqs, sourceFreq).frequency;
};

export const findNearestTargetIndex = (targetFreqs: number[], sourceFreq: number) => {
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < targetFreqs.length; i++) {
        const tf = targetFreqs[i];
        const dist = Math.abs(1200 * Math.log2(tf / sourceFreq));
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }
    return { noteIndex: bestIndex, frequency: targetFreqs[bestIndex], diffCents: bestDist };
};

export const renderMidiToAudio = async (
    importResult: MidiImportResult,
    targetScale: string[],
    options: RenderOptions = {}
): Promise<Blob> => {
    const {
        sampleRate = DEFAULT_SAMPLE_RATE,
        waveform = DEFAULT_WAVEFORM,
        noteGain = DEFAULT_NOTE_GAIN,
        onProgress
    } = options;

    const report = (status: RenderProgress['status'], percent: number, message: string) => {
        onProgress?.({ status, percent, message });
    };
    const speed = clampSpeed(options.speed);

    report('preparing', 0, 'Preparing audio render...');

    const { notes, ticksPerBeat, midi } = importResult;
    if (!notes || notes.length === 0) {
        throw new Error('No notes to render.');
    }

    // Calculate tempo (default 120 BPM if not specified)
    let microsecondsPerBeat = 500000; // 120 BPM default
    for (const track of midi.tracks || []) {
        for (const ev of track) {
            if (ev.type === 'setTempo' && ev.microsecondsPerBeat) {
                microsecondsPerBeat = ev.microsecondsPerBeat;
                break;
            }
        }
    }
    const secondsPerTick = (microsecondsPerBeat / 1000000) / ticksPerBeat / speed;

    // Build target frequencies from scale
    const baseNoteNum = options.baseNote ?? importResult.tuning?.baseNote ?? A4_NOTE;
    const baseFreq = options.baseFrequency ?? importResult.tuning?.baseFrequency ?? A4_FREQ;
    const targetFreqs = buildTargetFrequencies(targetScale, baseNoteNum, baseFreq);

    // Calculate total duration
    let maxEndTick = 0;
    for (const note of notes) {
        const endTick = note.startTick + note.durationTicks;
        if (endTick > maxEndTick) maxEndTick = endTick;
    }
    const totalDuration = maxEndTick * secondsPerTick + 1; // Add 1 second for release

    report('preparing', 10, `Duration: ${totalDuration.toFixed(1)}s, Notes: ${notes.length}`);

    // Create offline audio context
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

    report('rendering', 20, 'Rendering notes to audio buffer...');

    // Render each note
    const batchSize = 100;
    for (let i = 0; i < notes.length; i += batchSize) {
        const batch = notes.slice(i, i + batchSize);

        for (const note of batch) {
            const startTime = note.startTick * secondsPerTick;
            const duration = Math.max(0.01, note.durationTicks * secondsPerTick);

            // Get original frequency and retune it
            const origFreq = note.frequencyHz || midiNoteToFrequency(note.noteNumber);
            const retunedFreq = findNearestFrequency(targetFreqs, origFreq);

            // Create oscillator
            const osc = offlineCtx.createOscillator();
            osc.type = waveform;
            osc.frequency.value = retunedFreq;

            // Create gain envelope
            const gain = offlineCtx.createGain();
            const velocity = (note.velocity ?? 100) / 127;
            const maxGain = noteGain * velocity;

            const attackTime = 0.01;
            const releaseTime = Math.min(0.15, duration * 0.3);
            const sustainEnd = startTime + duration - releaseTime;

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(maxGain, startTime + attackTime);
            gain.gain.setValueAtTime(maxGain, Math.max(startTime + attackTime, sustainEnd));
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            // Pan based on channel
            const pan = offlineCtx.createStereoPanner?.();
            if (pan) {
                pan.pan.value = ((note.channel % 16) - 7.5) / 15; // Spread channels across stereo
                osc.connect(gain).connect(pan).connect(offlineCtx.destination);
            } else {
                osc.connect(gain).connect(offlineCtx.destination);
            }

            osc.start(startTime);
            osc.stop(startTime + duration + 0.05);
        }

        const progress = 20 + (i / notes.length) * 60;
        report('rendering', progress, `Rendering notes ${i + 1}-${Math.min(i + batchSize, notes.length)} of ${notes.length}...`);
    }

    report('rendering', 80, 'Finalizing audio buffer...');

    // Render the audio
    const audioBuffer = await offlineCtx.startRendering();

    report('encoding', 90, 'Encoding to audio file...');

    // Convert AudioBuffer to WAV blob (more compatible than WebM for downloads)
    const wavBlob = audioBufferToWav(audioBuffer);

    report('done', 100, 'Audio export complete.');

    return wavBlob;
};

// Convert AudioBuffer to WAV format
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;

    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave channels and write samples
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, int16, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
};
