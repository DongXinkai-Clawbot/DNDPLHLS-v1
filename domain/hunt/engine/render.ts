import type { HuntLayoutScore, HuntRenderScore, HuntGraphicObject, HuntEngineConfig, HuntLayoutEvent, HuntBeamGroup } from './types';
import { roundTo } from './utils';

const REST_GLYPHS = {
  whole: String.fromCodePoint(0x1d13b),
  half: String.fromCodePoint(0x1d13c),
  quarter: String.fromCodePoint(0x1d13d),
  eighth: String.fromCodePoint(0x1d13e),
  sixteenth: String.fromCodePoint(0x1d13f),
  thirtySecond: String.fromCodePoint(0x1d140),
  sixtyFourth: String.fromCodePoint(0x1d141)
};

const getRestGlyph = (restType?: string) => {
  if (!restType) return null;
  const normalized = restType.toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (normalized) {
    case 'whole':
    case 'breve':
    case 'long':
      return REST_GLYPHS.whole;
    case 'half':
      return REST_GLYPHS.half;
    case 'quarter':
      return REST_GLYPHS.quarter;
    case 'eighth':
    case '8th':
      return REST_GLYPHS.eighth;
    case 'sixteenth':
    case '16th':
      return REST_GLYPHS.sixteenth;
    case 'thirtysecond':
    case '32nd':
    case '32th':
      return REST_GLYPHS.thirtySecond;
    case 'sixtyfourth':
    case '64th':
      return REST_GLYPHS.sixtyFourth;
    default:
      return null;
  }
};

const buildBeamPath = (beam: HuntBeamGroup) => {
  const dx = beam.x2 - beam.x1;
  const dy = beam.y2 - beam.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const half = beam.thickness / 2;
  const x1 = beam.x1 + nx * half;
  const y1 = beam.y1 + ny * half;
  const x2 = beam.x2 + nx * half;
  const y2 = beam.y2 + ny * half;
  const x3 = beam.x2 - nx * half;
  const y3 = beam.y2 - ny * half;
  const x4 = beam.x1 - nx * half;
  const y4 = beam.y1 - ny * half;
  return `M ${roundTo(x1)} ${roundTo(y1)} L ${roundTo(x2)} ${roundTo(y2)} L ${roundTo(x3)} ${roundTo(y3)} L ${roundTo(x4)} ${roundTo(y4)} Z`;
};

const TREBLE_CLEF = String.fromCodePoint(0x1d11e);
const BASS_CLEF = String.fromCodePoint(0x1d122);
const CLEF_FONT = "Bravura, 'Noto Music', 'Noto Sans Symbols2', 'Segoe UI Symbol', serif";
const REST_SCALE = 1.75;
const DEFAULT_VOICE_PALETTE = ['#111111', '#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0f766e', '#be185d'];

const ACCIDENTAL_GLYPHS: Record<string, string> = {
  bb: String.fromCodePoint(0x1d12b),
  b: String.fromCodePoint(0x266d),
  n: String.fromCodePoint(0x266e),
  '#': String.fromCodePoint(0x266f),
  x: String.fromCodePoint(0x1d12a)
};

const getLineStyle = (lineNumber: number, baseThickness: number) => {
  if (!Number.isFinite(lineNumber) || lineNumber <= 0) {
    return { thickness: baseThickness, opacity: 1 };
  }
  const mod6 = (lineNumber - 1) % 6;
  if (mod6 === 0) {
    return { thickness: Math.max(1.2, baseThickness * 2.6), opacity: 1 };
  }
  if (lineNumber % 2 === 1) {
    return { thickness: Math.max(1.0, baseThickness * 1.6), opacity: 0.7 };
  }
  return { thickness: Math.max(0.7, baseThickness * 0.9), opacity: 0.35 };
};

const parseVoiceNumber = (voiceId?: string) => {
  if (!voiceId) return 1;
  const match = voiceId.match(/voice-([0-9]+)/i);
  if (!match) return 1;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const getVoiceColor = (voiceId: string | undefined, config: HuntEngineConfig) => {
  if (config.voiceColorsEnabled === false) return undefined;
  const map = config.voiceColors || {};
  if (voiceId && map[voiceId]) return map[voiceId];
  const voiceNum = parseVoiceNumber(voiceId);
  return DEFAULT_VOICE_PALETTE[(voiceNum - 1) % DEFAULT_VOICE_PALETTE.length] ?? '#111111';
};

export const buildRenderScore = (
  layout: HuntLayoutScore,
  config: HuntEngineConfig
): HuntRenderScore => {
  const objects: HuntGraphicObject[] = [];

  // Staff lines
  const showStaffLines = config.showStaffLines !== false;
  const showRegionLines = config.showRegionLines !== false;
  const staffLineThickness = config.staffLineThicknessPx ?? 1;
  const regionLineThickness = config.regionLineThicknessPx ?? Math.max(2, staffLineThickness * 2);
  const regionLineZ = config.regionLineZIndices || [];

  const lineSpacing = layout.staffLayouts[0]?.lineSpacing ?? 8;
  const clefX = Number.isFinite(config.clefXPx) && (config.clefXPx as number) > 0
    ? (config.clefXPx as number)
    : Math.max(24, lineSpacing * 3.5);
  const clefSize = Number.isFinite(config.clefSizePx) && (config.clefSizePx as number) > 0
    ? (config.clefSizePx as number)
    : Math.max(24, lineSpacing * 4.5);

  const staffById = new Map(layout.staffLayouts.map((s) => [s.staffId, s] as const));

  layout.staffLayouts.forEach((staff) => {
    for (let z = staff.visibleMinZ; z <= staff.visibleMaxZ; z += 1) {
      if (z % 2 !== 0) continue;
      const lineNumber = Math.round((z - staff.visibleMinZ) / 2) + 1;
      const style = getLineStyle(lineNumber, staffLineThickness);
      const y = staff.top + (staff.drawMaxZ - z) * staff.lineSpacing;
      const zInOct = ((z % 41) + 41) % 41;
      const isRegion = regionLineZ.includes(zInOct);
      const drawStaffLine = showStaffLines;
      const drawRegionLine = showRegionLines && !showStaffLines && isRegion;
      if (drawStaffLine || drawRegionLine) {
        objects.push({
          id: `staff-${staff.staffId}-z${z}`,
          type: 'staffLine',
          x: 0,
          y: y - style.thickness / 2,
          width: layout.width,
          height: style.thickness,
          layer: 0,
          opacity: style.opacity
        });
      }
    }

    const clefGlyph = staff.staffIndex >= 2 ? BASS_CLEF : TREBLE_CLEF;
    const clefY = staff.top + (staff.drawMaxZ - staff.centerLine) * staff.lineSpacing;
    objects.push({
      id: `clef-${staff.staffId}`,
      type: 'clef',
      x: clefX - clefSize * 0.5,
      y: clefY - clefSize * 0.5,
      width: clefSize,
      height: clefSize,
      layer: 1,
      text: clefGlyph
    });
  });

  const renderMeasures = layout.measures.map((m) => ({
    index: m.index,
    x: m.startX,
    width: m.width
  }));

  // Bar lines
  layout.measures.forEach((measure) => {
    objects.push({
      id: `bar-${measure.index}`,
      type: 'barline',
      x: measure.startX,
      y: 0,
      width: 1,
      height: layout.height,
      layer: 1
    });
  });

  // Notes, rests, stems, accidentals, dots, ledger lines
  layout.events.forEach((ev) => {
    const voiceColor = getVoiceColor(ev.voiceId, config);
    if (config.showLedgerLines !== false && ev.ledgerLines) {
      const staff = staffById.get(ev.staffId);
      ev.ledgerLines.forEach((line, idx) => {
        let thickness = 1;
        let opacity = 1;
        if (staff) {
          const z = Math.round(staff.drawMaxZ - (line.y - staff.top) / staff.lineSpacing);
          const lineNumber = z < staff.visibleMinZ
            ? 1 + Math.round((staff.visibleMinZ - z) / 2)
            : z > staff.visibleMaxZ
              ? 1 + Math.round((z - staff.visibleMaxZ) / 2)
              : 1 + Math.round((z - staff.visibleMinZ) / 2);
          const style = getLineStyle(lineNumber, staffLineThickness);
          thickness = style.thickness;
          opacity = style.opacity;
        }
        objects.push({
          id: `${ev.id}-ledger-${idx}`,
          type: 'ledger',
          x: line.x1,
          y: line.y - thickness / 2,
          width: line.x2 - line.x1,
          height: thickness,
          layer: 2,
          eventId: ev.id,
          voiceId: ev.voiceId,
          color: voiceColor,
          opacity,
          measureIndex: ev.measureIndex
        });
      });
    }

    if (ev.kind === 'rest') {
      const restGlyph = getRestGlyph(ev.restType);
      objects.push({
        id: `${ev.id}-rest`,
        type: 'rest',
        x: ev.notehead.x - ev.notehead.width / 2,
        y: ev.notehead.y - ev.notehead.height / 2,
        width: ev.notehead.width,
        height: ev.notehead.height,
        layer: 4,
        eventId: ev.id,
        voiceId: ev.voiceId,
        color: voiceColor,
        text: restGlyph || undefined,
        measureIndex: ev.measureIndex
      });
      return;
    }

    objects.push({
      id: `${ev.id}-notehead`,
      type: 'notehead',
      x: ev.notehead.x - ev.notehead.width / 2,
      y: ev.notehead.y - ev.notehead.height / 2,
      width: ev.notehead.width,
      height: ev.notehead.height,
      layer: 4,
      eventId: ev.id,
      voiceId: ev.voiceId,
      color: voiceColor,
      filled: ev.noteheadFilled !== false,
      measureIndex: ev.measureIndex
    });

    if (ev.stem) {
      objects.push({
        id: `${ev.id}-stem`,
        type: 'stem',
        x: ev.stem.x,
        y: Math.min(ev.stem.y1, ev.stem.y2),
        width: 1,
        height: Math.abs(ev.stem.y2 - ev.stem.y1),
        layer: 3,
        eventId: ev.id,
        voiceId: ev.voiceId,
        color: voiceColor,
        measureIndex: ev.measureIndex
      });
    }

    if (ev.flags && ev.flags > 0 && ev.stem) {
      const dir = ev.stem.direction;
      const flagLength = Math.max(6, ev.notehead.width * 0.9);
      for (let i = 0; i < ev.flags; i += 1) {
        const offsetY = i * 4 * (dir === 'up' ? 1 : -1);
        const x1 = ev.stem.x;
        const y1 = ev.stem.y2 + offsetY;
        const x2 = x1 + (dir === 'up' ? flagLength : -flagLength);
        const y2 = y1 + (dir === 'up' ? flagLength * 0.35 : -flagLength * 0.35);
        const path = `M ${roundTo(x1)} ${roundTo(y1)} Q ${roundTo((x1 + x2) / 2)} ${roundTo(y1 + (dir === 'up' ? 2 : -2))} ${roundTo(x2)} ${roundTo(y2)}`;
        objects.push({
          id: `${ev.id}-flag-${i}`,
          type: 'flag',
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
          layer: 3,
          eventId: ev.id,
          voiceId: ev.voiceId,
          color: voiceColor,
          path,
          measureIndex: ev.measureIndex
        });
      }
    }

    if (ev.accidental) {
      objects.push({
        id: `${ev.id}-acc`,
        type: 'accidental',
        x: ev.accidental.x,
        y: ev.accidental.y,
        width: ev.accidental.width,
        height: ev.accidental.height,
        layer: 3,
        eventId: ev.id,
        voiceId: ev.voiceId,
        color: voiceColor,
        text: ev.accidental.glyph,
        measureIndex: ev.measureIndex
      });
    }

    if (ev.dots) {
      ev.dots.forEach((dot, idx) => {
        objects.push({
          id: `${ev.id}-dot-${idx}`,
          type: 'dot',
          x: dot.x - dot.radius,
          y: dot.y - dot.radius,
          width: dot.radius * 2,
          height: dot.radius * 2,
          layer: 3,
          eventId: ev.id,
          voiceId: ev.voiceId,
          color: voiceColor,
          measureIndex: ev.measureIndex
        });
      });
    }

    if (ev.tie) {
      const midX = (ev.tie.x1 + ev.tie.x2) / 2;
      const midY = (ev.tie.y1 + ev.tie.y2) / 2;
      const curveDir = ev.tie.curveDir ?? -1;
      const curveHeight = ev.tie.curveHeight ?? 6;
      const controlY = midY + curveDir * curveHeight;
      const path = `M ${roundTo(ev.tie.x1)} ${roundTo(ev.tie.y1)} Q ${roundTo(midX)} ${roundTo(controlY)} ${roundTo(ev.tie.x2)} ${roundTo(ev.tie.y2)}`;
      objects.push({
        id: `${ev.id}-tie`,
        type: 'tie',
        x: Math.min(ev.tie.x1, ev.tie.x2),
        y: Math.min(ev.tie.y1, ev.tie.y2) - Math.abs(curveHeight),
        width: Math.abs(ev.tie.x2 - ev.tie.x1),
        height: Math.abs(ev.tie.y2 - ev.tie.y1) + Math.abs(curveHeight) * 2,
        layer: 2,
        eventId: ev.id,
        voiceId: ev.voiceId,
        color: voiceColor,
        path,
        measureIndex: ev.tie.crossMeasure ? undefined : ev.measureIndex
      });
    }
  });

  // Beams
  layout.beams.forEach((beam) => {
    const path = buildBeamPath(beam);
    objects.push({
      id: beam.id,
      type: 'beam',
      x: Math.min(beam.x1, beam.x2),
      y: Math.min(beam.y1, beam.y2) - beam.thickness,
      width: Math.abs(beam.x2 - beam.x1),
      height: beam.thickness * 2,
      layer: 3,
      voiceId: beam.voiceId,
      color: getVoiceColor(beam.voiceId, config),
      path,
      measureIndex: beam.measureIndex
    });
  });

  // Debug bounding boxes
  if (config.debug?.includeBoxes) {
    layout.events.forEach((ev) => {
      objects.push({
        id: `${ev.id}-bbox`,
        type: 'debug',
        x: ev.bbox.x,
        y: ev.bbox.y,
        width: ev.bbox.width,
        height: ev.bbox.height,
        layer: 9,
        eventId: ev.id
      });
    });
  }

  return { width: layout.width, height: layout.height, objects, measures: renderMeasures };
};

export const renderSvg = (render: HuntRenderScore) => {
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${roundTo(render.width)}" height="${roundTo(render.height)}" viewBox="0 0 ${roundTo(render.width)} ${roundTo(render.height)}">`);
  lines.push('<rect width="100%" height="100%" fill="#ffffff"/>');

  if (render.measures?.length) {
    lines.push('<defs>');
    render.measures.forEach((m) => {
      const x = roundTo(m.x);
      const w = roundTo(m.width);
      lines.push(`<clipPath id="hunt-m${m.index}"><rect x="${x}" y="0" width="${w}" height="${roundTo(render.height)}"/></clipPath>`);
    });
    lines.push('</defs>');
  }

  const sorted = [...render.objects].sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id));
  sorted.forEach((obj) => {
    const clip = obj.measureIndex !== undefined ? ` clip-path="url(#hunt-m${obj.measureIndex})"` : '';
    const color = obj.color || '#000';
    switch (obj.type) {
      case 'staffLine':
      case 'ledger': {
        const opacityAttr = obj.opacity !== undefined ? ` fill-opacity="${obj.opacity.toFixed(2)}"` : '';
        lines.push(`<rect x="${roundTo(obj.x)}" y="${roundTo(obj.y)}" width="${roundTo(obj.width)}" height="${roundTo(obj.height)}" fill="${color}"${opacityAttr}${clip}/>`);
        break;
      }
      case 'barline':
      case 'stem':
        lines.push(`<rect x="${roundTo(obj.x)}" y="${roundTo(obj.y)}" width="${roundTo(obj.width)}" height="${roundTo(obj.height)}" fill="${color}"${clip}/>`);
        break;
      case 'notehead':
        if (obj.filled === false) {
          lines.push(
            `<ellipse cx="${roundTo(obj.x + obj.width / 2)}" cy="${roundTo(obj.y + obj.height / 2)}" rx="${roundTo(obj.width / 2)}" ry="${roundTo(obj.height / 2)}" fill="none" stroke="${color}" stroke-width="1.2"${clip}/>`
          );
        } else {
          lines.push(`<ellipse cx="${roundTo(obj.x + obj.width / 2)}" cy="${roundTo(obj.y + obj.height / 2)}" rx="${roundTo(obj.width / 2)}" ry="${roundTo(obj.height / 2)}" fill="${color}"${clip}/>`);
        }
        break;
      case 'beam':
        if (obj.path) {
          lines.push(`<path d="${obj.path}" fill="${color}"${clip}/>`);
        }
        break;
      case 'clef':
        if (obj.text) {
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          lines.push(
            `<text x="${roundTo(cx)}" y="${roundTo(cy)}" text-anchor="middle" dominant-baseline="middle" font-size="${roundTo(obj.height)}" font-family="${CLEF_FONT}"${clip}>${obj.text}</text>`
          );
        }
        break;
      case 'accidental':
        if (obj.text) {
          const glyph = ACCIDENTAL_GLYPHS[obj.text] ?? obj.text;
          lines.push(
            `<text x="${roundTo(obj.x)}" y="${roundTo(obj.y + obj.height)}" font-size="${roundTo(obj.height * 1.2)}" font-family="${CLEF_FONT}" font-weight="800" fill="${color}"${clip}>${glyph}</text>`
          );
        }
        break;
      case 'dot':
        lines.push(`<circle cx="${roundTo(obj.x + obj.width / 2)}" cy="${roundTo(obj.y + obj.height / 2)}" r="${roundTo(obj.width / 2)}" fill="${color}"${clip}/>`);
        break;
      case 'rest':
        if (obj.text) {
          const fontSize = Math.max(12, obj.height * 2.2) * REST_SCALE;
          const cx = obj.x + obj.width / 2;
          const cy = obj.y + obj.height / 2;
          lines.push(
            `<text x="${roundTo(cx)}" y="${roundTo(cy)}" text-anchor="middle" dominant-baseline="middle" font-size="${roundTo(fontSize)}" font-family="Bravura, 'Noto Music', 'Noto Sans Symbols2', 'Segoe UI Symbol', serif" fill="${color}"${clip}>${obj.text}</text>`
          );
        } else {
          lines.push(`<rect x="${roundTo(obj.x)}" y="${roundTo(obj.y)}" width="${roundTo(obj.width)}" height="${roundTo(obj.height)}" fill="${color}"${clip}/>`);
        }
        break;
      case 'tie':
        if (obj.path) {
          lines.push(`<path d="${obj.path}" fill="none" stroke="${color}" stroke-width="1"${clip}/>`);
        }
        break;
      case 'flag':
        if (obj.path) {
          lines.push(`<path d="${obj.path}" fill="none" stroke="${color}" stroke-width="1"${clip}/>`);
        }
        break;
      case 'debug':
        lines.push(`<rect x="${roundTo(obj.x)}" y="${roundTo(obj.y)}" width="${roundTo(obj.width)}" height="${roundTo(obj.height)}" fill="none" stroke="#ff00ff" stroke-width="0.6"${clip}/>`);
        break;
      case 'flag':
      default:
        break;
    }
  });

  lines.push('</svg>');
  return lines.join('');
};
