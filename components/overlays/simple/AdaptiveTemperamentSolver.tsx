import React, { useMemo, useState } from 'react';
import type { AppSettings } from '../../../types';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type {
  CurveShape,
  OctaAnchor,
  OctaveModel,
  SolverOutput
} from '../../../utils/temperamentSolver';
import { OCTA_ANCHORS } from '../../../utils/temperamentSolver';
import { AdvancedConstraintsPanel } from './adaptiveTemperamentSolver/AdvancedConstraintsPanel';
import { ClassicModePanel } from './adaptiveTemperamentSolver/ClassicModePanel';
import { EnlargedChartModal } from './adaptiveTemperamentSolver/EnlargedChartModal';
import { HeaderBar } from './adaptiveTemperamentSolver/HeaderBar';
import { ResultsSection } from './adaptiveTemperamentSolver/ResultsSection';
import { DEFAULT_RATIOS, FIFTHS_CIRCLE, NOTE_NAMES } from './adaptiveTemperamentSolver/constants';
import { createSolverActions } from './adaptiveTemperamentSolver/solverActions';
import type { UiRatioSpec } from './adaptiveTemperamentSolver/types';
import { useAdvancedIntervals } from './adaptiveTemperamentSolver/useAdvancedIntervals';
import { useScalePlayback } from './adaptiveTemperamentSolver/useScalePlayback';
import { useScalaArchiveMatch } from './adaptiveTemperamentSolver/useScalaArchiveMatch';
import { useSolverDerived } from './adaptiveTemperamentSolver/useSolverDerived';
import { useSolverVisuals } from './adaptiveTemperamentSolver/useSolverVisuals';

export const AdaptiveTemperamentSolver: React.FC<{ settings: AppSettings }> = ({ settings }) => {
  // --- Store ---
  const {
    saveMidiScale,
    updateSettings
  } = useStore((s) => ({
    saveMidiScale: s.saveMidiScale,
    updateSettings: s.updateSettings
  }), shallow);
  // --- State ---
  const [N, setN] = useState<number>(12);
  const [baseFrequency, setBaseFrequency] = useState<number>(440);
  const [octaveModel, setOctaveModel] = useState<OctaveModel>('perfect');
  const [octaveCentsOverride, setOctaveCentsOverride] = useState<number>(1200);

  const [globalTol, setGlobalTol] = useState<number>(7);
  const [centerKey, setCenterKey] = useState<string>('C');
  const [rangeFlats, setRangeFlats] = useState<number>(3);
  const [rangeSharps, setRangeSharps] = useState<number>(4);

  const [wolfMode, setWolfMode] = useState<'auto' | 'manual'>('auto');
  const [manualWolfIndex, setManualWolfIndex] = useState<number>(0);

  // Use string maps for UI, map to 'ModeA'/'ModeB' for logic
  const [solverModeUi, setSolverModeUi] = useState<'regular' | 'irregular'>('regular');
  const [weightThirds, setWeightThirds] = useState<number>(0.5); // Meantone Weight
  const [curveShape, setCurveShape] = useState<CurveShape>('symmetrical');
  const [constrainMinor3rds, setConstrainMinor3rds] = useState<boolean>(false); // For 19-TET or minor-focused scales

  // Generate wolf position labels for dropdown (e.g., "G# – Eb", "B – F#")
  const wolfPositionLabels = useMemo(() => {
    const labels: { index: number; label: string }[] = [];
    for (let i = 0; i < N; i++) {
      if (N === 12) {
        const fifthsFrom = FIFTHS_CIRCLE[i];
        const fifthsTo = FIFTHS_CIRCLE[(i + 1) % 12];
        labels.push({ index: i, label: `${fifthsFrom} – ${fifthsTo}` });
      } else {
        labels.push({ index: i, label: `deg${i} – deg${(i + 1) % N}` });
      }
    }
    return labels;
  }, [N]);

  const [customRatioText, setCustomRatioText] = useState<string>('');
  const [ratioSpecs, setRatioSpecs] = useState<UiRatioSpec[]>(DEFAULT_RATIOS);
  const [scaleSaveName, setScaleSaveName] = useState<string>('');
  const [scaleName, setScaleName] = useState<string>('');

  // Modal for enlarged chart view
  const [enlargedChart, setEnlargedChart] = useState<'radar' | 'heatmap' | null>(null);  // For saving to customize mapping

  // Quad-Weighting Compass state (Mode A advanced)
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>({});
  const [quadEnabled, setQuadEnabled] = useState<boolean>(true);
  const [octaEnabled, setOctaEnabled] = useState<boolean>(false);
  const [octaX, setOctaX] = useState<number>(0.5);
  const [octaY, setOctaY] = useState<number>(0.5);
  const [octaZ, setOctaZ] = useState<number>(0.5);
  const [octaTargets, setOctaTargets] = useState<OctaAnchor[]>(() => OCTA_ANCHORS.map(anchor => ({ ...anchor })));

  const updateOctaTarget = (id: string, field: 'n' | 'd', rawValue: string) => {
    const value = parseInt(rawValue, 10);
    if (!Number.isFinite(value) || value < 1) return;
    setOctaTargets(prev => prev.map(t => (t.id === id ? { ...t, [field]: value } : t)));
  };

  // Rank-2 optimization: Octave Stretch control
  // 1.0 = Rigid (locked at 1200¢), 0.0 = Fluid (allows stretch)
  const [octaveStiffness, setOctaveStiffness] = useState<number>(1.0);

  // Individual tolerance overrides per ratio
  const [individualTolerances, setIndividualTolerances] = useState<Record<string, number>>({});

  // --- Advanced Constraints State ---
  const [advancedModeEnabled, setAdvancedModeEnabled] = useState<boolean>(false);
  const {
    boundaryNumerator,
    boundaryDenominator,
    boundaryRatio,
    boundaryCents,
    normalizeRatioToBoundary,
    updateBoundaryRatio,
    advancedIntervals,
    addAdvancedInterval,
    updateAdvancedInterval,
    removeAdvancedInterval,
    newIntervalDegree,
    setNewIntervalDegree,
    newIntervalRatio,
    setNewIntervalRatio,
    newIntervalTolerance,
    setNewIntervalTolerance,
    newIntervalPriority,
    setNewIntervalPriority,
    newIntervalHardMax,
    setNewIntervalHardMax,
    octaveTolerance,
    setOctaveTolerance,
    octavePriority,
    setOctavePriority,
    octaveHardMax,
    setOctaveHardMax
  } = useAdvancedIntervals({ N });

  // --- Target Interval Management ---
  const [targetState, setTargetState] = useState<Record<string, boolean>>({});

  // --- Logic Output State ---
  const [result, setResult] = useState<SolverOutput | null>(null);
  const [status, setStatus] = useState<string>('');
  const {
    octaveCents,
    targetsRaw,
    targetsWithEnabled,
    octaWeights,
    octaEntries,
    octaTopSummary,
    octaDetuning
  } = useSolverDerived({
    N,
    octaveModel,
    octaveCentsOverride,
    ratioSpecs,
    targetState,
    setTargetState,
    result,
    octaX,
    octaY,
    octaZ,
    octaTargets
  });

  // --- Privileged Keys (UI Visualization only, Logic handles internally) ---
  const privilegedKeys = useMemo(() => {
    const idx = FIFTHS_CIRCLE.indexOf(centerKey);
    if (idx < 0) return [0];
    const picks: string[] = [];
    for (let i = -rangeFlats; i <= rangeSharps; i++) {
      const j = (idx + i + 12) % 12; // wraps 0..11
      picks.push(FIFTHS_CIRCLE[j]);
    }
    const nameToPc = (nm: string) => NOTE_NAMES.indexOf(nm);
    return Array.from(new Set(picks.map(nameToPc).filter(v => v >= 0)));
  }, [centerKey, rangeFlats, rangeSharps]);

  const { radarRef, heatRef } = useSolverVisuals({
    result,
    globalTol,
    privilegedKeys,
    targetState,
    targetsRaw,
    individualTolerances,
    advancedModeEnabled,
    advancedIntervals
  });

  const { isPlayingScale, playDegreeDyad, playEntireScale, stopScalePlayback } = useScalePlayback({ result, settings });
  const { match: scalaMatch, status: scalaMatchStatus } = useScalaArchiveMatch(result);

  const { calculate, exportFiles, saveToCustomMapping, applyToMidiMapping } = createSolverActions({
    N,
    baseFrequency,
    octaveModel,
    octaveCents,
    globalTol,
    centerKey,
    rangeFlats,
    rangeSharps,
    wolfMode,
    manualWolfIndex,
    solverModeUi,
    weightThirds,
    curveShape,
    constrainMinor3rds,
    targetWeights,
    quadEnabled,
    octaEnabled,
    octaX,
    octaY,
    octaZ,
    octaTargets,
    octaveStiffness,
    advancedModeEnabled,
    boundaryNumerator,
    boundaryDenominator,
    boundaryCents,
    targetsWithEnabled,
    individualTolerances,
    advancedIntervals,
    octaveTolerance,
    octavePriority,
    octaveHardMax,
    result,
    settings,
    scaleName,
    setScaleName,
    saveMidiScale,
    updateSettings,
    setResult,
    setStatus
  });

  return (
    <>
      <div className="border border-indigo-500/40 bg-black/40 rounded-xl p-3 shadow-xl space-y-3">
        <HeaderBar
          advancedModeEnabled={advancedModeEnabled}
          onToggleMode={() => setAdvancedModeEnabled(!advancedModeEnabled)}
          onCalculate={calculate}
        />

        {advancedModeEnabled && (
          <AdvancedConstraintsPanel
            boundaryCents={boundaryCents}
            boundaryRatio={boundaryRatio}
            boundaryNumerator={boundaryNumerator}
            boundaryDenominator={boundaryDenominator}
            N={N}
            baseFrequency={baseFrequency}
            updateBoundaryRatio={updateBoundaryRatio}
            setN={setN}
            setBaseFrequency={setBaseFrequency}
            newIntervalDegree={newIntervalDegree}
            setNewIntervalDegree={setNewIntervalDegree}
            newIntervalRatio={newIntervalRatio}
            setNewIntervalRatio={setNewIntervalRatio}
            newIntervalTolerance={newIntervalTolerance}
            setNewIntervalTolerance={setNewIntervalTolerance}
            newIntervalPriority={newIntervalPriority}
            setNewIntervalPriority={setNewIntervalPriority}
            newIntervalHardMax={newIntervalHardMax}
            setNewIntervalHardMax={setNewIntervalHardMax}
            addAdvancedInterval={addAdvancedInterval}
            advancedIntervals={advancedIntervals}
            updateAdvancedInterval={updateAdvancedInterval}
            removeAdvancedInterval={removeAdvancedInterval}
            normalizeRatioToBoundary={normalizeRatioToBoundary}
            octaveTolerance={octaveTolerance}
            setOctaveTolerance={setOctaveTolerance}
            octavePriority={octavePriority}
            setOctavePriority={setOctavePriority}
            octaveHardMax={octaveHardMax}
            setOctaveHardMax={setOctaveHardMax}
          />
        )}
        {!advancedModeEnabled && (
          <ClassicModePanel
            N={N}
            setN={setN}
            baseFrequency={baseFrequency}
            setBaseFrequency={setBaseFrequency}
            octaveModel={octaveModel}
            setOctaveModel={setOctaveModel}
            octaveCentsOverride={octaveCentsOverride}
            setOctaveCentsOverride={setOctaveCentsOverride}
            globalTol={globalTol}
            setGlobalTol={setGlobalTol}
            targetsRaw={targetsRaw}
            targetState={targetState}
            setTargetState={setTargetState}
            individualTolerances={individualTolerances}
            setIndividualTolerances={setIndividualTolerances}
            customRatioText={customRatioText}
            setCustomRatioText={setCustomRatioText}
            ratioSpecs={ratioSpecs}
            setRatioSpecs={setRatioSpecs}
            wolfMode={wolfMode}
            setWolfMode={setWolfMode}
            manualWolfIndex={manualWolfIndex}
            setManualWolfIndex={setManualWolfIndex}
            wolfPositionLabels={wolfPositionLabels}
            solverModeUi={solverModeUi}
            setSolverModeUi={setSolverModeUi}
            octaEnabled={octaEnabled}
            setOctaEnabled={setOctaEnabled}
            octaX={octaX}
            octaY={octaY}
            setOctaX={setOctaX}
            setOctaY={setOctaY}
            octaZ={octaZ}
            setOctaZ={setOctaZ}
            octaTargets={octaTargets}
            updateOctaTarget={updateOctaTarget}
            targetWeights={targetWeights}
            setTargetWeights={setTargetWeights}
            quadEnabled={quadEnabled}
            setQuadEnabled={setQuadEnabled}
            weightThirds={weightThirds}
            setWeightThirds={setWeightThirds}
            curveShape={curveShape}
            setCurveShape={setCurveShape}
            constrainMinor3rds={constrainMinor3rds}
            setConstrainMinor3rds={setConstrainMinor3rds}
            centerKey={centerKey}
            setCenterKey={setCenterKey}
            rangeFlats={rangeFlats}
            setRangeFlats={setRangeFlats}
            rangeSharps={rangeSharps}
            setRangeSharps={setRangeSharps}
            result={result}
            octaveStiffness={octaveStiffness}
            setOctaveStiffness={setOctaveStiffness}
          />
        )}
        <ResultsSection
          status={status}
          result={result}
          globalTol={globalTol}
          radarRef={radarRef}
          heatRef={heatRef}
          onEnlargeChart={setEnlargedChart}
          isPlayingScale={isPlayingScale}
          playEntireScale={playEntireScale}
          stopScalePlayback={stopScalePlayback}
          playDegreeDyad={playDegreeDyad}
          settings={settings}
          exportFiles={exportFiles}
          scaleName={scaleName}
          setScaleName={setScaleName}
          saveToCustomMapping={saveToCustomMapping}
          applyToMidiMapping={applyToMidiMapping}
          scalaMatch={scalaMatch}
          scalaMatchStatus={scalaMatchStatus}
        />
      </div>

      <EnlargedChartModal
        enlargedChart={enlargedChart}
        onClose={() => setEnlargedChart(null)}
        result={result}
        advancedModeEnabled={advancedModeEnabled}
        advancedIntervals={advancedIntervals}
        targetsRaw={targetsRaw}
        targetState={targetState}
        individualTolerances={individualTolerances}
        globalTol={globalTol}
      />
    </>
  );
};
