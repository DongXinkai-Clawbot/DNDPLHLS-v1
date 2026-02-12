import type { Fraction, PrimeLimit } from '../../types';
import type {
  InteractionState,
  RatioContext,
  RatioDescriptor,
  RenderView,
  SyncStatus,
  TemporalState,
  TokenStream
} from './types';

export interface NotationEvents {
  'tokens:updated': TokenStream;
  'ratio-context:updated': RatioContext;
  'ratios:updated': RatioDescriptor[];
  'temporal:updated': TemporalState;
  'controls:updated': InteractionState;
  'render:view': RenderView;
  'sync:request-token': { index: number; reason: string };
  'sync:request-retune': { ratio: Fraction; tokenIndex: number };
  'sync:request-lattice': { primeVector: Record<PrimeLimit, number>; tokenIndex: number };
  'sync:request-audio': { ratio: Fraction; tokenIndex: number };
  'sync:status': SyncStatus;
}
