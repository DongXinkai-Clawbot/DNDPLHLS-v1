import React from 'react';
import { Knob } from '../../../common/AudioControls';
import { Section, SubSection, Label, Select, Checkbox } from '../../audio/SynthPatchEditor';
import type { TimbrePatch } from '../../../../types';
import { SYNC_DIVISIONS } from '../constants';

type TimbreEffectsColumnProps = {
  activePatch: TimbrePatch;
  activeFxTab: string;
  setActiveFxTab: (value: string) => void;
  effectsAdvanced: boolean;
  setEffectsAdvanced: (value: boolean) => void;
  updateVoice: (partial: Partial<TimbrePatch['voice']>) => void;
};

export const TimbreEffectsColumn = ({
  activePatch,
  activeFxTab,
  setActiveFxTab,
  effectsAdvanced,
  setEffectsAdvanced,
  updateVoice
}: TimbreEffectsColumnProps) => {
  return (
    <>
      <Section title="Effects Rack">
        <div className="flex flex-wrap gap-1 mb-3 border-b border-gray-800/50 pb-2">
          {['EQ', 'Chorus', 'Phaser', 'Delay', 'Reverb', 'Comp', 'Limiter', 'Dist', 'Bitcrush'].map(fx => (
            <button
              key={fx}
              onClick={() => setActiveFxTab(fx.toLowerCase())}
              className={`px-2 py-1 text-[9px] font-black uppercase rounded transition-colors ${activeFxTab === fx.toLowerCase() ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {fx}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end mb-2">
          <Checkbox
            label="Advanced"
            checked={effectsAdvanced}
            onChange={(v) => setEffectsAdvanced(v)}
          />
        </div>

        {/* ... other effects ... */}

        {activeFxTab === 'bitcrush' && (
          <div className="space-y-2">
            <Checkbox label="Enable Bitcrush" checked={activePatch.voice.bitcrush?.enabled || false} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.bitcrush?.mix || 0.5} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, mix: v } })} size={36} />
              <Knob label="Depth" value={activePatch.voice.bitcrush?.depth || 0} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, depth: v } })} size={36} />
              {effectsAdvanced && (
                <>
                  <Knob label="Bit" value={activePatch.voice.bitcrush?.bitDepth ?? 12} min={2} max={16} step={1} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, bitDepth: v } })} size={36} />
                  <Knob label="Rate" value={activePatch.voice.bitcrush?.sampleRateReduce ?? 1} min={1} max={32} step={1} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, sampleRateReduce: v } })} size={36} />
                  <Knob label="Jitter" value={activePatch.voice.bitcrush?.jitter ?? 0} max={1} step={0.01} onChange={(v) => updateVoice({ bitcrush: { ...activePatch.voice.bitcrush, jitter: v } })} size={36} />
                </>
              )}
            </div>
          </div>
        )}


        {activeFxTab === 'eq' && (
          <div className="space-y-2">
            <Checkbox label="Enable EQ" checked={activePatch.voice.eq.enabled} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-black/30 p-1 rounded">
                <Label>LOW</Label>
                <Knob label="Freq" value={activePatch.voice.eq.lowFreq} min={20} max={1000} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, lowFreq: v } })} size={30} />
                <Knob label="Gain" value={activePatch.voice.eq.lowGain} min={-12} max={12} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, lowGain: v } })} size={30} />
              </div>
              <div className="bg-black/30 p-1 rounded">
                <Label>MID</Label>
                <Knob label="Freq" value={activePatch.voice.eq.midFreq} min={200} max={5000} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, midFreq: v } })} size={30} />
                <Knob label="Gain" value={activePatch.voice.eq.midGain} min={-12} max={12} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, midGain: v } })} size={30} />
                {effectsAdvanced && (
                  <Knob label="Q" value={activePatch.voice.eq.midQ} min={0.2} max={10} step={0.1} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, midQ: v } })} size={30} />
                )}
              </div>
              <div className="bg-black/30 p-1 rounded">
                <Label>HIGH</Label>
                <Knob label="Freq" value={activePatch.voice.eq.highFreq} min={2000} max={15000} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, highFreq: v } })} size={30} />
                <Knob label="Gain" value={activePatch.voice.eq.highGain} min={-12} max={12} onChange={(v) => updateVoice({ eq: { ...activePatch.voice.eq, highGain: v } })} size={30} />
              </div>
            </div>
          </div>
        )}

        {activeFxTab === 'chorus' && (
          <div className="space-y-2">
            <Checkbox label="Enable Chorus" checked={activePatch.voice.chorus.enabled} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.chorus.mix} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, mix: v } })} size={36} />
              <Knob label="Depth" value={activePatch.voice.chorus.depth} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, depth: v } })} size={36} />
              <Knob label="Rate" value={activePatch.voice.chorus.rate} max={10} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, rate: v } })} size={36} />
              <Knob label="Delay" value={activePatch.voice.chorus.delay} max={0.1} step={0.001} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, delay: v } })} size={36} />
              <Knob label="Feedbk" value={activePatch.voice.chorus.feedback} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, feedback: v } })} size={36} />
              {effectsAdvanced && (
                <>
                  <Knob label="Spread" value={activePatch.voice.chorus.spread} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, spread: v } })} size={36} />
                  <div className="flex items-center">
                    <Checkbox label="Sync" checked={activePatch.voice.chorus.sync ?? false} onChange={(v) => updateVoice({ chorus: { ...activePatch.voice.chorus, sync: v } })} />
                  </div>
                  {activePatch.voice.chorus.sync && (
                    <Select
                      value={activePatch.voice.chorus.syncDivision || '1/4'}
                      onChange={(e) => updateVoice({ chorus: { ...activePatch.voice.chorus, syncDivision: e.target.value as any } })}
                    >
                      {SYNC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeFxTab === 'phaser' && (
          <div className="space-y-2">
            <Checkbox label="Enable Phaser" checked={activePatch.voice.phaser.enabled} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.phaser.mix} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, mix: v } })} size={36} />
              <Knob label="Depth" value={activePatch.voice.phaser.depth} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, depth: v } })} size={36} />
              <Knob label="Rate" value={activePatch.voice.phaser.rate} max={10} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, rate: v } })} size={36} />
              <Knob label="Feedbk" value={activePatch.voice.phaser.feedback} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, feedback: v } })} size={36} />
              <Knob label="BaseHz" value={activePatch.voice.phaser.baseHz} min={100} max={2000} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, baseHz: v } })} size={36} />
              {effectsAdvanced && (
                <>
                  <Knob label="Stages" value={activePatch.voice.phaser.stages} min={2} max={12} step={1} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, stages: v } })} size={36} />
                  <div className="flex items-center">
                    <Checkbox label="Sync" checked={activePatch.voice.phaser.sync ?? false} onChange={(v) => updateVoice({ phaser: { ...activePatch.voice.phaser, sync: v } })} />
                  </div>
                  {activePatch.voice.phaser.sync && (
                    <Select
                      value={activePatch.voice.phaser.syncDivision || '1/4'}
                      onChange={(e) => updateVoice({ phaser: { ...activePatch.voice.phaser, syncDivision: e.target.value as any } })}
                    >
                      {SYNC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeFxTab === 'delay' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-1">
              <Checkbox label="Enable Delay" checked={activePatch.voice.delay.enabled} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, enabled: v } })} />
              <Select
                value={activePatch.voice.delay.type || 'stereo'}
                onChange={(e) => updateVoice({ delay: { ...activePatch.voice.delay, type: e.target.value as any } })}
              >
                <option value="stereo">Stereo</option>
                <option value="pingpong">Ping Pong</option>
                <option value="cross">Cross</option>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.delay.mix} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, mix: v } })} size={36} />
              <Knob label="Time" value={activePatch.voice.delay.timeMs} max={2000} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, timeMs: v } })} size={36} />
              <Knob label="Feedbk" value={activePatch.voice.delay.feedback} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, feedback: v } })} size={36} />
              <Knob label="Offset" value={activePatch.voice.delay.stereoOffsetMs} max={500} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, stereoOffsetMs: v } })} size={36} />
              <Knob label="Color" value={activePatch.voice.delay.color || 10000} min={100} max={20000} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, color: v } })} size={36} />
              <Knob label="Mod" value={activePatch.voice.delay.modDepth || 0} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, modDepth: v } })} size={36} />
              {effectsAdvanced && (
                <>
                  <Knob label="ModRate" value={activePatch.voice.delay.modRate || 0.5} max={10} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, modRate: v } })} size={36} />
                  <Knob label="HPF" value={activePatch.voice.delay.filterHighpassHz || 40} min={20} max={5000} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, filterHighpassHz: v } })} size={36} />
                  <Knob label="LPF" value={activePatch.voice.delay.filterHz || 8000} min={200} max={20000} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, filterHz: v } })} size={36} />
                  <Knob label="Width" value={activePatch.voice.delay.stereoWidth || 1} max={2} step={0.01} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, stereoWidth: v } })} size={36} />
                  <Knob label="Duck" value={activePatch.voice.delay.ducking || 0} max={1} step={0.01} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, ducking: v } })} size={36} />
                  <div className="flex items-center">
                    <Checkbox label="Sync" checked={activePatch.voice.delay.sync} onChange={(v) => updateVoice({ delay: { ...activePatch.voice.delay, sync: v } })} />
                  </div>
                  {activePatch.voice.delay.sync && (
                    <Select
                      value={activePatch.voice.delay.syncDivision || '1/4'}
                      onChange={(e) => updateVoice({ delay: { ...activePatch.voice.delay, syncDivision: e.target.value as any } })}
                    >
                      {SYNC_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </Select>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeFxTab === 'reverb' && (
          <div className="space-y-2">
            <Checkbox label="Enable Reverb" checked={activePatch.voice.space.reverb.enabled} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, enabled: v } } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.space.reverb.mix} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, mix: v } } })} size={36} />
              <Knob label="Decay" value={activePatch.voice.space.reverb.decay} max={10} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, decay: v } } })} size={36} />
              <Knob label="PreDly" value={activePatch.voice.space.reverb.preDelayMs} max={500} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, preDelayMs: v } } })} size={36} />
              <Knob label="Size" value={activePatch.voice.space.reverb.size || 0.5} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, size: v } } })} size={36} />
              <Knob label="Color" value={activePatch.voice.space.reverb.color || 10000} min={100} max={20000} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, color: v } } })} size={36} />
              <Knob label="Mod" value={activePatch.voice.space.reverb.modDepth || 0} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, modDepth: v } } })} size={36} />
              {effectsAdvanced && (
                <>
                  <Knob label="Damp" value={activePatch.voice.space.reverb.dampingHz || 5000} min={200} max={20000} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, dampingHz: v } } })} size={36} />
                  <Knob label="ModSpd" value={activePatch.voice.space.reverb.modSpeed || 0.5} max={5} step={0.01} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, modSpeed: v } } })} size={36} />
                  <Knob label="Stereo" value={activePatch.voice.space.reverb.stereoWidth || 1} max={2} step={0.01} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, stereoWidth: v } } })} size={36} />
                  <Knob label="EarlyMx" value={activePatch.voice.space.reverb.earlyMix || 0} max={1} step={0.01} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, earlyMix: v } } })} size={36} />
                  <Knob label="EarlyD" value={activePatch.voice.space.reverb.earlyDelayMs || 0} max={100} step={1} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, reverb: { ...activePatch.voice.space.reverb, earlyDelayMs: v } } })} size={36} />
                </>
              )}
            </div>
            {effectsAdvanced && (
              <SubSection title="Resonance">
                <div className="grid grid-cols-3 gap-2">
                  <Checkbox
                    label="Enable"
                    checked={activePatch.voice.space.resonance.enabled}
                    onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, resonance: { ...activePatch.voice.space.resonance, enabled: v } } })}
                  />
                  <Knob label="Mix" value={activePatch.voice.space.resonance.mix} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, resonance: { ...activePatch.voice.space.resonance, mix: v } } })} size={32} />
                  <Knob label="Delay" value={activePatch.voice.space.resonance.delayMs} max={100} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, resonance: { ...activePatch.voice.space.resonance, delayMs: v } } })} size={32} />
                  <Knob label="Feedbk" value={activePatch.voice.space.resonance.feedback} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, resonance: { ...activePatch.voice.space.resonance, feedback: v } } })} size={32} />
                  <Knob label="Damp" value={activePatch.voice.space.resonance.dampingHz} min={200} max={20000} onChange={(v) => updateVoice({ space: { ...activePatch.voice.space, resonance: { ...activePatch.voice.space.resonance, dampingHz: v } } })} size={32} />
                </div>
              </SubSection>
            )}
            <div className="mt-2 pt-2 border-t border-gray-800/50">
              <div className="flex justify-between mb-1"><Label>KARPLUS</Label><Checkbox label="" checked={activePatch.voice.karplus.enabled} onChange={(v) => updateVoice({ karplus: { ...activePatch.voice.karplus, enabled: v } })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <Knob label="Mix" value={activePatch.voice.karplus.mix} onChange={(v) => updateVoice({ karplus: { ...activePatch.voice.karplus, mix: v } })} size={30} />
                <Knob label="Feedbk" value={activePatch.voice.karplus.feedback} onChange={(v) => updateVoice({ karplus: { ...activePatch.voice.karplus, feedback: v } })} size={30} />
                <Knob label="Damp" value={activePatch.voice.karplus.dampingHz} min={100} max={10000} onChange={(v) => updateVoice({ karplus: { ...activePatch.voice.karplus, dampingHz: v } })} size={30} />
              </div>
            </div>
          </div>
        )}

        {activeFxTab === 'comp' && (
          <div className="space-y-2">
            <Checkbox label="Enable Comp" checked={activePatch.voice.compressor.enabled} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Thresh" value={activePatch.voice.compressor.threshold} min={-60} max={0} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, threshold: v } })} size={36} />
              <Knob label="Ratio" value={activePatch.voice.compressor.ratio} min={1} max={20} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, ratio: v } })} size={36} />
              <Knob label="Gain" value={activePatch.voice.compressor.gain} min={0} max={20} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, gain: v } })} size={36} />
              <Knob label="Att" value={activePatch.voice.compressor.attackMs} max={100} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, attackMs: v } })} size={36} />
              <Knob label="Rel" value={activePatch.voice.compressor.releaseMs} max={1000} onChange={(v) => updateVoice({ compressor: { ...activePatch.voice.compressor, releaseMs: v } })} size={36} />
            </div>
          </div>
        )}

        {activeFxTab === 'limiter' && (
          <div className="space-y-2">
            <Checkbox label="Enable Limiter" checked={activePatch.voice.limiter?.enabled || false} onChange={(v) => updateVoice({ limiter: { ...activePatch.voice.limiter, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="PreGain" value={mapRange(activePatch.voice.limiter?.preGain || 0, -12, 12, 0, 1)} onChange={(v) => updateVoice({ limiter: { ...activePatch.voice.limiter, preGain: mapRange(v, 0, 1, -12, 12) } })} size={36} />
              <Knob label="Mix" value={activePatch.voice.limiter?.mix ?? 1} onChange={(v) => updateVoice({ limiter: { ...activePatch.voice.limiter, mix: v } })} size={36} />
              <Knob label="Thresh" value={activePatch.voice.limiter?.threshold || 0} min={-60} max={0} onChange={(v) => updateVoice({ limiter: { ...activePatch.voice.limiter, threshold: v } })} size={36} />
              <Knob label="Rel" value={activePatch.voice.limiter?.releaseMs || 50} max={1000} onChange={(v) => updateVoice({ limiter: { ...activePatch.voice.limiter, releaseMs: v } })} size={36} />
            </div>
          </div>
        )}

        {activeFxTab === 'dist' && (
          <div className="space-y-2">
            <Checkbox label="Enable Dist" checked={activePatch.voice.nonlinearity.enabled} onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, enabled: v } })} />
            <div className="grid grid-cols-3 gap-2">
              <Knob label="Mix" value={activePatch.voice.nonlinearity.mix} onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, mix: v } })} size={36} />
              <Knob label="Drive" value={activePatch.voice.nonlinearity.drive} max={20} onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, drive: v } })} size={36} />
              <Knob label="Comp" value={activePatch.voice.nonlinearity.compensation} max={5} onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, compensation: v } })} size={36} />
              {effectsAdvanced && (
                <>
                  <div className="flex flex-col items-center">
                    <Label>Type</Label>
                    <Select
                      value={activePatch.voice.nonlinearity.type}
                      onChange={(e) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, type: e.target.value as any } })}
                    >
                      {['tanh', 'soft-clip', 'hard-clip', 'diode', 'wavefold', 'sine-fold', 'bit-crush'].map(t => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div className="flex items-center">
                    <Checkbox
                      label="Auto Gain"
                      checked={activePatch.voice.nonlinearity.autoGain}
                      onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, autoGain: v } })}
                    />
                  </div>
                  <Knob label="Trim" value={activePatch.voice.nonlinearity.outputTrim || 0} max={12} min={-12} onChange={(v) => updateVoice({ nonlinearity: { ...activePatch.voice.nonlinearity, outputTrim: v } })} size={36} />
                </>
              )}
            </div>
          </div>
        )}
      </Section>

    </>
  );
};
