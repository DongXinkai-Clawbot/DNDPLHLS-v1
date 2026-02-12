import { DEFAULT_PARSING_RULES } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type {
  Accidental,
  GroupRole,
  GroupingType,
  NotationToken,
  ParsingRules,
  TokenStream
} from '../types';

const isWhitespace = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

export class NotationParsingAgent {
  private bus: NotationEventBus<NotationEvents>;
  private rules: ParsingRules;
  private tokenCounter = 0;
  private groupCounters: Record<'bar' | 'tie' | 'chord', number> = { bar: 0, tie: 0, chord: 0 };
  private sessionId = Math.random().toString(36).slice(2, 8);

  constructor(bus: NotationEventBus<NotationEvents>, rules: ParsingRules = DEFAULT_PARSING_RULES) {
    this.bus = bus;
    this.rules = rules;
  }

  setRules(rules: ParsingRules): void {
    this.rules = rules;
  }

  parse(text: string, rulesOverride?: Partial<ParsingRules>): TokenStream {
    const rules = this.resolveRules(rulesOverride);
    const tokens: NotationToken[] = [];
    const chordStack: string[] = [];
    const tieStack: string[] = [];

    let i = 0;
    while (i < text.length) {
      const ch = text[i];

      if (isWhitespace(ch)) {
        tokens.push(this.createToken(text, i, i + 1, ch, null, false, 0, 0, null, null, null));
        i += 1;
        continue;
      }

      const groupingHit = this.handleGrouping(text, i, rules, chordStack, tieStack);
      if (groupingHit) {
        tokens.push(groupingHit.token);
        i = groupingHit.nextIndex;
        continue;
      }

      const noteHit = this.handleNote(text, i, rules, chordStack, tieStack);
      if (noteHit) {
        tokens.push(noteHit.token);
        i = noteHit.nextIndex;
        continue;
      }

      tokens.push(this.createToken(text, i, i + 1, ch, null, false, 0, 0, null, null, null));
      i += 1;
    }

    const stream = { sourceText: text, tokens };
    this.bus.emit('tokens:updated', stream);
    return stream;
  }

  private resolveRules(override?: Partial<ParsingRules>): ParsingRules {
    if (!override) return this.rules;
    return {
      ...this.rules,
      ...override,
      accidentalSymbols: { ...this.rules.accidentalSymbols, ...(override.accidentalSymbols ?? {}) },
      octaveSymbols: { ...this.rules.octaveSymbols, ...(override.octaveSymbols ?? {}) },
      groupingSymbols: { ...this.rules.groupingSymbols, ...(override.groupingSymbols ?? {}) }
    };
  }

  private nextTokenId(): string {
    this.tokenCounter += 1;
    return `tok-${this.sessionId}-${this.tokenCounter}`;
  }

  private nextGroupId(type: 'bar' | 'tie' | 'chord'): string {
    this.groupCounters[type] += 1;
    return `${type}-${this.sessionId}-${this.groupCounters[type]}`;
  }

  private createToken(
    text: string,
    start: number,
    end: number,
    symbol: string,
    degree: number | null,
    isRest: boolean,
    octaveOffset: number,
    durationUnit: number,
    grouping: GroupingType,
    groupId: string | null,
    groupRole: GroupRole
  ): NotationToken {
    return {
      tokenId: this.nextTokenId(),
      symbol,
      degree,
      accidental: 'none',
      octaveOffset,
      durationUnit,
      isRest,
      grouping,
      groupId: groupId || undefined,
      groupRole: groupRole || undefined,
      sourceRange: { start, end }
    };
  }

  private handleGrouping(
    text: string,
    index: number,
    rules: ParsingRules,
    chordStack: string[],
    tieStack: string[]
  ): { token: NotationToken; nextIndex: number } | null {
    const ch = text[index];
    const start = index;
    const end = index + 1;

    if (rules.groupingSymbols.bar.includes(ch)) {
      const groupId = this.nextGroupId('bar');
      const token = this.createToken(text, start, end, ch, null, false, 0, 0, 'bar', groupId, 'marker');
      return { token, nextIndex: end };
    }

    if (rules.groupingSymbols.chordStart.includes(ch)) {
      const groupId = this.nextGroupId('chord');
      chordStack.push(groupId);
      const token = this.createToken(text, start, end, ch, null, false, 0, 0, 'chord', groupId, 'start');
      return { token, nextIndex: end };
    }

    if (rules.groupingSymbols.chordEnd.includes(ch)) {
      const groupId = chordStack.pop() ?? this.nextGroupId('chord');
      const token = this.createToken(text, start, end, ch, null, false, 0, 0, 'chord', groupId, 'end');
      return { token, nextIndex: end };
    }

    if (rules.groupingSymbols.tieStart.includes(ch)) {
      const groupId = this.nextGroupId('tie');
      tieStack.push(groupId);
      const token = this.createToken(text, start, end, ch, null, false, 0, 0, 'tie', groupId, 'start');
      return { token, nextIndex: end };
    }

    if (rules.groupingSymbols.tieEnd.includes(ch)) {
      const groupId = tieStack.pop() ?? this.nextGroupId('tie');
      const token = this.createToken(text, start, end, ch, null, false, 0, 0, 'tie', groupId, 'end');
      return { token, nextIndex: end };
    }

    return null;
  }

  private handleNote(
    text: string,
    index: number,
    rules: ParsingRules,
    chordStack: string[],
    tieStack: string[]
  ): { token: NotationToken; nextIndex: number } | null {
    let i = index;
    let prefix = '';
    while (i < text.length && this.isAccidental(text[i], rules)) {
      prefix += text[i];
      i += 1;
    }

    const degreeIndex = i;
    if (degreeIndex >= text.length) return null;

    const degreeChar = text[degreeIndex];
    const isRest = rules.restSymbols.includes(degreeChar);
    let degree: number | null = null;
    let noteEnd = degreeIndex + 1;

    if (!isRest) {
      if (this.isDigit(degreeChar)) {
        let j = degreeIndex;
        while (j < text.length && this.isDigit(text[j])) j += 1;
        const numStr = text.slice(degreeIndex, j);
        const mapped = rules.degreeSymbols[numStr];
        const parsed = Number.parseInt(numStr, 10);
        if (Number.isFinite(mapped)) {
          degree = mapped;
        } else if (Number.isFinite(parsed)) {
          degree = parsed;
        }
        noteEnd = j;
      } else if (degreeChar in rules.degreeSymbols) {
        degree = rules.degreeSymbols[degreeChar];
      }
    }

    if (!isRest && (!degree || degree <= 0)) {
      return null;
    }

    let accidental = this.accidentalFromSymbols(prefix, rules);
    let suffix = '';
    i = noteEnd;

    if (!prefix && (rules.accidentalPlacement === 'after' || rules.accidentalPlacement === 'either')) {
      while (i < text.length && this.isAccidental(text[i], rules)) {
        suffix += text[i];
        i += 1;
      }
      if (suffix) {
        accidental = this.accidentalFromSymbols(suffix, rules);
      }
    }

    let octaveOffset = 0;
    while (i < text.length && this.isOctaveSymbol(text[i], rules)) {
      if (rules.octaveSymbols.up.includes(text[i])) octaveOffset += 1;
      if (rules.octaveSymbols.down.includes(text[i])) octaveOffset -= 1;
      i += 1;
    }

    let sustainCount = 0;
    while (i < text.length && rules.sustainSymbols.includes(text[i])) {
      sustainCount += 1;
      i += 1;
    }

    const durationUnit = 1 + sustainCount;
    const symbol = text.slice(index, i);
    const grouping = chordStack.length > 0 ? 'chord' : tieStack.length > 0 ? 'tie' : null;
    const groupId = chordStack[chordStack.length - 1] ?? tieStack[tieStack.length - 1] ?? null;
    const groupRole: GroupRole = grouping ? 'member' : null;

    const token: NotationToken = {
      tokenId: this.nextTokenId(),
      symbol,
      degree: isRest ? null : degree,
      accidental: isRest ? 'none' : accidental,
      octaveOffset,
      durationUnit,
      isRest,
      grouping,
      groupId: groupId || undefined,
      groupRole: groupRole || undefined,
      sourceRange: { start: index, end: i }
    };

    return { token, nextIndex: i };
  }

  private isAccidental(ch: string, rules: ParsingRules): boolean {
    return rules.accidentalSymbols.sharp.includes(ch) || rules.accidentalSymbols.flat.includes(ch);
  }

  private isOctaveSymbol(ch: string, rules: ParsingRules): boolean {
    return rules.octaveSymbols.up.includes(ch) || rules.octaveSymbols.down.includes(ch);
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private accidentalFromSymbols(symbols: string, rules: ParsingRules): Accidental {
    const chars = symbols.split('');
    const hasSharp = chars.some(c => rules.accidentalSymbols.sharp.includes(c));
    const hasFlat = chars.some(c => rules.accidentalSymbols.flat.includes(c));
    if (hasSharp && !hasFlat) return 'sharp';
    if (hasFlat && !hasSharp) return 'flat';
    return 'none';
  }
}
