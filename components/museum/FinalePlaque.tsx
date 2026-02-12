import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';
import { useMuseumStore } from '../../store/museumStore';
import { museumMaterial } from './materials';

export const FINALE_PLAQUE_POS: [number, number, number] = [0, 1.15, 44.15];
export const FINALE_PLAQUE_ROT_Y = Math.PI; 

const SPAWN_POS = new Vector3(0, 1.6, -2.2);

export const FinalePlaque = () => {
  const setPlaqueNear = useMuseumStore((s) => s.setPlaqueNear);
  const tour = useMuseumStore((s) => s.tour);
  const tourHistory = useMuseumStore((s) => s.tourHistory);

  const restartTour = useMuseumStore((s) => s.restartTour);
  const requestTeleport = useMuseumStore((s) => s.requestTeleport);
  const closeFinalePlaque = useMuseumStore((s) => s.closeFinalePlaque);

  const nearRef = useRef(false);

  const handleEnter = (payload: any) => {
    const isPlayer = payload.other?.rigidBodyObject?.name === 'player' || payload.other?.rigidBodyObject?.userData?.type === 'player';
    if (!isPlayer) return;
    if (!nearRef.current) {
      nearRef.current = true;
      setPlaqueNear(true);
    }
  };

  const handleExit = (payload: any) => {
    const isPlayer = payload.other?.rigidBodyObject?.name === 'player' || payload.other?.rigidBodyObject?.userData?.type === 'player';
    if (!isPlayer) return;
    if (nearRef.current) {
      nearRef.current = false;
      setPlaqueNear(false);
      
      if (tour.plaqueOpen) closeFinalePlaque();
    }
  };

  const plaqueMat = useMemo(() => museumMaterial('wallAccent', 'plaque-body'), []);
  const baseMat = useMemo(() => museumMaterial('baseboard', 'plaque-base'), []);
  const panelMat = useMemo(() => museumMaterial('wallPlaster', 'plaque-panel'), []);

  const timeText = (ms: number | null) => {
    if (ms == null) return '—';
    const s = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  const canShowSummary = tour.summaryAvailable || tourHistory.timesCompleted > 0;

  useEffect(() => {
    
    if (tour.status !== 'finished' && tour.plaqueOpen) closeFinalePlaque();
    
  }, [tour.status]);

  return (
    <group position={FINALE_PLAQUE_POS} rotation={[0, FINALE_PLAQUE_ROT_Y, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, -0.95, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.22, 0.55]} />
          <meshStandardMaterial color={baseMat.color} roughness={baseMat.roughness} metalness={baseMat.metalness} />
        </mesh>

        <mesh position={[0, -0.24, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.95, 1.35, 0.14]} />
          <meshStandardMaterial color={plaqueMat.color} roughness={plaqueMat.roughness} metalness={plaqueMat.metalness} />
        </mesh>

        <mesh position={[0, -0.22, 0.075]} receiveShadow>
          <boxGeometry args={[0.82, 1.18, 0.02]} />
          <meshStandardMaterial color={panelMat.color} roughness={panelMat.roughness} metalness={panelMat.metalness} />
        </mesh>

        <CuboidCollider
          sensor
          args={[1.35, 1.2, 1.35]}
          position={[0, -0.25, 0.8]}
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      </RigidBody>

      <Html
        transform
        position={[0, -0.25, 0.095]}
        style={{ pointerEvents: 'none' }}
        distanceFactor={1.1}
        occlude={false}
      >
        <div
          style={{
            width: 360,
            borderRadius: 18,
            background: 'rgba(10, 12, 16, 0.62)',
            border: '1px solid rgba(255,255,255,0.10)',
            padding: '14px 16px',
            color: 'rgba(255,255,255,0.92)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(10px)',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: 0.5, fontWeight: 700, opacity: 0.9 }}>FINALE PLAQUE</div>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>Microtonality Museum Tour</div>

          {!tour.plaqueOpen && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
              {canShowSummary ? (
                <>
                  <div style={{ opacity: 0.85 }}>Approach and press <b>E</b> to open the plaque.</div>
                  {tour.summaryAvailable && !tour.summaryViewed && (
                    <div style={{ marginTop: 6, opacity: 0.85 }}>Tour complete — read the summary here.</div>
                  )}
                </>
              ) : (
                <div style={{ opacity: 0.85 }}>This plaque will show your tour summary when you finish the route.</div>
              )}
            </div>
          )}

          {tour.plaqueOpen && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>LAST</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{timeText(tourHistory.lastTimeMs)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>BEST</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{timeText(tourHistory.bestTimeMs)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.75 }}>RUNS</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{tourHistory.timesCompleted ?? 0}</div>
                </div>
              </div>

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.8 }}>ACTIONS (keyboard)</div>
                <div style={{ marginTop: 6, lineHeight: 1.5, opacity: 0.92 }}>
                  <div><b>1</b> — Free explore</div>
                  <div><b>2</b> — Restart tour (teleport to entrance)</div>
                  <div><b>3</b> — Exit (walk out)</div>
                  <div style={{ marginTop: 6, opacity: 0.75 }}><b>E</b> / <b>Esc</b> — Close</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
};
