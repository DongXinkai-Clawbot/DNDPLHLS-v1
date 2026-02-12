import { calculateCents, getPrimeVectorFromRatio } from '../../../musicLogic';
import { DEFAULT_INTERACTION_STATE, DEFAULT_SYNC_CONFIG } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type {
  InteractionState,
  RatioDescriptor,
  SyncConfig,
  SyncStatus,
  TemporalState
} from '../types';
import type { Fraction } from '../../../types';

type ExternalSource = 'lattice' | 'midi' | 'retune' | 'audio' | 'external';

export class SynchronizationAgent {
  private bus: NotationEventBus<NotationEvents>;
  private config: SyncConfig;
  private controls: InteractionState = DEFAULT_INTERACTION_STATE;
  private ratios: RatioDescriptor[] = [];
  private temporal: TemporalState = { currentTokenIndex: -1, phase: 'start', lookaheadRange: { start: -1, end: -1 } };
  private overrideMode = false;
  private lastSource: SyncStatus['lastSource'] = 'none';
  private externalRatios: Partial<Record<ExternalSource, Fraction>> = {};
  private lastSyncedIndex = -1;

  constructor(bus: NotationEventBus<NotationEvents>, config: SyncConfig = DEFAULT_SYNC_CONFIG) {
    this.bus = bus;
    this.config = config;

    this.bus.on('controls:updated', (state) => {
      this.controls = state;
    });

    this.bus.on('ratios:updated', (ratios) => {
      this.ratios = ratios;
      this.lastSyncedIndex = -1;
      this.handleTokenUpdate();
    });

    this.bus.on('temporal:updated', (state) => {
      this.temporal = state;
      this.handleTokenUpdate();
    });
  }

  clearOverride(): void {
    this.overrideMode = false;
    this.lastSyncedIndex = -1;
    this.emitStatus('notation', undefined, 'Override cleared');
    this.handleTokenUpdate();
  }

  handleLatticeSelection(ratio: Fraction, isUser: boolean = true): void {
    this.externalRatios.lattice = ratio;
    this.handleExternalInput('lattice', ratio, isUser);
  }

  handleMidiNoteOn(payload: { ratio?: Fraction; cents?: number; isUser?: boolean }): void {
    const isUser = payload.isUser ?? true;
    if (payload.ratio) {
      this.externalRatios.midi = payload.ratio;
      this.handleExternalInput('midi', payload.ratio, isUser);
      return;
    }
    if (typeof payload.cents === 'number') {
      this.handleExternalCents('midi', payload.cents, isUser);
    }
  }

  handleRetuneConfirmed(ratio: Fraction, isUser: boolean = true): void {
    this.externalRatios.retune = ratio;
    this.handleExternalInput('retune', ratio, isUser);
  }

  handleAudioState(payload: { ratio?: Fraction; isUser?: boolean }): void {
    if (!payload.ratio) return;
    const isUser = payload.isUser ?? false;
    this.externalRatios.audio = payload.ratio;
    this.handleExternalInput('audio', payload.ratio, isUser);
  }

  private handleExternalInput(source: ExternalSource, ratio: Fraction, isUser: boolean): void {
    this.lastSource = source;
    if (isUser) {
      this.overrideMode = true;
    }

    this.maybeAdvanceFromExternal(ratio, source, isUser);
    this.emitMismatchIfNeeded(ratio, source);
  }

  private handleExternalCents(source: ExternalSource, cents: number, isUser: boolean): void {
    this.lastSource = source;
    if (isUser) {
      this.overrideMode = true;
    }

    if (!this.controls.autoAdvance || this.controls.syncPriority !== 'user') {
      this.emitStatus(source, undefined, 'Auto-advance disabled');
      return;
    }

    const match = this.findClosestTokenIndexByCents(cents);
    if (match) {
      this.bus.emit('sync:request-token', { index: match.index, reason: `${source}-match` });
    }
  }

  private maybeAdvanceFromExternal(ratio: Fraction, source: ExternalSource, isUser: boolean): void {
    if (!this.controls.autoAdvance) return;
    if (this.controls.syncPriority !== 'user' && isUser) return;
    if (this.controls.syncPriority !== 'user' && !isUser) return;

    const targetCents = calculateCents(ratio);
    const match = this.findClosestTokenIndexByCents(targetCents);
    if (!match) return;
    this.bus.emit('sync:request-token', { index: match.index, reason: `${source}-match` });
  }

  private handleTokenUpdate(): void {
    const index = this.temporal.currentTokenIndex;
    if (index < 0 || index === this.lastSyncedIndex) return;

    const descriptor = this.ratios[index];
    if (!descriptor || !descriptor.finalRatio) return;

    if (this.overrideMode) {
      this.emitStatus('notation', undefined, 'Override active');
      return;
    }

    this.lastSyncedIndex = index;
    this.lastSource = 'notation';

    if (this.controls.autoRetune && this.shouldSyncExternal('retune', descriptor.finalRatio)) {
      this.bus.emit('sync:request-retune', { ratio: descriptor.finalRatio, tokenIndex: index });
    }

    if (this.controls.autoLatticeSync && this.shouldSyncExternal('lattice', descriptor.finalRatio)) {
      const primeVector = descriptor.primeFactors ?? getPrimeVectorFromRatio(descriptor.finalRatio.n, descriptor.finalRatio.d);
      this.bus.emit('sync:request-lattice', { primeVector, tokenIndex: index });
    }

    if (this.controls.autoAudio) {
      this.bus.emit('sync:request-audio', { ratio: descriptor.finalRatio, tokenIndex: index });
    }
  }

  private shouldSyncExternal(target: 'lattice' | 'retune', ratio: Fraction): boolean {
    if (this.controls.syncPriority === 'score') return true;
    const external = this.externalRatios[target];
    if (!external) return true;
    const diff = this.diffCents(ratio, external);
    if (diff <= this.config.mismatchToleranceCents) return true;
    this.emitStatus('notation', diff, 'External mismatch');
    return false;
  }

  private emitMismatchIfNeeded(externalRatio: Fraction, source: ExternalSource): void {
    const current = this.ratios[this.temporal.currentTokenIndex];
    if (!current || !current.finalRatio) return;
    const diff = this.diffCents(current.finalRatio, externalRatio);
    if (diff <= this.config.mismatchToleranceCents) return;
    this.emitStatus(source, diff, 'Ratio mismatch');
  }

  private diffCents(a: Fraction, b: Fraction): number {
    const centsA = calculateCents(a);
    const centsB = calculateCents(b);
    return Math.abs(centsA - centsB);
  }

  private emitStatus(source: SyncStatus['lastSource'], mismatchCents?: number, message?: string): void {
    this.bus.emit('sync:status', {
      mode: this.overrideMode ? 'observing' : 'synced',
      lastSource: source,
      mismatchCents,
      message
    });
  }

  private findClosestTokenIndexByCents(targetCents: number): { index: number; diff: number } | null {
    let bestIndex = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    this.ratios.forEach((ratio, index) => {
      if (!ratio || !ratio.finalRatio) return;
      const diff = Math.abs(calculateCents(ratio.finalRatio) - targetCents);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) return null;
    if (bestDiff > this.config.matchToleranceCents) return null;
    return { index: bestIndex, diff: bestDiff };
  }
}
