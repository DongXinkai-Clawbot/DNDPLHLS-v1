import { useState, useRef, useEffect, useMemo, type ChangeEvent } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import { formatRatioForDisplay, calculateRelativeRatio, calculateCents, parseMathExpression, getNoteName } from '../../../musicLogic';
import { notifyError, notifyInfo, notifySuccess, notifyWarning, openPrompt } from '../../../utils/notifications';
import { KNOWN_COMMAS } from '../../../constants';
import { useDeviceType } from '../../../hooks/useDeviceType';
import { getCommaSpreadingInfo } from '../../../utils/lattice/commaSpreadingInfo';

export const useInfoPanelState = () => {
    const {
        selectedNode,
        settings,
        updateSettings,
        regenerateLattice,
        maskNode,
        unmaskNode,
        selectNode,
        selectNearbyNode,
        setCenter,
        addSecondaryOrigin,
        removeSecondaryOrigin,
        nodes,
        addToKeyboard,
        customKeyboard,
        customNodeTextures,
        setNodeTexture,
        nodeSurfaceLabelOverrides,
        setNodeSurfaceLabelOverride,
        clearNodeSurfaceLabelOverride,
        nodeNameOverrides,
        setNodeNameOverride,
        addToComparison,
        isIsolationMode,
        toggleIsolationMode,
        setCommaLines,
        commaLines,
        triggerLocate,
        comparisonNodes,
        savedCommas,
        saveCustomComma,
        renameCustomComma,
        deleteCustomCommaById,
        toggleNodeInfo,
        nearbyNodes,
        panels,
        undoSelection,
        redoSelection,
        historyIndex,
        selectionHistory
    } = useStore((s) => ({
        selectedNode: s.selectedNode,
        settings: s.settings,
        updateSettings: s.updateSettings,
        regenerateLattice: s.regenerateLattice,
        selectNode: s.selectNode,
        selectNearbyNode: s.selectNearbyNode,
        setCenter: s.setCenter,
        addSecondaryOrigin: s.addSecondaryOrigin,
        removeSecondaryOrigin: s.removeSecondaryOrigin,
        nodes: s.nodes,
        addToKeyboard: s.addToKeyboard,
        customKeyboard: s.customKeyboard,
        customNodeTextures: s.customNodeTextures,
        setNodeTexture: s.setNodeTexture,
        nodeSurfaceLabelOverrides: s.nodeSurfaceLabelOverrides,
        setNodeSurfaceLabelOverride: s.setNodeSurfaceLabelOverride,
        clearNodeSurfaceLabelOverride: s.clearNodeSurfaceLabelOverride,
        nodeNameOverrides: s.nodeNameOverrides,
        setNodeNameOverride: s.setNodeNameOverride,
        addToComparison: s.addToComparison,
        isIsolationMode: s.isIsolationMode,
        toggleIsolationMode: s.toggleIsolationMode,
        setCommaLines: s.setCommaLines,
        commaLines: s.commaLines,
        triggerLocate: s.triggerLocate,
        comparisonNodes: s.comparisonNodes,
        savedCommas: s.savedCommas,
        saveCustomComma: s.saveCustomComma,
        renameCustomComma: s.renameCustomComma,
        deleteCustomCommaById: s.deleteCustomCommaById,
        toggleNodeInfo: s.toggleNodeInfo,
        nearbyNodes: s.nearbyNodes,
        panels: s.panels,
        undoSelection: s.undoSelection,
        redoSelection: s.redoSelection,
        historyIndex: s.historyIndex,
        selectionHistory: s.selectionHistory,
        maskNode: s.maskNode,
        unmaskNode: s.unmaskNode
    }), shallow);
    const { isMobile } = useDeviceType();

    const nodeTextureInputRef = useRef<HTMLInputElement>(null);
    const [commaSearch, setCommaSearch] = useState("");
    const [activeTab, setActiveTab] = useState<'analysis' | 'builder'>('analysis');

    const [customCommaN, setCustomCommaN] = useState("81");
    const [customCommaD, setCustomCommaD] = useState("80");
    const [customCommaName, setCustomCommaName] = useState("");

    const [editingCommaId, setEditingCommaId] = useState<string | null>(null);
    const [editingCommaName, setEditingCommaName] = useState("");

    const [isRenamingNode, setIsRenamingNode] = useState(false);
    const [editLatticeName, setEditLatticeName] = useState("");
    const [editPanelName, setEditPanelName] = useState("");
    const [editShowOriginal, setEditShowOriginal] = useState(false);

    const isOrigin = !!selectedNode && settings.secondaryOrigins.some(o => o.id === selectedNode.id);
    const hasMultipleOrigins = settings.secondaryOrigins.length > 0;
    const isInKeyboard = !!selectedNode && customKeyboard.some(n => n.id === selectedNode.id);

    const oddHarmonicInfo = useMemo(() => {
        if (!selectedNode) return null;
        let val = 1n;
        const primes = Object.keys(selectedNode.primeVector).map(Number);
        primes.forEach(p => {
            if (p === 2) return;
            const exp = selectedNode.primeVector[p];

            val *= BigInt(p) ** BigInt(Math.abs(exp));
        });
        return val;
    }, [selectedNode]);

    const commaSpreadingInfo = useMemo(() => {
        if (!selectedNode) return null;
        return getCommaSpreadingInfo(selectedNode, settings);
    }, [selectedNode, settings]);

    const rootNode = nodes.find((n: any) => {
        const v = n.primeVector;
        return v[3] === 0 && v[5] === 0 && v[7] === 0 && v[11] === 0 && v[13] === 0 && v[17] === 0 && v[19] === 0 && v[23] === 0 && v[29] === 0 && v[31] === 0;
    });

    const norm = (s: string) => (s || "").trim().toLowerCase();

    const commaResults = useMemo(() => {
        const q = norm(commaSearch);

        const user = (savedCommas || []).map(c => ({ ...c, __source: "user" as const }));
        const known = KNOWN_COMMAS.map(c => ({ ...c, __source: "known" as const }));

        let list = [...user, ...known];
        if (q) list = list.filter(c => norm(c.name).includes(q));
        return list;
    }, [commaSearch, savedCommas]);

    const infoPanelState = panels['info'];

    const isStacked = isMobile || (infoPanelState && (
        infoPanelState.mode === 'dock-left' ||
        infoPanelState.mode === 'dock-right' ||
        (infoPanelState.mode === 'float' && infoPanelState.width < 600)
    ));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedNode || (e.target as HTMLElement).tagName === 'INPUT') return;
            if (panels.keyboard && panels.keyboard.isOpen && panels.keyboard.mode === 'fullscreen') return;
            const k = e.key.toLowerCase();
            if (k === 'c') addToComparison(selectedNode);
            else if (k === 'k') addToKeyboard(selectedNode);
            else if (k === 'i') toggleIsolationMode();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNode, addToComparison, addToKeyboard, toggleIsolationMode, panels.keyboard]);

    const handleTextureUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0] && selectedNode) {
            const url = URL.createObjectURL(e.target.files[0]);
            setNodeTexture(selectedNode.id, url);
            e.target.value = '';
        }
    };

    const locateOrigin = (id: string) => {
        const node = nodes.find((n: any) => n.id === id);
        if (node) {
            selectNode(node);
            triggerLocate();
        }
    };

    const showComma = (comma: any) => {
        if (!selectedNode) return;
        let match = null;
        let minDiff = 0.5;

        for (const n of nodes) {
            if (n.id === selectedNode.id) continue;
            const centsDiff = Math.abs(n.cents - selectedNode.cents);
            if (Math.abs(centsDiff - Math.abs(comma.cents)) < minDiff) {
                match = n;
                break;
            }
        }

        if (match) {
            setCommaLines([{ sourceId: selectedNode.id, targetId: match.id, name: comma.name }]);
        } else {
            notifyWarning(
                `Comma interval "${comma.name}" (${comma.cents.toFixed(2)}¢) not found relative to ${selectedNode.name} in current lattice.`,
                'Comma Search'
            );
        }
    };

    const fillCustomCommaFromComparison = () => {
        if (comparisonNodes.length < 2) {
            notifyInfo('Add at least 2 notes to the Comparison Tray first.', 'Comparison');
            return;
        }
        const r = calculateRelativeRatio(comparisonNodes[0], comparisonNodes[1]);
        setCustomCommaN(r.n.toString());
        setCustomCommaD(r.d.toString());
        setCustomCommaName(`Interval ${comparisonNodes[0].name}:${comparisonNodes[1].name}`);
    };

    const findCustomComma = () => {
        try {
            const n = parseMathExpression(customCommaN);
            const d = parseMathExpression(customCommaD);
            if (n === 0n || d === 0n) throw new Error();
            const cents = calculateCents({ n, d });
            showComma({ name: customCommaName || `Custom (${n}/${d})`, cents, n, d });
        } catch (e) {
            notifyError('Invalid custom ratio.', 'Comma Search');
        }
    };

    const saveCurrentComma = () => {
        try {
            const n = parseMathExpression(customCommaN);
            const d = parseMathExpression(customCommaD);
            if (n === 0n || d === 0n) throw new Error();

            const commit = (name: string) => {
                const trimmed = name.trim();
                if (!trimmed) return;
                const cents = calculateCents({ n, d });
                saveCustomComma({ name: trimmed, n, d, cents });
                setCustomCommaName("");
                notifySuccess(`Interval "${trimmed}" added to user commas.`, 'Comma Saved');
            };

            if (!customCommaName) {
                openPrompt({
                    title: 'Name Interval',
                    message: 'Enter interval name:',
                    defaultValue: `Custom ${n}/${d}`,
                    confirmLabel: 'Save',
                    cancelLabel: 'Cancel',
                    onConfirm: (value) => {
                        if (value) commit(value);
                    }
                });
            } else {
                commit(customCommaName);
            }
        } catch (e) {
            notifyError('Invalid ratio.', 'Comma Save');
        }
    };

    const startRenaming = (id: string, name: string) => {
        setEditingCommaId(id);
        setEditingCommaName(name);
    };

    const applyRename = () => {
        if (editingCommaId && editingCommaName.trim()) {
            renameCustomComma(editingCommaId, editingCommaName.trim());
        }
        setEditingCommaId(null);
        setEditingCommaName("");
    };

    const customSymbols = useMemo(() => {
        if (!settings.customPrimes) return undefined;
        const map: Record<number, string> = {};
        settings.customPrimes.forEach(cp => {
            if (cp.symbol?.up) {
                map[cp.prime] = cp.symbol.up;
            }
        });
        return map;
    }, [settings.customPrimes]);

    const noteNamingSymbols = useMemo(() => {
        const merged = { ...settings.notationSymbols };
        if (settings.customPrimes) {
            settings.customPrimes.forEach(cp => {
                if (cp.symbol) {
                    merged[cp.prime] = cp.symbol;
                }
            });
        }
        return merged;
    }, [settings.notationSymbols, settings.customPrimes]);

    const dynamicName = useMemo(() => {
        if (!selectedNode) return "";
        return getNoteName(selectedNode.primeVector, noteNamingSymbols, settings.accidentalPlacement);
    }, [selectedNode, noteNamingSymbols, settings.accidentalPlacement]);

    const surfaceLabelsEnabled = !!settings.visuals.nodeSurfaceRatioLabelsEnabled;
    const surfaceOverride = selectedNode ? nodeSurfaceLabelOverrides?.[selectedNode.id] : undefined;
    const hasNodeTexture = !!selectedNode && !!customNodeTextures?.[selectedNode.id];
    const ratioSelectValue = surfaceOverride?.showRatio === undefined ? 'global' : (surfaceOverride.showRatio ? 'show' : 'hide');
    const textureSelectValue = surfaceOverride?.showTexture === undefined ? 'global' : (surfaceOverride.showTexture ? 'show' : 'hide');
    const hasFontOverride = typeof surfaceOverride?.fontScale === 'number' && Number.isFinite(surfaceOverride.fontScale);
    const ratioDisplayMode = settings.visuals?.ratioDisplay?.contexts?.infoPanel || 'auto';
    const autoPowerDigits = settings.visuals?.ratioDisplay?.autoPowerDigits ?? 14;

    const displayRatio = selectedNode
        ? formatRatioForDisplay(selectedNode.ratio, selectedNode.primeVector, { mode: ratioDisplayMode, autoPowerDigits, customSymbols })
        : '';

    const nameOverride = selectedNode ? nodeNameOverrides?.[selectedNode.id] : undefined;
    const displayName = selectedNode ? (nameOverride?.panel || dynamicName) : '';
    const displayOriginalName = selectedNode ? selectedNode.name : '';
    const shouldShowOriginal = !!nameOverride?.showOriginal && displayName !== displayOriginalName;

    const startNodeRenaming = () => {
        if (!selectedNode) return;
        setEditLatticeName(nameOverride?.lattice || selectedNode.name);
        setEditPanelName(nameOverride?.panel || selectedNode.name);
        setEditShowOriginal(!!nameOverride?.showOriginal);
        setIsRenamingNode(true);
    };

    const saveNodeRenaming = () => {
        if (!selectedNode) return;
        setNodeNameOverride(selectedNode.id, {
            lattice: editLatticeName.trim() || undefined,
            panel: editPanelName.trim() || undefined,
            showOriginal: editShowOriginal
        });
        setIsRenamingNode(false);
    };

    return {
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
        customKeyboard,
        customNodeTextures,
        setNodeTexture,
        nodeSurfaceLabelOverrides,
        setNodeSurfaceLabelOverride,
        clearNodeSurfaceLabelOverride,
        nodeNameOverrides,
        setNodeNameOverride,
        addToComparison,
        isIsolationMode,
        toggleIsolationMode,
        setCommaLines,
        commaLines,
        triggerLocate,
        comparisonNodes,
        savedCommas,
        saveCustomComma,
        renameCustomComma,
        deleteCustomCommaById,
        toggleNodeInfo,
        nearbyNodes,
        panels,
        undoSelection,
        redoSelection,
        historyIndex,
        selectionHistory,
        isMobile,
        nodeTextureInputRef,
        commaSearch,
        setCommaSearch,
        activeTab,
        setActiveTab,
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
        maskNode,
        unmaskNode
    };
};
