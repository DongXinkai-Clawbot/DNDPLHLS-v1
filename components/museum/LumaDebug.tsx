import React, { forwardRef, useMemo } from 'react';
import { Uniform } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = `
uniform float threshold;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Calculate relative luminance (standard rec.709 coefficients)
    float luma = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    
    if (luma > threshold) {
        // Highlight overexposed areas in bright magenta
        outputColor = vec4(1.0, 0.0, 1.0, 1.0);
    } else {
        // Keep original color
        outputColor = inputColor;
    }
}
`;

class LumaDebugEffect extends Effect {
  constructor({ threshold = 0.9 } = {}) {
    super('LumaDebugEffect', fragmentShader, {
      uniforms: new Map([['threshold', new Uniform(threshold)]]),
    });
  }
}

type LumaDebugProps = {
  threshold?: number;
};

export const LumaDebug = forwardRef<any, LumaDebugProps>(({ threshold = 0.9 }, ref) => {
  const effect = useMemo(() => new LumaDebugEffect({ threshold }), [threshold]);
  return <primitive ref={ref} object={effect} dispose={null} />;
});
