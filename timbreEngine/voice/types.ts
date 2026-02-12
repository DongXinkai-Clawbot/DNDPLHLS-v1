import type { AppSettings, TimbrePatch } from '../../types';
import type { TimbreContext, TimbreVoiceExpression } from '../engineState';

export type VoiceRuntime = {
  ctx: AudioContext;
  out: AudioNode;
  freq: number;
  patch: TimbrePatch;
  settings: AppSettings;
  context: TimbreContext;
  startTime: number;
  noteKey: string;
  velocity: number;
  voiceMods?: TimbreVoiceExpression;
  now: number;
  stopped: boolean;
  nodes: AudioNode[];
  stopFns: Array<() => void>;
  [key: string]: any;
};
