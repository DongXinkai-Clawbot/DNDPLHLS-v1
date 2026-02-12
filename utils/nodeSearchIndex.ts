import type { NodeData, NodeSearchIndex } from '../types';
import { formatRatio } from '../musicLogic';

const normalize = (value: string) => value.toLowerCase().trim();

const tokenize = (value: string) =>
  value
    .split(/[^a-z0-9/.:+-]+/i)
    .map((t) => t.trim())
    .filter(Boolean);

const lowerBound = (arr: { cents: number; index: number }[], target: number) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].cents < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

export const buildNodeSearchIndex = (nodes: NodeData[]): NodeSearchIndex => {
  const searchText: string[] = new Array(nodes.length);
  const tokenIndex = new Map<string, number[]>();
  const exactIndex = new Map<string, number[]>();
  const centsSorted = nodes.map((node, index) => ({ cents: node.cents, index }));

  nodes.forEach((node, index) => {
    const name = normalize(node.name || '');
    const ratio = normalize(formatRatio(node.ratio));
    const combined = `${name} ${ratio}`.trim();
    searchText[index] = combined;

    const tokens = new Set<string>();
    tokenize(name).forEach((t) => tokens.add(t));
    tokenize(ratio).forEach((t) => tokens.add(t));
    if (name) tokens.add(name);
    if (ratio) tokens.add(ratio);

    tokens.forEach((token) => {
      const list = tokenIndex.get(token);
      if (list) list.push(index);
      else tokenIndex.set(token, [index]);
    });

    if (name) {
      const list = exactIndex.get(name);
      if (list) list.push(index);
      else exactIndex.set(name, [index]);
    }
    if (ratio) {
      const list = exactIndex.get(ratio);
      if (list) list.push(index);
      else exactIndex.set(ratio, [index]);
    }
  });

  centsSorted.sort((a, b) => a.cents - b.cents);

  return {
    version: 1,
    nodes,
    searchText,
    tokenIndex,
    exactIndex,
    centsSorted
  };
};

const pickClosestByCents = (index: NodeSearchIndex, target: number, limit: number) => {
  if (index.centsSorted.length === 0) return [];
  const sorted = index.centsSorted;
  let right = lowerBound(sorted, target);
  let left = right - 1;
  const results: number[] = [];

  while (results.length < limit && (left >= 0 || right < sorted.length)) {
    const leftItem = left >= 0 ? sorted[left] : null;
    const rightItem = right < sorted.length ? sorted[right] : null;

    if (!rightItem || (leftItem && Math.abs(leftItem.cents - target) <= Math.abs(rightItem.cents - target))) {
      results.push(leftItem!.index);
      left -= 1;
    } else {
      results.push(rightItem.index);
      right += 1;
    }
  }

  return results;
};

export const searchNodeIndex = (index: NodeSearchIndex | null | undefined, query: string, limit = 10): NodeData[] => {
  if (!index) return [];
  const raw = query ?? '';
  const q = normalize(raw);
  if (!q) return [];

  const isNumeric = !Number.isNaN(parseFloat(q)) && !q.includes('/') && !q.includes(':');
  if (isNumeric) {
    const target = parseFloat(q);
    const hits = pickClosestByCents(index, target, limit);
    return hits.map((i) => index.nodes[i]).filter(Boolean);
  }

  const exact = index.exactIndex.get(q);
  if (exact && exact.length > 0) {
    return exact.slice(0, limit).map((i) => index.nodes[i]).filter(Boolean);
  }

  const tokens = tokenize(q);
  const tokenHits = new Map<number, number>();
  tokens.forEach((token) => {
    const list = index.tokenIndex.get(token);
    if (!list) return;
    list.forEach((idx) => {
      tokenHits.set(idx, (tokenHits.get(idx) || 0) + 1);
    });
  });

  let candidateIndices: number[] = [];
  if (tokenHits.size > 0) {
    const required = Math.max(1, tokens.length);
    candidateIndices = Array.from(tokenHits.entries())
      .filter(([, count]) => count >= required)
      .map(([idx]) => idx);
    if (candidateIndices.length === 0) {
      candidateIndices = Array.from(tokenHits.keys());
    }
  }

  if (candidateIndices.length === 0) {
    const results: NodeData[] = [];
    for (let i = 0; i < index.searchText.length; i += 1) {
      if (index.searchText[i].includes(q)) {
        results.push(index.nodes[i]);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  const filtered = candidateIndices.filter((idx) => index.searchText[idx].includes(q));
  filtered.sort((a, b) => index.searchText[a].length - index.searchText[b].length);
  return filtered.slice(0, limit).map((i) => index.nodes[i]).filter(Boolean);
};
