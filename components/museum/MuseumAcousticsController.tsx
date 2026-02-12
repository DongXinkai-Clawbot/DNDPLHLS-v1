import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useMuseumStore } from '../../store/museumStore';
import { unlockAudioContext } from '../../audioEngine';
import { museumAcoustics, type AcousticProfileId } from '../../engine/museumAcoustics';

const SPEED_GATE = 0.12;

export const MuseumAcousticsController = () => {
  const zoneId = useMuseumStore((s) => s.tour.currentZoneId);
  const speed = useMuseumStore((s) => s.playerSpeed);
  const reduceMotion = useMuseumStore((s) => s.comfort.reduceMotion);
  const activeExhibit = useMuseumStore((s) => s.activeExhibitId);
  const menu = useMuseumStore((s) => s.ui.menu);
  const avatarPos = useMuseumStore((s) => s.avatar.position);

  const profile = useMemo(() => {
    const inExit = avatarPos.x >= 7 && avatarPos.x <= 11 && avatarPos.z >= 36 && avatarPos.z <= 45;
    if (inExit) return 'exit';
    if (zoneId === 'finale') return 'finale';
    if (zoneId && zoneId.startsWith('gallery')) return 'gallery';
    return 'spine';
  }, [avatarPos.x, avatarPos.z, zoneId]);

  const lastProfile = useRef<AcousticProfileId>('spine');
  const stepAcc = useRef(0);

  useEffect(() => {
    const onGesture = () => {
      unlockAudioContext();
      museumAcoustics.resume();
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }, []);

  useFrame((_, delta) => {
    
    museumAcoustics.ensure();

    if (profile !== lastProfile.current) {
      museumAcoustics.setProfile(profile, 900);
      lastProfile.current = profile;
    }

    if (menu !== 'none') return;
    if (activeExhibit) return;
    if (reduceMotion) return;

    const v = speed;
    if (v < SPEED_GATE) {
      stepAcc.current = 0;
      return;
    }

    const v01 = Math.min(1, v / 2.2);
    const interval = 0.58 - 0.26 * v01; 

    stepAcc.current += delta;
    if (stepAcc.current >= interval) {
      
      stepAcc.current = stepAcc.current - interval * 0.85;
      museumAcoustics.playFootstep(profile, v01);
    }
  });

  return null;
};
