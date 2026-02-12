import { Fraction } from '../../types';

const clamp14 = (v: number) => Math.min(16383, Math.max(0, Math.round(v)));

export const calculatePitchBend = (cents: number, rangeSemitones: number): number => {
    
    if (rangeSemitones <= 0) return 8192;

    const rangeCents = rangeSemitones * 100;
    const norm = cents / rangeCents; 

    const value = 8192 + (norm * 8192);
    return clamp14(value);
};

export const calculateDeviation = (targetHz: number, midiNote: number): { cents: number } => {
    const standardFreq = 440 * Math.pow(2, (midiNote - 69) / 12);
    if (standardFreq === 0) return { cents: 0 }; 

    if (targetHz <= 0) return { cents: 0 };

    const ratio = targetHz / standardFreq;
    const cents = 1200 * Math.log2(ratio);
    return { cents };
};

export const calculateInputPitchBend = (
    wheelValue: number,
    currentStepIndex: number,
    scaleCents: number[],
    rangeSteps: number
): number => {
    if (wheelValue === 0) return 0;
    if (scaleCents.length === 0) return 0;

    const absWheel = Math.abs(wheelValue);
    const direction = Math.sign(wheelValue);

    const stepsToMove = absWheel * rangeSteps;
    const wholeSteps = Math.floor(stepsToMove);
    const fraction = stepsToMove - wholeSteps;

    const period = 1200;

    const getCentsAt = (index: number) => {
        const len = scaleCents.length;
        const octaveShift = Math.floor(index / len);
        const modIndex = ((index % len) + len) % len;
        
        return scaleCents[modIndex] + (octaveShift * period);
    };

    const startCents = getCentsAt(currentStepIndex);
    const targetWholeIndex = currentStepIndex + (wholeSteps * direction);
    const wholeStepCents = getCentsAt(targetWholeIndex);

    const nextBoundaryIndex = targetWholeIndex + direction; 
    const nextBoundaryCents = getCentsAt(nextBoundaryIndex);

    const stepSize = nextBoundaryCents - wholeStepCents;
    const fractionalCents = stepSize * fraction;

    const totalTargetCents = wholeStepCents + fractionalCents;

    return totalTargetCents - startCents;
};
