import type { Hunt205LabelLayout, Hunt205Layout, Hunt205ToneLayout } from './Hunt205LayoutLoader';
import { getPeriodCents } from './Hunt205LayoutLoader';

export type NormalizedNoteEvent = {
  event_id: string;
  start_time_ms: number;
  end_time_ms: number;
  pitch_representation: {
    type: 'label' | 'cents' | 'ratio' | 'frequency';
    label?: string;
    cents?: number;
    ratio_num?: number;
    ratio_den?: number;
    hz?: number;
  };
  velocity: number;
  channel?: number;
  voice?: number;
};

export type ToneBinding = {
  event_id: string;
  tone_id: number;
  label_id?: number;
  start_time_ms: number;
  end_time_ms: number;
  velocity: number;
  approx?: boolean;
  match_method: 'label' | 'cents' | 'ratio' | 'frequency';
  distance_cents: number;
};

export type ToneResolverOptions = {
  periodCents?: number;
  centsThreshold?: number;
  referenceHz?: number;
  referenceCents?: number;
  log?: (entry: {
    eventId: string;
    pitch: NormalizedNoteEvent['pitch_representation'];
    toneId: number;
    matchMethod: ToneBinding['match_method'];
    distanceCents: number;
    approx: boolean;
  }) => void;
};

const normalizeLabel = (text: string) => text.normalize('NFC').trim();

const ratioToCents = (num?: number, den?: number) => {
  if (!Number.isFinite(num) || !Number.isFinite(den) || !den || !num) return null;
  const value = num / den;
  if (!(value > 0)) return null;
  return 1200 * Math.log2(value);
};

const normalizeCents = (cents: number, period: number) => {
  const wrapped = ((cents % period) + period) % period;
  return Number.isFinite(wrapped) ? wrapped : cents;
};

const circularDistance = (a: number, b: number, period: number) => {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.abs(period - diff));
};

const buildLabelIndex = (labels: Hunt205LabelLayout[]) => {
  const map = new Map<string, Hunt205LabelLayout[]>();
  labels.forEach((label) => {
    const key = normalizeLabel(label.text || '');
    if (!key) return;
    const list = map.get(key) || [];
    list.push(label);
    map.set(key, list);
  });
  return map;
};

const resolveByLabel = (
  labelText: string,
  labelIndex: Map<string, Hunt205LabelLayout[]>,
  tonesById: Map<number, Hunt205ToneLayout>
) => {
  const key = normalizeLabel(labelText || '');
  if (!key) return null;
  const matches = labelIndex.get(key);
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) {
    const match = matches[0];
    return { toneId: match.parent_tone_id, labelId: match.label_id };
  }
  const sorted = [...matches].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const match = sorted[0];
  if (!tonesById.has(match.parent_tone_id)) return null;
  return { toneId: match.parent_tone_id, labelId: match.label_id };
};

const resolveByCents = (
  cents: number,
  tones: Hunt205ToneLayout[],
  period: number
) => {
  const normalized = normalizeCents(cents, period);
  let bestTone = tones[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  tones.forEach((tone) => {
    const target = Number.isFinite(tone.cent_value) ? tone.cent_value : 0;
    const dist = circularDistance(normalized, target, period);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestTone = tone;
    }
  });
  return { toneId: bestTone.tone_id, distanceCents: bestDistance };
};

export const resolveToneBindings = (
  events: NormalizedNoteEvent[],
  layout: Hunt205Layout,
  options: ToneResolverOptions = {}
): ToneBinding[] => {
  const period = Number.isFinite(options.periodCents)
    ? (options.periodCents as number)
    : getPeriodCents(layout, 1200);
  const threshold = Number.isFinite(options.centsThreshold) ? (options.centsThreshold as number) : 25;
  const referenceHz = Number.isFinite(options.referenceHz) ? (options.referenceHz as number) : 440;
  const referenceCents = Number.isFinite(options.referenceCents) ? (options.referenceCents as number) : 0;

  const labelIndex = buildLabelIndex(layout.labels || []);
  const tonesById = new Map(layout.tones.map((tone) => [tone.tone_id, tone]));

  return events.map((event) => {
    const pitch = event.pitch_representation;
    let toneId = 0;
    let labelId: number | undefined;
    let distanceCents = 0;
    let matchMethod: ToneBinding['match_method'] = 'cents';
    let approx = false;
    let resolved = false;

    const tryCents = (centsValue: number) => {
      const resolvedTone = resolveByCents(centsValue, layout.tones, period);
      toneId = resolvedTone.toneId;
      distanceCents = resolvedTone.distanceCents;
      approx = distanceCents > threshold;
      matchMethod = 'cents';
      resolved = true;
    };

    const tryRatio = (num: number, den: number) => {
      const cents = ratioToCents(num, den);
      if (cents == null) return;
      const resolvedTone = resolveByCents(cents, layout.tones, period);
      toneId = resolvedTone.toneId;
      distanceCents = resolvedTone.distanceCents;
      approx = distanceCents > threshold;
      matchMethod = 'ratio';
      resolved = true;
    };

    const tryFrequency = (hz: number) => {
      if (!(hz > 0)) return;
      const cents = 1200 * Math.log2(hz / referenceHz) + referenceCents;
      const resolvedTone = resolveByCents(cents, layout.tones, period);
      toneId = resolvedTone.toneId;
      distanceCents = resolvedTone.distanceCents;
      approx = distanceCents > threshold;
      matchMethod = 'frequency';
      resolved = true;
    };

    if (pitch.label) {
      const match = resolveByLabel(pitch.label, labelIndex, tonesById);
      if (match) {
        toneId = match.toneId;
        labelId = match.labelId;
        distanceCents = 0;
        matchMethod = 'label';
        resolved = true;
      }
    }

    if (!resolved && Number.isFinite(pitch.cents)) {
      tryCents(pitch.cents as number);
    }
    if (!resolved && Number.isFinite(pitch.ratio_num) && Number.isFinite(pitch.ratio_den)) {
      tryRatio(pitch.ratio_num as number, pitch.ratio_den as number);
    }
    if (!resolved && Number.isFinite(pitch.hz)) {
      tryFrequency(pitch.hz as number);
    }

    const binding: ToneBinding = {
      event_id: event.event_id,
      tone_id: toneId,
      label_id: labelId,
      start_time_ms: event.start_time_ms,
      end_time_ms: event.end_time_ms,
      velocity: event.velocity,
      approx,
      match_method: matchMethod,
      distance_cents: distanceCents
    };

    if (options.log) {
      options.log({
        eventId: event.event_id,
        pitch,
        toneId,
        matchMethod,
        distanceCents,
        approx
      });
    }
    return binding;
  });
};
