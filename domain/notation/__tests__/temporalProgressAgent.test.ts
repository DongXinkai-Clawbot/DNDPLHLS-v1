import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import { TemporalProgressAgent } from '../agents/TemporalProgressAgent';
import type { NotationToken, TemporalState } from '../types';

describe('TemporalProgressAgent', () => {
  test('advances based on transport time', () => {
    const bus = new NotationEventBus<NotationEvents>();
    const temporal = new TemporalProgressAgent(bus, {
      lookaheadCount: 2,
      phaseThresholds: { start: 0.1, end: 0.9 }
    });

    const tokens: NotationToken[] = [
      {
        tokenId: 't1',
        symbol: '1',
        degree: 1,
        accidental: 'none',
        octaveOffset: 0,
        durationUnit: 1,
        isRest: false,
        grouping: null,
        sourceRange: { start: 0, end: 1 }
      },
      {
        tokenId: 't2',
        symbol: '2-',
        degree: 2,
        accidental: 'none',
        octaveOffset: 0,
        durationUnit: 2,
        isRest: false,
        grouping: null,
        sourceRange: { start: 1, end: 3 }
      },
      {
        tokenId: 't3',
        symbol: '0',
        degree: null,
        accidental: 'none',
        octaveOffset: 0,
        durationUnit: 1,
        isRest: true,
        grouping: null,
        sourceRange: { start: 3, end: 4 }
      }
    ];

    let latest: TemporalState | null = null;
    bus.on('temporal:updated', (state) => {
      latest = state;
    });

    temporal.setTokens(tokens);
    temporal.updateTransport({ timeMs: 1500, bpm: 60, beatUnit: 4 });

    expect(latest?.currentTokenIndex).toBe(1);

    temporal.advanceToNextPlayable();
    expect(latest?.currentTokenIndex).toBe(2);
  });
});
