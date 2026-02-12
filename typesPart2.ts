import type {
    AppSettings, NodeData, SavedChord, SavedKeyboard, Comma, SavedMidiScale,
    ProgressionStep, PanelId, PanelState, MathLabState, WaveformShape, SynthPatch,
    PrimeLimit, EdgeData, SimpleModeStage, MathObject, MathViewSettings, MathSamplingSettings,
    MathNoteSet, MathNoteSet as MathNoteSetType, MathDot, ConsequentialScaleConfig, ConsequentialScaleResult,
    SavedChordGroupCollection, LandingMode, ComparisonGroup, NodeMaterial
} from './typesPart1';

export interface SavedSession {
    version: number;
    date: string;
    settings: AppSettings;
    customKeyboard: NodeData[];
    keyBindings: Record<string, string>;
    customNodeTextures: Record<string, string>;
    customNodeRotations: Record<string, number>;
    nodeSurfaceLabelOverrides?: Record<string, NodeSurfaceLabelOverride>;
    savedChords: SavedChord[];
    savedKeyboards: SavedKeyboard[];
    savedCommas: Comma[];
    savedMidiScales: SavedMidiScale[];
    savedChordGroupCollections?: SavedChordGroupCollection[];
    progressionSteps?: ProgressionStep[];
    panels?: Record<PanelId, PanelState>;
    mathLabState?: MathLabState;

    earTrainingPersisted?: EarTrainingPersistedV1;
    commaJNDProfiles?: any[];
    commaJNDActiveProfile?: string | null;
}

export interface NodeSurfaceLabelOverride {
    showRatio?: boolean;
    showTexture?: boolean;
    fontScale?: number;
}

export interface NodeNameOverride {
    lattice?: string;
    panel?: string;
    showOriginal?: boolean;
}

export interface NodeSearchIndex {
    version: number;
    nodes: NodeData[];
    searchText: string[];
    tokenIndex: Map<string, number[]>;
    exactIndex: Map<string, number[]>;
    centsSorted: Array<{ cents: number; index: number }>;
}

export type PureScoreRatioDisplayMode = 'fraction' | 'decimal' | 'both';
export type PureScoreJoinLineStyle = 'solid' | 'dashed' | 'dotted' | 'glow';

export interface PureScoreOverlayState {
    hidden: boolean;
    collapsed: boolean;
    displayMode: PureScoreRatioDisplayMode;
    showBars: boolean;
    showOctaveFolding: boolean;
    showCents: boolean;
    showHz: boolean;
    showPrimes: boolean;
    soloVoiceId: string | null;
    pxPerSecond: number;
    preSeconds: number;
    postSeconds: number;
    showJoinLine: boolean;
    joinLineStyle: PureScoreJoinLineStyle;
}

export type TutorialTemperingConstraintStatus =
  | 'declared_not_applied'
  | 'strategy_selected'
  | 'model_ready'
  | 'tempering_applied';

export interface TutorialTemperingConstraint {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  pathA: string;
  pathB: string;
  commaCents: number;
  status: TutorialTemperingConstraintStatus;
}

export type TutorialTemperingStrategyType = 'strict' | 'best_fit' | 'hybrid';

export interface TutorialTemperingStrategy {
  type: TutorialTemperingStrategyType;
  options: {
    favorConsonance?: boolean;
    favorUniformDistribution?: boolean;
  };
}

export interface TutorialTemperingModel {
  constraints: string[];
  strategy: TutorialTemperingStrategy;
  parameters: {
    octaveFixed: true;
    allowGeneratorAdjustment?: boolean;
  };
}

export interface TutorialTemperingResult {
  final_mapping: Record<string, number>;
  residuals: Record<string, number>;
  summary: {
    conflictsResolved: number;
    maxDeviationCents: number;
  };
}

export type WorkspaceViewType = 'hunt' | 'ji-scroller' | 'lattice' | 'empty';
export type WorkspaceSplitDirection = 'row' | 'col';
export type WorkspaceSyncMode = 'hard' | 'soft' | 'focus';
export type WorkspaceSyncScope = 'scoreOnly' | 'score+zoom' | 'score+filters';
export type WorkspaceQualityMode = 'high' | 'balanced' | 'performance';
export type WorkspaceTemplateId = 'single' | 'split-vertical' | 'split-horizontal' | 'grid-2x2' | 'triple-columns';

export interface WorkspaceTransport {
    mode: 'stopped' | 'playing' | 'scrubbing';
    position: { measureIndex: number; tick: number; timeSec?: number };
}

export interface WorkspaceSelection {
    selectedNotes: string[];
    selectedEvent?: { measureIndex: number; tick: number; voice?: number; staff?: number } | null;
    hoverNote?: string | null;
}

export interface WorkspaceSyncState {
    syncEnabled: boolean;
    mode: WorkspaceSyncMode;
    scope: WorkspaceSyncScope;
    masterPaneId?: string | null;
}

export interface WorkspaceFilters {
    voiceIds?: string[];
    pitchClasses?: string[];
    tuningClusters?: string[];
}

export interface WorkspaceQualityState {
    mode: WorkspaceQualityMode;
}

export interface WorkspacePaneNode {
    type: 'pane';
    paneId: string;
    viewType: WorkspaceViewType;
    viewState?: Record<string, any>;
    minWidth?: number;
    minHeight?: number;
}

export interface WorkspaceSplitNode {
    type: 'split';
    direction: WorkspaceSplitDirection;
    ratio: number;
    a: WorkspaceLayoutNode;
    b: WorkspaceLayoutNode;
}

export type WorkspaceLayoutNode = WorkspacePaneNode | WorkspaceSplitNode;

export interface WorkspaceEventLog {
    id: string;
    ts: number;
    type: 'navigate' | 'select' | 'hover' | 'brush' | 'sync';
    sourcePaneId?: string;
    payload?: Record<string, any>;
}

export interface WorkspacePreset {
    id: string;
    name: string;
    version: number;
    createdAt: number;
    layout: WorkspaceLayoutNode;
    transport: WorkspaceTransport;
    sync: WorkspaceSyncState;
    filters: WorkspaceFilters;
    quality: WorkspaceQualityState;
}

export interface WorkspaceState {
    schemaVersion: number;
    layout: WorkspaceLayoutNode;
    transport: WorkspaceTransport;
    selection: WorkspaceSelection;
    sync: WorkspaceSyncState;
    filters: WorkspaceFilters;
    quality: WorkspaceQualityState;
    presets: WorkspacePreset[];
    nextPaneId: number;
    debug: {
        enabled: boolean;
        events: WorkspaceEventLog[];
    };
}

export type AuthStatus = 'signed_out' | 'signing_in' | 'signed_in';

export interface AuthUser {
    id: string;
    email: string;
    displayName?: string | null;
}

export interface AuthState {
    status: AuthStatus;
    user: AuthUser | null;
    accessToken: string | null;
    accessExpiresAt: number | null;
    lastEmail: string;
}

export interface AuthUiState {
    modalOpen: boolean;
    sidebarOpen: boolean;
}

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
    id?: string;
    label: string;
    onClick?: () => void;
}

export interface AppNotification {
    id: string;
    level: NotificationLevel;
    title?: string;
    message: string;
    autoCloseMs?: number;
    actions?: NotificationAction[];
}

export type NotificationDialogType = 'confirm' | 'prompt';

export interface NotificationDialog {
    id: string;
    type: NotificationDialogType;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    defaultValue?: string;
    onConfirm?: (value?: string) => void;
    onCancel?: () => void;
}

export type EarTaskType = 'interval' | 'compare' | 'chord' | 'drift' | 'melody' | 'duo_melody' | 'progression';
export type EarDifficulty = 'easy' | 'medium' | 'hard' | 'auto';
export type EarAnswerMode = 'auto' | 'choice' | 'text';
export type EarSelectionMode = 'random' | 'cycle';

export interface EarContentPool {
    enabled: boolean;
    items: string[];
}

export interface EarTrainingContentPools {
    interval?: EarContentPool;
    chord?: EarContentPool;
    compare?: EarContentPool;
    drift?: EarContentPool;
    melody?: EarContentPool;
    duo_melody?: EarContentPool;
    progression?: EarContentPool;
}

export interface EarQuestionSignature {
    v: number;
    taskType: EarTaskType;
    baseFreq: number;
    answerMode?: 'choice' | 'text';
    referenceTone?: {
        mode: 'none' | 'fixed' | 'random';
        ratioStr?: string;
        label?: string;
    };
    interval?: {
        poolId: string;
        ratioStr?: string;
        label?: string;
        direction: 'up' | 'down';
        mode: 'sequence' | 'chord';
        compoundOctaves: number;
        distractorPoolIds: string[];
        optionsOrder: string[];
    };
    chord?: {
        qualityId: string;
        ratios?: string[];
        label?: string;
        inversion: 'root' | '1st' | '2nd' | '3rd';
        voicing: 'close' | 'open' | 'drop2';
        octaveShifts: number[];
        optionsOrder: string[];
        answerFormat?: 'quality' | 'ratios';
    };
    drift?: {
        targetRatio: string;
        severity: 'subtle' | 'medium' | 'extreme';
        variant: 'purity' | 'vector';
        morphA: number;
        morphB: number;
        correctAnswer: 'A' | 'B';
    };
    compare?: {
        aRatio: string;
        bRatio: string;
        correctAnswer: 'A' | 'B';
    };
    melody?: {
        poolId: string;
        sequence: string[];
        rhythm?: number[];
        optionsOrder: string[];
    };
    duoMelody?: {
        poolId: string;
        upper: string[];
        lower: string[];
        upperRhythm?: number[];
        lowerRhythm?: number[];
        rhythm?: number[];
        optionsOrder: string[];
    };
    progression?: {
        poolId: string;
        chords: string[][];
        rhythm?: number[];
        optionsOrder: string[];
    };
}

export interface EarQuestion {
    id: string;
    type: EarTaskType;
    signature: EarQuestionSignature;
    promptText: string;
    options: { id: string; label: string; isCorrect: boolean }[];
    answerMode?: 'choice' | 'text';
    expectedAnswer?: string;
    referenceTone?: {
        node: NodeData;
        ratioStr: string;
        label?: string;
        mode: 'fixed' | 'random';
    };
    soundData: {
        nodes: NodeData[];
        mode: 'sequence' | 'chord' | 'ab_test' | 'duo' | 'progression';
        layers?: NodeData[][];
        chords?: NodeData[][];
        durations?: number[];
        layerDurations?: number[][];
        chordDurations?: number[];
        morphA?: number;
        morphB?: number;
        baseFreq: number;
    };
    explanation: string;
    difficulty: EarDifficulty;
}

export interface EarAttemptRecord {
    id: string;
    ts: number;
    mode: 'normal' | 'review';
    taskType: EarTaskType;
    difficulty: EarDifficulty;
    signature: EarQuestionSignature;
    chosenId: string;
    correctId: string;
    chosenLabel: string;
    correctLabel: string;
    isCorrect: boolean;
    timeMs: number;
    replays: number;
}

export interface EarReviewItem {
    key: string;
    signature: EarQuestionSignature;
    stage: number;
    dueAt: number;
    lapses: number;
    seen: number;
    lastResult?: 'wrong' | 'hard' | 'ok' | 'easy';
}

export interface EarSessionSummary {
    id: string;
    tsStart: number;
    tsEnd: number;
    mode: 'normal' | 'review';
    total: number;
    correct: number;
    accuracy: number;
    avgTimeMs: number;
    avgReplays: number;
}

export interface EarTrainingPersistedV1 {
    v: 1;
    updatedAt: number;
    settings: EarTrainingSettings;
    attempts: EarAttemptRecord[];
    reviewItems: EarReviewItem[];
    sessions: EarSessionSummary[];
    part2?: EarTrainingPart2PersistedV1;
}

export interface EarTrainingSettings {
    difficulty: EarDifficulty;
    tasks: EarTaskType[];
    sessionLength: number;
    taskWeights: { [key in EarTaskType]: number };
    playback: {
        intervalMode: 'sequence' | 'chord' | 'mixed';
        noteMs: number;
        gapMs: number;
        chordMs: number;
    };
    pitch: {
        baseFreqMode: 'fixed' | 'random';
        fixedBaseFreq: number;
        randomMin: number;
        randomMax: number;
    };
    timbre: {
        clickInstrument: WaveformShape;
        chordInstrument: WaveformShape;
        instrumentDuoUpper?: WaveformShape;
        instrumentDuoLower?: WaveformShape;
    };

    pro?: {

        seedMode?: 'random' | 'locked';
        lockedSeed?: string;
        optionCount?: number;
        answerMode?: EarAnswerMode;
        selectionMode?: EarSelectionMode;
        avoidRepeatCount?: number;
        poolLimit?: number;
        intervalLimit?: number;
        shuffleOptions?: boolean;
        allowReplay?: boolean;
        maxReplays?: number;
        memoryDelayMs?: number;
        sequence?: {
            melodyLength?: number;
            progressionLength?: number;
            rhythmMode?: 'fixed' | 'random';
            rhythmValues?: string[];
            melodyLimit?: number;
            duoLimit?: number;
            duoAllowRest?: boolean;
            useScale?: boolean;
            activeScaleId?: string;
            scalePool?: { id: string; name: string; ratios: string[] }[];
            melodyScale?: { useScale?: boolean; activeScaleId?: string; scalePool?: { id: string; name: string; ratios: string[] }[] };
            duoScale?: { useScale?: boolean; activeScaleId?: string; scalePool?: { id: string; name: string; ratios: string[] }[] };
            intervalScale?: { useScale?: boolean; activeScaleId?: string; scalePool?: { id: string; name: string; ratios: string[] }[] };
            rhythmComplexity?: 'simple' | 'triplets' | 'complex' | 'custom';
            metronomeEnabled?: boolean;
        };
        referenceTone?: {
            mode?: 'none' | 'fixed' | 'random';
            ratios?: string[];
        };
        registerDrift?: { enabled?: boolean; maxCents?: number; perQuestionCents?: number };
        tuning?: { mode?: 'JI' | 'EDO'; edoDivisions?: number; temperamentMorph?: number };
        content?: EarTrainingContentPools;
        timbre?: {
            randomizePerQuestion?: boolean;
            pool?: WaveformShape[];
        };
        audio?: {

            masterGain?: number;
            limiter?: { enabled?: boolean; thresholdDb?: number; releaseMs?: number };

            customSynth?: {
                polyphony?: number;
                clickPatch?: SynthPatch;
                chordPatch?: SynthPatch;
            };
        };
        adaptive?: {
            enabled?: boolean;
            targetAccuracy?: number;
            stepUp?: number;
            stepDown?: number;
        };
        chord?: {
            answerFormat?: 'quality' | 'ratios';
            inversionMode?: 'root' | 'free';
        };
    };
}

export interface AppState {
    appMode: 'lattice' | 'museum';
    landingMode: LandingMode;
    isSetupComplete: boolean;
    hasConfiguredAdvanced: boolean;
    isPureUIMode: boolean;
    isSettingsOpen: boolean;
    namingSetupOpen: boolean;
    settings: AppSettings;
    settingsHistory: AppSettings[];
    settingsFuture: AppSettings[];
    savedAdvancedSettings?: AppSettings;
    savedSimpleSettings?: AppSettings;
    activeMaxPrimeLimit: PrimeLimit;
    nodes: NodeData[];
    nodeSearchIndex: NodeSearchIndex | null;
    edges: EdgeData[];
    latticeTopologyKey: string;
    latticeDisplayKey: string;
    selectedNode: NodeData | null;
    referenceNode: NodeData | null;
    nearbyNodes: NodeData[];
    nearestGen0Nodes: NodeData[];
    nearestGen1Node: NodeData | null;
    highlightedPath: string[];
    affiliatedLineNodeIds: string[];
    affiliatedLineLimit: PrimeLimit | null;
    isGenerating: boolean;
    error: string | null;
    storageRecovery: StorageRecovery | null;
    isStorageReadOnly: boolean;
    customKeyboard: NodeData[];
    keyBindings: Record<string, string>;
    customNodeTextures: Record<string, string>;
    customNodeRotations: Record<string, number>;
    nodeSurfaceLabelOverrides: Record<string, NodeSurfaceLabelOverride>;
    nodeNameOverrides: Record<string, NodeNameOverride>;
    comparisonNodes: NodeData[];
    comparisonGroups: ComparisonGroup[];
    savedChords: SavedChord[];
    isComparisonVisible: boolean;
    savedKeyboards: SavedKeyboard[];
    savedCommas: Comma[];
    savedMidiScales: SavedMidiScale[];
    savedChordGroupCollections: SavedChordGroupCollection[];
    selectionHistory: string[];
    historyIndex: number;
    isKeyboardVisible: boolean;
    isNodeInfoVisible: boolean;
    disableWasdInKeyboard: boolean;
    keyboardLayout: 'custom' | 'standard';
    keyboardHoldNotes: boolean;
    isEducationMode: boolean;
    educationLabelMode: 'ratio' | 'name';
    navAxisHorizontal: PrimeLimit;
    navAxisVertical: PrimeLimit;
    navAxisDepth: PrimeLimit;
    activeNavigationLimit: PrimeLimit;
    isGravityEnabled: boolean;
    isIsolationMode: boolean;
    isRecording: boolean;
    customSampleNames: string[];
    playingNodeIds: Map<string, { channels: number[], velocity: number, tracks?: number[]; parts?: number[] }>;
    playingRatios: Map<string, {
        ratio: string;
        velocity: number;
        channel?: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTime?: number;
        endTime?: number;
    }>;
    retuneSnapDelayMs: number;
    showRetuneRatios: boolean;
    commaLines: { sourceId: string; targetId: string; name: string }[];

    pending_tempering_constraints: TutorialTemperingConstraint[];
    tempering_strategy: TutorialTemperingStrategy | null;
    tempering_model: TutorialTemperingModel | null;
    tempering_result: TutorialTemperingResult | null;

    // Ratio Statistics
    ratioStats: Map<string, number>;
    chordStats: Map<string, number>;
    lastChordRatio: string | null;
    showRatioStats: boolean;
    modifierKeys: { z: boolean; a: boolean; x: boolean; tab: boolean };
    focusSignal: number;
    cameraResetSignal: number;
    simpleModeStage: SimpleModeStage;

    isProgressionVisible: boolean;
    progressionSteps: ProgressionStep[];
    progressionBpm: number;
    progressionIsPlaying: boolean;
    progressionCurrentStep: number;

    panels: Record<PanelId, PanelState>;
    topZIndex: number;
    notifications: AppNotification[];
    activeDialog: NotificationDialog | null;

    latticeSlotCurrent: SavedSession | null;
    latticeSlotNew: SavedSession | null;
    latticeSlotNewName: string | null;

    mathLab: MathLabState;
    midiRetuner: MidiRetunerState;
    pureScoreOverlay: PureScoreOverlayState;
    auth: AuthState;
    authUi: AuthUiState;
    workspace: WorkspaceState;

    earTraining: {
        isActive: boolean;
        mode: 'normal' | 'review';
        sessionStats: {
            totalQuestions: number;
            correctCount: number;
            currentStreak: number;
            bestStreak: number;
            history: EarAttemptRecord[];
        };
        currentQuestion: EarQuestion | null;
        currentQuestionStartedAt: number;
        currentReplays: number;
        phase: 'idle' | 'prompt' | 'listen' | 'answer' | 'feedback' | 'summary';
        selectedAnswerId: string | null;
        settings: EarTrainingSettings;
        returnTo: LandingMode | null;
        persisted: EarTrainingPersistedV1;
        reviewQueue: string[];
        ui: { panel: 'train' | 'stats' | 'mistakes' | 'part2' };
    };

    setAppMode: (mode: 'lattice' | 'museum') => void;
    setLandingMode: (mode: LandingMode) => void;
    completeSetup: (roots: PrimeLimit[], max: PrimeLimit, a: number, b: number, c: number, d: number, e: number, vis: 'performance' | 'quality') => void;
    clearAdvancedSession: () => void;
    updateSettings: (newSettings: Partial<AppSettings>) => void;
    commitDraftSettings: (newSettings: AppSettings) => void;
    updateVisualSettings: (newVisuals: Partial<AppSettings['visuals']>) => void;
    undoSettings: () => void;
    redoSettings: () => void;
    toggleAxisLoop: (limit: PrimeLimit) => void;
    toggleCommaSpreadingForAxis: (limit: PrimeLimit) => void;
    regenerateLattice: (applyDefaults?: boolean, recordHistory?: boolean) => void;
    setCenter: (node: NodeData) => void;
    addSecondaryOrigin: (node: NodeData) => void;
    removeSecondaryOrigin: (nodeId: string) => void;
    resetHarmonicCenter: () => void;
    selectNode: (node: NodeData | null, preserveReference?: boolean, addToHistory?: boolean, playAudio?: boolean) => void;
    triggerLocate: () => void;
    triggerCameraReset: () => void;
    undoSelection: () => void;
    redoSelection: () => void;
    selectNearbyNode: (node: NodeData) => void;
    addToKeyboard: (node: NodeData) => void;
    removeFromKeyboard: (nodeId: string) => void;
    shiftKeyboardOctave: (nodeId: string, direction: number) => void;
    bindKey: (nodeId: string, key: string) => void;
    onShortcutKey: (key: string) => void;
    unbindKey: (nodeId: string) => void;
    setCustomKeyboard: (nodes: NodeData[]) => void;
    toggleKeyboard: (force?: boolean) => void;
    toggleNodeInfo: (visible: boolean) => void;
    toggleGravity: () => void;
    toggleIsolationMode: () => void;
    toggleEducationMode: (f?: boolean) => void;
    setEducationLabelMode: (mode: 'ratio' | 'name') => void;
    addToComparison: (node: NodeData, octaveShift?: number) => void;
    removeFromComparison: (nodeId: string) => void;
    shiftComparisonOctave: (nodeId: string, direction: number) => void;
    clearComparison: () => void;
    clearComparisonNodesOnly: () => void;
    toggleComparisonTray: () => void;

    addComparisonGroup: (name: string, nodes: NodeData[]) => void;
    updateComparisonGroup: (id: string, partial: Partial<ComparisonGroup>) => void;
    deleteComparisonGroup: (id: string) => void;
    toggleComparisonGroupVisibility: (id: string) => void;
    clearComparisonGroups: () => void;

    saveChordGroupCollection: (name: string) => void;
    deleteChordGroupCollection: (id: string) => void;
    loadChordGroupCollection: (collection: SavedChordGroupCollection) => void;
    saveChord: (name: string, nodes: NodeData[], description?: string) => void;
    deleteChord: (id: string) => void;
    loadChord: (chord: SavedChord) => void;
    saveKeyboard: (name: string, nodes: NodeData[], bindings: Record<string, string>) => void;
    deleteKeyboard: (id: string) => void;
    loadKeyboard: (kb: SavedKeyboard) => void;
    clearKeyboard: () => void;
    duplicateKeyboardWithFactor: (factorNum: bigint, factorDen: bigint) => void;
    saveCustomComma: (comma: Comma) => void;
    renameCustomComma: (id: string, newName: string) => void;
    deleteCustomComma: (name: string) => void;
    deleteCustomCommaById: (id: string) => void;
    saveMidiScale: (name: string, scale: string[]) => void;
    deleteMidiScale: (id: string) => void;
    loadMidiScale: (scale: string[]) => void;
    setNavAxisHorizontal: (limit: PrimeLimit) => void;
    setNavAxisVertical: (limit: PrimeLimit) => void;
    setNavAxisDepth: (limit: PrimeLimit) => void;
    setActiveNavigationLimit: (limit: PrimeLimit) => void;
    navigateSelection: (direction: { dx?: number, dy?: number, dz?: number } | number) => void;
    setNodeTexture: (nodeId: string, url: string | null) => void;
    setNodeTextureRotation: (nodeId: string, rotation: number) => void;
    setNodeSurfaceLabelOverride: (nodeId: string, partial: NodeSurfaceLabelOverride) => void;
    clearNodeSurfaceLabelOverride: (nodeId: string) => void;
    setNodeNameOverride: (nodeId: string, partial: NodeNameOverride) => void;
    clearUserContent: () => void;
    resetLatticeConfig: () => void;
    saveSession: () => void;
    loadSession: (file: File) => Promise<void>;
    loadFileToNewLattice: (file: File) => Promise<void>;
    loadCurrentLattice: () => void;
    loadNewLattice: () => void;
    setRecording: (status: boolean) => void;
    stopAllAudioActivity: () => void;
    setDisableWasdInKeyboard: (disabled: boolean) => void;
    setKeyboardLayout: (layout: 'custom' | 'standard') => void;
    setKeyboardHoldNotes: (enabled: boolean) => void;
    uploadCustomSample: (name: string, file: File) => Promise<void>;
    setPlayingNodeStates: (states: Map<string, { channels: number[], velocity: number, tracks?: number[] }>) => void;
    resetSettings: () => void;
    nuclearReset: () => void;
    setCommaLines: (lines: { sourceId: string; targetId: string; name: string }[]) => void;
    setModifierKeys: (keys: Partial<{ z: boolean; a: boolean; x: boolean }>) => void;
    toggleSimpleMode: () => void;
    setSimpleModeStage: (stage: SimpleModeStage) => void;
    toggleSimpleLabelMode: () => void;
    togglePureUIMode: () => void;
    setPureUIMode: (enabled: boolean) => void;
    toggleSettings: (visible?: boolean) => void;
    setNamingSetupOpen: (open: boolean) => void;
    exitToSetup: (target?: 'landing' | 'advanced') => void;

    toggleProgressionPanel: () => void;
    progressionAddStep: (chordId: string) => void;
    progressionAddRestStep: () => void;
    progressionRemoveStep: (index: number) => void;
    progressionMoveStep: (from: number, to: number) => void;
    progressionDuplicateStep: (index: number) => void;
    progressionUpdateStep: (index: number, partial: Partial<ProgressionStep>) => void;
    progressionSetBpm: (bpm: number) => void;
    progressionTogglePlay: () => void;
    progressionStop: () => void;
    progressionClearSteps: () => void;
    progressionSetCurrentStep: (index: number) => void;

    setPanelState: (id: PanelId, partial: Partial<PanelState>) => void;
    focusPanel: (id: PanelId) => void;
    resetPanelLayout: () => void;

    addMathObject: (obj: MathObject) => void;
    updateMathObject: (id: string, partial: Partial<MathObject>) => void;
    removeMathObject: (id: string) => void;
    setMathObjects: (objects: MathObject[]) => void;
    setMathView: (view: Partial<MathViewSettings>) => void;
    setMathSampling: (sampling: Partial<MathSamplingSettings>) => void;
    setMathEditorState: (partial: Partial<MathLabState['editor']>) => void;
    setMathUnifiedFunctionState: (partial: Partial<NonNullable<MathLabState['unifiedFunctionState']>>) => void;
    setMathLabState: (state: MathLabState) => void;

    addMathNoteSet: (set: MathNoteSet) => void;
    updateMathNoteSet: (id: string, partial: Partial<MathNoteSet>) => void;
    removeMathNoteSet: (id: string) => void;
    setActiveMathNoteSet: (id: string | null) => void;

    addNoteSet: (set: MathNoteSet) => void;
    updateNoteSet: (id: string, partial: Partial<MathNoteSet>) => void;
    deleteNoteSet: (id: string) => void;
    setActiveNoteSet: (id: string | null) => void;

    addMathDot: (noteSetId: string, dot: MathDot) => void;
    updateMathDot: (noteSetId: string, dotId: string, partial: Partial<MathDot>) => void;
    removeMathDot: (noteSetId: string, dotId: string) => void;
    clearMathDots: (noteSetId: string) => void;

    addConsequentialScale: (config: ConsequentialScaleConfig) => void;
    updateConsequentialScale: (id: string, partial: Partial<ConsequentialScaleConfig>) => void;
    removeConsequentialScale: (id: string) => void;
    setActiveConsequentialScale: (id: string | null) => void;
    updateConsequentialCache: (id: string, result: ConsequentialScaleResult) => void;

    startEarSession: () => void;
    openEarTrainerFromAdvanced: () => void;
    stopEarSession: () => void;
    backToEarSettings: () => void;
    submitEarAnswer: (answerId: string) => void;
    nextEarQuestion: () => void;
    updateEarSettings: (settings: Partial<EarTrainingSettings>) => void;
    recordEarReplay: () => void;
    finishEarSession: () => void;
    startReviewSession: (source: 'mistakes' | 'due') => void;
    setEarPanel: (panel: 'train' | 'stats' | 'mistakes' | 'part2') => void;
    startPracticeSignature: (sig: EarQuestionSignature) => void;
    deleteReviewItem: (key: string) => void;

    exportEarTrainingData: () => EarTrainingPersistedV1;
    importEarTrainingData: (data: EarTrainingPersistedV1, mode: 'merge' | 'replace') => void;
    resetEarTrainingData: () => void;

    setEarTrainingPersistedPart2: (part2: EarTrainingPart2PersistedV1) => void;

    setMidiRetunerState: (partial: Partial<MidiRetunerState>) => void;
    setPureScoreOverlay: (partial: Partial<PureScoreOverlayState>) => void;
    setPendingTemperingConstraints: (constraints: TutorialTemperingConstraint[]) => void;
    setTemperingStrategy: (strategy: TutorialTemperingStrategy | null) => void;
    setTemperingModel: (model: TutorialTemperingModel | null) => void;
    setTemperingResult: (result: TutorialTemperingResult | null) => void;
    resetTemperingTutorial: () => void;
    setAuthState: (partial: Partial<AuthState>) => void;
    clearAuthState: () => void;
    setAuthUi: (partial: Partial<AuthUiState>) => void;
    applyWorkspaceTemplate: (template: WorkspaceTemplateId) => void;
    setWorkspaceLayout: (layout: WorkspaceLayoutNode) => void;
    setWorkspacePaneView: (paneId: string, viewType: WorkspaceViewType) => void;
    setWorkspacePaneState: (paneId: string, partial: Record<string, any>) => void;
    splitWorkspacePane: (paneId: string, direction: WorkspaceSplitDirection, placement?: 'before' | 'after') => void;
    closeWorkspacePane: (paneId: string) => void;
    setWorkspaceTransport: (partial: Partial<WorkspaceTransport>) => void;
    setWorkspaceSelection: (partial: Partial<WorkspaceSelection>) => void;
    setWorkspaceSync: (partial: Partial<WorkspaceSyncState>) => void;
    setWorkspaceFilters: (partial: Partial<WorkspaceFilters>) => void;
    setWorkspaceQuality: (mode: WorkspaceQualityMode) => void;
    toggleWorkspaceDebug: () => void;
    saveWorkspacePreset: (name: string) => void;
    loadWorkspacePreset: (presetId: string) => void;
    deleteWorkspacePreset: (presetId: string) => void;

    setPlayingRatios: (ratios: Map<string, {
        ratio: string;
        velocity: number;
        channel?: number;
        trackIndex?: number;
        nodeId?: string;
        noteNumber?: number;
        startTick?: number;
        durationTicks?: number;
        startTime?: number;
        endTime?: number;
    }>) => void;
    setRetuneSnapDelay: (ms: number) => void;
    setShowRetuneRatios: (show: boolean) => void;

    // Ratio Statistics Actions
    incrementRatioStats: (ratio: string) => void;
    resetRatioStats: () => void;
    setShowRatioStats: (show: boolean) => void;

    pushNotification: (notification: Omit<AppNotification, 'id'> & { id?: string }) => void;
    dismissNotification: (id: string) => void;
    openConfirmDialog: (dialog: Omit<NotificationDialog, 'id' | 'type'>) => void;
    openPromptDialog: (dialog: Omit<NotificationDialog, 'id' | 'type'>) => void;
    closeDialog: () => void;
    ackStorageRecovery: () => void;

}

export type StorageRecovery = {
    reason: string;
    payloads: {
        settings?: string | null;
        settingsUi?: string | null;
        flags?: string | null;
    };
};

export declare namespace WebMidi {
    interface MIDIAccess extends EventTarget {
        inputs: Map<string, MIDIInput>;
        outputs: Map<string, MIDIOutput>;
        onstatechange: ((e: any) => void) | null;
    }
    interface MIDIInput extends EventTarget {
        id: string;
        name: string;
        addEventListener(type: string, listener: (e: MIDIMessageEvent) => void): void;
        removeEventListener(type: string, listener: (e: MIDIMessageEvent) => void): void;
    }
    interface MIDIOutput extends EventTarget {
        id: string;
        name: string;
        send(data: number[] | Uint8Array, timestamp?: number): void;
    }
    interface MIDIMessageEvent extends Event {
        data: Uint8Array;
    }
}

export interface EarTrainingPart2IntervalZoneSample {
    deviationCents: number;
    accepted: boolean;
    t: number;

    targetCents?: number;
    baseHz?: number;
    intervalCents?: number;
}

export interface EarTrainingPart2JndSample {
    gapCents: number;
    correct: boolean;
    direction: 'higher' | 'lower';
    mode: 'interval' | 'double';
    optionsCount: number;
    t: number;
    baseHz?: number;
    waveform?: WaveformShape;
    responseMs?: number;
    counted?: boolean;
}

export interface EarTrainingPart2ContinuousPitchSample {
    targetHz: number;
    finalHz: number;
    errorCents: number;
    holdMs: number;
    t: number;
}

export interface EarTrainingPart2EvaluationSnapshot {
    t: number;
    jnd?: { estimateCents?: number; trials?: number; note?: string };
    intervalZone?: { meanAbsDeviationCents?: number; p90AbsDeviationCents?: number; note?: string };
    continuousPitch?: { meanAbsErrorCents?: number; p90AbsErrorCents?: number; note?: string };
}


export interface MidiRetunerState {
    importResult: any | null; // MidiImportResult
    targetMode: 'custom' | 'scale' | 'edo' | 'lattice' | 'dynamic';
    selectedScaleId: string;
    scalaScaleId: string | null;
    scalaSource: 'saved' | 'archive';
    edoDivisions: number;
    baseNote: number;
    restrictToNodes: boolean;
    outputUrl: string | null;
    outputName: string;
    summary: any | null;
    retuneCustomScale: string[];
    retuneSpeed: number;
    retuneSpeedTargets: {
        preview: boolean;
        wav: boolean;
        midi: boolean;
    };
    retuneTrackVisualsEnabled: boolean;
    retunePreviewActive: boolean;
    previewPositionSeconds?: number;
    previewIsPlaying?: boolean;
    previewSeekToSeconds?: ((seconds: number) => void) | null;
    previewStop?: (() => void) | null;
    retuneTrackStyles: RetuneTrackStyle[];
    preExtensionSettings: AppSettings | null;
    temporaryExtensionApplied: boolean;
    autoSwitchToLattice: boolean;
}

export interface RetuneTrackStyle {
    color: string;
    material: NodeMaterial;
    textureUrl: string;
}

export interface EarTrainingPart2PersistedV1 {
    v: 1;
    settings: {
        enabled: boolean;
        shareAnonymizedJnd?: boolean;
        jnd: {
            baseHz: number;
            mode: 'interval' | 'double' | 'random';
            startGapCents: number;
            minGapCents: number;
            maxGapCents: number;
            stepDown: number;
            stepUp: number;
            confirmRepeats: number;
            optionsCount: number;
            waveform?: WaveformShape;
            toneMs?: number;
            gapMs?: number;
            randomBase?: boolean;
            baseHzMin?: number;
            baseHzMax?: number;
            randomGap?: boolean;
        };
        intervalZone?: {
            baseHz: number;
            intervalCents: number;
            rangeCents: number;
            waveform?: WaveformShape;
        };
        continuousPitch: {
            targetHz: number;
            centsRange: number;
            waveform?: WaveformShape;
        };
    };
    jndSamples: EarTrainingPart2JndSample[];
    intervalZoneSamples?: EarTrainingPart2IntervalZoneSample[];
    continuousPitchSamples: EarTrainingPart2ContinuousPitchSample[];
    evaluation: EarTrainingPart2EvaluationSnapshot[];
}
