import React, { memo, useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store';
import { parseGeneralRatio, expandCompositePrimeVector } from '../../musicLogic';
import { getPrimeColor } from '../../constants';

const CHANNEL_COLORS = [
        '#ee2b2b', '#ee742b', '#eebd2b', '#d5ee2b',
        '#8cee2b', '#43ee2b', '#2bee5b', '#2beea5',
        '#2beeee', '#2ba5ee', '#2b5bee', '#432bee',
        '#8c2bee', '#d52bee', '#ee2bbd', '#ee2b74'
    ];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const normalizeFrac = (turns: number) => {
    let frac = turns - Math.floor(turns);
    if (frac < 0) frac += 1;
    return frac;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpHue01 = (h1: number, h2: number, t: number) => {
    const dh = ((h2 - h1 + 0.5) % 1) - 0.5;
    return (h1 + dh * t + 1) % 1;
};
const mixHSL = (c1: THREE.Color, c2: THREE.Color, t: number) => {
    const hsl1 = { h: 0, s: 0, l: 0 };
    const hsl2 = { h: 0, s: 0, l: 0 };
    c1.getHSL(hsl1);
    c2.getHSL(hsl2);
    const h = lerpHue01(hsl1.h, hsl2.h, t);
    const s = lerp(hsl1.s, hsl2.s, t);
    const l = lerp(hsl1.l, hsl2.l, t);
    return new THREE.Color().setHSL(h, s, l);
};

const spectrumColorFromFrac = (
    frac: number,
    anchors: { startFrac: number; yellowT: number; blueT: number },
    primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }
) => {
    const start = anchors.startFrac;
    const t = ((frac - start) % 1 + 1) % 1;
    const yT = clamp(anchors.yellowT, 1e-12, 1 - 1e-12);
    const bT = clamp(anchors.blueT, yT + 1e-12, 1 - 1e-12);

    if (t <= yT) {
        const u = t / yT;
        return mixHSL(primaries.a, primaries.c, Math.pow(u, 1.5));
    }
    if (t <= bT) {
        const u = (t - yT) / (bT - yT);
        return mixHSL(primaries.c, primaries.b, Math.pow(u, 0.65));
    }
    return mixHSL(primaries.b, primaries.a, (t - bT) / (1 - bT));
};

const primaryWeightsFromHue = (hueDeg: number) => {
    const hue = ((hueDeg % 360) + 360) % 360;
    let a = 0;
    let b = 0;
    let c = 0;
    if (hue < 120) {
        const t = hue / 120;
        a = 1 - t;
        c = t;
    } else if (hue < 240) {
        const t = (hue - 120) / 120;
        c = 1 - t;
        b = t;
    } else {
        const t = (hue - 240) / 120;
        b = 1 - t;
        a = t;
    }
    return { a, b, c };
};

const mixRgbFromWeights = (
    weights: { a: number; b: number; c: number },
    primaries: { a: THREE.Color; b: THREE.Color; c: THREE.Color }
) => {
    const total = Math.abs(weights.a) + Math.abs(weights.b) + Math.abs(weights.c);
    if (total <= 1e-6) return primaries.a.clone().lerp(primaries.b, 0.5).lerp(primaries.c, 0.5);
    const wa = weights.a / total;
    const wb = weights.b / total;
    const wc = weights.c / total;
    const out = new THREE.Color(0, 0, 0);
    out.r = primaries.a.r * wa + primaries.b.r * wb + primaries.c.r * wc;
    out.g = primaries.a.g * wa + primaries.b.g * wb + primaries.c.g * wc;
    out.b = primaries.a.b * wa + primaries.b.b * wb + primaries.c.b * wc;
    return out;
};

const maxPrimeFromBigInt = (value: bigint) => {
    let v = value < 0n ? -value : value;
    if (v <= 1n) return 1;
    while (v % 2n === 0n) v /= 2n;
    if (v <= 3n) return Number(v);
    let max = 1n;
    let p = 3n;
    const limit = 100000n;
    while (p * p <= v && p <= limit) {
        if (v % p === 0n) {
            max = p;
            while (v % p === 0n) v /= p;
        }
        p += 2n;
    }
    if (v > 1n) max = v;
    if (max > BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(max % 1000n) + 3;
    }
    return Number(max);
};

const maxPrimeFromVector = (vector: Record<number, number> | undefined) => {
    if (!vector) return 1;
    const expanded = expandCompositePrimeVector(vector as any);
    let max = 1;
    Object.keys(expanded).forEach((k) => {
        const p = Number(k);
        if (!Number.isFinite(p)) return;
        const exp = expanded[p as any] || 0;
        if (exp !== 0 && p > max) max = p;
    });
    return max;
};

/**
 * A compact scrolling ratio panel displayed in the bottom-left corner during Pure UI mode.
 * Shows all currently playing ratios in real-time as a minimal scrolling score.
 * User can toggle visibility on/off.
 */
export const RetuneSnapPanel: React.FC = memo(() => {
    const playingRatios = useStore(state => state.playingRatios);
    const retuneSnapDelayMs = useStore(state => state.retuneSnapDelayMs);
    const setRetuneSnapDelay = useStore(state => state.setRetuneSnapDelay);
    const showRetuneRatios = useStore(state => state.showRetuneRatios);
    const setShowRetuneRatios = useStore(state => state.setShowRetuneRatios);
    const setShowRatioStats = useStore(state => state.setShowRatioStats);
    const isPureUIMode = useStore(state => state.isPureUIMode);
    const retunePreviewActive = useStore(state => state.midiRetuner?.retunePreviewActive);
    const settings = useStore(state => state.settings);
    const nodes = useStore(state => state.nodes);

    const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
    const layoutMode = settings.visuals?.layoutMode || 'lattice';

    const hChromaColorForRatio = useMemo(() => {
        const visuals = settings.visuals || {};
        const baseA = clamp(Number(visuals.hChromaBase ?? 2), 1.01, 50);
        const lnA = Math.log(baseA);
        const primaryA = new THREE.Color(visuals.hChromaPrimaryA ?? '#ff0000');
        const primaryB = new THREE.Color(visuals.hChromaPrimaryB ?? '#0000ff');
        const primaryC = new THREE.Color(visuals.hChromaPrimaryC ?? '#ffff00');
        const anchors = (() => {
            const startFrac = normalizeFrac(Math.log(2) / lnA);
            const yellowFrac = normalizeFrac(Math.log(5) / lnA);
            const blueFrac = normalizeFrac(Math.log(3) / lnA);
            const yellowT = ((yellowFrac - startFrac) % 1 + 1) % 1;
            const blueT = ((blueFrac - startFrac) % 1 + 1) % 1;
            return { startFrac, yellowT, blueT };
        })();
        const colorMode = visuals.hChromaColorMode ?? 'pure';

        return (ratioValue: number) => {
            if (!Number.isFinite(ratioValue) || ratioValue <= 0 || !Number.isFinite(lnA)) return null;
            const frac = normalizeFrac(Math.log(ratioValue) / lnA);
            const primaries = { a: primaryA, b: primaryB, c: primaryC };
            let color: THREE.Color;
            if (colorMode === 'primaryRatio') {
                const weights = primaryWeightsFromHue(frac * 360);
                color = mixRgbFromWeights(weights, primaries);
            } else {
                color = spectrumColorFromFrac(frac, anchors, primaries);
            }
            return `#${color.getHexString()}`;
        };
    }, [
        settings.visuals?.hChromaBase,
        settings.visuals?.hChromaPrimaryA,
        settings.visuals?.hChromaPrimaryB,
        settings.visuals?.hChromaPrimaryC,
        settings.visuals?.hChromaColorMode
    ]);

    // Get all active voices sorted by pitch
    const activeVoices = useMemo(() => {
        if (!showRetuneRatios || playingRatios.size === 0) return [];

        const voices: { noteNumber: number, ratio: string, rawRatio: string, velocity: number, id: string, channel?: number, trackIndex?: number, nodeId?: string }[] = [];

        for (const [id, entry] of playingRatios) {
            // ID format is usually "noteNumber-time-channel" or similar
            const parts = id.split('-');
            const parsedNoteNumber = parseInt(parts[0], 10);
            const noteNumber = Number.isFinite(entry.noteNumber) ? (entry.noteNumber as number) : parsedNoteNumber;
            const parsedChannel = parseInt(parts[parts.length - 1], 10);
            const channel = Number.isFinite(entry.channel) ? entry.channel : (Number.isFinite(parsedChannel) ? parsedChannel : undefined);

            if (!isNaN(noteNumber)) {
                // Try to format ratio as fraction if it looks like a float
                let displayRatio = entry.ratio;
                if (entry.ratio.includes('.')) {
                    try {
                        const frac = parseGeneralRatio(entry.ratio);
                        // Only use fraction if denominator is reasonable (e.g. < 10000)
                        if (frac.d < BigInt(10000)) {
                            displayRatio = frac.n.toString() + '/' + frac.d.toString();
                        }
                    } catch (e) { /* ignore */ }
                }

                voices.push({
                    id,
                    noteNumber,
                    ratio: displayRatio, // Use formatted ratio for display
                    rawRatio: entry.ratio, // Keep raw for whatever else
                    velocity: entry.velocity,
                    channel,
                    trackIndex: entry.trackIndex,
                    nodeId: entry.nodeId
                });
            }
        }

        // Sort by pitch (Low -> High)
        return voices.sort((a, b) => a.noteNumber - b.noteNumber);
    }, [playingRatios, showRetuneRatios]);

    const [lastActiveVoices, setLastActiveVoices] = React.useState(activeVoices);

    React.useEffect(() => {
        if (activeVoices.length) {
            setLastActiveVoices(activeVoices);
        }
    }, [activeVoices]);

    const shouldHoldPanel = showRetuneRatios && isPureUIMode && retunePreviewActive;
    const displayedVoices = activeVoices.length ? activeVoices : (shouldHoldPanel ? lastActiveVoices : []);

    // Calculate Chord Ratio from all active voices (pitch order)
    const chordRatioString = useMemo(() => {
        if (displayedVoices.length < 2) return null;

        try {
            const rawRatios = displayedVoices.map(v => v.rawRatio || v.ratio);
            if (new Set(rawRatios).size < 2) return null; // Unison

            // Parse fractions using robust parser (preserve voice order)
            const fractions = rawRatios.map(r => parseGeneralRatio(r));

            // GCD helper
            const gcd = (a: bigint, b: bigint): bigint => {
                let x = a < 0n ? -a : a;
                let y = b < 0n ? -b : b;
                while (y > 0n) {
                    const t = y;
                    y = x % y;
                    x = t;
                }
                return x;
            };

            // LCM helper
            const lcm = (a: bigint, b: bigint): bigint => (a * b) / gcd(a, b);

            // Find common denominator
            let commonD = 1n;
            fractions.forEach(f => { commonD = lcm(commonD, f.d); });

            // Convert to common numerators
            let numerators = fractions.map(f => f.n * (commonD / f.d));

            // Simplify (divide all by global GCD)
            if (numerators.length > 0) {
                let commonFactor = numerators[0];
                for (let i = 1; i < numerators.length; i++) {
                    commonFactor = gcd(commonFactor, numerators[i]);
                }
                numerators = numerators.map(n => n / commonFactor);
            }

            if (numerators.length > 8) return 'Complexity Limit';

            return numerators.join(':');
        } catch (e) {
            return '...';
        }
    }, [displayedVoices]);

    const [colorOverrides, setColorOverrides] = React.useState<Map<string, number>>(new Map());

    const toggleVoiceColor = (voiceId: string) => {
        setColorOverrides(prev => {
            const next = new Map(prev);
            const current = next.get(voiceId) ?? -1;
            next.set(voiceId, (current + 1) % CHANNEL_COLORS.length);
            return next;
        });
    };

    const getVoiceColor = (voice: { id: string; trackIndex?: number; channel?: number }) => {
        const override = colorOverrides.get(voice.id);
        if (override !== undefined && override !== -1) return CHANNEL_COLORS[override];
        const idx = (voice.trackIndex ?? voice.channel ?? 0) % CHANNEL_COLORS.length;
        return CHANNEL_COLORS[idx];
    };

    const getRatioColor = (voice: { nodeId?: string; rawRatio?: string; ratio?: string }) => {
        let limit: number | null = null;
        let ratioValue: number | null = null;

        if (voice.nodeId) {
            const node = nodeById.get(voice.nodeId);
            if (node) {
                // Prefer axis/origin limit so colors match lattice line/limit colors
                limit = (node as any).originLimit ?? maxPrimeFromVector(node.primeVector as any);
                ratioValue = Math.pow(2, node.cents / 1200);
            }
        }

        if (limit === null) {
            const ratioStr = voice.rawRatio || voice.ratio || '';
            try {
                const frac = parseGeneralRatio(ratioStr);
                ratioValue = Number(frac.n) / Number(frac.d);

                // Derive the "odd limit" (remove factors of 2) so composite odd-limit colors can apply
                const strip2 = (x: bigint) => {
                    let v = x < 0n ? -x : x;
                    while (v > 0n && (v & 1n) === 0n) v >>= 1n;
                    return v;
                };
                const nOdd = strip2(frac.n);
                const dOdd = strip2(frac.d);
                const maxOdd = nOdd > dOdd ? nOdd : dOdd;

                if (maxOdd <= BigInt(Number.MAX_SAFE_INTEGER)) {
                    limit = Number(maxOdd);
                } else {
                    // Fallback: use maximum prime factor (keeps mapping stable even for huge ratios)
                    const maxN = maxPrimeFromBigInt(nOdd);
                    const maxD = maxPrimeFromBigInt(dOdd);
                    limit = Math.max(maxN, maxD);
                }
            } catch (e) {
                limit = null;
            }
        }

        if (layoutMode === 'h-chroma' && ratioValue !== null) {
            const hColor = hChromaColorForRatio(ratioValue);
            if (hColor) return hColor;
        }

        if (limit && limit > 1) {
            return getPrimeColor(limit as any, settings);
        }

        return '#ffffff';
    };

    // Show minimal toggle button when hidden but ratios are playing
    if (!showRetuneRatios && playingRatios.size > 0) {
        return (
            <div className="absolute bottom-4 left-4 pointer-events-auto z-20">
                <button
                    onClick={() => setShowRetuneRatios(true)}
                    className="bg-black/60 backdrop-blur-sm border border-gray-700/50 rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
                    title="Show ratio display"
                >
                    Ratios
                </button>
            </div>
        );
    }

    // Don't render if no ratios are playing and not in retune preview hold mode
    if (displayedVoices.length === 0 && !shouldHoldPanel) {
        return null;
    }

    return (
        <div className="absolute bottom-4 left-4 pointer-events-auto z-20">
            <div
                className="bg-black/80 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 shadow-xl flex flex-col gap-2"
                style={{ minWidth: '200px', maxWidth: '300px' }}
            >
                {/* Header with toggle, stats button, and delay slider */}
                <div className="flex items-center justify-between border-b border-gray-700/50 pb-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRetuneRatios(false)}
                            className="text-[10px] text-gray-400 uppercase font-bold tracking-wider hover:text-gray-200 transition-colors"
                            title="Hide ratio display"
                        >
                            Hide
                        </button>
                        <button
                            onClick={() => setShowRatioStats(true)}
                            className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded border border-gray-600 transition-colors"
                            title="Show Ratio Statistics"
                        >
                            Stats
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono">{retuneSnapDelayMs > 0 ? '+' : ''}{retuneSnapDelayMs}ms</span>
                        <input
                            type="range"
                            min="-200"
                            max="200"
                            step="10"
                            value={retuneSnapDelayMs}
                            onChange={(e) => setRetuneSnapDelay(parseInt(e.target.value, 10))}
                            className="w-16 h-1.5 accent-indigo-500 appearance-none bg-gray-700 rounded cursor-pointer"
                            title="Audio-Visual Delay Offset"
                        />
                    </div>
                </div>

                {/* Chord Ratio Display */}
                {chordRatioString ? (
                    <div className="px-3 py-2 bg-indigo-950/60 border border-indigo-500/30 rounded text-center shadow-inner">
                        <div className="text-[9px] text-indigo-400 font-bold tracking-widest uppercase opacity-80 mb-1">Chord Ratio</div>
                        <div className={`font-mono text-indigo-100 font-bold tracking-tight leading-none drop-shadow-md whitespace-nowrap 
                            ${chordRatioString.length > 20 ? 'text-xs' : chordRatioString.length > 12 ? 'text-sm' : chordRatioString.length > 8 ? 'text-base' : 'text-xl'}`}>
                            {chordRatioString}
                        </div>
                    </div>
                ) : (
                    <div className="px-3 py-2 bg-indigo-950/40 border border-indigo-500/20 rounded text-center shadow-inner">
                        <div className="text-[9px] text-indigo-300 font-bold tracking-widest uppercase opacity-80 mb-1">Chord Ratio</div>
                        <div className="font-mono text-indigo-100 font-bold tracking-tight leading-none text-sm">Idle</div>
                    </div>
                )}

                {/* Individual Voices List */}
                <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent pr-1">
                    <div className="text-[9px] text-gray-500 font-bold tracking-wider uppercase mb-0.5">Active Voices ({displayedVoices.length})</div>
                    <div className="flex flex-col-reverse gap-1">
                        {displayedVoices.map((voice) => {
                            const ratioStr = voice.ratio;
                            const isLong = ratioStr.length > 5;
                            const isVeryLong = ratioStr.length > 8;

                            const voiceColor = getVoiceColor(voice);
                            const ratioColor = getRatioColor(voice);

                            return (
                                <div
                                    key={voice.id}
                                    className="flex items-center justify-between px-2 py-1.5 bg-gray-800/40 border border-gray-700/30 rounded font-mono text-sm group hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => toggleVoiceColor(voice.id)}
                                    title="Click to cycle voice color"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: voiceColor }} />
                                        <span className="text-[10px] w-6 text-right select-none" style={{ color: voiceColor, opacity: 0.85 }}>{voice.noteNumber}</span>
                                    </div>
                                    <span
                                        className={`font-bold tracking-wide transition-all ${isVeryLong ? 'text-[10px]' : isLong ? 'text-xs' : 'text-sm'}`}
                                        style={{ color: ratioColor }}
                                    >
                                        {voice.ratio}
                                    </span>
                                    <div className="h-1.5 w-8 bg-gray-700 rounded-full overflow-hidden ml-2">
                                        <div
                                            className="h-full transition-all duration-75"
                                            style={{
                                                width: (Math.min(100, voice.velocity * 100)) + '%',
                                                opacity: 0.5 + voice.velocity * 0.5,
                                                backgroundColor: voiceColor
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
});

RetuneSnapPanel.displayName = 'RetuneSnapPanel';
