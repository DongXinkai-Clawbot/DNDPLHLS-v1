import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useMuseumStore } from '../../store/museumStore';
import { museumMaterial } from './materials';

export const MuseumEntryPlaque = () => {
  const hasPointerLocked = useMuseumStore((s) => s.ui.hasPointerLocked);
  const menu = useMuseumStore((s) => s.ui.menu);
  const activeExhibitId = useMuseumStore((s) => s.activeExhibitId);

  const visible = !hasPointerLocked && menu === 'none' && !activeExhibitId;

  const plaqueMat = useMemo(() => museumMaterial('wallAccent', 'entry-plaque-body'), []);
  const baseMat = useMemo(() => museumMaterial('baseboard', 'entry-plaque-base'), []);
  const panelMat = useMemo(() => museumMaterial('wallPlaster', 'entry-plaque-panel'), []);

  return (
    <group position={[0, 1.05, -1.6]} rotation={[0, Math.PI, 0]} visible={visible}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, -0.66, 0.05]} castShadow receiveShadow>
          <boxGeometry args={[0.88, 0.16, 0.46]} />
          <meshStandardMaterial color={baseMat.color} roughness={baseMat.roughness} metalness={baseMat.metalness} />
        </mesh>
        <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 1.0, 0.12]} />
          <meshStandardMaterial color={plaqueMat.color} roughness={plaqueMat.roughness} metalness={plaqueMat.metalness} />
        </mesh>
        <mesh position={[0, -0.12, 0.07]} receiveShadow>
          <boxGeometry args={[0.68, 0.86, 0.02]} />
          <meshStandardMaterial color={panelMat.color} roughness={panelMat.roughness} metalness={panelMat.metalness} />
        </mesh>
      </RigidBody>

      <Html transform position={[0, -0.12, 0.082]} distanceFactor={1.05} occlude={false}>
        <div
          style={{
            width: 260,
            borderRadius: 12,
            background: 'rgba(8, 10, 14, 0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '10px 12px',
            color: 'rgba(255,255,255,0.92)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial',
            lineHeight: 1.3
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: 0.8, fontWeight: 700, opacity: 0.9 }}>
            MICROTONALITY MUSEUM
          </div>
          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>Click to enter viewing mode.</div>
          <div style={{ marginTop: 4, fontSize: 11, opacity: 0.8 }}>Press Esc to release the cursor.</div>
          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.72 }}>Press T when ready for the guided tour.</div>
        </div>
      </Html>
    </group>
  );
};
