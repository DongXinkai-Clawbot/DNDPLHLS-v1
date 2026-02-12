import React, { useMemo } from 'react';
import type { CurvedGeometryConfig } from '../../../types';
import { DEFAULT_SETTINGS } from '../../../constants';

type CurvedGeometryPanelProps = {
    globalSettings: any;
    updateCurved: (partial: Partial<CurvedGeometryConfig>) => void;
    resetLatticeConfig: () => void;
};

const METRIC_OPTIONS: { value: CurvedGeometryConfig['pitchMetric']; label: string }[] = [
    { value: 'log2', label: 'Log2 Distance' },
    { value: 'cents', label: 'Cents Distance' },
    { value: 'primeL1', label: 'Prime L1 (|exp| sum)' },
    { value: 'primeL2', label: 'Prime L2 (sqrt sum sq)' },
    { value: 'primeLInf', label: 'Prime Linf (max |exp|)' },
    { value: 'weighted', label: 'Weighted (|exp| * log2 p)' }
];

const DISTANCE_OPTIONS: { value: CurvedGeometryConfig['distanceMode']; label: string }[] = [
    { value: 'linear', label: 'Linear' },
    { value: 'power', label: 'Power' },
    { value: 'log', label: 'Log' }
];

const NumberRow = ({ label, value, min, max, step, onChange, unit }: any) => (
    <div className="bg-black/20 p-2 rounded border border-gray-800">
        <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400 font-bold uppercase">{label}</span>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="w-14 bg-gray-800 border border-gray-600 rounded text-[9px] text-white text-center outline-none px-0.5"
                />
                {unit && <span className="text-[9px] text-gray-500">{unit}</span>}
            </div>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded appearance-none accent-emerald-500"
        />
    </div>
);

export const CurvedGeometryPanel: React.FC<CurvedGeometryPanelProps> = ({
    globalSettings,
    updateCurved,
    resetLatticeConfig
}) => {
    const config = (globalSettings.curvedGeometry || DEFAULT_SETTINGS.curvedGeometry) as CurvedGeometryConfig;
    const angleDeg = useMemo(() => (config.curveRadiansPerStep || 0) * (180 / Math.PI), [config.curveRadiansPerStep]);

    return (
        <div className="bg-gray-900/40 border border-emerald-900/40 rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-400 uppercase">Curved Geometry Mode</h3>
                <button
                    onClick={() => {
                        resetLatticeConfig();
                        updateCurved({ ...DEFAULT_SETTINGS.curvedGeometry });
                    }}
                    className="text-[9px] text-emerald-300 hover:text-white border border-emerald-900 px-2 py-0.5 rounded bg-emerald-950/30 font-bold active:scale-95 transition-transform"
                >
                    RESET CONFIG
                </button>
            </div>
            <div className="text-[9px] text-emerald-200/80 bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                Curved branches are positioned by pitch distance from center. Only odd gen0 axes are used while this mode is enabled.
            </div>

            <div className="flex items-center justify-between bg-black/30 p-2 rounded border border-gray-800">
                <span className="text-[9px] text-gray-400 font-bold uppercase">Enable Curved Geometry</span>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!config.enabled}
                        onChange={(e) => updateCurved({ enabled: e.target.checked })}
                        className="w-3 h-3 accent-emerald-500"
                    />
                    <span className="text-[9px] text-gray-400">{config.enabled ? 'On' : 'Off'}</span>
                </label>
            </div>

            {config.enabled && (
                <div className="space-y-3 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="bg-black/20 p-2 rounded border border-gray-800">
                            <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Pitch Metric</span>
                            <select
                                className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                value={config.pitchMetric}
                                onChange={(e) => updateCurved({ pitchMetric: e.target.value as CurvedGeometryConfig['pitchMetric'] })}
                            >
                                {METRIC_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="bg-black/20 p-2 rounded border border-gray-800">
                            <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Distance Mode</span>
                            <select
                                className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                value={config.distanceMode}
                                onChange={(e) => updateCurved({ distanceMode: e.target.value as CurvedGeometryConfig['distanceMode'] })}
                            >
                                {DISTANCE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <NumberRow
                        label="Distance Scale"
                        value={config.distanceScale}
                        min={0.5}
                        max={40}
                        step={0.5}
                        onChange={(value: number) => updateCurved({ distanceScale: value })}
                    />
                    <NumberRow
                        label="Distance Exponent"
                        value={config.distanceExponent}
                        min={0.2}
                        max={4}
                        step={0.1}
                        onChange={(value: number) => updateCurved({ distanceExponent: value })}
                    />
                    <NumberRow
                        label="Distance Offset"
                        value={config.distanceOffset}
                        min={0}
                        max={10}
                        step={0.1}
                        onChange={(value: number) => updateCurved({ distanceOffset: value })}
                    />
                    <NumberRow
                        label="Curve Angle / Step"
                        value={angleDeg}
                        min={0}
                        max={90}
                        step={1}
                        unit="deg"
                        onChange={(value: number) => updateCurved({ curveRadiansPerStep: (value * Math.PI) / 180 })}
                    />

                    <div className="bg-black/20 p-2 rounded border border-gray-800 flex items-center justify-between">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Auto Spacing</span>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.autoSpacing !== false}
                                onChange={(e) => updateCurved({ autoSpacing: e.target.checked })}
                                className="w-3 h-3 accent-emerald-500"
                            />
                            <span className="text-[9px] text-gray-400">{config.autoSpacing !== false ? 'On' : 'Off'}</span>
                        </label>
                    </div>
                    <NumberRow
                        label="Collision Padding (x radius)"
                        value={config.collisionPadding}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(value: number) => updateCurved({ collisionPadding: value })}
                    />
                </div>
            )}
        </div>
    );
};
