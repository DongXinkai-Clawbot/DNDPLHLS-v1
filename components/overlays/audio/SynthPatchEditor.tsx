
import React, { useState } from 'react';
import { Vector3 } from 'three';
import type { SynthPatch, SynthOscillatorSpec, NodeData } from '../../../types';
import { startNote } from '../../../audioEngine';

export const number = (v: any, fallback: number) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : fallback;
};

export const ensurePatch = (p?: SynthPatch): SynthPatch => p ?? ({
    name: 'New Patch',
    gain: 0.5,
    osc: [{ type: 'sine', gain: 1 }],
    env: { attackMs: 5, decayMs: 120, sustain: 0.4, releaseMs: 180 },
    filter: { enabled: false, type: 'lowpass', cutoffHz: 1800, q: 0.8, envAmount: 0 },
    lfo: { enabled: false, waveform: 'sine', rateHz: 5, depth: 0.2, target: 'pitch' },
    unison: { enabled: false, voices: 2, detuneCents: 6, stereoSpread: 0.4 },
    glideMs: 0
});

const oscTypes = ['sine', 'triangle', 'square', 'sawtooth', 'pulse', 'noise'] as const;
const filterTypes = ['lowpass', 'highpass', 'bandpass', 'notch'] as const;
const lfoTargets = ['pitch', 'filter', 'amp'] as const;

export const Label = ({ children }: { children?: React.ReactNode }) => (
    <span className="block text-[9px] font-bold text-gray-500 uppercase mb-1 truncate">{children}</span>
);

export const Input = ({ className = '', ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'>) => (
    <input
        className={`w-full bg-black/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-blue-100 focus:border-blue-500 outline-none transition-colors font-mono ${className}`}
        {...props}
    />
);

export const Select = ({ className = '', style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }) => (
    <select
        className={`w-full bg-black/50 border border-gray-700 rounded px-1 py-1 text-[10px] text-gray-300 focus:border-blue-500 outline-none appearance-none font-sans cursor-pointer [&>option]:bg-gray-900 [&>option]:text-gray-300 ${className}`}
        style={{ colorScheme: 'dark', ...style }}
        {...props}
    />
);

export const Checkbox = ({ label, checked, onChange, className }: { label: string, checked: boolean, onChange: (v: boolean) => void, className?: string }) => (
    <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onChange(!checked); }}
        className={`flex items-center gap-2 cursor-pointer group select-none ${className ?? ''}`}
    >
        <div className={`w-3 h-3 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-600 group-hover:border-gray-500'}`}>
            {checked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
        </div>
        <span className="text-[10px] font-bold text-gray-400 group-hover:text-blue-300 transition-colors uppercase">{label}</span>
    </button>
);

export const Section = ({ title, children, className = "" }: { title: string, children?: React.ReactNode, className?: string }) => (
    <div className={`p-3 bg-gray-900/40 border border-gray-800 rounded-lg ${className}`}>
        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1 flex items-center gap-2">
            {title}
        </h4>
        {children}
    </div>
);

export const SubSection = ({ title, children, right }: { title: string, children?: React.ReactNode, right?: React.ReactNode }) => (
    <div className="mt-3 bg-black/20 p-2 rounded border border-gray-800/50">
        <div className="flex justify-between items-center mb-2">
            <h5 className="text-[9px] font-bold text-gray-500 uppercase">{title}</h5>
            {right}
        </div>
        {children}
    </div>
);

export function PatchEditor({ title, patch, onPatch }: { title: string; patch: SynthPatch; onPatch: (p: SynthPatch) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const p = patch;

    const set = (k: keyof SynthPatch, v: any) => onPatch({ ...p, [k]: v } as SynthPatch);
    const setEnv = (k: keyof SynthPatch['env'], v: any) => onPatch({ ...p, env: { ...p.env, [k]: v } });
    const setFilter = (k: keyof NonNullable<SynthPatch['filter']>, v: any) => onPatch({ ...p, filter: { ...(p.filter ?? { enabled: false, type: 'lowpass', cutoffHz: 1800, q: 0.8, envAmount: 0 }), [k]: v } });
    const setLfo = (k: keyof NonNullable<SynthPatch['lfo']>, v: any) => onPatch({ ...p, lfo: { ...(p.lfo ?? { enabled: false, waveform: 'sine', rateHz: 5, depth: 0.2, target: 'pitch' }), [k]: v } });
    const setUnison = (k: keyof NonNullable<SynthPatch['unison']>, v: any) => onPatch({ ...p, unison: { ...(p.unison ?? { enabled: false, voices: 2, detuneCents: 6, stereoSpread: 0.4 }), [k]: v } });

    const updateOsc = (idx: number, partial: Partial<SynthOscillatorSpec>) => {
        const next = p.osc.map((o, i) => i === idx ? ({ ...o, ...partial }) : o);
        onPatch({ ...p, osc: next });
    };

    const handleTest = (e: React.MouseEvent) => {
        e.stopPropagation();
        const dummyNode: NodeData = {
            id: 'preview',
            position: new Vector3(),
            primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
            ratio: { n: 1n, d: 1n },
            octave: 0,
            cents: 0,
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: 'Test'
        };

        const mockSettings: any = {
            baseFrequency: 440,
            visuals: { temperamentMorph: 0 },
            instrumentClick: 'custom-synth',
            instrumentChord: 'custom-synth',
            instrumentKeyboard: 'custom-synth',
            synthPatches: {
                enabled: true,
                clickPatch: p,
                chordPatch: p,
                keyboardPatch: p
            },
            playDurationSingle: 0.5,
            playDurationDual: 2.0
        };

        const stop = startNote(dummyNode, mockSettings, 'chord');
        setTimeout(() => stop(), 1000);
    };

    return (
        <div className="border border-gray-700 bg-gray-900/60 rounded-lg overflow-hidden transition-all duration-200">
            <div className="w-full flex items-center justify-between p-3 bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-wider">{title}</span>
                    <span className="text-[9px] text-gray-500 font-mono">({p.osc.length} Osc)</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleTest}
                        className="px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-[9px] font-bold rounded shadow-lg border border-green-600 active:scale-95 transition-all"
                    >
                        ▶ TEST
                    </button>
                    <span className="text-gray-500 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
            </div>

            {isOpen && <div className="p-3 space-y-4 border-t border-gray-800">

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Patch Name</Label>
                        <Input value={p.name ?? ''} onChange={e => set('name', e.target.value)} />
                    </div>
                    <div>
                        <Label>Master Gain</Label>
                        <Input type="number" step="0.01" value={p.gain} onChange={e => set('gain', number(e.target.value, p.gain))} />
                    </div>
                </div>

                <SubSection title="Oscillators" right={
                    <div className="flex gap-1">
                        <button className="px-2 py-0.5 border border-gray-600 rounded bg-gray-800 text-[8px] text-gray-300 hover:text-white" onClick={() => onPatch({ ...p, osc: [...p.osc, { type: 'sine', gain: 0.4 }] })}>+ Add</button>
                        {p.osc.length > 1 && <button className="px-2 py-0.5 border border-gray-600 rounded bg-gray-800 text-[8px] text-gray-300 hover:text-white" onClick={() => onPatch({ ...p, osc: p.osc.slice(0, -1) })}>- Rem</button>}
                    </div>
                }>
                    <div className="space-y-2">
                        {p.osc.map((o, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-2 bg-black/30 p-1.5 rounded border border-white/5">
                                <div>
                                    <Label>Type</Label>
                                    <Select value={o.type} onChange={e => updateOsc(idx, { type: e.target.value as any })}>
                                        {oscTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </Select>
                                </div>
                                <div>
                                    <Label>Gain</Label>
                                    <Input type="number" step="0.01" value={o.gain ?? 0.7} onChange={e => updateOsc(idx, { gain: number(e.target.value, o.gain ?? 0.7) })} />
                                </div>
                                <div>
                                    <Label>Detune ¢</Label>
                                    <Input type="number" step="1" value={o.detuneCents ?? 0} onChange={e => updateOsc(idx, { detuneCents: number(e.target.value, o.detuneCents ?? 0) })} />
                                </div>
                                <div>
                                    <Label>Pulse W</Label>
                                    <Input type="number" step="0.01" value={o.pulseWidth ?? 0.5} onChange={e => updateOsc(idx, { pulseWidth: number(e.target.value, o.pulseWidth ?? 0.5) })} />
                                </div>
                            </div>
                        ))}
                    </div>
                </SubSection>

                <SubSection title="Envelope (ADSR)">
                    <div className="grid grid-cols-4 gap-2">
                        <div><Label>Attack</Label><Input type="number" value={p.env.attackMs} onChange={e => setEnv('attackMs', number(e.target.value, p.env.attackMs))} /></div>
                        <div><Label>Decay</Label><Input type="number" value={p.env.decayMs} onChange={e => setEnv('decayMs', number(e.target.value, p.env.decayMs))} /></div>
                        <div><Label>Sustain</Label><Input type="number" step="0.01" value={p.env.sustain} onChange={e => setEnv('sustain', number(e.target.value, p.env.sustain))} /></div>
                        <div><Label>Release</Label><Input type="number" value={p.env.releaseMs} onChange={e => setEnv('releaseMs', number(e.target.value, p.env.releaseMs))} /></div>
                    </div>
                </SubSection>

                <SubSection title="Filter" right={<Checkbox label="Active" checked={p.filter?.enabled ?? false} onChange={e => setFilter('enabled', e)} />}>
                    <div className={`grid grid-cols-4 gap-2 transition-opacity ${p.filter?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                            <Label>Type</Label>
                            <Select value={p.filter?.type ?? 'lowpass'} onChange={e => setFilter('type', e.target.value as any)}>
                                {filterTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                        <div><Label>Cutoff</Label><Input type="number" value={p.filter?.cutoffHz ?? 1800} onChange={e => setFilter('cutoffHz', number(e.target.value, 1800))} /></div>
                        <div><Label>Q</Label><Input type="number" step="0.01" value={p.filter?.q ?? 0.8} onChange={e => setFilter('q', number(e.target.value, 0.8))} /></div>
                        <div><Label>Env Mod</Label><Input type="number" step="0.01" value={p.filter?.envAmount ?? 0} onChange={e => setFilter('envAmount', number(e.target.value, 0))} /></div>
                    </div>
                </SubSection>

                <SubSection title="LFO" right={<Checkbox label="Active" checked={p.lfo?.enabled ?? false} onChange={e => setLfo('enabled', e)} />}>
                    <div className={`grid grid-cols-4 gap-2 transition-opacity ${p.lfo?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div>
                            <Label>Wave</Label>
                            <Select value={p.lfo?.waveform ?? 'sine'} onChange={e => setLfo('waveform', e.target.value as any)}>
                                {['sine', 'triangle', 'square', 'sawtooth'].map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                        <div><Label>Rate</Label><Input type="number" step="0.01" value={p.lfo?.rateHz ?? 5} onChange={e => setLfo('rateHz', number(e.target.value, 5))} /></div>
                        <div><Label>Depth</Label><Input type="number" step="0.01" value={p.lfo?.depth ?? 0.2} onChange={e => setLfo('depth', number(e.target.value, 0.2))} /></div>
                        <div>
                            <Label>Target</Label>
                            <Select value={p.lfo?.target ?? 'pitch'} onChange={e => setLfo('target', e.target.value as any)}>
                                {lfoTargets.map(t => <option key={t} value={t}>{t}</option>)}
                            </Select>
                        </div>
                    </div>
                </SubSection>

                <SubSection title="Unison" right={<Checkbox label="Active" checked={p.unison?.enabled ?? false} onChange={e => setUnison('enabled', e)} />}>
                    <div className={`grid grid-cols-3 gap-2 transition-opacity ${p.unison?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        <div><Label>Voices</Label><Input type="number" value={p.unison?.voices ?? 2} onChange={e => setUnison('voices', number(e.target.value, 2))} /></div>
                        <div><Label>Detune</Label><Input type="number" value={p.unison?.detuneCents ?? 6} onChange={e => setUnison('detuneCents', number(e.target.value, 6))} /></div>
                        <div><Label>Spread</Label><Input type="number" step="0.01" value={p.unison?.stereoSpread ?? 0.4} onChange={e => setUnison('stereoSpread', number(e.target.value, 0.4))} /></div>
                    </div>
                </SubSection>

            </div>}
        </div>
    );
}
