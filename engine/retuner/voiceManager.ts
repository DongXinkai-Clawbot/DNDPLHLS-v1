
export interface Voice {
    voiceId: number;        
    inputNote: number;      
    inputChannel: number;   
    outputNote: number;     
    outputChannel: number;  
    targetHz: number;       
    pitchBend: number;      
    velocity: number;       
    timestamp: number;      
    active: boolean;        
    sourceId?: string;
    destId?: string;
}

export interface NoteStack {
    inputNote: number;
    voiceIds: number[];     
}

export interface ChannelState {
    channel: number;
    activeVoiceIds: Set<number>;
    currentPitchBend: number;
    lastUsedTimestamp: number;
}

export class VoiceManager {
    private voices: Map<number, Voice> = new Map();           
    private noteStacks: Map<string, number[]> = new Map();    
    private channelStates: ChannelState[] = [];               
    private nextVoiceId: number = 1;

    constructor() {
        this.initChannelStates();
    }

    private initChannelStates(): void {
        
        this.channelStates = new Array(17).fill(null).map((_, i) => ({
            channel: i,
            activeVoiceIds: new Set<number>(),
            currentPitchBend: 8192,  
            lastUsedTimestamp: 0,
        }));
    }

    allocateVoice(
        inputNote: number,
        inputChannel: number,
        outputNote: number,
        outputChannel: number,
        targetHz: number,
        pitchBend: number,
        velocity: number
    , meta?: { sourceId?: string; destId?: string }): Voice {
        const voiceId = this.nextVoiceId++;
        const timestamp = Date.now();

        const voice: Voice = {
            voiceId,
            inputNote,
            inputChannel,
            outputNote,
            outputChannel,
            targetHz,
            pitchBend,
            velocity,
            timestamp,
            active: true,
            sourceId: meta?.sourceId,
            destId: meta?.destId,
        };

        this.voices.set(voiceId, voice);

        const noteKey = this.getNoteKey(inputNote, inputChannel);
        let stack = this.noteStacks.get(noteKey);
        if (!stack) {
            stack = [];
            this.noteStacks.set(noteKey, stack);
        }
        stack.push(voiceId);

        const channelState = this.channelStates[outputChannel];
        if (channelState) {
            channelState.activeVoiceIds.add(voiceId);
            channelState.lastUsedTimestamp = timestamp;
            channelState.currentPitchBend = pitchBend;
        }

        return voice;
    }

    releaseVoice(inputNote: number, inputChannel: number = 1): Voice | null {
        const noteKey = this.getNoteKey(inputNote, inputChannel);
        const stack = this.noteStacks.get(noteKey);
        if (!stack || stack.length === 0) {
            return null;
        }

        const voiceId = stack.pop()!;
        const voice = this.voices.get(voiceId);

        if (!voice) {
            return null;
        }

        voice.active = false;

        const channelState = this.channelStates[voice.outputChannel];
        if (channelState) {
            channelState.activeVoiceIds.delete(voiceId);
        }

        this.voices.delete(voiceId);

        if (stack.length === 0) {
            this.noteStacks.delete(noteKey);
        }

        return voice;
    }

    releaseVoiceById(voiceId: number): Voice | null {
        const voice = this.voices.get(voiceId);
        if (!voice) {
            return null;
        }

        const stack = this.noteStacks.get(this.getNoteKey(voice.inputNote, voice.inputChannel));
        if (stack) {
            const idx = stack.indexOf(voiceId);
            if (idx !== -1) {
                stack.splice(idx, 1);
            }
            if (stack.length === 0) {
                this.noteStacks.delete(this.getNoteKey(voice.inputNote, voice.inputChannel));
            }
        }

        voice.active = false;

        const channelState = this.channelStates[voice.outputChannel];
        if (channelState) {
            channelState.activeVoiceIds.delete(voiceId);
        }

        this.voices.delete(voiceId);

        return voice;
    }

    getVoicesByChannel(channel: number): Voice[] {
        const channelState = this.channelStates[channel];
        if (!channelState) return [];

        const result: Voice[] = [];
        for (const voiceId of channelState.activeVoiceIds) {
            const voice = this.voices.get(voiceId);
            if (voice && voice.active) {
                result.push(voice);
            }
        }
        return result;
    }

    isChannelEmpty(channel: number): boolean {
        const channelState = this.channelStates[channel];
        if (!channelState) return true;
        return channelState.activeVoiceIds.size === 0;
    }

    getChannelVoiceCount(channel: number): number {
        const channelState = this.channelStates[channel];
        if (!channelState) return 0;
        return channelState.activeVoiceIds.size;
    }

    stealOldestVoice(): Voice | null {
        let oldestVoice: Voice | null = null;
        let oldestTimestamp = Infinity;

        for (const voice of this.voices.values()) {
            if (voice.active && voice.timestamp < oldestTimestamp) {
                oldestTimestamp = voice.timestamp;
                oldestVoice = voice;
            }
        }

        if (oldestVoice) {
            return this.releaseVoiceById(oldestVoice.voiceId);
        }

        return null;
    }

    stealOldestVoiceInChannel(channel: number): Voice | null {
        const voices = this.getVoicesByChannel(channel);
        if (voices.length === 0) return null;

        let oldestVoice = voices[0];
        for (const voice of voices) {
            if (voice.timestamp < oldestVoice.timestamp) {
                oldestVoice = voice;
            }
        }

        return this.releaseVoiceById(oldestVoice.voiceId);
    }

    stealQuietestVoice(): Voice | null {
        let quietestVoice: Voice | null = null;
        let lowestVelocity = Infinity;

        for (const voice of this.voices.values()) {
            if (voice.active && voice.velocity < lowestVelocity) {
                lowestVelocity = voice.velocity;
                quietestVoice = voice;
            }
        }

        if (quietestVoice) {
            return this.releaseVoiceById(quietestVoice.voiceId);
        }

        return null;
    }

    getAllActiveVoices(): Voice[] {
        return Array.from(this.voices.values()).filter(v => v.active);
    }

    getActiveVoiceCount(): number {
        return this.voices.size;
    }

    getNoteVoiceCount(inputNote: number, inputChannel: number = 1): number {
        const stack = this.noteStacks.get(this.getNoteKey(inputNote, inputChannel));
        return stack ? stack.length : 0;
    }

    updateChannelPitchBend(channel: number, pitchBend: number): void {
        const channelState = this.channelStates[channel];
        if (channelState) {
            channelState.currentPitchBend = pitchBend;
        }
    }

    getChannelPitchBend(channel: number): number {
        const channelState = this.channelStates[channel];
        return channelState ? channelState.currentPitchBend : 8192;
    }

    findFreeChannel(startChannel: number, endChannel: number): number | null {
        for (let ch = startChannel; ch <= endChannel; ch++) {
            if (this.isChannelEmpty(ch)) {
                return ch;
            }
        }
        return null;
    }

    findLeastUsedChannel(startChannel: number, endChannel: number): number {
        let leastUsedChannel = startChannel;
        let leastVoiceCount = Infinity;

        for (let ch = startChannel; ch <= endChannel; ch++) {
            const count = this.getChannelVoiceCount(ch);
            if (count < leastVoiceCount) {
                leastVoiceCount = count;
                leastUsedChannel = ch;
            }
        }

        return leastUsedChannel;
    }

    findOldestUsedChannel(startChannel: number, endChannel: number): number {
        let oldestChannel = startChannel;
        let oldestTimestamp = Infinity;

        for (let ch = startChannel; ch <= endChannel; ch++) {
            const channelState = this.channelStates[ch];
            if (channelState && channelState.lastUsedTimestamp < oldestTimestamp) {
                oldestTimestamp = channelState.lastUsedTimestamp;
                oldestChannel = ch;
            }
        }

        return oldestChannel;
    }

    clear(): void {
        this.voices.clear();
        this.noteStacks.clear();
        this.initChannelStates();
        
    }

    clearChannel(channel: number): Voice[] {
        const voices = this.getVoicesByChannel(channel);
        const released: Voice[] = [];

        for (const voice of voices) {
            const releasedVoice = this.releaseVoiceById(voice.voiceId);
            if (releasedVoice) {
                released.push(releasedVoice);
            }
        }

        return released;
    }

    getDebugInfo(): {
        totalVoices: number;
        channelUsage: { channel: number; voiceCount: number }[];
        noteStacks: { note: number; count: number }[];
    } {
        const channelUsage = [];
        for (let ch = 1; ch <= 16; ch++) {
            const count = this.getChannelVoiceCount(ch);
            if (count > 0) {
                channelUsage.push({ channel: ch, voiceCount: count });
            }
        }

        const noteStacks = [];
        for (const [noteKey, stack] of this.noteStacks.entries()) {
            noteStacks.push({ note: Number(noteKey.split(':')[0]), count: stack.length });
        }

        return {
            totalVoices: this.voices.size,
            channelUsage,
            noteStacks,
        };
    }

    private getNoteKey(inputNote: number, inputChannel: number): string {
        return `${inputNote}:${inputChannel}`;
    }
}
