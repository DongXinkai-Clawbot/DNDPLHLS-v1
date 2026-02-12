import { DEFAULT_TEMPORAL_CONFIG } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type { NotationToken, TemporalConfig, TemporalState, TransportState } from '../types';

type TimelineEntry = { index: number; start: number; end: number; duration: number };

export class TemporalProgressAgent {
  private bus: NotationEventBus<NotationEvents>;
  private config: TemporalConfig;
  private tokens: NotationToken[] = [];
  private playableIndices: number[] = [];
  private timeline: TimelineEntry[] = [];
  private state: TemporalState = {
    currentTokenIndex: -1,
    phase: 'start',
    lookaheadRange: { start: -1, end: -1 }
  };

  constructor(bus: NotationEventBus<NotationEvents>, config: TemporalConfig = DEFAULT_TEMPORAL_CONFIG) {
    this.bus = bus;
    this.config = config;

    this.bus.on('tokens:updated', (stream) => {
      this.setTokens(stream.tokens);
    });

    this.bus.on('sync:request-token', ({ index }) => {
      this.setCurrentTokenIndex(index, 'sync');
    });
  }

  setTokens(tokens: NotationToken[]): void {
    this.tokens = tokens;
    this.rebuildTimeline();
    if (this.playableIndices.length === 0) {
      this.updateState({ currentTokenIndex: -1, phase: 'start', lookaheadRange: { start: -1, end: -1 } });
      return;
    }
    if (!this.playableIndices.includes(this.state.currentTokenIndex)) {
      this.setCurrentTokenIndex(this.playableIndices[0], 'reset');
    } else {
      this.updateState({
        currentTokenIndex: this.state.currentTokenIndex,
        phase: this.state.phase,
        lookaheadRange: this.computeLookahead(this.state.currentTokenIndex)
      });
    }
  }

  advanceToNextPlayable(reason: string = 'advance'): void {
    if (this.playableIndices.length === 0) return;
    const currentPos = this.playableIndices.indexOf(this.state.currentTokenIndex);
    const nextPos = currentPos >= 0 ? Math.min(this.playableIndices.length - 1, currentPos + 1) : 0;
    this.setCurrentTokenIndex(this.playableIndices[nextPos], reason);
  }

  setCurrentTokenIndex(index: number, reason: string = 'seek'): void {
    const target = this.resolvePlayableIndex(index);
    if (target === null) return;
    this.updateState({
      currentTokenIndex: target,
      phase: 'start',
      lookaheadRange: this.computeLookahead(target)
    });
  }

  updateTransport(transport: TransportState): void {
    if (this.timeline.length === 0) return;
    const startMs = transport.startTimeMs ?? 0;
    const msPerBeat = 60000 / Math.max(1, transport.bpm);
    const beatScale = 4 / Math.max(1, transport.beatUnit);
    const elapsedBeats = ((transport.timeMs - startMs) / msPerBeat) * beatScale;

    const entry = this.findTimelineEntry(elapsedBeats);
    if (!entry) return;

    const progress = entry.duration > 0 ? (elapsedBeats - entry.start) / entry.duration : 0;
    const phase = this.phaseFromProgress(progress);
    this.updateState({
      currentTokenIndex: entry.index,
      phase,
      lookaheadRange: this.computeLookahead(entry.index)
    });
  }

  getState(): TemporalState {
    return this.state;
  }

  private rebuildTimeline(): void {
    this.playableIndices = [];
    this.timeline = [];
    let cursor = 0;
    this.tokens.forEach((token, index) => {
      if (!this.isPlayable(token)) return;
      const duration = Math.max(1, token.durationUnit || 1);
      const start = cursor;
      const end = cursor + duration;
      this.playableIndices.push(index);
      this.timeline.push({ index, start, end, duration });
      cursor = end;
    });
  }

  private resolvePlayableIndex(index: number): number | null {
    if (this.playableIndices.length === 0) return null;
    if (this.playableIndices.includes(index)) return index;
    let closest = this.playableIndices[0];
    let minDiff = Math.abs(index - closest);
    for (const idx of this.playableIndices) {
      const diff = Math.abs(index - idx);
      if (diff < minDiff) {
        closest = idx;
        minDiff = diff;
      }
    }
    return closest;
  }

  private computeLookahead(currentIndex: number): { start: number; end: number } {
    if (currentIndex < 0) return { start: -1, end: -1 };
    const pos = this.playableIndices.indexOf(currentIndex);
    if (pos < 0) return { start: currentIndex, end: currentIndex };
    const endPos = Math.min(this.playableIndices.length - 1, pos + this.config.lookaheadCount);
    return { start: currentIndex, end: this.playableIndices[endPos] };
  }

  private findTimelineEntry(elapsedBeats: number): TimelineEntry | null {
    if (this.timeline.length === 0) return null;
    const first = this.timeline[0];
    const last = this.timeline[this.timeline.length - 1];
    if (elapsedBeats <= first.start) return first;
    if (elapsedBeats >= last.end) return last;
    for (const entry of this.timeline) {
      if (elapsedBeats >= entry.start && elapsedBeats < entry.end) return entry;
    }
    return last;
  }

  private phaseFromProgress(progress: number): TemporalState['phase'] {
    if (progress <= this.config.phaseThresholds.start) return 'start';
    if (progress >= this.config.phaseThresholds.end) return 'end';
    return 'sustain';
  }

  private updateState(next: TemporalState): void {
    const current = this.state;
    if (
      current.currentTokenIndex === next.currentTokenIndex &&
      current.phase === next.phase &&
      current.lookaheadRange.start === next.lookaheadRange.start &&
      current.lookaheadRange.end === next.lookaheadRange.end
    ) {
      return;
    }
    this.state = next;
    this.bus.emit('temporal:updated', this.state);
  }

  private isPlayable(token: NotationToken): boolean {
    return !!(token.degree !== null || token.isRest) && token.durationUnit > 0;
  }
}
