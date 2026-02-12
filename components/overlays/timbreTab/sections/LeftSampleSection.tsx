import React from 'react';
import { Knob } from '../../../common/AudioControls';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';
import { parseOptional, parseOptionalInt } from '../sectionUtils';

type LeftSampleSectionProps = {
  activePatch: TimbrePatch;
  updateSample: (partial: Partial<TimbrePatch['voice']['sample']>) => void;
  updateSampleLayer: (idx: number, partial: Partial<TimbrePatch['voice']['sample']['layers'][0]>) => void;
  updateSampleRegion: (layerIdx: number, regionIdx: number, partial: Partial<TimbrePatch['voice']['sample']['layers'][0]['regions'][0]>) => void;
  updateReleaseSample: (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['releaseSamples']>[0]>) => void;
  updateReleaseRegion: (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['releaseSamples']>[0]['region']>) => void;
  updateLegatoTransition: (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['legatoTransitions']>[0]>) => void;
  updateLegatoRegion: (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['legatoTransitions']>[0]['region']>) => void;
  advancedPanels: Record<string, boolean>;
  togglePanel: (key: string) => void;
};

export const LeftSampleSection = ({
  activePatch,
  updateSample,
  updateSampleLayer,
  updateSampleRegion,
  updateReleaseSample,
  updateReleaseRegion,
  updateLegatoTransition,
  updateLegatoRegion,
  advancedPanels,
  togglePanel
}: LeftSampleSectionProps) => {
  return (
    <Section title="Sample Engine">
      <div className="flex justify-between items-center mb-2">
        <Checkbox
          label="Enable"
          checked={activePatch.voice.sample.enabled}
          onChange={(v) => updateSample({ enabled: v })}
        />
        <button
          onClick={() => togglePanel('sample')}
          className="text-[9px] text-gray-400 hover:text-white px-1"
        >
          {advancedPanels.sample ? 'Hide' : 'More'}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Knob label="Master" value={activePatch.voice.sample.masterGain} max={2} step={0.01} onChange={(v) => updateSample({ masterGain: v })} size={32} />
        <Knob label="Release Mix" value={activePatch.voice.sample.releaseMix ?? 0} max={1} step={0.01} onChange={(v) => updateSample({ releaseMix: v })} size={32} />
        <div className="flex flex-col items-center">
          <Label>Vel Curve</Label>
          <Select
            value={activePatch.voice.sample.velocityCurve || 'linear'}
            onChange={(e) => updateSample({ velocityCurve: e.target.value as any })}
          >
            <option value="linear">linear</option>
            <option value="soft">soft</option>
            <option value="hard">hard</option>
          </Select>
        </div>
        <div className="flex flex-col items-center">
          <Label>Round Robin</Label>
          <Select
            value={activePatch.voice.sample.roundRobinMode || 'cycle'}
            onChange={(e) => updateSample({ roundRobinMode: e.target.value as any })}
          >
            <option value="cycle">cycle</option>
            <option value="random">random</option>
            <option value="random-no-repeat">random-no-repeat</option>
          </Select>
        </div>
      </div>

      <div className="flex justify-between items-center mt-3">
        <Label>Layers</Label>
        <button
          onClick={() => {
            const next = [...activePatch.voice.sample.layers, {
              gain: 1,
              pan: 0,
              tuneCents: 0,
              regions: [{ url: '' }]
            }];
            updateSample({ layers: next });
          }}
          className="text-[9px] text-gray-400 hover:text-white"
        >
          + Add Layer
        </button>
      </div>

      <div className="space-y-2 mt-2">
        {activePatch.voice.sample.layers.map((layer, layerIdx) => (
          <SubSection key={`sample-layer-${layerIdx}`} title={`Layer ${layerIdx + 1}`}>
            <div className="flex justify-between items-center mb-2">
              <div className="text-[9px] text-gray-500">Layer Controls</div>
              <button
                onClick={() => {
                  const next = activePatch.voice.sample.layers.filter((_, idx) => idx !== layerIdx);
                  updateSample({ layers: next });
                }}
                className="text-[9px] text-red-500 hover:text-red-300"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Gain" value={layer.gain} max={2} step={0.01} onChange={(v) => updateSampleLayer(layerIdx, { gain: v })} size={30} />
              <Knob label="Pan" value={layer.pan} min={-1} max={1} step={0.01} onChange={(v) => updateSampleLayer(layerIdx, { pan: v })} size={30} />
              <Knob label="Tune" value={layer.tuneCents} min={-2400} max={2400} step={1} onChange={(v) => updateSampleLayer(layerIdx, { tuneCents: v })} size={30} />
            </div>
            {advancedPanels.sample && (
              <>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="flex flex-col">
                    <Label>Root Key</Label>
                    <input
                      type="text"
                      value={layer.rootKey ?? ''}
                      onChange={(e) => updateSampleLayer(layerIdx, { rootKey: e.target.value })}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Key Min</Label>
                    <input
                      type="number"
                      step="1"
                      value={layer.keyRange?.[0] ?? ''}
                      onChange={(e) => {
                        const next: [number, number] = [parseOptionalInt(e.target.value) ?? 0, layer.keyRange?.[1] ?? 127];
                        updateSampleLayer(layerIdx, { keyRange: next });
                      }}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Key Max</Label>
                    <input
                      type="number"
                      step="1"
                      value={layer.keyRange?.[1] ?? ''}
                      onChange={(e) => {
                        const next: [number, number] = [layer.keyRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127];
                        updateSampleLayer(layerIdx, { keyRange: next });
                      }}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Vel Min</Label>
                    <input
                      type="number"
                      step="1"
                      value={layer.velRange?.[0] ?? ''}
                      onChange={(e) => {
                        const next: [number, number] = [parseOptionalInt(e.target.value) ?? 0, layer.velRange?.[1] ?? 127];
                        updateSampleLayer(layerIdx, { velRange: next });
                      }}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label>Vel Max</Label>
                    <input
                      type="number"
                      step="1"
                      value={layer.velRange?.[1] ?? ''}
                      onChange={(e) => {
                        const next: [number, number] = [layer.velRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127];
                        updateSampleLayer(layerIdx, { velRange: next });
                      }}
                      className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center mt-3">
                  <Label>Regions</Label>
                  <button
                    onClick={() => {
                      const nextRegions = [...layer.regions, { url: '' }];
                      updateSampleLayer(layerIdx, { regions: nextRegions });
                    }}
                    className="text-[9px] text-gray-400 hover:text-white"
                  >
                    + Add Region
                  </button>
                </div>

                <div className="space-y-2 mt-2">
                  {layer.regions.map((region, regionIdx) => (
                    <div key={`sample-region-${layerIdx}-${regionIdx}`} className="border border-gray-800/50 rounded p-2">
                      <div className="flex justify-between items-center mb-2">
                        <Label>Region {regionIdx + 1}</Label>
                        <button
                          onClick={() => {
                            const nextRegions = layer.regions.filter((_, idx) => idx !== regionIdx);
                            updateSampleLayer(layerIdx, { regions: nextRegions });
                          }}
                          className="text-[9px] text-red-500 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <Label>URL</Label>
                          <input
                            type="text"
                            value={region.url}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { url: e.target.value })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>Start (ms)</Label>
                          <input
                            type="number"
                            step="1"
                            value={region.startOffsetMs ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { startOffsetMs: parseOptionalInt(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>End Trim (ms)</Label>
                          <input
                            type="number"
                            step="1"
                            value={region.endTrimMs ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { endTrimMs: parseOptionalInt(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>Loop</Label>
                          <Select
                            value={region.loopMode || 'off'}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { loopMode: e.target.value as any })}
                          >
                            <option value="off">off</option>
                            <option value="forward">forward</option>
                            <option value="pingpong">pingpong</option>
                          </Select>
                        </div>
                        <div className="flex flex-col">
                          <Label>Loop Start</Label>
                          <input
                            type="number"
                            step="0.001"
                            value={region.loopStart ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { loopStart: parseOptional(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>Loop End</Label>
                          <input
                            type="number"
                            step="0.001"
                            value={region.loopEnd ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { loopEnd: parseOptional(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>Loop Xfade</Label>
                          <input
                            type="number"
                            step="1"
                            value={region.loopXfadeMs ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { loopXfadeMs: parseOptionalInt(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>RR Group</Label>
                          <input
                            type="text"
                            value={region.roundRobinGroupId ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { roundRobinGroupId: e.target.value })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Label>RR Index</Label>
                          <input
                            type="number"
                            step="1"
                            value={region.rrIndex ?? ''}
                            onChange={(e) => updateSampleRegion(layerIdx, regionIdx, { rrIndex: parseOptionalInt(e.target.value) })}
                            className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SubSection>
        ))}
      </div>

      {advancedPanels.sample && (
        <>
          <SubSection title="Release Samples">
            <div className="flex justify-between items-center mb-2">
              <Label>Maps</Label>
              <button
                onClick={() => updateSample({ releaseSamples: [...(activePatch.voice.sample.releaseSamples || []), { region: { url: '' } }] })}
                className="text-[9px] text-gray-400 hover:text-white"
              >
                + Add Map
              </button>
            </div>
            <div className="space-y-2">
              {(activePatch.voice.sample.releaseSamples || []).map((map, idx) => (
                <div key={`release-map-${idx}`} className="border border-gray-800/50 rounded p-2">
                  <div className="flex justify-between items-center mb-1">
                    <Label>Map {idx + 1}</Label>
                    <button
                      onClick={() => {
                        const next = (activePatch.voice.sample.releaseSamples || []).filter((_, i) => i !== idx);
                        updateSample({ releaseSamples: next });
                      }}
                      className="text-[9px] text-red-500 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <Label>Key Min</Label>
                      <input
                        type="number"
                        step="1"
                        value={map.keyRange?.[0] ?? ''}
                        onChange={(e) => updateReleaseSample(idx, { keyRange: [parseOptionalInt(e.target.value) ?? 0, map.keyRange?.[1] ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>Key Max</Label>
                      <input
                        type="number"
                        step="1"
                        value={map.keyRange?.[1] ?? ''}
                        onChange={(e) => updateReleaseSample(idx, { keyRange: [map.keyRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>Vel Min</Label>
                      <input
                        type="number"
                        step="1"
                        value={map.velRange?.[0] ?? ''}
                        onChange={(e) => updateReleaseSample(idx, { velRange: [parseOptionalInt(e.target.value) ?? 0, map.velRange?.[1] ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>Vel Max</Label>
                      <input
                        type="number"
                        step="1"
                        value={map.velRange?.[1] ?? ''}
                        onChange={(e) => updateReleaseSample(idx, { velRange: [map.velRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>URL</Label>
                      <input
                        type="text"
                        value={map.region.url}
                        onChange={(e) => updateReleaseRegion(idx, { url: e.target.value })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>Loop</Label>
                      <Select
                        value={map.region.loopMode || 'off'}
                        onChange={(e) => updateReleaseRegion(idx, { loopMode: e.target.value as any })}
                      >
                        <option value="off">off</option>
                        <option value="forward">forward</option>
                        <option value="pingpong">pingpong</option>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>

          <SubSection title="Legato Transitions">
            <div className="flex justify-between items-center mb-2">
              <Label>Transitions</Label>
              <button
                onClick={() => updateSample({ legatoTransitions: [...(activePatch.voice.sample.legatoTransitions || []), { region: { url: '' } }] })}
                className="text-[9px] text-gray-400 hover:text-white"
              >
                + Add Transition
              </button>
            </div>
            <div className="space-y-2">
              {(activePatch.voice.sample.legatoTransitions || []).map((transition, idx) => (
                <div key={`legato-${idx}`} className="border border-gray-800/50 rounded p-2">
                  <div className="flex justify-between items-center mb-1">
                    <Label>Transition {idx + 1}</Label>
                    <button
                      onClick={() => {
                        const next = (activePatch.voice.sample.legatoTransitions || []).filter((_, i) => i !== idx);
                        updateSample({ legatoTransitions: next });
                      }}
                      className="text-[9px] text-red-500 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col">
                      <Label>From Min</Label>
                      <input
                        type="number"
                        step="1"
                        value={transition.fromKeyRange?.[0] ?? ''}
                        onChange={(e) => updateLegatoTransition(idx, { fromKeyRange: [parseOptionalInt(e.target.value) ?? 0, transition.fromKeyRange?.[1] ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>From Max</Label>
                      <input
                        type="number"
                        step="1"
                        value={transition.fromKeyRange?.[1] ?? ''}
                        onChange={(e) => updateLegatoTransition(idx, { fromKeyRange: [transition.fromKeyRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>To Min</Label>
                      <input
                        type="number"
                        step="1"
                        value={transition.toKeyRange?.[0] ?? ''}
                        onChange={(e) => updateLegatoTransition(idx, { toKeyRange: [parseOptionalInt(e.target.value) ?? 0, transition.toKeyRange?.[1] ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>To Max</Label>
                      <input
                        type="number"
                        step="1"
                        value={transition.toKeyRange?.[1] ?? ''}
                        onChange={(e) => updateLegatoTransition(idx, { toKeyRange: [transition.toKeyRange?.[0] ?? 0, parseOptionalInt(e.target.value) ?? 127] })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label>Interval</Label>
                      <Select
                        value={transition.intervalClass || 'semitone'}
                        onChange={(e) => updateLegatoTransition(idx, { intervalClass: e.target.value as any })}
                      >
                        <option value="semitone">semitone</option>
                        <option value="whole">whole</option>
                        <option value="leap">leap</option>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>URL</Label>
                      <input
                        type="text"
                        value={transition.region.url}
                        onChange={(e) => updateLegatoRegion(idx, { url: e.target.value })}
                        className="w-full bg-transparent text-right text-blue-300 outline-none focus:text-white border-b border-gray-700/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SubSection>
        </>
      )}
    </Section>
  );
};
