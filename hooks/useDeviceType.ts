import { useEffect, useState } from 'react';
import { getDeviceCapabilities } from '../utils/capabilities';

const getSnapshot = () => {
  if (typeof window === 'undefined') {
    return {
      isMobile: false,
      isLandscape: false,
      category: 'desktop' as const,
      input: 'fine' as const,
      runtime: 'web' as const,
      isLowEnd: false,
      isLowEndMobile: false,
      deviceMemoryGb: null as number | null,
      hardwareConcurrency: null as number | null,
      maxTouchPoints: 0,
      isNativeAndroid: false,
      isNativePlatform: false,
      nativePlatform: 'web' as const,
      isOnline: true,
      userAgent: ''
    };
  }

  const caps = getDeviceCapabilities();
  const isLandscape = window.innerWidth > window.innerHeight;
  return { ...caps, isLandscape };
};

export const useDeviceType = () => {
  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setState(getSnapshot());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
};
