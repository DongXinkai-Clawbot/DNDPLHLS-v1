import React, { useEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, Matrix4, Object3D } from 'three';
import { useMuseumStore } from '../../store/museumStore';
import { useExitRitualStore } from './exitRitualStore';

const emissiveNeutral = new Color('#d7d1c6');
const emissiveWarm = new Color('#f4e6c1');

export const MuseumWayfinding = () => {
  const tour = useMuseumStore((s) => s.tour);
  const exitPhase = useExitRitualStore((s) => s.phase);
  const activeDoor = useMemo(() => {
    if (exitPhase !== 'inactive') return 'exit';
    if (tour.status !== 'active') return null;
    return tour.steps[tour.stepIndex]?.doorId ?? null;
  }, [exitPhase, tour.status, tour.stepIndex, tour.steps]);

  const nodes = useMemo(() => {
    
    const strip = {
      x: 0,
      y: 0.006,
      width: 0.14,
      segLen: 3.6,
      gap: 0.4,
      zStart: 0.8,
      zEnd: 31.2
    };

    const makeStripSegmentPositions = () => {
      const segs: Array<[number, number, number]> = [];
      const step = strip.segLen + strip.gap;
      for (let z = strip.zStart; z < strip.zEnd; z += step) {
        const center = z + strip.segLen / 2;
        segs.push([strip.x, strip.y, center]);
      }
      return segs;
    };

    const ticks = [
      { id: 'tick-g1', doorId: 'g1', pos: [-1.15, 0.012, 8.0] as [number, number, number], warm: false },
      { id: 'tick-g2', doorId: 'g2', pos: [1.15, 0.012, 16.0] as [number, number, number], warm: false },
      { id: 'tick-g3', doorId: 'g3', pos: [-1.15, 0.012, 24.0] as [number, number, number], warm: false },
      { id: 'tick-finale', doorId: 'finale', pos: [0.0, 0.012, 32.0] as [number, number, number], warm: true }
    ];

    const plaques = [
      { id: 'g1', pos: [-0.9, 0.0, 8.0] as [number, number, number], rotY: 0 },
      { id: 'g2', pos: [0.9, 0.0, 16.0] as [number, number, number], rotY: 0 },
      { id: 'g3', pos: [-0.9, 0.0, 24.0] as [number, number, number], rotY: 0 },
      { id: 'finale', pos: [0.9, 0.0, 32.0] as [number, number, number], rotY: 0 },
      { id: 'exit', pos: [5.9, 0.0, 40.5] as [number, number, number], rotY: -Math.PI / 2 }
    ];

    const finaleBeacon = { pos: [0, 0.05, 38] as [number, number, number] };

    return {
      strip,
      stripSegmentPositions: makeStripSegmentPositions(),
      ticks,
      plaques,
      finaleBeacon
    };
  }, []);

  const stripBaseRef = useRef<InstancedMesh>(null);

  const stripRotX = useMemo(() => {
    const m = new Matrix4();
    m.makeRotationX(-Math.PI / 2);
    return m;
  }, []);

  useEffect(() => {
        const base = stripBaseRef.current;
    if (!base) return;

    const tmp = new Object3D();
    const tmpM = new Matrix4();

    nodes.stripSegmentPositions.forEach((pos, i) => {
      tmp.position.set(pos[0], pos[1], pos[2]);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();

      tmpM.copy(stripRotX).multiply(tmp.matrix);
      base.setMatrixAt(i, tmpM);
    });

    base.instanceMatrix.needsUpdate = true;
  }, [nodes.stripSegmentPositions, stripRotX]);

  return (
    <group>
      <instancedMesh ref={stripBaseRef} args={[undefined, undefined, nodes.stripSegmentPositions.length]}>
        <boxGeometry args={[nodes.strip.width, 0.012, nodes.strip.segLen]} />
        <meshStandardMaterial color={'#2f353d'} roughness={0.98} metalness={0.02} />
      </instancedMesh>

      {nodes.ticks.map((t) => {
        const w =
          t.id === 'tick-finale'
            ? 2.2
            : tour.status === 'active' && activeDoor === t.doorId
              ? 1.84
              : 1.6;

        const isTarget = tour.status === 'active' && activeDoor === t.doorId;
        const baseGlow = t.warm ? 0.12 : 0.08;
        const glow = tour.status !== 'active' ? baseGlow : baseGlow * (isTarget ? 1.85 : 0.8);

        return (
          <group key={t.id} position={t.pos} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh>
              <planeGeometry args={[w, 0.18]} />
              <meshStandardMaterial color={'#3b424c'} roughness={0.95} metalness={0.04} />
            </mesh>
            <mesh position={[0, 0.001, 0]}>
              <planeGeometry args={[w * 0.92, 0.045]} />
              <meshStandardMaterial
                color={'#2a2f36'}
                emissive={t.warm ? emissiveWarm : emissiveNeutral}
                roughness={1}
                metalness={0}
                transparent
                opacity={isTarget ? 0.85 : 0.55}
              />
            </mesh>
          </group>
        );
      })}

      {nodes.plaques.map((p) => {
        const isTarget = (tour.status === 'active' && activeDoor === p.id) || (exitPhase !== 'inactive' && p.id === 'exit');
        const glow = isTarget ? 0.55 : 0.06;
        return (
          <group key={`plaque-${p.id}`} position={p.pos} rotation={[0, p.rotY, 0]}>
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.28, 0.16, 0.12]} />
              <meshStandardMaterial color={'#2f353d'} roughness={0.9} metalness={0.08} />
            </mesh>
            <mesh position={[0, 0.32, -0.04]} castShadow receiveShadow>
              <boxGeometry args={[0.22, 0.34, 0.04]} />
              <meshStandardMaterial color={'#3a424c'} roughness={0.88} metalness={0.06} />
            </mesh>
            <mesh position={[0, 0.32, -0.018]}>
              <boxGeometry args={[0.16, 0.12, 0.01]} />
              <meshStandardMaterial
                color={'#2a2f36'}
                emissive={emissiveWarm}
                emissiveIntensity={glow}
                roughness={0.9}
                metalness={0.02}
              />
            </mesh>
          </group>
        );
      })}

      <mesh position={nodes.finaleBeacon.pos} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.45, 0.55, 48]} />
        <meshStandardMaterial
          color={'#3b424c'}
          emissive={emissiveWarm}
          emissiveIntensity={0.16}
          roughness={0.95}
          metalness={0.04}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
};
