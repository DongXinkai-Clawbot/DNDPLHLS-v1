import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useStore } from '../../../store';
import { shallow } from 'zustand/shallow';
import type { NodeData, AppSettings, PrimeLimit, Fraction } from '../../../types';
import { parseGeneralRatio, hasUnsupportedFactors, getPrimeVectorFromRatio, calculateCents, calculateOctaveCentsFromPrimeVector, formatRatio, formatRatioForDisplay, normalizeOctave, simplify } from '../../../musicLogic';
import { startNote, playNote, playSimultaneous } from '../../../audioEngine';
import { CHORD_LIBRARY_GROUPS } from '../../../utils/chordLibrary';
import { Vector3 } from 'three';
import { RatioToolView } from './ratioTool/RatioToolView';

const CHORD_LIBRARY_ITEMS = CHORD_LIBRARY_GROUPS.flatMap(group =>
    group.items.map(item => ({ ...item, group: group.title }))
);

export const RatioTool = ({ nodes, settings, updateSettings, regenerateLattice, selectNode, addToKeyboard }: any) => {
    const {
      addToComparison,
      saveChord
    } = useStore((s) => ({
      addToComparison: s.addToComparison,
      saveChord: s.saveChord
    }), shallow);
    const [mode, setMode] = useState<'single' | 'chord' | 'derive' | 'sethares' | 'temperament' | 'superposition' | 'musicxml' | 'hunt'>('single');

    const [inputA, setInputA] = useState("3^2");
    const [inputB, setInputB] = useState("2");
    const [normalizeSingle, setNormalizeSingle] = useState(true);
    const [result, setResult] = useState<any>(null);

    const [chordInput, setChordInput] = useState("1/1, 5/4, 3/2, 7/4");
    const [chordResult, setChordResult] = useState<{ notes: NodeData[], error?: string } | null>(null);
    const [normalizeChord, setNormalizeChord] = useState(true);
    const [libraryChordId, setLibraryChordId] = useState<string>(CHORD_LIBRARY_ITEMS[0]?.id || '');
    const [saveChordName, setSaveChordName] = useState('');
    const [saveChordDescription, setSaveChordDescription] = useState('');

    const [previewInsts, setPreviewInsts] = useState<Record<string, string>>({
        single: 'click',
        chord: 'click',
        derive: 'click',
        sethares: 'click',
        musicxml: 'click',
        hunt: 'click'
    });
    const previewInst = previewInsts[mode] || 'click';
    const setPreviewInst = (val: string) => setPreviewInsts(prev => ({ ...prev, [mode]: val }));

    const activeTimeouts = useRef<any[]>([]);
    const stopAllPlayback = () => {
        activeTimeouts.current.forEach(t => clearTimeout(t));
        activeTimeouts.current = [];
    };

    useEffect(() => {
        return () => stopAllPlayback();
    }, [mode]);

    const playSettings = useMemo(() => {
        return previewInst === 'click'
            ? settings
            : { ...settings, instrumentClick: previewInst, instrumentChord: previewInst } as AppSettings;
    }, [settings, previewInst]);

    const customSymbols = useMemo(() => {
        if (!settings.customPrimes) return undefined;
        const map: Record<number, string> = {};
        settings.customPrimes.forEach(cp => {
            if (cp.symbol?.up) {
                map[cp.prime] = cp.symbol.up;
            }
        });
        return map;
    }, [settings.customPrimes]);

    const DERIVE_PRIMES: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
    const [derivePrime, setDerivePrime] = useState<number>(3);
    const [deriveSteps, setDeriveSteps] = useState<number>(6);
    const [deriveReveal, setDeriveReveal] = useState<number>(6);
    const [deriveZoom, setDeriveZoom] = useState<number>(1.0);
    const [deriveSpan, setDeriveSpan] = useState<number>(1.0);
    const [deriveBound, setDeriveBound] = useState<number>(2);
    const [commaMaxCents, setCommaMaxCents] = useState<number>(15);
    const [showCommasOnGraph, setShowCommasOnGraph] = useState<boolean>(false);
    const [showMonzo, setShowMonzo] = useState<boolean>(false);
    const [showDeviation, setShowDeviation] = useState<boolean>(true);
    const [deriveSortMode, setDeriveSortMode] = useState<'steps' | 'benedetti' | 'tenney' | 'odd'>('steps');
    const [deriveOddLimitMax, setDeriveOddLimitMax] = useState<number>(0);
    const [ghostGridMode, setGhostGridMode] = useState<'none' | '12tet' | '31tet' | 'both'>('none');
    const [latticeRange, setLatticeRange] = useState<number>(4);
    const [latticeZPrime, setLatticeZPrime] = useState<PrimeLimit>(7);
    const [latticeZLayer, setLatticeZLayer] = useState<number>(0);
    const [cpsMode, setCpsMode] = useState<'hexany' | 'eikosany'>('hexany');
    const [cpsFactors, setCpsFactors] = useState<string>('1, 3, 5, 7');
    const [cpsNormalize, setCpsNormalize] = useState<boolean>(true);
    const [scalePlaybackSpeed, setScalePlaybackSpeed] = useState<number>(0.4);

    const deriverContainerRef = useRef<HTMLDivElement>(null);
    const [isDeriverDragging, setIsDeriverDragging] = useState(false);
    const deriverDragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    const handleDeriverMouseDown = (e: React.MouseEvent) => {

        if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'INPUT') return;

        if (!deriverContainerRef.current) return;
        setIsDeriverDragging(true);
        deriverDragStart.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: deriverContainerRef.current.scrollLeft,
            scrollTop: deriverContainerRef.current.scrollTop
        };
    };

    const handleDeriverMouseMove = (e: React.MouseEvent) => {
        if (!isDeriverDragging || !deriverContainerRef.current) return;
        e.preventDefault();
        const dx = e.clientX - deriverDragStart.current.x;
        const dy = e.clientY - deriverDragStart.current.y;
        deriverContainerRef.current.scrollLeft = deriverDragStart.current.scrollLeft - dx;
        deriverContainerRef.current.scrollTop = deriverDragStart.current.scrollTop - dy;
    };

    const handleDeriverMouseUp = () => setIsDeriverDragging(false);

    const handleDeriverWheel = (e: React.WheelEvent) => {
        if (!deriverContainerRef.current) return;

        const delta = -Math.sign(e.deltaY) * 0.1;
        setDeriveZoom(z => Math.max(0.5, Math.min(4, z + delta)));
    };

    const MONZO_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31] as const;

    const getMonzoFromRatio = (ratio: Fraction) => {
        let n = ratio.n;
        let d = ratio.d;
        const exps: number[] = [];
        MONZO_PRIMES.forEach((prime) => {
            let exp = 0;
            const p = BigInt(prime);
            while (n % p === 0n) { n /= p; exp++; }
            while (d % p === 0n) { d /= p; exp--; }
            exps.push(exp);
        });
        return exps;
    };

    const formatMonzo = (ratio: Fraction) => {
        const exps = getMonzoFromRatio(ratio);
        return `<${exps.join(', ')}>`;
    };

    const getOddLimit = (ratio: Fraction) => {
        const oddPart = (v: bigint) => {
            let value = v < 0n ? -v : v;
            while (value % 2n === 0n) value /= 2n;
            return value;
        };
        const nOdd = oddPart(ratio.n);
        const dOdd = oddPart(ratio.d);
        return Number(nOdd > dOdd ? nOdd : dOdd);
    };

    const getBenedetti = (ratio: Fraction) => {
        const value = (ratio.n < 0n ? -ratio.n : ratio.n) * (ratio.d < 0n ? -ratio.d : ratio.d);
        return value;
    };

    const getTenney = (ratio: Fraction) => {
        const n = Number(ratio.n < 0n ? -ratio.n : ratio.n);
        const d = Number(ratio.d < 0n ? -ratio.d : ratio.d);
        if (!Number.isFinite(n) || !Number.isFinite(d) || n === 0 || d === 0) return 0;
        return Math.log2(n) + Math.log2(d);
    };

    const getDeviation = (cents: number) => {
        const nearest = Math.round(cents / 100) * 100;
        return cents - nearest;
    };

    const derived = useMemo(() => {
        const ratioDisplayMode = settings?.visuals?.ratioDisplay?.contexts?.nodeDeriver || 'auto';
        const autoPowerDigits = settings?.visuals?.ratioDisplay?.autoPowerDigits ?? 14;
        const prime = derivePrime;
        const log2Prime = Math.log2(prime);
        const log10Prime = Math.log10(prime);
        const log10_2 = Math.log10(2);
        const maxSteps = Math.max(0, Math.floor(deriveSteps));
        const reveal = Math.max(0, Math.min(maxSteps, Math.floor(deriveReveal)));
        const primeBig = BigInt(prime);
        const allPrimes: PrimeLimit[] = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31];
        const makeAxisVec = (exp: number) => ({ 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0, [prime]: exp } as any);

        const formatAxisPowerRatio = (exp: number, k: number) => {
            const num: string[] = [];
            const den: string[] = [];
            if (k > 0) den.push(k === 1 ? '2' : `2^${k}`);
            else if (k < 0) num.push((-k) === 1 ? '2' : `2^${-k}`);
            if (exp > 0) num.push(exp === 1 ? `${prime}` : `${prime}^${exp}`);
            else if (exp < 0) den.push((-exp) === 1 ? `${prime}` : `${prime}^${-exp}`);
            const n = num.length ? num.join('*') : '1';
            const d = den.length ? den.join('*') : '1';
            return d === '1' ? n : `${n}/${d}`;
        };

        const findAxisNode = (exp: number) => {
            return (nodes as NodeData[]).find((n) => {
                const vec = n.primeVector as any;

                if ((vec[prime] || 0) !== exp) return false;
                for (const k in vec) {
                    const numK = Number(k);
                    if (numK !== prime && vec[k] !== 0) return false;
                }
                return true;
            }) || null;
        };

        const normalizeToBound = (f: Fraction, bound: number) => {
            let { n, d } = f;
            let octaves = 0;
            while (n < d) {
                n *= 2n;
                octaves--;
            }
            while (Number(n) / Number(d) >= bound) {
                d *= 2n;
                octaves++;
            }
            return { ratio: { n, d }, octaves };
        };

        const buildSide = (dir: 'pos' | 'neg') => {
            const steps: any[] = [];
            let current: Fraction = { n: 1n, d: 1n };
            steps.push({
                exp: 0,
                ratio: current,
                cents: 0,
                ratioStr: '1/1',
                monzo: formatMonzo(current),
                oddLimit: getOddLimit(current),
                benedetti: getBenedetti(current),
                tenney: getTenney(current),
                deviation: getDeviation(0),
                op: '',
                intermediateStr: '',
                octaveShift: 0,
                exists: findAxisNode(0)
            });

            for (let i = 1; i <= reveal; i++) {
                const intermediate = dir === 'pos'
                    ? simplify({ n: current.n * primeBig, d: current.d })
                    : simplify({ n: current.n, d: current.d * primeBig });

                const norm = normalizeToBound(intermediate, deriveBound);
                const normalized = simplify(norm.ratio);
                const op = dir === 'pos' ? `× ${prime}` : `÷ ${prime}`;
                const octaveShift = norm.octaves;
                const octaveStr =
                    octaveShift === 0 ? '' :
                        octaveShift > 0 ? `  →  ÷ 2^${octaveShift}` :
                            `  →  × 2^${Math.abs(octaveShift)}`;

                current = normalized;
                const exp = dir === 'pos' ? i : -i;
                const val = Number(normalized.n) / Number(normalized.d);
                const cents = 1200 * Math.log2(val);
                const ratioStr = formatRatioForDisplay(normalized, makeAxisVec(exp), { mode: ratioDisplayMode, autoPowerDigits, customSymbols });

                const prevExp = dir === 'pos' ? (i - 1) : -(i - 1);
                const kPrev = Math.floor(prevExp * log2Prime);
                const intermediatePowerStr = formatAxisPowerRatio(exp, kPrev);
                const log10Num = (kPrev < 0 ? (-kPrev) * log10_2 : 0) + (exp > 0 ? exp * log10Prime : 0);
                const log10Den = (kPrev > 0 ? kPrev * log10_2 : 0) + (exp < 0 ? (-exp) * log10Prime : 0);
                const maxDigits = Math.max(
                    log10Num <= 0 ? 1 : Math.floor(log10Num) + 1,
                    log10Den <= 0 ? 1 : Math.floor(log10Den) + 1
                );
                const intermediateStr = (ratioDisplayMode === 'primePowers' || (ratioDisplayMode === 'auto' && maxDigits >= autoPowerDigits))
                    ? intermediatePowerStr
                    : formatRatio(intermediate);

                const monzo = formatMonzo(normalized);
                const oddLimit = getOddLimit(normalized);
                const benedetti = getBenedetti(normalized);
                const tenney = getTenney(normalized);
                const deviation = getDeviation(cents);

                steps.push({
                    exp,
                    ratio: normalized,
                    cents,
                    ratioStr,
                    monzo,
                    oddLimit,
                    benedetti,
                    tenney,
                    deviation,
                    op: op + octaveStr,
                    intermediateStr,
                    octaveShift,
                    exists: findAxisNode(exp)
                });
            }
            return steps;
        };

        const pos = buildSide('pos');
        const neg = buildSide('neg');
        return { pos, neg, reveal, maxSteps };
    }, [derivePrime, deriveSteps, deriveReveal, nodes, settings?.visuals?.ratioDisplay, deriveBound, customSymbols]);

    const filteredDerived = useMemo(() => {
        const applyFilter = (steps: any[]) => {
            let next = steps;
            if (deriveOddLimitMax > 0) {
                next = next.filter(s => s.oddLimit <= deriveOddLimitMax);
            }
            if (deriveSortMode !== 'steps') {
                const sorted = [...next];
                sorted.sort((a, b) => {
                    if (deriveSortMode === 'benedetti') {
                        return Number(a.benedetti - b.benedetti);
                    }
                    if (deriveSortMode === 'tenney') {
                        return a.tenney - b.tenney;
                    }
                    if (deriveSortMode === 'odd') {
                        return a.oddLimit - b.oddLimit;
                    }
                    return Math.abs(a.exp) - Math.abs(b.exp);
                });
                return sorted;
            }
            return next;
        };
        return {
            pos: applyFilter(derived.pos),
            neg: applyFilter(derived.neg)
        };
    }, [derived.pos, derived.neg, deriveOddLimitMax, deriveSortMode]);

    const foundCommas = useMemo(() => {
        const threshold = commaMaxCents;
        const all = [...derived.pos, ...derived.neg];
        const seen = new Set();
        const results = [];
        for (const s of all) {
            if (s.exp === 0) continue;
            if (seen.has(s.ratioStr)) continue;

            const c = s.cents;

            const dist = Math.abs(c - Math.round(c / 1200) * 1200);

            if (dist <= threshold && dist > 0.0001) {
                seen.add(s.ratioStr);
                results.push({ ...s, dist });
            }
        }
        return results.sort((a, b) => a.dist - b.dist);
    }, [derived, commaMaxCents]);

    const analyze = () => {
        try {

            const fA = parseGeneralRatio(inputA);
            const fB = parseGeneralRatio(inputB);

            if (fA.n === 0n || fB.n === 0n) throw new Error("Invalid Input");

            const nInput = fA.n * fB.d;
            const dInput = fA.d * fB.n;

            if (nInput === 0n || dInput === 0n) throw new Error("Invalid Ratio");

            let n = nInput;
            let d = dInput;
            let octaves = 0;

            if (normalizeSingle) {

                const norm = normalizeOctave({ n: nInput, d: dInput });
                n = norm.ratio.n;
                d = norm.ratio.d;
                octaves = norm.octaves;
            } else {
                const sim = simplify({ n: nInput, d: dInput });
                n = sim.n;
                d = sim.d;
            }

            const unsupported = hasUnsupportedFactors(n, d);
            const vector = getPrimeVectorFromRatio(n, d);
            const cents = normalizeSingle ? calculateOctaveCentsFromPrimeVector(vector) : calculateCents({ n, d });
            const decimal = Number(n) / Number(d);

            let exists = nodes.find((node: NodeData) => {
                return [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].every(p => vector[p as PrimeLimit] === node.primeVector[p as PrimeLimit]);
            });

            const usedPrimes = Object.keys(vector).map(Number).filter(k => vector[k as PrimeLimit] !== 0) as PrimeLimit[];
            const maxLimit = usedPrimes.length > 0 ? Math.max(...usedPrimes, 3) as PrimeLimit : 3;
            let suggestedSettings = { ...settings };
            let configChanged = false;

            if (!unsupported) {
                const currentRoots = new Set(suggestedSettings.rootLimits);
                usedPrimes.forEach(p => { if (!currentRoots.has(p)) { currentRoots.add(p); configChanged = true; } });
                suggestedSettings.rootLimits = Array.from(currentRoots).sort((a: any, b: any) => a - b) as PrimeLimit[];
                const currentLengths = { ...suggestedSettings.gen0Lengths };
                usedPrimes.forEach(p => {
                    const req = Math.abs(vector[p]);
                    const cur = currentLengths[p] || suggestedSettings.expansionA;
                    if (cur < req) { currentLengths[p] = req; configChanged = true; }
                });
                suggestedSettings.gen0Lengths = currentLengths;
                if (suggestedSettings.maxPrimeLimit < maxLimit) { suggestedSettings.maxPrimeLimit = maxLimit; configChanged = true; }
            }
            setResult({ vector, cents, decimal, exists, suggestedSettings, n, d, configChanged, unsupported, octaves });
        } catch (e) { setResult({ error: "Invalid math input." }); }
    };

    const autoNormField = (target: 'A' | 'B') => {
        const valStr = target === 'A' ? inputA : inputB;
        const setFn = target === 'A' ? setInputA : setInputB;
        try {
            const frac = parseGeneralRatio(valStr);
            const val = Number(frac.n) / Number(frac.d);
            if (val <= 0 || !Number.isFinite(val)) return;

            const k = Math.floor(Math.log2(val));
            if (k === 0) return;

            if (k > 0) {
                setFn(`(${valStr})/2^${k}`);
            } else {
                setFn(`(${valStr})*2^${-k}`);
            }
        } catch (e) { }
    };

    const gcdBigInt = (a: bigint, b: bigint) => {
        let x = a < 0n ? -a : a;
        let y = b < 0n ? -b : b;
        while (y !== 0n) {
            const t = y;
            y = x % y;
            x = t;
        }
        return x;
    };

    const chordLibraryToInput = (ratios: string) => {
        const trimmed = ratios.trim();
        if (!trimmed) return '';
        if (trimmed.includes(':')) {
            const parts = trimmed.split(':').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2 && parts.every(p => /^\d+$/.test(p))) {
                const base = BigInt(parts[0]);
                if (base !== 0n) {
                    return parts.map(p => {
                        const n = BigInt(p);
                        const g = gcdBigInt(n, base);
                        return `${(n / g).toString()}/${(base / g).toString()}`;
                    }).join(', ');
                }
            }
        }
        return trimmed.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean).join(', ');
    };

    const analyzeChord = () => {
        const parts = chordInput.split(/[,;\s]+/).filter(s => s.trim() !== "");
        if (parts.length > 40) {
            setChordResult({ notes: [], error: "Max 40 notes allowed." });
            return;
        }

        const notes: NodeData[] = [];
        try {
            parts.forEach((part, i) => {
                const { n: parsedN, d: parsedD } = parseGeneralRatio(part);
                if (parsedN === 0n) throw new Error("Invalid part: " + part);

                let n = parsedN;
                let d = parsedD;
                let octaves = 0;

                if (normalizeChord) {
                    const norm = normalizeOctave({ n, d });
                    n = norm.ratio.n;
                    d = norm.ratio.d;
                    octaves = norm.octaves;
                }

                const vector = getPrimeVectorFromRatio(n, d);
                const cents = normalizeChord ? calculateOctaveCentsFromPrimeVector(vector) : calculateCents({ n, d });

                notes.push({
                    id: `chord-${i}-${Date.now()}`,
                    position: new Vector3(0, 0, 0),
                    primeVector: vector,
                    ratio: { n, d },
                    octave: octaves,
                    cents: cents,
                    gen: -1,
                    originLimit: 0,
                    parentId: null,
                    name: `Note ${i + 1}`
                });
            });
            setChordResult({ notes });
        } catch (e) {
            setChordResult({ notes: [], error: "Parsing error. Use format: 1/1, 5/4, 2^700/1200, 1.25" });
        }
    };

    const playChord = () => {
        stopAllPlayback();
        if (!chordResult || !chordResult.notes.length) return;

        const duration = settings.playDurationDual || 3.0;
        const stops = chordResult.notes.map(n => startNote(n, playSettings, 'chord'));

        setTimeout(() => stops.forEach(s => s()), duration * 1000);
    };

    const addChordToComparison = () => {
        if (chordResult?.notes) {
            chordResult.notes.forEach(n => addToComparison(n));
        }
    };

    const addChordToKeyboard = () => {
        if (chordResult?.notes) {
            chordResult.notes.forEach(n => addToKeyboard(n));
        }
    };

    const saveConstructedChord = () => {
        if (!chordResult?.notes?.length || !saveChordName.trim()) return;
        saveChord(saveChordName.trim(), chordResult.notes, saveChordDescription.trim() || undefined);
        setSaveChordName('');
        setSaveChordDescription('');
    };

    const selectedLibraryChord = CHORD_LIBRARY_ITEMS.find(item => item.id === libraryChordId) || CHORD_LIBRARY_ITEMS[0];

    const applyLibraryChord = (mode: 'replace' | 'append') => {
        if (!selectedLibraryChord) return;
        const payload = chordLibraryToInput(selectedLibraryChord.ratios);
        if (!payload) return;
        if (mode === 'append' && chordInput.trim().length > 0) {
            const next = chordInput.trim().replace(/[,\s]+$/, '');
            setChordInput(`${next}, ${payload}`);
        } else {
            setChordInput(payload);
        }
        setChordResult(null);
    };

    const getDummyNode = () => result ? ({ id: 'temp', position: new Vector3(), primeVector: result.vector, ratio: { n: result.n, d: result.d }, octave: normalizeSingle ? 0 : (result.octaves || 0), cents: result.cents, gen: -1, originLimit: 0, parentId: null, name: "Ratio" } as NodeData) : null;
    const dummyRoot: NodeData = { id: 'root', position: new Vector3(), primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 }, ratio: { n: 1n, d: 1n }, octave: 0, cents: 0, gen: 0, originLimit: 0, parentId: null, name: '1/1' };

    const playWithOverride = (node: NodeData) => {
        stopAllPlayback();
        playNote(node, playSettings);
    };

    const makeDerivedNode = (prime: PrimeLimit, exp: number, ratio: Fraction, cents: number): NodeData => ({
        id: `derive-${prime}-${exp}`,
        position: new Vector3(0, 0, 0),
        primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0, [prime]: exp } as any,
        ratio,
        octave: 0,
        cents,
        gen: -1,
        originLimit: 0,
        parentId: null,
        name: formatRatio(ratio)
    });

    const viewProps = {
        nodes,
        mode,
        setMode,
        previewInst,
        setPreviewInst,
        inputA,
        setInputA,
        inputB,
        setInputB,
        autoNormField,
        analyze,
        normalizeSingle,
        setNormalizeSingle,
        result,
        getDummyNode,
        dummyRoot,
        playWithOverride,
        playSimultaneous,
        playSettings,
        addToComparison,
        addToKeyboard,
        selectNode,
        updateSettings,
        regenerateLattice,
        settings,
        chordInput,
        setChordInput,
        normalizeChord,
        setNormalizeChord,
        libraryChordId,
        setLibraryChordId,
        selectedLibraryChord,
        applyLibraryChord,
        analyzeChord,
        chordResult,
        playChord,
        addChordToComparison,
        addChordToKeyboard,
        CHORD_LIBRARY_ITEMS,
        formatRatio,
        saveChordName,
        setSaveChordName,
        saveChordDescription,
        setSaveChordDescription,
        saveConstructedChord,
        derivePrime,
        setDerivePrime,
        deriveBound,
        setDeriveBound,
        deriveReveal,
        setDeriveReveal,
        deriveSteps,
        setDeriveSteps,
        deriveZoom,
        setDeriveZoom,
        deriveSpan,
        setDeriveSpan,
        ghostGridMode,
        commaMaxCents,
        setCommaMaxCents,
        showCommasOnGraph,
        setShowCommasOnGraph,
        showMonzo,
        scalePlaybackSpeed,
        setScalePlaybackSpeed,
        derived,
        filteredDerived,
        foundCommas,
        makeDerivedNode,
        playNote,
        activeTimeouts,
        stopAllPlayback,
        deriverContainerRef,
        handleDeriverMouseDown,
        handleDeriverMouseMove,
        handleDeriverMouseUp,
        handleDeriverWheel
    };

    return <RatioToolView {...viewProps} />;
};
