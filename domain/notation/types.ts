import type { Fraction, PrimeLimit } from '../../types';

export type Accidental = 'sharp' | 'flat' | 'none';
export type GroupingType = 'bar' | 'tie' | 'chord' | null;
export type GroupRole = 'start' | 'end' | 'member' | 'marker' | null;

export interface SourceRange {
  start: number;
  end: number;
}

export interface NotationToken {
  tokenId: string;
  symbol: string;
  degree: number | null;
  accidental: Accidental;
  octaveOffset: number;
  durationUnit: number;
  isRest: boolean;
  grouping: GroupingType;
  groupId?: string;
  groupRole?: GroupRole;
  sourceRange: SourceRange;
}

export interface TokenStream {
  sourceText: string;
  tokens: NotationToken[];
}

export interface ParsingRules {
  degreeSymbols: Record<string, number>;
  accidentalSymbols: { sharp: string[]; flat: string[] };
  octaveSymbols: { up: string[]; down: string[] };
  sustainSymbols: string[];
  restSymbols: string[];
  groupingSymbols: {
    bar: string[];
    tieStart: string[];
    tieEnd: string[];
    chordStart: string[];
    chordEnd: string[];
  };
  accidentalPlacement: 'before' | 'after' | 'either';
}

export interface RatioContext {
  tonic: Fraction;
  scaleMap: Record<number, Fraction>;
  accidentalRatios: { sharp: Fraction; flat: Fraction };
  octaveRatio: Fraction;
}

export type Resolvability = 'resolved' | 'approximate' | 'unresolved';

export interface RatioDescriptor {
  tokenId: string;
  tokenIndex: number;
  baseRatio: Fraction | null;
  accidentalRatio: Fraction | null;
  octaveRatio: Fraction | null;
  finalRatio: Fraction | null;
  simplifiedRatio: Fraction | null;
  primeFactors: Record<PrimeLimit, number> | null;
  relativeCents: number | null;
  latticeMapping: { primeVector: Record<PrimeLimit, number> } | null;
  resolvability: Resolvability;
}

export type TemporalPhase = 'start' | 'sustain' | 'end';

export interface TemporalState {
  currentTokenIndex: number;
  phase: TemporalPhase;
  lookaheadRange: { start: number; end: number };
}

export interface TransportState {
  timeMs: number;
  bpm: number;
  beatUnit: number;
  startTimeMs?: number;
}

export interface TemporalConfig {
  lookaheadCount: number;
  phaseThresholds: { start: number; end: number };
}

export type DisplayMode =
  | 'notation'
  | 'notation+retune'
  | 'notation+lattice'
  | 'notation+retune+lattice';

export type SyncPriority = 'user' | 'score';

export interface InteractionState {
  autoAdvance: boolean;
  autoRetune: boolean;
  autoLatticeSync: boolean;
  autoScroll: boolean;
  autoAudio: boolean;
  displayMode: DisplayMode;
  syncPriority: SyncPriority;
  showHz: boolean;
  showCents: boolean;
  showPrimeFactors: boolean;
}

export interface SyncStatus {
  mode: 'synced' | 'observing';
  lastSource: 'notation' | 'lattice' | 'midi' | 'retune' | 'audio' | 'external' | 'none';
  mismatchCents?: number;
  message?: string;
}

export interface RenderTokenView {
  tokenId: string;
  index: number;
  symbol: string;
  degree: number | null;
  isRest: boolean;
  grouping: GroupingType;
  ratioLabel: string | null;
  extras: { hz?: number; cents?: number; primeFactors?: string };
  isCurrent: boolean;
  isPlayable: boolean;
}

export interface RenderView {
  mode: DisplayMode;
  tokens: RenderTokenView[];
  currentIndex: number;
  visibleRange: { start: number; end: number };
  scrollAnchorIndex: number;
  autoScroll: boolean;
}

export interface RenderConfig {
  viewportSize: number;
  baseFrequency?: number;
}

export interface SyncConfig {
  matchToleranceCents: number;
  mismatchToleranceCents: number;
}
