import {
  calculateCents,
  formatPrimePowerRatioFromPrimeVector,
  formatRatio,
  getFrequency
} from '../../../musicLogic';
import { DEFAULT_INTERACTION_STATE, DEFAULT_RENDER_CONFIG } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type {
  InteractionState,
  NotationToken,
  RatioDescriptor,
  RenderConfig,
  RenderTokenView,
  RenderView,
  TemporalState
} from '../types';

export class RenderingAgent {
  private bus: NotationEventBus<NotationEvents>;
  private config: RenderConfig;
  private tokens: NotationToken[] = [];
  private ratios: RatioDescriptor[] = [];
  private temporal: TemporalState = { currentTokenIndex: -1, phase: 'start', lookaheadRange: { start: -1, end: -1 } };
  private controls: InteractionState = DEFAULT_INTERACTION_STATE;
  private manualScrollIndex = 0;

  constructor(bus: NotationEventBus<NotationEvents>, config: RenderConfig = DEFAULT_RENDER_CONFIG) {
    this.bus = bus;
    this.config = config;

    this.bus.on('tokens:updated', (stream) => {
      this.tokens = stream.tokens;
      this.render();
    });

    this.bus.on('ratios:updated', (ratios) => {
      this.ratios = ratios;
      this.render();
    });

    this.bus.on('temporal:updated', (state) => {
      this.temporal = state;
      this.render();
    });

    this.bus.on('controls:updated', (state) => {
      this.controls = state;
      this.render();
    });
  }

  setManualScrollIndex(index: number): void {
    this.manualScrollIndex = Math.max(0, Math.floor(index));
    this.render();
  }

  setConfig(partial: Partial<RenderConfig>): void {
    this.config = { ...this.config, ...partial };
    this.render();
  }

  private render(): RenderView {
    const currentIndex = this.temporal.currentTokenIndex;
    const anchor = this.controls.autoScroll && currentIndex >= 0 ? currentIndex : this.manualScrollIndex;
    const visibleRange = this.computeVisibleRange(anchor);

    const views: RenderTokenView[] = this.tokens.map((token, index) => {
      const descriptor = this.ratios[index];
      const ratioLabel = descriptor?.simplifiedRatio ? formatRatio(descriptor.simplifiedRatio) : null;
      const extras: RenderTokenView['extras'] = {};

      if (descriptor?.finalRatio) {
        if (this.controls.showCents) {
          extras.cents = Number(calculateCents(descriptor.finalRatio).toFixed(3));
        }
        if (this.controls.showHz && typeof this.config.baseFrequency === 'number') {
          extras.hz = Number(getFrequency(this.config.baseFrequency, descriptor.finalRatio).toFixed(3));
        }
        if (this.controls.showPrimeFactors && descriptor.primeFactors) {
          extras.primeFactors = formatPrimePowerRatioFromPrimeVector(descriptor.primeFactors);
        }
      }

      return {
        tokenId: token.tokenId,
        index,
        symbol: token.symbol,
        degree: token.degree,
        isRest: token.isRest,
        grouping: token.grouping,
        ratioLabel,
        extras,
        isCurrent: index === currentIndex,
        isPlayable: this.isPlayable(token)
      };
    });

    const view: RenderView = {
      mode: this.controls.displayMode,
      tokens: views,
      currentIndex,
      visibleRange,
      scrollAnchorIndex: anchor,
      autoScroll: this.controls.autoScroll
    };

    this.bus.emit('render:view', view);
    return view;
  }

  private computeVisibleRange(anchor: number): { start: number; end: number } {
    const total = this.tokens.length;
    const size = Math.max(1, this.config.viewportSize);
    if (total === 0) return { start: -1, end: -1 };

    const half = Math.floor(size / 2);
    let start = Math.max(0, anchor - half);
    let end = Math.min(total - 1, start + size - 1);

    if (end - start + 1 < size) {
      start = Math.max(0, end - size + 1);
    }
    return { start, end };
  }

  private isPlayable(token: NotationToken): boolean {
    return !!(token.degree !== null || token.isRest) && token.durationUnit > 0;
  }
}
