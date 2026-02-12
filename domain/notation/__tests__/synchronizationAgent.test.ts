import { createFraction } from '../../../musicLogic';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import { SynchronizationAgent } from '../agents/SynchronizationAgent';
import type { InteractionState, RatioDescriptor, TemporalState } from '../types';

describe('SynchronizationAgent', () => {
  test('requests token sync for external lattice selection', () => {
    const bus = new NotationEventBus<NotationEvents>();
    const sync = new SynchronizationAgent(bus, {
      matchToleranceCents: Number.POSITIVE_INFINITY,
      mismatchToleranceCents: 1
    });

    const controls: InteractionState = {
      autoAdvance: true,
      autoRetune: false,
      autoLatticeSync: false,
      autoScroll: true,
      autoAudio: false,
      displayMode: 'notation',
      syncPriority: 'user',
      showHz: false,
      showCents: false,
      showPrimeFactors: false
    };

    const ratios: RatioDescriptor[] = [
      {
        tokenId: 't1',
        tokenIndex: 0,
        baseRatio: createFraction(1n, 1n),
        accidentalRatio: createFraction(1n, 1n),
        octaveRatio: createFraction(1n, 1n),
        finalRatio: createFraction(1n, 1n),
        simplifiedRatio: createFraction(1n, 1n),
        primeFactors: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
        relativeCents: 0,
        latticeMapping: { primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 } },
        resolvability: 'resolved'
      },
      {
        tokenId: 't2',
        tokenIndex: 1,
        baseRatio: createFraction(5n, 4n),
        accidentalRatio: createFraction(1n, 1n),
        octaveRatio: createFraction(1n, 1n),
        finalRatio: createFraction(5n, 4n),
        simplifiedRatio: createFraction(5n, 4n),
        primeFactors: { 3: 0, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 },
        relativeCents: 0,
        latticeMapping: { primeVector: { 3: 0, 5: 1, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0 } },
        resolvability: 'resolved'
      }
    ];

    const temporal: TemporalState = {
      currentTokenIndex: 0,
      phase: 'start',
      lookaheadRange: { start: 0, end: 1 }
    };

    bus.emit('controls:updated', controls);
    bus.emit('ratios:updated', ratios);
    bus.emit('temporal:updated', temporal);

    let requestedIndex: number | null = null;
    bus.on('sync:request-token', ({ index }) => {
      requestedIndex = index;
    });

    sync.handleLatticeSelection(createFraction(5n, 4n), true);

    expect(requestedIndex).toBe(1);
  });
});
