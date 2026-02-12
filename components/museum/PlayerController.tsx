import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { Vector3 } from 'three';
import { useMuseumStore } from '../../store/museumStore';
import { useExitRitualStore } from './exitRitualStore';

const SPEED = 1.4;
const PLAYER_RADIUS = 0.2;
const CAMERA_HEIGHT = 1.4;
const STORE_UPDATE_MS = 200; 
const PIXELS_PER_CM = 37.8;
const MOUSE_SENSITIVITY = (15 * Math.PI) / 180 / PIXELS_PER_CM;
const ACCEL = 6.5;
const DECEL = 8.5;

const SPAWN: [number, number, number] = [0, PLAYER_RADIUS, -2.2];

const useKeyboard = () => {
  const keys = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          keys.current.w = true;
          break;
        case 'KeyA':
          keys.current.a = true;
          break;
        case 'KeyS':
          keys.current.s = true;
          break;
        case 'KeyD':
          keys.current.d = true;
          break;
        default:
          break;
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'KeyW':
          keys.current.w = false;
          break;
        case 'KeyA':
          keys.current.a = false;
          break;
        case 'KeyS':
          keys.current.s = false;
          break;
        case 'KeyD':
          keys.current.d = false;
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return keys;
};

export const PlayerController = () => {
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  const { camera, gl } = useThree();
  const keys = useKeyboard();

  const setAvatarPosition = useMuseumStore((state) => state.setAvatarPosition);
  const activeExhibitId = useMuseumStore((state) => state.activeExhibitId);
  const comfort = useMuseumStore((state) => state.comfort);

  const pendingTeleport = useMuseumStore((state) => state.pendingTeleport);
  const clearTeleport = useMuseumStore((state) => state.clearTeleport);

  const setPlayerSpeed = useMuseumStore((state) => state.setPlayerSpeed);

  const menu = useMuseumStore((state) => state.ui.menu);
  const setMenu = useMuseumStore((state) => state.setMenu);
  const exitInspect = useMuseumStore((state) => state.exitInspect);
  const plaqueOpen = useMuseumStore((state) => state.tour.plaqueOpen);
  const exitPhase = useExitRitualStore((state) => state.phase);

  const direction = useMemo(() => new Vector3(), []);
  const frontVector = useMemo(() => new Vector3(), []);
  const sideVector = useMemo(() => new Vector3(), []);
  const upVector = useMemo(() => new Vector3(0, 1, 0), []);
  const velocity = useRef(new Vector3());
  const yaw = useRef(0);
  const pitch = useRef(0);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    };
  }, []);

  useEffect(() => {
    const element = gl.domElement;

    const handleClick = () => {
      
      if (document.pointerLockElement !== element) {
        element.requestPointerLock?.();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return;
      if (activeExhibitId) return; 

      const sens = MOUSE_SENSITIVITY * (comfort.mouseSensitivityMultiplier ?? 1);
      yaw.current -= event.movementX * sens;
      pitch.current -= event.movementY * sens;
      pitch.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch.current));
    };

    element.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      element.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl, comfort.mouseSensitivityMultiplier, activeExhibitId]);

  useEffect(() => {
    const element = gl.domElement;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;

      if (exitPhase !== 'inactive' || plaqueOpen) return;

      if (activeExhibitId) {
        event.preventDefault();
        exitInspect();
        return;
      }

      if (document.pointerLockElement === element) {
        event.preventDefault();
        document.exitPointerLock?.();
        return;
      }

      event.preventDefault();
      setMenu(menu === 'none' ? 'map' : 'none');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gl, activeExhibitId, exitInspect, menu, setMenu, exitPhase, plaqueOpen]);

  useFrame((_, delta) => {
    const rigidBody = rigidBodyRef.current;
    if (!rigidBody) return;

    if (pendingTeleport) {
      rigidBody.setTranslation({ x: pendingTeleport.x, y: PLAYER_RADIUS, z: pendingTeleport.z }, true);
      rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      clearTeleport();
    }

    const currentVelocity = rigidBody.linvel();

    if (activeExhibitId) {
      rigidBody.setLinvel({ x: 0, y: currentVelocity.y, z: 0 }, true);
      velocity.current.set(0, 0, 0);
    } else {
      frontVector.set(0, 0, (keys.current.s ? 1 : 0) - (keys.current.w ? 1 : 0));
      sideVector.set((keys.current.a ? 1 : 0) - (keys.current.d ? 1 : 0), 0, 0);

      direction.subVectors(frontVector, sideVector).normalize();

      const target = direction.lengthSq() > 0
        ? direction
          .applyAxisAngle(upVector, yaw.current)
          .multiplyScalar(SPEED * (comfort.moveSpeedMultiplier ?? 1))
        : direction.set(0, 0, 0);

      const blend = direction.lengthSq() > 0 ? ACCEL : DECEL;
      const t = 1 - Math.exp(-blend * Math.max(0.0001, delta));
      velocity.current.lerp(target, t);
      rigidBody.setLinvel({ x: velocity.current.x, y: currentVelocity.y, z: velocity.current.z }, true);
    }

    setPlayerSpeed(Math.hypot(velocity.current.x, velocity.current.z));

    const position = rigidBody.translation();
    camera.position.set(position.x, position.y + CAMERA_HEIGHT, position.z);
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const rigidBody = rigidBodyRef.current;
      if (!rigidBody) return;
      const position = rigidBody.translation();
      setAvatarPosition(new Vector3(position.x, position.y, position.z));
    }, STORE_UPDATE_MS);

    return () => window.clearInterval(intervalId);
  }, [setAvatarPosition]);

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      type="dynamic"
      position={SPAWN}
      enabledRotations={[false, false, false]}
      linearDamping={0}
      name="player"
      userData={{ type: 'player' }}
    >
      <BallCollider args={[PLAYER_RADIUS]} />
    </RigidBody>
  );
};
