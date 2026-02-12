import { PairContribution } from './roughnessCore';
import { MinimaPoint, Suggestion } from './types';

const bitToTone = (mask: number) => {
  const tones: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (mask & (1 << i)) tones.push(i);
  }
  return tones;
};

export const buildTimbreSuggestions = (
  topPairs: PairContribution[],
  baseFreq: number
): Suggestion[] => {
  if (!topPairs.length) return [];
  const cross: PairContribution[] = [];
  const self: PairContribution[] = [];
  topPairs.forEach(p => {
    const tones1 = bitToTone(p.toneMask1);
    const tones2 = bitToTone(p.toneMask2);
    const crossTone = tones1.some(t1 => tones2.some(t2 => t1 !== t2));
    if (crossTone) cross.push(p);
    else self.push(p);
  });

  const suggestions: Suggestion[] = [];
  if (cross.length) {
    const example = cross[0];
    const ratio1 = example.f1 / baseFreq;
    const ratio2 = example.f2 / baseFreq;
    suggestions.push({
      title: 'Cross-tone roughness dominates',
      details: [
        `Reduce or rebalance partials near ratios ${ratio1.toFixed(3)} and ${ratio2.toFixed(3)}.`,
        `Try trimming partial indices around ${example.partialIndex1} and ${example.partialIndex2} by 10-15%.`,
        'If the ratio is close to a target consonance, consider boosting the aligned partial instead.'
      ]
    });
  }
  if (self.length) {
    const example = self[0];
    const ratio1 = example.f1 / baseFreq;
    const ratio2 = example.f2 / baseFreq;
    suggestions.push({
      title: 'Intra-tone roughness dominates',
      details: [
        `Reduce adjacent partials near ratios ${ratio1.toFixed(3)} and ${ratio2.toFixed(3)}.`,
        `Increase high-partial decay above index ${Math.max(example.partialIndex1, example.partialIndex2)}.`,
        'Recompute terrain after adjustments to confirm valleys deepen.'
      ]
    });
  }
  return suggestions;
};

export const buildScaleFromMinima = (
  minima: MinimaPoint[],
  rootRatio: number,
  maxCount: number
) => {
  const ratios = minima
    .flatMap(m => [m.x, m.y])
    .filter(r => Number.isFinite(r) && r >= 1 && r <= 2)
    .sort((a, b) => a - b);

  const unique: number[] = [];
  ratios.forEach(r => {
    const last = unique[unique.length - 1];
    if (last === undefined || Math.abs(Math.log2(r / last)) > 1e-4) {
      unique.push(r);
    }
  });

  const withRoot = unique.includes(rootRatio) ? unique : [rootRatio, ...unique];
  return withRoot.slice(0, Math.max(2, maxCount));
};

