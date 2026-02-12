export const parseNum = (value: string, fallback: number) => {
  const v = parseFloat(value);
  return Number.isFinite(v) ? v : fallback;
};

export const parseOptional = (value: string) => {
  const v = parseFloat(value);
  return Number.isFinite(v) ? v : undefined;
};

export const parseOptionalInt = (value: string) => {
  const v = parseInt(value, 10);
  return Number.isFinite(v) ? v : undefined;
};
