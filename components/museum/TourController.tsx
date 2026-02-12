import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TourZoneId, useMuseumStore } from '../../store/museumStore';

export const TourController = () => {
  const hydrate = useMuseumStore((s) => s.hydrateTourHistory);
  const tick = useMuseumStore((s) => s.tourTick);
  const onZoneEnter = useMuseumStore((s) => s.onZoneEnter);
  const onZoneExit = useMuseumStore((s) => s.onZoneExit);
  const avatarPos = useMuseumStore((s) => s.avatar.position);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const prevZone = useRef<TourZoneId | null>(null);

  const resolveZone = (x: number, z: number): TourZoneId | null => {
    
    if (x >= -1.6 && x <= 1.6 && z >= -3 && z <= 0) return 'entrance_threshold';
    if (x >= -12 && x <= -2 && z >= 4 && z <= 14) return 'gallery_1';
    if (x >= 2 && x <= 12 && z >= 12 && z <= 22) return 'gallery_2';
    if (x >= -12 && x <= -2 && z >= 20 && z <= 30) return 'gallery_3';
    if (x >= -7 && x <= 7 && z >= 32 && z <= 45) return 'finale';
    return null;
  };

  const acc = useRef(0);
  useFrame((_, delta) => {
    acc.current += delta;
    if (acc.current < 0.12) return;
    acc.current = 0;

    const z = resolveZone(avatarPos.x, avatarPos.z);
    if (z !== prevZone.current) {
      if (prevZone.current) onZoneExit(prevZone.current);
      if (z) onZoneEnter(z);
      prevZone.current = z;
    }

    tick(Date.now());
  });

  return null;
};
