import React, { useMemo, useState } from 'react';
import { Section, SubSection, Label, Select, Checkbox, Input } from '../audio/SynthPatchEditor';
import {
  buildTimbreUpgradeReport,
  DEFAULT_TIMBRE_UPGRADE_INPUT,
  TIMBRE_UPGRADE_BAND_MAP,
  TIMBRE_UPGRADE_MODULE_LIBRARY,
  TIMBRE_UPGRADE_MODULES,
  TIMBRE_UPGRADE_OPTIONS,
  TIMBRE_UPGRADE_ROUTES,
  TIMBRE_UPGRADE_TEXTURE_MAP,
  TimbreUpgradeInput
} from '../../../utils/timbreUpgrade';
import type { TimbrePatch } from '../../../types';
import { TimbreUpgradeActionableRack } from './TimbreUpgradeActionableRack';

const toggleListValue = (list: string[] | undefined, value: string) => {
  const set = new Set(list || []);
  if (set.has(value)) {
    set.delete(value);
  } else {
    set.add(value);
  }
  return Array.from(set);
};

type TimbreUpgradePanelProps = {
  activePatch?: TimbrePatch;
  updateActive?: (partial: Partial<TimbrePatch>) => void;
  updateVoice?: (partial: Partial<TimbrePatch['voice']>) => void;
};

export const TimbreUpgradePanel = ({ activePatch, updateActive, updateVoice }: TimbreUpgradePanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState<TimbreUpgradeInput>({ ...DEFAULT_TIMBRE_UPGRADE_INPUT });
  const [copied, setCopied] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [showMaps, setShowMaps] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  const report = useMemo(() => buildTimbreUpgradeReport(input), [input]);

  const updateInput = (partial: Partial<TimbreUpgradeInput>) => {
    setInput(prev => ({ ...prev, ...partial }));
  };

  const outputFormatOptions = TIMBRE_UPGRADE_OPTIONS.outputFormat as readonly string[];
  const outputIsCustom = !!input.outputFormat && !outputFormatOptions.includes(input.outputFormat);
  const outputFormatValue = outputIsCustom ? 'Other' : (input.outputFormat || '');
  const lufsIsAuto = !input.lufsTarget || input.lufsTarget.trim().length === 0;
  const moduleLabelMap = new Map(TIMBRE_UPGRADE_MODULES.map((m) => [m.id, m.label]));
  const activeModuleSet = new Set(input.enabledModules || []);

  const setAllModules = (enabled: boolean) => {
    updateInput({ enabledModules: enabled ? TIMBRE_UPGRADE_MODULES.map(m => m.id) : [] });
  };

  const applyRouteModules = (chain: string) => {
    const modules = chain.match(/M\d+/g) || [];
    updateInput({ enabledModules: Array.from(new Set(modules)) });
  };

  const toggleModuleDetails = (id: string) => {
    setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderQuickButtons = (options: readonly string[] | string[], current: string | undefined, onPick: (value: string) => void) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((value) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            onClick={() => onPick(value)}
            className={`px-2 py-0.5 text-[9px] rounded border ${isActive ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section title="Timbre Upgrade Toolkit">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[9px] text-gray-500">
          {'Input -> Actionable -> Constraints -> Routes -> Modules -> Maps -> Report'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setInput({ ...DEFAULT_TIMBRE_UPGRADE_INPUT })}
            className="px-2 py-1 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
          >
            Reset defaults
          </button>
          <button
            onClick={() => setIsOpen(v => !v)}
            className="px-2 py-1 text-[9px] bg-blue-700 border border-blue-500 rounded text-white"
          >
            {isOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="space-y-3">
          <SubSection title="Input & Intent (empty fields fall back to defaults)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label>Source types</Label>
                  <button
                    onClick={() => updateInput({ sourceTypes: [] })}
                    className="text-[9px] text-gray-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {TIMBRE_UPGRADE_OPTIONS.sourceTypes.map((item) => (
                    <Checkbox
                      key={item}
                      label={item}
                      checked={(input.sourceTypes || []).includes(item)}
                      onChange={() => updateInput({ sourceTypes: toggleListValue(input.sourceTypes, item) })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Style targets</Label>
                  <button
                    onClick={() => updateInput({ styleTargets: [] })}
                    className="text-[9px] text-gray-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {TIMBRE_UPGRADE_OPTIONS.styleTargets.map((item) => (
                    <Checkbox
                      key={item}
                      label={item}
                      checked={(input.styleTargets || []).includes(item)}
                      onChange={() => updateInput({ styleTargets: toggleListValue(input.styleTargets, item) })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Mood keywords</Label>
                  <button
                    onClick={() => updateInput({ moodKeywords: [] })}
                    className="text-[9px] text-gray-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {TIMBRE_UPGRADE_OPTIONS.moodKeywords.map((item) => (
                    <Checkbox
                      key={item}
                      label={item}
                      checked={(input.moodKeywords || []).includes(item)}
                      onChange={() => updateInput({ moodKeywords: toggleListValue(input.moodKeywords, item) })}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label>Reference timbre</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={input.reference || ''}
                    onChange={(e) => updateInput({ reference: e.target.value })}
                    placeholder="No reference / Track A/B/C"
                  />
                  <button
                    onClick={() => updateInput({ reference: DEFAULT_TIMBRE_UPGRADE_INPUT.reference || '' })}
                    className="px-2 py-1 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
                  >
                    Default
                  </button>
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="Actionable Engine Modules (Patch Controls)">
            <TimbreUpgradeActionableRack
              activePatch={activePatch}
              updateActive={updateActive}
              updateVoice={updateVoice}
            />
          </SubSection>

          <SubSection title="Constraints & Loudness">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Max distortion</Label>
                <Select
                  value={input.maxDistortion || ''}
                  onChange={(e) => updateInput({ maxDistortion: e.target.value })}
                >
                  {TIMBRE_UPGRADE_OPTIONS.maxDistortion.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>Dynamic range</Label>
                <Select
                  value={input.dynamicRange || ''}
                  onChange={(e) => updateInput({ dynamicRange: e.target.value })}
                >
                  {TIMBRE_UPGRADE_OPTIONS.dynamicRange.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>Space</Label>
                <Select
                  value={input.space || ''}
                  onChange={(e) => updateInput({ space: e.target.value })}
                >
                  {TIMBRE_UPGRADE_OPTIONS.space.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>Stereo width</Label>
                <Select
                  value={input.stereoWidth || ''}
                  onChange={(e) => updateInput({ stereoWidth: e.target.value })}
                >
                  {TIMBRE_UPGRADE_OPTIONS.stereoWidth.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>Noise tolerance</Label>
                <Select
                  value={input.noiseTolerance || ''}
                  onChange={(e) => updateInput({ noiseTolerance: e.target.value })}
                >
                  {TIMBRE_UPGRADE_OPTIONS.noiseTolerance.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </div>
              <div>
                <Label>Output format</Label>
                <Select
                  value={outputFormatValue}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === 'Other') {
                      updateInput({ outputFormat: outputIsCustom ? input.outputFormat : 'Other' });
                    } else {
                      updateInput({ outputFormat: next });
                    }
                  }}
                >
                  {TIMBRE_UPGRADE_OPTIONS.outputFormat.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
                {outputFormatValue === 'Other' && (
                  <Input
                    className="mt-1"
                    value={outputIsCustom ? (input.outputFormat || '') : ''}
                    onChange={(e) => updateInput({ outputFormat: e.target.value })}
                    placeholder="Describe output format"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <Label>Peak &lt;=</Label>
                <Input
                  value={input.peakLimit || ''}
                  onChange={(e) => updateInput({ peakLimit: e.target.value })}
                  placeholder="-1 dBFS"
                />
                {renderQuickButtons(TIMBRE_UPGRADE_OPTIONS.peakLimitOptions, input.peakLimit, (v) => updateInput({ peakLimit: v }))}
              </div>
              <div>
                <Label>True Peak &lt;=</Label>
                <Input
                  value={input.truePeakLimit || ''}
                  onChange={(e) => updateInput({ truePeakLimit: e.target.value })}
                  placeholder="-1 dBTP"
                />
                {renderQuickButtons(TIMBRE_UPGRADE_OPTIONS.truePeakLimitOptions, input.truePeakLimit, (v) => updateInput({ truePeakLimit: v }))}
              </div>
              <div>
                <Label>LUFS target</Label>
                <Input
                  value={input.lufsTarget || ''}
                  onChange={(e) => updateInput({ lufsTarget: e.target.value })}
                  placeholder="-14 LUFS"
                />
                <div className="flex flex-wrap gap-1 mt-1">
                  <button
                    onClick={() => updateInput({ lufsTarget: '' })}
                    className={`px-2 py-0.5 text-[9px] rounded border ${lufsIsAuto ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                  >
                    Auto (style-based)
                  </button>
                  {TIMBRE_UPGRADE_OPTIONS.lufsTargetOptions.map((value) => (
                    <button
                      key={value}
                      onClick={() => updateInput({ lufsTarget: value })}
                      className={`px-2 py-0.5 text-[9px] rounded border ${input.lufsTarget === value ? 'bg-blue-700 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection
            title="Route Presets"
            right={(
              <button
                onClick={() => setShowRoutes(v => !v)}
                className="px-2 py-0.5 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
              >
                {showRoutes ? 'Hide' : 'Show'}
              </button>
            )}
          >
            {showRoutes && (
              <div className="grid grid-cols-3 gap-2">
                {TIMBRE_UPGRADE_ROUTES.map((route) => {
                  const routeModules = route.chain.match(/M\d+/g) || [];
                  const isActive = routeModules.length > 0
                    && routeModules.every((id) => activeModuleSet.has(id))
                    && activeModuleSet.size === routeModules.length;
                  return (
                    <div key={route.name} className={`border rounded p-2 bg-black/30 ${isActive ? 'border-blue-500/60' : 'border-gray-800'}`}>
                      <div className="text-[10px] font-bold text-gray-200 mb-1">{route.name}</div>
                      <div className="text-[9px] text-gray-500">Chain: {route.chain}</div>
                      <div className="text-[9px] text-gray-500">Core: {route.core}</div>
                      <div className="text-[9px] text-gray-500">Risks: {route.risks}</div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => applyRouteModules(route.chain)}
                          className="px-2 py-0.5 text-[9px] bg-blue-700 border border-blue-500 rounded text-white"
                        >
                          Apply modules
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SubSection>

          <SubSection title="Module Switchboard">
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setAllModules(true)}
                className="px-2 py-1 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
              >
                Enable all
              </button>
              <button
                onClick={() => setAllModules(false)}
                className="px-2 py-1 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
              >
                Disable all
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIMBRE_UPGRADE_MODULE_LIBRARY.map((module) => {
                const isEnabled = (input.enabledModules || []).includes(module.id);
                return (
                  <div key={module.id} className="border border-gray-800 rounded bg-black/30 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          label={module.id}
                          checked={isEnabled}
                          onChange={() => updateInput({ enabledModules: toggleListValue(input.enabledModules, module.id) })}
                        />
                        <div>
                          <div className="text-[10px] text-gray-200 font-bold">{module.title}</div>
                          <div className="text-[9px] text-gray-500">{module.goal}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleModuleDetails(module.id)}
                        className="text-[9px] text-gray-500 hover:text-white"
                      >
                        {expandedModules[module.id] ? 'Hide' : 'Details'}
                      </button>
                    </div>
                    {expandedModules[module.id] && (
                      <div className="mt-2 text-[9px] text-gray-400 space-y-1">
                        <div className="text-gray-500">Typical ranges:</div>
                        {module.ranges.map((item, idx) => <div key={`${module.id}-range-${idx}`}>- {item}</div>)}
                        <div className="text-gray-500 mt-1">Starting points:</div>
                        {module.starting.map((item, idx) => <div key={`${module.id}-start-${idx}`}>- {item}</div>)}
                        <div className="text-gray-500 mt-1">Listening checkpoints:</div>
                        {module.listening.map((item, idx) => <div key={`${module.id}-listen-${idx}`}>- {item}</div>)}
                        <div className="text-gray-500 mt-1">Failure modes & fixes:</div>
                        {module.failures.map((item, idx) => <div key={`${module.id}-fail-${idx}`}>- {item}</div>)}
                        <div className="text-gray-500 mt-1">Alternatives:</div>
                        {module.alternatives.map((item, idx) => <div key={`${module.id}-alt-${idx}`}>- {item}</div>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-gray-500 mt-2">
              Active modules: {(input.enabledModules || []).map((id) => moduleLabelMap.get(id) || id).join(', ') || 'None'}
            </div>
          </SubSection>

          <SubSection
            title="Toolkit Maps"
            right={(
              <button
                onClick={() => setShowMaps(v => !v)}
                className="px-2 py-0.5 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
              >
                {showMaps ? 'Hide' : 'Show'}
              </button>
            )}
          >
            {showMaps && (
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-gray-800 rounded bg-black/30 p-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Band Map (Sub → Air)</div>
                  <div className="space-y-1">
                    {TIMBRE_UPGRADE_BAND_MAP.map((band) => (
                      <div key={band.band} className="text-[9px] text-gray-400">
                        <span className="text-gray-200 font-bold">{band.band}</span> — {band.contribution} {band.effect}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-800 rounded bg-black/30 p-2">
                  <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Target Feel → Strategy</div>
                  <div className="space-y-1">
                    {TIMBRE_UPGRADE_TEXTURE_MAP.map((row) => (
                      <div key={row.feel} className="text-[9px] text-gray-400">
                        <span className="text-gray-200 font-bold">{row.feel}</span> — {row.strategy}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SubSection>

          <SubSection
            title="Generated report"
            right={
              <button
                onClick={handleCopy}
                className="px-2 py-1 text-[9px] bg-gray-800 border border-gray-700 rounded text-gray-300 hover:text-white"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            }
          >
            <pre className="text-[10px] text-gray-200 whitespace-pre-wrap font-mono max-h-[420px] overflow-y-auto bg-black/40 border border-gray-800 rounded p-2">
              {report}
            </pre>
          </SubSection>
        </div>
      )}
    </Section>
  );
};
