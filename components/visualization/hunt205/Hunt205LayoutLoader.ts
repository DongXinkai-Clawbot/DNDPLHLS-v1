import layoutData from '../../../assets/hunt205_ring_layout.json';

export type Hunt205LayoutMeta = {
  version: string;
  source?: string;
  period_cents?: number;
  radial_layers?: number[];
  author?: string;
  date?: string;
  source_image_hash?: string | null;
  preferred_52?: string[];
};

export type Hunt205ToneLayout = {
  tone_id: number;
  angle_index: number;
  primary_label: string;
  cent_value: number;
  labels: number[];
  debug_name?: string;
};

export type Hunt205LabelLayout = {
  label_id: number;
  text: string;
  parent_tone_id: number;
  radial_layer: number;
  local_angle_offset_deg?: number;
  local_radius_offset_ratio?: number;
  glyph_flags?: string[];
  priority?: number;
  align?: 'left' | 'center' | 'right';
};

export type Hunt205Layout = {
  meta: Hunt205LayoutMeta;
  tones: Hunt205ToneLayout[];
  labels: Hunt205LabelLayout[];
};

export type ToneAngle = {
  toneId: number;
  angleIndex: number;
  angleRad: number;
  angleDeg: number;
};

export type Hunt205ToneAngleTable = {
  byToneId: Map<number, ToneAngle>;
  list: ToneAngle[];
};

const TWO_PI = Math.PI * 2;

export const loadHunt205Layout = (): Hunt205Layout => layoutData as Hunt205Layout;

export const buildToneAngleTable = (layout: Hunt205Layout): Hunt205ToneAngleTable => {
  const count = layout.tones.length || 41;
  const byToneId = new Map<number, ToneAngle>();
  const list: ToneAngle[] = layout.tones.map((tone) => {
    const angleIndex = Number.isFinite(tone.angle_index) ? tone.angle_index : tone.tone_id;
    const angleRad = (angleIndex / count) * TWO_PI - Math.PI / 2;
    const angleDeg = (angleRad * 180) / Math.PI;
    const entry = { toneId: tone.tone_id, angleIndex, angleRad, angleDeg };
    byToneId.set(tone.tone_id, entry);
    return entry;
  });
  return { byToneId, list };
};

export const getPeriodCents = (layout: Hunt205Layout, fallback = 1200) => {
  const period = layout?.meta?.period_cents;
  return Number.isFinite(period) ? (period as number) : fallback;
};
