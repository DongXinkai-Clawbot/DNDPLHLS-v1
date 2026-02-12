import { DEFAULT_INTERACTION_STATE, DEFAULT_RATIO_CONTEXT } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type { InteractionState, RatioContext } from '../types';

export class InteractionAgent {
  private bus: NotationEventBus<NotationEvents>;
  private state: InteractionState;
  private ratioContext: RatioContext;

  constructor(
    bus: NotationEventBus<NotationEvents>,
    state: InteractionState = DEFAULT_INTERACTION_STATE,
    ratioContext: RatioContext = DEFAULT_RATIO_CONTEXT
  ) {
    this.bus = bus;
    this.state = state;
    this.ratioContext = ratioContext;
  }

  initialize(): void {
    this.bus.emit('controls:updated', this.state);
    this.bus.emit('ratio-context:updated', this.ratioContext);
  }

  setState(partial: Partial<InteractionState>): void {
    this.state = { ...this.state, ...partial };
    this.bus.emit('controls:updated', this.state);
  }

  getState(): InteractionState {
    return this.state;
  }

  setRatioContext(context: RatioContext): void {
    this.ratioContext = context;
    this.bus.emit('ratio-context:updated', this.ratioContext);
  }

  updateRatioContext(partial: Partial<RatioContext>): void {
    this.ratioContext = { ...this.ratioContext, ...partial };
    this.bus.emit('ratio-context:updated', this.ratioContext);
  }

  getRatioContext(): RatioContext {
    return this.ratioContext;
  }
}
