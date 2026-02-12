import {
  calculateCents,
  createFraction,
  getPrimeVectorFromRatio,
  getTETCents,
  hasUnsupportedFactors,
  multiply,
  simplify
} from '../../../musicLogic';
import { DEFAULT_RATIO_CONTEXT } from '../defaults';
import { NotationEventBus } from '../eventBus';
import type { NotationEvents } from '../events';
import type { NotationToken, RatioContext, RatioDescriptor } from '../types';

export class RatioInterpretationAgent {
  private bus: NotationEventBus<NotationEvents>;
  private context: RatioContext;
  private tokens: NotationToken[] = [];

  constructor(bus: NotationEventBus<NotationEvents>, context: RatioContext = DEFAULT_RATIO_CONTEXT) {
    this.bus = bus;
    this.context = context;

    this.bus.on('tokens:updated', (stream) => {
      this.tokens = stream.tokens;
      this.recompute();
    });

    this.bus.on('ratio-context:updated', (ctx) => {
      this.context = ctx;
      this.recompute();
    });
  }

  setContext(context: RatioContext): void {
    this.context = context;
    this.recompute();
  }

  setTokens(tokens: NotationToken[]): void {
    this.tokens = tokens;
    this.recompute();
  }

  private recompute(): void {
    const descriptors = this.tokens.map((token, index) => this.buildDescriptor(token, index));
    this.bus.emit('ratios:updated', descriptors);
  }

  private buildDescriptor(token: NotationToken, index: number): RatioDescriptor {
    const baseRatio = token.degree ? this.context.scaleMap[token.degree] : null;
    if (!baseRatio || token.isRest) {
      return {
        tokenId: token.tokenId,
        tokenIndex: index,
        baseRatio: baseRatio ?? null,
        accidentalRatio: null,
        octaveRatio: null,
        finalRatio: null,
        simplifiedRatio: null,
        primeFactors: null,
        relativeCents: null,
        latticeMapping: null,
        resolvability: 'unresolved'
      };
    }

    const accidentalRatio = this.getAccidentalRatio(token.accidental);
    const octaveRatio = this.powFraction(this.context.octaveRatio, token.octaveOffset);
    const finalRatio = simplify(
      multiply(multiply(multiply(this.context.tonic, baseRatio), accidentalRatio), octaveRatio)
    );
    const simplifiedRatio = simplify(finalRatio);

    const unsupported = hasUnsupportedFactors(simplifiedRatio.n, simplifiedRatio.d);
    const primeFactors = getPrimeVectorFromRatio(simplifiedRatio.n, simplifiedRatio.d);
    const cents = calculateCents(simplifiedRatio);
    const relativeCents = cents - getTETCents(cents, 12);

    return {
      tokenId: token.tokenId,
      tokenIndex: index,
      baseRatio,
      accidentalRatio,
      octaveRatio,
      finalRatio,
      simplifiedRatio,
      primeFactors,
      relativeCents,
      latticeMapping: unsupported ? null : { primeVector: primeFactors },
      resolvability: unsupported ? 'approximate' : 'resolved'
    };
  }

  private getAccidentalRatio(accidental: NotationToken['accidental']) {
    if (accidental === 'sharp') return this.context.accidentalRatios.sharp;
    if (accidental === 'flat') return this.context.accidentalRatios.flat;
    return createFraction(1n, 1n);
  }

  private powFraction(base: { n: bigint; d: bigint }, exp: number) {
    if (exp === 0) return createFraction(1n, 1n);
    const absExp = BigInt(Math.abs(exp));
    const num = base.n ** absExp;
    const den = base.d ** absExp;
    if (exp > 0) return simplify({ n: num, d: den });
    return simplify({ n: den, d: num });
  }
}
