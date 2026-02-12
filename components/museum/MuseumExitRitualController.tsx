import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useExitRitualStore } from './exitRitualStore';

const EXIT_END_SENSOR = {
  x: 9.0,
  y: 1.0,
  z: 44.55,
  hx: 1.6,
  hy: 1.6,
  hz: 0.7
};

export const MuseumExitRitualController = () => {
  const tick = useExitRitualStore((s) => s.tick);
  const reachExitEnd = useExitRitualStore((s) => s.reachExitEnd);
  const shouldNavigate = useExitRitualStore((s) => s.shouldNavigate);
  const reset = useExitRitualStore((s) => s.reset);
  const phase = useExitRitualStore((s) => s.phase);

  const navOnce = useRef(false);

  useEffect(() => {
    navOnce.current = false;
  }, [phase]);

  useFrame(() => {
    const now = Date.now();
    tick(now);
  });

  useEffect(() => {
    if (!shouldNavigate) return;
    if (navOnce.current) return;
    navOnce.current = true;
    
    const t = window.setTimeout(() => {
      window.location.hash = '#/';
      
      reset();
    }, 80);
    return () => window.clearTimeout(t);
  }, [shouldNavigate, reset]);

  const onEnter = (payload: any) => {
    const isPlayer = payload.other?.rigidBodyObject?.name === 'player' || payload.other?.rigidBodyObject?.userData?.type === 'player';
    if (!isPlayer) return;
    reachExitEnd();
  };

  if (phase === 'inactive') return null;

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        sensor
        args={[EXIT_END_SENSOR.hx, EXIT_END_SENSOR.hy, EXIT_END_SENSOR.hz]}
        position={[EXIT_END_SENSOR.x, EXIT_END_SENSOR.y, EXIT_END_SENSOR.z]}
        onIntersectionEnter={onEnter}
      />
    </RigidBody>
  );
};
