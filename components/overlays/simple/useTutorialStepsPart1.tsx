
import React from 'react';
import type { TutorialStep } from './tutorialTypes';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import { playNote, playSimultaneous } from '../../../audioEngine';
import type { NodeData } from '../../../types';

export const usePart1Steps = (onFinish: (keepSettings?: boolean) => void) => {
    const {
      updateSettings,
      updateVisualSettings,
      regenerateLattice,
      selectNode,
      nodes,
      settings,
      addToComparison,
      clearComparison,
      setNavAxisDepth,
      setCommaLines
    } = useStore((s) => ({
      updateSettings: s.updateSettings,
      updateVisualSettings: s.updateVisualSettings,
      regenerateLattice: s.regenerateLattice,
      selectNode: s.selectNode,
      nodes: s.nodes,
      settings: s.settings,
      addToComparison: s.addToComparison,
      clearComparison: s.clearComparison,
      setNavAxisDepth: s.setNavAxisDepth,
      setCommaLines: s.setCommaLines
    }), shallow);
    const playIntervalSequence = (targetNode: NodeData | undefined) => {
        if (!targetNode) return;
        const currentNodes = useStore.getState().nodes;
        const currentSettings = useStore.getState().settings;
        const root = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
        if (root) {
            playNote(root, currentSettings);
            setTimeout(() => playNote(targetNode, currentSettings), 500);
        } else {
            playNote(targetNode, currentSettings);
        }
    };

    const steps: TutorialStep[] = [
        {
            title: "1. The Monad (1/1)",
            desc: "Every harmonic universe begins with a single point of reference. In physics, this is the Fundamental Frequency. In the Lattice, this is the origin (0,0,0). This is not just a note; it is the center of gravity for all subsequent intervals.",
            actionLabel: "Hear Origin", 
            onActivate: () => {
                updateSettings({ 
                    rootLimits: [3], 
                    maxPrimeLimit: 3,
                    gen0Lengths: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0}, 
                    gen0Ranges: {}, 
                    gen1Lengths: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
                    gen1Ranges: {},
                    expansionA: 12,
                    expansionB: 0,
                    expansionC: 0,
                    secondaryOrigins: [],
                    axisLooping: { 3: null, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
                    
                    visuals: {
                        ...settings.visuals,
                        lineRenderingMode: 'quality',
                        nodeShape: 'sphere',
                        nodeMaterial: 'lambert',
                        layoutMode: 'lattice',
                        spiralFactor: 0
                    }
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                    if(root) {
                        selectNode(root);
                        playNote(root, useStore.getState().settings);
                    }
                }, 100);
            }
        },
        {
            title: "2. Octave Equivalence (2/1)",
            desc: "Multiplying a frequency by 2 doubles its vibration rate but retains its identity. In this visualization, we do not add a new dimension for octaves. Instead, we fold them into the node itself (Modulo 2). Think of them as the same color, just brighter.",
            actionLabel: "Hear Octave",
            onActivate: () => {
                const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                if(root) {
                    selectNode(root); 
                    const octaveNode: NodeData = {
                        ...root,
                        id: 'temp-octave',
                        name: "Octave (2/1)",
                        ratio: { n: 2n, d: 1n },
                        cents: 1200,
                        octave: 1
                    };
                    playNote(octaveNode, useStore.getState().settings);
                }
            }
        },
        {
            title: "3. The Generator: Prime 3 (3/2)",
            desc: "The number 3 is the first step away from unity. It creates the Perfect Fifth. Extending horizontally to the Right, we enter the \"Pythagorean\" dimension of brightness and tension. This is the dominant force in harmony.",
            actionLabel: "Generate 5th",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 3, 
                    rootLimits: [3],
                    gen0Lengths: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
                    gen0Ranges: { 3: { neg: 0, pos: 1 } },
                    expansionB: 0 
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const node = useStore.getState().nodes.find(n => n.primeVector[3] === 1);
                    if(node) {
                        selectNode(node);
                        playIntervalSequence(node);
                    }
                }, 200);
            }
        },
        {
            title: "4. The Reciprocal: Subharmonics (4/3)",
            desc: "Every action has an equal and opposite reaction. Dividing by 3 (or moving Left) creates the Perfect Fourth. This is the \"Utonal\" or Plagal direction, moving towards the subdominant, creating a sense of relaxation or \"coming home.\"",
            actionLabel: "Generate 4th",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 3, 
                    rootLimits: [3],
                    gen0Lengths: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0},
                    gen0Ranges: { 3: { neg: 1, pos: 1 } },
                    expansionB: 0
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const node = useStore.getState().nodes.find(n => n.primeVector[3] === -1);
                    if(node) {
                        selectNode(node);
                        playIntervalSequence(node);
                    }
                }, 200);
            }
        },
        {
            title: "5. The Grid: Prime 5 (5/4)",
            desc: "The 5th Harmonic introduces the Major Third. This defines the Vertical Axis. Unlike the sharp, restless Major Third of modern tuning (12-TET), the Just Major Third (5/4) is perfectly stable and sweet. This dimension transforms a line of Fifths into a Lattice plane.",
            actionLabel: "Add 3rd Dimension",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3, 5], 
                    gen0Lengths: { 3: 0, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 1, pos: 1 }, 5: { neg: 0, pos: 1 } },
                    expansionB: 0
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const node = useStore.getState().nodes.find(n => n.primeVector[5] === 1);
                    if(node) {
                        selectNode(node);
                        playIntervalSequence(node);
                    }
                }, 200);
            }
        },
        {
            title: "6. Vector Synthesis (Compound Intervals)",
            desc: "Complex intervals are simply vector paths through the lattice. The Major Seventh (15/8) is not a random note; it is the sum of a Perfect Fifth (3/2) and a Major Third (5/4). Geometrically, it is one step Right and one step Up.",
            actionLabel: "Synthesize 15/8",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3, 5],
                    gen0Lengths: { 3: 0, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 1, pos: 1 }, 5: { neg: 0, pos: 1 } },
                    expansionB: 1, 
                    gen1Lengths: {3:1, 5:1, 7:0, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0},
                    gen1Ranges: {}
                }); 
                regenerateLattice(false);
                setTimeout(() => {
                    const node = useStore.getState().nodes.find(n => n.primeVector[3] === 1 && n.primeVector[5] === 1);
                    if(node) {
                        selectNode(node);
                        playNote(node, useStore.getState().settings);
                    }
                }, 200);
            }
        },
        {
            title: "7. The Syntonic Comma (81/80)",
            desc: "Here lies the fundamental conflict of tuning. Reach 'E' by moving Right 4 times (Pythagorean E, 81/64). Reach 'E' by moving Up 1 time (Just E, 5/4). The Problem: They are not the same note. The gap between them is the Syntonic Comma (approx. 21.5 cents). The lattice does not close; it spirals.",
            actionLabel: "Hear The Comma",
            onActivate: () => {
                clearComparison();
                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3, 5],
                    gen0Lengths: { 3: 4, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
                    gen0Ranges: {}, 
                    expansionB: 0, gen1Lengths: {} as any 
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const currentNodes = useStore.getState().nodes;
                    const pythE = currentNodes.find(n => n.primeVector[3] === 4);
                    const justE = currentNodes.find(n => n.primeVector[5] === 1);
                    if (pythE && justE) {
                        addToComparison(pythE);
                        addToComparison(justE);
                        selectNode(pythE);
                        setCommaLines([{ sourceId: pythE.id, targetId: justE.id, name: "Syntonic Comma" }]);
                    }
                }, 200);
            },
            extraContent: (
                <div className="flex gap-2 mt-4">
                    <button 
                        onClick={() => {
                            const currentNodes = useStore.getState().nodes;
                            const n1 = currentNodes.find(n => n.primeVector[3] === 4);
                            const n2 = currentNodes.find(n => n.primeVector[5] === 1);
                            if(n1 && n2) playSimultaneous(n1, n2, useStore.getState().settings);
                        }}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-xs font-bold"
                    >
                        Play Syntonic Comma
                    </button>
                </div>
            )
        },
        {
            title: "8. The Ruler of Pitch",
            desc: "Ratios provide harmonic logic, but Cents provide the map of perception. We divide the Octave into 1200 logarithmic Cents.\n\nIn standard 12-TET, every semitone is exactly 100 cents. In Just Intonation, we measure the 'truth' against this grid.",
            actionLabel: "Show Ruler",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 3, 
                    rootLimits: [], 
                    gen0Lengths: {3:0,5:0,7:0,11:0,13:0,17:0,19:0,23:0,29:0,31:0}, 
                    gen0Ranges: {},
                    expansionB: 0
                });
                updateVisualSettings({ layoutMode: 'pitch-field' });
                regenerateLattice(false);
            },
            extraContent: (
                <div className="space-y-4 mt-2">
                    <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700 overflow-hidden">
                        <table className="w-full text-[10px] text-left">
                            <thead className="text-gray-500 uppercase font-bold border-b border-gray-700">
                                <tr>
                                    <th className="py-1">Interval</th>
                                    <th className="py-1">Ratio</th>
                                    <th className="py-1">Cents</th>
                                    <th className="py-1">12-TET</th>
                                    <th className="py-1">Offset</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300 font-mono">
                                <tr className="border-b border-gray-800/50">
                                    <td className="py-1 font-sans font-bold text-white">Maj 3rd</td>
                                    <td className="py-1 text-blue-300">5/4</td>
                                    <td className="py-1">386.3</td>
                                    <td className="py-1 text-gray-500">400</td>
                                    <td className="py-1 text-blue-400">-13.7</td>
                                </tr>
                                <tr className="border-b border-gray-800/50">
                                    <td className="py-1 font-sans font-bold text-white">Perf 5th</td>
                                    <td className="py-1 text-blue-300">3/2</td>
                                    <td className="py-1">701.9</td>
                                    <td className="py-1 text-gray-500">700</td>
                                    <td className="py-1 text-red-400">+1.9</td>
                                </tr>
                                <tr>
                                    <td className="py-1 font-sans font-bold text-white">Harm 7th</td>
                                    <td className="py-1 text-blue-300">7/4</td>
                                    <td className="py-1">968.8</td>
                                    <td className="py-1 text-gray-500">1000</td>
                                    <td className="py-1 text-blue-400">-31.2</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-blue-900/20 border-l-2 border-blue-500 p-2 text-[10px] text-gray-300">
                        <span className="text-red-400">+ Red: Sharper</span> | <span className="text-blue-400">- Blue: Flatter</span> than piano.
                    </div>
                </div>
            )
        },
        {
            title: "9. The Great Diesis (128/125)",
            desc: "Back to the Lattice. You saw the horizontal gap (Comma). Now see the VERTICAL gap.\n\nMathematically, 3 Major Thirds (125/64) fall short of an Octave (128/64) by about 41 cents.\n\nThe Cyan Line connects the top of the stack (B#) back to the Root (C). This huge gap is why G# and Ab are different notes in pure tuning.",
            actionLabel: "Visualize Diesis",
            onActivate: () => {
                updateVisualSettings({ layoutMode: 'lattice' }); 
                clearComparison();
                updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [5], 
                    gen0Lengths: { 5: 3, 3:0, 7:0, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0 }, 
                    gen0Ranges: { 5: { neg: 0, pos: 3 } },
                    expansionB: 0
                });
                regenerateLattice(false);
                setTimeout(() => {
                    const currentNodes = useStore.getState().nodes;
                    const topThird = currentNodes.find(n => n.primeVector[5] === 3); 
                    const root = currentNodes.find(n => n.gen === 0 && n.originLimit === 0);
                    if (topThird && root) {
                        selectNode(topThird);
                        setCommaLines([{ sourceId: topThird.id, targetId: root.id, name: "Diesis Gap (41¢)" }]);
                    }
                }, 200);
            },
            extraContent: (
                <div className="flex gap-2 mt-4">
                    <button 
                        onClick={() => {
                            const currentNodes = useStore.getState().nodes;
                            const top = currentNodes.find(n => n.primeVector[5] === 3);
                            const oct = { ...top!, ratio: {n:2n, d:1n}, cents: 1200 };
                            if(top) {
                                playNote(oct, useStore.getState().settings);
                                setTimeout(() => playNote(top, useStore.getState().settings), 500);
                                setTimeout(() => playSimultaneous(top, oct, useStore.getState().settings), 1200);
                            }
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold"
                    >
                        Play Diesis Gap
                    </button>
                </div>
            )
        },
        {
            title: "10. Navigation Basics",
            desc: "To explore: Use ARROW KEYS to move Left/Right (3-Limit) and Up/Down (5-Limit). Use +/- keys to move In/Out. Hold W/A/S/D to fly. Tip: Press 'R' to reset if you get lost.",
            actionLabel: "Unlock Controls",
            onActivate: () => {
               updateSettings({ 
                    maxPrimeLimit: 5,
                    rootLimits: [3, 5], 
                    gen0Lengths: { 3: 0, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, 
                    gen0Ranges: { 3: { neg: 1, pos: 1 }, 5: { neg: 0, pos: 1 } },
                    expansionB: 0
                });
               regenerateLattice(false);
               setCommaLines([]);
            },
            extraContent: (
                <div className="mt-4 text-center">
                    <button 
                        onClick={() => {
                            const root = useStore.getState().nodes.find(n => n.gen === 0 && n.originLimit === 0);
                            if(root) {
                                selectNode(root);
                                playNote(root, useStore.getState().settings);
                            }
                        }}
                        className="bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 px-4 py-2 rounded font-bold text-xs"
                    >
                        ⌖ Locate Center (1/1)
                    </button>
                </div>
            )
        },
        {
            title: "11. The 3rd Dimension: Prime 7 (7/4)",
            desc: "Now we unlock the Z-Axis (Depth). The 7th Harmonic (7/4) creates the Harmonic Seventh. It is significantly flatter than the minor seventh on a piano. This is the \"blue note\"—crucial for Barbershop harmony and Blues.",
            actionLabel: "Add Depth (7)",
            onActivate: () => {
                updateSettings({ 
                    maxPrimeLimit: 7,
                    rootLimits: [3, 5, 7], 
                    gen0Lengths: { 3: 2, 5: 2, 7: 1, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
                    gen0Ranges: {},
                    expansionB: 1, 
                    gen1Lengths: {3:1, 5:1, 7:1, 11:0, 13:0, 17:0, 19:0, 23:0, 29:0, 31:0}
                });
                setNavAxisDepth(7);
                regenerateLattice(false);
                setTimeout(() => {
                    const sevenNode = useStore.getState().nodes.find(n => n.primeVector[7] === 1);
                    if (sevenNode) {
                        selectNode(sevenNode);
                        playNote(sevenNode, useStore.getState().settings);
                    }
                }, 200);
            }
        }
    ];

    return steps;
};
