import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store';
import { peekAudioContext } from '../../audioEngine';
import { getActiveTimbreVoiceCount } from '../../timbreEngine';
import { getMidiDiagnostics } from '../../engine/midi/diagnostics';

type MidiRow = {
  ts: number;
  dir: 'in' | 'out';
  data: number[];
};

export const DevDiagnosticsPanel = () => {
  const updatesRef = useRef(0);
  const totalRef = useRef(0);
  const [storeRate, setStoreRate] = useState(0);
  const [storeTotal, setStoreTotal] = useState(0);
  const [renderFps, setRenderFps] = useState(0);
  const [audioState, setAudioState] = useState('none');
  const [timbreVoices, setTimbreVoices] = useState(0);
  const [midiState, setMidiState] = useState('idle');
  const [midiError, setMidiError] = useState('');
  const [midiMessages, setMidiMessages] = useState<MidiRow[]>([]);

  useEffect(() => {
    const unsubscribe = useStore.subscribe(() => {
      updatesRef.current += 1;
    });

    const interval = setInterval(() => {
      totalRef.current += updatesRef.current;
      setStoreRate(updatesRef.current);
      setStoreTotal(totalRef.current);
      updatesRef.current = 0;

      const renderStats = (window as any).__renderStats;
      setRenderFps(renderStats?.fps ?? 0);

      const ctx = peekAudioContext();
      setAudioState(ctx?.state || 'none');
      setTimbreVoices(getActiveTimbreVoiceCount());

      const midi = getMidiDiagnostics();
      setMidiState(midi.state);
      setMidiError(midi.lastError || '');
      setMidiMessages(midi.recentMessages.slice(0, 6));
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const formattedMessages = useMemo(
    () =>
      midiMessages.map((m) => ({
        key: `${m.ts}-${m.dir}`,
        time: new Date(m.ts).toLocaleTimeString(),
        dir: m.dir,
        bytes: m.data.map((b) => b.toString(16).padStart(2, '0')).join(' ')
      })),
    [midiMessages]
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[280px] bg-black/80 text-gray-100 border border-white/10 rounded-lg p-3 text-[10px] font-mono shadow-xl pointer-events-none">
      <div className="text-[11px] font-bold uppercase tracking-widest text-blue-300 mb-2">Dev Diagnostics</div>

      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-2">
        <div className="text-gray-400">Store updates/s</div>
        <div className="text-right">{storeRate}</div>
        <div className="text-gray-400">Store total</div>
        <div className="text-right">{storeTotal}</div>
        <div className="text-gray-400">Render FPS</div>
        <div className="text-right">{renderFps}</div>
        <div className="text-gray-400">Audio state</div>
        <div className="text-right">{audioState}</div>
        <div className="text-gray-400">Timbre voices</div>
        <div className="text-right">{timbreVoices}</div>
      </div>

      <div className="border-t border-white/10 pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400">MIDI state</span>
          <span className="text-right">{midiState}</span>
        </div>
        {midiError && <div className="text-[9px] text-red-300 mb-1">Error: {midiError}</div>}
        <div className="text-gray-400 mb-1">Recent MIDI messages</div>
        <div className="space-y-0.5 max-h-24 overflow-hidden">
          {formattedMessages.length === 0 && <div className="text-gray-500">No messages</div>}
          {formattedMessages.map((m) => (
            <div key={m.key} className="flex items-center gap-1 text-[9px] text-gray-300">
              <span className={`w-4 ${m.dir === 'in' ? 'text-emerald-300' : 'text-amber-300'}`}>
                {m.dir === 'in' ? 'IN' : 'OUT'}
              </span>
              <span className="text-gray-500">{m.time}</span>
              <span className="truncate">{m.bytes}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
