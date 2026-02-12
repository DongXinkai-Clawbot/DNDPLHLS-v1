import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Hunt205Layout } from './Hunt205LayoutLoader';
import { buildToneAngleTable } from './Hunt205LayoutLoader';
import type { ToneBinding } from './Hunt205ToneResolver';
import {
  DEFAULT_HUNT205_RING_CONFIG,
  buildRingGeometry,
  computeToneStates,
  drawDebugLayer,
  drawDynamicLayer,
  drawLabelLayer,
  drawStaticLayer,
  Hunt205RingConfig,
  LabelHitBox,
  TonePoint
} from './Hunt205RingRenderer';
import { Hunt205DebugOverlay } from './Hunt205DebugOverlay';

type Hunt205RingViewProps = {
  layout: Hunt205Layout;
  bindings: ToneBinding[];
  playheadMs: number;
  config?: Partial<Hunt205RingConfig>;
  sizePx: number;
  showAllLabels: boolean;
  showPreferredNames: boolean;
  rotationDeg: number;
  showUpcoming: boolean;
  debugEnabled: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const Hunt205RingView = ({
  layout,
  bindings,
  playheadMs,
  config,
  sizePx,
  showAllLabels,
  showPreferredNames,
  rotationDeg,
  showUpcoming,
  debugEnabled
}: Hunt205RingViewProps) => {
  const mergedConfig = useMemo(() => {
    const next: Hunt205RingConfig = JSON.parse(JSON.stringify(DEFAULT_HUNT205_RING_CONFIG));
    if (config) {
      next.layout = { ...next.layout, ...config.layout };
      next.visual = { ...next.visual, ...config.visual };
      next.anim = { ...next.anim, ...config.anim };
      next.upcoming = { ...next.upcoming, ...config.upcoming };
    }
    if (showPreferredNames) {
      const toneRing = next.layout.radius_ratios.tone_label;
      next.layout = {
        ...next.layout,
        label_rings: [1.0, toneRing],
        collision_enabled: false
      };
      next.visual = {
        ...next.visual,
        primary_label_font_scale: Math.max(next.visual.primary_label_font_scale, 0.04)
      };
    }
    next.upcoming.enabled = showUpcoming;
    return next;
  }, [config, showPreferredNames, showUpcoming]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const labelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayLayout = useMemo(() => {
    if (!showPreferredNames) return layout;
    const preferred = (layout.meta?.preferred_52 || []).slice(0, layout.tones.length || 41);
    const tones = layout.tones.map((tone, idx) => ({
      ...tone,
      primary_label: preferred[idx] || tone.primary_label
    }));
    return { ...layout, tones, labels: [] };
  }, [layout, showPreferredNames]);
  const toneAngles = useMemo(() => buildToneAngleTable(displayLayout), [displayLayout]);
  const adjustedAngles = useMemo(() => {
    const deltaDeg = Number.isFinite(rotationDeg) ? rotationDeg : 0;
    const deltaRad = (deltaDeg * Math.PI) / 180;
    const byToneId = new Map<number, ToneAngle>();
    toneAngles.list.forEach((entry) => {
      const angleRad = entry.angleRad + deltaRad;
      const angleDeg = entry.angleDeg + deltaDeg;
      byToneId.set(entry.toneId, { ...entry, angleRad, angleDeg });
    });
    return { byToneId };
  }, [rotationDeg, toneAngles]);
  const labelHitBoxesRef = useRef<LabelHitBox[]>([]);
  const tonePointsRef = useRef<TonePoint[]>([]);
  const perfRef = useRef({ lastTs: 0, windowStart: 0, frameCount: 0, lastMs: 0, avgMs: 0 });
  const prevActiveCountsRef = useRef<Map<number, number>>(new Map());

  const [hoverTone, setHoverTone] = useState<{
    toneId: number;
    primaryLabel: string;
    centValue: number;
    activeCount: number;
  } | null>(null);
  const [hoverLabel, setHoverLabel] = useState<{
    labelId: number;
    text: string;
    toneId: number;
    radialLayer: number;
    angleDeg: number;
    radius: number;
  } | null>(null);

  const bindingsByTone = useMemo(() => {
    const grouped = new Map<number, ToneBinding[]>();
    bindings.forEach((binding) => {
      const list = grouped.get(binding.tone_id) || [];
      list.push(binding);
      grouped.set(binding.tone_id, list);
    });
    grouped.forEach((list) => list.sort((a, b) => a.start_time_ms - b.start_time_ms));
    return grouped;
  }, [bindings]);

  const showLabels = !showPreferredNames && (showAllLabels || debugEnabled);
  const showPrimaryLabels = showPreferredNames || !showAllLabels;

  const resizeCanvas = (canvas: HTMLCanvasElement, size: number, dpr: number, scale: number) => {
    const ratio = Math.max(1, dpr * scale);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return ctx;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const renderScale = Number.isFinite(mergedConfig.visual.render_scale) ? mergedConfig.visual.render_scale : 1;
    const ctx = resizeCanvas(canvas, sizePx, dpr, renderScale);
    if (!ctx) return;

    if (!staticCanvasRef.current) {
      staticCanvasRef.current = document.createElement('canvas');
    }
    if (!labelCanvasRef.current) {
      labelCanvasRef.current = document.createElement('canvas');
    }
    const staticCanvas = staticCanvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    const staticCtx = resizeCanvas(staticCanvas, sizePx, dpr, renderScale);
    const labelCtx = resizeCanvas(labelCanvas, sizePx, dpr, renderScale);
    if (!staticCtx) return;
    if (!labelCtx) return;

    const geometry = buildRingGeometry(sizePx, mergedConfig);
    const { tonePoints } = drawStaticLayer(
      staticCtx,
      displayLayout,
      adjustedAngles.byToneId,
      geometry,
      mergedConfig,
      false,
      false
    );
    tonePointsRef.current = tonePoints;

    const labelResult = drawLabelLayer(
      labelCtx,
      displayLayout,
      adjustedAngles.byToneId,
      geometry,
      mergedConfig,
      showLabels,
      showPrimaryLabels
    );
    labelHitBoxesRef.current = labelResult.labelHitBoxes;

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.drawImage(staticCanvas, 0, 0, sizePx, sizePx);
    ctx.drawImage(labelCanvas, 0, 0, sizePx, sizePx);
  }, [adjustedAngles.byToneId, debugEnabled, displayLayout, mergedConfig, showAllLabels, showLabels, showPrimaryLabels, sizePx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    const labelCanvas = labelCanvasRef.current;
    if (!canvas || !staticCanvas || !labelCanvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const geometry = buildRingGeometry(sizePx, mergedConfig);
    const toneStates = computeToneStates(bindings, playheadMs, mergedConfig);

    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.drawImage(staticCanvas, 0, 0, sizePx, sizePx);
    drawDynamicLayer(
      ctx,
      toneStates,
      tonePointsRef.current,
      geometry,
      mergedConfig,
      playheadMs,
      false,
      labelHitBoxesRef.current
    );
    ctx.drawImage(labelCanvas, 0, 0, sizePx, sizePx);
    if (debugEnabled) {
      drawDebugLayer(ctx, tonePointsRef.current, labelHitBoxesRef.current, mergedConfig);
    }
  }, [bindings, debugEnabled, mergedConfig, playheadMs, sizePx]);

  const toneStates = useMemo(() => computeToneStates(bindings, playheadMs, mergedConfig), [bindings, playheadMs, mergedConfig]);
  const activeTones = useMemo(() => {
    return Array.from(toneStates.values())
      .filter((state) => state.activeCount > 0)
      .sort((a, b) => b.activeVelocity - a.activeVelocity)
      .map((state) => ({
        toneId: state.toneId,
        count: state.activeCount,
        velocity: clamp(state.activeVelocity || state.releaseVelocity, 0, 1),
        approxCount: state.approxCount
      }));
  }, [toneStates]);

  useEffect(() => {
    if (!debugEnabled || typeof window === 'undefined') return;
    const now = performance.now();
    const perf = perfRef.current;
    if (perf.lastTs > 0) {
      perf.lastMs = now - perf.lastTs;
    }
    perf.lastTs = now;
    perf.frameCount += 1;
    if (perf.windowStart === 0) {
      perf.windowStart = now;
    }
    const windowMs = now - perf.windowStart;
    if (windowMs >= 1000 && perf.frameCount > 0) {
      perf.avgMs = windowMs / perf.frameCount;
      const fps = perf.avgMs > 0 ? 1000 / perf.avgMs : 0;
      (window as any).__hunt205RingPerf = {
        fps: Number(fps.toFixed(1)),
        avgMs: Number(perf.avgMs.toFixed(2)),
        lastMs: Number(perf.lastMs.toFixed(2)),
        sampleMs: Number(windowMs.toFixed(1)),
        frames: perf.frameCount
      };
      perf.windowStart = now;
      perf.frameCount = 0;
    }
  }, [debugEnabled, playheadMs]);

  useEffect(() => {
    if (!debugEnabled || typeof window === 'undefined') return;
    const prevCounts = prevActiveCountsRef.current;
    const recent: Array<{
      type: 'note_on' | 'note_off';
      toneId: number;
      eventId: string | null;
      playheadMs: number;
      eventStartMs: number | null;
      eventEndMs: number | null;
      latencyMs: number | null;
      velocity: number;
      activeCount: number;
    }> = [];

    const findClosestBinding = (toneId: number) => {
      const list = bindingsByTone.get(toneId) || [];
      if (list.length === 0) return null;
      let candidate: ToneBinding | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      list.forEach((binding) => {
        const withinWindow = playheadMs >= binding.start_time_ms - 10 && playheadMs <= binding.end_time_ms + mergedConfig.anim.release_ms;
        if (!withinWindow) return;
        const distance = Math.abs(playheadMs - binding.start_time_ms);
        if (distance < bestDistance) {
          bestDistance = distance;
          candidate = binding;
        }
      });
      return candidate;
    };

    toneStates.forEach((state) => {
      const prevCount = prevCounts.get(state.toneId) || 0;
      if (prevCount === 0 && state.activeCount > 0) {
        const binding = findClosestBinding(state.toneId);
        const latency = binding ? playheadMs - binding.start_time_ms : null;
        recent.push({
          type: 'note_on',
          toneId: state.toneId,
          eventId: binding?.event_id ?? null,
          playheadMs,
          eventStartMs: binding?.start_time_ms ?? null,
          eventEndMs: binding?.end_time_ms ?? null,
          latencyMs: latency !== null ? Number(latency.toFixed(2)) : null,
          velocity: Number((state.activeVelocity || 0).toFixed(3)),
          activeCount: state.activeCount
        });
      }
      if (prevCount > 0 && state.activeCount === 0 && state.releaseProgress > 0) {
        const binding = findClosestBinding(state.toneId);
        const latency = binding ? playheadMs - (binding.end_time_ms ?? playheadMs) : null;
        recent.push({
          type: 'note_off',
          toneId: state.toneId,
          eventId: binding?.event_id ?? null,
          playheadMs,
          eventStartMs: binding?.start_time_ms ?? null,
          eventEndMs: binding?.end_time_ms ?? null,
          latencyMs: latency !== null ? Number(latency.toFixed(2)) : null,
          velocity: Number((state.releaseVelocity || 0).toFixed(3)),
          activeCount: 0
        });
      }
      prevCounts.set(state.toneId, state.activeCount);
    });

    if (recent.length > 0) {
      const bucket = (window as any).__hunt205RingEvents || [];
      const nextBucket = [...bucket, ...recent].slice(-200);
      (window as any).__hunt205RingEvents = nextBucket;
      console.debug('[Hunt205Ring][State]', recent);
    }
  }, [bindingsByTone, debugEnabled, mergedConfig.anim.release_ms, playheadMs, toneStates]);

  const recentEvents = useMemo(() => {
    return bindings
      .filter((b) => b.start_time_ms <= playheadMs)
      .sort((a, b) => b.start_time_ms - a.start_time_ms)
      .slice(0, 20)
      .map((b) => ({
        eventId: b.event_id,
        toneId: b.tone_id,
        method: b.match_method,
        distanceCents: b.distance_cents,
        approx: !!b.approx
      }));
  }, [bindings, playheadMs]);

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let nextLabel: typeof hoverLabel = null;
    for (const label of labelHitBoxesRef.current) {
      if (
        x >= label.box.x &&
        x <= label.box.x + label.box.width &&
        y >= label.box.y &&
        y <= label.box.y + label.box.height
      ) {
        nextLabel = {
          labelId: label.labelId,
          text: label.text,
          toneId: label.toneId,
          radialLayer: label.radialLayer,
          angleDeg: label.angleDeg,
          radius: label.radius
        };
        break;
      }
    }
    setHoverLabel(nextLabel);

    let closestTone: typeof hoverTone = null;
    let closestDist = Number.POSITIVE_INFINITY;
    tonePointsRef.current.forEach((tone) => {
      const dx = x - tone.x;
      const dy = y - tone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestTone = tone;
      }
    });
    if (closestTone && closestDist <= mergedConfig.anim.inactive_dot_radius_px * 2.6) {
      const toneLayout = displayLayout.tones.find((t) => t.tone_id === closestTone.toneId);
      const activeCount = toneStates.get(closestTone.toneId)?.activeCount ?? 0;
      setHoverTone({
        toneId: closestTone.toneId,
        primaryLabel: toneLayout?.primary_label || `Tone ${closestTone.toneId}`,
        centValue: Number.isFinite(toneLayout?.cent_value) ? (toneLayout?.cent_value as number) : 0,
        activeCount
      });
    } else {
      setHoverTone(null);
    }
  };

  const handlePointerLeave = () => {
    setHoverLabel(null);
    setHoverTone(null);
  };

  return (
    <div className="relative" style={{ width: `${sizePx}px`, height: `${sizePx}px` }}>
      <canvas
        ref={canvasRef}
        className="block"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      />
      {debugEnabled && (
        <Hunt205DebugOverlay
          activeTones={activeTones}
          hoverTone={hoverTone}
          hoverLabel={hoverLabel}
          recentEvents={recentEvents}
        />
      )}
    </div>
  );
};
