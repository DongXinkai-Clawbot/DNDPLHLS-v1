import type { AppState, NodeData } from '../../types';
import { AUTO_BIND_KEYS, derivedCommaId } from './constants';
import { STORAGE_KEYS } from './storageKeys';
import { createLogger } from '../../utils/logger';

const log = createLogger('store/keyboard');

export { derivedCommaId };

export const addToKeyboard = (set: any, node: NodeData) => {
    set((s: AppState) => {
        if (s.customKeyboard.some(n => n.id === node.id)) return s;
        const newKeyboard = [...s.customKeyboard, node];
        const usedKeys = new Set(Object.values(s.keyBindings));
        const nextKey = AUTO_BIND_KEYS.find(k => !usedKeys.has(k));
        const newBindings = { ...s.keyBindings };
        if (nextKey) { newBindings[node.id] = nextKey; }
        const newPanels = { ...s.panels, keyboard: { ...s.panels.keyboard, isOpen: true } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { customKeyboard: newKeyboard, keyBindings: newBindings, isKeyboardVisible: true, panels: newPanels };
    });
};

export const removeFromKeyboard = (set: any, id: string) => set((s: AppState) => ({ customKeyboard: s.customKeyboard.filter(n => n.id !== id), keyBindings: Object.fromEntries(Object.entries(s.keyBindings).filter(([k]) => k !== id)) }));
const safeOctave = (value: any) => (Number.isFinite(value) ? value : 0);

export const shiftKeyboardOctave = (set: any, id: string, dir: number) => set((s: AppState) => ({
    customKeyboard: s.customKeyboard.map(n => n.id === id ? { ...n, octave: safeOctave(n.octave) + dir } : n)
}));
export const bindKey = (set: any, id: string, key: string) => set((s: AppState) => ({ keyBindings: { ...s.keyBindings, [id]: key } }));
export const unbindKey = (set: any, id: string) => set((s: AppState) => { const { [id]: _, ...rest } = s.keyBindings; return { keyBindings: rest }; });

export const setCustomKeyboard = (set: any, nodes: NodeData[]) => {
    set((s: AppState) => {
        const newPanels = { ...s.panels, keyboard: { ...s.panels.keyboard, isOpen: true } };
        return { customKeyboard: nodes, keyBindings: {}, isKeyboardVisible: true, panels: newPanels };
    });
};

export const toggleKeyboard = (set: any, force?: boolean) => {
    set((s: AppState) => {
        const next = force !== undefined ? force : !s.isKeyboardVisible;
        const newPanels = { ...s.panels, keyboard: { ...s.panels.keyboard, isOpen: next } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { isKeyboardVisible: next, panels: newPanels };
    });
};

export const toggleNodeInfo = (set: any, visible: boolean) => {
    set((s: AppState) => {
        const next = visible;
        const newPanels = { ...s.panels, info: { ...s.panels.info, isOpen: next } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { isNodeInfoVisible: next, panels: newPanels };
    });
};

export const addToComparison = (set: any, node: NodeData, octaveShift = 0) => {
    set((s: AppState) => {
        let processedNode = node;
        if (octaveShift !== 0) {
            processedNode = { ...node, octave: node.octave + octaveShift };
        }
        const newPanels = { ...s.panels, comparison: { ...s.panels.comparison, isOpen: true } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return {
            comparisonNodes: [...s.comparisonNodes, processedNode],
            isComparisonVisible: true,
            panels: newPanels
        };
    });
};

export const removeFromComparison = (set: any, id: string) => set((s: AppState) => ({ comparisonNodes: s.comparisonNodes.filter(n => n.id !== id) }));
export const shiftComparisonOctave = (set: any, id: string, dir: number) => set((s: AppState) => ({
    comparisonNodes: s.comparisonNodes.map(n => n.id === id ? { ...n, octave: safeOctave(n.octave) + dir } : n)
}));
export const clearComparison = (set: any) => set({ comparisonNodes: [], commaLines: [] });
export const clearComparisonNodesOnly = (set: any) => set({ comparisonNodes: [] });

export const toggleComparisonTray = (set: any) => {
    set((s: AppState) => {
        const next = !s.isComparisonVisible;
        const newPanels = { ...s.panels, comparison: { ...s.panels.comparison, isOpen: next } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { isComparisonVisible: next, panels: newPanels };
    });
};

export const saveChord = (set: any, name: string, nodes: NodeData[], description?: string) => set((s: AppState) => ({ savedChords: [...s.savedChords, { id: Date.now().toString(), name, description, nodes }] }));
export const deleteChord = (set: any, id: string) => set((s: AppState) => ({ savedChords: s.savedChords.filter(c => c.id !== id) }));
export const loadChord = (set: any, chord: any) => {
    if (!chord || !Array.isArray(chord.nodes)) {
        log.warn('loadChord: Invalid chord data', chord);
        return;
    }
    set((s: AppState) => {
        const newPanels = { ...s.panels, comparison: { ...s.panels.comparison, isOpen: true } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { comparisonNodes: [...chord.nodes], isComparisonVisible: true, panels: newPanels };
    });
};

const GROUP_COLORS = [
    '#ff00ff',
    '#00ffff',
    '#ffff00',
    '#ff8800',
    '#88ff00',
    '#ff0088',
    '#00ff88',
    '#8800ff',
    '#0088ff',
    '#ff4444',
];

const getNextGroupColor = (existingGroups: any[]): string => {
    const usedColors = new Set(existingGroups.map(g => g.color));
    for (const color of GROUP_COLORS) {
        if (!usedColors.has(color)) return color;
    }

    return `hsl(${Math.random() * 360}, 80%, 60%)`;
};

export const addComparisonGroup = (set: any, name: string, nodes: any[]) => {
    set((s: AppState) => {
        const newGroup = {
            id: `cg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: name || `Group ${s.comparisonGroups.length + 1}`,
            nodes,
            color: getNextGroupColor(s.comparisonGroups),
            visible: true
        };
        const newPanels = { ...s.panels, comparison: { ...s.panels.comparison, isOpen: true } };
        return {
            comparisonGroups: [...s.comparisonGroups, newGroup],
            isComparisonVisible: true,
            panels: newPanels
        };
    });
};

export const updateComparisonGroup = (set: any, id: string, partial: any) => {
    set((s: AppState) => ({
        comparisonGroups: s.comparisonGroups.map(g =>
            g.id === id ? { ...g, ...partial } : g
        )
    }));
};

export const deleteComparisonGroup = (set: any, id: string) => {
    set((s: AppState) => ({
        comparisonGroups: s.comparisonGroups.filter(g => g.id !== id)
    }));
};

export const toggleComparisonGroupVisibility = (set: any, id: string) => {
    set((s: AppState) => ({
        comparisonGroups: s.comparisonGroups.map(g =>
            g.id === id ? { ...g, visible: !g.visible } : g
        )
    }));
};

export const clearComparisonGroups = (set: any) => {
    set({ comparisonGroups: [] });
};

export const saveChordGroupCollection = (set: any, name: string) => {
    set((s: AppState) => {
        if (s.comparisonGroups.length === 0) return s;
        const collection = {
            id: `cgc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: name || `Collection ${(s as any).savedChordGroupCollections?.length + 1 || 1}`,
            groups: [...s.comparisonGroups],
            createdAt: new Date().toISOString()
        };
        return {
            savedChordGroupCollections: [...((s as any).savedChordGroupCollections || []), collection]
        };
    });
};

export const deleteChordGroupCollection = (set: any, id: string) => {
    set((s: any) => ({
        savedChordGroupCollections: (s.savedChordGroupCollections || []).filter((c: any) => c.id !== id)
    }));
};

export const loadChordGroupCollection = (set: any, collection: any) => {
    if (!collection || !Array.isArray(collection.groups)) {
        log.warn('loadChordGroupCollection: Invalid collection data', collection);
        return;
    }
    set((s: AppState) => {
        const newPanels = { ...s.panels, comparison: { ...s.panels.comparison, isOpen: true } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return {
            comparisonGroups: [...collection.groups],
            isComparisonVisible: true,
            panels: newPanels
        };
    });
};

export const saveKeyboard = (set: any, name: string, nodes: NodeData[], bindings: Record<string, string>) => set((s: AppState) => ({ savedKeyboards: [...s.savedKeyboards, { id: Date.now().toString(), name, nodes, bindings }] }));
export const deleteKeyboard = (set: any, id: string) => set((s: AppState) => ({ savedKeyboards: s.savedKeyboards.filter(k => k.id !== id) }));
export const loadKeyboard = (set: any, kb: any) => {
    set((s: AppState) => {
        const newPanels = { ...s.panels, keyboard: { ...s.panels.keyboard, isOpen: true } };
        return { customKeyboard: kb.nodes, keyBindings: kb.bindings, isKeyboardVisible: true, panels: newPanels };
    });
};
export const clearKeyboard = (set: any) => set({ customKeyboard: [], keyBindings: {} });

export const duplicateKeyboardWithFactor = (set: any, factorNum: bigint, factorDen: bigint) => {
    set((s: AppState) => {
        if (s.customKeyboard.length === 0) return s;

        const newNodes: NodeData[] = [];
        const newBindings: Record<string, string> = { ...s.keyBindings };
        const usedKeys = new Set(Object.values(newBindings));

        for (const node of s.customKeyboard) {

            const newRatioN = node.ratio.n * factorNum;
            const newRatioD = node.ratio.d * factorDen;

            const gcd = (a: bigint, b: bigint): bigint => {
                let x = a < 0n ? -a : a;
                let y = b < 0n ? -b : b;
                while (y !== 0n) {
                    const temp = y;
                    y = x % y;
                    x = temp;
                }
                return x;
            };
            const common = gcd(newRatioN, newRatioD);
            let simplifiedN = newRatioN / common;
            let simplifiedD = newRatioD / common;

            let octaveShift = 0;
            while (simplifiedN < simplifiedD && simplifiedD > 0n) {
                simplifiedN *= 2n;
                octaveShift -= 1;
            }
            while (simplifiedN >= simplifiedD * 2n && simplifiedD > 0n) {
                simplifiedD *= 2n;
                octaveShift += 1;
            }

            const newCents = simplifiedD > 0n ? 1200 * Math.log2(Number(simplifiedN) / Number(simplifiedD)) : 0;

            const newRatioFloat = simplifiedD > 0n ? Number(simplifiedN) / Number(simplifiedD) : 1;

            const newNode: NodeData = {
                ...node,
                id: `${node.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ratio: { n: simplifiedN, d: simplifiedD },
                ratioFloat: newRatioFloat,
                octave: (node.octave || 0) + octaveShift,
                cents: newCents,
                name: `${node.name}′`
            };

            newNodes.push(newNode);

            const nextKey = AUTO_BIND_KEYS.find(k => !usedKeys.has(k));
            if (nextKey) {
                newBindings[newNode.id] = nextKey;
                usedKeys.add(nextKey);
            }
        }

        return {
            customKeyboard: [...s.customKeyboard, ...newNodes],
            keyBindings: newBindings
        };
    });
};

const normalizeCommaName = (name: string) => (name || '').trim().normalize('NFKC');

const newCommaId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const saveCustomComma = (set: any, comma: any) =>
    set((s: AppState) => {
        const withId = { ...comma, id: comma?.id ?? newCommaId() };
        return { savedCommas: [...s.savedCommas, withId] };
    });

export const renameCustomComma = (set: any, id: string, newName: string) => {
    set((s: AppState) => ({
        savedCommas: s.savedCommas.map(c => {
            const currentId = (c as any).id ?? derivedCommaId(c);
            if (currentId === id) return { ...c, name: newName };
            return c;
        })
    }));
};

export const deleteCustomCommaById = (set: any, id: string) =>
    set((s: AppState) => ({
        savedCommas: s.savedCommas.filter(c => ((c as any).id ?? derivedCommaId(c)) !== id)
    }));

export const deleteCustomComma = (set: any, name: string) => {
    const target = normalizeCommaName(name);
    return set((s: AppState) => ({
        savedCommas: s.savedCommas.filter(c => normalizeCommaName((c as any).name) !== target)
    }));
};

export const saveMidiScale = (set: any, name: string, scale: string[]) => set((s: AppState) => ({ savedMidiScales: [...s.savedMidiScales, { id: Date.now().toString(), name, scale }] }));
export const deleteMidiScale = (set: any, id: string) => set((s: AppState) => ({ savedMidiScales: s.savedMidiScales.filter(sc => sc.id !== id) }));
export const loadMidiScale = (set: any, scale: string[]) => set((s: AppState) => ({ settings: { ...s.settings, midi: { ...s.settings.midi, mappingScale: scale, mappingDivisions: scale.length } } }));

export const setNodeTexture = (set: any, nodeId: string, url: string | null) => {
    set((s: AppState) => {
        const next = { ...s.customNodeTextures };
        if (!url) {
            delete next[nodeId];
        } else {
            next[nodeId] = url;
        }
        return { customNodeTextures: next };
    });
};
export const setNodeTextureRotation = (set: any, nodeId: string, rotation: number) => set((s: AppState) => ({ customNodeRotations: { ...s.customNodeRotations, [nodeId]: rotation } }));

const cleanupNodeSurfaceOverride = (o: any) => {
    const next: any = {};
    if (typeof o?.showRatio === 'boolean') next.showRatio = o.showRatio;
    if (typeof o?.showTexture === 'boolean') next.showTexture = o.showTexture;
    if (typeof o?.fontScale === 'number' && Number.isFinite(o.fontScale)) next.fontScale = o.fontScale;
    return next;
};

export const setNodeSurfaceLabelOverride = (set: any, nodeId: string, partial: any) => {
    set((s: AppState) => {
        const prev = (s as any).nodeSurfaceLabelOverrides?.[nodeId] || {};
        const merged = { ...prev, ...partial };
        const cleaned = cleanupNodeSurfaceOverride(merged);

        const next = { ...(s as any).nodeSurfaceLabelOverrides };
        if (Object.keys(cleaned).length === 0) {
            delete next[nodeId];
        } else {
            next[nodeId] = cleaned;
        }
        return { nodeSurfaceLabelOverrides: next };
    });
};

export const clearNodeSurfaceLabelOverride = (set: any, nodeId: string) =>
    set((s: AppState) => {
        const next = { ...(s as any).nodeSurfaceLabelOverrides };
        delete next[nodeId];
        return { nodeSurfaceLabelOverrides: next };
    });
