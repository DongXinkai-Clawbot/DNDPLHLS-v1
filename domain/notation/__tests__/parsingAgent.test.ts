import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import { NotationParsingAgent } from '../agents/NotationParsingAgent';

describe('NotationParsingAgent', () => {
  test('parses tokens and preserves source text', () => {
    const bus = new NotationEventBus<NotationEvents>();
    const parser = new NotationParsingAgent(bus);
    const text = '#1..- 0 | [3 4] (5_6) R';
    const stream = parser.parse(text);

    expect(stream.tokens.map(t => t.symbol).join('')).toBe(text);

    const note = stream.tokens.find(t => t.symbol.startsWith('#1'))!;
    expect(note.degree).toBe(1);
    expect(note.accidental).toBe('sharp');
    expect(note.octaveOffset).toBe(2);
    expect(note.durationUnit).toBe(2);

    const rest = stream.tokens.find(t => t.symbol === '0')!;
    expect(rest.isRest).toBe(true);
    expect(rest.durationUnit).toBe(1);

    const chordStart = stream.tokens.find(t => t.symbol === '[')!;
    expect(chordStart.grouping).toBe('chord');
    expect(chordStart.groupRole).toBe('start');
  });
});
