import React from 'react';
import { XYPad, Knob, ADSRGraph } from '../../../common/AudioControls';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';
import { mapRange } from '../helpers';
import { parseNum, parseOptional, parseOptionalInt } from '../sectionUtils';
import { LFO_WAVES, MOD_CURVES, SYNC_DIVISIONS } from '../constants';

type TimbreMiddleColumnProps = {
  activePatch: TimbrePatch;
  updateVoice: (partial: Partial<TimbrePatch['voice']>) => void;
  updateActive: (partial: Partial<TimbrePatch>) => void;
  updateFmOperator: (idx: number, partial: Partial<TimbrePatch['voice']['fmOperators']['operators'][0]>) => void;
  advancedPanels: Record<string, boolean>;
  togglePanel: (key: string) => void;
  lfoAdvanced: Record<string, boolean>;
  setLfoAdvanced: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

export const TimbreMiddleColumn = ({
  activePatch,
  updateVoice,
  updateActive,
  updateFmOperator,
  advancedPanels,
  togglePanel,
  lfoAdvanced,
  setLfoAdvanced
}: TimbreMiddleColumnProps) => {
  const renderLfo = (key: 'lfo1' | 'lfo2' | 'lfo3' | 'lfo4', label: string, border?: boolean) => {
    const lfo = activePatch.voice.lfo[key];
    const isAdvanced = lfoAdvanced[key];
    return (
      <div className={border ? 'border-r border-gray-800/50 pr-2' : ''}>
        <div className="flex justify-between mb-1">
          <Label>{label}</Label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLfoAdvanced(prev => ({ ...prev, [key]: !prev[key] }))}
              className="text-[8px] text-gray-400 hover:text-white px-1"
            >
              {isAdvanced ? 'Hide' : 'More'}
            </button>
            <Checkbox
              label=""
              checked={lfo.enabled}
              onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, enabled: v } } })}
            />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select
            value={lfo.waveform}
            onChange={(e) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, waveform: e.target.value as any } } })}
          >
            {LFO_WAVES.map(w => <option key={w} value={w}>{w}</option>)}
          </Select>
          <Knob label="Rate" value={lfo.rateHz} max={20} onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, rateHz: v } } })} size={32} />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Checkbox
            label="Sync"
            checked={lfo.tempoSync ?? false}
            onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, tempoSync: v } } })}
          />
          {lfo.tempoSync && (
            <Select
              value={lfo.syncDivision || '1/4'}
              onChange={(e) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, syncDivision: e.target.value as any } } })}
            >
              {SYNC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          )}
        </div>
        {isAdvanced && (
          <>
            <div className="grid grid-cols-3 gap-1 mt-1">
              <Knob label="Phase" value={lfo.phase || 0} min={0} max={1} step={0.01} onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, phase: v } } })} size={28} />
              <Knob label="Fade" value={lfo.fadeInMs || 0} min={0} max={2000} step={1} onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, fadeInMs: v } } })} size={28} />
              <div className="flex flex-col items-center">
                <Label>Curve</Label>
                <Select
                  value={lfo.curve || 'linear'}
                  onChange={(e) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, curve: e.target.value as any } } })}
                >
                  {MOD_CURVES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div className="flex flex-col">
                <Label>Curve Amt</Label>
                <input
                  type="number"
                  step="0.1"
                  value={lfo.curveAmount ?? ''}
                  onChange={(e) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, curveAmount: parseOptional(e.target.value) } } })}
                  className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                />
              </div>
              <div className="flex flex-col">
                <Label>Steps</Label>
                <input
                  type="number"
                  step="1"
                  value={lfo.curveSteps ?? ''}
                  onChange={(e) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, curveSteps: parseOptionalInt(e.target.value) } } })}
                  className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                label="One-shot"
                checked={lfo.oneShot ?? false}
                onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, oneShot: v } } })}
              />
              <Checkbox
                label="Retrig"
                checked={lfo.retrigger ?? true}
                onChange={(v) => updateVoice({ lfo: { ...activePatch.voice.lfo, [key]: { ...lfo, retrigger: v } } })}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="col-span-4 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
      <Section title="Filter">
        <div className="flex justify-between items-center mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.filter.enabled} onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, enabled: v } })} />
          <div className="flex gap-2">
            <Select
              value={activePatch.voice.filter.type}
              onChange={(e) => updateVoice({ filter: { ...activePatch.voice.filter, type: e.target.value as any } })}
            >
              {['lowpass', 'highpass', 'bandpass', 'notch', 'peaking', 'lowshelf', 'highshelf', 'allpass', 'svf', 'comb', 'formant'].map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select
              value={activePatch.voice.filter.slope || 12}
              onChange={(e) => updateVoice({ filter: { ...activePatch.voice.filter, slope: parseInt(e.target.value, 10) as 12 | 24 } })}
            >
              <option value={12}>12 dB</option>
              <option value={24}>24 dB</option>
            </Select>
            <button
              onClick={() => togglePanel('filter')}
              className="text-[9px] text-gray-400 hover:text-white px-1"
            >
              {advancedPanels.filter ? 'Hide' : 'More'}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 flex flex-col items-center">
            <Label>Cutoff / Res</Label>
            <XYPad
              x={mapRange(activePatch.voice.filter.cutoffHz, 20, 20000, 0, 1)}
              y={activePatch.voice.filter.q / 20}
              onChange={(x, y) => {
                updateVoice({
                  filter: {
                    ...activePatch.voice.filter,
                    cutoffHz: mapRange(x, 0, 1, 20, 20000),
                    q: y * 20
                  }
                });
              }}
              size={120}
              labelX="Freq"
              labelY="Res"
            />
          </div>
          <div className="flex flex-col gap-2 justify-center">
            <Knob
              label="Env Amt"
              value={activePatch.voice.filter.envAmount ?? activePatch.voice.envelopes.filter.amount}
              min={-1}
              max={1}
              onChange={(v) => updateVoice({
                filter: { ...activePatch.voice.filter, envAmount: v },
                envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, amount: v } }
              })}
              size={36}
            />
            <Knob label="LFO Amt" value={activePatch.voice.filter.lfoAmount ?? 0} max={1} onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, lfoAmount: v } })} size={36} />
            <Knob label="KeyTrack" value={activePatch.voice.filter.keyTracking} onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, keyTracking: v } })} size={36} />
          </div>
        </div>
        {advancedPanels.filter && (
          <SubSection title="Advanced Filter">
            <div className="grid grid-cols-3 gap-2">
              <Knob
                label="Key Base"
                value={activePatch.voice.filter.keyTrackingBaseHz || 261.63}
                min={20}
                max={2000}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, keyTrackingBaseHz: v } })}
                size={32}
              />
              <Knob
                label="Comb Mix"
                value={activePatch.voice.filter.comb?.mix || 0}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, comb: { ...activePatch.voice.filter.comb, mix: v } } })}
                size={32}
              />
              <Knob
                label="Comb Freq"
                value={activePatch.voice.filter.comb?.freqHz || 440}
                min={20}
                max={5000}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, comb: { ...activePatch.voice.filter.comb, freqHz: v } } })}
                size={32}
              />
              <Knob
                label="Comb FB"
                value={activePatch.voice.filter.comb?.feedback || 0}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, comb: { ...activePatch.voice.filter.comb, feedback: v } } })}
                size={32}
              />
              <Knob
                label="Comb Damp"
                value={activePatch.voice.filter.comb?.dampingHz || 6000}
                min={200}
                max={12000}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, comb: { ...activePatch.voice.filter.comb, dampingHz: v } } })}
                size={32}
              />
              <Knob
                label="Formant Mix"
                value={activePatch.voice.filter.formant?.mix || 0}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, mix: v } } })}
                size={32}
              />
              <Knob
                label="Formant Morph"
                value={activePatch.voice.filter.formant?.morph || 0}
                onChange={(v) => updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, morph: v } } })}
                size={32}
              />
              <div className="flex flex-col items-center">
                <Label>Vowel</Label>
                <Select
                  value={activePatch.voice.filter.formant?.vowel || 'a'}
                  onChange={(e) => updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, vowel: e.target.value as any } } })}
                >
                  {['a', 'e', 'i', 'o', 'u'].map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
            </div>

            {(activePatch.voice.filter.type === 'formant' || (activePatch.voice.filter.formant?.peaks?.length ?? 0) > 0) && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <Label>Formant Peaks</Label>
                  <button
                    onClick={() => {
                      const peaks = [...(activePatch.voice.filter.formant?.peaks || []), { freq: 500, q: 3, gain: 1 }];
                      updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, peaks } } });
                    }}
                    className="text-[9px] text-gray-400 hover:text-white"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1">
                  {(activePatch.voice.filter.formant?.peaks || []).map((peak, idx) => (
                    <div key={`formant-peak-${idx}`} className="grid grid-cols-4 gap-2 items-center">
                      <input
                        type="number"
                        step="1"
                        value={peak.freq}
                        onChange={(e) => {
                          const peaks = [...(activePatch.voice.filter.formant?.peaks || [])];
                          peaks[idx] = { ...peaks[idx], freq: parseNum(e.target.value, peak.freq) };
                          updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, peaks } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={peak.q}
                        onChange={(e) => {
                          const peaks = [...(activePatch.voice.filter.formant?.peaks || [])];
                          peaks[idx] = { ...peaks[idx], q: parseNum(e.target.value, peak.q) };
                          updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, peaks } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={peak.gain}
                        onChange={(e) => {
                          const peaks = [...(activePatch.voice.filter.formant?.peaks || [])];
                          peaks[idx] = { ...peaks[idx], gain: parseNum(e.target.value, peak.gain) };
                          updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, peaks } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <button
                        onClick={() => {
                          const peaks = (activePatch.voice.filter.formant?.peaks || []).filter((_, i) => i !== idx);
                          updateVoice({ filter: { ...activePatch.voice.filter, formant: { ...activePatch.voice.filter.formant, peaks } } });
                        }}
                        className="text-[9px] text-red-500 hover:text-red-300"
                      >
                        
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SubSection>
        )}
      </Section>

      <Section title="FM Operators">
        <div className="flex justify-between items-center mb-2">
          <Checkbox
            label="Enable"
            checked={activePatch.voice.fmOperators.enabled}
            onChange={(v) => updateVoice({ fmOperators: { ...activePatch.voice.fmOperators, enabled: v } })}
          />
          <div className="flex items-center gap-2">
            <Select
              value={activePatch.voice.fmOperators.algorithm}
              onChange={(e) => updateVoice({ fmOperators: { ...activePatch.voice.fmOperators, algorithm: e.target.value as any } })}
            >
              {['algo1', 'algo2', 'algo3', 'algo4', 'algo5', 'algo6', 'algo7', 'algo8'].map(algo => (
                <option key={algo} value={algo}>{algo}</option>
              ))}
            </Select>
            <Checkbox
              label="Safe"
              checked={activePatch.voice.fmOperators.safeMode ?? false}
              onChange={(v) => updateVoice({ fmOperators: { ...activePatch.voice.fmOperators, safeMode: v } })}
            />
            <button
              onClick={() => togglePanel('fmOps')}
              className="text-[9px] text-gray-400 hover:text-white px-1"
            >
              {advancedPanels.fmOps ? 'Hide' : 'More'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {activePatch.voice.fmOperators.operators.map((op, idx) => {
            const env = op.env;
            return (
              <SubSection key={`fm-op-${idx}`} title={`Operator ${idx + 1}`}>
                <div className="grid grid-cols-3 gap-2">
                  <Knob label="Ratio" value={op.ratio} max={16} step={0.1} onChange={(v) => updateFmOperator(idx, { ratio: v })} size={30} />
                  <Knob label="Detune" value={op.detuneCents} min={-100} max={100} step={1} onChange={(v) => updateFmOperator(idx, { detuneCents: v })} size={30} />
                  <Knob label="Level" value={op.level} max={2} step={0.01} onChange={(v) => updateFmOperator(idx, { level: v })} size={30} />
                  <Knob label="Feedback" value={op.feedback ?? 0} max={4} step={0.01} onChange={(v) => updateFmOperator(idx, { feedback: v })} size={30} />
                  <Knob label="KeyScale" value={op.keyScaling ?? 0} max={1} step={0.01} onChange={(v) => updateFmOperator(idx, { keyScaling: v })} size={30} />
                </div>

                {advancedPanels.fmOps && (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        label="Custom Env"
                        checked={!!env}
                        onChange={(v) => {
                          if (v) {
                            updateFmOperator(idx, { env: { ...activePatch.voice.envelopes.amp } });
                          } else {
                            updateFmOperator(idx, { env: undefined });
                          }
                        }}
                      />
                    </div>
                    {env && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <Knob label="Atk" value={env.attackMs} max={2000} step={10} onChange={(v) => updateFmOperator(idx, { env: { ...env, attackMs: v } })} size={28} />
                        <Knob label="Dec" value={env.decayMs} max={5000} step={10} onChange={(v) => updateFmOperator(idx, { env: { ...env, decayMs: v } })} size={28} />
                        <Knob label="Sus" value={env.sustain} max={1} step={0.01} onChange={(v) => updateFmOperator(idx, { env: { ...env, sustain: v } })} size={28} />
                        <Knob label="Rel" value={env.releaseMs} max={5000} step={10} onChange={(v) => updateFmOperator(idx, { env: { ...env, releaseMs: v } })} size={28} />
                      </div>
                    )}
                  </>
                )}
              </SubSection>
            );
          })}
        </div>
      </Section>

      <Section title="LFOs">
        <div className="grid grid-cols-2 gap-4">
          {renderLfo('lfo1', 'LFO 1', true)}
          {renderLfo('lfo2', 'LFO 2')}
          {renderLfo('lfo3', 'LFO 3', true)}
          {renderLfo('lfo4', 'LFO 4')}
        </div>
      </Section>

      <Section title="Amp Envelope (AHDSR)">
        <ADSRGraph
          a={activePatch.voice.envelopes.amp.attackMs || 0}
          d={activePatch.voice.envelopes.amp.decayMs || 0}
          s={activePatch.voice.envelopes.amp.sustain || 1}
          r={activePatch.voice.envelopes.amp.releaseMs || 0}
          onChange={(k, v) => {
            const map: any = { a: 'attackMs', d: 'decayMs', s: 'sustain', r: 'releaseMs' };
            updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, [map[k]]: v } } });
          }}
        />
        <div className="grid grid-cols-6 gap-1 mt-2 items-end">
          <Knob label="Attack" value={activePatch.voice.envelopes.amp.attackMs || 0} max={2000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, attackMs: v } } })} size={32} />
          <Knob label="Hold" value={activePatch.voice.envelopes.amp.holdMs || 0} max={2000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, holdMs: v } } })} size={32} />
          <Knob label="Decay" value={activePatch.voice.envelopes.amp.decayMs || 0} max={5000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, decayMs: v } } })} size={32} />
          <Knob label="Sustain" value={activePatch.voice.envelopes.amp.sustain || 1} max={1} step={0.01} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, sustain: v } } })} size={32} />
          <Knob label="Release" value={activePatch.voice.envelopes.amp.releaseMs || 0} max={5000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, releaseMs: v } } })} size={32} />
          <Knob label="Spec" value={activePatch.voice.envelopes.spectralDecay.amount} max={1} step={0.01} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, spectralDecay: { ...activePatch.voice.envelopes.spectralDecay, amount: v } } })} size={32} />
        </div>
        <SubSection title="Advanced">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <Label>Curve</Label>
              <Select
                value={activePatch.voice.envelopes.amp.curve || 'linear'}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, curve: e.target.value as any } } })}
              >
                {MOD_CURVES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="flex flex-col">
              <Label>Curve Amt</Label>
              <input
                type="number"
                step="0.1"
                value={activePatch.voice.envelopes.amp.curveAmount ?? ''}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, curveAmount: parseOptional(e.target.value) } } })}
                className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
              />
            </div>
            <div className="flex flex-col">
              <Label>Curve Steps</Label>
              <input
                type="number"
                step="1"
                value={activePatch.voice.envelopes.amp.curveSteps ?? ''}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, amp: { ...activePatch.voice.envelopes.amp, curveSteps: parseOptionalInt(e.target.value) } } })}
                className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
              />
            </div>
            <div className="flex flex-col items-center">
              <Label>Spec Curve</Label>
              <Knob
                label="Curve"
                value={activePatch.voice.envelopes.spectralDecay.curve}
                max={4}
                step={0.05}
                onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, spectralDecay: { ...activePatch.voice.envelopes.spectralDecay, curve: v } } })}
                size={32}
              />
            </div>
            <div className="flex flex-col items-center">
              <Label>Spec Max</Label>
              <Knob
                label="Max"
                value={activePatch.voice.envelopes.spectralDecay.maxMultiplier}
                max={10}
                step={0.1}
                onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, spectralDecay: { ...activePatch.voice.envelopes.spectralDecay, maxMultiplier: v } } })}
                size={32}
              />
            </div>
          </div>
        </SubSection>
      </Section>

      <Section title="Filter Envelope (AHDSR)">
        <Checkbox label="Enable" checked={activePatch.voice.envelopes.filter.enabled} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, enabled: v } } })} className="mb-2" />
        <div className="grid grid-cols-6 gap-1">
          <Knob label="Amount" value={activePatch.voice.envelopes.filter.amount} max={1} min={-1} step={0.01} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, amount: v } } })} size={32} />
          <Knob label="Attack" value={activePatch.voice.envelopes.filter.attackMs || 0} max={2000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, attackMs: v } } })} size={32} />
          <Knob label="Hold" value={activePatch.voice.envelopes.filter.holdMs || 0} max={2000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, holdMs: v } } })} size={32} />
          <Knob label="Decay" value={activePatch.voice.envelopes.filter.decayMs || 0} max={5000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, decayMs: v } } })} size={32} />
          <Knob label="Sustain" value={activePatch.voice.envelopes.filter.sustain || 1} max={1} step={0.01} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, sustain: v } } })} size={32} />
          <Knob label="Release" value={activePatch.voice.envelopes.filter.releaseMs || 0} max={5000} step={10} onChange={(v) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, releaseMs: v } } })} size={32} />
        </div>
        <SubSection title="Advanced">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center">
              <Label>Curve</Label>
              <Select
                value={activePatch.voice.envelopes.filter.curve || 'linear'}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, curve: e.target.value as any } } })}
              >
                {MOD_CURVES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="flex flex-col">
              <Label>Curve Amt</Label>
              <input
                type="number"
                step="0.1"
                value={activePatch.voice.envelopes.filter.curveAmount ?? ''}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, curveAmount: parseOptional(e.target.value) } } })}
                className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
              />
            </div>
            <div className="flex flex-col">
              <Label>Curve Steps</Label>
              <input
                type="number"
                step="1"
                value={activePatch.voice.envelopes.filter.curveSteps ?? ''}
                onChange={(e) => updateVoice({ envelopes: { ...activePatch.voice.envelopes, filter: { ...activePatch.voice.envelopes.filter, curveSteps: parseOptionalInt(e.target.value) } } })}
                className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
              />
            </div>
          </div>
        </SubSection>
      </Section>

      <Section title="Performance & Quality">
        <div className="grid grid-cols-4 gap-2">
          <Knob
            label="Max Partials"
            value={activePatch.performance.maxPartials}
            min={4}
            max={128}
            step={1}
            onChange={(v) => updateActive({ performance: { ...activePatch.performance, maxPartials: v } })}
            size={36}
          />
          <Knob
            label="Rebuild Xfade"
            value={activePatch.performance.rebuildCrossfadeMs || 0}
            min={0}
            max={200}
            step={1}
            onChange={(v) => updateActive({ performance: { ...activePatch.performance, rebuildCrossfadeMs: v } })}
            size={36}
          />
          <div className="flex flex-col items-center">
            <Label>Velocity</Label>
            <Select
              value={activePatch.performance.velocityCurve || 'linear'}
              onChange={(e) => updateActive({ performance: { ...activePatch.performance, velocityCurve: e.target.value as any } })}
            >
              <option value="linear">linear</option>
              <option value="soft">soft</option>
              <option value="hard">hard</option>
            </Select>
          </div>
          <div className="flex flex-col items-center">
            <Label>Release</Label>
            <Select
              value={activePatch.performance.releaseMode || 'normal'}
              onChange={(e) => updateActive({ performance: { ...activePatch.performance, releaseMode: e.target.value as any } })}
            >
              <option value="normal">normal</option>
              <option value="cut">cut</option>
            </Select>
          </div>
        </div>
      </Section>
    </div>
  );
};
