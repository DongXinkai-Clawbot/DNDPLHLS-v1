
import React, { useState, useEffect } from 'react';
import { useTutorialSteps } from './useTutorialSteps';

const TUTORIAL_SEEN_KEY = 'mm_simple_tutorial_seen';

export const SimpleTutorial = ({ onFinish }: { onFinish: (keepSettings?: boolean) => void }) => {
    const steps = useTutorialSteps(onFinish);
    const [step, setStep] = useState(0);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [isSeen, setIsSeen] = useState(() => {
        try {
            return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
        } catch {
            return false;
        }
    });
    const lastActivatedRef = React.useRef<number | null>(null);

    useEffect(() => {
        if (isSeen) {
            onFinish(true); 
        }
    }, [isSeen, onFinish]);

    const handleDontShowChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setDontShowAgain(checked);
        if (checked) {
            localStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
        } else {
            localStorage.removeItem(TUTORIAL_SEEN_KEY);
        }
    };

    const currentStep = steps[step];
    const nextStep = steps[step + 1];
    const guard = currentStep?.guard;
    const canAdvance = guard ? guard.canAdvance() : true;

    const advance = () => {
        if (!currentStep) return;
        if (!canAdvance) return;
        if (typeof currentStep.onAdvance === 'function') {
            currentStep.onAdvance();
        }
        if (step < steps.length - 1) setStep(s => s + 1);
    };

    useEffect(() => {
        if (isSeen) return;
        if (!steps[step]) return;
        if (lastActivatedRef.current === step) return;
        lastActivatedRef.current = step;
        steps[step].onActivate();
    }, [step, isSeen, steps]);

    if (isSeen || !currentStep) return null;

    const isStep9 = step === 8;
    const containerClass = isStep9 
        ? "absolute bottom-6 right-6 w-full max-w-md pointer-events-none transition-all duration-300"
        : "absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none transition-all duration-300";

    return (
        <div className={containerClass}>
            <div className="pointer-events-auto bg-gray-950/90 backdrop-blur-md border border-blue-500/30 p-4 rounded-xl shadow-2xl relative max-h-[70vh] overflow-y-auto">
                <div className="absolute -top-3 left-4 bg-blue-700 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                    Step {step + 1} / {steps.length}
                </div>
                <h3 className="text-base font-bold text-white mb-1 mt-1">{currentStep.title}</h3>
                <p className="text-gray-300 text-[11px] mb-2 leading-relaxed whitespace-pre-wrap">{currentStep.desc}</p>
                {currentStep.extraContent}
                
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-800/50">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex gap-0.5">
                            {steps.map((_, i) => (
                                <div key={i} className={`h-1 w-3 rounded-full transition-colors ${i <= step ? 'bg-blue-500' : 'bg-gray-800'}`} />
                            ))}
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer group opacity-60 hover:opacity-100 transition-opacity">
                            <input 
                                type="checkbox" 
                                checked={dontShowAgain}
                                onChange={handleDontShowChange}
                                className="w-3 h-3 accent-blue-500 bg-gray-900 border-gray-700 rounded"
                            />
                            <span className="text-[9px] text-gray-400 font-bold group-hover:text-gray-200 transition-colors">Do not show again</span>
                        </label>
                    </div>
                    
                    <div className="flex gap-2">
                        {step > 0 && <button onClick={() => setStep(s => s - 1)} className="text-gray-500 hover:text-white text-[10px] uppercase font-bold px-2">Back</button>}
                        {step < steps.length - 1 && (
                            <button 
                                onClick={advance}
                                disabled={!canAdvance}
                                className={`px-3 py-1 rounded font-bold text-[10px] transition-all flex items-center gap-1 shadow-md ${canAdvance ? 'bg-white text-blue-900 hover:bg-gray-200' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}
                            >
                                {(nextStep ? nextStep.actionLabel : "Next") + " →"}
                            </button>
                        )}
                    </div>
                    {!canAdvance && guard?.blockReason && (
                        <div className="mt-2 text-[10px] text-amber-300 font-semibold">{guard.blockReason}</div>
                    )}
                </div>
            </div>
        </div>
    );
};
