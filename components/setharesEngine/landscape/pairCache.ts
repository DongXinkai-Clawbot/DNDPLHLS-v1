type PairIndexCache = {
  i: Int32Array;
  j: Int32Array;
};

const cache = new Map<number, PairIndexCache>();

export const getPairIndices = (count: number): PairIndexCache => {
  const n = Math.max(0, Math.floor(count));
  const cached = cache.get(n);
  if (cached) return cached;
  const total = (n * (n - 1)) / 2;
  const i = new Int32Array(total);
  const j = new Int32Array(total);
  let k = 0;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      i[k] = a;
      j[k] = b;
      k += 1;
    }
  }
  const entry = { i, j };
  cache.set(n, entry);
  return entry;
};

export const clearPairCache = () => {
  cache.clear();
};
