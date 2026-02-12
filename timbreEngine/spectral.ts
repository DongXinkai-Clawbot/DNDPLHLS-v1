type SpectralFreezeSettings = {
  enabled: boolean;
  freeze: boolean;
  smear: number;
  mix: number;
};

export const createSpectralFreezeNode = (_ctx: AudioContext, settings: SpectralFreezeSettings) => {
  if (!settings.enabled) return null;
  return null;
};
