import { useMemo, useCallback } from 'react';
import { EDO_PRESETS } from '../../../../constants';
import { generateEdoScale } from '../../../../utils/midiFileRetune';
import { buildTargetFrequencies, findNearestTargetIndex, midiNoteToFrequency } from '../../../../utils/midiAudioRenderer';
import { findBestTuningForChord } from '../../../../utils/dynamicTuning';
import { buildNodeScale, buildHChromaScale, snapScaleToLayout } from './utils';
import { computeLatticeExtension, type LatticeExtensionPlan } from './ratioAnalyzer';

export const useMidiFileRetuneTargets = ({
    settings,
    nodes,
    layoutMode,
    targetMode,
    retuneCustomScale,
    savedMidiScales,
    selectedScaleId,
    scalaSource,
    loadedScalaScale,
    edoDivisions,
    restrictToNodes,
    showStats,
    importResult,
    resolvedBaseNote,
    resolvedBaseFrequency,
    extensionMode,
    updateState,
    updateSettings,
    regenerateLattice,
    setShowExtensionConfirm,
    setExtensionPanelCollapsed
}: {
    settings: any;
    nodes: any[];
    layoutMode: string;
    targetMode: string;
    retuneCustomScale: string[] | null;
    savedMidiScales: any[];
    selectedScaleId: string;
    scalaSource: string;
    loadedScalaScale: { ratios: string[] } | null;
    edoDivisions: number;
    restrictToNodes: boolean;
    showStats: boolean;
    importResult: any;
    resolvedBaseNote: number;
    resolvedBaseFrequency: number;
    extensionMode: 'temporary' | 'permanent' | 'replacement';
    updateState: (partial: any) => void;
    updateSettings: (partial: any) => void;
    regenerateLattice: (a?: boolean, b?: boolean) => void;
    setShowExtensionConfirm: (value: boolean) => void;
    setExtensionPanelCollapsed: (value: boolean) => void;
}) => {
    const nodeScale = useMemo(() => buildNodeScale(nodes), [nodes]);
    const hChromaScale = useMemo(() => {
        const baseA = Math.max(1.01, Number(settings?.visuals?.hChromaBase ?? 2));
        const limit = Number(settings?.visuals?.hChromaLimit ?? 47);
        return buildHChromaScale(baseA, limit, settings?.visuals?.hChromaCustomScale);
    }, [settings?.visuals?.hChromaBase, settings?.visuals?.hChromaLimit, settings?.visuals?.hChromaCustomScale]);
    const layoutScale = useMemo(() => (layoutMode === 'h-chroma' ? hChromaScale : nodeScale), [layoutMode, hChromaScale, nodeScale]);

    const targetScale = useMemo(() => {
        if (targetMode === 'lattice') {
            return { scale: layoutScale.scale, width: layoutScale.scale.length, nodeIdByScaleIndex: layoutScale.nodeIdByScaleIndex };
        }
        if (targetMode === 'custom') {
            const scale = retuneCustomScale || [];
            if (!restrictToNodes) {
                return { scale, width: scale.length, nodeIdByScaleIndex: scale.map(() => null) };
            }
            const snapped = snapScaleToLayout(scale, layoutScale);
            return { scale: snapped.scale, width: snapped.scale.length, nodeIdByScaleIndex: snapped.nodeIdByScaleIndex };
        }
        if (targetMode === 'scale') {
            if (scalaSource === 'archive' && loadedScalaScale) {
                const ratios = loadedScalaScale.ratios;
                if (!restrictToNodes) {
                    return { scale: ratios, width: ratios.length, nodeIdByScaleIndex: ratios.map(() => null) };
                }
                const snapped = snapScaleToLayout(ratios, layoutScale);
                return { scale: snapped.scale, width: snapped.scale.length, nodeIdByScaleIndex: snapped.nodeIdByScaleIndex };
            }
            const scale = savedMidiScales.find((s) => s.id === selectedScaleId);
            const ratios = scale ? scale.scale : [];
            if (!restrictToNodes) {
                return { scale: ratios, width: ratios.length, nodeIdByScaleIndex: ratios.map(() => null) };
            }
            const snapped = snapScaleToLayout(ratios, layoutScale);
            return { scale: snapped.scale, width: snapped.scale.length, nodeIdByScaleIndex: snapped.nodeIdByScaleIndex };
        }
        const preset = EDO_PRESETS[edoDivisions];
        const scale = preset ? [...preset] : generateEdoScale(edoDivisions);
        if (!restrictToNodes) {
            return { scale, width: scale.length, nodeIdByScaleIndex: scale.map(() => null) };
        }
        const snapped = snapScaleToLayout(scale, layoutScale);
        return { scale: snapped.scale, width: snapped.scale.length, nodeIdByScaleIndex: snapped.nodeIdByScaleIndex };
    }, [targetMode, retuneCustomScale, settings?.midi?.mappingScale, savedMidiScales, selectedScaleId, scalaSource, loadedScalaScale, edoDivisions, restrictToNodes, layoutScale]);

    const effectiveTargetScale = useMemo(() => {
        if (targetScale.width) return targetScale;
        return { scale: ['1/1'], width: 1, nodeIdByScaleIndex: [null] };
    }, [targetScale]);

    const extensionPlan = useMemo((): LatticeExtensionPlan | null => {
        if (targetMode === 'dynamic' || targetMode === 'lattice') return null;
        if (!effectiveTargetScale.scale.length) return null;

        const plan = computeLatticeExtension(effectiveTargetScale.scale, nodes, settings);
        return plan.missingRatios.length > 0 ? plan : null;
    }, [effectiveTargetScale.scale, nodes, settings, targetMode]);

    const handleApplyExtension = useCallback(() => {
        if (!extensionPlan) return;

        if (extensionMode === 'temporary') {
            updateState({
                preExtensionSettings: JSON.parse(JSON.stringify(settings)),
                temporaryExtensionApplied: true
            });
        }

        if (extensionMode === 'replacement') {
            const newRootLimits: number[] = [];
            const newGen0Ranges: Record<number, { neg: number; pos: number }> = {};

            const allPrimes = new Set<number>();
            extensionPlan.missingRatios.forEach(r => {
                Object.keys(r.primeVector).forEach(p => allPrimes.add(Number(p)));
            });

            let newCustomPrimes = [...(settings.customPrimes || [])];
            extensionPlan.newCustomPrimes.forEach(np => {
                if (!newCustomPrimes.some((ep: any) => ep.prime === np.prime)) {
                    newCustomPrimes.push(np);
                }
            });

            allPrimes.forEach(prime => {
                if (prime > 2) {
                    newRootLimits.push(prime);
                    const change = extensionPlan.gen0Changes[prime];
                    if (change) {
                        newGen0Ranges[prime] = change.required;
                    } else {
                        newGen0Ranges[prime] = { neg: 1, pos: 1 };
                    }
                }
            });

            const sortedPrimes = newRootLimits.slice().sort((a, b) => a - b);
            const primeSpacings: Record<number, number> = { ...(settings.visuals?.primeSpacings || {}) };

            sortedPrimes.forEach((prime, index) => {
                const isStandard = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].includes(prime);
                if (!isStandard) {
                    primeSpacings[prime] = 1.5 + (index * 0.2);
                } else if (!primeSpacings[prime]) {
                    primeSpacings[prime] = 1.0;
                }
            });

            updateSettings({
                customPrimes: newCustomPrimes,
                rootLimits: sortedPrimes as any,
                gen0Ranges: newGen0Ranges,
                expansionA: 1,
                expansionB: 0,
                expansionC: 0,
                expansionD: 0,
                expansionE: 0,
                secondaryOrigins: [],
                visuals: {
                    ...settings.visuals,
                    primeSpacings
                }
            });

            regenerateLattice(true, true);
            setShowExtensionConfirm(false);
            setExtensionPanelCollapsed(true);
            return;
        }

        if (extensionPlan.newCustomPrimes.length > 0) {
            const existingPrimes = settings.customPrimes || [];
            const newPrimes = extensionPlan.newCustomPrimes.filter(
                np => !existingPrimes.some((ep: any) => ep.prime === np.prime)
            );
            if (newPrimes.length > 0) {
                updateSettings({ customPrimes: [...existingPrimes, ...newPrimes] });
            }
        }

        if (Object.keys(extensionPlan.gen0Changes).length > 0) {
            const newGen0Ranges = { ...(settings.gen0Ranges || {}) };
            let changed = false;

            for (const [primeStr, change] of Object.entries(extensionPlan.gen0Changes)) {
                const prime = Number(primeStr);
                const current = newGen0Ranges[prime] || { neg: 0, pos: 0 };
                if (change.required.neg > current.neg || change.required.pos > current.pos) {
                    newGen0Ranges[prime] = {
                        neg: Math.max(current.neg, change.required.neg),
                        pos: Math.max(current.pos, change.required.pos)
                    };
                    changed = true;
                }
            }

            if (changed) {
                updateSettings({ gen0Ranges: newGen0Ranges });
            }
        }

        regenerateLattice(true, true);
        setShowExtensionConfirm(false);
        setExtensionPanelCollapsed(true);
    }, [extensionPlan, extensionMode, settings, updateState, updateSettings, regenerateLattice, setExtensionPanelCollapsed, setShowExtensionConfirm]);

    const retuneStats = useMemo(() => {
        if (!showStats || !importResult?.notes?.length) return null;

        const ratioToFloat = (ratio: string) => {
            const trimmed = (ratio || '').trim();
            if (!trimmed) return 1;
            if (trimmed.includes('/')) {
                const parts = trimmed.split('/');
                const n = Number(parts[0]);
                const d = Number(parts[1]);
                if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 1;
                return n / d;
            }
            const value = Number(trimmed);
            return Number.isFinite(value) && value > 0 ? value : 1;
        };

        if (targetMode === 'dynamic') {
            if (!nodes.length) return null;
            const baseNoteNum = resolvedBaseNote;
            const baseFreq = resolvedBaseFrequency;
            const nodeById = new Map(nodes.map((node) => [node.id, node]));
            const ratioCounts = new Map<string, number>();
            const chordCounts = new Map<string, number>();
            const notesSorted = [...importResult.notes].sort((a: any, b: any) => a.startTick - b.startTick);

            let active: { note: any; nodeId: string | null }[] = [];
            let index = 0;

            while (index < notesSorted.length) {
                const tick = notesSorted[index].startTick;
                active = active.filter((entry) => (entry.note.startTick + entry.note.durationTicks) > tick);

                const batch: any[] = [];
                while (index < notesSorted.length && notesSorted[index].startTick === tick) {
                    batch.push(notesSorted[index]);
                    index += 1;
                }

                const activeNotes = active.map((entry) => entry.note);
                const allNotes = [...activeNotes, ...batch];
                const fixedAssignments = new Map<number, string>();
                active.forEach((entry, idx) => {
                    if (entry.nodeId) fixedAssignments.set(idx, entry.nodeId);
                });

                const MAX_CONCURRENT_NOTES_STATS = 30;
                const tuningNotes = allNotes.slice(0, MAX_CONCURRENT_NOTES_STATS);

                const targetCents = tuningNotes.map((note: any) => {
                    const freq = note.frequencyHz;
                    if (Number.isFinite(freq) && freq > 0 && Number.isFinite(baseFreq) && baseFreq > 0) {
                        return 1200 * Math.log2(freq / baseFreq);
                    }
                    return (note.noteNumber - baseNoteNum) * 100;
                });

                let result;
                try {
                    result = findBestTuningForChord(
                        tuningNotes.map((note: any) => note.noteNumber),
                        nodes,
                        baseNoteNum,
                        45,
                        fixedAssignments,
                        { targetCents }
                    );
                } catch (e) {
                    console.warn('Retune stats computation failed for chord', e);
                    result = { nodeIds: [], octaveShifts: [], totalComplexity: 0 };
                }

                batch.forEach((note: any, batchIdx: number) => {
                    const nodeId = result.nodeIds[activeNotes.length + batchIdx] ?? null;
                    active.push({ note, nodeId });
                    const node = nodeId ? nodeById.get(nodeId) : null;
                    if (node?.ratio) {
                        const ratioStr = `${node.ratio.n}/${node.ratio.d}`;
                        ratioCounts.set(ratioStr, (ratioCounts.get(ratioStr) || 0) + 1);
                    }
                });

                const chordRatios = active
                    .map((entry) => entry.nodeId ? nodeById.get(entry.nodeId) : null)
                    .filter(Boolean)
                    .map((node) => `${node!.ratio.n}/${node!.ratio.d}`);

                if (chordRatios.length >= 2) {
                    const unique = Array.from(new Set(chordRatios)).sort((a, b) => ratioToFloat(a) - ratioToFloat(b));
                    const key = unique.join(' + ');
                    chordCounts.set(key, (chordCounts.get(key) || 0) + 1);
                }
            }

            const ratioStats = Array.from(ratioCounts.entries()).sort((a, b) => b[1] - a[1]);
            const chordStats = Array.from(chordCounts.entries()).sort((a, b) => b[1] - a[1]);
            const maxRatioCount = ratioStats.length ? ratioStats[0][1] : 0;
            const maxChordCount = chordStats.length ? chordStats[0][1] : 0;

            return {
                ratioStats,
                chordStats,
                maxRatioCount,
                maxChordCount,
                totalNotes: importResult.notes.length
            };
        }

        const scale = effectiveTargetScale.scale.length ? effectiveTargetScale.scale : ['1/1'];
        const scaleSize = Math.max(1, scale.length);
        const baseNoteNum = resolvedBaseNote;
        const baseFreq = resolvedBaseFrequency;
        const targetFreqs = buildTargetFrequencies(scale, baseNoteNum, baseFreq);
        const ratioCounts = new Map<string, number>();
        const chordCounts = new Map<string, number>();
        const notesByStart = new Map<number, string[]>();

        importResult.notes.forEach((note: any) => {
            const sourceFreq = note.frequencyHz || midiNoteToFrequency(note.noteNumber);
            const nearest = findNearestTargetIndex(targetFreqs, sourceFreq);
            const degree = ((nearest.noteIndex - baseNoteNum) % scaleSize + scaleSize) % scaleSize;
            const ratio = scale[degree] || '1/1';
            ratioCounts.set(ratio, (ratioCounts.get(ratio) || 0) + 1);
            const list = notesByStart.get(note.startTick) || [];
            list.push(ratio);
            notesByStart.set(note.startTick, list);
        });

        notesByStart.forEach((ratios) => {
            if (ratios.length < 2) return;
            const unique = Array.from(new Set(ratios)).sort((a, b) => ratioToFloat(a) - ratioToFloat(b));
            const key = unique.join(' + ');
            chordCounts.set(key, (chordCounts.get(key) || 0) + 1);
        });

        const ratioStats = Array.from(ratioCounts.entries()).sort((a, b) => b[1] - a[1]);
        const chordStats = Array.from(chordCounts.entries()).sort((a, b) => b[1] - a[1]);
        const maxRatioCount = ratioStats.length ? ratioStats[0][1] : 0;
        const maxChordCount = chordStats.length ? chordStats[0][1] : 0;

        return {
            ratioStats,
            chordStats,
            maxRatioCount,
            maxChordCount,
            totalNotes: importResult.notes.length
        };
    }, [showStats, importResult, effectiveTargetScale, resolvedBaseNote, resolvedBaseFrequency, targetMode, nodes]);

    const noteStats = useMemo(() => {
        if (!importResult?.notes?.length) return null;
        const noteNumbers = importResult.notes.map((n: any) => n.noteNumber);
        const channels = new Set(importResult.notes.map((n: any) => n.channel));
        let min = Infinity;
        let max = -Infinity;
        for (const n of noteNumbers) {
            if (n < min) min = n;
            if (n > max) max = n;
        }
        return {
            count: importResult.notes.length,
            min: min === Infinity ? 0 : min,
            max: max === -Infinity ? 127 : max,
            channels: channels.size
        };
    }, [importResult]);

    const sortedSavedScales = useMemo(() => {
        return [...savedMidiScales].sort((a, b) => a.name.localeCompare(b.name));
    }, [savedMidiScales]);

    return {
        layoutScale,
        effectiveTargetScale,
        extensionPlan,
        handleApplyExtension,
        retuneStats,
        noteStats,
        sortedSavedScales
    } as const;
};

