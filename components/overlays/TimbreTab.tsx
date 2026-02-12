import React, { useEffect, useState } from 'react';
import { getTimbreEngineError } from '../../timbreEngine';
import type { TimbreModRoute, TimbrePatch } from '../../types';
import { TimbreTabView } from './timbreTab/TimbreTabView';
import { ensureMacro, patternToValues } from './timbreTab/helpers';

export const TimbreTab = ({ settings, handleSettingChange }: any) => {
  const timbre = settings.timbre;
  const [engineError, setEngineError] = useState<string | null>(getTimbreEngineError());
  const [activeOscTab, setActiveOscTab] = useState(0);
  const [activeFxTab, setActiveFxTab] = useState('reverb');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      setEngineError(detail || null);
    };
    window.addEventListener('timbre-engine-error', handler);
    return () => window.removeEventListener('timbre-engine-error', handler);
  }, []);

  const patches = timbre.patches || [];
  const activePatch = patches.find((p: TimbrePatch) => p.id === timbre.activePatchId) || patches[0];

  if (activePatch && activePatch.macros.length < 8) {
    const next = [...activePatch.macros];
    while (next.length < 8) next.push(ensureMacro({}, next.length));
  }

  const updateTimbre = (partial: Partial<typeof timbre>) => {
    handleSettingChange({ timbre: { ...timbre, ...partial } });
  };

  const updatePatch = (nextPatch: TimbrePatch) => {
    const nextPatches = patches.map((p: TimbrePatch) => p.id === nextPatch.id ? nextPatch : p);
    updateTimbre({ patches: nextPatches });
  };

  const updateActive = (partial: Partial<TimbrePatch>) => updatePatch({ ...activePatch, ...partial });
  const updateVoice = (partial: Partial<TimbrePatch['voice']>) => updateActive({ voice: { ...activePatch.voice, ...partial } });

  const updateOsc = (idx: number, partial: Partial<TimbrePatch['voice']['oscBank']['oscillators'][0]>) => {
    const next = activePatch.voice.oscBank.oscillators.map((o, i) => i === idx ? { ...o, ...partial } : o);
    updateVoice({ oscBank: { ...activePatch.voice.oscBank, oscillators: next } });
  };

  const updateRoute = (idx: number, partial: Partial<TimbreModRoute>) => {
    const next = activePatch.modMatrix.map((r, i) => i === idx ? { ...r, ...partial } : r);
    updateActive({ modMatrix: next });
  };


  const updatePattern = (idx: number, val: number) => {
    const current = patternToValues(activePatch.voice.harmonic.pattern, 16);
    current[idx] = val;
    updateVoice({ harmonic: { ...activePatch.voice.harmonic, pattern: current.map(v => v.toFixed(2)).join(',') } });
  };

  if (!activePatch) return <div className="text-xs text-gray-500">No patches.</div>;

  const viewProps = {
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
  };

  return <TimbreTabView {...viewProps} />;
};
