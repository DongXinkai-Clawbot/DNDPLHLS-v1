import React, { useMemo } from 'react';
import type { GeometryConfig, PrimeLimit } from '../../../types';
import { STANDARD_PRIMES, DEFAULT_SETTINGS } from '../../../constants';
import { CustomGeometryPreview } from './CustomGeometryPreview';

interface Props {
    config: GeometryConfig;
    onChange: (partial: Partial<GeometryConfig>) => void;
}

const InputControl = ({ label, value, min, max, step, onChange }: any) => (
    <div className="flex flex-col flex-1">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-gray-500 uppercase font-bold">{label}</span>
            <input
                type="number"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-10 bg-gray-800 border border-gray-600 rounded text-[9px] text-white text-center outline-none px-0.5"
            />
        </div>
        <input
            type="range" min={min} max={max} step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded appearance-none accent-indigo-500"
        />
    </div>
);

export const GeometrySettings = ({ config, onChange }: Props) => {
    const mode = config.mode || 'rectangle';
    const sphereConfig = config.sphere || DEFAULT_SETTINGS.geometry.sphere;
    const customConfig = config.custom || DEFAULT_SETTINGS.geometry.custom;
    const customParam = customConfig.parametric || DEFAULT_SETTINGS.geometry.custom!.parametric;

    const PRESET_EXPRESSIONS: Record<string, string> = {
        sphere: 'x^2 + y^2 + z^2 - 400',
        torus: '(sqrt(x^2 + y^2) - 20)^2 + z^2 - 25',
        helix: '(x - 18*cos(z/6))^2 + (y - 18*sin(z/6))^2 - 16',
        shell: 'sqrt(x^2 + y^2 + z^2) - (12 + 6*sin(3*atan2(y,x)))',
        octa: 'abs(x) + abs(y) + abs(z) - 30'
    };

    // Calculate predicted node count
    const predictedCount = useMemo(() => {
        if (mode === 'rectangle' || mode === 'custom') {
            const [d1, d2, d3] = config.dimensions;
            let baseCount = d1 * d2 * d3;

            // Add branch nodes for each gen level
            const branchLengths = config.branchLengths || {};
            let prevGenCount = baseCount;

            for (let gen = 1; gen <= 3; gen++) {
                const branch = branchLengths[gen] || { pos: 0, neg: 0 };
                const branchLength = branch.pos + branch.neg;
                if (branchLength > 0) {
                    // Each node in previous gen spawns branchLength new nodes
                    const newNodes = prevGenCount * branchLength;
                    baseCount += newNodes;
                    prevGenCount = newNodes;
                } else {
                    break; // No more branches if current gen has 0
                }
            }

            return baseCount;
        } else {
            // Sphere: approximate count based on radius
            const r = sphereConfig?.radius || 3;
            let count = 0;
            for (let s = -r; s <= r; s++) {
                const layerRadius = Math.floor(Math.sqrt(r * r - s * s));
                for (let a = -layerRadius; a <= layerRadius; a++) {
                    for (let b = -layerRadius; b <= layerRadius; b++) {
                        if (Math.sqrt(a * a + b * b + s * s) <= r) count++;
                    }
                }
            }
            return count;
        }
    }, [mode, config.dimensions, config.branchLengths, sphereConfig?.radius]);

    const updateLimit = (index: 0 | 1 | 2, newLimit: PrimeLimit) => {
        const newLimits = [...config.limits] as [PrimeLimit, PrimeLimit, PrimeLimit];
        newLimits[index] = newLimit;
        onChange({ limits: newLimits });
    };

    const updateDimension = (index: 0 | 1 | 2, newVal: number) => {
        const newDims = [...config.dimensions] as [number, number, number];
        newDims[index] = newVal;
        onChange({ dimensions: newDims });
    };

    const updateSphereLimit = (index: 0 | 1 | 2, newLimit: PrimeLimit) => {
        const current = sphereConfig || DEFAULT_SETTINGS.geometry.sphere;
        const newLimits = [...current.limits] as [PrimeLimit, PrimeLimit, PrimeLimit];
        newLimits[index] = newLimit;
        onChange({ sphere: { ...current, limits: newLimits } });
    };

    const updateSphere = (partial: Partial<typeof sphereConfig>) => {
        const current = sphereConfig || DEFAULT_SETTINGS.geometry.sphere;
        onChange({ sphere: { ...current, ...partial } });
    };

    const updateCustom = (partial: Partial<typeof customConfig>) => {
        const current = customConfig || DEFAULT_SETTINGS.geometry.custom;
        onChange({ custom: { ...current, ...partial } });
    };

    const updateCustomParam = (partial: Partial<typeof customParam>) => {
        const current = customConfig?.parametric || DEFAULT_SETTINGS.geometry.custom!.parametric;
        updateCustom({ parametric: { ...current, ...partial } });
    };

    return (
        <div className="bg-gray-800/60 p-3 rounded-lg border border-gray-700 mt-4">
            <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-3">
                <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    3D Shape Generator
                </h3>
                <label className="flex items-center gap-2 cursor-pointer bg-black/40 px-2 py-1 rounded hover:bg-black/60 transition-colors">
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => onChange({ enabled: e.target.checked })}
                        className="w-4 h-4 accent-indigo-500 rounded"
                    />
                    <span className="text-[10px] font-bold text-gray-300 uppercase">Enable</span>
                </label>
            </div>

            {config.enabled && (
                <div className="space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {/* Shape Selector */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => onChange({ mode: 'rectangle' })}
                            className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all ${mode === 'rectangle'
                                ? 'bg-indigo-600 border-indigo-400 text-white'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                                }`}
                        >
                            Rect
                        </button>
                        <button
                            onClick={() => onChange({ mode: 'custom' })}
                            className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all ${mode === 'custom'
                                ? 'bg-emerald-600 border-emerald-400 text-white'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                                }`}
                        >
                            Custom
                        </button>
                        <button
                            onClick={() => onChange({ mode: 'sphere' })}
                            className={`flex-1 py-2 rounded text-[10px] font-bold border transition-all ${mode === 'sphere'
                                ? 'bg-purple-600 border-purple-400 text-white'
                                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                                }`}
                        >
                            Sphere
                        </button>
                    </div>

                    {/* Common settings */}
                    <div className="flex items-center justify-between bg-black/20 p-2 rounded border border-gray-800">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">Harmonic Coloring</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.useHarmonicColors !== false}
                                onChange={(e) => onChange({ useHarmonicColors: e.target.checked })}
                                className="w-3 h-3 accent-indigo-500"
                            />
                            <span className="text-[9px] text-gray-400">{config.useHarmonicColors !== false ? 'On' : 'Off'}</span>
                        </label>
                    </div>

                    {/* Rectangle Mode */}
                    {(mode === 'rectangle' || mode === 'custom') && (
                        <div className="space-y-3">
                            <p className="text-[9px] text-gray-500 italic bg-indigo-900/10 p-2 rounded border border-indigo-900/30">
                                Defines the axis bounds for the lattice grid (used by Rectangle and Custom modes).
                            </p>

                            {[0, 1, 2].map((idx) => (
                                <div key={idx} className="bg-black/20 p-2 rounded border border-gray-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-[9px] font-bold uppercase ${idx === 0 ? 'text-red-400' : idx === 1 ? 'text-green-400' : 'text-blue-400'}`}>
                                            Axis {idx + 1}
                                        </span>
                                        <select
                                            className="bg-black border border-gray-700 text-[10px] text-white rounded p-1 outline-none"
                                            value={config.limits[idx as 0 | 1 | 2]}
                                            onChange={(e) => updateLimit(idx as 0 | 1 | 2, parseInt(e.target.value) as PrimeLimit)}
                                        >
                                            {STANDARD_PRIMES.map(p => <option key={p} value={p}>{p}-Limit</option>)}
                                        </select>
                                    </div>
                                    <InputControl
                                        label="Length"
                                        value={config.dimensions[idx as 0 | 1 | 2]}
                                        min={1} max={50} step={1}
                                        onChange={(v: number) => updateDimension(idx as 0 | 1 | 2, v)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                                        {/* Custom Mode */}
                    {mode === 'custom' && (
                        <div className="space-y-3">
                            <p className="text-[9px] text-gray-500 italic bg-emerald-900/10 p-2 rounded border border-emerald-900/30">
                                Custom shapes keep nodes that match your expression. Use a,b,c for lattice exponents, x,y,z for world coords.</p>
                            <div className="mt-2">
                                <CustomGeometryPreview />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="bg-black/20 p-2 rounded border border-gray-800">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Shape Style</span>
                                    <select
                                        className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                        value={customConfig.style}
                                        onChange={(e) => updateCustom({ style: e.target.value as any })}
                                    >
                                        <option value="implicit">Implicit Field</option>
                                        <option value="parametric">Parametric</option>
                                        <option value="voxel">Voxel/Mask</option>
                                        <option value="preset">Preset</option>
                                    </select>
                                </div>
                                <div className="bg-black/20 p-2 rounded border border-gray-800">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Input Space</span>
                                    <select
                                        className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                        value={customConfig.inputSpace}
                                        onChange={(e) => updateCustom({ inputSpace: e.target.value as any })}
                                    >
                                        <option value="lattice">Lattice (a,b,c)</option>
                                        <option value="world">World (x,y,z)</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                            </div>

                            {(customConfig.style === 'implicit' || customConfig.style === 'voxel') && (
                                <>
                                    <div className="bg-black/20 p-2 rounded border border-gray-800">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">
                                            {customConfig.style === 'voxel' ? 'Voxel Expression' : 'Implicit Expression'}
                                        </span>
                                        <textarea
                                            rows={2}
                                            value={customConfig.style === 'voxel' ? customConfig.voxelExpression : customConfig.implicitExpression}
                                            onChange={(e) => updateCustom(customConfig.style === 'voxel'
                                                ? { voxelExpression: e.target.value }
                                                : { implicitExpression: e.target.value })}
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-2 outline-none font-mono"
                                        />
                                    </div>
                                    {customConfig.style === 'implicit' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="bg-black/20 p-2 rounded border border-gray-800">
                                                <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Threshold Mode</span>
                                                <select
                                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                                    value={customConfig.thresholdMode}
                                                    onChange={(e) => updateCustom({ thresholdMode: e.target.value as any })}
                                                >
                                                    <option value="lte0">F &lt;= 0</option>
                                                    <option value="abs">|F| &lt;= eps</option>
                                                </select>
                                            </div>
                                            {customConfig.thresholdMode === 'abs' && (
                                                <InputControl
                                                    label="Epsilon"
                                                    value={customConfig.epsilon}
                                                    min={0.05} max={10} step={0.05}
                                                    onChange={(v: number) => updateCustom({ epsilon: v })}
                                                />
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {customConfig.style === 'preset' && (
                                <div className="space-y-2">
                                    <div className="bg-black/20 p-2 rounded border border-gray-800">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Preset</span>
                                        <select
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                            value={customConfig.presetId}
                                            onChange={(e) => {
                                                const id = e.target.value;
                                                updateCustom({
                                                    presetId: id,
                                                    implicitExpression: PRESET_EXPRESSIONS[id] || customConfig.implicitExpression
                                                });
                                            }}
                                        >
                                            {Object.keys(PRESET_EXPRESSIONS).map((key) => (
                                                <option key={key} value={key}>{key}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded border border-gray-800 text-[9px] text-gray-500 font-mono">
                                        {customConfig.implicitExpression}
                                    </div>
                                </div>
                            )}

                            {customConfig.style === 'parametric' && (
                                <div className="space-y-2">
                                    <div className="bg-black/20 p-2 rounded border border-gray-800">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Parametric Mode</span>
                                        <select
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                            value={customParam.mode}
                                            onChange={(e) => updateCustomParam({ mode: e.target.value as any })}
                                        >
                                            <option value="curve">Curve (t)</option>
                                            <option value="surface">Surface (u,v)</option>
                                        </select>
                                    </div>
                                    <div className="bg-black/20 p-2 rounded border border-gray-800">
                                        <span className="text-[9px] text-gray-400 font-bold uppercase block mb-1">Vector Expression</span>
                                        <textarea
                                            rows={2}
                                            value={customParam.expression}
                                            onChange={(e) => updateCustomParam({ expression: e.target.value })}
                                            className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-2 outline-none font-mono"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <InputControl label="U Min" value={customParam.uMin} min={-50} max={50} step={0.5} onChange={(v: number) => updateCustomParam({ uMin: v })} />
                                        <InputControl label="U Max" value={customParam.uMax} min={-50} max={50} step={0.5} onChange={(v: number) => updateCustomParam({ uMax: v })} />
                                        <InputControl label="U Steps" value={customParam.uSteps} min={8} max={240} step={1} onChange={(v: number) => updateCustomParam({ uSteps: v })} />
                                        {customParam.mode === 'surface' && (
                                            <>
                                                <InputControl label="V Min" value={customParam.vMin} min={-50} max={50} step={0.5} onChange={(v: number) => updateCustomParam({ vMin: v })} />
                                                <InputControl label="V Max" value={customParam.vMax} min={-50} max={50} step={0.5} onChange={(v: number) => updateCustomParam({ vMax: v })} />
                                                <InputControl label="V Steps" value={customParam.vSteps} min={6} max={200} step={1} onChange={(v: number) => updateCustomParam({ vSteps: v })} />
                                            </>
                                        )}
                                    </div>
                                    <InputControl label="Thickness" value={customParam.thickness} min={1} max={50} step={0.5} onChange={(v: number) => updateCustomParam({ thickness: v })} />
                                </div>
                            )}
                        </div>
                    )}
                    {/* Sphere Mode */}
                    {mode === 'sphere' && (
                        <div className="space-y-3">
                            <p className="text-[9px] text-gray-500 italic bg-purple-900/10 p-2 rounded border border-purple-900/30">
                                Generates a spherical lattice with 2D planes stacked along the structuring axis.
                            </p>

                            <div className="bg-black/20 p-2 rounded border border-gray-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[9px] text-purple-300 font-bold uppercase">Radius</span>
                                    <input
                                        type="number"
                                        min={1} max={20}
                                        value={sphereConfig?.radius || 3}
                                        onChange={(e) => updateSphere({ radius: parseInt(e.target.value) || 3 })}
                                        className="w-12 bg-gray-800 border border-gray-600 rounded text-[10px] text-white text-center"
                                    />
                                </div>
                                <input
                                    type="range" min={1} max={10} step={1}
                                    value={sphereConfig?.radius || 3}
                                    onChange={(e) => updateSphere({ radius: parseInt(e.target.value) })}
                                    className="w-full h-1 bg-gray-700 rounded appearance-none accent-purple-500"
                                />
                            </div>

                            <div className="bg-black/20 p-2 rounded border border-gray-800">
                                <span className="text-[9px] text-gray-400 font-bold uppercase block mb-2">Structuring Axis (Stacking)</span>
                                <select
                                    className="w-full bg-black border border-gray-700 text-[10px] text-white rounded p-1.5 outline-none"
                                    value={sphereConfig?.structuringAxis || 3}
                                    onChange={(e) => updateSphere({ structuringAxis: parseInt(e.target.value) as PrimeLimit })}
                                >
                                    {(sphereConfig?.limits || [3, 5, 7]).map(p => (
                                        <option key={p} value={p}>{p}-Limit Axis</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map((idx) => (
                                    <div key={idx} className="bg-black/20 p-2 rounded border border-gray-800">
                                        <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">
                                            Limit {idx + 1}
                                        </span>
                                        <select
                                            className="w-full bg-black border border-gray-700 text-[9px] text-white rounded p-1 outline-none"
                                            value={(sphereConfig?.limits || [3, 5, 7])[idx]}
                                            onChange={(e) => updateSphereLimit(idx as 0 | 1 | 2, parseInt(e.target.value) as PrimeLimit)}
                                        >
                                            {STANDARD_PRIMES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Predicted count */}
                    <div className="flex justify-between items-center bg-black/30 p-2 rounded border border-gray-700">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Predicted Nodes</span>
                        <span className="text-[10px] text-indigo-300 font-mono font-bold">{predictedCount.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};









