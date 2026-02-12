import React, { useEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { RoundedBox } from '@react-three/drei';
import {
  InstancedMesh,
  Object3D,
  TextureLoader,
  NoColorSpace,
  LinearFilter,
  LinearMipmapLinearFilter,
  ClampToEdgeWrapping
} from 'three';
import { museumMaterial, type MuseumMaterialKey, shouldMicroDetail, microDetailOnBeforeCompile } from './materials';
import { useMuseumStore } from '../../store/museumStore';
import { buildMuseumLayout } from './museumArchitecture/layout';
import { groupByMaterial, mergeBoxGeometries } from './museumArchitecture/geometry';
import type { Decal } from './museumArchitecture/types';
import { createLogger } from '../../utils/logger';

export const MuseumArchitecture = () => {
  const log = createLogger('museum/architecture');
  const quality = useMuseumStore((s) => s.graphics.quality);

  const lmWall = useLoader(TextureLoader, '/lightmaps/wall_lm.png');
  const aoWall = useLoader(TextureLoader, '/lightmaps/wall_ao.png');
  const lmFloor = useLoader(TextureLoader, '/lightmaps/floor_lm.png');
  const aoFloor = useLoader(TextureLoader, '/lightmaps/floor_ao.png');
  const lmFinale = useLoader(TextureLoader, '/lightmaps/finale_lm.png');
  const aoFinale = useLoader(TextureLoader, '/lightmaps/finale_ao.png');
  const configureBakedMap = (t: any) => {
    if (!t) return;
    
    if (t.image && t.image.width <= 2 && t.image.height <= 2) {
      if (import.meta.env.DEV) {
        log.warn('1x1 lightmap detected and ignored', t.source?.data?.currentSrc);
      }
      return;
    }

    if ('colorSpace' in t) t.colorSpace = NoColorSpace;
    if ('encoding' in t) t.encoding = 3000; 
    t.flipY = false;
    t.wrapS = ClampToEdgeWrapping;
    t.wrapT = ClampToEdgeWrapping;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  };

  const lightmaps = useMemo(() => {
    
    const enabled = quality !== 'low';
    if (!enabled) return { wall: null, floor: null, finale: null, wallAO: null, floorAO: null, finaleAO: null } as const;
    
    configureBakedMap(lmWall);
    configureBakedMap(lmFloor);
    configureBakedMap(lmFinale);
    configureBakedMap(aoWall);
    configureBakedMap(aoFloor);
    configureBakedMap(aoFinale);

    const isValid = (t: any) => t && t.image && (t.image.width > 2 || t.image.height > 2);

    return {
      wall: isValid(lmWall) ? lmWall : null,
      floor: isValid(lmFloor) ? lmFloor : null,
      finale: isValid(lmFinale) ? lmFinale : null,
      wallAO: isValid(aoWall) ? aoWall : null,
      floorAO: isValid(aoFloor) ? aoFloor : null,
      finaleAO: isValid(aoFinale) ? aoFinale : null
    } as const;
  }, [quality, lmWall, lmFloor, lmFinale, aoWall, aoFloor, aoFinale]);

  const layout = useMemo(() => {
    const result = buildMuseumLayout();

    configureBakedMap(lmWall);
    configureBakedMap(lmFloor);
    configureBakedMap(lmFinale);
    configureBakedMap(aoWall);
    configureBakedMap(aoFloor);
    configureBakedMap(aoFinale);

    return result;
  }, []);

  const mergedFloors = useMemo(() => {
    const byMat = groupByMaterial(layout.floors);
    const out: { material: MuseumMaterialKey; geometry: any }[] = [];
    for (const [material, items] of byMat) {
      out.push({ material, geometry: mergeBoxGeometries(items) });
    }
    return out;
  }, [layout.floors]);

  const mergedWalls = useMemo(() => {
    const byMat = groupByMaterial(layout.walls);
    const out: { material: MuseumMaterialKey; geometry: any }[] = [];
    for (const [material, items] of byMat) {
      out.push({ material, geometry: mergeBoxGeometries(items) });
    }
    return out;
  }, [layout.walls]);

  const bevelSolids = useMemo(() => {
    
    const isBevelTarget = (id: string) =>
      id.startsWith('portal-') && (id.endsWith('jamb-a') || id.endsWith('jamb-b') || id.endsWith('header'));
    return layout.solids.filter((s) => isBevelTarget(s.id));
  }, [layout.solids]);

  const mergedSolidsWithoutBevel = useMemo(() => {
    const bevelIds = new Set(bevelSolids.map((s) => s.id));
    const rest = layout.solids.filter((s) => !bevelIds.has(s.id));
    const byMat = groupByMaterial(rest);
    return Array.from(byMat.entries()).map(([material, items]) => ({
      material,
      geometry: mergeBoxGeometries(items)
    }));
  }, [layout.solids, bevelSolids]);

  const renderMaterial = (material: MuseumMaterialKey, id: string) => {
    const m = museumMaterial(material, id);

    const ao =
      material === 'floorFinale'
        ? lightmaps.finaleAO
        : material.startsWith('floor')
          ? lightmaps.floorAO
          : material.startsWith('wall')
            ? lightmaps.wallAO
            : null;

    const lm =
      material === 'floorFinale'
        ? lightmaps.finale
        : material.startsWith('floor')
          ? lightmaps.floor
          : material.startsWith('wall')
            ? lightmaps.wall
            : null;

    return (
      <meshStandardMaterial
        color={m.color}
        roughness={m.roughness}
        metalness={m.metalness}
        emissive={m.emissive}
        emissiveIntensity={m.emissiveIntensity}
        lightMap={lm as any}
        lightMapIntensity={!lm ? 1.0 : material.startsWith('floor') ? 0.72 : 0.86}
        aoMap={ao as any}
        aoMapIntensity={ao ? 0.92 : 1.0}
        onBeforeCompile={
          shouldMicroDetail(material)
            ? microDetailOnBeforeCompile(quality)
            : undefined
        }
        customProgramCacheKey={() => `md-${quality}-${material}`}
      />
    );
  };

  const DecalInstances = ({ material, decals }: { material: MuseumMaterialKey; decals: Decal[] }) => {
    const ref = useRef<InstancedMesh>(null);
    const count = decals.length;

    useEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const temp = new Object3D();
      for (let i = 0; i < count; i++) {
        const d = decals[i];
        temp.position.set(d.box.position[0], d.box.position[1], d.box.position[2]);
        const r = d.rotation ?? [0, 0, 0];
        temp.rotation.set(r[0], r[1], r[2]);
        temp.scale.set(d.box.size[0], d.box.size[1], d.box.size[2]);
        temp.updateMatrix();
        mesh.setMatrixAt(i, temp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }, [count, decals]);

    return (
      <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        {renderMaterial(material, `decals-${material}`)}
      </instancedMesh>
    );
  };

  const Rail = ({
    id,
    position,
    rotationY,
    length,
    depth,
    height
  }: {
    id: string;
    position: [number, number, number];
    rotationY: number;
    length: number;
    depth: number;
    height: number;
  }) => {
    
    const baseH = 0.55;
    const capH = 0.06;
    const capY = baseH + capH / 2;
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh castShadow receiveShadow position={[0, baseH / 2, 0]}>
          <boxGeometry args={[length, baseH, depth]} />
          {renderMaterial('bench', `${id}-base`)}
        </mesh>
        <mesh castShadow receiveShadow position={[0, capY, 0]}>
          <boxGeometry args={[length * 0.92, capH, depth * 0.82]} />
          {renderMaterial('bench', `${id}-cap`)}
        </mesh>
        <mesh castShadow receiveShadow position={[0, baseH * 0.55, -depth * 0.34]}>
          <boxGeometry args={[length * 0.88, baseH * 0.65, 0.06]} />
          {renderMaterial('bench', `${id}-fin`)}
        </mesh>
      </group>
    );
  };

  const Bench = ({
    id,
    position,
    rotationY,
    length,
    depth,
    height
  }: {
    id: string;
    position: [number, number, number];
    rotationY: number;
    length: number;
    depth: number;
    height: number;
  }) => {
    const seatT = 0.08;
    const legW = 0.12;
    const legD = 0.12;
    const legH = Math.max(0.18, height - seatT);
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh castShadow receiveShadow position={[0, legH + seatT / 2, 0]}>
          <RoundedBox args={[length, seatT, depth]} radius={0.03} smoothness={2} />
          {renderMaterial('bench', `${id}-seat`)}
        </mesh>

        <mesh castShadow receiveShadow position={[-length / 2 + legW / 2 + 0.12, legH / 2, 0]}>
          <boxGeometry args={[legW, legH, legD]} />
          {renderMaterial('bench', `${id}-leg-a`)}
        </mesh>
        <mesh castShadow receiveShadow position={[length / 2 - legW / 2 - 0.12, legH / 2, 0]}>
          <boxGeometry args={[legW, legH, legD]} />
          {renderMaterial('bench', `${id}-leg-b`)}
        </mesh>

        <mesh castShadow receiveShadow position={[0, legH + 0.18, -depth * 0.42]}>
          <RoundedBox args={[length * 0.92, 0.32, 0.06]} radius={0.02} smoothness={2} />
          {renderMaterial('bench', `${id}-back`)}
        </mesh>
      </group>
    );
  };

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        {mergedFloors.map(({ material, geometry }) => (
          <mesh key={`floor-${material}`} receiveShadow geometry={geometry}>
            {renderMaterial(material, `floor-${material}`)}
          </mesh>
        ))}
        {layout.floors.map(({ id, box }) => (
          <CuboidCollider
            key={`floor-col-${id}`}
            args={[box.size[0] / 2, box.size[1] / 2, box.size[2] / 2]}
            position={box.position}
          />
        ))}
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {mergedWalls.map(({ material, geometry }) => (
          <mesh key={`wall-${material}`} receiveShadow geometry={geometry}>
            {renderMaterial(material, `wall-${material}`)}
          </mesh>
        ))}
        {layout.walls.map(({ id, box }) => (
          <CuboidCollider
            key={`wall-col-${id}`}
            args={[box.size[0] / 2, box.size[1] / 2, box.size[2] / 2]}
            position={box.position}
          />
        ))}
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {mergedSolidsWithoutBevel.map(({ material, geometry }) => (
          <mesh key={`solid-${material}`} receiveShadow geometry={geometry}>
            {renderMaterial(material, `solid-${material}`)}
          </mesh>
        ))}
        {bevelSolids.map((s) => (
          <RoundedBox
            key={`bevel-${s.id}`}
            args={[s.box.size[0], s.box.size[1], s.box.size[2]]}
            radius={0.02}
            smoothness={4}
            position={s.box.position}
            castShadow
            receiveShadow
          >
            {renderMaterial(s.material, s.id)}
          </RoundedBox>
        ))}
        {layout.solids.map(({ id, box, collider }) =>
          collider ? (
            <CuboidCollider
              key={`solid-col-${id}`}
              args={[box.size[0] / 2, box.size[1] / 2, box.size[2] / 2]}
              position={box.position}
            />
          ) : null
        )}
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        {layout.pauses.map((p) => (
          <group key={p.id}>
            <CuboidCollider
              args={[p.collider.size[0] / 2, p.collider.size[1] / 2, p.collider.size[2] / 2]}
              position={p.collider.position}
            />
          </group>
        ))}
      </RigidBody>

      {layout.pauses.map((p) => (
        <group key={`${p.id}-visual`}>
          {p.visual.kind === 'rail' ? (
            <Rail
              id={p.id}
              position={p.visual.position}
              rotationY={p.visual.rotationY}
              length={p.visual.length}
              depth={p.visual.depth}
              height={p.visual.height}
            />
          ) : (
            <Bench
              id={p.id}
              position={p.visual.position}
              rotationY={p.visual.rotationY}
              length={p.visual.length}
              depth={p.visual.depth}
              height={p.visual.height}
            />
          )}
        </group>
      ))}

      {(() => {
        const byMaterial = new Map<MuseumMaterialKey, Decal[]>();
        for (const d of layout.decals) {
          const list = byMaterial.get(d.material) ?? [];
          list.push(d);
          byMaterial.set(d.material, list);
        }
        return Array.from(byMaterial.entries()).map(([material, decals]) => (
          <DecalInstances key={`decals-${material}`} material={material} decals={decals} />
        ));
      })()}

      {layout.ceilings.map((c) => (
        <mesh key={c.id} position={c.box.position} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[c.box.size[0], c.box.size[2]]} />
          {renderMaterial(c.material, c.id)}
        </mesh>
      ))}
    </group>
  );
};
