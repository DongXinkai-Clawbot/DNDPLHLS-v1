type Disposable = () => void;

const registry = new Map<string, Disposable>();

export const registerGlobalDisposable = (key: string, setup: () => Disposable | void) => {
  const existing = registry.get(key);
  if (existing) {
    try {
      existing();
    } catch {}
  }
  const dispose = setup() || (() => {});
  registry.set(key, dispose);
  return dispose;
};

export const disposeGlobalDisposable = (key: string) => {
  const existing = registry.get(key);
  if (!existing) return;
  try {
    existing();
  } finally {
    registry.delete(key);
  }
};

export const disposeAllGlobalDisposables = () => {
  registry.forEach((dispose) => {
    try {
      dispose();
    } catch {}
  });
  registry.clear();
};
