import React, { useMemo, useState } from 'react';
import { Checkbox, Label, Input, Select } from '../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../types';

type TimbreUpgradeActionableRackProps = {
  activePatch?: TimbrePatch;
  updateActive?: (partial: Partial<TimbrePatch>) => void;
  updateVoice?: (partial: Partial<TimbrePatch['voice']>) => void;
};

type EngineField = {
  type: 'number' | 'text' | 'select' | 'toggle';
  label: string;
  value: any;
  onChange: (value: any) => void;
  step?: number;
  options?: string[];
  optional?: boolean;
};

type EngineGroup = {
  title?: string;
  fields: EngineField[];
};

type EngineModule = {
  id: string;
  title: string;
  description?: string;
  toggle?: EngineField;
  groups: EngineGroup[];
};

export const TimbreUpgradeActionableRack = ({
  activePatch,
  updateActive,
  updateVoice
}: TimbreUpgradeActionableRackProps) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const canEditPatch = !!activePatch && !!updateActive && !!updateVoice;

  const toNumber = (value: string, fallback: number) => {
    const v = parseFloat(value);
    return Number.isFinite(v) ? v : fallback;
  };

  const toOptionalNumber = (value: string) => {
    const v = parseFloat(value);
    return Number.isFinite(v) ? v : undefined;
  };

  const updateRouting = (partial: Partial<TimbrePatch['routing']>) => {
    if (!canEditPatch || !activePatch || !updateActive) return;
    updateActive({ routing: { ...activePatch.routing, ...partial } });
  };

  const updateVoiceBlock = (key: keyof TimbrePatch['voice'], partial: any) => {
    if (!canEditPatch || !activePatch || !updateVoice) return;
    updateVoice({ [key]: { ...(activePatch.voice as any)[key], ...partial } } as any);
  };

  const updateReverb = (partial: Partial<TimbrePatch['voice']['space']['reverb']>) => {
    if (!canEditPatch || !activePatch || !updateVoice) return;
    updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, ...partial } } });
  };

  const updateDelay = (partial: Partial<TimbrePatch['voice']['delay']>) => {
    if (!canEditPatch || !activePatch || !updateVoice) return;
    updateVoice({ delay: { ...activePatch.voice.delay, ...partial } });
  };

  const updateLfo1 = (partial: Partial<TimbrePatch['voice']['lfo']['lfo1']>) => {
    if (!canEditPatch || !activePatch || !updateVoice) return;
    updateVoice({ lfo: { ...activePatch.voice.lfo, lfo1: { ...activePatch.voice.lfo.lfo1, ...partial } } });
  };

  const updateGranular = (partial: Partial<NonNullable<TimbrePatch['voice']['granular']>>) => {
    if (!canEditPatch || !activePatch || !updateVoice || !activePatch.voice.granular) return;
    updateVoice({ granular: { ...activePatch.voice.granular, ...partial } } as any);
  };

  const renderField = (field: EngineField) => {
    if (field.type === 'toggle') {
      return (
        <div className="flex items-center">
          <Checkbox label={field.label} checked={!!field.value} onChange={(v) => field.onChange(v)} />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div>
          <Label>{field.label}</Label>
          <Select value={field.value} onChange={(e) => field.onChange(e.target.value)}>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>
      );
    }

    if (field.type === 'text') {
      return (
        <div>
          <Label>{field.label}</Label>
          <Input value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value)} />
        </div>
      );
    }

    return (
      <div>
        <Label>{field.label}</Label>
        <Input
          type="number"
          step={field.step}
          value={field.value ?? ''}
          onChange={(e) => {
            const next = field.optional
              ? toOptionalNumber(e.target.value)
              : toNumber(e.target.value, field.value ?? 0);
            field.onChange(next);
          }}
        />
      </div>
    );
  };

  const modules = useMemo<EngineModule[]>(() => {
    if (!canEditPatch || !activePatch) return [];

    return [
      {
        id: 'M2',
        title: 'M2 Master Filter (HPF/LPF)',
        description: 'Structural cleanup filter',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.masterFilter.enabled,
          onChange: (v) => updateVoiceBlock('masterFilter', { enabled: v })
        },
        groups: [
          {
            fields: [
              {
                type: 'select',
                label: 'Type',
                value: activePatch.voice.masterFilter.type,
                onChange: (v) => updateVoiceBlock('masterFilter', { type: v }),
                options: ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'lowshelf', 'highshelf', 'peaking']
              },
              {
                type: 'number',
                label: 'Cutoff Hz',
                value: activePatch.voice.masterFilter.cutoffHz,
                onChange: (v) => updateVoiceBlock('masterFilter', { cutoffHz: v })
              },
              {
                type: 'number',
                label: 'Resonance',
                step: 0.01,
                value: activePatch.voice.masterFilter.resonance,
                onChange: (v) => updateVoiceBlock('masterFilter', { resonance: v })
              },
              {
                type: 'number',
                label: 'Mix',
                step: 0.01,
                value: activePatch.voice.masterFilter.mix,
                onChange: (v) => updateVoiceBlock('masterFilter', { mix: v })
              }
            ]
          }
        ]
      },
      {
        id: 'M3',
        title: 'M3 Tone EQ',
        description: 'Low / Mid / High sculpting',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.eq.enabled,
          onChange: (v) => {
            updateRouting({ enableEq: v });
            updateVoiceBlock('eq', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              { type: 'number', label: 'Low Freq', value: activePatch.voice.eq.lowFreq, onChange: (v) => updateVoiceBlock('eq', { lowFreq: v }) },
              { type: 'number', label: 'Low Gain', step: 0.1, value: activePatch.voice.eq.lowGain, onChange: (v) => updateVoiceBlock('eq', { lowGain: v }) },
              { type: 'number', label: 'Mid Freq', value: activePatch.voice.eq.midFreq, onChange: (v) => updateVoiceBlock('eq', { midFreq: v }) },
              { type: 'number', label: 'Mid Gain', step: 0.1, value: activePatch.voice.eq.midGain, onChange: (v) => updateVoiceBlock('eq', { midGain: v }) },
              { type: 'number', label: 'Mid Q', step: 0.01, value: activePatch.voice.eq.midQ, onChange: (v) => updateVoiceBlock('eq', { midQ: v }) },
              { type: 'number', label: 'High Freq', value: activePatch.voice.eq.highFreq, onChange: (v) => updateVoiceBlock('eq', { highFreq: v }) },
              { type: 'number', label: 'High Gain', step: 0.1, value: activePatch.voice.eq.highGain, onChange: (v) => updateVoiceBlock('eq', { highGain: v }) }
            ]
          }
        ]
      },
      {
        id: 'M4',
        title: 'M4 Dynamics (Compressor)',
        description: 'Glue & control',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.compressor.enabled,
          onChange: (v) => {
            updateRouting({ enableCompressor: v });
            updateVoiceBlock('compressor', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              { type: 'number', label: 'Threshold', step: 0.1, value: activePatch.voice.compressor.threshold, onChange: (v) => updateVoiceBlock('compressor', { threshold: v }) },
              { type: 'number', label: 'Ratio', step: 0.1, value: activePatch.voice.compressor.ratio, onChange: (v) => updateVoiceBlock('compressor', { ratio: v }) },
              { type: 'number', label: 'Attack (ms)', step: 1, value: activePatch.voice.compressor.attackMs, onChange: (v) => updateVoiceBlock('compressor', { attackMs: v }) },
              { type: 'number', label: 'Release (ms)', step: 1, value: activePatch.voice.compressor.releaseMs, onChange: (v) => updateVoiceBlock('compressor', { releaseMs: v }) },
              { type: 'number', label: 'Makeup Gain', step: 0.1, value: activePatch.voice.compressor.gain, onChange: (v) => updateVoiceBlock('compressor', { gain: v }) }
            ]
          }
        ]
      },
      {
        id: 'M5',
        title: 'M5 Harmonics (Saturation)',
        description: 'Drive & color',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.nonlinearity.enabled,
          onChange: (v) => {
            updateRouting({ enableNonlinearity: v });
            updateVoiceBlock('nonlinearity', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              {
                type: 'select',
                label: 'Type',
                value: activePatch.voice.nonlinearity.type,
                onChange: (v) => updateVoiceBlock('nonlinearity', { type: v }),
                options: ['tanh', 'soft-clip', 'hard-clip', 'diode', 'wavefold', 'sine-fold', 'bit-crush']
              },
              { type: 'number', label: 'Drive', step: 0.1, value: activePatch.voice.nonlinearity.drive, onChange: (v) => updateVoiceBlock('nonlinearity', { drive: v }) },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.nonlinearity.mix, onChange: (v) => updateVoiceBlock('nonlinearity', { mix: v }) },
              { type: 'number', label: 'Compensation', step: 0.1, value: activePatch.voice.nonlinearity.compensation, onChange: (v) => updateVoiceBlock('nonlinearity', { compensation: v }) },
              { type: 'toggle', label: 'Auto Gain', value: activePatch.voice.nonlinearity.autoGain, onChange: (v) => updateVoiceBlock('nonlinearity', { autoGain: v }) },
              { type: 'number', label: 'Output Trim', step: 0.1, value: activePatch.voice.nonlinearity.outputTrim ?? 0, onChange: (v) => updateVoiceBlock('nonlinearity', { outputTrim: v }) }
            ]
          }
        ]
      },
      {
        id: 'M6',
        title: 'M6 Transient (Amp Envelope)',
        description: 'Attack / Decay / Sustain / Release',
        groups: [
          {
            fields: [
              { type: 'number', label: 'Attack (ms)', step: 1, value: activePatch.voice.envelopes.amp.attackMs, onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, attackMs: v } }) },
              { type: 'number', label: 'Hold (ms)', step: 1, value: activePatch.voice.envelopes.amp.holdMs ?? 0, optional: true, onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, holdMs: v } }) },
              { type: 'number', label: 'Decay (ms)', step: 1, value: activePatch.voice.envelopes.amp.decayMs, onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, decayMs: v } }) },
              { type: 'number', label: 'Sustain', step: 0.01, value: activePatch.voice.envelopes.amp.sustain, onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, sustain: v } }) },
              { type: 'number', label: 'Release (ms)', step: 1, value: activePatch.voice.envelopes.amp.releaseMs, onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, releaseMs: v } }) },
              {
                type: 'select',
                label: 'Curve',
                value: activePatch.voice.envelopes.amp.curve || 'linear',
                onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, curve: v } }),
                options: ['linear', 'log', 'invert-log', 'exp', 'pow', 's-curve', 'step', 'bipolar-s-curve']
              },
              {
                type: 'number',
                label: 'Curve Amt',
                step: 0.1,
                value: activePatch.voice.envelopes.amp.curveAmount ?? '',
                optional: true,
                onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, curveAmount: v } })
              },
              {
                type: 'number',
                label: 'Curve Steps',
                step: 1,
                value: activePatch.voice.envelopes.amp.curveSteps ?? '',
                optional: true,
                onChange: (v) => updateVoiceBlock('envelopes', { amp: { ...activePatch.voice.envelopes.amp, curveSteps: v } })
              }
            ]
          }
        ]
      },
      {
        id: 'M7',
        title: 'M7 Stereo / Depth (Unison + Chorus)',
        description: 'Width & dimension',
        groups: [
          {
            title: 'Unison',
            fields: [
              { type: 'toggle', label: 'Enable', value: activePatch.voice.unison.enabled, onChange: (v) => updateVoiceBlock('unison', { enabled: v }) },
              { type: 'number', label: 'Voices', step: 1, value: activePatch.voice.unison.voices, onChange: (v) => updateVoiceBlock('unison', { voices: v }) },
              { type: 'number', label: 'Detune', step: 1, value: activePatch.voice.unison.detune, onChange: (v) => updateVoiceBlock('unison', { detune: v }) },
              { type: 'number', label: 'Spread', step: 0.01, value: activePatch.voice.unison.spread, onChange: (v) => updateVoiceBlock('unison', { spread: v }) },
              { type: 'number', label: 'Phase', step: 0.01, value: activePatch.voice.unison.phase ?? 0, onChange: (v) => updateVoiceBlock('unison', { phase: v }) },
              { type: 'number', label: 'Blend', step: 0.01, value: activePatch.voice.unison.blend, onChange: (v) => updateVoiceBlock('unison', { blend: v }) }
            ]
          },
          {
            title: 'Chorus',
            fields: [
              { type: 'toggle', label: 'Enable', value: activePatch.voice.chorus.enabled, onChange: (v) => { updateRouting({ enableChorus: v }); updateVoiceBlock('chorus', { enabled: v }); } },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.chorus.mix, onChange: (v) => updateVoiceBlock('chorus', { mix: v }) },
              { type: 'number', label: 'Depth', step: 0.01, value: activePatch.voice.chorus.depth, onChange: (v) => updateVoiceBlock('chorus', { depth: v }) },
              { type: 'number', label: 'Rate', step: 0.01, value: activePatch.voice.chorus.rate, onChange: (v) => updateVoiceBlock('chorus', { rate: v }) },
              { type: 'number', label: 'Delay', step: 0.01, value: activePatch.voice.chorus.delay, onChange: (v) => updateVoiceBlock('chorus', { delay: v }) },
              { type: 'number', label: 'Feedback', step: 0.01, value: activePatch.voice.chorus.feedback, onChange: (v) => updateVoiceBlock('chorus', { feedback: v }) },
              { type: 'number', label: 'Spread', step: 0.01, value: activePatch.voice.chorus.spread, onChange: (v) => updateVoiceBlock('chorus', { spread: v }) },
              { type: 'toggle', label: 'Sync', value: activePatch.voice.chorus.sync ?? false, onChange: (v) => updateVoiceBlock('chorus', { sync: v }) },
              {
                type: 'select',
                label: 'Sync Div',
                value: activePatch.voice.chorus.syncDivision || '1/4',
                onChange: (v) => updateVoiceBlock('chorus', { syncDivision: v }),
                options: ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64']
              }
            ]
          }
        ]
      },
      {
        id: 'M8',
        title: 'M8 Space (Reverb + Delay)',
        description: 'Depth and glue',
        groups: [
          {
            title: 'Reverb',
            fields: [
              { type: 'toggle', label: 'Enable', value: activePatch.voice.space.reverb.enabled, onChange: (v) => { updateRouting({ enableSpace: v }); updateReverb({ enabled: v }); } },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.space.reverb.mix, onChange: (v) => updateReverb({ mix: v }) },
              { type: 'number', label: 'Decay', step: 0.01, value: activePatch.voice.space.reverb.decay, onChange: (v) => updateReverb({ decay: v }) },
              { type: 'number', label: 'PreDelay (ms)', step: 1, value: activePatch.voice.space.reverb.preDelayMs, onChange: (v) => updateReverb({ preDelayMs: v }) },
              { type: 'number', label: 'Size', step: 0.01, value: activePatch.voice.space.reverb.size, onChange: (v) => updateReverb({ size: v }) },
              { type: 'number', label: 'Color', step: 1, value: activePatch.voice.space.reverb.color, onChange: (v) => updateReverb({ color: v }) },
              { type: 'number', label: 'Stereo Width', step: 0.01, value: activePatch.voice.space.reverb.stereoWidth ?? 1, onChange: (v) => updateReverb({ stereoWidth: v }) },
              { type: 'number', label: 'Mod Depth', step: 0.01, value: activePatch.voice.space.reverb.modDepth, onChange: (v) => updateReverb({ modDepth: v }) },
              { type: 'number', label: 'Mod Speed', step: 0.01, value: activePatch.voice.space.reverb.modSpeed, onChange: (v) => updateReverb({ modSpeed: v }) },
              { type: 'number', label: 'Damping Hz', step: 1, value: activePatch.voice.space.reverb.dampingHz, onChange: (v) => updateReverb({ dampingHz: v }) },
              { type: 'number', label: 'Early Mix', step: 0.01, value: activePatch.voice.space.reverb.earlyMix ?? '', optional: true, onChange: (v) => updateReverb({ earlyMix: v }) },
              { type: 'number', label: 'Early Delay (ms)', step: 1, value: activePatch.voice.space.reverb.earlyDelayMs ?? '', optional: true, onChange: (v) => updateReverb({ earlyDelayMs: v }) }
            ]
          },
          {
            title: 'Delay',
            fields: [
              { type: 'toggle', label: 'Enable', value: activePatch.voice.delay.enabled, onChange: (v) => { updateRouting({ enableDelay: v }); updateDelay({ enabled: v }); } },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.delay.mix, onChange: (v) => updateDelay({ mix: v }) },
              { type: 'number', label: 'Time (ms)', step: 1, value: activePatch.voice.delay.timeMs, onChange: (v) => updateDelay({ timeMs: v }) },
              { type: 'number', label: 'Feedback', step: 0.01, value: activePatch.voice.delay.feedback, onChange: (v) => updateDelay({ feedback: v }) },
              { type: 'number', label: 'Stereo Offset', step: 1, value: activePatch.voice.delay.stereoOffsetMs, onChange: (v) => updateDelay({ stereoOffsetMs: v }) },
              { type: 'toggle', label: 'Ping Pong', value: activePatch.voice.delay.pingPong, onChange: (v) => updateDelay({ pingPong: v }) },
              { type: 'toggle', label: 'Sync', value: activePatch.voice.delay.sync, onChange: (v) => updateDelay({ sync: v }) },
              {
                type: 'select',
                label: 'Sync Div',
                value: activePatch.voice.delay.syncDivision || '1/4',
                onChange: (v) => updateDelay({ syncDivision: v }),
                options: ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64']
              },
              {
                type: 'select',
                label: 'Type',
                value: activePatch.voice.delay.type,
                onChange: (v) => updateDelay({ type: v }),
                options: ['stereo', 'pingpong', 'cross']
              },
              { type: 'number', label: 'LPF Hz', step: 1, value: activePatch.voice.delay.filterHz, onChange: (v) => updateDelay({ filterHz: v }) },
              { type: 'number', label: 'HPF Hz', step: 1, value: activePatch.voice.delay.filterHighpassHz ?? '', optional: true, onChange: (v) => updateDelay({ filterHighpassHz: v }) },
              { type: 'number', label: 'Stereo Width', step: 0.01, value: activePatch.voice.delay.stereoWidth ?? 1, optional: true, onChange: (v) => updateDelay({ stereoWidth: v }) },
              { type: 'number', label: 'Ducking', step: 0.01, value: activePatch.voice.delay.ducking ?? 0, optional: true, onChange: (v) => updateDelay({ ducking: v }) },
              { type: 'number', label: 'Color', step: 1, value: activePatch.voice.delay.color, onChange: (v) => updateDelay({ color: v }) },
              { type: 'number', label: 'Mod Depth', step: 0.01, value: activePatch.voice.delay.modDepth, onChange: (v) => updateDelay({ modDepth: v }) },
              { type: 'number', label: 'Mod Rate', step: 0.01, value: activePatch.voice.delay.modRate, onChange: (v) => updateDelay({ modRate: v }) }
            ]
          }
        ]
      },
      {
        id: 'M9',
        title: 'M9 Motion (LFO1)',
        description: 'Slow movement and drift',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.lfo.lfo1.enabled,
          onChange: (v) => updateLfo1({ enabled: v })
        },
        groups: [
          {
            fields: [
              {
                type: 'select',
                label: 'Waveform',
                value: activePatch.voice.lfo.lfo1.waveform,
                onChange: (v) => updateLfo1({ waveform: v }),
                options: ['sine', 'triangle', 'square', 'sawtooth', 'sample&hold']
              },
              { type: 'number', label: 'Rate (Hz)', step: 0.01, value: activePatch.voice.lfo.lfo1.rateHz, onChange: (v) => updateLfo1({ rateHz: v }) },
              { type: 'toggle', label: 'Sync', value: activePatch.voice.lfo.lfo1.tempoSync ?? false, onChange: (v) => updateLfo1({ tempoSync: v }) },
              {
                type: 'select',
                label: 'Sync Div',
                value: activePatch.voice.lfo.lfo1.syncDivision || '1/4',
                onChange: (v) => updateLfo1({ syncDivision: v }),
                options: ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64']
              },
              { type: 'number', label: 'Phase', step: 0.01, value: activePatch.voice.lfo.lfo1.phase ?? 0, onChange: (v) => updateLfo1({ phase: v }) },
              { type: 'number', label: 'Fade In (ms)', step: 1, value: activePatch.voice.lfo.lfo1.fadeInMs ?? 0, onChange: (v) => updateLfo1({ fadeInMs: v }) },
              { type: 'toggle', label: 'One-shot', value: activePatch.voice.lfo.lfo1.oneShot ?? false, onChange: (v) => updateLfo1({ oneShot: v }) },
              { type: 'toggle', label: 'Retrig', value: activePatch.voice.lfo.lfo1.retrigger ?? true, onChange: (v) => updateLfo1({ retrigger: v }) },
              {
                type: 'select',
                label: 'Curve',
                value: activePatch.voice.lfo.lfo1.curve || 'linear',
                onChange: (v) => updateLfo1({ curve: v }),
                options: ['linear', 'log', 'invert-log', 'exp', 'pow', 's-curve', 'step', 'bipolar-s-curve']
              },
              { type: 'number', label: 'Curve Amt', step: 0.1, value: activePatch.voice.lfo.lfo1.curveAmount ?? '', optional: true, onChange: (v) => updateLfo1({ curveAmount: v }) },
              { type: 'number', label: 'Curve Steps', step: 1, value: activePatch.voice.lfo.lfo1.curveSteps ?? '', optional: true, onChange: (v) => updateLfo1({ curveSteps: v }) }
            ]
          }
        ]
      },
      {
        id: 'M10',
        title: 'M10 Texture (Noise)',
        description: 'Noise layer and texture',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.noise.enabled,
          onChange: (v) => {
            updateRouting({ enableNoise: v });
            updateVoiceBlock('noise', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.noise.mix, onChange: (v) => updateVoiceBlock('noise', { mix: v }) },
              { type: 'number', label: 'Burst', step: 0.01, value: activePatch.voice.noise.burstAmount, onChange: (v) => updateVoiceBlock('noise', { burstAmount: v }) },
              { type: 'number', label: 'Burst Decay', step: 1, value: activePatch.voice.noise.burstDecayMs, onChange: (v) => updateVoiceBlock('noise', { burstDecayMs: v }) },
              { type: 'number', label: 'Sustain', step: 0.01, value: activePatch.voice.noise.sustainAmount, onChange: (v) => updateVoiceBlock('noise', { sustainAmount: v }) },
              { type: 'number', label: 'Filter Hz', step: 1, value: activePatch.voice.noise.filterHz, onChange: (v) => updateVoiceBlock('noise', { filterHz: v }) },
              { type: 'number', label: 'HPF Hz', step: 1, value: activePatch.voice.noise.highpassHz, onChange: (v) => updateVoiceBlock('noise', { highpassHz: v }) },
              { type: 'number', label: 'Color', step: 0.01, value: activePatch.voice.noise.color, onChange: (v) => updateVoiceBlock('noise', { color: v }) },
              { type: 'number', label: 'Stereo Width', step: 0.01, value: activePatch.voice.noise.stereoWidth, onChange: (v) => updateVoiceBlock('noise', { stereoWidth: v }) }
            ]
          },
          ...(activePatch.voice.granular ? [{
            title: 'Granular',
            fields: [
              { type: 'toggle', label: 'Enable', value: activePatch.voice.granular.enabled, onChange: (v: boolean) => { updateRouting({ enableGranular: v }); updateGranular({ enabled: v }); } },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.granular.mix, onChange: (v: number) => updateGranular({ mix: v }) },
              { type: 'number', label: 'Grain Size', step: 1, value: activePatch.voice.granular.grainSizeMs, onChange: (v: number) => updateGranular({ grainSizeMs: v }) },
              { type: 'number', label: 'Density', step: 0.1, value: activePatch.voice.granular.density, onChange: (v: number) => updateGranular({ density: v }) },
              { type: 'number', label: 'Position', step: 0.01, value: activePatch.voice.granular.position, onChange: (v: number) => updateGranular({ position: v }) },
              { type: 'number', label: 'Pos Jitter', step: 0.01, value: activePatch.voice.granular.positionJitter, onChange: (v: number) => updateGranular({ positionJitter: v }) },
              { type: 'number', label: 'Pitch', step: 0.1, value: activePatch.voice.granular.pitch, onChange: (v: number) => updateGranular({ pitch: v }) },
              { type: 'number', label: 'Spray', step: 0.01, value: activePatch.voice.granular.spray, onChange: (v: number) => updateGranular({ spray: v }) },
              {
                type: 'select',
                label: 'Window',
                value: activePatch.voice.granular.windowType,
                onChange: (v: string) => updateGranular({ windowType: v as any }),
                options: ['hann', 'tri', 'rect']
              },
              { type: 'toggle', label: 'Freeze', value: activePatch.voice.granular.freeze, onChange: (v: boolean) => updateGranular({ freeze: v }) },
              { type: 'text', label: 'Source URL', value: activePatch.voice.granular.sourceUrl ?? '', onChange: (v: string) => updateGranular({ sourceUrl: v }) }
            ]
          }] : [])
        ]
      },
      {
        id: 'M11',
        title: 'M11 Character (Bitcrush)',
        description: 'Lo-fi & grit',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.bitcrush.enabled,
          onChange: (v) => {
            updateRouting({ enableBitcrush: v });
            updateVoiceBlock('bitcrush', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              { type: 'number', label: 'Bit Depth', step: 1, value: activePatch.voice.bitcrush.bitDepth ?? 12, onChange: (v) => updateVoiceBlock('bitcrush', { bitDepth: v }) },
              { type: 'number', label: 'Rate Reduce', step: 1, value: activePatch.voice.bitcrush.sampleRateReduce ?? 1, onChange: (v) => updateVoiceBlock('bitcrush', { sampleRateReduce: v }) },
              { type: 'number', label: 'Jitter', step: 0.01, value: activePatch.voice.bitcrush.jitter ?? 0, onChange: (v) => updateVoiceBlock('bitcrush', { jitter: v }) },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.bitcrush.mix, onChange: (v) => updateVoiceBlock('bitcrush', { mix: v }) }
            ]
          }
        ]
      },
      {
        id: 'M12',
        title: 'M12 Final QC (Limiter)',
        description: 'Peak control',
        toggle: {
          type: 'toggle',
          label: 'Enable',
          value: activePatch.voice.limiter.enabled,
          onChange: (v) => {
            updateRouting({ enableLimiter: v });
            updateVoiceBlock('limiter', { enabled: v });
          }
        },
        groups: [
          {
            fields: [
              { type: 'number', label: 'PreGain', step: 0.1, value: activePatch.voice.limiter.preGain, onChange: (v) => updateVoiceBlock('limiter', { preGain: v }) },
              { type: 'number', label: 'Mix', step: 0.01, value: activePatch.voice.limiter.mix, onChange: (v) => updateVoiceBlock('limiter', { mix: v }) },
              { type: 'number', label: 'Threshold', step: 0.1, value: activePatch.voice.limiter.threshold, onChange: (v) => updateVoiceBlock('limiter', { threshold: v }) },
              { type: 'number', label: 'Release (ms)', step: 1, value: activePatch.voice.limiter.releaseMs, onChange: (v) => updateVoiceBlock('limiter', { releaseMs: v }) }
            ]
          }
        ]
      }
    ];
  }, [activePatch, canEditPatch, updateActive, updateVoice]);

  if (!canEditPatch) {
    return (
      <div className="text-[9px] text-gray-500">
        No active patch is connected to the Toolkit. Open the Timbre tab and select a patch to enable these controls.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {modules.map((module) => (
        <div key={module.id} className="border border-gray-800 rounded bg-black/30 p-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {module.toggle ? (
                <Checkbox label={module.title} checked={!!module.toggle.value} onChange={(v) => module.toggle?.onChange(v)} />
              ) : (
                <div className="text-[9px] text-gray-300 font-bold">{module.title}</div>
              )}
              {module.description && <span className="text-[9px] text-gray-500">{module.description}</span>}
            </div>
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [module.id]: !prev[module.id] }))}
              className="text-[9px] text-gray-500 hover:text-white"
            >
              {expanded[module.id] ? 'Hide' : 'Details'}
            </button>
          </div>
          {expanded[module.id] && (
            <div className="space-y-2 mt-2">
              {module.groups.map((group, groupIdx) => (
                <div key={`${module.id}-group-${groupIdx}`}>
                  {group.title && <div className="text-[9px] text-gray-500 uppercase mb-1">{group.title}</div>}
                  <div className="grid grid-cols-3 gap-2">
                    {group.fields.map((field, fieldIdx) => (
                      <div key={`${module.id}-${groupIdx}-${fieldIdx}`}>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
