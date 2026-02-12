export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roundTo = (value: number, decimals = 3) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

export const sum = (values: number[]) => values.reduce((acc, v) => acc + v, 0);

export const stableSort = <T>(items: T[], compare: (a: T, b: T) => number): T[] => {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const res = compare(a.item, b.item);
      return res !== 0 ? res : a.index - b.index;
    })
    .map(({ item }) => item);
};

export const uniqSorted = (values: number[]) => {
  const set = new Set(values);
  return Array.from(set.values()).sort((a, b) => a - b);
};
