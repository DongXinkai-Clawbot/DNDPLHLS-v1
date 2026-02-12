import { useEffect, useRef } from 'react';
import type { Minima, Partial } from './utils';
import { applySpectralDecay, DEFAULT_ATTACK, DEFAULT_RELEASE, getAudioCtx, resolvePartialWaveform } from './utils';

type UseSetharesHoverAudioParams = {
    hoverCents: number | null;
    partials: Partial[];
    masterVolume: number;
    baseFreq: number;
    snapToMinima: boolean;
    snapModifierActive: boolean;
    minima: Minima[];
    waveform: OscillatorType;
    decayAmount: number;
    timeSlice: number;
    beatEnabled: boolean;
    beatDepth: number;
};

export const useSetharesHoverAudio = ({
    hoverCents,
    partials,
    masterVolume,
    baseFreq,
    snapToMinima,
    snapModifierActive,
    minima,
    waveform,
    decayAmount,
    timeSlice,
    beatEnabled,
    beatDepth
}: UseSetharesHoverAudioParams) => {
    const oscsRef = useRef<Array<{ osc: OscillatorNode; gain: GainNode; isSweep?: boolean; baseFreq?: number; beatOsc?: OscillatorNode }>>([]);
    const gainRef = useRef<GainNode | null>(null);
    const beatSettingsRef = useRef({ enabled: beatEnabled, depth: beatDepth });

    useEffect(() => {
        const ctx = getAudioCtx();

        const stopActiveOscs = () => {
            const now = ctx.currentTime;
            oscsRef.current.forEach(({ osc, gain, beatOsc }) => {
                gain.gain.cancelScheduledValues(now);
                gain.gain.setTargetAtTime(0.0001, now, DEFAULT_RELEASE / 4);
                osc.stop(now + DEFAULT_RELEASE + 0.02);
                if (beatOsc) {
                    beatOsc.stop(now + DEFAULT_RELEASE + 0.02);
                }
            });
            oscsRef.current = [];
            if (gainRef.current) {
                const master = gainRef.current;
                setTimeout(() => {
                    if (gainRef.current === master) {
                        master.disconnect();
                        gainRef.current = null;
                    }
                }, (DEFAULT_RELEASE + 0.05) * 1000);
            }
        };

        if (beatSettingsRef.current.enabled !== beatEnabled || beatSettingsRef.current.depth !== beatDepth) {
            stopActiveOscs();
            beatSettingsRef.current = { enabled: beatEnabled, depth: beatDepth };
        }

        if (hoverCents === null) {
            stopActiveOscs();
            return;
        }

        let targetCents = hoverCents;

        if (snapToMinima || snapModifierActive) {
            let nearest = null;
            let minDist = Infinity;
            for (const m of minima) {
                const dist = Math.abs(m.cents - hoverCents);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = m;
                }
            }

            if (nearest && minDist < 50) {
                targetCents = nearest.cents;
            }
        }

        const analysisPartials = applySpectralDecay(partials, decayAmount, timeSlice).filter(p => p.amplitude > 0.01);

        if (oscsRef.current.length > 0 && oscsRef.current.length !== analysisPartials.length * 2) {
            stopActiveOscs();
        }

        if (oscsRef.current.length === 0) {
            const masterGain = ctx.createGain();
            masterGain.gain.value = masterVolume * 0.2;
            masterGain.connect(ctx.destination);
            gainRef.current = masterGain;

            const f0 = baseFreq;
            const activePartials = analysisPartials;

            activePartials.forEach(p => {
                const osc = ctx.createOscillator();
                osc.type = resolvePartialWaveform(p, waveform);
                osc.frequency.value = f0 * p.ratio;
                const g = ctx.createGain();
                g.gain.value = 0;
                osc.connect(g);
                g.connect(masterGain);
                osc.start();
                g.gain.linearRampToValueAtTime(p.amplitude, ctx.currentTime + DEFAULT_ATTACK);
                oscsRef.current.push({ osc, gain: g });
            });

            activePartials.forEach(p => {
                const osc = ctx.createOscillator();
                osc.type = resolvePartialWaveform(p, waveform);
                osc.frequency.value = f0 * p.ratio;
                const g = ctx.createGain();
                g.gain.value = 0;
                osc.connect(g);
                g.connect(masterGain);
                osc.start();
                const targetAmp = p.amplitude;
                const baseAmp = beatEnabled ? targetAmp * (1 - beatDepth * 0.5) : targetAmp;
                g.gain.linearRampToValueAtTime(baseAmp, ctx.currentTime + DEFAULT_ATTACK);
                let beatOsc: OscillatorNode | undefined;
                if (beatEnabled) {
                    const beatFreq = Math.min(40, Math.max(0.5, Math.abs(f0 * p.ratio * (Math.pow(2, targetCents / 1200) - 1))));
                    beatOsc = ctx.createOscillator();
                    beatOsc.type = 'sine';
                    beatOsc.frequency.value = beatFreq;
                    const beatGain = ctx.createGain();
                    beatGain.gain.value = targetAmp * beatDepth * 0.5;
                    beatOsc.connect(beatGain);
                    beatGain.connect(g.gain);
                    beatOsc.start();
                }
                oscsRef.current.push({ osc, gain: g, isSweep: true, baseFreq: f0 * p.ratio, beatOsc });
            });
        }

        if (gainRef.current) {
            gainRef.current.gain.setTargetAtTime(masterVolume * 0.2, ctx.currentTime, 0.1);
        }

        const ratio = Math.pow(2, targetCents / 1200);
        oscsRef.current.forEach(({ osc, isSweep, baseFreq, beatOsc }, idx) => {
            const partial = analysisPartials.length > 0 ? analysisPartials[idx % analysisPartials.length] : null;
            if (isSweep && baseFreq) {
                osc.frequency.setTargetAtTime(baseFreq * ratio, ctx.currentTime, 0.02);
                if (beatOsc && beatEnabled) {
                    const beatFreq = Math.min(40, Math.max(0.5, Math.abs(baseFreq * (ratio - 1))));
                    beatOsc.frequency.setTargetAtTime(beatFreq, ctx.currentTime, 0.02);
                }
            }
            if (partial) {
                const targetAmp = partial.amplitude;
                const baseAmp = isSweep && beatEnabled ? targetAmp * (1 - beatDepth * 0.5) : targetAmp;
                oscsRef.current[idx].gain.gain.setTargetAtTime(baseAmp, ctx.currentTime, 0.05);
            }
        });
    }, [hoverCents, partials, masterVolume, baseFreq, snapToMinima, snapModifierActive, minima, waveform, decayAmount, timeSlice, beatEnabled, beatDepth]);
};
