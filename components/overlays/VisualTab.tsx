
import React from 'react';
import type { PrimeLimit, NodeShape, NodeMaterial } from '../../types';
import { getPerformancePolicy } from '../../utils/performancePolicy';
import { useStore } from '../../store';
import { buildDiagnosticsPackage } from '../../utils/diagnostics';
import { copyJsonToClipboard, downloadJson } from '../../utils/download';
import { notifySuccess, notifyWarning } from '../../utils/notifications';

export const VisualTab = ({ settings, updateVisualSettings, handleImageUpload, fileInputRef, onInteractionStart, onInteractionEnd }: any) => {
    const perfPolicy = React.useMemo(() => getPerformancePolicy(), []);
    const renderScale = Number.isFinite(settings.visuals.renderScale) ? settings.visuals.renderScale : 1;
    const spacingPrimes = React.useMemo(() => {
        const standard = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].filter(p => p <= settings.maxPrimeLimit);
        const custom = (settings.customPrimes || [])
            .map((cp: any) => cp.prime)
            .filter((p: number) => Number.isFinite(p) && p >= 3);
        return Array.from(new Set([...standard, ...custom])).sort((a, b) => a - b);
    }, [settings.maxPrimeLimit, settings.customPrimes]);

    const chromaPrimes: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const handleDownloadDiagnostics = React.useCallback(() => {
        downloadJson(`diagnostics-${Date.now()}.json`, buildDiagnosticsPackage(useStore.getState()));
        notifySuccess('Diagnostics exported.', 'Diagnostics');
    }, []);

    const handleCopyDiagnostics = React.useCallback(async () => {
        const ok = await copyJsonToClipboard(buildDiagnosticsPackage(useStore.getState()));
        if (ok) notifySuccess('Diagnostics copied to clipboard.', 'Diagnostics');
        else notifyWarning('Clipboard not available.', 'Diagnostics');
    }, []);

    const hslToHex = (h: number, s: number, l: number) => {
        const sNorm = s / 100;
        const lNorm = l / 100;
        const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = lNorm - c / 2;
        let r = 0, g = 0, b = 0;
        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }
        const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const applyDistinctLimitColors = () => {
        const count = chromaPrimes.length;
        if (!count) return;
        const step = 360 / count;
        const next = { ...settings.visuals.limitColors } as any;
        chromaPrimes.forEach((p, i) => {
            const hue = (i * step) % 360;
            next[p] = hslToHex(hue, 72, 52);
        });
        updateVisualSettings({ limitColors: next }, true);
    };

        return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-3 bg-gray-800/40 border border-gray-700 rounded-lg space-y-3">
                <h4 className="text-[10px] font-black text-white uppercase mb-1 flex items-center gap-2">
                    <span className="text-lg">☀️</span>
                    Environmental Lighting
                </h4>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Global Brightness</span>
                        <span className="text-[10px] font-mono text-white">{((settings.visuals.globalBrightness ?? 1.0) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        // Prevent a fully-black scene. A tiny non-zero floor keeps the lattice visible
                        // while still allowing very dim lighting.
                        type="range" min="0.05" max="3" step="0.05"
                        value={settings.visuals.globalBrightness ?? 1.0}
                        onPointerDown={onInteractionStart}
                        onPointerUp={onInteractionEnd}
                        onChange={(e) => updateVisualSettings({ globalBrightness: parseFloat(e.target.value) }, true, false)}
                        className="w-full h-1.5 accent-yellow-500 appearance-none bg-gray-700 rounded cursor-pointer"
                    />
                </div>
            </div>

            {
                settings.visuals.layoutMode === 'lattice' && (
                    <div className="p-3 bg-gray-800/40 border border-gray-700 rounded-lg">
                        <h4 className="text-[10px] font-black text-white uppercase mb-3 flex items-center gap-2">
                            <span className="text-xl">⚖️</span>
                            The Temperament Overlay
                        </h4>
                        <p className="text-[9px] text-gray-400 mb-3 italic leading-relaxed">
                            Activate the EDO Reference Layer to see the grid superimposed on your lattice. Use the slider to transition between natural Prime Resonance and modern Equal Temperament.
                        </p>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 cursor-pointer bg-black/40 p-2 rounded border border-gray-700 hover:bg-black/60 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={settings.visuals.showGhostGrid}
                                    onChange={(e) => updateVisualSettings({ showGhostGrid: e.target.checked }, true)}
                                    className="w-4 h-4 accent-gray-500"
                                />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-200 uppercase">Show Ghost Grid</span>
                                    <span className="text-[8px] text-gray-500">Visualizes the "Perfect" piano key positions</span>
                                </div>
                            </label>

                            {settings.visuals.showGhostGrid && (
                                <div className="bg-black/20 p-2 rounded border border-gray-700/50 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Ghost Transparency</span>
                                        <span className="text-[10px] font-mono text-white">{(settings.visuals.ghostOpacity * 100).toFixed(0)}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.01"
                                        value={settings.visuals.ghostOpacity}
                                        onPointerDown={onInteractionStart}
                                        onPointerUp={onInteractionEnd}
                                        onChange={(e) => updateVisualSettings({ ghostOpacity: parseFloat(e.target.value) }, true, false)}
                                        className="w-full h-1 accent-gray-500 appearance-none bg-gray-700 rounded cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-gray-900/50 p-2 rounded">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">Reference Tuning</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="1" max="100"
                                        value={settings.visuals.tetDivisions || 12}
                                        onChange={(e) => updateVisualSettings({ tetDivisions: parseInt(e.target.value) }, true)}
                                        className="w-10 bg-black border border-gray-600 rounded text-xs text-center text-white"
                                    />
                                    <span className="text-[9px] text-gray-500 font-bold">-EDO</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-blue-300 uppercase">Temperament Morph</span>
                                    <span className="text-[10px] font-mono text-white">{(settings.visuals.temperamentMorph * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={settings.visuals.temperamentMorph}
                                    onPointerDown={onInteractionStart}
                                    onPointerUp={onInteractionEnd}
                                    onChange={(e) => updateVisualSettings({ temperamentMorph: parseFloat(e.target.value) }, true, false)}
                                    className="w-full h-1.5 accent-blue-500 appearance-none bg-gray-700 rounded cursor-pointer"
                                />
                                <div className="flex justify-between text-[8px] text-gray-500 mt-1 font-bold uppercase">
                                    <span>Just Intonation (Pure)</span>
                                    <span>{settings.visuals.tetDivisions || 12}-TET (Avg)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            <div className="border-b border-gray-800 pb-4 px-1">
                <label className="text-[10px] text-gray-500 block mb-2 uppercase font-black">Rendering Engine</label>
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold">
                        <span>Render Scale</span>
                        <span className="text-blue-400">{Math.round(renderScale * 100)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.05"
                        value={renderScale}
                        onPointerDown={onInteractionStart}
                        onPointerUp={onInteractionEnd}
                        onChange={(e) => updateVisualSettings({ renderScale: parseFloat(e.target.value) }, true, false)}
                        className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                    />
                    <div className="flex justify-between text-[8px] text-gray-500 mt-1 font-bold uppercase">
                        <span>Lower = Faster</span>
                        <span>Higher = Sharper</span>
                    </div>
                </div>
                <div className="flex bg-black rounded p-0.5 mb-3 border border-gray-800">
                    <button onClick={() => updateVisualSettings({ lineRenderingMode: 'performance' }, true)} className={`flex-1 text-[10px] py-1.5 rounded font-bold ${settings.visuals.lineRenderingMode === 'performance' ? 'bg-blue-900 text-blue-200' : 'text-gray-500'}`}>Performance (Fast)</button>
                    <button onClick={() => updateVisualSettings({ lineRenderingMode: 'quality' }, true)} className={`flex-1 text-[10px] py-1.5 rounded font-bold ${settings.visuals.lineRenderingMode === 'quality' ? 'bg-blue-900 text-blue-200' : 'text-gray-500'}`}>Quality (HD)</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[9px] text-gray-500 block mb-1 uppercase">Node Shape</label>
                        <select value={settings.visuals.nodeShape} onChange={(e) => updateVisualSettings({ nodeShape: e.target.value as NodeShape }, true)} className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none">
                            <option value="lowpoly">Low Poly</option>
                            <option value="sphere">HD Sphere</option>
                            <option value="cube">Digital Cube</option>
                            <option value="diamond">Diamond Octa</option>
                            <option value="tetra">Tetrahedron</option>
                            <option value="point">Minimal Point</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Node Color Mode</label>
                        <select value={settings.visuals.nodeColorMode || 'limit'} onChange={(e) => updateVisualSettings({ nodeColorMode: e.target.value as any }, true)} className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none">
                            <option value="limit">Prime Limit (Standard)</option>
                            <option value="harmonic">Harmonic Chroma (H-Chroma)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] text-gray-500 block mb-1 uppercase">Material FX</label>
                        <select value={settings.visuals.nodeMaterial} onChange={(e) => updateVisualSettings({ nodeMaterial: e.target.value as NodeMaterial }, true)} className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none">
                            <option value="basic">Unlit Basic</option>
                            <option value="lambert">Matte Lambert</option>
                            <option value="phong">Glossy Phong</option>
                            <option value="standard">Standard PBR</option>
                            <option value="toon">Cel Shaded</option>
                            <option value="normal">Normal Visualizer</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={settings.visuals.enableFog} onChange={e => updateVisualSettings({ enableFog: e.target.checked }, true)} className="w-4 h-4 accent-blue-500" />
                    <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors uppercase font-bold">Atmospheric Depth Fog</span>
                </label>
                <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-800">
                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold"><span>Visibility Horizon</span><span className="text-blue-400">Gen {settings.visuals.maxVisibleGen}</span></div>
                        <input type="range" min="0" max="4" step="1" value={settings.visuals.maxVisibleGen} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => updateVisualSettings({ maxVisibleGen: parseInt(e.target.value) }, true, false)} className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded" />
                    </div>
                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold"><span>Node Diameter</span><span className="text-blue-400">{settings.visuals.nodeScale.toFixed(2)}x</span></div>
                        <input type="range" min="0.1" max="2.5" step="0.05" value={settings.visuals.nodeScale} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => updateVisualSettings({ nodeScale: parseFloat(e.target.value) }, true, false)} className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded" />
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] text-gray-500 mb-1 uppercase font-bold"><span>Interval Opacity</span><span className="text-blue-400">{Math.round(settings.visuals.edgeOpacity * 100)}%</span></div>
                        <input type="range" min="0" max="1" step="0.02" value={settings.visuals.edgeOpacity} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => updateVisualSettings({ edgeOpacity: parseFloat(e.target.value) }, true, false)} className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded" />
                    </div>
                </div>

                <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-800 space-y-2">
                    <h4 className="text-[10px] font-black text-gray-200 uppercase tracking-widest">Node Surface Labels</h4>
                    <label className="flex items-center justify-between gap-3 cursor-pointer bg-black/30 p-2 rounded border border-gray-800 hover:bg-black/50 transition-colors">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-200 uppercase">Print Labels On Nodes</span>
                            <span className="text-[9px] text-gray-500">Renders ratio or harmonic text on node surfaces (can be heavy for huge lattices).</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={!!settings.visuals.nodeSurfaceRatioLabelsEnabled}
                            onChange={(e) => updateVisualSettings({ nodeSurfaceRatioLabelsEnabled: e.target.checked }, true)}
                            className="w-4 h-4 accent-blue-500"
                        />
                    </label>

                    {!!settings.visuals.nodeSurfaceRatioLabelsEnabled && (
                        <div className="space-y-2 pt-1">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Textured Nodes</label>
                                    <select
                                        value={settings.visuals.nodeSurfaceRatioTexturedMode || 'both'}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioTexturedMode: e.target.value as any }, true)}
                                        className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                                    >
                                        <option value="both">Show Both</option>
                                        <option value="ratioOnly">Ratio Only (Hide Texture)</option>
                                        <option value="textureOnly">Texture Only (Hide Ratio)</option>
                                    </select>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] text-gray-500 mb-1 uppercase font-bold">
                                        <span>Font Scale</span>
                                        <span className="text-blue-400">{(settings.visuals.nodeSurfaceRatioFontScale ?? 0.55).toFixed(2)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.2"
                                        max="1.5"
                                        step="0.05"
                                        value={settings.visuals.nodeSurfaceRatioFontScale ?? 0.55}
                                        onPointerDown={onInteractionStart}
                                        onPointerUp={onInteractionEnd}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioFontScale: parseFloat(e.target.value) }, true, false)}
                                        className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Placement</label>
                                    <select
                                        value={settings.visuals.nodeSurfaceRatioPlacement || 'surface'}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioPlacement: e.target.value as any }, true)}
                                        className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                                    >
                                        <option value="surface">On Surface (Camera-Facing)</option>
                                        <option value="above">Above Node</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Label Mode</label>
                                    <select
                                        value={settings.visuals.nodeSurfaceRatioLabelMode || 'ratio'}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioLabelMode: e.target.value as any }, true)}
                                        className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                                    >
                                        <option value="ratio">Ratio</option>
                                        <option value="harmonic">Harmonic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Label Filter</label>
                                    <select
                                        value={settings.visuals.nodeSurfaceRatioFilterMode || 'all'}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioFilterMode: e.target.value as any }, true)}
                                        className="w-full bg-gray-900 border border-gray-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                                    >
                                        <option value="all">All Nodes</option>
                                        <option value="nearCenter">Near 1/1 (by pitch)</option>
                                        <option value="mainAxis">Main Axis Only (Gen 0)</option>
                                        <option value="nearCenterAndMainAxis">Near 1/1 + Main Axis</option>
                                    </select>
                                </div>
                            </div>
                            {(settings.visuals.nodeSurfaceRatioLabelMode || 'ratio') === 'harmonic' && (
                                <label className="flex items-center gap-2 text-[9px] text-gray-500 uppercase font-bold">
                                    <input
                                        type="checkbox"
                                        checked={!!settings.visuals.nodeSurfaceRatioEmphasizePrimes}
                                        onChange={(e) => updateVisualSettings({ nodeSurfaceRatioEmphasizePrimes: e.target.checked }, true)}
                                        className="w-3 h-3 accent-blue-500"
                                    />
                                    Emphasize Primes
                                </label>
                            )}
                            {(settings.visuals.nodeSurfaceRatioFilterMode === 'nearCenter' || settings.visuals.nodeSurfaceRatioFilterMode === 'nearCenterAndMainAxis') && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-gray-500 uppercase font-bold">Near 1/1 Count</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="500"
                                            value={settings.visuals.nodeSurfaceRatioNearCenterCount ?? 50}
                                            onChange={(e) => updateVisualSettings({ nodeSurfaceRatioNearCenterCount: Math.max(1, parseInt(e.target.value) || 50) }, true)}
                                            className="w-16 bg-black border border-gray-600 rounded text-[10px] text-center text-white p-1"
                                        />
                                    </div>
                                    <p className="text-[8px] text-gray-600 mt-1">Nodes closest to 1/1 by pitch (cents). Not spatial position.</p>
                                </div>
                            )}
                            <div className="text-[9px] text-gray-500 mt-2">
                                Per-node overrides live in <span className="text-gray-300 font-bold">DETAILS</span> (selected node).
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase mb-3 tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>Spatial Proportions</h4>
                    <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase"><span>Overall Scale</span><span className="text-white">{settings.visuals.globalScale.toFixed(1)}x</span></div>
                        <input type="range" min="0.1" max="4.0" step="0.1" value={settings.visuals.globalScale} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => updateVisualSettings({ globalScale: parseFloat(e.target.value) }, true, false)} className="w-full h-1 accent-white appearance-none cursor-pointer bg-gray-700 rounded" />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {spacingPrimes.map(p => (
                            <div key={p}>
                                <div className="flex justify-between text-[9px] text-gray-500 mb-0.5 uppercase"><span>{p}-Vector</span><span className="text-white">{(settings.visuals.primeSpacings as any)[p]?.toFixed(2) || 1.00}</span></div>
                                <input type="range" min="0.2" max="2.5" step="0.05" value={(settings.visuals.primeSpacings as any)[p] || 1} onPointerDown={onInteractionStart} onPointerUp={onInteractionEnd} onChange={e => updateVisualSettings({ primeSpacings: { ...settings.visuals.primeSpacings, [p]: parseFloat(e.target.value) } }, true, false)} className="w-full h-1 accent-gray-500 appearance-none cursor-pointer bg-gray-700 rounded" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-3 bg-gray-900 border border-gray-800 rounded-lg">
                    <label className="block text-[10px] text-gray-500 mb-2 uppercase font-black">Environment Skin</label>
                    <input type="file" ref={fileInputRef} accept="image/*" autoComplete="off" onChange={handleImageUpload} className="hidden" />
                    <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[10px] py-2 px-3 rounded border border-gray-700 font-bold transition-colors">{settings.visuals.backgroundImageUrl ? "Switch Background" : "Upload Custom Skybox"}</button>
                        {settings.visuals.backgroundImageUrl && <button onClick={() => updateVisualSettings({ backgroundImageUrl: null }, true)} className="bg-red-900/40 hover:bg-red-800 text-red-400 px-3 rounded border border-red-900/30 text-[10px]">✕</button>}
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Chromatic Identity (Prime Limits)</label>
                        <button
                            onClick={applyDistinctLimitColors}
                            className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
                        >
                            Auto Distinct
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {chromaPrimes.map(p => (
                            <div key={p} className="flex flex-col items-center gap-1">
                                <input type="color" value={settings.visuals.limitColors[p as PrimeLimit]} onChange={e => updateVisualSettings({ limitColors: { ...settings.visuals.limitColors, [p]: e.target.value } }, true)} className="w-10 h-7 border border-gray-700 p-0.5 bg-gray-800 cursor-pointer rounded-md overflow-hidden hover:scale-110 transition-transform" />
                                <span className="text-[9px] text-gray-500 font-mono font-bold">{p}L</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg space-y-2">
                    <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Performance Tier</h4>
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span>Tier</span>
                        <span className="text-gray-200 font-bold">{perfPolicy.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[9px] text-gray-500">
                        <div className="flex items-center justify-between">
                            <span>Max Nodes</span>
                            <span className="text-gray-300 font-mono">{perfPolicy.maxNodes}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Polyphony</span>
                            <span className="text-gray-300 font-mono">{perfPolicy.maxPolyphony}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Unison Cap</span>
                            <span className="text-gray-300 font-mono">{perfPolicy.unisonMax}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span>Render</span>
                            <span className="text-gray-300 font-mono">{perfPolicy.render.lineRenderingMode}</span>
                        </div>
                    </div>
                </div>
                <div className="p-3 bg-gray-900/40 border border-gray-800 rounded-lg space-y-2">
                    <h4 className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Diagnostics</h4>
                    <div className="text-[9px] text-gray-500">
                        Export a package with settings, device capabilities, and recent logs.
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadDiagnostics}
                            className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-200 hover:bg-gray-700"
                        >
                            Download
                        </button>
                        <button
                            onClick={handleCopyDiagnostics}
                            className="flex-1 rounded-md border border-gray-700 bg-black/40 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-300 hover:bg-gray-800"
                        >
                            Copy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
