
import { startNote, getAudioContext } from '../audioEngine';
import type { AppSettings, SavedChord, ProgressionStep, NodeData } from '../types';

const SCHEDULE_AHEAD_TIME = 0.1; 
const LOOKAHEAD_INTERVAL = 25; 

class SeededRandom {
    private seed: number;
    constructor(seed: number) {
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
}

class Sequencer {
    private timerID: number | null = null;
    private nextNoteTime: number = 0;
    private currentStepIndex: number = 0;
    private isRunning: boolean = false;
    
    private arpNoteCounter: number = 0;
    private rng: SeededRandom = new SeededRandom(12345); 
    
    private activeVoices: (() => void)[] = [];
    
    private getStore: () => any;

    constructor(getStoreFn: () => any) {
        this.getStore = getStoreFn;
    }

    public start(resume: boolean = false) {
        if (this.isRunning) return;
        
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();
        
        if (!resume) {
            this.currentStepIndex = 0;
            this.arpNoteCounter = 0;
            this.rng = new SeededRandom(12345); 
        }
        
        this.nextNoteTime = ctx.currentTime + 0.05;
        this.isRunning = true;
        
        this.getStore().progressionSetCurrentStep(this.currentStepIndex);
        
        this.scheduler();
    }

    public pause() {
        this.isRunning = false;
        if (this.timerID !== null) {
            window.clearTimeout(this.timerID);
            this.timerID = null;
        }
        
        this.silenceAll();
    }

    public stop() {
        this.isRunning = false;
        if (this.timerID !== null) {
            window.clearTimeout(this.timerID);
            this.timerID = null;
        }
        this.silenceAll();
        
        this.currentStepIndex = 0;
        this.arpNoteCounter = 0;
        this.getStore().progressionSetCurrentStep(0);
    }

    private silenceAll() {
        this.activeVoices.forEach(stopFn => stopFn());
        this.activeVoices = [];
    }

    private nextStep() {
        const store = this.getStore();
        const steps: ProgressionStep[] = store.progressionSteps;
        const bpm: number = store.progressionBpm;

        if (steps.length === 0) return;

        this.currentStepIndex++;
        if (this.currentStepIndex >= steps.length) {
            this.currentStepIndex = 0; 
        }

        store.progressionSetCurrentStep(this.currentStepIndex);

        const currentStep = steps[this.currentStepIndex];
        const secondsPerBeat = 60.0 / bpm;
        
        const duration = (currentStep ? currentStep.duration : 1) * secondsPerBeat;
        
        this.nextNoteTime += duration;
    }

    private scheduleNote(stepNumber: number, time: number) {
        const store = this.getStore();
        const steps: ProgressionStep[] = store.progressionSteps;
        const chords: SavedChord[] = store.savedChords;
        const settings: AppSettings = store.settings;
        const bpm: number = store.progressionBpm;

        const step = steps[stepNumber];
        if (!step || step.mode === 'rest') return;

        const chord = chords.find(c => c.id === step.chordId);
        if (!chord || !chord.nodes || chord.nodes.length === 0) return;

        const secondsPerBeat = 60.0 / bpm;
        const stepDuration = step.duration * secondsPerBeat;

        const play = (node: NodeData, startTime: number, duration: number) => {
            const vel = Math.max(0, Math.min(step.velocity ?? 1, 1));
            const stopFn = startNote(node, settings, 'sequence', 0, startTime, vel);
            
            stopFn(startTime + duration); 
            
            this.activeVoices.push(stopFn);
        };

        if (step.mode === 'chord' || !step.mode) {
            
            chord.nodes.forEach(node => {
                const gate = step.gate || 0.95;
                play(node, time, stepDuration * gate);
            });
        } else if (step.mode === 'arp') {
            
            const sortedNodes = [...chord.nodes].sort((a, b) => {
                const pitchA = a.cents + (a.octave * 1200);
                const pitchB = b.cents + (b.octave * 1200);
                return pitchA - pitchB;
            });

            const sub = step.subdivision || 1;
            const totalTicks = Math.round(step.duration * sub);
            const tickDuration = secondsPerBeat / sub;
            const noteGate = step.gate || 0.5;
            const noteDuration = tickDuration * noteGate;

            const pattern = step.arpPattern || 'up';
            const count = sortedNodes.length;
            
            for (let i = 0; i < totalTicks; i++) {
                let noteIndex = 0;
                
                const seqPos = this.arpNoteCounter;

                if (pattern === 'up') {
                    noteIndex = seqPos % count;
                } else if (pattern === 'down') {
                    noteIndex = (count - 1) - (seqPos % count);
                } else if (pattern === 'up-down') {
                    if (count < 2) {
                        noteIndex = 0;
                    } else {
                        const cycleLen = (count * 2) - 2;
                        const cyclePos = seqPos % cycleLen;
                        if (cyclePos < count) {
                            noteIndex = cyclePos;
                        } else {
                            noteIndex = count - 2 - (cyclePos - count);
                        }
                    }
                } else if (pattern === 'random') {
                    
                    noteIndex = Math.floor(this.rng.next() * count);
                }

                const nodeToPlay = sortedNodes[noteIndex];
                if (nodeToPlay) {
                    play(nodeToPlay, time + (i * tickDuration), noteDuration);
                }
                
                this.arpNoteCounter++;
            }
        }
    }

    private scheduler() {
        if (!this.isRunning) return;

        const ctx = getAudioContext();
        const currentTime = ctx.currentTime;

        if (this.nextNoteTime < currentTime - 0.2) {
            this.nextNoteTime = currentTime;
        }

        while (this.nextNoteTime < currentTime + SCHEDULE_AHEAD_TIME) {
            this.scheduleNote(this.currentStepIndex, this.nextNoteTime);
            this.nextStep();
        }

        this.timerID = window.setTimeout(() => this.scheduler(), LOOKAHEAD_INTERVAL);
    }
}

let sequencerInstance: Sequencer | null = null;

export const getSequencer = (getStoreFn: () => any) => {
    if (!sequencerInstance) {
        sequencerInstance = new Sequencer(getStoreFn);
    }
    return sequencerInstance;
};
