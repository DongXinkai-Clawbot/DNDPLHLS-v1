import type { MusicXmlPitch, MusicXmlTempoEvent, MusicXmlTimeSignatureEvent, MusicXmlIgnoredElement, MusicXmlTimeModification, MusicXmlTuplet } from '../../musicxml/types';
import type { HuntMap } from '../HUNT_MAP';

export type HuntLogLevel = 'info' | 'debug' | 'error';

export interface HuntLogEntry {
  level: HuntLogLevel;
  message: string;
  measureIndex?: number;
  voiceId?: string;
  tick?: number;
  objectId?: string;
  data?: Record<string, unknown>;
}

export type HuntSeverity = 'fatal' | 'error' | 'warning';

export interface HuntValidationIssue {
  ruleId: string;
  severity: HuntSeverity;
  message: string;
  measureIndex?: number;
  voiceId?: string;
  tick?: number;
  objectId?: string;
  suggestion?: string;
}

export interface HuntValidationReport {
  issues: HuntValidationIssue[];
  stats: {
    fatalCount: number;
    errorCount: number;
    warningCount: number;
    byRule: Record<string, number>;
    crowdedAreas: Array<{ measureIndex: number; tick: number; density: number }>;
  };
}

export type HuntAccidentalPolicy = 'measure' | 'always';

export interface HuntEngineConfig {
  map?: HuntMap;
  ticksPerQuarter?: number;
  refPitchHz?: number;
  zeroPitch?: 'C0' | 'A4' | 'custom';
  a4InC0Cents?: number;
  accidentalPolicy?: HuntAccidentalPolicy;
  maxPitchErrorCents?: number;
  staffLineCount?: number;
  staffLineSpacingPx?: number;
  staffGapPx?: number;
  clefXPx?: number;
  clefSizePx?: number;
  showStaffLines?: boolean;
  showRegionLines?: boolean;
  regionLineZIndices?: number[];
  staffLineThicknessPx?: number;
  regionLineThicknessPx?: number;
  showLedgerLines?: boolean;
  baseQuarterWidthPx?: number;
  minNoteSpacingPx?: number;
  strongBeatSpacingFactor?: number;
  weakBeatSpacingFactor?: number;
  stemLengthPx?: number;
  stemLengthMinPx?: number;
  stemLengthMaxPx?: number;
  stemExtremeThreshold?: number;
  beamMaxSlope?: number;
  beamThicknessPx?: number;
  beamSpacingPx?: number;
  noteheadWidthPx?: number;
  noteheadHeightPx?: number;
  accidentalGapPx?: number;
  dotGapPx?: number;
  ledgerLineExtraPx?: number;
  restScale?: number;
  voiceColorsEnabled?: boolean;
  voiceColors?: Record<string, string>;
  debug?: {
    includeBoxes?: boolean;
    includeGrid?: boolean;
  };
}

export interface HuntLogicalScore {
  title?: string;
  ticksPerQuarter: number;
  totalTicks: number;
  parts: HuntPart[];
  measures: HuntMeasure[];
  tempoEvents: MusicXmlTempoEvent[];
  timeSignatures: MusicXmlTimeSignatureEvent[];
  ignoredElements: MusicXmlIgnoredElement[];
}

export interface HuntPart {
  id: string;
  name: string;
  staves: HuntStaff[];
}

export interface HuntStaff {
  id: string;
  staffIndex: number;
  voices: HuntVoice[];
  staffLines?: number;
}

export interface HuntVoice {
  id: string;
  voiceIndex: number;
  events: HuntEvent[];
}

export type HuntEvent = HuntNoteEvent | HuntRestEvent | HuntControlEvent;

export interface HuntEventBase {
  id: string;
  kind: 'note' | 'rest' | 'control';
  partId: string;
  staffIndex: number;
  voiceId: string;
  measureIndex: number;
  startTick: number;
  durationTicks: number;
  endTick: number;
  chordMember?: boolean;
  noteType?: string;
  dots?: number;
  timeModification?: MusicXmlTimeModification;
  tuplet?: MusicXmlTuplet;
  sourceId?: string;
}

export interface HuntNoteEvent extends HuntEventBase {
  kind: 'note';
  pitch?: MusicXmlPitch;
  midiNote?: number;
  tieStart: boolean;
  tieStop: boolean;
  pitchMap?: HuntPitchMapping;
  beams?: Array<{ level: number; type: string }>;
}

export interface HuntRestEvent extends HuntEventBase {
  kind: 'rest';
  restFullMeasure?: boolean;
  restType?: string;
}

export interface HuntControlEvent extends HuntEventBase {
  kind: 'control';
  controlType: 'timeSignature' | 'barline';
  payload?: Record<string, unknown>;
}

export interface HuntPitchMapping {
  centsAbs: number;
  I: number;
  Z: number;
  O: number;
  zInOct: number;
  errorCents: number;
  errorOverLimit: boolean;
  accidental: 'bb' | 'b' | 'n' | '#' | 'x';
}

export interface HuntMeasure {
  index: number;
  startTick: number;
  endTick: number;
  timeSignature: { numerator: number; denominator: number };
  beatGrid: HuntBeatGrid;
  events: HuntEvent[];
}

export interface HuntBeatGrid {
  measureIndex: number;
  startTick: number;
  endTick: number;
  ticksPerBeat: number;
  beatCount: number;
  isCompound: boolean;
  strongBoundaries: number[];
  secondaryBoundaries: number[];
  beatBoundaries: number[];
  forbiddenBoundaries: number[];
  allowedGroups: Array<{ start: number; end: number; level: number }>;
}

export type StemDirection = 'up' | 'down';

export interface HuntLayoutScore {
  width: number;
  height: number;
  measures: HuntLayoutMeasure[];
  events: HuntLayoutEvent[];
  beams: HuntBeamGroup[];
  staffLayouts: HuntStaffLayout[];
}

export interface HuntStaffLayout {
  staffId: string;
  staffIndex: number;
  top: number;
  bottom: number;
  centerLine: number;
  lineSpacing: number;
  visibleMinZ: number;
  visibleMaxZ: number;
  drawMinZ: number;
  drawMaxZ: number;
}

export interface HuntLayoutMeasure {
  index: number;
  startTick: number;
  endTick: number;
  startX: number;
  width: number;
  contentStartX: number;
  contentWidth: number;
  tickPositions?: Array<{ tick: number; x: number }>;
  beatGrid: HuntBeatGrid;
}

export interface HuntLayoutEventBase {
  id: string;
  kind: 'note' | 'rest';
  measureIndex: number;
  staffId: string;
  voiceId: string;
  startTick: number;
  durationTicks: number;
  tieStart?: boolean;
  tieStop?: boolean;
  noteType?: string;
  x: number;
  y: number;
  notehead: { x: number; y: number; width: number; height: number };
  stem?: { direction: StemDirection; x: number; y1: number; y2: number };
  flags?: number;
  dots?: Array<{ x: number; y: number; radius: number }>;
  accidental?: { x: number; y: number; glyph: string; width: number; height: number };
  ledgerLines?: Array<{ x1: number; x2: number; y: number }>;
  tie?: { x1: number; y1: number; x2: number; y2: number; curveDir?: number; curveHeight?: number; crossMeasure?: boolean };
  bbox: { x: number; y: number; width: number; height: number };
}

export interface HuntLayoutNote extends HuntLayoutEventBase {
  kind: 'note';
  pitchMap: HuntPitchMapping;
  noteheadFilled?: boolean;
  stem?: { direction: StemDirection; x: number; y1: number; y2: number };
}

export interface HuntLayoutRest extends HuntLayoutEventBase {
  kind: 'rest';
  restType: string;
}

export type HuntLayoutEvent = HuntLayoutNote | HuntLayoutRest;

export interface HuntBeamGroup {
  id: string;
  voiceId: string;
  measureIndex: number;
  level: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  slope: number;
  thickness: number;
  noteIds: string[];
}

export interface HuntGraphicObject {
  id: string;
  type:
    | 'staffLine'
    | 'barline'
    | 'clef'
    | 'notehead'
    | 'stem'
    | 'flag'
    | 'beam'
    | 'accidental'
    | 'dot'
    | 'rest'
    | 'ledger'
    | 'tie'
    | 'debug';
  x: number;
  y: number;
  width: number;
  height: number;
  path?: string;
  text?: string;
  layer: number;
  eventId?: string;
  voiceId?: string;
  color?: string;
  opacity?: number;
  filled?: boolean;
  measureIndex?: number;
}

export interface HuntRenderMeasure {
  index: number;
  x: number;
  width: number;
}

export interface HuntRenderScore {
  width: number;
  height: number;
  objects: HuntGraphicObject[];
  measures: HuntRenderMeasure[];
}

export interface HuntEngineResult {
  logical: HuntLogicalScore;
  layout: HuntLayoutScore;
  render: HuntRenderScore;
  validation: HuntValidationReport;
  logs: HuntLogEntry[];
}
