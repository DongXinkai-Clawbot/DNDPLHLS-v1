import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TunerProfile, TunerSettings } from '../../../types';
import { DEFAULT_SETTINGS } from '../../../constants';
import { calculateCents, parseGeneralRatio } from '../../../musicLogic';
import { useStore } from '../../../store';
import type { ScalaArchiveScale } from '../../../utils/scalaArchive';
import { Checkbox, Input, Label, Section, Select, SubSection, number } from '../../common/SynthPatchEditor';
import { ScalaArchivePicker } from '../settingsTabsPart2/ScalaArchivePicker';

type Props = {
  tuner?: TunerSettings;
  onChange: (next: TunerSettings) => void;
};

type TunerRow = {
  index: number;
  ratioLabel: string;
  cents: number | null;
  hz: number | null;
};

type PitchResult = {
  freq: number | null;
  rms: number;
};

type TargetMatch = {
  targetHz: number;
  cents: number;
  label: string;
  stepIndex: number;
};

const createProfileId = () => `tuner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const autoCorrelate = (buf: Float32Array, sampleRate: number): PitchResult => {
  const size = buf.length;
  
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return { freq: null, rms };

  const maxSamples = Math.floor(size / 2);
  const correlations: number[] = new Array(maxSamples).fill(0);

  let sumSq1 = 0;
  for (let i = 0; i < maxSamples; i++) {
    sumSq1 += buf[i] * buf[i];
  }
  let sumSq2 = sumSq1;

  for (let offset = 0; offset < maxSamples; offset++) {
    if (offset > 0) {
      const prev = buf[offset - 1];
      const next = buf[offset + maxSamples - 1];
      sumSq2 = sumSq2 - (prev * prev) + (next * next);
    }

    let crossCorr = 0;
    for (let i = 0; i < maxSamples; i++) {
      crossCorr += buf[i] * buf[i + offset];
    }

    const denominator = sumSq1 + sumSq2;
    if (denominator > 0.000001) {
      correlations[offset] = (2 * crossCorr) / denominator;
    } else {
      correlations[offset] = 0;
    }
  }

  let i = 0;
  while (i < maxSamples && correlations[i] > 0) {
    i++;
  }

  if (i >= maxSamples - 1) {
    return { freq: null, rms };
  }

  let globalMax = -1;
  for (let j = i; j < maxSamples; j++) {
    if (correlations[j] > globalMax) {
      globalMax = correlations[j];
    }
  }

  if (globalMax < 0.5) {
    return { freq: null, rms };
  }

  const threshold = 0.85 * globalMax;
  let bestOffset = -1;

  for (let j = i; j < maxSamples - 1; j++) {
    
    if (correlations[j] > correlations[j - 1] && correlations[j] > correlations[j + 1]) {
      if (correlations[j] >= threshold) {
        bestOffset = j;
        break; 
      }
    }
  }

  if (bestOffset === -1) return { freq: null, rms };

  const x1 = correlations[bestOffset - 1];
  const x2 = correlations[bestOffset];
  const x3 = correlations[bestOffset + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a !== 0 ? -b / (2 * a) : 0;
  const freq = sampleRate / (bestOffset + shift);

  if (!Number.isFinite(freq) || freq <= 0) return { freq: null, rms };
  return { freq, rms };
};

const normalizeProfile = (profile: TunerProfile): TunerProfile => {
  const next = { ...profile };
  if (!Number.isFinite(next.baseFrequency) || next.baseFrequency <= 0) {
    next.baseFrequency = 440;
  }
  if (next.mappingMode === 'ratios') {
    const ratios = Array.isArray(next.ratios) ? next.ratios.filter(Boolean) : [];
    next.ratios = ratios;
    next.divisions = ratios.length;
  } else if (next.mappingMode === 'edo') {
    const divs = Math.max(1, Math.floor(next.edoDivisions ?? next.divisions ?? 12));
    next.edoDivisions = divs;
    next.divisions = divs;
  } else {
    const divs = Math.max(1, Math.floor(next.equalStepDivisions ?? next.divisions ?? 12));
    next.equalStepDivisions = divs;
    next.divisions = divs;
    if (!Number.isFinite(next.equalStepBase) || (next.equalStepBase ?? 0) <= 0) {
      next.equalStepBase = 2;
    }
  }
  return next;
};

const buildRatioList = (profile: TunerProfile) => {
  if (profile.mappingMode === 'ratios') {
    return (profile.ratios ?? [])
      .map((ratioStr, index) => {
        
        const parts = ratioStr.split(':');
        const label = parts.length > 1 ? parts[0].trim() : ratioStr.trim();
        const valueStr = parts.length > 1 ? parts[1].trim() : parts[0].trim();

        const frac = parseGeneralRatio(valueStr);
        const ratioValue = Number(frac.n) / Number(frac.d);
        if (!Number.isFinite(ratioValue) || ratioValue <= 0) return null;

        return { ratio: ratioValue, label: label, stepIndex: index };
      })
      .filter(Boolean) as { ratio: number; label: string; stepIndex: number }[];
  }

  const divs = Math.max(1, Math.floor(profile.divisions || 12));
  const base = profile.mappingMode === 'equal-step' ? (profile.equalStepBase ?? 2) : 2;
  const items: { ratio: number; label: string; stepIndex: number }[] = [];
  for (let i = 0; i < divs; i++) {
    const ratio = Math.pow(base, i / divs);
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const label = profile.mappingMode === 'equal-step'
      ? `${base}^(${i}/${divs})`
      : `step ${i}`;
    items.push({ ratio, label, stepIndex: i });
  }
  return items;
};

const findNearestTarget = (profile: TunerProfile, freq: number): TargetMatch | null => {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const ratios = buildRatioList(profile);
  if (ratios.length === 0) return null;

  let best: TargetMatch | null = null;
  for (const item of ratios) {
    const baseTarget = profile.baseFrequency * item.ratio;
    if (!Number.isFinite(baseTarget) || baseTarget <= 0) continue;
    const octaveShift = Math.round(Math.log2(freq / baseTarget));
    const targetHz = baseTarget * Math.pow(2, octaveShift);
    if (!Number.isFinite(targetHz) || targetHz <= 0) continue;
    const cents = 1200 * Math.log2(freq / targetHz);
    const absCents = Math.abs(cents);
    if (!best || absCents < Math.abs(best.cents)) {
      
      const octLabel = (4 + octaveShift).toString();
      const finalLabel = item.label.match(/\d$/) ? item.label : `${item.label}${octLabel}`;

      best = { targetHz, cents, label: finalLabel, stepIndex: item.stepIndex };
    }
  }
  return best;
};

const TunerGauge = ({ cents, noteName, detectedHz, targetHz }: { cents: number, noteName: string, detectedHz: number | null, targetHz: number | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const w = cvs.width;
    const h = cvs.height;
    const cx = w / 2;
    const cy = h - 20;
    const radius = Math.min(w, h * 2) * 0.8;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#333';
    ctx.stroke();

    const range = 50; 
    for (let i = -range; i <= range; i += 5) {
      const angle = Math.PI + (Math.PI * (i + range) / (range * 2));
      const isMajor = i % 10 === 0;
      const len = isMajor ? 15 : 8;

      const x1 = cx + Math.cos(angle) * (radius - len);
      const y1 = cy + Math.sin(angle) * (radius - len);
      const x2 = cx + Math.cos(angle) * radius;
      const y2 = cy + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.strokeStyle = i === 0 ? '#4ade80' : '#666'; 
      ctx.stroke();
    }

    const clampedCents = Math.max(-range, Math.min(range, cents));
    const needleAngle = Math.PI + (Math.PI * (clampedCents + range) / (range * 2));
    const needleLen = radius - 20;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
    ctx.lineWidth = 4;
    ctx.strokeStyle = Math.abs(cents) < 3 ? '#4ade80' : '#f87171'; 
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

  }, [cents]);

  return (
    <div className="relative flex flex-col items-center bg-gray-900 rounded-xl p-4 border border-gray-700 shadow-lg">
      <div className="absolute top-12 left-0 right-0 text-center pointer-events-none">
        <div className="text-6xl font-bold text-white tracking-tighter drop-shadow-md">
          {noteName}
        </div>
        <div className={`text-sm font-bold mt-1 ${Math.abs(cents) < 3 ? 'text-green-400' : Math.abs(cents) < 10 ? 'text-yellow-400' : 'text-red-400'}`}>
          {Math.abs(cents) < 50 ? (cents > 0 ? `+${cents.toFixed(1)}` : cents.toFixed(1)) : (cents > 0 ? '> +50' : '< -50')} ¢
        </div>
      </div>

      <canvas ref={canvasRef} width={300} height={180} className="w-full max-w-[300px]" />

      <div className="flex justify-between w-full max-w-[240px] mt-2 px-2 bg-black/40 rounded py-1">
        <div className="text-xs text-gray-400">
          TARGET <span className="text-blue-300 font-mono block text-sm">{targetHz ? targetHz.toFixed(1) : '--'} Hz</span>
        </div>
        <div className="text-xs text-gray-400 text-right">
          DETECTED <span className="text-white font-mono block text-sm">{detectedHz ? detectedHz.toFixed(1) : '--'} Hz</span>
        </div>
      </div>
    </div>
  );
};

const buildRows = (profile: TunerProfile): TunerRow[] => {
  if (profile.mappingMode === 'ratios') {
    return (profile.ratios ?? []).map((ratioStr, index) => {
      const frac = parseGeneralRatio(ratioStr);
      const ratioValue = Number(frac.n) / Number(frac.d);
      if (!Number.isFinite(ratioValue) || ratioValue <= 0) {
        return { index, ratioLabel: ratioStr, cents: null, hz: null };
      }
      return {
        index,
        ratioLabel: ratioStr,
        cents: calculateCents(frac),
        hz: profile.baseFrequency * ratioValue
      };
    });
  }

  const divs = Math.max(1, Math.floor(profile.divisions || 12));
  const base = profile.mappingMode === 'equal-step' ? (profile.equalStepBase ?? 2) : 2;

  const rows: TunerRow[] = [];
  for (let i = 0; i < divs; i++) {
    const ratioValue = Math.pow(base, i / divs);
    rows.push({
      index: i,
      ratioLabel: `${base}^(${i}/${divs})`,
      cents: ratioValue > 0 ? (1200 * Math.log2(ratioValue)) : null,
      hz: ratioValue > 0 ? profile.baseFrequency * ratioValue : null
    });
  }
  return rows;
};

const formatValue = (value: number | null, digits: number) => {
  if (value === null || !Number.isFinite(value)) return '--';
  return value.toFixed(digits);
};

export const TunerPanel = ({ tuner, onChange }: Props) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFreqRef = useRef<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [detectedHz, setDetectedHz] = useState<number | null>(null);
  const [signalRms, setSignalRms] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const savedMidiScales = useStore(s => s.savedMidiScales);
  const [selectedSavedScaleId, setSelectedSavedScaleId] = useState('');
  const [showScalaArchive, setShowScalaArchive] = useState(false);
  const [selectedScalaId, setSelectedScalaId] = useState<string | null>(null);

  const fallback = DEFAULT_SETTINGS.tuner ?? {
    enabled: false,
    activeProfileId: '',
    profiles: [],
    showRatio: true,
    showCents: true,
    showHz: true
  };
  const tunerState = tuner ?? fallback;
  const activeProfile = tunerState.profiles.find(p => p.id === tunerState.activeProfileId) ?? tunerState.profiles[0];
  const safeProfile = activeProfile ? normalizeProfile(activeProfile) : null;
  const selectedSavedScale = savedMidiScales.find(s => s.id === selectedSavedScaleId) ?? null;

  useEffect(() => {
    if (!selectedSavedScaleId) return;
    if (!savedMidiScales.some(scale => scale.id === selectedSavedScaleId)) {
      setSelectedSavedScaleId('');
    }
  }, [savedMidiScales, selectedSavedScaleId]);

  const updateTuner = (partial: Partial<TunerSettings>) => {
    onChange({ ...tunerState, ...partial });
  };

  const updateProfile = (id: string, partial: Partial<TunerProfile>) => {
    const nextProfiles = tunerState.profiles.map(p => (p.id === id ? normalizeProfile({ ...p, ...partial }) : p));
    updateTuner({ profiles: nextProfiles });
  };

  const applyRatiosToProfile = (ratios: string[]) => {
    if (!safeProfile) return;
    const items = Array.isArray(ratios) ? ratios.filter(Boolean) : [];
    updateProfile(safeProfile.id, { mappingMode: 'ratios', ratios: items, divisions: items.length });
  };

  const handleLoadSavedScale = () => {
    if (!safeProfile || !selectedSavedScale) return;
    applyRatiosToProfile(selectedSavedScale.scale);
  };

  const handleScalaSelect = (id: string | null, scale: ScalaArchiveScale | null) => {
    setSelectedScalaId(id);
    if (!scale) return;
    applyRatiosToProfile(scale.ratios);
  };

  const handleAddProfile = () => {
    const baseProfile = fallback.profiles[0] ?? {
      id: '',
      name: 'Default',
      baseFrequency: 440,
      mappingMode: 'ratios' as const,
      divisions: 0,
      ratios: []
    };
    const nextProfile = normalizeProfile({
      ...baseProfile,
      id: createProfileId(),
      name: 'New Profile'
    });
    updateTuner({
      profiles: [...tunerState.profiles, nextProfile],
      activeProfileId: nextProfile.id
    });
  };

  const handleDuplicateProfile = () => {
    if (!safeProfile) return;
    const nextProfile = normalizeProfile({
      ...safeProfile,
      id: createProfileId(),
      name: `${safeProfile.name} Copy`,
      ratios: [...(safeProfile.ratios ?? [])]
    });
    updateTuner({
      profiles: [...tunerState.profiles, nextProfile],
      activeProfileId: nextProfile.id
    });
  };

  const handleDeleteProfile = () => {
    if (!safeProfile || tunerState.profiles.length <= 1) return;
    const nextProfiles = tunerState.profiles.filter(p => p.id !== safeProfile.id);
    const nextActive = tunerState.activeProfileId === safeProfile.id ? (nextProfiles[0]?.id || '') : tunerState.activeProfileId;
    updateTuner({ profiles: nextProfiles, activeProfileId: nextActive });
  };

  const rows = useMemo(() => (safeProfile ? buildRows(safeProfile) : []), [safeProfile]);
  const targetMatch = useMemo(() => {
    if (!safeProfile || !detectedHz) return null;
    return findNearestTarget(safeProfile, detectedHz);
  }, [safeProfile, detectedHz]);
  const pitchStatus = useMemo(() => {
    if (!targetMatch || detectedHz === null) return 'No signal';
    const cents = targetMatch.cents;
    if (Math.abs(cents) <= 2) return 'In tune';
    return cents < 0 ? 'Flat' : 'Sharp';
  }, [targetMatch, detectedHz]);

  const showRatio = tunerState.showRatio ?? true;
  const showCents = tunerState.showCents ?? true;
  const showHz = tunerState.showHz ?? true;
  const visibleCount = [showRatio, showCents, showHz].filter(Boolean).length;
  const fallbackRatio = visibleCount === 0;
  const gridTemplateColumns = `70px repeat(${fallbackRatio ? 1 : visibleCount}, minmax(0, 1fr))`;

  const stopListening = () => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    setIsListening(false);
    setDetectedHz(null);
    setSignalRms(0);
  };

  const startListening = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not available in this browser.');
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        setError('AudioContext not supported.');
        return;
      }
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);
      lastFreqRef.current = null;

      const buffer = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current || !audioContextRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);
        const result = autoCorrelate(buffer, audioContextRef.current.sampleRate);
        setSignalRms(result.rms);
        if (result.freq) {
          const prev = lastFreqRef.current;
          const nextFreq = prev ? (prev * 0.7 + result.freq * 0.3) : result.freq;
          lastFreqRef.current = nextFreq;
          setDetectedHz(nextFreq);
        } else {
          setDetectedHz(null);
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      tick();
    } catch (err: any) {
      stopListening();
      setError(err?.message || 'Microphone permission denied.');
    }
  };

  useEffect(() => {
    if (!tunerState.enabled && isListening) {
      stopListening();
    }
  }, [tunerState.enabled, isListening]);

  useEffect(() => {
    return () => stopListening();
  }, []);

  return (
    <Section title="Tuner (Microtonal)">
      <div className="flex justify-between items-center mb-2">
        <Checkbox label="Enabled" checked={tunerState.enabled ?? false} onChange={e => {
          updateTuner({ enabled: e });
          
          if (e && collapsed) setCollapsed(false);
        }} />
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-300 hover:text-white"
          >
            Collapse
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          <SubSection
            title="Profiles"
            right={
              <div className="flex gap-2">
                <button onClick={handleAddProfile} className="text-[9px] px-2 py-0.5 border border-gray-600 rounded bg-gray-800 text-gray-300 hover:text-white">+ New</button>
                <button onClick={handleDuplicateProfile} className="text-[9px] px-2 py-0.5 border border-gray-600 rounded bg-gray-800 text-gray-300 hover:text-white">Copy</button>
                <button onClick={handleDeleteProfile} className="text-[9px] px-2 py-0.5 border border-gray-600 rounded bg-gray-800 text-gray-300 hover:text-white" disabled={tunerState.profiles.length <= 1}>Del</button>
              </div>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Active Profile</Label>
                <Select
                  value={safeProfile?.id ?? ''}
                  onChange={e => updateTuner({ activeProfileId: e.target.value })}
                >
                  {tunerState.profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Profile Name</Label>
                <Input
                  value={safeProfile?.name ?? ''}
                  onChange={e => safeProfile && updateProfile(safeProfile.id, { name: e.target.value })}
                />
              </div>
            </div>
          </SubSection>

          {safeProfile && (
            <>
              <SubSection title="Live Tuning">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isListening) stopListening();
                      else startListening();
                    }}
                    disabled={!tunerState.enabled}
                    className="text-[9px] px-3 py-1 rounded border border-gray-700 bg-gray-800 text-gray-200 font-bold disabled:opacity-40"
                  >
                    {isListening ? 'Stop' : 'Start'}
                  </button>
                  <div className="text-[9px] text-gray-500">
                    {tunerState.enabled ? 'Mic required' : 'Enable tuner to start'}
                  </div>
                </div>
                <div className="flex flex-col gap-4 mt-3">
                  <TunerGauge
                    cents={targetMatch ? targetMatch.cents : 0}
                    noteName={targetMatch ? targetMatch.label : '--'}
                    detectedHz={detectedHz}
                    targetHz={targetMatch ? targetMatch.targetHz : null}
                  />

                  {safeProfile.mappingMode === 'ratios' && (safeProfile.ratios?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {safeProfile.ratios?.map((r, i) => {
                        const parts = r.split(':');
                        const label = parts[0].trim();
                        const isActive = targetMatch?.label.startsWith(label); 
                        return (
                          <div
                            key={i}
                            className={`
                                    w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold border
                                    ${isActive
                                ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-110'
                                : 'bg-gray-800 border-gray-600 text-gray-400 opacity-60'}
                                    transition-all duration-200
                                `}
                          >
                            {label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error && <div className="text-[9px] text-red-400 mt-2">{error}</div>}

                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-300">
                  <span>Status: {pitchStatus}</span>
                </div>
              </SubSection>

              <SubSection title="Profile Settings">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Base Frequency</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={safeProfile.baseFrequency}
                      onChange={e => updateProfile(safeProfile.id, { baseFrequency: Math.max(1, number(e.target.value, 440)) })}
                    />
                  </div>
                  <div>
                    <Label>Mapping Mode</Label>
                    <Select
                      value={safeProfile.mappingMode}
                      onChange={e => updateProfile(safeProfile.id, { mappingMode: e.target.value as any })}
                    >
                      <option value="ratios">Ratios</option>
                      <option value="edo">EDO</option>
                      <option value="equal-step">Equal Step</option>
                    </Select>
                  </div>
                  <div>
                    <Label>Steps</Label>
                    <Input value={safeProfile.divisions} readOnly />
                  </div>
                </div>
              </SubSection>

              <SubSection title="Mapping Data">
                {safeProfile.mappingMode === 'ratios' && (
                  <>
                    <textarea
                      value={(safeProfile.ratios ?? []).join('\n')}
                      onChange={e => {
                        const items = e.target.value
                          .split(/\r?\n/)
                          .flatMap(line => line.split(','))
                          .map(s => s.trim())
                          .filter(Boolean);
                        updateProfile(safeProfile.id, { ratios: items, divisions: items.length });
                      }}
                      placeholder="One ratio per line (or comma-separated)."
                      className="w-full min-h-[90px] bg-black/50 border border-gray-700 rounded px-2 py-1 text-[10px] text-blue-100 focus:border-blue-500 outline-none font-mono"
                    />
                    <div className="text-[9px] text-gray-500 mt-1">
                      Format: "Label: Ratio" (e.g. "C: 1/1", "G: 3/2").
                      <br />Or "Label: Freq" (e.g. "A4: 440", "G3: 196").
                    </div>
                  </>
                )}
                {safeProfile.mappingMode !== 'ratios' && (
                  <div className="text-[9px] text-gray-500 mb-2">
                    Importing a scale switches mapping mode to Ratios.
                  </div>
                )}
                <div className="mt-2 bg-black/30 border border-gray-700 rounded p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500 uppercase font-bold">Library Import</span>
                    <span className="text-[9px] text-gray-600">{savedMidiScales.length} saved</span>
                  </div>
                  <div className="text-[9px] text-gray-500">
                    Use saved scales from the Library or the Scala archive.
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={selectedSavedScaleId}
                        onChange={e => setSelectedSavedScaleId(e.target.value)}
                        disabled={savedMidiScales.length === 0}
                      >
                        <option value="">Select saved scale</option>
                        {savedMidiScales.map(scale => (
                          <option key={scale.id} value={scale.id}>
                            {scale.name} ({scale.scale.length})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <button
                      onClick={handleLoadSavedScale}
                      disabled={!safeProfile || !selectedSavedScale}
                      className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-800 text-gray-200 font-bold disabled:opacity-40"
                    >
                      Load
                    </button>
                  </div>
                  <button
                    onClick={() => setShowScalaArchive(v => !v)}
                    className="text-[9px] px-2 py-1 rounded border border-gray-700 bg-gray-900 text-gray-300 font-bold"
                  >
                    {showScalaArchive ? 'Hide Scala Archive' : 'Scala Archive'}
                  </button>
                  {showScalaArchive && (
                    <ScalaArchivePicker selectedId={selectedScalaId} onSelect={handleScalaSelect} />
                  )}
                </div>
                {safeProfile.mappingMode === 'edo' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>EDO Divisions</Label>
                      <Input
                        type="number"
                        value={safeProfile.edoDivisions ?? safeProfile.divisions}
                        onChange={e => {
                          const divs = Math.max(1, Math.floor(number(e.target.value, 12)));
                          updateProfile(safeProfile.id, { edoDivisions: divs, divisions: divs });
                        }}
                      />
                    </div>
                  </div>
                )}
                {safeProfile.mappingMode === 'equal-step' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Base</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={safeProfile.equalStepBase ?? 2}
                        onChange={e => updateProfile(safeProfile.id, { equalStepBase: Math.max(0.01, number(e.target.value, 2)) })}
                      />
                    </div>
                    <div>
                      <Label>Divisions</Label>
                      <Input
                        type="number"
                        value={safeProfile.equalStepDivisions ?? safeProfile.divisions}
                        onChange={e => {
                          const divs = Math.max(1, Math.floor(number(e.target.value, 12)));
                          updateProfile(safeProfile.id, { equalStepDivisions: divs, divisions: divs });
                        }}
                      />
                    </div>
                  </div>
                )}
              </SubSection>

              <SubSection title="Display">
                <div className="flex flex-wrap gap-3">
                  <Checkbox label="Show Ratio" checked={showRatio} onChange={e => updateTuner({ showRatio: e })} />
                  <Checkbox label="Show Cents" checked={showCents} onChange={e => updateTuner({ showCents: e })} />
                  <Checkbox label="Show Hz" checked={showHz} onChange={e => updateTuner({ showHz: e })} />
                </div>
              </SubSection>

              <SubSection title="Mapping Preview">
                <div className="text-[9px] text-gray-500 mb-2">Base: {safeProfile.baseFrequency} Hz</div>
                <div className="grid gap-1 text-[9px] font-mono" style={{ gridTemplateColumns }}>
                  <div className="text-gray-500 uppercase">Step</div>
                  {(showRatio || fallbackRatio) && <div className="text-gray-500 uppercase">Ratio</div>}
                  {showCents && <div className="text-gray-500 uppercase">Cents</div>}
                  {showHz && <div className="text-gray-500 uppercase">Hz</div>}
                </div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar mt-1">
                  {rows.map(row => (
                    <div key={row.index} className="grid gap-1 text-[10px] text-gray-300 border-b border-gray-800 py-1" style={{ gridTemplateColumns }}>
                      <div className="text-gray-500">{row.index}</div>
                      {(showRatio || fallbackRatio) && <div className="truncate">{row.ratioLabel}</div>}
                      {showCents && <div>{formatValue(row.cents, 2)}</div>}
                      {showHz && <div>{formatValue(row.hz, 2)}</div>}
                    </div>
                  ))}
                </div>
              </SubSection>
            </>
          )}
        </>
      )}
    </Section>
  );
};
