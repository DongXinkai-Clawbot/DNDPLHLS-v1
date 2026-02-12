import React, { useMemo } from 'react';
import { shallow } from 'zustand/shallow';

import { useStore } from '../../store';
import { useAudioController } from '../../hooks/useAudioController';
import { formatRatio } from '../../musicLogic';
import { STANDARD_PRIMES } from '../../constants';
import type { PrimeLimit } from '../../types';
import { reportRecoverableError } from '../../utils/errorReporting';

type HitTestPolicy = 'optional' | 'required';
type PlacementMode = 'hit-test' | 'manual';

type ARControlPanelProps = {
  isOpen: boolean;
  onToggleOpen: () => void;
  hitTestPolicy: HitTestPolicy;
  onChangeHitTestPolicy: (policy: HitTestPolicy) => void;
  placementMode: PlacementMode;
  manualLocked: boolean;
  onToggleManualLock: () => void;
  arScale: number;
  onChangeArScale: (value: number) => void;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const ARControlPanel = ({
  isOpen,
  onToggleOpen,
  hitTestPolicy,
  onChangeHitTestPolicy,
  placementMode,
  manualLocked,
  onToggleManualLock,
  arScale,
  onChangeArScale,
}: ARControlPanelProps) => {
  const { isAudioUnlocked, handleStartAudio } = useAudioController();
  const {
    settings,
    selectedNode,
    updateSettings,
    regenerateLattice,
    addToKeyboard,
    addToComparison,
    stopAllAudioActivity,
  } = useStore(
    (s) => ({
      settings: s.settings,
      selectedNode: s.selectedNode,
      updateSettings: s.updateSettings,
      regenerateLattice: s.regenerateLattice,
      addToKeyboard: s.addToKeyboard,
      addToComparison: s.addToComparison,
      stopAllAudioActivity: s.stopAllAudioActivity,
    }),
    shallow
  );

  const visuals = settings?.visuals ?? {};
  const layoutMode = visuals.layoutMode ?? 'lattice';
  const primeOptions = STANDARD_PRIMES as PrimeLimit[];
  const primeIndex = Math.max(0, primeOptions.indexOf(settings.maxPrimeLimit as PrimeLimit));

  const activePatch = useMemo(() => {
    const patches = settings.timbre?.patches || [];
    return patches.find((p) => p.id === settings.timbre?.activePatchId) || patches[0] || null;
  }, [settings.timbre]);

  const runSafely = (label: string, action: () => void) => {
    try {
      action();
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error';
      reportRecoverableError('AR', err, `Action failed (${label}): ${detail}`);
    }
  };

  const updateVisuals = (partial: Partial<typeof settings.visuals>) => {
    const base = settings?.visuals ?? {};
    runSafely('updateVisuals', () => {
      updateSettings({ visuals: { ...base, ...partial } });
    });
  };

  const updateTimbre = (partial: Partial<NonNullable<typeof settings.timbre>>) => {
    const base = settings?.timbre ?? {};
    runSafely('updateTimbre', () => {
      updateSettings({ timbre: { ...base, ...partial } });
    });
  };

  const adjustExpansion = (key: 'expansionA' | 'expansionB', delta: number) => {
    const current = settings[key];
    const next = clamp(current + delta, 0, 24);
    runSafely(`adjustExpansion:${key}`, () => {
      updateSettings({ [key]: next });
      regenerateLattice(false, true);
    });
  };

  const adjustPrimeLimit = (delta: number) => {
    const nextIndex = clamp(primeIndex + delta, 0, primeOptions.length - 1);
    const next = primeOptions[nextIndex];
    runSafely('adjustPrimeLimit', () => {
      updateSettings({ maxPrimeLimit: next });
      regenerateLattice(false, true);
    });
  };

  const cyclePatch = () => {
    const patches = settings.timbre?.patches || [];
    if (!patches.length) return;
    const currentIndex = Math.max(0, patches.findIndex((p) => p.id === settings.timbre?.activePatchId));
    const nextPatch = patches[(currentIndex + 1) % patches.length];
    runSafely('cyclePatch', () => updateTimbre({ activePatchId: nextPatch.id }));
  };

  return (
    <div className="ar-control-panel pointer-events-auto absolute z-[70] flex flex-col items-end gap-2" style={{
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      right: 'calc(12px + env(safe-area-inset-right, 0px))',
    }}>
      <button
        type="button"
        onClick={() => runSafely('toggleControls', onToggleOpen)}
        className="min-h-[44px] rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur"
      >
        {isOpen ? 'Hide Controls' : 'AR Controls'}
      </button>

      {isOpen && (
        <div className="w-[300px] max-w-[85vw] max-h-[70vh] overflow-y-auto rounded-3xl border border-white/15 bg-black/70 p-4 text-white shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">AR Session</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => runSafely('hitTestOptional', () => onChangeHitTestPolicy('optional'))}
              className={`rounded-xl border px-3 py-2 font-bold ${hitTestPolicy === 'optional' ? 'border-blue-400 bg-blue-600/70' : 'border-white/10 bg-white/5'}`}
            >
              Auto Placement
            </button>
            <button
              type="button"
              onClick={() => runSafely('hitTestRequired', () => onChangeHitTestPolicy('required'))}
              className={`rounded-xl border px-3 py-2 font-bold ${hitTestPolicy === 'required' ? 'border-blue-400 bg-blue-600/70' : 'border-white/10 bg-white/5'}`}
            >
              Require Hit-Test
            </button>
          </div>
          <div className="mt-2 text-[10px] text-gray-300">
            Mode: {placementMode === 'manual' ? 'Manual' : 'Hit-Test'}{placementMode === 'manual' ? (manualLocked ? ' (Locked)' : ' (Unlocked)') : ''}
          </div>

          {placementMode === 'manual' && (
            <div className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Manual Placement</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runSafely('manualLockToggle', onToggleManualLock)}
                  className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold"
                >
                  {manualLocked ? 'Unlock' : 'Lock'}
                </button>
              </div>
              <div className="mt-3">
                <div className="text-[10px] text-gray-300">AR Scale</div>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.05}
                  value={arScale}
                  onChange={(e) =>
                    runSafely('manualScale', () => onChangeArScale(parseFloat(e.target.value)))
                  }
                  className="mt-1 w-full"
                />
                <div className="text-[10px] text-gray-400">{arScale.toFixed(2)}x</div>
              </div>
            </div>
          )}

          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Audio</div>
          <div className="mt-2 flex gap-2">
            {!isAudioUnlocked && (
              <button
                type="button"
                onClick={() => runSafely('startAudio', handleStartAudio)}
                className="flex-1 rounded-xl border border-blue-400 bg-blue-600/80 px-3 py-2 text-[11px] font-bold"
              >
                Start Audio
              </button>
            )}
            <button
              type="button"
              onClick={() => runSafely('stopAudio', stopAllAudioActivity)}
              className="flex-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold"
            >
              Stop Audio
            </button>
          </div>
          <button
            type="button"
            onClick={() => runSafely('cyclePatch', cyclePatch)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold"
          >
            Timbre: {activePatch ? activePatch.name : 'Default'}
          </button>

          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Lattice</div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-300">Expansion A</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runSafely('expansionA:dec', () => adjustExpansion('expansionA', -1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                -
              </button>
              <span className="w-6 text-center font-mono">{settings.expansionA}</span>
              <button
                type="button"
                onClick={() => runSafely('expansionA:inc', () => adjustExpansion('expansionA', 1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-300">Expansion B</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runSafely('expansionB:dec', () => adjustExpansion('expansionB', -1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                -
              </button>
              <span className="w-6 text-center font-mono">{settings.expansionB}</span>
              <button
                type="button"
                onClick={() => runSafely('expansionB:inc', () => adjustExpansion('expansionB', 1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-300">Prime Limit</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runSafely('primeLimit:dec', () => adjustPrimeLimit(-1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                -
              </button>
              <span className="w-8 text-center font-mono">{settings.maxPrimeLimit}</span>
              <button
                type="button"
                onClick={() => runSafely('primeLimit:inc', () => adjustPrimeLimit(1))}
                className="h-7 w-7 rounded-full border border-white/20 bg-white/10 font-bold"
              >
                +
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => runSafely('regenerateLattice', () => regenerateLattice(false, true))}
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-bold"
          >
            Regenerate Lattice
          </button>

          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Visuals</div>
          <div className="mt-2 text-[10px] text-gray-300">Global Scale</div>
          <input
            type="range"
            min={0.4}
            max={2.2}
            step={0.05}
            value={visuals.globalScale ?? 1}
            onChange={(e) => updateVisuals({ globalScale: parseFloat(e.target.value) })}
            className="mt-1 w-full"
          />
          <div className="mt-2 text-[10px] text-gray-300">Node Scale</div>
          <input
            type="range"
            min={0.3}
            max={1.8}
            step={0.05}
            value={visuals.nodeScale ?? 1}
            onChange={(e) => updateVisuals({ nodeScale: parseFloat(e.target.value) })}
            className="mt-1 w-full"
          />
          <div className="mt-2 text-[10px] text-gray-300">Edge Opacity</div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={visuals.edgeOpacity ?? 0.3}
            onChange={(e) => updateVisuals({ edgeOpacity: parseFloat(e.target.value) })}
            className="mt-1 w-full"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                runSafely('layoutMode:lattice', () => {
                  updateVisuals({ layoutMode: 'lattice' });
                  regenerateLattice(false, true);
                })
              }
              className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-bold ${layoutMode === 'lattice' ? 'border-blue-400 bg-blue-600/70' : 'border-white/15 bg-white/5'}`}
            >
              Lattice
            </button>
            <button
              type="button"
              onClick={() =>
                runSafely('layoutMode:pitch-field', () => {
                  updateVisuals({ layoutMode: 'pitch-field' });
                  regenerateLattice(false, true);
                })
              }
              className={`flex-1 rounded-xl border px-3 py-2 text-[11px] font-bold ${layoutMode === 'pitch-field' ? 'border-blue-400 bg-blue-600/70' : 'border-white/15 bg-white/5'}`}
            >
              Pitch Field
            </button>
          </div>

          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">Selection</div>
          {selectedNode ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-[11px]">
              <div className="font-bold">{selectedNode.name}</div>
              <div className="text-gray-300 font-mono">{formatRatio(selectedNode.ratio)}</div>
              <div className="text-gray-400">{selectedNode.cents.toFixed(2)}c</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => runSafely('addToKeyboard', () => addToKeyboard(selectedNode))}
                  className="flex-1 rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold"
                >
                  To Keyboard
                </button>
                <button
                  type="button"
                  onClick={() => runSafely('addToComparison', () => addToComparison(selectedNode))}
                  className="flex-1 rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold"
                >
                  Compare
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-gray-400">No node selected.</div>
          )}
        </div>
      )}
    </div>
  );
};
