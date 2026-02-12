import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

type RendererTunerProps = {
  shadows: boolean;
  
  exposure: number;
  
  brightness: number;
};

export const RendererTuner = ({ shadows, exposure, brightness }: RendererTunerProps) => {
  const { gl } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = shadows;
  }, [gl, shadows]);

  useEffect(() => {
    
    const offset = (brightness - 1.0) * 0.6;
    gl.toneMappingExposure = exposure + offset;
  }, [gl, exposure, brightness]);

  return null;
};
