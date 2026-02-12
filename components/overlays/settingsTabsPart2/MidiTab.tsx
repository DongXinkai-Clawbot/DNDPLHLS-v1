import React, { useEffect, useState } from 'react';
import { Vector3 } from 'three';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { WebMidi } from '../../../types';
import { EDO_PRESETS } from '../../../constants';
import { buildMtsBulkDump } from '../../../utils/temperamentSolver/mts';
import { startFrequency } from '../../../audioEngine';
import type { SolverInput } from '../../../utils/temperamentSolver';
import { CHROMATIC_ORDER, FIFTH_ORDER, MEANTONE_PRESETS, WELL_TEMPERED_PRESETS } from './constants';
import { MidiDeviceManagerSection } from './MidiDeviceManagerSection';
import { MidiInputSection } from './MidiInputSection';
import { MidiMappingSection } from './MidiMappingSection';
import { MidiOutputSection } from './MidiOutputSection';
import { createLogger } from '../../../utils/logger';
import { notifyError, notifySuccess, notifyWarning } from '../../../utils/notifications';

const log = createLogger('midi/tab');

export const MidiTab = ({ settings, handleSettingChange }: any) => {
    const {
      saveMidiScale,
      deleteMidiScale,
      savedMidiScales,
      setCustomKeyboard
    } = useStore((s) => ({
      saveMidiScale: s.saveMidiScale,
      deleteMidiScale: s.deleteMidiScale,
      savedMidiScales: s.savedMidiScales,
      setCustomKeyboard: s.setCustomKeyboard
    }), shallow);
    const [devices, setDevices] = useState<WebMidi.MIDIInput[]>([]);
    const [outputs, setOutputs] = useState<WebMidi.MIDIOutput[]>([]);
    const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastNote, setLastNote] = useState<number | null>(null);
    const [newScaleName, setNewScaleName] = useState("");
    const [equalStepBase, setEqualStepBase] = useState(() => 2);
    const [equalStepDivisor, setEqualStepDivisor] = useState(() => settings.midi.mappingDivisions || 12);
    const lastDivisionsRef = React.useRef<number | null>(settings.midi.mappingDivisions || 12);
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
        const currentDiv = settings.midi.mappingDivisions || 12;
        if (lastDivisionsRef.current !== null && equalStepDivisor === lastDivisionsRef.current) {
            setEqualStepDivisor(currentDiv);
        }
        lastDivisionsRef.current = currentDiv;
    }, [settings.midi.mappingDivisions, equalStepDivisor]);

    useEffect(() => {
        if (!navigator.requestMIDIAccess) {
            setError("Web MIDI API not supported in this browser.");
            return;
        }

        // Request MIDI access with proper error handling
        // Use both rejection callback AND .catch() for maximum compatibility
        navigator
            .requestMIDIAccess({ sysex: false })  // Try without sysex first
            .then(
                (access) => {
                    setMidiAccess(access as unknown as WebMidi.MIDIAccess);
                    setError(null); // Clear any previous errors
                    const inputs = Array.from((access as any).inputs.values()) as WebMidi.MIDIInput[];
                    setDevices(inputs);
                    setOutputs(Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[]);

                    access.onstatechange = (e: any) => {
                        const newInputs = Array.from((access as any).inputs.values()) as WebMidi.MIDIInput[];
                        const newOutputs = Array.from((access as any).outputs?.values?.() || []) as WebMidi.MIDIOutput[];
                        setDevices(newInputs);
                        setOutputs(newOutputs);
                    };
                },
                // Rejection callback (legacy but kept for compatibility)
                (err: any) => {
                    const errorMsg = err?.message || "MIDI Access Denied or Not Supported";
                    console.warn('MIDI request rejected:', errorMsg);
                    setError(errorMsg);
                }
            )
            .catch((err: any) => {
                // Modern .catch() handler for unhandled rejections
                // This prevents unhandled promise rejections from crashing the app
                const errorMsg = err?.message || "MIDI Access Denied or Not Supported";
                console.error('MIDI access error:', errorMsg);
                setError(errorMsg);
            });
    }, []);

    const midiOutEnabled = Boolean((settings.midi as any).outputEnabled);
    const midiOutId = String((settings.midi as any).outputId || '');

    const midiOutChannels: number[] = (settings.midi as any).outputChannels
        ? (settings.midi as any).outputChannels
        : [(settings.midi as any).outputChannel ?? 1];
    const midiOutPitchBendRange = Math.min(24, Math.max(1, Math.floor(Number((settings.midi as any).outputPitchBendRange ?? 2))));

    useEffect(() => {
        if (!midiAccess || !settings.midi.enabled) return;

        const handleMsg = (e: WebMidi.MIDIMessageEvent) => {
            // Safely handle MIDI message with bounds checking
            if (!e.data || e.data.length < 2) return;

            const [status, note] = e.data;
            if (!status || note === undefined) return;

            // Only handle Note On messages (0x90 = channel 1)
            if ((status & 0xF0) === 0x90) {
                setLastNote(note);
                setTimeout(() => setLastNote(null), 500);
            }
        };

        const inputs = Array.from((midiAccess as any).inputs?.values?.() || []) as WebMidi.MIDIInput[];

        // Add null check for each input before attaching listener
        inputs.forEach((input) => {
            if (input && typeof input.addEventListener === 'function') {
                try {
                    input.addEventListener('midimessage', handleMsg);
                } catch (err) {
                    console.warn('Failed to attach MIDI listener to input:', err);
                }
            }
        });

        return () => {
            // Safely remove listeners with same null checks
            inputs.forEach((input) => {
                if (input && typeof input.removeEventListener === 'function') {
                    try {
                        input.removeEventListener('midimessage', handleMsg);
                    } catch (err) {
                        console.warn('Failed to remove MIDI listener from input:', err);
                    }
                }
            });
        };
    }, [midiAccess, settings.midi.enabled]);

    const handleDivisionChange = (newDiv: number) => {
        if (newDiv < 1 || newDiv > 100) return;

        let currentScale = [...(settings.midi.mappingScale || [])];

        if (EDO_PRESETS[newDiv]) {
            currentScale = EDO_PRESETS[newDiv].map((ratio) => formatDecimalRatio(ratio));
        } else {

            if (newDiv > currentScale.length) {
                for (let i = currentScale.length; i < newDiv; i++) currentScale.push('1/1');
            } else if (newDiv < currentScale.length) {
                currentScale.length = newDiv;
            }
        }

        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: newDiv, mappingScale: currentScale } });
    };

    const handleScaleStepChange = (index: number, val: string) => {
        const newScale = [...settings.midi.mappingScale];
        newScale[index] = val;
        handleSettingChange({ midi: { ...settings.midi, mappingScale: newScale } });
    };

    const resetToStandardJI = () => {
        handleDivisionChange(12);
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
        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: divisions, mappingScale: newScale } });
    };

    const generateEqualStepScale = () => {
        const divisions = settings.midi.mappingDivisions || 12;
        const base = Number(equalStepBase);
        const divisor = Number(equalStepDivisor);
        if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(divisor) || divisor <= 0) return;
        const newScale = [];
        for (let i = 0; i < divisions; i++) {
            const val = Math.pow(base, i / divisor);
            newScale.push(formatDecimalValue(val));
        }
        handleSettingChange({ midi: { ...settings.midi, mappingScale: newScale } });
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
        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: 12, mappingScale: scale } });
    };

    const applyCustomComma = (commaStr: string) => {
        const trimmed = commaStr.trim();
        const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (!match) {
            notifyWarning('Invalid format. Use a/b format like "1/4" or "2/7".', 'MIDI');
            return;
        }
        const a = parseFloat(match[1]);
        const b = parseFloat(match[2]);
        if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) {
            notifyWarning('Invalid values.', 'MIDI');
            return;
        }
        const fraction = a / b;
        const scale = generateMeantoneScale(fraction);
        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: 12, mappingScale: scale } });
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
        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: 12, mappingScale: scale } });
    };

    const clearCustomMap = () => {
        const div = settings.midi.mappingDivisions || 12;
        const newScale = new Array(div).fill('1/1');
        handleSettingChange({ midi: { ...settings.midi, mappingScale: newScale } });
    };

    const handleSaveScale = () => {
        if (!newScaleName.trim()) {
            notifyWarning('Enter a name for the preset.', 'MIDI');
            return;
        }
        saveMidiScale(newScaleName, [...settings.midi.mappingScale]);
        setNewScaleName("");
    };

    const handleLoadScale = (scale: string[]) => {
        const safeScale = Array.isArray(scale) ? scale.map((r) => formatDecimalRatio(r)) : [];
        const nextDivisions = Math.max(1, safeScale.length || settings.midi.mappingDivisions || 12);
        handleSettingChange({ midi: { ...settings.midi, mappingDivisions: nextDivisions, mappingScale: safeScale } });
        setEqualStepDivisor(nextDivisions);
        lastDivisionsRef.current = nextDivisions;
    };

    const handleExportMts = (scale: string[], name: string) => {
        try {
            const scaleSize = scale.length;
            const baseNote = settings.midi.centerNote || 60;

            const baseFreq = 440 * Math.pow(2, (baseNote - 69) / 12);

            const input: Pick<SolverInput, "scaleSize" | "baseMidiNote" | "baseFrequencyHz" | "cycleCents"> = {
                scaleSize,
                baseMidiNote: baseNote,
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

            if (midiOutEnabled && midiOutId) {
                const output = outputs.find(o => o.id === midiOutId);
                if (output) {
                    output.send(syx);

                    log.info(`Sent MTS SysEx to ${output.name}`);
                }
            }

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
            notifyError('Export failed. Check console.', 'MIDI');
        }
    };

    const handlePlayRatio = (ratio: string, i: number) => {
        try {

            const baseNote = settings.midi.centerNote || 60;
            const baseFreq = 440 * Math.pow(2, (baseNote - 69) / 12);

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

    const handleExportToKeyboard = () => {
        try {
            const scale = settings.midi.mappingScale || [];

            const nodes = scale.map((rStr: string, i: number) => {
                let cents = 0;
                let n = 1n, d = 1n;
                let ratioFloat: number | undefined = undefined;

                if (rStr.includes('/')) {
                    const parts = rStr.split('/');

                    if (parts[0].includes('.') || parts[1].includes('.')) {
                        const numVal = parseFloat(parts[0]) || 1;
                        const denVal = parseFloat(parts[1]) || 1;
                        ratioFloat = numVal / denVal;
                        cents = 1200 * Math.log2(ratioFloat);

                        const precision = 10000000000n;
                        n = BigInt(Math.round(ratioFloat * 10000000000));
                        d = precision;
                    } else {
                        n = BigInt(parts[0]);
                        d = BigInt(parts[1]);
                        cents = 1200 * Math.log2(Number(n) / Number(d));
                    }
                } else {

                    ratioFloat = parseFloat(rStr);
                    cents = 1200 * Math.log2(ratioFloat);

                    const precision = 10000000000n;
                    n = BigInt(Math.round(ratioFloat * 10000000000));
                    d = precision;
                }

                if (ratioFloat === undefined && d !== 0n) {
                    ratioFloat = Number(n) / Number(d);
                }

                return {
                    id: `export-${Date.now()}-${i}`,
                    name: rStr,
                    cents,
                    ratio: { n, d },
                    ratioFloat: ratioFloat,
                    octave: 0,
                    position: new Vector3(i * 2, 0, 0),
                    primeVector: {},
                    gen: 0,
                    originLimit: 0,
                    parentId: null
                };
            });

            setCustomKeyboard(nodes);
            notifySuccess(`Exported ${nodes.length} keys to Virtual Keyboard panel.`, 'MIDI');
        } catch (e) {
            log.error('Export failed', e);
            notifyError('Failed to export to keyboard.', 'MIDI');
        }
    };

    const contentCollapsed = !settings.midi.enabled;

    return (
        <div className="space-y-4 p-1">
            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
                External MIDI Control
                {settings.midi.enabled && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_lime]"></span>}
            </h3>

            {error && <div className="p-2 bg-red-900/30 text-red-300 text-[10px] rounded border border-red-800">{error}</div>}

            <MidiInputSection
                settings={settings}
                handleSettingChange={handleSettingChange}
                devices={devices}
                contentCollapsed={contentCollapsed}
                lastNote={lastNote}
            />

            <MidiOutputSection
                settings={settings}
                handleSettingChange={handleSettingChange}
                midiOutEnabled={midiOutEnabled}
                midiOutId={midiOutId}
                outputs={outputs}
                midiOutChannels={midiOutChannels}
                midiOutPitchBendRange={midiOutPitchBendRange}
            />

            <MidiDeviceManagerSection
                settings={settings}
                handleSettingChange={handleSettingChange}
            />

            <MidiMappingSection
                settings={settings}
                handleSettingChange={handleSettingChange}
                handleDivisionChange={handleDivisionChange}
                generateTETScale={generateTETScale}
                clearCustomMap={clearCustomMap}
                handleExportToKeyboard={handleExportToKeyboard}
                resetToStandardJI={resetToStandardJI}
                generateEqualStepScale={generateEqualStepScale}
                equalStepBase={equalStepBase}
                setEqualStepBase={setEqualStepBase}
                equalStepDivisor={equalStepDivisor}
                setEqualStepDivisor={setEqualStepDivisor}
                meantonePresetId={meantonePresetId}
                setMeantonePresetId={setMeantonePresetId}
                applyMeantonePreset={applyMeantonePreset}
                customCommaInput={customCommaInput}
                setCustomCommaInput={setCustomCommaInput}
                applyCustomComma={applyCustomComma}
                wellTemperedPresetId={wellTemperedPresetId}
                setWellTemperedPresetId={setWellTemperedPresetId}
                applyWellTemperedPreset={applyWellTemperedPreset}
                newScaleName={newScaleName}
                setNewScaleName={setNewScaleName}
                handleSaveScale={handleSaveScale}
                savedMidiScales={savedMidiScales}
                loadMidiScale={handleLoadScale}
                deleteMidiScale={deleteMidiScale}
                handleExportMts={handleExportMts}
                handleScaleStepChange={handleScaleStepChange}
                handlePlayRatio={handlePlayRatio}
                formatRatioInput={formatDecimalRatio}
            />


        </div>
    );
};
