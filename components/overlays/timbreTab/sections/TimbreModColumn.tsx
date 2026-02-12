import React from 'react';
import { BarChartEditor, Knob } from '../../../common/AudioControls';
import { TimbreMsegEditor } from '../../TimbreMsegEditor';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbreModRoute, TimbrePatch } from '../../../../types';
import { ensureRoute, patternToValues } from '../helpers';
import { TIMBRE_MOD_SOURCES, TIMBRE_MOD_TARGETS } from '../../../../timbreEngine/paramRegistry';
import { MOD_BLEND_MODES, MOD_CURVES } from '../constants';
import { parseNum, parseOptional, parseOptionalInt } from '../sectionUtils';

type TimbreModColumnProps = {
  activePatch: TimbrePatch;
  expandedRoutes: Record<string, boolean>;
  setExpandedRoutes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  updateVoice: (partial: Partial<TimbrePatch["voice"]>) => void;
  updateActive: (partial: Partial<TimbrePatch>) => void;
  updateRoute: (idx: number, partial: Partial<TimbreModRoute>) => void;
  updatePattern: (idx: number, val: number) => void;
};

export const TimbreModColumn = ({
  activePatch,
  expandedRoutes,
  setExpandedRoutes,
  updateVoice,
  updateActive,
  updateRoute,
  updatePattern
}: TimbreModColumnProps) => {
  return (
    <>
      <Section title="Pattern Sequencer">
        <div className="bg-black/30 p-2 rounded border border-gray-800/50">
          <BarChartEditor
            values={patternToValues(activePatch.voice.harmonic.pattern)}
            onChange={(idx, val) => updatePattern(idx, val)}
            height={80}
          />
          <div className="text-[8px] text-gray-500 mt-1 text-center">Modulation Pattern (16 Steps)</div>
        </div>
      </Section>

      <Section title="MSEG (Multi-Stage Envelope)">
        <div className="flex justify-between items-center mb-2">
          <Checkbox label="Enable" checked={activePatch.voice.mseg.enabled} onChange={(v) => updateVoice({ mseg: { ...activePatch.voice.mseg, enabled: v } })} />
          <Knob label="Amt" value={activePatch.voice.mseg.amount} onChange={(v) => updateVoice({ mseg: { ...activePatch.voice.mseg, amount: v } })} size={30} />
        </div>
        <TimbreMsegEditor
          points={activePatch.voice.mseg.points}
          onChange={(points) => updateVoice({ mseg: { ...activePatch.voice.mseg, points } })}
          height={100}
          color="#34d399"
        />
        <div className="text-[9px] text-gray-500 mt-1">
          Drag to move - Double-click to add - Right-click to remove
        </div>
      </Section>

      <Section title="Mechanical / Sympathetic">
        <SubSection title="Mechanical Noise">
          <div className="flex justify-between items-center mb-2">
            <Checkbox label="Enable" checked={activePatch.voice.mechanicalNoise.enabled} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, enabled: v } })} />
            <Select
              value={activePatch.voice.mechanicalNoise.color}
              onChange={(e) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, color: e.target.value as any } })}
            >
              <option value="white">white</option>
              <option value="pink">pink</option>
              <option value="brown">brown</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Knob label="Key" value={activePatch.voice.mechanicalNoise.keyNoise} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, keyNoise: v } })} size={32} />
            <Knob label="Release" value={activePatch.voice.mechanicalNoise.releaseNoise} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, releaseNoise: v } })} size={32} />
            <Knob label="Breath" value={activePatch.voice.mechanicalNoise.breathNoise} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, breathNoise: v } })} size={32} />
            <Knob label="Bow" value={activePatch.voice.mechanicalNoise.bowNoise} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, bowNoise: v } })} size={32} />
            <Knob label="HPF" value={activePatch.voice.mechanicalNoise.hpHz || 80} min={20} max={2000} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, hpHz: v } })} size={32} />
            <Knob label="LPF" value={activePatch.voice.mechanicalNoise.lpHz || 12000} min={2000} max={20000} onChange={(v) => updateVoice({ mechanicalNoise: { ...activePatch.voice.mechanicalNoise, lpHz: v } })} size={32} />
          </div>
        </SubSection>
        <SubSection title="Sympathetic Resonance">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox label="Enable" checked={activePatch.voice.sympathetic.enabled} onChange={(v) => updateVoice({ sympathetic: { ...activePatch.voice.sympathetic, enabled: v } })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Knob label="Amount" value={activePatch.voice.sympathetic.amount} onChange={(v) => updateVoice({ sympathetic: { ...activePatch.voice.sympathetic, amount: v } })} size={32} />
            <Knob label="Decay" value={activePatch.voice.sympathetic.decay} onChange={(v) => updateVoice({ sympathetic: { ...activePatch.voice.sympathetic, decay: v } })} size={32} />
            <Knob label="Color" value={activePatch.voice.sympathetic.color} onChange={(v) => updateVoice({ sympathetic: { ...activePatch.voice.sympathetic, color: v } })} size={32} />
          </div>
        </SubSection>
      </Section>

      {activePatch.voice.granular && (
        <Section title="Granular Engine">
          <div className="flex justify-between items-center mb-2">
            <Checkbox
              label="Enable"
              checked={activePatch.voice.granular.enabled}
              onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, enabled: v } } as any)}
            />
            <Select
              value={activePatch.voice.granular.windowType}
              onChange={(e) => updateVoice({ granular: { ...activePatch.voice.granular, windowType: e.target.value as any } } as any)}
            >
              <option value="hann">hann</option>
              <option value="tri">tri</option>
              <option value="rect">rect</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Knob label="Mix" value={activePatch.voice.granular.mix} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, mix: v } } as any)} size={32} />
            <Knob label="Size" value={activePatch.voice.granular.grainSizeMs} max={500} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, grainSizeMs: v } } as any)} size={32} />
            <Knob label="Density" value={activePatch.voice.granular.density} max={32} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, density: v } } as any)} size={32} />
            <Knob label="Position" value={activePatch.voice.granular.position} max={1} step={0.01} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, position: v } } as any)} size={32} />
            <Knob label="Jitter" value={activePatch.voice.granular.positionJitter} max={1} step={0.01} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, positionJitter: v } } as any)} size={32} />
            <Knob label="Pitch" value={activePatch.voice.granular.pitch} min={-24} max={24} step={0.1} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, pitch: v } } as any)} size={32} />
            <Knob label="Spray" value={activePatch.voice.granular.spray} max={1} step={0.01} onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, spray: v } } as any)} size={32} />
            <div className="flex items-center">
              <Checkbox
                label="Freeze"
                checked={activePatch.voice.granular.freeze}
                onChange={(v) => updateVoice({ granular: { ...activePatch.voice.granular, freeze: v } } as any)}
              />
            </div>
            <div className="col-span-2">
              <Label>Source URL</Label>
              <input
                type="text"
                value={activePatch.voice.granular.sourceUrl ?? ''}
                onChange={(e) => updateVoice({ granular: { ...activePatch.voice.granular, sourceUrl: e.target.value } } as any)}
                className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
              />
            </div>
          </div>
        </Section>
      )}

      <Section title="FM & Ring Mod">
        <div className="flex gap-4">
          <div className="flex-1 border-r border-gray-800/50 pr-2">
            <div className="flex justify-between mb-1"><Label>FM</Label><Checkbox label="" checked={activePatch.voice.fm.enabled} onChange={(v) => updateVoice({ fm: { ...activePatch.voice.fm, enabled: v } })} /></div>
            <div className="grid grid-cols-2 gap-1 mb-1">
              <Select value={activePatch.voice.fm.waveform} onChange={(e) => updateVoice({ fm: { ...activePatch.voice.fm, waveform: e.target.value as any } })} className="col-span-2">
                {['sine', 'triangle', 'square', 'sawtooth'].map(w => <option key={w} value={w}>{w}</option>)}
              </Select>
              <Select value={activePatch.voice.fm.target} onChange={(e) => updateVoice({ fm: { ...activePatch.voice.fm, target: e.target.value as any } })} className="col-span-2">
                <option value="osc">Oscs Only</option>
                <option value="harmonic">Harmonic Only</option>
                <option value="all">All</option>
              </Select>
            </div>
            <div className="flex gap-1">
              <Knob label="Ratio" value={activePatch.voice.fm.ratio} max={16} step={0.1} onChange={(v) => updateVoice({ fm: { ...activePatch.voice.fm, ratio: v } })} size={36} />
              <Knob label="Depth" value={activePatch.voice.fm.depth} max={2} onChange={(v) => updateVoice({ fm: { ...activePatch.voice.fm, depth: v } })} size={36} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-1"><Label>RingMod</Label><Checkbox label="" checked={activePatch.voice.ringMod.enabled} onChange={(v) => updateVoice({ ringMod: { ...activePatch.voice.ringMod, enabled: v } })} /></div>
            <Select value={activePatch.voice.ringMod.waveform} onChange={(e) => updateVoice({ ringMod: { ...activePatch.voice.ringMod, waveform: e.target.value as any } })} className="mb-1 w-full">
              {['sine', 'triangle', 'square', 'sawtooth'].map(w => <option key={w} value={w}>{w}</option>)}
            </Select>
            <div className="grid grid-cols-3 gap-1">
              <Knob label="Ratio" value={activePatch.voice.ringMod.ratio} max={16} step={0.1} onChange={(v) => updateVoice({ ringMod: { ...activePatch.voice.ringMod, ratio: v } })} size={30} />
              <Knob label="Depth" value={activePatch.voice.ringMod.depth} onChange={(v) => updateVoice({ ringMod: { ...activePatch.voice.ringMod, depth: v } })} size={30} />
              <Knob label="Mix" value={activePatch.voice.ringMod.mix} onChange={(v) => updateVoice({ ringMod: { ...activePatch.voice.ringMod, mix: v } })} size={30} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Modulation Matrix">
        <div className="space-y-1">
          {activePatch.modMatrix.map((route, idx) => {
            const routeKey = route.id || `route-${idx}`;
            const isExpanded = !!expandedRoutes[routeKey];
            return (
              <React.Fragment key={routeKey}>
                <div className="grid grid-cols-12 gap-1 items-center bg-black/30 p-1 rounded border border-gray-800/50 text-[9px]">
                  <div className="col-span-4">
                    <Select
                      value={route.source}
                      onChange={(e) => updateRoute(idx, { source: e.target.value as any })}
                    >
                      {TIMBRE_MOD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-1 text-center text-gray-500">{'->'}</div>
                  <div className="col-span-4">
                    <Select
                      value={route.target}
                      onChange={(e) => updateRoute(idx, { target: e.target.value as any })}
                    >
                      {TIMBRE_MOD_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      step="0.1"
                      value={route.depth}
                      onChange={(e) => updateRoute(idx, { depth: parseNum(e.target.value, 0) })}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-transparent focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center gap-1">
                    <button
                      onClick={() => setExpandedRoutes(prev => ({ ...prev, [routeKey]: !prev[routeKey] }))}
                      className="text-gray-400 hover:text-white"
                    >
                      {isExpanded ? 'v' : '>'}
                    </button>
                    <button onClick={() => updateActive({ modMatrix: activePatch.modMatrix.filter((_, i) => i !== idx) })} className="text-red-500 hover:text-white">x</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="grid grid-cols-12 gap-1 items-center bg-black/20 p-2 rounded border border-gray-800/40 text-[9px]">
                    <div className="col-span-3">
                      <Label>Curve</Label>
                      <Select
                        value={route.curve || 'linear'}
                        onChange={(e) => updateRoute(idx, { curve: e.target.value as any })}
                      >
                        {MOD_CURVES.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Label>Curve Amt</Label>
                      <input
                        type="number"
                        step="0.1"
                        value={route.curveAmount ?? ''}
                        onChange={(e) => updateRoute(idx, { curveAmount: parseOptional(e.target.value) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Curve Steps</Label>
                      <input
                        type="number"
                        step="1"
                        value={route.curveSteps ?? ''}
                        onChange={(e) => updateRoute(idx, { curveSteps: parseOptionalInt(e.target.value) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-3">
                      <Label>Blend</Label>
                      <Select
                        value={route.blendMode || 'sum'}
                        onChange={(e) => updateRoute(idx, { blendMode: e.target.value as any })}
                      >
                        {MOD_BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Scale</Label>
                      <input
                        type="number"
                        step="0.1"
                        value={route.scale ?? 1}
                        onChange={(e) => updateRoute(idx, { scale: parseNum(e.target.value, 1) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Offset</Label>
                      <input
                        type="number"
                        step="0.1"
                        value={route.offset ?? 0}
                        onChange={(e) => updateRoute(idx, { offset: parseNum(e.target.value, 0) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Clamp Min</Label>
                      <input
                        type="number"
                        step="0.1"
                        value={route.clampMin ?? ''}
                        onChange={(e) => updateRoute(idx, { clampMin: parseOptional(e.target.value) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Clamp Max</Label>
                      <input
                        type="number"
                        step="0.1"
                        value={route.clampMax ?? ''}
                        onChange={(e) => updateRoute(idx, { clampMax: parseOptional(e.target.value) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Deadzone</Label>
                      <input
                        type="number"
                        step="0.01"
                        value={route.deadzone ?? 0}
                        onChange={(e) => updateRoute(idx, { deadzone: parseNum(e.target.value, 0) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Smooth ms</Label>
                      <input
                        type="number"
                        step="1"
                        value={route.smoothingMs ?? 0}
                        onChange={(e) => updateRoute(idx, { smoothingMs: parseNum(e.target.value, 0) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <Checkbox
                        label="Invert"
                        checked={route.invert ?? false}
                        onChange={(v) => updateRoute(idx, { invert: v })}
                      />
                    </div>
                    <div className="col-span-2 flex items-center">
                      <Checkbox
                        label="Bipolar"
                        checked={route.bipolar ?? false}
                        onChange={(v) => updateRoute(idx, { bipolar: v })}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Phase Off</Label>
                      <input
                        type="number"
                        step="0.01"
                        value={route.phaseOffset ?? 0}
                        onChange={(e) => updateRoute(idx, { phaseOffset: parseNum(e.target.value, 0) })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
          <button
            onClick={() => updateActive({ modMatrix: [...activePatch.modMatrix, ensureRoute({}, activePatch.modMatrix.length)] })}
            className="w-full text-[9px] bg-gray-800 hover:bg-gray-700 py-1 rounded text-gray-400 mt-2"
          >
            + Add Route
          </button>
          <div className="text-[8px] text-gray-500 mt-1 text-center">
            {'Blend order: sum + avg -> max/min -> multiply.'}
          </div>
        </div>
      </Section>

    </>
  );
};
