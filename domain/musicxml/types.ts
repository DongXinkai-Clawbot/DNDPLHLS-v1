export type MusicXmlTempoEvent = {
  tick: number;
  bpm: number;
  microsecondsPerQuarter: number;
};

export type MusicXmlTimeSignatureEvent = {
  tick: number;
  numerator: number;
  denominator: number;
};

export type MusicXmlPitch = {
  step: string;
  alter: number;
  octave: number;
};

export type MusicXmlBeam = {
  level: number;
  type: 'begin' | 'continue' | 'end' | 'forward' | 'backward';
};

export type MusicXmlTimeModification = {
  actualNotes: number;
  normalNotes: number;
  normalType?: string;
};

export type MusicXmlTuplet = {
  type: 'start' | 'stop' | 'continue';
  number?: number;
  showNumber?: boolean;
  showType?: boolean;
  placement?: 'above' | 'below';
};

export type MusicXmlMeasureMeta = {
  partId: string;
  measureIndex: number;
  startTick: number;
  divisions: number | null;
  timeSignature?: { numerator: number; denominator: number };
  staffLines?: Record<number, number>;
  measureNumber?: string;
};

export type MusicXmlIgnoredElement = {
  partId: string;
  measureIndex: number;
  tagName: string;
};

export type MusicXmlNoteEvent = {
  id: string;
  partId: string;
  partName: string;
  measureIndex: number;
  staff: number;
  voice: string;

  startTick: number;
  durationTicks: number;
  endTick: number;
  measureStartTick?: number;
  rawDurationDivisions?: number;
  divisions?: number;

  isRest: boolean;
  restFullMeasure?: boolean;
  chordMember: boolean;
  pitch?: MusicXmlPitch;
  /** MIDI note number. Can be fractional if MusicXML has microtonal <alter>. */
  midiNote?: number;
  noteType?: string;
  dots?: number;
  timeModification?: MusicXmlTimeModification;
  tuplet?: MusicXmlTuplet;

  tieStart: boolean;
  tieStop: boolean;
  beams?: MusicXmlBeam[];
};

export type MusicXmlPartInfo = {
  id: string;
  name: string;
};

export type MusicXmlImportResult = {
  sourceType: 'xml' | 'mxl';
  title?: string;
  parts: MusicXmlPartInfo[];
  events: MusicXmlNoteEvent[];
  tempoEvents: MusicXmlTempoEvent[];
  timeSignatureEvents: MusicXmlTimeSignatureEvent[];
  /** Measure start positions in ticks (union across parts). */
  measureStartTicks: number[];
  ticksPerQuarter: number;
  totalTicks: number;
  measureMeta?: MusicXmlMeasureMeta[];
  ignoredElements?: MusicXmlIgnoredElement[];
  errors?: string[];
};

export const voiceKeyForMusicXmlEvent = (ev: Pick<MusicXmlNoteEvent, 'partId' | 'staff' | 'voice'>) => {
  const staff = Number.isFinite(ev.staff) ? Math.max(1, Math.floor(ev.staff)) : 1;
  const voice = (ev.voice || '1').trim() || '1';
  return `part-${ev.partId}-staff-${staff}-voice-${voice}`;
};
