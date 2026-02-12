
import type { PanelId, PanelState, ProgressionStep, AppState, MathNoteSet, MathLabState, MathDot, ConsequentialScaleConfig, ConsequentialScaleResult } from '../../types';
import { INITIAL_PANELS } from './constants';
import { STORAGE_KEYS } from './storageKeys';

const PANEL_PERSIST_DEBOUNCE_MS = 200;
let panelPersistTimer: number | null = null;
let panelPersistPending: any = null;

const schedulePanelPersist = (panels: any) => {
    panelPersistPending = panels;
    if (typeof window === 'undefined' || !window.localStorage) return;

    if (panelPersistTimer !== null) {
        window.clearTimeout(panelPersistTimer);
    }

    panelPersistTimer = window.setTimeout(() => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(panelPersistPending));
        } catch (e) {
            
        }
        panelPersistTimer = null;
    }, PANEL_PERSIST_DEBOUNCE_MS);
};

export const setPanelState = (set: any, id: PanelId, partial: Partial<PanelState>) => {
    set((s: AppState) => {
        const newPanel = { ...s.panels[id], ...partial };
        const newPanels = { ...s.panels, [id]: newPanel };
        const maxZ = Math.max(s.topZIndex, newPanel.zIndex);
        schedulePanelPersist(newPanels);
        return { panels: newPanels, topZIndex: maxZ };
    });
};

export const focusPanel = (set: any, id: PanelId) => {
    set((s: AppState) => {
        const newZ = s.topZIndex + 1;
        const newPanels = { ...s.panels, [id]: { ...s.panels[id], zIndex: newZ } };
        return { panels: newPanels, topZIndex: newZ };
    });
};

export const resetPanelLayout = (set: any) => {
    set({ panels: INITIAL_PANELS });
    localStorage.removeItem(STORAGE_KEYS.panels);
};

export const toggleProgressionPanel = (set: any) => {
    set((s: AppState) => {
        const next = !s.isProgressionVisible;
        const newPanels = { ...s.panels, progression: { ...s.panels.progression, isOpen: next } };
        localStorage.setItem(STORAGE_KEYS.panels, JSON.stringify(newPanels));
        return { isProgressionVisible: next, panels: newPanels };
    });
};

export const progressionAddStep = (set: any, chordId: string) => {
    set((s: AppState) => ({ 
      progressionSteps: [...s.progressionSteps, { 
          id: Date.now().toString(), 
          chordId, 
          duration: 2, 
          velocity: 1.0, 
          mode: 'chord',
          arpPattern: 'up',
          subdivision: 1,
          gate: 0.9
      }] 
  }));
};

export const progressionAddRestStep = (set: any) => {
    set((s: AppState) => ({
        progressionSteps: [...s.progressionSteps, {
            id: `${Date.now().toString()}-rest`,
            chordId: 'rest',
            duration: 2,
            velocity: 1.0,
            mode: 'rest'
        }]
    }));
};

export const progressionRemoveStep = (set: any, index: number) => {
    set((s: AppState) => ({
        progressionSteps: s.progressionSteps.filter((_, i) => i !== index)
    }));
};

export const progressionMoveStep = (set: any, from: number, to: number) => {
    set((s: AppState) => {
        const steps = [...s.progressionSteps];
        if (from < 0 || to < 0 || from >= steps.length || to >= steps.length || from === to) {
            return { progressionSteps: steps };
        }
        const [item] = steps.splice(from, 1);
        steps.splice(to, 0, item);

        let current = s.progressionCurrentStep;
        if (current === from) current = to;
        else if (from < current && to >= current) current -= 1;
        else if (from > current && to <= current) current += 1;

        return { progressionSteps: steps, progressionCurrentStep: current };
    });
};

export const progressionDuplicateStep = (set: any, index: number) => {
    set((s: AppState) => {
        const steps = [...s.progressionSteps];
        const src = steps[index];
        if (!src) return { progressionSteps: steps };
        const copy = { ...src, id: `${Date.now().toString()}-dup` };
        steps.splice(index + 1, 0, copy);
        const current = s.progressionCurrentStep >= index + 1 ? s.progressionCurrentStep + 1 : s.progressionCurrentStep;
        return { progressionSteps: steps, progressionCurrentStep: current };
    });
};

export const progressionClearSteps = (set: any) => {
    set({ progressionSteps: [], progressionCurrentStep: 0 });
};

export const progressionUpdateStep = (set: any, index: number, partial: Partial<ProgressionStep>) => {
    set((s: AppState) => {
        const newSteps = [...s.progressionSteps];
        if (newSteps[index]) {
            newSteps[index] = { ...newSteps[index], ...partial };
        }
        return { progressionSteps: newSteps };
    });
};

export const addMathObject = (set: any, obj: any) => set((s: AppState) => ({ mathLab: { ...s.mathLab, objects: [...s.mathLab.objects, obj] } }));
export const updateMathObject = (set: any, id: string, partial: any) => set((s: AppState) => ({ mathLab: { ...s.mathLab, objects: s.mathLab.objects.map(o => o.id === id ? { ...o, ...partial } : o) } }));
export const removeMathObject = (set: any, id: string) => set((s: AppState) => ({ mathLab: { ...s.mathLab, objects: s.mathLab.objects.filter(o => o.id !== id) } }));
export const setMathObjects = (set: any, objects: any[]) => set((s: AppState) => ({ mathLab: { ...s.mathLab, objects } }));
export const setMathView = (set: any, view: any) => set((s: AppState) => ({ mathLab: { ...s.mathLab, view: { ...s.mathLab.view, ...view } } }));
export const setMathSampling = (set: any, sampling: any) => set((s: AppState) => ({ mathLab: { ...s.mathLab, sampling: { ...s.mathLab.sampling, ...sampling } } }));

export const setMathEditorState = (set: any, partial: Partial<MathLabState['editor']>) => set((s: AppState) => ({
    mathLab: { ...s.mathLab, editor: { ...s.mathLab.editor, ...partial } }
}));
export const setMathUnifiedFunctionState = (set: any, partial: Partial<NonNullable<MathLabState['unifiedFunctionState']>>) => set((s: AppState) => ({
    mathLab: { 
        ...s.mathLab,
        unifiedFunctionState: {
            ...(s.mathLab.unifiedFunctionState || { variableBindings: {}, variableDefs: {} }),
            ...partial,
            variableBindings: {
                ...((s.mathLab.unifiedFunctionState || {}).variableBindings || {}),
                ...(partial.variableBindings || {})
            },
            variableDefs: {
                ...((s.mathLab.unifiedFunctionState || {}).variableDefs || {}),
                ...(partial.variableDefs || {})
            }
        }
    }
}));
export const setMathLabState = (set: any, state: MathLabState) => set(() => ({ mathLab: state }));

export const addMathNoteSet = (set: any, noteSet: MathNoteSet) => set((s: AppState) => ({
    mathLab: { 
        ...s.mathLab, 
        noteSets: [...(s.mathLab.noteSets || []), noteSet],
        activeNoteSetId: noteSet.id 
    }
}));

export const updateMathNoteSet = (set: any, id: string, partial: Partial<MathNoteSet>) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        noteSets: (s.mathLab.noteSets || []).map(n => n.id === id ? { ...n, ...partial, updatedAt: new Date().toISOString() } : n)
    }
}));

export const removeMathNoteSet = (set: any, id: string) => set((s: AppState) => {
    const remaining = (s.mathLab.noteSets || []).filter(n => n.id !== id);
    return {
        mathLab: {
            ...s.mathLab,
            noteSets: remaining,
            activeNoteSetId: s.mathLab.activeNoteSetId === id ? (remaining[0]?.id || null) : s.mathLab.activeNoteSetId
        }
    };
});

export const deleteNoteSet = removeMathNoteSet; 

export const setActiveMathNoteSet = (set: any, id: string | null) => set((s: AppState) => ({
    mathLab: { ...s.mathLab, activeNoteSetId: id }
}));

export const addMathDot = (set: any, noteSetId: string, dot: MathDot) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        noteSets: (s.mathLab.noteSets || []).map(ns => {
            if (ns.id !== noteSetId) return ns;
            return { ...ns, dots: [...ns.dots, dot], updatedAt: new Date().toISOString() };
        })
    }
}));

export const updateMathDot = (set: any, noteSetId: string, dotId: string, partial: Partial<MathDot>) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        noteSets: (s.mathLab.noteSets || []).map(ns => {
            if (ns.id !== noteSetId) return ns;
            return { 
                ...ns, 
                dots: ns.dots.map(d => d.id === dotId ? { ...d, ...partial } : d),
                updatedAt: new Date().toISOString()
            };
        })
    }
}));

export const removeMathDot = (set: any, noteSetId: string, dotId: string) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        noteSets: (s.mathLab.noteSets || []).map(ns => {
            if (ns.id !== noteSetId) return ns;
            return { ...ns, dots: ns.dots.filter(d => d.id !== dotId), updatedAt: new Date().toISOString() };
        })
    }
}));

export const clearMathDots = (set: any, noteSetId: string) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        noteSets: (s.mathLab.noteSets || []).map(ns => {
            if (ns.id !== noteSetId) return ns;
            return { ...ns, dots: [], updatedAt: new Date().toISOString() };
        })
    }
}));

export const addConsequentialScale = (set: any, config: ConsequentialScaleConfig) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        consequentialScales: [...(s.mathLab.consequentialScales || []), config],
        activeConsequentialScaleId: config.id
    }
}));

export const updateConsequentialScale = (set: any, id: string, partial: Partial<ConsequentialScaleConfig>) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        consequentialScales: (s.mathLab.consequentialScales || []).map(c => c.id === id ? { ...c, ...partial } : c)
    }
}));

export const removeConsequentialScale = (set: any, id: string) => set((s: AppState) => {
    const remaining = (s.mathLab.consequentialScales || []).filter(c => c.id !== id);
    return {
        mathLab: {
            ...s.mathLab,
            consequentialScales: remaining,
            activeConsequentialScaleId: s.mathLab.activeConsequentialScaleId === id ? (remaining[0]?.id || null) : s.mathLab.activeConsequentialScaleId
        }
    };
});

export const setActiveConsequentialScale = (set: any, id: string | null) => set((s: AppState) => ({
    mathLab: { ...s.mathLab, activeConsequentialScaleId: id }
}));

export const updateConsequentialCache = (set: any, id: string, result: ConsequentialScaleResult) => set((s: AppState) => ({
    mathLab: {
        ...s.mathLab,
        consequentialCache: { ...(s.mathLab.consequentialCache || {}), [id]: result }
    }
}));

export const updateNoteSet = updateMathNoteSet;
export const addNoteSet = addMathNoteSet;
export const setActiveNoteSet = setActiveMathNoteSet;
