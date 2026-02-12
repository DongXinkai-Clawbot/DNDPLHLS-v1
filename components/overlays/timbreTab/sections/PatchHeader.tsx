import React from 'react';
import { Knob } from '../../../common/AudioControls';
import { Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';

type PatchHeaderProps = {
  timbre: any;
  patches: TimbrePatch[];
  activePatch: TimbrePatch;
  updateTimbre: (partial: any) => void;
  updateActive: (partial: Partial<TimbrePatch>) => void;
  onOpenAssistant: () => void;
  onPanic: () => void;
};

export const PatchHeader = ({
  timbre,
  patches,
  activePatch,
  updateTimbre,
  updateActive,
  onOpenAssistant,
  onPanic
}: PatchHeaderProps) => {
  return (
    <div className="flex items-center justify-between bg-gray-900/40 p-2 rounded border border-gray-800">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <Label>Active Patch</Label>
          <Select
            value={timbre.activePatchId}
            onChange={(e) => updateTimbre({ activePatchId: e.target.value })}
          >
            {patches.map((p: TimbrePatch) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className="flex flex-col">
          <Label>Patch Name</Label>
          <input
            className="bg-black/50 border border-gray-700 text-xs text-blue-100 rounded px-2 py-1 outline-none focus:border-blue-500 w-32"
            value={activePatch.name}
            onChange={(e) => updateActive({ name: e.target.value })}
          />
        </div>
        <div className="flex gap-4 ml-4 pl-4 border-l border-gray-700">
          <Knob label="Polyphony" value={activePatch.performance.polyphony} min={1} max={16} step={1} onChange={(v) => updateActive({ performance: { ...activePatch.performance, polyphony: v } })} size={32} />
          <Knob label="Portamento" value={activePatch.performance.portamentoMs} max={500} step={1} onChange={(v) => updateActive({ performance: { ...activePatch.performance, portamentoMs: v } })} size={32} />
          <Knob label="Bend" value={activePatch.performance.pitchBendRangeSemitones ?? 2} min={0} max={24} step={1} onChange={(v) => updateActive({ performance: { ...activePatch.performance, pitchBendRangeSemitones: v } })} size={32} />
          <div className="flex flex-col items-center">
            <Label>Steal</Label>
            <Select
              value={activePatch.performance.voiceSteal || 'release-first'}
              onChange={(e) => updateActive({ performance: { ...activePatch.performance, voiceSteal: e.target.value as any } })}
            >
              <option value="release-first">release-first</option>
              <option value="quietest">quietest</option>
              <option value="oldest">oldest</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAssistant}
          className="text-[9px] bg-blue-900/50 hover:bg-blue-800 text-blue-200 px-2 py-1 rounded border border-blue-800 uppercase font-bold flex items-center gap-1"
        >
          <span>?</span> Agent
        </button>
        <Checkbox
          label="Engine Active"
          checked={timbre.engineMode === 'timbre'}
          onChange={(v) => updateTimbre({ engineMode: v ? 'timbre' : 'basic' })}
        />
        <button onClick={onPanic} className="text-[9px] bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-1 rounded border border-red-800 uppercase font-bold">Panic</button>
      </div>
    </div>
  );
};
