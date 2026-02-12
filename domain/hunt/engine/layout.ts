import type {
  HuntEngineConfig,
  HuntLogicalScore,
  HuntLayoutScore,
  HuntLayoutMeasure,
  HuntLayoutEvent,
  HuntLayoutNote,
  HuntLayoutRest,
  HuntBeamGroup,
  HuntStaffLayout,
  HuntMeasure,
  HuntNoteEvent,
  HuntRestEvent,
  HuntEvent,
  StemDirection
} from './types';
import { HuntLogger } from './logger';
import { clamp, stableSort } from './utils';
import { HUNT_MAP_GEOMETRY_V1 } from '../HUNT_MAP';

const NOTE_TYPE_LEVEL: Record<string, number> = {
  eighth: 1,
  '8th': 1,
  sixteenth: 2,
  '16th': 2,
  thirtysecond: 3,
  '32nd': 3,
  sixtyfourth: 4,
  '64th': 4
};

const NOTE_TYPES = [
  { type: 'whole', beats: 4 },
  { type: 'half', beats: 2 },
  { type: 'quarter', beats: 1 },
  { type: 'eighth', beats: 0.5 },
  { type: '16th', beats: 0.25 },
  { type: '32nd', beats: 0.125 },
  { type: '64th', beats: 0.0625 }
];

const durationToNoteValue = (durationTicks: number, ticksPerQuarter: number) => {
  const epsilon = 0.001;
  for (const base of NOTE_TYPES) {
    const baseTicks = base.beats * ticksPerQuarter;
    for (let dots = 0; dots <= 2; dots += 1) {
      const dotFactor = dots === 0 ? 1 : dots === 1 ? 1.5 : 1.75;
      const target = baseTicks * dotFactor;
      if (Math.abs(durationTicks - target) <= epsilon) {
        return { noteType: base.type, dots };
      }
    }
  }
  return { noteType: 'custom', dots: 0 };
};

const noteTypeToBeamLevel = (noteType?: string) => {
  if (!noteType) return 0;
  const key = noteType.toLowerCase();
  return NOTE_TYPE_LEVEL[key] ?? 0;
};

const noteHasStem = (noteType?: string) => {
  if (!noteType) return true;
  const key = noteType.toLowerCase();
  return key !== 'whole' && key !== 'breve' && key !== 'long';
};

const noteTypeToFlagCount = (noteType?: string) => {
  const level = noteTypeToBeamLevel(noteType);
  return Math.max(0, level);
};

const buildStaffLayouts = (logical: HuntLogicalScore, config: HuntEngineConfig): HuntStaffLayout[] => {
  const map = config.map ?? HUNT_MAP_GEOMETRY_V1;
  const staffLineCount = Math.max(5, Math.floor(config.staffLineCount ?? 25));
  const lineSpacing = config.staffLineSpacingPx ?? 8;
  const staffGap = config.staffGapPx ?? lineSpacing * 8;
  const layouts: HuntStaffLayout[] = [];

  let currentTop = 40;

  logical.parts.forEach((part) => {
    part.staves.forEach((staff) => {
      const notes = staff.voices.flatMap((voice) => voice.events).filter((e) => e.kind === 'note') as HuntNoteEvent[];
      const zs = notes
        .map((n) => n.pitchMap?.Z)
        .filter((z): z is number => Number.isFinite(z));
      const minZ = zs.length ? Math.min(...zs) : 0;
      const maxZ = zs.length ? Math.max(...zs) : 0;
      const centerZ = Math.round((minZ + maxZ) / 2);
      const centerLine = centerZ % 2 === 0 ? centerZ : centerZ + 1;
      const halfLines = Math.floor(staffLineCount / 2);
      const minVisibleZ = centerLine - halfLines * 2;
      const maxVisibleZ = centerLine + halfLines * 2;
      const minDrawZ = Math.min(minVisibleZ, minZ);
      const maxDrawZ = Math.max(maxVisibleZ, maxZ);
      const height = (maxDrawZ - minDrawZ) * lineSpacing;
      const layout: HuntStaffLayout = {
        staffId: staff.id,
        staffIndex: staff.staffIndex,
        top: currentTop,
        bottom: currentTop + height,
        centerLine: centerLine,
        lineSpacing,
        visibleMinZ: minVisibleZ,
        visibleMaxZ: maxVisibleZ,
        drawMinZ: minDrawZ,
        drawMaxZ: maxDrawZ
      };
      layouts.push(layout);
      currentTop += height + staffGap;
    });
  });

  return layouts;
};

const yForZ = (layout: HuntStaffLayout, z: number) => {
  return layout.top + (layout.drawMaxZ - z) * layout.lineSpacing;
};

const computeChordOffsets = (notes: HuntLayoutNote[]) => {
  const sorted = [...notes].sort((a, b) => a.pitchMap.Z - b.pitchMap.Z);
  let offsetDir = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    const note = sorted[i];
    const prev = sorted[i - 1];
    let offset = 0;
    if (prev && Math.abs(prev.pitchMap.Z - note.pitchMap.Z) === 1) {
      offset = offsetDir * (note.notehead.width * 0.6);
      offsetDir *= -1;
    } else {
      offsetDir = 1;
    }
    note.notehead.x += offset;
    note.x += offset;
  }
};

const assignVoiceDirections = (staffEvents: HuntEvent[]) => {
  const voiceMap = new Map<string, { sum: number; count: number }>();
  staffEvents.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntNoteEvent;
    const z = note.pitchMap?.Z;
    if (!Number.isFinite(z)) return;
    const entry = voiceMap.get(note.voiceId) || { sum: 0, count: 0 };
    entry.sum += z as number;
    entry.count += 1;
    voiceMap.set(note.voiceId, entry);
  });
  const ranked = Array.from(voiceMap.entries())
    .map(([voiceId, stats]) => ({ voiceId, avg: stats.sum / Math.max(1, stats.count) }))
    .sort((a, b) => b.avg - a.avg);
  const directions = new Map<string, StemDirection>();
  if (ranked.length > 1) {
    ranked.forEach((voice, idx) => {
      directions.set(voice.voiceId, idx === 0 ? 'up' : idx === ranked.length - 1 ? 'down' : 'up');
    });
  }
  return directions;
};

const computeStem = (
  note: HuntLayoutNote,
  staffLayout: HuntStaffLayout,
  direction: StemDirection,
  config: HuntEngineConfig
) => {
  if (!noteHasStem(note.noteType)) return;
  const baseLen = config.stemLengthPx ?? staffLayout.lineSpacing * 7;
  const minLen = config.stemLengthMinPx ?? staffLayout.lineSpacing * 4;
  const maxLen = config.stemLengthMaxPx ?? staffLayout.lineSpacing * 12;
  const extremeThreshold = config.stemExtremeThreshold ?? staffLayout.lineSpacing * 6;
  const centerY = yForZ(staffLayout, staffLayout.centerLine);
  const distance = Math.abs(note.notehead.y - centerY);
  let length = baseLen;
  if (distance > extremeThreshold) {
    length = Math.max(baseLen, distance);
  }
  length = clamp(length, minLen, maxLen);

  const stemX = note.notehead.x + (direction === 'up' ? note.notehead.width / 2 : -note.notehead.width / 2);
  const y1 = note.notehead.y;
  const y2 = direction === 'up' ? y1 - length : y1 + length;
  note.stem = { direction, x: stemX, y1, y2 };
};

const computeLedgerLines = (
  note: HuntLayoutNote,
  staffLayout: HuntStaffLayout,
  config: HuntEngineConfig,
  ledgerBounds?: { minY?: number; maxY?: number }
) => {
  const extra = config.ledgerLineExtraPx ?? note.notehead.width * 0.6;
  const lines: Array<{ x1: number; x2: number; y: number }> = [];
  const z = note.pitchMap.Z;
  if (z < staffLayout.visibleMinZ) {
    const targetLineZ = z % 2 === 0 ? z : z - 1;
    for (let lineZ = staffLayout.visibleMinZ - 2; lineZ >= targetLineZ; lineZ -= 2) {
      if (lineZ % 2 !== 0) continue;
      const y = yForZ(staffLayout, lineZ);
      if (ledgerBounds?.maxY !== undefined && y >= ledgerBounds.maxY) break;
      lines.push({ x1: note.notehead.x - note.notehead.width / 2 - extra, x2: note.notehead.x + note.notehead.width / 2 + extra, y });
    }
  }
  if (z > staffLayout.visibleMaxZ) {
    const targetLineZ = z % 2 === 0 ? z : z + 1;
    for (let lineZ = staffLayout.visibleMaxZ + 2; lineZ <= targetLineZ; lineZ += 2) {
      if (lineZ % 2 !== 0) continue;
      const y = yForZ(staffLayout, lineZ);
      if (ledgerBounds?.minY !== undefined && y <= ledgerBounds.minY) break;
      lines.push({ x1: note.notehead.x - note.notehead.width / 2 - extra, x2: note.notehead.x + note.notehead.width / 2 + extra, y });
    }
  }
  note.ledgerLines = lines.length ? lines : undefined;
};

const computeDots = (note: HuntLayoutNote, staffLayout: HuntStaffLayout, config: HuntEngineConfig, dotCount: number) => {
  const dots = dotCount ?? 0;
  if (!dots) return;
  const gap = config.dotGapPx ?? note.notehead.width * 0.45;
  const radius = Math.max(1.4, note.notehead.height * 0.25);
  const isLine = note.pitchMap.zInOct % 2 === 0;
  const dotZ = isLine ? note.pitchMap.Z + 1 : note.pitchMap.Z;
  const y = yForZ(staffLayout, dotZ);
  const dotList = [] as Array<{ x: number; y: number; radius: number }>;
  let x = note.notehead.x + note.notehead.width / 2 + gap;
  for (let i = 0; i < dots; i += 1) {
    dotList.push({ x, y, radius });
    x += radius * 2 + gap;
  }
  note.dots = dotList;
};

const computeAccidental = (
  note: HuntLayoutNote,
  show: boolean,
  config: HuntEngineConfig
) => {
  if (!show) return;
  const gap = config.accidentalGapPx ?? note.notehead.width * 0.35;
  const width = note.notehead.width * 0.65;
  const height = note.notehead.height * 1.8;
  const x = note.notehead.x - note.notehead.width / 2 - gap - width;
  let y = note.notehead.y - height / 2;
  // Align flat bowl center to the staff line when the note sits on a line.
  const isLine = note.pitchMap.zInOct % 2 === 0;
  if (isLine && (note.pitchMap.accidental === 'b' || note.pitchMap.accidental === 'bb')) {
    const bowlCenterRatio = 0.65;
    y = note.notehead.y - height * bowlCenterRatio;
  }
  note.accidental = { x, y, glyph: note.pitchMap.accidental, width, height };
};

const buildBeamGroups = (
  notes: HuntLayoutNote[],
  staffLayout: HuntStaffLayout,
  voiceDirection: StemDirection | null,
  config: HuntEngineConfig
): HuntBeamGroup[] => {
  const beams: HuntBeamGroup[] = [];
  if (notes.length < 2) return beams;

  const maxSlope = config.beamMaxSlope ?? 0.25;
  const thickness = config.beamThicknessPx ?? staffLayout.lineSpacing * 0.55;
  const spacing = config.beamSpacingPx ?? thickness * 0.8;

  const notesSorted = stableSort(notes, (a, b) => a.x - b.x || a.id.localeCompare(b.id));
  // Determine beam level for each note
  const levels = notesSorted.map((note) => noteTypeToBeamLevel(note.noteType));
  const maxLevel = Math.max(...levels);
  if (maxLevel <= 0) return beams;

  // Determine direction
  let direction: StemDirection = voiceDirection || 'up';
  if (!voiceDirection) {
    const centerY = yForZ(staffLayout, staffLayout.centerLine);
    let maxDistance = -1;
    let farNote: HuntLayoutNote | null = null;
    notesSorted.forEach((note) => {
      const dist = Math.abs(note.notehead.y - centerY);
      if (dist > maxDistance) {
        maxDistance = dist;
        farNote = note;
      }
    });
    if (farNote) {
      direction = farNote.notehead.y < centerY ? 'down' : 'up';
    }
  }

  // Apply direction to stems
  notesSorted.forEach((note) => {
    if (!note.stem) return;
    note.stem.direction = direction;
  });

  const first = notesSorted[0];
  const last = notesSorted[notesSorted.length - 1];
  const x1 = first.stem?.x ?? first.notehead.x;
  const x2 = last.stem?.x ?? last.notehead.x;
  const baseLen = config.stemLengthPx ?? staffLayout.lineSpacing * 7;
  const baseY1 = direction === 'up' ? first.notehead.y - baseLen : first.notehead.y + baseLen;
  const baseY2 = direction === 'up' ? last.notehead.y - baseLen : last.notehead.y + baseLen;
  let slope = (baseY2 - baseY1) / Math.max(1, x2 - x1);
  slope = clamp(slope, -maxSlope, maxSlope);
  if (Math.abs(slope) < maxSlope * 0.5) {
    slope = 0;
  }

  for (let level = 1; level <= maxLevel; level += 1) {
    let segmentStart: HuntLayoutNote | null = null;
    for (let i = 0; i < notesSorted.length; i += 1) {
      const note = notesSorted[i];
      const hasLevel = levels[i] >= level;
      if (hasLevel && !segmentStart) {
        segmentStart = note;
      }
      if ((!hasLevel || i === notesSorted.length - 1) && segmentStart) {
        const segmentEnd = hasLevel && i === notesSorted.length - 1 ? note : notesSorted[i - 1];
        const segX1 = segmentStart.stem?.x ?? segmentStart.notehead.x;
        const segX2 = segmentEnd.stem?.x ?? segmentEnd.notehead.x;
        const yBase = direction === 'up' ? -spacing * (level - 1) : spacing * (level - 1);
        const segY1 = baseY1 + slope * (segX1 - x1) + yBase;
        const segY2 = baseY1 + slope * (segX2 - x1) + yBase;
        beams.push({
          id: `beam-${segmentStart.id}-${segmentEnd.id}-l${level}`,
          voiceId: segmentStart.voiceId,
          measureIndex: segmentStart.measureIndex,
          level,
          x1: segX1,
          y1: segY1,
          x2: segX2,
          y2: segY2,
          slope,
          thickness,
          noteIds: notesSorted.filter((n, idx) => idx >= notesSorted.indexOf(segmentStart!) && idx <= notesSorted.indexOf(segmentEnd!)).map((n) => n.id)
        });
        segmentStart = null;
      }
    }
  }

  // Align stems to top beam level
  beams.filter((b) => b.level === 1).forEach((beam) => {
    notesSorted.forEach((note) => {
      if (!note.stem) return;
      if (note.x < Math.min(beam.x1, beam.x2) - 0.1 || note.x > Math.max(beam.x1, beam.x2) + 0.1) return;
      const y = beam.y1 + beam.slope * (note.stem.x - beam.x1);
      note.stem.y2 = y;
    });
  });

  return beams;
};

export const layoutHuntScore = (
  logical: HuntLogicalScore,
  config: HuntEngineConfig,
  logger: HuntLogger
): HuntLayoutScore => {
  const staffLayouts = buildStaffLayouts(logical, config);
  const map = config.map ?? HUNT_MAP_GEOMETRY_V1;
  const noteheadWidth = config.noteheadWidthPx ?? 9;
  const noteheadHeight = config.noteheadHeightPx ?? 6;
  const baseQuarterWidth = config.baseQuarterWidthPx ?? 36;
  const minNoteSpacing = config.minNoteSpacingPx ?? 12;
  const restScale = config.restScale ?? 1.75;
  const restGlyphHeight = noteheadHeight * 2.2 * restScale;
  const restGlyphWidth = noteheadWidth * 1.2 * restScale;

  let currentX = 120;
  const measures: HuntLayoutMeasure[] = [];
  const events: HuntLayoutEvent[] = [];
  const beams: HuntBeamGroup[] = [];

  const staffLayoutById = new Map(staffLayouts.map((s) => [s.staffId, s] as const));
  const staffLedgerBounds = new Map<string, { minY?: number; maxY?: number }>();
  staffLayouts.forEach((staff, idx) => {
    const prev = staffLayouts[idx - 1];
    const next = staffLayouts[idx + 1];
    const minY = prev ? prev.bottom + staff.lineSpacing * 0.5 : undefined;
    const maxY = next ? next.top - staff.lineSpacing * 0.5 : undefined;
    staffLedgerBounds.set(staff.staffId, { minY, maxY });
  });

  const shiftEvent = (ev: HuntLayoutEvent, dx: number, dy: number) => {
    ev.x += dx;
    ev.y += dy;
    ev.notehead.x += dx;
    ev.notehead.y += dy;
    if (ev.stem) {
      ev.stem.x += dx;
      ev.stem.y1 += dy;
      ev.stem.y2 += dy;
    }
    if (ev.accidental) {
      ev.accidental.x += dx;
      ev.accidental.y += dy;
    }
    if (ev.dots) {
      ev.dots.forEach((dot) => {
        dot.x += dx;
        dot.y += dy;
      });
    }
    if (ev.ledgerLines) {
      ev.ledgerLines.forEach((line) => {
        line.x1 += dx;
        line.x2 += dx;
        line.y += dy;
      });
    }
    if (ev.tie) {
      ev.tie.x1 += dx;
      ev.tie.x2 += dx;
      ev.tie.y1 += dy;
      ev.tie.y2 += dy;
    }
    ev.bbox.x += dx;
    ev.bbox.y += dy;
  };

  const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

  logical.measures.forEach((measure) => {
    const beatsPerMeasure = measure.timeSignature.numerator * (4 / measure.timeSignature.denominator);
    const measureTicks = Math.max(1, measure.endTick - measure.startTick);
    const eventsInMeasure = measure.events;
    const shortest = eventsInMeasure.reduce((acc, ev) => Math.min(acc, ev.durationTicks || acc), measureTicks);
    const density = eventsInMeasure.length / Math.max(1, beatsPerMeasure);
    const shortness = shortest ? (measureTicks / Math.max(1, shortest) - 1) : 0;
    const widthScale = 1 + shortness * 0.25 + density * 0.08;
    let width = Math.max(baseQuarterWidth * beatsPerMeasure * widthScale, baseQuarterWidth * beatsPerMeasure);
    const accidentalGap = config.accidentalGapPx ?? noteheadWidth * 0.35;
    const accidentalWidth = noteheadWidth * 0.65;
    const minAccPadding = noteheadWidth * 0.5 + accidentalGap + accidentalWidth + 2;
    const leftPad = Math.max(
      minAccPadding,
      Math.min(width * 0.15, Math.max(noteheadWidth * 1.2, minNoteSpacing * 0.6, 4))
    );
    const rightPad = Math.max(noteheadWidth * 0.6, minNoteSpacing * 0.4, 2);
    const usableWidth = Math.max(1, width - leftPad - rightPad);
    const startX = currentX;
    const interMeasureGap = Math.max(minNoteSpacing * 0.25, noteheadWidth * 0.4);
    let contentStartX = startX + leftPad;
    let contentWidth = usableWidth;
    const measureLayout: HuntLayoutMeasure = {
      index: measure.index,
      startTick: measure.startTick,
      endTick: measure.endTick,
      startX,
      width,
      contentStartX,
      contentWidth,
      beatGrid: measure.beatGrid
    };
    measures.push(measureLayout);

    const tickColumns = new Map<number, HuntLayoutEvent[]>();
    const measureEvents: HuntLayoutEvent[] = [];
    const dotCounts = new Map<string, number>();

    // Build layout events
    eventsInMeasure.forEach((ev) => {
      if (ev.kind === 'control') return;
      const staffId = logical.parts
        .flatMap((p) => p.staves)
        .find((s) => s.staffIndex === ev.staffIndex)?.id ?? `staff-${ev.staffIndex}`;
      const staffLayout = staffLayoutById.get(staffId);
      if (!staffLayout) return;
      const t = (ev.startTick - measure.startTick) / measureTicks;
      const x = startX + leftPad + t * contentWidth;
      if (ev.kind === 'rest') {
        const y = yForZ(staffLayout, staffLayout.centerLine);
        const rest: HuntLayoutRest = {
          id: ev.id,
          kind: 'rest',
          measureIndex: measure.index,
          staffId,
          voiceId: ev.voiceId,
          startTick: ev.startTick,
          durationTicks: ev.durationTicks,
          x,
          y,
          notehead: { x, y, width: noteheadWidth, height: noteheadHeight },
          restType: (ev as HuntRestEvent).restType || ev.noteType || 'quarter',
          bbox: { x: x - restGlyphWidth / 2, y: y - restGlyphHeight / 2, width: restGlyphWidth, height: restGlyphHeight }
        };
        events.push(rest);
        measureEvents.push(rest);
        const column = tickColumns.get(ev.startTick) || [];
        column.push(rest);
        tickColumns.set(ev.startTick, column);
        return;
      }

      const note = ev as HuntNoteEvent;
      if (!note.pitchMap) {
        logger.error('Missing pitch map for note.', { measureIndex: measure.index, tick: ev.startTick, objectId: ev.id });
        return;
      }
      const y = yForZ(staffLayout, note.pitchMap.Z);
      const isFullBar = ev.durationTicks >= measureTicks;
      const hasTuplet = !!ev.tuplet;
      const derived = durationToNoteValue(ev.durationTicks, Math.max(1, config.ticksPerQuarter ?? 480));
      const useDerived = !hasTuplet && (!ev.noteType || ev.noteType === 'custom' || ev.durationTicks >= (config.ticksPerQuarter ?? 480) * 2);
      const effectiveNoteType = isFullBar ? 'whole' : (useDerived ? derived.noteType : ev.noteType);
      const effectiveDots = useDerived ? derived.dots : (ev.dots ?? derived.dots);
      const hollowNotehead = effectiveNoteType === 'whole' || effectiveNoteType === 'half' || effectiveNoteType === 'breve' || effectiveNoteType === 'long';
      const layoutNote: HuntLayoutNote = {
        id: ev.id,
        kind: 'note',
        measureIndex: measure.index,
        staffId,
        voiceId: ev.voiceId,
        startTick: ev.startTick,
        durationTicks: ev.durationTicks,
        tieStart: ev.tieStart,
        tieStop: ev.tieStop,
        x,
        y,
        notehead: { x, y, width: noteheadWidth, height: noteheadHeight },
        pitchMap: note.pitchMap,
        noteType: effectiveNoteType,
        flags: noteTypeToFlagCount(effectiveNoteType),
        noteheadFilled: !hollowNotehead,
        bbox: { x: x - noteheadWidth / 2, y: y - noteheadHeight / 2, width: noteheadWidth, height: noteheadHeight }
      };
      events.push(layoutNote);
      measureEvents.push(layoutNote);
      dotCounts.set(layoutNote.id, effectiveDots);
      const column = tickColumns.get(ev.startTick) || [];
      column.push(layoutNote);
      tickColumns.set(ev.startTick, column);
    });

    // Chord offsets
    tickColumns.forEach((colEvents) => {
      const notes = colEvents.filter((e) => e.kind === 'note') as HuntLayoutNote[];
      if (notes.length > 1) computeChordOffsets(notes);
    });

    // Stem directions per staff
    const staffEvents = measure.events.filter((e) => e.kind === 'note');
    const voiceDirections = assignVoiceDirections(staffEvents);

    // Apply stems, dots, accidentals, ledger lines
    const accidentalState = new Map<string, string>();

    tickColumns.forEach((colEvents) => {
      const notes = colEvents.filter((e) => e.kind === 'note') as HuntLayoutNote[];
      notes.forEach((note) => {
        const staffLayout = staffLayoutById.get(note.staffId);
        if (!staffLayout) return;
        const voiceDir = voiceDirections.get(note.voiceId) || null;
        const direction = voiceDir || (note.pitchMap.Z >= staffLayout.centerLine ? 'down' : 'up');
        computeStem(note, staffLayout, direction, config);
        computeLedgerLines(note, staffLayout, config, staffLedgerBounds.get(note.staffId));
        computeDots(note, staffLayout, config, dotCounts.get(note.id) ?? 0);

        const accPolicy = config.accidentalPolicy ?? 'measure';
        const pitchKey = `${note.staffId}:${note.pitchMap.Z}`;
        const lastAcc = accidentalState.get(pitchKey);
        const showAcc = accPolicy === 'always' || lastAcc !== note.pitchMap.accidental;
        if (showAcc) accidentalState.set(pitchKey, note.pitchMap.accidental);
        computeAccidental(note, showAcc, config);

        // Update bbox
        let minX = note.notehead.x - note.notehead.width / 2;
        let maxX = note.notehead.x + note.notehead.width / 2;
        let minY = note.notehead.y - note.notehead.height / 2;
        let maxY = note.notehead.y + note.notehead.height / 2;
        if (note.accidental) {
          minX = Math.min(minX, note.accidental.x);
          minY = Math.min(minY, note.accidental.y);
          maxY = Math.max(maxY, note.accidental.y + note.accidental.height);
        }
        if (note.dots) {
          note.dots.forEach((dot) => {
            minX = Math.min(minX, dot.x - dot.radius);
            maxX = Math.max(maxX, dot.x + dot.radius);
            minY = Math.min(minY, dot.y - dot.radius);
            maxY = Math.max(maxY, dot.y + dot.radius);
          });
        }
        if (note.stem) {
          minX = Math.min(minX, note.stem.x - 1);
          maxX = Math.max(maxX, note.stem.x + 1);
          minY = Math.min(minY, Math.min(note.stem.y1, note.stem.y2));
          maxY = Math.max(maxY, Math.max(note.stem.y1, note.stem.y2));
        }
        note.bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      });
    });

    // Rest collision avoidance within the same tick (notes + rests)
    tickColumns.forEach((colEvents) => {
      const notes = colEvents.filter((e) => e.kind === 'note') as HuntLayoutNote[];
      const rests = colEvents.filter((e) => e.kind === 'rest') as HuntLayoutRest[];
      if (!rests.length) return;
      const noteBoxes = notes.map((n) => n.bbox);
      const placedRestBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      const sortedRests = rests.sort((a, b) => a.voiceId.localeCompare(b.voiceId) || a.id.localeCompare(b.id));
      sortedRests.forEach((rest) => {
        const staffLayout = staffLayoutById.get(rest.staffId);
        if (!staffLayout) return;
        const step = staffLayout.lineSpacing;
        const candidates = [0, step, -step, step * 2, -step * 2, step * 3, -step * 3];
        let bestOffset = 0;
        let bestOverlap = Infinity;
        for (const offset of candidates) {
          const bbox = { x: rest.x - restGlyphWidth / 2, y: rest.y + offset - restGlyphHeight / 2, width: restGlyphWidth, height: restGlyphHeight };
          let overlapArea = 0;
          for (const box of noteBoxes) {
            if (!overlaps(bbox, box)) continue;
            const ix = Math.min(bbox.x + bbox.width, box.x + box.width) - Math.max(bbox.x, box.x);
            const iy = Math.min(bbox.y + bbox.height, box.y + box.height) - Math.max(bbox.y, box.y);
            overlapArea += Math.max(0, ix) * Math.max(0, iy);
          }
          for (const box of placedRestBoxes) {
            if (!overlaps(bbox, box)) continue;
            const ix = Math.min(bbox.x + bbox.width, box.x + box.width) - Math.max(bbox.x, box.x);
            const iy = Math.min(bbox.y + bbox.height, box.y + box.height) - Math.max(bbox.y, box.y);
            overlapArea += Math.max(0, ix) * Math.max(0, iy);
          }
          if (overlapArea === 0) {
            shiftEvent(rest, 0, offset);
            placedRestBoxes.push({ x: rest.x - restGlyphWidth / 2, y: rest.y - restGlyphHeight / 2, width: restGlyphWidth, height: restGlyphHeight });
            return;
          }
          if (overlapArea < bestOverlap) {
            bestOverlap = overlapArea;
            bestOffset = offset;
          }
        }
        if (bestOffset !== 0) {
          shiftEvent(rest, 0, bestOffset);
        }
        placedRestBoxes.push({ x: rest.x - restGlyphWidth / 2, y: rest.y - restGlyphHeight / 2, width: restGlyphWidth, height: restGlyphHeight });
      });
    });

    // Collision spacing within measure
    const columns = Array.from(tickColumns.entries())
      .map(([tick, colEvents]) => {
        const minX = Math.min(...colEvents.map((ev) => ev.bbox.x));
        const maxX = Math.max(...colEvents.map((ev) => ev.bbox.x + ev.bbox.width));
        const xCenter = colEvents[0]?.x ?? 0;
        return { tick, events: colEvents, minX, maxX, xCenter };
      })
      .sort((a, b) => a.tick - b.tick);

    let shift = 0;
    let prevRight = -Infinity;
    columns.forEach((col) => {
      col.minX += shift;
      col.maxX += shift;
      col.xCenter += shift;
      if (col.minX < prevRight + minNoteSpacing) {
        const delta = prevRight + minNoteSpacing - col.minX;
        shift += delta;
        col.minX += delta;
        col.maxX += delta;
        col.xCenter += delta;
        col.events.forEach((ev) => shiftEvent(ev, delta, 0));
      }
      prevRight = col.maxX;
    });

    // Ensure nothing crosses the left barline and compute final content width
    const boundaryMargin = Math.max(2, noteheadWidth * 0.3);
    let minX = Infinity;
    let maxX = -Infinity;
    measureEvents.forEach((ev) => {
      minX = Math.min(minX, ev.bbox.x);
      maxX = Math.max(maxX, ev.bbox.x + ev.bbox.width);
    });
    if (Number.isFinite(minX) && minX < startX + boundaryMargin) {
      const delta = startX + boundaryMargin - minX;
      measureEvents.forEach((ev) => shiftEvent(ev, delta, 0));
      minX += delta;
      maxX += delta;
      contentStartX += delta;
    }

    const contentEndX = Math.max(contentStartX + contentWidth, maxX);
    contentWidth = Math.max(1, contentEndX - contentStartX);
    width = Math.max(width, contentEndX + rightPad - startX);
    measureLayout.contentStartX = contentStartX;
    measureLayout.contentWidth = contentWidth;
    measureLayout.width = width;

    const tickPositions = Array.from(tickColumns.entries())
      .map(([tick, colEvents]) => ({
        tick,
        x: colEvents.reduce((acc, ev) => acc + ev.x, 0) / Math.max(1, colEvents.length)
      }))
      .sort((a, b) => a.tick - b.tick);
    if (!tickPositions.length || tickPositions[0].tick !== measure.startTick) {
      tickPositions.unshift({ tick: measure.startTick, x: contentStartX });
    }
    if (tickPositions[tickPositions.length - 1]?.tick !== measure.endTick) {
      tickPositions.push({ tick: measure.endTick, x: contentStartX + contentWidth });
    }
    measureLayout.tickPositions = tickPositions;

    // Beam groups per voice
    const notesByVoice = new Map<string, HuntLayoutNote[]>();
    events.forEach((ev) => {
      if (ev.measureIndex !== measure.index) return;
      if (ev.kind !== 'note') return;
      const note = ev as HuntLayoutNote;
      const list = notesByVoice.get(note.voiceId) || [];
      list.push(note);
      notesByVoice.set(note.voiceId, list);
    });

    notesByVoice.forEach((voiceNotes, voiceId) => {
      const staffId = voiceNotes[0]?.staffId;
      const staffLayout = staffId ? staffLayoutById.get(staffId) : null;
      if (!staffLayout) return;
      const voiceDirection = voiceDirections.get(voiceId) || null;
      const beamCandidates = voiceNotes.filter((note) => noteTypeToBeamLevel(note.noteType) > 0);
      if (beamCandidates.length < 2) return;

      measure.beatGrid.allowedGroups.forEach((group) => {
        const inGroup = beamCandidates.filter((note) => note.startTick >= group.start && note.startTick < group.end);
        if (inGroup.length < 2) return;
        const sorted = stableSort(inGroup, (a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id));
        let seq: HuntLayoutNote[] = [];
        for (let i = 0; i < sorted.length; i += 1) {
          const note = sorted[i];
          if (!seq.length) {
            seq = [note];
            continue;
          }
          const prev = seq[seq.length - 1];
          const prevEnd = prev.startTick + prev.durationTicks;
          if (note.startTick > prevEnd + 0.001) {
            if (seq.length >= 2) beams.push(...buildBeamGroups(seq, staffLayout, voiceDirection, config));
            seq = [note];
          } else {
            seq.push(note);
          }
        }
        if (seq.length >= 2) beams.push(...buildBeamGroups(seq, staffLayout, voiceDirection, config));
      });
    });

    const beamedIds = new Set(beams.flatMap((b) => b.noteIds));
    events.forEach((ev) => {
      if (ev.measureIndex !== measure.index) return;
      if (ev.kind !== 'note') return;
      if (beamedIds.has(ev.id)) ev.flags = 0;
    });

    currentX += width + interMeasureGap;
  });

  // Tie curves across measures
  const notesByVoiceId = new Map<string, HuntLayoutNote[]>();
  events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    const list = notesByVoiceId.get(note.voiceId) || [];
    list.push(note);
    notesByVoiceId.set(note.voiceId, list);
  });

  notesByVoiceId.forEach((voiceNotes) => {
    const sorted = stableSort(voiceNotes, (a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id));
    const lookup = new Map<string, HuntLayoutNote>();
    sorted.forEach((note) => {
      lookup.set(`${note.startTick}|${note.pitchMap.Z}|${note.pitchMap.O}`, note);
    });
    sorted.forEach((note) => {
      if (!note.tieStart) return;
      const endTick = note.startTick + note.durationTicks;
      const next = lookup.get(`${endTick}|${note.pitchMap.Z}|${note.pitchMap.O}`);
      if (!next) return;
      const staff = staffLayoutById.get(note.staffId);
      const stemDir =
        note.stem?.direction ||
        (staff ? (note.pitchMap.Z >= staff.centerLine ? 'down' : 'up') : 'up');
      const placeBelow = stemDir === 'up';
      const yOffset = note.notehead.height * 0.9;
      const x1 = note.notehead.x + note.notehead.width / 2;
      const x2 = next.notehead.x - next.notehead.width / 2;
      const y1 = note.notehead.y + (placeBelow ? yOffset : -yOffset);
      const y2 = next.notehead.y + (placeBelow ? yOffset : -yOffset);
      const curveDir = placeBelow ? 1 : -1;
      const curveHeight = Math.max(6, note.notehead.height * 1.4);
      note.tie = {
        x1,
        y1,
        x2,
        y2,
        curveDir,
        curveHeight,
        crossMeasure: note.measureIndex !== next.measureIndex
      };
    });
  });

  const lastStaff = staffLayouts[staffLayouts.length - 1];
  const height = lastStaff ? lastStaff.bottom + 40 : 400;
  const width = Math.max(800, currentX + 40);

  return {
    width,
    height,
    measures,
    events,
    beams,
    staffLayouts
  };
};
