import {
    RetunerSettings, RetunerType, ZoneSettings, MpeZoneConfig
} from '../../domain/retuner/types';
import {
    OutputDestination, getPitchBendRangeFromDestination
} from '../../domain/retuner/destination';
import {
    calculatePitchBend
} from '../../domain/retuner/tuningCore';
import { VoiceManager, Voice } from './voiceManager';

export interface IRetunerTransport {
    sendMidi(bytes: number[], priority?: 'urgent' | 'config' | 'normal'): void;
    sendAllNotesOff(): void;
    /**
     * Optional throttled send path for non-realtime traffic (CC/RPN/SysEx).
     * If provided, RetunerEngine will use it for multi-message sequences.
     */
    sendMidiQueued?: (bytes: number[], priority?: 'normal' | 'bulk') => void;
    connect?: () => Promise<void>;
    disconnect?: () => Promise<void>;
    isConnected?: () => boolean;
    flushConfig?: () => Promise<void>;
    getCapabilities?: () => {
        supportsPb: boolean;
        supportsMpe: boolean;
        supportsMts: boolean;
        maxMessagesPerSecond?: number;
        transport?: string;
    };
}

export type { Voice } from './voiceManager';

export class RetunerEngine {
    private voiceManager: VoiceManager;
    private destination: OutputDestination | null = null;
    private settings: RetunerSettings;
    private transport: IRetunerTransport;

    // Cache to avoid re-sending output configuration on every event.
    private lastPbConfigKeyByDest: Map<string, string> = new Map();
    private lastMpeConfigKeyByDest: Map<string, string> = new Map();

    constructor(
        transport: IRetunerTransport,
        settings: RetunerSettings,
        destination?: OutputDestination | null
    ) {
        this.transport = transport;
        this.settings = settings;
        this.destination = destination ?? null;
        this.voiceManager = new VoiceManager();
    }

    public updateSettings(newSettings: RetunerSettings): void {
        this.settings = newSettings;
        // Settings changes can affect MPE config / pitch bend range targets.
        this.invalidateOutputConfig();
    }

    public updateDestination(destination: OutputDestination | null): void {
        this.destination = destination;
        this.invalidateOutputConfig(destination?.id);
    }

    public getDestination(): OutputDestination | null {
        return this.destination;
    }

    private invalidateOutputConfig(destId?: string | null): void {
        if (destId) {
            this.lastPbConfigKeyByDest.delete(destId);
            this.lastMpeConfigKeyByDest.delete(destId);
            return;
        }
        this.lastPbConfigKeyByDest.clear();
        this.lastMpeConfigKeyByDest.clear();
    }

    private getPitchBendRange(): number {
        if (this.destination) {
            return getPitchBendRangeFromDestination(this.destination, 48);
        }
        return this.settings.outputPitchBendRange ?? 48;
    }

    private sendQueued(bytes: number[], priority: 'normal' | 'bulk' = 'normal'): void {
        if (this.transport.sendMidiQueued) {
            this.transport.sendMidiQueued(bytes, priority);
        } else {
            this.transport.sendMidi(bytes, 'config');
        }
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
                out[k] = sorter((obj as any)[k]);
            });
            return out;
        };
        return JSON.stringify(sorter(value));
    }

    /**
     * Ensure MPE configuration + Pitch Bend Range RPN are configured for the active mode.
     * This is called lazily on first NoteOn after a settings/destination change.
     */
    private ensureOutputConfigured(): void {
        if (!this.settings.enabled || this.settings.mode === 'none') return;

        // Modes that don't require per-channel pitchbend configuration.
        if (this.settings.mode === 'mts-esp-master') return;

        const pbRange = this.getPitchBendRange();
        const mode = this.settings.mode;
        const zoneSig = this.stableStringify(this.settings.zone ?? {});
        const mpeSig = mode === 'mpe' ? this.stableStringify(this.settings.mpeZone ?? {}) : '';
        const destSig = this.destination?.id ?? 'no-dest';

        const pbKey = `${mode}|${pbRange}|${zoneSig}|${destSig}`;
        const mpeKey = `${mode}|${mpeSig}|${destSig}`;

        const lastPb = this.lastPbConfigKeyByDest.get(destSig);
        const lastMpe = this.lastMpeConfigKeyByDest.get(destSig);

        if (mode === 'mpe') {
            if (lastMpe !== mpeKey) {
                this.sendMpeConfig();
                this.lastMpeConfigKeyByDest.set(destSig, mpeKey);
            }
        }

        // Always set Pitch Bend Range for the channels that might emit PB.
        if (lastPb !== pbKey) {
            this.sendPitchBendRangeRpn(pbRange);
            this.lastPbConfigKeyByDest.set(destSig, pbKey);
        }
    }

    public getOutputConfigSignature(): { pbKey: string; mpeKey: string | null } {
        const pbRange = this.getPitchBendRange();
        const mode = this.settings.mode;
        const zoneSig = this.stableStringify(this.settings.zone ?? {});
        const mpeSig = mode === 'mpe' ? this.stableStringify(this.settings.mpeZone ?? {}) : '';
        const destSig = this.destination?.id ?? 'no-dest';
        return {
            pbKey: `${mode}|${pbRange}|${zoneSig}|${destSig}`,
            mpeKey: mode === 'mpe' ? `${mode}|${mpeSig}|${destSig}` : null
        };
    }

    public async preflightOutput(): Promise<void> {
        if (!this.settings.enabled || this.settings.mode === 'none') return;
        if (this.settings.mode === 'mts-esp-master') return;

        this.ensureOutputConfigured();

        // Reset pitch bend to center for any channels we might use.
        const channels = this.getChannelsForPitchBendConfig();
        for (const channel of channels) {
            const lsb = 8192 & 0x7f;
            const msb = (8192 >> 7) & 0x7f;
            const ch = (channel - 1) & 0x0f;
            this.sendQueued([0xE0 | ch, lsb, msb], 'normal');
        }

        // All Notes Off + Reset Controllers (avoid lingering state).
        for (let ch = 1; ch <= 16; ch++) {
            const chByte = (ch - 1) & 0x0f;
            this.sendQueued([0xB0 | chByte, 123, 0], 'normal');
            this.sendQueued([0xB0 | chByte, 121, 0], 'normal');
        }

        if (this.transport.flushConfig) {
            await this.transport.flushConfig();
        }
    }

    private getChannelsForPitchBendConfig(): number[] {
        const mode = this.settings.mode;
        const zone = this.settings.zone;

        const pushUnique = (arr: number[], ch: number) => {
            if (ch >= 1 && ch <= 16 && !arr.includes(ch)) arr.push(ch);
        };

        const channels: number[] = [];

        if (mode === 'midi') {
            pushUnique(channels, zone?.startChannel ?? 1);
            return channels;
        }

        if (mode === 'multichannel') {
            const start = zone?.startChannel ?? 1;
            const end = zone?.endChannel ?? start;
            for (let ch = start; ch <= end; ch++) pushUnique(channels, ch);
            return channels;
        }

        if (mode === 'mpe') {
            const mpeZone = this.settings.mpeZone;

            const addZone = (z?: { globalChannel: number; memberChannels: number[] }) => {
                if (!z) return;
                // Global channel can carry zone-wide messages; include it as well.
                pushUnique(channels, z.globalChannel);
                for (const ch of z.memberChannels) pushUnique(channels, ch);
            };

            if (mpeZone?.type === 'lower') addZone(mpeZone.lower);
            else if (mpeZone?.type === 'upper') addZone(mpeZone.upper);
            else if (mpeZone?.type === 'both') {
                addZone(mpeZone.lower);
                addZone(mpeZone.upper);
            } else {
                // Fallback to the zone range if config is missing.
                const start = zone?.startChannel ?? 2;
                const end = zone?.endChannel ?? 16;
                for (let ch = start; ch <= end; ch++) pushUnique(channels, ch);
            }

            return channels;
        }

        // Default: conservative
        pushUnique(channels, 1);
        return channels;
    }

    private sendPitchBendRangeRpn(pbRangeSemitones: number): void {
        const semis = Math.max(1, Math.min(96, Math.round(pbRangeSemitones)));
        const channels = this.getChannelsForPitchBendConfig();

        for (const channel of channels) {
            const ch = (channel - 1) & 0x0f;
            // RPN 0x0000 Pitch Bend Range, Data Entry MSB = semitones, LSB = cents.
            this.sendQueued([0xB0 | ch, 101, 0], 'normal');
            this.sendQueued([0xB0 | ch, 100, 0], 'normal');
            this.sendQueued([0xB0 | ch, 6, semis & 0x7f], 'normal');
            this.sendQueued([0xB0 | ch, 38, 0], 'normal');
            // RPN null
            this.sendQueued([0xB0 | ch, 101, 127], 'normal');
            this.sendQueued([0xB0 | ch, 100, 127], 'normal');
        }
    }

    private noteFloatFromHz(hz: number): number {
        if (!(hz > 0) || !Number.isFinite(hz)) return 60;
        return 69 + 12 * Math.log2(hz / 440);
    }

    /**
     * Selects an output MIDI note + pitchbend that best represents targetHz
     * within the available pitch bend range.
     */
    private selectOutputNote(targetHz: number, pbRange: number): { outputNote: number; cents: number; pitchBend: number } {
        const noteFloat = this.noteFloatFromHz(targetHz);

        // Search candidate notes that keep bend within the configured range.
        const nMin = Math.max(0, Math.floor(noteFloat - pbRange));
        const nMax = Math.min(127, Math.ceil(noteFloat + pbRange));

        let bestNote = Math.min(127, Math.max(0, Math.round(noteFloat)));
        let bestAbs = Math.abs(noteFloat - bestNote);

        for (let n = nMin; n <= nMax; n++) {
            const abs = Math.abs(noteFloat - n);
            if (abs < bestAbs) {
                bestAbs = abs;
                bestNote = n;
            }
        }

        const cents = (noteFloat - bestNote) * 100;
        const pitchBend = calculatePitchBend(cents, pbRange);

        return { outputNote: bestNote, cents, pitchBend };
    }

    public handleNoteOn(
        inputNote: number,
        velocity: number,
        targetHz: number,
        inputChannel: number = 1
    ): void {
        if (!this.settings.enabled || this.settings.mode === 'none') return;

        // Configure output on demand.
        this.ensureOutputConfigured();

        switch (this.settings.mode) {
            case 'midi': {
                const pbRange = this.getPitchBendRange();
                const { outputNote, pitchBend } = this.selectOutputNote(targetHz, pbRange);
                this.handleMonoNoteOn(inputNote, inputChannel, outputNote, pitchBend, velocity, targetHz);
                break;
            }
            case 'mpe': {
                const pbRange = this.getPitchBendRange();
                const { outputNote, pitchBend } = this.selectOutputNote(targetHz, pbRange);
                this.handleMpeNoteOn(inputNote, inputChannel, outputNote, pitchBend, velocity, targetHz);
                break;
            }
            case 'multichannel': {
                const pbRange = this.getPitchBendRange();
                const { outputNote, pitchBend } = this.selectOutputNote(targetHz, pbRange);
                this.handleMultichannelNoteOn(inputNote, inputChannel, outputNote, pitchBend, velocity, targetHz);
                break;
            }
            case 'mts-esp-master':
                if (this.settings.mtsEsp?.mode === 'broadcast+passthrough') {
                    this.sendNoteOn(1, inputNote, velocity);
                }
                break;
        }
    }

    public handleNoteOff(inputNote: number, velocity: number = 0, inputChannel: number = 1): void {
        if (!this.settings.enabled || this.settings.mode === 'none') return;

        switch (this.settings.mode) {
            case 'midi':
                this.handleMonoNoteOff(inputNote, velocity, inputChannel);
                break;
            case 'mpe':
            case 'multichannel':
                this.handlePolyNoteOff(inputNote, velocity, inputChannel);
                break;
            case 'mts-esp-master':
                if (this.settings.mtsEsp?.mode === 'broadcast+passthrough') {
                    this.sendNoteOff(1, inputNote, velocity);
                }
                break;
        }
    }

    private handleMonoNoteOn(
        inputNote: number,
        inputChannel: number,
        outputNote: number,
        pitchBend: number,
        velocity: number,
        targetHz: number
    ): void {
        const ch = this.settings.zone.startChannel || 1;

        if (this.voiceManager.getActiveVoiceCount() > 0) {
            if (this.settings.monoPolicy === 'steal') {
                this.forceSilenceAll();
            } else {
                this.forceSilenceAll();
            }
        }

        this.sendPitchBend(ch, pitchBend);
        this.sendNoteOn(ch, outputNote, velocity);

        this.voiceManager.allocateVoice(
            inputNote, inputChannel, outputNote, ch,
            targetHz, pitchBend, velocity
        );
    }

    private handleMonoNoteOff(inputNote: number, velocity: number, inputChannel: number): void {
        const voice = this.voiceManager.releaseVoice(inputNote, inputChannel);
        if (!voice) return;

        const ch = voice.outputChannel;
        this.sendNoteOff(ch, voice.outputNote, velocity);

        if (this.settings.resetPbOnNoteOff && this.voiceManager.isChannelEmpty(ch)) {
            this.sendPitchBend(ch, 8192);
        }
    }

    private handleMpeNoteOn(
        inputNote: number,
        inputChannel: number,
        outputNote: number,
        pitchBend: number,
        velocity: number,
        targetHz: number
    ): void {
        const ch = this.allocateMpeChannel();
        this.sendPitchBend(ch, pitchBend);
        this.sendNoteOn(ch, outputNote, velocity);

        this.voiceManager.allocateVoice(
            inputNote, inputChannel, outputNote, ch,
            targetHz, pitchBend, velocity
        );
    }

    private allocateMpeChannel(): number {
        const zone = this.settings.zone;
        const mpeZone = this.settings.mpeZone;

        const tryMembers = (members?: number[]) => {
            if (!members || members.length === 0) return null;
            return this.findOrStealChannel(members);
        };

        if (mpeZone?.type === 'lower' && mpeZone.lower) {
            return tryMembers(mpeZone.lower.memberChannels) ?? (zone.startChannel || 2);
        }
        if (mpeZone?.type === 'upper' && mpeZone.upper) {
            return tryMembers(mpeZone.upper.memberChannels) ?? (zone.startChannel || 2);
        }
        if (mpeZone?.type === 'both') {
            const members = [
                ...(mpeZone.lower?.memberChannels ?? []),
                ...(mpeZone.upper?.memberChannels ?? [])
            ];
            if (members.length > 0) {
                return this.findOrStealChannel(members);
            }
        }

        // Fallback: allocate within configured range.
        const start = zone.startChannel;
        const end = zone.endChannel;

        const freeChannel = this.voiceManager.findFreeChannel(start, end);
        if (freeChannel !== null) {
            return freeChannel;
        }

        return this.stealChannelInRange(start, end);
    }

    private findOrStealChannel(channels: number[]): number {
        for (const ch of channels) {
            if (this.voiceManager.isChannelEmpty(ch)) {
                return ch;
            }
        }

        let oldestChannel = channels[0];
        let oldestTimestamp = Infinity;

        for (const ch of channels) {
            const voices = this.voiceManager.getVoicesByChannel(ch);
            for (const voice of voices) {
                if (voice.timestamp < oldestTimestamp) {
                    oldestTimestamp = voice.timestamp;
                    oldestChannel = ch;
                }
            }
        }

        this.voiceManager.stealOldestVoiceInChannel(oldestChannel);
        return oldestChannel;
    }

    private handleMultichannelNoteOn(
        inputNote: number,
        inputChannel: number,
        outputNote: number,
        pitchBend: number,
        velocity: number,
        targetHz: number
    ): void {
        const zone = this.settings.zone;
        const start = zone.startChannel;
        const end = zone.endChannel;

        let ch = this.voiceManager.findFreeChannel(start, end);
        if (ch === null) {
            ch = this.stealChannelInRange(start, end);
        }

        this.sendPitchBend(ch, pitchBend);
        this.sendNoteOn(ch, outputNote, velocity);

        this.voiceManager.allocateVoice(
            inputNote, inputChannel, outputNote, ch,
            targetHz, pitchBend, velocity
        );
    }

    private handlePolyNoteOff(inputNote: number, velocity: number, inputChannel: number): void {
        const voice = this.voiceManager.releaseVoice(inputNote, inputChannel);
        if (!voice) return;

        const ch = voice.outputChannel;
        this.sendNoteOff(ch, voice.outputNote, velocity);

        if (this.settings.resetPbOnNoteOff && this.voiceManager.isChannelEmpty(ch)) {
            this.sendPitchBend(ch, 8192);
        }
    }

    private stealChannelInRange(start: number, end: number): number {
        const policy = this.settings.stealPolicy;

        if (policy === 'quietest') {
            const voice = this.voiceManager.stealQuietestVoice();
            if (voice) {
                this.sendNoteOff(voice.outputChannel, voice.outputNote, 0);
                return voice.outputChannel;
            }
        }

        const oldestChannel = this.voiceManager.findOldestUsedChannel(start, end);
        const voice = this.voiceManager.stealOldestVoiceInChannel(oldestChannel);
        if (voice) {
            this.sendNoteOff(voice.outputChannel, voice.outputNote, 0);
        }
        return oldestChannel;
    }

    public retuneActiveVoices(
        getTargetHz: (inputNote: number, inputChannel: number) => number | null,
        policy: { mode: 'new-notes-only' | 'immediate' | 'ramp'; rampMs: number }
    ): void {
        if (policy.mode === 'new-notes-only') return;
        const pbRange = this.getPitchBendRange();
        const voices = this.voiceManager.getAllActiveVoices();
        voices.forEach((voice) => {
            const nextHz = getTargetHz(voice.inputNote, voice.inputChannel);
            if (!nextHz || !Number.isFinite(nextHz) || nextHz <= 0) return;
            const { outputNote, pitchBend } = this.selectOutputNote(nextHz, pbRange);
            if (policy.mode === 'ramp' && policy.rampMs > 0) {
                this.rampPitchBend(voice.outputChannel, voice.pitchBend, pitchBend, policy.rampMs);
                voice.pitchBend = pitchBend;
                voice.targetHz = nextHz;
                return;
            }
            if (outputNote !== voice.outputNote) {
                this.sendNoteOff(voice.outputChannel, voice.outputNote, 0);
                this.sendPitchBend(voice.outputChannel, pitchBend);
                this.sendNoteOn(voice.outputChannel, outputNote, voice.velocity);
                voice.outputNote = outputNote;
                voice.pitchBend = pitchBend;
                voice.targetHz = nextHz;
                return;
            }
            this.sendPitchBend(voice.outputChannel, pitchBend);
            voice.pitchBend = pitchBend;
            voice.targetHz = nextHz;
        });
    }

    public sendMpeConfig(): void {
        const mpeZone = this.settings.mpeZone;
        if (!mpeZone) return;

        if (mpeZone.type === 'lower' && mpeZone.lower) {
            this.sendMpeConfigMessage(mpeZone.lower.globalChannel, mpeZone.lower.memberCount);
        }
        if (mpeZone.type === 'upper' && mpeZone.upper) {
            this.sendMpeConfigMessage(mpeZone.upper.globalChannel, mpeZone.upper.memberCount);
        }
        if (mpeZone.type === 'both') {
            if (mpeZone.lower) {
                this.sendMpeConfigMessage(mpeZone.lower.globalChannel, mpeZone.lower.memberCount);
            }
            if (mpeZone.upper) {
                this.sendMpeConfigMessage(mpeZone.upper.globalChannel, mpeZone.upper.memberCount);
            }
        }
    }

    private sendMpeConfigMessage(globalChannel: number, memberCount: number): void {
        const ch = (globalChannel - 1) & 0x0f;
        // RPN 0x0006 MPE Configuration
        this.sendQueued([0xB0 | ch, 101, 0], 'normal');
        this.sendQueued([0xB0 | ch, 100, 6], 'normal');
        this.sendQueued([0xB0 | ch, 6, memberCount & 0x7f], 'normal');
        this.sendQueued([0xB0 | ch, 38, 0], 'normal');
        // RPN null
        this.sendQueued([0xB0 | ch, 101, 127], 'normal');
        this.sendQueued([0xB0 | ch, 100, 127], 'normal');
    }

    private forceSilenceAll(): void {
        const voices = this.voiceManager.getAllActiveVoices();
        for (const voice of voices) {
            this.sendNoteOff(voice.outputChannel, voice.outputNote, 0);
        }
        this.voiceManager.clear();
    }

    public allNotesOff(): void {
        this.forceSilenceAll();
        this.transport.sendAllNotesOff();
    }

    public panic(): void {
        this.voiceManager.clear();
        for (let ch = 0; ch < 16; ch++) {
            this.transport.sendMidi([0xB0 | ch, 123, 0], 'urgent');
        }
        for (let ch = 0; ch < 16; ch++) {
            this.transport.sendMidi([0xB0 | ch, 121, 0], 'urgent');
        }
        for (let ch = 0; ch < 16; ch++) {
            const lsb = 8192 & 0x7f;
            const msb = (8192 >> 7) & 0x7f;
            this.transport.sendMidi([0xE0 | ch, lsb, msb], 'urgent');
        }
    }

    private sendPitchBend(ch: number, val: number): void {
        const lsb = val & 0x7f;
        const msb = (val >> 7) & 0x7f;
        this.transport.sendMidi([0xE0 | ((ch - 1) & 0x0f), lsb, msb], 'urgent');
        this.voiceManager.updateChannelPitchBend(ch, val);
    }

    private sendNoteOn(ch: number, note: number, vel: number): void {
        this.transport.sendMidi([0x90 | ((ch - 1) & 0x0f), note & 0x7f, vel & 0x7f], 'urgent');
    }

    private sendNoteOff(ch: number, note: number, vel: number): void {
        this.transport.sendMidi([0x80 | ((ch - 1) & 0x0f), note & 0x7f, vel & 0x7f], 'urgent');
    }

    private rampPitchBend(ch: number, from: number, to: number, rampMs: number): void {
        const steps = Math.max(2, Math.min(8, Math.floor(rampMs / 10)));
        const stepMs = rampMs / steps;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const val = Math.round(from + (to - from) * t);
            setTimeout(() => {
                this.sendPitchBend(ch, val);
            }, Math.round(stepMs * i));
        }
    }

    public getDebugInfo(): {
        voiceManager: ReturnType<VoiceManager['getDebugInfo']>;
        settings: RetunerSettings;
        pbRange: number;
    } {
        return {
            voiceManager: this.voiceManager.getDebugInfo(),
            settings: this.settings,
            pbRange: this.getPitchBendRange(),
        };
    }
}
