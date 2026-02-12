
import { normalizeOctave, calculateCents, getPrimeVectorFromRatio } from '../musicLogic';
import type { ConsequentialScaleConfig, ConsequentialNote, ConsequentialScaleResult } from '../types';
import { preprocessExpression, buildMathContext, evalScalar, evalVector } from './math/unifiedEvaluator';

const MAX_NOTES = 2000;

export const generateConsequentialNotes = (config: ConsequentialScaleConfig): ConsequentialScaleResult => {
    const notes: ConsequentialNote[] = [];
    const stats = {
        totalCount: 0,
        playableCount: 0,
        outOfRangeCount: 0,
        minFreq: Infinity,
        maxFreq: -Infinity,
        minCents: Infinity,
        maxCents: -Infinity,
        invalidCount: 0
    };

    const { nStart, nEnd, nStep, iStart, iEnd, iStep, iList, varyMode, variables } = config.domain;
    const { baseFreq, normalizeToOctave: doNormalize, quantizeMode, handleNegative, linearMode, linearUnit } = config.mapping;
    const mappingMode = config.mappingMode || 'scalar_ratio';
    const derivativeOrder = config.derivativeOrder || 0;
    const derivVar = config.derivVar; 
    
    const { processed: expr } = preprocessExpression(config.expressionRaw, config.advancedSymbols);

    let sequence: { vars: Record<string, number>, idx: number }[] = [];
    let idxCounter = 0;

    const getRange = (v: any) => {
        if (v.role === 'parameter') return [v.value];
        const arr = [];
        const start = v.min ?? 0;
        const end = v.max ?? 1;
        const step = v.step && v.step !== 0 ? Math.abs(v.step) : 1;
        if (start <= end) for(let x=start; x<=end; x+=step) arr.push(x);
        else for(let x=start; x>=end; x-=step) arr.push(x);
        return arr;
    };

    if (variables && variables.length > 0) {
        
        const domainVars = variables.filter(v => v.role === 'domain');
        const paramVars = variables.filter(v => v.role === 'parameter');
        
        const baseContext: Record<string, number> = {};
        paramVars.forEach(p => baseContext[p.name] = p.value);

        if (domainVars.length === 0) {
            
            sequence.push({ vars: { ...baseContext }, idx: 0 });
        } else {
            
            const ranges = domainVars.map(v => ({ name: v.name, values: getRange(v) }));
            
            const recurse = (depth: number, current: Record<string, number>) => {
                if (depth === ranges.length) {
                    sequence.push({ vars: { ...baseContext, ...current }, idx: idxCounter++ });
                    return;
                }
                const r = ranges[depth];
                for (const val of r.values) {
                    recurse(depth + 1, { ...current, [r.name]: val });
                }
            };
            recurse(0, {});
        }
    } else {
        
        const range = (start: number, end: number, step: number) => {
            const arr = [];
            const s = step === 0 ? 1 : Math.abs(step);
            if (start <= end) for(let v=start; v<=end; v+=s) arr.push(v);
            else for(let v=start; v>=end; v-=s) arr.push(v);
            return arr;
        };
        const nSeq = range(nStart, nEnd, nStep);
        let iSeq = (iList && iList.length > 0) ? iList : range(iStart, iEnd, iStep);

        const add = (n: number, i: number) => sequence.push({ vars: { n, i, k: i }, idx: idxCounter++ });

        if (varyMode === 'Grid') {
            for (const n of nSeq) for (const i of iSeq) add(n, i);
        } else if (varyMode === 'FixN_VaryI') {
            const n = nSeq[0] || 1;
            for (const i of iSeq) add(n, i);
        } else {
            const i = iSeq[0] || 0;
            for (const n of nSeq) add(n, i);
        }
    }

    if (sequence.length > MAX_NOTES) {
        sequence = sequence.slice(0, MAX_NOTES);
    }
    stats.totalCount = sequence.length;

    let intermediates: { vars: Record<string, number>, idx: number, rawScalar: number, originalScalar: number, rawString: string, isValid: boolean }[] = [];
    let minVal = Infinity;

    for (const item of sequence) {
        const { vars, idx } = item;
        const ctx = buildMathContext(vars); 

        let rawScalar = NaN;
        let rawString = "NaN";
        let isValid = false;

        if (mappingMode === 'parametric_y') {
            const vecRes = evalVector(expr, ctx);
            if (vecRes.isValid) {
                rawScalar = vecRes.y; 
                rawString = `(${vecRes.x.toFixed(2)}, ${vecRes.y.toFixed(2)})`;
                isValid = true;
            } else {
                rawString = vecRes.error || "Err";
            }
        } else if (mappingMode === 'polar_r') {
            const res = evalScalar(expr, ctx);
            if (res.isValid) {
                rawScalar = res.value; 
                rawString = res.value.toFixed(4);
                isValid = true;
            } else {
                rawString = res.error || "Err";
            }
        } else {
            const res = evalScalar(expr, ctx);
            if (res.isValid) {
                rawScalar = res.value;
                rawString = res.value.toFixed(4);
                isValid = true;
            } else {
                rawString = res.error || "Err";
            }
        }

        intermediates.push({ vars, idx, rawScalar, originalScalar: rawScalar, rawString, isValid });
    }

    if (derivativeOrder > 0) {
        let currentSequence = intermediates;
        
        let targetVar = derivVar;
        
        if (!targetVar || !currentSequence[0]?.vars.hasOwnProperty(targetVar)) {
            
            if (variables && variables.length > 0) {
                const dom = variables.find(v => v.role === 'domain');
                if (dom) targetVar = dom.name;
            } else {
                
                targetVar = 'n';
            }
        }

        const stepVal = variables?.find(v => v.name === targetVar)?.step || 1;
        const step = Math.abs(stepVal); 

        for (let k = 0; k < derivativeOrder; k++) {
            const nextSeq = [];
            
            const lookup = new Map<string, number>();
            const genKey = (vars: Record<string, number>) => {
                
                return Object.keys(vars).sort().map(k => `${k}:${vars[k].toFixed(4)}`).join('|');
            };

            currentSequence.forEach((item) => {
                if (item.isValid) lookup.set(genKey(item.vars), item.rawScalar);
            });

            for (let i = 0; i < currentSequence.length; i++) {
                const curr = currentSequence[i];
                if (!curr.isValid || !targetVar) {
                    nextSeq.push({ ...curr, rawScalar: 0, rawString: "Err", isValid: false });
                    continue;
                }

                const prevVars = { ...curr.vars };
                prevVars[targetVar] = prevVars[targetVar] - step; 
                
                const prevKey = genKey(prevVars);
                const prevVal = lookup.get(prevKey);

                if (prevVal !== undefined) {
                    const dy = curr.rawScalar - prevVal;
                    const dx = stepVal; 
                    const slope = dy / dx;
                    nextSeq.push({
                        ...curr,
                        rawScalar: slope,
                        rawString: slope.toFixed(4),
                        isValid: true
                    });
                } else {
                    
                    nextSeq.push({ ...curr, rawScalar: 0, rawString: "d0", isValid: false });
                }
            }
            currentSequence = nextSeq;
        }
        intermediates = currentSequence;
    }

    for (const item of intermediates) {
        if (item.isValid && Number.isFinite(item.rawScalar)) {
            if (item.rawScalar < minVal) minVal = item.rawScalar;
        }
    }

    let shiftAmount = 0;
    if (handleNegative === 'shift' && minVal < 0 && Number.isFinite(minVal)) {
        
        shiftAmount = -minVal + 0.01;
    }

    for (const item of intermediates) {
        const { vars, idx, rawScalar, originalScalar, rawString, isValid } = item;
        
        let freqHz = 0;
        let playable = false;
        let octaveShift = 0;
        let finalRatioFloat = rawScalar;
        let cents = 0;
        let ratioStruct = { n: 0n, d: 1n };
        let pVec = undefined;
        let displayScalar = rawScalar; 

        if (isValid && Number.isFinite(rawScalar)) {
            
            if (handleNegative === 'shift') {
                finalRatioFloat = rawScalar + shiftAmount;
                displayScalar = finalRatioFloat; 
            } else if (handleNegative === 'abs') {
                if (rawScalar < 0) finalRatioFloat = Math.abs(rawScalar);
            } else {
                
                finalRatioFloat = rawScalar;
            }

            if (linearMode) {
                
                const unit = linearUnit || 100;
                freqHz = baseFreq + (finalRatioFloat * unit);
                
                if (freqHz > 20 && freqHz <= 20000) {
                    playable = true;
                    stats.playableCount++;
                    stats.minFreq = Math.min(stats.minFreq, freqHz);
                    stats.maxFreq = Math.max(stats.maxFreq, freqHz);
                    
                    const ratio = freqHz / baseFreq;
                    cents = 1200 * Math.log2(ratio);
                    finalRatioFloat = ratio; 
                } else {
                    stats.outOfRangeCount++;
                }
            } else {
                
                if (finalRatioFloat > 0) {
                    
                    let processingVal = finalRatioFloat;
                    if (doNormalize) {
                        let norm = processingVal;
                        while (norm >= 2) { norm /= 2; octaveShift++; }
                        while (norm < 1) { norm *= 2; octaveShift--; }
                        processingVal = norm;
                    }

                    freqHz = baseFreq * processingVal;
                    
                    if (freqHz >= 20 && freqHz <= 20000) {
                        playable = true;
                        stats.playableCount++;
                        stats.minFreq = Math.min(stats.minFreq, freqHz);
                        stats.maxFreq = Math.max(stats.maxFreq, freqHz);
                    } else {
                        stats.outOfRangeCount++;
                    }

                    cents = 1200 * Math.log2(processingVal);
                } else {
                    
                    playable = false;
                }
            }

            if (playable) {
                stats.minCents = Math.min(stats.minCents, cents);
                stats.maxCents = Math.max(stats.maxCents, cents);
            }

            if (playable) {
                if (quantizeMode === 'prime_limit_fraction') {
                    const precision = 10000;
                    const nInt = Math.round(finalRatioFloat * precision);
                    const dInt = precision;
                    const norm = normalizeOctave({ n: BigInt(nInt), d: BigInt(dInt) });
                    ratioStruct = norm.ratio;
                    pVec = getPrimeVectorFromRatio(ratioStruct.n, ratioStruct.d);
                } else if (quantizeMode === 'edo' && config.mapping.edoDivisions) {
                    const div = config.mapping.edoDivisions;
                    const step = 1200 / div;
                    const qCents = Math.round(cents / step) * step;
                    cents = qCents;
                    const qRatio = Math.pow(2, cents/1200);
                    freqHz = baseFreq * qRatio;
                }
            }
        } else {
            if (!isValid) stats.invalidCount++;
        }

        notes.push({
            idx, n: vars.n || 0, i: vars.i || 0,
            varsSnapshot: vars,
            rawValue: rawString,
            rawScalar: displayScalar, 
            originalScalar, 
            ratioFloat: finalRatioFloat, 
            freqHz,
            playable,
            cents,
            octaveShift,
            primeVector: pVec,
            frac: (pVec || quantizeMode === 'none') ? ratioStruct : undefined
        });
    }

    return {
        configId: config.id,
        notes,
        generatedAt: Date.now(),
        stats
    };
};
