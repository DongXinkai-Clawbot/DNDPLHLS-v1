import type { HuntMeasure, HuntNoteEvent, HuntEngineConfig } from './types';
import { HuntLogger } from './logger';
import { mapPitchToHunt } from './pitchMap';

export const applyPitchMapping = (
  measures: HuntMeasure[],
  config: HuntEngineConfig,
  logger: HuntLogger
): HuntMeasure[] => {
  return measures.map((measure) => {
    const events = measure.events.map((event) => {
      if (event.kind !== 'note') return event;
      const note = event as HuntNoteEvent;
      if (!note.pitch) return event;
      const mapping = mapPitchToHunt(note.pitch, config);
      if (mapping.errorOverLimit) {
        logger.error('Pitch mapping error exceeds threshold.', {
          measureIndex: note.measureIndex,
          tick: note.startTick,
          objectId: note.id,
          data: { errorCents: mapping.errorCents }
        });
      }
      return { ...note, pitchMap: mapping } as HuntNoteEvent;
    });
    return { ...measure, events };
  });
};
