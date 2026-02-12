
/// <reference types="vite/client" />

export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      fog: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      primitive: any;
      sphereGeometry: any;
      boxGeometry: any;
      bufferGeometry: any;
      meshBasicMaterial: any;
      mesh: any;
      instancedMesh: any;
      meshLambertMaterial: any;
      meshPhongMaterial: any;
      meshStandardMaterial: any;
      meshToonMaterial: any;
      meshNormalMaterial: any;
      lineSegments: any;
      lineBasicMaterial: any;
      [elemName: string]: any;
    }
  }
}

import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      fog: any;
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      primitive: any;
      sphereGeometry: any;
      boxGeometry: any;
      bufferGeometry: any;
      meshBasicMaterial: any;
      mesh: any;
      instancedMesh: any;
      meshLambertMaterial: any;
      meshPhongMaterial: any;
      meshStandardMaterial: any;
      meshToonMaterial: any;
      meshNormalMaterial: any;
      lineSegments: any;
      lineBasicMaterial: any;
      [elemName: string]: any;
    }
  }
}
