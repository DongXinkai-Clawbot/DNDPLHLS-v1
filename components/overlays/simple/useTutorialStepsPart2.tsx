
import React, { useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import { playNote, playSimultaneous } from '../../../audioEngine';
import { formatRatio } from '../../../musicLogic';
import type { NodeData, TutorialTemperingConstraint, TutorialTemperingResult } from '../../../types';
import type { TutorialStep } from './tutorialTypes';

export const usePart2Steps = (onFinish: (keepSettings?: boolean) => void) => {
    const {
      updateSettings,
      updateVisualSettings,
      regenerateLattice,
      selectNode,
      setCommaLines,
      setNavAxisVertical,
      settings,
      nodes,
      commaLines,
      pending_tempering_constraints,
      tempering_strategy,
      tempering_model,
      tempering_result,
      setPendingTemperingConstraints,
      setTemperingStrategy,
      setTemperingModel,
      setTemperingResult,
      resetTemperingTutorial,
      setNodeNameOverride
    } = useStore((s) => ({
      updateSettings: s.updateSettings,
      updateVisualSettings: s.updateVisualSettings,
      regenerateLattice: s.regenerateLattice,
      selectNode: s.selectNode,
      setCommaLines: s.setCommaLines,
      setNavAxisVertical: s.setNavAxisVertical,
      settings: s.settings,
      nodes: s.nodes,
      commaLines: s.commaLines,
      pending_tempering_constraints: s.pending_tempering_constraints,
      tempering_strategy: s.tempering_strategy,
      tempering_model: s.tempering_model,
      tempering_result: s.tempering_result,
      setPendingTemperingConstraints: s.setPendingTemperingConstraints,
      setTemperingStrategy: s.setTemperingStrategy,
      setTemperingModel: s.setTemperingModel,
      setTemperingResult: s.setTemperingResult,
      resetTemperingTutorial: s.resetTemperingTutorial,
      setNodeNameOverride: s.setNodeNameOverride
    }), shallow);
    const basePrimeVector: NodeData['primeVector'] = { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 };
    const buildEqualStepNode = (stepIndex: number): NodeData => {
        const ratioFloat = Math.pow(2, stepIndex / 12);
        return {
            id: `equal-step-${stepIndex}`,
            position: new Vector3(),
            primeVector: basePrimeVector,
            ratio: { n: 1n, d: 1n },
            ratioFloat,
            octave: 0,
            cents: (1200 / 12) * stepIndex,
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: `2^(${stepIndex}/12)`
        };
    };

    const [allowGeneratorAdjustment, setAllowGeneratorAdjustment] = useState(true);
    const [modelError, setModelError] = useState<string | null>(null);
    const [isSolving, setIsSolving] = useState(false);

    const nodeById = useMemo(() => {
        const map = new Map<string, NodeData>();
        nodes.forEach((n) => map.set(n.id, n));
        return map;
    }, [nodes]);

    const commaData = useMemo(() => {
        const first = commaLines[0] || null;
        const fallbackSource = nodes.find(n => n.gen === 0 && n.originLimit === 0) || null;
        const fallbackTarget = nodes.find(n => n.primeVector[3] === 12) || null;
        const source = first ? nodeById.get(first.sourceId) || null : fallbackSource;
        const target = first ? nodeById.get(first.targetId) || null : fallbackTarget;
        const sourceId = source?.id || 'source';
        const targetId = target?.id || 'target';
        const commaCentsRaw = source && target ? (target.cents - source.cents) : 23.46;
        const commaCents = Number.isFinite(commaCentsRaw) ? commaCentsRaw : 23.46;
        const pathA = first?.name
            ? `Path A: ${first.name}`
            : 'Path A: twelve fifths upward';
        const pathB = 'Path B: seven octaves';
        const id = `comma-${sourceId}-${targetId}`;
        return { source, target, sourceId, targetId, commaCents, pathA, pathB, id };
    }, [commaLines, nodeById, nodes]);

    const formatSignedCents = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}¢`;

    const setAllConstraintStatus = (status: TutorialTemperingConstraint['status']) => {
        if (pending_tempering_constraints.length === 0) return;
        const next = pending_tempering_constraints.map(c => ({ ...c, status }));
        setPendingTemperingConstraints(next);
    };

    const declareConstraint = () => {
        const constraint: TutorialTemperingConstraint = {
            id: commaData.id,
            sourceNodeId: commaData.sourceId,
            targetNodeId: commaData.targetId,
            pathA: commaData.pathA,
            pathB: commaData.pathB,
            commaCents: commaData.commaCents,
            status: 'declared_not_applied'
        };
        resetTemperingTutorial();
        setPendingTemperingConstraints([constraint]);
        setTemperingStrategy(null);
        setTemperingModel(null);
        setTemperingResult(null);
    };

    const applyStrategy = (type: 'strict' | 'best_fit' | 'hybrid') => {
        const currentOptions = tempering_strategy?.options || {};
        setTemperingStrategy({ type, options: currentOptions });
        setTemperingModel(null);
        setTemperingResult(null);
        setAllConstraintStatus('strategy_selected');
    };

    const updateStrategyOption = (key: 'favorConsonance' | 'favorUniformDistribution', value: boolean) => {
        if (!tempering_strategy) return;
        setTemperingStrategy({
            type: tempering_strategy.type,
            options: { ...tempering_strategy.options, [key]: value }
        });
    };

    const buildModel = () => {
        if (pending_tempering_constraints.length === 0 || !tempering_strategy) {
            setModelError('There is not enough information yet to decide how pitches should change.');
            return;
        }
        const model = {
            constraints: pending_tempering_constraints.map(c => c.id),
            strategy: tempering_strategy,
            parameters: {
                octaveFixed: true as const,
                allowGeneratorAdjustment
            }
        };
        setTemperingModel(model);
        setModelError(null);
        setAllConstraintStatus('model_ready');
    };

    const computeTutorialResult = (): TutorialTemperingResult | null => {
        if (pending_tempering_constraints.length === 0 || !tempering_strategy) return null;
        const constraint = pending_tempering_constraints[0];
        const commaCents = constraint.commaCents;
        let factor = tempering_strategy.type === 'strict' ? 1 : tempering_strategy.type === 'best_fit' ? 0.5 : 0.7;
        if (tempering_strategy.type === 'hybrid') {
            if (tempering_strategy.options?.favorConsonance) factor -= 0.15;
            if (tempering_strategy.options?.favorUniformDistribution) factor += 0.1;
        }
        factor = Math.min(1, Math.max(0.3, factor));
        const adjustment = -commaCents * factor;
        const residual = commaCents + adjustment;
        const maxDeviation = Math.max(Math.abs(adjustment), Math.abs(residual));
        return {
            final_mapping: {
                [constraint.sourceNodeId]: 0,
                [constraint.targetNodeId]: adjustment
            },
            residuals: {
                [constraint.id]: residual
            },
            summary: {
                conflictsResolved: pending_tempering_constraints.length,
                maxDeviationCents: maxDeviation
            }
        };
    };

    const applyTempering = () => {
        if (isSolving) return;
        if (!tempering_model) return;
        setIsSolving(true);
        const result = computeTutorialResult();
        window.setTimeout(() => {
            if (result) {
                setTemperingResult(result);
                setAllConstraintStatus('tempering_applied');
                updateVisualSettings({ temperamentMorph: Math.max(settings.visuals.temperamentMorph || 0, 0.35) });
            }
            setIsSolving(false);
        }, 350);
    };

    const explanationRows = useMemo(() => {
        const comma = pending_tempering_constraints[0]?.commaCents ?? commaData.commaCents;
        const deviationBase = tempering_result?.summary.maxDeviationCents ?? Math.abs(comma) * 0.25;
        const sign = comma >= 0 ? 1 : -1;
        const rows = [
            {
                name: 'Perfect Fifth (3/2)',
                pure: 701.955,
                deviation: sign * deviationBase * 0.35
            },
            {
                name: 'Major Third (5/4)',
                pure: 386.314,
                deviation: sign * deviationBase * 0.2
            },
            {
                name: 'Comma (Pythagorean)',
                pure: Math.abs(comma),
                deviation: tempering_result?.residuals?.[pending_tempering_constraints[0]?.id || ''] ?? sign * deviationBase * 0.45
            }
        ];
        return rows.slice(0, 3).map((row) => ({
            ...row,
            final: row.pure + row.deviation
        }));
    }, [commaData.commaCents, pending_tempering_constraints, tempering_result]);

    const deviationClass = (value: number) => {
        const abs = Math.abs(value);
        if (abs >= 8) return 'text-red-300';
        if (abs >= 3) return 'text-amber-300';
        return 'text-emerald-300';
    };

    const steps: TutorialStep[] = [
        {
            title: "12. Locking Phase (Famous Chords)",
            desc: "Why bother with Just Intonation? Listen to the Major Triad (4:5:6). In standard tuning, chords \"shimmer\" due to wave interference (beating). In JI, the waves align perfectly.",
            actionLabel: "Next: The Minor Problem",
            onActivate: () => {},
            extraContent: (
                <div className="flex gap-2 mt-4 flex-wrap">
                    <button onClick={() => {
                        const currentNodes = useStore.getState().nodes;
                        const s = useStore.getState().settings;
                        const r = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
                        const m3 = currentNodes.find(n => n.primeVector[5] === 1);
                        const p5 = currentNodes.find(n => n.primeVector[3] === 1);
                        if(r && m3 && p5) { playNote(r, s); setTimeout(()=>playNote(m3,s), 200); setTimeout(()=>playNote(p5,s), 400); }
                    }} className="bg-green-700 px-3 py-1 rounded text-xs">Play JI Major Triad</button>
                    <button onClick={() => {
                        const currentNodes = useStore.getState().nodes;
                        const s = useStore.getState().settings;
                        const r = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
                        const m3 = currentNodes.find(n => n.primeVector[5] === 1);
                        const p5 = currentNodes.find(n => n.primeVector[3] === 1);
                        const h7 = currentNodes.find(n => n.primeVector[7] === 1); 
                        if(r && m3 && p5 && h7) { 
                             playSimultaneous(r, m3, s);
                             setTimeout(() => playSimultaneous(p5, h7, s), 100);
                        }
                    }} className="bg-blue-700 px-3 py-1 rounded text-xs">Play Harmonic 7th Chord</button>
                </div>
            )
        },
        {
            title: "13. The Mirror Universe (Minor Triad)",
            desc: "The Minor Triad is not found in the upward overtone series. It is the Reciprocal Reflection of the Major. Ideally, the Minor Triad is a \"downward\" projection of the lattice (1/1 -> 1/5 -> 1/3).",
            actionLabel: "Invert Lattice",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3, 5], 
                    gen0Lengths: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 1, pos: 0 }, 5: { neg: 1, pos: 0 } },
                    expansionB: 0
                });
                regenerateLattice(false);
                
                setTimeout(() => {
                    const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                    if (root) selectNode(root);
                }, 200);
            },
            extraContent: (
                <div className="flex gap-2 mt-4">
                     <button onClick={() => {
                        const currentNodes = useStore.getState().nodes;
                        const s = useStore.getState().settings;
                        const r = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
                        const sub5 = currentNodes.find(n => n.primeVector[5] === -1);
                        const sub3 = currentNodes.find(n => n.primeVector[3] === -1);
                        if(r && sub5 && sub3) {
                            playSimultaneous(r, sub5, s);
                            setTimeout(() => playSimultaneous(sub5, sub3, s), 100);
                        }
                    }} className="bg-indigo-700 px-3 py-1 rounded text-xs">Play Utonal Triad (10:12:15)</button>
                </div>
            )
        },
        {
            title: "14. The Comma Pump (Drift)",
            desc: "The lattice spirals, causing pitch drift in progressions. We visualize this by bending 12 Fifths into a vertical helix.\n\nNotice the VERTICAL GAP between start (C) and end (B#). Jumping back creates a pitch error. The lattice must drift to stay in tune.",
            actionLabel: "Bend The Lattice",
            onActivate: () => {
                
                setNavAxisVertical(3);

                updateVisualSettings({
                    layoutMode: 'lattice', 
                    spiralFactor: 0, 
                    helixFactor: 0.15 
                });

                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3], 
                    gen0Lengths: { 3: 12, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 0, pos: 12 } }, 
                    gen1Lengths: { 3:0, 5:0, 7:0, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0 }, 
                    expansionB: 0,
                    axisLooping: { 3: 6.0, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
                    autoCameraFocus: true 
                });

                regenerateLattice(false);
                
                setTimeout(() => {
                    setCommaLines([]);
                    const currentNodes = useStore.getState().nodes;
                    const start = currentNodes.find(n => n.primeVector[3] === 0); 
                    const end = currentNodes.find(n => n.primeVector[3] === 12); 
                    if (start && end) {
                         setCommaLines([{ sourceId: start.id, targetId: end.id, name: "The Comma Gap (Drift)" }]);
                         selectNode(end);
                    }
                }, 500);
            },
            extraContent: (
                <div className="flex flex-col gap-2 mt-4">
                    <button
                        onClick={() => {
                            const currentNodes = useStore.getState().nodes;
                            const s = useStore.getState().settings;
                            const start = currentNodes.find(n => n.primeVector[3] === 0); 
                            const end = currentNodes.find(n => n.primeVector[3] === 12); 
                            if(start && end) {
                                playNote(start, s);
                                setTimeout(() => playNote(end, s), 600);
                                setTimeout(() => playSimultaneous(start, end, s), 1400);
                            }
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded font-bold text-xs shadow-lg animate-pulse border border-red-400"
                    >
                        ▶ Play The Gap (Audio)
                    </button>
                    <p className="text-[10px] text-gray-400 italic mt-1 text-center">
                        (Controls remapped: Up/Down arrows now move along the Helix)
                    </p>
                </div>
            )
        },
        {
            title: "Step 1 · Identify a conflict (Comma)",
            desc: "You have discovered a comma.\nThis means two valid tuning paths reach the same note name,\nbut do not match in pitch.\n\nAt this stage, nothing has been tempered yet.",
            actionLabel: "Identify a conflict",
            guard: {
                canAdvance: () => pending_tempering_constraints.length > 0,
                blockReason: "Declare the conflict to continue."
            },
            onActivate: () => {},
            extraContent: (
                <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-gray-700/70 bg-gray-800/40 p-3 text-[11px] text-gray-200">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Comma info</div>
                        <div className="flex flex-col gap-1">
                            <div className="text-gray-300">{commaData.pathA}</div>
                            <div className="text-gray-300">{commaData.pathB}</div>
                            <div className="text-gray-400">
                                Comma size: <span className="text-gray-200 font-mono">{formatSignedCents(commaData.commaCents)}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={declareConstraint}
                        title="Declaring a problem does not change tuning. It only tells the system: this inconsistency matters."
                        className="w-full rounded-xl border border-gray-600 bg-gray-900/80 py-2 text-[11px] font-bold text-gray-100 hover:border-gray-500 hover:text-white"
                    >
                        Treat this comma as a problem to solve
                    </button>
                </div>
            )
        },
        {
            title: "Step 2 · Choose how to resolve the conflict",
            desc: "At this point, you are not changing pitches.\nYou are choosing how changes will be justified later.",
            actionLabel: "Choose a strategy",
            guard: {
                canAdvance: () => !!tempering_strategy,
                blockReason: "Select a strategy to continue."
            },
            onActivate: () => {},
            extraContent: (
                <div className="mt-3 space-y-3 text-[11px] text-gray-200">
                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
                        <label className="flex items-start gap-2">
                            <input
                                type="radio"
                                name="tempering-strategy"
                                checked={tempering_strategy?.type === 'strict'}
                                onChange={() => applyStrategy('strict')}
                                className="mt-1"
                            />
                            <div>
                                <div className="font-bold">Treat this comma as zero</div>
                                <div className="text-gray-400 text-[10px]">The two pitches must become identical.</div>
                                <div className="mt-1 text-[10px] text-gray-500">
                                    This enforces an exact identification. Other intervals may be altered to compensate.
                                </div>
                            </div>
                        </label>
                    </div>
                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
                        <label className="flex items-start gap-2">
                            <input
                                type="radio"
                                name="tempering-strategy"
                                checked={tempering_strategy?.type === 'best_fit'}
                                onChange={() => applyStrategy('best_fit')}
                                className="mt-1"
                            />
                            <div>
                                <div className="font-bold">Allow residual error, but minimize it</div>
                                <div className="mt-1 text-[10px] text-gray-500">
                                    The comma may not fully disappear, but the system will try to make it as small as possible.
                                </div>
                            </div>
                        </label>
                    </div>
                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3">
                        <label className="flex items-start gap-2">
                            <input
                                type="radio"
                                name="tempering-strategy"
                                checked={tempering_strategy?.type === 'hybrid'}
                                onChange={() => applyStrategy('hybrid')}
                                className="mt-1"
                            />
                            <div className="flex-1">
                                <div className="font-bold">Partially strict, partially best-fit</div>
                                <div className="mt-2 flex flex-col gap-2 text-[10px] text-gray-300">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!!tempering_strategy?.options?.favorConsonance}
                                            onChange={(e) => updateStrategyOption('favorConsonance', e.target.checked)}
                                            disabled={tempering_strategy?.type !== 'hybrid'}
                                        />
                                        Favor consonant intervals
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={!!tempering_strategy?.options?.favorUniformDistribution}
                                            onChange={(e) => updateStrategyOption('favorUniformDistribution', e.target.checked)}
                                            disabled={tempering_strategy?.type !== 'hybrid'}
                                        />
                                        Favor uniform distribution
                                    </label>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            )
        },
        {
            title: "Step 3 · Build the tempering model",
            desc: "Tempering means defining a consistent rule\nthat assigns final pitch values to all notes,\nwhile respecting your chosen constraints.",
            actionLabel: "Build tempering model",
            guard: {
                canAdvance: () => !!tempering_model,
                blockReason: "Build the model to continue."
            },
            onActivate: () => {},
            extraContent: (
                <div className="mt-3 space-y-3 text-[11px] text-gray-200">
                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3 space-y-2">
                        <label className="flex items-center gap-2 text-gray-300">
                            <input type="checkbox" checked readOnly disabled />
                            Treat octave as fixed (1200 cents)
                        </label>
                        <label className="flex items-center gap-2 text-gray-300">
                            <input
                                type="checkbox"
                                checked={allowGeneratorAdjustment}
                                onChange={(e) => setAllowGeneratorAdjustment(e.target.checked)}
                            />
                            Allow adjustment of generators
                            <span className="text-[10px] text-gray-500">(e.g. fifths, thirds, etc.)</span>
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={buildModel}
                        className="w-full rounded-xl border border-blue-500/70 bg-blue-600/30 py-2 text-[11px] font-bold text-blue-100 hover:bg-blue-600/50"
                    >
                        Build tempering model
                    </button>
                    {modelError && (
                        <div className="text-[10px] text-amber-300 font-semibold">{modelError}</div>
                    )}
                </div>
            )
        },
        {
            title: "Step 4 · Apply tempering and inspect the result",
            desc: "This step applies the model and explains what the results mean.",
            actionLabel: "Apply tempering",
            guard: {
                canAdvance: () => !!tempering_result,
                blockReason: "Apply tempering to continue."
            },
            onActivate: () => {},
            extraContent: (
                <div className="mt-3 space-y-4 text-[11px] text-gray-200">
                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3 space-y-2">
                        <button
                            type="button"
                            onClick={applyTempering}
                            disabled={isSolving}
                            className="w-full rounded-xl border border-emerald-500/70 bg-emerald-600/30 py-2 text-[11px] font-bold text-emerald-100 hover:bg-emerald-600/50 disabled:opacity-60"
                        >
                            {isSolving ? 'Solving…' : 'Apply tempering'}
                        </button>
                    </div>

                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/30 p-3 space-y-1">
                        <div>{(tempering_result?.summary.conflictsResolved ?? 0)} conflicts were resolved.</div>
                        <div>Some intervals are no longer pure.</div>
                        <div>
                            Maximum deviation: ±{tempering_result?.summary.maxDeviationCents !== undefined
                                ? tempering_result.summary.maxDeviationCents.toFixed(2)
                                : '--'} cents.
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/30 p-3">
                        <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Explanation view</div>
                        <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-400 font-semibold">
                            <div>Interval name</div>
                            <div>Pure value</div>
                            <div>Final value</div>
                            <div>Deviation</div>
                        </div>
                        <div className="mt-2 space-y-1">
                            {explanationRows.map((row) => (
                                <div
                                    key={row.name}
                                    title="This deviation is the cost of resolving the selected comma(s)."
                                    className="grid grid-cols-4 gap-2 text-[10px] text-gray-200"
                                >
                                    <div>{row.name}</div>
                                    <div className="font-mono">{row.pure.toFixed(3)}¢</div>
                                    <div className="font-mono">{row.final.toFixed(3)}¢</div>
                                    <div className={`font-mono ${deviationClass(row.deviation)}`}>
                                        {row.deviation >= 0 ? '+' : ''}{row.deviation.toFixed(3)}¢
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-700/70 bg-gray-900/40 p-3 text-[10px] text-gray-300 whitespace-pre-wrap">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Important clarification</div>
                        Connecting or closing commas only visualizes inconsistencies.
                        Tempering requires:

                        Declaring which inconsistencies matter

                        Choosing how they should be resolved

                        Building a solvable model

                        Inspecting the consequences

                        Without these steps, no tempering has occurred.
                    </div>
                </div>
            )
        },
        {
            title: "19. Visualizing the Closure",
            desc: "Now that the tempering decision has been made, we can visualize a closed loop. This is a visual representation of the compromise, not the decision itself.",
            actionLabel: "Visualize closure",
            onActivate: () => {
                setNavAxisVertical(5);

                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3], 
                    gen0Lengths: { 3: 12, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 0, pos: 12 } }, 
                    gen1Lengths: { 3:0, 5:0, 7:0, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0 }, 
                    expansionB: 0,
                    axisLooping: { 3: 6.0, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null }
                });
                updateVisualSettings({
                    layoutMode: 'lattice',
                    spiralFactor: 0,
                    helixFactor: 0.15
                });
                regenerateLattice(false);
                
                setTimeout(() => {
                    const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                    if (root) selectNode(root);
                }, 200);
            },
            extraContent: (
                <div className="flex flex-col gap-3 mt-4">
                    <button
                        onClick={() => {
                            updateSettings({
                                gen0Ranges: { 3: { neg: 0, pos: 11 } },
                                axisLooping: { 3: 6.0, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null }
                            });
                            
                            updateVisualSettings({ helixFactor: 0 });
                            
                            regenerateLattice(false);
                            setCommaLines([]); 
                            
                            setTimeout(() => {
                                const currentNodes = useStore.getState().nodes;
                                const root = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
                                const esharp = currentNodes.find(n => n.primeVector[3] === 11);
                                if (root && esharp) {
                                    const rootRatio = formatRatio(root.ratio);
                                    const esharpRatio = formatRatio(esharp.ratio);
                                    const mergedLabel = `${root.name} ${rootRatio} / ${esharp.name} ${esharpRatio}`;
                                    setNodeNameOverride(root.id, { lattice: mergedLabel });
                                    updateSettings({ maskedNodeIds: [esharp.id] });
                                    setCommaLines([{ sourceId: esharp.id, targetId: root.id, name: "Circle Closure" }]);
                                    selectNode(root);
                                }
                            }, 400);
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold text-xs shadow-lg border border-purple-400"
                    >
                        Force Loop (Visualize)
                    </button>
                </div>
            )
        },
        {
            title: "20. 12-TET (The Modern Grid)",
            desc: "Finally, we smooth out all harmonic irregularities. By setting every step to exactly 2^(n/12), we achieve 12-Tone Equal Temperament.\n\nThe 'wolf' is gone, the circle is perfect, but the pure resonance of 3/2 and 5/4 is replaced by a vibrating compromise.",
            actionLabel: "Quantize to 12-ET",
            onActivate: () => {
                
                updateSettings({
                    maxPrimeLimit: 5,
                    rootLimits: [3],
                    gen0Lengths: { 3: 12, 5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0 },
                    gen0Ranges: { 3: { neg: 0, pos: 11 } }, 
                    axisLooping: { 3: 6.0, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
                    maskedNodeIds: []
                });
                
                updateVisualSettings({
                    layoutMode: 'lattice',
                    spiralFactor: 0,
                    helixFactor: 0,
                    temperamentMorph: 1.0, 
                    tetDivisions: 12
                });
                regenerateLattice(false);
                setCommaLines([]);
                
                setTimeout(() => {
                    const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                    if (root) setNodeNameOverride(root.id, { lattice: '' });
                    if (root) selectNode(root);
                }, 200);
            },
            extraContent: (
                <div className="flex flex-col gap-3 mt-4">
                    <button
                        onClick={() => {
                            
                            const s = useStore.getState().settings;
                            let delay = 0;
                            
                            for (let i = 0; i < 12; i++) {
                                const n = buildEqualStepNode(i);
                                setTimeout(() => playNote(n, s), delay);
                                delay += 150;
                            }
                        }}
                        className="bg-cyan-700 hover:bg-cyan-600 text-white py-2 rounded-lg font-bold text-xs shadow-lg border border-cyan-500"
                    >
                        ▶ Play Equal Steps (2^n/12)
                    </button>

                    <div className="grid grid-cols-2 gap-2 border-t border-gray-700 pt-3">
                        <button 
                            onClick={() => {
                                setNavAxisVertical(5); 
                                onFinish(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-xs shadow-lg"
                        >
                            Finish & Explore
                        </button>
                        <button 
                            onClick={() => {
                                setNavAxisVertical(5); 
                                onFinish(false);
                            }}
                            className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-bold text-xs border border-gray-500"
                        >
                            Reset to Standard
                        </button>
                    </div>
                </div>
            )
        }
    ];

    return steps;
};
