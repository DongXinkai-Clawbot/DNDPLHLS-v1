
import type { NodeData, AppSettings, PrimeLimit } from '../../types';
import { STANDARD_PRIMES } from '../../constants';
import { calculateLoopComma, calculatePerStepAdjustment } from './commaCalculator';
import { calculateOctaveCentsFromPrimeVector } from '../../musicLogic';

export interface AxisSpreadingInfo {
  
  prime: PrimeLimit;
  
  loopLength: number;
  
  totalComma: number;
  
  perStepAdjustment: number;
  
  nodeStepIndex: number;
  
  cumulativeAdjustment: number;
}

export interface CommaSpreadingInfo {
  
  isAffected: boolean;
  
  axisDetails: AxisSpreadingInfo[];
  
  totalAdjustment: number;
  
  jiCents: number;
  
  temperedCents: number;
}

export function isNodeAffectedByCommaSpread(
  node: NodeData,
  settings: AppSettings
): boolean {
  if (!node || !settings) return false;
  
  const { axisLooping, commaSpreadingEnabled } = settings;
  if (!axisLooping || !commaSpreadingEnabled) return false;
  
  for (const prime of STANDARD_PRIMES) {
    const loopLength = axisLooping[prime];
    const spreadEnabled = commaSpreadingEnabled[prime];
    const stepIndex = node.primeVector?.[prime] || 0;
    
    if (loopLength && loopLength > 0 && spreadEnabled && stepIndex !== 0) {
      return true;
    }
  }
  
  if (settings.customPrimes) {
    for (const cp of settings.customPrimes) {
      const prime = cp.prime;
      const loopLength = axisLooping[prime];
      const spreadEnabled = commaSpreadingEnabled[prime];
      const stepIndex = node.primeVector?.[prime] || 0;
      
      if (loopLength && loopLength > 0 && spreadEnabled && stepIndex !== 0) {
        return true;
      }
    }
  }
  
  return false;
}

export function getCommaSpreadingInfo(
  node: NodeData,
  settings: AppSettings
): CommaSpreadingInfo {
  const emptyResult: CommaSpreadingInfo = {
    isAffected: false,
    axisDetails: [],
    totalAdjustment: 0,
    jiCents: 0,
    temperedCents: 0
  };
  
  if (!node || !settings) return emptyResult;
  
  const { axisLooping, commaSpreadingEnabled } = settings;
  if (!axisLooping || !commaSpreadingEnabled) {
    return {
      ...emptyResult,
      jiCents: calculateOctaveCentsFromPrimeVector(node.primeVector),
      temperedCents: node.cents
    };
  }
  
  const jiCents = calculateOctaveCentsFromPrimeVector(node.primeVector);
  
  const axisDetails: AxisSpreadingInfo[] = [];
  let totalAdjustment = 0;
  
  const primesToCheck: PrimeLimit[] = [...STANDARD_PRIMES];
  if (settings.customPrimes) {
    for (const cp of settings.customPrimes) {
      if (!primesToCheck.includes(cp.prime)) {
        primesToCheck.push(cp.prime);
      }
    }
  }
  
  for (const prime of primesToCheck) {
    const loopLength = axisLooping[prime];
    const spreadEnabled = commaSpreadingEnabled[prime];
    const stepIndex = node.primeVector?.[prime] || 0;
    
    if (loopLength && loopLength > 0 && spreadEnabled && stepIndex !== 0) {
      const totalComma = calculateLoopComma(prime, loopLength);
      const perStepAdjustment = calculatePerStepAdjustment(totalComma, loopLength);
      const cumulativeAdjustment = stepIndex * perStepAdjustment;
      
      axisDetails.push({
        prime,
        loopLength,
        totalComma,
        perStepAdjustment,
        nodeStepIndex: stepIndex,
        cumulativeAdjustment
      });
      
      totalAdjustment += cumulativeAdjustment;
    }
  }
  
  return {
    isAffected: axisDetails.length > 0,
    axisDetails,
    totalAdjustment,
    jiCents,
    temperedCents: node.cents 
  };
}
