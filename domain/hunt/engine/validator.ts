import type {
  HuntLogicalScore,
  HuntLayoutScore,
  HuntValidationReport,
  HuntValidationIssue,
  HuntEngineConfig,
  HuntLayoutNote
} from './types';
import { clamp } from './utils';

export const validateHuntScore = (
  logical: HuntLogicalScore,
  layout: HuntLayoutScore,
  config: HuntEngineConfig
): HuntValidationReport => {
  const issues: HuntValidationIssue[] = [];
  const maxSlope = config.beamMaxSlope ?? 0.25;

  const noteById = new Map(layout.events.filter((e) => e.kind === 'note').map((n) => [n.id, n] as const));

  // Pitch errors
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    if (note.pitchMap.errorOverLimit) {
      issues.push({
        ruleId: 'R-PITCH-ERROR',
        severity: 'fatal',
        message: 'Pitch mapping error exceeds threshold.',
        measureIndex: note.measureIndex,
        voiceId: note.voiceId,
        tick: note.startTick,
        objectId: note.id,
        suggestion: 'Check pitch spelling or adjust mapping tolerance.'
      });
    }
  });

  // Beam slope and crossing
  layout.beams.forEach((beam) => {
    if (Math.abs(beam.slope) > maxSlope + 1e-4) {
      issues.push({
        ruleId: 'R-BEAM-SLOPE',
        severity: 'error',
        message: 'Beam slope exceeds maximum.',
        measureIndex: beam.measureIndex,
        objectId: beam.id,
        suggestion: 'Clamp beam slope or adjust stem lengths.'
      });
    }
    const measure = logical.measures.find((m) => m.index === beam.measureIndex);
    if (measure) {
      const ticks = beam.noteIds
        .map((id) => noteById.get(id))
        .filter((n): n is HuntLayoutNote => !!n)
        .map((n) => n.startTick);
      const minTick = Math.min(...ticks);
      const maxTick = Math.max(...ticks);
      const forbidden = measure.beatGrid.forbiddenBoundaries;
      const crossed = forbidden.find((t) => t > minTick && t < maxTick);
      if (crossed !== undefined) {
        issues.push({
          ruleId: 'R-BEAM-CROSS',
          severity: 'fatal',
          message: 'Beam group crosses forbidden beat boundary.',
          measureIndex: beam.measureIndex,
          objectId: beam.id,
          tick: crossed,
          suggestion: 'Split rhythm at beat boundary.'
        });
      }
    }
  });

  // Dot placement
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    if (!note.dots || !note.dots.length) return;
    const staff = layout.staffLayouts.find((s) => s.staffId === note.staffId);
    if (!staff) return;
    const isLine = note.pitchMap.zInOct % 2 === 0;
    const expectedZ = isLine ? note.pitchMap.Z + 1 : note.pitchMap.Z;
    const expectedY = staff.top + (staff.drawMaxZ - expectedZ) * staff.lineSpacing;
    const dot = note.dots[0];
    if (Math.abs(dot.y - expectedY) > staff.lineSpacing * 0.45) {
      issues.push({
        ruleId: 'R-DOT-PLACEMENT',
        severity: 'error',
        message: 'Dot placement violates line/space rule.',
        measureIndex: note.measureIndex,
        voiceId: note.voiceId,
        tick: note.startTick,
        objectId: note.id,
        suggestion: 'Move dots to the correct space above the note.'
      });
    }
  });

  // Stem direction
  const staffVoiceAverages = new Map<string, Map<string, number>>();
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    const staffMap = staffVoiceAverages.get(note.staffId) || new Map<string, number>();
    const sum = staffMap.get(note.voiceId) ?? 0;
    staffMap.set(note.voiceId, sum + note.pitchMap.Z);
    staffVoiceAverages.set(note.staffId, staffMap);
  });
  const staffVoiceCounts = new Map<string, Map<string, number>>();
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    const staffMap = staffVoiceCounts.get(note.staffId) || new Map<string, number>();
    staffMap.set(note.voiceId, (staffMap.get(note.voiceId) || 0) + 1);
    staffVoiceCounts.set(note.staffId, staffMap);
  });
  const staffVoiceDirections = new Map<string, Map<string, 'up' | 'down'>>();
  staffVoiceAverages.forEach((avgMap, staffId) => {
    const counts = staffVoiceCounts.get(staffId) || new Map<string, number>();
    const voices = Array.from(avgMap.entries()).map(([voiceId, sum]) => ({ voiceId, avg: sum / Math.max(1, counts.get(voiceId) || 1) }));
    if (voices.length > 1) {
      voices.sort((a, b) => b.avg - a.avg);
      const dirMap = new Map<string, 'up' | 'down'>();
      voices.forEach((voice, idx) => {
        dirMap.set(voice.voiceId, idx === 0 ? 'up' : idx === voices.length - 1 ? 'down' : 'up');
      });
      staffVoiceDirections.set(staffId, dirMap);
    }
  });

  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const note = ev as HuntLayoutNote;
    if (!note.stem) return;
    const staff = layout.staffLayouts.find((s) => s.staffId === note.staffId);
    if (!staff) return;
    const dirMap = staffVoiceDirections.get(note.staffId);
    const expected = dirMap?.get(note.voiceId) || (note.pitchMap.Z >= staff.centerLine ? 'down' : 'up');
    if (note.stem.direction !== expected) {
      issues.push({
        ruleId: 'R-STEM-DIR',
        severity: 'error',
        message: 'Stem direction violates stem rule.',
        measureIndex: note.measureIndex,
        voiceId: note.voiceId,
        tick: note.startTick,
        objectId: note.id,
        suggestion: 'Flip stem direction based on staff rule.'
      });
    }
  });

  // Accidentals overlap
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    if (!ev.accidental) return;
    const noteLeft = ev.notehead.x - ev.notehead.width / 2;
    const accRight = ev.accidental.x + ev.accidental.width;
    if (accRight > noteLeft - 1) {
      issues.push({
        ruleId: 'R-ACCIDENTAL-GAP',
        severity: 'error',
        message: 'Accidental overlaps notehead.',
        measureIndex: ev.measureIndex,
        voiceId: ev.voiceId,
        tick: ev.startTick,
        objectId: ev.id,
        suggestion: 'Increase horizontal spacing or move accidental left.'
      });
    }
  });

  // Tie chain check (basic)
  const notes = layout.events.filter((e) => e.kind === 'note') as HuntLayoutNote[];
  const notesByVoice = new Map<string, HuntLayoutNote[]>();
  notes.forEach((note) => {
    const list = notesByVoice.get(note.voiceId) || [];
    list.push(note);
    notesByVoice.set(note.voiceId, list);
  });
  notesByVoice.forEach((voiceNotes) => {
    const sorted = voiceNotes.sort((a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id));
    sorted.forEach((note, idx) => {
      const endTick = note.startTick + note.durationTicks;
      const pitchKey = `${note.pitchMap.Z}:${note.pitchMap.O}`;
      if (note.tieStart) {
        const next = sorted.find((n) => n.startTick === endTick && `${n.pitchMap.Z}:${n.pitchMap.O}` === pitchKey);
        if (!next) {
          issues.push({
            ruleId: 'R-TIE-CHAIN',
            severity: 'fatal',
            message: 'Tie start without matching following note.',
            measureIndex: note.measureIndex,
            voiceId: note.voiceId,
            tick: note.startTick,
            objectId: note.id,
            suggestion: 'Ensure split notes or tied notes align at the next tick.'
          });
        }
      }
      if (note.tieStop) {
        const prev = sorted.find((n) => n.startTick + n.durationTicks === note.startTick && `${n.pitchMap.Z}:${n.pitchMap.O}` === pitchKey);
        if (!prev) {
          issues.push({
            ruleId: 'R-TIE-CHAIN',
            severity: 'fatal',
            message: 'Tie stop without matching previous note.',
            measureIndex: note.measureIndex,
            voiceId: note.voiceId,
            tick: note.startTick,
            objectId: note.id,
            suggestion: 'Ensure tie stop connects to a previous note with the same pitch.'
          });
        }
      }
    });
  });

  // Crowding stats (simple overlap detection)
  const crowdedAreas: Array<{ measureIndex: number; tick: number; density: number }> = [];
  const byMeasure = new Map<number, HuntLayoutNote[]>();
  layout.events.forEach((ev) => {
    if (ev.kind !== 'note') return;
    const list = byMeasure.get(ev.measureIndex) || [];
    list.push(ev as HuntLayoutNote);
    byMeasure.set(ev.measureIndex, list);
  });

  byMeasure.forEach((notes, measureIndex) => {
    notes.sort((a, b) => a.startTick - b.startTick);
    for (let i = 1; i < notes.length; i += 1) {
      const prev = notes[i - 1];
      const curr = notes[i];
      const overlap = Math.max(0, prev.bbox.x + prev.bbox.width - curr.bbox.x);
      if (overlap > 0) {
        const density = clamp(overlap / Math.max(1, prev.bbox.width), 0, 1);
        crowdedAreas.push({ measureIndex, tick: curr.startTick, density });
        issues.push({
          ruleId: 'R-CROWDING',
          severity: 'warning',
          message: 'Local spacing is crowded.',
          measureIndex,
          tick: curr.startTick,
          objectId: curr.id,
          suggestion: 'Increase spacing or reduce symbols in the area.'
        });
      }
    }
  });

  const stats = {
    fatalCount: issues.filter((i) => i.severity === 'fatal').length,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    byRule: {} as Record<string, number>,
    crowdedAreas
  };

  issues.forEach((issue) => {
    stats.byRule[issue.ruleId] = (stats.byRule[issue.ruleId] || 0) + 1;
  });

  return { issues, stats };
};
