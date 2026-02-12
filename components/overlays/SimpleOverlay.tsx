
import React, { useEffect } from 'react';
import { useStore } from '../../store';
import { shallow } from 'zustand/shallow';
import { formatRatio } from '../../musicLogic';
import { playNote } from '../../audioEngine';
import { SimplePrompt } from './simple/SimplePrompt';
import { SimpleTutorial } from './simple/SimpleTutorial';
import { SimpleElectives } from './simple/SimpleElectives';
import { SimpleManualConfig } from './simple/SimpleManualConfig';
import { STORAGE_KEYS } from '../../store/logic/storageKeys';

export const SimpleOverlay = () => {
    const {
      settings,
      selectedNode,
      toggleSimpleMode,
      toggleSimpleLabelMode,
      updateSettings,
      simpleModeStage,
      setSimpleModeStage,
      regenerateLattice,
      setLandingMode
    } = useStore((s) => ({
      settings: s.settings,
      selectedNode: s.selectedNode,
      toggleSimpleMode: s.toggleSimpleMode,
      toggleSimpleLabelMode: s.toggleSimpleLabelMode,
      updateSettings: s.updateSettings,
      simpleModeStage: s.simpleModeStage,
      setSimpleModeStage: s.setSimpleModeStage,
      regenerateLattice: s.regenerateLattice,
      setLandingMode: s.setLandingMode
    }), shallow);
    useEffect(() => {
        const skip = localStorage.getItem(STORAGE_KEYS.simpleSkip);
        if (simpleModeStage === 'prompt' && skip === 'true') {
            setSimpleModeStage('manual');
        }

        if (settings.visuals.lineRenderingMode === 'performance') {
            updateSettings({
                visuals: {
                    ...settings.visuals,
                    lineRenderingMode: 'quality',
                    nodeShape: 'sphere'
                }
            });
        }
    }, [settings.visuals.lineRenderingMode, updateSettings, settings.visuals, simpleModeStage, setSimpleModeStage]);

    const handlePromptChoice = (tutorial: boolean, dontShowAgain: boolean) => {
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_KEYS.simpleSkip, 'true');
        }

        if (tutorial) {
            setSimpleModeStage('tutorial');
        } else {
            
            updateSettings({
                rootLimits: [3, 5],
                maxPrimeLimit: 5,
                expansionA: 6,
                expansionB: 2,
                expansionC: 0,
                gen0Lengths: {} as any, gen0Ranges: {}, gen1Lengths: {} as any, gen1Ranges: {}
            });
            regenerateLattice(false);
            setSimpleModeStage('manual');
        }
    };

    const handleTutorialFinish = (keepSettings: boolean = false) => {
        if (keepSettings) {
            
            updateSettings({
                maxPrimeLimit: 7,
                rootLimits: [3, 5, 7],
                expansionA: 2,
                gen0Lengths: { 3: 2, 5: 2, 7: 1, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
                gen0Ranges: {},
                expansionB: 1,
                gen1Lengths: { 3: 1, 5: 1, 7: 1, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
                axisLooping: { 3: null, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
                
                visuals: { ...settings.visuals, spiralFactor: 0, helixFactor: 0, temperamentMorph: 0 }
            });
        } else {
            
            updateSettings({
                rootLimits: [3, 5],
                maxPrimeLimit: 5,
                expansionA: 6,
                expansionB: 2,
                expansionC: 0,
                gen0Lengths: {} as any, gen0Ranges: {}, gen1Lengths: {} as any, gen1Ranges: {},
                axisLooping: { 3: null, 5: null, 7: null, 11: null, 13: null, 17: null, 19: null, 23: null, 29: null, 31: null },
                
                visuals: { ...settings.visuals, spiralFactor: 0, helixFactor: 0, temperamentMorph: 0, layoutMode: 'lattice' }
            });
        }

        regenerateLattice(false);
        setSimpleModeStage('manual');
    };

    const getStageTitle = () => {
        switch (simpleModeStage) {
            case 'tutorial': return 'Interactive Tutorial';
            case 'electives': return 'Advanced Modules';
            case 'manual': return 'Exploration View';
            default: return 'Harmonic Simple Mode';
        }
    };

    const getLabelModeText = () => {
        if (settings.simpleLabelMode === 'both') return 'All';
        return settings.simpleLabelMode === 'ratio' ? 'Ratios' : 'Names';
    };

    return (
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-50">
            {simpleModeStage === 'prompt' && <SimplePrompt onChoice={handlePromptChoice} onCancel={toggleSimpleMode} />}

            {simpleModeStage === 'tutorial' && <SimpleTutorial onFinish={handleTutorialFinish} />}

            {simpleModeStage === 'electives' && <SimpleElectives onExit={() => setSimpleModeStage('manual')} />}

            {simpleModeStage === 'manual' && <SimpleManualConfig />}

            {simpleModeStage !== 'prompt' && (
                <div className="flex justify-between items-start pointer-events-none">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl pointer-events-auto">
                        <h1 className="text-xl font-black text-white uppercase tracking-tighter">Harmonic Simple Mode</h1>
                        <p className="text-[10px] text-white/50 uppercase font-bold tracking-widest">
                            {getStageTitle()}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={toggleSimpleMode}
                                className="bg-red-500 hover:bg-red-400 text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all shadow-lg"
                            >
                                Advanced Mode
                            </button>
                            <button
                                onClick={() => setSimpleModeStage('prompt')}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all"
                            >
                                Restart Tutorial
                            </button>
                            <button
                                onClick={() => setLandingMode('ear')}
                                className="bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all shadow-lg border border-yellow-400"
                            >
                                👂 Ear Training
                            </button>
                            {simpleModeStage !== 'electives' && (
                                <button
                                    onClick={() => setSimpleModeStage('electives')}
                                    className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all border border-purple-400"
                                >
                                    Modules
                                </button>
                            )}
                            {simpleModeStage === 'manual' && (
                                <button
                                    onClick={toggleSimpleLabelMode}
                                    className="bg-gray-700 hover:bg-gray-600 text-white text-[10px] px-3 py-1 rounded-full font-bold transition-all"
                                >
                                    Labels: {getLabelModeText()}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {simpleModeStage !== 'prompt' && (
                <div className="pointer-events-none self-start mt-auto">
                    {selectedNode && (
                        <div className="bg-black/40 backdrop-blur-lg border border-white/10 p-4 rounded-2xl shadow-xl min-w-[180px] pointer-events-auto">
                            <h2 className="text-2xl font-black text-white leading-none whitespace-pre-wrap">
                                {(simpleModeStage === 'tutorial')
                                    ? `${selectedNode.name}\n${formatRatio(selectedNode.ratio)}`
                                    : (settings.simpleLabelMode === 'ratio' ? formatRatio(selectedNode.ratio) : selectedNode.name)
                                }
                            </h2>
                            {simpleModeStage !== 'tutorial' && settings.simpleLabelMode !== 'ratio' && settings.simpleLabelMode !== 'both' && (
                                <p className="text-white/70 font-mono text-sm mt-1">{formatRatio(selectedNode.ratio)}</p>
                            )}
                            {settings.simpleLabelMode === 'both' && simpleModeStage !== 'tutorial' && (
                                <p className="text-white/70 font-mono text-sm mt-1">{formatRatio(selectedNode.ratio)}</p>
                            )}

                            <div className="flex justify-between items-end mt-2">
                                <p className="text-blue-400 font-mono text-xs font-bold">{selectedNode.cents.toFixed(1)}¢</p>
                                <button onClick={() => playNote(selectedNode, settings)} className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-sm hover:scale-110 active:scale-95 transition-all shadow-lg">▶</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
