import React, { useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useMuseumStore } from '../../store/museumStore';
import { museumExhibits } from '../../data/museumExhibits';
import { ExhibitInspectPanel } from './ExhibitInspectPanel';
import { useExitRitualStore } from './exitRitualStore';

export const MuseumHUD = () => {
  const focusedExhibitId = useMuseumStore((state) => state.focusedExhibitId);
  const activeExhibitId = useMuseumStore((state) => state.activeExhibitId);
  const enterInspect = useMuseumStore((state) => state.enterInspect);
  const exitInspect = useMuseumStore((state) => state.exitInspect);

  const setComfort = useMuseumStore((state) => state.setComfort);
  const comfort = useMuseumStore((state) => state.comfort);

  const setGraphics = useMuseumStore((state) => state.setGraphics);
  const graphics = useMuseumStore((state) => state.graphics);

  const menu = useMuseumStore((state) => state.ui.menu);
  const setMenu = useMuseumStore((state) => state.setMenu);

  const playerSpeed = useMuseumStore((state) => state.playerSpeed);
  const hasPointerLocked = useMuseumStore((state) => state.ui.hasPointerLocked);

  const tour = useMuseumStore((s) => s.tour);
  const tourHistory = useMuseumStore((s) => s.tourHistory);
  const startTour = useMuseumStore((s) => s.startTour);
  const cancelTour = useMuseumStore((s) => s.cancelTour);
  const restartTour = useMuseumStore((s) => s.restartTour);
  const openFinalePlaque = useMuseumStore((s) => s.openFinalePlaque);
  const closeFinalePlaque = useMuseumStore((s) => s.closeFinalePlaque);
  const requestTeleport = useMuseumStore((s) => s.requestTeleport);
  const clearTourHistory = useMuseumStore((s) => s.clearTourHistory);

  const exitPhase = useExitRitualStore((s) => s.phase);
  const exitFadeAlpha = useExitRitualStore((s) => s.fadeAlpha);
  const requestExit = useExitRitualStore((s) => s.requestExit);
  const cancelExit = useExitRitualStore((s) => s.cancelExit);

  const focusedExhibit = useMemo(() => {
    if (!focusedExhibitId) return null;
    return museumExhibits.find((e) => e.id === focusedExhibitId) ?? null;
  }, [focusedExhibitId]);

  const focusedTitle = focusedExhibit?.content?.title ?? null;
  const focusedAction = useMemo(() => {
    if (!focusedExhibit) return 'Observe';
    if (focusedExhibit.type === 'audio') return 'Listen / Compare';
    if (focusedExhibit.type === 'text') return 'Trace';
    if (focusedExhibit.type === 'interactive') return 'Explore';
    return 'Observe';
  }, [focusedExhibit]);

  const [focusedSince, setFocusedSince] = useState<number>(0);

  useEffect(() => {
    setFocusedSince(Date.now());
  }, [focusedExhibitId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      
      if (event.code === 'Escape') {
        if (exitPhase !== 'inactive') {
          event.preventDefault();
          cancelExit();
          return;
        }
        if (tour.plaqueOpen) {
          event.preventDefault();
          closeFinalePlaque();
          return;
        }
      }

      if (event.code === 'KeyE') {
        if (!activeExhibitId && menu === 'none' && tour.summaryAvailable && tour.plaqueNear) {
          event.preventDefault();
          if (tour.plaqueOpen) closeFinalePlaque();
          else openFinalePlaque();
          return;
        }
        if (focusedExhibitId && !activeExhibitId && menu === 'none') {
          event.preventDefault();
          enterInspect();
          return;
        }
      }

      if (tour.plaqueOpen && menu === 'none') {
        if (event.code === 'Digit1') {
          event.preventDefault();
          closeFinalePlaque();
          return;
        }
        if (event.code === 'Digit2') {
          event.preventDefault();
          closeFinalePlaque();
          
          requestTeleport(new Vector3(0, 1.6, -2.2));
          restartTour();
          return;
        }
        if (event.code === 'Digit3') {
          event.preventDefault();
          closeFinalePlaque();
          requestExit();
          return;
        }
      }

      if (event.code === 'KeyM') {
        event.preventDefault();
        setMenu(menu === 'map' ? 'none' : 'map');
      }

      if (event.code === 'KeyC') {
        event.preventDefault();
        setMenu(menu === 'comfort' ? 'none' : 'comfort');
      }

      if (event.code === 'KeyG') {
        event.preventDefault();
        setMenu(menu === 'graphics' ? 'none' : 'graphics');
      }

      if (event.code === 'KeyT') {
        event.preventDefault();
        
        if (!activeExhibitId && menu === 'none' && tour.status === 'inactive') {
          startTour();
          return;
        }
        setMenu(menu === 'tour' ? 'none' : 'tour');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeExhibitId, focusedExhibitId, enterInspect, menu, setMenu, tour.status, tour.summaryAvailable, tour.plaqueNear, tour.plaqueOpen, startTour, restartTour, openFinalePlaque, closeFinalePlaque, requestTeleport, exitPhase, cancelExit, requestExit]);

  const showInspectPrompt =
    !!focusedExhibitId &&
    !activeExhibitId &&
    menu === 'none' &&
    hasPointerLocked &&
    playerSpeed < 0.15 &&
    Date.now() - focusedSince > 250;

  const showTourCallout =
    !activeExhibitId &&
    menu === 'none' &&
    hasPointerLocked &&
    tour.status === 'inactive' &&
    playerSpeed < 0.12;

  const showPlaquePrompt =
    !activeExhibitId &&
    menu === 'none' &&
    hasPointerLocked &&
    tour.summaryAvailable &&
    tour.plaqueNear &&
    !tour.plaqueOpen &&
    playerSpeed < 0.15;

  const showPlaqueOpenHint = menu === 'none' && tour.plaqueOpen;

  const showExitGuideHint =
    exitPhase === 'guiding' &&
    menu === 'none' &&
    hasPointerLocked &&
    !activeExhibitId &&
    playerSpeed < 0.12;
  const step = tour.steps[tour.stepIndex];
  const stepsTotal = tour.steps.length;
  const stepsDone = Object.values(tour.completed).filter(Boolean).length;

  const fmtTime = (ms: number | null) => {
    if (ms == null) return '--:--';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[100]">
      {exitFadeAlpha > 0.001 && (
        <div
          className="absolute inset-0"
          style={{ background: 'black', opacity: exitFadeAlpha, transition: 'opacity 60ms linear' }}
        />
      )}

      {hasPointerLocked && menu === 'none' && !activeExhibitId && !!focusedExhibitId && playerSpeed < 0.12 && (
        <div className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      )}

      {tour.status === 'active' && menu === 'none' && !activeExhibitId && playerSpeed < 0.12 && (
        <div className="absolute left-1/2 top-4 w-[min(520px,calc(100%-24px))] -translate-x-1/2">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2 text-white shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide">Tour</div>
              <div className="text-[11px] text-white/70">
                {stepsDone}/{stepsTotal}
              </div>
            </div>
            <div className="mt-0.5 text-sm font-medium">Next: {step?.label ?? '--'}</div>
          </div>
        </div>
      )}

      {showTourCallout && (
        <div className="absolute bottom-6 right-6 w-[min(320px,calc(100%-24px))]">
          <div className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-white shadow-lg backdrop-blur">
            <div className="text-xs font-semibold tracking-wide">Guided tour available</div>
            <div className="mt-1 text-[11px] text-white/70">Press T to begin. Lighting will guide you.</div>
          </div>
        </div>
      )}

      {showInspectPrompt && (
        <div className="absolute left-1/2 top-[60%] w-[min(460px,calc(100%-24px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-center text-white shadow-lg backdrop-blur">
          <div className="text-sm font-semibold">{focusedAction}</div>
          {focusedTitle && <div className="mt-1 text-xs text-white/70">{focusedTitle}</div>}
          <div className="mt-1 text-[11px] text-white/60">Key: E</div>
        </div>
      )}

      {showPlaquePrompt && (
        <div className="absolute left-1/2 top-[68%] w-[min(520px,92%)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-center text-white shadow-lg backdrop-blur">
          <div className="text-sm font-semibold">Finale plaque available</div>
          <div className="mt-1 text-xs text-white/70">Key: E. Summary stays in the hall.</div>
        </div>
      )}

      {showPlaqueOpenHint && (
        <div className="absolute left-1/2 top-[76%] w-[min(520px,92%)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-center text-white shadow-lg backdrop-blur">
          <div className="text-xs text-white/80">
            <span className="font-semibold">1</span> Free explore |{' '}
            <span className="font-semibold">2</span> Restart tour |{' '}
            <span className="font-semibold">3</span> Exit |{' '}
            <span className="font-semibold">E/Esc</span> Close
          </div>
        </div>
      )}

      {showExitGuideHint && (
        <div className="absolute left-1/2 top-6 w-[min(560px,calc(100%-24px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-center text-white shadow-lg backdrop-blur">
          <div className="text-sm font-semibold">Exit is a walk-out</div>
          <div className="mt-1 text-xs text-white/70">Follow the corridor light and walk all the way out. Press Esc to cancel.</div>
        </div>
      )}

      {activeExhibitId && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(920px,100%)]">
            <ExhibitInspectPanel exhibitId={activeExhibitId} onRequestClose={exitInspect} />
          </div>
        </div>
      )}

      {menu !== 'none' && !activeExhibitId && (
        <div className="pointer-events-auto absolute left-4 top-4 w-[min(420px,calc(100%-32px))] rounded-2xl border border-white/10 bg-black/70 p-4 text-white shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-wide">Museum Menu</div>
            <button
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
              onClick={() => setMenu('none')}
            >
              Close
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              className={`rounded-lg border px-3 py-1 text-xs ${menu === 'map' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              onClick={() => setMenu(menu === 'map' ? 'none' : 'map')}
            >
              Map (M)
            </button>
            <button
              className={`rounded-lg border px-3 py-1 text-xs ${menu === 'comfort' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              onClick={() => setMenu(menu === 'comfort' ? 'none' : 'comfort')}
            >
              Comfort (C)
            </button>
            <button
              className={`rounded-lg border px-3 py-1 text-xs ${menu === 'graphics' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              onClick={() => setMenu(menu === 'graphics' ? 'none' : 'graphics')}
            >
              Graphics (G)
            </button>

            <button
              className={`rounded-lg border px-3 py-1 text-xs ${menu === 'tour' ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              onClick={() => setMenu(menu === 'tour' ? 'none' : 'tour')}
            >
              Tour (T)
            </button>
          </div>

          {menu === 'map' && (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-white/70">
                Teleport is for accessibility and quick navigation. Explore freely; teleport is available for accessibility.
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {museumExhibits.map((e) => (
                  <button
                    key={e.id}
                    className="flex w-full flex-col rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      requestTeleport(new Vector3(e.position[0], 1.6, e.position[2] + 2.6));
                      setMenu('none');
                    }}
                  >
                    <div className="text-sm font-medium">{e.content.title}</div>
                    <div className="mt-1 text-xs text-white/70">{e.content.shortDescription}</div>
                  </button>
                ))}
              </div>

              <button
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                onClick={() => {
                  
                  window.location.hash = '#/';
                  setMenu('none');
                }}
              >
                <div className="text-sm font-medium">Exit Museum</div>
                <div className="mt-1 text-xs text-white/70">Return to the main experience.</div>
              </button>
            </div>
          )}

          {menu === 'comfort' && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-white/70">
                Comfort settings prioritize navigation stability over motion intensity.
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs">
                  <span>Move speed</span>
                  <input
                    className="w-40"
                    type="range"
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    value={comfort.moveSpeedMultiplier}
                    onChange={(e) => setComfort({ moveSpeedMultiplier: Number(e.target.value) })}
                  />
                </label>

                <label className="flex items-center justify-between text-xs">
                  <span>Mouse sensitivity</span>
                  <input
                    className="w-40"
                    type="range"
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    value={comfort.mouseSensitivityMultiplier}
                    onChange={(e) => setComfort({ mouseSensitivityMultiplier: Number(e.target.value) })}
                  />
                </label>

                <label className="flex items-center justify-between text-xs">
                  <span>Reduce motion</span>
                  <input
                    type="checkbox"
                    checked={comfort.reduceMotion}
                    onChange={(e) => setComfort({ reduceMotion: e.target.checked })}
                  />
                </label>
              </div>
            </div>
          )}

          {menu === 'graphics' && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-white/70">Lighting scales with quality. Use Brightness if your display is dim.</div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((q) => (
                  <button
                    key={q}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      graphics.quality === q ? 'border-white/30 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setGraphics({ quality: q })}
                  >
                    {q.toUpperCase()}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between text-xs">
                <span>Brightness</span>
                <input
                  className="w-40"
                  type="range"
                  min={0.8}
                  max={3.0}
                  step={0.05}
                  value={graphics.brightness}
                  onChange={(e) => setGraphics({ brightness: Number(e.target.value) })}
                />
              </label>
              <div className="text-[11px] text-white/60">{graphics.brightness.toFixed(2)} exposure</div>
            </div>
          )}

          {menu === 'tour' && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-white/70">
                Guided tour is optimized for first-time visitors: it highlights the next doorway and records completion.
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/70">Status</div>
                <div className="mt-1 text-sm font-semibold">
                  {tour.status === 'inactive' && 'Not running'}
                  {tour.status === 'active' && `Step ${tour.stepIndex + 1}/${stepsTotal}: ${step?.label ?? '--'}`}
                  {tour.status === 'finished' && 'Completed'}
                </div>
                {tour.status === 'active' && (
                  <div className="mt-1 text-[11px] text-white/70">
                    Stay briefly in each target room. Doorway lighting will guide you forward.
                  </div>
                )}
              </div>

              {tour.status !== 'active' ? (
                <button
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => startTour()}
                >
                  <div className="text-sm font-medium">Start Tour</div>
                  <div className="mt-1 text-xs text-white/70">Target completion time: 2 min.</div>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => cancelTour()}
                  >
                    <div className="text-sm font-medium">Cancel</div>
                    <div className="mt-1 text-xs text-white/70">Stop guiding + keep exploring.</div>
                  </button>
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => restartTour()}
                  >
                    <div className="text-sm font-medium">Restart</div>
                    <div className="mt-1 text-xs text-white/70">Reset tour timers.</div>
                  </button>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/70">History</div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="text-white/60">Completed runs</div>
                    <div className="mt-0.5 text-sm font-semibold">{tourHistory.timesCompleted}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="text-white/60">Best time</div>
                    <div className="mt-0.5 text-sm font-semibold">{fmtTime(tourHistory.bestTimeMs)}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="text-white/60">Last time</div>
                    <div className="mt-0.5 text-sm font-semibold">{fmtTime(tourHistory.lastTimeMs)}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <div className="text-white/60">Last finished</div>
                    <div className="mt-0.5 text-sm font-semibold">
                      {tourHistory.lastFinishedAtMs ? new Date(tourHistory.lastFinishedAtMs).toLocaleString() : '--'}
                    </div>
                  </div>
                </div>

                <button
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                  onClick={() => clearTourHistory()}
                >
                  Clear history
                </button>
              </div>

              {tour.status === 'finished' && (
                <button
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => (tour.plaqueOpen ? closeFinalePlaque() : openFinalePlaque())}
                >
                  <div className="text-sm font-medium">{tour.plaqueOpen ? 'Close finale plaque' : 'Open finale plaque'}</div>
                  <div className="mt-1 text-xs text-white/70">{tour.plaqueOpen ? 'Return to free exploration.' : 'Read the in-hall summary plaque.'}</div>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
