
import type { TutorialStep } from './tutorialTypes';
import { usePart1Steps } from './useTutorialStepsPart1';
import { usePart2Steps } from './useTutorialStepsPart2';

export const useTutorialSteps = (onFinish: (keepSettings?: boolean) => void): TutorialStep[] => {
    const s1 = usePart1Steps(onFinish);
    const s2 = usePart2Steps(onFinish);
    return [...s1, ...s2];
};
