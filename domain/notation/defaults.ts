import { createFraction } from '../../musicLogic';
import type {
  InteractionState,
  ParsingRules,
  RatioContext,
  RenderConfig,
  SyncConfig,
  TemporalConfig
} from './types';

export const DEFAULT_PARSING_RULES: ParsingRules = {
  degreeSymbols: { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 },
  accidentalSymbols: { sharp: ['#'], flat: ['b'] },
  octaveSymbols: { up: ['.'], down: [','] },
  sustainSymbols: ['-', '_'],
  restSymbols: ['0', 'R'],
  groupingSymbols: {
    bar: ['|'],
    tieStart: ['('],
    tieEnd: [')'],
    chordStart: ['['],
    chordEnd: [']']
  },
  accidentalPlacement: 'before'
};

export const DEFAULT_RATIO_CONTEXT: RatioContext = {
  tonic: createFraction(1n, 1n),
  scaleMap: {
    1: createFraction(1n, 1n),
    2: createFraction(9n, 8n),
    3: createFraction(5n, 4n),
    4: createFraction(4n, 3n),
    5: createFraction(3n, 2n),
    6: createFraction(5n, 3n),
    7: createFraction(15n, 8n)
  },
  accidentalRatios: {
    sharp: createFraction(25n, 24n),
    flat: createFraction(24n, 25n)
  },
  octaveRatio: createFraction(2n, 1n)
};

export const DEFAULT_INTERACTION_STATE: InteractionState = {
  autoAdvance: true,
  autoRetune: false,
  autoLatticeSync: false,
  autoScroll: true,
  autoAudio: false,
  displayMode: 'notation',
  syncPriority: 'score',
  showHz: false,
  showCents: false,
  showPrimeFactors: false
};

export const DEFAULT_TEMPORAL_CONFIG: TemporalConfig = {
  lookaheadCount: 4,
  phaseThresholds: { start: 0.1, end: 0.9 }
};

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  viewportSize: 16
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  matchToleranceCents: Number.POSITIVE_INFINITY,
  mismatchToleranceCents: 5
};
