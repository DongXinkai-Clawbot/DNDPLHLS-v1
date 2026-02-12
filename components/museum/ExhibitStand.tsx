import React, { Suspense, useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { RoundedBox, useGLTF } from '@react-three/drei';
import { Exhibit } from '../../data/museumExhibits';
import { useMuseumStore } from '../../store/museumStore';
import { museumMaterial } from './materials';

interface ExhibitStandProps {
  exhibit: Exhibit;
}

const StandModel = ({ url, transform }: { url: string; transform?: Exhibit['assets']['modelTransform'] }) => {
  const gltf = useGLTF(url) as any;
  const pos = transform?.position ?? ([0, 1.15, 0] as [number, number, number]);
  const rot = transform?.rotation ?? ([0, 0, 0] as [number, number, number]);
  const scale = transform?.scale ?? 0.75;

  return (
    <group position={pos} rotation={rot} scale={scale as any}>
      <primitive object={gltf.scene} />
    </group>
  );
};

export const ExhibitStand = ({ exhibit }: ExhibitStandProps) => {
  const setFocusedExhibitId = useMuseumStore((state) => state.setFocusedExhibitId);
  const setActiveExhibitId = useMuseumStore((state) => state.setActiveExhibitId);
  const activeExhibitId = useMuseumStore((state) => state.activeExhibitId);
  const focusedExhibitId = useMuseumStore((state) => state.focusedExhibitId);

  const standSeed = `stand:${exhibit.id}`;

  const ceramic = museumMaterial('artifactCeramic', standSeed);
  const gap = museumMaterial('shadowGap', standSeed);
  const plaque = museumMaterial('artifactPlaque', standSeed);
  const plaqueFrame = museumMaterial('artifactPlaqueFrame', standSeed);
  const fastener = museumMaterial('artifactFastener', standSeed);
  const foot = museumMaterial('artifactFoot', standSeed);
  const inlay = museumMaterial('inlay', standSeed);

  const sizeScale = exhibit.standSize === 's' ? 0.85 : exhibit.standSize === 'l' ? 1.15 : 1;

  const dims = {
    footprintX: 2.28 * sizeScale,
    footprintZ: 1.68 * sizeScale,
    baseH: 0.12 * sizeScale,

    bodyX: 2.08 * sizeScale,
    bodyZ: 1.48 * sizeScale,
    bodyH: 1.46 * sizeScale,

    gapH: 0.016,

    capH: 0.08 * sizeScale,
    capOverhang: 0.05 * sizeScale,

    cornerRadius: 0.055 * sizeScale
  } as const;

  const totalH = dims.baseH + dims.bodyH + dims.gapH + dims.capH;

  const handleEnter = (payload: any) => {
    const obj = payload?.other?.rigidBodyObject;
    const isPlayer = obj?.userData?.type === 'player' || obj?.name === 'player';
    if (!isPlayer) return;
    setFocusedExhibitId(exhibit.id);
  };

  const handleExit = (payload: any) => {
    const obj = payload?.other?.rigidBodyObject;
    const isPlayer = obj?.userData?.type === 'player' || obj?.name === 'player';
    if (!isPlayer) return;
    if (focusedExhibitId === exhibit.id) setFocusedExhibitId(null);
    if (activeExhibitId === exhibit.id) setActiveExhibitId(null);
  };

  const footPads = useMemo(() => {
    const padX = 0.16;
    const padZ = 0.16;
    const padH = 0.02;

    const insetX = 0.18;
    const insetZ = 0.18;
    const x = dims.footprintX / 2 - insetX;
    const z = dims.footprintZ / 2 - insetZ;

    return {
      size: [padX, padH, padZ] as [number, number, number],
      y: padH / 2,
      positions: [
        [x, padH / 2, z],
        [-x, padH / 2, z],
        [x, padH / 2, -z],
        [-x, padH / 2, -z]
      ] as [number, number, number][]
    };
  }, [dims.footprintX, dims.footprintZ]);

  return (
    <group position={exhibit.position} rotation={exhibit.rotation}>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, 0.004, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.footprintX - 0.06, 0.008, dims.footprintZ - 0.06]} />
          <meshStandardMaterial color={gap.color} roughness={gap.roughness} metalness={gap.metalness} />
        </mesh>

        {footPads.positions.map((p, i) => (
          <mesh key={`foot-${i}`} position={p} castShadow receiveShadow>
            <boxGeometry args={footPads.size} />
            <meshStandardMaterial color={foot.color} roughness={foot.roughness} metalness={foot.metalness} />
          </mesh>
        ))}

        <mesh position={[0, 0.012, dims.footprintZ / 2 + 0.55 * sizeScale]} receiveShadow>
          <boxGeometry args={[dims.bodyX * 0.78, 0.02, 0.06]} />
          <meshStandardMaterial color={inlay.color} roughness={inlay.roughness} metalness={inlay.metalness} />
        </mesh>

        <mesh position={[0, dims.baseH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.footprintX, dims.baseH, dims.footprintZ]} />
          <meshStandardMaterial
            color={ceramic.color}
            roughness={Math.min(1, ceramic.roughness + 0.03)}
            metalness={ceramic.metalness}
          />
        </mesh>

        <RoundedBox
          args={[dims.bodyX, dims.bodyH, dims.bodyZ]}
          radius={dims.cornerRadius}
          smoothness={4}
          position={[0, dims.baseH + dims.bodyH / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={ceramic.color} roughness={ceramic.roughness} metalness={ceramic.metalness} />
        </RoundedBox>

        <mesh position={[0, dims.baseH + dims.bodyH + dims.gapH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[dims.bodyX + 0.01, dims.gapH, dims.bodyZ + 0.01]} />
          <meshStandardMaterial color={gap.color} roughness={gap.roughness} metalness={gap.metalness} />
        </mesh>

        <RoundedBox
          args={[dims.bodyX + dims.capOverhang * 2, dims.capH, dims.bodyZ + dims.capOverhang * 2]}
          radius={Math.max(0.02, dims.cornerRadius * 0.55)}
          smoothness={4}
          position={[0, dims.baseH + dims.bodyH + dims.gapH + dims.capH / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={ceramic.color}
            roughness={Math.min(1, ceramic.roughness + 0.02)}
            metalness={Math.max(0, ceramic.metalness - 0.01)}
          />
        </RoundedBox>

        <group position={[0, dims.baseH + dims.bodyH * 0.62, dims.bodyZ / 2 - 0.012]}>
          <mesh castShadow receiveShadow position={[0, 0, -0.008]}>
            <boxGeometry args={[dims.bodyX * 0.66, dims.bodyH * 0.22, 0.012]} />
            <meshStandardMaterial color={gap.color} roughness={gap.roughness} metalness={gap.metalness} />
          </mesh>

          <RoundedBox
            args={[dims.bodyX * 0.64, dims.bodyH * 0.20, 0.012]}
            radius={0.02}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={plaqueFrame.color}
              roughness={plaqueFrame.roughness}
              metalness={plaqueFrame.metalness}
            />
          </RoundedBox>

          <RoundedBox
            args={[dims.bodyX * 0.60, dims.bodyH * 0.17, 0.010]}
            radius={0.018}
            smoothness={4}
            position={[0, 0, 0.002]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color={plaque.color} roughness={plaque.roughness} metalness={plaque.metalness} />
          </RoundedBox>

          {(() => {
            const w = dims.bodyX * 0.60;
            const h = dims.bodyH * 0.17;
            const x = w / 2 - 0.045;
            const y = h / 2 - 0.028;
            const r = 0.008;
            const depth = 0.006;
            const z = 0.008;
            const pts: [number, number, number][] = [
              [x, y, z],
              [-x, y, z],
              [x, -y, z],
              [-x, -y, z]
            ];
            return pts.map((p, i) => (
              <mesh key={`screw-${i}`} position={p} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[r, r, depth, 16]} />
                <meshStandardMaterial color={fastener.color} roughness={fastener.roughness} metalness={fastener.metalness} />
              </mesh>
            ));
          })()}
        </group>

        <CuboidCollider args={[dims.footprintX / 2, totalH / 2, dims.footprintZ / 2]} position={[0, totalH / 2, 0]} />
      </RigidBody>

      {exhibit.assets.modelUrl && (
        <Suspense fallback={null}>
          <StandModel url={exhibit.assets.modelUrl} transform={exhibit.assets.modelTransform} />
        </Suspense>
      )}

      <CuboidCollider
        args={[1.6, 1.25, 1.6]}
        position={[0, 1.02, 0]}
        sensor
        onIntersectionEnter={handleEnter}
        onIntersectionExit={handleExit}
      />

    </group>
  );
};
