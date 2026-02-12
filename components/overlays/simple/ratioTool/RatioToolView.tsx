import React, { useMemo, useState } from 'react';

import { useDeviceType } from '../../../../hooks/useDeviceType';
import { FullScreenModal } from '../../../common/FullScreenModal';
import SetharesExperiment from '../../../setharesEngine/SetharesExperiment';

import { AdaptiveTemperamentSolver } from '../AdaptiveTemperamentSolver';
import { HarmonicSuperposition } from '../HarmonicSuperposition';
import { RatioToolChordMode } from './RatioToolChordMode';
import { RatioToolDeriveMode } from './RatioToolDeriveMode';
import { RatioToolSingleMode } from './RatioToolSingleMode';
import { MusicXmlRetuneTool } from './MusicXmlRetuneTool';
import { HuntSystemTool } from './HuntSystemTool';

export type RatioToolViewProps = Record<string, any>;

type ModeId = 'single' | 'chord' | 'derive' | 'sethares' | 'temperament' | 'superposition' | 'musicxml' | 'hunt';

const MODES: Array<{ id: ModeId; label: string; title?: string }> = [
  { id: 'single', label: 'Single Interval' },
  { id: 'chord', label: 'Chord Constructor' },
  { id: 'derive', label: 'N-Limit JI Ratio Deriver' },
  { id: 'sethares', label: 'Sethares Engine' },
  {
    id: 'temperament',
    label: 'Temperament Solver',
    title: 'Harmonia Universalis: The Adaptive Temperament Solver'
  },
  { id: 'superposition', label: 'Harmonic Superposition' },
  { id: 'musicxml', label: 'MusicXML Retune' },
  { id: 'hunt', label: 'Hunt System' }
];

export const RatioToolView = (props: RatioToolViewProps) => {
  const { isMobile } = useDeviceType();
  const { mode, setMode, previewInst, setPreviewInst, settings } = props as any;

  const modeOptions = useMemo(() => MODES, []);
  const showSoundSelector = mode !== 'superposition' && mode !== 'sethares' && mode !== 'temperament' && mode !== 'musicxml' && mode !== 'hunt';

  const [fullscreenTool, setFullscreenTool] = useState<null | 'sethares' | 'temperament'>(null);

  const handleModeChange = (nextMode: string) => {
    setMode(nextMode);

    if (!isMobile) return;

    if (nextMode === 'sethares' || nextMode === 'temperament') {
      setFullscreenTool(nextMode);
    }
  };

  const isMobileAdvanced = isMobile && (mode === 'sethares' || mode === 'temperament');

  return (
    <div className="space-y-4 text-xs">
      <FullScreenModal
        isOpen={fullscreenTool === 'sethares'}
        title="Sethares Engine"
        onClose={() => setFullscreenTool(null)}
      >
        <div className="border border-indigo-500/40 bg-black/40 rounded-xl p-2 shadow-xl">
          <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: 'min(90vh, 1000px)' }}>
            <SetharesExperiment />
          </div>
        </div>
      </FullScreenModal>

      <FullScreenModal
        isOpen={fullscreenTool === 'temperament'}
        title="Adaptive Temperament Solver"
        onClose={() => setFullscreenTool(null)}
      >
        <AdaptiveTemperamentSolver settings={settings} />
      </FullScreenModal>

      <div className="space-y-2">
        <div className="sm:hidden">
          <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Mode</label>
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            className="w-full min-h-[44px] bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          >
            {modeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex flex-wrap gap-1 bg-black rounded-lg p-1 border border-gray-800">
          {modeOptions.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleModeChange(m.id)}
              title={m.title}
              className={`px-3 py-1.5 rounded-lg font-black uppercase tracking-widest text-[10px] transition-colors ${
                mode === m.id
                  ? 'bg-blue-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showSoundSelector && (
        <div className="flex gap-2 items-center bg-gray-900 p-2 rounded-lg border border-gray-700">
          <span className="text-[10px] uppercase text-gray-500 font-bold whitespace-nowrap">Sound:</span>
          <select
            value={previewInst}
            onChange={(e) => setPreviewInst(e.target.value)}
            className="flex-1 min-h-[44px] bg-black border border-gray-600 text-sm rounded-lg px-3 py-2 outline-none text-gray-200"
          >
            <option value="click">Default (Current Settings)</option>
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="organ">Organ</option>
            <option value="epiano">E-Piano</option>
            <option value="strings">Strings</option>
            <option value="pad">Pad</option>
          </select>
        </div>
      )}

      {isMobileAdvanced && (
        <div className="border border-gray-800 bg-black/40 rounded-xl p-3 space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mobile Fullscreen Tool</div>
          <div className="text-xs text-gray-300">
            This tool works best in fullscreen on mobile so controls stay readable and stable.
          </div>
          <button
            type="button"
            onClick={() => setFullscreenTool(mode as any)}
            className="w-full min-h-[44px] rounded-lg border border-blue-700 bg-blue-700/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          >
            Open {mode === 'sethares' ? 'Sethares Engine' : 'Temperament Solver'}
          </button>
        </div>
      )}

      {!isMobileAdvanced &&
        (mode === 'single' ? (
          <RatioToolSingleMode {...props} />
        ) : mode === 'chord' ? (
          <RatioToolChordMode {...props} />
        ) : mode === 'temperament' ? (
          <AdaptiveTemperamentSolver settings={settings} />
        ) : mode === 'superposition' ? (
          <HarmonicSuperposition settings={settings} />
        ) : mode === 'musicxml' ? (
          <MusicXmlRetuneTool {...props} />
        ) : mode === 'hunt' ? (
          <HuntSystemTool settings={settings} />
        ) : mode === 'sethares' ? (
          <div className="border border-indigo-500/40 bg-black/40 rounded-xl p-2 shadow-xl">
            <div className="border border-white/10 rounded-lg overflow-hidden" style={{ height: 'min(82vh, 900px)' }}>
              <SetharesExperiment />
            </div>
          </div>
        ) : (
          <RatioToolDeriveMode {...props} />
        ))}
    </div>
  );
};
