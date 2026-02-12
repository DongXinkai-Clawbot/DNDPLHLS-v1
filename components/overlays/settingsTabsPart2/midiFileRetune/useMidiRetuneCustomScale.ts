import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../../store/storeImpl';
import { buildMtsBulkDump } from '../../../../utils/temperamentSolver/mts';
import { startFrequency } from '../../../../audioEngine';
import type { SolverInput } from '../../../../utils/temperamentSolver';
import { MEANTONE_PRESETS, WELL_TEMPERED_PRESETS, CHROMATIC_ORDER, FIFTH_ORDER } from '../constants';
import { createLogger } from '../../../../utils/logger';
import { notifyError, notifyWarning } from '../../../../utils/notifications';

type UseMidiRetuneCustomScaleArgs = {
    settings: any;
};

const log = createLogger('midi/retune-custom-scale');

export const useMidiRetuneCustomScale = ({ settings }: UseMidiRetuneCustomScaleArgs) => {
    const midiRetuner = useStore((state: any) => state.midiRetuner);
    const { retuneCustomScale, baseNote } = midiRetuner;
    const updateState = useStore(state => state.setMidiRetunerState) as (payload: any) => void;
    const saveMidiScale = useStore(state => state.saveMidiScale);
    const deleteMidiScale = useStore(state => state.deleteMidiScale);

    const [newScaleName, setNewScaleName] = useState("");
    const [equalStepBase, setEqualStepBase] = useState(2);
    const [equalStepDivisor, setEqualStepDivisor] = useState(12);
    const lastDivisionsRef = useRef<number | null>(retuneCustomScale?.length || 12);
    const [meantonePresetId, setMeantonePresetId] = useState(MEANTONE_PRESETS[0]?.id || '');
    const [wellTemperedPresetId, setWellTemperedPresetId] = useState(WELL_TEMPERED_PRESETS[0]?.id || '');
    const [customCommaInput, setCustomCommaInput] = useState('1/4');
    const formatDecimalValue = (value: number) => {
        if (!Number.isFinite(value)) return '1';
        return value.toFixed(6).replace(/\.?0+$/, '');
    };
    const formatDecimalRatio = (ratio: string) => {
        const trimmed = (ratio || '').trim();
        if (!trimmed || trimmed.includes('/')) return trimmed;
        const value = Number(trimmed);
        if (!Number.isFinite(value)) return trimmed;
        return formatDecimalValue(value);
    };

    useEffect(() => {
        if (!retuneCustomScale || retuneCustomScale.length === 0) {
            const newScale = [];
            const div = 12;
            for (let i = 0; i < div; i++) {
                if (i === 0) {
                    newScale.push('1/1');
                } else {
                    newScale.push(Math.pow(2, i / div).toFixed(4));
                }
            }
            updateState({ retuneCustomScale: newScale });
        }
    }, [retuneCustomScale, updateState]);

    useEffect(() => {
        const currentDiv = retuneCustomScale?.length || 12;
        if (lastDivisionsRef.current !== null && equalStepDivisor === lastDivisionsRef.current) {
            setEqualStepDivisor(currentDiv);
        }
        lastDivisionsRef.current = currentDiv;
    }, [retuneCustomScale?.length, equalStepDivisor]);

    const handleCustomScaleChange = (newScale: string[]) => {
        const nextScale = Array.isArray(newScale) ? newScale : [];
        const prevLength = retuneCustomScale?.length ?? 0;
        updateState({ retuneCustomScale: nextScale });
        if (nextScale.length > 0 && nextScale.length !== prevLength) {
            setEqualStepDivisor(nextScale.length);
            lastDivisionsRef.current = nextScale.length;
        }
    };

    const handleScaleStepChange = (index: number, val: string) => {
        const newScale = [...(retuneCustomScale || [])];
        newScale[index] = val;
        handleCustomScaleChange(newScale);
    };

    const generateTETScale = (divisions: number) => {
        const newScale = [];
        for (let i = 0; i < divisions; i++) {
            if (i === 0) {
                newScale.push('1/1');
                continue;
            }
            const val = Math.pow(2, i / divisions);
            newScale.push(formatDecimalValue(val));
        }
        handleCustomScaleChange(newScale);
    };

    const generateEqualStepScale = () => {
        const divisions = retuneCustomScale?.length || 12;
        const base = Number(equalStepBase);
        const divisor = Number(equalStepDivisor);
        if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(divisor) || divisor <= 0) return;
        const newScale = [];
        for (let i = 0; i < divisions; i++) {
            const val = Math.pow(base, i / divisor);
            newScale.push(formatDecimalValue(val));
        }
        handleCustomScaleChange(newScale);
    };

    const normalizeToOctave = (val: number) => {
        if (!Number.isFinite(val) || val <= 0) return 1;
        let v = val;
        const shift = Math.floor(Math.log2(v));
        v = v / Math.pow(2, shift);
        while (v >= 2) v /= 2;
        while (v < 1) v *= 2;
        return v;
    };

    const generateMeantoneScale = (fraction: number) => {
        const syntonicComma = 81 / 80;
        const temperedFifth = (3 / 2) * Math.pow(syntonicComma, -fraction);
        const ratios: number[] = [];
        for (let i = 0; i < 12; i++) {
            ratios.push(normalizeToOctave(Math.pow(temperedFifth, i)));
        }
        ratios.sort((a, b) => a - b);
        return ratios.map((v) => formatDecimalValue(v));
    };

    const applyMeantonePreset = (presetId: string) => {
        const preset = MEANTONE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        const scale = generateMeantoneScale(preset.fraction);
        handleCustomScaleChange(scale);
    };

    const applyCustomComma = (commaStr: string) => {
        const trimmed = commaStr.trim();
        const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (!match) {
            notifyWarning('Invalid format. Use a/b format like "1/4" or "2/7".', 'Retune');
            return;
        }
        const a = parseFloat(match[1]);
        const b = parseFloat(match[2]);
        if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) {
            notifyWarning('Invalid values.', 'Retune');
            return;
        }
        const fraction = a / b;
        const scale = generateMeantoneScale(fraction);
        handleCustomScaleChange(scale);
    };

    const generateWellTemperedScale = (adjustments: number[]) => {
        const fifthBase = 1200 * Math.log2(3 / 2);
        const centsByNote: Record<string, number> = { C: 0 };
        let acc = 0;
        for (let i = 1; i < FIFTH_ORDER.length; i++) {
            const tweak = adjustments[i - 1] ?? 0;
            acc += fifthBase + tweak;
            const note = FIFTH_ORDER[i];
            const mod = ((acc % 1200) + 1200) % 1200;
            centsByNote[note] = mod;
        }
        return CHROMATIC_ORDER.map((note, idx) => {
            if (idx === 0) return '1/1';
            const cents = centsByNote[note] ?? 0;
            return formatDecimalValue(Math.pow(2, cents / 1200));
        });
    };

    const applyWellTemperedPreset = (presetId: string) => {
        const preset = WELL_TEMPERED_PRESETS.find(p => p.id === presetId);
        if (!preset) return;
        const scale = generateWellTemperedScale(preset.adjustments);
        handleCustomScaleChange(scale);
    };

    const clearCustomMap = () => {
        const div = retuneCustomScale?.length || 12;
        const newScale = new Array(div).fill('1/1');
        handleCustomScaleChange(newScale);
    };

    const resetToStandardJI = () => {
        const newScale = [];
        const div = 12;
        for (let i = 0; i < div; i++) {
            if (i === 0) { newScale.push('1/1'); continue; }
            newScale.push(Math.pow(2, i / div).toFixed(4));
        }
        handleCustomScaleChange(newScale);
    };

    const handleSaveScale = () => {
        if (!newScaleName.trim()) {
            notifyWarning('Enter a name for the preset.', 'Retune');
            return;
        }
        saveMidiScale(newScaleName, [...(retuneCustomScale || [])]);
        setNewScaleName("");
    };

    const handleExportMts = (scale: string[], name: string) => {
        try {
            const scaleSize = scale.length;
            const bNote = baseNote || 60;
            const baseFreq = 440 * Math.pow(2, (bNote - 69) / 12);

            const input: Pick<SolverInput, "scaleSize" | "baseMidiNote" | "baseFrequencyHz" | "cycleCents"> = {
                scaleSize,
                baseMidiNote: bNote,
                baseFrequencyHz: baseFreq,
                cycleCents: 1200,
            };

            const centsByDegree = scale.map(rStr => {
                if (rStr.includes('/')) {
                    const [n, d] = rStr.split('/').map(Number);
                    if (d === 0) return 0;
                    return 1200 * Math.log2(n / d);
                }
                return 1200 * Math.log2(parseFloat(rStr));
            });

            const syx = buildMtsBulkDump(input, centsByDegree, name, 0x7F, 0);
            const blob = new Blob([syx], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${name.replace(/\s+/g, '_')}_mts.syx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            log.error('Export failed', e);
            notifyError('Export failed. Check console.', 'Retune');
        }
    };

    const handlePlayRatio = (ratio: string, i: number) => {
        try {
            const bNote = baseNote || 60;
            const baseFreq = 440 * Math.pow(2, (bNote - 69) / 12);

            let ratioVal = 1;
            if (ratio.includes('/')) {
                const [n, d] = ratio.split('/').map(Number);
                if (d) ratioVal = n / d;
            } else {
                ratioVal = parseFloat(ratio);
            }
            const freq = baseFreq * ratioVal;
            const stop = startFrequency(freq, settings, 'click', 0);
            setTimeout(() => stop(), 500);
        } catch (e) {
            log.error('Export failed', e);
        }
    };

    const handleDivisionChange = (newDiv: number) => {
        if (newDiv < 1 || newDiv > 100) return;
        let currentScale = [...(retuneCustomScale || [])];
        if (newDiv > currentScale.length) {
            for (let i = currentScale.length; i < newDiv; i++) currentScale.push('1/1');
        } else if (newDiv < currentScale.length) {
            currentScale.length = newDiv;
        }
        handleCustomScaleChange(currentScale);
    };

    return {
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
        formatRatioInput: formatDecimalRatio,
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
        deleteMidiScale
    };
};
