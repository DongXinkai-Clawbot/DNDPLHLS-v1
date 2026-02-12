import type { NodeShape } from '../types';
import { getDeviceCapabilities } from './capabilities';
import { getPerformancePolicy } from './performancePolicy';

export const isMobile = () => getDeviceCapabilities().isMobile;

export const isLowEndDevice = () => {
    const caps = getDeviceCapabilities();
    if (!caps.isMobile) return false;
    if (caps.deviceMemoryGb !== null && caps.deviceMemoryGb < 1) return true;
    if (caps.hardwareConcurrency !== null && caps.hardwareConcurrency <= 2) return true;
    return caps.isLowEndMobile;
};

export const getMobileOptimizedSettings = () => {
    const policy = getPerformancePolicy();
    return {
        maxNodes: policy.maxNodes,
        enableFog: policy.render.enableFog,
        nodeShape: policy.render.nodeShape as NodeShape,
        lineRenderingMode: policy.render.lineRenderingMode,
        maxPolyphony: policy.maxPolyphony,
        sampleRate: policy.sampleRate,
        enableGC: true,
        memoryCheckInterval: policy.memoryCheckIntervalMs,
    };
};
