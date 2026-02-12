import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { BasicShadowMap, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { MuseumEnvironment } from './MuseumEnvironment';
import { MuseumLighting } from './MuseumLighting';
import { MuseumAcousticsController } from './MuseumAcousticsController';
import { museumExhibits } from '../../data/museumExhibits';
import { ExhibitStand } from './ExhibitStand';
import { PlayerController } from './PlayerController';
import { TourController } from './TourController';
import { FinalePlaque } from './FinalePlaque';
import { MuseumExitRitualController } from './MuseumExitRitualController';
import { useMuseumStore } from '../../store/museumStore';
import { RendererTuner } from './RendererTuner';
import { MuseumPerformanceProbe } from './MuseumPerformanceProbe';
import { MuseumExhibitAudio } from './MuseumExhibitAudio';
import { EffectComposer } from '@react-three/postprocessing';
import { LumaDebug } from './LumaDebug';
import { useExitRitualStore } from './exitRitualStore';

export const MuseumScene = () => {
  const quality = useMuseumStore((s) => s.graphics.quality);
  const brightness = useMuseumStore((s) => s.graphics.brightness);
  const resetMuseum = useMuseumStore((s) => s.resetMuseum);
  const resetExitRitual = useExitRitualStore((s) => s.reset);
  const perfEnabled = typeof window !== 'undefined' && window.location.search.includes('perf=1');
  const debugLuma = typeof window !== 'undefined' && window.location.search.includes('debugLuma=1');

  const renderTuning = React.useMemo(() => {
    switch (quality) {
      case 'low':
        return {
          dpr: [0.75, 1] as [number, number],
          shadows: false,
          antialias: false,
          shadowMapSize: 512,
          
          exposure: 1.15
        };
      case 'medium':
        return {
          
          dpr: [0.9, 1.1] as [number, number],
          shadows: false,
          antialias: true,
          shadowMapSize: 512,
          exposure: 1.25
        };
      case 'high':
      default:
        return {
          dpr: [1, 1.5] as [number, number],
          shadows: true,
          antialias: true,
          shadowMapSize: 1024,
          exposure: 1.35
        };
    }
  }, [quality]);

  const toneMappingExposure = React.useMemo(() => {
    
    const offset = (brightness - 1.0) * 0.6; 
    return renderTuning.exposure + offset;
  }, [renderTuning.exposure, brightness]);

  useEffect(() => {
    return () => {
      resetMuseum();
      resetExitRitual();
      if (typeof document !== 'undefined') {
        document.exitPointerLock?.();
      }
    };
  }, [resetExitRitual, resetMuseum]);

  return (
    <>
      <div className="absolute inset-0">
        <Canvas
          shadows={renderTuning.shadows}
          dpr={renderTuning.dpr}
          camera={{ position: [0, 1.6, -1.6], fov: 70 }}
          gl={{ antialias: renderTuning.antialias, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = renderTuning.shadows;
            gl.shadowMap.type = BasicShadowMap;
            gl.outputColorSpace = SRGBColorSpace;
            
            (gl as any).useLegacyLights = true;
            
            (gl as any).physicallyCorrectLights = false;
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = toneMappingExposure;
          }}
        >
          <RendererTuner shadows={renderTuning.shadows} exposure={renderTuning.exposure} brightness={brightness} />
          <MuseumPerformanceProbe enabled={perfEnabled} />
          <color attach="background" args={['#141a23']} />
          <fog attach="fog" args={['#141a23', 28, 90]} />
          <MuseumLighting />
          <MuseumAcousticsController />
          <MuseumExhibitAudio />

          {debugLuma && (
            <EffectComposer>
              <LumaDebug threshold={0.9} />
            </EffectComposer>
          )}

          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
              <MuseumEnvironment />
              <TourController />
              <MuseumExitRitualController />
              <FinalePlaque />
              {museumExhibits.map((exhibit) => (
                <ExhibitStand key={exhibit.id} exhibit={exhibit} />
              ))}
              <PlayerController />
            </Physics>
          </Suspense>
        </Canvas>
      </div>
      <Loader />
    </>
  );
};
