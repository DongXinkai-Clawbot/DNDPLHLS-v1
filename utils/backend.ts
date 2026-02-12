import { getDeviceCapabilities } from './capabilities';

export type UploadAvailability = {
  canUpload: boolean;
  reason: string | null;
  isOnline: boolean;
  protocol: string | null;
  isNative: boolean;
  envEnabled: boolean;
};

export const getJndUploadAvailability = (): UploadAvailability => {
  const caps = getDeviceCapabilities();
  const protocol = typeof window !== 'undefined' ? window.location.protocol : null;
  const isHttp = protocol === 'http:' || protocol === 'https:';
  const envEnabled = import.meta.env.VITE_ENABLE_JND_UPLOAD !== 'false';

  if (!envEnabled) {
    return { canUpload: false, reason: 'Uploads disabled by build config.', isOnline: caps.isOnline, protocol, isNative: caps.isNativePlatform, envEnabled };
  }
  if (!isHttp) {
    return { canUpload: false, reason: 'Uploads require http/https.', isOnline: caps.isOnline, protocol, isNative: caps.isNativePlatform, envEnabled };
  }
  if (caps.isNativePlatform) {
    return { canUpload: false, reason: 'Native builds do not include the upload backend.', isOnline: caps.isOnline, protocol, isNative: caps.isNativePlatform, envEnabled };
  }
  if (!caps.isOnline) {
    return { canUpload: false, reason: 'Offline mode.', isOnline: caps.isOnline, protocol, isNative: caps.isNativePlatform, envEnabled };
  }
  return { canUpload: true, reason: null, isOnline: caps.isOnline, protocol, isNative: caps.isNativePlatform, envEnabled };
};
