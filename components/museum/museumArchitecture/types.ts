import type { MuseumMaterialKey } from '../materials';

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Box = { size: [number, number, number]; position: [number, number, number] };

export type Solid = { id: string; box: Box; material: MuseumMaterialKey; collider: boolean };
export type Decal = { id: string; box: Box; material: MuseumMaterialKey; rotation?: [number, number, number] };

export type PauseNode = {
  id: string;
  collider: Box;
  visual: {
    kind: 'bench' | 'rail';
    position: [number, number, number];
    rotationY: number;
    length: number;
    depth: number;
    height: number;
  };
};

export type MuseumLayout = {
  floors: Array<{ id: string; box: Box; material: MuseumMaterialKey }>;
  walls: Array<{ id: string; box: Box; height: number; material: MuseumMaterialKey }>;
  solids: Solid[];
  decals: Decal[];
  ceilings: Array<{ id: string; box: Box; material: MuseumMaterialKey }>;
  pauses: PauseNode[];
};
