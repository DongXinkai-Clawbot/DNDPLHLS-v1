import type { AppSettings, NodeData } from '../types';
import { getNoteName } from '../musicLogic';

const buildAccidentalKey = (
  vector: NodeData['primeVector'],
  symbols: AppSettings['notationSymbols'],
  placement: AppSettings['accidentalPlacement']
) => {
  const primes = [5, 7, 11, 13, 17, 19, 23, 29, 31] as const;
  let leftStr = '';
  let rightStr = '';
  for (const p of primes) {
    const count = vector[p];
    if (!count) continue;
    const sym = symbols[p] || { up: '', down: '' };
    const absCount = Math.abs(count);
    let char = count > 0 ? sym.up : sym.down;
    let effectivePlacement = sym.placement || placement;
    if (p === 5 && count < 0) {
      char = '+';
      effectivePlacement = 'right';
    }
    if (!char) continue;
    const token = absCount >= 8 ? `${char}(${absCount})` : char.repeat(absCount);
    if (effectivePlacement === 'left') {
      leftStr = token + leftStr;
    } else if (effectivePlacement === 'right') {
      rightStr += token;
    } else {
      if (count > 0) rightStr += token;
      else leftStr = token + leftStr;
    }
  }
  return `${leftStr}${rightStr}`;
};

const normalizeNoteKey = (value: string) => value.replace(/\s+/g, '').toLowerCase();

export const getNoteKey = (node: NodeData, settings: AppSettings, mode: 'full' | 'accidental') => {
  if (mode === 'full') {
    const name = node.name || getNoteName(node.primeVector, settings.notationSymbols, settings.accidentalPlacement);
    return normalizeNoteKey(name) || 'default';
  }
  const accidental = buildAccidentalKey(node.primeVector, settings.notationSymbols, settings.accidentalPlacement);
  return normalizeNoteKey(accidental || 'default');
};
