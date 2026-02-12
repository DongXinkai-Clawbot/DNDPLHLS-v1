import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { getAudioContext, unlockAudioContext } from '../../audioEngine';
import { museumExhibits } from '../../data/museumExhibits';
import { useMuseumStore } from '../../store/museumStore';

type ExhibitNode = {
  src: AudioBufferSourceNode;
  gain: GainNode;
  hp: BiquadFilterNode;
  lp: BiquadFilterNode;
  position: [number, number, number];
};

const makeNoiseBuffer = (ctx: AudioContext, lengthSec: number) => {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(lengthSec * sr));
  const b = ctx.createBuffer(1, length, sr);
  const d = b.getChannelData(0);
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };
  for (let i = 0; i < length; i++) d[i] = rnd() * 0.35;
  return b;
};

export const MuseumExhibitAudio = () => {
  const avatarPos = useMuseumStore((s) => s.avatar.position);

  const nodes = useRef<ExhibitNode[] | null>(null);
  const started = useRef(false);
  const acc = useRef(0);

  const exhibits = useMemo(() => museumExhibits, []);

  useEffect(() => {
    const ctx = getAudioContext();
    const buffer = makeNoiseBuffer(ctx, 1.6);

    nodes.current = exhibits.map((exhibit, idx) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 140 + idx * 30;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2400 + idx * 240;
      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      return {
        src,
        gain,
        hp,
        lp,
        position: exhibit.position
      };
    });

    const onGesture = () => {
      if (!nodes.current || started.current) return;
      unlockAudioContext();
      nodes.current.forEach((node) => node.src.start());
      started.current = true;
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      nodes.current?.forEach((node) => {
        try {
          node.src.stop();
        } catch {
          
        }
        try {
          node.src.disconnect();
          node.hp.disconnect();
          node.lp.disconnect();
          node.gain.disconnect();
        } catch {
          
        }
      });
      nodes.current = null;
    };
  }, [exhibits]);

  useFrame((_, delta) => {
    if (!nodes.current || !started.current) return;
    acc.current += delta;
    if (acc.current < 0.12) return;
    acc.current = 0;

    const ctx = getAudioContext();
    const x = avatarPos.x;
    const z = avatarPos.z;

    nodes.current.forEach((node) => {
      const dx = x - node.position[0];
      const dz = z - node.position[2];
      const dist = Math.hypot(dx, dz);
      const near = Math.max(0, 1 - (dist - 0.6) / 3.2);
      const target = 0.02 * Math.min(1, near);
      node.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
    });
  });

  return null;
};
