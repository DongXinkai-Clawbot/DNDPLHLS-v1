import React from 'react';
import { clearTimbreEngineError, panicTimbreEngine } from '../../../timbreEngine';
import { VirtualKeyboard } from '../VirtualKeyboard';
import type { TimbreModRoute, TimbrePatch } from '../../../types';
import { TimbreAssistant } from '../TimbreAssistant';
import { PatchHeader } from './sections/PatchHeader';
import { LeftOscSection } from './sections/LeftOscSection';
import { LeftSampleSection } from './sections/LeftSampleSection';
import { LeftToneSection } from './sections/LeftToneSection';
import { TimbreMiddleColumn } from './sections/TimbreMiddleColumn';
import { TimbreEffectsColumn } from './sections/TimbreEffectsColumn';
import { TimbreModColumn } from './sections/TimbreModColumn';

type TimbreTabViewProps = {
  settings: any;
  timbre: any;
  patches: TimbrePatch[];
  activePatch: TimbrePatch;
  engineError: string | null;
  setEngineError: React.Dispatch<React.SetStateAction<string | null>>;
  activeOscTab: number;
  setActiveOscTab: React.Dispatch<React.SetStateAction<number>>;
  activeFxTab: string;
  setActiveFxTab: React.Dispatch<React.SetStateAction<string>>;
  updateTimbre: (partial: any) => void;
  updateActive: (partial: Partial<TimbrePatch>) => void;
  updateVoice: (partial: Partial<TimbrePatch['voice']>) => void;
  updateOsc: (idx: number, partial: Partial<TimbrePatch['voice']['oscBank']['oscillators'][0]>) => void;
  updateRoute: (idx: number, partial: Partial<TimbreModRoute>) => void;
  updatePattern: (idx: number, val: number) => void;
};

export const TimbreTabView = ({
  settings,
  timbre,
  patches,
  activePatch,
  engineError,
  setEngineError,
  activeOscTab,
  setActiveOscTab,
  activeFxTab,
  setActiveFxTab,
  updateTimbre,
  updateActive,
  updateVoice,
  updateOsc,
  updateRoute,
  updatePattern
}: TimbreTabViewProps) => {
  const [showAssistant, setShowAssistant] = React.useState(false);
  const [expandedRoutes, setExpandedRoutes] = React.useState<Record<string, boolean>>({});
  const [lfoAdvanced, setLfoAdvanced] = React.useState<Record<string, boolean>>({});
  const [advancedPanels, setAdvancedPanels] = React.useState<Record<string, boolean>>({});
  const [effectsAdvanced, setEffectsAdvanced] = React.useState(false);

  const togglePanel = (key: string) => {
    setAdvancedPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSample = (partial: Partial<TimbrePatch['voice']['sample']>) => {
    updateVoice({ sample: { ...activePatch.voice.sample, ...partial } });
  };

  const updateSampleLayer = (idx: number, partial: Partial<TimbrePatch['voice']['sample']['layers'][0]>) => {
    const nextLayers = [...activePatch.voice.sample.layers];
    nextLayers[idx] = { ...nextLayers[idx], ...partial };
    updateSample({ layers: nextLayers });
  };

  const updateSampleRegion = (layerIdx: number, regionIdx: number, partial: Partial<TimbrePatch['voice']['sample']['layers'][0]['regions'][0]>) => {
    const nextLayers = [...activePatch.voice.sample.layers];
    const nextRegions = [...nextLayers[layerIdx].regions];
    nextRegions[regionIdx] = { ...nextRegions[regionIdx], ...partial };
    nextLayers[layerIdx] = { ...nextLayers[layerIdx], regions: nextRegions };
    updateSample({ layers: nextLayers });
  };

  const updateReleaseSample = (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['releaseSamples']>[0]>) => {
    const current = activePatch.voice.sample.releaseSamples || [];
    const next = [...current];
    next[idx] = { ...next[idx], ...partial };
    updateSample({ releaseSamples: next });
  };

  const updateReleaseRegion = (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['releaseSamples']>[0]['region']>) => {
    const current = activePatch.voice.sample.releaseSamples || [];
    const next = [...current];
    next[idx] = { ...next[idx], region: { ...next[idx].region, ...partial } };
    updateSample({ releaseSamples: next });
  };

  const updateLegatoTransition = (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['legatoTransitions']>[0]>) => {
    const current = activePatch.voice.sample.legatoTransitions || [];
    const next = [...current];
    next[idx] = { ...next[idx], ...partial };
    updateSample({ legatoTransitions: next });
  };

  const updateLegatoRegion = (idx: number, partial: Partial<NonNullable<TimbrePatch['voice']['sample']['legatoTransitions']>[0]['region']>) => {
    const current = activePatch.voice.sample.legatoTransitions || [];
    const next = [...current];
    next[idx] = { ...next[idx], region: { ...next[idx].region, ...partial } };
    updateSample({ legatoTransitions: next });
  };

  const updateVa = (partial: Partial<TimbrePatch['voice']['vaOsc']>) => {
    updateVoice({ vaOsc: { ...activePatch.voice.vaOsc, ...partial } });
  };

  const updateFmOperator = (idx: number, partial: Partial<TimbrePatch['voice']['fmOperators']['operators'][0]>) => {
    const nextOps = [...activePatch.voice.fmOperators.operators] as TimbrePatch['voice']['fmOperators']['operators'];
    nextOps[idx] = { ...nextOps[idx], ...partial };
    updateVoice({ fmOperators: { ...activePatch.voice.fmOperators, operators: nextOps } });
  };


  return (
    <div className="h-full flex flex-col gap-2 p-1 relative">
      {showAssistant && <TimbreAssistant onClose={() => setShowAssistant(false)} />}

      <PatchHeader
        timbre={timbre}
        patches={patches}
        activePatch={activePatch}
        updateTimbre={updateTimbre}
        updateActive={updateActive}
        onOpenAssistant={() => setShowAssistant(true)}
        onPanic={panicTimbreEngine}
      />

      {engineError && (
        <div className="bg-red-900/30 border border-red-800 text-red-200 px-3 py-2 rounded text-xs flex justify-between">
          <span>Error: {engineError}</span>
          <button onClick={() => { clearTimbreEngineError(); setEngineError(null); }} className="underline">Dismiss</button>
        </div>
      )}

      <div className="shrink-0 h-48 border rounded-lg border-gray-800 overflow-hidden mb-2">
        <VirtualKeyboard settingsOverride={settings} />
      </div>

      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        <div className="col-span-4 flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
          <LeftOscSection
            activePatch={activePatch}
            activeOscTab={activeOscTab}
            setActiveOscTab={setActiveOscTab}
            updateVoice={updateVoice}
            updateOsc={updateOsc}
            advancedPanels={advancedPanels}
            togglePanel={togglePanel}
          />
          <LeftSampleSection
            activePatch={activePatch}
            updateSample={updateSample}
            updateSampleLayer={updateSampleLayer}
            updateSampleRegion={updateSampleRegion}
            updateReleaseSample={updateReleaseSample}
            updateReleaseRegion={updateReleaseRegion}
            updateLegatoTransition={updateLegatoTransition}
            updateLegatoRegion={updateLegatoRegion}
            advancedPanels={advancedPanels}
            togglePanel={togglePanel}
          />
          <LeftToneSection
            activePatch={activePatch}
            updateVoice={updateVoice}
            updateActive={updateActive}
            updateVa={updateVa}
            advancedPanels={advancedPanels}
            togglePanel={togglePanel}
          />
        </div>

        <TimbreMiddleColumn
          activePatch={activePatch}
          updateVoice={updateVoice}
          updateActive={updateActive}
          updateFmOperator={updateFmOperator}
          advancedPanels={advancedPanels}
          togglePanel={togglePanel}
          lfoAdvanced={lfoAdvanced}
          setLfoAdvanced={setLfoAdvanced}
        />

        <div className="col-span-4 flex flex-col gap-2">
          <TimbreEffectsColumn
            activePatch={activePatch}
            activeFxTab={activeFxTab}
            setActiveFxTab={setActiveFxTab}
            effectsAdvanced={effectsAdvanced}
            setEffectsAdvanced={setEffectsAdvanced}
            updateVoice={updateVoice}
          />
          <TimbreModColumn
            activePatch={activePatch}
            expandedRoutes={expandedRoutes}
            setExpandedRoutes={setExpandedRoutes}
            updateVoice={updateVoice}
            updateActive={updateActive}
            updateRoute={updateRoute}
            updatePattern={updatePattern}
          />
        </div>
      </div>
    </div>
  );
};
