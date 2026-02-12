import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, SpotLight } from 'three';
import { useMuseumStore } from '../../store/museumStore';
import { museumExhibits } from '../../data/museumExhibits';
import { FINALE_PLAQUE_POS } from './FinalePlaque';
import { useExitRitualStore } from './exitRitualStore';

type Quality = 'low' | 'medium' | 'high';

const FRAME_DEPTH = 0.34;
const SLOT_D = 0.18;
const SLOT_CENTER_OFFSET = FRAME_DEPTH / 2 + SLOT_D / 2 - 0.02;

const RHYTHM_Z = [6, 14, 22, 30];

type DoorId = 'g1' | 'g2' | 'g3' | 'finale' | 'exit';
type DoorSpec =
  | { id: DoorId; kind: 'side'; xFace: number; z: number; spineDirX: 1 | -1; doorH: number } 
  | { id: DoorId; kind: 'north'; zFace: number; x: number; spineDirZ: 1 | -1; lenX: number; doorH: number }; 

const DOORS: DoorSpec[] = [
  { id: 'g1', kind: 'side', xFace: -2.0, z: 8.0, spineDirX: +1, doorH: 2.35 },
  { id: 'g2', kind: 'side', xFace: 2.0, z: 16.0, spineDirX: -1, doorH: 2.35 },
  { id: 'g3', kind: 'side', xFace: -2.0, z: 24.0, spineDirX: +1, doorH: 2.35 },
  { id: 'finale', kind: 'north', zFace: 32.0, x: 0.0, spineDirZ: -1, lenX: 3.2, doorH: 2.45 },
  { id: 'exit', kind: 'side', xFace: 7.0, z: 40.5, spineDirX: -1, doorH: 2.3 }
];

const guidePositionsZHigh = [6, 12, 18, 24, 30];

const TargetedSpotLight = (props: {
  id: string;
  position: [number, number, number];
  target: [number, number, number];
  intensity: number;
  distance: number;
  angle: number;
  penumbra: number;
  decay: number;
  color: string;
  castShadow?: boolean;
  shadowMapSize?: number;
  breathe?: boolean;
}) => {
  const targetObj = useRef<Object3D>(new Object3D());
  const lightRef = useRef<SpotLight | null>(null);

  useEffect(() => {
    targetObj.current.position.set(props.target[0], props.target[1], props.target[2]);
  }, [props.target]);

  useFrame((state) => {
    if (!lightRef.current) return;
    
    const t = state.clock.getElapsedTime();
    const base = props.intensity;
    const breathe = props.breathe ? 0.96 + 0.04 * Math.sin(t * 0.7) : 1;
    lightRef.current.intensity = base * breathe;
  });

  return (
    <>
      <primitive object={targetObj.current} />
      <spotLight
        ref={lightRef}
        position={props.position}
        intensity={props.intensity}
        distance={props.distance}
        angle={props.angle}
        penumbra={props.penumbra}
        decay={props.decay}
        color={props.color}
        castShadow={!!props.castShadow}
        shadow-mapSize-width={props.shadowMapSize ?? 1024}
        shadow-mapSize-height={props.shadowMapSize ?? 1024}
        target={targetObj.current}
      />
    </>
  );
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export const MuseumLighting = () => {
  const quality = useMuseumStore((s) => s.graphics.quality) as Quality;
  const tour = useMuseumStore((s) => s.tour);
  const zoneId = useMuseumStore((s) => s.tour.currentZoneId);
  const avatarPos = useMuseumStore((s) => s.avatar.position);
  const focusedExhibitId = useMuseumStore((s) => s.focusedExhibitId);
  const exitPhase = useExitRitualStore((s) => s.phase);

  const activeDoor: DoorId | null = useMemo(() => {
    
    if (exitPhase !== 'inactive') return 'exit';
    if (tour.status === 'active') {
      return (tour.steps[tour.stepIndex]?.doorId as DoorId | undefined) ?? null;
    }

    if (zoneId === 'gallery_1') return 'g1';
    if (zoneId === 'gallery_2') return 'g2';
    if (zoneId === 'gallery_3') return 'g3';
    if (zoneId === 'finale') return 'exit';

    const z = avatarPos.z;
    if (z < 10) return 'g1';
    if (z < 18) return 'g2';
    if (z < 26) return 'g3';
    return 'finale';
  }, [exitPhase, tour.status, tour.stepIndex, tour.steps, zoneId, avatarPos.z]);

  const showPlaqueAccent = tour.summaryAvailable && !tour.summaryViewed;

  const guideZ = useMemo(() => {
    const z = avatarPos.z;
    if (z < 6) return 6;
    if (z < 14) return 14;
    if (z < 22) return 22;
    if (z < 30) return 30;
    return 32;
  }, [avatarPos.z]);

  const guideList = useMemo(() => {
    return quality === 'high' ? guidePositionsZHigh : [guideZ];
  }, [quality, guideZ]);

  const isNearEntrance = avatarPos.z < 4;
  const isNearFinale = avatarPos.z > 24;
  const inFinale = zoneId === 'finale';
  const showFinaleKey = quality === 'high' || isNearFinale || inFinale;

  const cfg = useMemo(() => {
    if (quality === 'low') {
      return {
        
        ambient: 0.65,
        hemi: 0.95,
        guideZ: guideList,
        guideIntensity: 1.25,
        rhythmIntensity: 0,
        doorSlotIntensity: 0.22,
        doorBoost: 1.2,
        pausePoolIntensity: 0.0,
        attentionIntensity: 0.0,
        finaleKeyIntensity: 6.2,
        spineFillIntensity: 0.0,
        globalFillIntensity: 1.1,
        vestibuleKey: 2.2,
        shadows: false,
        slotBeats: 1,
        doorSlotsMode: 'active' as const,
        showRhythm: false,
        showPausePools: false,
        showGalleryFocus: false,
        showSpineFills: false,
        showFinaleEdges: false
      };
    }
    if (quality === 'high') {
      return {
        
        ambient: 0.65,
        hemi: 1.05,
        guideZ: guidePositionsZHigh,
        guideIntensity: 1.55,
        rhythmIntensity: 2.1,
        doorSlotIntensity: 0.3,
        doorBoost: 1.8,
        pausePoolIntensity: 0.8,
        attentionIntensity: 4.6,
        finaleKeyIntensity: 7.4,
        spineFillIntensity: 0.85,
        globalFillIntensity: 1.75,
        vestibuleKey: 2.9,
        shadows: true,
        slotBeats: 2,
        doorSlotsMode: 'all' as const,
        showRhythm: true,
        showPausePools: true,
        showGalleryFocus: true,
        showSpineFills: true,
        showFinaleEdges: true
      };
    }
    return {
      
      ambient: 0.60,
      hemi: 0.95,
      guideZ: guideList,
      guideIntensity: 1.35,
      rhythmIntensity: 0,
      doorSlotIntensity: 0.25,
      doorBoost: 1.35,
      pausePoolIntensity: 0.6,
      attentionIntensity: 0.0,
      finaleKeyIntensity: 6.6,
      spineFillIntensity: 0.0,
      globalFillIntensity: 0.0,
      vestibuleKey: 2.5,
      shadows: false,
      slotBeats: 1,
      doorSlotsMode: 'active' as const,
      showRhythm: false,
      showPausePools: true,
      showGalleryFocus: false,
      showSpineFills: false,
      showFinaleEdges: false
    };
  }, [quality, guideList]);

  const shouldBreathe = false;

  const doorSlotSpots = useMemo(() => {
    
    const make = (door: DoorSpec) => {
      const isTarget = activeDoor === door.id;
      const boost = isTarget ? cfg.doorBoost : tour.status === 'active' ? 0.7 : 0.55;
      const intensity = cfg.doorSlotIntensity * boost;

      const spots: Array<{
        id: string;
        pos: [number, number, number];
        target: [number, number, number];
        intensity: number;
        angle: number;
        distance: number;
        color: string;
        breathe: boolean;
      }> = [];

      if (door.kind === 'side') {
        const beats = cfg.slotBeats;
        const offsets = beats === 1 ? [0] : beats === 2 ? [-0.55, 0.55] : [-0.7, 0, 0.7];
        const slotX = door.xFace + door.spineDirX * SLOT_CENTER_OFFSET;
        const y = door.doorH + 0.14;
        for (let i = 0; i < offsets.length; i++) {
          const dz = offsets[i];
          spots.push({
            id: `slot-${door.id}-${i}`,
            pos: [slotX, y, door.z + dz],
            target: [door.xFace + door.spineDirX * 0.05, 0.6, door.z + dz],
            intensity: intensity * (i === 1 && beats === 3 ? 1.05 : 0.95),
            angle: 0.46,
            distance: isTarget ? 12 : 9,
            color: '#e7e0d3',
            breathe: shouldBreathe && isTarget
          });
        }
      } else {
        
        const beats = cfg.slotBeats;
        const offsets = beats === 1 ? [0] : beats === 2 ? [-0.95, 0.95] : [-1.15, 0, 1.15];
        const slotZ = door.zFace + door.spineDirZ * SLOT_CENTER_OFFSET;
        const y = door.doorH + 0.14;
        for (let i = 0; i < offsets.length; i++) {
          const dx = offsets[i];
          spots.push({
            id: `slot-${door.id}-${i}`,
            pos: [door.x + dx, y, slotZ],
            target: [door.x + dx, 0.7, door.zFace + door.spineDirZ * 0.02],
            intensity: intensity * (i === 1 && beats === 3 ? 1.08 : 0.95),
            angle: 0.5,
            distance: isTarget ? 14 : 10,
            color: '#f0e7d6',
            breathe: shouldBreathe && isTarget
          });
        }
      }

      return spots;
    };

    const doors = cfg.doorSlotsMode === 'all' ? DOORS : activeDoor ? DOORS.filter((d) => d.id === activeDoor) : [];
    return doors.flatMap((d) => make(d));
  }, [activeDoor, cfg.doorBoost, cfg.doorSlotIntensity, cfg.slotBeats, cfg.doorSlotsMode, shouldBreathe, tour.status]);

  const pauseTargets = useMemo(() => {
    if (!cfg.showPausePools) return [];
    const all = [
      { id: 'g1', pos: [-9.2, 2.35, 9.0] as [number, number, number] },
      { id: 'g2', pos: [9.2, 2.35, 16.0] as [number, number, number] },
      { id: 'g3', pos: [-9.2, 2.35, 24.0] as [number, number, number] }
    ];
    if (quality === 'high') return all;
    return activeDoor && activeDoor.startsWith('g') ? all.filter((p) => p.id === activeDoor) : [];
  }, [activeDoor, cfg.showPausePools, quality]);

  const focusedPlaque = useMemo(() => {
    if (!focusedExhibitId) return null;
    const exhibit = museumExhibits.find((e) => e.id === focusedExhibitId);
    if (!exhibit) return null;
    const rotY = exhibit.rotation?.[1] ?? 0;
    const offsetX = Math.sin(rotY) * 0.9;
    const offsetZ = Math.cos(rotY) * 0.9;
    return {
      pos: [exhibit.position[0] + offsetX, 1.75, exhibit.position[2] + offsetZ] as [number, number, number],
      target: [exhibit.position[0], 1.15, exhibit.position[2]] as [number, number, number]
    };
  }, [focusedExhibitId]);

  return (
    <>
      <ambientLight intensity={cfg.ambient} />
      <hemisphereLight intensity={cfg.hemi} />

      <directionalLight position={[-6, 8, 12]} intensity={0.72} color={'#ffffff'} />

      {isNearEntrance && (
        <TargetedSpotLight
          id="vestibule-key"
          position={[0, 2.25, -1.6]}
          target={[0, 0.6, 0.6]}
          angle={0.62}
          penumbra={0.9}
          intensity={cfg.vestibuleKey}
          distance={10}
          decay={2}
          color={'#d7e6ff'}
        />
      )}

      {cfg.guideZ.map((z) => (
        <TargetedSpotLight
          key={`guide-${z}`}
          id={`guide-${z}`}
          position={[0, 2.55, z]}
          target={[0, 0, z]}
          angle={0.8}
          penumbra={0.85}
          intensity={cfg.guideIntensity}
          distance={11}
          decay={2}
          color={'#d7dbe0'}
        />
      ))}

      {cfg.showRhythm &&
        RHYTHM_Z.map((z) => (
          <TargetedSpotLight
            key={`rhythm-${z}`}
            id={`rhythm-${z}`}
            position={[0, 2.78, z]}
            target={[0, 0, z]}
            angle={0.58}
            penumbra={0.86}
            intensity={cfg.rhythmIntensity}
            distance={12}
            decay={2}
            color={'#f1e5cf'}
          />
        ))}

      {cfg.globalFillIntensity > 0 && (
        <pointLight position={[0, 6.0, 18.0]} intensity={cfg.globalFillIntensity} distance={160} decay={2} color={'#d7e0ee'} />
      )}

      {cfg.showSpineFills &&
        [4, 12, 20, 28].map((z) => (
          <pointLight
            key={`spine-fill-${z}`}
            position={[0, 2.85, z]}
            intensity={cfg.spineFillIntensity}
            distance={22}
            decay={2}
            color={'#cfd6e1'}
          />
        ))}

      {doorSlotSpots.map((s) => (
        <TargetedSpotLight
          key={s.id}
          id={s.id}
          position={s.pos}
          target={s.target}
          angle={s.angle}
          penumbra={0.92}
          intensity={s.intensity}
          distance={s.distance}
          decay={2}
          color={s.color}
          castShadow={cfg.shadows}
          shadowMapSize={cfg.shadows ? 1536 : 1024}
          breathe={s.breathe}
        />
      ))}

      {exitPhase !== 'inactive' &&
        [38.2, 41.0, 43.6].map((z, i) => (
          <TargetedSpotLight
            key={`exit-guide-${i}`}
            id={`exit-guide-${i}`}
            position={[9.1, 2.55, z]}
            target={[9.1, 0.0, z]}
            angle={0.72}
            penumbra={0.9}
            intensity={cfg.guideIntensity * (0.85 - i * 0.08)}
            distance={9}
            decay={2}
            color={'#d9e6ff'}
          />
        ))}

      {pauseTargets.map((p) => {
        const isTarget = tour.status === 'active' && activeDoor === p.id;
        const base = cfg.pausePoolIntensity;
        const mul = tour.status !== 'active' ? 1 : isTarget ? 1.55 : 0.9;
        return (
          <TargetedSpotLight
            key={`pause-${p.id}`}
            id={`pause-${p.id}`}
            position={p.pos}
            target={[p.pos[0], 0.0, p.pos[2]]}
            angle={0.72}
            penumbra={0.95}
            intensity={base * mul}
            distance={10}
            decay={2}
            color={'#efe5d6'}
          />
        );
      })}

      {focusedPlaque && (
        <TargetedSpotLight
          id="plaque-focus"
          position={focusedPlaque.pos}
          target={focusedPlaque.target}
          angle={0.48}
          penumbra={0.92}
          intensity={quality === 'high' ? 1.8 : 1.1}
          distance={8}
          decay={2}
          color={'#f1eadf'}
        />
      )}

      {showPlaqueAccent && (
        <pointLight
          position={[FINALE_PLAQUE_POS[0], FINALE_PLAQUE_POS[1] + 1.1, FINALE_PLAQUE_POS[2] - 0.6]}
          intensity={0.8}
          distance={6}
          decay={2}
          color={'#efe5d6'}
        />
      )}

      {cfg.showGalleryFocus && (
        <>
          <TargetedSpotLight
            id="att-g1"
            position={[-8.5, 2.55, 9.0]}
            target={[-11.0, 1.3, 9.0]}
            angle={0.28}
            penumbra={0.7}
            intensity={cfg.attentionIntensity}
            distance={14}
            decay={2}
            color={'#f7f2e6'}
          />
          <TargetedSpotLight
            id="att-g2"
            position={[8.5, 2.55, 16.0]}
            target={[11.0, 1.3, 16.0]}
            angle={0.28}
            penumbra={0.7}
            intensity={cfg.attentionIntensity}
            distance={14}
            decay={2}
            color={'#f7f2e6'}
          />
          <TargetedSpotLight
            id="att-g3"
            position={[-8.5, 2.55, 24.0]}
            target={[-11.0, 1.3, 24.0]}
            angle={0.28}
            penumbra={0.7}
            intensity={cfg.attentionIntensity}
            distance={14}
            decay={2}
            color={'#f7f2e6'}
          />
        </>
      )}

      {showFinaleKey && (
        <>
          <TargetedSpotLight
            id="finale-key"
            position={[0, 3.9, 38]}
            target={[0, 0.0, 38]}
            angle={0.6}
            penumbra={0.85}
            intensity={cfg.finaleKeyIntensity * (tour.status === 'active' && activeDoor === 'finale' ? 1.12 : 1)}
            distance={22}
            decay={2}
            color={'#f4f0e6'}
            castShadow={cfg.shadows}
            shadowMapSize={cfg.shadows ? 2048 : 1024}
          />
          <pointLight position={[0, 4.2, 35.0]} intensity={1.2} distance={18} decay={2} color={'#d8dde6'} />
          <pointLight position={[0, 4.2, 42.0]} intensity={1.2} distance={18} decay={2} color={'#d8dde6'} />
        </>
      )}

      {cfg.showFinaleEdges &&
        [
          [-6.2, 1.4, 34.0],
          [6.2, 1.4, 34.0],
          [-6.2, 1.4, 44.0],
          [6.2, 1.4, 44.0]
        ].map((p, i) => (
          <TargetedSpotLight
            key={`finale-edge-${i}`}
            id={`finale-edge-${i}`}
            position={[p[0], 2.55, p[2]] as [number, number, number]}
            target={[p[0], 0.0, p[2]] as [number, number, number]}
            angle={0.55}
            penumbra={0.92}
            intensity={clamp01(0.55)}
            distance={12}
            decay={2}
            color={'#cfd6e1'}
          />
        ))}
    </>
  );
};
