import { writeMidi } from 'midi-file';

/**
 * Generates a simple MIDI file for testing dynamic retuning.
 * Progression: C Major -> F Major -> G Major -> C Major
 */
export function generateDemoMidi(): Uint8Array {
    const ticksPerBeat = 480;
    const tempo = 500000; // 120 BPM

    // Track 0: Tempo and Meta
    const track0 = [
        { deltaTime: 0, type: 'setTempo', microsecondsPerBeat: tempo },
        { deltaTime: 0, type: 'endOfTrack' }
    ];

    // Track 1: Notes
    const track1: any[] = [];

    // Helper to add a chord
    const addChord = (notes: number[], startTick: number, durationTicks: number) => {
        notes.forEach((note, i) => {
            track1.push({
                deltaTime: i === 0 ? startTick : 0,
                type: 'noteOn',
                channel: 0,
                noteNumber: note,
                velocity: 80
            });
        });

        notes.forEach((note, i) => {
            track1.push({
                deltaTime: i === 0 ? durationTicks : 0,
                type: 'noteOff',
                channel: 0,
                noteNumber: note,
                velocity: 0
            });
        });
    };

    // Progression
    // C Major (60, 64, 67)
    addChord([60, 64, 67], 0, ticksPerBeat * 2);
    // F Major (65, 69, 72)
    addChord([65, 69, 72], 0, ticksPerBeat * 2);
    // G Major (67, 71, 74)
    addChord([67, 71, 74], 0, ticksPerBeat * 2);
    // C Major (60, 64, 67)
    addChord([60, 64, 67], 0, ticksPerBeat * 2);

    track1.push({ deltaTime: 0, type: 'endOfTrack' });

    // Sort events by absolute time to ensure correct delta times
    // For simplicity, we just wrote them in order with delta times relative to start.
    // Wait, the way I wrote it with deltaTime: 0 for subsequent notes in a chord is correct for MIDI 'simultaneous' events.

    const midi = {
        header: {
            format: 1,
            numTracks: 2,
            ticksPerBeat: ticksPerBeat
        },
        tracks: [track0, track1]
    };

    const bytes = writeMidi(midi);
    return new Uint8Array(bytes);
}
