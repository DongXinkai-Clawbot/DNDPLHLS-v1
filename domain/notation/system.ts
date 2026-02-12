import { DEFAULT_INTERACTION_STATE, DEFAULT_PARSING_RULES, DEFAULT_RATIO_CONTEXT, DEFAULT_RENDER_CONFIG, DEFAULT_SYNC_CONFIG, DEFAULT_TEMPORAL_CONFIG } from './defaults';
import { NotationEventBus } from './eventBus';
import type { NotationEvents } from './events';
import { InteractionAgent } from './agents/InteractionAgent';
import { NotationParsingAgent } from './agents/NotationParsingAgent';
import { RatioInterpretationAgent } from './agents/RatioInterpretationAgent';
import { RenderingAgent } from './agents/RenderingAgent';
import { SynchronizationAgent } from './agents/SynchronizationAgent';
import { TemporalProgressAgent } from './agents/TemporalProgressAgent';
import type {
  InteractionState,
  ParsingRules,
  RatioContext,
  RenderConfig,
  SyncConfig,
  TemporalConfig,
  TransportState
} from './types';
import type { Fraction } from '../../types';

type NotationSystemConfig = {
  parsingRules?: ParsingRules;
  ratioContext?: RatioContext;
  interaction?: InteractionState;
  temporal?: TemporalConfig;
  render?: RenderConfig;
  sync?: SyncConfig;
};

export class NotationSystem {
  readonly bus: NotationEventBus<NotationEvents>;
  readonly parsing: NotationParsingAgent;
  readonly ratio: RatioInterpretationAgent;
  readonly temporal: TemporalProgressAgent;
  readonly sync: SynchronizationAgent;
  readonly rendering: RenderingAgent;
  readonly interaction: InteractionAgent;

  constructor(config: NotationSystemConfig = {}) {
    this.bus = new NotationEventBus<NotationEvents>();
    const ratioContext = config.ratioContext ?? DEFAULT_RATIO_CONTEXT;

    this.parsing = new NotationParsingAgent(this.bus, config.parsingRules ?? DEFAULT_PARSING_RULES);
    this.ratio = new RatioInterpretationAgent(this.bus, ratioContext);
    this.temporal = new TemporalProgressAgent(this.bus, config.temporal ?? DEFAULT_TEMPORAL_CONFIG);
    this.sync = new SynchronizationAgent(this.bus, config.sync ?? DEFAULT_SYNC_CONFIG);
    this.rendering = new RenderingAgent(this.bus, config.render ?? DEFAULT_RENDER_CONFIG);
    this.interaction = new InteractionAgent(
      this.bus,
      config.interaction ?? DEFAULT_INTERACTION_STATE,
      ratioContext
    );
    this.interaction.initialize();
  }

  on<K extends keyof NotationEvents>(event: K, handler: (payload: NotationEvents[K]) => void): () => void {
    return this.bus.on(event, handler);
  }

  parse(text: string, rulesOverride?: Partial<ParsingRules>) {
    return this.parsing.parse(text, rulesOverride);
  }

  setRatioContext(context: RatioContext): void {
    this.interaction.setRatioContext(context);
  }

  updateControls(partial: Partial<InteractionState>): void {
    this.interaction.setState(partial);
  }

  updateTransport(transport: TransportState): void {
    this.temporal.updateTransport(transport);
  }

  advanceToken(): void {
    this.temporal.advanceToNextPlayable('manual');
  }

  seekToken(index: number): void {
    this.temporal.setCurrentTokenIndex(index, 'manual');
  }

  setManualScrollIndex(index: number): void {
    this.rendering.setManualScrollIndex(index);
  }

  handleLatticeSelection(ratio: Fraction, isUser: boolean = true): void {
    this.sync.handleLatticeSelection(ratio, isUser);
  }

  handleMidiNoteOn(payload: { ratio?: Fraction; cents?: number; isUser?: boolean }): void {
    this.sync.handleMidiNoteOn(payload);
  }

  handleRetuneConfirmed(ratio: Fraction, isUser: boolean = true): void {
    this.sync.handleRetuneConfirmed(ratio, isUser);
  }

  handleAudioState(payload: { ratio?: Fraction; isUser?: boolean }): void {
    this.sync.handleAudioState(payload);
  }

  clearOverride(): void {
    this.sync.clearOverride();
  }
}
