import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings } from '../../../../types';
import type {
  AdvancedIntervalSpec,
  CurveShape,
  KeySpecificity,
  OctaAnchor,
  OctaveModel,
  RatioSpec as CoreRatioSpec,
  SolverInput,
  SolverMode,
  SolverOutput
} from '../../../../utils/temperamentSolver';
import { centsToRatioApprox } from '../../../../utils/temperamentSolver/exporters';
import { runSolver } from '../../../../utils/temperamentSolver/runner';
import { NOTE_NAMES } from './constants';
import type { AdvancedIntervalItem, TargetItem } from './types';
import { fmt } from './utils';
import { createLogger } from '../../../../utils/logger';
import { notifySuccess } from '../../../../utils/notifications';

type SolverActionsParams = {
  N: number;
  baseFrequency: number;
  octaveModel: OctaveModel;
  octaveCents: number;
  globalTol: number;
  centerKey: string;
  rangeFlats: number;
  rangeSharps: number;
  wolfMode: 'auto' | 'manual';
  manualWolfIndex: number;
  solverModeUi: 'regular' | 'irregular';
  weightThirds: number;
  curveShape: CurveShape;
  constrainMinor3rds: boolean;
  targetWeights: Record<string, number>;
  quadEnabled: boolean;
  octaEnabled: boolean;
  octaX: number;
  octaY: number;
  octaZ: number;
  octaTargets: OctaAnchor[];
  octaveStiffness: number;
  advancedModeEnabled: boolean;
  boundaryNumerator: number;
  boundaryDenominator: number;
  boundaryCents: number;
  targetsWithEnabled: TargetItem[];
  individualTolerances: Record<string, number>;
  advancedIntervals: AdvancedIntervalItem[];
  octaveTolerance: number;
  octavePriority: number;
  octaveHardMax: string;
  result: SolverOutput | null;
  settings: AppSettings;
  scaleName: string;
  setScaleName: Dispatch<SetStateAction<string>>;
  saveMidiScale: (name: string, ratios: string[]) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setResult: Dispatch<SetStateAction<SolverOutput | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
};

const log = createLogger('temperament/solver-actions');

export const createSolverActions = ({
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
}: SolverActionsParams) => {
  const calculate = () => {
    try {
      setStatus('Calculating...');
      // 1. Build Solver Input
      const tonicPc = NOTE_NAMES.indexOf(centerKey);
      const keySpecificity: KeySpecificity = {
        tonic: tonicPc >= 0 ? tonicPc : 0,
        flats: rangeFlats,
        sharps: rangeSharps
      };

      // Build targets with individual tolerances
      const logicTargets: CoreRatioSpec[] = advancedModeEnabled
        ? []
        : targetsWithEnabled
          .filter(t => t.enabled)
          .map(t => {
            const key = `${t.n}/${t.d}`;
            const individualTol = individualTolerances[key];
            return {
              n: t.n,
              d: t.d,
              label: t.label,
              tolerance: individualTol !== undefined && individualTol > 0 ? individualTol : undefined
            };
          });

      const solverMode: SolverMode = advancedModeEnabled ? 'ModeB' : (solverModeUi === 'regular' ? 'ModeA' : 'ModeB');
      const octaveModelForSolve: OctaveModel = advancedModeEnabled
        ? ((boundaryNumerator === 2 && boundaryDenominator === 1)
          ? (octavePriority > 0 ? 'stretched' : 'perfect')
          : 'non_octave')
        : octaveModel;
      const cycleCentsForSolve = advancedModeEnabled ? boundaryCents : octaveCents;

      const advancedIntervalsInput: AdvancedIntervalSpec[] = advancedIntervals.map(interval => ({
        degree: interval.degree,
        n: interval.n,
        d: interval.d,
        label: `${interval.n}/${interval.d}`,
        toleranceCents: interval.toleranceCents,
        priority: interval.priority,
        maxErrorCents: interval.maxErrorCents
      }));

      const input: SolverInput = {
        scaleSize: N,
        baseFrequencyHz: baseFrequency,
        baseMidiNote: 69, // Standard A4 convention
        octaveModel: octaveModelForSolve,
        cycleCents: cycleCentsForSolve,
        targets: logicTargets,
        globalToleranceCents: globalTol,
        keySpecificity: keySpecificity,
        constrainMinor3rds: constrainMinor3rds, // For 19-TET or minor-focused tunings
        wolfPlacement: wolfMode,
        wolfEdgeIndex: wolfMode === 'manual' ? manualWolfIndex : undefined,
        mode: solverMode,
        meantoneWeight: weightThirds,
        curveShape: curveShape,
        // Quad-Weighting Compass: pass target weights for Mode A advanced mode
        targetWeights: solverMode === 'ModeA' && !octaEnabled && quadEnabled ? targetWeights : undefined,
        octaWeighting: solverMode === 'ModeA' && octaEnabled
          ? { enabled: true, x: octaX, y: octaY, z: octaZ, targets: octaTargets }
          : undefined,
        // Rank-2 optimization: octave stiffness (only effective when octaWeighting is enabled)
        octaveStiffness: solverMode === 'ModeA' && octaEnabled ? octaveStiffness : undefined,
        advancedConstraints: advancedModeEnabled
          ? {
            enabled: true,
            intervals: advancedIntervalsInput,
            octave: {
              toleranceCents: Math.max(0.01, octaveTolerance),
              priority: Math.max(0, octavePriority),
              maxErrorCents: octaveHardMax.trim() === '' ? undefined : Math.max(0.01, parseFloat(octaveHardMax))
            }
          }
          : undefined
      };

      // 2. Run Solver
      const output = runSolver(input);

      // 3. Set Result
      setResult(output);
      const statusMode = advancedModeEnabled
        ? 'Advanced Constraints'
        : `Optimization: ${solverMode} / ${wolfMode === 'auto' ? 'Auto Wolf' : 'Manual Wolf'}`;
      setStatus(`Success. ${statusMode}. Max Error: ${fmt(output.maxAbsErrorCents)}¢`);

    } catch (e: any) {
      log.error('Solver failed', e);
      setResult(null);
      setStatus(`Error: ${e.message}`);
    }
  };

  const exportFiles = (kind: 'scl' | 'kbm' | 'csv' | 'syx-bulk' | 'syx-single') => {
    if (!result) return;
    let filename = 'temperament.txt';
    let blob: Blob;

    if (kind === 'scl') {
      blob = new Blob([result.sclText], { type: 'text/plain' });
      filename = 'harmonia_universalis.scl';
    } else if (kind === 'kbm') {
      blob = new Blob([result.kbmText], { type: 'text/plain' });
      filename = 'harmonia_universalis.kbm';
    } else if (kind === 'csv') {
      blob = new Blob([result.csvText], { type: 'text/csv' });
      filename = 'harmonia_universalis.csv';
    } else if (kind === 'syx-bulk') {
      // MTS Bulk Tuning Dump (0x08 0x01) - Modern synths
      blob = new Blob([result.mtsBulkSyxBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      filename = 'harmonia_universalis_bulk.syx';
    } else {
      // MTS Single Note Tuning (0x08 0x02) - Legacy devices (Yamaha, Roland)
      blob = new Blob([result.mtsSingleSyxBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      filename = 'harmonia_universalis_single.syx';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Save generated scale to Custom Mapping (store)
  const saveToCustomMapping = () => {
    if (!result) return;
    const name = scaleName.trim() || `Temperament ${new Date().toLocaleDateString()}`;

    // Convert cents to ratio strings using the approximation function
    const ratioStrings = result.notes.map(n => centsToRatioApprox(n.centsFromRoot, 128));

    // Save to store (will appear in the Saved Scales list)
    saveMidiScale(name, ratioStrings);
    setScaleName('');
    notifySuccess(`Saved "${name}" to Custom Mapping.`, 'Temperament');
  };

  // Apply generated scale directly to current MIDI settings
  const applyToMidiMapping = () => {
    if (!result) return;

    // Convert cents to ratio strings
    const ratioStrings = result.notes.map(n => centsToRatioApprox(n.centsFromRoot, 128));

    // Update settings directly
    updateSettings({
      midi: {
        ...settings.midi,
        mappingMode: 'custom',
        mappingScale: ratioStrings,
        mappingDivisions: result.input.scaleSize
      }
    });
    notifySuccess(`Applied ${result.input.scaleSize}-note temperament to MIDI Mapping.`, 'Temperament');
  };

  return { calculate, exportFiles, saveToCustomMapping, applyToMidiMapping };
};
