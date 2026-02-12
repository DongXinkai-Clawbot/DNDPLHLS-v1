
import type { PrimeLimit, AppState } from '../../types';
import { DEFAULT_SETTINGS } from '../../constants';
import { INITIAL_PANELS } from '../logic/constants';
import { TRANSIENT_OVERLAY_RESET } from '../logic/transients';
import { saveMainState } from '../logic/persistence';
import { createLogger } from '../../utils/logger';
import { getPerformancePolicy, applyPerformancePolicyToSettings } from '../../utils/performancePolicy';

const log = createLogger('store/setup');

export const handleCompleteSetup = (
  set: any, get: any,
  activeRootLimits: PrimeLimit[], 
  maxPrimeLimit: PrimeLimit, 
  expansionA: number, 
  expansionB: number, 
  expansionC: number, 
  expansionD: number, 
  expansionE: number, 
  visualMode: 'performance' | 'quality'
) => {
  
  const policy = getPerformancePolicy();
  const isMobile = policy.tier === 'low' || policy.tier === 'safe';
  
  if (isMobile) {
    log.info('Mobile performance tier detected - applying safety limits', { tier: policy.tier });
    log.debug('Original values', { expansionA, expansionB, expansionC, expansionD, expansionE });
    if (policy.maxExpansion) {
      expansionA = Math.min(expansionA, policy.maxExpansion.a);
      expansionB = Math.min(expansionB, policy.maxExpansion.b);
      expansionC = Math.min(expansionC, policy.maxExpansion.c);
      expansionD = Math.min(expansionD, policy.maxExpansion.d);
      expansionE = Math.min(expansionE, policy.maxExpansion.e);
    }
    log.debug('Policy-limited values', { expansionA, expansionB, expansionC, expansionD, expansionE });
  }
  
  set((state: AppState) => {
      const newVisuals = { ...state.settings.visuals };
      if (visualMode === 'quality') {
          newVisuals.lineRenderingMode = 'quality';
          newVisuals.nodeShape = 'sphere';
          newVisuals.nodeMaterial = 'lambert';
      } else {
          newVisuals.lineRenderingMode = 'performance';
          newVisuals.nodeShape = 'lowpoly';
          newVisuals.nodeMaterial = 'basic';
      }
      
      if (policy.tier === 'low' || policy.tier === 'safe') {
        newVisuals.lineRenderingMode = policy.render.lineRenderingMode;
        newVisuals.nodeShape = policy.render.nodeShape;
        newVisuals.nodeMaterial = policy.render.nodeMaterial;
        newVisuals.enableFog = policy.render.enableFog;
        log.info('Applying performance render policy', { tier: policy.tier });
      }
      
      let vAxis = 5;
      if (maxPrimeLimit < 5) vAxis = 3;

      const initialLengths = { ...state.settings.gen0Lengths };
      activeRootLimits.forEach(l => { initialLengths[l] = expansionA; });
      
      const initialGen1Lengths = {};

      const nextSettings = applyPerformancePolicyToSettings({
        ...state.settings,
        isSimpleMode: false,
        rootLimits: activeRootLimits,
        maxPrimeLimit: maxPrimeLimit,
        gen1MaxPrimeLimit: undefined,
        gen2MaxPrimeLimit: undefined,
        gen3MaxPrimeLimit: undefined,
        gen4MaxPrimeLimit: undefined,
        expansionA,
        gen0Lengths: initialLengths,
        gen0Ranges: {}, 
        expansionB,
        gen1Lengths: initialGen1Lengths,
        gen1Ranges: {},
        gen3Lengths: {},
        gen3Ranges: {},
        gen4Lengths: {},
        gen4Ranges: {},
        expansionC,
        expansionD,
        expansionE,
        visuals: newVisuals
      }, policy);

      log.info('Saving settings and completing setup');
      saveMainState(nextSettings, { landingMode: 'advanced', isSetupComplete: true });

      return {
        isSetupComplete: true,
        hasConfiguredAdvanced: true,
        activeMaxPrimeLimit: maxPrimeLimit,
        navAxisVertical: vAxis as PrimeLimit,
        settings: nextSettings
      };
  });
  
  log.info('Triggering lattice regeneration');
  get().regenerateLattice(false);
};

export const toggleSimpleLabelMode = (set: any, get: any) => {
    set((state: AppState) => {
      const modes: ('name' | 'ratio' | 'both')[] = ['name', 'ratio', 'both'];
      const next = modes[(modes.indexOf(state.settings.simpleLabelMode) + 1) % modes.length];
      const nextSettings = { ...state.settings, simpleLabelMode: next };
      saveMainState(nextSettings, { landingMode: state.landingMode, isSetupComplete: state.isSetupComplete });
      return { settings: nextSettings };
    });
};

export const clearAdvancedSession = (set: any) => {
    set({
        isSetupComplete: false,
        hasConfiguredAdvanced: false,
        settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
        nodes: [],
        nodeSearchIndex: null,
        edges: [],
        panels: INITIAL_PANELS,
        savedAdvancedSettings: undefined,
        ...TRANSIENT_OVERLAY_RESET,
        selectedNode: null,
        referenceNode: null
    });
    
};
