
import React, { useState, useMemo } from 'react';
import type { SpiralConfig, PrimeLimit } from '../../../types';

interface Props {
    config: SpiralConfig;
    onChange: (partial: Partial<SpiralConfig>) => void;
}

interface CommaOption {
    steps: number;
    cents: number;
    description: string;
}

const InputControl = ({ label, value, min, max, step, onChange, disabled, title, colorClass = "accent-white" }: any) => (
    <div className={`flex flex-col flex-1 ${disabled ? 'opacity-30 pointer-events-none' : ''}`} title={title}>
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-gray-500 uppercase font-bold">{label}</span>
            <input
                type="number"
                min={min} max={max} step={step}
                value={value ?? 0}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-10 bg-gray-800 border border-gray-600 rounded text-[9px] text-white text-center outline-none px-0.5"
            />
        </div>
        <input
            type="range" min={min} max={max} step={step}
            value={value ?? 0}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className={`w-full h-1 bg-gray-700 rounded appearance-none ${colorClass}`}
        />
    </div>
);

export const SpiralSettings = ({ config, onChange }: Props) => {

    const findCommas = (limit: PrimeLimit): CommaOption[] => {
        const centsPerStep = 1200 * Math.log2(limit);
        const candidates: CommaOption[] = [];
        const tolerance = config.commaTolerance || 40;

        for (let s = 1; s <= 2000; s++) {
            let totalCents = s * centsPerStep;

            let diff = Math.abs(totalCents) % 1200;
            diff = Math.min(diff, 1200 - diff);

            if (diff < tolerance) {

                let name = `${s} steps`;
                if (s === 12 && limit === 3) name = "Pythagorean (12)";
                if (s === 53 && limit === 3) name = "Mercator (53)";
                if (s === 41 && limit === 3) name = "41-EDO (41)";
                if (s === 665 && limit === 3) name = "Schisma (665)";
                candidates.push({ steps: s, cents: diff, description: name });
            }
        }

        return candidates.sort((a, b) => a.steps - b.steps);
    };

    const axisCommas = useMemo(() => findCommas(config.axis), [config.axis, config.commaTolerance]);

    const secondaryOptions = useMemo(() => {
        return axisCommas.filter(c => c.steps > config.primaryStep && c.cents < config.primaryCents);
    }, [axisCommas, config.primaryStep, config.primaryCents]);

    const tertiaryOptions = useMemo(() => {
        const sStep = config.secondaryStep || 0;
        const sErr = config.secondaryCents || 100;
        return axisCommas.filter(c => c.steps > sStep && c.cents < sErr);
    }, [axisCommas, config.secondaryStep, config.secondaryCents]);

    const isTorus = config.secondaryStep > 0;
    const isHyperTorus = config.tertiaryStep !== undefined && config.tertiaryStep > 0;

    return (
        <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 mt-4">
            <div className={`flex justify-between items-center ${config.enabled ? 'border-b border-gray-700 pb-2 mb-3' : ''}`}>
                <h3 className="text-xs font-black text-blue-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="text-lg">🌀</span>
                    Spiral Generator
                </h3>
                <label className="flex items-center gap-2 cursor-pointer bg-black/40 px-2 py-1 rounded hover:bg-black/60 transition-colors">
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => onChange({ enabled: e.target.checked })}
                        className="w-4 h-4 accent-blue-500 rounded"
                    />
                    <span className="text-[10px] font-bold text-gray-300 uppercase">Enable</span>
                </label>
            </div>

            {config.enabled && (
                <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Driving Axis (Gen 0)</label>
                            <select
                                value={config.axis || 3}
                                onChange={(e) => {
                                    const newAxis = parseInt(e.target.value) as PrimeLimit;

                                    onChange({
                                        axis: newAxis,
                                        primaryStep: 12, primaryCents: 23.46,
                                        secondaryStep: 0, secondaryCents: 0,
                                        tertiaryStep: 0, tertiaryCents: 0
                                    });
                                }}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none"
                            >
                                {[3, 5, 7, 11, 13, 17, 19, 23, 29, 31].map(p => <option key={p} value={p}>{p}-Limit</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Total Length</label>
                            <input
                                type="number"
                                min="10" max="2000"
                                value={config.length || 53}
                                onChange={(e) => onChange({ length: parseInt(e.target.value) })}
                                className="w-full bg-black border border-gray-700 text-xs text-white rounded p-1.5 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center bg-black/20 p-2 rounded border border-gray-800">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Comma Search Tolerance</span>
                        <div className="flex items-center gap-2 flex-1 ml-3">
                            <input
                                type="range"
                                min="1" max="100"
                                value={config.commaTolerance || 40}
                                onChange={(e) => onChange({ commaTolerance: parseFloat(e.target.value) })}
                                className="flex-1 h-1 accent-gray-500 bg-gray-700 rounded appearance-none"
                            />
                            <span className="text-[9px] font-mono text-white w-8 text-right">{(config.commaTolerance || 40).toFixed(0)}¢</span>
                        </div>
                    </div>

                    <div className="bg-black/20 p-2 rounded border border-gray-800 relative">
                        <span className="text-[9px] text-blue-400 font-bold uppercase block mb-2">1. Primary Comma (Inner Loop)</span>
                        <select
                            value={config.primaryStep}
                            onChange={(e) => {
                                const step = parseInt(e.target.value);
                                const opt = axisCommas.find(c => c.steps === step);
                                onChange({
                                    primaryStep: step,
                                    primaryCents: opt ? opt.cents : 0,

                                    secondaryStep: 0, secondaryCents: 0,
                                    tertiaryStep: 0, tertiaryCents: 0
                                });
                            }}
                            className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded p-1.5 mb-2 outline-none"
                        >
                            {axisCommas.length === 0 && <option value={0}>No commas found within tolerance</option>}
                            {axisCommas.map(c => (
                                <option key={c.steps} value={c.steps}>
                                    {c.description} (Err: {c.cents.toFixed(1)}¢)
                                </option>
                            ))}
                        </select>
                        <div className="flex gap-4">
                            <InputControl
                                label="Radius"
                                value={config.radius1 ?? 30}
                                min={10} max={200} step={1}
                                onChange={(v: number) => onChange({ radius1: v })}
                                colorClass="accent-blue-500"
                            />
                            <InputControl
                                label="Helix Rise"
                                value={config.rise ?? 60.0}
                                min={0} max={1000} step={1}
                                onChange={(v: number) => onChange({ rise: v })}
                                title="Total Vertical Drift per Cycle (Helix Pitch)"
                                colorClass="accent-white"
                            />
                        </div>
                    </div>

                    <div className="bg-black/20 p-2 rounded border border-gray-800 relative">
                        <span className="text-[9px] text-green-400 font-bold uppercase block mb-2">2. Secondary Comma (Middle Loop)</span>
                        <select
                            value={config.secondaryStep}
                            onChange={(e) => {
                                const step = parseInt(e.target.value);
                                const opt = secondaryOptions.find(c => c.steps === step);
                                onChange({
                                    secondaryStep: step,
                                    secondaryCents: opt ? opt.cents : 0,
                                    tertiaryStep: 0, tertiaryCents: 0
                                });
                            }}
                            disabled={secondaryOptions.length === 0}
                            className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded p-1.5 mb-2 outline-none disabled:opacity-50"
                        >
                            <option value={0}>-- None --</option>
                            {secondaryOptions.map(c => (
                                <option key={c.steps} value={c.steps}>
                                    {c.description} (Err: {c.cents.toFixed(1)}¢)
                                </option>
                            ))}
                        </select>

                        <div className="flex gap-4">
                            <InputControl
                                label="Radius"
                                value={config.radius2 ?? 100}
                                min={10} max={300} step={1}
                                onChange={(v: number) => onChange({ radius2: v })}
                                colorClass="accent-green-500"
                                disabled={!isTorus}
                            />
                            <InputControl
                                label="Coil Rise"
                                value={config.rise2 ?? 200.0}
                                min={0} max={1000} step={1}
                                onChange={(v: number) => onChange({ rise2: v })}
                                title="Total Vertical Drift per Secondary Cycle (Coil Pitch)"
                                colorClass="accent-white"
                                disabled={!isTorus}
                            />
                        </div>
                    </div>

                    <div className="bg-black/20 p-2 rounded border border-gray-800 relative">
                        <span className="text-[9px] text-pink-400 font-bold uppercase block mb-2">3. Tertiary Comma (Outer Loop)</span>
                        <select
                            value={config.tertiaryStep || 0}
                            onChange={(e) => {
                                const step = parseInt(e.target.value);
                                const opt = tertiaryOptions.find(c => c.steps === step);
                                onChange({
                                    tertiaryStep: step,
                                    tertiaryCents: opt ? opt.cents : 0
                                });
                            }}
                            disabled={!isTorus || tertiaryOptions.length === 0}
                            className="w-full bg-gray-900 border border-gray-700 text-xs text-white rounded p-1.5 mb-2 outline-none disabled:opacity-50"
                        >
                            <option value={0}>-- None --</option>
                            {tertiaryOptions.map(c => (
                                <option key={c.steps} value={c.steps}>
                                    {c.description} (Err: {c.cents.toFixed(1)}¢)
                                </option>
                            ))}
                        </select>

                        <div className="flex gap-4">
                            <InputControl
                                label="Radius"
                                value={config.radius3 ?? 300}
                                min={50} max={1500} step={10}
                                onChange={(v: number) => onChange({ radius3: v })}
                                colorClass="accent-pink-500"
                                disabled={!isHyperTorus}
                            />
                            <InputControl
                                label="Super Rise"
                                value={config.rise3 ?? 600.0}
                                min={0} max={10000} step={10}
                                onChange={(v: number) => onChange({ rise3: v })}
                                title="Total Vertical Drift per Tertiary Cycle"
                                colorClass="accent-white"
                                disabled={!isHyperTorus}
                            />
                        </div>
                    </div>

                    <div className="bg-black/20 p-2 rounded border border-gray-800">
                        <span className="text-[9px] text-purple-400 font-bold uppercase block mb-2">Branching Config (Independent)</span>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[8px] text-gray-500 uppercase">Gen 1 Length</span>
                                    <span className="text-[8px] font-mono text-white">{config.expansionB ?? 2}</span>
                                </div>
                                <input
                                    type="range" min="0" max="20" step="1"
                                    value={config.expansionB ?? 2}
                                    onChange={(e) => onChange({ expansionB: parseInt(e.target.value) })}
                                    className="w-full h-1 accent-purple-500 bg-gray-700 rounded appearance-none"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-[8px] text-gray-500 uppercase">Gen 2 Length</span>
                                    <span className="text-[8px] font-mono text-white">{config.expansionC ?? 0}</span>
                                </div>
                                <input
                                    type="range" min="0" max="10" step="1"
                                    value={config.expansionC ?? 0}
                                    onChange={(e) => onChange({ expansionC: parseInt(e.target.value) })}
                                    className="w-full h-1 accent-pink-500 bg-gray-700 rounded appearance-none"
                                />
                            </div>
                        </div>
                    </div>

                    <p className="text-[9px] text-gray-500 italic leading-relaxed bg-blue-900/10 p-2 rounded border border-blue-900/30">
                        Generates a bi-directional chain from the center. Meeting the Primary Comma completes the first circle. Secondary/Tertiary commas wrap into larger nested spirals.
                    </p>
                </div>
            )
            }
        </div>
    );
};
