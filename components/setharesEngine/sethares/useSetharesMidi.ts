import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MidiMappingMode, Partial } from './utils';
import { applySpectralDecay, clamp, DEFAULT_ATTACK, DEFAULT_RELEASE, getAudioCtx, resolvePartialWaveform } from './utils';

type UseSetharesMidiParams = {
    midiEnabled: boolean;
    midiInputs: any[];
    midiInputId: string;
    midiMappingMode: MidiMappingMode;
    midiBaseNote: number;
    midiNoteBendRange: number;
    midiChannel: number;
    setMidiInputs: Dispatch<SetStateAction<any[]>>;
    setMidiInputId: Dispatch<SetStateAction<string>>;
    masterVolume: number;
    baseFreq: number;
    partials: Partial[];
    decayAmount: number;
    timeSlice: number;
    waveform: OscillatorType;
    getScaleRatios: () => number[];
};

export const useSetharesMidi = ({
    midiEnabled,
    midiInputs,
    midiInputId,
    midiMappingMode,
    midiBaseNote,
    midiNoteBendRange,
    midiChannel,
    setMidiInputs,
    setMidiInputId,
    masterVolume,
    baseFreq,
    partials,
    decayAmount,
    timeSlice,
    waveform,
    getScaleRatios
}: UseSetharesMidiParams) => {
    const midiVoicesRef = useRef<Map<number, any>>(new Map());
    const midiMasterGainRef = useRef<GainNode | null>(null);
    const pitchBendRef = useRef(0);

    const mapMidiNoteToRatio = useCallback((note: number) => {
        const scale = getScaleRatios();
        const scaleLen = scale.length;
        if (scaleLen === 0) return null;
        if (midiMappingMode === 'white') {
            const whiteOffsets = [0, 2, 4, 5, 7, 9, 11];
            const semitone = ((note - midiBaseNote) % 12 + 12) % 12;
            const whiteIndex = whiteOffsets.indexOf(semitone);
            if (whiteIndex === -1) return null;
            const octave = Math.floor((note - midiBaseNote) / 12);
            const stepIndex = octave * 7 + whiteIndex;
            let degree = stepIndex % scaleLen;
            let octaveOffset = Math.floor(stepIndex / scaleLen);
            if (degree < 0) {
                degree += scaleLen;
                octaveOffset -= 1;
            }
            return { ratio: scale[degree] * Math.pow(2, octaveOffset), degree, octave: octaveOffset };
        }
        const stepIndex = note - midiBaseNote;
        let degree = stepIndex % scaleLen;
        let octaveOffset = Math.floor(stepIndex / scaleLen);
        if (degree < 0) {
            degree += scaleLen;
            octaveOffset -= 1;
        }
        return { ratio: scale[degree] * Math.pow(2, octaveOffset), degree, octave: octaveOffset };
    }, [getScaleRatios, midiBaseNote, midiMappingMode]);

    const getMidiMasterGain = () => {
        const ctx = getAudioCtx();
        if (!midiMasterGainRef.current) {
            const gain = ctx.createGain();
            gain.gain.value = masterVolume * 0.2;
            gain.connect(ctx.destination);
            midiMasterGainRef.current = gain;
        }
        return midiMasterGainRef.current;
    };

    const syncMidiVoiceOscillators = (voice: any, targetRatio: number, analysisPartials: Partial[]) => {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const targetCount = analysisPartials.length;
        const oscList = voice.oscillators as Array<{ osc: OscillatorNode; gain: GainNode }>;

        for (let i = 0; i < Math.min(oscList.length, targetCount); i++) {
            const partial = analysisPartials[i];
            const oscObj = oscList[i];
            oscObj.osc.type = resolvePartialWaveform(partial, waveform);
            oscObj.osc.frequency.setTargetAtTime(baseFreq * partial.ratio * targetRatio, now, 0.03);
            oscObj.gain.gain.setTargetAtTime(partial.amplitude, now, 0.03);
        }

        if (oscList.length > targetCount) {
            for (let i = targetCount; i < oscList.length; i++) {
                const oscObj = oscList[i];
                oscObj.gain.gain.setTargetAtTime(0.0001, now, DEFAULT_RELEASE / 2);
                oscObj.osc.stop(now + DEFAULT_RELEASE);
            }
            oscList.splice(targetCount);
        }

        if (oscList.length < targetCount) {
            for (let i = oscList.length; i < targetCount; i++) {
                const partial = analysisPartials[i];
                const osc = ctx.createOscillator();
                osc.type = resolvePartialWaveform(partial, waveform);
                osc.frequency.value = baseFreq * partial.ratio * targetRatio;
                const g = ctx.createGain();
                g.gain.value = partial.amplitude;
                osc.connect(g);
                g.connect(voice.voiceGain);
                osc.start();
                oscList.push({ osc, gain: g });
            }
        }
    };

    const updateMidiVoices = useCallback(() => {
        const scale = getScaleRatios();
        const bendRatio = Math.pow(2, (pitchBendRef.current * midiNoteBendRange) / 12);
        const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice).filter(p => p.amplitude > 0.0005);
        midiVoicesRef.current.forEach((voice) => {
            const degree = Math.min(Math.max(0, voice.degree), Math.max(0, scale.length - 1));
            const targetRatio = (scale[degree] || 1) * Math.pow(2, voice.octave) * bendRatio;
            syncMidiVoiceOscillators(voice, targetRatio, analysisPartials);
        });
    }, [decayAmount, getScaleRatios, midiNoteBendRange, partials, timeSlice, waveform, baseFreq]);

    const startMidiVoice = useCallback((note: number, velocity: number) => {
        if (midiVoicesRef.current.has(note)) return;
        const mapping = mapMidiNoteToRatio(note);
        if (!mapping) return;
        const ctx = getAudioCtx();
        ctx.resume();
        const master = getMidiMasterGain();
        const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice).filter(p => p.amplitude > 0.0005);
        const bendRatio = Math.pow(2, (pitchBendRef.current * midiNoteBendRange) / 12);
        const ratio = mapping.ratio * bendRatio;
        const voiceGain = ctx.createGain();
        const velGain = clamp(velocity / 127, 0, 1);
        voiceGain.gain.setValueAtTime(0, ctx.currentTime);
        voiceGain.gain.linearRampToValueAtTime(velGain, ctx.currentTime + DEFAULT_ATTACK);
        voiceGain.connect(master);
        const oscillators = analysisPartials.map(partial => {
            const osc = ctx.createOscillator();
            osc.type = resolvePartialWaveform(partial, waveform);
            osc.frequency.value = baseFreq * partial.ratio * ratio;
            const g = ctx.createGain();
            g.gain.value = partial.amplitude;
            osc.connect(g);
            g.connect(voiceGain);
            osc.start();
            return { osc, gain: g };
        });
        midiVoicesRef.current.set(note, {
            note,
            degree: mapping.degree,
            octave: mapping.octave,
            voiceGain,
            oscillators
        });
    }, [mapMidiNoteToRatio, partials, decayAmount, timeSlice, waveform, baseFreq, midiNoteBendRange]);

    const stopMidiVoice = useCallback((note: number) => {
        const voice = midiVoicesRef.current.get(note);
        if (!voice) return;
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        voice.voiceGain.gain.cancelScheduledValues(now);
        voice.voiceGain.gain.setTargetAtTime(0.0001, now, DEFAULT_RELEASE / 2);
        voice.oscillators.forEach((oscObj: any) => {
            oscObj.osc.stop(now + DEFAULT_RELEASE + 0.05);
        });
        midiVoicesRef.current.delete(note);
    }, []);

    const stopAllMidiVoices = useCallback(() => {
        Array.from(midiVoicesRef.current.keys()).forEach((note) => stopMidiVoice(note));
    }, [stopMidiVoice]);

    useEffect(() => {
        if (midiMasterGainRef.current) {
            const ctx = getAudioCtx();
            midiMasterGainRef.current.gain.setTargetAtTime(masterVolume * 0.2, ctx.currentTime, 0.05);
        }
    }, [masterVolume]);

    useEffect(() => {
        if (!midiEnabled) {
            stopAllMidiVoices();
            return;
        }
        if (!navigator.requestMIDIAccess) return;

        let access: any = null;
        let cancelled = false;

        // Request MIDI access with proper error handling
        navigator
            .requestMIDIAccess({ sysex: false })
            .then((acc) => {
                if (cancelled) return;
                access = acc;

                const updateInputs = () => {
                    const inputs = Array.from(acc.inputs?.values?.() || []);
                    setMidiInputs(inputs);
                    if (inputs.length > 0 && !midiInputId) {
                        setMidiInputId(inputs[0]?.id || '');
                    }
                };

                updateInputs();
                // Safely set state change handler with null check
                if (acc && typeof acc.onstatechange !== 'undefined') {
                    acc.onstatechange = updateInputs;
                }
            })
            .catch((err: any) => {
                // Handle MIDI access errors gracefully without crashing
                if (!cancelled) {
                    console.warn('MIDI access failed:', err?.message || err);
                    setMidiInputs([]);
                    setMidiInputId('');
                }
            });

        return () => {
            cancelled = true;
            if (access && typeof access.onstatechange !== 'undefined') {
                access.onstatechange = null;
            }
        };
    }, [midiEnabled, midiInputId, stopAllMidiVoices]);

    useEffect(() => {
        if (!midiEnabled) return;
        const input = midiInputs.find((i) => i.id === midiInputId) || midiInputs[0];
        if (!input) return;

        const handleMessage = (event: any) => {
            // Safely parse MIDI message with bounds checking
            if (!event?.data || event.data.length < 1) return;

            const [status, data1, data2] = event.data;
            if (status === undefined || data1 === undefined) return;

            const cmd = status & 0xf0;
            const channel = status & 0x0f;

            // Filter by channel if specified
            if (midiChannel >= 0 && channel !== midiChannel) return;

            // Handle different MIDI commands safely
            try {
                if (cmd === 0x90) {  // Note On
                    if (data2 === 0) stopMidiVoice(data1);
                    else startMidiVoice(data1, data2);
                } else if (cmd === 0x80) {  // Note Off
                    stopMidiVoice(data1);
                } else if (cmd === 0xe0) {  // Pitch Bend
                    const value = data1 | (data2 << 7);
                    const bend = (value - 8192) / 8192;
                    pitchBendRef.current = clamp(bend, -1, 1);
                    updateMidiVoices();
                }
            } catch (err) {
                console.warn('Error handling MIDI message:', err);
            }
        };
        input.onmidimessage = handleMessage;
        return () => {
            input.onmidimessage = null;
        };
    }, [midiEnabled, midiInputs, midiInputId, midiChannel, startMidiVoice, stopMidiVoice, updateMidiVoices]);

    useEffect(() => {
        if (!midiEnabled) return;
        updateMidiVoices();
    }, [midiEnabled, updateMidiVoices]);
};
