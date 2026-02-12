import type { LoopbackGuardSettings } from '../../domain/retuner/types';

type LoopbackEvent = {
  t: number;
  key: string;
};

export class LoopbackGuard {
  private events: LoopbackEvent[] = [];

  constructor(private settings: LoopbackGuardSettings) {}

  updateSettings(settings: LoopbackGuardSettings): void {
    this.settings = settings;
  }

  recordOutput(event: { channel: number; note: number; type: 'on' | 'off'; velocity?: number }): void {
    if (!this.settings.enabled || this.settings.mode === 'off') return;
    const now = Date.now();
    const key = this.makeKey(event);
    this.events.push({ t: now, key });
    this.cleanup(now);
  }

  shouldDropInput(event: { channel: number; note: number; type: 'on' | 'off'; velocity?: number }): boolean {
    if (!this.settings.enabled || this.settings.mode === 'off') return false;
    const now = Date.now();
    const key = this.makeKey(event);
    this.cleanup(now);
    return this.events.some((e) => e.key === key && now - e.t <= this.settings.windowMs);
  }

  private makeKey(event: { channel: number; note: number; type: 'on' | 'off'; velocity?: number }): string {
    const bucketVel = this.settings.mode === 'strict'
      ? Math.floor((event.velocity ?? 0) / 8)
      : 0;
    return `${event.channel}:${event.note}:${event.type}:${bucketVel}`;
  }

  private cleanup(now: number): void {
    const cutoff = now - Math.max(10, this.settings.windowMs);
    if (this.events.length === 0) return;
    let idx = 0;
    while (idx < this.events.length && this.events[idx].t < cutoff) idx++;
    if (idx > 0) this.events.splice(0, idx);
  }
}
