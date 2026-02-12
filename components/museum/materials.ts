import { Color } from 'three';
import { createLogger } from '../../utils/logger';

const log = createLogger('museum/materials');

export type MuseumMaterialKey =
  | 'wallPlaster'
  | 'wallGallery'
  | 'wallVestibule'
  | 'wallExit'
  | 'wallAccent'
  | 'baseboard'
  | 'stoneTrim'
  | 'shadowGap'
  | 'fixtureTrim'
  | 'fixtureDiffuser'
  | 'floorSpine'
  | 'floorGallery'
  | 'floorFinale'
  | 'floorVestibule'
  | 'floorExit'
  | 'bench'
  | 'thresholdStone'
  | 'nicheFrame'
  | 'nicheInner'
  | 'inlay'
  
  | 'artifactCeramic'
  | 'artifactPlaque'
  | 'artifactPlaqueFrame'
  | 'artifactFastener'
  | 'artifactFoot';

const BASE: Partial<Record<
  MuseumMaterialKey,
  { hex: string; roughness: number; metalness: number; emissiveHex?: string; emissiveIntensity?: number }
>> = {
  wallPlaster: { hex: '#d6d1c8', roughness: 0.96, metalness: 0.02 },
  wallAccent: { hex: '#2f2f2f', roughness: 0.98, metalness: 0.02 },
  baseboard: { hex: '#262626', roughness: 0.98, metalness: 0.02 },

  stoneTrim: { hex: '#3a4048', roughness: 0.94, metalness: 0.04 },
  
  shadowGap: { hex: '#1b1b1b', roughness: 0.99, metalness: 0.0 },

  fixtureTrim: { hex: '#3a4048', roughness: 0.9, metalness: 0.06 },
  fixtureDiffuser: {
    hex: '#e9e2d6',
    roughness: 0.82,
    metalness: 0.02,
    emissiveHex: '#e9e2d6',
    emissiveIntensity: 0.08
  },

  floorSpine: { hex: '#2b333d', roughness: 0.98, metalness: 0.03 },
  floorGallery: { hex: '#d0cac0', roughness: 0.97, metalness: 0.03 },
  floorFinale: { hex: '#2a323c', roughness: 0.96, metalness: 0.05 },

  bench: { hex: '#394450', roughness: 0.86, metalness: 0.08 },
  thresholdStone: { hex: '#3a3f46', roughness: 0.94, metalness: 0.05 },
  inlay: { hex: '#3b424c', roughness: 0.95, metalness: 0.04 },

  nicheFrame: { hex: '#343434', roughness: 0.96, metalness: 0.03 },
  nicheInner: { hex: '#1f1f1f', roughness: 0.99, metalness: 0.01 },

  artifactCeramic: { hex: '#2e2a26', roughness: 0.96, metalness: 0.01 },
  
  artifactPlaque: { hex: '#5a4f43', roughness: 0.55, metalness: 0.38 },
  
  artifactPlaqueFrame: { hex: '#463b32', roughness: 0.5, metalness: 0.55 },
  
  artifactFastener: { hex: '#1c1c1c', roughness: 0.35, metalness: 0.82 },
  
  artifactFoot: { hex: '#141414', roughness: 0.92, metalness: 0.02 }
};

function hashStringToUnit(seed: string): number {
  
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

function jitterColor(baseHex: string, seed: string, amount = 0.035): Color {
  const c = new Color(baseHex);
  const hsl: { h: number; s: number; l: number } = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);

  const u = hashStringToUnit(seed);
  const dl = (u - 0.5) * 2 * amount;
  const ds = (u - 0.5) * 2 * (amount * 0.4);

  const l = Math.min(1, Math.max(0, hsl.l + dl));
  const s = Math.min(1, Math.max(0, hsl.s + ds));

  const out = new Color();
  out.setHSL(hsl.h, s, l);
  return out;
}

export function museumMaterial(
  key: MuseumMaterialKey | string,
  seed = key
): { color: Color; roughness: number; metalness: number; emissive?: Color; emissiveIntensity?: number } {
  const b = (BASE as any)[key];
  if (!b) {
    log.error(`Missing configuration for key "${key}"`);
    
    return {
      color: new Color('#ff00ff'),
      roughness: 0.5,
      metalness: 0.0,
      emissive: new Color('#ff00ff'),
      emissiveIntensity: 1.0
    };
  }
  const jitter = key.startsWith('floor') ? 0.03 : 0.025;
  const color = jitterColor(b.hex, seed, jitter);
  const emissive = b.emissiveHex ? new Color(b.emissiveHex) : undefined;
  return {
    color,
    roughness: b.roughness,
    metalness: b.metalness,
    emissive,
    emissiveIntensity: b.emissiveIntensity
  };
}

export function shouldMicroDetail(material: MuseumMaterialKey): boolean {
  
  return (
    material === 'wallPlaster' ||
    material === 'wallGallery' ||
    material === 'wallVestibule' ||
    material === 'wallExit' ||
    material === 'wallAccent' ||
    material === 'floorSpine' ||
    material === 'floorGallery' ||
    material === 'floorFinale' ||
    material === 'floorVestibule' ||
    material === 'floorExit' ||
    material === 'nicheInner' ||
    material === 'baseboard'
  );
}

export function microDetailOnBeforeCompile(quality: 'low' | 'medium' | 'high') {
  return (shader: any) => {
    
    shader.uniforms.uNoiseScale = { value: 45.0 }; 
    shader.uniforms.uDetailStrength = { value: quality === 'low' ? 0.0 : 0.015 }; 
    shader.uniforms.uRoughnessPerturb = { value: 0.03 }; 
    shader.uniforms.uEdgeDarkening = { value: 0.04 }; 

    shader.vertexShader = `
      varying vec3 vWorldPosition;
      ${shader.vertexShader}
    `.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `
    );

    shader.fragmentShader = `
      varying vec3 vWorldPosition;
      
      // Simple hash-based 3D noise (replace with better texture if available, but this is cheap/stable)
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }

      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      
      // World space noise
      float n = noise(vWorldPosition * 45.0); // Hardcoded scale for now
      
      // Albedo perturbation (subtle)
      float albedoMod = mix(1.0 - 0.015, 1.0 + 0.015, n);
      diffuseColor.rgb *= albedoMod;

      // Phase 2.3: Edge darkening (Simulate AO/Seams)
      // Using UV coordinates assuming standard mapping where 0 and 1 are edges.
      // Note: This requires UVs to be reasonably laid out per panel.
      #ifdef USE_UV
        vec2 edgeDist = min(vMapUv, 1.0 - vMapUv);
        float edgeFactor = min(edgeDist.x, edgeDist.y);
        // Darken edges within 0.05 UV units
        float edgeMix = smoothstep(0.0, 0.05, edgeFactor);
        float edgeDark = mix(1.0 - 0.04, 1.0, edgeMix);
        diffuseColor.rgb *= edgeDark;
      #endif
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `
      #include <roughnessmap_fragment>
      // Roughness perturbation
      // Break up the perfect plastic look
      float roughMod = mix(-0.03, 0.03, n);
      roughnessFactor = clamp(roughnessFactor + roughMod, 0.0, 1.0);
      `
    );
  };
}
