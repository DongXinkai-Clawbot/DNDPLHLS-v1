
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { notifySuccess } from '../../utils/notifications';
import { shallow } from 'zustand/shallow';
import type { ConsequentialScaleConfig, ConsequentialScaleResult, MathFunctionPreset, MathObject, VariableDef } from '../../types';
import { startNote } from '../../audioEngine';
import { generateConsequentialNotes } from '../../utils/consequentialScale';
import { preprocessExpression } from '../../utils/mathExpressionPreprocess';
import { spreadChordFrequencies } from '../../utils/octaveSpread';
import { Vector3 } from 'three';
import { ConsequentialBuilderView } from './consequentialBuilder/ConsequentialBuilderView';
import { DEFAULT_CONFIG } from './consequentialBuilder/defaults';

export const ConsequentialBuilder = () => {
    const {
      mathLab,
      addConsequentialScale,
      updateConsequentialScale,
      setActiveConsequentialScale,
      updateConsequentialCache,
      saveMidiScale,
      setCustomKeyboard,
      addToComparison,
      settings
    } = useStore((s) => ({
      mathLab: s.mathLab,
      addConsequentialScale: s.addConsequentialScale,
      updateConsequentialScale: s.updateConsequentialScale,
      setActiveConsequentialScale: s.setActiveConsequentialScale,
      updateConsequentialCache: s.updateConsequentialCache,
      saveMidiScale: s.saveMidiScale,
      setCustomKeyboard: s.setCustomKeyboard,
      addToComparison: s.addToComparison,
      settings: s.settings
    }), shallow);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [localConfig, setLocalConfig] = useState<ConsequentialScaleConfig>(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
    const [result, setResult] = useState<ConsequentialScaleResult | null>(null);
    const [previewExpr, setPreviewExpr] = useState("");
    const [iListInput, setIListInput] = useState("");
    const [showPresets, setShowPresets] = useState(false);
    const [showGrapherImport, setShowGrapherImport] = useState(false);

    const voicesRef = useRef<(() => void)[]>([]);
    const timeoutsRef = useRef<number[]>([]);

    const scales = mathLab?.consequentialScales || [];
    const cache = mathLab?.consequentialCache || {};
    const grapherObjects = mathLab?.objects || [];

    useEffect(() => {
        if (mathLab?.activeConsequentialScaleId) {
            setActiveId(mathLab.activeConsequentialScaleId);
            const cfg = scales.find(c => c.id === mathLab.activeConsequentialScaleId);
            if (cfg) {
                
                const mergedDisplay = { ...DEFAULT_CONFIG.display, ...cfg.display };
                const mergedPlayback = { ...DEFAULT_CONFIG.playback, ...cfg.playback };
                const mergedMapping = { ...DEFAULT_CONFIG.mapping, ...cfg.mapping };
                const mergedConfig = { ...cfg, display: mergedDisplay, playback: mergedPlayback, mapping: mergedMapping };
                
                if (mergedConfig.derivativeOrder === undefined) mergedConfig.derivativeOrder = 0;

                setLocalConfig(JSON.parse(JSON.stringify(mergedConfig)));
                if (cache[cfg.id]) {
                    setResult(cache[cfg.id]);
                } else {
                    handleGenerate(mergedConfig);
                }
            }
        } else {
            if (scales.length > 0) {
                setActiveConsequentialScale(scales[0].id);
            }
        }
    }, [mathLab?.activeConsequentialScaleId, scales.length]);

    useEffect(() => {
        let raw = localConfig.expressionRaw;
        const { processed } = preprocessExpression(raw, localConfig.advancedSymbols);
        setPreviewExpr(processed);
    }, [localConfig.expressionRaw, localConfig.advancedSymbols, localConfig.mode]);

    const handleConfigChange = (partial: Partial<ConsequentialScaleConfig> | any) => {
        setLocalConfig(prev => {
            const next = { ...prev, ...partial };
            if (partial.domain) next.domain = { ...prev.domain, ...partial.domain };
            if (partial.mapping) next.mapping = { ...prev.mapping, ...partial.mapping };
            if (partial.display) next.display = { ...prev.display, ...partial.display };
            if (partial.playback) next.playback = { ...prev.playback, ...partial.playback };
            return next;
        });
    };

    const availableVars = useMemo(() => {
        const vars = new Set<string>(['idx']);
        const hasCustomVars = localConfig.domain.variables && localConfig.domain.variables.length > 0;
        
        if (hasCustomVars) {
             localConfig.domain.variables!.forEach(v => vars.add(v.name));
        } else {
             vars.add('n');
             vars.add('i');
        }
        return Array.from(vars);
    }, [localConfig.domain.variables]);

    useEffect(() => {
        if (!availableVars.includes(localConfig.display.xAxis)) {
            
            const firstDomain = localConfig.domain.variables?.find(v => v.role === 'domain')?.name;
            const fallback = firstDomain || availableVars[0] || 'idx';
            
            if (fallback !== localConfig.display.xAxis) {
                handleConfigChange({ display: { xAxis: fallback } });
            }
        }
    }, [availableVars, localConfig.display.xAxis]);

    const handleLoadPreset = (p: MathFunctionPreset) => {
        const newVars: VariableDef[] = [];
        let xAxisVar = 'x';
        if (p.expression.includes('x')) {
            newVars.push({ name: 'x', value: 0, min: p.params.min, max: p.params.max, step: 1, role: 'domain' });
        } else if (p.expression.includes('t')) {
            
        }
        
        const nextConfig = { ...localConfig };
        nextConfig.expressionRaw = p.expression;
        nextConfig.mode = 'Custom'; 
        nextConfig.domain.variables = newVars;
        
        if (p.type === 'parametric') {
            nextConfig.mappingMode = 'parametric_y';
            xAxisVar = 't';
            if (!newVars.find(v=>v.name==='t')) {
                 newVars.push({ name: 't', value: 0, min: p.params.min, max: p.params.max, step: 0.1, role: 'domain' });
            }
        } else {
            nextConfig.mappingMode = 'scalar_ratio';
        }
        
        nextConfig.display.xAxis = xAxisVar;
        setLocalConfig(nextConfig);
        setShowPresets(false);
    };

    const handleImportGrapherObject = (obj: MathObject) => {
        const newVars: VariableDef[] = [];
        let xAxisVar = 'x';

        if (obj.expression.includes('x') || obj.type === 'explicit') {
            newVars.push({ name: 'x', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
        }
        
        const bindings = mathLab.unifiedFunctionState?.variableBindings || {};
        const defs = mathLab.unifiedFunctionState?.variableDefs || {};
        Object.entries(bindings).forEach(([k, v]) => {
            const val = v as number;
            const def = defs[k];
            newVars.push({ name: k, value: val, min: def?.min ?? val-10, max: def?.max ?? val+10, step: def?.step ?? 0.1, role: 'parameter' });
        });

        const nextConfig = { ...localConfig };
        nextConfig.expressionRaw = obj.expression;
        nextConfig.mode = 'Custom';
        nextConfig.domain.variables = newVars;
        
        if (obj.type === 'parametric') {
            nextConfig.mappingMode = 'parametric_y';
            xAxisVar = 't';
            if (!newVars.find(v=>v.name==='t')) {
                 newVars.push({ name: 't', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
            }
        }
        else if (obj.type === 'polar') {
            nextConfig.mappingMode = 'polar_r';
            xAxisVar = 'theta';
            if (!newVars.find(v=>v.name==='theta')) {
                 newVars.push({ name: 'theta', value: 0, min: obj.params.min, max: obj.params.max, step: 0.1, role: 'domain' });
            }
        }
        else {
            nextConfig.mappingMode = 'scalar_ratio';
        }

        nextConfig.display.xAxis = xAxisVar;
        setLocalConfig(nextConfig);
        setShowGrapherImport(false);
    };

    const handleAddVariable = () => {
        const v: VariableDef = { name: 'v', value: 1, min: 1, max: 10, step: 1, role: 'parameter' };
        const currentVars = localConfig.domain.variables || [];
        handleConfigChange({ domain: { variables: [...currentVars, v] } });
    };

    const updateVariable = (idx: number, p: Partial<VariableDef>) => {
        const currentVars = [...(localConfig.domain.variables || [])];
        if (currentVars[idx]) {
            currentVars[idx] = { ...currentVars[idx], ...p };
            handleConfigChange({ domain: { variables: currentVars } });
        }
    };

    const removeVariable = (idx: number) => {
        const currentVars = [...(localConfig.domain.variables || [])];
        currentVars.splice(idx, 1);
        handleConfigChange({ domain: { variables: currentVars } });
    };

    const handleGenerate = (configToUse = localConfig) => {
        if (iListInput.trim()) {
            const list = iListInput.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            configToUse.domain.iList = list;
        }

        const res = generateConsequentialNotes(configToUse);
        setResult(res);
        
        if (activeId && activeId !== 'temp') {
            updateConsequentialScale(activeId, configToUse);
            updateConsequentialCache(activeId, res);
        }
    };

    const handleCreateNew = () => {
        const newId = `cs-${Date.now()}`;
        const newConfig = { ...localConfig, id: newId, name: `Scale ${scales.length + 1}` };
        addConsequentialScale(newConfig);
        setActiveConsequentialScale(newId);
    };

    const stopAll = () => {
        timeoutsRef.current.forEach(window.clearTimeout);
        timeoutsRef.current = [];
        voicesRef.current.forEach(stop => stop());
        voicesRef.current = [];
    };

    useEffect(() => () => stopAll(), []);

    const handlePlayScale = () => {
        stopAll();
        if (!result) return;
        const playable = result.notes.filter(n => n.playable);
        const seq = playable.sort((a,b) => a.idx - b.idx);
        let time = 0;
        
        let dur = localConfig.playback.scaleNoteDuration || 300;
        let gap = localConfig.playback.scaleNoteGap !== undefined ? localConfig.playback.scaleNoteGap : 100;

        if (localConfig.playback.speedUnit === 'bpm') {
             const bpm = localConfig.playback.bpm || 120;
             const gate = localConfig.playback.gate || 0.8;
             const stepMs = 60000 / bpm;
             dur = stepMs * gate;
             gap = stepMs * (1 - gate);
        }

        seq.forEach(n => {
            const t = window.setTimeout(() => {
                const stop = playFreq(n.freqHz, 'click');
                voicesRef.current.push(stop);
                
                const tStop = window.setTimeout(() => stop(), dur);
                timeoutsRef.current.push(tStop);
            }, time);
            timeoutsRef.current.push(t);
            time += (dur + gap);
        });
    };

    const handlePlayChord = () => {
        stopAll();
        if (!result) return;
        const candidates = result.notes;
        const notesToUse = candidates.slice(0, localConfig.playback.chordNoteCount);
        const freqs = notesToUse.map(n => n.freqHz);
        const { freqsOut, mutedMask } = spreadChordFrequencies(
            freqs, 
            localConfig.playback.spreadOctaves,
            localConfig.playback.minSpacingCents,
            [20, 20000],
            localConfig.playback.strategy
        );
        freqsOut.forEach((f, i) => {
            if (mutedMask[i]) return;
            const t = window.setTimeout(() => {
                const stop = playFreq(f, 'chord');
                voicesRef.current.push(stop);
            }, i * 30);
            timeoutsRef.current.push(t);
        });
    };

    const playFreq = (freq: number, type: 'click'|'chord') => {
        const r = freq / settings.baseFrequency;
        const precision = 10000;
        const nVal = Math.round(r * precision);
        const dVal = precision;
        const dummyNode: any = {
            id: 'temp-audio',
            position: new Vector3(),
            primeVector: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0}, 
            ratio: { n: BigInt(nVal), d: BigInt(dVal) }, 
            octave: 0,
            cents: 1200 * Math.log2(freq / settings.baseFrequency),
            gen: 0, originLimit: 0, parentId: null, name: ''
        };
        return startNote(dummyNode, settings, type);
    };

    const handleSaveMidi = () => {
        if (!result) return;
        
        const map: string[] = result.notes
            .filter(n => n.playable)
            .map(n => {
                let val = n.ratioFloat;
                while (val >= 2) val /= 2;
                while (val < 1) val *= 2;
                return val.toFixed(6);
            });
        const unique = Array.from(new Set(map)).sort();
        saveMidiScale(localConfig.name || "Consequential", unique);
        notifySuccess(`Saved ${unique.length} tones to MIDI Map.`, 'Consequential');
    };

    const handleSaveKeyboard = () => {
        if (!result) return;
        const nodes = result.notes.filter(n => n.playable).map(n => ({
            id: `cs-${n.n}-${n.i}`,
            position: new Vector3(),
            primeVector: n.primeVector || {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
            ratio: n.frac || { n: BigInt(Math.round(n.ratioFloat*1000)), d: 1000n },
            octave: n.octaveShift,
            cents: n.cents,
            gen: 0, originLimit: 0, parentId: null,
            name: `n=${n.n},i=${n.i}`
        }));
        setCustomKeyboard(nodes as any);
        notifySuccess('Applied to Virtual Keyboard.', 'Consequential');
    };

    const handleCompare = () => {
        if (!result) return;
        result.notes.filter(n => n.playable).forEach(n => {
             const node = {
                id: `cmp-${n.n}-${n.i}`,
                position: new Vector3(),
                primeVector: n.primeVector || {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
                ratio: n.frac || { n: BigInt(Math.round(n.ratioFloat*1000)), d: 1000n },
                octave: n.octaveShift,
                cents: n.cents,
                gen: 0, originLimit: 0, parentId: null,
                name: `n=${n.n}`
            };
            addToComparison(node as any);
        });
    };

    const viewProps = {
        activeId,
        localConfig,
        result,
        previewExpr,
        iListInput,
        showPresets,
        showGrapherImport,
        availableVars,
        grapherObjects,
        handleLoadPreset,
        handleImportGrapherObject,
        handleConfigChange,
        handleAddVariable,
        updateVariable,
        removeVariable,
        setShowPresets,
        setShowGrapherImport,
        setIListInput,
        handleGenerate,
        handleCreateNew,
        stopAll,
        handlePlayScale,
        handlePlayChord,
        playFreq,
        handleSaveMidi,
        handleSaveKeyboard,
        handleCompare
    };
    return <ConsequentialBuilderView {...viewProps} />;
};
