import { useState, useMemo, useRef, useEffect } from 'react';
import { Vector3 } from 'three';
import { useStore } from '../../../store';
import { DEFAULT_SETTINGS } from '../../../constants';
import { CHORD_LIBRARY_GROUPS } from '../../../utils/chordLibrary';
import {
    DEFAULT_INTERVALS,
    getIntervalsByLimit,
    getIntervalsByCategory,
    type IntervalEntry
} from '../../../utils/intervalLibrary';
import { scalaArchiveIndex, loadScalaScale, type ScalaArchiveScale, type ScalaArchiveEntry } from '../../../utils/scalaArchive';
import { readScalaArchivePrefs, writeScalaArchivePrefs } from '../../../utils/scalaArchivePrefs';
import type { SavedChord, NodeData } from '../../../types';
import { startNote, startFrequency } from '../../../audioEngine';
import { calculateCents, getPrimeVectorFromRatio, normalizeOctave, parseGeneralRatio } from '../../../musicLogic';
import { AUTO_BIND_KEYS } from '../../../store/logic/constants';
import { notifyError } from '../../../utils/notifications';

export type LibrarySection = 'chords' | 'scales' | 'intervals';

const CHORD_PREVIEW_DURATION = 2.3;

export const useLibraryTabState = () => {
    const settings = useStore(s => s.settings);
    const savedChords = useStore(s => s.savedChords);
    const savedMidiScales = useStore(s => s.savedMidiScales);
    const deleteChord = useStore(s => s.deleteChord);
    const deleteMidiScale = useStore(s => s.deleteMidiScale);
    const saveMidiScale = useStore(s => s.saveMidiScale);
    const updateSettings = useStore(s => s.updateSettings);
    const setCustomKeyboard = useStore(s => s.setCustomKeyboard);
    const bindKey = useStore(s => s.bindKey);
    const nodes = useStore(s => s.nodes);
    const selectNode = useStore(s => s.selectNode);
    const setMidiRetunerState = useStore(s => s.setMidiRetunerState);
    const setPanelState = useStore(s => s.setPanelState);

    const [activeSection, setActiveSection] = useState<LibrarySection>('chords');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['JI Triads']));
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddScale, setShowAddScale] = useState(false);
    const [newScaleName, setNewScaleName] = useState('');
    const [newScaleRatios, setNewScaleRatios] = useState('');
    const [scalePlaybackSpeed, setScalePlaybackSpeed] = useState(200);
    const [scaleWaveform, setScaleWaveform] = useState<'sine' | 'triangle' | 'sawtooth' | 'square'>('sine');

    const archivePrefs = useMemo(() => readScalaArchivePrefs(), []);
    const [showArchiveScales, setShowArchiveScales] = useState(archivePrefs.showArchive);
    const [hiddenArchiveIds, setHiddenArchiveIds] = useState(new Set(archivePrefs.hiddenIds));
    const [archiveScaleCache, setArchiveScaleCache] = useState<Record<string, ScalaArchiveScale>>({});
    const [archiveLimit, setArchiveLimit] = useState(200);
    const [showHiddenArchive, setShowHiddenArchive] = useState(false);
    const [selectedArchiveScale, setSelectedArchiveScale] = useState<ScalaArchiveScale | null>(null);
    const [archiveSortMode, setArchiveSortMode] = useState<'name' | 'count' | 'period'>('name');
    const [savedScaleSortMode, setSavedScaleSortMode] = useState<'name' | 'count'>('name');

    const [intervalFilterMode, setIntervalFilterMode] = useState<'all' | 'limit' | 'category'>('all');
    const [selectedLimit, setSelectedLimit] = useState<number>(7);
    const [selectedCategory, setSelectedCategory] = useState<IntervalEntry['category']>('harmonic');
    const [intervalSortMode, setIntervalSortMode] = useState<'cents' | 'name' | 'ratio' | 'limit'>('cents');

    const activeStopsRef = useRef<(() => void)[]>([]);
    const chordStopTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const scaleAudioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        try {
            writeScalaArchivePrefs({
                showArchive: showArchiveScales,
                hiddenIds: Array.from(hiddenArchiveIds)
            });
        } catch { }
    }, [showArchiveScales, hiddenArchiveIds]);

    const stopAll = () => {
        chordStopTimersRef.current.forEach(timer => clearTimeout(timer));
        chordStopTimersRef.current = [];

        activeStopsRef.current.forEach(stop => stop());
        activeStopsRef.current = [];

        if (scaleAudioCtxRef.current) {
            const ctx = scaleAudioCtxRef.current;
            scaleAudioCtxRef.current = null;
            try {
                ctx.close();
            } catch { }
        }
    };

    const scheduleChordStop = (durationSeconds: number = CHORD_PREVIEW_DURATION) => {
        const timer = setTimeout(() => {
            stopAll();
        }, durationSeconds * 1000);
        chordStopTimersRef.current.push(timer);
    };

    useEffect(() => {
        return () => stopAll();
    }, []);

    useEffect(() => {
        stopAll();
    }, [activeSection]);

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const playPresetChord = (ratios: string) => {
        stopAll();

        const parts = ratios.split(':').map(s => parseInt(s.trim(), 10));
        if (parts.some(isNaN)) return;
        const baseHz = settings.baseFrequency;

        parts.forEach((p, i) => {
            const freq = baseHz * (p / parts[0]);
            const stopFn = startFrequency(freq, settings, 'chord', (i / parts.length) * 0.3 - 0.15);
            activeStopsRef.current.push(stopFn);
        });
        if (parts.length > 0) {
            scheduleChordStop();
        }
    };

    const playSavedChord = (chord: SavedChord) => {
        stopAll();
        chord.nodes.forEach((node, i) => {
            const stopFn = startNote(node, settings, 'chord', (i / chord.nodes.length) * 0.3 - 0.15);
            activeStopsRef.current.push(stopFn);
        });
        if (chord.nodes.length > 0) {
            scheduleChordStop();
        }
    };

    const playScale = (scale: string[]) => {
        stopAll();
        const baseHz = settings.baseFrequency;
        const ctx = new AudioContext();
        scaleAudioCtxRef.current = ctx;
        const noteDuration = scalePlaybackSpeed / 1000;
        const startTime = ctx.currentTime + 0.05;

        scale.forEach((ratioStr, i) => {
            try {
                const ratio = parseGeneralRatio(ratioStr);
                const freq = baseHz * (Number(ratio.n) / Number(ratio.d));
                const noteStart = startTime + i * noteDuration;

                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.frequency.value = freq;
                osc.type = scaleWaveform;

                const attackTime = 0.01;
                const sustainLevel = 0.18;
                const releaseStart = noteStart + noteDuration * 0.85;
                const releaseEnd = noteStart + noteDuration;

                gain.gain.setValueAtTime(0, noteStart);
                gain.gain.linearRampToValueAtTime(sustainLevel, noteStart + attackTime);
                gain.gain.setValueAtTime(sustainLevel, releaseStart);
                gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

                osc.connect(gain).connect(ctx.destination);
                osc.start(noteStart);
                osc.stop(releaseEnd + 0.05);
            } catch (e) { }
        });
    };

    const handleAddScale = () => {
        if (!newScaleName.trim() || !newScaleRatios.trim()) return;
        const ratioList = newScaleRatios.split(/[,\s]+/).filter(s => s.trim());
        if (ratioList.length === 0) return;
        saveMidiScale(newScaleName.trim(), ratioList);
        setNewScaleName('');
        setNewScaleRatios('');
        setShowAddScale(false);
    };

    const loadArchiveScale = async (entry: ScalaArchiveEntry) => {
        const cached = archiveScaleCache[entry.id];
        if (cached) return cached;
        const loaded = await loadScalaScale(entry);
        if (!loaded) return null;
        setArchiveScaleCache(prev => ({ ...prev, [loaded.id]: loaded }));
        return loaded;
    };

    const handlePlayArchiveScale = async (entry: ScalaArchiveEntry) => {
        const scale = await loadArchiveScale(entry);
        if (scale) playScale(scale.ratios);
    };

    const handleSaveArchiveScale = async (entry: ScalaArchiveEntry) => {
        const scale = await loadArchiveScale(entry);
        if (!scale) return;
        const name = scale.description?.trim() || entry.displayName;
        saveMidiScale(name, scale.ratios);
    };

    const isSameScale = (a: string[], b: string[]) => {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    };

    const handleSendToRetuner = async (scaleId: string, scaleName: string, ratios: string[]) => {
        const scaleRatios = Array.isArray(ratios) ? ratios : [];
        const matching = savedMidiScales.find(s => s.id === scaleId)
            || savedMidiScales.find(s => s.name === scaleName && isSameScale(s.scale, scaleRatios))
            || savedMidiScales.find(s => isSameScale(s.scale, scaleRatios));

        if (!matching && scaleRatios.length > 0) {
            saveMidiScale(scaleName, scaleRatios);
        }

        const baseMidi = settings.midi ?? DEFAULT_SETTINGS.midi;
        updateSettings({
            midi: {
                ...baseMidi,
                mappingScale: scaleRatios,
                mappingDivisions: Math.max(1, scaleRatios.length || baseMidi.mappingDivisions || 12)
            }
        });

        if (matching) {
            setMidiRetunerState({
                targetMode: 'scale',
                scalaSource: 'saved',
                selectedScaleId: matching.id,
                retuneCustomScale: [...scaleRatios]
            });
        } else {
            setMidiRetunerState({
                targetMode: 'custom',
                retuneCustomScale: [...scaleRatios]
            });
        }

        setPanelState('settings', { isOpen: true });
    };

    const handleSendToTuner = (scaleName: string, ratios: string[]) => {
        const scaleRatios = Array.isArray(ratios) ? ratios : [];
        const fallbackTuner = DEFAULT_SETTINGS.tuner;
        const tunerState = settings.tuner ?? fallbackTuner;
        const profiles = Array.isArray(tunerState.profiles) && tunerState.profiles.length > 0
            ? tunerState.profiles
            : fallbackTuner.profiles;

        if (!profiles || profiles.length === 0) return;

        const activeId = tunerState.activeProfileId || profiles[0].id;
        const activeIndex = Math.max(0, profiles.findIndex(p => p.id === activeId));
        const activeProfile = profiles[activeIndex] || profiles[0];

        const nextProfile = {
            ...activeProfile,
            mappingMode: 'ratios' as const,
            ratios: [...scaleRatios],
            divisions: scaleRatios.length
        };

        const nextProfiles = profiles.map((p, idx) => (idx === activeIndex ? nextProfile : p));

        updateSettings({
            tuner: {
                ...tunerState,
                profiles: nextProfiles,
                activeProfileId: nextProfile.id
            }
        });

        setPanelState('settings', { isOpen: true });
    };

    const buildKeyboardNodesFromScale = (ratios: string[]) => {
        const now = Date.now();
        return ratios.map((ratioStr, i) => {
            const frac = parseGeneralRatio(ratioStr);
            if (frac.n <= 0n || frac.d <= 0n) return null;
            const { ratio, octaves } = normalizeOctave(frac);
            if (ratio.n <= 0n || ratio.d <= 0n) return null;
            const ratioFloat = Number(ratio.n) / Number(ratio.d);
            return {
                id: `kb-scale-${now}-${i}`,
                name: ratioStr,
                ratio,
                ratioFloat,
                octave: octaves,
                cents: calculateCents(ratio),
                position: new Vector3(i * 2, 0, 0),
                primeVector: getPrimeVectorFromRatio(ratio.n, ratio.d),
                gen: 0,
                originLimit: 0,
                parentId: null
            };
        }).filter(Boolean) as NodeData[];
    };

    const handleSendToKeyboard = (scaleName: string, ratios: string[]) => {
        const scaleRatios = Array.isArray(ratios) ? ratios : [];
        const nodes = buildKeyboardNodesFromScale(scaleRatios);
        if (nodes.length === 0) {
            notifyError(`Failed to load "${scaleName}" into the keyboard.`, 'Library');
            return;
        }
        setCustomKeyboard(nodes);
        const maxKeys = Math.min(AUTO_BIND_KEYS.length, nodes.length);
        for (let i = 0; i < maxKeys; i += 1) {
            bindKey(nodes[i].id, AUTO_BIND_KEYS[i]);
        }
    };

    const handleHideArchiveScale = (id: string) => {
        setHiddenArchiveIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    };

    const handleRestoreArchiveScale = (id: string) => {
        setHiddenArchiveIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const filteredPresetGroups = useMemo(() => {
        if (!searchQuery.trim()) return CHORD_LIBRARY_GROUPS;
        const q = searchQuery.toLowerCase();
        return CHORD_LIBRARY_GROUPS.map(g => ({
            ...g,
            items: g.items.filter(item => item.label.toLowerCase().includes(q) || item.ratios.includes(q))
        })).filter(g => g.items.length > 0);
    }, [searchQuery]);

    const filteredSavedChords = useMemo(() => {
        if (!searchQuery.trim()) return savedChords;
        const q = searchQuery.toLowerCase();
        return savedChords.filter(c => c.name.toLowerCase().includes(q));
    }, [searchQuery, savedChords]);

    const filteredSavedScales = useMemo(() => {
        let scales = savedMidiScales;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            scales = scales.filter(s => s.name.toLowerCase().includes(q));
        }
        return [...scales].sort((a, b) => {
            if (savedScaleSortMode === 'count') return b.scale.length - a.scale.length;
            return a.name.localeCompare(b.name);
        });
    }, [searchQuery, savedMidiScales, savedScaleSortMode]);

    const filteredArchiveEntries = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let baseList = query
            ? scalaArchiveIndex.filter(entry =>
                entry.displayName.toLowerCase().includes(query) ||
                entry.fileName.toLowerCase().includes(query)
            )
            : [...scalaArchiveIndex];

        baseList = baseList.filter(entry => !hiddenArchiveIds.has(entry.id));

        if (archiveSortMode === 'name') {
            baseList.sort((a, b) => a.displayName.localeCompare(b.displayName));
        }

        return baseList;
    }, [searchQuery, hiddenArchiveIds, archiveSortMode]);

    const archiveDisplayEntries = useMemo(() => {
        if (searchQuery.trim()) return filteredArchiveEntries;
        return filteredArchiveEntries.slice(0, archiveLimit);
    }, [searchQuery, filteredArchiveEntries, archiveLimit]);

    const hiddenArchiveEntries = useMemo(
        () => scalaArchiveIndex.filter(entry => hiddenArchiveIds.has(entry.id)),
        [hiddenArchiveIds]
    );

    const archiveHasMore = !searchQuery.trim() && filteredArchiveEntries.length > archiveLimit;
    const archiveTotalCount = scalaArchiveIndex.length;

    useEffect(() => {
        if (!showArchiveScales) return;
        const toLoad = archiveDisplayEntries.filter(e => !archiveScaleCache[e.id]).slice(0, 20);
        if (toLoad.length === 0) return;
        let cancelled = false;
        (async () => {
            for (const entry of toLoad) {
                if (cancelled) break;
                const scale = await loadScalaScale(entry);
                if (scale && !cancelled) {
                    setArchiveScaleCache(prev => ({ ...prev, [scale.id]: scale }));
                }
            }
        })();
        return () => { cancelled = true; };
    }, [showArchiveScales, archiveDisplayEntries, archiveScaleCache]);

    const filteredIntervals = useMemo(() => {
        let intervals = DEFAULT_INTERVALS;

        if (intervalFilterMode === 'limit') {
            intervals = getIntervalsByLimit(selectedLimit);
        } else if (intervalFilterMode === 'category') {
            intervals = getIntervalsByCategory(selectedCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            intervals = intervals.filter(interval =>
                interval.name.toLowerCase().includes(query) ||
                interval.shortName.toLowerCase().includes(query) ||
                `${interval.ratio.n}/${interval.ratio.d}`.includes(query)
            );
        }

        intervals.sort((a, b) => {
            switch (intervalSortMode) {
                case 'cents':
                    return a.cents - b.cents;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'ratio':
                    return Number(a.ratio.n) / Number(a.ratio.d) - Number(b.ratio.n) / Number(b.ratio.d);
                case 'limit':
                    return a.primeLimit - b.primeLimit;
                default:
                    return 0;
            }
        });

        return intervals;
    }, [intervalFilterMode, selectedLimit, selectedCategory, intervalSortMode, searchQuery]);

    const findNodeForInterval = (interval: IntervalEntry) => {
        return nodes.find(node =>
            node.ratio.n === interval.ratio.n &&
            node.ratio.d === interval.ratio.d
        );
    };

    const navigateToInterval = (interval: IntervalEntry) => {
        const node = findNodeForInterval(interval);
        if (node) {
            selectNode(node);
        }
    };

    const getCategoryColor = (category: IntervalEntry['category']) => {
        switch (category) {
            case 'pure': return 'text-blue-400 bg-blue-900/20 border-blue-800';
            case 'harmonic': return 'text-green-400 bg-green-900/20 border-green-800';
            case 'melodic': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
            case 'comma': return 'text-red-400 bg-red-900/20 border-red-800';
            default: return 'text-gray-400 bg-gray-900/20 border-gray-800';
        }
    };

    const presetChordCount = CHORD_LIBRARY_GROUPS.reduce((a, g) => a + g.items.length, 0);

    return {
        activeSection,
        setActiveSection,
        expandedGroups,
        toggleGroup,
        searchQuery,
        setSearchQuery,
        showAddScale,
        setShowAddScale,
        newScaleName,
        setNewScaleName,
        newScaleRatios,
        setNewScaleRatios,
        scalePlaybackSpeed,
        setScalePlaybackSpeed,
        scaleWaveform,
        setScaleWaveform,
        showArchiveScales,
        setShowArchiveScales,
        hiddenArchiveIds,
        setHiddenArchiveIds,
        archiveScaleCache,
        archiveLimit,
        setArchiveLimit,
        showHiddenArchive,
        setShowHiddenArchive,
        selectedArchiveScale,
        setSelectedArchiveScale,
        archiveSortMode,
        setArchiveSortMode,
        savedScaleSortMode,
        setSavedScaleSortMode,
        intervalFilterMode,
        setIntervalFilterMode,
        selectedLimit,
        setSelectedLimit,
        selectedCategory,
        setSelectedCategory,
        intervalSortMode,
        setIntervalSortMode,
        savedChords,
        savedMidiScales,
        deleteChord,
        deleteMidiScale,
        saveMidiScale,
        playPresetChord,
        playSavedChord,
        playScale,
        handleAddScale,
        handlePlayArchiveScale,
        handleSaveArchiveScale,
        loadArchiveScale,
        handleSendToRetuner,
        handleSendToTuner,
        handleSendToKeyboard,
        handleHideArchiveScale,
        handleRestoreArchiveScale,
        filteredPresetGroups,
        filteredSavedChords,
        filteredSavedScales,
        filteredArchiveEntries,
        archiveDisplayEntries,
        hiddenArchiveEntries,
        archiveHasMore,
        archiveTotalCount,
        filteredIntervals,
        findNodeForInterval,
        navigateToInterval,
        getCategoryColor,
        presetChordCount
    };
};
