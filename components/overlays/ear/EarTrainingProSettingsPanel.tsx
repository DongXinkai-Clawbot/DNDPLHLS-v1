import React from 'react';
import type { EarTrainingSettings, EarTaskType, EarTrainingContentPools } from '../../../types';
import { useStore } from '../../../store';
import { getChordRatio, parseGeneralRatio, normalizeOctave, getPrimeVectorFromRatio, calculateCents } from '../../../musicLogic';
import { Label, Input, Select, Checkbox, Section, SubSection, number } from '../../common/SynthPatchEditor';
import { startNote } from '../../../audioEngine';
import { CHORD_LIBRARY_GROUPS } from '../../../utils/chordLibrary';
import { DEFAULT_SCALES, buildMelodyPool, buildDuoMelodyPool, buildProgressionPool, buildIntervalPool, buildChordPool, formatSequenceAnswer, formatDuoAnswer, formatProgressionAnswer } from './EarLogic';
import { Vector3 } from 'three';

type Props = {
  settings: EarTrainingSettings;
  onChange: (partial: Partial<EarTrainingSettings>) => void;
};

const TASKS: { id: EarTaskType; label: string; placeholder: string; hint: string }[] = [
  { id: 'interval', label: 'Interval', placeholder: 'Major 3rd=5/4', hint: 'Format: label=ratio or just ratio.' },
  { id: 'compare', label: 'Compare', placeholder: '9/8 | 10/9', hint: 'Format: A | B (ratios).' },
  { id: 'chord', label: 'Chord', placeholder: 'Major=1/1,5/4,3/2', hint: 'Format: label=1/1,5/4,3/2' },
  { id: 'drift', label: 'Drift', placeholder: '7/4', hint: 'Format: ratio only.' },
  { id: 'melody', label: 'Melody Dictation', placeholder: '1/1@1 9/8@0.5 5/4@1 4/3@1 3/2@2', hint: 'Format: ratio sequence (use @duration if needed).' },
  { id: 'duo_melody', label: 'Dual Melody', placeholder: '1/1 5/4 3/2 | 1/1 4/3 3/2', hint: 'Format: upper | lower (each line may use @duration).' },
  { id: 'progression', label: 'Progression', placeholder: '1/1,5/4,3/2@2 ; 1/1,6/5,3/2@1', hint: 'Format: chord ; chord ; chord (use @duration if needed).' }
];

export function EarTrainingProSettingsPanel({ settings, onChange }: Props) {
  const pro = settings.pro ?? {};
  const content = pro.content ?? {};
  const referenceTone = pro.referenceTone ?? { mode: 'none', ratios: ['1/1'] };
  const sequence = pro.sequence ?? {};
  const chordSettings = pro.chord ?? {};
  const appSettings = useStore(s => s.settings);
  const savedChords = useStore(s => s.savedChords);
  const saveChord = useStore(s => s.saveChord);
  const savedMidiScales = useStore(s => s.savedMidiScales);
  const chordItems = content.chord?.items ?? [];
  const chordItemSet = new Set(chordItems);
  const chordLibraryLines = React.useMemo(() => {
    return CHORD_LIBRARY_GROUPS.flatMap(group =>
      group.items.map(item => `${item.label}=${item.ratios}`)
    );
  }, []);
  const chordLibraryLineSet = React.useMemo(() => new Set(chordLibraryLines), [chordLibraryLines]);
  const previewStopsRef = React.useRef<(() => void)[]>([]);
  const previewTimerRef = React.useRef<number | null>(null);

  const setPro = (p: any) => onChange({ pro: { ...(settings.pro || {}), ...p } });
  const setTaskWeight = (taskId: EarTaskType, value: number) => {
    onChange({
      taskWeights: {
        ...settings.taskWeights,
        [taskId]: Math.max(0, value)
      }
    });
  };
  const setContent = (taskId: keyof EarTrainingContentPools, partial: any) => {
    const current = content[taskId] ?? { enabled: false, items: [] };
    setPro({
      content: {
        ...content,
        [taskId]: { ...current, ...partial }
      }
    });
  };

  const gcdBigInt = (a: bigint, b: bigint) => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y !== 0n) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  };

  const parseNamedLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return { label: '', value: '' };
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      return { label: trimmed.slice(0, idx).trim(), value: trimmed.slice(idx + 1).trim() };
    }
    return { label: '', value: trimmed };
  };

  const chordToRatioLine = (chord: { name: string; nodes: any[] }) => {
    const raw = getChordRatio(chord.nodes || []);
    if (!raw) return null;
    const parts = raw.split(':').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const base = BigInt(parts[0]);
    if (base === 0n) return null;
    const ratios = parts.map(p => {
      const n = BigInt(p);
      const g = gcdBigInt(n, base);
      const num = n / g;
      const den = base / g;
      return `${num.toString()}/${den.toString()}`;
    });
    return `${chord.name}=${ratios.join(',')}`;
  };

  const appendSavedChords = (taskId: keyof EarTrainingContentPools) => {
    if (!savedChords || savedChords.length === 0) return;
    const lines = savedChords.map(chordToRatioLine).filter(Boolean) as string[];
    if (lines.length === 0) return;
    const current = content[taskId] ?? { enabled: false, items: [] };
    const merged = Array.from(new Set([...(current.items ?? []), ...lines]));
    setContent(taskId, { items: merged, enabled: true });
  };

  const mergeSavedMidiScales = (existing: { id: string; name: string; ratios: string[] }[]) => {
    if (!savedMidiScales || savedMidiScales.length === 0) return existing;
    const existingKeys = new Set(existing.map(s => `${s.name}|${s.ratios.join(',')}`));
    const imports = savedMidiScales.map((sc, idx) => {
      const ratios = (sc.scale || []).map(r => r.trim()).filter(Boolean);
      const name = sc.name?.trim() || `MIDI Scale ${idx + 1}`;
      return {
        id: `midi-scale-${sc.id}-${Date.now()}`,
        name,
        ratios
      };
    }).filter(item => item.ratios.length > 0);
    const merged = [...existing];
    imports.forEach(item => {
      const key = `${item.name}|${item.ratios.join(',')}`;
      if (!existingKeys.has(key)) {
        merged.push(item);
        existingKeys.add(key);
      }
    });
    return merged;
  };

  const getScaleState = (taskId: 'melody' | 'duo_melody' | 'interval') => {
    const fallback = {
      useScale: sequence.useScale ?? false,
      activeScaleId: sequence.activeScaleId ?? 'ji_major',
      scalePool: sequence.scalePool ?? []
    };
    const perTask = taskId === 'melody' ? sequence.melodyScale : (taskId === 'duo_melody' ? sequence.duoScale : sequence.intervalScale);
    return { ...fallback, ...(perTask ?? {}) };
  };

  const setScaleState = (taskId: 'melody' | 'duo_melody' | 'interval', next: { useScale?: boolean; activeScaleId?: string; scalePool?: { id: string; name: string; ratios: string[] }[] }) => {
    const key = taskId === 'melody' ? 'melodyScale' : (taskId === 'duo_melody' ? 'duoScale' : 'intervalScale');
    setPro({ sequence: { ...sequence, [key]: next } });
  };

  const renderScaleConstraint = (taskId: 'melody' | 'duo_melody' | 'interval') => {
    const scaleState = getScaleState(taskId);
    const allScales = [...DEFAULT_SCALES, ...(scaleState.scalePool || [])];
    const label = taskId === 'interval' ? 'Interval Scale Constraint' : 'Melodic Scale Constraint';
    return (
      <div className="bg-black/30 p-3 rounded border border-gray-800 space-y-3">
        <div className="flex justify-between items-center">
          <Label>{label}</Label>
          <Checkbox
            label="Limit to Scale"
            checked={scaleState.useScale ?? false}
            onChange={e => setScaleState(taskId, { ...scaleState, useScale: e })}
          />
        </div>

        <div className="mt-2">
          <Label>Ratio Denom Limit (0=No Limit)</Label>
          <Input
            type="number"
            value={(taskId === 'melody' ? sequence.melodyLimit : (taskId === 'duo_melody' ? sequence.duoLimit : pro.intervalLimit)) ?? 0}
            onChange={e => {
              const val = Math.max(0, number(e.target.value, 0));
              if (taskId === 'melody') setPro({ sequence: { ...sequence, melodyLimit: val } });
              else if (taskId === 'duo_melody') setPro({ sequence: { ...sequence, duoLimit: val } });
              else setPro({ intervalLimit: val });
            }}
          />
        </div>

        {scaleState.useScale && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div>
              <Label>Active Scale</Label>
              <Select
                value={scaleState.activeScaleId ?? 'ji_major'}
                onChange={e => setScaleState(taskId, { ...scaleState, activeScaleId: e.target.value })}
              >
                {allScales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>

            <div className="bg-black/30 p-2 rounded border border-gray-800">
              <Label>Custom Scales Pool</Label>
              <textarea
                value={(scaleState.scalePool || []).map(s => `${s.name}=${s.ratios.join(',')}`).join('\n')}
                onChange={e => {
                  const lines = e.target.value.split('\n').filter(l => l.trim());
                  const newPool = lines.map((line, idx) => {
                    const [name, ratiosStr] = line.split('=');
                    const ratios = (ratiosStr || '').split(',').map(r => r.trim()).filter(Boolean);
                    return {
                      id: `custom-scale-${idx}-${Date.now()}`,
                      name: name?.trim() || `Scale ${idx + 1}`,
                      ratios: ratios.length ? ratios : ['1/1']
                    };
                  });
                  setScaleState(taskId, { ...scaleState, scalePool: newPool });
                }}
                placeholder="My Scale = 1/1, 9/8, 5/4..."
                className="w-full min-h-[60px] bg-black/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-blue-100 focus:border-blue-500 outline-none font-mono mt-1"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    const merged = mergeSavedMidiScales(scaleState.scalePool ?? []);
                    setScaleState(taskId, { ...scaleState, scalePool: merged });
                  }}
                  disabled={!savedMidiScales || savedMidiScales.length === 0}
                  className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Saved MIDI Scales
                </button>
                <span className="text-[9px] text-gray-500">Imports from MIDI Mapping presets.</span>
              </div>
              <div className="text-[9px] text-gray-500 mt-1">Format: Name = ratio, ratio, ratio...</div>
            </div>
          </div>
        )}

        <div className="text-[9px] text-gray-500">
          Applies to generated {label} questions only.
        </div>
      </div>
    );
  };

  const parseChordRatiosForPreview = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return [] as string[];
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.every(p => /^-?\d+(\.\d+)?$/.test(p))) {
        const base = parseFloat(parts[0]);
        if (Number.isFinite(base) && base !== 0) {
          return parts.slice(1).map(p => `${p}/${base}`).filter(r => r !== '1/1' && r !== '1');
        }
      }
    }
    return trimmed.split(/[\s,]+/).map(t => t.trim()).filter(Boolean).filter(t => t !== '1/1' && t !== '1');
  };

  const createNodeFromRatioString = (ratioStr: string, name?: string) => {
    const frac = parseGeneralRatio(ratioStr);
    const norm = normalizeOctave(frac);
    return {
      id: `ear-preview-${Math.random()}`,
      position: new Vector3(0, 0, 0),
      primeVector: getPrimeVectorFromRatio(norm.ratio.n, norm.ratio.d),
      ratio: norm.ratio,
      octave: norm.octaves,
      cents: calculateCents(norm.ratio),
      gen: 0,
      originLimit: 0,
      parentId: null,
      name: name || ratioStr
    };
  };

  const saveCustomChordsToCompare = () => {
    if (!saveChord) return;
    const lines = (content.chord?.items ?? []).filter(Boolean);
    if (lines.length === 0) return;
    const existing = new Set((savedChords ?? []).map(c => c.name));
    lines.forEach((line, idx) => {
      const parsed = parseNamedLine(line);
      const ratios = parseChordRatiosForPreview(parsed.value);
      if (ratios.length === 0) return;
      const name = parsed.label || parsed.value || `Custom Chord ${idx + 1}`;
      if (existing.has(name)) return;
      const nodes = [
        createNodeFromRatioString('1/1', 'Root'),
        ...ratios.map(r => createNodeFromRatioString(r, name))
      ];
      saveChord(name, nodes as any);
      existing.add(name);
    });
  };

  const stopChordPreview = () => {
    previewStopsRef.current.forEach(stop => stop());
    previewStopsRef.current = [];
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      stopChordPreview();
    };
  }, []);

  const playChordPreview = (ratios: string, label: string) => {
    const items = parseChordRatiosForPreview(ratios);
    if (items.length === 0) return;
    stopChordPreview();
    const baseFrequency = Math.max(20, (settings.pitch?.fixedBaseFreq ?? 440));
    const previewSettings = {
      ...appSettings,
      baseFrequency,
      instrumentClick: settings.timbre?.clickInstrument ?? appSettings.instrumentClick,
      instrumentChord: settings.timbre?.chordInstrument ?? appSettings.instrumentChord
    };
    const nodes = [
      createNodeFromRatioString('1/1', 'Root'),
      ...items.map(r => createNodeFromRatioString(r, label))
    ];
    previewStopsRef.current = nodes.map(n => startNote(n as any, previewSettings as any, 'chord'));
    const duration = Math.max(0.2, (settings.playback?.chordMs ?? 1800) / 1000);
    previewTimerRef.current = window.setTimeout(stopChordPreview, duration * 1000);
  };

  const toggleChordLibraryLine = (line: string, enabled: boolean) => {
    const next = new Set(chordItems);
    if (enabled) next.add(line);
    else next.delete(line);
    setContent('chord', { items: Array.from(next), enabled: next.size > 0 });
  };

  const selectAllChordLibrary = () => {
    const merged = new Set([...chordItems, ...chordLibraryLines]);
    setContent('chord', { items: Array.from(merged), enabled: merged.size > 0 });
  };

  const clearChordLibrary = () => {
    const remaining = chordItems.filter(item => !chordLibraryLineSet.has(item));
    setContent('chord', { items: remaining, enabled: remaining.length > 0 });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px bg-gray-700 flex-1"></div>
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Professional Settings</span>
        <div className="h-px bg-gray-700 flex-1"></div>
      </div>

      <Section title="Session Logic">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Seed Mode</Label>
              <div className="flex bg-black border border-gray-700 rounded overflow-hidden">
                <button onClick={() => setPro({ seedMode: 'random' })} className={`flex-1 text-[9px] py-1 font-bold ${pro.seedMode === 'random' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}>RND</button>
                <button onClick={() => setPro({ seedMode: 'locked' })} className={`flex-1 text-[9px] py-1 font-bold ${pro.seedMode === 'locked' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>LOCK</button>
              </div>
            </div>
            {pro.seedMode === 'locked' && (
              <div>
                <Label>Seed Key</Label>
                <Input value={pro.lockedSeed ?? 'EAR-V2'} onChange={e => setPro({ lockedSeed: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Label>Selection Mode</Label>
              <Select value={pro.selectionMode ?? 'random'} onChange={e => setPro({ selectionMode: e.target.value })}>
                <option value="random">Random</option>
                <option value="cycle">Cycle</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Avoid Repeat</Label>
                <Input type="number" value={pro.avoidRepeatCount ?? 0} onChange={e => setPro({ avoidRepeatCount: Math.max(0, number(e.target.value, 0)) })} />
              </div>
              <div>
                <Input type="number" value={pro.poolLimit ?? 0} onChange={e => setPro({ poolLimit: Math.max(0, number(e.target.value, 0)) })} />
              </div>
            </div>
            <div className="mt-2">
              <Label>Interval Limit (Denom)</Label>
              <Input type="number" value={pro.intervalLimit ?? 0} onChange={e => setPro({ intervalLimit: Math.max(0, number(e.target.value, 0)) })} />
            </div>
            <Checkbox label="Shuffle Options" checked={pro.shuffleOptions ?? true} onChange={e => setPro({ shuffleOptions: e })} />
          </div>
        </div>
      </Section>

      <Section title="Answering">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Answer Mode</Label>
            <Select value={pro.answerMode ?? 'auto'} onChange={e => setPro({ answerMode: e.target.value })}>
              <option value="auto">Auto</option>
              <option value="choice">Choice</option>
              <option value="text">Text</option>
            </Select>
          </div>
          <div>
            <Label>Options Count</Label>
            <Input type="number" value={pro.optionCount ?? 4} onChange={e => setPro({ optionCount: Math.max(2, number(e.target.value, 4)) })} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <Label>Memory Delay (ms)</Label>
            <Input type="number" value={pro.memoryDelayMs ?? 0} onChange={e => setPro({ memoryDelayMs: Math.max(0, number(e.target.value, 0)) })} />
          </div>
          <div className="pt-3">
            <Checkbox label="Allow Replay" checked={pro.allowReplay ?? true} onChange={e => setPro({ allowReplay: e })} />
          </div>
          <div>
            <Label>Max Replays</Label>
            <Input type="number" value={pro.maxReplays ?? 0} onChange={e => setPro({ maxReplays: Math.max(0, number(e.target.value, 0)) })} />
          </div>
        </div>
      </Section>

      <Section title="Timbre & Instruments">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Melody/Click Instrument</Label>
            <Select
              value={settings.timbre?.clickInstrument ?? 'sine'}
              onChange={e => onChange({ timbre: { ...settings.timbre, clickInstrument: e.target.value as any } })}
            >
              {['sine', 'triangle', 'sawtooth', 'square', 'piano', 'organ', 'synth', 'pad', 'pluck'].map(i => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Chord Instrument</Label>
            <Select
              value={settings.timbre?.chordInstrument ?? 'sine'}
              onChange={e => onChange({ timbre: { ...settings.timbre, chordInstrument: e.target.value as any } })}
            >
              {['sine', 'triangle', 'sawtooth', 'square', 'piano', 'organ', 'synth', 'pad', 'pluck'].map(i => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </Select>
          </div>
          {settings.tasks?.includes('duo_melody') && (
            <>
              <div>
                <Label>Duo Upper Voice</Label>
                <Select
                  value={settings.timbre?.instrumentDuoUpper ?? settings.timbre?.clickInstrument ?? 'sine'}
                  onChange={e => onChange({ timbre: { ...settings.timbre, instrumentDuoUpper: e.target.value as any } })}
                >
                  <option value="">Default (Same as Click)</option>
                  {['sine', 'triangle', 'sawtooth', 'square', 'piano', 'organ', 'synth', 'pad', 'pluck'].map(i => (
                    <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Duo Lower Voice</Label>
                <Select
                  value={settings.timbre?.instrumentDuoLower ?? settings.timbre?.clickInstrument ?? 'sine'}
                  onChange={e => onChange({ timbre: { ...settings.timbre, instrumentDuoLower: e.target.value as any } })}
                >
                  <option value="">Default (Same as Click)</option>
                  {['sine', 'triangle', 'sawtooth', 'square', 'piano', 'organ', 'synth', 'pad', 'pluck'].map(i => (
                    <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                  ))}
                </Select>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Reference Tone">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mode</Label>
            <Select
              value={referenceTone.mode ?? 'none'}
              onChange={e => setPro({ referenceTone: { ...referenceTone, mode: e.target.value as 'none' | 'fixed' | 'random' } })}
            >
              <option value="none">None</option>
              <option value="fixed">Fixed 1/1</option>
              <option value="random">Random from Pool</option>
            </Select>
          </div>
          <div>
            <Label>Pool Ratios</Label>
            <Input
              value={(referenceTone.ratios ?? []).join(', ')}
              onChange={e => {
                const ratios = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                setPro({ referenceTone: { ...referenceTone, ratios } });
              }}
            />
          </div>
        </div>
        <div className="text-[9px] text-gray-500 mt-2">
          Random mode picks one ratio per question and plays it before the prompt.
        </div>
      </Section>

      {(settings.tasks?.some(t => ['melody', 'duo_melody', 'progression'].includes(t))) && (
        <Section title="Sequence & Rhythm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Melody Length</Label>
              <Input
                type="number"
                value={sequence.melodyLength ?? 5}
                onChange={e => setPro({ sequence: { ...sequence, melodyLength: Math.max(2, Math.min(32, number(e.target.value, 5))) } })}
              />
            </div>
            <div>
              <Label>Progression Length</Label>
              <Input
                type="number"
                value={sequence.progressionLength ?? 3}
                onChange={e => setPro({ sequence: { ...sequence, progressionLength: Math.max(2, Math.min(32, number(e.target.value, 3))) } })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <Label>Rhythm Complexity</Label>
              <Select
                value={sequence.rhythmComplexity ?? 'simple'}
                onChange={e => setPro({ sequence: { ...sequence, rhythmComplexity: e.target.value } })}
              >
                <option value="simple">Simple (1/2, 1, 3/2, 2)</option>
                <option value="triplets">Triplets (1/3, 2/3, 1...)</option>
                <option value="complex">Complex (1/4, 1/3, 1/2...)</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <Label>Rhythm Mode</Label>
              <Select
                value={sequence.rhythmMode ?? 'fixed'}
                onChange={e => setPro({ sequence: { ...sequence, rhythmMode: e.target.value as 'fixed' | 'random' } })}
              >
                <option value="fixed">Fixed</option>
                <option value="random">Random</option>
              </Select>
            </div>
          </div>

          <div className="mt-3">
            <Checkbox
              label="Count-in (Melody/Duo)"
              checked={sequence.metronomeEnabled ?? true}
              onChange={e => setPro({ sequence: { ...sequence, metronomeEnabled: e } })}
            />
            <div className="text-[9px] text-gray-500 mt-1">
              Adds a 1 bar count-in before melody/duo playback.
            </div>
          </div>
          <div className="mt-3">
            <Checkbox
              label="Allow Rest (Duo Melody)"
              checked={sequence.duoAllowRest ?? false}
              onChange={e => setPro({ sequence: { ...sequence, duoAllowRest: e } })}
            />
            <div className="text-[9px] text-gray-500 mt-1">
              Inserts rests into generated duo melodies (no simultaneous rests).
            </div>
          </div>

          {sequence.rhythmComplexity === 'custom' && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
              <Label>Custom Rhythm Values (fractions)</Label>
              <Input
                value={(sequence.rhythmValues ?? ['1/2', '1', '3/2', '2']).join(', ')}
                onChange={e => {
                  const vals = e.target.value.split(',').map(v => v.trim()).filter(Boolean);
                  setPro({ sequence: { ...sequence, rhythmValues: vals } });
                }}
                placeholder="1/2, 1, 3/2, 2, 1/3, 2/3..."
              />
              <div className="text-[9px] text-gray-500 mt-1">
                Use fractions: 1/2 = quaver, 1 = crotchet, 3/2 = dotted crotchet, 2 = minim, 1/3 = triplet...
              </div>
            </div>
          )}
        </Section>
      )}

      <Section title="Task Weights">
        <div className="grid grid-cols-2 gap-3">
          {TASKS.map(task => {
            if (!settings.tasks?.includes(task.id)) return null;
            return (
              <div key={task.id}>
                <Label>{task.label}</Label>
                <Input
                  type="number"
                  value={settings.taskWeights?.[task.id] ?? 0}
                  onChange={e => setTaskWeight(task.id, number(e.target.value, 0))}
                />
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Custom Content Pools">
        <div className="space-y-3">
          {TASKS.map(task => {
            if (!settings.tasks?.includes(task.id)) return null;
            const pool = content[task.id] ?? { enabled: false, items: [] };
            const textValue = (pool.items ?? []).join('\n');
            return (
              <React.Fragment key={task.id}>
                <SubSection
                  title={task.label}
                  right={
                    <Checkbox
                      label="Use Custom"
                      checked={pool.enabled ?? false}
                      onChange={e => setContent(task.id, { enabled: e })}
                    />
                  }
                >
                  <textarea
                    value={textValue}
                    onChange={e => {
                      const items = e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                      setContent(task.id, { items });
                    }}
                    placeholder={task.placeholder}
                    className="w-full min-h-[70px] bg-black/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-blue-100 focus:border-blue-500 outline-none font-mono"
                  />
                  {(task.id === 'chord' || task.id === 'progression' || task.id === 'melody' || task.id === 'duo_melody' || task.id === 'interval') && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          
                          const tempSettings = {
                            ...settings,
                            pro: {
                              ...settings.pro,
                              content: {
                                ...content,
                                [task.id]: { enabled: false, items: [] }
                              }
                            }
                          };
                          let newItems: string[] = [];
                          if (task.id === 'melody') {
                            const pool = buildMelodyPool(tempSettings);
                            newItems = pool.map(item => `${item.name}=${formatSequenceAnswer(item.sequence, item.rhythm)}`);
                          } else if (task.id === 'duo_melody') {
                            const pool = buildDuoMelodyPool(tempSettings);
                            newItems = pool.map(item => `${item.name}=${formatDuoAnswer(item.upper, item.lower, item.upperRhythm, item.lowerRhythm)}`);
                          } else if (task.id === 'progression') {
                            const pool = buildProgressionPool(tempSettings);
                            newItems = pool.map(item => `${item.name}=${formatProgressionAnswer(item.chords, item.rhythm)}`);
                          } else if (task.id === 'interval') {
                            const pool = buildIntervalPool(tempSettings);
                            newItems = pool.map(item => `${item.name}=${item.ratioStr}`);
                          } else if (task.id === 'chord') {
                            const pool = buildChordPool(tempSettings);
                            newItems = pool.map(item => `${item.name}=${item.ratios.join(',')}`);
                          }

                          setContent(task.id, { items: newItems, enabled: true });
                        }}
                        className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
                      >
                        Load Generated Defaults
                      </button>
                    </div>
                  )}
                  {(task.id === 'chord' || task.id === 'progression') && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => appendSavedChords(task.id)}
                        className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
                      >
                        Add Saved Chords
                      </button>
                      <span className="text-[9px] text-gray-500">Imports from Comparison Tray.</span>
                    </div>
                  )}
                  {task.id === 'chord' && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveCustomChordsToCompare}
                          className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
                        >
                          Save Custom to Compare
                        </button>
                        <span className="text-[9px] text-gray-500">Stores custom chords for the Comparison tray.</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Chord Question</Label>
                          <Select
                            value={chordSettings.answerFormat ?? 'quality'}
                            onChange={e => setPro({ chord: { ...chordSettings, answerFormat: e.target.value as any } })}
                          >
                            <option value="quality">Identify Chord Type</option>
                            <option value="ratios">Chord Dictation (Ratios)</option>
                          </Select>
                        </div>
                        <div>
                          <Label>Inversion</Label>
                          <Select
                            value={chordSettings.inversionMode ?? 'root'}
                            onChange={e => setPro({ chord: { ...chordSettings, inversionMode: e.target.value as any } })}
                          >
                            <option value="root">Root Position</option>
                            <option value="free">Free Inversion</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="text-[9px] text-gray-500 mt-1">{task.hint}</div>
                  {task.id === 'melody' && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      {renderScaleConstraint('melody')}
                    </div>
                  )}
                  {task.id === 'duo_melody' && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      {renderScaleConstraint('duo_melody')}
                    </div>
                  )}
                  {task.id === 'interval' && (
                    <div className="mt-2 pt-2 border-t border-gray-700/50">
                      {renderScaleConstraint('interval')}
                    </div>
                  )}
                </SubSection>
              </React.Fragment>
            );
          })}
        </div>
      </Section>

      {settings.tasks?.includes('chord') && (
        <Section title="Chord Library (JI)">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[9px] text-gray-500">
              Select chord qualities to include in the chord question pool.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllChordLibrary}
                className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearChordLibrary}
                className="text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
              >
                Clear Library
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
            {CHORD_LIBRARY_GROUPS.map(group => (
              <div key={group.title} className="bg-black/30 border border-gray-800 rounded p-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map(item => {
                    const line = `${item.label}=${item.ratios}`;
                    const checked = chordItemSet.has(line);
                    return (
                      <div key={item.id} className="w-full flex items-start gap-2">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggleChordLibraryLine(line, !checked)}
                          className="flex-1 flex items-start gap-2 p-1 rounded hover:bg-white/5 transition-colors text-left"
                        >
                          <div className={`w-3 h-3 mt-0.5 rounded border flex items-center justify-center ${checked ? 'bg-blue-600 border-blue-500' : 'bg-gray-900 border-gray-600'}`}>
                            {checked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                          </div>
                          <div className="flex-1">
                            <div className="text-[10px] font-bold text-gray-300">{item.label}</div>
                            <div className="text-[9px] font-mono text-gray-500">{item.ratios}</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            playChordPreview(item.ratios, item.label);
                          }}
                          className="mt-0.5 text-[9px] px-2 py-1 border border-gray-700 rounded bg-gray-800 text-gray-300 hover:text-white"
                        >
                          Play
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-gray-500 mt-2">
            Selected library items populate the chord pool. Use the Chord "Use Custom" toggle to temporarily disable them.
          </div>
        </Section>
      )}
    </div >
  );
}
