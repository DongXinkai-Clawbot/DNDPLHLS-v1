import React, { useMemo } from 'react';
import type { ScoreDocument, ScoreEvent } from '../../../../../domain/scoreTimeline/types';
import { parseGeneralRatio } from '../../../../../musicLogic';
import { bigGcd, getNoteNameFromMidi } from './helpers';

type Props = {
  scoreDoc: ScoreDocument;
  playhead: number;
  hiddenVoiceIds: Set<string>;
};

export const InstantaneousChordDisplay = ({ scoreDoc, playhead, hiddenVoiceIds }: Props) => {
  const activeEvents = useMemo(() => {
    const events: ScoreEvent[] = [];
    scoreDoc.voices.forEach(voice => {
      if (hiddenVoiceIds.has(voice.voiceId)) return;
      voice.events.forEach(e => {
        if (e.type === 'note' && e.t0 <= playhead && e.t1 >= playhead) {
          events.push(e);
        }
      });
    });
    return events.sort((a, b) => a.midiNote && b.midiNote ? a.midiNote - b.midiNote : 0);
  }, [scoreDoc, playhead, hiddenVoiceIds]);

  const chordRatioStr = useMemo(() => {
    const fractions = activeEvents
      .map(e => e.ratioFraction || (e.ratio ? parseGeneralRatio(e.ratio) : null))
      .filter(f => f !== null) as { n: bigint, d: bigint }[];

    if (fractions.length === 0) return '';
    if (fractions.length === 1) return '1/1';

    let lcmDenom = 1n;
    fractions.forEach(f => {
      lcmDenom = (lcmDenom * f.d) / bigGcd(lcmDenom, f.d);
    });

    const numerators = fractions.map(f => f.n * (lcmDenom / f.d));
    let commonGcd = numerators[0];
    for (let i = 1; i < numerators.length; i++) {
      commonGcd = bigGcd(commonGcd, numerators[i]);
    }

    const parts = numerators.map(num => (num / commonGcd).toString());
    return parts.join(':');
  }, [activeEvents]);

  if (activeEvents.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 bg-black/80 border border-emerald-900/50 rounded p-2 z-20 pointer-events-none">
      <div className="text-[10px] uppercase font-bold text-emerald-500 mb-1">Instantaneous Chord</div>
      {chordRatioStr && (
        <div className="mb-2 text-[13px] font-mono font-bold text-white text-right border-b border-emerald-900/50 pb-1">
          {chordRatioStr}
        </div>
      )}
      <div className="flex flex-col gap-1 items-end">
        {activeEvents.map((e) => (
          <div key={e.id} className="text-[11px] text-gray-400">
            {getNoteNameFromMidi(e.midiNote)}
          </div>
        ))}
      </div>
    </div>
  );
};

