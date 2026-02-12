import fs from 'fs';
import path from 'path';
import { computeGrid } from '../components/setharesEngine/landscape/engine';
import { STANDARD_CONSTANTS } from '../components/setharesEngine/landscape/constants';
import { annotateMinimaWithRationals, detectMinimaDetailed, estimateBasins } from '../components/setharesEngine/landscape/analysis';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const out = args.find(a => a.startsWith('--out='))?.split('=')[1] || 'roughness_output';
  const configPath = args.find(a => a.startsWith('--config='))?.split('=')[1];
  return { out, configPath };
};

const buildDefaultConfig = () => ({
  baseFreq: 220,
  timbre: {
    preset: 'saw',
    partialCount: 12,
    customPartials: [],
    maxPartials: 64,
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
    xSteps: 128,
    ySteps: 128,
    logSampling: true,
    foldOctave: false,
    resolutionMode: 'fixed',
    autoLowSteps: 128,
    autoHighSteps: 128,
    maxSteps: 256,
    progressiveRefine: false,
    progressiveWindow: 0.05,
    progressiveSteps: 64,
    refineFixed: true,
    refineGradient: false,
    refineMinima: false,
    refineBandCents: 14,
    refineDensity: 3,
    gradientThreshold: 0.06,
    minimaNeighborhood: 2,
    minimaSmoothing: 1,
    refineBaseSteps: 24
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

const main = () => {
  const { out, configPath } = parseArgs();
  const baseConfig = buildDefaultConfig();
  let config = baseConfig;
  if (configPath) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    config = { ...baseConfig, ...parsed };
  }

  const start = Date.now();
  const grid = computeGrid(config);
  const minima = annotateMinimaWithRationals(
    detectMinimaDetailed(grid, {
      neighborhood: 2,
      smoothIterations: 1,
      useLaplacian: true,
      minLaplacian: 0,
      minDepth: 0
    }),
    32,
    true,
    'denominator'
  );
  const axisX = grid.logSampling ? grid.logX : grid.xs;
  const axisY = grid.logSampling ? grid.logY : grid.ys;
  const spanX = axisX.length > 1 ? axisX[axisX.length - 1] - axisX[0] : 0;
  const spanY = axisY.length > 1 ? axisY[axisY.length - 1] - axisY[0] : 0;
  const basinMaxRadius = Number.isFinite(spanX) && Number.isFinite(spanY) ? 0.5 * Math.hypot(spanX, spanY) : Infinity;
  const basins = estimateBasins(grid, minima, {
    thresholdStd: 0.15,
    maxRadius: basinMaxRadius,
    useEightNeighbors: true,
    field: 'normalized',
    boundaryPolicy: 'skip',
    localRadius: 2
  });
  const elapsed = Date.now() - start;

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'grid_raw.bin'), Buffer.from(grid.raw.buffer));
  fs.writeFileSync(path.join(out, 'grid_normalized.bin'), Buffer.from(grid.normalized.buffer));

  const matrixText = grid.ys.map((_, j) => {
    const row = [];
    for (let i = 0; i < grid.xs.length; i++) {
      row.push(grid.normalized[j * grid.xs.length + i].toFixed(8));
    }
    return row.join(',');
  }).join('\n');
  fs.writeFileSync(path.join(out, 'grid_normalized.csv'), matrixText, 'utf8');

  const minimaText = ['x,y,roughness,rationalX,rationalY,basinRadius']
    .concat(basins.map(m => `${m.x},${m.y},${m.roughness},${m.rationalX ?? ''},${m.rationalY ?? ''},${m.basinRadius ?? ''}`))
    .join('\n');
  fs.writeFileSync(path.join(out, 'minima.csv'), minimaText, 'utf8');

  const report = [
    'Roughness Terrain CLI Report',
    `Generated: ${new Date().toISOString()}`,
    `Elapsed: ${(elapsed / 1000).toFixed(2)}s`,
    `Grid: ${grid.xs.length} x ${grid.ys.length}`,
    `Minima: ${basins.length}`,
    '',
    'Config:',
    JSON.stringify(config, null, 2)
  ].join('\n');
  fs.writeFileSync(path.join(out, 'report.txt'), report, 'utf8');

  console.log(`Outputs written to ${out}`);
};

main();
