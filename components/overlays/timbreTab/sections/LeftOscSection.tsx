import React from 'react';
import { Knob } from '../../../common/AudioControls';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';
import { createPatchId } from '../helpers';
import { parseOptional } from '../sectionUtils';

type LeftOscSectionProps = {
  activePatch: TimbrePatch;
  activeOscTab: number;
  setActiveOscTab: (value: number) => void;
  updateVoice: (partial: Partial<TimbrePatch['voice']>) => void;
  updateOsc: (idx: number, partial: Partial<TimbrePatch['voice']['oscBank']['oscillators'][0]>) => void;
  advancedPanels: Record<string, boolean>;
  togglePanel: (key: string) => void;
};

export const LeftOscSection = ({
  activePatch,
  activeOscTab,
  setActiveOscTab,
  updateVoice,
  updateOsc,
  advancedPanels,
  togglePanel
}: LeftOscSectionProps) => {
  return (
    <>
      <Section title="Oscillators">
        <div className="flex justify-between items-center mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.oscBank.enabled} onChange={(v) => updateVoice({ oscBank: { ...activePatch.voice.oscBank, enabled: v } })} />
          <button
            onClick={() => togglePanel('osc')}
            className="text-[9px] text-gray-400 hover:text-white px-1"
          >
            {advancedPanels.osc ? 'Hide' : 'More'}
          </button>
        </div>

        <div className="flex gap-1 mb-2 border-b border-gray-800/50 pb-2 overflow-x-auto">
          {activePatch.voice.oscBank.oscillators.map((osc, idx) => (
            <button
              key={osc.id || idx}
              onClick={() => setActiveOscTab(idx)}
              className={`px-3 py-1 text-[9px] font-bold rounded transition-colors ${activeOscTab === idx ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              OSC {idx + 1}
            </button>
          ))}
          <button
            onClick={() => updateVoice({ oscBank: { ...activePatch.voice.oscBank, oscillators: [...activePatch.voice.oscBank.oscillators, { id: createPatchId(), type: 'sine', gain: 0.4 }] } })}
            className="px-2 py-1 text-[9px] bg-gray-800 rounded text-gray-400 hover:text-white"
          >+
          </button>
        </div>

        {activePatch.voice.oscBank.oscillators[activeOscTab] && (
          <SubSection title={`Oscillator ${activeOscTab + 1} `}>
            {(() => {
              const osc = activePatch.voice.oscBank.oscillators[activeOscTab];
              const wtCount = osc.wavetables && osc.wavetables.length > 0 ? osc.wavetables.length : (osc.wavetable ? 2 : 1);
              const wtMax = Math.max(1, wtCount - 1);
              const sample = osc.sample || { baseHz: 440, loop: false };
              return (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <Select
                      value={osc.type}
                      onChange={(e) => updateOsc(activeOscTab, { type: e.target.value as any })}
                    >
                      {['sine', 'triangle', 'square', 'sawtooth', 'pulse', 'noise', 'wavetable', 'sample'].map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                    <button onClick={() => updateVoice({ oscBank: { ...activePatch.voice.oscBank, oscillators: activePatch.voice.oscBank.oscillators.filter((_, i) => i !== activeOscTab) } })} className="text-[9px] text-red-500 hover:text-red-300">Remove</button>
                  </div>
                  <div className="flex justify-around">
                    <Knob label="Gain" value={osc.gain} onChange={(v) => updateOsc(activeOscTab, { gain: v })} size={40} />
                    <Knob label="Detune" value={osc.detuneCents || 0} min={-100} max={100} step={1} onChange={(v) => updateOsc(activeOscTab, { detuneCents: v })} size={40} />
                    {osc.type === 'pulse' && (
                      <Knob label="Pulse W" value={osc.pulseWidth || 0.5} onChange={(v) => updateOsc(activeOscTab, { pulseWidth: v })} size={40} />
                    )}
                  </div>
                  {advancedPanels.osc && osc.type === 'wavetable' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Knob
                        label="WT Morph"
                        value={osc.wavetableMorph ?? 0}
                        min={0}
                        max={wtMax}
                        step={0.01}
                        onChange={(v) => updateOsc(activeOscTab, { wavetableMorph: v })}
                        size={30}
                      />
                      <div className="col-span-2 text-[9px] text-gray-500 self-center">
                        {wtCount > 1 ? `Tables: ${wtCount}` : 'No wavetable stack'}
                      </div>
                    </div>
                  )}
                  {advancedPanels.osc && osc.type === 'sample' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Knob
                        label="Base Hz"
                        value={sample.baseHz || 440}
                        min={20}
                        max={20000}
                        step={1}
                        onChange={(v) => updateOsc(activeOscTab, { sample: { ...sample, baseHz: v } })}
                        size={30}
                      />
                      <div className="flex items-center">
                        <Checkbox
                          label="Loop"
                          checked={sample.loop}
                          onChange={(v) => updateOsc(activeOscTab, { sample: { ...sample, loop: v } })}
                        />
                      </div>
                      <div className="flex flex-col items-center">
                        <Label>Loop Mode</Label>
                        <Select
                          value={sample.loopMode || 'oneshot'}
                          onChange={(e) => updateOsc(activeOscTab, { sample: { ...sample, loopMode: e.target.value as any } })}
                        >
                          <option value="oneshot">oneshot</option>
                          <option value="loop">loop</option>
                          <option value="pingpong">pingpong</option>
                        </Select>
                      </div>
                      <div className="flex flex-col">
                        <Label>Root Key</Label>
                        <input
                          type="text"
                          value={sample.rootKey ?? ''}
                          onChange={(e) => updateOsc(activeOscTab, { sample: { ...sample, rootKey: e.target.value } })}
                          className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label>Loop Start</Label>
                        <input
                          type="number"
                          step="0.001"
                          value={sample.loopStart ?? ''}
                          onChange={(e) => updateOsc(activeOscTab, { sample: { ...sample, loopStart: parseOptional(e.target.value) } })}
                          className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label>Loop End</Label>
                        <input
                          type="number"
                          step="0.001"
                          value={sample.loopEnd ?? ''}
                          onChange={(e) => updateOsc(activeOscTab, { sample: { ...sample, loopEnd: parseOptional(e.target.value) } })}
                          className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                        />
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </SubSection>
        )}
      </Section>

      <Section title="Unison">
        <div className="flex items-center justify-between mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.unison?.enabled || false} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, enabled: v } })} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Knob label="Voices" value={activePatch.voice.unison?.voices || 1} min={1} max={16} step={1} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, voices: v } })} size={32} />
          <Knob label="Detune" value={activePatch.voice.unison?.detune || 0} max={50} step={0.1} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, detune: v } })} size={32} />
          <Knob label="Spread" value={activePatch.voice.unison?.spread || 0} max={1} step={0.01} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, spread: v } })} size={32} />
          <Knob label="Blend" value={activePatch.voice.unison?.blend || 0} max={1} step={0.01} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, blend: v } })} size={32} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Knob label="Phase" value={activePatch.voice.unison?.phase || 0} max={1} step={0.01} onChange={(v) => updateVoice({ unison: { ...activePatch.voice.unison, phase: v } })} size={30} />
        </div>
      </Section>
    </>
  );
};
