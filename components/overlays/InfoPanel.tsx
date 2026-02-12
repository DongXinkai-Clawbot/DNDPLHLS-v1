import React from 'react';
import { formatRatio, expandCompositePrimeVector, generatePrimeColor } from '../../musicLogic';
import { BranchDrawingCanvas } from './BranchDrawingCanvas';
import { playNote, playSimultaneous } from '../../audioEngine';
import type { NodeData } from '../../types';
import { createLogger } from '../../utils/logger';
import { openConfirm } from '../../utils/notifications';

import { derivedCommaId } from '../../store/logic/keyboard';
import { useInfoPanelState } from './infoPanel/useInfoPanelState';

const log = createLogger('ui/info-panel');

export const InfoPanel = () => {
    const {
        selectedNode,
        settings,
        updateSettings,
        regenerateLattice,
        selectNode,
        selectNearbyNode,
        setCenter,
        addSecondaryOrigin,
        removeSecondaryOrigin,
        nodes,
        addToKeyboard,
        addToComparison,
        isIsolationMode,
        toggleIsolationMode,
        setCommaLines,
        commaLines,
        triggerLocate,
        deleteCustomCommaById,
        nearbyNodes,
        undoSelection,
        redoSelection,
        historyIndex,
        selectionHistory,
        isMobile,
        nodeTextureInputRef,
        commaSearch,
        setCommaSearch,

        customCommaN,
        setCustomCommaN,
        customCommaD,
        setCustomCommaD,
        customCommaName,
        setCustomCommaName,
        editingCommaId,
        editingCommaName,
        setEditingCommaId,
        setEditingCommaName,
        startRenaming,
        applyRename,
        isRenamingNode,
        setIsRenamingNode,
        editLatticeName,
        setEditLatticeName,
        editPanelName,
        setEditPanelName,
        editShowOriginal,
        setEditShowOriginal,
        isOrigin,
        hasMultipleOrigins,
        isInKeyboard,
        oddHarmonicInfo,
        commaSpreadingInfo,
        rootNode,
        commaResults,
        isStacked,
        handleTextureUpload,
        locateOrigin,
        showComma,
        fillCustomCommaFromComparison,
        findCustomComma,
        saveCurrentComma,
        surfaceLabelsEnabled,
        surfaceOverride,
        hasNodeTexture,
        ratioSelectValue,
        textureSelectValue,
        hasFontOverride,
        displayRatio,
        displayName,
        displayOriginalName,
        shouldShowOriginal,
        startNodeRenaming,
        saveNodeRenaming,
        setNodeSurfaceLabelOverride,
        clearNodeSurfaceLabelOverride,
        maskNode
    } = useInfoPanelState();

    const [axisLimitInput, setAxisLimitInput] = React.useState("");
    const [axisNegInput, setAxisNegInput] = React.useState("0");
    const [axisPosInput, setAxisPosInput] = React.useState("0");

    const [drawingLimit, setDrawingLimit] = React.useState<number | null>(null);

    const formatRatioLimited = (ratio: { n: bigint; d: bigint }, maxDigits: number = 20) => {
        const nStr = ratio.n.toString();
        const dStr = ratio.d.toString();

        const toIndexForm = (s: string) => {
            if (s.length <= maxDigits) return s;
            const exponent = s.length - 1;
            const mantissa = s.length > 2 ? `${s[0]}.${s.slice(1, 3)}` : s[0];
            return `${mantissa}*10^${exponent}`;
        };

        if (nStr.length <= maxDigits && dStr.length <= maxDigits) {
            return `${nStr}/${dStr}`;
        }

        return `${toIndexForm(nStr)}/${toIndexForm(dStr)}`;
    };

    const clampBranchLen = (value: number) => Math.max(0, Math.min(50, Math.floor(value)));
    const geometryConfig = settings.geometry || {};
    const overrideMap = geometryConfig.nodeBranchOverrides || {};
    const selectedNodeId = selectedNode?.id ?? '';
    const currentOverride = selectedNodeId ? (overrideMap[selectedNodeId] || { pos: 0, neg: 0, axisOverrides: {} }) : { pos: 0, neg: 0, axisOverrides: {} };
    const currentAxisOverrides = currentOverride.axisOverrides || {};
    const axisOverrideEntries = Object.entries(currentAxisOverrides)
        .map(([key, value]) => ({ limit: parseInt(key, 10), pos: value?.pos ?? 0, neg: value?.neg ?? 0 }))
        .filter(entry => Number.isFinite(entry.limit))
        .sort((a, b) => a.limit - b.limit);
    const [pendingBranchPos, setPendingBranchPos] = React.useState<number>(currentOverride.pos ?? 0);
    const [pendingBranchNeg, setPendingBranchNeg] = React.useState<number>(currentOverride.neg ?? 0);

    React.useEffect(() => {
        setPendingBranchPos(currentOverride.pos ?? 0);
        setPendingBranchNeg(currentOverride.neg ?? 0);
    }, [selectedNodeId, currentOverride.pos, currentOverride.neg]);



    const updateNodeOverride = (nextOverride: any, nextCustomPrimes?: any[]) => {
        if (!selectedNode) return;
        const nextSettings: any = {
            geometry: {
                ...geometryConfig,
                nodeBranchOverrides: { ...overrideMap, [selectedNode.id]: nextOverride }
            }
        };
        if (nextCustomPrimes) {
            nextSettings.customPrimes = nextCustomPrimes;
        }
        updateSettings(nextSettings);
        regenerateLattice();
    };

    const ensureCustomPrime = (oddLimit: number) => {
        const standardSet = new Set([3, 5, 7, 11, 13, 17, 19, 23, 29, 31]);
        const existing = settings.customPrimes || [];
        const existingSet = new Set(existing.map((cp: any) => cp.prime));
        const nextCustom = [...existing];
        if (!standardSet.has(oddLimit) && !existingSet.has(oddLimit)) {
            nextCustom.push({ prime: oddLimit, color: generatePrimeColor(oddLimit) });
            existingSet.add(oddLimit);
        }
        return nextCustom;
    };

    const updateBranchLengths = (pos: number, neg: number) => {
        updateNodeOverride({
            ...currentOverride,
            pos: clampBranchLen(pos),
            neg: clampBranchLen(neg),
            axisOverrides: { ...currentAxisOverrides }
        });
    };

    // Real-time auto-commit removed in favor of Apply button.
    // Sync local state when selection changes, but don't auto-save pending changes.
    React.useEffect(() => {
        setPendingBranchPos(currentOverride.pos ?? 0);
        setPendingBranchNeg(currentOverride.neg ?? 0);
    }, [selectedNodeId, currentOverride.pos, currentOverride.neg]);

    const addAxisOverride = () => {
        const rawLimit = Math.abs(parseInt(axisLimitInput, 10));
        if (!Number.isFinite(rawLimit) || rawLimit <= 1 || rawLimit % 2 === 0) return;
        const pos = clampBranchLen(parseInt(axisPosInput, 10) || 0);
        const neg = clampBranchLen(parseInt(axisNegInput, 10) || 0);
        const nextOverride = {
            ...currentOverride,
            axisOverrides: { ...currentAxisOverrides, [rawLimit]: { pos, neg } }
        };
        const nextCustom = ensureCustomPrime(rawLimit);
        if (nextCustom.length !== (settings.customPrimes || []).length) {
            updateNodeOverride(nextOverride, nextCustom);
        } else {
            updateNodeOverride(nextOverride);
        }
    };


    const updateAxisOverride = (limit: number, pos: number, neg: number) => {
        if (!Number.isFinite(limit) || limit <= 1 || limit % 2 === 0) return;
        const nextOverride = {
            ...currentOverride,
            axisOverrides: { ...currentAxisOverrides, [limit]: { pos: clampBranchLen(pos), neg: clampBranchLen(neg) } }
        };
        const nextCustom = ensureCustomPrime(limit);
        if (nextCustom.length !== (settings.customPrimes || []).length) {
            updateNodeOverride(nextOverride, nextCustom);
        } else {
            updateNodeOverride(nextOverride);
        }
    };

    const removeAxisOverride = (limit: number) => {
        const nextAxis = { ...currentAxisOverrides };
        delete nextAxis[limit];
        updateNodeOverride({ ...currentOverride, axisOverrides: nextAxis });
    };

    const handleSaveCurve = (limit: number, points: any[]) => {
        const nextAxis = { ...currentAxisOverrides };
        nextAxis[limit] = { ...(nextAxis[limit] || { pos: settings.expansionB, neg: settings.expansionB }), customCurve: { points } };
        updateNodeOverride({ ...currentOverride, axisOverrides: nextAxis });
        setDrawingLimit(null);
    };



    if (!selectedNode) {
        return (
            <div className="flex h-full w-full items-center justify-center text-gray-500 text-xs italic bg-gray-900/50 p-4 text-center">
                Select a node in the lattice to view harmonic properties.
            </div>
        );
    }

    return (
        <>
            {drawingLimit && (
                <BranchDrawingCanvas
                    limit={drawingLimit}
                    onCancel={() => setDrawingLimit(null)}
                    onSave={(pts) => handleSaveCurve(drawingLimit, pts)}
                    initialPoints={currentAxisOverrides[drawingLimit]?.customCurve?.points}
                />
            )}
            <div className={`flex h-full w-full overflow-hidden bg-gray-900/50 ${isStacked ? 'flex-col' : 'flex-row'}`}>
                <div className={`${isStacked ? (isMobile ? 'w-full border-b max-h-[45vh] flex-none' : 'w-full border-b max-h-[50%]') : 'w-1/3 min-w-[220px] border-r h-full'} border-gray-800 flex flex-col relative bg-black/20 overflow-hidden`}>
                    <div className="p-3 overflow-y-auto custom-scrollbar flex-1">
                        <div className="mb-4">
                            {isRenamingNode ? (
                                <div className="bg-gray-900/80 p-3 rounded border border-blue-500/50 space-y-2 mb-2">
                                    <h4 className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1">Rename Node</h4>

                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Lattice Label</label>
                                        <input
                                            className="w-full bg-black border border-gray-700 rounded text-xs text-white p-1.5 focus:border-blue-500 outline-none"
                                            value={editLatticeName}
                                            onChange={e => setEditLatticeName(e.target.value)}
                                            placeholder={selectedNode.name}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Info Panel Name</label>
                                        <input
                                            className="w-full bg-black border border-gray-700 rounded text-xs text-white p-1.5 focus:border-blue-500 outline-none"
                                            value={editPanelName}
                                            onChange={e => setEditPanelName(e.target.value)}
                                            placeholder={selectedNode.name}
                                        />
                                    </div>

                                    <label className="flex items-center gap-2 text-[9px] text-gray-400 font-bold uppercase cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editShowOriginal}
                                            onChange={e => setEditShowOriginal(e.target.checked)}
                                            className="accent-blue-500"
                                        />
                                        Show Original Name in Panel
                                    </label>

                                    <div className="flex gap-2 pt-1">
                                        <button onClick={saveNodeRenaming} className="flex-1 bg-blue-800 hover:bg-blue-700 text-white text-[10px] py-1.5 rounded font-black uppercase transition-all">Save</button>
                                        <button onClick={() => setIsRenamingNode(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] py-1.5 rounded font-black uppercase transition-all">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group relative">
                                    <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-none mb-1 truncate flex items-baseline gap-2" title={displayOriginalName}>
                                        {displayName}
                                        {shouldShowOriginal && <span className="text-sm font-normal text-gray-500">({displayOriginalName})</span>}
                                        <button onClick={startNodeRenaming} className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 hover:text-blue-300 bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-900/50 transition-all align-middle">✎</button>
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-mono text-blue-400" title={displayRatio}>{displayRatio}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); maskNode(selectedNode.id); }}
                                            className="text-[10px] text-gray-500 hover:text-red-400 opacity-60 hover:opacity-100 transition-all border border-transparent hover:border-red-900/50 rounded px-1"
                                            title="Hide this node (Delete)"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 mb-4">
                            <button onClick={() => playNote(selectedNode, settings)} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-2.5 rounded text-xs font-black shadow-lg flex-1 transition-all active:scale-95">▶ PLAY</button>
                            {rootNode && rootNode.id !== selectedNode.id && (
                                <button onClick={() => playSimultaneous(rootNode, selectedNode, settings)} className="bg-green-900/50 hover:bg-green-800 text-green-100 px-3 py-2.5 rounded text-xs border border-green-700 flex-1 transition-all active:scale-95 font-bold">VS ROOT</button>
                            )}
                        </div>

                        <button onClick={triggerLocate} className="mb-4 w-full bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded text-xs font-black border border-gray-600 tracking-widest transition-all active:scale-95">
                            ⌖ LOCATE
                        </button>

                        {settings.secondaryOrigins.length > 0 && (
                            <div className="mb-4 bg-gray-900/40 p-2 rounded border border-gray-800">
                                <span className="text-[10px] uppercase font-black text-gray-500 block mb-2 tracking-widest">Active Origins</span>
                                <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                    {settings.secondaryOrigins.map(o => (
                                        <div key={o.id} className="flex justify-between items-center bg-black/40 px-2 py-1.5 rounded">
                                            <span className="text-[11px] text-blue-300 truncate mr-1 font-bold">{o.name}</span>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => locateOrigin(o.id)} className="text-[10px] bg-gray-800 hover:bg-white hover:text-black px-2 py-0.5 rounded border border-gray-600 font-black transition-colors">Go</button>
                                                <button onClick={() => removeSecondaryOrigin(o.id)} className="text-[11px] text-red-500 px-1.5 font-black hover:text-red-300">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1.5 mb-4 text-[11px]">
                            <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1 font-black uppercase tracking-tighter">
                                <span className="flex items-center gap-1">
                                    Pitch
                                    {commaSpreadingInfo?.isAffected && (
                                        <span
                                            className={commaSpreadingInfo.totalAdjustment >= 0 ? 'text-green-400' : 'text-red-400'}
                                            title={`Tempered: ${commaSpreadingInfo.totalAdjustment >= 0 ? '+' : ''}${commaSpreadingInfo.totalAdjustment.toFixed(2)}¢ from comma spreading`}
                                        >
                                            ≈
                                        </span>
                                    )}
                                </span>
                                <span className="font-mono text-gray-300">{selectedNode.cents.toFixed(2)}¢</span>
                            </div>
                            <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1 font-black uppercase tracking-tighter"><span>Gen</span><span className="font-mono text-gray-300">{selectedNode.gen}</span></div>
                            {oddHarmonicInfo && (
                                <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1 font-black uppercase tracking-tighter">
                                    <span>Odd Limit</span>
                                    <span className="font-mono text-blue-300" title="Odd Integral Harmonic (Product of all odd factors)">
                                        {oddHarmonicInfo.toString()}
                                    </span>
                                </div>
                            )}

                            {/* Node Branch Overrides (Gen n+1 Control) - Available in all modes */}
                            <div className="mt-4 border-t border-gray-800 pt-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] uppercase font-black text-amber-500 tracking-widest">Gen {selectedNode.gen + 1} Branches</span>
                                </div>
                                <div className="bg-amber-900/10 border border-amber-900/30 rounded p-2">
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-gray-500 uppercase font-bold">Negative</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={pendingBranchNeg}
                                                onChange={(e) => setPendingBranchNeg(parseInt(e.target.value, 10) || 0)}
                                                className="w-full bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-gray-500 uppercase font-bold">Positive</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={pendingBranchPos}
                                                onChange={(e) => setPendingBranchPos(parseInt(e.target.value, 10) || 0)}
                                                className="w-full bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="text-[8px] text-gray-500">Max 50 per side. Supports Gen up to 20.</div>
                                        <div className="flex gap-1">
                                            {(currentOverride.pos > 0 || currentOverride.neg > 0) && (
                                                <button
                                                    onClick={() => updateBranchLengths(0, 0)}
                                                    className="px-2 py-0.5 text-[9px] font-black uppercase bg-red-900/40 hover:bg-red-800 text-red-200 rounded border border-red-800"
                                                    title="Remove these branches"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                            <button
                                                onClick={() => updateBranchLengths(pendingBranchPos, pendingBranchNeg)}
                                                className="px-2 py-0.5 text-[9px] font-black uppercase bg-amber-900/40 hover:bg-amber-800 text-amber-100 rounded border border-amber-700"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-amber-900/40 pt-2 mt-2 space-y-2">
                                        <div className="text-[9px] text-amber-300 font-bold uppercase">Odd Limit Axis Override</div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="number"
                                                min="3"
                                                step="2"
                                                value={axisLimitInput}
                                                onChange={(e) => setAxisLimitInput(e.target.value)}
                                                placeholder="Odd Limit"
                                                className="bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={axisNegInput}
                                                onChange={(e) => setAxisNegInput(e.target.value)}
                                                placeholder="Neg"
                                                className="bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="50"
                                                value={axisPosInput}
                                                onChange={(e) => setAxisPosInput(e.target.value)}
                                                placeholder="Pos"
                                                className="bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                            />
                                        </div>
                                        <button
                                            onClick={addAxisOverride}
                                            className="w-full bg-amber-900/40 hover:bg-amber-800 text-amber-100 text-[10px] font-black uppercase py-1 rounded border border-amber-700"
                                        >
                                            Set Odd Limit
                                        </button>
                                        {axisOverrideEntries.length > 0 && (
                                            <div className="space-y-1">
                                                {axisOverrideEntries.map(entry => (
                                                    <div key={`axis-${entry.limit}`} className="flex items-center justify-between bg-black/40 border border-amber-900/30 rounded px-2 py-1 gap-2">
                                                        <span className="text-[9px] text-amber-200 font-bold shrink-0">Odd {entry.limit}L</span>

                                                        <div className="flex items-center gap-1 text-[9px] font-mono min-w-0">
                                                            <span className="text-gray-500">-</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="50"
                                                                value={entry.neg}
                                                                onChange={(e) => {
                                                                    const v = clampBranchLen(parseInt(e.target.value) || 0);
                                                                    updateAxisOverride(entry.limit, entry.pos, v);
                                                                }}
                                                                className="w-10 bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                                            />
                                                            <span className="text-gray-500">+</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="50"
                                                                value={entry.pos}
                                                                onChange={(e) => {
                                                                    const v = clampBranchLen(parseInt(e.target.value) || 0);
                                                                    updateAxisOverride(entry.limit, v, entry.neg);
                                                                }}
                                                                className="w-10 bg-black border border-gray-700 rounded text-[10px] text-amber-200 text-center outline-none"
                                                            />
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => setDrawingLimit(entry.limit)}
                                                                className="text-[9px] bg-gray-700 hover:bg-gray-600 rounded px-1.5 py-0.5 text-gray-300 transition-colors"
                                                                title="Draw custom shape"
                                                            >
                                                                ✎
                                                            </button>
                                                            <button
                                                                onClick={() => removeAxisOverride(entry.limit)}
                                                                className="text-[10px] text-red-400 hover:text-red-200 font-black shrink-0 ml-1"
                                                                title="Remove axis override"
                                                            >
                                                                X
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Derived Nodes List */}
                                    <details className="group">
                                        <summary className="text-[9px] font-bold text-gray-500 uppercase cursor-pointer list-none flex items-center gap-1 hover:text-gray-300">
                                            <span className="text-[8px] group-open:rotate-90 transition-transform">▶</span>
                                            Derived Nodes of Gen {selectedNode.gen + 1}
                                        </summary>
                                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {nodes
                                                .filter(n => {
                                                    try {
                                                        if (n.gen !== selectedNode.gen + 1) return false;
                                                        if (!selectedNode.primeVector || !n.primeVector) return false;

                                                        // Check if node lies on a direct axis from selectedNode (1 axis difference)
                                                        const sVec = selectedNode.primeVector;
                                                        const nVec = n.primeVector;

                                                        // Ensure vectors are objects
                                                        if (typeof sVec !== 'object' || typeof nVec !== 'object') return false;

                                                        const sKeys = Object.keys(sVec);
                                                        const nKeys = Object.keys(nVec);
                                                        const allKeys = new Set([...sKeys, ...nKeys].map(k => Number(k)));

                                                        let diffs = 0;
                                                        for (const p of allKeys) {
                                                            if (isNaN(p)) continue;
                                                            const v1 = sVec[p] || 0;
                                                            const v2 = nVec[p] || 0;
                                                            if (v1 !== v2) diffs++;
                                                        }
                                                        return diffs === 1;
                                                    } catch (e) {
                                                        log.warn('Error filtering derived nodes', e);
                                                        return false;
                                                    }
                                                })
                                                .map(n => (
                                                    <div key={n.id} onClick={() => selectNode(n)} className="flex justify-between items-center bg-black/20 p-1 rounded hover:bg-black/40 cursor-pointer">
                                                        <span className="text-[10px] text-blue-200 font-bold">{n.name}</span>
                                                        <span className="text-[9px] text-gray-500 font-mono">{n.cents.toFixed(1)}¢</span>
                                                    </div>
                                                ))}
                                            {nodes.filter(n => {
                                                try {
                                                    if (n.gen !== selectedNode.gen + 1) return false;
                                                    if (!selectedNode.primeVector || !n.primeVector) return false;
                                                    const sVec = selectedNode.primeVector;
                                                    const nVec = n.primeVector;
                                                    if (typeof sVec !== 'object' || typeof nVec !== 'object') return false;
                                                    const allKeys = new Set([...Object.keys(sVec), ...Object.keys(nVec)].map(k => Number(k)));
                                                    let diffs = 0;
                                                    for (const p of allKeys) {
                                                        if (isNaN(p)) continue;
                                                        const v1 = sVec[p] || 0;
                                                        const v2 = nVec[p] || 0;
                                                        if (v1 !== v2) diffs++;
                                                    }
                                                    return diffs === 1;
                                                } catch (e) { return false; }
                                            }).length === 0 && (
                                                    <div className="text-[9px] text-gray-600 italic px-2">No derived nodes yet. Increase branch length.</div>
                                                )}
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </div>

                        {commaSpreadingInfo?.isAffected && (
                            <div className="mb-4 bg-gray-900/40 p-2 rounded border border-gray-800">
                                <span className="text-[10px] uppercase font-black text-gray-500 block mb-2 tracking-widest">Temperament</span>
                                <div className="space-y-1.5 text-[11px]">
                                    <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1">
                                        <span className="font-black uppercase tracking-tighter">JI</span>
                                        <span className="font-mono text-gray-300">{commaSpreadingInfo.jiCents.toFixed(2)}¢</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1">
                                        <span className="font-black uppercase tracking-tighter">Tempered</span>
                                        <span className="font-mono text-gray-300">{commaSpreadingInfo.temperedCents.toFixed(2)}¢</span>
                                    </div>
                                    <div className="flex justify-between text-gray-500 border-b border-gray-800 py-1">
                                        <span className="font-black uppercase tracking-tighter">Adjustment</span>
                                        <span className={`font-mono ${commaSpreadingInfo.totalAdjustment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {commaSpreadingInfo.totalAdjustment >= 0 ? '+' : ''}{commaSpreadingInfo.totalAdjustment.toFixed(2)}¢
                                        </span>
                                    </div>
                                </div>
                                {commaSpreadingInfo.axisDetails.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-800">
                                        <span className="text-[9px] uppercase font-bold text-gray-600 block mb-1">Per-Axis Breakdown</span>
                                        {commaSpreadingInfo.axisDetails.map(axis => (
                                            <div key={axis.prime} className="text-[10px] text-gray-400 py-0.5 flex justify-between">
                                                <span>
                                                    <span className="text-blue-300 font-bold">{axis.prime}</span>
                                                    <span className="text-gray-600 ml-1">
                                                        (loop:{axis.loopLength}, step:{axis.nodeStepIndex})
                                                    </span>
                                                </span>
                                                <span className={`font-mono ${axis.cumulativeAdjustment >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {axis.cumulativeAdjustment >= 0 ? '+' : ''}{axis.cumulativeAdjustment.toFixed(2)}¢
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setCenter(selectedNode)} disabled={hasMultipleOrigins} className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded text-[10px] border border-gray-700 disabled:opacity-30 uppercase font-black truncate transition-all active:scale-95">Set Center</button>
                            {isOrigin ? (
                                <button onClick={() => removeSecondaryOrigin(selectedNode.id)} className="bg-red-900/40 hover:bg-red-800 text-red-300 py-2.5 rounded text-[10px] border border-red-800 uppercase font-black truncate transition-all active:scale-95">Remove Origin</button>
                            ) : (
                                <button onClick={() => addSecondaryOrigin(selectedNode)} disabled={settings.secondaryOrigins.length >= 6} className="bg-blue-900/40 hover:bg-blue-800 text-blue-200 py-2.5 rounded text-[10px] border border-blue-800 uppercase font-black truncate transition-all active:scale-95">Add Origin</button>
                            )}
                            <button onClick={() => toggleIsolationMode()} className={`py-2.5 rounded text-[10px] border uppercase font-black truncate transition-all active:scale-95 ${isIsolationMode ? 'bg-yellow-900/40 text-yellow-200 border-yellow-600' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>Isolate</button>
                            <button onClick={() => addToComparison(selectedNode)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded text-[10px] border border-gray-700 uppercase font-black truncate transition-all active:scale-95">Compare</button>
                            <button
                                onClick={() => addToKeyboard(selectedNode)}
                                disabled={isInKeyboard}
                                className={`py-2.5 rounded text-[10px] border uppercase font-black truncate transition-all active:scale-95 ${isInKeyboard ? 'bg-green-900/20 text-green-500 border-green-900/50 opacity-50 cursor-not-allowed' : 'bg-blue-900/30 text-blue-200 border-blue-900/50 hover:bg-blue-800 transition-colors'}`}
                            >
                                {isInKeyboard ? "In Keys" : "To Keys"}
                            </button>
                            <button onClick={() => nodeTextureInputRef.current?.click()} className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded text-[10px] border border-gray-700 uppercase font-black truncate transition-all active:scale-95">
                                Texture
                                <input type="file" ref={nodeTextureInputRef} accept="image/*" autoComplete="off" onChange={handleTextureUpload} className="hidden" />
                            </button>
                        </div>

                        {surfaceLabelsEnabled && (
                            <div className="mt-3 bg-gray-900/40 p-2 rounded border border-gray-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Surface Label Overrides</span>
                                    <button
                                        onClick={() => clearNodeSurfaceLabelOverride(selectedNode.id)}
                                        className="text-[9px] bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-2 py-1 rounded font-black uppercase tracking-widest"
                                    >
                                        Reset
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Label Text</label>
                                        <select
                                            value={ratioSelectValue}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setNodeSurfaceLabelOverride(selectedNode.id, {
                                                    showRatio: v === 'global' ? undefined : v === 'show'
                                                });
                                            }}
                                            className="w-full bg-black border border-gray-800 rounded text-[10px] text-white p-1.5 focus:border-blue-500 outline-none"
                                        >
                                            <option value="global">Global</option>
                                            <option value="show">Force Show</option>
                                            <option value="hide">Force Hide</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[9px] text-gray-500 block mb-1 uppercase font-bold">Node Texture</label>
                                        <select
                                            value={textureSelectValue}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setNodeSurfaceLabelOverride(selectedNode.id, {
                                                    showTexture: v === 'global' ? undefined : v === 'show'
                                                });
                                            }}
                                            disabled={!hasNodeTexture}
                                            className="w-full bg-black border border-gray-800 rounded text-[10px] text-white p-1.5 focus:border-blue-500 outline-none disabled:opacity-40"
                                        >
                                            <option value="global">Global</option>
                                            <option value="show">Force Show</option>
                                            <option value="hide">Force Hide</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <label className="flex items-center gap-2 text-[9px] uppercase font-black text-gray-500">
                                        <input
                                            type="checkbox"
                                            checked={hasFontOverride}
                                            onChange={(e) => {
                                                setNodeSurfaceLabelOverride(selectedNode.id, {
                                                    fontScale: e.target.checked ? 1.0 : undefined
                                                });
                                            }}
                                            className="w-3 h-3 accent-blue-500 rounded"
                                        />
                                        Font Override
                                    </label>
                                    <span className="text-[10px] text-blue-300 font-mono">
                                        {(surfaceOverride?.fontScale ?? 1.0).toFixed(2)}x
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.3"
                                    max="2.5"
                                    step="0.05"
                                    value={surfaceOverride?.fontScale ?? 1.0}
                                    disabled={!hasFontOverride}
                                    onChange={(e) => setNodeSurfaceLabelOverride(selectedNode.id, { fontScale: parseFloat(e.target.value) })}
                                    className="w-full h-1 accent-blue-500 appearance-none cursor-pointer bg-gray-700 rounded disabled:opacity-40"
                                />
                                <div className="text-[9px] text-gray-500">
                                    Tip: use <span className="text-gray-300 font-bold">VIS &gt; Node Surface Labels</span> for global options.
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-900/20">


                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3">

                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Acoustic Proximity</h3>
                                <div className="flex gap-1.5 bg-black/40 p-1 rounded border border-white/5 shadow-inner" onPointerDown={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => { clearScheduledSelections(); undoSelection(); }}
                                        disabled={historyIndex <= 0}
                                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 border border-gray-600 rounded px-3 py-1 text-white text-xs font-black transition-all active:scale-90"
                                        title="Undo Selection"
                                    >
                                        &lt;
                                    </button>
                                    <button
                                        onClick={() => { clearScheduledSelections(); redoSelection(); }}
                                        disabled={historyIndex >= selectionHistory.length - 1}
                                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-20 border border-gray-600 rounded px-3 py-1 text-white text-xs font-black transition-all active:scale-90"
                                        title="Redo Selection"
                                    >
                                        &gt;
                                    </button>
                                    <span className="text-[8px] text-gray-600 font-black uppercase px-1 self-center tracking-tighter">History</span>
                                </div>
                            </div>
                            <select value={settings.nearbySort} onChange={(e) => updateSettings({ nearbySort: e.target.value as any })} className="bg-black text-[10px] text-gray-400 border border-gray-800 rounded px-2 py-1 outline-none font-bold">
                                <option value="pitch">By Pitch</option>
                                <option value="gen">By Gen</option>
                                <option value="center">By Dist</option>
                            </select>
                        </div>

                        <div className={`grid gap-2 mb-4 ${isMobile ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
                            {nearbyNodes.length === 0 && <div className="text-gray-700 text-[10px] italic col-span-full py-4 text-center">No nodes found in range.</div>}
                            {nearbyNodes.map((node: NodeData) => (
                                <div key={node.id} onClick={() => selectNearbyNode(node)} className="bg-gray-800/40 hover:bg-gray-700 border border-gray-800 rounded-lg p-2 cursor-pointer transition-all hover:scale-[1.03] active:scale-95">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-black text-blue-100 text-[11px] truncate">{node.name}</span>
                                        <span className="text-[8px] bg-gray-900 px-1.5 py-0.5 rounded text-gray-500 uppercase font-black">G{node.gen}</span>
                                    </div>
                                    <div className="flex justify-between items-end gap-2">
                                        {(() => {
                                            const ratioText = formatRatioLimited(node.ratio, 20);
                                            return (
                                                <span className="text-[9px] text-gray-500 font-mono break-all flex-1 min-w-0" title={ratioText}>
                                                    {ratioText}
                                                </span>
                                            );
                                        })()}
                                        <span className={`text-[10px] font-mono font-bold shrink-0 ${(node.cents - selectedNode.cents) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(node.cents - selectedNode.cents).toFixed(1)}¢
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-gray-800 pt-3">
                            <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Comma Detective</h3>

                            <div className="mb-4 p-3 bg-blue-900/10 rounded-xl border border-blue-900/30">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Interval Designer</span>
                                    <button
                                        onClick={fillCustomCommaFromComparison}
                                        className="text-[10px] bg-blue-900/40 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-700 font-black transition-all active:scale-95"
                                        title="Use comparison tray"
                                    >
                                        FROM TRAY
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Num"
                                            value={customCommaN}
                                            onChange={e => setCustomCommaN(e.target.value)}
                                            className="flex-1 bg-black border border-gray-700 rounded-lg text-center text-xs text-white p-2 focus:border-blue-500 outline-none font-mono"
                                        />
                                        <span className="text-gray-500 self-center text-xl font-black">/</span>
                                        <input
                                            placeholder="Den"
                                            value={customCommaD}
                                            onChange={e => setCustomCommaD(e.target.value)}
                                            className="flex-1 bg-black border border-gray-700 rounded-lg text-center text-xs text-white p-2 focus:border-blue-500 outline-none font-mono"
                                        />
                                    </div>
                                    <input
                                        placeholder="Interval Name..."
                                        value={customCommaName}
                                        onChange={e => setCustomCommaName(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded-lg text-xs text-blue-300 p-2 focus:border-blue-500 outline-none font-bold"
                                    />
                                    <div className="flex gap-2 pt-1">
                                        <button onClick={findCustomComma} className="flex-1 bg-blue-800 hover:bg-blue-700 text-white text-xs py-2 rounded-lg font-black uppercase shadow-lg transition-all active:scale-95">FIND</button>
                                        <button onClick={saveCurrentComma} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs py-2 rounded-lg font-black uppercase border border-gray-600 transition-all active:scale-95">SAVE</button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-3">
                                <input type="text" placeholder="Search Comma Name..." value={commaSearch} onChange={e => setCommaSearch(e.target.value)} className="bg-black text-xs text-white border border-gray-700 rounded-lg px-3 py-2 flex-1 focus:border-blue-500 outline-none" />
                                {commaLines.length > 0 && <button onClick={() => setCommaLines([])} className="text-[11px] text-red-400 px-3 py-2 hover:text-white border border-red-900/30 rounded-lg bg-red-900/10 uppercase font-black transition-colors">Clear</button>}
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {commaResults.map((c: any) => {
                                    const isUser = c.__source === "user";
                                    const id = c.id ?? derivedCommaId(c);
                                    const isEditing = editingCommaId === id;

                                    return (
                                        <div
                                            key={`${c.__source}:${id}`}
                                            className={`flex justify-between items-center px-3 py-2.5 rounded-lg group transition-all ${isUser ? 'bg-indigo-900/30 border border-indigo-800/50' : 'bg-gray-800/30 hover:bg-gray-800/50'}`}
                                        >
                                            <div className="flex flex-col overflow-hidden mr-2 flex-1">
                                                {isEditing ? (
                                                    <div className="flex gap-1.5 items-center">
                                                        <input
                                                            autoFocus
                                                            className="bg-black border border-blue-500 rounded-md text-xs text-white px-2 py-1 flex-1 outline-none"
                                                            value={editingCommaName}
                                                            onChange={e => setEditingCommaName(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') applyRename();
                                                                if (e.key === 'Escape') setEditingCommaId(null);
                                                            }}
                                                            onBlur={applyRename}
                                                        />
                                                        <button onClick={applyRename} className="text-green-400 text-base font-black px-1">✓</button>
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={`text-[11px] md:text-xs truncate font-black ${isUser ? 'text-indigo-200 cursor-pointer hover:underline' : 'text-gray-300'}`}
                                                        title={isUser ? "Click to rename" : c.name}
                                                        onClick={() => isUser && startRenaming(id, c.name)}
                                                    >
                                                        {isUser ? `★ ${c.name}` : c.name}
                                                        {!isUser && <span className="ml-1 text-[10px] text-gray-500 opacity-60 font-bold">(built-in)</span>}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-600 font-mono font-bold">{c.cents.toFixed(2)}¢</span>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => showComma(c)} className="text-[10px] bg-blue-900/50 hover:bg-blue-800 px-2.5 py-1.5 rounded-md text-blue-200 font-black uppercase transition-all active:scale-95 shadow-sm">SHOW</button>
                                                {isUser && (
                                                    <button type="button"
                                                        onPointerDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            openConfirm({
                                                                title: 'Delete Saved Comma',
                                                                message: `Delete saved comma "${c.name}"?\n\nNote: built-in commas cannot be deleted and may still appear if they share the same name.`,
                                                                confirmLabel: 'Delete',
                                                                cancelLabel: 'Cancel',
                                                                onConfirm: () => {
                                                                    deleteCustomCommaById(id);
                                                                    setCommaLines(commaLines.filter(l => l.name !== c.name));
                                                                }
                                                            });
                                                        }}
                                                        className="text-xs text-red-500 px-3 py-1.5 hover:text-white font-black hover:bg-red-500 rounded-md cursor-pointer transition-all active:scale-90"
                                                        title="Delete Saved Comma"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                </div>
            </div >
        </>
    );
};

const clearScheduledSelections = () => {

};
