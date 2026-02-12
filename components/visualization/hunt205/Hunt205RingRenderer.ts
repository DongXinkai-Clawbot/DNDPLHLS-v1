import type { Hunt205LabelLayout, Hunt205Layout, Hunt205ToneLayout, ToneAngle } from './Hunt205LayoutLoader';

export type Hunt205RingAnimConfig = {
  attack_ms: number;
  release_ms: number;
  inactive_dot_radius_px: number;
  active_dot_radius_gain_px: number;
  glow_blur_base_px: number;
  glow_blur_gain_px: number;
  glow_alpha_base: number;
  glow_alpha_gain: number;
  pulse_enabled: boolean;
  pulse_period_ms: number;
  pulse_depth_ratio: number;
  min_visible_ms: number;
};

export type Hunt205RingLayoutConfig = {
  radius_ratios: {
    label_outer: number;
    label_inner: number;
    tone_label: number;
    dot_inactive: number;
    dot_active: number;
  };
  label_rings?: number[];
  collision_enabled: boolean;
  collision_max_angle_deg: number;
  collision_angle_step_deg: number;
  collision_max_radius_ratio: number;
};

export type Hunt205RingVisualConfig = {
  ring_stroke: string;
  ring_stroke_width: number;
  tick_stroke: string;
  tick_length_px: number;
  label_color: string;
  primary_label_color: string;
  label_font_family: string;
  label_font_scale: number;
  primary_label_font_scale: number;
  render_scale: number;
  inactive_dot_color: string;
  active_dot_color: string;
  glow_color: string;
  upcoming_color: string;
  upcoming_stroke_width: number;
};

export type Hunt205RingConfig = {
  layout: Hunt205RingLayoutConfig;
  visual: Hunt205RingVisualConfig;
  anim: Hunt205RingAnimConfig;
  upcoming: {
    enabled: boolean;
    window_ms: number;
  };
};

export type RingGeometry = {
  size: number;
  centerX: number;
  centerY: number;
  radius: number;
  labelRings: number[];
  layers: {
    labelOuter: number;
    labelInner: number;
    toneLabel: number;
    dotInactive: number;
    dotActive: number;
  };
};

export type LabelHitBox = {
  labelId: number;
  toneId: number;
  radialLayer: number;
  text: string;
  angleDeg: number;
  radius: number;
  flipped: boolean;
  align: 'left' | 'center' | 'right';
  box: { x: number; y: number; width: number; height: number };
};

export type TonePoint = {
  toneId: number;
  x: number;
  y: number;
};

export type ToneState = {
  toneId: number;
  activeCount: number;
  activeVelocity: number;
  releaseVelocity: number;
  attackProgress: number;
  releaseProgress: number;
  intensity: number;
  lastStartMs: number;
  lastEndMs: number;
  approxCount: number;
  upcomingStartMs: number;
};

export const DEFAULT_HUNT205_RING_CONFIG: Hunt205RingConfig = {
  layout: {
    radius_ratios: {
      label_outer: 1.0,
      label_inner: 0.94,
      tone_label: 0.86,
      dot_inactive: 0.68,
      dot_active: 0.68
    },
    label_rings: [1.0, 0.94, 0.86, 0.8, 0.74],
    collision_enabled: true,
    collision_max_angle_deg: 6,
    collision_angle_step_deg: 0.6,
    collision_max_radius_ratio: 0.03
  },
  visual: {
    ring_stroke: 'rgba(255,255,255,0.12)',
    ring_stroke_width: 1.2,
    tick_stroke: 'rgba(255,255,255,0.18)',
    tick_length_px: 8,
    label_color: 'rgba(255,255,255,0.72)',
    primary_label_color: 'rgba(255,255,255,0.9)',
    label_font_family: "'Bravura', 'Noto Music', 'Noto Sans Symbols2', 'Noto Sans', 'Segoe UI Symbol', 'Arial Unicode MS', sans-serif",
    label_font_scale: 0.025,
    primary_label_font_scale: 0.034,
    render_scale: 1.5,
    inactive_dot_color: 'rgba(200,200,200,0.45)',
    active_dot_color: 'rgba(255,220,120,0.95)',
    glow_color: 'rgba(255,210,120,0.9)',
    upcoming_color: 'rgba(120,200,255,0.65)',
    upcoming_stroke_width: 1
  },
  anim: {
    attack_ms: 60,
    release_ms: 180,
    inactive_dot_radius_px: 4,
    active_dot_radius_gain_px: 5,
    glow_blur_base_px: 6,
    glow_blur_gain_px: 10,
    glow_alpha_base: 0.35,
    glow_alpha_gain: 0.45,
    pulse_enabled: true,
    pulse_period_ms: 420,
    pulse_depth_ratio: 0.12,
    min_visible_ms: 40
  },
  upcoming: {
    enabled: false,
    window_ms: 700
  }
};

export const buildRingGeometry = (size: number, config: Hunt205RingConfig): RingGeometry => {
  const radius = size / 2;
  const ratios = config.layout.radius_ratios;
  const ringRatios = (config.layout.label_rings && config.layout.label_rings.length > 0)
    ? config.layout.label_rings
    : [ratios.label_outer, ratios.label_inner];
  return {
    size,
    centerX: size / 2,
    centerY: size / 2,
    radius,
    labelRings: ringRatios.map((r) => radius * r),
    layers: {
      labelOuter: radius * ratios.label_outer,
      labelInner: radius * ratios.label_inner,
      toneLabel: radius * ratios.tone_label,
      dotInactive: radius * ratios.dot_inactive,
      dotActive: radius * ratios.dot_active
    }
  };
};

const resolveTextAlign = (align: 'left' | 'center' | 'right', flipped: boolean): CanvasTextAlign => {
  if (!flipped) return align;
  if (align === 'left') return 'right';
  if (align === 'right') return 'left';
  return 'center';
};

const computeBoundingBox = (
  x: number,
  y: number,
  width: number,
  height: number,
  rotationRad: number,
  align: CanvasTextAlign
) => {
  const halfHeight = height / 2;
  let x0 = 0;
  let x1 = width;
  if (align === 'center') {
    x0 = -width / 2;
    x1 = width / 2;
  } else if (align === 'right') {
    x0 = -width;
    x1 = 0;
  }
  const corners = [
    { x: x0, y: -halfHeight },
    { x: x1, y: -halfHeight },
    { x: x1, y: halfHeight },
    { x: x0, y: halfHeight }
  ];
  const sin = Math.sin(rotationRad);
  const cos = Math.cos(rotationRad);
  const rotated = corners.map((pt) => ({
    x: x + pt.x * cos - pt.y * sin,
    y: y + pt.x * sin + pt.y * cos
  }));
  const xs = rotated.map((pt) => pt.x);
  const ys = rotated.map((pt) => pt.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

const boxesOverlap = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) => {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
};

const splitLabelText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) return [''];
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 2 && parts.every((p) => p.length <= 4)) {
      return parts;
    }
  }
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 2 && parts.every((p) => p.length <= 4)) {
      return parts;
    }
  }
  return [trimmed];
};

const placeLabels = (
  ctx: CanvasRenderingContext2D,
  labels: Hunt205LabelLayout[],
  tones: Hunt205ToneLayout[],
  toneAngles: Map<number, ToneAngle>,
  geometry: RingGeometry,
  config: Hunt205RingConfig
) => {
  const layerRadius = (layer: number) => {
    if (geometry.labelRings && geometry.labelRings.length > 0) {
      const idx = Math.max(0, Math.min(layer, geometry.labelRings.length - 1));
      return geometry.labelRings[idx];
    }
    return layer === 0 ? geometry.layers.labelOuter : geometry.layers.labelInner;
  };
  const baseFontSize = Math.max(8, Math.round(geometry.radius * config.visual.label_font_scale));
  const fontScales = config.layout.collision_enabled ? [1, 0.92, 0.84] : [1];
  ctx.font = `600 ${baseFontSize}px ${config.visual.label_font_family}`;
  ctx.fillStyle = config.visual.label_color;
  ctx.textBaseline = 'middle';

  const grouped = new Map<string, Hunt205LabelLayout[]>();
  labels.forEach((label) => {
    const key = `${label.parent_tone_id}:${label.radial_layer}`;
    const list = grouped.get(key) || [];
    list.push(label);
    grouped.set(key, list);
  });

  const hitBoxes: LabelHitBox[] = [];

  grouped.forEach((groupLabels, key) => {
    const boxes: { box: { x: number; y: number; width: number; height: number } }[] = [];
    groupLabels.forEach((label) => {
      const tone = tones.find((t) => t.tone_id === label.parent_tone_id);
      const angleEntry = toneAngles.get(label.parent_tone_id);
      if (!tone || !angleEntry) return;
      const baseRadius = layerRadius(label.radial_layer);
      const baseAngleDeg = angleEntry.angleDeg + (label.local_angle_offset_deg || 0);
      const baseRadiusOffset = (label.local_radius_offset_ratio || 0) * geometry.radius;
      const align = label.align || 'center';

      let finalAngle = baseAngleDeg;
      let finalRadiusOffset = baseRadiusOffset;
      let placedBox: { x: number; y: number; width: number; height: number } | null = null;
      let flipped = false;
      let finalFontSize = baseFontSize;

      const maxAngle = config.layout.collision_max_angle_deg;
      const step = config.layout.collision_angle_step_deg;
      const maxRadiusOffset = config.layout.collision_max_radius_ratio * geometry.radius;
      const maxAngleSteps = Math.ceil(maxAngle / step);

      const tryPlace = (angleDeg: number, radiusOffset: number, fontSize: number) => {
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = geometry.centerX + (baseRadius + radiusOffset) * Math.cos(angleRad);
        const y = geometry.centerY + (baseRadius + radiusOffset) * Math.sin(angleRad);
        const rotationDeg = angleDeg + 90;
        flipped = false;
        const rotationRad = (rotationDeg * Math.PI) / 180;
        const text = label.text || '';
        const lines = splitLabelText(text);
        const multiLine = lines.length > 1;
        const lineFontSize = multiLine ? Math.max(7, Math.round(fontSize * 0.9)) : fontSize;
        ctx.font = `600 ${fontSize}px ${config.visual.label_font_family}`;
        const lineWidth = (value: string) => ctx.measureText(value).width;
        const width = Math.max(...lines.map(lineWidth));
        const lineHeight = lineFontSize * 1.05;
        const height = lineHeight * lines.length;
        const textAlign = align;
        const box = computeBoundingBox(x, y, width, height, rotationRad, textAlign);
        return { x, y, rotationRad, box, textAlign, fontSize: lineFontSize, lines, lineHeight };
      };

      let placement = tryPlace(finalAngle, finalRadiusOffset, baseFontSize);
      let placed = false;
      for (const scale of fontScales) {
        const fontSize = Math.max(7, Math.round(baseFontSize * scale));
        placement = tryPlace(finalAngle, finalRadiusOffset, fontSize);
        if (!config.layout.collision_enabled) {
          placed = true;
          finalFontSize = fontSize;
          break;
        }
        let collision = boxes.some((existing) => boxesOverlap(existing.box, placement.box));
        if (!collision) {
          placed = true;
          finalFontSize = fontSize;
          break;
        }
        let found = false;
        for (let i = 1; i <= maxAngleSteps; i += 1) {
          const offset = step * i;
          const candidates = [baseAngleDeg + offset, baseAngleDeg - offset];
          for (const candidate of candidates) {
            const test = tryPlace(candidate, baseRadiusOffset, fontSize);
            const overlaps = boxes.some((existing) => boxesOverlap(existing.box, test.box));
            if (!overlaps) {
              placement = test;
              finalAngle = candidate;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found && maxRadiusOffset > 0) {
          const radiusSteps = Math.max(1, Math.ceil(maxRadiusOffset / (geometry.radius * 0.004)));
          for (let i = 1; i <= radiusSteps; i += 1) {
            const offset = (maxRadiusOffset / radiusSteps) * i;
            const candidates = [baseRadiusOffset + offset, baseRadiusOffset - offset];
            for (const candidate of candidates) {
              const test = tryPlace(finalAngle, candidate, fontSize);
              const overlaps = boxes.some((existing) => boxesOverlap(existing.box, test.box));
              if (!overlaps) {
                placement = test;
                finalRadiusOffset = candidate;
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        if (found) {
          placed = true;
          finalFontSize = fontSize;
          break;
        }
      }

      if (!placement) return;
      if (!placed) {
        finalFontSize = placement.fontSize ?? finalFontSize;
      }
      ctx.save();
      ctx.translate(placement.x, placement.y);
      ctx.rotate(placement.rotationRad);
      ctx.textAlign = placement.textAlign;
      ctx.font = `600 ${finalFontSize}px ${config.visual.label_font_family}`;
      const lines = placement.lines || [label.text || ''];
      const lineHeight = placement.lineHeight || finalFontSize * 1.05;
      const offsetY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line: string, idx: number) => {
        ctx.fillText(line, 0, offsetY + idx * lineHeight);
      });
      ctx.restore();

      placedBox = placement.box;
      boxes.push({ box: placedBox });
      hitBoxes.push({
        labelId: label.label_id,
        toneId: label.parent_tone_id,
        radialLayer: label.radial_layer,
        text: label.text || '',
        angleDeg: finalAngle,
        radius: baseRadius + finalRadiusOffset,
        flipped,
        align,
        box: placedBox
      });
    });
  });

  return hitBoxes;
};

export const drawStaticLayer = (
  ctx: CanvasRenderingContext2D,
  layout: Hunt205Layout,
  toneAngles: Map<number, ToneAngle>,
  geometry: RingGeometry,
  config: Hunt205RingConfig,
  showAllLabels: boolean,
  showPrimaryLabels: boolean
) => {
  ctx.clearRect(0, 0, geometry.size, geometry.size);
  ctx.save();

  const labelRingRadii = geometry.labelRings && geometry.labelRings.length > 0
    ? geometry.labelRings
    : [geometry.layers.labelOuter, geometry.layers.labelInner];

  ctx.strokeStyle = config.visual.ring_stroke;
  ctx.lineWidth = config.visual.ring_stroke_width;
  labelRingRadii.forEach((radius) => {
    ctx.beginPath();
    ctx.arc(geometry.centerX, geometry.centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.arc(geometry.centerX, geometry.centerY, geometry.layers.toneLabel, 0, Math.PI * 2);
  ctx.stroke();

  const tickLen = config.visual.tick_length_px;
  ctx.strokeStyle = config.visual.tick_stroke;
  ctx.lineWidth = 1;

  const angleStep = (Math.PI * 2) / Math.max(1, layout.tones.length || 41);
  const gridOuter = Math.max(...labelRingRadii);
  const gridInner = Math.min(...labelRingRadii);

  for (let i = 0; i < (layout.tones.length || 41); i += 1) {
    const angle = (i / (layout.tones.length || 41)) * Math.PI * 2 - Math.PI / 2 - angleStep / 2;
    const xOuter = geometry.centerX + gridOuter * Math.cos(angle);
    const yOuter = geometry.centerY + gridOuter * Math.sin(angle);
    const xInner = geometry.centerX + gridInner * Math.cos(angle);
    const yInner = geometry.centerY + gridInner * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(xInner, yInner);
    ctx.lineTo(xOuter, yOuter);
    ctx.stroke();
  }

  const tonePoints: TonePoint[] = [];
  layout.tones.forEach((tone) => {
    const angle = toneAngles.get(tone.tone_id);
    if (!angle) return;
    const rad = angle.angleRad;
    const xOuter = geometry.centerX + (geometry.layers.toneLabel + tickLen) * Math.cos(rad);
    const yOuter = geometry.centerY + (geometry.layers.toneLabel + tickLen) * Math.sin(rad);
    const xInner = geometry.centerX + (geometry.layers.toneLabel - tickLen) * Math.cos(rad);
    const yInner = geometry.centerY + (geometry.layers.toneLabel - tickLen) * Math.sin(rad);
    ctx.beginPath();
    ctx.moveTo(xInner, yInner);
    ctx.lineTo(xOuter, yOuter);
    ctx.stroke();

    const dotX = geometry.centerX + geometry.layers.dotInactive * Math.cos(rad);
    const dotY = geometry.centerY + geometry.layers.dotInactive * Math.sin(rad);
    tonePoints.push({ toneId: tone.tone_id, x: dotX, y: dotY });
  });

  ctx.fillStyle = config.visual.inactive_dot_color;
  tonePoints.forEach((tone) => {
    ctx.beginPath();
    ctx.arc(tone.x, tone.y, config.anim.inactive_dot_radius_px, 0, Math.PI * 2);
    ctx.fill();
  });

  if (showPrimaryLabels) {
    const primaryFontSize = Math.max(9, Math.round(geometry.radius * config.visual.primary_label_font_scale));
    ctx.font = `700 ${primaryFontSize}px ${config.visual.label_font_family}`;
    ctx.fillStyle = config.visual.primary_label_color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    layout.tones.forEach((tone) => {
      const angle = toneAngles.get(tone.tone_id);
      if (!angle) return;
      const rad = angle.angleRad;
      const x = geometry.centerX + geometry.layers.toneLabel * Math.cos(rad);
      const y = geometry.centerY + geometry.layers.toneLabel * Math.sin(rad);
      ctx.fillText(tone.primary_label || '', x, y);
    });
  }

  const labelHitBoxes = showAllLabels
    ? placeLabels(ctx, layout.labels, layout.tones, toneAngles, geometry, config)
    : [];

  ctx.restore();
  return { labelHitBoxes, tonePoints };
};

export const drawLabelLayer = (
  ctx: CanvasRenderingContext2D,
  layout: Hunt205Layout,
  toneAngles: Map<number, ToneAngle>,
  geometry: RingGeometry,
  config: Hunt205RingConfig,
  showAllLabels: boolean,
  showPrimaryLabels: boolean
) => {
  ctx.clearRect(0, 0, geometry.size, geometry.size);
  ctx.save();

  if (showPrimaryLabels) {
    const primaryFontSize = Math.max(9, Math.round(geometry.radius * config.visual.primary_label_font_scale));
    ctx.font = `700 ${primaryFontSize}px ${config.visual.label_font_family}`;
    ctx.fillStyle = config.visual.primary_label_color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    layout.tones.forEach((tone) => {
      const angle = toneAngles.get(tone.tone_id);
      if (!angle) return;
      const rad = angle.angleRad;
      const x = geometry.centerX + geometry.layers.toneLabel * Math.cos(rad);
      const y = geometry.centerY + geometry.layers.toneLabel * Math.sin(rad);
      ctx.fillText(tone.primary_label || '', x, y);
    });
  }

  const labelHitBoxes = showAllLabels
    ? placeLabels(ctx, layout.labels, layout.tones, toneAngles, geometry, config)
    : [];

  ctx.restore();
  return { labelHitBoxes };
};

export const computeToneStates = (
  bindings: Array<{ tone_id: number; start_time_ms: number; end_time_ms: number; velocity: number; approx?: boolean }>,
  playheadMs: number,
  config: Hunt205RingConfig
) => {
  const states = new Map<number, ToneState>();
  const minVisible = Math.max(0, config.anim.min_visible_ms);
  const upcomingWindow = config.upcoming.enabled ? Math.max(0, config.upcoming.window_ms) : 0;

  const getState = (toneId: number) => {
    if (!states.has(toneId)) {
      states.set(toneId, {
        toneId,
        activeCount: 0,
        activeVelocity: 0,
        releaseVelocity: 0,
        attackProgress: 0,
        releaseProgress: 0,
        intensity: 0,
        lastStartMs: Number.NEGATIVE_INFINITY,
        lastEndMs: Number.NEGATIVE_INFINITY,
        approxCount: 0,
        upcomingStartMs: Number.POSITIVE_INFINITY
      });
    }
    return states.get(toneId)!;
  };

  bindings.forEach((binding) => {
    const state = getState(binding.tone_id);
    const start = binding.start_time_ms;
    const end = Math.max(binding.end_time_ms, start + minVisible);
    const velocity = Math.max(0, Math.min(1, binding.velocity ?? 0));
    if (binding.approx) state.approxCount += 1;

    if (playheadMs >= start && playheadMs <= end) {
      state.activeCount += 1;
      if (velocity > state.activeVelocity) {
        state.activeVelocity = velocity;
      }
      if (start > state.lastStartMs) {
        state.lastStartMs = start;
      }
    } else if (playheadMs > end) {
      if (end > state.lastEndMs) {
        state.lastEndMs = end;
        state.releaseVelocity = velocity;
      }
    }

    if (upcomingWindow > 0 && start > playheadMs && start <= playheadMs + upcomingWindow) {
      if (start < state.upcomingStartMs) {
        state.upcomingStartMs = start;
      }
    }
  });

  states.forEach((state) => {
    if (state.activeCount > 0) {
      const attackMs = Math.max(1, config.anim.attack_ms);
      state.attackProgress = Math.min(1, Math.max(0, (playheadMs - state.lastStartMs) / attackMs));
      state.releaseProgress = 0;
      state.intensity = state.attackProgress;
    } else {
      const releaseMs = Math.max(1, config.anim.release_ms);
      const delta = playheadMs - state.lastEndMs;
      if (Number.isFinite(delta) && delta >= 0 && delta <= releaseMs) {
        state.releaseProgress = 1 - delta / releaseMs;
      } else {
        state.releaseProgress = 0;
      }
      state.intensity = state.releaseProgress;
    }
  });

  return states;
};

export const drawDynamicLayer = (
  ctx: CanvasRenderingContext2D,
  toneStates: Map<number, ToneState>,
  tonePoints: TonePoint[],
  geometry: RingGeometry,
  config: Hunt205RingConfig,
  playheadMs: number,
  debug: boolean,
  labelBoxes: LabelHitBox[]
) => {
  ctx.save();

  const pulseEnabled = config.anim.pulse_enabled;
  const pulsePhase = pulseEnabled ? (playheadMs % config.anim.pulse_period_ms) / config.anim.pulse_period_ms : 0;
  const pulseValue = pulseEnabled ? (1 + Math.sin(pulsePhase * Math.PI * 2)) / 2 : 0;

  tonePoints.forEach((tone) => {
    const state = toneStates.get(tone.toneId);
    if (!state) return;
    const intensity = state.intensity;
    const velocity = state.activeCount > 0 ? state.activeVelocity : state.releaseVelocity;
    if (intensity <= 0) {
      return;
    }
    const pulseScale = pulseEnabled ? 1 + config.anim.pulse_depth_ratio * pulseValue : 1;
    const baseRadius = config.anim.inactive_dot_radius_px;
    const targetRadius = baseRadius + config.anim.active_dot_radius_gain_px * velocity;
    const radius = baseRadius + (targetRadius - baseRadius) * intensity * pulseScale;
    const glowAlpha = Math.min(1, (config.anim.glow_alpha_base + config.anim.glow_alpha_gain * velocity) * intensity);
    const glowBlur = config.anim.glow_blur_base_px + config.anim.glow_blur_gain_px * velocity;

    ctx.beginPath();
    ctx.fillStyle = config.visual.active_dot_color;
    ctx.shadowColor = config.visual.glow_color;
    ctx.shadowBlur = glowBlur;
    ctx.globalAlpha = glowAlpha;
    ctx.arc(tone.x, tone.y, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = config.visual.active_dot_color;
    ctx.arc(tone.x, tone.y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  if (config.upcoming.enabled) {
    const windowMs = Math.max(1, config.upcoming.window_ms);
    tonePoints.forEach((tone) => {
      const state = toneStates.get(tone.toneId);
      if (!state || !Number.isFinite(state.upcomingStartMs)) return;
      if (state.upcomingStartMs === Number.POSITIVE_INFINITY) return;
      const delta = state.upcomingStartMs - playheadMs;
      if (delta <= 0 || delta > windowMs) return;
      const t = 1 - delta / windowMs;
      ctx.save();
      ctx.strokeStyle = config.visual.upcoming_color;
      ctx.globalAlpha = Math.max(0.1, t * 0.6);
      ctx.lineWidth = config.visual.upcoming_stroke_width;
      ctx.beginPath();
      ctx.arc(tone.x, tone.y, config.anim.inactive_dot_radius_px * (1.6 + t), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  ctx.restore();
};

export const drawDebugLayer = (
  ctx: CanvasRenderingContext2D,
  tonePoints: TonePoint[],
  labelBoxes: LabelHitBox[],
  config: Hunt205RingConfig
) => {
  ctx.save();
  ctx.font = `600 9px ${config.visual.label_font_family}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  tonePoints.forEach((tone) => {
    ctx.fillText(String(tone.toneId), tone.x, tone.y - 12);
  });

  labelBoxes.forEach((box) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(box.box.x, box.box.y, box.box.width, box.box.height);
  });
  ctx.restore();
};
