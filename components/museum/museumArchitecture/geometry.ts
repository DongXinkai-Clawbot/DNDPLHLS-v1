import { BoxGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MuseumMaterialKey } from '../materials';
import type { Box } from './types';

export const groupByMaterial = <T extends { material: MuseumMaterialKey }>(
  items: T[]
): Map<MuseumMaterialKey, T[]> => {
  const m = new Map<MuseumMaterialKey, T[]>();
  for (const it of items) {
    const arr = m.get(it.material);
    if (arr) arr.push(it);
    else m.set(it.material, [it]);
  }
  return m;
};

export const mergeBoxGeometries = (items: { box: Box }[]) => {
  const geometries = items.map(({ box }) => {
    const g = new BoxGeometry(box.size[0], box.size[1], box.size[2]);
    g.translate(box.position[0], box.position[1], box.position[2]);
    return g;
  });
  const merged = mergeGeometries(geometries, false);

  if (merged && (merged as any).attributes?.uv && !(merged as any).attributes?.uv2) {
    (merged as any).setAttribute('uv2', (merged as any).attributes.uv);
  }

  for (const g of geometries) g.dispose();
  return merged;
};
