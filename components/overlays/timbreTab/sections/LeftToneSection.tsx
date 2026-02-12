import React from 'react';
import { BarChartEditor, Knob, Fader } from '../../../common/AudioControls';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';
import { TIMBRE_MOD_SOURCES } from '../../../../timbreEngine/paramRegistry';
import { ensureTable } from '../helpers';
import { parseNum } from '../sectionUtils';

type LeftToneSectionProps = {
  activePatch: TimbrePatch;
  updateVoice: (partial: Partial<TimbrePatch['voice']>) => void;
  updateActive: (partial: Partial<TimbrePatch>) => void;
  updateVa: (partial: Partial<TimbrePatch['voice']['vaOsc']>) => void;
  advancedPanels: Record<string, boolean>;
  togglePanel: (key: string) => void;
};

export const LeftToneSection = ({
  activePatch,
  updateVoice,
  updateActive,
  updateVa,
  advancedPanels,
  togglePanel
}: LeftToneSectionProps) => {
  return (
    <>
      <Section title="VA Synth">
        <div className="flex justify-between items-center mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.vaOsc.enabled} onChange={(v) => updateVa({ enabled: v })} />
          <div className="flex items-center gap-2">
            <Checkbox
              label="Sync Osc2"
              checked={activePatch.voice.vaOsc.syncOsc2 ?? false}
              onChange={(v) => updateVa({ syncOsc2: v })}
            />
            <button
              onClick={() => togglePanel('va')}
              className="text-[9px] text-gray-400 hover:text-white px-1"
            >
              {advancedPanels.va ? 'Hide' : 'More'}
            </button>
          </div>
        </div>

        {([
          { key: 'osc1', label: 'Osc 1' },
          { key: 'osc2', label: 'Osc 2' },
          { key: 'subOsc', label: 'Sub Osc' },
          { key: 'noiseOsc', label: 'Noise Osc' }
        ] as const).map((oscDef) => {
          const osc = activePatch.voice.vaOsc[oscDef.key];
          return (
            <SubSection key={oscDef.key} title={oscDef.label}>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center">
                  <Label>Wave</Label>
                  <Select
                    value={osc.waveform}
                    onChange={(e) => updateVa({ [oscDef.key]: { ...osc, waveform: e.target.value as any } } as any)}
                  >
                    {['sine', 'triangle', 'square', 'sawtooth', 'pulse'].map(w => <option key={w} value={w}>{w}</option>)}
                  </Select>
                </div>
                <Knob label="Oct" value={osc.octave} min={-4} max={4} step={1} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, octave: v } } as any)} size={30} />
                <Knob label="Semi" value={osc.semitone} min={-12} max={12} step={1} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, semitone: v } } as any)} size={30} />
                <Knob label="Cent" value={osc.cent} min={-100} max={100} step={1} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, cent: v } } as any)} size={30} />
                <Knob label="Level" value={osc.level} max={2} step={0.01} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, level: v } } as any)} size={30} />
                <Knob label="Pan" value={osc.pan} min={-1} max={1} step={0.01} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, pan: v } } as any)} size={30} />
              </div>
              {advancedPanels.va && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Knob label="PWM" value={osc.pwmDepth ?? 0} max={1} step={0.01} onChange={(v) => updateVa({ [oscDef.key]: { ...osc, pwmDepth: v } } as any)} size={28} />
                  <div className="flex flex-col items-center">
                    <Label>PWM Src</Label>
                    <Select
                      value={osc.pwmSource || 'lfo1'}
                      onChange={(e) => updateVa({ [oscDef.key]: { ...osc, pwmSource: e.target.value as any } } as any)}
                    >
                      {TIMBRE_MOD_SOURCES.map(src => <option key={src} value={src}>{src}</option>)}
                    </Select>
                  </div>
                </div>
              )}
            </SubSection>
          );
        })}
      </Section>

      <Section title="Harmonic Series">
        <div className="flex justify-between items-center mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.harmonic.enabled} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, enabled: v } })} />
          <div className="flex items-center gap-2">
            <Select
              value={activePatch.voice.harmonic.mode}
              onChange={(e) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, mode: e.target.value as any } })}
            >
              <option value="parametric">Parametric</option>
              <option value="table">Table Draw</option>
              <option value="hybrid">Hybrid</option>
            </Select>
            <button
              onClick={() => togglePanel('harmonic')}
              className="text-[9px] text-gray-400 hover:text-white px-1"
            >
              {advancedPanels.harmonic ? 'Hide' : 'More'}
            </button>
          </div>
        </div>

        <div className="bg-black/30 p-2 rounded border border-gray-800/50 mb-2">
          <div className="flex justify-between mb-1">
            <Label>Partials Table</Label>
            <Select
              value={activePatch.voice.harmonic.tableSize}
              onChange={(e) => {
                const size = parseInt(e.target.value);
                updateVoice({ harmonic: { ...activePatch.voice.harmonic, tableSize: size, table: ensureTable(activePatch.voice.harmonic.table, size) } });
              }}
            >
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
            </Select>
          </div>
          <BarChartEditor
            values={activePatch.voice.harmonic.table.map(v => v === -1 ? 0 : v)}
            onChange={(idx, val) => {
              const next = [...activePatch.voice.harmonic.table];
              next[idx] = val;
              updateVoice({ harmonic: { ...activePatch.voice.harmonic, table: next } });
            }}
            height={80}
          />
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Knob label="Count" value={activePatch.voice.harmonic.harmonicCount} min={1} max={64} step={1} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, harmonicCount: v } })} size={36} />
          <Knob label="Bright" value={activePatch.voice.harmonic.brightness} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, brightness: v } })} size={36} />
          <Knob label="Rolloff" value={activePatch.voice.harmonic.rolloff} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, rolloff: v } })} size={36} />
          <Knob label="Odd/Even" value={activePatch.voice.harmonic.oddEven} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, oddEven: v } })} size={36} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Knob label="Inharm" value={activePatch.voice.harmonic.inharmonicity} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, inharmonicity: v } })} size={36} />
          <Knob label="Curve" value={activePatch.voice.harmonic.inharmonicityCurve} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, inharmonicityCurve: v } })} size={36} />
          <Knob label="Phase" value={activePatch.voice.harmonic.phase || 0} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, phase: v } })} size={36} />
          <Knob label="Jitter" value={activePatch.voice.harmonic.jitter} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, jitter: v } })} size={36} />
        </div>
        {advancedPanels.harmonic && (
          <SubSection title="Advanced Harmonics">
            <div className="grid grid-cols-4 gap-2">
              {activePatch.voice.harmonic.groupWeights.map((value, idx) => (
                <Knob
                  key={`groupWeight-${idx}`}
                  label={`G${idx + 1} W`}
                  value={value}
                  onChange={(v) => {
                    const next = [...activePatch.voice.harmonic.groupWeights] as [number, number, number, number];
                    next[idx] = v;
                    updateVoice({ harmonic: { ...activePatch.voice.harmonic, groupWeights: next } });
                  }}
                  size={32}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {activePatch.voice.harmonic.groupDecay.map((value, idx) => (
                <Knob
                  key={`groupDecay-${idx}`}
                  label={`G${idx + 1} D`}
                  value={value}
                  onChange={(v) => {
                    const next = [...activePatch.voice.harmonic.groupDecay] as [number, number, number, number];
                    next[idx] = v;
                    updateVoice({ harmonic: { ...activePatch.voice.harmonic, groupDecay: next } });
                  }}
                  size={32}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col items-center">
                <Label>Phase Mode</Label>
                <Select
                  value={activePatch.voice.harmonic.phaseMode || 'locked'}
                  onChange={(e) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, phaseMode: e.target.value as any } })}
                >
                  {['locked', 'random', 'randomPerNote', 'randomPerVoice', 'spread'].map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </Select>
              </div>
              <Knob
                label="Phase Spr"
                value={activePatch.voice.harmonic.phaseSpread || 0}
                onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, phaseSpread: v } })}
                size={32}
              />
              <div className="flex flex-col items-center">
                <Label>Mask</Label>
                <Select
                  value={activePatch.voice.harmonic.mask}
                  onChange={(e) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, mask: e.target.value as any } })}
                >
                  {['all', 'no_fundamental', 'odd', 'even', 'pattern', 'bandpass', 'multiBand', 'formant'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col">
                <Label>Pattern</Label>
                <input
                  type="text"
                  value={activePatch.voice.harmonic.pattern || ''}
                  onChange={(e) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, pattern: e.target.value } })}
                  className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Normalize"
                  checked={activePatch.voice.harmonic.normalize}
                  onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, normalize: v } })}
                />
                <Checkbox
                  label="Lock Energy"
                  checked={activePatch.voice.harmonic.lockEnergy}
                  onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, lockEnergy: v } })}
                />
              </div>
              <Knob
                label="Mix"
                value={activePatch.voice.harmonic.mix}
                onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, mix: v } })}
                size={32}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <Knob
                label="Mask Low"
                value={activePatch.voice.harmonic.maskConfig?.lowHz ?? 200}
                min={20}
                max={20000}
                onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, lowHz: v } } })}
                size={30}
              />
              <Knob
                label="Mask High"
                value={activePatch.voice.harmonic.maskConfig?.highHz ?? 8000}
                min={20}
                max={20000}
                onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, highHz: v } } })}
                size={30}
              />
              <div className="flex items-center text-[9px] text-gray-500">
                {activePatch.voice.harmonic.mask}
              </div>
            </div>

            {(activePatch.voice.harmonic.mask === 'multiBand' || (activePatch.voice.harmonic.maskConfig?.bands?.length ?? 0) > 0) && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <Label>Bands</Label>
                  <button
                    onClick={() => {
                      const bands = [...(activePatch.voice.harmonic.maskConfig?.bands || []), { low: 200, high: 800, gain: 1 }];
                      updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, bands } } });
                    }}
                    className="text-[9px] text-gray-400 hover:text-white"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1">
                  {(activePatch.voice.harmonic.maskConfig?.bands || []).map((band, idx) => (
                    <div key={`mask-band-${idx}`} className="grid grid-cols-4 gap-2 items-center">
                      <input
                        type="number"
                        step="1"
                        value={band.low}
                        onChange={(e) => {
                          const bands = [...(activePatch.voice.harmonic.maskConfig?.bands || [])];
                          bands[idx] = { ...bands[idx], low: parseNum(e.target.value, band.low) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, bands } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="1"
                        value={band.high}
                        onChange={(e) => {
                          const bands = [...(activePatch.voice.harmonic.maskConfig?.bands || [])];
                          bands[idx] = { ...bands[idx], high: parseNum(e.target.value, band.high) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, bands } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={band.gain}
                        onChange={(e) => {
                          const bands = [...(activePatch.voice.harmonic.maskConfig?.bands || [])];
                          bands[idx] = { ...bands[idx], gain: parseNum(e.target.value, band.gain) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, bands } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <button
                        onClick={() => {
                          const bands = (activePatch.voice.harmonic.maskConfig?.bands || []).filter((_, i) => i !== idx);
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, bands } } });
                        }}
                        className="text-[9px] text-red-500 hover:text-red-300"
                      >
                        
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(activePatch.voice.harmonic.mask === 'formant' || (activePatch.voice.harmonic.maskConfig?.formants?.length ?? 0) > 0) && (
              <div className="mt-3">
                <div className="flex justify-between items-center mb-1">
                  <Label>Formants</Label>
                  <button
                    onClick={() => {
                      const formants = [...(activePatch.voice.harmonic.maskConfig?.formants || []), { freq: 500, width: 120, gain: 1 }];
                      updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, formants } } });
                    }}
                    className="text-[9px] text-gray-400 hover:text-white"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1">
                  {(activePatch.voice.harmonic.maskConfig?.formants || []).map((formant, idx) => (
                    <div key={`mask-formant-${idx}`} className="grid grid-cols-4 gap-2 items-center">
                      <input
                        type="number"
                        step="1"
                        value={formant.freq}
                        onChange={(e) => {
                          const formants = [...(activePatch.voice.harmonic.maskConfig?.formants || [])];
                          formants[idx] = { ...formants[idx], freq: parseNum(e.target.value, formant.freq) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, formants } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="1"
                        value={formant.width}
                        onChange={(e) => {
                          const formants = [...(activePatch.voice.harmonic.maskConfig?.formants || [])];
                          formants[idx] = { ...formants[idx], width: parseNum(e.target.value, formant.width) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, formants } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <input
                        type="number"
                        step="0.1"
                        value={formant.gain}
                        onChange={(e) => {
                          const formants = [...(activePatch.voice.harmonic.maskConfig?.formants || [])];
                          formants[idx] = { ...formants[idx], gain: parseNum(e.target.value, formant.gain) };
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, formants } } });
                        }}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                      <button
                        onClick={() => {
                          const formants = (activePatch.voice.harmonic.maskConfig?.formants || []).filter((_, i) => i !== idx);
                          updateVoice({ harmonic: { ...activePatch.voice.harmonic, maskConfig: { ...activePatch.voice.harmonic.maskConfig, formants } } });
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

      <Section title="Noise / Exciter">
        <div className="flex items-center justify-between mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.noise.enabled} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, enabled: v } })} />
          <button
            onClick={() => togglePanel('noise')}
            className="text-[9px] text-gray-400 hover:text-white px-1"
          >
            {advancedPanels.noise ? 'Hide' : 'More'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Knob label="Burst" value={activePatch.voice.noise.burstAmount} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, burstAmount: v } })} size={36} />
          <Knob label="Sustain" value={activePatch.voice.noise.sustainAmount} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, sustainAmount: v } })} size={36} />
          <Knob label="Mix" value={activePatch.voice.noise.mix} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, mix: v } })} size={36} />
        </div>
        {advancedPanels.noise && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Knob label="Burst D" value={activePatch.voice.noise.burstDecayMs} max={1000} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, burstDecayMs: v } })} size={32} />
            <Knob label="Filter" value={activePatch.voice.noise.filterHz} min={100} max={20000} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, filterHz: v } })} size={32} />
            <Knob label="HPF" value={activePatch.voice.noise.highpassHz} min={20} max={8000} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, highpassHz: v } })} size={32} />
            <Knob label="Color" value={activePatch.voice.noise.color} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, color: v } })} size={32} />
            <Knob label="Width" value={activePatch.voice.noise.stereoWidth} onChange={(v) => updateVoice({ noise: { ...activePatch.voice.noise, stereoWidth: v } })} size={32} />
          </div>
        )}
      </Section>

      <Section title="Master Filter">
        <div className="flex items-center justify-between mb-2">
          <Checkbox label="M.Filter" checked={activePatch.voice.masterFilter?.enabled || false} onChange={(v) => updateVoice({ masterFilter: { ...activePatch.voice.masterFilter, enabled: v } })} />
          <Select
            value={activePatch.voice.masterFilter?.type || 'lowpass'}
            onChange={(e) => updateVoice({ masterFilter: { ...activePatch.voice.masterFilter, type: e.target.value as any } })}
          >
            <option value="lowpass">LP</option>
            <option value="highpass">HP</option>
            <option value="bandpass">BP</option>
            <option value="notch">Notch</option>
            <option value="allpass">All</option>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Knob label="Cutoff" value={activePatch.voice.masterFilter?.cutoffHz || 20000} min={20} max={20000} onChange={(v) => updateVoice({ masterFilter: { ...activePatch.voice.masterFilter, cutoffHz: v } })} size={30} />
          <Knob label="Res" value={activePatch.voice.masterFilter?.resonance || 0} max={20} onChange={(v) => updateVoice({ masterFilter: { ...activePatch.voice.masterFilter, resonance: v } })} size={30} />
          <Knob label="Mix" value={activePatch.voice.masterFilter?.mix ?? 1} max={1} step={0.01} onChange={(v) => updateVoice({ masterFilter: { ...activePatch.voice.masterFilter, mix: v } })} size={30} />
        </div>
      </Section>

      <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
        <div className="flex items-end justify-between mb-2 border-b border-gray-800/50 pb-2">
          <Knob
            label="Voice Gain"
            value={activePatch.voice.gain}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => updateVoice({ gain: v })}
            size={32}
          />
          <Fader label="Master" value={activePatch.voice.harmonic.mix} onChange={(v) => updateVoice({ harmonic: { ...activePatch.voice.harmonic, mix: v } })} height={80} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {activePatch.macros.slice(0, 4).map((macro, idx) => (
            <Knob
              key={macro.id || idx}
              label={macro.name}
              value={macro.value}
              onChange={(v) => {
                const next = [...activePatch.macros];
                next[idx] = { ...macro, value: v };
                updateActive({ macros: next });
              }}
              size={42}
            />
          ))}
        </div>
      </div>
    </>
  );
};
