import { Capacitor } from '@capacitor/core';

export type DeviceCategory = 'desktop' | 'tablet' | 'phone';
export type PointerMode = 'fine' | 'coarse';
export type RuntimeContainer = 'web' | 'native';

export type DeviceCapabilities = {
  userAgent: string;
  category: DeviceCategory;
  input: PointerMode;
  runtime: RuntimeContainer;
  isMobile: boolean;
  isLowEndMobile: boolean;
  isLowEnd: boolean;
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  maxTouchPoints: number;
  isNativeAndroid: boolean;
  isNativePlatform: boolean;
  nativePlatform: 'android' | 'ios' | 'web' | 'unknown';
  isOnline: boolean;
};

export const getUserAgent = () => {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
};

export const isNativeAndroid = () => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

const getNativePlatform = (): DeviceCapabilities['nativePlatform'] => {
  try {
    if (Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      if (platform === 'android' || platform === 'ios') return platform;
      return 'unknown';
    }
  } catch {
    return 'unknown';
  }
  return 'web';
};

const getViewport = () => {
  if (typeof window === 'undefined') return { width: 1024, height: 768 };
  return { width: window.innerWidth, height: window.innerHeight };
};

const getPointerMode = (maxTouchPoints: number) => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(pointer: coarse)').matches) return 'coarse';
  }
  if (maxTouchPoints > 0) return 'coarse';
  return 'fine';
};

export const classifyDeviceCategory = (input: {
  width: number;
  height: number;
  pointer: PointerMode;
  isNativePlatform: boolean;
}) => {
  const minDim = Math.min(input.width, input.height);
  if (minDim <= 760) return 'phone';
  if ((input.pointer === 'coarse' || input.isNativePlatform) && minDim <= 1024) return 'tablet';
  return 'desktop';
};

export const estimateLowEnd = (input: {
  deviceMemoryGb: number | null;
  hardwareConcurrency: number | null;
  category: DeviceCategory;
  minDim: number;
}) => {
  if (input.deviceMemoryGb !== null && input.deviceMemoryGb <= 2) return true;
  if (input.hardwareConcurrency !== null && input.hardwareConcurrency <= 2) return true;
  if (input.category === 'phone' && input.minDim <= 480) return true;
  return false;
};

export const getDeviceCapabilities = (): DeviceCapabilities => {
  const ua = getUserAgent();
  const { width, height } = getViewport();
  const minDim = Math.min(width, height);
  const deviceMemoryGb = typeof navigator !== 'undefined' && 'deviceMemory' in navigator
    ? Number((navigator as any).deviceMemory)
    : null;
  const hardwareConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? Number(navigator.hardwareConcurrency)
    : null;
  const maxTouchPoints = typeof navigator !== 'undefined' && Number.isFinite(navigator.maxTouchPoints)
    ? navigator.maxTouchPoints
    : 0;
  const isNativePlatform = (() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();
  const pointer = getPointerMode(maxTouchPoints);
  const category = classifyDeviceCategory({ width, height, pointer, isNativePlatform });
  const isLowEnd = estimateLowEnd({ deviceMemoryGb, hardwareConcurrency, category, minDim });

  return {
    userAgent: ua,
    category,
    input: pointer,
    runtime: isNativePlatform ? 'native' : 'web',
    isMobile: category !== 'desktop',
    isLowEnd,
    isLowEndMobile: category !== 'desktop' && isLowEnd,
    deviceMemoryGb,
    hardwareConcurrency,
    maxTouchPoints,
    isNativeAndroid: isNativeAndroid(),
    isNativePlatform,
    nativePlatform: getNativePlatform(),
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
};

export const isMobileDevice = () => getDeviceCapabilities().isMobile;
