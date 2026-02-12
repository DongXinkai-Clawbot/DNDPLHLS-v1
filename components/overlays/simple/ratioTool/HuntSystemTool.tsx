import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { useStore } from '../../../../store';
import { DEFAULT_HUNT_SETTINGS } from '../../../../constants';
import { HUNT_MAP_GEOMETRY_V1, huntIndexToSlot } from '../../../../domain/hunt/HUNT_MAP';
import { buildHuntEngine, exportHuntSvg } from '../../../../domain/hunt/engine';
import type { HuntEngineConfig } from '../../../../domain/hunt/engine/types';
import { extractMusicXmlFromMxl } from '../../../../domain/musicxml/parseMxl';
import { parseMusicXmlString } from '../../../../domain/musicxml/parseMusicXml';
import { buildScoreDocumentFromMusicXml, type RetunedEventInfo } from '../../../../domain/musicxml/buildScoreDocument';
import { buildTempoMap, secondsToTick, tickToSeconds } from '../../../../domain/musicxml/tempoMap';
import type { MusicXmlImportResult, MusicXmlNoteEvent } from '../../../../domain/musicxml/types';
import { voiceKeyForMusicXmlEvent } from '../../../../domain/musicxml/types';
import { downloadBlob, downloadText } from '../../../../utils/download';
import { FullScreenModal } from '../../../common/FullScreenModal';
import type { ScoreDocument, ScoreEvent } from '../../../../domain/scoreTimeline/types';
import { startFrequency } from '../../../../audioEngine';
import { midiNoteToFrequency, useRafLoop } from './musicXmlRetune/helpers';

type Props = {
  settings?: any;
};

type HuntMappedNote = {
  id: string;
  partId: string;
  partName: string;
  measureIndex: number;
  staff: number;
  voice: string;
  tick: number;
  durationTicks: number;
  endTick: number;
  isRest: boolean;
  pitchLabel: string;
  pitchSource: 'midi' | 'rest' | 'unknown';
  midiNote: number | null;
  freqHz: number | null;
  centsAbs: number | null;
  I: number | null;
  Z: number | null;
  O: number | null;
  tieStart: boolean;
  tieStop: boolean;
  beams?: Array<{ level: number; type: string }>;
};

const STEP_CENTS = 1200 / 205;
const DEFAULT_VOICE_PALETTE = ['#111111', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0f766e', '#be185d'];

const stripCjk = (value: string) => value.replace(/[\u3400-\u9FFF\uF900-\uFAFF]/g, '');

const sanitizeLabel = (value: string) => stripCjk(value).replace(/\s+/g, ' ').trim();

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatAlter = (alter: number) => {
  if (!Number.isFinite(alter) || alter === 0) return '';
  if (alter === 1) return '#';
  if (alter === -1) return 'b';
  if (alter === 2) return '##';
  if (alter === -2) return 'bb';
  const sign = alter > 0 ? '+' : '';
  return `${sign}${alter}`;
};

const buildPitchLabel = (event: MusicXmlNoteEvent) => {
  if (event.isRest) return 'rest';
  if (!event.pitch) return '--';
  const alter = formatAlter(event.pitch.alter || 0);
  return `${event.pitch.step}${alter}${event.pitch.octave}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const REST_GLYPHS = {
  whole: String.fromCodePoint(0x1d13b),
  half: String.fromCodePoint(0x1d13c),
  quarter: String.fromCodePoint(0x1d13d),
  eighth: String.fromCodePoint(0x1d13e),
  sixteenth: String.fromCodePoint(0x1d13f),
  thirtySecond: String.fromCodePoint(0x1d140),
  sixtyFourth: String.fromCodePoint(0x1d141)
};

const ACCIDENTAL_GLYPHS: Record<string, string> = {
  bb: String.fromCodePoint(0x1d12b),
  b: String.fromCodePoint(0x266d),
  n: String.fromCodePoint(0x266e),
  '#': String.fromCodePoint(0x266f),
  x: String.fromCodePoint(0x1d12a)
};

const getAccidentalGlyph = (value?: string) => (value ? ACCIDENTAL_GLYPHS[value] ?? '' : '');

const getRestGlyph = (durationTicks: number, ticksPerQuarter: number) => {
  const q = ticksPerQuarter;
  if (durationTicks >= q * 4) return REST_GLYPHS.whole;
  if (durationTicks >= q * 2) return REST_GLYPHS.half;
  if (durationTicks >= q) return REST_GLYPHS.quarter;
  if (durationTicks >= q / 2) return REST_GLYPHS.eighth;
  if (durationTicks >= q / 4) return REST_GLYPHS.sixteenth;
  if (durationTicks >= q / 8) return REST_GLYPHS.thirtySecond;
  return REST_GLYPHS.sixtyFourth;
};

const getBeamLevel = (durationTicks: number, ticksPerQuarter: number) => {
  const q = ticksPerQuarter;
  if (durationTicks >= q) return 0;
  if (durationTicks >= q / 2) return 1;
  if (durationTicks >= q / 4) return 2;
  if (durationTicks >= q / 8) return 3;
  return 4;
};

const parseBeamType = (value: string | undefined) => {
  const t = (value || '').toLowerCase();
  if (t === 'begin' || t === 'continue' || t === 'end' || t === 'forward' || t === 'backward') return t;
  return null;
};

const buildStaffSvg = (
  rows: HuntMappedNote[],
  options: {
    title?: string;
    ticksPerQuarter: number;
    totalTicks: number;
    measureStartTicks: number[];
    timeSignatures: Array<{ tick: number; numerator: number; denominator: number }>;
    staffZoom?: number;
    staffDisplay?: typeof DEFAULT_HUNT_SETTINGS.staffDisplay;
    debugEnabled?: boolean;
  }
) => {
  if (!rows.length) {
    return { svg: '', width: 0, height: 0 };
  }

  const map = HUNT_MAP_GEOMETRY_V1;
  const staffZoom = Math.max(0.5, options.staffZoom ?? 1);
  const staffDisplay = options.staffDisplay ?? DEFAULT_HUNT_SETTINGS.staffDisplay;
  const baseVu = staffDisplay.slotStepPx || 8;
  const vu = baseVu * staffZoom;
  const standardLine = Math.max(0.8, vu * 0.12);
  const regionLineWidth = standardLine * 2.4;
  const staffBoldWidth = standardLine * 1.5;
  const microLineWidth = Math.max(0.4, staffDisplay.microLineThickness || standardLine * 0.5);
  const showMicroLines =
    staffDisplay.microLineMode === 'on' ||
    (staffDisplay.microLineMode === 'auto' && staffZoom >= (staffDisplay.microLineVisibleZoomThreshold || 1.6));
  const showStaffLines = staffDisplay.showStaffLines !== false;
  const showRegionLines = staffDisplay.showRegionLines !== false;
  const showLedgerLines = staffDisplay.showLedgerLines !== false;
  const showSlotLabels = staffDisplay.showSlotLabels || 'off';
  const labelMode = staffDisplay.labelMode || 'brief';
  const labelFontSize = staffDisplay.labelFontSize || 9;
  const labelColor = staffDisplay.labelColor || '#111111';
  const titleHeight = options.title ? 24 : 0;
  const paddingTop = 18 + titleHeight;
  const paddingBottom = Math.max(32, vu * 3);
  const gutterWidth = 80;
  const clefScale = Number.isFinite(staffDisplay.clefScale) ? staffDisplay.clefScale : 1.55;
  const clefSize = Math.max(36, vu * 9) * clefScale;
  const clefWidth = clefSize * 0.8;
  const paddingLeft = gutterWidth + clefWidth;
  const paddingRight = 24;

  const noteRows = rows.filter((row) => !row.isRest && Number.isFinite(row.Z) && Number.isFinite(row.tick));
  if (!noteRows.length) {
    return { svg: '', width: 0, height: 0 };
  }

  const mappedNotes = noteRows.map((row) => {
    const I = row.I ?? 0;
    const { Z, O, slot } = huntIndexToSlot(I, map);
    const globalYIndex = Z;
    return { row, I, Z, O, slot, globalYIndex };
  });
  const voiceSet = new Set(mappedNotes.map((note) => note.row.voice || '1'));
  const useVoiceBasedStems = voiceSet.size > 1;

  type StaffName = 'treble' | 'bass';

  const assignStaff = (row: HuntMappedNote, globalYIndex: number): StaffName => {
    if (row.staff >= 2) return 'bass';
    if (row.staff === 1) return 'treble';
    if (Number.isFinite(row.midiNote)) return (row.midiNote as number) < 60 ? 'bass' : 'treble';
    return globalYIndex < 0 ? 'bass' : 'treble';
  };

  const notesWithStaff = mappedNotes.map((note) => ({
    ...note,
    staff: assignStaff(note.row, note.globalYIndex)
  }));

  const notesByStaff: Record<StaffName, typeof notesWithStaff> = { treble: [], bass: [] };
  notesWithStaff.forEach((note) => {
    notesByStaff[note.staff].push(note);
  });

  const getZInOct = (z: number) =>
    ((z % map.positionsPerOctave) + map.positionsPerOctave) % map.positionsPerOctave;
  const isLineZ = (z: number) => getZInOct(z) % 2 === 0;
  const nearestLineZ = (z: number) => (isLineZ(z) ? z : z + 1);

  const buildStaffRange = (notes: typeof notesWithStaff) => {
    const yIndices = notes.map((note) => note.globalYIndex);
    const hasNotes = yIndices.length > 0;
    const minIndex = hasNotes ? Math.min(...yIndices) : 0;
    const maxIndex = hasNotes ? Math.max(...yIndices) : 0;
    const centerIndex = hasNotes ? Math.round((minIndex + maxIndex) / 2) : 0;
    const centerLine = nearestLineZ(centerIndex);
    const halfLines = Math.floor((staffDisplay.staffLineCount || 25) / 2);
    const minLine = centerLine - halfLines * 2;
    const maxLine = centerLine + halfLines * 2;
    const minVisible = Number.isFinite(staffDisplay.visibleZMin) ? (staffDisplay.visibleZMin as number) : minLine;
    const maxVisible = Number.isFinite(staffDisplay.visibleZMax) ? (staffDisplay.visibleZMax as number) : maxLine;
    const minDraw = hasNotes ? Math.min(minVisible, minIndex) : minVisible;
    const maxDraw = hasNotes ? Math.max(maxVisible, maxIndex) : maxVisible;
    const rangeIndex = Math.max(4, maxDraw - minDraw);
    return {
      minVisible,
      maxVisible,
      minDraw,
      maxDraw,
      rangeIndex
    };
  };

  const trebleRange = buildStaffRange(notesByStaff.treble);
  const bassRange = buildStaffRange(notesByStaff.bass);
  const slotSpacing = Math.max(1, Math.round(vu * 2) / 2);
  const trebleHeight = trebleRange.rangeIndex * slotSpacing;
  const bassHeight = bassRange.rangeIndex * slotSpacing;
  const staffGap = slotSpacing * 8;

  const trebleTop = paddingTop;
  const bassTop = trebleTop + trebleHeight + staffGap;
  const height = paddingTop + trebleHeight + staffGap + bassHeight + paddingBottom;

  const ticksPerQuarter = Math.max(1, options.ticksPerQuarter || 480);
  const totalTicks = Math.max(1, options.totalTicks || 1);
  const basePxPerQuarter = 12 * staffZoom;
  const measureStarts = options.measureStartTicks.length ? [...options.measureStartTicks] : [0];
  measureStarts.sort((a, b) => a - b);
  if (measureStarts[0] !== 0) measureStarts.unshift(0);
  const measureInfos = measureStarts.map((start, idx) => {
    const end = idx + 1 < measureStarts.length ? measureStarts[idx + 1] : totalTicks;
    const ticks = Math.max(1, end - start);
    const rowsInMeasure = rows.filter((row) => row.tick >= start && row.tick < end && !row.isRest);
    const minDur = rowsInMeasure.reduce((acc, row) => Math.min(acc, row.durationTicks || ticksPerQuarter), ticksPerQuarter);
    const shortness = Math.max(0, ticksPerQuarter / Math.max(1, minDur) - 1);
    const density = rowsInMeasure.length / Math.max(1, ticks / ticksPerQuarter);
    const beamDensity = rowsInMeasure.filter((row) => (getBeamLevel(row.durationTicks || ticksPerQuarter, ticksPerQuarter) > 0)).length;
    const beamFactor = beamDensity > 0 ? Math.min(1, beamDensity / Math.max(1, rowsInMeasure.length)) : 0;
    const scale = clamp(1 + shortness * 0.35 + density * 0.08 + beamFactor * 0.25, 1, 2.4);
    const width = (ticks / ticksPerQuarter) * basePxPerQuarter * scale;
    return { start, end, ticks, scale, width };
  });
  const width = Math.max(
    600,
    paddingLeft + paddingRight + measureInfos.reduce((acc, m) => acc + m.width, 0)
  );

  const staffLayout: Record<StaffName, { top: number; height: number } & ReturnType<typeof buildStaffRange>> = {
    treble: { ...trebleRange, top: trebleTop, height: trebleHeight },
    bass: { ...bassRange, top: bassTop, height: bassHeight }
  };

  const yForIndex = (staff: StaffName, index: number) =>
    staffLayout[staff].top + (staffLayout[staff].maxDraw - index) * slotSpacing;

  const barPadding = Math.max(noteWidth + noteRx, vu * 1.8);
  const xForTick = (tick: number) => {
    const t = Math.max(0, Math.min(totalTicks, tick));
    const idx = measureInfos.findIndex((m) => t >= m.start && t < m.end);
    if (idx < 0) {
      return paddingLeft;
    }
    const measure = measureInfos[idx];
    const prevWidth = measureInfos.slice(0, idx).reduce((acc, m) => acc + m.width, 0);
    const local = (t - measure.start) / measure.ticks;
    const usableWidth = Math.max(4, measure.width - barPadding * 2);
    return paddingLeft + prevWidth + barPadding + local * usableWidth;
  };

  const lines: string[] = [];
  const staffLines: string[] = [];
  const regionLines: string[] = [];
  const microLines: string[] = [];
  const gutterLabels: string[] = [];
  const clefLines: string[] = [];
  const measureLines: string[] = [];
  const ledgerLines: string[] = [];
  const beamLines: string[] = [];
  const stemLines: string[] = [];
  const flagLines: string[] = [];
  const headLines: string[] = [];
  const accidentalLines: string[] = [];
  const restLines: string[] = [];
  const tieLines: string[] = [];

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  lines.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

  let titleY = 18;
  if (options.title) {
    lines.push(
      `<text x="${paddingLeft}" y="${titleY}" font-family="ui-sans-serif, system-ui" font-size="14" fill="#111827">${escapeXml(
        options.title
      )}</text>`
    );
    titleY += titleHeight;
  }

  if (options.debugEnabled && showSlotLabels === 'debug' && labelMode === 'full') {
    const labelX = paddingLeft;
    const labelY = titleY + 8;
    lines.push(
      `<text x="${labelX}" y="${labelY}" font-family="ui-sans-serif, system-ui" font-size="10" fill="#374151">Lines by Number</text>`
    );
    lines.push(
      `<text x="${labelX + 120}" y="${labelY}" font-family="ui-sans-serif, system-ui" font-size="10" fill="#6b7280">Spaces by Number</text>`
    );
    titleY += 12;
  }

  const regionLabelX = 24;
  const yLabelX = 56;
  const regionFontSize = Math.max(14, vu * 1.4);
  const yLabelFontSize = Math.max(9, vu * 0.9);
  const fallbackRegionLines = [0, 5, 10, 15, 20, 25, 30, 35];
  const regionLineZIndices = (staffDisplay.regionLineZIndices || []).length
    ? staffDisplay.regionLineZIndices
    : fallbackRegionLines;
  const regionLineSet = (() => {
    if (staffDisplay.regionLineCount && staffDisplay.regionLineCount > 0 && regionLineZIndices.length !== staffDisplay.regionLineCount) {
      const step = Math.floor(map.positionsPerOctave / staffDisplay.regionLineCount);
      const indices: number[] = [];
      for (let i = 0; i < staffDisplay.regionLineCount; i += 1) {
        indices.push((i * step) % map.positionsPerOctave);
      }
      return indices;
    }
    return regionLineZIndices;
  })();

  const getSlotLabel = (zInOct: number, kind: 'line' | 'space') => {
    const x = Math.floor(zInOct / 10) + 1;
    const rem = zInOct % 10;
    const y = Math.floor(rem / 2);
    const z = rem % 2;
    const triple = `${x}.${y}.${z}`;
    if (labelMode === 'none') return null;
    if (labelMode === 'brief') return { title: '', body: triple, kind };
    return { title: kind, body: triple, kind };
  };

  (['treble', 'bass'] as StaffName[]).forEach((staff) => {
    const { minVisible, maxVisible } = staffLayout[staff];
    const minIndex = Math.floor(minVisible);
    const maxIndex = Math.ceil(maxVisible);

    const minOct = Math.floor(minIndex / map.positionsPerOctave);
    const maxOct = Math.floor(maxIndex / map.positionsPerOctave);
    for (let oct = minOct; oct <= maxOct; oct += 1) {
      const regionNumber = oct + 1;
      const centerIndex = oct * map.positionsPerOctave + map.positionsPerOctave / 2;
      const y = yForIndex(staff, centerIndex);
      gutterLabels.push(
        `<text x="${regionLabelX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui" font-size="${regionFontSize}" fill="#111111" font-weight="700">${regionNumber}</text>`
      );
    }

    let lineCounter = 0;
    for (let idx = minIndex; idx <= maxIndex; idx += 1) {
      const zInOct = ((idx % map.positionsPerOctave) + map.positionsPerOctave) % map.positionsPerOctave;
      const slot = map.slots[zInOct];
      const y = yForIndex(staff, idx);

      if (slot.kind === 'line') {
        lineCounter += 1;
        if (showStaffLines) {
          const isMain = staffDisplay.staffMainLineEvery > 0 && (lineCounter - 1) % staffDisplay.staffMainLineEvery === 0;
          staffLines.push(
            `<line x1="${paddingLeft}" x2="${width - paddingRight}" y1="${y}" y2="${y}" stroke="#000000" stroke-width="${isMain ? staffBoldWidth : standardLine}"/>`
          );
        }
        if (showRegionLines && regionLineSet.includes(zInOct)) {
          regionLines.push(
            `<line x1="${paddingLeft}" x2="${width - paddingRight}" y1="${y}" y2="${y}" stroke="#111111" stroke-width="${regionLineWidth}"/>`
          );
        }
      }

      const shouldLabel =
        (showSlotLabels === 'debug' && options.debugEnabled && labelMode !== 'none') ||
        (showSlotLabels === 'hover' && labelMode !== 'none');
      if (shouldLabel) {
        const label = getSlotLabel(zInOct, slot.kind);
        if (label) {
          const labelFill = slot.kind === 'line' ? labelColor : '#555555';
          const opacity = showSlotLabels === 'hover' ? 0 : 1;
          const title = `${label.kind} ${label.body}`;
          const titleSpan = label.title
            ? `<tspan x="${yLabelX}" dy="-${labelFontSize * 0.4}">${label.title}</tspan>`
            : '';
          const bodyDy = label.title ? labelFontSize * 1.1 : 0;
          gutterLabels.push(
            `<text x="${yLabelX}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui" font-size="${labelFontSize}" fill="${labelFill}" opacity="${opacity}">
              <title>${escapeXml(title)}</title>
              ${titleSpan}
              <tspan x="${yLabelX}" dy="${bodyDy}">${label.body}</tspan>
            </text>`
          );
        }
      }
    }

    if (showMicroLines && staffDisplay.microLineCount > 0) {
      const microCount = staffDisplay.microLineCount;
      const microSpanStart = paddingLeft + (width - paddingLeft - paddingRight) * 0.2;
      const microSpanEnd = paddingLeft + (width - paddingLeft - paddingRight) * 0.8;
      const microRange = Math.max(1, maxIndex - minIndex);
      for (let i = 0; i < microCount; i += 1) {
        const idx = minIndex + Math.round(((i + 1) * microRange) / (microCount + 1));
        const y = yForIndex(staff, idx);
        microLines.push(
          `<line x1="${microSpanStart}" x2="${microSpanEnd}" y1="${y}" y2="${y}" stroke="#9aa0a6" stroke-width="${microLineWidth}" stroke-opacity="${staffDisplay.microLineOpacity}"/>`
        );
      }
    }
  });

  const trebleClef = String.fromCodePoint(0x1d11e);
  const bassClef = String.fromCodePoint(0x1d122);
  const clefX = gutterWidth + clefWidth * 0.5;
  const clefFont = "Bravura, 'Noto Music', 'Segoe UI Symbol', serif";
  const trebleCenter = (staffLayout.treble.minVisible + staffLayout.treble.maxVisible) / 2;
  const bassCenter = (staffLayout.bass.minVisible + staffLayout.bass.maxVisible) / 2;
  const trebleOffset = Number.isFinite(staffDisplay.clefOffsetLinesTreble) ? staffDisplay.clefOffsetLinesTreble : 0;
  const bassOffset = Number.isFinite(staffDisplay.clefOffsetLinesBass) ? staffDisplay.clefOffsetLinesBass : 0;
  const trebleAnchor = nearestLineZ(trebleCenter + trebleOffset * 2);
  const bassAnchor = nearestLineZ(bassCenter + bassOffset * 2);
  clefLines.push(
    `<text x="${clefX}" y="${yForIndex('treble', trebleAnchor)}" text-anchor="middle" dominant-baseline="middle" font-family="${clefFont}" font-size="${clefSize}" fill="#000000">${escapeXml(
      trebleClef
    )}</text>`
  );
  clefLines.push(
    `<text x="${clefX}" y="${yForIndex('bass', bassAnchor)}" text-anchor="middle" dominant-baseline="middle" font-family="${clefFont}" font-size="${clefSize}" fill="#000000">${escapeXml(
      bassClef
    )}</text>`
  );

  options.measureStartTicks.forEach((tick) => {
    if (!Number.isFinite(tick)) return;
    const x = xForTick(tick);
    measureLines.push(
      `<line x1="${x}" x2="${x}" y1="${trebleTop}" y2="${bassTop + bassHeight}" stroke="#000000" stroke-width="1.2"/>`
    );
  });

  const noteRx = Math.max(vu * 0.75, 4);
  const noteRy = Math.max(vu * 0.5, 3);
  const noteWidth = noteRx * 2;
  const accidentalOffset = noteRx * 2.2;
  const stemLength = Math.max(slotSpacing * 7, vu * 3.5, 18);
  const flagSpacing = Math.max(3, vu * 0.4);

  type NoteLayout = {
    row: HuntMappedNote;
    x: number;
    y: number;
    staff: StaffName;
    globalYIndex: number;
    voiceNum: number;
    beamLevel: number;
    isWhole: boolean;
    stemUp: boolean;
    stemX: number;
    stemY1: number;
    stemY2: number;
  };

  const noteLayout = new Map<string, NoteLayout>();
  const quarterTicks = Math.max(1, ticksPerQuarter);
  const collisionGroups = new Map<string, NoteLayout[]>();

  notesWithStaff.forEach((note) => {
    const { row, O, globalYIndex, staff } = note;
    const voiceNumRaw = parseInt(row.voice, 10);
    const voiceNum = Number.isFinite(voiceNumRaw) ? Math.max(1, voiceNumRaw) : 1;
    const voiceOffset = clamp((voiceNum - 1) * (vu * 0.5), -vu, vu);
    const x = xForTick(row.tick) + voiceOffset;
    const y = yForIndex(staff, globalYIndex);
    const durationTicks = Math.max(0, row.durationTicks || 0);
    const isWhole = durationTicks >= quarterTicks * 4;
    const beamLevel = getBeamLevel(durationTicks, quarterTicks);
    const layout: NoteLayout = {
      row,
      x,
      y,
      staff,
      globalYIndex,
      voiceNum,
      beamLevel,
      isWhole,
      stemUp: true,
      stemX: x,
      stemY1: y,
      stemY2: y
    };
    noteLayout.set(row.id, layout);
    const key = `${staff}:${row.tick}`;
    const group = collisionGroups.get(key) || [];
    group.push(layout);
    collisionGroups.set(key, group);
  });

  collisionGroups.forEach((group) => {
    if (group.length < 2) return;
    group.sort((a, b) => a.globalYIndex - b.globalYIndex);
    for (let i = 1; i < group.length; i += 1) {
      const dy = Math.abs(group[i].globalYIndex - group[i - 1].globalYIndex);
      if (dy < 2) {
        const lower = group[i - 1];
        const upper = group[i];
        lower.x -= noteRx * 0.7;
        upper.x += noteRx * 0.7;
      }
    }
  });

  const staffMiddleLineIndex = (staff: StaffName) => {
    const staffInfo = staffLayout[staff];
    return nearestLineZ((staffInfo.minVisible + staffInfo.maxVisible) / 2);
  };

  const computeStem = (layout: NoteLayout, stemUp: boolean) => {
    const middleLine = staffMiddleLineIndex(layout.staff);
    const middleY = yForIndex(layout.staff, middleLine);
    const stemX = stemUp ? layout.x + noteRx : layout.x - noteRx;
    const stemY1 = layout.y;
    let stemY2 = stemUp ? layout.y - stemLength : layout.y + stemLength;
    if (stemUp) {
      if (stemY2 > middleY) stemY2 = middleY;
    } else {
      if (stemY2 < middleY) stemY2 = middleY;
    }
    return { stemUp, stemX, stemY1, stemY2 };
  };

  const dottedCandidates = [
    { ticks: quarterTicks * 4 },
    { ticks: quarterTicks * 2 },
    { ticks: quarterTicks },
    { ticks: quarterTicks / 2 },
    { ticks: quarterTicks / 4 },
    { ticks: quarterTicks / 8 }
  ];

  const isDotted = (durationTicks: number) => {
    for (const cand of dottedCandidates) {
      const base = cand.ticks;
      if (!Number.isFinite(base) || base <= 0) continue;
      const dotted = base * 1.5;
      if (Math.abs(durationTicks - dotted) <= 0.5) return true;
    }
    return false;
  };

  noteLayout.forEach((layout) => {
    const { row, staff, globalYIndex, voiceNum } = layout;
    const acc = getAccidentalGlyph(map.inflections[row.O ?? 2]?.glyph);
    if (acc) {
      accidentalLines.push(
        `<text x="${layout.x - accidentalOffset}" y="${layout.y}" text-anchor="end" dominant-baseline="middle" font-family="${clefFont}" font-size="${Math.max(
          10,
          vu * 1.2
        )}" fill="#111111">${escapeXml(acc)}</text>`
      );
    }

    headLines.push(
      `<ellipse cx="${layout.x}" cy="${layout.y}" rx="${noteRx}" ry="${noteRy}" fill="#000000" stroke="#000000" stroke-width="${Math.max(
        0.8,
        standardLine
      )}"/>`
    );

    const middleLine = staffMiddleLineIndex(staff);
    let stemUp = true;
    if (useVoiceBasedStems) {
      stemUp = voiceNum === 1;
    } else if (globalYIndex > middleLine) {
      stemUp = false;
    } else if (globalYIndex < middleLine) {
      stemUp = true;
    } else {
      stemUp = false;
    }
    const stem = computeStem(layout, stemUp);

    noteLayout.set(row.id, {
      ...layout,
      ...stem
    });

    if (isDotted(row.durationTicks)) {
      const dotOffset = noteRx * 1.6;
      const dotX = layout.x + dotOffset;
      const zInOct = getZInOct(globalYIndex);
      const dotY = isLineZ(zInOct) ? layout.y - slotSpacing : layout.y;
      headLines.push(
        `<circle cx="${dotX}" cy="${dotY}" r="${Math.max(1.2, noteRy * 0.25)}" fill="#000000"/>`
      );
    }
  });

  // Ledger lines for notes outside visible staff range.
  notesWithStaff.forEach((note) => {
    const layout = noteLayout.get(note.row.id);
    if (!layout) return;
    const staff = note.staff;
    const staffInfo = staffLayout[staff];
    const index = note.globalYIndex;
    if (!showLedgerLines) return;
    if (index >= staffInfo.minVisible && index <= staffInfo.maxVisible) return;
    const ledgerLen = noteRx * Math.max(1.6, Math.min(2.4, staffDisplay.ledgerLengthFactor || 2.0));
    const direction = index < staffInfo.minVisible ? -1 : 1;
    let cursor = direction < 0 ? staffInfo.minVisible - 1 : staffInfo.maxVisible + 1;
    let count = 0;
    while ((direction < 0 && cursor >= index) || (direction > 0 && cursor <= index)) {
      const zInOct = ((cursor % map.positionsPerOctave) + map.positionsPerOctave) % map.positionsPerOctave;
      const slot = map.slots[zInOct];
      if (slot.kind === 'line') {
        const y = yForIndex(staff, cursor);
        const distanceSteps = Math.abs(cursor - (direction < 0 ? staffInfo.minVisible : staffInfo.maxVisible));
        const fade = Math.max(
          staffDisplay.ledgerMinOpacity || 0.25,
          1 - distanceSteps * (staffDisplay.ledgerFadeK || 0.08)
        );
        ledgerLines.push(
          `<line x1="${layout.x - ledgerLen / 2}" x2="${layout.x + ledgerLen / 2}" y1="${y}" y2="${y}" stroke="#000000" stroke-width="${Math.max(
            1,
            standardLine
          )}" stroke-opacity="${fade.toFixed(2)}"/>`
        );
        count += 1;
        if (staffDisplay.ledgerMaxCount && count >= staffDisplay.ledgerMaxCount) break;
      }
      cursor += direction;
    }
  });

  // Rests (draw after staff, before ties).
  rows
    .filter((row) => row.isRest)
    .forEach((row) => {
      const restGlyph = getRestGlyph(row.durationTicks, ticksPerQuarter);
      const voiceNumRaw = parseInt(row.voice, 10);
      const voiceNum = Number.isFinite(voiceNumRaw) ? Math.max(1, voiceNumRaw) : 1;
      const voiceOffset = clamp((voiceNum - 1) * (vu * 0.5), -vu, vu);
      const staff: StaffName = row.staff >= 2 ? 'bass' : 'treble';
      const staffInfo = staffLayout[staff];
      const restX = xForTick(row.tick) + voiceOffset;
      const restY = yForIndex(staff, Math.round((staffInfo.minVisible + staffInfo.maxVisible) / 2));
      restLines.push(
        `<text x="${restX}" y="${restY}" text-anchor="middle" dominant-baseline="middle" font-family="${clefFont}" font-size="${Math.max(
          12,
          vu * 1.4
        ) * 1.75}" fill="#000000">${escapeXml(restGlyph)}</text>`
      );
    });

  measureStarts.sort((a, b) => a - b);
  const timeSigs = [...options.timeSignatures].sort((a, b) => a.tick - b.tick);
  const defaultTimeSig = { tick: 0, numerator: 4, denominator: 4 };

  const getTimeSigForTick = (tick: number) => {
    let current = defaultTimeSig;
    for (let i = 0; i < timeSigs.length; i += 1) {
      if (timeSigs[i].tick <= tick) {
        current = timeSigs[i];
      } else {
        break;
      }
    }
    return current;
  };

  const buildBeatGroups = (startTick: number, endTick: number) => {
    const ts = getTimeSigForTick(startTick);
    const numerator = Math.max(1, ts.numerator || 4);
    const denominator = Math.max(1, ts.denominator || 4);
    const ticksPerBeat = ticksPerQuarter * 4 / denominator;
    const eighthTicks = ticksPerQuarter / 2;

    let groupSizes: number[] = [];
    let unitTicks = ticksPerBeat;
    if (denominator === 8 && (numerator === 6 || numerator === 9 || numerator === 12)) {
      groupSizes = new Array(numerator / 3).fill(3);
      unitTicks = eighthTicks;
    } else if (denominator === 8 && numerator === 5) {
      groupSizes = [3, 2];
      unitTicks = eighthTicks;
    } else if (denominator === 8 && numerator === 7) {
      groupSizes = [3, 2, 2];
      unitTicks = eighthTicks;
    } else if (denominator === 8 && numerator === 11) {
      groupSizes = [3, 3, 3, 2];
      unitTicks = eighthTicks;
    } else if (numerator === 4) {
      groupSizes = [2, 2];
      unitTicks = ticksPerBeat;
    } else if (numerator === 2 || numerator === 3) {
      groupSizes = new Array(numerator).fill(1);
      unitTicks = ticksPerBeat;
    } else {
      groupSizes = new Array(numerator).fill(1);
      unitTicks = ticksPerBeat;
    }

    const groups: Array<{ start: number; end: number }> = [];
    let cursor = startTick;
    let idx = 0;
    while (cursor < endTick - 0.1) {
      const size = groupSizes[idx % groupSizes.length];
      const next = Math.min(endTick, cursor + size * unitTicks);
      groups.push({ start: cursor, end: next });
      cursor = next;
      idx += 1;
    }
    return groups;
  };

  const rowsByVoice = new Map<string, HuntMappedNote[]>();
  rows.forEach((row) => {
    const key = `${row.partId}:${row.staff}:${row.voice || '1'}`;
    const list = rowsByVoice.get(key) || [];
    list.push(row);
    rowsByVoice.set(key, list);
  });

  const beamedLevels = new Map<string, number>();

  const decideStemUpForRun = (noteIds: string[]) => {
    const layouts = noteIds.map((id) => noteLayout.get(id)).filter(Boolean) as NoteLayout[];
    if (!layouts.length) return true;
    if (useVoiceBasedStems) {
      return layouts[0].voiceNum === 1;
    }
    const staff = layouts[0].staff;
    const middleLine = staffMiddleLineIndex(staff);
    let farthest = layouts[0];
    let farthestDist = Math.abs(farthest.globalYIndex - middleLine);
    layouts.forEach((layout) => {
      const dist = Math.abs(layout.globalYIndex - middleLine);
      if (dist > farthestDist) {
        farthest = layout;
        farthestDist = dist;
      }
    });
    if (farthest.globalYIndex > middleLine) return false;
    if (farthest.globalYIndex < middleLine) return true;
    return false;
  };

  const drawBeamRun = (noteIds: string[], level: number) => {
    if (noteIds.length < 2) return;
    const layouts = noteIds.map((id) => noteLayout.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof noteLayout.get>>[];
    if (layouts.length < 2) return;
    const runStemUp = decideStemUpForRun(noteIds);
    layouts.forEach((layout) => {
      const stem = computeStem(layout, runStemUp);
      noteLayout.set(layout.row.id, { ...layout, ...stem });
    });
    const updated = noteIds.map((id) => noteLayout.get(id)).filter(Boolean) as NoteLayout[];
    const x1 = updated[0].stemX;
    const x2 = updated[updated.length - 1].stemX;
    const beamThickness = Math.max(2, vu * 0.35);
    const beamGap = Math.max(3, vu * 0.5);
    const baseY = runStemUp ? Math.min(...updated.map((l) => l.stemY2)) : Math.max(...updated.map((l) => l.stemY2));
    const levelOffset = (level - 1) * (beamThickness + beamGap);
    const startStemY = updated[0].stemY2;
    const endStemY = updated[updated.length - 1].stemY2;
    const maxSlope = slotSpacing * 0.6;
    const rawSlope = endStemY - startStemY;
    const slope = Math.max(-maxSlope, Math.min(maxSlope, rawSlope));
    const y1 = runStemUp ? baseY - beamThickness - levelOffset : baseY + levelOffset;
    const y2 = y1 + slope;
    const y1b = y1 + beamThickness;
    const y2b = y2 + beamThickness;
    beamLines.push(
      `<polygon points="${x1},${y1} ${x2},${y2} ${x2},${y2b} ${x1},${y1b}" fill="#000000"/>`
    );
    noteIds.forEach((id) => {
      const current = beamedLevels.get(id) || 0;
      if (level > current) {
        beamedLevels.set(id, level);
      }
    });
  };

  const drawBeamRunsForLevel = (sequence: string[], level: number) => {
    let run: string[] = [];
    sequence.forEach((id) => {
      const beamLevel = noteLayout.get(id)?.beamLevel ?? 0;
      if (beamLevel >= level) {
        run.push(id);
      } else {
        if (run.length >= 2) {
          drawBeamRun(run, level);
        }
        run = [];
      }
    });
    if (run.length >= 2) {
      drawBeamRun(run, level);
    }
  };

  rowsByVoice.forEach((voiceRows) => {
    voiceRows.sort((a, b) => a.tick - b.tick);
    const hasExplicitBeams = voiceRows.some((row) => row.beams && row.beams.length > 0);

    for (let m = 0; m < measureStarts.length; m += 1) {
      const measureStart = measureStarts[m];
      const measureEnd = m + 1 < measureStarts.length ? measureStarts[m + 1] : options.totalTicks;
      const rowsInMeasure = voiceRows.filter((row) => row.tick >= measureStart && row.tick < measureEnd);
      if (!rowsInMeasure.length) continue;

      if (hasExplicitBeams) {
        const maxLevel = 4;
        for (let level = 1; level <= maxLevel; level += 1) {
          let current: string[] = [];
          rowsInMeasure.forEach((row) => {
            const layout = noteLayout.get(row.id);
            if (!layout) {
              if (current.length) {
                drawBeamRun(current, level);
                current = [];
              }
              return;
            }
            const beamInfo = row.beams?.find((b) => b.level === level);
            const beamType = parseBeamType(beamInfo?.type);
            if (!beamType) {
              if (current.length) {
                drawBeamRun(current, level);
                current = [];
              }
              return;
            }
            if (beamType === 'begin') {
              if (current.length) {
                drawBeamRun(current, level);
              }
              current = [row.id];
            } else if (beamType === 'continue' || beamType === 'forward' || beamType === 'backward') {
              if (!current.length) current = [row.id];
              else current.push(row.id);
            } else if (beamType === 'end') {
              if (!current.length) current = [row.id];
              else current.push(row.id);
              drawBeamRun(current, level);
              current = [];
            }
          });
          if (current.length) {
            drawBeamRun(current, level);
          }
        }
        continue;
      }

      const beatGroups = buildBeatGroups(measureStart, measureEnd);
      beatGroups.forEach((group) => {
        const groupRows = rowsInMeasure.filter((row) => row.tick >= group.start && row.tick < group.end);
        let sequence: string[] = [];
        groupRows.forEach((row) => {
          const layout = noteLayout.get(row.id);
          if (!layout || row.isRest || layout.beamLevel === 0 || row.endTick > group.end) {
            if (sequence.length) {
              const maxLevel = Math.max(...sequence.map((id) => noteLayout.get(id)?.beamLevel ?? 0));
              for (let level = 1; level <= maxLevel; level += 1) {
                drawBeamRunsForLevel(sequence, level);
              }
              sequence = [];
            }
            return;
          }
          sequence.push(row.id);
        });
        if (sequence.length) {
          const maxLevel = Math.max(...sequence.map((id) => noteLayout.get(id)?.beamLevel ?? 0));
          for (let level = 1; level <= maxLevel; level += 1) {
            drawBeamRunsForLevel(sequence, level);
          }
        }
      });
    }
  });

  // Draw stems after beam directions are resolved.
  noteLayout.forEach((layout) => {
    if (layout.isWhole) return;
    stemLines.push(
      `<line x1="${layout.stemX}" x2="${layout.stemX}" y1="${layout.stemY1}" y2="${layout.stemY2}" stroke="#000000" stroke-width="${Math.max(
        1,
        standardLine
      )}"/>`
    );
  });

  // Flags for notes not beamed.
  noteLayout.forEach((layout, id) => {
    if (layout.isWhole) return;
    const usedLevel = beamedLevels.get(id) || 0;
    if (usedLevel > 0) return;
    const flagCount = Math.max(0, layout.beamLevel);
    if (flagCount <= 0) return;
    for (let i = 0; i < flagCount; i += 1) {
      const offset = i * flagSpacing;
      if (layout.stemUp) {
        const yStart = layout.stemY2 + offset;
        flagLines.push(
          `<line x1="${layout.stemX}" x2="${layout.stemX + 6}" y1="${yStart}" y2="${yStart - 3}" stroke="#000000" stroke-width="1.2" stroke-linecap="round"/>`
        );
      } else {
        const yStart = layout.stemY2 - offset;
        flagLines.push(
          `<line x1="${layout.stemX}" x2="${layout.stemX + 6}" y1="${yStart}" y2="${yStart + 3}" stroke="#000000" stroke-width="1.2" stroke-linecap="round"/>`
        );
      }
    }
  });

  // Ties
  const notesByVoicePitch = new Map<string, HuntMappedNote[]>();
  rows
    .filter((row) => !row.isRest)
    .forEach((row) => {
      const key = `${row.partId}:${row.staff}:${row.voice}:${row.pitchLabel}`;
      const list = notesByVoicePitch.get(key) || [];
      list.push(row);
      notesByVoicePitch.set(key, list);
    });

  notesByVoicePitch.forEach((list) => {
    list.sort((a, b) => a.tick - b.tick);
    list.forEach((row, idx) => {
      if (!row.tieStart) return;
      const next = list.slice(idx + 1).find((n) => n.tieStop);
      if (!next) return;
      const startLayout = noteLayout.get(row.id);
      const endLayout = noteLayout.get(next.id);
      if (!startLayout || !endLayout) return;
      const yOffset = startLayout.stemUp ? 10 : -10;
      const x1 = startLayout.x + (startLayout.stemUp ? noteRx : -noteRx);
      const x2 = endLayout.x + (endLayout.stemUp ? noteRx : -noteRx);
      const y1 = startLayout.y + yOffset;
      const y2 = endLayout.y + yOffset;
      const cx = (x1 + x2) / 2;
      const cy = y1 + (startLayout.stemUp ? 6 : -6);
      tieLines.push(
        `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" fill="none" stroke="#000000" stroke-width="1.2"/>`
      );
    });
  });

  lines.push(
    ...microLines,
    ...staffLines,
    ...regionLines,
    ...gutterLabels,
    ...clefLines,
    ...measureLines,
    ...ledgerLines,
    ...stemLines,
    ...beamLines,
    ...flagLines,
    ...headLines,
    ...accidentalLines,
    ...restLines,
    ...tieLines
  );
  lines.push('</svg>');
  return { svg: lines.join(''), width, height };
};

export const HuntSystemTool = (_props: Props) => {
  const { settings, updateSettings } = useStore(
    (s) => ({
      settings: s.settings,
      updateSettings: s.updateSettings
    }),
    shallow
  );

  const huntSettings = settings?.hunt ?? DEFAULT_HUNT_SETTINGS;
  const staffDisplay = useMemo(() => ({
    ...DEFAULT_HUNT_SETTINGS.staffDisplay,
    ...(huntSettings.staffDisplay || {}),
    labelMode: (huntSettings.staffDisplay?.labelMode || huntSettings.debugLabelMode || DEFAULT_HUNT_SETTINGS.debugLabelMode) as any,
    showSlotLabels: (huntSettings.staffDisplay?.showSlotLabels ?? (huntSettings.debugEnabled ? 'debug' : 'off'))
  }), [huntSettings]);

  const [page, setPage] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<MusicXmlImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const autoScrollRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [preSeconds, setPreSeconds] = useState(4);
  const [postSeconds, setPostSeconds] = useState(8);
  const playStartRef = useRef(0);
  const playOffsetRef = useRef(0);
  const audioTimeoutsRef = useRef<number[]>([]);
  const activeAudioStopsRef = useRef<Array<(t?: number) => void>>([]);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewFullscreenScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0
  });
  const inputId = useId();

  const updateHuntSettings = useCallback(
    (partial: Partial<typeof huntSettings>) => {
      updateSettings({ hunt: { ...huntSettings, ...partial } });
    },
    [huntSettings, updateSettings]
  );

  const updateStaffDisplay = useCallback(
    (partial: Partial<typeof DEFAULT_HUNT_SETTINGS.staffDisplay>) => {
      updateSettings({ hunt: { ...huntSettings, staffDisplay: { ...DEFAULT_HUNT_SETTINGS.staffDisplay, ...(huntSettings.staffDisplay || {}), ...partial } } });
    },
    [huntSettings, updateSettings]
  );

  const updateVoiceColor = useCallback(
    (voiceId: string, color: string) => {
      updateSettings({
        hunt: {
          ...huntSettings,
          voiceColors: {
            ...(huntSettings.voiceColors || {}),
            [voiceId]: color
          }
        }
      });
    },
    [huntSettings, updateSettings]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setBusy(true);
      setImportResult(null);
      try {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const buffer = await file.arrayBuffer();
        let xmlText = '';
        if (ext === 'mxl') {
          const extracted = await extractMusicXmlFromMxl(buffer);
          xmlText = extracted.xmlText;
        } else {
          xmlText = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer));
        }
        const parsed = parseMusicXmlString(xmlText, {
          ticksPerQuarter: 480,
          sourceType: ext === 'mxl' ? 'mxl' : 'xml'
        });
        setImportResult(parsed);
        setFileName(file.name);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse MusicXML/MXL');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const mapped = useMemo(() => {
    if (!importResult) {
      return { rows: [] as HuntMappedNote[], stats: { total: 0, mapped: 0, rests: 0, missing: 0 } };
    }
    const rows: HuntMappedNote[] = [];
    let rests = 0;
    let missing = 0;
    const refHz = Number.isFinite(huntSettings.refPitchHz) && huntSettings.refPitchHz > 0
      ? huntSettings.refPitchHz
      : 440;
    const offset =
      huntSettings.zeroPitch === 'A4' ? 0 : Number.isFinite(huntSettings.a4InC0Cents)
        ? huntSettings.a4InC0Cents
        : 5700;
    importResult.events.forEach((ev) => {
      const safePartName = sanitizeLabel(ev.partName || ev.partId || 'Part') || 'Part';
      const base: Omit<HuntMappedNote, 'midiNote' | 'freqHz' | 'centsAbs' | 'I' | 'Z' | 'O' | 'pitchSource'> = {
        id: ev.id,
        partId: ev.partId,
        partName: safePartName,
        measureIndex: ev.measureIndex,
        staff: ev.staff,
        voice: ev.voice,
        tick: ev.startTick,
        durationTicks: ev.durationTicks,
        endTick: ev.endTick,
        isRest: ev.isRest,
        pitchLabel: buildPitchLabel(ev),
        tieStart: ev.tieStart,
        tieStop: ev.tieStop,
        beams: ev.beams
      };

      if (ev.isRest) {
        rests += 1;
        rows.push({
          ...base,
          pitchSource: 'rest',
          midiNote: null,
          freqHz: null,
          centsAbs: null,
          I: null,
          Z: null,
          O: null
        });
        return;
      }
      if (!Number.isFinite(ev.midiNote)) {
        missing += 1;
        return;
      }
      const midiNote = ev.midiNote as number;
      const freqHz = refHz * Math.pow(2, (midiNote - 69) / 12);
      const centsFromA4 = 1200 * Math.log2(freqHz / refHz);
      const centsAbs = centsFromA4 + offset;
      const I = Math.round(centsAbs / STEP_CENTS);
      const Z = Math.floor(I / 5);
      const O = ((I % 5) + 5) % 5;

      rows.push({
        ...base,
        pitchSource: 'midi',
        midiNote,
        freqHz,
        centsAbs,
        I,
        Z,
        O
      });
    });
    rows.sort((a, b) => a.tick - b.tick || (a.midiNote ?? 0) - (b.midiNote ?? 0));
    return {
      rows,
      stats: {
        total: importResult.events.length,
        mapped: rows.length,
        rests,
        missing
      }
    };
  }, [importResult, huntSettings]);

  const previewRows = mapped.rows;
  const exportRows = mapped.rows;
  const displayFileName = sanitizeLabel(fileName ?? '') || null;
  const exportBaseName = sanitizeLabel(fileName ?? '') || 'hunt-score';

  const voiceEntries = useMemo(() => {
    if (!importResult) return [] as Array<{ voiceId: string; label: string; voiceNum: number }>;
    const partNames = new Map<string, string>((importResult.parts || []).map((p) => [p.id, p.name || p.id]));
    const entries = new Map<string, { voiceId: string; label: string; voiceNum: number; partOrder: number; staff: number }>();
    const partOrder = new Map<string, number>();
    (importResult.parts || []).forEach((p, idx) => partOrder.set(p.id, idx));

    (importResult.events || []).forEach((ev) => {
      const voiceId = voiceKeyForMusicXmlEvent(ev);
      if (entries.has(voiceId)) return;
      const staff = Number.isFinite(ev.staff) ? Math.max(1, Math.floor(ev.staff)) : 1;
      const voiceRaw = (ev.voice || '1').trim() || '1';
      const voiceNumRaw = parseInt(voiceRaw, 10);
      const voiceNum = Number.isFinite(voiceNumRaw) && voiceNumRaw > 0 ? voiceNumRaw : 1;
      const partName = partNames.get(ev.partId) || ev.partId || 'Part';
      const label = `${partName} · Staff ${staff} · Voice ${voiceRaw}`;
      entries.set(voiceId, {
        voiceId,
        label,
        voiceNum,
        partOrder: partOrder.get(ev.partId) ?? 0,
        staff
      });
    });

    return Array.from(entries.values())
      .sort((a, b) => a.partOrder - b.partOrder || a.staff - b.staff || a.voiceNum - b.voiceNum || a.voiceId.localeCompare(b.voiceId))
      .map(({ voiceId, label, voiceNum }) => ({ voiceId, label, voiceNum }));
  }, [importResult]);

  const engineConfig = useMemo<HuntEngineConfig>(() => {
    const zoom = huntSettings.staffZoom ?? 1;
    const slotStep = staffDisplay.slotStepPx || 8;
    const clefScale = Number.isFinite(staffDisplay.clefScale) ? staffDisplay.clefScale : 1.55;
    const clefSizePx = Math.max(24, slotStep * zoom * 4.5) * clefScale;
    const clefXPx = Math.max(24, slotStep * zoom * 3.5);
    return {
      ticksPerQuarter: importResult?.ticksPerQuarter ?? 480,
      refPitchHz: huntSettings.refPitchHz,
      zeroPitch: huntSettings.zeroPitch,
      a4InC0Cents: huntSettings.a4InC0Cents,
      staffLineSpacingPx: slotStep * zoom,
      staffLineCount: staffDisplay.staffLineCount || 25,
      staffGapPx: slotStep * zoom * 8,
      clefXPx,
      clefSizePx,
      showStaffLines: staffDisplay.showStaffLines !== false,
      showRegionLines: staffDisplay.showRegionLines !== false,
      regionLineZIndices: staffDisplay.regionLineZIndices || undefined,
      staffLineThicknessPx: Math.max(1, slotStep * zoom * 0.12),
      regionLineThicknessPx: Math.max(2, slotStep * zoom * 0.24),
      showLedgerLines: staffDisplay.showLedgerLines !== false,
      baseQuarterWidthPx: 12 * zoom,
      noteheadWidthPx: 9 * zoom,
      noteheadHeightPx: 6 * zoom,
      voiceColorsEnabled: huntSettings.voiceColorsEnabled !== false,
      voiceColors: huntSettings.voiceColors || {},
      debug: { includeBoxes: huntSettings.debugEnabled && huntSettings.debugLabelMode === 'full' }
    };
  }, [huntSettings, importResult, staffDisplay]);

  const huntEngine = useMemo(() => {
    if (!importResult) return null;
    return buildHuntEngine(importResult, engineConfig);
  }, [importResult, engineConfig]);

  const tuningMap = useMemo(() => {
    if (!importResult) return null;
    const map = new Map<string, RetunedEventInfo>();
    (importResult.events || []).forEach((ev) => {
      map.set(ev.id, { ratio: null, ratioFraction: null, nodeId: null });
    });
    return map;
  }, [importResult]);

  const scoreDoc = useMemo<ScoreDocument | null>(() => {
    if (!importResult || !tuningMap) return null;
    return buildScoreDocumentFromMusicXml(importResult, tuningMap, { speed: playSpeed });
  }, [importResult, tuningMap, playSpeed]);

  const tempoSegments = useMemo(() => {
    if (!importResult) return [];
    return buildTempoMap(importResult.tempoEvents || [], importResult.ticksPerQuarter, playSpeed);
  }, [importResult, playSpeed]);

  const totalDuration = scoreDoc?.totalDuration || 0;

  const noteEvents = useMemo(() => {
    if (!scoreDoc) return [] as ScoreEvent[];
    const events: ScoreEvent[] = [];
    scoreDoc.voices.forEach((voice) => {
      voice.events.forEach((event) => {
        if (event.type !== 'note') return;
        if (!Number.isFinite(event.t0) || !Number.isFinite(event.t1)) return;
        events.push(event);
      });
    });
    return events.sort((a, b) => a.t0 - b.t0);
  }, [scoreDoc]);

  const stopAudioPlayback = useCallback(() => {
    audioTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    audioTimeoutsRef.current = [];
    activeAudioStopsRef.current.forEach((stop) => {
      try { stop(); } catch { }
    });
    activeAudioStopsRef.current = [];
  }, []);

  const startAudioPlayback = useCallback(
    (fromSeconds: number) => {
      if (!scoreDoc || noteEvents.length === 0) return;
      stopAudioPlayback();
      const a4Hz = Number.isFinite(huntSettings.refPitchHz) && huntSettings.refPitchHz > 0 ? huntSettings.refPitchHz : 440;
      const baseSettings = settings ?? DEFAULT_HUNT_SETTINGS;
      const playSettings = { ...baseSettings };
      const startAt = Math.max(0, fromSeconds);

      noteEvents.forEach((event) => {
        if (event.t1 <= startAt) return;
        const offset = Math.max(0, startAt - event.t0);
        const duration = Math.max(0, event.duration - offset);
        if (duration <= 0) return;
        const delayMs = Math.max(0, (event.t0 - startAt) * 1000);
        const startId = window.setTimeout(() => {
          const midiNote = event.midi?.noteNumber;
          if (!Number.isFinite(midiNote)) return;
          const freq = midiNoteToFrequency(midiNote as number, a4Hz);
          if (!Number.isFinite(freq)) return;
          const stop = startFrequency(freq, playSettings as any, 'sequence', 0, undefined, { velocity: 0.85 }, event.id);
          activeAudioStopsRef.current.push(stop);
          const stopId = window.setTimeout(() => {
            stop();
            activeAudioStopsRef.current = activeAudioStopsRef.current.filter((s) => s !== stop);
          }, Math.max(20, duration * 1000));
          audioTimeoutsRef.current.push(stopId);
        }, delayMs);
        audioTimeoutsRef.current.push(startId);
      });
    },
    [scoreDoc, noteEvents, stopAudioPlayback, huntSettings.refPitchHz, settings]
  );

  const startVisualPlay = useCallback(() => {
    if (!scoreDoc) return;
    setPlaying(true);
    playStartRef.current = performance.now();
    playOffsetRef.current = playhead;
    startAudioPlayback(playhead);
  }, [scoreDoc, playhead, startAudioPlayback]);

  const stopVisualPlay = useCallback(() => {
    setPlaying(false);
    stopAudioPlayback();
  }, [stopAudioPlayback]);

  useRafLoop(playing, (t) => {
    const elapsed = (t - playStartRef.current) / 1000;
    const next = playOffsetRef.current + elapsed;
    if (next >= totalDuration) {
      setPlayhead(totalDuration);
      stopAudioPlayback();
      setPlaying(false);
      return;
    }
    setPlayhead(next);
  });

  const onSeek = useCallback((t: number) => {
    const clamped = clamp(t, 0, totalDuration);
    setPlayhead(clamped);
    if (playing) {
      playStartRef.current = performance.now();
      playOffsetRef.current = clamped;
      startAudioPlayback(clamped);
    }
  }, [totalDuration, playing, startAudioPlayback]);

  useEffect(() => {
    stopAudioPlayback();
    setPlaying(false);
  }, [scoreDoc, stopAudioPlayback]);

  useEffect(() => () => stopAudioPlayback(), [stopAudioPlayback]);

  useEffect(() => {
    setPlayhead(0);
  }, [importResult]);

  const previewSvg = useMemo(() => {
    if (!huntEngine) return '';
    return exportHuntSvg(huntEngine);
  }, [huntEngine]);

  const playheadTick = useMemo(() => {
    if (!tempoSegments.length) return 0;
    return secondsToTick(tempoSegments, playhead);
  }, [tempoSegments, playhead]);

  const tickToX = useCallback((tick: number) => {
    if (!huntEngine) return 0;
    const measures = huntEngine.layout.measures;
    if (!measures.length) return 0;
    const clampedTick = clamp(tick, measures[0].startTick, measures[measures.length - 1].endTick);
    const measure = measures.find((m) => clampedTick >= m.startTick && clampedTick <= m.endTick) || measures[measures.length - 1];
    const positions = measure.tickPositions;
    if (positions && positions.length >= 2) {
      const idx = positions.findIndex((p) => p.tick >= clampedTick);
      if (idx === -1) return positions[positions.length - 1].x;
      if (idx <= 0) return positions[0].x;
      const prev = positions[idx - 1];
      const next = positions[idx];
      const span = Math.max(1, next.tick - prev.tick);
      const t = clamp((clampedTick - prev.tick) / span, 0, 1);
      return prev.x + t * (next.x - prev.x);
    }
    const span = Math.max(1, measure.endTick - measure.startTick);
    const t = clamp((clampedTick - measure.startTick) / span, 0, 1);
    return measure.contentStartX + t * measure.contentWidth;
  }, [huntEngine]);

  const playheadX = useMemo(() => {
    if (!huntEngine) return null;
    return tickToX(playheadTick);
  }, [huntEngine, playheadTick, tickToX]);

  const xToTick = useCallback((x: number) => {
    if (!huntEngine) return 0;
    const measures = huntEngine.layout.measures;
    if (!measures.length) return 0;
    const measure = measures.find((m) => x >= m.startX && x <= m.startX + m.width) || measures[measures.length - 1];
    const positions = measure.tickPositions;
    if (positions && positions.length >= 2) {
      const idx = positions.findIndex((p) => p.x >= x);
      if (idx === -1) return positions[positions.length - 1].tick;
      if (idx <= 0) return positions[0].tick;
      const prev = positions[idx - 1];
      const next = positions[idx];
      const span = Math.max(1, next.x - prev.x);
      const t = clamp((x - prev.x) / span, 0, 1);
      return prev.tick + t * (next.tick - prev.tick);
    }
    const span = Math.max(1, measure.endTick - measure.startTick);
    const t = clamp((x - measure.contentStartX) / Math.max(1, measure.contentWidth), 0, 1);
    return measure.startTick + t * span;
  }, [huntEngine]);

  const safePre = Math.max(0, Number.isFinite(preSeconds) ? preSeconds : 0);
  const safePost = Math.max(0.5, Number.isFinite(postSeconds) ? postSeconds : 0.5);
  const getActiveScrollEl = () => (previewFullscreen ? previewFullscreenScrollRef.current : previewScrollRef.current);

  const scrollToPlayhead = useCallback(() => {
    if (!huntEngine || playheadX == null) return;
    const scrollEl = getActiveScrollEl();
    if (!scrollEl) return;
    const viewW = scrollEl.clientWidth || 1;
    const totalW = huntEngine.render.width || 1;
    const ratio = safePre / Math.max(0.0001, safePre + safePost);
    const target = playheadX - ratio * viewW;
    const clamped = clamp(target, 0, Math.max(0, totalW - viewW));
    autoScrollRef.current = true;
    scrollEl.scrollLeft = clamped;
    window.setTimeout(() => {
      autoScrollRef.current = false;
    }, 0);
  }, [huntEngine, playheadX, safePre, safePost, previewFullscreen]);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStateRef.current.moved) return;
    if (!huntEngine || !tempoSegments.length) return;
    const scrollEl = getActiveScrollEl();
    if (!scrollEl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollEl.scrollLeft;
    const tick = xToTick(x);
    const seconds = tickToSeconds(tempoSegments, tick);
    onSeek(seconds);
  }, [huntEngine, tempoSegments, xToTick, onSeek, previewFullscreen]);

  const handlePreviewPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const scrollEl = getActiveScrollEl();
    if (!scrollEl) return;
    setFollowPlayhead(false);
    dragStateRef.current.active = true;
    dragStateRef.current.moved = false;
    dragStateRef.current.startX = e.clientX;
    dragStateRef.current.startY = e.clientY;
    dragStateRef.current.scrollLeft = scrollEl.scrollLeft;
    dragStateRef.current.scrollTop = scrollEl.scrollTop;
    if (e.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [previewFullscreen]);

  const handlePreviewPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    const scrollEl = getActiveScrollEl();
    if (!scrollEl) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const dy = e.clientY - dragStateRef.current.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      dragStateRef.current.moved = true;
    }
    scrollEl.scrollLeft = dragStateRef.current.scrollLeft - dx;
    scrollEl.scrollTop = dragStateRef.current.scrollTop - dy;
  }, [previewFullscreen]);

  const handlePreviewPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;
    if (e.pointerId != null) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  useEffect(() => {
    if (!playing || !followPlayhead || playheadX == null) return;
    scrollToPlayhead();
  }, [playing, followPlayhead, playheadX, scrollToPlayhead]);

  const renderPreview = (ref: React.RefObject<HTMLDivElement>, heightClass: string) => (
    <div
      className={`bg-white rounded-lg border border-gray-700 overflow-auto ${heightClass} cursor-grab active:cursor-grabbing`}
      ref={ref}
      onScroll={() => {
        if (autoScrollRef.current) return;
        setFollowPlayhead(false);
      }}
      onPointerDown={handlePreviewPointerDown}
      onPointerMove={handlePreviewPointerMove}
      onPointerUp={handlePreviewPointerUp}
      onPointerLeave={handlePreviewPointerUp}
    >
      <div
        className="relative inline-block"
        style={{ width: huntEngine?.render.width || 'auto', height: huntEngine?.render.height || 'auto' }}
        onClick={handlePreviewClick}
      >
        <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
        {playheadX != null && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 pointer-events-none"
            style={{ left: `${playheadX}px` }}
          />
        )}
      </div>
    </div>
  );

  const exportSvgPayload = useCallback(() => {
    if (!huntEngine) return { svg: '', width: 0, height: 0 };
    return { svg: exportHuntSvg(huntEngine), width: huntEngine.render.width, height: huntEngine.render.height };
  }, [huntEngine]);

  const exportSvg = useCallback(() => {
    const payload = exportSvgPayload();
    if (!payload.svg) return;
    const base = exportBaseName.replace(/\.[^.]+$/, '');
    downloadText(`${base}-hunt.svg`, payload.svg, 'image/svg+xml');
  }, [exportSvgPayload, exportBaseName]);

  const exportPng = useCallback(async () => {
    const payload = exportSvgPayload();
    if (!payload.svg) return;

    const svgBlob = new Blob([payload.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    // Clean up the object URL on any error
    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = payload.width * dpr;
        canvas.height = payload.height * dpr;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          console.error('Failed to get canvas context');
          cleanup();
          return;
        }

        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, payload.width, payload.height);

        canvas.toBlob(
          (blob) => {
            try {
              if (blob) {
                const base = exportBaseName.replace(/\.[^.]+$/, '');
                downloadBlob(`${base}-hunt.png`, blob);
              }
            } catch (err) {
              console.error('Failed to process PNG blob:', err);
            } finally {
              cleanup();
            }
          },
          'image/png'
        );
      } catch (err) {
        console.error('Error during PNG export:', err);
        cleanup();
      }
    };

    // CRITICAL: Add error handler to prevent URL memory leak
    img.onerror = () => {
      console.error('Failed to load SVG image for PNG export');
      cleanup();
    };

    img.src = url;
  }, [exportSvgPayload, exportBaseName]);

  const exportPdf = useCallback(() => {
    const payload = exportSvgPayload();
    if (!payload.svg) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Hunt Export</title>
          <style>
            body { margin: 0; padding: 12px; background: #fff; font-family: ui-sans-serif, system-ui; }
          </style>
        </head>
        <body>${payload.svg}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  }, [exportSvgPayload]);

  const exportValidation = useCallback(() => {
    if (!huntEngine) return;
    const base = exportBaseName.replace(/\.[^.]+$/, '');
    const payload = {
      validation: huntEngine.validation,
      logs: huntEngine.logs
    };
    downloadText(`${base}-hunt-validation.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [huntEngine, exportBaseName]);

  const exportIntermediate = useCallback(() => {
    if (!huntEngine) return;
    const base = exportBaseName.replace(/\.[^.]+$/, '');
    const payload = {
      logical: huntEngine.logical,
      layout: huntEngine.layout
    };
    downloadText(`${base}-hunt-ir.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [huntEngine, exportBaseName]);

  const statsLabel = importResult
    ? `${mapped.stats.mapped} notes mapped${mapped.stats.rests ? ` | ${mapped.stats.rests} rests` : ''}${mapped.stats.missing ? ` | ${mapped.stats.missing} missing pitch` : ''}`
    : 'No file loaded.';
  const validationSummary = huntEngine
    ? `Validation: ${huntEngine.validation.stats.fatalCount} fatal, ${huntEngine.validation.stats.errorCount} errors, ${huntEngine.validation.stats.warningCount} warnings`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-gray-300">Hunt System</div>
          <div className="text-[9px] text-gray-500">Independent Page: {page}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(0)}
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
              page === 0 ? 'bg-blue-600/70 border-blue-400 text-white' : 'bg-black/40 border-white/10 text-gray-400'
            }`}
          >
            Page 0
          </button>
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Input</div>
        <div className="flex flex-col gap-2">
          <label className="text-[9px] text-gray-500 uppercase font-bold">MusicXML Upload</label>
          <input
            id={inputId}
            type="file"
            accept=".xml,.musicxml,.mxl"
            onChange={handleFileChange}
            className="sr-only"
          />
          <label
            htmlFor={inputId}
            className="inline-flex items-center justify-center min-h-[32px] px-3 py-1.5 rounded-lg bg-blue-700/70 text-[10px] font-bold uppercase tracking-widest text-white cursor-pointer"
          >
            Select File
          </label>
          <div className="text-[9px] text-gray-500">
            {busy ? 'Parsing file...' : displayFileName ? `Loaded: ${displayFileName}` : 'No file selected.'}
          </div>
          {error && <div className="text-[9px] text-red-400">{error}</div>}
          {!error && importResult && (
            <div className="text-[9px] text-emerald-300">
              {statsLabel}
            </div>
          )}
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reference & Zero</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Ref Pitch Name</label>
            <input
              value={huntSettings.refPitchName}
              onChange={(e) => updateHuntSettings({ refPitchName: e.target.value })}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Ref Pitch Hz</label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={huntSettings.refPitchHz}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (Number.isFinite(next)) updateHuntSettings({ refPitchHz: next });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Cents Zero Pitch</label>
            <select
              value={huntSettings.zeroPitch}
              onChange={(e) => updateHuntSettings({ zeroPitch: e.target.value as any })}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            >
              <option value="C0">C0</option>
              <option value="A4">A4</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">A4 in C0 Cents</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={huntSettings.a4InC0Cents}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (Number.isFinite(next)) updateHuntSettings({ a4InC0Cents: next });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Staff Display</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Staff Zoom</label>
            <input
              type="number"
              min={0.5}
              max={3}
              step={0.1}
              value={huntSettings.staffZoom ?? 1}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (Number.isFinite(next)) updateHuntSettings({ staffZoom: next });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Line Spacing (px)</label>
            <input
              type="number"
              min={2}
              max={24}
              step={0.5}
              value={staffDisplay.slotStepPx ?? 8}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                if (Number.isFinite(next)) updateStaffDisplay({ slotStepPx: next });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Micro Lines</label>
            <select
              value={staffDisplay.microLineMode}
              onChange={(e) => updateStaffDisplay({ microLineMode: e.target.value as any })}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="on">On</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Visible Z Min</label>
            <input
              type="number"
              value={staffDisplay.visibleZMin ?? ''}
              placeholder="auto"
              onChange={(e) => {
                const val = e.target.value.trim();
                updateStaffDisplay({ visibleZMin: val === '' ? null : parseInt(val) });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Visible Z Max</label>
            <input
              type="number"
              value={staffDisplay.visibleZMax ?? ''}
              placeholder="auto"
              onChange={(e) => {
                const val = e.target.value.trim();
                updateStaffDisplay({ visibleZMax: val === '' ? null : parseInt(val) });
              }}
              className="w-full bg-black border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200"
            />
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={staffDisplay.showStaffLines !== false}
              onChange={(e) => updateStaffDisplay({ showStaffLines: e.target.checked })}
              className="accent-blue-500"
            />
            Show Staff Lines
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={staffDisplay.showRegionLines !== false}
              onChange={(e) => updateStaffDisplay({ showRegionLines: e.target.checked })}
              className="accent-blue-500"
            />
            Show Region Lines
          </div>
          <div className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={staffDisplay.showLedgerLines !== false}
              onChange={(e) => updateStaffDisplay({ showLedgerLines: e.target.checked })}
              className="accent-blue-500"
            />
            Show Ledger Lines
          </div>
        </div>
      </div>

      {voiceEntries.length > 0 && (
        <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Voice Colors</div>
          <label className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={huntSettings.voiceColorsEnabled !== false}
              onChange={(e) => updateHuntSettings({ voiceColorsEnabled: e.target.checked })}
              className="accent-blue-500"
            />
            Enable voice colors
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {voiceEntries.map((entry) => {
              const fallback = DEFAULT_VOICE_PALETTE[(entry.voiceNum - 1) % DEFAULT_VOICE_PALETTE.length] || '#111111';
              const current = (huntSettings.voiceColors || {})[entry.voiceId] || fallback;
              return (
                <div key={entry.voiceId} className="flex items-center gap-2 bg-black/30 rounded-lg border border-gray-800 px-2 py-1">
                  <input
                    type="color"
                    value={current}
                    onChange={(e) => updateVoiceColor(entry.voiceId, e.target.value)}
                    className="h-6 w-8 p-0 bg-transparent border-0"
                    title={entry.label}
                  />
                  <span className="text-[10px] text-gray-300 truncate">{entry.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Debug & Export</div>
        {validationSummary && (
          <div className="text-[9px] text-amber-300">{validationSummary}</div>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={huntSettings.debugEnabled}
              onChange={(e) => updateHuntSettings({ debugEnabled: e.target.checked })}
              className="accent-blue-500"
            />
            Debug On
          </label>
          <select
            value={huntSettings.debugLabelMode}
            onChange={(e) => updateHuntSettings({ debugLabelMode: e.target.value as any })}
            className="bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
            disabled={!huntSettings.debugEnabled}
          >
            <option value="none">Labels: None</option>
            <option value="brief">Labels: Brief</option>
            <option value="full">Labels: Full</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-[10px] uppercase font-bold text-gray-200 bg-black/40 disabled:opacity-40"
            onClick={exportSvg}
            disabled={!huntEngine}
          >
            Export SVG
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-[10px] uppercase font-bold text-gray-200 bg-black/40 disabled:opacity-40"
            onClick={exportPng}
            disabled={!huntEngine}
          >
            Export PNG
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-[10px] uppercase font-bold text-gray-200 bg-black/40 disabled:opacity-40"
            onClick={exportPdf}
            disabled={!huntEngine}
          >
            Export PDF
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-[10px] uppercase font-bold text-gray-200 bg-black/40 disabled:opacity-40"
            onClick={exportValidation}
            disabled={!huntEngine}
          >
            Export Validation
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 text-[10px] uppercase font-bold text-gray-200 bg-black/40 disabled:opacity-40"
            onClick={exportIntermediate}
            disabled={!huntEngine}
          >
            Export IR
          </button>
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Playback</div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${
              playing ? 'bg-red-900/50 text-red-200 border-red-700' : 'bg-emerald-900/50 text-emerald-200 border-emerald-700'
            }`}
            onClick={playing ? stopVisualPlay : startVisualPlay}
            disabled={!scoreDoc}
          >
            {playing ? 'Stop' : 'Play'}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-gray-200"
            onClick={() => onSeek(0)}
            disabled={!scoreDoc}
          >
            Rewind
          </button>
          <label className="flex items-center gap-2 text-[9px] text-gray-400">
            <input
              type="checkbox"
              checked={followPlayhead}
              onChange={(e) => setFollowPlayhead(e.target.checked)}
              className="accent-blue-500"
            />
            Follow red line
          </label>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-gray-700 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-gray-200"
            onClick={() => {
              setFollowPlayhead(true);
              scrollToPlayhead();
            }}
            disabled={!huntEngine}
          >
            Re-center
          </button>
          <div className="text-[10px] text-gray-400">
            {scoreDoc ? `${playhead.toFixed(2)}s / ${totalDuration.toFixed(2)}s` : 'No score'}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Speed</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={playSpeed}
                onChange={(e) => setPlaySpeed(clamp(Number(e.target.value), 0.25, 2))}
                className="w-full h-1.5 accent-emerald-500 bg-gray-700 rounded appearance-none"
              />
              <input
                type="number"
                min={0.25}
                max={2}
                step={0.05}
                value={playSpeed}
                onChange={(e) => setPlaySpeed(clamp(Number(e.target.value), 0.25, 2))}
                className="w-16 bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-gray-500 uppercase font-bold">Scroll Window (s)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.5}
                value={preSeconds}
                onChange={(e) => setPreSeconds(Math.max(0, Number(e.target.value)))}
                className="w-16 bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              />
              <span className="text-[10px] text-gray-500">Pre</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={postSeconds}
                onChange={(e) => setPostSeconds(Math.max(0.5, Number(e.target.value)))}
                className="w-16 bg-black border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200"
              />
              <span className="text-[10px] text-gray-500">Post</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black/40 border border-gray-800 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hunt Staff Preview</div>
          {previewSvg && (
            <button
              type="button"
              onClick={() => setPreviewFullscreen(true)}
              className="px-2 py-1 rounded border border-gray-700 text-[9px] uppercase font-bold text-gray-200 bg-black/40"
            >
              Fullscreen
            </button>
          )}
        </div>
        {!previewSvg && (
          <div className="text-[11px] text-gray-500">Upload a MusicXML file to see the Hunt staff preview.</div>
        )}
        {previewSvg && renderPreview(previewScrollRef, 'max-h-[420px]')}
      </div>

      <FullScreenModal
        isOpen={previewFullscreen}
        title="Hunt Staff Preview"
        onClose={() => setPreviewFullscreen(false)}
      >
        {previewSvg ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[9px] text-gray-300">
                <input
                  type="checkbox"
                  checked={followPlayhead}
                  onChange={(e) => setFollowPlayhead(e.target.checked)}
                  className="accent-blue-500"
                />
                Follow red line
              </label>
              <button
                type="button"
                className="px-2 py-1 rounded border border-gray-700 text-[9px] uppercase font-bold text-gray-200 bg-black/40"
                onClick={() => {
                  setFollowPlayhead(true);
                  scrollToPlayhead();
                }}
              >
                Re-center
              </button>
            </div>
            {renderPreview(previewFullscreenScrollRef, 'w-full h-[92vh]')}
          </div>
        ) : (
          <div className="text-sm text-gray-300">No preview available.</div>
        )}
      </FullScreenModal>

    </div>
  );
};

