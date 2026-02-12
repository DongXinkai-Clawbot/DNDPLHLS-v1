import type { IRetunerTransport } from '../retuner/retunerEngine';
import { createLogger } from '../../utils/logger';

export type MidiPriority = 'realtime' | 'normal' | 'bulk';

export interface QueuedMessage {
    id: number;
    bytes: number[];
    priority: MidiPriority;
    timestamp: number;
    callback?: () => void;
}

const PRIORITY_WEIGHT: Record<MidiPriority, number> = {
    realtime: 0,
    normal: 1,
    bulk: 2,
};

const log = createLogger('midi/sysex-queue');

/**
 * SysExQueue
 *
 * A lightweight MIDI throttling queue designed for Web MIDI hardware outputs.
 *
 * Key behaviors:
 * - realtime: sent immediately (NoteOn/Off, PitchBend)
 * - normal: throttled with a small gap (default 5ms)
 * - bulk: throttled more aggressively (default 20ms, configurable via options.intervalMs)
 *
 * Important: This implementation is *not* a fixed 20ms polling interval. It schedules
 * sends precisely based on the head-of-queue message and the last send time, so
 * normal traffic is not slowed down after bulk bursts.
 */
export class SysExQueue {
    private queue: QueuedMessage[] = [];
    private bulkIntervalMs: number;
    private normalIntervalMs: number;
    private maxQueueSize: number;

    private timer: ReturnType<typeof setTimeout> | null = null;
    private running: boolean = false;

    private nextMessageId: number = 1;
    private lastSendTime: number = 0;
    private isProcessing: boolean = false;

    constructor(
        private transport: IRetunerTransport,
        options?: {
            /** Bulk (SysEx-heavy) minimum gap, default 20ms */
            intervalMs?: number;
            /** Normal (CC/RPN) minimum gap, default 5ms */
            normalIntervalMs?: number;
            maxQueueSize?: number;
        }
    ) {
        this.bulkIntervalMs = options?.intervalMs ?? 20;
        this.normalIntervalMs = options?.normalIntervalMs ?? 5;
        this.maxQueueSize = options?.maxQueueSize ?? 256;
    }

    enqueue(bytes: number[], priority: MidiPriority = 'normal', callback?: () => void): void {
        // realtime always bypasses queue
        if (priority === 'realtime') {
            this.transport.sendMidi(bytes);
            callback?.();
            return;
        }

        // Backpressure
        if (this.queue.length >= this.maxQueueSize) {
            // Prefer dropping bulk messages
            const bulkIndex = this.queue.findIndex(m => m.priority === 'bulk');
            if (bulkIndex !== -1) {
                this.queue.splice(bulkIndex, 1);
            } else {
                // Otherwise drop oldest
                this.queue.shift();
            }
        }

        const message: QueuedMessage = {
            id: this.nextMessageId++,
            bytes,
            priority,
            timestamp: Date.now(),
            callback,
        };

        this.queue.push(message);
        this.sortByPriority();

        if (!this.running) this.start();
        else this.scheduleNext();
    }

    enqueueNoteOn(channel: number, note: number, velocity: number): void {
        const bytes = [0x90 | ((channel - 1) & 0x0f), note & 0x7f, velocity & 0x7f];
        this.enqueue(bytes, 'realtime');
    }

    enqueueNoteOff(channel: number, note: number, velocity: number = 0): void {
        const bytes = [0x80 | ((channel - 1) & 0x0f), note & 0x7f, velocity & 0x7f];
        this.enqueue(bytes, 'realtime');
    }

    enqueuePitchBend(channel: number, value: number): void {
        const lsb = value & 0x7f;
        const msb = (value >> 7) & 0x7f;
        const bytes = [0xE0 | ((channel - 1) & 0x0f), lsb, msb];
        this.enqueue(bytes, 'realtime');
    }

    enqueueCC(channel: number, cc: number, value: number): void {
        const bytes = [0xB0 | ((channel - 1) & 0x0f), cc & 0x7f, value & 0x7f];
        this.enqueue(bytes, 'normal');
    }

    enqueueProgramChange(channel: number, program: number): void {
        const bytes = [0xC0 | ((channel - 1) & 0x0f), program & 0x7f];
        this.enqueue(bytes, 'normal');
    }

    enqueueSysEx(bytes: number[], callback?: () => void): void {
        this.enqueue(bytes, 'bulk', callback);
    }

    enqueueRPN(channel: number, rpnMsb: number, rpnLsb: number, dataMsb: number, dataLsb: number = 0): void {
        const ch = (channel - 1) & 0x0f;

        // RPN select
        this.enqueue([0xB0 | ch, 101, rpnMsb & 0x7f], 'normal');
        this.enqueue([0xB0 | ch, 100, rpnLsb & 0x7f], 'normal');

        // Data entry
        this.enqueue([0xB0 | ch, 6, dataMsb & 0x7f], 'normal');
        this.enqueue([0xB0 | ch, 38, dataLsb & 0x7f], 'normal');

        // RPN null
        this.enqueue([0xB0 | ch, 101, 127], 'normal');
        this.enqueue([0xB0 | ch, 100, 127], 'normal');
    }

    async flush(): Promise<void> {
        // Stop scheduling; send remaining in-order with per-message spacing.
        this.stop();

        while (this.queue.length > 0) {
            const msg = this.queue.shift()!;
            try {
                this.transport.sendMidi(msg.bytes);
                msg.callback?.();
            } catch (e) {
                log.error('Send error', e);
            }

            const interval = this.getRequiredInterval(msg.priority);
            if (interval > 0 && this.queue.length > 0) {
                await this.delay(interval);
            }
        }
    }

    clear(): void {
        this.queue = [];
        this.scheduleNext();
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.scheduleNext();
    }

    stop(): void {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    getQueueSize(): number {
        return this.queue.length;
    }

    hasPending(): boolean {
        return this.queue.length > 0;
    }

    private sortByPriority(): void {
        this.queue.sort((a, b) => {
            const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
            if (priorityDiff !== 0) return priorityDiff;

            const tsDiff = a.timestamp - b.timestamp;
            if (tsDiff !== 0) return tsDiff;

            // Tie-breaker to preserve deterministic order even if timestamps match.
            return a.id - b.id;
        });
    }

    private getRequiredInterval(priority: MidiPriority): number {
        switch (priority) {
            case 'realtime':
                return 0;
            case 'normal':
                return Math.max(0, this.normalIntervalMs);
            case 'bulk':
                return Math.max(0, this.bulkIntervalMs);
            default:
                return 0;
        }
    }

    private scheduleNext(): void {
        if (!this.running) return;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.queue.length === 0) return;

        const msg = this.queue[0];
        const requiredInterval = this.getRequiredInterval(msg.priority);
        const now = Date.now();
        const dueIn = Math.max(0, requiredInterval - (now - this.lastSendTime));

        this.timer = setTimeout(() => {
            this.processNext();
        }, dueIn);
    }

    private processNext(): void {
        if (!this.running) return;

        if (this.queue.length === 0) {
            this.scheduleNext();
            return;
        }

        if (this.isProcessing) {
            this.scheduleNext();
            return;
        }

        const now = Date.now();
        const msg = this.queue[0];
        const requiredInterval = this.getRequiredInterval(msg.priority);

        if (now - this.lastSendTime < requiredInterval) {
            this.scheduleNext();
            return;
        }

        this.isProcessing = true;

        const message = this.queue.shift()!;
        try {
            this.transport.sendMidi(message.bytes);
            message.callback?.();
        } catch (e) {
            log.error('Send error', e);
        }

        this.lastSendTime = Date.now();
        this.isProcessing = false;

        this.scheduleNext();
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getDebugInfo(): {
        queueLength: number;
        isRunning: boolean;
        intervalMs: number;
        normalIntervalMs: number;
        maxQueueSize: number;
        priorityCounts: Record<MidiPriority, number>;
    } {
        const priorityCounts: Record<MidiPriority, number> = {
            realtime: 0,
            normal: 0,
            bulk: 0,
        };

        for (const msg of this.queue) {
            priorityCounts[msg.priority]++;
        }

        return {
            queueLength: this.queue.length,
            isRunning: this.running,
            intervalMs: this.bulkIntervalMs,
            normalIntervalMs: this.normalIntervalMs,
            maxQueueSize: this.maxQueueSize,
            priorityCounts,
        };
    }
}

export function createSysExQueue(
    transport: IRetunerTransport,
    options?: {
        intervalMs?: number;
        normalIntervalMs?: number;
        maxQueueSize?: number;
    }
): SysExQueue {
    return new SysExQueue(transport, options);
}
