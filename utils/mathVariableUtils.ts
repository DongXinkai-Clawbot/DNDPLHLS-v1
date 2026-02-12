import type { MathObjectType } from '../types';
import { tokenize, Token } from './safeMath';

const RESERVED = new Set(['x', 'y', 't', 'theta', 'pi', 'e', 'tau', 'phi']);

const isFunctionCall = (tokens: Token[], idx: number) => {
  const next = tokens[idx + 1];
  return next?.type === 'LPAREN';
};

export const extractVariables = (expression: string, type?: MathObjectType): string[] => {
  if (!expression || typeof expression !== 'string') return [];
  const tokens = tokenize(expression);
  const vars = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== 'ID' || !tok.value) continue;
    const name = tok.value;
    if (RESERVED.has(name)) continue;
    if (isFunctionCall(tokens, i)) continue;
    vars.add(name);
  }
  if (type === 'parametric') {
    vars.delete('t');
  } else if (type === 'polar') {
    vars.delete('theta');
  } else if (type === 'explicit' || type === 'implicit' || type === 'vector_field') {
    vars.delete('x');
    vars.delete('y');
  }
  return Array.from(vars);
};

export const getBindingsSubset = (bindings: Record<string, number>, variables: string[]) => {
  const subset: Record<string, number> = {};
  variables.forEach((v) => {
    if (bindings[v] !== undefined) subset[v] = bindings[v];
  });
  return subset;
};
