export type RetunerType = "none" | "midi" | "mpe" | "multichannel" | "mts-esp-master";

export type InputType = "midi" | "mpe";

export type MappingMode = 'scale' | 'lattice' | 'table' | 'adaptive';

export type ChannelFilterMode = 'all' | 'range' | 'list';

export type LoopbackGuardMode = 'off' | 'basic' | 'strict';

export type TuningChangePolicy = 'new-notes-only' | 'immediate' | 'ramp';

export type PreflightNotePolicy = 'queue' | 'drop';

export type MtsEspMode = 'broadcast-only' | 'broadcast+passthrough';

export type MtsEspBroadcastPolicy = 'onchange' | 'interval' | 'manual';

export type RetunerErrorCode =
    | 'NO_OUTPUT_SELECTED'
    | 'OUTPUT_NOT_FOUND'
    | 'PERMISSION_DENIED'
    | 'BRIDGE_DISCONNECTED'
    | 'PLUGIN_NOT_INSTALLED'
    | 'PLUGIN_VERSION_MISMATCH'
    | 'MTS_ESP_NO_CLIENTS'
    | 'CONFIG_TIMEOUT'
    | 'SEND_FAILED'
    | 'UNKNOWN';

export type MonoPolicy = "steal" | "legato";

export type StealPolicy = "oldest" | "quietest";

export interface PitchBendRange {
    semitones: number;
}

export interface BaseTuningSettings {
    a4Hz: number;
    baseNote: number;
    rootNote: number;
}

export interface InputSourceFilter {
    sourceIds: string[];
    channelMode: ChannelFilterMode;
    channelRange?: { min: number; max: number };
    channelList?: number[];
    noteRange?: { min: number; max: number };
}

export interface LoopbackGuardSettings {
    enabled: boolean;
    mode: LoopbackGuardMode;
    windowMs: number;
}

export interface MappingTableEntry {
    midiNote: number;
    ratio?: string;
    hz?: number;
    label?: string;
}

export interface RetunerRoute {
    id: string;
    name?: string;
    enabled: boolean;
    priority: number;
    sourceFilter?: Partial<InputSourceFilter>;
    mappingMode?: MappingMode;
    mappingTable?: MappingTableEntry[];
    destinations: string[];
    modeOverride?: RetunerType;
    pitchBendRangeOverride?: number;
    fanOut?: boolean;
}

export interface InputSettings {
    type: InputType;
    /**
     * Interpreted as +/- N scale steps at full wheel deflection.
     * Used by step-based input retuning flows.
     */
    pitchBendRangeSteps: number;
    mappingMode: MappingMode;
    baseTuning: BaseTuningSettings;
    sourceFilter: InputSourceFilter;
    mappingTable: MappingTableEntry[];
    loopbackGuard: LoopbackGuardSettings;
}

export interface ZoneSettings {
    startChannel: number;
    endChannel: number;
    useGlobalChannel: boolean;
    /**
     * If useGlobalChannel=true, this channel is used for zone-wide messages.
     * Defaults to 1.
     */
    globalChannel?: number;
}

export type MpeZoneType = 'lower' | 'upper' | 'both' | 'none';

export interface MpeZoneConfig {
    type: MpeZoneType;

    lower?: {
        globalChannel: number;
        memberChannels: number[];
        memberCount: number;
    };

    upper?: {
        globalChannel: number;
        memberChannels: number[];
        memberCount: number;
    };
}

export interface MtsEspSettings {
    enabled: boolean;
    mode: MtsEspMode;
    broadcastPolicy: MtsEspBroadcastPolicy;
    broadcastIntervalMs: number;
}

export interface RetunerSettings {
    enabled: boolean;
    mode: RetunerType;

    destinationId: string | null;

    /**
     * @deprecated Legacy field retained for backward compatibility.
     * Migrated into OutputDestination.pitchBendRangeSemitones.
     */
    outputPitchBendRange?: number;

    /** Input remapping settings (for future: MIDI input retune / MPE input). */
    input: InputSettings;

    monoPolicy: MonoPolicy;

    zone: ZoneSettings;
    stealPolicy: StealPolicy;

    resetPbOnNoteOff: boolean;

    mtsEsp?: MtsEspSettings;

    mpeZone?: MpeZoneConfig;

    routes?: RetunerRoute[];

    preflight: {
        notePolicy: PreflightNotePolicy;
        maxQueueSize: number;
        queueTimeoutMs: number;
        configTimeoutMs: number;
    };

    tuningChangePolicy: {
        mode: TuningChangePolicy;
        rampMs: number;
    };

    panicOnDestinationChange: boolean;
    panicOnModeChange: boolean;
    panicOnZoneChange: boolean;
    panicOnPbRangeChange: boolean;

    group: "Off" | "A" | "B" | "C" | "D";
}

export interface DestinationRuntimeState {
    status: 'disconnected' | 'connecting' | 'preflighting' | 'ready' | 'error';
    lastErrorCode?: RetunerErrorCode;
    lastErrorMessage?: string | null;
    lastConnectedAt?: number;
    lastPreflightAt?: number;
    capabilitiesSnapshot?: {
        supportsPb: boolean;
        supportsMpe: boolean;
        supportsMts: boolean;
        maxMessagesPerSecond?: number;
        transport?: string;
    };
    preflightStep?: string;
}

export interface MidiEventLog {
    t: number;
    dir: 'in' | 'out';
    bytes: number[];
    destId?: string;
    sourceId?: string;
    note?: number;
    channel?: number;
    type?: string;
    priority?: 'urgent' | 'config' | 'normal';
    info?: string;
}

export interface PreflightLogEntry {
    t: number;
    destId: string;
    step: string;
    status: 'start' | 'done' | 'error';
    info?: string;
}

export interface RetunerState {
    compatibilityWarning?: string;
    mtsEspClientCount?: number;
    isMtsEspMaster?: boolean;
    mtsEspBroadcastRequestId?: number;
    panicRequestId?: number;
    pluginHostStatus?: 'unsupported' | 'available' | 'connected';
    pluginHostError?: string | null;
    availablePlugins?: {
        id: string;
        name: string;
        path: string;
        format: 'vst3' | 'au';
        manufacturer?: string;
        version?: string;
        category?: string;
    }[];
    hostedPlugins?: {
        id: string;
        name: string;
        format: 'vst3' | 'au';
        manufacturer?: string;
        version?: string;
        editorOpen: boolean;
    }[];

    inputStatus?: {
        enabled: boolean;
        activeSourceIds: string[];
        lastEventAt?: number;
    };
    destinationStatus?: Record<string, DestinationRuntimeState>;
    diagnostics?: {
        inputEvents?: MidiEventLog[];
        outputEvents?: MidiEventLog[];
        preflight?: PreflightLogEntry[];
        loopbackHits?: number;
        droppedEvents?: number;
        lastPanicAt?: number;
    };
}
