
import React, { useState, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, TrackballControls } from '@react-three/drei';
import * as THREE from 'three';
import { useLatticeStore, useLatticeStoreApi } from '../../store/latticeStoreContext';
import { buildNodeIndexMap, getRenderedNodePosition, getRootNodeForPitchField } from '../../utils/renderedPosition';
import { DEFAULT_SETTINGS } from '../../constants';

export const NavigationControls = () => {
  const { camera, invalidate } = useThree();
  const controlsRef = useRef<any>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({ w: false, a: false, s: false, d: false });
  const lastTapRef = useRef<Record<string, number>>({ w: 0, a: 0, s: 0, d: 0 });
  const isSprintingRef = useRef(false);
  const isRightMouseRef = useRef(false);
  const isInteractingRef = useRef(false);
  // Use individual selectors to prevent full re-renders
  const selectedNode = useLatticeStore(s => s.selectedNode);
  const nodes = useLatticeStore(s => s.nodes);
  const settings = useLatticeStore(s => s.settings);
  const isGravityEnabled = useLatticeStore(s => s.isGravityEnabled);
  const focusSignal = useLatticeStore(s => s.focusSignal);
  const navigateSelection = useLatticeStore(s => s.navigateSelection);
  const isHChroma = settings.visuals.layoutMode === 'h-chroma';
  const navControls = settings.navigationControls || DEFAULT_SETTINGS.navigationControls;
  const storeApi = useLatticeStoreApi();
  const isGlobalStore = typeof storeApi === 'function';
  const rotateSpeed = Math.max(0.1, navControls.mouseRotateSpeed || DEFAULT_SETTINGS.navigationControls.mouseRotateSpeed);
  const zoomSpeed = Math.max(0.1, navControls.mouseZoomSpeed || DEFAULT_SETTINGS.navigationControls.mouseZoomSpeed);
  const panSpeed = Math.max(0.1, navControls.mousePanSpeed || DEFAULT_SETTINGS.navigationControls.mousePanSpeed);
  const doubleTapMs = Math.max(80, navControls.doubleTapMs || DEFAULT_SETTINGS.navigationControls.doubleTapMs);
  const wasdBaseSpeed = Math.max(0.1, navControls.wasdBaseSpeed || DEFAULT_SETTINGS.navigationControls.wasdBaseSpeed);
  const wasdSprintMultiplier = Math.max(1, navControls.wasdSprintMultiplier || DEFAULT_SETTINGS.navigationControls.wasdSprintMultiplier);
  const cameraResetSignal = useLatticeStore(s => s.cameraResetSignal);
  const disableWasdInKeyboard = useLatticeStore(s => s.disableWasdInKeyboard);
  const keyboardPanel = useLatticeStore(s => s.panels.keyboard);
  const isKeyboardFullscreen = !!(keyboardPanel && keyboardPanel.isOpen && keyboardPanel.mode === 'fullscreen');
  const neutralKeys = React.useMemo(() => ['F13', 'F14', 'F15'], []);

  const rootNode = React.useMemo(() => getRootNodeForPitchField(nodes), [nodes]);
  const nodeIndexMap = React.useMemo(() => buildNodeIndexMap(nodes), [nodes]);
  const [targetPos, setTargetPos] = useState<THREE.Vector3 | null>(null);
  const [overviewTarget, setOverviewTarget] = useState<{ target: THREE.Vector3; position: THREE.Vector3 } | null>(null);
  const prevFocusSignal = useRef(focusSignal);
  const prevResetSignal = useRef(cameraResetSignal);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl) return;
    const handleChange = () => invalidate();
    const handleStart = () => {
      isInteractingRef.current = true;
      invalidate();
    };
    const handleEnd = () => {
      isInteractingRef.current = false;
    };
    ctrl.addEventListener('change', handleChange);
    ctrl.addEventListener('start', handleStart);
    ctrl.addEventListener('end', handleEnd);
    return () => {
      ctrl.removeEventListener('change', handleChange);
      ctrl.removeEventListener('start', handleStart);
      ctrl.removeEventListener('end', handleEnd);
    };
  }, [invalidate, isHChroma]);

  useEffect(() => {
    const ctrl = controlsRef.current;
    if (!ctrl || !Array.isArray(ctrl.keys)) return;
    ctrl.keys = neutralKeys;
  }, [isHChroma, neutralKeys]);

  // Camera reset signal - position camera at optimal overview angle
  useEffect(() => {
    if (cameraResetSignal !== prevResetSignal.current && nodes.length > 0) {
      prevResetSignal.current = cameraResetSignal;

      // Calculate bounding box of all nodes
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;

      for (const node of nodes) {
        const pos = getRenderedNodePosition(node, nodes, settings, nodeIndexMap, rootNode);
        minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
        minZ = Math.min(minZ, pos.z); maxZ = Math.max(maxZ, pos.z);
      }

      // Calculate center and size
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const centerZ = (minZ + maxZ) / 2;
      const sizeX = maxX - minX;
      const sizeY = maxY - minY;
      const sizeZ = maxZ - minZ;
      const maxSize = Math.max(sizeX, sizeY, sizeZ, 10);

      // Position camera at an optimal 3D angle (45° elevation, 45° azimuth)
      const distance = maxSize * 1.5;
      const elevation = Math.PI / 6; // 30 degrees up
      const azimuth = Math.PI / 4; // 45 degrees rotated

      const camX = centerX + distance * Math.cos(elevation) * Math.sin(azimuth);
      const camY = centerY + distance * Math.sin(elevation) + maxSize * 0.3;
      const camZ = centerZ + distance * Math.cos(elevation) * Math.cos(azimuth);

      setOverviewTarget({
        target: new THREE.Vector3(centerX, centerY, centerZ),
        position: new THREE.Vector3(camX, camY, camZ)
      });
      setTargetPos(null); // Clear any existing focus target
    }
  }, [cameraResetSignal, nodes, settings, nodeIndexMap, rootNode]);

  useEffect(() => {
    if (!selectedNode) return;
    let shouldFocus = false;

    if (focusSignal !== prevFocusSignal.current) {

      shouldFocus = settings.visuals.layoutMode !== 'h-chroma';
      prevFocusSignal.current = focusSignal;
    } else if (settings.autoCameraFocus && !isGravityEnabled) {
      const isNonFocusLayout = settings.visuals.layoutMode === 'pitch-field' || settings.visuals.layoutMode === 'h-chroma';
      if (!isNonFocusLayout) {
        shouldFocus = true;
      }
    }

    if (shouldFocus) {
      setTargetPos(getRenderedNodePosition(selectedNode, nodes, settings, nodeIndexMap, rootNode));
      setOverviewTarget(null); // Clear overview when focusing on node
    }
  }, [selectedNode, settings.autoCameraFocus, isGravityEnabled, settings.visuals.layoutMode, focusSignal, nodes, settings, nodeIndexMap, rootNode]);

  useEffect(() => {
    if (isHChroma) setTargetPos(null);
    if (isHChroma && controlsRef.current) {

      const ctrl = controlsRef.current;
      ctrl.minPolarAngle = Math.PI / 2;
      ctrl.maxPolarAngle = Math.PI / 2;
      ctrl.update();
    }
  }, [isHChroma]);

  useEffect(() => {
    if (isKeyboardFullscreen) {
      setKeys({ w: false, a: false, s: false, d: false });
      isSprintingRef.current = false;
    }
  }, [isKeyboardFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (isKeyboardFullscreen) return;
      if (disableWasdInKeyboard && document.querySelector('[data-virtual-keyboard]')) {
        return;
      }
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        if (!keys[k]) {
          const now = performance.now();
          const lastTime = lastTapRef.current[k];
          if (now - lastTime < doubleTapMs || e.shiftKey) { isSprintingRef.current = true; }
          setKeys(prev => ({ ...prev, [k]: true }));
          setTargetPos(null);
          invalidate();
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (e.repeat) return;
        if (isGlobalStore && e.defaultPrevented) return;
        e.preventDefault();
        navigateSelection({ dx: -1 });
      } else if (e.key === 'ArrowRight') {
        if (e.repeat) return;
        if (isGlobalStore && e.defaultPrevented) return;
        e.preventDefault();
        navigateSelection({ dx: 1 });
      } else if (e.key === 'ArrowUp') {
        if (e.repeat) return;
        if (isGlobalStore && e.defaultPrevented) return;
        e.preventDefault();
        navigateSelection({ dy: 1 });
      } else if (e.key === 'ArrowDown') {
        if (e.repeat) return;
        if (isGlobalStore && e.defaultPrevented) return;
        e.preventDefault();
        navigateSelection({ dy: -1 });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.key) return;
      if (isKeyboardFullscreen) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) {
        setKeys(prev => {
          const next = { ...prev, [k]: false };
          if (!next.w && !next.a && !next.s && !next.d) { isSprintingRef.current = false; }
          return next;
        });
        lastTapRef.current[k] = performance.now();
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button')) return;
      if (e.button === 2) isRightMouseRef.current = true;
      setTargetPos(null);
      invalidate();
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isRightMouseRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [keys, doubleTapMs, disableWasdInKeyboard, isKeyboardFullscreen, invalidate, isGlobalStore, navigateSelection]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    const safeDelta = Number.isFinite(delta) ? Math.min(delta, 0.05) : 0;
    if (!isHChroma) {
      if (targetPos) {
        const ctrl = controlsRef.current;
        const lerpFactor = Math.min(1, 4 * delta);
        ctrl.target.lerp(targetPos, lerpFactor);
        const dist = camera.position.distanceTo(ctrl.target);
        if (dist > 50) {
          const dir = camera.position.clone().sub(ctrl.target).normalize();
          camera.position.lerp(ctrl.target.clone().add(dir.multiplyScalar(40)), lerpFactor);
        }
        if (ctrl.target.distanceTo(targetPos) < 0.1) setTargetPos(null);
      } else if (overviewTarget) {
        const ctrl = controlsRef.current;
        const lerpFactor = Math.min(1, 4 * delta);

        // Interpolate both target (center) and camera position
        ctrl.target.lerp(overviewTarget.target, lerpFactor);
        camera.position.lerp(overviewTarget.position, lerpFactor);

        // Stop when close enough
        if (ctrl.target.distanceTo(overviewTarget.target) < 0.5 &&
          camera.position.distanceTo(overviewTarget.position) < 0.5) {
          setOverviewTarget(null);
        }
      }
    }

    const { w, s, a, d } = keys;
    if ((w || s || a || d) && !isRightMouseRef.current) {
      if (isHChroma) {

        const speedMult = isSprintingRef.current ? wasdSprintMultiplier : 1.0;
        const speed = 18 * wasdBaseSpeed * speedMult * safeDelta;
        const dy = (w ? 1 : 0) * speed + (s ? -1 : 0) * speed;
        if (Math.abs(dy) > 0) {
          camera.position.y += dy;
          controlsRef.current.target.y += dy;
        }
      } else {

        const baseVelocity = 25;
        const adaptiveBase = Math.max(baseVelocity, (settings.expansionA * 10) / 15);
        const speedMult = isSprintingRef.current ? wasdSprintMultiplier : 1.0;
        const speed = adaptiveBase * wasdBaseSpeed * speedMult * safeDelta;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
        const move = new THREE.Vector3();
        if (w) move.add(forward);
        if (s) move.sub(forward);
        if (d) move.add(right);
        if (a) move.sub(right);
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(speed);
          camera.position.add(move);
          controlsRef.current.target.add(move);
        }
      }
    }
    if (isHChroma) {

      const ctrl = controlsRef.current;
      const tx = ctrl.target?.x ?? 0;
      const tz = ctrl.target?.z ?? 0;
      if (Math.abs(tx) > 1e-6 || Math.abs(tz) > 1e-6) {
        ctrl.target.x = 0;
        ctrl.target.z = 0;
        camera.position.x -= tx;
        camera.position.z -= tz;
      }

      camera.up.set(0, 1, 0);
    }

    controlsRef.current.update();

    const shouldContinue =
      isInteractingRef.current ||
      !!targetPos ||
      !!overviewTarget ||
      keys.w || keys.a || keys.s || keys.d ||
      (isHChroma && !!settings.visuals.hChromaAutoRotate);

    if (shouldContinue) invalidate();
  });

  return (
    isHChroma ? (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableZoom
        enableRotate
        autoRotate={!!settings.visuals.hChromaAutoRotate}
        autoRotateSpeed={settings.visuals.hChromaAutoRotateSpeed ?? 1.0}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={rotateSpeed}
        zoomSpeed={zoomSpeed}
        panSpeed={panSpeed}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
      />
    ) : (
      <TrackballControls ref={controlsRef} makeDefault rotateSpeed={rotateSpeed} zoomSpeed={zoomSpeed} panSpeed={panSpeed} staticMoving={false} dynamicDampingFactor={0.1} />
    )
  );
};
