import type { MuseumMaterialKey } from '../materials';
import type { Bounds, Box, Decal, MuseumLayout, PauseNode, Solid } from './types';

const WALL_THICKNESS = 0.22;
const FLOOR_THICKNESS = 0.18;

const BASEBOARD_H = 0.14;
const BASEBOARD_T = 0.06;
const BASEBOARD_MATERIAL: MuseumMaterialKey = 'stoneTrim';

const DOOR_CLEAR_H_SPINE = 2.45;
const DOOR_CLEAR_H_GALLERY = 2.35;
const DOOR_CLEAR_H_EXIT = 2.3;

const FRAME_DEPTH = 0.34;
const FRAME_THICK = 0.18;
const HEADER_H = 0.22;

const RETURN_DEPTH = 0.6;
const SLOT_H = 0.12;
const SLOT_D = 0.18;

const SLOT_CENTER_OFFSET = FRAME_DEPTH / 2 + SLOT_D / 2 - 0.02;

const boundsToFloor = (bounds: Bounds, y = 0): Box => {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  return {
    size: [w, FLOOR_THICKNESS, d],
    position: [(bounds.minX + bounds.maxX) / 2, y - FLOOR_THICKNESS / 2, (bounds.minZ + bounds.maxZ) / 2]
  };
};

const wallSegment = (size: [number, number, number], position: [number, number, number]): Box => {
  return { size, position };
};

export const buildMuseumLayout = (): MuseumLayout => {
  
  const vestibule: Bounds = { minX: -1.6, maxX: 1.6, minZ: -3, maxZ: 0 };
  const spine: Bounds = { minX: -2.0, maxX: 2.0, minZ: 0, maxZ: 32 };

  const g1: Bounds = { minX: -12, maxX: -2, minZ: 4, maxZ: 14 };
  const g2: Bounds = { minX: 2, maxX: 12, minZ: 12, maxZ: 22 };
  const g3: Bounds = { minX: -12, maxX: -2, minZ: 20, maxZ: 30 };

  const finale: Bounds = { minX: -7, maxX: 7, minZ: 32, maxZ: 45 };
  const exit: Bounds = { minX: 7, maxX: 11, minZ: 36, maxZ: 45 };

  const floors: Array<{ id: string; box: Box; material: MuseumMaterialKey }> = [
    { id: 'floor-vestibule', box: boundsToFloor(vestibule), material: 'floorVestibule' },
    { id: 'floor-spine', box: boundsToFloor(spine), material: 'floorSpine' },
    { id: 'floor-g1', box: boundsToFloor(g1), material: 'floorGallery' },
    { id: 'floor-g2', box: boundsToFloor(g2), material: 'floorGallery' },
    { id: 'floor-g3', box: boundsToFloor(g3), material: 'floorGallery' },
    { id: 'floor-finale', box: boundsToFloor(finale), material: 'floorFinale' },
    { id: 'floor-exit', box: boundsToFloor(exit), material: 'floorExit' }
  ];

  const H_VEST = 2.65;
  const H_SPINE = 3.25;
  const H_GALLERY = 3.05;
  const H_FINALE = 4.25;
  const H_EXIT = 2.9;

  const walls: Array<{ id: string; box: Box; height: number; material: MuseumMaterialKey }> = [];

  const v = vestibule;
  const vw = v.maxX - v.minX;
  const vd = v.maxZ - v.minZ;

  const vestibuleDoorW = 2.2;
  const vestLeftSegW = (vw - vestibuleDoorW) / 2;

  walls.push({
    id: `vest-south`,
    height: H_VEST,
    material: 'wallVestibule',
    box: wallSegment([vw + 2 * WALL_THICKNESS, H_VEST, WALL_THICKNESS], [(v.minX + v.maxX) / 2, H_VEST / 2, v.minZ - WALL_THICKNESS / 2])
  });
  walls.push({
    id: `vest-west`,
    height: H_VEST,
    material: 'wallVestibule',
    box: wallSegment([WALL_THICKNESS, H_VEST, vd + 2 * WALL_THICKNESS], [v.minX - WALL_THICKNESS / 2, H_VEST / 2, (v.minZ + v.maxZ) / 2])
  });
  walls.push({
    id: `vest-east`,
    height: H_VEST,
    material: 'wallVestibule',
    box: wallSegment([WALL_THICKNESS, H_VEST, vd + 2 * WALL_THICKNESS], [v.maxX + WALL_THICKNESS / 2, H_VEST / 2, (v.minZ + v.maxZ) / 2])
  });

  if (vestLeftSegW > 0.1) {
    walls.push({
      id: `vest-north-left`,
      height: H_VEST,
      material: 'wallVestibule',
      box: wallSegment([vestLeftSegW, H_VEST, WALL_THICKNESS], [v.minX + vestLeftSegW / 2, H_VEST / 2, v.maxZ + WALL_THICKNESS / 2])
    });
    walls.push({
      id: `vest-north-right`,
      height: H_VEST,
      material: 'wallVestibule',
      box: wallSegment([vestLeftSegW, H_VEST, WALL_THICKNESS], [v.maxX - vestLeftSegW / 2, H_VEST / 2, v.maxZ + WALL_THICKNESS / 2])
    });
  }

  const s = spine;
  const sw = s.maxX - s.minX;

  const southSegW = (sw - vestibuleDoorW) / 2;
  if (southSegW > 0.1) {
    walls.push({
      id: `spine-south-left`,
      height: H_SPINE,
      material: 'wallPlaster',
      box: wallSegment([southSegW, H_SPINE, WALL_THICKNESS], [s.minX + southSegW / 2, H_SPINE / 2, s.minZ - WALL_THICKNESS / 2])
    });
    walls.push({
      id: `spine-south-right`,
      height: H_SPINE,
      material: 'wallPlaster',
      box: wallSegment([southSegW, H_SPINE, WALL_THICKNESS], [s.maxX - southSegW / 2, H_SPINE / 2, s.minZ - WALL_THICKNESS / 2])
    });
  }

  const spineFinaleDoorW = 3.2;
  const northSegW = (sw - spineFinaleDoorW) / 2;
  if (northSegW > 0.1) {
    walls.push({
      id: `spine-north-left`,
      height: H_SPINE,
      material: 'wallPlaster',
      box: wallSegment([northSegW, H_SPINE, WALL_THICKNESS], [s.minX + northSegW / 2, H_SPINE / 2, s.maxZ + WALL_THICKNESS / 2])
    });
    walls.push({
      id: `spine-north-right`,
      height: H_SPINE,
      material: 'wallPlaster',
      box: wallSegment([northSegW, H_SPINE, WALL_THICKNESS], [s.maxX - northSegW / 2, H_SPINE / 2, s.maxZ + WALL_THICKNESS / 2])
    });
  }

  const doorLenZ = 2.2;
  const spineDoorsWest = [
    { id: 'g1', z: 8, len: doorLenZ },
    { id: 'g3', z: 24, len: doorLenZ }
  ];
  const spineDoorsEast = [{ id: 'g2', z: 16, len: doorLenZ }];

  const buildSpineWallWithGaps = (side: 'west' | 'east', x: number, doors: { id: string; z: number; len: number }[]) => {
    const wallZMin = s.minZ;
    const wallZMax = s.maxZ;
    const segs: Array<{ z0: number; z1: number; id: string }> = [];
    let cursor = wallZMin;
    const sorted = [...doors].sort((a, b) => a.z - b.z);
    for (const d of sorted) {
      const gap0 = d.z - d.len / 2;
      const gap1 = d.z + d.len / 2;
      if (gap0 > cursor) segs.push({ z0: cursor, z1: gap0, id: `${side}-${d.id}-pre` });
      cursor = gap1;
    }
    if (cursor < wallZMax) segs.push({ z0: cursor, z1: wallZMax, id: `${side}-tail` });

    for (const seg of segs) {
      const len = seg.z1 - seg.z0;
      if (len < 0.2) continue;
      walls.push({
        id: `spine-${seg.id}`,
        height: H_SPINE,
        material: 'wallPlaster',
        box: wallSegment([WALL_THICKNESS, H_SPINE, len + WALL_THICKNESS], [x, H_SPINE / 2, (seg.z0 + seg.z1) / 2])
      });
    }
  };

  buildSpineWallWithGaps('west', s.minX - WALL_THICKNESS / 2, spineDoorsWest);
  buildSpineWallWithGaps('east', s.maxX + WALL_THICKNESS / 2, spineDoorsEast);

  const buildRoomWithSingleDoor = (
    idPrefix: string,
    b: Bounds,
    height: number,
    material: MuseumMaterialKey,
    doorOn: 'west' | 'east',
    doorZ: number,
    doorWz = 2.2
  ) => {
    const w = b.maxX - b.minX;
    const d = b.maxZ - b.minZ;

    walls.push({
      id: `${idPrefix}-north`,
      height,
      material,
      box: wallSegment([w + 2 * WALL_THICKNESS, height, WALL_THICKNESS], [(b.minX + b.maxX) / 2, height / 2, b.maxZ + WALL_THICKNESS / 2])
    });
    walls.push({
      id: `${idPrefix}-south`,
      height,
      material,
      box: wallSegment([w + 2 * WALL_THICKNESS, height, WALL_THICKNESS], [(b.minX + b.maxX) / 2, height / 2, b.minZ - WALL_THICKNESS / 2])
    });

    const xDoor = doorOn === 'west' ? b.minX - WALL_THICKNESS / 2 : b.maxX + WALL_THICKNESS / 2;
    const xOther = doorOn === 'west' ? b.maxX + WALL_THICKNESS / 2 : b.minX - WALL_THICKNESS / 2;

    const buildSide = (x: number, isDoorSide: boolean, sideName: string) => {
      if (!isDoorSide) {
        walls.push({
          id: `${idPrefix}-${sideName}`,
          height,
          material,
          box: wallSegment([WALL_THICKNESS, height, d + 2 * WALL_THICKNESS], [x, height / 2, (b.minZ + b.maxZ) / 2])
        });
        return;
      }

      const gap0 = doorZ - doorWz / 2;
      const gap1 = doorZ + doorWz / 2;

      const segA0 = b.minZ;
      const segA1 = Math.max(b.minZ, gap0);
      const segB0 = Math.min(b.maxZ, gap1);
      const segB1 = b.maxZ;

      if (segA1 - segA0 > 0.2) {
        walls.push({
          id: `${idPrefix}-${sideName}-a`,
          height,
          material,
          box: wallSegment([WALL_THICKNESS, height, (segA1 - segA0) + WALL_THICKNESS], [x, height / 2, (segA0 + segA1) / 2])
        });
      }
      if (segB1 - segB0 > 0.2) {
        walls.push({
          id: `${idPrefix}-${sideName}-b`,
          height,
          material,
          box: wallSegment([WALL_THICKNESS, height, (segB1 - segB0) + WALL_THICKNESS], [x, height / 2, (segB0 + segB1) / 2])
        });
      }
    };

    buildSide(xDoor, true, doorOn === 'west' ? 'west' : 'east');
    buildSide(xOther, false, doorOn === 'west' ? 'east' : 'west');
  };

  buildRoomWithSingleDoor('g1', g1, H_GALLERY, 'wallGallery', 'east', 8, doorLenZ);
  buildRoomWithSingleDoor('g2', g2, H_GALLERY, 'wallGallery', 'west', 16, doorLenZ);
  buildRoomWithSingleDoor('g3', g3, H_GALLERY, 'wallGallery', 'east', 24, doorLenZ);

  const f = finale;
  const fw = f.maxX - f.minX;
  const fd = f.maxZ - f.minZ;

  walls.push({
    id: `finale-north`,
    height: H_FINALE,
    material: 'wallPlaster',
    box: wallSegment([fw + 2 * WALL_THICKNESS, H_FINALE, WALL_THICKNESS], [(f.minX + f.maxX) / 2, H_FINALE / 2, f.maxZ + WALL_THICKNESS / 2])
  });

  const segW = (fw - spineFinaleDoorW) / 2;
  if (segW > 0.1) {
    walls.push({
      id: `finale-south-left`,
      height: H_FINALE,
      material: 'wallPlaster',
      box: wallSegment([segW, H_FINALE, WALL_THICKNESS], [f.minX + segW / 2, H_FINALE / 2, f.minZ - WALL_THICKNESS / 2])
    });
    walls.push({
      id: `finale-south-right`,
      height: H_FINALE,
      material: 'wallPlaster',
      box: wallSegment([segW, H_FINALE, WALL_THICKNESS], [f.maxX - segW / 2, H_FINALE / 2, f.minZ - WALL_THICKNESS / 2])
    });
  }

  walls.push({
    id: `finale-west`,
    height: H_FINALE,
    material: 'wallPlaster',
    box: wallSegment([WALL_THICKNESS, H_FINALE, fd + 2 * WALL_THICKNESS], [f.minX - WALL_THICKNESS / 2, H_FINALE / 2, (f.minZ + f.maxZ) / 2])
  });

  const exitDoorZ = 40.5;
  const exitDoorWz = 2.2;
  const exitGap0 = exitDoorZ - exitDoorWz / 2;
  const exitGap1 = exitDoorZ + exitDoorWz / 2;

  for (const seg of [
    { id: 'a', z0: f.minZ, z1: exitGap0 },
    { id: 'b', z0: exitGap1, z1: f.maxZ }
  ]) {
    const len = seg.z1 - seg.z0;
    if (len < 0.2) continue;
    walls.push({
      id: `finale-east-${seg.id}`,
      height: H_FINALE,
      material: 'wallPlaster',
      box: wallSegment([WALL_THICKNESS, H_FINALE, len + WALL_THICKNESS], [f.maxX + WALL_THICKNESS / 2, H_FINALE / 2, (seg.z0 + seg.z1) / 2])
    });
  }

  const e = exit;
  const ew = e.maxX - e.minX;
  const ed = e.maxZ - e.minZ;

  walls.push({
    id: `exit-north`,
    height: H_EXIT,
    material: 'wallExit',
    box: wallSegment([ew + 2 * WALL_THICKNESS, H_EXIT, WALL_THICKNESS], [(e.minX + e.maxX) / 2, H_EXIT / 2, e.maxZ + WALL_THICKNESS / 2])
  });

  const buildExitWest = () => {
    const x = e.minX - WALL_THICKNESS / 2;
    const segA0 = e.minZ;
    const segA1 = Math.max(e.minZ, exitGap0);
    const segB0 = Math.min(e.maxZ, exitGap1);
    const segB1 = e.maxZ;

    if (segA1 - segA0 > 0.2) {
      walls.push({
        id: `exit-west-a`,
        height: H_EXIT,
        material: 'wallExit',
        box: wallSegment([WALL_THICKNESS, H_EXIT, (segA1 - segA0) + WALL_THICKNESS], [x, H_EXIT / 2, (segA0 + segA1) / 2])
      });
    }
    if (segB1 - segB0 > 0.2) {
      walls.push({
        id: `exit-west-b`,
        height: H_EXIT,
        material: 'wallExit',
        box: wallSegment([WALL_THICKNESS, H_EXIT, (segB1 - segB0) + WALL_THICKNESS], [x, H_EXIT / 2, (segB0 + segB1) / 2])
      });
    }
  };
  buildExitWest();

  walls.push({
    id: `exit-east`,
    height: H_EXIT,
    material: 'wallExit',
    box: wallSegment([WALL_THICKNESS, H_EXIT, ed + 2 * WALL_THICKNESS], [e.maxX + WALL_THICKNESS / 2, H_EXIT / 2, (e.minZ + e.maxZ) / 2])
  });

  const stubLen = 1.2;
  walls.push({
    id: `exit-south-stub-a`,
    height: H_EXIT,
    material: 'wallExit',
    box: wallSegment([stubLen, H_EXIT, WALL_THICKNESS], [e.minX + stubLen / 2, H_EXIT / 2, e.minZ - WALL_THICKNESS / 2])
  });
  walls.push({
    id: `exit-south-stub-b`,
    height: H_EXIT,
    material: 'wallExit',
    box: wallSegment([stubLen, H_EXIT, WALL_THICKNESS], [e.maxX - stubLen / 2, H_EXIT / 2, e.minZ - WALL_THICKNESS / 2])
  });

  const solids: Solid[] = [];
  const decals: Decal[] = [];

  const baseboards: Decal[] = walls.map((w) => {
    const [sx, , sz] = w.box.size;
    const isNS = sx > sz; 
    const size: [number, number, number] = isNS ? [sx, BASEBOARD_H, BASEBOARD_T] : [BASEBOARD_T, BASEBOARD_H, sz];
    return {
      id: `${w.id}-baseboard`,
      
      material: BASEBOARD_MATERIAL,
      box: { size, position: [w.box.position[0], BASEBOARD_H / 2, w.box.position[2]] }
    };
  });

  decals.push(...baseboards);

  const seamH = 2.8;
  const seamY = 1.55;
  const seamNormal = 0.012;
  const seamW = 0.018;
  const seams: Decal[] = [];
  const addSeamX = (id: string, x: number, z: number) =>
    seams.push({ id, material: 'shadowGap', box: { size: [seamNormal, seamH, seamW], position: [x, seamY, z] } });
  const addSeamZ = (id: string, x: number, z: number) =>
    seams.push({ id, material: 'shadowGap', box: { size: [seamW, seamH, seamNormal], position: [x, seamY, z] } });

  const spineWestFaceX = -2.0 + seamNormal / 2 + 0.002;
  const spineEastFaceX = 2.0 - seamNormal / 2 - 0.002;
  [3.5, 12.0, 20.0, 28.5].forEach((z) => addSeamX(`seam-spine-west-${z}`, spineWestFaceX, z));
  [3.5, 10.5, 21.5, 29.0].forEach((z) => addSeamX(`seam-spine-east-${z}`, spineEastFaceX, z));

  const finaleWestFaceX = -7.0 + seamNormal / 2 + 0.008;
  const finaleEastFaceX = 7.0 - seamNormal / 2 - 0.008;
  [34.5, 38.5, 42.5].forEach((z) => addSeamX(`seam-finale-west-${z}`, finaleWestFaceX, z));
  [34.5, 38.5, 42.5].forEach((z) => addSeamX(`seam-finale-east-${z}`, finaleEastFaceX, z));

  const finaleNorthFaceZ = 45.0 - seamNormal / 2 - 0.008;
  const finaleSouthFaceZ = 32.0 + seamNormal / 2 + 0.008;
  [-4.5, -2.5, 2.5, 4.5].forEach((x) => addSeamZ(`seam-finale-north-${x}`, x, finaleNorthFaceZ));
  [-4.5, -2.5, 2.5, 4.5].forEach((x) => addSeamZ(`seam-finale-south-${x}`, x, finaleSouthFaceZ));

  decals.push(...seams);

  const addSideDoorPortal = (args: {
    id: string;
    xFace: number;
    z: number;
    lenZ: number;
    doorH: number;
    spineDir: 1 | -1; 
    withThreshold?: boolean;
    withSlot?: boolean;
  }) => {
    const { id, xFace, z, lenZ, doorH, spineDir } = args;
    const z0 = z - lenZ / 2;
    const z1 = z + lenZ / 2;

    solids.push({
      id: `${id}-jamb-a`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [FRAME_DEPTH, doorH, FRAME_THICK], position: [xFace, doorH / 2, z0 - FRAME_THICK / 2] }
    });
    solids.push({
      id: `${id}-jamb-b`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [FRAME_DEPTH, doorH, FRAME_THICK], position: [xFace, doorH / 2, z1 + FRAME_THICK / 2] }
    });
    
    solids.push({
      id: `${id}-header`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [FRAME_DEPTH, HEADER_H, lenZ + 2 * FRAME_THICK], position: [xFace, doorH + HEADER_H / 2, z] }
    });

    if (args.withThreshold !== false) {
      
      decals.push({
        id: `${id}-threshold-gap`,
        material: 'shadowGap',
        box: { size: [FRAME_DEPTH * 1.12, 0.012, lenZ * 1.02], position: [xFace, 0.006, z] }
      });
      decals.push({
        id: `${id}-threshold`,
        material: 'thresholdStone',
        box: { size: [FRAME_DEPTH * 1.06, 0.04, lenZ * 0.98], position: [xFace, 0.02, z] }
      });
    }

    if (args.withSlot !== false) {
      
      const cx = xFace + spineDir * SLOT_CENTER_OFFSET;
      const cy = doorH + 0.12;
      const cz = z;
      const len = lenZ * 0.92;
      
      decals.push({
        id: `${id}-slot-cavity`,
        material: 'shadowGap',
        box: { size: [SLOT_D, SLOT_H, len], position: [cx, cy, cz] }
      });
      
      decals.push({
        id: `${id}-slot-trim`,
        material: 'fixtureTrim',
        box: {
          size: [0.012, SLOT_H + 0.05, len * 1.02],
          position: [cx - spineDir * (SLOT_D / 2 - 0.006), cy, cz]
        }
      });
      
      decals.push({
        id: `${id}-slot-diffuser`,
        material: 'fixtureDiffuser',
        box: {
          size: [0.008, SLOT_H * 0.86, len * 0.94],
          position: [cx - spineDir * (SLOT_D / 2 - 0.012), cy, cz]
        }
      });
    }
  };

  const addNorthSouthPortal = (args: {
    id: string;
    zFace: number;
    x: number;
    lenX: number;
    doorH: number;
    spineDirZ: 1 | -1; 
    withThreshold?: boolean;
    withSlot?: boolean;
  }) => {
    const { id, zFace, x, lenX, doorH, spineDirZ } = args;
    const x0 = x - lenX / 2;
    const x1 = x + lenX / 2;

    solids.push({
      id: `${id}-jamb-a`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [FRAME_THICK, doorH, FRAME_DEPTH], position: [x0 - FRAME_THICK / 2, doorH / 2, zFace] }
    });
    solids.push({
      id: `${id}-jamb-b`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [FRAME_THICK, doorH, FRAME_DEPTH], position: [x1 + FRAME_THICK / 2, doorH / 2, zFace] }
    });
    solids.push({
      id: `${id}-header`,
      material: 'stoneTrim',
      collider: true,
      box: { size: [lenX + 2 * FRAME_THICK, HEADER_H, FRAME_DEPTH], position: [x, doorH + HEADER_H / 2, zFace] }
    });

    if (args.withThreshold !== false) {
      decals.push({
        id: `${id}-threshold-gap`,
        material: 'shadowGap',
        box: { size: [lenX * 1.02, 0.012, FRAME_DEPTH * 1.12], position: [x, 0.006, zFace] }
      });
      decals.push({
        id: `${id}-threshold`,
        material: 'thresholdStone',
        box: { size: [lenX * 0.98, 0.04, FRAME_DEPTH * 1.06], position: [x, 0.02, zFace] }
      });
    }

    if (args.withSlot !== false) {
      
      const cx = x;
      const cy = doorH + 0.12;
      const cz = zFace + spineDirZ * SLOT_CENTER_OFFSET;
      const len = lenX * 0.92;
      
      decals.push({
        id: `${id}-slot-cavity`,
        material: 'shadowGap',
        box: { size: [len, SLOT_H, SLOT_D], position: [cx, cy, cz] }
      });
      
      decals.push({
        id: `${id}-slot-trim`,
        material: 'fixtureTrim',
        box: {
          size: [len * 1.02, SLOT_H + 0.05, 0.012],
          position: [cx, cy, cz - spineDirZ * (SLOT_D / 2 - 0.006)]
        }
      });
      
      decals.push({
        id: `${id}-slot-diffuser`,
        material: 'fixtureDiffuser',
        box: {
          size: [len * 0.94, SLOT_H * 0.86, 0.008],
          position: [cx, cy, cz - spineDirZ * (SLOT_D / 2 - 0.012)]
        }
      });
    }
  };

  addNorthSouthPortal({
    id: 'portal-vest-spine',
    zFace: 0.0,
    x: 0.0,
    lenX: vestibuleDoorW,
    doorH: DOOR_CLEAR_H_SPINE,
    spineDirZ: +1
  });

  addSideDoorPortal({
    id: 'portal-spine-g1',
    xFace: -2.0,
    z: 8.0,
    lenZ: doorLenZ,
    doorH: DOOR_CLEAR_H_GALLERY,
    spineDir: +1
  });
  addSideDoorPortal({
    id: 'portal-spine-g2',
    xFace: 2.0,
    z: 16.0,
    lenZ: doorLenZ,
    doorH: DOOR_CLEAR_H_GALLERY,
    spineDir: -1
  });
  addSideDoorPortal({
    id: 'portal-spine-g3',
    xFace: -2.0,
    z: 24.0,
    lenZ: doorLenZ,
    doorH: DOOR_CLEAR_H_GALLERY,
    spineDir: +1
  });

  addNorthSouthPortal({
    id: 'portal-spine-finale',
    zFace: 32.0,
    x: 0.0,
    lenX: spineFinaleDoorW,
    doorH: DOOR_CLEAR_H_SPINE,
    spineDirZ: -1
  });

  addSideDoorPortal({
    id: 'portal-finale-exit',
    xFace: 7.0,
    z: exitDoorZ,
    lenZ: exitDoorWz,
    doorH: DOOR_CLEAR_H_EXIT,
    spineDir: -1
  });

  const addGalleryReturns = (id: string, xFace: number, z: number, lenZ: number, height: number, inwardDir: 1 | -1) => {
    const z0 = z - lenZ / 2;
    const z1 = z + lenZ / 2;

    solids.push({
      id: `${id}-return-a`,
      material: 'wallGallery',
      collider: true,
      box: { size: [RETURN_DEPTH, height, WALL_THICKNESS], position: [xFace + inwardDir * (RETURN_DEPTH / 2), height / 2, z0 - WALL_THICKNESS / 2] }
    });
    solids.push({
      id: `${id}-return-b`,
      material: 'wallGallery',
      collider: true,
      box: { size: [RETURN_DEPTH, height, WALL_THICKNESS], position: [xFace + inwardDir * (RETURN_DEPTH / 2), height / 2, z1 + WALL_THICKNESS / 2] }
    });
  };

  addGalleryReturns('g1', -2.0, 8.0, doorLenZ, H_GALLERY, -1);
  addGalleryReturns('g2', 2.0, 16.0, doorLenZ, H_GALLERY, +1);
  addGalleryReturns('g3', -2.0, 24.0, doorLenZ, H_GALLERY, -1);

  decals.push(
    
    {
      id: 'niche-g1-frame',
      material: 'nicheFrame',
      box: { size: [0.08, 1.75, 3.1], position: [-11.92, 1.55, 9.0] }
    },
    {
      id: 'niche-g1-inner',
      material: 'nicheInner',
      box: { size: [0.04, 1.55, 2.85], position: [-11.87, 1.55, 9.0] }
    },
    
    {
      id: 'niche-g2-frame',
      material: 'nicheFrame',
      box: { size: [0.08, 1.75, 3.1], position: [11.92, 1.55, 16.0] }
    },
    {
      id: 'niche-g2-inner',
      material: 'nicheInner',
      box: { size: [0.04, 1.55, 2.85], position: [11.87, 1.55, 16.0] }
    },
    
    {
      id: 'niche-g3-frame',
      material: 'nicheFrame',
      box: { size: [0.08, 1.75, 3.1], position: [-11.92, 1.55, 24.0] }
    },
    {
      id: 'niche-g3-inner',
      material: 'nicheInner',
      box: { size: [0.04, 1.55, 2.85], position: [-11.87, 1.55, 24.0] }
    }
  );

  const pauses: PauseNode[] = [
    
    {
      id: 'pause-g1',
      
      collider: { size: [2.4, 0.45, 0.6], position: [-9.0, 0.225, 9.0] },
      visual: { kind: 'rail', position: [-9.0, 0.0, 9.0], rotationY: Math.PI / 2, length: 2.2, depth: 0.26, height: 0.9 }
    },
    {
      id: 'pause-g2',
      collider: { size: [2.4, 0.45, 0.6], position: [9.0, 0.225, 16.0] },
      visual: { kind: 'rail', position: [9.0, 0.0, 16.0], rotationY: Math.PI / 2, length: 2.2, depth: 0.26, height: 0.9 }
    },
    {
      id: 'pause-g3',
      collider: { size: [2.4, 0.45, 0.6], position: [-9.0, 0.225, 24.0] },
      visual: { kind: 'rail', position: [-9.0, 0.0, 24.0], rotationY: Math.PI / 2, length: 2.2, depth: 0.26, height: 0.9 }
    },
    
    {
      id: 'pause-spine-6',
      collider: { size: [1.6, 0.4, 0.45], position: [-1.1, 0.2, 6.0] },
      visual: { kind: 'bench', position: [-1.1, 0.0, 6.0], rotationY: 0, length: 1.35, depth: 0.42, height: 0.48 }
    },
    {
      id: 'pause-spine-14',
      collider: { size: [1.6, 0.4, 0.45], position: [1.1, 0.2, 14.0] },
      visual: { kind: 'bench', position: [1.1, 0.0, 14.0], rotationY: Math.PI, length: 1.35, depth: 0.42, height: 0.48 }
    },
    {
      id: 'pause-spine-22',
      collider: { size: [1.6, 0.4, 0.45], position: [-1.1, 0.2, 22.0] },
      visual: { kind: 'bench', position: [-1.1, 0.0, 22.0], rotationY: 0, length: 1.35, depth: 0.42, height: 0.48 }
    },
    {
      id: 'pause-spine-30',
      collider: { size: [1.6, 0.4, 0.45], position: [1.1, 0.2, 30.0] },
      visual: { kind: 'bench', position: [1.1, 0.0, 30.0], rotationY: Math.PI, length: 1.35, depth: 0.42, height: 0.48 }
    }
  ];

  const RHYTHM_Z = [6, 14, 22, 30];
  const rhythmPatches: Decal[] = RHYTHM_Z.map((z) => ({
    id: `spine-rhythm-inlay-${z}`,
    material: 'inlay',
    box: { size: [1.25, 0.01, 2.6], position: [0, 0.006, z] }
  }));
  decals.push(...rhythmPatches);

  const standpointInlays: Decal[] = [
    { id: 'stand-g1', material: 'inlay', box: { size: [0.58, 0.01, 0.58], position: [-9.2, 0.006, 9.0] } },
    { id: 'stand-g2', material: 'inlay', box: { size: [0.58, 0.01, 0.58], position: [9.2, 0.006, 16.0] } },
    { id: 'stand-g3', material: 'inlay', box: { size: [0.58, 0.01, 0.58], position: [-9.2, 0.006, 24.0] } }
  ];
  decals.push(...standpointInlays);

  const ceilings: Array<{ id: string; box: Box; material: MuseumMaterialKey }> = [
    {
      id: 'ceiling-spine',
      material: 'wallAccent',
      box: { size: [6.0, 0.01, 40.0], position: [0, 3.25, 16] }
    },
    {
      id: 'ceiling-finale',
      material: 'wallAccent',
      box: { size: [16.0, 0.01, 18.0], position: [0, 4.25, 38.5] }
    },
    {
      id: 'ceiling-exit',
      material: 'wallExit',
      box: { size: [4.5, 0.01, 9.5], position: [9.0, 2.9, 40.5] }
    }
  ];

  const addCompression = (id: string, z: number) => {
    solids.push({
      id,
      material: 'wallAccent',
      collider: false,
      box: { size: [4.2, 0.32, 1.6], position: [0, H_SPINE - 0.16, z] }
    });
  };
  [6, 14, 22, 30].forEach((z) => addCompression(`compression-${z}`, z));

  const addDownlight = (id: string, x: number, z: number, ceilingY: number) => {
    const trimY = ceilingY - 0.02;
    solids.push({
      id: `${id}-trim`,
      material: 'fixtureTrim',
      collider: false,
      box: { size: [0.28, 0.03, 0.28], position: [x, trimY, z] }
    });
    solids.push({
      id: `${id}-diffuser`,
      material: 'fixtureDiffuser',
      collider: false,
      box: { size: [0.2, 0.008, 0.2], position: [x, trimY - 0.018, z] }
    });
  };

  addDownlight('dl-vest', 0, -1.6, H_VEST);
  
  [6, 14, 22, 30].forEach((z) => addDownlight(`dl-spine-${z}`, 0, z, H_SPINE));
  
  addDownlight('dl-g1', -9.2, 9.0, H_GALLERY);
  addDownlight('dl-g2', 9.2, 16.0, H_GALLERY);
  addDownlight('dl-g3', -9.2, 24.0, H_GALLERY);
  
  addDownlight('dl-finale', 0, 38.0, H_FINALE);


  return { floors, walls, solids, decals, ceilings, pauses };
};
