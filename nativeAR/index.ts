import { registerPlugin } from '@capacitor/core';

import type { NativeArPlugin } from './types';

export const NativeAR = registerPlugin<NativeArPlugin>('NativeAR', {
  web: () => import('./web').then((m) => m.NativeARWeb),
});

export * from './types';
