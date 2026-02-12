import React, { useEffect, useState } from 'react';
import { useMuseumStore } from '../../store/museumStore';

export const MuseumUX = () => {
  const onboardingSeen = useMuseumStore((s) => s.ui.onboardingSeen);
  const hasPointerLocked = useMuseumStore((s) => s.ui.hasPointerLocked);
  const menu = useMuseumStore((s) => s.ui.menu);
  const setOnboardingSeen = useMuseumStore((s) => s.setOnboardingSeen);
  const setHasPointerLocked = useMuseumStore((s) => s.setHasPointerLocked);

  const [checkedPointerLock, setCheckedPointerLock] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const locked = !!document.pointerLockElement;
      setHasPointerLocked(locked);
      if (locked) setOnboardingSeen(true);
      setCheckedPointerLock(true);
    };
    document.addEventListener('pointerlockchange', onChange);
    onChange();
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, [setHasPointerLocked, setOnboardingSeen]);

  if (!checkedPointerLock) return null;
  if (onboardingSeen || hasPointerLocked) return null;
  if (menu !== 'none') return null;
  return null;
};
