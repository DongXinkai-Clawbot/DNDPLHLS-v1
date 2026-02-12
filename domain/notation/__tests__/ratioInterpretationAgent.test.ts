import { createFraction } from '../../../musicLogic';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import { RatioInterpretationAgent } from '../agents/RatioInterpretationAgent';
import type { NotationToken, RatioContext, RatioDescriptor } from '../types';

describe('RatioInterpretationAgent', () => {
  test('maps tokens into ratio descriptors', () => {
    const bus = new NotationEventBus<NotationEvents>();
    const context: RatioContext = {
      tonic: createFraction(1n, 1n),
      scaleMap: {
        1: createFraction(1n, 1n),
        5: createFraction(3n, 2n)
      },
      accidentalRatios: {
        sharp: createFraction(25n, 24n),
        flat: createFraction(24n, 25n)
      },
      octaveRatio: createFraction(2n, 1n)
    };

    const tokens: NotationToken[] = [
      {
        tokenId: 't1',
        symbol: 'b5,',
        degree: 5,
        accidental: 'flat',
        octaveOffset: -1,
        durationUnit: 1,
        isRest: false,
        grouping: null,
        sourceRange: { start: 0, end: 2 }
      },
      {
        tokenId: 't2',
        symbol: '0',
        degree: null,
        accidental: 'none',
        octaveOffset: 0,
        durationUnit: 1,
        isRest: true,
        grouping: null,
        sourceRange: { start: 2, end: 3 }
      }
    ];

    let latest: RatioDescriptor[] = [];
    bus.on('ratios:updated', (ratios) => {
      latest = ratios;
    });

    const agent = new RatioInterpretationAgent(bus, context);
    agent.setTokens(tokens);

    expect(latest).toHaveLength(2);
    expect(latest[0].finalRatio?.n).toBe(18n);
    expect(latest[0].finalRatio?.d).toBe(25n);
    expect(latest[0].resolvability).toBe('resolved');
    expect(latest[1].resolvability).toBe('unresolved');
  });
});
