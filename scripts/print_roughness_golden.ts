import { createHash } from 'crypto';
import { computeGrid } from '../components/setharesEngine/landscape/engine';
import { STANDARD_CONSTANTS } from '../components/setharesEngine/landscape/constants';

const buildConfig = () => ({
  baseFreq: 220,
  timbre: {
    preset: 'saw',
    partialCount: 6,
    customPartials: [],
    maxPartials: 24,
    mergeClosePartials: false,
    mergeTolerance: 1e-4,
    amplitudeNormalization: 'none',
    amplitudeCompression: 'none',
    amplitudeCompressionAmount: 2,
    triadEnergyMode: 'none',
    clampNegativeAmps: true
  },
  sampling: {
    xRange: [1, 2],
    yRange: [1, 2],
    xSteps: 16,
    ySteps: 16,
    logSampling: true,
    foldOctave: false,
    resolutionMode: 'fixed',
    autoLowSteps: 16,
    autoHighSteps: 16,
    maxSteps: 64,
    progressiveRefine: false,
    progressiveWindow: 0.05,
    progressiveSteps: 32,
    refineFixed: false,
    refineGradient: false,
    refineMinima: false,
    refineBandCents: 14,
    refineDensity: 3,
    gradientThreshold: 0.06,
    minimaNeighborhood: 2,
    minimaSmoothing: 0,
    refineBaseSteps: 16
  },
  roughness: {
    ampThreshold: 0.001,
    epsilonContribution: 1e-4,
    enableSelfInteraction: false,
    selfInteractionWeight: 0.7,
    mergeDuplicatePartials: false,
    performanceMode: false
  },
  normalizationMode: 'energy',
  constants: STANDARD_CONSTANTS,
  referencePoint: { x: 1, y: 1 }
});

const hashArray = (arr: Float64Array) => {
  const hash = createHash('sha256');
  hash.update(Buffer.from(arr.buffer));
  return hash.digest('hex');
};

const config = buildConfig();
const grid = computeGrid(config);

const output = {
  config,
  width: grid.xs.length,
  height: grid.ys.length,
  rawHash: hashArray(grid.raw),
  normalizedHash: hashArray(grid.normalized),
  minRaw: grid.minRaw,
  maxRaw: grid.maxRaw,
  minNorm: grid.minNorm,
  maxNorm: grid.maxNorm
};

console.log(JSON.stringify(output, null, 2));
