import type { AppSettings, NodeData, WebMidi } from '../../types';
import type { OutputDestination } from '../../domain/retuner/destination';
import type {
  RetunerSettings,
  RetunerState,
  RetunerRoute,
  MappingMode,
  DestinationRuntimeState,
  MidiEventLog,
  PreflightLogEntry,
} from '../../domain/retuner/types';
import { RetunerEngine, IRetunerTransport } from './retunerEngine';
import { LoopbackGuard } from './loopbackGuard';
import { mapExternalNote } from './inputMapper';
import {
  WebMidiRetunerTransport,
  NativeHostTransport,
  MtsEspTransport,
  createDefaultQueue,
} from './transports';
import { createLogger } from '../../utils/logger';
import { DEFAULT_RETUNER_SETTINGS } from '../../constants';

const log = createLogger('retuner/service');

type MidiInput = WebMidi.MIDIInput;
type MidiMessageEvent = WebMidi.MIDIMessageEvent;

type QueuedNoteEvent = {
  t: number;
  type: 'on' | 'off';
  inputNote: number;
  inputChannel: number;
  velocity: number;
  targetHz?: number;
  sourceId?: string;
};

const nowMs = () => Date.now();

const midiNoteToHz = (note: number, a4Hz: number): number => a4Hz * Math.pow(2, (note - 69) / 12);

class RecordingTransport implements IRetunerTransport {
  constructor(
    public base: IRetunerTransport,
    private onSend: (bytes: number[], priority?: 'urgent' | 'config' | 'normal') => void
  ) {}

  sendMidi(bytes: number[], priority: 'urgent' | 'config' | 'normal' = 'normal'): void {
    this.onSend(bytes, priority);
    this.base.sendMidi(bytes, priority);
  }

  sendAllNotesOff(): void {
    this.base.sendAllNotesOff();
  }

  sendMidiQueued(bytes: number[], priority: 'normal' | 'bulk' = 'normal'): void {
    this.base.sendMidiQueued?.(bytes, priority);
  }

  connect(): Promise<void> | undefined {
    return this.base.connect?.();
  }

  disconnect(): Promise<void> | undefined {
    return this.base.disconnect?.();
  }

  isConnected(): boolean | undefined {
    return this.base.isConnected?.();
  }

  flushConfig(): Promise<void> | undefined {
    return this.base.flushConfig?.();
  }

  getCapabilities(): { supportsPb: boolean; supportsMpe: boolean; supportsMts: boolean; maxMessagesPerSecond?: number; transport?: string } | undefined {
    return this.base.getCapabilities?.();
  }

  getBaseTransport(): IRetunerTransport {
    return this.base;
  }
}

class DestinationRuntime {
  public status: DestinationRuntimeState['status'] = 'disconnected';
  public lastErrorCode?: DestinationRuntimeState['lastErrorCode'];
  public lastErrorMessage?: string | null;
  public lastConnectedAt?: number;
  public lastPreflightAt?: number;
  public preflightStep?: string;

  private engine: RetunerEngine;
  public transport: IRetunerTransport;
  private noteQueue: QueuedNoteEvent[] = [];
  private preflightPromise: Promise<void> | null = null;
  private lastConfigKey = '';

  constructor(
    private dest: OutputDestination,
    settings: RetunerSettings,
    transport: any,
    private onStatusChange: (partial: DestinationRuntimeState) => void,
    private onOutputEvent: (evt: MidiEventLog) => void,
    private onPreflightLog: (evt: PreflightLogEntry) => void,
    private onDrop: () => void,
    private getPreflightPolicy: () => RetunerSettings['preflight']
  ) {
    this.transport = transport;
    this.engine = new RetunerEngine(transport, settings, dest);
    this.setStatus({ status: 'disconnected' });
  }

  updateSettings(settings: RetunerSettings, dest: OutputDestination): void {
    this.dest = dest;
    this.engine.updateSettings(settings);
    this.engine.updateDestination(dest);
  }

  private setStatus(next: Partial<DestinationRuntimeState>): void {
    this.status = next.status ?? this.status;
    this.lastErrorCode = next.lastErrorCode ?? this.lastErrorCode;
    this.lastErrorMessage = next.lastErrorMessage ?? this.lastErrorMessage;
    this.lastConnectedAt = next.lastConnectedAt ?? this.lastConnectedAt;
    this.lastPreflightAt = next.lastPreflightAt ?? this.lastPreflightAt;
    this.preflightStep = next.preflightStep ?? this.preflightStep;
    this.onStatusChange({
      status: this.status,
      lastErrorCode: this.lastErrorCode,
      lastErrorMessage: this.lastErrorMessage,
      lastConnectedAt: this.lastConnectedAt,
      lastPreflightAt: this.lastPreflightAt,
      preflightStep: this.preflightStep,
      capabilitiesSnapshot: this.transport.getCapabilities?.(),
    });
  }

  private async connect(): Promise<void> {
    if (this.transport.connect) {
      this.setStatus({ status: 'connecting', preflightStep: 'connect' });
      await this.transport.connect();
      this.setStatus({ status: 'connecting', lastConnectedAt: nowMs() });
    }
  }

  async ensureReady(): Promise<void> {
    const signature = this.engine.getOutputConfigSignature();
    const key = `${signature.pbKey}|${signature.mpeKey ?? ''}`;
    if (this.status === 'ready' && this.lastConfigKey === key) return;
    if (this.preflightPromise) return this.preflightPromise;

    this.preflightPromise = (async () => {
      try {
        await this.connect();
        const policy = this.getPreflightPolicy();
        const timeoutMs = Math.max(200, policy.configTimeoutMs || 2000);
        this.setStatus({ status: 'preflighting', preflightStep: 'config' });
        this.onPreflightLog({ t: nowMs(), destId: this.dest.id, step: 'config', status: 'start' });
        const preflightPromise = this.engine.preflightOutput();
        await Promise.race([
          preflightPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('CONFIG_TIMEOUT')), timeoutMs)),
        ]);
        this.onPreflightLog({ t: nowMs(), destId: this.dest.id, step: 'config', status: 'done' });
        this.lastConfigKey = key;
        this.setStatus({ status: 'ready', lastPreflightAt: nowMs(), preflightStep: 'ready' });
        this.flushQueued();
      } catch (e: any) {
        const msg = String(e?.message || e);
        const code = msg.includes('OUTPUT_NOT_FOUND') ? 'OUTPUT_NOT_FOUND'
          : msg.includes('PERMISSION_DENIED') ? 'PERMISSION_DENIED'
          : msg.includes('BRIDGE_DISCONNECTED') ? 'BRIDGE_DISCONNECTED'
          : msg.includes('CONFIG_TIMEOUT') ? 'CONFIG_TIMEOUT'
          : 'UNKNOWN';
        this.onPreflightLog({ t: nowMs(), destId: this.dest.id, step: 'config', status: 'error', info: msg });
        this.setStatus({ status: 'error', lastErrorCode: code as any, lastErrorMessage: msg, preflightStep: 'error' });
      } finally {
        this.preflightPromise = null;
      }
    })();

    return this.preflightPromise;
  }

  private flushQueued(): void {
    if (this.noteQueue.length === 0) return;
    const queue = [...this.noteQueue];
    this.noteQueue = [];
    queue.forEach((evt) => {
      if (evt.type === 'on' && evt.targetHz) {
        this.engine.handleNoteOn(evt.inputNote, evt.velocity, evt.targetHz, evt.inputChannel);
      } else if (evt.type === 'off') {
        this.engine.handleNoteOff(evt.inputNote, evt.velocity, evt.inputChannel);
      }
    });
  }

  handleNoteEvent(evt: QueuedNoteEvent): void {
    if (this.status === 'ready') {
      if (evt.type === 'on' && evt.targetHz) {
        this.engine.handleNoteOn(evt.inputNote, evt.velocity, evt.targetHz, evt.inputChannel);
      } else if (evt.type === 'off') {
        this.engine.handleNoteOff(evt.inputNote, evt.velocity, evt.inputChannel);
      }
      return;
    }

    const policy = this.getPreflightPolicy();
    if (policy.notePolicy === 'queue') {
      const cutoff = nowMs() - Math.max(0, policy.queueTimeoutMs || 0);
      if (policy.queueTimeoutMs && this.noteQueue.length > 0) {
        this.noteQueue = this.noteQueue.filter((evt) => evt.t >= cutoff);
      }
      if (this.noteQueue.length >= policy.maxQueueSize) {
        this.noteQueue.shift();
        this.onDrop();
      }
      this.noteQueue.push(evt);
      void this.ensureReady();
      return;
    }

    this.onDrop();
    void this.ensureReady();
  }

  applyTuningPolicy(
    getTargetHz: (inputNote: number, inputChannel: number) => number | null,
    policy: { mode: 'new-notes-only' | 'immediate' | 'ramp'; rampMs: number }
  ): void {
    this.engine.retuneActiveVoices(getTargetHz, policy);
  }

  panic(): void {
    this.engine.panic();
  }

  allNotesOff(): void {
    this.engine.allNotesOff();
  }
}

export class ExternalRetunerService {
  private settings: AppSettings | null = null;
  private nodes: NodeData[] = [];
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private inputHandlers: Map<string, (e: MidiMessageEvent) => void> = new Map();
  private activeInputs: Map<string, MidiInput> = new Map();
  private destinations: Map<string, DestinationRuntime> = new Map();
  private loopbackGuard: LoopbackGuard;
  private adaptiveCaches: Map<string, Map<string, any>> = new Map();
  private broadcastIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private lastManualBroadcastId: number | null = null;
  private lastPanicRequestId: number | null = null;
  private lastRetunerStateHash: string | null = null;
  private lastDestId: string | null = null;
  private lastMode: string | null = null;
  private lastZoneSig: string = '';
  private lastPbSig: string = '';

  private diagnostics: {
    inputEvents: MidiEventLog[];
    outputEvents: MidiEventLog[];
    preflight: PreflightLogEntry[];
    loopbackHits: number;
    droppedEvents: number;
    lastPanicAt?: number;
  } = {
    inputEvents: [],
    outputEvents: [],
    preflight: [],
    loopbackHits: 0,
    droppedEvents: 0,
  };

  private diagnosticsDirty = false;
  private diagnosticsTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private updateSettings: (partial: Partial<AppSettings>) => void) {
    this.loopbackGuard = new LoopbackGuard({
      enabled: true,
      mode: 'basic',
      windowMs: 120,
    });
  }

  async start(): Promise<void> {
    if (this.midiAccess || typeof navigator === 'undefined') {
      if (this.settings?.retuner) {
        this.updateInputBindings(this.settings.retuner as RetunerSettings);
      }
      return;
    }
    if (!(navigator as any).requestMIDIAccess) return;
    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: true });
      if (this.settings?.retuner) {
        this.updateInputBindings(this.settings.retuner as RetunerSettings);
      }
    } catch (e) {
      log.warn('MIDI access denied', e);
      this.midiAccess = null;
    }
  }

  stop(): void {
    this.unbindInputs();
    this.destinations.forEach((dest) => {
      dest.panic();
      dest.allNotesOff();
    });
    this.broadcastIntervals.forEach((timer) => clearInterval(timer));
    this.broadcastIntervals.clear();
  }

  dispose(): void {
    this.stop();
    this.destinations.clear();
  }

  updateContext(settings: AppSettings, nodes: NodeData[]): void {
    this.settings = settings;
    this.nodes = nodes;
    const rawRetuner = (settings.retuner || {}) as RetunerSettings;
    const retuner: RetunerSettings = {
      ...DEFAULT_RETUNER_SETTINGS,
      ...rawRetuner,
      input: {
        ...DEFAULT_RETUNER_SETTINGS.input,
        ...(rawRetuner as any).input,
        baseTuning: {
          ...DEFAULT_RETUNER_SETTINGS.input.baseTuning,
          ...((rawRetuner as any).input?.baseTuning || {}),
        },
        sourceFilter: {
          ...DEFAULT_RETUNER_SETTINGS.input.sourceFilter,
          ...((rawRetuner as any).input?.sourceFilter || {}),
        },
        loopbackGuard: {
          ...DEFAULT_RETUNER_SETTINGS.input.loopbackGuard,
          ...((rawRetuner as any).input?.loopbackGuard || {}),
        },
        mappingTable: Array.isArray((rawRetuner as any).input?.mappingTable)
          ? (rawRetuner as any).input.mappingTable
          : DEFAULT_RETUNER_SETTINGS.input.mappingTable,
      },
      zone: { ...DEFAULT_RETUNER_SETTINGS.zone, ...(rawRetuner as any).zone },
      mtsEsp: { ...DEFAULT_RETUNER_SETTINGS.mtsEsp, ...((rawRetuner as any).mtsEsp || {}) },
      preflight: { ...DEFAULT_RETUNER_SETTINGS.preflight, ...((rawRetuner as any).preflight || {}) },
      tuningChangePolicy: { ...DEFAULT_RETUNER_SETTINGS.tuningChangePolicy, ...((rawRetuner as any).tuningChangePolicy || {}) },
    };

    this.loopbackGuard.updateSettings(retuner.input.loopbackGuard);

    this.refreshDestinations(retuner, settings.retunerDestinations || []);
    this.checkPanicTriggers(retuner, settings.retunerDestinations || []);
    this.updateInputBindings(retuner);
    this.handleMtsEspBroadcast(retuner);
    this.updateInputStatus(retuner);
    this.preflightReferencedDestinations(retuner);

    const panicId = (settings.retunerState as any)?.panicRequestId ?? null;
    if (panicId && panicId !== this.lastPanicRequestId) {
        this.lastPanicRequestId = panicId;
        this.triggerPanic();
    }

    if (retuner.tuningChangePolicy?.mode && retuner.tuningChangePolicy.mode !== 'new-notes-only') {
      const policy = retuner.tuningChangePolicy;
      const mapper = (inputNote: number) => this.mapTargetHz({
        id: 'policy',
        enabled: true,
        priority: 0,
        destinations: [],
        mappingMode: retuner.input.mappingMode,
        mappingTable: retuner.input.mappingTable,
        fanOut: false,
      }, inputNote);
      this.destinations.forEach((runtime) => runtime.applyTuningPolicy((note) => mapper(note), {
        mode: policy.mode,
        rampMs: policy.rampMs ?? 50,
      }));
    }
  }

  private preflightReferencedDestinations(retuner: RetunerSettings): void {
    if (!retuner.enabled) return;
    const routeDestinations = (retuner.routes || []).flatMap((r) => r.destinations || []);
    const ids = new Set<string>([
      ...(retuner.destinationId ? [retuner.destinationId] : []),
      ...routeDestinations,
    ]);
    ids.forEach((id) => {
      const runtime = this.destinations.get(id);
      if (runtime) void runtime.ensureReady();
    });
  }

  private checkPanicTriggers(retuner: RetunerSettings, dests: OutputDestination[]): void {
    const zoneSig = JSON.stringify(retuner.zone || {});
    const pbSig = JSON.stringify(dests.map((d) => ({ id: d.id, pb: d.pitchBendRangeSemitones })));
    const destId = retuner.destinationId ?? null;
    const mode = retuner.mode ?? null;

    if (this.lastDestId !== null && destId !== this.lastDestId && retuner.panicOnDestinationChange) {
      this.triggerPanic();
    }
    if (this.lastMode !== null && mode !== this.lastMode && retuner.panicOnModeChange) {
      this.triggerPanic();
    }
    if (this.lastZoneSig && zoneSig !== this.lastZoneSig && retuner.panicOnZoneChange) {
      this.triggerPanic();
    }
    if (this.lastPbSig && pbSig !== this.lastPbSig && retuner.panicOnPbRangeChange) {
      this.triggerPanic();
    }

    this.lastDestId = destId;
    this.lastMode = mode;
    this.lastZoneSig = zoneSig;
    this.lastPbSig = pbSig;
  }

  private triggerPanic(): void {
    this.destinations.forEach((dest) => dest.panic());
    this.diagnostics.lastPanicAt = nowMs();
    this.scheduleDiagnosticsUpdate();
  }

  private updateInputStatus(retuner: RetunerSettings): void {
    const activeSourceIds = retuner.input.sourceFilter.sourceIds || [];
    this.setRetunerState({
      inputStatus: {
        enabled: !!retuner.enabled,
        activeSourceIds,
      }
    });
  }

  private refreshDestinations(retuner: RetunerSettings, dests: OutputDestination[]): void {
    const existing = new Set(this.destinations.keys());
    dests.forEach((dest) => {
      const runtime = this.destinations.get(dest.id);
      if (!runtime) {
        const transport = this.createTransport(dest);
        const wrapped = new RecordingTransport(transport, (bytes, priority) => this.handleOutput(bytes, priority, dest.id));
        if ((transport as any).attachQueue) {
          (transport as any).attachQueue(createDefaultQueue(wrapped));
        }
        const nextRuntime = new DestinationRuntime(
          dest,
          retuner,
          wrapped,
          (partial) => this.updateDestinationStatus(dest.id, partial),
          (evt) => this.pushOutputEvent(evt),
          (evt) => this.pushPreflightEvent(evt),
          () => this.incrementDropped(),
          () => retuner.preflight
        );
        this.destinations.set(dest.id, nextRuntime);
      } else {
        runtime.updateSettings(retuner, dest);
        const baseTransport = (runtime.transport as any).getBaseTransport ? (runtime.transport as any).getBaseTransport() : runtime.transport;
        if (dest.type === 'webmidi' && baseTransport?.updateOutputId) {
          baseTransport.updateOutputId(dest.webmidi?.outputId ?? '');
        }
      }
      existing.delete(dest.id);
    });

    existing.forEach((id) => {
      this.destinations.delete(id);
    });
  }

  private createTransport(dest: OutputDestination): any {
    if (dest.type === 'webmidi') {
      return new WebMidiRetunerTransport(dest.webmidi?.outputId ?? '');
    }
    if (dest.type === 'native-host') {
      return new NativeHostTransport();
    }
    if (dest.type === 'mts-esp') {
      return new MtsEspTransport();
    }
    return new WebMidiRetunerTransport(dest.webmidi?.outputId ?? '');
  }

  private updateInputBindings(retuner: RetunerSettings): void {
    if (!retuner.enabled) {
      this.unbindInputs();
      return;
    }
    if (!this.midiAccess) return;
    const desiredIds = new Set(retuner.input.sourceFilter.sourceIds || []);
    const inputs = Array.from(this.midiAccess.inputs.values()) as MidiInput[];
    const nextInputs = desiredIds.size > 0
      ? inputs.filter((i) => desiredIds.has(i.id))
      : inputs;

    const nextSet = new Set(nextInputs.map((i) => i.id));
    // Remove stale bindings
    for (const [id, input] of this.activeInputs.entries()) {
      if (!nextSet.has(id)) {
        const handler = this.inputHandlers.get(id);
        if (handler) input.removeEventListener('midimessage', handler as any);
        this.inputHandlers.delete(id);
        this.activeInputs.delete(id);
      }
    }
    // Add new bindings
    nextInputs.forEach((input) => {
      if (this.activeInputs.has(input.id)) return;
      const handler = (e: MidiMessageEvent) => this.handleMidiMessage(input.id, e);
      input.addEventListener('midimessage', handler as any);
      this.inputHandlers.set(input.id, handler);
      this.activeInputs.set(input.id, input);
    });
  }

  private unbindInputs(): void {
    for (const [id, input] of this.activeInputs.entries()) {
      const handler = this.inputHandlers.get(id);
      if (handler) input.removeEventListener('midimessage', handler as any);
    }
    this.activeInputs.clear();
    this.inputHandlers.clear();
  }

  private matchesFilter(route: RetunerRoute | null, sourceId: string, channel: number, note: number): boolean {
    const retuner = this.settings?.retuner as RetunerSettings;
    const baseFilter = retuner?.input.sourceFilter;
    const filter = { ...baseFilter, ...(route?.sourceFilter || {}) };
    if (filter.sourceIds && filter.sourceIds.length > 0 && !filter.sourceIds.includes(sourceId)) {
      return false;
    }
    if (filter.channelMode === 'range' && filter.channelRange) {
      if (channel < filter.channelRange.min || channel > filter.channelRange.max) return false;
    }
    if (filter.channelMode === 'list' && filter.channelList && filter.channelList.length > 0) {
      if (!filter.channelList.includes(channel)) return false;
    }
    if (filter.noteRange) {
      if (note < filter.noteRange.min || note > filter.noteRange.max) return false;
    }
    return true;
  }

  private resolveRoutes(sourceId: string, channel: number, note: number): RetunerRoute[] {
    const retuner = this.settings?.retuner as RetunerSettings;
    const routes = Array.isArray(retuner?.routes) && retuner.routes.length > 0
      ? retuner.routes
      : [{
        id: 'default',
        enabled: true,
        priority: 0,
        sourceFilter: retuner?.input.sourceFilter,
        mappingMode: retuner?.input.mappingMode,
        mappingTable: retuner?.input.mappingTable,
        destinations: retuner?.destinationId ? [retuner.destinationId] : [],
        fanOut: false,
      } as RetunerRoute];

    const matched = routes
      .filter((r) => r.enabled !== false)
      .filter((r) => this.matchesFilter(r, sourceId, channel, note))
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

    if (matched.length === 0) return [];
    const anyFanOut = matched.some((r) => r.fanOut);
    if (anyFanOut) return matched;
    return matched.slice(0, 1);
  }

  private mapTargetHz(route: RetunerRoute, inputNote: number): number | null {
    const retuner = this.settings?.retuner as RetunerSettings;
    const scale = this.settings?.midi?.mappingScale || [];
    const mappingMode: MappingMode = route.mappingMode || retuner.input.mappingMode;
    const table = route.mappingTable || retuner.input.mappingTable;
    const cache = this.adaptiveCaches.get(route.id) || new Map<string, any>();
    this.adaptiveCaches.set(route.id, cache);
    const result = mapExternalNote(inputNote, {
      mode: mappingMode,
      baseTuning: retuner.input.baseTuning,
      scale,
      latticeNodes: this.nodes,
      mappingTable: table,
      adaptiveCache: mappingMode === 'adaptive' ? cache : undefined,
    });
    if (!result) return null;
    return result.targetHz;
  }

  private handleMidiMessage(sourceId: string, e: MidiMessageEvent): void {
    if (!this.settings) return;
    const retuner = this.settings.retuner as RetunerSettings;
    if (!retuner?.enabled) return;

    const data = Array.from(e.data || []);
    if (data.length < 2) return;

    const status = data[0];
    const type = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    const note = data[1] ?? 0;
    const velocity = data[2] ?? 0;

    if (type !== 0x90 && type !== 0x80) return;
    const isNoteOn = type === 0x90 && velocity > 0;
    const isNoteOff = type === 0x80 || (type === 0x90 && velocity === 0);

    if (!this.matchesFilter(null, sourceId, channel, note)) return;

    if (this.loopbackGuard.shouldDropInput({ channel, note, type: isNoteOn ? 'on' : 'off', velocity })) {
      this.diagnostics.loopbackHits += 1;
      this.scheduleDiagnosticsUpdate();
      return;
    }

    if (isNoteOn) {
      this.pushInputEvent({
        t: nowMs(),
        dir: 'in',
        bytes: data,
        sourceId,
        note,
        channel,
        type: 'noteon',
      });
      const routes = this.resolveRoutes(sourceId, channel, note);
      routes.forEach((route) => {
        const targetHz = this.mapTargetHz(route, note);
        if (!targetHz || !Number.isFinite(targetHz) || targetHz <= 0) {
          this.incrementDropped();
          return;
        }
        route.destinations.forEach((destId) => {
          const runtime = this.destinations.get(destId);
          if (!runtime) return;
          this.applyRouteOverrides(route, destId);
          runtime.handleNoteEvent({
            t: nowMs(),
            type: 'on',
            inputNote: note,
            inputChannel: channel,
            velocity,
            targetHz,
            sourceId,
          });
        });
      });
    }

    if (isNoteOff) {
      this.pushInputEvent({
        t: nowMs(),
        dir: 'in',
        bytes: data,
        sourceId,
        note,
        channel,
        type: 'noteoff',
      });
      const routes = this.resolveRoutes(sourceId, channel, note);
      routes.forEach((route) => {
        route.destinations.forEach((destId) => {
          const runtime = this.destinations.get(destId);
          if (!runtime) return;
          this.applyRouteOverrides(route, destId);
          runtime.handleNoteEvent({
            t: nowMs(),
            type: 'off',
            inputNote: note,
            inputChannel: channel,
            velocity,
            sourceId,
          });
        });
      });
    }

    this.setRetunerState({
      inputStatus: {
        enabled: true,
        activeSourceIds: retuner.input.sourceFilter.sourceIds || [],
        lastEventAt: nowMs(),
      }
    });
  }

  private handleOutput(bytes: number[], priority: 'urgent' | 'config' | 'normal' = 'normal', destId?: string): void {
    if (bytes.length < 1) return;
    const status = bytes[0];
    const type = status & 0xf0;
    const channel = (status & 0x0f) + 1;
    if (type === 0x90 || type === 0x80) {
      const note = bytes[1] ?? 0;
      const vel = bytes[2] ?? 0;
      this.loopbackGuard.recordOutput({
        channel,
        note,
        type: type === 0x90 && vel > 0 ? 'on' : 'off',
        velocity: vel,
      });
    }
    this.pushOutputEvent({
      t: nowMs(),
      dir: 'out',
      bytes: bytes.slice(0, 3),
      destId,
      channel,
      note: bytes[1],
      type: type === 0x90 ? 'noteon' : (type === 0x80 ? 'noteoff' : 'midi'),
      priority,
    });
  }

  private applyRouteOverrides(route: RetunerRoute, destId: string): void {
    if (!this.settings) return;
    const retuner = this.settings.retuner as RetunerSettings;
    const dest = (this.settings.retunerDestinations || []).find((d) => d.id === destId);
    const runtime = this.destinations.get(destId);
    if (!runtime || !dest) return;

    if (route.modeOverride || route.pitchBendRangeOverride) {
      const nextSettings: RetunerSettings = {
        ...retuner,
        mode: (route.modeOverride || retuner.mode) as any,
      };
      const nextDest: OutputDestination = {
        ...dest,
        pitchBendRangeSemitones: route.pitchBendRangeOverride ?? dest.pitchBendRangeSemitones,
      };
      runtime.updateSettings(nextSettings, nextDest);
    }
  }

  private pushInputEvent(evt: MidiEventLog): void {
    this.diagnostics.inputEvents.push(evt);
    if (this.diagnostics.inputEvents.length > 50) this.diagnostics.inputEvents.shift();
    this.scheduleDiagnosticsUpdate();
  }

  private pushOutputEvent(evt: MidiEventLog): void {
    this.diagnostics.outputEvents.push(evt);
    if (this.diagnostics.outputEvents.length > 50) this.diagnostics.outputEvents.shift();
    this.scheduleDiagnosticsUpdate();
  }

  private pushPreflightEvent(evt: PreflightLogEntry): void {
    this.diagnostics.preflight.push(evt);
    if (this.diagnostics.preflight.length > 50) this.diagnostics.preflight.shift();
    this.scheduleDiagnosticsUpdate();
  }

  private incrementDropped(): void {
    this.diagnostics.droppedEvents += 1;
    this.scheduleDiagnosticsUpdate();
  }

  private scheduleDiagnosticsUpdate(): void {
    if (this.diagnosticsDirty) return;
    this.diagnosticsDirty = true;
    if (this.diagnosticsTimer) clearTimeout(this.diagnosticsTimer);
    this.diagnosticsTimer = setTimeout(() => {
      this.diagnosticsDirty = false;
      this.setRetunerState({ diagnostics: { ...this.diagnostics } });
    }, 120);
  }

  private updateDestinationStatus(destId: string, partial: DestinationRuntimeState): void {
    const state = (this.settings?.retunerState || {}) as RetunerState;
    const current = state.destinationStatus || {};
    const next = { ...current, [destId]: { ...(current[destId] || {}), ...partial } };
    this.setRetunerState({ destinationStatus: next });
  }

  private setRetunerState(partial: Partial<RetunerState>): void {
    if (!this.settings) return;
    const current = (this.settings.retunerState || {}) as RetunerState;
    const next = { ...current, ...partial };
    const hash = this.stableStringify(next);
    if (hash === this.lastRetunerStateHash) return;
    this.lastRetunerStateHash = hash;
    this.updateSettings({ retunerState: next });
  }

  private stableStringify(value: unknown): string {
    if (!value || typeof value !== 'object') return String(value);
    const seen = new WeakSet();
    const sorter = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);
      if (Array.isArray(obj)) return obj.map(sorter);
      const out: Record<string, any> = {};
      Object.keys(obj).sort().forEach((k) => {
        out[k] = sorter(obj[k]);
      });
      return out;
    };
    return JSON.stringify(sorter(value));
  }

  private handleMtsEspBroadcast(retuner: RetunerSettings): void {
    const destinations = this.settings?.retunerDestinations || [];
    destinations.forEach((dest) => {
      if (dest.type !== 'mts-esp') return;
      const mode = dest.mtsEsp?.broadcastPolicy ?? retuner.mtsEsp?.broadcastPolicy ?? 'onchange';
      const intervalMs = dest.mtsEsp?.intervalMs ?? retuner.mtsEsp?.broadcastIntervalMs ?? 1000;
      const runtime = this.destinations.get(dest.id) as any;
      const baseTransport = runtime?.transport?.getBaseTransport ? runtime.transport.getBaseTransport() : runtime?.transport;
      const mts = baseTransport && (baseTransport as any).broadcastTuning ? (baseTransport as MtsEspTransport) : null;
      if (!mts) return;

      const shouldBroadcast = () => {
        const table = this.buildTuningTable(retuner);
        void mts.broadcastTuning(table).catch((e) => log.warn('MTS broadcast failed', e));
        void mts.getClientCount().then((count) => {
          this.setRetunerState({ mtsEspClientCount: count });
        }).catch(() => undefined);
      };

      if (mode === 'interval') {
        if (!this.broadcastIntervals.has(dest.id)) {
          const timer = setInterval(shouldBroadcast, Math.max(200, intervalMs));
          this.broadcastIntervals.set(dest.id, timer);
        }
      } else {
        const timer = this.broadcastIntervals.get(dest.id);
        if (timer) {
          clearInterval(timer);
          this.broadcastIntervals.delete(dest.id);
        }
        if (mode === 'onchange') {
          shouldBroadcast();
        }
        if (mode === 'manual') {
          const manualId = (this.settings?.retunerState as any)?.mtsEspBroadcastRequestId ?? null;
          if (manualId && manualId !== this.lastManualBroadcastId) {
            this.lastManualBroadcastId = manualId;
            shouldBroadcast();
          }
        }
      }
    });
  }

  private buildTuningTable(retuner: RetunerSettings): number[] {
    const table: number[] = [];
    for (let note = 0; note < 128; note++) {
      const targetHz = this.mapTargetHz({
        id: 'mts',
        enabled: true,
        priority: 0,
        destinations: [],
        mappingMode: retuner.input.mappingMode,
        mappingTable: retuner.input.mappingTable,
        fanOut: false,
      }, note);
      if (targetHz && Number.isFinite(targetHz)) {
        table[note] = targetHz;
      } else {
        table[note] = midiNoteToHz(note, retuner.input.baseTuning.a4Hz);
      }
    }
    return table;
  }
}
