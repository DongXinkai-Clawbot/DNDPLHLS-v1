
import type { PrimeLimit, OriginConfig, EqualStepConfig } from '../../types';

const ALL_PRIMES: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];

const MAX_PREDICTED_NODES = 100_000_000_000_000n;

const EXACT_ENUM_UPPER_BOUND_LIMIT = 250_000n;

const clamp = (v: bigint) => (v > MAX_PREDICTED_NODES ? MAX_PREDICTED_NODES : v);

const addClamp = (a: bigint, b: bigint) => clamp(a + b);

const mulClamp = (a: bigint, b: bigint) => {
  if (a <= 0n || b <= 0n) return 0n;
  if (a > MAX_PREDICTED_NODES / b) return MAX_PREDICTED_NODES;
  return a * b;
};

const asCount = (value: number): bigint => {
  if (!Number.isFinite(value)) return MAX_PREDICTED_NODES;
  return BigInt(Math.max(0, Math.floor(value)));
};

const getAxisSpan = (
  lengths: { [key in PrimeLimit]?: number } | undefined,
  ranges: { [key in PrimeLimit]?: { neg: number; pos: number } } | undefined,
  limit: PrimeLimit,
  fallback: number
) => {
  let lenNeg = lengths ? (lengths[limit] ?? fallback) : fallback;
  let lenPos = lenNeg;
  const range = ranges?.[limit];
  if (range) {
    lenNeg = range.neg;
    lenPos = range.pos;
  }
  return { neg: Math.max(0, lenNeg), pos: Math.max(0, lenPos) };
};

const getGen2Span = (
  lengths: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: number } } | undefined,
  ranges: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: { neg: number; pos: number } } } | undefined,
  parent: PrimeLimit,
  child: PrimeLimit,
  fallback: number
) => {
  let lenNeg = fallback;
  let lenPos = fallback;
  const specific = lengths?.[parent]?.[child];
  if (specific !== undefined) {
    lenNeg = specific;
    lenPos = specific;
    const range = ranges?.[parent]?.[child];
    if (range) {
      lenNeg = range.neg;
      lenPos = range.pos;
    }
  }
  return { neg: Math.max(0, lenNeg), pos: Math.max(0, lenPos) };
};

const primesUpTo = (limit: PrimeLimit, allowList?: PrimeLimit[]) => {
  let list = ALL_PRIMES.filter((p) => p <= limit) as PrimeLimit[];
  if (allowList !== undefined) {
    const allowSet = new Set(allowList);
    list = list.filter((p) => allowSet.has(p));
  }
  return list;
};

export const estimateNodeCount = (
  rootLimits: PrimeLimit[],
  maxPrimeLimit: PrimeLimit,
  expansionA: number,
  expansionB: number,
  expansionC: number,
  expansionD: number,
  expansionE: number,
  gen0Lengths: { [key in PrimeLimit]?: number } = {},
  gen0Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } } = {},
  gen1Lengths: { [key in PrimeLimit]?: number } = {},
  gen1Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } } = {},
  secondaryOrigins: OriginConfig[] = [],
  gen2Lengths: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: number } } = {},
  gen2Ranges: { [parent in PrimeLimit]?: { [child in PrimeLimit]?: { neg: number, pos: number } } } = {},
  gen3Lengths: { [key in PrimeLimit]?: number } = {},
  gen3Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } } = {},
  gen4Lengths: { [key in PrimeLimit]?: number } = {},
  gen4Ranges: { [key in PrimeLimit]?: { neg: number, pos: number } } = {},
  gen1MaxPrimeLimit?: PrimeLimit,
  gen2MaxPrimeLimit?: PrimeLimit,
  gen3MaxPrimeLimit?: PrimeLimit,
  gen4MaxPrimeLimit?: PrimeLimit,
  equalStep?: EqualStepConfig,
  gen1PrimeSet?: PrimeLimit[],
  gen2PrimeSet?: PrimeLimit[],
  gen3PrimeSet?: PrimeLimit[],
  gen4PrimeSet?: PrimeLimit[]
): number => {
  if (equalStep && equalStep.enabled) {
      const range = Number.isFinite(equalStep.range) ? Math.max(0, Math.floor(equalStep.range)) : 0;
      return (range * 2) + 1;
  }

  const mainConfig: OriginConfig = {
    id: "root",
    name: "Global Root",
    primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
    rootLimits: rootLimits || [3],
    expansionA,
    gen0Lengths,
    gen0Ranges: gen0Ranges || {},
    expansionB,
    gen1Lengths,
    gen1Ranges: gen1Ranges || {},
    gen2Lengths: gen2Lengths || {},
    gen2Ranges: gen2Ranges || {},
    gen3Lengths: gen3Lengths || {},
    gen3Ranges: gen3Ranges || {},
    gen4Lengths: gen4Lengths || {},
    gen4Ranges: gen4Ranges || {},
    expansionC,
    expansionD,
    expansionE,
    maxPrimeLimit
  };

  const configs = [mainConfig, ...secondaryOrigins];

  const resolveGenLimit = (gen: number, configMax: PrimeLimit) => {
    const genOverride =
      gen === 1 ? gen1MaxPrimeLimit :
      gen === 2 ? gen2MaxPrimeLimit :
      gen === 3 ? gen3MaxPrimeLimit :
      gen === 4 ? gen4MaxPrimeLimit :
      undefined;
    const effective = genOverride ?? maxPrimeLimit;
    return (effective < configMax ? effective : configMax) as PrimeLimit;
  };

  const estimateUpperBoundForConfig = (config: OriginConfig) => {
    const {
      rootLimits: cRoots,
      gen0Lengths: cG0L,
      gen0Ranges: cG0R,
      gen1Lengths: cG1L,
      gen1Ranges: cG1R,
      gen2Lengths: cG2L,
      gen2Ranges: cG2R,
      gen3Lengths: cG3L,
      gen3Ranges: cG3R,
      gen4Lengths: cG4L,
      gen4Ranges: cG4R,
      expansionA: cA,
      expansionB: cB,
      expansionC: cC,
      expansionD: cD,
      expansionE: cE,
      maxPrimeLimit: cMax
    } = config;

    const roots: PrimeLimit[] = cRoots && cRoots.length > 0 ? cRoots : ([3] as PrimeLimit[]);
    const rootsSet = new Set<PrimeLimit>(roots);

    let axisTotal = 1n;
    const axisByRoot = new Map<PrimeLimit, bigint>();
    roots.forEach((limit) => {
      const span = getAxisSpan(cG0L, cG0R, limit, cA);
      const axisCount = addClamp(asCount(span.neg), asCount(span.pos));
      axisByRoot.set(limit, axisCount);
      axisTotal = addClamp(axisTotal, axisCount);
    });

    const gen1Primes = primesUpTo(resolveGenLimit(1, cMax), gen1PrimeSet);
    const gen2Primes = primesUpTo(resolveGenLimit(2, cMax), gen2PrimeSet);
    const gen3Primes = primesUpTo(resolveGenLimit(3, cMax), gen3PrimeSet);
    const gen4Primes = primesUpTo(resolveGenLimit(4, cMax), gen4PrimeSet);

    const gen1ByPrime = new Map<PrimeLimit, bigint>();
    let totalGen1 = 0n;

    gen1Primes.forEach((prime) => {
      const span = getAxisSpan(cG1L, cG1R, prime, cB);
      const len = addClamp(asCount(span.neg), asCount(span.pos));
      if (len === 0n) {
        gen1ByPrime.set(prime, 0n);
        return;
      }

      let sources = rootsSet.has(prime) ? 0n : 1n; 
      roots.forEach((r) => {
        if (r === prime) return;
        sources = addClamp(sources, axisByRoot.get(r) ?? 0n);
      });

      const nodes = mulClamp(sources, len);
      gen1ByPrime.set(prime, nodes);
      totalGen1 = addClamp(totalGen1, nodes);
    });

    const gen2ByPrime = new Map<PrimeLimit, bigint>();
    gen2Primes.forEach((p) => gen2ByPrime.set(p, 0n));

    gen1ByPrime.forEach((parentCount, parentPrime) => {
      if (parentCount === 0n) return;
      gen2Primes.forEach((childPrime) => {
        if (childPrime === parentPrime) return;
        const span = getGen2Span(cG2L, cG2R, parentPrime, childPrime, cC);
        const len = addClamp(asCount(span.neg), asCount(span.pos));
        if (len === 0n) return;
        const cur = gen2ByPrime.get(childPrime) ?? 0n;
        gen2ByPrime.set(childPrime, addClamp(cur, mulClamp(parentCount, len)));
      });
    });

    let totalGen2 = 0n;
    gen2ByPrime.forEach((v) => { totalGen2 = addClamp(totalGen2, v); });

    let totalGen3 = 0n;
    const gen3ByPrime = new Map<PrimeLimit, bigint>();
    if (totalGen2 > 0n) {
      gen3Primes.forEach((p) => {
        const span = getAxisSpan(cG3L, cG3R, p, cD);
        const len = addClamp(asCount(span.neg), asCount(span.pos));
        if (len === 0n) {
          gen3ByPrime.set(p, 0n);
          return;
        }
        const excluded = gen2ByPrime.get(p) ?? 0n;
        const sources = totalGen2 > excluded ? (totalGen2 - excluded) : 0n;
        const nodes = mulClamp(sources, len);
        gen3ByPrime.set(p, nodes);
        totalGen3 = addClamp(totalGen3, nodes);
      });
    } else {
      gen3Primes.forEach((p) => gen3ByPrime.set(p, 0n));
    }

    let totalGen4 = 0n;
    if (totalGen3 > 0n) {
      gen4Primes.forEach((p) => {
        const span = getAxisSpan(cG4L, cG4R, p, cE);
        const len = addClamp(asCount(span.neg), asCount(span.pos));
        if (len === 0n) return;
        const excluded = gen3ByPrime.get(p) ?? 0n;
        const sources = totalGen3 > excluded ? (totalGen3 - excluded) : 0n;
        totalGen4 = addClamp(totalGen4, mulClamp(sources, len));
      });
    }

    return clamp(addClamp(addClamp(addClamp(axisTotal, totalGen1), totalGen2), addClamp(totalGen3, totalGen4)));
  };

  let upperBound = 0n;
  for (const c of configs) {
    upperBound = addClamp(upperBound, estimateUpperBoundForConfig(c));
    if (upperBound >= MAX_PREDICTED_NODES) break;
  }

  if (upperBound > EXACT_ENUM_UPPER_BOUND_LIMIT) {
    return Number(upperBound);
  }

  const visited = new Set<string>();
  let count = 0;

  const add = (v: { [key: number]: number }) => {
    const k3 = v[3] || 0;
    const k5 = v[5] || 0;
    const k7 = v[7] || 0;
    const k11 = v[11] || 0;
    const k13 = v[13] || 0;
    const k17 = v[17] || 0;
    const k19 = v[19] || 0;
    const k23 = v[23] || 0;
    const k29 = v[29] || 0;
    const k31 = v[31] || 0;
    const id = `3:${k3},5:${k5},7:${k7},11:${k11},13:${k13},17:${k17},19:${k19},23:${k23},29:${k29},31:${k31}`;

    if (!visited.has(id)) {
      visited.add(id);
      count++;
      return true;
    }
    return false;
  };

  configs.forEach(config => {
    const { rootLimits: cRoots, gen0Lengths: cG0L, gen0Ranges: cG0R, gen1Lengths: cG1L, gen1Ranges: cG1R, gen2Lengths: cG2L, gen2Ranges: cG2R, gen3Lengths: cG3L, gen3Ranges: cG3R, gen4Lengths: cG4L, gen4Ranges: cG4R, expansionA: cA, expansionB: cB, expansionC: cC, expansionD: cD, expansionE: cE, maxPrimeLimit: cMax, primeVector: originVec } = config;
    
    const gen1Primes = primesUpTo(resolveGenLimit(1, cMax), gen1PrimeSet);
    const gen2Primes = primesUpTo(resolveGenLimit(2, cMax), gen2PrimeSet);
    const gen3Primes = primesUpTo(resolveGenLimit(3, cMax), gen3PrimeSet);
    const gen4Primes = primesUpTo(resolveGenLimit(4, cMax), gen4PrimeSet);
    const limitsToUse = cRoots && cRoots.length > 0 ? cRoots : [3];

    const axisNodes: { vec: any, originLimit: number }[] = [];
    
    if (add(originVec)) axisNodes.push({ vec: originVec, originLimit: 0 });

    limitsToUse.forEach(limit => {
      let lenNeg = cG0L ? (cG0L[limit] ?? cA) : cA;
      let lenPos = lenNeg;
      if (cG0R && cG0R[limit]) {
          lenNeg = cG0R[limit]!.neg;
          lenPos = cG0R[limit]!.pos;
      }

      for (let i = 1; i <= lenPos; i++) {
          const vPos = { ...originVec, [limit]: (originVec[limit] || 0) + i };
          if (add(vPos)) axisNodes.push({ vec: vPos, originLimit: limit });
      }
      for (let i = 1; i <= lenNeg; i++) {
          const vNeg = { ...originVec, [limit]: (originVec[limit] || 0) - i };
          if (add(vNeg)) axisNodes.push({ vec: vNeg, originLimit: limit });
      }
    });

    const gen1Nodes: { vec: any, originLimit: number }[] = [];
    axisNodes.forEach(node => {
       gen1Primes.forEach(limit => {
          if (node.originLimit === 0) {
              if (limitsToUse.includes(limit)) return;
          } else {
              if (limit === node.originLimit) return;
          }

          let lenNeg = cG1L ? (cG1L[limit] ?? cB) : cB;
          let lenPos = lenNeg;
          if (cG1R && cG1R[limit]) {
              lenNeg = cG1R[limit]!.neg;
              lenPos = cG1R[limit]!.pos;
          }

          for (let i = 1; i <= lenPos; i++) {
              const vPos = { ...node.vec, [limit]: (node.vec[limit] || 0) + i };
              if (add(vPos)) gen1Nodes.push({ vec: vPos, originLimit: limit });
          }
          for (let i = 1; i <= lenNeg; i++) {
              const vNeg = { ...node.vec, [limit]: (node.vec[limit] || 0) - i };
              if (add(vNeg)) gen1Nodes.push({ vec: vNeg, originLimit: limit });
          }
       });
    });

    const gen2Nodes: { vec: any, originLimit: number }[] = [];
    
    const hasCustomGen2 = cG2L && Object.keys(cG2L).length > 0;
    
    gen1Nodes.forEach(node => {
        gen2Primes.forEach(limit => {
            if (limit === node.originLimit) return;
            
            let lenNeg = cC;
            let lenPos = cC;
            
            if (cG2L && cG2L[node.originLimit] && cG2L[node.originLimit]![limit] !== undefined) {
                const specificLen = cG2L[node.originLimit]![limit]!;
                lenNeg = specificLen;
                lenPos = specificLen;
                
                if (cG2R && cG2R[node.originLimit] && cG2R[node.originLimit]![limit]) {
                    lenNeg = cG2R[node.originLimit]![limit]!.neg;
                    lenPos = cG2R[node.originLimit]![limit]!.pos;
                }
            } else if (hasCustomGen2) {
                
            }

            if (lenPos > 0 || lenNeg > 0) {
                for (let i = 1; i <= lenPos; i++) {
                    const vPos = { ...node.vec, [limit]: (node.vec[limit] || 0) + i };
                    if (add(vPos)) gen2Nodes.push({ vec: vPos, originLimit: limit });
                }
                for (let i = 1; i <= lenNeg; i++) {
                    const vNeg = { ...node.vec, [limit]: (node.vec[limit] || 0) - i };
                    if (add(vNeg)) gen2Nodes.push({ vec: vNeg, originLimit: limit });
                }
            }
        });
    });

    const gen3Nodes: { vec: any, originLimit: number }[] = [];
    if (gen2Nodes.length > 0) {
        gen2Nodes.forEach(node => {
           gen3Primes.forEach(limit => {
              if (limit === node.originLimit) return;
              const span = getAxisSpan(cG3L, cG3R, limit, cD);
              if (span.neg <= 0 && span.pos <= 0) return;
              for (let i = 1; i <= span.pos; i++) {
                  const vPos = { ...node.vec, [limit]: (node.vec[limit]||0) + i };
                  if (add(vPos)) gen3Nodes.push({vec:vPos, originLimit: limit});
              }
              for (let i = 1; i <= span.neg; i++) {
                  const vNeg = { ...node.vec, [limit]: (node.vec[limit]||0) - i };
                  if (add(vNeg)) gen3Nodes.push({vec:vNeg, originLimit: limit});
              }
           });
        });
    }

    if (gen3Nodes.length > 0) {
        gen3Nodes.forEach(node => {
           gen4Primes.forEach(limit => {
              if (limit === node.originLimit) return;
              const span = getAxisSpan(cG4L, cG4R, limit, cE);
              if (span.neg <= 0 && span.pos <= 0) return;
              for (let i = 1; i <= span.pos; i++) {
                  const vPos = { ...node.vec, [limit]: (node.vec[limit]||0) + i };
                  add(vPos);
              }
              for (let i = 1; i <= span.neg; i++) {
                  const vNeg = { ...node.vec, [limit]: (node.vec[limit]||0) - i };
                  add(vNeg);
              }
           });
        });
    }
  });

  return count;
};
