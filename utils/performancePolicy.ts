import type { AppSettings, NodeMaterial, NodeShape } from '../types';
import { getDeviceCapabilities } from './capabilities';

export type PerformanceTier = 'high' | 'balanced' | 'low' | 'safe';

export type PerformancePolicy = {
  tier: PerformanceTier;
  label: string;
  maxNodes: number;
  maxPolyphony: number;
  unisonMax: number;
  sampleRate: number;
  memoryCheckIntervalMs: number;
  render: {
    lineRenderingMode: 'performance' | 'quality';
    nodeShape: NodeShape;
    nodeMaterial: NodeMaterial;
    enableFog: boolean;
  };
  maxExpansion?: {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
  };
};

const buildPolicy = (tier: PerformanceTier): PerformancePolicy => {
  switch (tier) {
    case 'safe':
      return {
        tier,
        label: 'Safe',
        maxNodes: 150,
        maxPolyphony: 12,
        unisonMax: 2,
        sampleRate: 22050,
        memoryCheckIntervalMs: 10000,
        render: {
          lineRenderingMode: 'performance',
          nodeShape: 'point',
          nodeMaterial: 'basic',
          enableFog: false,
        },
        maxExpansion: { a: 8, b: 2, c: 0, d: 0, e: 0 },
      };
    case 'low':
      return {
        tier,
        label: 'Low',
        maxNodes: 300,
        maxPolyphony: 24,
        unisonMax: 3,
        sampleRate: 22050,
        memoryCheckIntervalMs: 15000,
        render: {
          lineRenderingMode: 'performance',
          nodeShape: 'lowpoly',
          nodeMaterial: 'basic',
          enableFog: true,
        },
        maxExpansion: { a: 10, b: 3, c: 1, d: 0, e: 0 },
      };
    case 'balanced':
      return {
        tier,
        label: 'Balanced',
        maxNodes: 600,
        maxPolyphony: 48,
        unisonMax: 6,
        sampleRate: 44100,
        memoryCheckIntervalMs: 30000,
        render: {
          lineRenderingMode: 'quality',
          nodeShape: 'sphere',
          nodeMaterial: 'lambert',
          enableFog: true,
        },
      };
    case 'high':
    default:
      return {
        tier: 'high',
        label: 'High',
        maxNodes: 900,
        maxPolyphony: 64,
        unisonMax: 8,
        sampleRate: 44100,
        memoryCheckIntervalMs: 30000,
        render: {
          lineRenderingMode: 'quality',
          nodeShape: 'sphere',
          nodeMaterial: 'lambert',
          enableFog: true,
        },
      };
  }
};

export const getPerformanceTier = () => {
  const caps = getDeviceCapabilities();
  if (caps.isLowEndMobile || (caps.deviceMemoryGb !== null && caps.deviceMemoryGb <= 1)) return 'safe';
  if (caps.isMobile) return 'low';
  if (caps.deviceMemoryGb !== null && caps.deviceMemoryGb <= 4) return 'balanced';
  if (caps.hardwareConcurrency !== null && caps.hardwareConcurrency <= 4) return 'balanced';
  return 'high';
};

export const getPerformancePolicy = (): PerformancePolicy => buildPolicy(getPerformanceTier());
export const getPerformancePolicyForTier = (tier: PerformanceTier): PerformancePolicy => buildPolicy(tier);

export const applyPerformancePolicyToSettings = (settings: AppSettings, policy: PerformancePolicy) => {
  const nextSettings = { ...settings };
  const visuals = { ...settings.visuals };
  const maxExpansion = policy.maxExpansion;

  if (maxExpansion) {
    nextSettings.expansionA = Math.min(nextSettings.expansionA ?? maxExpansion.a, maxExpansion.a);
    nextSettings.expansionB = Math.min(nextSettings.expansionB ?? maxExpansion.b, maxExpansion.b);
    nextSettings.expansionC = Math.min(nextSettings.expansionC ?? maxExpansion.c, maxExpansion.c);
    nextSettings.expansionD = Math.min(nextSettings.expansionD ?? maxExpansion.d, maxExpansion.d);
    nextSettings.expansionE = Math.min(nextSettings.expansionE ?? maxExpansion.e, maxExpansion.e);
  }

  if (policy.tier === 'low' || policy.tier === 'safe') {
    visuals.lineRenderingMode = policy.render.lineRenderingMode;
    visuals.nodeShape = policy.render.nodeShape;
    visuals.nodeMaterial = policy.render.nodeMaterial;
    visuals.enableFog = policy.render.enableFog;
  }

  nextSettings.visuals = visuals;
  if (nextSettings.timbre?.performance) {
    const perf = { ...nextSettings.timbre.performance };
    perf.maxPolyphony = Math.min(perf.maxPolyphony, policy.maxPolyphony);
    if (policy.tier === 'safe') {
      perf.maxPartials = Math.min(perf.maxPartials, 24);
    } else if (policy.tier === 'low') {
      perf.maxPartials = Math.min(perf.maxPartials, 32);
    } else if (policy.tier === 'balanced') {
      perf.maxPartials = Math.min(perf.maxPartials, 48);
    }
    nextSettings.timbre = { ...nextSettings.timbre, performance: perf };
  }
  return nextSettings;
};
