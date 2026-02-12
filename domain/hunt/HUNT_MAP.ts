// Geometry-accurate Hunt Megastaff mapping for placement.
// - 205-TET steps per octave: 205
// - Comma zones per octave: 41 (=205/5)
// - Subzones per comma zone: 5 (JND)
// Placement rule: zInOct = ((Z % 41) + 41) % 41, where Z = floor(I/5), I = round(centsAbs / (1200/205))

export type HuntSlotKind = "line" | "space";
export type HuntInflection = "bb" | "b" | "n" | "#" | "x"; // double-flat, flat, natural, sharp, double-sharp

export type HuntSlot = {
  /** 0..40 Comma Zone index within octave */
  zInOct: number;

  /** For rendering: whether this slot is treated as a line or a space (geometry only). */
  kind: HuntSlotKind;

  /** 0..40 monotone index bottom->top; y = yBase - yStep * yIndex */
  yIndex: number;

  /** Optional: debug-friendly local numbering (NOT Zentral website naming) */
  lineNo?: number;
  spaceNo?: number;

  /**
   * Optional: exact X.Y.Z naming override if you later transcribe Zentral tables.
   * Example: {type:"space", x:4, y:2, z:2} => "space 4.2.2"
   */
  labelOverride?: { type: "line" | "space"; x: number; y: number; z: number };
};

export type HuntMap = {
  id: string;
  version: string;

  positionsPerOctave: 41;
  subzonesPerZone: 5;
  stepsPerOctave: 205;

  stepCents: number; // 1200/205
  zoneCents: number; // stepCents*5

  slots: HuntSlot[];

  // visual guide suggestions (optional; pure rendering policy)
  guides: {
    /** draw these zInOct indices as thicker "region lines" if you want */
    regionLineZ: number[];
    /** show micro-lines only when zoomed */
    microLinesEnabledByDefault: boolean;
  };

  // inflection mapping by O = I mod 5
  inflections: Record<number, { glyph: HuntInflection; centsOffsetFromZoneCenter: number }>;
};

const STEP_CENTS = 1200 / 205;
const ZONE_CENTS = STEP_CENTS * 5;

const INFLECTIONS: HuntMap["inflections"] = {
  0: { glyph: "bb", centsOffsetFromZoneCenter: -2 * STEP_CENTS },
  1: { glyph: "b", centsOffsetFromZoneCenter: -1 * STEP_CENTS },
  2: { glyph: "n", centsOffsetFromZoneCenter: 0 },
  3: { glyph: "#", centsOffsetFromZoneCenter: +1 * STEP_CENTS },
  4: { glyph: "x", centsOffsetFromZoneCenter: +2 * STEP_CENTS },
};

function buildSlots(): HuntSlot[] {
  const slots: HuntSlot[] = [];
  for (let z = 0; z < 41; z += 1) {
    const kind: HuntSlotKind = z % 2 === 0 ? "line" : "space";
    const yIndex = z;

    // Debug-only sequential numbers (geometry helper)
    const seq = Math.floor(z / 2) + 1;
    const slot: HuntSlot = {
      zInOct: z,
      kind,
      yIndex,
      ...(kind === "line" ? { lineNo: seq } : { spaceNo: seq }),
    };
    slots.push(slot);
  }
  return slots;
}

// Optional default "region line" emphasis (purely visual; you can change)
// 8 region lines per octave (exclude the top edge to keep count fixed).
const DEFAULT_REGION_LINES = [0, 5, 10, 15, 20, 25, 30, 35];

export const HUNT_MAP_GEOMETRY_V1: HuntMap = {
  id: "hunt-geometry-v1",
  version: "2026-01-26",

  positionsPerOctave: 41,
  subzonesPerZone: 5,
  stepsPerOctave: 205,

  stepCents: STEP_CENTS,
  zoneCents: ZONE_CENTS,

  slots: buildSlots(),

  guides: {
    regionLineZ: DEFAULT_REGION_LINES,
    microLinesEnabledByDefault: false,
  },

  inflections: INFLECTIONS,
};

/** Convert 205-step index I to Z/O/zInOct/slot */
export function huntIndexToSlot(I: number, map: HuntMap = HUNT_MAP_GEOMETRY_V1) {
  const Z = Math.floor(I / map.subzonesPerZone); // comma zone number (can be negative)
  const O = ((I % map.subzonesPerZone) + map.subzonesPerZone) % map.subzonesPerZone; // 0..4
  const zInOct =
    ((Z % map.positionsPerOctave) + map.positionsPerOctave) % map.positionsPerOctave; // 0..40
  const slot = map.slots[zInOct];
  return { I, Z, O, zInOct, slot };
}

/** Inject exact X.Y.Z naming later if needed */
export function applyLabelOverrides(
  map: HuntMap,
  labelOverrides: Record<number, HuntSlot["labelOverride"]>
): HuntMap {
  return {
    ...map,
    slots: map.slots.map((s) => ({
      ...s,
      labelOverride: labelOverrides[s.zInOct] ?? s.labelOverride,
    })),
  };
}
