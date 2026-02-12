import { pulseWaveCache, sampleCache } from './cache';
import { createLogger } from '../../utils/logger';
import { getPerformancePolicy } from '../../utils/performancePolicy';
import { registerGlobalDisposable } from '../../utils/resourceRegistry';

const log = createLogger('audio/context');

let audioCtx: AudioContext | null = null;
let masterDestination: MediaStreamAudioDestinationNode | null = null;
let masterBus: GainNode | null = null;
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let recordingMimeType: string | null = null;
let recordingError: string | null = null;
let audioContextInitRetries = 0;
const MAX_AUDIO_INIT_RETRIES = 3; // Prevent infinite retry loops

const audioProfile = {
  isMobile: false,
  maxPolyphony: 64,
  unisonMax: 8,
};

const SILENT_AUDIO_URI =
  'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMD//////////////////////////////////////////////////////////////////wAAAAAAMA==';

export const initAudio = () => {
  if (!audioCtx) {
    try {
      const policy = getPerformancePolicy();
      const isMobile = policy.tier === 'low' || policy.tier === 'safe';
      audioProfile.isMobile = isMobile;
      audioProfile.maxPolyphony = policy.maxPolyphony;
      audioProfile.unisonMax = policy.unisonMax;

      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: policy.sampleRate,
        latencyHint: isMobile ? 'playback' : 'interactive',
      });

      if (isMobile) {
        (audioCtx as any).maxNodes = 32;

        if ('memory' in performance) {
          const checkAudioMemory = () => {
            const memInfo = (performance as any).memory;
            if (memInfo && memInfo.usedJSHeapSize > memInfo.jsHeapSizeLimit * 0.8) {
              Object.keys(sampleCache).forEach((key) => {
                delete sampleCache[key];
              });
              pulseWaveCache.clear();
              log.warn('Memory cleanup performed');
            }
          };
          registerGlobalDisposable('audio:memory-check', () => {
            const intervalId = window.setInterval(checkAudioMemory, policy.memoryCheckIntervalMs);
            return () => window.clearInterval(intervalId);
          });
        }
      }

      masterDestination = audioCtx.createMediaStreamDestination();
      masterBus = audioCtx.createGain();
      masterBus.gain.value = 1;
      masterBus.connect(audioCtx.destination);
      masterBus.connect(masterDestination);
    } catch (error) {
      log.error('Failed to initialize AudioContext', error);

      if (isMobile) {
        log.warn('Using fallback audio context for mobile');
        try {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          masterDestination = audioCtx.createMediaStreamDestination();
          masterBus = audioCtx.createGain();
          masterBus.gain.value = 1;
          masterBus.connect(audioCtx.destination);
          masterBus.connect(masterDestination);
        } catch (fallbackError) {
          log.error('Fallback also failed', fallbackError);
          return null;
        }
      } else {
        throw error;
      }
    }
  }
  return audioCtx;
};

export const getAudioContext = () => initAudio();

export const peekAudioContext = () => audioCtx;

export const getMasterDestination = () => masterDestination;
export const getMasterBus = () => masterBus;
export const getAudioProfile = () => audioProfile;
export const getRecordingMimeType = () => recordingMimeType;

export const registerSample = async (name: string, arrayBuffer: ArrayBuffer) => {
  const ctx = initAudio();
  try {
    sampleCache[name] = await ctx.decodeAudioData(arrayBuffer);
    return true;
  } catch (e) {
    return false;
  }
};

export const unlockAudioContext = () => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = initAudio();
  if (!ctx) return;

  const policy = getPerformancePolicy();
  const isMobile = policy.tier === 'low' || policy.tier === 'safe';

  const resumeAndPlaySilent = () => {
    try {
      const sampleRate = isMobile ? Math.min(ctx.sampleRate, policy.sampleRate) : policy.sampleRate;
      const buffer = ctx.createBuffer(1, 1, sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      if (source.start) source.start(0);
      else (source as any).noteOn(0);

      if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
        const resumePromise = ctx.resume();

        if (isMobile) {
          Promise.race([
            resumePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Resume timeout')), 3000)),
          ])
            .then(() => {
              log.info('AudioContext resumed via touch');
              audioContextInitRetries = 0; // Reset retry counter on success
            })
            .catch((error) => {
              log.warn('AudioContext resume failed', error);

              // Prevent infinite retry loops on mobile
              audioContextInitRetries++;
              if (audioContextInitRetries >= MAX_AUDIO_INIT_RETRIES) {
                log.error('AudioContext initialization exceeded max retries, giving up');
                return; // Don't retry anymore
              }

              audioCtx = null;
              masterDestination = null;
              setTimeout(() => {
                try {
                  initAudio();
                } catch (e) {
                  log.error('Failed to reinitialize audio', e);
                  audioContextInitRetries = MAX_AUDIO_INIT_RETRIES; // Mark as failed
                }
              }, 1000);
            });
        } else {
          resumePromise
            .then(() => {
              log.info('AudioContext resumed via touch');
              audioContextInitRetries = 0;
            })
            .catch((error) => {
              log.warn('AudioContext resume failed on desktop', error);
              audioContextInitRetries = MAX_AUDIO_INIT_RETRIES;
            });
        }
      }
    } catch (error) {
      log.error('Failed to unlock audio context', error);
      audioContextInitRetries++;
      if (audioContextInitRetries >= MAX_AUDIO_INIT_RETRIES) {
        audioCtx = null; // Give up
      }
    }
  };

  resumeAndPlaySilent();
};

const pickRecordingMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return null;
};

export const getRecordingSupport = () => {
  if (typeof MediaRecorder === 'undefined') {
    return { supported: false, mimeType: null, reason: 'MediaRecorder is not available in this browser.' };
  }
  const mimeType = pickRecordingMimeType();
  if (!mimeType) {
    return { supported: false, mimeType: null, reason: 'No compatible audio recording MIME type supported.' };
  }
  return { supported: true, mimeType, reason: null };
};

export const startRecording = (): { ok: boolean; error?: string; mimeType?: string } => {
  const ctx = initAudio();
  if (!ctx || !masterDestination) {
    const message = 'Audio context unavailable';
    log.warn(message);
    recordingError = message;
    return { ok: false, error: message };
  }
  recordedChunks = [];
  recordingError = null;
  const mimeType = pickRecordingMimeType();
  if (!mimeType) {
    const message = 'MediaRecorder unsupported or no compatible MIME type';
    log.warn(message);
    recordingError = message;
    return { ok: false, error: message };
  }
  try {
    recordingMimeType = mimeType;
    mediaRecorder = new MediaRecorder(masterDestination.stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => e.data.size > 0 && recordedChunks.push(e.data);
    mediaRecorder.onerror = (event) => {
      log.warn('MediaRecorder error', event);
      recordingError = 'MediaRecorder error';
    };
    mediaRecorder.start();
    return { ok: true, mimeType };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to start recording';
    log.warn('Failed to start recording', e);
    recordingError = message;
    return { ok: false, error: message };
  }
};

export const stopRecording = async (): Promise<Blob | null> => {
  return new Promise((resolve) => {
    if (!mediaRecorder) {
      if (recordedChunks.length > 0) {
        const type = recordingMimeType || 'audio/webm';
        const fallback = new Blob(recordedChunks, { type });
        recordedChunks = [];
        recordingMimeType = null;
        recordingError = null;
        return resolve(fallback);
      }
      return resolve(null);
    }
    if (mediaRecorder.state === 'inactive') {
      const type = recordingMimeType || mediaRecorder.mimeType || 'audio/webm';
      const b = recordedChunks.length > 0 ? new Blob(recordedChunks, { type }) : null;
      recordedChunks = [];
      recordingMimeType = null;
      recordingError = null;
      mediaRecorder = null;
      return resolve(b);
    }
    const timeout = setTimeout(() => {
      log.warn('MediaRecorder stop timeout');
      recordedChunks = [];
      recordingMimeType = null;
      recordingError = 'Recording stop timeout';
      mediaRecorder = null;
      resolve(null);
    }, 2000);
    mediaRecorder.onstop = () => {
      clearTimeout(timeout);
      const type = recordingMimeType || mediaRecorder?.mimeType || 'audio/webm';
      const b = recordedChunks.length ? new Blob(recordedChunks, { type }) : null;
      recordedChunks = [];
      recordingMimeType = null;
      recordingError = null;
      mediaRecorder = null;
      resolve(b);
    };
    try {
      mediaRecorder.stop();
    } catch (e) {
      clearTimeout(timeout);
      log.warn('MediaRecorder stop failed', e);
      recordedChunks = [];
      recordingMimeType = null;
      recordingError = e instanceof Error ? e.message : 'Failed to stop recording';
      mediaRecorder = null;
      resolve(null);
    }
  });
};
