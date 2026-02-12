import { useEffect, useMemo, useState } from 'react';
import { EDO_PRESETS } from '../../../constants';
import { generateEdoScale } from '../../../utils/midiFileRetune';
import { loadScalaScale, type ScalaArchiveScale } from '../../../utils/scalaArchive';
import { buildHChromaScale, buildNodeScale, snapScaleToLayout } from '../settingsTabsPart2/midiFileRetune/utils';

export const useRetuneOverlayScale = ({
  settings,
  nodes,
  targetMode,
  selectedScaleId,
  scalaScaleId,
  scalaSource,
  edoDivisions,
  retuneCustomScale,
  restrictToNodes,
  savedMidiScales
}: {
  settings: any;
  nodes: any[];
  targetMode: string;
  selectedScaleId: string;
  scalaScaleId: string | null;
  scalaSource: 'saved' | 'archive';
  edoDivisions: number;
  retuneCustomScale: string[];
  restrictToNodes: boolean;
  savedMidiScales: any[];
}) => {
  const layoutMode = settings?.visuals?.layoutMode || 'lattice';
  const [loadedScalaScale, setLoadedScalaScale] = useState<ScalaArchiveScale | null>(null);

  useEffect(() => {
    if (scalaSource !== 'archive' || !scalaScaleId) {
      setLoadedScalaScale(null);
      return;
    }
    let cancelled = false;
    loadScalaScale(scalaScaleId)
      .then((scale) => {
        if (!cancelled) setLoadedScalaScale(scale);
      })
      .catch(() => {
        if (!cancelled) setLoadedScalaScale(null);
      });
    return () => {
      cancelled = true;
    };
  }, [scalaSource, scalaScaleId]);

  const nodeScale = useMemo(() => buildNodeScale(nodes), [nodes]);
  const hChromaScale = useMemo(() => {
    const baseA = Math.max(1.01, Number(settings?.visuals?.hChromaBase ?? 2));
    const limit = Number(settings?.visuals?.hChromaLimit ?? 47);
    return buildHChromaScale(baseA, limit, settings?.visuals?.hChromaCustomScale);
  }, [settings?.visuals?.hChromaBase, settings?.visuals?.hChromaLimit, settings?.visuals?.hChromaCustomScale]);

  const layoutScale = useMemo(
    () => (layoutMode === 'h-chroma' ? hChromaScale : nodeScale),
    [layoutMode, hChromaScale, nodeScale]
  );

  const effectiveTargetScale = useMemo(() => {
    let scale: string[] = [];
    let nodeIdByScaleIndex: (string | null)[] = [];
    if (targetMode === 'lattice' || targetMode === 'dynamic') {
      scale = layoutScale.scale;
      nodeIdByScaleIndex = layoutScale.nodeIdByScaleIndex;
    } else if (targetMode === 'custom') {
      scale = retuneCustomScale || [];
      nodeIdByScaleIndex = scale.map(() => null);
    } else if (targetMode === 'scale') {
      if (scalaSource === 'archive') {
        scale = loadedScalaScale?.ratios ?? [];
      } else {
        const saved = savedMidiScales.find((s: any) => s.id === selectedScaleId);
        scale = saved?.scale ?? [];
      }
      nodeIdByScaleIndex = scale.map(() => null);
    } else {
      const divisions = Number.isFinite(edoDivisions) ? (edoDivisions as number) : 12;
      const preset = EDO_PRESETS[divisions];
      scale = preset ? [...preset] : generateEdoScale(divisions);
      nodeIdByScaleIndex = scale.map(() => null);
    }

    if (restrictToNodes && scale.length && targetMode !== 'lattice' && targetMode !== 'dynamic') {
      const snapped = snapScaleToLayout(scale, layoutScale);
      scale = snapped.scale;
      nodeIdByScaleIndex = snapped.nodeIdByScaleIndex;
    }

    if (!scale.length) {
      scale = ['1/1'];
      nodeIdByScaleIndex = [null];
    }

    if (!nodeIdByScaleIndex.length) {
      nodeIdByScaleIndex = scale.map(() => null);
    }

    return { scale, nodeIdByScaleIndex };
  }, [
    targetMode,
    layoutScale,
    retuneCustomScale,
    scalaSource,
    loadedScalaScale,
    savedMidiScales,
    selectedScaleId,
    edoDivisions,
    restrictToNodes
  ]);

  return { layoutMode, layoutScale, effectiveTargetScale };
};
