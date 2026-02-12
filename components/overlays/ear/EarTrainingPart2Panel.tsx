import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getAudioContext, unlockAudioContext } from '../../../audioEngine';
import { useStore } from '../../../store';
import type { WaveformShape, EarTrainingPart2PersistedV1 } from '../../../types';
import { getJndUploadAvailability } from '../../../utils/backend';
import { buildDiagnosticsPackage } from '../../../utils/diagnostics';
import { downloadJson } from '../../../utils/download';
import { STORAGE_KEYS } from '../../../store/logic/storageKeys';

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function safeHz(hz: number) { return clamp(hz, 20, 20000); }
function centsToRatio(c: number) { return Math.pow(2, c / 1200); }
function mean(xs: number[]) { if (!xs.length) return 0; return xs.reduce((a, b) => a + b, 0) / xs.length; }
function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const ys = [...xs].sort((a, b) => a - b);
  const idx = Math.min(ys.length - 1, Math.max(0, Math.floor((p / 100) * (ys.length - 1))));
  return ys[idx];
}

const CALIBRATION_TIMBRES: WaveformShape[] = [
  'sine', 'triangle', 'sawtooth', 'square', 'organ', 'epiano', 'flute', 'custom-synth'
];

const Card = ({ title, icon, children, right }: { title: string, icon?: string, children?: React.ReactNode, right?: React.ReactNode }) => (
  <div className="bg-gray-900/60 border border-gray-700/50 p-4 rounded-xl space-y-4 shadow-sm backdrop-blur-sm">
    <div className="flex justify-between items-center border-b border-gray-800/50 pb-2">
      <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"></span>
        {icon && <span className="text-lg leading-none grayscale opacity-70">{icon}</span>}
        {title}
      </h4>
      {right}
    </div>
    {children}
  </div>
);

const Label = ({ children }: { children?: React.ReactNode }) => (
  <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1.5 tracking-wide">{children}</label>
);

const Input = (props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'>) => (
  <input
    className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-blue-200 focus:border-blue-500 outline-none transition-colors placeholder-gray-700"
    {...props}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }) => (
  <select
    className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1.5 text-xs font-mono text-blue-200 focus:border-blue-500 outline-none transition-colors cursor-pointer"
    {...props}
  />
);

const Button = ({ onClick, disabled = false, variant = 'primary', children, className = "" }: { onClick: () => void, disabled?: boolean, variant?: 'primary' | 'danger' | 'neutral' | 'success' | 'warning' | 'ghost', children?: React.ReactNode, className?: string }) => {
  const base = "px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm border";
  const variants = {
    primary: "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500",
    neutral: "bg-gray-900 border-gray-700 text-gray-500 hover:text-gray-300",
    danger: "bg-red-900/30 border-red-800/50 text-red-300 hover:bg-red-900/50 hover:border-red-500 hover:text-white",
    success: "bg-emerald-900/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-500 hover:text-white",
    warning: "bg-amber-900/30 border-amber-800/50 text-amber-300 hover:bg-amber-900/50 hover:border-amber-500 hover:text-white",
    ghost: "bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5",
  };
  const disabledClass = disabled ? "opacity-60 cursor-not-allowed active:scale-100 hover:bg-inherit hover:text-inherit hover:border-inherit" : "";

  const variantClass = variants[variant] || variants.primary;

  return <button disabled={disabled} onClick={disabled ? undefined : onClick} className={`${base} ${variantClass} ${disabledClass} ${className}`}>{children}</button>;
};

const StatBox = ({ label, value, color = "text-white", tooltip }: { label: string, value: string | number, color?: string, tooltip?: string }) => (
  <div className="bg-black/30 rounded border border-gray-800 p-2 flex flex-col items-center flex-1" title={tooltip}>
    <span className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">{label}</span>
    <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
  </div>
);

function playTone(hz: number, waveform: WaveformShape, ms: number, gainVal: number) {
  const ctx = getAudioContext();
  unlockAudioContext();
  const g = ctx.createGain();
  g.gain.value = gainVal;

  const wave = waveform || 'sine';
  const type = (wave === 'custom-synth' ? 'sawtooth' : wave) as OscillatorType;
  const isStandard = ['sine', 'square', 'sawtooth', 'triangle'].includes(type);

  if (isStandard) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = safeHz(hz);
    o.connect(g);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + ms / 1000 + 0.05);
  } else {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = safeHz(hz);
    o.connect(g);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + ms / 1000 + 0.05);
  }

  g.connect(ctx.destination);

  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainVal), now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
}

type Props = {
  part2: EarTrainingPart2PersistedV1;
  onUpdate: (next: EarTrainingPart2PersistedV1) => void;
};

export default function EarTrainingPart2Panel({ part2, onUpdate }: Props) {
  const s = part2.settings;
  const { updateSettings, regenerateLattice } = useStore(st => ({
    updateSettings: st.updateSettings,
    regenerateLattice: st.regenerateLattice
  }));
  const shareEnabled = s.shareAnonymizedJnd !== false;
  const setShareEnabled = (enabled: boolean) => {
    const next = JSON.parse(JSON.stringify(part2)) as EarTrainingPart2PersistedV1;
    next.settings.shareAnonymizedJnd = enabled;
    onUpdate(next);
  };

  const jndSettings = s.jnd || {
    baseHz: s.intervalZone?.baseHz ?? 440,
    mode: 'interval' as const,
    startGapCents: Math.max(5, s.intervalZone?.rangeCents ?? 100),
    minGapCents: 0.1,
    maxGapCents: 300,
    stepDown: 0.85,
    stepUp: 1.15,
    confirmRepeats: 2,
    optionsCount: 3,
    waveform: s.intervalZone?.waveform ?? 'sine',
    toneMs: 260,
    gapMs: 60,
    randomBase: false,
    baseHzMin: 220,
    baseHzMax: 880,
    randomGap: false
  };

  const [jndGap, setJndGap] = useState<number>(() => jndSettings.startGapCents);
  const [jndDirection, setJndDirection] = useState<'higher' | 'lower'>(() => (Math.random() > 0.5 ? 'higher' : 'lower'));
  const [trialIndex, setTrialIndex] = useState(0);
  const [trialBaseHz, setTrialBaseHz] = useState<number>(() => safeHz(jndSettings.baseHz));
  const [trialMode, setTrialMode] = useState<'interval' | 'double'>(() => (Math.random() > 0.5 ? 'interval' : 'double'));
  const [trialStartedAt, setTrialStartedAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number>(8000);
  const timeoutRef = useRef<number | null>(null);
  const tickerRef = useRef<number | null>(null);

  const roundTenth = (v: number) => Math.round(v * 10) / 10;

  useEffect(() => {
    setJndGap(jndSettings.startGapCents);
  }, [jndSettings.startGapCents]);

  useEffect(() => {
    if (!jndSettings.randomBase) {
      setTrialBaseHz(safeHz(jndSettings.baseHz));
      return;
    }
    const lo = safeHz(Number.isFinite(jndSettings.baseHzMin) ? (jndSettings.baseHzMin as number) : 220);
    const hi = safeHz(Number.isFinite(jndSettings.baseHzMax) ? (jndSettings.baseHzMax as number) : 880);
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    setTrialBaseHz((cur) => (cur >= a && cur <= b ? cur : safeHz(a + Math.random() * (b - a))));
  }, [jndSettings.randomBase, jndSettings.baseHz, jndSettings.baseHzMin, jndSettings.baseHzMax]);

  const shuffle = (arr: string[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const jndModeRaw = (jndSettings.mode || 'interval') as 'interval' | 'double' | 'random';
  const jndMode = jndModeRaw === 'random' ? trialMode : jndModeRaw;
  const baseHz = jndSettings.randomBase ? trialBaseHz : safeHz(jndSettings.baseHz);
  const minGapCents = Math.max(0.1, Number.isFinite(jndSettings.minGapCents) ? (jndSettings.minGapCents as number) : 0.1);
  const gapCents = Number.isFinite(jndGap) ? Math.max(minGapCents, jndGap) : minGapCents;
  const gapRatio = centsToRatio(gapCents);
  let secondHz = safeHz(jndDirection === 'higher' ? baseHz * gapRatio : baseHz / gapRatio);
  if (!Number.isFinite(secondHz) || Math.abs(secondHz - baseHz) < 1e-6) {
    const fallbackRatio = centsToRatio(Math.max(minGapCents, 1));
    secondHz = safeHz(jndDirection === 'higher' ? baseHz * fallbackRatio : baseHz / fallbackRatio);
  }
  const correctId = jndDirection === 'higher' ? 'offset' : 'base';
  const optionCount = clamp(jndSettings.optionsCount ?? 3, 3, 5);

  const optionLabels = useMemo(() => {
    const baseLabel = jndMode === 'double' ? 'Tone A' : 'First';
    const offsetLabel = jndMode === 'double' ? 'Tone B' : 'Second';
    const decoys = ['Same', 'Unclear', 'Not sure', 'Either'];
    const options = ['base', 'offset'];
    while (options.length < optionCount) {
      const candidate = decoys[options.length - 2] ?? 'Unclear';
      options.push(candidate);
    }
    return shuffle(options).map((id) => {
      if (id === 'base') return { id, label: baseLabel };
      if (id === 'offset') return { id, label: offsetLabel };
      return { id, label: id };
    });
  }, [trialIndex, jndMode, optionCount]);

  const toneMs = clamp(Number.isFinite(jndSettings.toneMs) ? (jndSettings.toneMs as number) : 260, 40, 4000);
  const gapMs = clamp(Number.isFinite(jndSettings.gapMs) ? (jndSettings.gapMs as number) : 60, 0, 4000);
  const maxAnswerMs = 8000;

  const clearTrialTimers = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  const startTrialTimer = () => {
    clearTrialTimers();
    const startedAt = Date.now();
    const deadline = startedAt + maxAnswerMs;
    setTrialStartedAt(startedAt);
    setTimeLeftMs(maxAnswerMs);
    tickerRef.current = window.setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setTimeLeftMs(left);
      if (left <= 0) {
        clearTrialTimers();
      }
    }, 50);
    timeoutRef.current = window.setTimeout(() => {
      clearTrialTimers();

      logJndSample(false, maxAnswerMs + 1, false);
      advanceJnd(false);
    }, maxAnswerMs + 5);
  };

  const playJndPair = () => {
    const wave = jndSettings.waveform || 'sine';
    startTrialTimer();
    if (jndMode === 'double') {
      playTone(baseHz, wave, toneMs, 0.12);
      playTone(secondHz, wave, toneMs, 0.12);
      return;
    }
    playTone(baseHz, wave, toneMs, 0.12);
    setTimeout(() => playTone(secondHz, wave, toneMs, 0.12), toneMs + gapMs);
  };

  const logJndSample = (isCorrect: boolean, responseMs?: number, counted?: boolean) => {
    const samples = part2.jndSamples ?? [];
    const next = { ...part2 };
    next.jndSamples = [...samples, {
      gapCents: jndGap,
      correct: isCorrect,
      direction: jndDirection,
      mode: jndMode,
      optionsCount: optionCount,
      t: Date.now(),
      baseHz,
      waveform: jndSettings.waveform,
      responseMs,
      counted
    }];
    onUpdate(next);
  };

  const advanceJnd = (isCorrect: boolean) => {
    setTrialStartedAt(null);
    setTimeLeftMs(maxAnswerMs);
    const minGap = Math.max(0.1, Number.isFinite(jndSettings.minGapCents) ? jndSettings.minGapCents : 0.1);
    const maxGap = Math.max(minGap, Number.isFinite(jndSettings.maxGapCents) ? jndSettings.maxGapCents : 300);
    const stepDown = clamp(Number.isFinite(jndSettings.stepDown) ? jndSettings.stepDown : 0.85, 0.5, 0.99);
    const stepUp = clamp(Number.isFinite(jndSettings.stepUp) ? jndSettings.stepUp : 1.15, 1.01, 2.0);
    const nextGap = jndSettings.randomGap
      ? minGap + Math.random() * (maxGap - minGap)
      : isCorrect
        ? Math.max(minGap, jndGap * stepDown)
        : Math.min(maxGap, jndGap * stepUp);

    setJndGap(roundTenth(nextGap));
    setJndDirection(Math.random() > 0.5 ? 'higher' : 'lower');
    if (jndSettings.randomBase) {
      const lo = safeHz(Number.isFinite(jndSettings.baseHzMin) ? (jndSettings.baseHzMin as number) : 220);
      const hi = safeHz(Number.isFinite(jndSettings.baseHzMax) ? (jndSettings.baseHzMax as number) : 880);
      const a = Math.min(lo, hi);
      const b = Math.max(lo, hi);
      setTrialBaseHz(safeHz(a + Math.random() * (b - a)));
    }
    if (jndModeRaw === 'random') {
      setTrialMode(Math.random() > 0.5 ? 'interval' : 'double');
    }
    setTrialIndex((v) => v + 1);
  };

  const submitJndAnswer = (id: string) => {
    if (trialStartedAt === null) return;
    clearTrialTimers();
    const responseMs = Date.now() - trialStartedAt;
    const correct = id === correctId;
    const counted = correct && responseMs <= maxAnswerMs;
    logJndSample(correct, responseMs, counted);

    const effectiveCorrect = correct && responseMs <= maxAnswerMs;
    advanceJnd(effectiveCorrect);
  };

  const jndEval = useMemo(() => {
    const samples = part2.jndSamples ?? [];
    const counted = samples.filter(s => s.counted && typeof s.responseMs === 'number');
    if (counted.length < 5) return null;

    const avgMs = mean(counted.map(s => s.responseMs as number));
    const avgOk = avgMs <= 6000;

    const last3 = samples.slice(-3).filter(s => typeof s.responseMs === 'number');
    const last3Counted = last3.filter(s => s.counted);
    const last3CorrectCounted = last3Counted.filter(s => s.correct);

    const avgCorrectInLastN = (n: number) => {
      const recent = samples.slice(-n).filter(s => s.counted && s.correct);
      if (recent.length === 0) return null;
      return mean(recent.map(s => s.gapCents));
    };

    if (last3Counted.length === 3 && last3CorrectCounted.length === 2) {
      const estimateCents = avgCorrectInLastN(5);
      if (estimateCents !== null) return { estimateCents, trials: counted.length, avgMs, avgOk, method: 'last3=2c1w -> avg(correct last5)' as const };
    }

    const minGap = Math.min(...counted.map(s => s.gapCents));
    const band = 0.5;
    let run: number[] = [];
    let best: number[] | null = null;
    for (const s0 of samples) {
      const ok = s0.counted && s0.correct && Math.abs(s0.gapCents - minGap) <= band;
      if (ok) {
        run.push(s0.gapCents);
        if (run.length >= 3) best = [...run];
      } else {
        run = [];
      }
    }
    if (best && best.length >= 3) {
      const last3Gaps = best.slice(-3);
      return { estimateCents: mean(last3Gaps), trials: counted.length, avgMs, avgOk, method: 'minGapBand run>=3 -> avg(last3)' as const };
    }

    const lastCorrect = samples.filter(s => s.counted && s.correct).slice(-3);
    if (lastCorrect.length === 3) {
      return { estimateCents: mean(lastCorrect.map(s => s.gapCents)), trials: counted.length, avgMs, avgOk, method: 'fallback avg(last3 correct)' as const };
    }
    return null;
  }, [part2.jndSamples]);

  const jndSuggestions = useMemo(() => {
    if (!jndEval?.estimateCents) return null;
    const est = clamp(jndEval.estimateCents, 0.1, 1200);
    return {
      simplifyTolerance: Math.round(est * 10) / 10,
      loopTolerance: Math.round(est * 1.5 * 10) / 10
    };
  }, [jndEval]);

  const ensureAnonUserId = () => {
    try {
      const key = STORAGE_KEYS.anonUserId;
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(key, id);
      return id;
    } catch {
      return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  };

  const [uploadAvailability, setUploadAvailability] = useState(() => getJndUploadAvailability());
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'ok' | 'error'>('idle');
  const [uploadMsg, setUploadMsg] = useState<string>('');
  const UPLOAD_COOLDOWN_MS = 30 * 60 * 1000;

  useEffect(() => {
    const refresh = () => setUploadAvailability(getJndUploadAvailability());
    refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);

  const getLastUploadAtMs = () => {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.jndUploadLastAtMs);
      const ms = Number(v);
      return Number.isFinite(ms) && ms > 0 ? ms : 0;
    } catch {
      return 0;
    }
  };

  const [cooldownLeftMs, setCooldownLeftMs] = useState<number>(() => {
    const last = getLastUploadAtMs();
    if (!last) return 0;
    return Math.max(0, last + UPLOAD_COOLDOWN_MS - Date.now());
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const last = getLastUploadAtMs();
      if (!last) {
        setCooldownLeftMs(0);
        return;
      }
      setCooldownLeftMs(Math.max(0, last + UPLOAD_COOLDOWN_MS - Date.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const formatCooldown = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const uploadJndEstimate = async () => {
    if (!shareEnabled) {
      setUploadState('error');
      setUploadMsg('Sharing disabled.');
      return;
    }
    const availability = getJndUploadAvailability();
    setUploadAvailability(availability);
    if (!availability.canUpload) {
      setUploadState('error');
      setUploadMsg(availability.reason || 'Uploads unavailable.');
      return;
    }
    if (cooldownLeftMs > 0) {
      setUploadState('error');
      setUploadMsg(`Upload cooldown: wait ${formatCooldown(cooldownLeftMs)}.`);
      return;
    }
    if (!jndEval?.estimateCents) {
      setUploadState('error');
      setUploadMsg('No valid JND estimate yet.');
      return;
    }
    if (!jndEval.avgOk) {
      setUploadState('error');
      setUploadMsg(`Avg answer time too slow (${(jndEval.avgMs / 1000).toFixed(2)}s > 6.0s).`);
      return;
    }
    setUploadState('uploading');
    setUploadMsg('');
    try {
      const anonUserId = ensureAnonUserId();
      const payload = {
        anonUserId,
        createdAt: Date.now(),
        conditions: {
          task: 'ear.part2.jnd',
          mode: jndSettings.mode,
          waveform: jndSettings.waveform || 'sine',
          toneMs,
          gapMs,
          minGapCents: jndSettings.minGapCents,
          maxGapCents: jndSettings.maxGapCents,
          randomGap: !!jndSettings.randomGap,
          randomBase: !!jndSettings.randomBase,
          baseHz: jndSettings.baseHz,
          baseHzMin: jndSettings.baseHzMin,
          baseHzMax: jndSettings.baseHzMax
        },
        computed: {
          estimateCents: jndEval.estimateCents,
          trials: jndEval.trials,
          method: jndEval.method
        },
        metrics: {
          avgAnswerMs: jndEval.avgMs,
          maxAnswerMs,
          requirement: { avgMsMax: 6000, singleMsMax: 8000 }
        }
      };
      const res = await fetch('/api/jnd/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = await res.json().catch(() => ({}));
      try {
        localStorage.setItem(STORAGE_KEYS.jndUploadLastAtMs, String(Date.now()));
      } catch { }
      setUploadState('ok');
      setUploadMsg(`Uploaded (${json.sessionId || 'ok'}).`);
    } catch (e: any) {
      setUploadState('error');
      setUploadMsg(e?.message || 'Upload failed.');
    }
  };

  const exportJndSnapshot = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      shareEnabled,
      settings: jndSettings,
      evaluation: jndEval,
      samples: part2.jndSamples ?? []
    };
    downloadJson(`jnd-export-${Date.now()}.json`, payload);
    setUploadState('ok');
    setUploadMsg('Exported locally.');
  };

  const exportDiagnostics = () => {
    downloadJson(`diagnostics-${Date.now()}.json`, buildDiagnosticsPackage());
  };

  const applySimplifyFromJnd = () => {
    if (!jndSuggestions) return;
    updateSettings({
      deduplicateNodes: true,
      deduplicationTolerance: jndSuggestions.simplifyTolerance
    });
    regenerateLattice(false, false);
  };

  const applyLoopFromJnd = () => {
    if (!jndSuggestions) return;
    updateSettings({
      loopTolerance: jndSuggestions.loopTolerance
    });
  };

  const intervalSettings = {
    baseHz: 440,
    intervalCents: 700,
    rangeCents: 50,
    waveform: 'sine',
    ...(s.intervalZone ?? {})
  };
  const intervalRange = clamp(Number.isFinite(intervalSettings.rangeCents) ? intervalSettings.rangeCents : 50, 1, 1200);
  const intervalTarget = Number.isFinite(intervalSettings.intervalCents) ? intervalSettings.intervalCents : 700;
  const intervalBase = safeHz(intervalSettings.baseHz ?? 440);
  const intervalWave = intervalSettings.waveform || 'sine';

  const [intervalOffset, setIntervalOffset] = useState(0);

  const [isIntervalTestMode, setIsIntervalTestMode] = useState(false);
  const [intervalTestFeedbackMode, setIntervalTestFeedbackMode] = useState<'diff' | 'hint'>('diff');
  const [intervalTestGuesses, setIntervalTestGuesses] = useState(0);
  const [intervalTestShift, setIntervalTestShift] = useState(0);
  const [intervalTestResult, setIntervalTestResult] = useState<string | null>(null);
  const [intervalTestRevealed, setIntervalTestRevealed] = useState(false);

  useEffect(() => {

    if (!isIntervalTestMode) {
      setIntervalTestShift(0);
      setIntervalTestResult(null);
      setIntervalTestRevealed(false);
      setIntervalTestGuesses(0);
    } else {
      startIntervalTest();
    }
  }, [isIntervalTestMode]);

  const startIntervalTest = () => {

    const range = intervalRange;
    const shift = (Math.random() * range * 1.6) - (range * 0.8);
    setIntervalTestShift(shift);
    setIntervalTestResult(null);
    setIntervalTestRevealed(false);
    setIntervalTestGuesses(0);
    setIntervalOffset(0);
  };

  useEffect(() => {
    setIntervalOffset((cur) => clamp(cur, -intervalRange, intervalRange));
  }, [intervalRange]);

  const currentEffectiveOffset = isIntervalTestMode ? intervalOffset + intervalTestShift : intervalOffset;
  const intervalHz = safeHz(intervalBase * centsToRatio(intervalTarget + currentEffectiveOffset));

  const [isPlayingInterval, setIsPlayingInterval] = useState(false);
  const activeIntervalOscs = useRef<{ osc: OscillatorNode, gain: GainNode }[]>([]);

  useEffect(() => {
    return () => stopContinuousInterval();
  }, []);

  useEffect(() => {
    if (isPlayingInterval && activeIntervalOscs.current.length === 2) {
      const now = getAudioContext().currentTime;
      activeIntervalOscs.current[0].osc.frequency.setTargetAtTime(intervalBase, now, 0.05);
      activeIntervalOscs.current[1].osc.frequency.setTargetAtTime(intervalHz, now, 0.05);
    }
  }, [intervalBase, intervalHz, isPlayingInterval]);

  const stopContinuousInterval = () => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    activeIntervalOscs.current.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.stop(now + 0.15);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 200);
      } catch (e) { }
    });
    activeIntervalOscs.current = [];
    setIsPlayingInterval(false);
  };

  const startContinuousInterval = () => {
    stopContinuousInterval();
    const ctx = getAudioContext();
    unlockAudioContext();
    const now = ctx.currentTime;
    const wave = intervalWave || 'sine';
    const type = (wave === 'custom-synth' ? 'sawtooth' : wave) as OscillatorType;

    const createVoice = (freq: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = ['sine', 'square', 'sawtooth', 'triangle'].includes(type) ? type : 'triangle';
      osc.frequency.value = freq;
      g.gain.value = 0.0001;
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      g.gain.exponentialRampToValueAtTime(0.1, now + 0.2);
      return { osc, gain: g };
    };

    activeIntervalOscs.current = [createVoice(intervalBase), createVoice(intervalHz)];
    setIsPlayingInterval(true);
  };

  const toggleIntervalPlayback = () => {
    if (isPlayingInterval) stopContinuousInterval();
    else startContinuousInterval();
  };

  const playIntervalTarget = () => {

    if (isPlayingInterval) stopContinuousInterval();

    playTone(intervalBase, intervalWave as WaveformShape, 420, 0.12);
    setTimeout(() => playTone(intervalHz, intervalWave as WaveformShape, 420, 0.12), 460);
  };

  const lockIntervalTarget = () => {
    const deviation = Number((isIntervalTestMode ? intervalOffset + intervalTestShift : intervalOffset).toFixed(2));
    const acceptWindow = 0.1;
    const next = { ...part2 };
    const samples = part2.intervalZoneSamples ?? [];
    next.intervalZoneSamples = [...samples, {
      deviationCents: deviation,
      accepted: Math.abs(deviation) <= acceptWindow,
      t: Date.now(),
      targetCents: intervalTarget,
      baseHz: intervalBase,
      intervalCents: intervalTarget
    }];
    onUpdate(next);
  };
  const intervalEval = useMemo(() => {
    const samples = part2.intervalZoneSamples ?? [];
    if (samples.length < 3) return null;
    const abs = samples.map(s => Math.abs(s.deviationCents));
    return {
      meanAbsDeviationCents: mean(abs),
      p90AbsDeviationCents: percentile(abs, 90)
    };
  }, [part2.intervalZoneSamples]);

  const checkIntervalTest = () => {
    const error = intervalOffset + intervalTestShift;
    const absError = Math.abs(error);
    const isPrecise = absError <= 1.0;

    lockIntervalTarget();

    if (intervalTestFeedbackMode === 'diff') {
      setIntervalTestResult(`Diff: ${error > 0 ? '+' : ''}${error.toFixed(2)} cents`);
      setIntervalTestRevealed(true);
    } else {
      const nextGuesses = intervalTestGuesses + 1;
      setIntervalTestGuesses(nextGuesses);

      if (isPrecise) {
        setIntervalTestResult(`Correct! (${error.toFixed(2)}c)`);
        setIntervalTestRevealed(true);
      } else {
        if (nextGuesses >= 3) {
          setIntervalTestResult(`Failed. Diff: ${error.toFixed(2)}c`);
          setIntervalTestRevealed(true);
        } else {
          setIntervalTestResult(error > 0 ? "Too High (Sharp)" : "Too Low (Flat)");
        }
      }
    }
  };

  const saveEvaluation = () => {
    const snap = {
      t: Date.now(),
      jnd: jndEval ? { ...jndEval, note: 'Manual Snap' } : undefined,
      intervalZone: intervalEval ? { ...intervalEval, note: 'Manual Snap' } : undefined
    };
    const next = { ...part2 };
    next.evaluation = [snap, ...next.evaluation].slice(0, 50);
    onUpdate(next);
  };

  const updateSetting = (path: string, value: any) => {
    const next = JSON.parse(JSON.stringify(part2)) as EarTrainingPart2PersistedV1;
    const parts = path.split('.');
    let cur: any = next.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    onUpdate(next);
  };

  return (
    <div className="space-y-6 p-3">
      <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-indigo-100 uppercase tracking-widest mb-1">Perceptual Calibration (Part II)</h3>
          <p className="text-[10px] text-indigo-300/80 leading-relaxed max-w-sm">
            Advanced modules to measure JND zones, interval precision, and pitch drift. Data is condition-dependent.
          </p>
        </div>
        <Button onClick={saveEvaluation} variant="primary" className="shrink-0 bg-indigo-700/50 border-indigo-500/50 text-indigo-100 hover:bg-indigo-600">
          Save Snapshot
        </Button>
      </div>

      <Card title="JND Finder (Interval / Double)" icon="JND" right={<span className="text-[9px] text-gray-500 font-mono">n={(part2.jndSamples ?? []).length}</span>}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mode</Label>
            <Select value={jndSettings.mode} onChange={e => updateSetting('jnd.mode', e.target.value)}>
              <option value="interval">Interval</option>
              <option value="double">Double</option>
              <option value="random">Random</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Random Root</Label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!jndSettings.randomBase}
                  onChange={(e) => updateSetting('jnd.randomBase', e.target.checked)}
                  className="w-3 h-3 accent-blue-500"
                />
                <span className="text-[9px] text-gray-400 font-bold uppercase">Enable</span>
              </label>
            </div>
            <div className="text-[9px] text-gray-500 font-mono">{baseHz.toFixed(1)} Hz</div>
          </div>
          {!jndSettings.randomBase ? (
            <div><Label>Base Hz</Label><Input type="number" value={jndSettings.baseHz} onChange={e => updateSetting('jnd.baseHz', Number(e.target.value || 440))} /></div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Min Hz</Label><Input type="number" value={jndSettings.baseHzMin ?? 220} onChange={e => updateSetting('jnd.baseHzMin', Number(e.target.value || 220))} /></div>
              <div><Label>Max Hz</Label><Input type="number" value={jndSettings.baseHzMax ?? 880} onChange={e => updateSetting('jnd.baseHzMax', Number(e.target.value || 880))} /></div>
            </div>
          )}
          <div><Label>Start Gap (cents)</Label><Input type="number" value={jndSettings.startGapCents} onChange={e => updateSetting('jnd.startGapCents', Number(e.target.value || 100))} /></div>
          <div><Label>Min Gap (cents)</Label><Input type="number" value={jndSettings.minGapCents} onChange={e => updateSetting('jnd.minGapCents', Number(e.target.value || 0.1))} /></div>
          <div><Label>Max Gap (cents)</Label><Input type="number" value={jndSettings.maxGapCents} onChange={e => updateSetting('jnd.maxGapCents', Number(e.target.value || 300))} /></div>
          <div><Label>Step Down</Label><Input type="number" step="0.01" value={jndSettings.stepDown} onChange={e => updateSetting('jnd.stepDown', Number(e.target.value || 0.85))} /></div>
          <div><Label>Step Up</Label><Input type="number" step="0.01" value={jndSettings.stepUp} onChange={e => updateSetting('jnd.stepUp', Number(e.target.value || 1.15))} /></div>
          <div className="col-span-2">
            <Label>Randomize Gap</Label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!jndSettings.randomGap}
                onChange={(e) => updateSetting('jnd.randomGap', e.target.checked)}
                className="w-3 h-3 accent-blue-500"
              />
              <span className="text-[9px] text-gray-400 font-bold uppercase">Each trial picks a random gap within Min/Max</span>
            </label>
          </div>
          <div><Label>Options</Label><Input type="number" min={3} max={5} value={jndSettings.optionsCount} onChange={e => updateSetting('jnd.optionsCount', Number(e.target.value || 3))} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Tone ms</Label><Input type="number" min={40} max={4000} value={toneMs} onChange={e => updateSetting('jnd.toneMs', Number(e.target.value || 260))} /></div>
            <div><Label>Gap ms</Label><Input type="number" min={0} max={4000} value={gapMs} onChange={e => updateSetting('jnd.gapMs', Number(e.target.value || 60))} /></div>
          </div>
          <div className="col-span-2">
            <Label>Timbre</Label>
            <div className="flex gap-2">
              <Select value={jndSettings.waveform || 'sine'} onChange={e => updateSetting('jnd.waveform', e.target.value)}>
                {CALIBRATION_TIMBRES.map(t => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Button onClick={() => playTone(baseHz, jndSettings.waveform || 'sine', toneMs, 0.12)} variant="primary" className="shrink-0">Test</Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <StatBox label="Current Gap" value={`${jndGap.toFixed(1)}c`} color="text-blue-300" />
          <StatBox label="Trial" value={trialIndex + 1} color="text-gray-200" />
        </div>

        {jndEval && (
          <div className="flex gap-2 pt-2">
            <StatBox label="JND Est." value={`${jndEval.estimateCents.toFixed(1)}c`} color="text-green-300" />
            <StatBox label="Trials" value={jndEval.trials} color="text-gray-200" />
          </div>
        )}

        {jndSuggestions && (
          <div className="bg-neutral-900/90 backdrop-blur-sm p-3 rounded-md border border-white/10 mt-2 space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] tracking-wider text-gray-400 uppercase font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Psychoacoustic JND
              </span>
              <span className="text-[9px] text-gray-600 font-mono">
                Weber Fraction
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatBox
                label="Simplify Thresh"
                value={`${jndSuggestions?.simplifyTolerance?.toFixed(1) ?? '--'}c`}
                color="text-cyan-300"
                tooltip="Deduplication Tolerance based on perceptual limits"
              />
              <StatBox
                label="Loop Criteria"
                value={`${jndSuggestions?.loopTolerance?.toFixed(1) ?? '--'}c`}
                color="text-fuchsia-300"
                tooltip="Max allow deviation for loop point closing"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={applySimplifyFromJnd}
                variant="ghost"
                className="w-full text-[10px] h-7 border border-cyan-900/50 hover:bg-cyan-900/30 text-cyan-100 transition-all"
              >
                Apply Simplification
              </Button>
              <Button
                onClick={applyLoopFromJnd}
                variant="ghost"
                className="w-full text-[10px] h-7 border border-fuchsia-900/50 hover:bg-fuchsia-900/30 text-fuchsia-100 transition-all"
              >
                Apply Loop Finder
              </Button>
            </div>

            <div className="text-[9px] text-gray-500 leading-relaxed px-0.5">
              <span className="text-gray-400 font-semibold">Target:</span> CONFIG
              <span className="mx-1 text-gray-600">→</span>
              Simplification (`deduplicationTolerance`) & Loop Finder (`loopTolerance`)
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2 border-t border-gray-800/50 mt-2">
          <Button onClick={playJndPair} variant="primary" className="w-full">Play Pair</Button>
          <div className="bg-black/40 border border-gray-800 rounded p-2">
            <div className="flex justify-between text-[9px] text-gray-500 font-mono mb-1">
              <span>Time Left</span>
              <span>{(timeLeftMs / 1000).toFixed(1)}s / 8.0s</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-amber-500"
                style={{ width: `${clamp((timeLeftMs / maxAnswerMs) * 100, 0, 100)}%` }}
              />
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              Must answer within 8 seconds. Slow answers do not count toward the JND estimate.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {optionLabels.map((opt) => (
              <button
                key={opt.id}
                onClick={() => submitJndAnswer(opt.id)}
                disabled={trialStartedAt === null || timeLeftMs <= 0}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm border w-full ${(trialStartedAt === null || timeLeftMs <= 0)
                  ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed opacity-60'
                  : 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50 hover:border-emerald-500 hover:text-white'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-gray-500 text-center">
            Choose the higher tone. Correct answers shrink the gap, wrong answers widen it.
          </div>
        </div>

        <div className="bg-black/20 p-2 rounded border border-gray-800 mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[8px] text-gray-500 uppercase font-bold tracking-wider">Share Anonymized JND Data</div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shareEnabled}
                onChange={(e) => setShareEnabled(e.target.checked)}
                className="w-3 h-3 accent-emerald-500"
              />
              <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Enabled</span>
            </label>
          </div>
          <div className="text-[8px] text-gray-600 leading-snug">
            Uploads only an anonymized JND estimate + task conditions. No names/emails. May still be personal data in some jurisdictions.
          </div>
          {!uploadAvailability.canUpload && uploadAvailability.reason && (
            <div className="text-[8px] text-amber-400">
              Upload disabled: {uploadAvailability.reason}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => { void uploadJndEstimate(); }}
              disabled={!shareEnabled || uploadState === 'uploading' || cooldownLeftMs > 0 || !uploadAvailability.canUpload}
              variant="primary"
              className="flex-1 py-1"
            >
              {uploadState === 'uploading' ? 'Uploading...' : 'Upload JND Estimate'}
            </Button>
            <div className="text-[8px] text-gray-500 font-mono whitespace-nowrap">
              {cooldownLeftMs > 0 ? <span className="text-amber-400">{formatCooldown(cooldownLeftMs)}</span> : null}
              {uploadState === 'ok' ? <span className="text-green-400">{uploadMsg}</span> : uploadState === 'error' ? <span className="text-red-400">{uploadMsg}</span> : null}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={exportJndSnapshot}
              variant="neutral"
              className="flex-1 py-1"
            >
              Export Data
            </Button>
            <Button
              onClick={exportDiagnostics}
              variant="ghost"
              className="flex-1 py-1"
            >
              Diagnostics
            </Button>
          </div>
          {jndEval && (
            <div className="text-[8px] text-gray-600 font-mono">
              Avg: {(jndEval.avgMs / 1000).toFixed(2)}s (must &lt;= 6.00s), max per answer: 8.00s, upload cooldown: 30 min.
            </div>
          )}
        </div>
      </Card>
      <Card title="Interval Target (Ultra Precision)" icon="Pure" right={<span className="text-[9px] text-gray-500 font-mono">n={(part2.intervalZoneSamples ?? []).length}</span>}>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div><Label>Base Hz</Label><Input type="number" value={intervalSettings.baseHz} onChange={e => updateSetting('intervalZone.baseHz', Number(e.target.value || 440))} /></div>
          <div><Label>Target (cents)</Label><Input type="number" value={intervalSettings.intervalCents} onChange={e => updateSetting('intervalZone.intervalCents', Number(e.target.value || 700))} /></div>
          <div><Label>Range (+/- cents)</Label><Input type="number" value={intervalSettings.rangeCents} onChange={e => updateSetting('intervalZone.rangeCents', Number(e.target.value || 50))} /></div>
          <div>
            <Label>Timbre</Label>
            <Select value={intervalWave} onChange={e => updateSetting('intervalZone.waveform', e.target.value)}>
              {CALIBRATION_TIMBRES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
        </div>

        <div className="bg-black/40 p-3 rounded-lg border border-gray-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] text-gray-400 font-mono">
              {isIntervalTestMode && !intervalTestRevealed
                ? `Offset: ???`
                : `Offset: ${currentEffectiveOffset > 0 ? '+' : ''}${currentEffectiveOffset.toFixed(2)}c`}
            </span>
            <span className="text-[10px] text-blue-300 font-mono font-bold">
              {isIntervalTestMode && !intervalTestRevealed
                ? `??? Hz`
                : `${intervalHz.toFixed(2)} Hz`}
            </span>
          </div>
          <input
            type="range"
            min={-intervalRange}
            max={intervalRange}
            step={0.05}
            value={intervalOffset}
            onChange={e => setIntervalOffset(Number(e.target.value))}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer hover:accent-blue-400 ${isIntervalTestMode ? 'bg-indigo-900/40 accent-indigo-500' : 'bg-gray-700 accent-blue-500'}`}
          />
          <div className="text-[9px] text-gray-600 mt-1 flex justify-between">
            <span>Precision step: 0.05 cents.</span>
            {isIntervalTestMode && <span className="text-indigo-400">BLIND TEST ACTIVE</span>}
          </div>
        </div>

        <div className="bg-indigo-900/10 border border-indigo-500/20 p-2 rounded mt-2 space-y-2">
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isIntervalTestMode}
                onChange={e => setIsIntervalTestMode(e.target.checked)}
                className="w-3 h-3 accent-indigo-500"
              />
              <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Blind Test Mode</span>
            </label>
            {isIntervalTestMode && (
              <Button onClick={startIntervalTest} variant="ghost" className="h-5 py-0 text-[9px] border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20">
                New Test
              </Button>
            )}
          </div>

          {isIntervalTestMode && (
            <div className="flex gap-2 items-center animate-in slide-in-from-top-1">
              <div className="flex-1">
                <Select
                  value={intervalTestFeedbackMode}
                  onChange={e => {
                    setIntervalTestFeedbackMode(e.target.value as any);
                    startIntervalTest();
                  }}
                  className="bg-black/40 border-indigo-500/30 text-indigo-200"
                >
                  <option value="diff">Immediate Show Diff</option>
                  <option value="hint">Hint (High/Low) - 3 Guesses</option>
                </Select>
              </div>
              {intervalTestResult && (
                <div className={`text-[10px] font-mono font-bold px-2 py-1 rounded ${intervalTestResult.includes('Correct') ? 'bg-green-900/50 text-green-300' : 'bg-black/40 text-indigo-200'}`}>
                  {intervalTestResult}
                </div>
              )}
            </div>
          )}
        </div>

        {intervalEval && (
          <div className="flex gap-2 pt-1">
            <StatBox label="Mean Err" value={`${intervalEval.meanAbsDeviationCents.toFixed(2)}c`} color="text-red-300" />
            <StatBox label="P90 Err" value={`${intervalEval.p90AbsDeviationCents.toFixed(2)}c`} color="text-red-400" />
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-800/50 mt-1">
          <Button onClick={playIntervalTarget} variant="primary" className="flex-1">Seq</Button>
          <Button
            onClick={toggleIntervalPlayback}
            variant={isPlayingInterval ? "warning" : "primary"}
            className={`flex-1 ${isPlayingInterval ? 'animate-pulse' : ''}`}
          >
            {isPlayingInterval ? 'Stop Drone' : 'Drone'}
          </Button>
          <Button
            onClick={isIntervalTestMode ? checkIntervalTest : lockIntervalTarget}
            disabled={isIntervalTestMode && intervalTestRevealed && intervalTestFeedbackMode === 'diff'}
            variant={isIntervalTestMode ? "warning" : "neutral"}
            className={`flex-1 ${isIntervalTestMode ? 'bg-amber-700/50 border-amber-600 text-amber-100' : 'bg-indigo-900/40 border-indigo-700 text-indigo-200 hover:bg-indigo-800'}`}
          >
            {isIntervalTestMode
              ? (intervalTestRevealed && intervalTestFeedbackMode === 'diff' ? 'Done' : `Check (${intervalTestGuesses}/3)`)
              : 'Lock'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
