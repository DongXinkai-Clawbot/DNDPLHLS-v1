import React, { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { XR, startSession } from '@react-three/xr';
import { DeviceOrientationControls, OrbitControls } from '@react-three/drei';
import { Matrix4, Quaternion, RingGeometry, Vector3, type Mesh } from 'three';
import { useStore } from '../store';
import { ARLattice } from './ARLattice';
import { ARControlPanel } from './overlays/ARControlPanel';
import { createLogger } from '../utils/logger';
import { notifyWarning } from '../utils/notifications';
import { reportRecoverableError } from '../utils/errorReporting';

type PlacementState = 'scanning' | 'preview' | 'placed' | 'repositioning';
type PlacementMode = 'hit-test' | 'manual';
type HitTestPolicy = 'optional' | 'required';
type HitTestUnavailableReason = 'unsupported' | 'request-failed';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

type HitTestReticleProps = {
  active: boolean;
  onHitChange: (hit: boolean) => void;
  onPose: (position: Vector3, rotation: Quaternion) => void;
  onSourceReady?: () => void;
  onSourceUnavailable?: (reason: HitTestUnavailableReason) => void;
};

const HitTestReticle = ({ active, onHitChange, onPose, onSourceReady, onSourceUnavailable }: HitTestReticleProps) => {
  const { gl } = useThree();
  const reticleRef = useRef<Mesh>(null);
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null);
  const hitTestRequestedRef = useRef(false);
  const hasHitRef = useRef(false);
  const tempMatrix = useMemo(() => new Matrix4(), []);
  const tempPosition = useMemo(() => new Vector3(), []);
  const tempQuaternion = useMemo(() => new Quaternion(), []);
  const tempScale = useMemo(() => new Vector3(), []);
  const ringGeometry = useMemo(() => {
    const geometry = new RingGeometry(0.06, 0.085, 32);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      ringGeometry.dispose();
    };
  }, [ringGeometry]);

  const setHasHit = useCallback(
    (hit: boolean) => {
      if (hasHitRef.current === hit) return;
      hasHitRef.current = hit;
      onHitChange(hit);
    },
    [onHitChange]
  );

  useEffect(() => {
    const xr = gl.xr;

    const handleSessionEnd = () => {
      hitTestRequestedRef.current = false;
      hitTestSourceRef.current?.cancel?.();
      hitTestSourceRef.current = null;
      setHasHit(false);
    };

    const handleSessionStart = async () => {
      const session = xr.getSession();
      if (!session || hitTestRequestedRef.current) return;
      hitTestRequestedRef.current = true;
      try {
        if (typeof session.requestHitTestSource !== 'function') {
          hitTestSourceRef.current = null;
          setHasHit(false);
          onSourceUnavailable?.('unsupported');
          return;
        }

        let referenceSpace: XRReferenceSpace | null = null;
        // Try multiple reference spaces for better mobile compatibility
        const spaceTypes = ['viewer', 'local-floor', 'local'];
        for (const spaceType of spaceTypes) {
          try {
            referenceSpace = await session.requestReferenceSpace(spaceType as XRReferenceSpaceType);
            log.info(`Hit-test reference space acquired: ${spaceType}`);
            break;
          } catch (err) {
            log.warn(`Reference space '${spaceType}' not available`);
          }
        }

        if (!referenceSpace) {
          log.error('No valid reference space available for hit-test');
          hitTestSourceRef.current = null;
          setHasHit(false);
          onSourceUnavailable?.('request-failed');
          return;
        }

        hitTestSourceRef.current = await session.requestHitTestSource({ space: referenceSpace });
        onSourceReady?.();
      } catch (err) {
        log.error('Hit-test initialization failed', err);
        hitTestSourceRef.current = null;
        setHasHit(false);
        onSourceUnavailable?.('request-failed');
      }
    };

    xr.addEventListener('sessionstart', handleSessionStart);
    xr.addEventListener('sessionend', handleSessionEnd);

    return () => {
      xr.removeEventListener('sessionstart', handleSessionStart);
      xr.removeEventListener('sessionend', handleSessionEnd);
      handleSessionEnd();
    };
  }, [gl, onSourceReady, onSourceUnavailable, setHasHit]);

  useFrame((state, _delta, frame) => {
    const reticle = reticleRef.current;
    if (!reticle) return;
    if (!active) {
      if (reticle.visible) reticle.visible = false;
      setHasHit(false);
      return;
    }

    if (!frame || !hitTestSourceRef.current) return;
    const referenceSpace = state.gl.xr.getReferenceSpace();
    if (!referenceSpace) return;

    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
    if (hitTestResults.length === 0) {
      reticle.visible = false;
      setHasHit(false);
      return;
    }

    const pose = hitTestResults[0].getPose(referenceSpace);
    if (!pose) return;

    tempMatrix.fromArray(pose.transform.matrix);
    tempMatrix.decompose(tempPosition, tempQuaternion, tempScale);
    reticle.position.copy(tempPosition);
    reticle.quaternion.copy(tempQuaternion);
    reticle.visible = true;
    onPose(tempPosition, tempQuaternion);
    setHasHit(true);
  });

  return (
    <mesh ref={reticleRef} geometry={ringGeometry} visible={false}>
      <meshBasicMaterial color="#00d9ff" transparent opacity={0.75} />
    </mesh>
  );
};

const XRSessionEvents = ({
  onSessionStart,
  onSessionEnd,
}: {
  onSessionStart: (session: XRSession | null) => void;
  onSessionEnd: () => void;
}) => {
  const { gl } = useThree();

  useEffect(() => {
    const handleStart = () => onSessionStart(gl.xr.getSession());
    const handleEnd = () => onSessionEnd();
    gl.xr.addEventListener('sessionstart', handleStart);
    gl.xr.addEventListener('sessionend', handleEnd);
    return () => {
      gl.xr.removeEventListener('sessionstart', handleStart);
      gl.xr.removeEventListener('sessionend', handleEnd);
    };
  }, [gl, onSessionEnd, onSessionStart]);

  return null;
};

const XRSelectListener = ({ onSelect }: { onSelect: () => void }) => {
  const { gl } = useThree();
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const handleSelect = () => onSelectRef.current();
    let session: XRSession | null = null;

    const handleSessionStart = () => {
      session = gl.xr.getSession();
      if (session) session.addEventListener('select', handleSelect);
    };
    const handleSessionEnd = () => {
      if (session) session.removeEventListener('select', handleSelect);
      session = null;
    };

    gl.xr.addEventListener('sessionstart', handleSessionStart);
    gl.xr.addEventListener('sessionend', handleSessionEnd);

    return () => {
      gl.xr.removeEventListener('sessionstart', handleSessionStart);
      gl.xr.removeEventListener('sessionend', handleSessionEnd);
      handleSessionEnd();
    };
  }, [gl]);

  return null;
};

export const ARContainer = () => {
  const log = createLogger('ar/container');
  const updateSettings = useStore((s) => s.updateSettings);
  const stopAllAudioActivity = useStore((s) => s.stopAllAudioActivity);
  const [placementState, setPlacementState] = useState<PlacementState>('scanning');
  const placementStateRef = useRef<PlacementState>('scanning');
  const [placementPosition, setPlacementPosition] = useState<[number, number, number]>([0, 0, -2]);
  const [placementRotation, setPlacementRotation] = useState<[number, number, number, number]>([0, 0, 0, 1]);
  const [hasHit, setHasHit] = useState(false);
  const hasHitRef = useRef(false);
  const lastHitPositionRef = useRef<Vector3>(new Vector3());
  const lastHitRotationRef = useRef<Quaternion>(new Quaternion());
  const [isArSupported, setIsArSupported] = useState<boolean | null>(null);

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const [useGyro, setUseGyro] = useState(false);
  const [simFacingMode, setSimFacingMode] = useState<'environment' | 'user'>('environment');
  const [simIsStarting, setSimIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRootRef = useRef<HTMLDivElement>(null);
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null);
  const xrSessionRef = useRef<XRSession | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>('hit-test');
  const [manualPlacementLocked, setManualPlacementLocked] = useState(false);
  const [manualScale, setManualScale] = useState(1);
  const manualScaleRef = useRef(1);
  const [manualYaw, setManualYaw] = useState(0);
  const manualYawRef = useRef(0);
  const placementPositionRef = useRef<[number, number, number]>(placementPosition);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const manualGestureRef = useRef<{
    mode: 'drag' | 'pinch' | null;
    startX: number;
    startY: number;
    startPos: [number, number, number];
    startScale: number;
    startYaw: number;
    startDistance: number;
    startAngle: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    startPos: [0, 0, -2],
    startScale: 1,
    startYaw: 0,
    startDistance: 0,
    startAngle: 0,
  });
  const [hitTestPolicy, setHitTestPolicy] = useState<HitTestPolicy>('optional');
  const [hitTestStatus, setHitTestStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [hitTestError, setHitTestError] = useState<string | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [xrRequestError, setXrRequestError] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const forceManualPlacementRef = useRef(false);
  const forceHitTestPolicyRef = useRef<HitTestPolicy | null>(null);
  const forceManualMessageRef = useRef<string | null>(null);
  const autoStartSimulatedRef = useRef(false);
  const xrAvailable = typeof navigator !== 'undefined' && !!(navigator as any).xr;
  const lastARAttemptRef = useRef<number>(0);
  const arAttemptDelayMs = 2000; // Minimum 2s between AR start attempts to prevent race conditions

  const safeAreaStyle = useMemo(
    () => ({
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
    }),
    []
  );
  const bottomBarStyle = useMemo(
    () => ({
      paddingLeft: 'calc(12px + env(safe-area-inset-left, 0px))',
      paddingRight: 'calc(12px + env(safe-area-inset-right, 0px))',
      paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    }),
    []
  );
  const runSafeAction = useCallback((label: string, action: () => void) => {
    try {
      action();
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : 'Unknown error';
      reportRecoverableError('AR', err, `Action failed (${label}): ${detail}`);
    }
  }, []);

  const resetPlacement = useCallback((nextState: PlacementState = 'scanning', opts?: { resetManual?: boolean }) => {
    setPlacementState(nextState);
    placementStateRef.current = nextState;
    hasHitRef.current = false;
    setHasHit(false);
    if (opts?.resetManual) {
      setManualPlacementLocked(false);
      setManualScale(1);
      manualScaleRef.current = 1;
      setManualYaw(0);
      manualYawRef.current = 0;
      setPlacementPosition([0, 0, -2]);
      setPlacementRotation([0, 0, 0, 1]);
    }
  }, []);

  const handleHitChange = useCallback((hit: boolean) => {
    if (placementMode !== 'hit-test') return;
    hasHitRef.current = hit;
    setHasHit(hit);
    setPlacementState((prev) => {
      if (prev === 'placed' || prev === 'repositioning') return prev;
      return hit ? 'preview' : 'scanning';
    });
  }, [placementMode]);

  const handleHitPose = useCallback((position: Vector3, rotation: Quaternion) => {
    if (placementMode !== 'hit-test') return;
    lastHitPositionRef.current.copy(position);
    lastHitRotationRef.current.copy(rotation);
  }, [placementMode]);

  const handleSelect = useCallback(() => {
    if (placementMode !== 'hit-test') return;
    if (!hasHitRef.current) return;
    const state = placementStateRef.current;
    if (state !== 'preview' && state !== 'repositioning') return;
    const pos = lastHitPositionRef.current;
    const rot = lastHitRotationRef.current;
    setPlacementPosition([pos.x, pos.y, pos.z]);
    setPlacementRotation([rot.x, rot.y, rot.z, rot.w]);
    setPlacementState('placed');
    placementStateRef.current = 'placed';
  }, [placementMode]);

  const applyManualYaw = useCallback((yaw: number) => {
    manualYawRef.current = yaw;
    setManualYaw(yaw);
    const q = new Quaternion();
    q.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    setPlacementRotation([q.x, q.y, q.z, q.w]);
  }, []);

  const handleHitTestReady = useCallback(() => {
    setHitTestStatus('available');
    setHitTestError(null);
  }, []);

  const handleHitTestUnavailable = useCallback((reason: HitTestUnavailableReason) => {
    setHitTestStatus('unavailable');
    if (hitTestPolicy === 'required') {
      setHitTestError('Hit-test is required but unavailable on this device/browser.');
      notifyWarning(
        'Hit-test required but unavailable. Try Chrome on Android with ARCore, or switch to manual placement.',
        'AR'
      );
      return;
    }
    setHitTestError('Hit-test unavailable. Manual placement enabled.');
    setPlacementMode('manual');
    resetPlacement('scanning', { resetManual: true });
    setManualPlacementLocked(false);
    if (reason === 'unsupported') {
      notifyWarning('Hit-test not supported on this device/browser. Manual placement enabled.', 'AR');
    } else {
      notifyWarning('Hit-test failed. Manual placement enabled.', 'AR');
    }
  }, [hitTestPolicy, resetPlacement]);

  const handleSessionStart = useCallback((session: XRSession | null) => {
    xrSessionRef.current = session;
    setIsSessionActive(true);
    setHitTestStatus('unknown');
    setHitTestError(null);
    setXrRequestError(null);
    setPlacementMode('hit-test');
    setIsControlPanelOpen(false);
    resetPlacement('scanning', { resetManual: true });
    if (forceHitTestPolicyRef.current) {
      setHitTestPolicy(forceHitTestPolicyRef.current);
    }
    if (forceManualPlacementRef.current) {
      setPlacementMode('manual');
      setManualPlacementLocked(false);
      setHitTestError(forceManualMessageRef.current || 'Hit-test unavailable. Manual placement enabled.');
      resetPlacement('scanning', { resetManual: true });
    }
    forceManualPlacementRef.current = false;
    forceHitTestPolicyRef.current = null;
    forceManualMessageRef.current = null;
  }, [resetPlacement]);

  const handleSessionEnd = useCallback(() => {
    xrSessionRef.current = null;
    setIsSessionActive(false);
    setHitTestStatus('unknown');
    setHitTestError(null);
    setXrRequestError(null);
    setPlacementMode('hit-test');
    setIsExiting(false);
    setIsControlPanelOpen(false);
    resetPlacement('scanning', { resetManual: true });
  }, [resetPlacement]);

  const endXRSession = useCallback(async () => {
    const session = xrSessionRef.current;
    if (!session) return { ended: true, reason: 'no-session' };

    return new Promise<{ ended: boolean; reason: string }>((resolve) => {
      let settled = false;
      const finish = (ended: boolean, reason: string) => {
        if (settled) return;
        settled = true;
        resolve({ ended, reason });
      };
      // Increased timeout from 1500ms to 3000ms to handle slower Android devices
      // Some low-end devices take 2-3s to properly end XR session
      const timeout = window.setTimeout(() => finish(false, 'timeout'), 3000);
      const handleEnd = () => {
        window.clearTimeout(timeout);
        finish(true, 'event');
      };
      session.addEventListener('end', handleEnd, { once: true });
      session.end().catch(() => {
        window.clearTimeout(timeout);
        finish(false, 'error');
      });
    });
  }, []);

  const exitAR = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    stopAllAudioActivity();
    const endResult = await endXRSession();
    if (!endResult.ended) {
      notifyWarning('XR session did not end cleanly. Forcing UI exit.', 'AR');
      log.warn('XR session end incomplete', endResult);
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    resetPlacement('scanning', { resetManual: true });
    updateSettings({ isArActive: false });
  }, [endXRSession, isExiting, log, resetPlacement, stopAllAudioActivity, updateSettings, videoStream]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const xr = (navigator as any).xr;
        const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : true;

        if (!isSecureContext || !xr?.isSessionSupported) {
          if (!cancelled) setIsArSupported(false);
          return;
        }

        const supported = await xr.isSessionSupported('immersive-ar');
        if (!cancelled) setIsArSupported(!!supported);
      } catch {
        if (!cancelled) setIsArSupported(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (xrAvailable) return;
    if (isArSupported === false) return;
    autoStartSimulatedRef.current = true;
    setIsArSupported(false);
  }, [isArSupported, xrAvailable]);

  useEffect(() => {
    videoStreamRef.current = videoStream;
  }, [videoStream]);

  const startSimulatedCamera = useCallback(async (mode: 'environment' | 'user' = simFacingMode) => {
    if (simIsStarting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API not available in this environment.');
      return;
    }
    setSimIsStarting(true);
    setCameraError(null);

    // Stop existing stream using ref (not state)
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      const constraintsList: Array<{ constraints: MediaStreamConstraints; label: string }> = [
        { constraints: { video: { facingMode: { ideal: mode } }, audio: false }, label: `ideal-${mode}` },
        { constraints: { video: { facingMode: mode }, audio: false }, label: `exact-${mode}` },
        { constraints: { video: true, audio: false }, label: 'fallback-any' },
      ];
      let stream: MediaStream | null = null;
      let successLabel = '';
      let lastError: unknown = null;

      for (const { constraints, label } of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          successLabel = label;
          log.info(`Camera started with constraint: ${label}`);
          break;
        } catch (err) {
          lastError = err;
          const errMsg = err instanceof Error ? err.name : String(err);
          log.warn(`Camera constraint failed (${label}): ${errMsg}`);
        }
      }

      if (!stream) {
        const detail = lastError instanceof Error ? `${lastError.name}: ${lastError.message}` : 'Unable to access camera.';
        throw new Error(detail);
      }

      setVideoStream(stream);
      setSimFacingMode(mode);
      setCameraError(null);
      reportRecoverableError('AR', null, `Camera started successfully (${successLabel})`);
    } catch (err) {
      log.warn('Simulated AR Camera Error', err);
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : 'Unknown error';

      // Provide specific guidance based on error type
      let userMessage = `Camera access denied or unavailable. Please check permissions. (${detail})`;
      if (detail.includes('NotAllowedError')) {
        userMessage = 'Camera permission denied. Please allow camera access in settings and try again.';
      } else if (detail.includes('NotReadableError')) {
        userMessage = 'Camera is in use by another app. Close other apps and try again.';
      } else if (detail.includes('NotFoundError')) {
        userMessage = 'No camera found on this device.';
      }

      setCameraError(userMessage);
      reportRecoverableError('AR', err, userMessage);
    } finally {
      setSimIsStarting(false);
    }
  }, [log, simFacingMode, simIsStarting]);

  useEffect(() => {
    if (!videoStream) return;

    // Monitor stream tracks - if they stop, the stream is no longer usable
    const handleTrackEnded = (event: Event) => {
      const track = event.target as MediaStreamTrack;
      log.warn(`Camera track ended: ${track.kind}`);
      // If video track ends, restart camera
      if (track.kind === 'video') {
        setCameraError('Camera stream lost. Please restart.');
      }
    };

    videoStream.getTracks().forEach(track => {
      track.addEventListener('ended', handleTrackEnded);
    });

    return () => {
      videoStream.getTracks().forEach(track => {
        track.removeEventListener('ended', handleTrackEnded);
      });
    };
  }, [videoStream, log]);

  useEffect(() => {
    return () => {
      // Only stop camera on component unmount, not on every state change
      const stream = videoStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (isArSupported !== false) return;
    if (!autoStartSimulatedRef.current) return;
    autoStartSimulatedRef.current = false;
    startSimulatedCamera(simFacingMode);
  }, [isArSupported, simFacingMode, startSimulatedCamera]);

  useEffect(() => {
    placementStateRef.current = placementState;
  }, [placementState]);

  useEffect(() => {
    placementPositionRef.current = placementPosition;
  }, [placementPosition]);

  useEffect(() => {
    manualScaleRef.current = manualScale;
  }, [manualScale]);

  useEffect(() => {
    manualYawRef.current = manualYaw;
  }, [manualYaw]);

  useEffect(() => {
    if (overlayRootRef.current) {
      setOverlayRoot(overlayRootRef.current);
    }
  }, []);

  useEffect(() => {
    if (hitTestPolicy === 'required' && placementMode === 'manual') {
      setPlacementMode('hit-test');
      resetPlacement('scanning', { resetManual: true });
    }
  }, [hitTestPolicy, placementMode, resetPlacement]);

  useEffect(() => {
    if (!videoRef.current) return;
    if (videoStream) {
      videoRef.current.srcObject = videoStream;

      // Add a small delay before playing to ensure stream is properly attached
      const playTimeout = window.setTimeout(async () => {
        try {
          if (videoRef.current && videoRef.current.srcObject === videoStream) {
            await videoRef.current.play();
            log.info('Video playback started successfully');
            setCameraError(null);
          }
        } catch (e) {
          log.error('Video play failed', e);

          // Check if it's a specific type of error
          const errorName = e instanceof Error ? e.name : String(e);
          if (errorName === 'NotAllowedError') {
            setCameraError('Camera access requires user interaction. Please enable the camera manually.');
          } else if (errorName === 'NotSupportedError') {
            setCameraError('Video playback not supported in this browser.');
          } else {
            setCameraError('Unable to start camera preview. Check permissions and try again.');
          }
          reportRecoverableError('AR', e, 'Unable to start camera preview.');
        }
      }, 100);

      return () => window.clearTimeout(playTimeout);
    } else {
      videoRef.current.srcObject = null;
    }
  }, [log, videoStream]);

  useEffect(() => {
    return () => {
      try {
        stopAllAudioActivity();
      } catch {

      }
      const session = xrSessionRef.current;
      if (session) {
        try {
          session.end();
        } catch {

        }
        xrSessionRef.current = null;
      }
      const stream = videoStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null;
        } catch {

        }
      }
    };
  }, [stopAllAudioActivity]);

  useEffect(() => {
    // Monitor WebGL context loss and handle recovery
    if (!overlayRootRef.current) return;

    const handleContextLoss = () => {
      log.warn('WebGL context lost during AR session');
      notifyWarning('WebGL context lost. AR may become unstable. Please restart AR.', 'AR');
      reportRecoverableError('AR', null, 'WebGL context lost');
    };

    const handleContextRestore = () => {
      log.info('WebGL context restored');
      notifyWarning('WebGL context restored.', 'AR');
    };

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLoss);
      canvas.addEventListener('webglcontextrestored', handleContextRestore);

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLoss);
        canvas.removeEventListener('webglcontextrestored', handleContextRestore);
      };
    }
  }, [log]);

  const requestGyroPermission = async () => {
    if (typeof DeviceOrientationEvent === 'undefined') {
      notifyWarning('Device orientation not supported on this device.', 'AR');
      return;
    }
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setUseGyro(true);
        } else {
          notifyWarning('Permission denied for device orientation.', 'AR');
        }
      } catch (e) {
        log.error('AR camera permission error', e);
        reportRecoverableError('AR', e, 'Unable to access device orientation.');
      }
    } else {
      
      setUseGyro(true);
    }
  };

  const manualGestureEnabled = placementMode === 'manual' && !manualPlacementLocked;
  const manualScaleMin = 0.4;
  const manualScaleMax = 2.5;

  const handleManualPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!manualGestureEnabled) return;
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture failures.
    }
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length === 1) {
      manualGestureRef.current = {
        mode: 'drag',
        startX: pointers[0].x,
        startY: pointers[0].y,
        startPos: placementPositionRef.current,
        startScale: manualScaleRef.current,
        startYaw: manualYawRef.current,
        startDistance: 0,
        startAngle: 0,
      };
    } else if (pointers.length >= 2) {
      const [p1, p2] = pointers;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      manualGestureRef.current = {
        mode: 'pinch',
        startX: 0,
        startY: 0,
        startPos: placementPositionRef.current,
        startScale: manualScaleRef.current,
        startYaw: manualYawRef.current,
        startDistance: Math.hypot(dx, dy),
        startAngle: Math.atan2(dy, dx),
      };
    }
  }, [manualGestureEnabled]);

  const handleManualPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!manualGestureEnabled) return;
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pointers = Array.from(activePointersRef.current.values());
    const gesture = manualGestureRef.current;
    if (pointers.length === 1) {
      const p = pointers[0];
      if (gesture.mode !== 'drag') {
        manualGestureRef.current = {
          ...gesture,
          mode: 'drag',
          startX: p.x,
          startY: p.y,
          startPos: placementPositionRef.current,
          startScale: manualScaleRef.current,
          startYaw: manualYawRef.current,
          startDistance: 0,
          startAngle: 0,
        };
        return;
      }
      const dx = p.x - gesture.startX;
      const dy = p.y - gesture.startY;
      const dragScale = 0.0025;
      setPlacementPosition([
        gesture.startPos[0] + dx * dragScale,
        gesture.startPos[1] - dy * dragScale,
        gesture.startPos[2],
      ]);
    } else if (pointers.length >= 2) {
      const [p1, p2] = pointers;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      if (gesture.mode !== 'pinch') {
        manualGestureRef.current = {
          ...gesture,
          mode: 'pinch',
          startPos: placementPositionRef.current,
          startScale: manualScaleRef.current,
          startYaw: manualYawRef.current,
          startDistance: distance,
          startAngle: angle,
        };
        return;
      }
      if (gesture.startDistance > 0) {
        const nextScale = clamp(gesture.startScale * (distance / gesture.startDistance), manualScaleMin, manualScaleMax);
        setManualScale(nextScale);
        manualScaleRef.current = nextScale;
      }
      const nextYaw = gesture.startYaw + (angle - gesture.startAngle);
      applyManualYaw(nextYaw);
    }
  }, [applyManualYaw, manualGestureEnabled, manualScaleMax, manualScaleMin]);

  const handleManualPointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.delete(e.pointerId);
    }
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length === 1) {
      manualGestureRef.current = {
        ...manualGestureRef.current,
        mode: 'drag',
        startX: pointers[0].x,
        startY: pointers[0].y,
        startPos: placementPositionRef.current,
        startScale: manualScaleRef.current,
        startYaw: manualYawRef.current,
        startDistance: 0,
        startAngle: 0,
      };
    } else if (pointers.length === 0) {
      manualGestureRef.current = {
        ...manualGestureRef.current,
        mode: null,
      };
    }
  }, []);

  const sessionInit = useMemo(() => {
    if (!overlayRoot) return null;
    const optionalFeatures = [
      'dom-overlay',
      'dom-overlay-for-handheld-ar',
      'local-floor',
      'bounded-floor',
      'local',
      'viewer',
    ];
    const requiredFeatures: string[] = [];
    if (hitTestPolicy === 'required') {
      requiredFeatures.push('hit-test');
    } else {
      optionalFeatures.unshift('hit-test');
    }
    return { domOverlay: { root: overlayRoot }, optionalFeatures, requiredFeatures };
  }, [hitTestPolicy, overlayRoot]);

  const describeXrError = useCallback((err: unknown) => {
    const name =
      err instanceof DOMException
        ? err.name
        : err instanceof Error
          ? err.name
          : '';
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : '';
    if (name === 'NotSupportedError') {
      return {
        summary: 'AR not supported on this browser/device.',
        detail: 'Try Chrome/Chromium on Android with ARCore, and ensure HTTPS connection.',
        fallbackToSimulated: true,
      };
    }
    if (name === 'NotAllowedError') {
      return {
        summary: 'AR permission denied.',
        detail: 'Go to Settings > Apps > [Your Browser] > Permissions and allow Camera and AR access.',
        fallbackToSimulated: false,
      };
    }
    if (name === 'SecurityError') {
      return {
        summary: 'AR requires a secure context (HTTPS).',
        detail: 'This app must be served over HTTPS. Contact the site owner if using HTTP.',
        fallbackToSimulated: true,
      };
    }
    if (name === 'InvalidStateError') {
      return {
        summary: 'AR session is already active or in a bad state.',
        detail: 'Exit AR completely and wait a few seconds before trying again.',
        fallbackToSimulated: false,
      };
    }
    if (name === 'NotReadableError') {
      return {
        summary: 'Camera is busy or unavailable.',
        detail: 'Close other apps using the camera, restart your device if needed.',
        fallbackToSimulated: true,
      };
    }
    if (name === 'NotFoundError') {
      return {
        summary: 'No camera found for AR.',
        detail: 'This device may not have a compatible camera for AR. Use simulated AR instead.',
        fallbackToSimulated: true,
      };
    }
    if (name === 'OverconstrainedError') {
      return {
        summary: 'Camera constraints not compatible.',
        detail: 'Try a different camera if available, or use simulated AR.',
        fallbackToSimulated: true,
      };
    }
    if (name === 'AbortError') {
      return {
        summary: 'AR startup was interrupted.',
        detail: 'Please try again or restart your browser.',
        fallbackToSimulated: false,
      };
    }
    if (message.includes('hit-test') || message.includes('Hit-test')) {
      return {
        summary: 'Hit-test not available.',
        detail: 'Manual placement mode has been enabled instead. You can place the lattice freely.',
        fallbackToSimulated: false,
      };
    }
    const summary = message ? `AR error: ${message}` : 'Unable to start AR session.';
    return { summary, detail: 'Try exiting AR, reloading the page, or use simulated AR.', fallbackToSimulated: false };
  }, []);

  const handleStartAR = useCallback(async () => {
    if (!sessionInit || isStartingSession) return;

    // Debounce AR start attempts to prevent race conditions and rapid retries
    // that can crash the browser on some mobile devices
    const now = Date.now();
    if (now - lastARAttemptRef.current < arAttemptDelayMs) {
      log.warn(`AR start attempt throttled: only ${now - lastARAttemptRef.current}ms since last attempt`);
      return;
    }
    lastARAttemptRef.current = now;

    setIsStartingSession(true);
    setXrRequestError(null);
    try {
      const stripFeatures = (features: string[] | undefined, blocked: string[]) =>
        (features || []).filter((f) => !blocked.includes(f));

      const noDomOverlayInit = {
        optionalFeatures: stripFeatures(sessionInit.optionalFeatures, ['dom-overlay', 'dom-overlay-for-handheld-ar']),
        requiredFeatures: stripFeatures(sessionInit.requiredFeatures, ['dom-overlay', 'dom-overlay-for-handheld-ar']),
      };
      const noHitTestInit = {
        optionalFeatures: stripFeatures(noDomOverlayInit.optionalFeatures, ['hit-test']),
        requiredFeatures: stripFeatures(noDomOverlayInit.requiredFeatures, ['hit-test']),
      };
      const minimalInit = {
        optionalFeatures: ['local', 'viewer'],
        requiredFeatures: [],
      };

      const attempts: Array<{
        label: string;
        init: XRSessionInit | null;
        pre?: () => void;
        onSuccess?: () => void;
        warn?: string;
      }> = [
        { label: 'full', init: sessionInit },
        {
          label: 'no-dom-overlay',
          init: noDomOverlayInit,
          warn: 'DOM overlay not supported. UI controls may be hidden during AR.',
        },
        {
          label: 'no-hit-test',
          init: noHitTestInit,
          pre: () => {
            forceHitTestPolicyRef.current = 'optional';
            forceManualPlacementRef.current = true;
            forceManualMessageRef.current = 'Hit-test unavailable. Manual placement enabled.';
          },
          warn: 'Hit-test unavailable. Manual placement enabled.',
        },
        {
          label: 'minimal',
          init: minimalInit,
          pre: () => {
            forceHitTestPolicyRef.current = 'optional';
            forceManualPlacementRef.current = true;
            forceManualMessageRef.current = 'Compatibility mode: limited AR features.';
          },
          warn: 'Compatibility mode: limited AR features.',
        },
      ];

      let lastError: unknown = null;
      for (const attempt of attempts) {
        if (!attempt.init) continue;
        const prevManual = forceManualPlacementRef.current;
        const prevPolicy = forceHitTestPolicyRef.current;
        const prevMessage = forceManualMessageRef.current;
        try {
          attempt.pre?.();
          await startSession('immersive-ar', attempt.init);
          attempt.onSuccess?.();
          if (attempt.warn) notifyWarning(attempt.warn, 'AR');
          lastError = null;
          break;
        } catch (err) {
          forceManualPlacementRef.current = prevManual;
          forceHitTestPolicyRef.current = prevPolicy;
          forceManualMessageRef.current = prevMessage;
          lastError = err;
        }
      }

      if (lastError) {
        const info = describeXrError(lastError);
        const detail = info.detail ? ` ${info.detail}` : '';
        setXrRequestError(`${info.summary}${detail}`);
        notifyWarning(`${info.summary}${detail}`, 'AR');
        reportRecoverableError('AR', lastError, `${info.summary}${detail}`);
        if (info.fallbackToSimulated) {
          autoStartSimulatedRef.current = true;
          setIsArSupported(false);
        }
      }
    } finally {
      setIsStartingSession(false);
    }
  }, [describeXrError, isStartingSession, sessionInit]);

  if (isArSupported === false || !xrAvailable) {
    return (
      <div className="absolute inset-0 w-full h-full z-[5] bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          disablePictureInPicture
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 pointer-events-none"
        />

        {(!videoStream || cameraError) && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-auto">
            <div className="bg-black/70 p-4 rounded-2xl text-white text-center border border-white/10 max-w-xs">
              <p className="font-bold text-sm mb-2">{cameraError ? 'Camera Error' : 'Camera Off'}</p>
              <p className="text-[11px] text-gray-300 mb-3">
                {cameraError || 'Enable the camera to start simulated AR.'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setCameraError(null);
                    startSimulatedCamera();
                  }}
                  disabled={simIsStarting}
                  className="px-4 py-2 rounded-full text-[10px] font-bold bg-blue-600/80 border border-blue-400 disabled:opacity-50 transition-opacity"
                >
                  {simIsStarting ? 'STARTING...' : 'ENABLE CAMERA'}
                </button>
                {cameraError && (
                  <button
                    onClick={() => {
                      setCameraError(null);
                      startSimulatedCamera();
                    }}
                    disabled={simIsStarting}
                    className="px-4 py-2 rounded-full text-[10px] font-bold bg-white/10 border border-white/20 disabled:opacity-50 transition-opacity"
                  >
                    RETRY
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <Canvas
          gl={{ alpha: true }}
          className="absolute inset-0 z-10"
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          {useGyro ? (
            <DeviceOrientationControls />
          ) : (
            <OrbitControls target={[0, 0, -5]} enablePan={false} enableZoom={true} minDistance={1} maxDistance={20} />
          )}
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />

          <ARLattice isPlaced={true} position={[0, 0, -5]} scaleMultiplier={manualScale} />
        </Canvas>

        <div className="absolute inset-0 z-20 pointer-events-none" style={safeAreaStyle}>
          <div
            className="absolute left-1/2 -translate-x-1/2 text-white text-center w-full px-3 sm:px-4"
            style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxWidth: '90vw' }}
          >
            <div className="bg-black/60 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-xs font-bold text-blue-300">SIMULATED AR</p>
              <p className="text-[10px] text-gray-300">
                WebXR Unavailable - {videoStream ? 'Camera On' : 'Camera Off'} + {useGyro ? 'Gyro' : 'Touch/Mouse'}
              </p>
            </div>
          </div>

          {!isControlPanelOpen && (
            <div className="absolute flex flex-col gap-2 z-[60]" style={{
              top: 'calc(12px + env(safe-area-inset-top, 0px))',
              right: 'calc(12px + env(safe-area-inset-right, 0px))',
            }}>
            <button
              onClick={() =>
                runSafeAction('gyro-toggle', () => {
                  if (!useGyro) requestGyroPermission();
                  else setUseGyro(false);
                })
              }
              className={`p-3 rounded-full shadow-xl border backdrop-blur-sm transition-all ${useGyro ? 'bg-blue-600/80 border-blue-400 text-white' : 'bg-gray-800/80 border-white/20 text-gray-300'}`}
              title={useGyro ? "Switch to Touch Control" : "Enable Gyro Control"}
              aria-label={useGyro ? "Switch to touch control" : "Enable gyro control"}
            >
              {useGyro ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              )}
            </button>
            <button
              onClick={() =>
                runSafeAction('switch-camera', () => {
                  const next = simFacingMode === 'environment' ? 'user' : 'environment';
                  setSimFacingMode(next);
                  if (videoStream) startSimulatedCamera(next);
                })
              }
              className="p-3 rounded-full shadow-xl border backdrop-blur-sm transition-all bg-gray-800/80 border-white/20 text-gray-300"
              title="Switch Camera"
              aria-label="Switch camera"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-4.553A1 1 0 0022 6.414V10m0 0h-3.586M9 14l-4.553 4.553A1 1 0 012 17.586V14m0 0h3.586M7 10h10a2 2 0 012 2v2m-2 0H7a2 2 0 01-2-2v-2a2 2 0 012-2z" />
              </svg>
            </button>
            </div>
          )}

          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-auto flex flex-wrap items-center justify-center gap-2 z-50"
            style={bottomBarStyle}
          >
            <button
              onClick={() => runSafeAction('exit-ar', exitAR)}
              className="bg-red-600/80 text-white px-6 py-2 rounded-full font-bold shadow-xl border border-red-500 transition-transform active:scale-95"
            >
              EXIT AR
            </button>
          </div>

          <ARControlPanel
            isOpen={isControlPanelOpen}
            onToggleOpen={() => setIsControlPanelOpen((prev) => !prev)}
            hitTestPolicy={hitTestPolicy}
            onChangeHitTestPolicy={setHitTestPolicy}
            placementMode={placementMode}
            manualLocked={manualPlacementLocked}
            onToggleManualLock={() => setManualPlacementLocked((prev) => !prev)}
            arScale={manualScale}
            onChangeArScale={(value) => {
              const next = clamp(value, manualScaleMin, manualScaleMax);
              setManualScale(next);
              manualScaleRef.current = next;
            }}
          />
        </div>
      </div>
    )
  }

  const isManualMode = placementMode === 'manual';
  const isPlaced = isManualMode ? true : (placementState === 'placed' || placementState === 'repositioning');
  const reticleActive = placementMode === 'hit-test' && placementState !== 'placed';

  const placementHeadline = isManualMode
    ? (manualPlacementLocked ? 'Manual Locked' : 'Manual Placement')
    : placementState === 'placed'
      ? 'Placed'
      : placementState === 'repositioning'
        ? 'Reposition'
        : placementState === 'preview'
          ? 'Ready to Place'
          : 'Scanning';

  const placementMessage = isManualMode
    ? (manualPlacementLocked
      ? 'Placement locked. Use Unlock to move the lattice.'
      : 'Drag to move, pinch to scale, rotate with two fingers, then lock.')
    : placementState === 'placed'
      ? 'Use Reposition to move the lattice.'
      : hasHit
        ? 'Tap to confirm placement.'
        : 'Move your device slowly to find a surface.';

  const placementStatus = isManualMode
    ? 'Manual placement active.'
    : hitTestStatus === 'available'
      ? 'Hit-test ready.'
      : hitTestStatus === 'unavailable'
        ? 'Hit-test unavailable.'
        : 'Checking hit-test...';

  return (
    <div className="absolute inset-0 w-full h-full z-[5]">
      {sessionInit && !isSessionActive && (
        <div className="xr-button">
          <button
            type="button"
            onClick={handleStartAR}
            disabled={isStartingSession}
          >
            {isStartingSession ? 'Starting AR...' : 'Enter AR'}
          </button>
        </div>
      )}

      {isStartingSession && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-auto">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-400 animate-spin"></div>
            </div>
            <div className="text-white text-center">
              <p className="text-sm font-bold">Starting AR Session...</p>
              <p className="text-xs text-gray-300 mt-1">Initializing camera and sensors</p>
            </div>
          </div>
        </div>
      )}

      <Canvas
        gl={{ alpha: true }}
        style={{ background: 'transparent' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <XR referenceSpace="local">
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <Suspense fallback={null}>
            <XRSessionEvents
              onSessionStart={handleSessionStart}
              onSessionEnd={handleSessionEnd}
            />
            <XRSelectListener onSelect={handleSelect} />
            <HitTestReticle
              active={reticleActive}
              onHitChange={handleHitChange}
              onPose={handleHitPose}
              onSourceReady={handleHitTestReady}
              onSourceUnavailable={handleHitTestUnavailable}
            />
            <ARLattice
              isPlaced={isPlaced}
              position={placementPosition}
              rotation={placementRotation}
              scaleMultiplier={manualScale}
            />
          </Suspense>
        </XR>
      </Canvas>

      <div ref={overlayRootRef} className="absolute inset-0 z-[50] pointer-events-none">
        {isSessionActive && manualGestureEnabled && (
          <div
            className="absolute inset-0 z-[51] pointer-events-auto"
            style={{ touchAction: 'none' }}
            onPointerDown={handleManualPointerDown}
            onPointerMove={handleManualPointerMove}
            onPointerUp={handleManualPointerEnd}
            onPointerCancel={handleManualPointerEnd}
          />
        )}

        {isSessionActive && (
          <div className="absolute inset-0 pointer-events-none" style={safeAreaStyle}>
            <div
              className="absolute left-1/2 -translate-x-1/2 text-white text-center w-full px-3 sm:px-4"
              style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxWidth: '90vw' }}
            >
              <div className="bg-black/80 px-6 py-4 rounded-3xl border border-white/20 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{placementHeadline}</p>
                <p className="text-[11px] font-medium leading-relaxed text-gray-200">{placementMessage}</p>
                <p className="mt-1 text-[10px] text-gray-400">{placementStatus}</p>
                {hitTestError && (
                  <p className="mt-2 text-[10px] font-semibold text-amber-200">{hitTestError}</p>
                )}
                {xrRequestError && (
                  <p className="mt-2 text-[10px] font-semibold text-rose-200">{xrRequestError}</p>
                )}
              </div>
            </div>

            <div
              className="pointer-events-auto absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-2"
              style={bottomBarStyle}
            >
              <button
                onClick={() => runSafeAction('exit-ar', exitAR)}
                disabled={isExiting}
                className="bg-red-600/80 text-white px-6 py-2 rounded-full font-bold shadow-xl border border-red-500 transition-transform active:scale-95 disabled:opacity-60"
              >
                {isExiting ? 'EXITING...' : 'EXIT AR'}
              </button>
              {placementMode === 'hit-test' && placementState === 'placed' && (
                <button
                  onClick={() => runSafeAction('reposition', () => resetPlacement('repositioning'))}
                  className="bg-white/10 text-white px-5 py-2 rounded-full font-bold shadow-xl border border-white/20 transition-transform active:scale-95"
                >
                  REPOSITION
                </button>
              )}
              {placementMode === 'hit-test' && placementState === 'repositioning' && (
                <button
                  onClick={() => runSafeAction('cancel-reposition', () => resetPlacement('placed'))}
                  className="bg-white/10 text-white px-5 py-2 rounded-full font-bold shadow-xl border border-white/20 transition-transform active:scale-95"
                >
                  CANCEL
                </button>
              )}
              {placementMode === 'hit-test' && !isPlaced && (
                <button
                  onClick={() => runSafeAction('reset-placement', () => resetPlacement('scanning'))}
                  className="bg-white/10 text-white px-5 py-2 rounded-full font-bold shadow-xl border border-white/20 transition-transform active:scale-95"
                >
                  RESET
                </button>
              )}
              {placementMode === 'manual' && (
                <>
                  <button
                    onClick={() =>
                      runSafeAction('manual-lock', () => setManualPlacementLocked((prev) => !prev))
                    }
                    className="bg-white/10 text-white px-5 py-2 rounded-full font-bold shadow-xl border border-white/20 transition-transform active:scale-95"
                  >
                    {manualPlacementLocked ? 'UNLOCK' : 'LOCK'}
                  </button>
                  <button
                    onClick={() =>
                      runSafeAction('manual-reset', () => resetPlacement('scanning', { resetManual: true }))
                    }
                    className="bg-white/10 text-white px-5 py-2 rounded-full font-bold shadow-xl border border-white/20 transition-transform active:scale-95"
                  >
                    RESET
                  </button>
                </>
              )}
            </div>

            <ARControlPanel
              isOpen={isControlPanelOpen}
              onToggleOpen={() => setIsControlPanelOpen((prev) => !prev)}
              hitTestPolicy={hitTestPolicy}
              onChangeHitTestPolicy={setHitTestPolicy}
              placementMode={placementMode}
              manualLocked={manualPlacementLocked}
              onToggleManualLock={() => setManualPlacementLocked((prev) => !prev)}
              arScale={manualScale}
              onChangeArScale={(value) => {
                const next = clamp(value, manualScaleMin, manualScaleMax);
                setManualScale(next);
                manualScaleRef.current = next;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
