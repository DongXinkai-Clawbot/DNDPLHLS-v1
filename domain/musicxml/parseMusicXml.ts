import type {
  MusicXmlImportResult,
  MusicXmlNoteEvent,
  MusicXmlPartInfo,
  MusicXmlTempoEvent,
  MusicXmlTimeSignatureEvent,
  MusicXmlPitch,
  MusicXmlBeam,
  MusicXmlMeasureMeta,
  MusicXmlIgnoredElement,
  MusicXmlTimeModification,
  MusicXmlTuplet
} from './types';

const STEP_TO_SEMITONE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

const safeNum = (value: any, fallback: number) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const textOf = (el: Element | null | undefined) => (el?.textContent ?? '').trim();

const elementChildren = (parent: Element) => {
  const kids = (parent as any).children ? Array.from((parent as any).children) : Array.from(parent.childNodes || []);
  return kids.filter((n) => (n as any).tagName) as Element[];
};

const childByTag = (parent: Element, tag: string) => {
  const kids = elementChildren(parent);
  return kids.find((c) => c.tagName === tag) || null;
};

const childrenByTag = (parent: Element, tag: string) => elementChildren(parent).filter((c) => c.tagName === tag);

const parseSelectorSegment = (segment: string) => {
  const match = /^([a-zA-Z0-9:-]+)(?:\\[(.+?)=[\"']?(.+?)[\"']?\\])?$/.exec(segment.trim());
  if (!match) return { tag: segment.trim(), attr: null as string | null, value: null as string | null };
  return { tag: match[1], attr: match[2] ?? null, value: match[3] ?? null };
};

const selectDescendants = (parent: Element | Document, segment: string) => {
  const { tag, attr, value } = parseSelectorSegment(segment);
  const nodes = Array.from(parent.getElementsByTagName(tag));
  if (!attr) return nodes as Element[];
  return nodes.filter((n) => {
    const attrVal = n.getAttribute(attr);
    return value === null ? attrVal !== null : attrVal === value;
  }) as Element[];
};

const qs = (parent: Element | Document, selector: string) => {
  const anyParent = parent as any;
  if (typeof anyParent.querySelector === 'function') return anyParent.querySelector(selector) as Element | null;
  const parts = selector.trim().split(/\\s+/);
  let current: Element | Document | null = parent;
  for (const part of parts) {
    if (!current) return null;
    const candidates = selectDescendants(current, part);
    current = candidates[0] ?? null;
  }
  return current as Element | null;
};

const qsa = (parent: Element | Document, selector: string) => {
  const anyParent = parent as any;
  if (typeof anyParent.querySelectorAll === 'function') return Array.from(anyParent.querySelectorAll(selector)) as Element[];
  const parts = selector.trim().split(/\\s+/);
  let current: Array<Element | Document> = [parent];
  for (const part of parts) {
    const next: Element[] = [];
    current.forEach((node) => {
      next.push(...selectDescendants(node as Element | Document, part));
    });
    current = next;
  }
  return current as Element[];
};

const parsePartList = (doc: Document): MusicXmlPartInfo[] => {
  const parts: MusicXmlPartInfo[] = [];
  const partList = qs(doc, 'part-list');
  if (!partList) return parts;
  const scoreParts = Array.from(qsa(partList, 'score-part'));
  scoreParts.forEach((sp) => {
    const id = sp.getAttribute('id') || '';
    if (!id) return;
    const name = textOf(qs(sp, 'part-name')) || id;
    parts.push({ id, name });
  });
  return parts;
};

type ParseState = {
  divisions: number;
  transposeChromatic: number;
  transposeOctaveChange: number;
};

const parseTranspose = (attributes: Element, state: ParseState) => {
  const transpose = qs(attributes, 'transpose');
  if (!transpose) return;
  const chromatic = qs(transpose, 'chromatic');
  const octaveChange = qs(transpose, 'octave-change');
  state.transposeChromatic = safeNum(textOf(chromatic), state.transposeChromatic);
  state.transposeOctaveChange = safeNum(textOf(octaveChange), state.transposeOctaveChange);
};

const parseDivisions = (attributes: Element, state: ParseState) => {
  const div = qs(attributes, 'divisions');
  if (!div) return;
  const v = safeNum(textOf(div), state.divisions);
  if (v > 0) state.divisions = v;
};

const parseTimeSignature = (attributes: Element): { numerator: number; denominator: number } | null => {
  const time = qs(attributes, 'time');
  if (!time) return null;
  const beats = safeNum(textOf(qs(time, 'beats')), NaN);
  const beatType = safeNum(textOf(qs(time, 'beat-type')), NaN);
  if (!Number.isFinite(beats) || !Number.isFinite(beatType) || beats <= 0 || beatType <= 0) return null;
  return { numerator: Math.floor(beats), denominator: Math.floor(beatType) };
};

const parseTempo = (direction: Element): number | null => {
  // 1) <sound tempo="120"/>
  const sound = qs(direction, 'sound');
  const tempoAttr = sound?.getAttribute('tempo');
  if (tempoAttr) {
    const bpm = safeNum(tempoAttr, NaN);
    if (Number.isFinite(bpm) && bpm > 0) return bpm;
  }

  // 2) <direction-type><metronome><per-minute>120</per-minute>
  const perMinute = qs(direction, 'direction-type metronome per-minute');
  const bpm = safeNum(textOf(perMinute), NaN);
  if (Number.isFinite(bpm) && bpm > 0) return bpm;

  return null;
};

const parsePitch = (note: Element, state: ParseState): MusicXmlPitch | null => {
  const pitchEl = qs(note, 'pitch');
  if (!pitchEl) return null;
  const step = textOf(qs(pitchEl, 'step')).toUpperCase();
  if (!step || !Object.prototype.hasOwnProperty.call(STEP_TO_SEMITONE, step)) return null;
  const alter = safeNum(textOf(qs(pitchEl, 'alter')), 0);
  const octave = safeNum(textOf(qs(pitchEl, 'octave')), NaN);
  if (!Number.isFinite(octave)) return null;
  const chromatic = state.transposeChromatic || 0;
  const octaveChange = state.transposeOctaveChange || 0;
  return {
    step,
    alter: alter + chromatic,
    octave: Math.floor(octave + octaveChange)
  };
};

const pitchToMidi = (pitch: MusicXmlPitch): number => {
  const base = STEP_TO_SEMITONE[pitch.step] ?? 0;
  // MusicXML octave is "scientific" (C4 is middle C); MIDI uses C4=60.
  // MIDI formula: (octave + 1) * 12 + stepSemitone + alter
  return (pitch.octave + 1) * 12 + base + (Number.isFinite(pitch.alter) ? pitch.alter : 0);
};

const parseTieInfo = (note: Element) => {
  // <tie type="start|stop"/> and/or <notations><tied type="start|stop"/></notations>
  const types: string[] = [];
  qsa(note, 'tie').forEach((tie) => {
    const t = (tie.getAttribute('type') || '').toLowerCase();
    if (t) types.push(t);
  });
  qsa(note, 'notations tied').forEach((tied) => {
    const t = (tied.getAttribute('type') || '').toLowerCase();
    if (t) types.push(t);
  });
  const tieStart = types.includes('start');
  const tieStop = types.includes('stop');
  return { tieStart, tieStop };
};

const parseBeams = (note: Element): MusicXmlBeam[] | undefined => {
  const beams: MusicXmlBeam[] = [];
  qsa(note, 'beam').forEach((beamEl) => {
    const levelRaw = beamEl.getAttribute('number');
    const level = safeNum(levelRaw, NaN);
    if (!Number.isFinite(level)) return;
    const type = textOf(beamEl).toLowerCase();
    if (!type) return;
    if (type === 'begin' || type === 'continue' || type === 'end' || type === 'forward' || type === 'backward') {
      beams.push({ level: Math.max(1, Math.floor(level)), type });
    }
  });
  return beams.length ? beams : undefined;
};

const parseNoteType = (note: Element) => {
  const typeEl = qs(note, 'type');
  const t = textOf(typeEl);
  return t ? t.toLowerCase() : undefined;
};

const parseDots = (note: Element) => {
  const dots = qsa(note, 'dot').length;
  return dots > 0 ? dots : 0;
};

const parseTimeModification = (note: Element): MusicXmlTimeModification | undefined => {
  const tm = qs(note, 'time-modification');
  if (!tm) return undefined;
  const actual = safeNum(textOf(qs(tm, 'actual-notes')), NaN);
  const normal = safeNum(textOf(qs(tm, 'normal-notes')), NaN);
  if (!Number.isFinite(actual) || !Number.isFinite(normal) || actual <= 0 || normal <= 0) return undefined;
  const normalType = textOf(qs(tm, 'normal-type')) || undefined;
  return { actualNotes: Math.floor(actual), normalNotes: Math.floor(normal), normalType };
};

const parseTuplet = (note: Element): MusicXmlTuplet | undefined => {
  const tupletEl = qs(note, 'notations tuplet');
  if (!tupletEl) return undefined;
  const typeRaw = (tupletEl.getAttribute('type') || '').toLowerCase();
  const type = typeRaw === 'start' || typeRaw === 'stop' || typeRaw === 'continue' ? typeRaw : 'continue';
  const number = safeNum(tupletEl.getAttribute('number'), NaN);
  const placement = (tupletEl.getAttribute('placement') || '').toLowerCase();
  const showNumber = (tupletEl.getAttribute('show-number') || '').toLowerCase();
  const showType = (tupletEl.getAttribute('show-type') || '').toLowerCase();
  return {
    type,
    number: Number.isFinite(number) ? Math.floor(number) : undefined,
    placement: placement === 'above' || placement === 'below' ? placement : undefined,
    showNumber: showNumber === 'none' ? false : showNumber === 'both' || showNumber === 'actual' || showNumber === 'both' ? true : undefined,
    showType: showType === 'none' ? false : showType === 'both' || showType === 'actual' || showType === 'both' ? true : undefined
  };
};

const makeCanonicalId = (parts: {
  partId: string;
  staff: number;
  voice: string;
  startTick: number;
  pitchKey: string;
  serial: number;
}) => {
  const v = parts.voice || '1';
  return `mx-${parts.partId}-st${parts.staff}-v${v}-t${parts.startTick}-p${parts.pitchKey}-#${parts.serial}`;
};

export const parseMusicXmlString = (
  xmlText: string,
  options?: { ticksPerQuarter?: number; sourceType?: 'xml' | 'mxl' }
): MusicXmlImportResult => {
  const ticksPerQuarter = Math.max(1, Math.floor(options?.ticksPerQuarter ?? 480));

  const DomParserCtor =
    typeof DOMParser !== 'undefined'
      ? DOMParser
      : (() => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const xmldom = require('@xmldom/xmldom');
            return xmldom.DOMParser;
          } catch (err) {
            throw new Error('DOMParser is not available in this environment.');
          }
        })();

  const doc = new DomParserCtor().parseFromString(xmlText, 'application/xml');
  const parseError = qs(doc, 'parsererror');
  if (parseError) {
    throw new Error('MusicXML parse error: invalid XML content.');
  }

  const score = doc.documentElement;
  const rootName = score?.tagName || '';
  const isPartwise = rootName === 'score-partwise';
  const isTimewise = rootName === 'score-timewise';
  if (!isPartwise && !isTimewise) {
    throw new Error(`Unsupported MusicXML root: ${rootName || '(empty)'} (expected score-partwise or score-timewise).`);
  }

  const title = textOf(qs(doc, 'work work-title')) || textOf(qs(doc, 'movement-title')) || undefined;
  const parts = parsePartList(doc);
  const partNameById = new Map(parts.map((p) => [p.id, p.name]));

  const events: MusicXmlNoteEvent[] = [];
  const tempoEvents: MusicXmlTempoEvent[] = [];
  const timeSignatureEvents: MusicXmlTimeSignatureEvent[] = [];
  const measureStartTicks = new Set<number>();
  let totalTicks = 0;
  const measureMeta: MusicXmlMeasureMeta[] = [];
  const ignoredElements: MusicXmlIgnoredElement[] = [];
  const errors: string[] = [];

  // Used to avoid id collisions when multiple notes share tick/pitch.
  const serialByKey = new Map<string, number>();

  type PartMeasureBundle = { partId: string; partName: string; measures: Element[]; measureIndices: number[] };
  const bundles: PartMeasureBundle[] = [];

  if (isPartwise) {
    const partEls = elementChildren(score).filter((c) => c.tagName === 'part') as Element[];
    partEls.forEach((partEl) => {
      const partId = partEl.getAttribute('id') || '';
      const partName = partNameById.get(partId) || partId || 'Part';
      const measures = elementChildren(partEl).filter((c) => c.tagName === 'measure') as Element[];
      bundles.push({ partId, partName, measures, measureIndices: measures.map((_, i) => i) });
    });
  } else {
    // score-timewise: measures at top-level, each containing part staves.
    const measureEls = elementChildren(score).filter((c) => c.tagName === 'measure') as Element[];
    const byPart = new Map<string, { measures: Element[]; indices: number[] }>();
    measureEls.forEach((measureEl, measureIndex) => {
      const partElsInMeasure = elementChildren(measureEl).filter((c) => c.tagName === 'part') as Element[];
      partElsInMeasure.forEach((partEl) => {
        const partId = partEl.getAttribute('id') || '';
        if (!partId) return;
        const bucket = byPart.get(partId) || { measures: [], indices: [] };
        bucket.measures.push(partEl);
        bucket.indices.push(measureIndex);
        byPart.set(partId, bucket);
      });
    });

    // Prefer declared part-list ordering, then fall back to any extra part ids.
    const partIdsOrdered = [...parts.map((p) => p.id), ...Array.from(byPart.keys()).filter((id) => !partNameById.has(id))];
    partIdsOrdered.forEach((partId) => {
      const bucket = byPart.get(partId);
      if (!bucket) return;
      const partName = partNameById.get(partId) || partId || 'Part';
      bundles.push({ partId, partName, measures: bucket.measures, measureIndices: bucket.indices });
    });
  }

  bundles.forEach((bundle) => {
    const { partId, partName, measures, measureIndices } = bundle;
    const state: ParseState = { divisions: 1, transposeChromatic: 0, transposeOctaveChange: 0 };

    let partTick = 0;
    measures.forEach((measureEl, idxInPart) => {
      const measureIndex = measureIndices[idxInPart] ?? idxInPart;
      const measureStart = partTick;
      const measureNumber = measureEl.getAttribute('number') || undefined;
      measureStartTicks.add(measureStart);
      let divisionsInMeasure: number | null = null;
      let measureTimeSignature: { numerator: number; denominator: number } | undefined;
      let staffLines: Record<number, number> | undefined;
      let cursorTick = measureStart;
      let maxCursorTick = cursorTick;
      let lastNoteStartTick = cursorTick;

      const children = elementChildren(measureEl);
      for (const child of children) {
        if (child.tagName === 'attributes') {
          parseDivisions(child, state);
          divisionsInMeasure = state.divisions || divisionsInMeasure;
          parseTranspose(child, state);
          const ts = parseTimeSignature(child);
          if (ts) {
            timeSignatureEvents.push({ tick: measureStart, numerator: ts.numerator, denominator: ts.denominator });
            measureTimeSignature = ts;
          }
          const staffDetails = Array.from(qsa(child, 'staff-details'));
          if (staffDetails.length) {
            staffLines = staffLines || {};
            staffDetails.forEach((sd) => {
              const staffNumber = safeNum(sd.getAttribute('number'), 1);
              const lines = safeNum(textOf(qs(sd, 'staff-lines')), NaN);
              if (Number.isFinite(lines) && lines > 0) {
                staffLines[Math.max(1, Math.floor(staffNumber))] = Math.floor(lines);
              }
            });
          }
          continue;
        }

        if (child.tagName === 'direction') {
          const bpm = parseTempo(child);
          if (bpm && Number.isFinite(bpm) && bpm > 0) {
            tempoEvents.push({ tick: cursorTick, bpm, microsecondsPerQuarter: Math.round(60000000 / bpm) });
          }
          continue;
        }

        if (child.tagName === 'backup' || child.tagName === 'forward') {
          const durationDiv = safeNum(textOf(qs(child, 'duration')), 0);
          const deltaTicks = Math.round(durationDiv * (ticksPerQuarter / Math.max(1, state.divisions)));
          if (child.tagName === 'backup') cursorTick -= deltaTicks;
          else cursorTick += deltaTicks;
          maxCursorTick = Math.max(maxCursorTick, cursorTick);
          continue;
        }

        if (child.tagName !== 'note') {
          ignoredElements.push({ partId, measureIndex, tagName: child.tagName });
          continue;
        }

        const noteEl = child;
        const isRest = !!qs(noteEl, 'rest');
        const restFullMeasure = !!qs(noteEl, 'rest[measure=\"yes\"]');
        const staff = Math.max(1, Math.floor(safeNum(textOf(qs(noteEl, 'staff')), 1)));
        const voice = textOf(qs(noteEl, 'voice')) || '1';
        const chordMember = !!qs(noteEl, 'chord');
        const hasGrace = !!qs(noteEl, 'grace');

        const durationDiv = hasGrace ? 0 : safeNum(textOf(qs(noteEl, 'duration')), 0);
        const durationTicks = Math.max(0, Math.round(durationDiv * (ticksPerQuarter / Math.max(1, state.divisions))));
        const startTick = chordMember ? lastNoteStartTick : cursorTick;
        const endTick = startTick + durationTicks;
        if (endTick > totalTicks) totalTicks = endTick;

        const { tieStart, tieStop } = parseTieInfo(noteEl);
        const beams = parseBeams(noteEl);
        const pitch = isRest ? null : parsePitch(noteEl, state);
        const midiNote = pitch ? pitchToMidi(pitch) : undefined;
        const noteType = parseNoteType(noteEl);
        const dots = parseDots(noteEl);
        const timeModification = parseTimeModification(noteEl);
        const tuplet = parseTuplet(noteEl);
        const pitchKey = isRest ? 'rest' : pitch ? `${pitch.step}${pitch.alter}` + `@${pitch.octave}` : 'unk';

        const serialKey = `${partId}|${staff}|${voice}|${startTick}|${pitchKey}`;
        const serial = (serialByKey.get(serialKey) || 0) + 1;
        serialByKey.set(serialKey, serial);

        const id = makeCanonicalId({ partId, staff, voice, startTick, pitchKey, serial });
        const ev: MusicXmlNoteEvent = {
          id,
          partId,
          partName,
          measureIndex,
          staff,
          voice,
          startTick,
          durationTicks,
          endTick,
          measureStartTick: measureStart,
          rawDurationDivisions: durationDiv,
          divisions: state.divisions,
          isRest,
          restFullMeasure,
          chordMember,
          pitch: pitch || undefined,
          midiNote,
          noteType: noteType || undefined,
          dots: Number.isFinite(dots) ? dots : undefined,
          timeModification,
          tuplet,
          tieStart,
          tieStop,
          beams
        };
        events.push(ev);

        lastNoteStartTick = startTick;
        if (!chordMember && !hasGrace) {
          cursorTick += durationTicks;
          maxCursorTick = Math.max(maxCursorTick, cursorTick);
        }
      }

      // Advance to the end of the measure.
      // MusicXML uses <backup>/<forward> for voices; the furthest cursor reached is the measure length.
      partTick = Math.max(maxCursorTick, cursorTick, measureStart);

      measureMeta.push({
        partId,
        measureIndex,
        startTick: measureStart,
        divisions: divisionsInMeasure,
        timeSignature: measureTimeSignature,
        staffLines,
        measureNumber
      });
    });
  });

  // Normalize tempo / time signature events (sorted, de-duped by tick).
  const normalizeByTick = <T extends { tick: number }>(items: T[]) => {
    const map = new Map<number, T>();
    items
      .filter((e) => Number.isFinite(e.tick) && e.tick >= 0)
      .sort((a, b) => a.tick - b.tick)
      .forEach((e) => {
        if (!map.has(e.tick)) map.set(e.tick, e);
      });
    return Array.from(map.values()).sort((a, b) => a.tick - b.tick);
  };

  const tempos = normalizeByTick(tempoEvents);
  const timeSigs = normalizeByTick(timeSignatureEvents);

  const measureTicksSorted = Array.from(measureStartTicks).filter((t) => Number.isFinite(t) && t >= 0);
  measureTicksSorted.sort((a, b) => a - b);

  return {
    sourceType: options?.sourceType ?? 'xml',
    title,
    parts,
    events,
    tempoEvents: tempos,
    timeSignatureEvents: timeSigs,
    measureStartTicks: measureTicksSorted,
    ticksPerQuarter,
    totalTicks: Math.max(0, totalTicks),
    measureMeta,
    ignoredElements,
    errors: errors.length ? errors : undefined
  };
};
