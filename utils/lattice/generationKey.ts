import type { AppSettings } from '../../types';

const replaceBigInt = (_key: string, value: any) => {
  if (typeof value === 'bigint') return value.toString();
  return value;
};

const pickGeometryKey = (geometry: AppSettings['geometry'] | undefined) => {
  if (!geometry) return undefined;
  return {
    enabled: geometry.enabled,
    mode: geometry.mode,
    limits: geometry.limits,
    dimensions: geometry.dimensions,
    spacing: geometry.spacing,
    sphere: geometry.sphere,
    nodeBranchOverrides: geometry.nodeBranchOverrides,
    custom: geometry.custom,
    ignoreOverrides: geometry.ignoreOverrides
  };
};

const pickCurvedKey = (curved: AppSettings['curvedGeometry'] | undefined) => {
  if (!curved) return undefined;
  return {
    enabled: curved.enabled,
    pitchMetric: curved.pitchMetric,
    distanceMode: curved.distanceMode,
    distanceScale: curved.distanceScale,
    distanceExponent: curved.distanceExponent,
    distanceOffset: curved.distanceOffset,
    curveRadiansPerStep: curved.curveRadiansPerStep,
    autoSpacing: curved.autoSpacing,
    collisionPadding: curved.collisionPadding
  };
};

/**
 * Topology key: only include settings that affect which nodes/edges are generated,
 * their positions, and tuning math (cents/ratio). Excludes display-only concerns
 * like naming/notation.
 */
export const buildLatticeTopologyKey = (settings: AppSettings) => {
  const visuals = settings.visuals || ({} as AppSettings['visuals']);
  const key = {
    rootLimits: settings.rootLimits,
    expansionA: settings.expansionA,
    expansionB: settings.expansionB,
    expansionC: settings.expansionC,
    expansionD: settings.expansionD,
    expansionE: settings.expansionE,
    gen0Lengths: settings.gen0Lengths,
    gen0Ranges: settings.gen0Ranges,
    gen1Lengths: settings.gen1Lengths,
    gen1Ranges: settings.gen1Ranges,
    gen2Lengths: settings.gen2Lengths,
    gen2Ranges: settings.gen2Ranges,
    gen3Lengths: settings.gen3Lengths,
    gen3Ranges: settings.gen3Ranges,
    gen4Lengths: settings.gen4Lengths,
    gen4Ranges: settings.gen4Ranges,
    axisLooping: settings.axisLooping,
    commaSpreadingEnabled: settings.commaSpreadingEnabled,
    secondaryOrigins: settings.secondaryOrigins,
    isSimpleMode: settings.isSimpleMode,
    gen0CustomizeEnabled: settings.gen0CustomizeEnabled,
    maxPrimeLimit: settings.maxPrimeLimit,
    gen1MaxPrimeLimit: settings.gen1MaxPrimeLimit,
    gen2MaxPrimeLimit: settings.gen2MaxPrimeLimit,
    gen3MaxPrimeLimit: settings.gen3MaxPrimeLimit,
    gen4MaxPrimeLimit: settings.gen4MaxPrimeLimit,
    gen1PrimeSet: settings.gen1PrimeSet,
    gen2PrimeSet: settings.gen2PrimeSet,
    gen3PrimeSet: settings.gen3PrimeSet,
    gen4PrimeSet: settings.gen4PrimeSet,
    deduplicateNodes: settings.deduplicateNodes,
    deduplicationTolerance: settings.deduplicationTolerance,
    priorityOrder: settings.priorityOrder,

    // Only visuals that affect geometry / lattice positioning
    visuals: {
      globalScale: visuals.globalScale,
      primeSpacings: visuals.primeSpacings,
      spiralFactor: visuals.spiralFactor,
      helixFactor: visuals.helixFactor,
      layoutMode: visuals.layoutMode,
      diamondLimit: visuals.diamondLimit
    },

    equalStep: settings.equalStep,
    geometry: pickGeometryKey(settings.geometry),
    spiral: settings.spiral,
    curvedGeometry: pickCurvedKey(settings.curvedGeometry)
  };

  return JSON.stringify(key, replaceBigInt);
};

/**
 * Display key: settings that only affect how an existing lattice is *labeled*
 * (names, accidentals, custom notation), without changing topology.
 */
export const buildLatticeDisplayKey = (settings: AppSettings) => {
  const key = {
    notationSymbols: settings.notationSymbols,
    accidentalPlacement: settings.accidentalPlacement,
    customPrimes: settings.customPrimes,
    transpositionVector: settings.transpositionVector
  };
  return JSON.stringify(key, replaceBigInt);
};

// Backwards compatibility: old name now maps to topology-only key.
export const buildLatticeGenerationKey = buildLatticeTopologyKey;
