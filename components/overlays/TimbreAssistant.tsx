
import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { TimbrePatch } from '../../typesPart1';
import { TimbreUpgradePanel } from './timbreTab/TimbreUpgradePanel';
import { TIMBRE_UPGRADE_OPTIONS } from '../../utils/timbreUpgrade';

interface TimbreAssistantProps {
    onClose: () => void;
}

const MODULE_OPTIONS = [
    { id: 'M1', name: 'M1 Cleanup & Repair', desc: 'De-noise, de-click, de-ess, de-resonance' },
    { id: 'M2', name: 'M2 Surgical EQ', desc: 'HPF/LPF, resonance control' },
    { id: 'M3', name: 'M3 Tone EQ', desc: 'Warmth, air, presence shaping' },
    { id: 'M4', name: 'M4 Dynamics', desc: 'Compression, density, stability' },
    { id: 'M5', name: 'M5 Harmonics', desc: 'Saturation, tape/tube tone' },
    { id: 'M6', name: 'M6 Transient', desc: 'Attack, sustain, micro-dynamics' },
    { id: 'M7', name: 'M7 Stereo/Depth', desc: 'Width, M/S balance' },
    { id: 'M8', name: 'M8 Space', desc: 'Reverb, delay, glue' },
    { id: 'M9', name: 'M9 Motion', desc: 'Micro modulation, movement' },
    { id: 'M10', name: 'M10 Texture', desc: 'Layering, noise texture' },
    { id: 'M11', name: 'M11 Character', desc: 'Lo-fi, bitcrush' },
    { id: 'M12', name: 'M12 Final QC', desc: 'Limiter, peak control' },
];

const SOURCE_OPTIONS = TIMBRE_UPGRADE_OPTIONS.sourceTypes;
const STYLE_OPTIONS = TIMBRE_UPGRADE_OPTIONS.styleTargets;
const MOOD_OPTIONS = TIMBRE_UPGRADE_OPTIONS.moodKeywords;

type TimbreProfile = {
    warmth: number;
    brightness: number;
    air: number;
    aggression: number;
    density: number;
    space: number;
    width: number;
    texture: number;
    metallic: number;
    woody: number;
    glassy: number;
    vintage: number;
    lofi: number;
    cinematic: number;
    experimental: number;
    clarity: number;
    punch: number;
    smooth: number;
    formant: number;
    motion: number;
    lowWeight: number;
    tags: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sliderSigned = (value: number) => clamp((value - 50) / 50, -1, 1);
const sliderUnsigned = (value: number) => clamp(value / 100, 0, 1);

const KEYWORD_MAP: Record<string, Partial<TimbreProfile>> = {
    warm: { warmth: 0.9, smooth: 0.4 },
    cold: { warmth: -0.7, brightness: 0.2 },
    bright: { brightness: 0.9, air: 0.6 },
    dark: { brightness: -0.9, air: -0.4 },
    aggressive: { aggression: 0.9, punch: 0.7 },
    punchy: { aggression: 0.7, punch: 0.8 },
    heavy: { density: 0.7, lowWeight: 0.8 },
    silky: { smooth: 0.8, air: 0.4 },
    airy: { air: 0.9, clarity: 0.5 },
    transparent: { clarity: 0.9, texture: -0.2 },
    clear: { clarity: 0.8 },
    grainy: { texture: 0.8 },
    gritty: { texture: 0.7, aggression: 0.4 },
    metallic: { metallic: 0.9, brightness: 0.4 },
    woody: { woody: 0.9, warmth: 0.4 },
    glassy: { glassy: 0.9, brightness: 0.4, air: 0.3 },
    vintage: { vintage: 0.8, warmth: 0.4 },
    retro: { vintage: 0.7, warmth: 0.3 },
    lofi: { lofi: 0.9, texture: 0.6, brightness: -0.2 },
    'lo-fi': { lofi: 0.9, texture: 0.6, brightness: -0.2 },
    cinematic: { cinematic: 0.9, space: 0.8, width: 0.6 },
    ambient: { space: 0.9, width: 0.6, smooth: 0.4 },
    experimental: { experimental: 0.9, metallic: 0.4, texture: 0.5 },
    cyber: { experimental: 0.7, metallic: 0.6, glassy: 0.4 },
    hyperpop: { brightness: 0.7, aggression: 0.7, texture: 0.4 },
    trap: { aggression: 0.7, density: 0.6, lowWeight: 0.6 },
    rock: { aggression: 0.6, density: 0.5 },
    jazz: { warmth: 0.5, smooth: 0.4 },
    classical: { smooth: 0.6, clarity: 0.5, space: 0.4 },
    electronic: { brightness: 0.4, texture: 0.3 },
    pluck: { punch: 0.6, aggression: 0.4 },
    pad: { smooth: 0.6, space: 0.6 },
    lead: { clarity: 0.5, brightness: 0.3 },
    bass: { lowWeight: 0.8, density: 0.5 },
    vocal: { formant: 0.7, clarity: 0.5 },
    voice: { formant: 0.7, clarity: 0.5 },
    breathy: { air: 0.6, texture: 0.3 },
    nasal: { formant: 0.8 },
    wide: { width: 0.8 },
    narrow: { width: -0.6 },
    dry: { space: -0.6 },
    wet: { space: 0.8 },
    moving: { motion: 0.6 },
    shimmer: { air: 0.7, glassy: 0.4 }
};

const STYLE_PRESETS: Record<string, Partial<TimbreProfile>> = {
    Modern: { clarity: 0.4, brightness: 0.3 },
    Vintage: { vintage: 0.7, warmth: 0.4, smooth: 0.3 },
    Cinematic: { cinematic: 0.8, space: 0.7, width: 0.6 },
    Electronic: { brightness: 0.3, texture: 0.3 },
    'Lo-fi': { lofi: 0.8, texture: 0.6, brightness: -0.3 },
    Hyperpop: { brightness: 0.7, aggression: 0.6, texture: 0.3 },
    Trap: { aggression: 0.6, lowWeight: 0.6, density: 0.5 },
    Rock: { aggression: 0.6, density: 0.5 },
    Jazz: { warmth: 0.5, smooth: 0.4 },
    Classical: { smooth: 0.6, clarity: 0.4, space: 0.4 },
    Experimental: { experimental: 0.8, texture: 0.5, metallic: 0.3 },
    Cyber: { experimental: 0.6, metallic: 0.5, glassy: 0.3 },
    Ambient: { space: 0.8, width: 0.6, smooth: 0.4 }
};

const MOOD_PRESETS: Record<string, Partial<TimbreProfile>> = {
    Warm: { warmth: 0.8, smooth: 0.4 },
    Cold: { warmth: -0.6, brightness: 0.2 },
    Bright: { brightness: 0.8, air: 0.6 },
    Dark: { brightness: -0.8, air: -0.4 },
    Aggressive: { aggression: 0.8, punch: 0.6 },
    Silky: { smooth: 0.8, air: 0.4 },
    Airy: { air: 0.8, clarity: 0.4 },
    Heavy: { density: 0.8, lowWeight: 0.7 },
    Transparent: { clarity: 0.8, texture: -0.2 },
    Grainy: { texture: 0.7 },
    Metallic: { metallic: 0.7, brightness: 0.4 },
    Woody: { woody: 0.7, warmth: 0.3 },
    Glassy: { glassy: 0.7, brightness: 0.3 }
};

const SOURCE_PRESETS: Record<string, Partial<TimbreProfile>> = {
    'Vocal': { formant: 0.7, clarity: 0.5, smooth: 0.3 },
    'Drums': { punch: 0.8, aggression: 0.6 },
    'Bass': { lowWeight: 0.8, density: 0.6 },
    'Guitar': { warmth: 0.4, aggression: 0.3 },
    'Piano': { clarity: 0.5, smooth: 0.3 },
    'Strings': { smooth: 0.6, space: 0.4 },
    'Brass': { aggression: 0.5, brightness: 0.3 },
    'Woodwinds': { smooth: 0.5, warmth: 0.4 },
    'Synth Lead': { clarity: 0.5, brightness: 0.3 },
    'Pad': { smooth: 0.7, space: 0.6, width: 0.4 },
    'Pluck': { punch: 0.6, aggression: 0.4 },
    'FX': { experimental: 0.6, texture: 0.6 },
    'Ambient/Atmosphere': { space: 0.8, width: 0.6, smooth: 0.4 },
    'Full Mix': { clarity: 0.5, density: 0.4 }
};

export const TimbreAssistant: React.FC<TimbreAssistantProps> = ({ onClose }) => {
    const settings = useStore(state => state.settings);
    const updateSettings = useStore(state => state.updateSettings);

    const [inputType, setInputType] = useState('Synth Lead');
    const [styleTarget, setStyleTarget] = useState('Modern');
    const [mood, setMood] = useState('Warm');
    const [descriptor, setDescriptor] = useState('');
    const [reference, setReference] = useState('');
    const [selectedRoute, setSelectedRoute] = useState<'Hi-Fi Natural' | 'Stylized Character' | 'Experimental / Futuristic'>('Stylized Character');
    const [rightTab, setRightTab] = useState<'modules' | 'toolkit'>('modules');
    const [intensity, setIntensity] = useState(70);
    const [autoEnable, setAutoEnable] = useState(true);
    const [createVariants, setCreateVariants] = useState(false);
    const [intent, setIntent] = useState({
        brightness: 50,
        warmth: 50,
        air: 50,
        aggression: 50,
        density: 50,
        space: 50,
        width: 50,
        texture: 50
    });
    const [activeModules, setActiveModules] = useState<Record<string, boolean>>({
        M3: true,
        M4: true,
        M5: true, // Harmonics
        M8: true  // Space
    });

    const getSourcePatch = (): TimbrePatch | null => {
        return settings.timbre.patches.find(p => p.id === settings.timbre.activePatchId) || null;
    };

    const updateActivePatch = (partial: Partial<TimbrePatch>) => {
        const source = getSourcePatch();
        if (!source) return;
        const nextPatches = settings.timbre.patches.map(p => (
            p.id === source.id ? { ...p, ...partial } : p
        ));
        updateSettings({
            timbre: {
                ...settings.timbre,
                patches: nextPatches
            }
        });
    };

    const updateVoice = (partial: Partial<TimbrePatch['voice']>) => {
        const source = getSourcePatch();
        if (!source) return;
        updateActivePatch({ voice: { ...source.voice, ...partial } });
    };

    const profile = useMemo<TimbreProfile>(() => {
        const next: TimbreProfile = {
            warmth: 0,
            brightness: 0,
            air: 0,
            aggression: 0,
            density: 0,
            space: 0,
            width: 0,
            texture: 0,
            metallic: 0,
            woody: 0,
            glassy: 0,
            vintage: 0,
            lofi: 0,
            cinematic: 0,
            experimental: 0,
            clarity: 0,
            punch: 0,
            smooth: 0,
            formant: 0,
            motion: 0,
            lowWeight: 0,
            tags: []
        };

        const add = (partial: Partial<TimbreProfile>, tag?: string) => {
            Object.entries(partial).forEach(([key, value]) => {
                if (key === 'tags') return;
                const numeric = typeof value === 'number' ? value : 0;
                (next as any)[key] = (next as any)[key] + numeric;
            });
            if (tag) next.tags.push(tag);
        };

        add(SOURCE_PRESETS[inputType] || {});
        add(STYLE_PRESETS[styleTarget] || {}, styleTarget);
        add(MOOD_PRESETS[mood] || {}, mood);

        const tokens = descriptor.toLowerCase().match(/[a-z0-9-]+/g) || [];
        tokens.forEach((token) => {
            const match = KEYWORD_MAP[token];
            if (match) add(match, token);
        });

        add({
            brightness: sliderSigned(intent.brightness),
            warmth: sliderSigned(intent.warmth),
            air: sliderSigned(intent.air),
            aggression: sliderSigned(intent.aggression),
            density: sliderSigned(intent.density),
            space: sliderSigned(intent.space),
            width: sliderSigned(intent.width),
            texture: sliderSigned(intent.texture)
        }, 'intent');

        return next;
    }, [descriptor, inputType, intent, mood, styleTarget]);

    const buildRouteProfile = (route: string) => {
        const next = { ...profile };
        const add = (partial: Partial<TimbreProfile>) => {
            Object.entries(partial).forEach(([key, value]) => {
                if (typeof value !== 'number') return;
                (next as any)[key] = (next as any)[key] + value;
            });
        };
        if (route === 'Hi-Fi Natural') {
            add({ clarity: 0.4, smooth: 0.3, texture: -0.3, lofi: -0.4, aggression: -0.2, space: 0.1 });
        } else if (route === 'Stylized Character') {
            add({ aggression: 0.3, texture: 0.3, motion: 0.2, width: 0.2 });
        } else {
            add({ experimental: 0.5, metallic: 0.4, texture: 0.4, motion: 0.3, glassy: 0.2 });
        }
        return next;
    };

    const buildModulePlan = (p: TimbreProfile) => ({
        M1: p.clarity > 0.2 || p.lofi > 0.2,
        M2: true,
        M3: true,
        M4: p.density > 0.15 || p.aggression > 0.2,
        M5: p.warmth > 0.15 || p.aggression > 0.2 || p.vintage > 0.2,
        M6: p.punch > 0.2,
        M7: p.width > 0.2,
        M8: p.space > 0.2,
        M9: p.motion > 0.2,
        M10: p.texture > 0.2,
        M11: p.lofi > 0.2 || p.experimental > 0.4,
        M12: true
    });

    const getEnvelopeTargets = (source: string) => {
        const key = source.toLowerCase();
        if (key.includes('drum')) return { attackMs: 2, decayMs: 250, sustain: 0.1, releaseMs: 200 };
        if (key.includes('pluck')) return { attackMs: 8, decayMs: 600, sustain: 0.25, releaseMs: 600 };
        if (key.includes('pad') || key.includes('ambient')) return { attackMs: 600, decayMs: 1200, sustain: 0.8, releaseMs: 1500 };
        if (key.includes('bass')) return { attackMs: 20, decayMs: 400, sustain: 0.6, releaseMs: 500 };
        if (key.includes('vocal') || key.includes('voice')) return { attackMs: 20, decayMs: 500, sustain: 0.85, releaseMs: 700 };
        if (key.includes('strings') || key.includes('brass') || key.includes('wood')) return { attackMs: 40, decayMs: 700, sustain: 0.8, releaseMs: 900 };
        return { attackMs: 15, decayMs: 450, sustain: 0.65, releaseMs: 500 };
    };

    const applyProfileToPatch = (
        patch: TimbrePatch,
        p: TimbreProfile,
        routeLabel: string,
        intensityScale: number,
        modulePlan: Record<string, boolean>
    ) => {
        const voice = patch.voice;
        const routing = patch.routing;
        const t = clamp01(sliderUnsigned(intensity) * intensityScale);

        const bright = clamp(p.brightness + p.air * 0.3 + p.glassy * 0.2, -1, 1);
        const warm = clamp(p.warmth + p.woody * 0.3 - p.brightness * 0.2, -1, 1);
        const air = clamp(p.air + p.glassy * 0.3, -1, 1);
        const aggression = clamp(p.aggression + p.punch * 0.4, -1, 1);
        const density = clamp(p.density + p.lowWeight * 0.3, -1, 1);
        const texture = clamp(p.texture + p.lofi * 0.3 + p.experimental * 0.2, -1, 1);
        const width = clamp(p.width + p.cinematic * 0.4, -1, 1);
        const space = clamp(p.space + p.cinematic * 0.4, -1, 1);
        const clarity = clamp(p.clarity - p.lofi * 0.2, -1, 1);

        const enableRouting = (key: keyof TimbrePatch['routing']) => {
            if (autoEnable) routing[key] = true;
        };

        if (modulePlan.M1 || modulePlan.M2) {
            voice.eq.enabled = true;
            enableRouting('enableEq');
            voice.eq.lowFreq = lerp(voice.eq.lowFreq, 90, t);
            voice.eq.lowGain = clamp(lerp(voice.eq.lowGain, -2 - texture, t), -12, 12);
            voice.noise.mix = clamp(lerp(voice.noise.mix, 0.02, t), 0, 1);
        }

        if (modulePlan.M3) {
            voice.eq.enabled = true;
            enableRouting('enableEq');
            voice.eq.lowGain = clamp(lerp(voice.eq.lowGain, voice.eq.lowGain + warm * 3 + density * 2, t), -12, 12);
            voice.eq.midGain = clamp(lerp(voice.eq.midGain, voice.eq.midGain + clarity * 2 - texture * 1, t), -12, 12);
            voice.eq.highGain = clamp(lerp(voice.eq.highGain, voice.eq.highGain + bright * 4 + air * 2 - p.lofi * 4, t), -12, 12);
            voice.eq.midQ = clamp(lerp(voice.eq.midQ, 0.7 + Math.abs(aggression) * 0.6, t), 0.2, 4);
        }

        if (modulePlan.M4) {
            voice.compressor.enabled = true;
            enableRouting('enableCompressor');
            voice.compressor.ratio = clamp(lerp(voice.compressor.ratio, 2 + density * 4 + Math.max(0, aggression) * 2, t), 1.2, 12);
            voice.compressor.threshold = clamp(lerp(voice.compressor.threshold, -24 + density * 8, t), -60, 0);
            voice.compressor.attackMs = clamp(lerp(voice.compressor.attackMs, 30 - aggression * 15, t), 1, 60);
            voice.compressor.releaseMs = clamp(lerp(voice.compressor.releaseMs, 120 + density * 80, t), 20, 400);
        }

        if (modulePlan.M5) {
            voice.nonlinearity.enabled = true;
            enableRouting('enableNonlinearity');
            const satType =
                p.lofi > 0.4 ? 'bit-crush' :
                aggression > 0.4 ? 'hard-clip' :
                p.vintage > 0.3 ? 'tanh' : 'soft-clip';
            voice.nonlinearity.type = satType as any;
            voice.nonlinearity.drive = clamp(lerp(voice.nonlinearity.drive, 0.3 + Math.max(0, aggression) * 1.4 + p.lofi * 0.6, t), 0, 6);
            voice.nonlinearity.mix = clamp(lerp(voice.nonlinearity.mix, 0.25 + Math.max(0, aggression) * 0.5, t), 0, 1);
            voice.nonlinearity.compensation = clamp(lerp(voice.nonlinearity.compensation, 0.6 + p.vintage * 0.4, t), 0, 2);
        }

        if (modulePlan.M6) {
            const envTargets = getEnvelopeTargets(inputType);
            voice.envelopes.amp.attackMs = clamp(lerp(voice.envelopes.amp.attackMs, envTargets.attackMs, t), 1, 4000);
            voice.envelopes.amp.decayMs = clamp(lerp(voice.envelopes.amp.decayMs, envTargets.decayMs, t), 10, 8000);
            voice.envelopes.amp.sustain = clamp(lerp(voice.envelopes.amp.sustain, envTargets.sustain, t), 0, 1);
            voice.envelopes.amp.releaseMs = clamp(lerp(voice.envelopes.amp.releaseMs, envTargets.releaseMs, t), 10, 10000);
            voice.envelopes.filter.amount = clamp(lerp(voice.envelopes.filter.amount, 0.3 + Math.max(0, aggression) * 0.3, t), -1, 1);
            voice.envelopes.filter.attackMs = clamp(lerp(voice.envelopes.filter.attackMs, envTargets.attackMs * 0.6, t), 1, 4000);
            voice.envelopes.filter.decayMs = clamp(lerp(voice.envelopes.filter.decayMs, envTargets.decayMs * 0.7, t), 10, 8000);
            voice.envelopes.filter.sustain = clamp(lerp(voice.envelopes.filter.sustain, envTargets.sustain, t), 0, 1);
            voice.envelopes.filter.releaseMs = clamp(lerp(voice.envelopes.filter.releaseMs, envTargets.releaseMs * 0.7, t), 10, 10000);
        }

        if (modulePlan.M7) {
            voice.unison.enabled = true;
            voice.unison.voices = clamp(Math.round(lerp(voice.unison.voices, 1 + width * 6, t)), 1, 16);
            voice.unison.detune = clamp(lerp(voice.unison.detune, 5 + Math.abs(width) * 25, t), 0, 100);
            voice.unison.spread = clamp(lerp(voice.unison.spread, 0.2 + Math.abs(width) * 0.8, t), 0, 1);
            voice.unison.blend = clamp(lerp(voice.unison.blend, 0.4 + Math.abs(width) * 0.4, t), 0, 1);

            if (width > 0.15) {
                voice.chorus.enabled = true;
                enableRouting('enableChorus');
                voice.chorus.mix = clamp(lerp(voice.chorus.mix, 0.08 + Math.abs(width) * 0.25, t), 0, 1);
                voice.chorus.depth = clamp(lerp(voice.chorus.depth, 5 + Math.abs(width) * 12, t), 0, 50);
                voice.chorus.rate = clamp(lerp(voice.chorus.rate, 0.2 + Math.abs(width) * 0.6, t), 0.05, 5);
            }
        }

        if (modulePlan.M8) {
            voice.space.reverb.enabled = true;
            enableRouting('enableSpace');
            voice.space.reverb.mix = clamp(lerp(voice.space.reverb.mix, 0.1 + Math.max(0, space) * 0.4, t), 0, 0.8);
            voice.space.reverb.decay = clamp(lerp(voice.space.reverb.decay, 0.6 + Math.max(0, space) * 2.4, t), 0.2, 8);
            voice.space.reverb.size = clamp(lerp(voice.space.reverb.size, 0.4 + Math.max(0, space) * 0.5, t), 0.1, 1);
            voice.space.reverb.preDelayMs = clamp(lerp(voice.space.reverb.preDelayMs, 10 + Math.max(0, space) * 20, t), 0, 120);
            voice.space.reverb.dampingHz = clamp(lerp(voice.space.reverb.dampingHz, 8000 - warm * 2000, t), 1000, 16000);
            voice.space.reverb.stereoWidth = clamp(lerp(voice.space.reverb.stereoWidth ?? 1, 1 + Math.max(0, width) * 0.6, t), 0.5, 2);

            if (space > 0.2) {
                voice.delay.enabled = true;
                enableRouting('enableDelay');
                voice.delay.mix = clamp(lerp(voice.delay.mix, 0.08 + Math.max(0, space) * 0.18, t), 0, 0.5);
                voice.delay.feedback = clamp(lerp(voice.delay.feedback, 0.2 + Math.max(0, space) * 0.3, t), 0, 0.9);
                voice.delay.timeMs = clamp(lerp(voice.delay.timeMs, 220 + Math.max(0, space) * 320, t), 40, 1200);
                voice.delay.filterHz = clamp(lerp(voice.delay.filterHz, 6000 + bright * 3000, t), 800, 16000);
            }
        }

        if (modulePlan.M9) {
            voice.lfo.lfo1.enabled = true;
            voice.lfo.lfo1.rateHz = clamp(lerp(voice.lfo.lfo1.rateHz, 0.15 + Math.max(0, p.motion) * 0.6, t), 0.05, 5);
            if (voice.filter.enabled) {
                voice.filter.lfoAmount = clamp(lerp(voice.filter.lfoAmount ?? 0, 0.04 + Math.max(0, p.motion) * 0.12, t), 0, 1);
            } else {
                voice.harmonic.jitter = clamp(lerp(voice.harmonic.jitter, 0.02 + Math.max(0, p.motion) * 0.08, t), 0, 0.5);
            }
        }

        if (modulePlan.M10) {
            voice.noise.enabled = true;
            enableRouting('enableNoise');
            voice.noise.mix = clamp(lerp(voice.noise.mix, 0.04 + Math.max(0, texture) * 0.12, t), 0, 0.6);
            voice.noise.sustainAmount = clamp(lerp(voice.noise.sustainAmount, 0.04 + Math.max(0, texture) * 0.2, t), 0, 1);
            voice.noise.filterHz = clamp(lerp(voice.noise.filterHz, 6000 + bright * 6000, t), 400, 16000);
        }

        if (modulePlan.M11) {
            voice.bitcrush.enabled = true;
            enableRouting('enableBitcrush');
            voice.bitcrush.mix = clamp(lerp(voice.bitcrush.mix, 0.15 + p.lofi * 0.4, t), 0, 1);
            voice.bitcrush.bitDepth = clamp(Math.round(lerp(voice.bitcrush.bitDepth ?? 12, 12 - p.lofi * 6, t)), 2, 16);
            voice.bitcrush.sampleRateReduce = clamp(Math.round(lerp(voice.bitcrush.sampleRateReduce ?? 1, 1 + p.lofi * 12, t)), 1, 32);
        }

        if (modulePlan.M12) {
            voice.limiter.enabled = true;
            enableRouting('enableLimiter');
            voice.limiter.threshold = clamp(lerp(voice.limiter.threshold, -1.2 + Math.max(0, density) * -1, t), -6, 0);
            voice.limiter.releaseMs = clamp(lerp(voice.limiter.releaseMs, 80 + Math.max(0, density) * 120, t), 20, 400);
        }

        // Harmonic shaping
        voice.harmonic.enabled = true;
        enableRouting('enableHarmonic');
        voice.harmonic.rolloff = clamp(lerp(voice.harmonic.rolloff, 1.4 - bright * 0.6 + warm * 0.4, t), 0.6, 2.2);
        voice.harmonic.brightness = clamp(lerp(voice.harmonic.brightness, bright * 0.7 + air * 0.4 - warm * 0.2, t), -0.6, 0.9);
        voice.harmonic.harmonicCount = clamp(Math.round(lerp(voice.harmonic.harmonicCount, 18 + density * 22 + Math.max(0, bright) * 12, t)), 4, 64);
        voice.harmonic.jitter = clamp(lerp(voice.harmonic.jitter, 0.02 + Math.max(0, texture) * 0.2 + Math.max(0, p.metallic) * 0.15, t), 0, 0.8);
        voice.harmonic.inharmonicity = clamp(lerp(voice.harmonic.inharmonicity, Math.max(0, p.metallic) * 0.5 + Math.max(0, p.experimental) * 0.4, t), 0, 1);
        voice.harmonic.phaseMode = (p.metallic > 0.4 || p.experimental > 0.4 || texture > 0.4) ? 'random' : 'locked';

        if (p.formant > 0.3) {
            voice.harmonic.mask = 'formant';
            voice.harmonic.maskConfig = voice.harmonic.maskConfig || {};
            voice.harmonic.maskConfig.formants = [
                { freq: 500, width: 100, gain: 1 },
                { freq: 1500, width: 140, gain: 0.8 },
                { freq: 2500, width: 160, gain: 0.6 }
            ];
        }

        // Filter shaping
        voice.filter.enabled = true;
        enableRouting('enableFilter');
        voice.filter.cutoffHz = clamp(lerp(voice.filter.cutoffHz, voice.filter.cutoffHz * (1 + bright * 0.6 + air * 0.3 - p.lofi * 0.5), t), 200, 20000);
        voice.filter.q = clamp(lerp(voice.filter.q, 0.5 + Math.max(0, aggression) * 1.6 + Math.max(0, p.metallic) * 0.6, t), 0.2, 10);
        voice.filter.envAmount = clamp(lerp(voice.filter.envAmount, 0.15 + Math.max(0, aggression) * 0.3, t), -1, 1);

        // Route tags
        const refTag = reference.trim();
        patch.tags = Array.from(new Set([...(patch.tags || []), inputType, styleTarget, mood, routeLabel, ...p.tags, ...(refTag ? [`ref:${refTag}`] : [])]));
    };

    const applyUpgrade = () => {
        const source = getSourcePatch();
        if (!source) return;

        const routes = createVariants
            ? ['Hi-Fi Natural', 'Stylized Character', 'Experimental / Futuristic']
            : [selectedRoute];

        const newPatches = routes.map((route, idx) => {
            const newPatch = JSON.parse(JSON.stringify(source)) as TimbrePatch;
            const routeProfile = buildRouteProfile(route);
            const planBase = buildModulePlan(routeProfile);
            const modulePlan = autoEnable ? { ...planBase, ...activeModules } : activeModules;
            const scale = route === selectedRoute ? 1 : 0.8 + idx * 0.05;
            applyProfileToPatch(newPatch, routeProfile, route, scale, modulePlan);
            newPatch.name = `${source.name} (${route})`;
            newPatch.id = crypto.randomUUID();
            return newPatch;
        });

        const activeIdx = Math.max(0, routes.indexOf(selectedRoute));
        updateSettings({
            timbre: {
                ...settings.timbre,
                patches: [...settings.timbre.patches, ...newPatches],
                activePatchId: newPatches[activeIdx]?.id || newPatches[0]?.id || settings.timbre.activePatchId
            }
        });

        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-[#333] w-[800px] h-[600px] flex flex-col shadow-2xl rounded-lg overflow-hidden">
                {/* Header */}
                <div className="h-14 border-b border-[#333] flex items-center justify-between px-6 bg-[#222]">
                    <h2 className="text-white font-medium text-lg flex items-center gap-2">Timbre Upgrade Assistant</h2>
                    <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">X</button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Inputs */}
                    <div className="w-64 border-r border-[#333] bg-[#1e1e1e] p-6 space-y-6 overflow-y-auto">
                        <div>
                            <label className="block text-[#888] text-xs uppercase mb-2">Input Source</label>
                            <select className="w-full bg-[#111] border border-[#333] text-sm text-[#eee] rounded p-2 focus:border-blue-500 outline-none"
                                value={inputType} onChange={e => setInputType(e.target.value)}>
                                {SOURCE_OPTIONS.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[#888] text-xs uppercase mb-2">Target Style</label>
                            <select className="w-full bg-[#111] border border-[#333] text-sm text-[#eee] rounded p-2 focus:border-blue-500 outline-none"
                                value={styleTarget} onChange={e => setStyleTarget(e.target.value)}>
                                {STYLE_OPTIONS.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[#888] text-xs uppercase mb-2">Mood / Texture</label>
                            <select className="w-full bg-[#111] border border-[#333] text-sm text-[#eee] rounded p-2 focus:border-blue-500 outline-none"
                                value={mood} onChange={e => setMood(e.target.value)}>
                                {MOOD_OPTIONS.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[#888] text-xs uppercase mb-2">Describe Timbre</label>
                            <textarea
                                rows={3}
                                value={descriptor}
                                onChange={(e) => setDescriptor(e.target.value)}
                                placeholder="e.g. warm airy pad, metallic pluck, dark aggressive bass..."
                                className="w-full bg-[#111] border border-[#333] text-sm text-[#eee] rounded p-2 focus:border-blue-500 outline-none resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[#888] text-xs uppercase mb-2">Reference</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="Track / artist / notes"
                                className="w-full bg-[#111] border border-[#333] text-sm text-[#eee] rounded p-2 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="border-t border-[#333] pt-4">
                            <label className="block text-[#888] text-xs uppercase mb-2">Intensity</label>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={intensity}
                                onChange={(e) => setIntensity(parseInt(e.target.value, 10))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-[#666] mt-1">
                                <span>Subtle</span>
                                <span>{intensity}%</span>
                                <span>Extreme</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    checked={autoEnable}
                                    onChange={(e) => setAutoEnable(e.target.checked)}
                                />
                                <span className="text-[11px] text-[#aaa]">Auto-plan modules & routing</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    checked={createVariants}
                                    onChange={(e) => setCreateVariants(e.target.checked)}
                                />
                                <span className="text-[11px] text-[#aaa]">Create 3 route variants</span>
                            </div>
                        </div>

                        <div className="border-t border-[#333] pt-4">
                            <label className="block text-[#888] text-xs uppercase mb-2">Intent Controls</label>
                            {([
                                { key: 'brightness', label: 'Brightness' },
                                { key: 'warmth', label: 'Warmth' },
                                { key: 'air', label: 'Air' },
                                { key: 'aggression', label: 'Aggression' },
                                { key: 'density', label: 'Density' },
                                { key: 'space', label: 'Space' },
                                { key: 'width', label: 'Width' },
                                { key: 'texture', label: 'Texture' }
                            ] as const).map((item) => (
                                <div key={item.key} className="mb-2">
                                    <div className="flex justify-between text-[10px] text-[#666]">
                                        <span>{item.label}</span>
                                        <span>{intent[item.key]}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        value={intent[item.key]}
                                        onChange={(e) => setIntent(prev => ({ ...prev, [item.key]: parseInt(e.target.value, 10) }))}
                                        className="w-full"
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-[#333]">
                            <label className="block text-[#888] text-xs uppercase mb-3">Upgrade Route</label>
                        <div className="space-y-2">
                                {['Hi-Fi Natural', 'Stylized Character', 'Experimental / Futuristic'].map(r => (
                                    <div
                                        key={r}
                                        onClick={() => setSelectedRoute(r as any)}
                                        className={`cursor-pointer px-3 py-2 rounded text-sm transition-all border ${selectedRoute === r
                                            ? 'border-blue-500/50 bg-blue-500/10 text-white'
                                            : 'border-[#333] bg-[#222] text-[#888] hover:border-[#555]'
                                            }`}
                                    >
                                        {r}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Modules */}
                    <div className="flex-1 bg-[#151515] p-6 overflow-y-auto">
                        <div className="flex items-center gap-2 mb-4">
                            {['modules', 'toolkit'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setRightTab(tab as 'modules' | 'toolkit')}
                                    className={`px-3 py-1 text-xs font-semibold rounded border ${rightTab === tab
                                        ? 'border-blue-500/60 bg-blue-500/10 text-white'
                                        : 'border-[#333] bg-[#222] text-[#888] hover:text-white'
                                        }`}
                                >
                                    {tab === 'modules' ? 'Modules' : 'Toolkit'}
                                </button>
                            ))}
                        </div>

                        {rightTab === 'modules' ? (
                            <>
                                <div className="mb-3 text-[10px] text-[#666] space-y-1">
                                    <div>
                                        Detected: {Array.from(new Set(profile.tags)).slice(0, 6).join(', ') || 'none'}
                                    </div>
                                    <div>
                                        Bright {profile.brightness.toFixed(2)} • Warm {profile.warmth.toFixed(2)} • Air {profile.air.toFixed(2)} • Space {profile.space.toFixed(2)}
                                    </div>
                                </div>
                                <h3 className="text-[#888] text-xs uppercase mb-4">Processing Modules (Agent Recommendation)</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {MODULE_OPTIONS.map(mod => (
                                        <div
                                            key={mod.id}
                                            onClick={() => setActiveModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}
                                            className={`border rounded p-3 cursor-pointer transition-all select-none ${activeModules[mod.id]
                                                ? 'border-green-500/30 bg-green-500/5'
                                                : 'border-[#333] bg-[#1a1a1a] opacity-60 hover:opacity-100'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-sm font-medium ${activeModules[mod.id] ? 'text-green-400' : 'text-[#888]'}`}>
                                                    {mod.name}
                                                </span>
                                                <div className={`w-2 h-2 rounded-full ${activeModules[mod.id] ? 'bg-green-500' : 'bg-[#333]'}`} />
                                            </div>
                                            <div className="text-xs text-[#555]">{mod.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-[#888] text-xs uppercase">Timbre Upgrade Toolkit</div>
                                <div className="border border-[#333] rounded bg-[#0f0f0f] p-2">
                                    <TimbreUpgradePanel
                                        activePatch={getSourcePatch() || undefined}
                                        updateActive={updateActivePatch}
                                        updateVoice={updateVoice}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="h-16 border-t border-[#333] bg-[#222] flex items-center justify-end px-6 gap-4">
                    <div className="text-xs text-[#666] mr-auto">
                        {createVariants
                            ? 'Assistant will create three route variants from your current selection.'
                            : 'Assistant will create a new patch based on your current selection.'}
                    </div>
                    <button onClick={onClose} className="px-4 py-2 text-sm text-[#888] hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={applyUpgrade}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                    >
                        Execute Upgrade
                    </button>
                </div>
            </div>
        </div>
    );
};
