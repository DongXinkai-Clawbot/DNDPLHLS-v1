import type { Fraction } from '../../types';

export type RatioDisplayMode = 'fraction' | 'decimal' | 'both';

export type ScoreEventType = 'note' | 'rest' | 'bar' | 'marker';

export type ScoreEvent = {
  id: string;
  type: ScoreEventType;
  voiceId: string;
  t0: number;
  t1: number;
  duration: number;
  ratio?: string | null;
  ratioFraction?: Fraction | null;
  nodeId?: string | null;
  midi?: {
    id?: string;
    noteNumber: number;
    channel: number;
    trackIndex: number;
    startTick: number;
    durationTicks: number;
  };
  chordGroupId?: string;
};

export type ScoreVoiceIndex = { t0s: number[] };

export type ScoreVoice = { voiceId: string; label?: string; events: ScoreEvent[]; index?: ScoreVoiceIndex };

export type ScoreTempoInfo = {
  ticksPerBeat: number;
  microsecondsPerBeat: number;
  secondsPerTick: number;
  speed: number;
};

export type ScoreTimeSignature = {
  numerator: number;
  denominator: number;
};

export type ScoreDocument = {
  voices: ScoreVoice[];
  events?: ScoreEvent[];
  totalDuration: number;
  tempoInfo?: ScoreTempoInfo;
  timeSignature?: ScoreTimeSignature;
};
