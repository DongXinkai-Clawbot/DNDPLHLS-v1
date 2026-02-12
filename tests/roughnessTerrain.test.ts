import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { STANDARD_CONSTANTS } from '../components/setharesEngine/landscape/constants';
import { pairRoughness } from '../components/setharesEngine/landscape/roughnessCore';
import { computeGrid } from '../components/setharesEngine/landscape/engine';
import { detectMinimaDetailed } from '../components/setharesEngine/landscape/analysis';

const baseConfig = () => ({
  baseFreq: 220,
  timbre: {
    preset: 'saw',
    partialCount: 8,
    customPartials: [],
    maxPartials: 32,
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
    xSteps: 24,
    ySteps: 24,
    logSampling: true,
    foldOctave: false,
    resolutionMode: 'fixed',
    autoLowSteps: 24,
    autoHighSteps: 24,
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
    mergeDuplicatePartials: false
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

describe('roughness core', () => {
  it('pairRoughness is symmetric', () => {
    const a = pairRoughness(220, 330, 0.8, 0.6, STANDARD_CONSTANTS);
    const b = pairRoughness(330, 220, 0.6, 0.8, STANDARD_CONSTANTS);
    expect(Math.abs(a - b)).toBeLessThan(1e-12);
  });

  it('pairRoughness returns zero on zero frequency delta', () => {
    const v = pairRoughness(440, 440, 0.8, 0.6, STANDARD_CONSTANTS);
    expect(v).toBe(0);
  });
});

describe('roughness grid', () => {
  it('matches golden sample (hash + range)', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'roughness_golden_v1.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const grid = computeGrid(fixture.config);
    expect(grid.xs.length).toBe(fixture.width);
    expect(grid.ys.length).toBe(fixture.height);
    expect(hashArray(grid.raw)).toBe(fixture.rawHash);
    expect(hashArray(grid.normalized)).toBe(fixture.normalizedHash);
    expect(grid.minRaw).toBeCloseTo(fixture.minRaw, 12);
    expect(grid.maxRaw).toBeCloseTo(fixture.maxRaw, 12);
    expect(grid.minNorm).toBeCloseTo(fixture.minNorm, 12);
    expect(grid.maxNorm).toBeCloseTo(fixture.maxNorm, 12);
  });

  it('grid is approximately symmetric', () => {
    const config = baseConfig();
    const grid = computeGrid(config);
    const width = grid.xs.length;
    const height = grid.ys.length;
    const samples = Math.min(width, height, 12);
    let maxDiff = 0;
    for (let i = 0; i < samples; i++) {
      for (let j = 0; j < samples; j++) {
        const a = grid.normalized[j * width + i];
        const b = grid.normalized[i * width + j];
        maxDiff = Math.max(maxDiff, Math.abs(a - b));
      }
    }
    expect(maxDiff).toBeLessThan(1e-3);
  });

  it('detects minima on a typical grid', () => {
    const xs = [1, 1.5, 2];
    const ys = [1, 1.5, 2];
    const values = [
      1, 1, 1,
      1, 0.1, 1,
      1, 1, 1
    ];
    const grid = {
      xs,
      ys,
      logX: xs.map(Math.log),
      logY: ys.map(Math.log),
      raw: new Float64Array(values),
      normalized: new Float64Array(values),
      diagnostics: {
        points: values.length,
        originalPartials: 0,
        prunedPartials: 0,
        invalidPartials: 0,
        skippedPairs: 0,
        totalPairs: 0,
        silentPoints: 0
      },
      normalizationMode: 'none'
    } as const;
    const minima = detectMinimaDetailed(grid, {
      neighborhood: 1,
      smoothIterations: 0,
      useLaplacian: false,
      minLaplacian: 0,
      minDepth: 0
    });
    expect(minima.length).toBeGreaterThan(0);
  });

  it('performance smoke test', () => {
    const config = baseConfig();
    const start = Date.now();
    computeGrid(config);
    const elapsed = Date.now() - start;
    // Log for regression tracking.
    console.log(`roughness grid compute: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2000);
  });
});



