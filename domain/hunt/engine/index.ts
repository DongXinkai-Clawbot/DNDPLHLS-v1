import type { MusicXmlImportResult } from '../../musicxml/types';
import type { HuntEngineConfig, HuntEngineResult, HuntMeasure, HuntEvent, HuntLogicalScore } from './types';
import { HuntLogger } from './logger';
import { buildLogicalScore } from './normalize';
import { splitScoreByGrid } from './splitRhythm';
import { applyPitchMapping } from './pitchAssign';
import { layoutHuntScore } from './layout';
import { buildRenderScore, renderSvg } from './render';
import { validateHuntScore } from './validator';
import { DEFAULT_HUNT_ENGINE_CONFIG } from './defaults';

const rebuildPartsFromMeasures = (logical: HuntLogicalScore, measures: HuntMeasure[]) => {
  const eventMap = new Map<string, HuntEvent[]>();
  measures.forEach((measure) => {
    measure.events.forEach((ev) => {
      const key = `${ev.partId}|${ev.staffIndex}|${ev.voiceId}`;
      const list = eventMap.get(key) || [];
      list.push(ev);
      eventMap.set(key, list);
    });
  });

  const parts = logical.parts.map((part) => {
    const staves = part.staves.map((staff) => {
      const voices = staff.voices.map((voice) => {
        const key = `${part.id}|${staff.staffIndex}|${voice.id}`;
        const events = eventMap.get(key) || [];
        return { ...voice, events: events.sort((a, b) => a.startTick - b.startTick || a.id.localeCompare(b.id)) };
      });
      return { ...staff, voices };
    });
    return { ...part, staves };
  });

  return { ...logical, parts };
};

export const buildHuntEngine = (
  importResult: MusicXmlImportResult,
  config: HuntEngineConfig = {}
): HuntEngineResult => {
  const mergedConfig: HuntEngineConfig = {
    ...DEFAULT_HUNT_ENGINE_CONFIG,
    ...config,
    ticksPerQuarter: config.ticksPerQuarter ?? importResult.ticksPerQuarter ?? DEFAULT_HUNT_ENGINE_CONFIG.ticksPerQuarter
  };
  const logger = new HuntLogger();
  const logical = buildLogicalScore(importResult, mergedConfig, logger);
  const splitMeasures = splitScoreByGrid(logical.measures, mergedConfig, logger);
  const mappedMeasures = applyPitchMapping(splitMeasures, mergedConfig, logger);
  const mappedLogical = rebuildPartsFromMeasures({ ...logical, measures: mappedMeasures }, mappedMeasures);
  const layout = layoutHuntScore(mappedLogical, mergedConfig, logger);
  const render = buildRenderScore(layout, mergedConfig);
  const validation = validateHuntScore(mappedLogical, layout, mergedConfig);

  return {
    logical: mappedLogical,
    layout,
    render,
    validation,
    logs: logger.flush()
  };
};

export const exportHuntSvg = (result: HuntEngineResult) => {
  return renderSvg(result.render);
};
