
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { JITopologyConfig, JITopologyResult, RatioTarget, WeightMode, WeightNormalization, ZNormalization } from './jiTypes';
import { clamp, foldRatio, parseRatioText } from './jiUtils';

const sectionClass = 'bg-black/50 border border-white/10 rounded-xl p-3 space-y-2';
const labelClass = 'text-[10px] uppercase tracking-widest text-gray-400 font-black';
const inputClass = 'min-h-[34px] w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-[11px] font-mono';

const DEFAULT_TARGETS: RatioTarget[] = [
  { id: 't-1', text: '3/2', ratio: 3 / 2, weight: 1, num: 3, den: 2, label: 'Perfect Fifth' },
  { id: 't-2', text: '5/4', ratio: 5 / 4, weight: 1, num: 5, den: 4, label: 'Major Third' },
  { id: 't-3', text: '7/4', ratio: 7 / 4, weight: 1, num: 7, den: 4, label: 'Natural Seventh' }
];

const DEFAULT_CONFIG: JITopologyConfig = {
  beta: 2,
  nMin: 5,
  nMax: 120,
  baseStep: 0.05,
  cPeriod: 1200,
  epsilon: 1e-6,
  gamma: 0.5,
  p: 2,
  weightMode: 'tenney',
  weightNormalization: 'max',
  zNormalization: 'sqrt',
  enableBase: true,
  enablePeaks: true,
  enableDense: true,
  denseOffsets: [0.001, 0.005, 0.02],
  mergeEps: 1e-5,
  colorSigma: 5,
  colorSharpen: 1.4,
  yPhysCurve: 0.65,
  yCogCurve: 1.1,
  targets: DEFAULT_TARGETS
};

const buildRequestId = () => `ji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const signedCentsError = (n: number, ratio: number, beta: number, cPeriod: number) => {
  const folded = foldRatio(ratio, beta);
  if (!Number.isFinite(folded) || folded <= 0) return NaN;
  const L = Math.log(folded) / Math.log(beta);
  if (!Number.isFinite(L) || Math.abs(L) < 1e-12) return NaN;
  const k = n * L;
  const delta = Math.round(k) - k;
  return delta * (cPeriod / n);
};

const binarySearchNearest = (arr: Float32Array, value: number) => {
  let lo = 0;
  let hi = arr.length - 1;
  if (hi < 0) return 0;
  if (value <= arr[lo]) return lo;
  if (value >= arr[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= value) lo = mid;
    else hi = mid;
  }
  return Math.abs(arr[lo] - value) < Math.abs(arr[hi] - value) ? lo : hi;
};

const JustIntonationTopology = () => {
  const [beta, setBeta] = useState(DEFAULT_CONFIG.beta);
  const [nMin, setNMin] = useState(DEFAULT_CONFIG.nMin);
  const [nMax, setNMax] = useState(DEFAULT_CONFIG.nMax);
  const [baseStep, setBaseStep] = useState(DEFAULT_CONFIG.baseStep);
  const [cPeriod, setCPeriod] = useState(DEFAULT_CONFIG.cPeriod);
  const [epsilon, setEpsilon] = useState(DEFAULT_CONFIG.epsilon);
  const [gamma, setGamma] = useState(DEFAULT_CONFIG.gamma);
  const [p, setP] = useState(DEFAULT_CONFIG.p);
  const [weightMode, setWeightMode] = useState<WeightMode>(DEFAULT_CONFIG.weightMode);
  const [weightNormalization, setWeightNormalization] = useState<WeightNormalization>(DEFAULT_CONFIG.weightNormalization);
  const [zNormalization, setZNormalization] = useState<ZNormalization>(DEFAULT_CONFIG.zNormalization);
  const [enableBase, setEnableBase] = useState(DEFAULT_CONFIG.enableBase);
  const [enablePeaks, setEnablePeaks] = useState(DEFAULT_CONFIG.enablePeaks);
  const [enableDense, setEnableDense] = useState(DEFAULT_CONFIG.enableDense);
  const [denseOffsets, setDenseOffsets] = useState(DEFAULT_CONFIG.denseOffsets.join(', '));
  const [mergeEps, setMergeEps] = useState(DEFAULT_CONFIG.mergeEps);
  const [colorSigma, setColorSigma] = useState(DEFAULT_CONFIG.colorSigma);
  const [colorSharpen, setColorSharpen] = useState(DEFAULT_CONFIG.colorSharpen);
  const [colorFloor, setColorFloor] = useState(0.06);
  const [yPhysCurve, setYPhysCurve] = useState(DEFAULT_CONFIG.yPhysCurve);
  const [yCogCurve, setYCogCurve] = useState(DEFAULT_CONFIG.yCogCurve);
  const [targets, setTargets] = useState<RatioTarget[]>(DEFAULT_TARGETS);
  const [maxDen, setMaxDen] = useState(256);
  const [newTargetText, setNewTargetText] = useState('');
  const [newTargetWeight, setNewTargetWeight] = useState(1);
  const [autoCompute, setAutoCompute] = useState(true);
  const [status, setStatus] = useState<'idle' | 'computing' | 'error'>('idle');
  const [error, setError] = useState('');
  const [betaError, setBetaError] = useState('');
  const [result, setResult] = useState<JITopologyResult | null>(null);
  const [cognitiveWeight, setCognitiveWeight] = useState(0.35);
  const [zScale, setZScale] = useState(1);
  const [pointScale, setPointScale] = useState(1.4);
  const [lodAuto, setLodAuto] = useState(true);
  const [lodThreshold, setLodThreshold] = useState(0.9);
  const [hoverInfo, setHoverInfo] = useState<null | {
    n: number;
    z: number;
    yPhys: number;
    yCog: number;
    flags: number;
    deltaP5: number;
    deltaM3: number;
    deltaN7: number;
  }>(null);
  const [qaReport, setQaReport] = useState<string[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string>('');
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const frameRef = useRef<number | null>(null);
  const dataRef = useRef<JITopologyResult | null>(null);
  const zoomRef = useRef(1);
  const nRangeRef = useRef({ nMin, nMax });
  const lodAutoRef = useRef(lodAuto);
  const lodThresholdRef = useRef(lodThreshold);
  const resizeRef = useRef<(() => void) | null>(null);
  const targetRef = useRef(new THREE.Vector3(0, 0, 0));
  const dragStateRef = useRef<null | {
    mode: 'pan' | 'orbit';
    startX: number;
    startY: number;
    startCam: THREE.Vector3;
    startTarget: THREE.Vector3;
    radius: number;
    theta: number;
    phi: number;
  }>(null);

  const parsedTargets = useMemo(() => {
    return targets.map(target => {
      const parsed = parseRatioText(target.text, maxDen);
      if (!parsed) {
        return { ...target, valid: false };
      }
      return {
        ...target,
        valid: true,
        ratio: parsed.ratio,
        num: parsed.num,
        den: parsed.den
      };
    });
  }, [targets, maxDen]);

  const validTargets = useMemo(() => parsedTargets.filter(t => t.valid), [parsedTargets]);
  const invalidTargets = useMemo(() => parsedTargets.filter(t => !t.valid), [parsedTargets]);
  const config = useMemo<JITopologyConfig>(() => {
    const offsets = denseOffsets
      .split(',')
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v >= 0)
      .slice(0, 16);
    const filteredTargets = validTargets.filter(t => {
      const folded = foldRatio(t.ratio, beta);
      if (!Number.isFinite(folded) || folded <= 0) return false;
      const L = Math.log(folded) / Math.log(beta);
      return Number.isFinite(L) && Math.abs(L) >= 1e-12;
    });
    return {
      beta,
      nMin,
      nMax,
      baseStep,
      cPeriod,
      epsilon,
      gamma,
      p,
      weightMode,
      weightNormalization,
      zNormalization,
      enableBase,
      enablePeaks,
      enableDense,
      denseOffsets: offsets.length ? offsets : DEFAULT_CONFIG.denseOffsets,
      mergeEps,
      colorSigma,
      colorSharpen,
      yPhysCurve,
      yCogCurve,
      targets: filteredTargets.map(t => ({
        id: t.id,
        text: t.text,
        ratio: t.ratio,
        weight: clamp(t.weight, 0, 1),
        num: t.num,
        den: t.den,
        label: t.label
      }))
    };
  }, [
    beta,
    nMin,
    nMax,
    baseStep,
    cPeriod,
    epsilon,
    gamma,
    p,
    weightMode,
    weightNormalization,
    zNormalization,
    enableBase,
    enablePeaks,
    enableDense,
    denseOffsets,
    mergeEps,
    colorSigma,
    colorSharpen,
    yPhysCurve,
    yCogCurve,
    validTargets
  ]);

  const configValid = Number.isFinite(beta) && beta > 1 && nMax > nMin && baseStep > 0 && config.targets.length > 0;

  useEffect(() => {
    nRangeRef.current = { nMin, nMax };
    if (resizeRef.current) resizeRef.current();
  }, [nMin, nMax]);

  useEffect(() => {
    lodAutoRef.current = lodAuto;
  }, [lodAuto]);

  useEffect(() => {
    lodThresholdRef.current = lodThreshold;
  }, [lodThreshold]);

  const updateTarget = (id: string, patch: Partial<RatioTarget>) => {
    setTargets(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTarget = (id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  const addTarget = () => {
    const parsed = parseRatioText(newTargetText, maxDen);
    if (!parsed) {
      setError('Invalid ratio format. Use values like 3/2 or 1.25.');
      return;
    }
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTargets(prev => [
      ...prev,
      {
        id,
        text: newTargetText.trim(),
        ratio: parsed.ratio,
        weight: clamp(newTargetWeight, 0, 1),
        num: parsed.num,
        den: parsed.den
      }
    ]);
    setNewTargetText('');
    setNewTargetWeight(1);
    setError('');
  };

  const applyPreset = (preset: 'just5' | 'just7' | 'penta') => {
    if (preset === 'just5') {
      setTargets([
        { id: 't-1', text: '3/2', ratio: 3 / 2, weight: 1, num: 3, den: 2 },
        { id: 't-2', text: '5/4', ratio: 5 / 4, weight: 1, num: 5, den: 4 },
        { id: 't-3', text: '4/3', ratio: 4 / 3, weight: 0.8, num: 4, den: 3 },
        { id: 't-4', text: '6/5', ratio: 6 / 5, weight: 0.6, num: 6, den: 5 }
      ]);
    }
    if (preset === 'just7') {
      setTargets([
        { id: 't-1', text: '3/2', ratio: 3 / 2, weight: 1, num: 3, den: 2 },
        { id: 't-2', text: '5/4', ratio: 5 / 4, weight: 1, num: 5, den: 4 },
        { id: 't-3', text: '7/4', ratio: 7 / 4, weight: 0.9, num: 7, den: 4 },
        { id: 't-4', text: '7/6', ratio: 7 / 6, weight: 0.6, num: 7, den: 6 }
      ]);
    }
    if (preset === 'penta') {
      setTargets([
        { id: 't-1', text: '9/8', ratio: 9 / 8, weight: 0.7, num: 9, den: 8 },
        { id: 't-2', text: '5/4', ratio: 5 / 4, weight: 1, num: 5, den: 4 },
        { id: 't-3', text: '3/2', ratio: 3 / 2, weight: 1, num: 3, den: 2 },
        { id: 't-4', text: '5/3', ratio: 5 / 3, weight: 0.7, num: 5, den: 3 }
      ]);
    }
  };
  const compute = useCallback(() => {
    if (!workerRef.current || !configValid) return;
    const requestId = buildRequestId();
    requestIdRef.current = requestId;
    setStatus('computing');
    setError('');
    workerRef.current.postMessage({ type: 'compute', payload: { requestId, config } });
  }, [config, configValid]);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./jiWorker.ts', import.meta.url), { type: 'module' });
    const worker = workerRef.current;
    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (!payload || payload.requestId !== requestIdRef.current) return;
      if (type === 'result') {
        setResult(payload.result as JITopologyResult);
        dataRef.current = payload.result as JITopologyResult;
        setStatus('idle');
      }
      if (type === 'error') {
        setStatus('error');
        setError(payload.message || 'Worker error');
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!autoCompute) return;
    if (!configValid) return;
    const handle = window.setTimeout(() => compute(), 200);
    return () => window.clearTimeout(handle);
  }, [autoCompute, configValid, compute]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    rendererRef.current = renderer;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05070b');
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
    camera.position.set(0, 0, 300);
    cameraRef.current = camera;

    const geometry = new THREE.BufferGeometry();
    geometryRef.current = geometry;

    const uniforms = {
      u_cognitive_weight: { value: cognitiveWeight },
      u_z_scale: { value: zScale },
      u_point_scale: { value: pointScale },
      u_lod: { value: 0 },
      u_color_floor: { value: colorFloor }
    };

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms,
      vertexShader: `
        attribute float aN;
        attribute float aYPhys;
        attribute float aYCog;
        attribute float aZ;
        attribute vec3 aColor;
        attribute float aFlags;
        uniform float u_cognitive_weight;
        uniform float u_z_scale;
        uniform float u_point_scale;
        uniform float u_lod;
        varying vec3 vColor;
        void main() {
          int flags = int(aFlags + 0.5);
          bool isPeak = (flags & 2) == 2;
          if (u_lod > 0.5 && !isPeak) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            vColor = vec3(0.0);
            return;
          }
          float yFinal = aYPhys * (1.0 - u_cognitive_weight * aYCog);
          vec3 pos = vec3(aN, yFinal, aZ * u_z_scale);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          float size = mix(2.0, 4.0, step(0.8, aZ));
          gl_PointSize = size * u_point_scale;
          vColor = aColor;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        uniform float u_color_floor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float dist = length(uv);
          if (dist > 0.5) discard;
          vec3 color = max(vColor, vec3(u_color_floor));
          gl_FragColor = vec4(color, 0.92);
        }
      `
    });

    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    pointsRef.current = points;
    scene.add(points);

    const resize = () => {
      if (!host || !cameraRef.current || !rendererRef.current) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width <= 0 || height <= 0) return;
      rendererRef.current.setSize(width, height, false);

      const { nMin: minN, nMax: maxN } = nRangeRef.current;
      const xRange = Math.max(1e-6, Math.abs(maxN - minN));
      const yMin = -5;
      const yMax = 105;
      const xPad = xRange * 0.05;

      camera.left = minN - xPad;
      camera.right = maxN + xPad;
      camera.top = yMax;
      camera.bottom = yMin;
      camera.zoom = zoomRef.current;
      const cx = (camera.left + camera.right) / 2;
      const cy = (yMin + yMax) / 2;
      camera.position.set(cx, cy, 300);
      targetRef.current.set(cx, cy, 0);
      camera.lookAt(targetRef.current);
      camera.updateProjectionMatrix();
    };

    resize();
    resizeRef.current = resize;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(host);
    } else {
      window.addEventListener('resize', resize);
    }

    const render = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !materialRef.current) return;
      const zoom = cameraRef.current.zoom || 1;
      const peakCount = dataRef.current?.stats?.peakCount ?? 0;
      const lod = lodAutoRef.current && peakCount > 0 && zoom < lodThresholdRef.current ? 1 : 0;
      materialRef.current.uniforms.u_lod.value = lod;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      frameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', resize);
      }
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      scene.clear();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      pointsRef.current = null;
      geometryRef.current = null;
      materialRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.u_cognitive_weight.value = cognitiveWeight;
    materialRef.current.uniforms.u_z_scale.value = zScale;
    materialRef.current.uniforms.u_point_scale.value = pointScale;
    materialRef.current.uniforms.u_color_floor.value = colorFloor;
  }, [cognitiveWeight, zScale, pointScale, colorFloor]);

  useEffect(() => {
    if (!result || !geometryRef.current) return;
    const geom = geometryRef.current;
    const count = result.n.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const flags = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = result.n[i];
      positions[i * 3 + 1] = result.y_phys[i];
      positions[i * 3 + 2] = result.z_pure[i];
      const rgb = result.rgb[i];
      colors[i * 3] = ((rgb >> 16) & 0xff) / 255;
      colors[i * 3 + 1] = ((rgb >> 8) & 0xff) / 255;
      colors[i * 3 + 2] = (rgb & 0xff) / 255;
      flags[i] = result.flags[i];
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aN', new THREE.BufferAttribute(result.n, 1));
    geom.setAttribute('aYPhys', new THREE.BufferAttribute(result.y_phys, 1));
    geom.setAttribute('aYCog', new THREE.BufferAttribute(result.y_cog, 1));
    geom.setAttribute('aZ', new THREE.BufferAttribute(result.z_pure, 1));
    geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('aFlags', new THREE.BufferAttribute(flags, 1));
    geom.setDrawRange(0, count);
    geom.computeBoundingSphere();
  }, [result]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const camera = cameraRef.current;
      if (!camera) return;
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      const nextZoom = clamp((camera.zoom || 1) + delta, 0.3, 4);
      camera.zoom = nextZoom;
      zoomRef.current = nextZoom;
      camera.updateProjectionMatrix();
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    host.addEventListener('contextmenu', onContextMenu);
    return () => {
      host.removeEventListener('wheel', onWheel);
      host.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const handlePointerDown = (event: PointerEvent) => {
      const camera = cameraRef.current;
      if (!camera) return;
      if (event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      host.setPointerCapture(event.pointerId);
      const target = targetRef.current.clone();
      const camPos = camera.position.clone();
      const offset = camPos.clone().sub(target);
      const radius = Math.max(1e-3, offset.length());
      const theta = Math.atan2(offset.x, offset.z);
      const phi = Math.acos(clamp(offset.y / radius, -1, 1));
      dragStateRef.current = {
        mode: event.button === 2 ? 'orbit' : 'pan',
        startX: event.clientX,
        startY: event.clientY,
        startCam: camPos,
        startTarget: target,
        radius,
        theta,
        phi
      };
      host.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event: PointerEvent) => {
      const camera = cameraRef.current;
      const state = dragStateRef.current;
      if (!camera || !state) return;
      event.preventDefault();
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;

      if (state.mode === 'pan') {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        const worldPerPxX = (camera.right - camera.left) / (width * (camera.zoom || 1));
        const worldPerPxY = (camera.top - camera.bottom) / (height * (camera.zoom || 1));
        const moveX = dx * worldPerPxX;
        const moveY = dy * worldPerPxY;
        camera.position.set(state.startCam.x - moveX, state.startCam.y + moveY, state.startCam.z);
        targetRef.current.set(state.startTarget.x - moveX, state.startTarget.y + moveY, state.startTarget.z);
        camera.lookAt(targetRef.current);
      } else {
        const theta = state.theta - dx * 0.005;
        const phi = clamp(state.phi - dy * 0.005, 0.1, Math.PI - 0.1);
        const r = state.radius;
        const t = state.startTarget;
        const sinPhi = Math.sin(phi);
        const x = t.x + r * sinPhi * Math.sin(theta);
        const y = t.y + r * Math.cos(phi);
        const z = t.z + r * sinPhi * Math.cos(theta);
        camera.position.set(x, y, z);
        camera.lookAt(t);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        host.style.cursor = '';
      }
      if (host.hasPointerCapture(event.pointerId)) {
        host.releasePointerCapture(event.pointerId);
      }
    };

    host.addEventListener('pointerdown', handlePointerDown);
    host.addEventListener('pointermove', handlePointerMove);
    host.addEventListener('pointerup', handlePointerUp);
    host.addEventListener('pointerleave', handlePointerUp);

    const handleMove = (event: MouseEvent) => {
      const camera = cameraRef.current;
      const data = dataRef.current;
      if (!camera || !data) return;
      if (dragStateRef.current) {
        setHoverInfo(null);
        return;
      }
      const rect = host.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const vec = new THREE.Vector3(ndcX, ndcY, 0).unproject(camera);
      const worldX = vec.x;
      const worldY = vec.y;
      const idx = binarySearchNearest(data.n, worldX);
      let best = idx;
      let bestDist = Infinity;
      const start = Math.max(0, idx - 4);
      const end = Math.min(data.n.length - 1, idx + 4);
      for (let i = start; i <= end; i++) {
        const yFinal = data.y_phys[i] * (1 - cognitiveWeight * data.y_cog[i]);
        const dx = data.n[i] - worldX;
        const dy = yFinal - worldY;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      const threshold = Math.pow(Math.max(0.5, (nMax - nMin) / 120), 2);
      if (bestDist > threshold) {
        setHoverInfo(null);
        return;
      }

      const nVal = data.n[best];
      setHoverInfo({
        n: nVal,
        z: data.z_pure[best],
        yPhys: data.y_phys[best],
        yCog: data.y_cog[best],
        flags: data.flags[best],
        deltaP5: signedCentsError(nVal, 3 / 2, beta, cPeriod),
        deltaM3: signedCentsError(nVal, 5 / 4, beta, cPeriod),
        deltaN7: signedCentsError(nVal, 7 / 4, beta, cPeriod)
      });
    };

    const handleLeave = () => setHoverInfo(null);
    host.addEventListener('mousemove', handleMove);
    host.addEventListener('mouseleave', handleLeave);
    return () => {
      host.removeEventListener('pointerdown', handlePointerDown);
      host.removeEventListener('pointermove', handlePointerMove);
      host.removeEventListener('pointerup', handlePointerUp);
      host.removeEventListener('pointerleave', handlePointerUp);
      host.removeEventListener('mousemove', handleMove);
      host.removeEventListener('mouseleave', handleLeave);
    };
  }, [beta, cPeriod, cognitiveWeight, nMax, nMin]);

  useEffect(() => {
    const report: string[] = [];
    const test = (name: string, value: number, expected: number, tol: number) => {
      const diff = Math.abs(value - expected);
      const ok = diff <= tol;
      report.push(`${ok ? 'PASS' : 'WARN'} ${name}: ${value.toFixed(4)} cents (expected ${expected})`);
      if (!ok) {
        report.push(`  Delta = ${diff.toFixed(4)} cents. Check formula/rounding.`);
      }
    };

    const c = 1200;
    const betaTest = 2;
    test('12-EDO fifth', signedCentsError(12, 3 / 2, betaTest, c), -1.955, 0.02);
    test('12-EDO major third', signedCentsError(12, 5 / 4, betaTest, c), 13.686, 0.02);
    test('31-EDO fifth', signedCentsError(31, 3 / 2, betaTest, c), -5.18, 0.05);
    test('31-EDO major third', signedCentsError(31, 5 / 4, betaTest, c), 0.79, 0.05);
    test('31-EDO natural seventh', signedCentsError(31, 7 / 4, betaTest, c), -0.98, 0.2);

    let bestN = 0;
    let bestZ = -Infinity;
    for (let n = 5; n < 60; n++) {
      const d5 = Math.abs(signedCentsError(n, 3 / 2, betaTest, c));
      const d3 = Math.abs(signedCentsError(n, 5 / 4, betaTest, c));
      const d7 = Math.abs(signedCentsError(n, 7 / 4, betaTest, c));
      const E = Math.sqrt(d5 * d5 + d3 * d3 + d7 * d7);
      const z = Math.sqrt(n) / (E + 1e-6);
      if (z > bestZ) {
        bestZ = z;
        bestN = n;
      }
    }
    report.push(`${bestN === 53 ? 'PASS' : 'WARN'} 53-EDO peak check: best n < 60 is ${bestN}.`);

    const edgeBeta = 1.00001;
    const edgeVal = signedCentsError(12, 3 / 2, edgeBeta, c);
    report.push(`${Number.isFinite(edgeVal) ? 'PASS' : 'WARN'} Edge beta 1.00001 finite check: ${edgeVal.toFixed(4)}`);

    const ratios = Array.from({ length: 100 }, (_, i) => (i + 2) / (i + 1));
    const t0 = performance.now();
    const L = ratios.map(r => Math.log(r) / Math.log(betaTest));
    let sum = 0;
    for (let i = 0; i < L.length; i++) {
      const k = 31 * L[i];
      sum += Math.abs(k - Math.round(k));
    }
    const t1 = performance.now() - t0;
    report.push(`${t1 < 200 ? 'PASS' : 'WARN'} Edge 100-ratio compute time: ${t1.toFixed(2)} ms`);

    let maxVal = 0;
    for (let i = 0; i < L.length; i++) {
      const k = 31 * L[i];
      const delta = Math.abs(k - Math.round(k));
      if (delta > maxVal) maxVal = delta;
    }
    const zEdge = Math.sqrt(31) / (maxVal + 1e-6);
    report.push(`${Number.isFinite(zEdge) ? 'PASS' : 'WARN'} Edge p=100 (max) stability: z=${zEdge.toFixed(3)}`);

    setQaReport(report);
  }, []);
  return (
    <div className="h-full w-full bg-black/40 text-gray-200 font-mono flex flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-500/40 p-3 bg-black/60">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">JUST INTONATION TOPOLOGY</div>
          <div className="text-white text-lg font-black tracking-tight">Stability Islands Explorer</div>
          <div className="text-[11px] text-gray-400 font-mono">Continuum of division counts, peak sharpness, and topology scoring.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] sm:justify-end">
          <span className="text-gray-500">Points: {result?.stats.pointCount ?? 0}</span>
          <span className={status === 'error' ? 'text-red-300 font-bold' : 'text-indigo-300 font-bold'}>
            STATUS: {status === 'computing' ? 'COMPUTING' : status === 'error' ? 'ERROR' : 'READY'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="w-full lg:w-[340px] lg:flex-shrink-0 h-[45vh] lg:h-full overflow-y-auto p-3 space-y-3 custom-scrollbar">
          <div className={sectionClass}>
            <div className={labelClass}>Universe</div>
            <label className="text-[9px] text-gray-500">Beta (period ratio)</label>
            <input
              type="number"
              value={beta}
              step="0.0001"
              onChange={(e) => {
                const next = Number(e.target.value);
                if (!Number.isFinite(next)) return;
                setBeta(next);
                if (next <= 1) {
                  setBetaError('Beta must be greater than 1.0');
                } else {
                  setBetaError('');
                }
              }}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-2 text-[9px]">
              <button onClick={() => setBeta(2)} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">Octave (2.0)</button>
              <button onClick={() => setBeta(3)} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">Bohlen-Pierce (3.0)</button>
              <button onClick={() => setBeta(2.01)} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">Stretched (2.01)</button>
            </div>
            <label className="text-[9px] text-gray-500">Cents per period</label>
            <input type="number" value={cPeriod} onChange={(e) => setCPeriod(Number(e.target.value) || 1200)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Epsilon</label>
            <input type="number" value={epsilon} onChange={(e) => setEpsilon(Number(e.target.value) || 1e-6)} className={inputClass} />
            {betaError && <div className="text-[9px] text-red-300">{betaError}</div>}
            {!configValid && <div className="text-[9px] text-red-300">Beta must be &gt; 1 and nMax &gt; nMin.</div>}
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Division Range</div>
            <label className="text-[9px] text-gray-500">n min</label>
            <input type="number" value={nMin} onChange={(e) => setNMin(Number(e.target.value) || 0)} className={inputClass} />
            <label className="text-[9px] text-gray-500">n max</label>
            <input type="number" value={nMax} onChange={(e) => setNMax(Number(e.target.value) || 0)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Base step (dN)</label>
            <input type="number" value={baseStep} onChange={(e) => setBaseStep(Number(e.target.value) || 0.05)} className={inputClass} />
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={enableBase} onChange={(e) => setEnableBase(e.target.checked)} className="accent-indigo-500" />
              Base layer
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={enablePeaks} onChange={(e) => setEnablePeaks(e.target.checked)} className="accent-indigo-500" />
              Peak injection
            </label>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={enableDense} onChange={(e) => setEnableDense(e.target.checked)} className="accent-indigo-500" />
              Dense micro offsets
            </label>
            <label className="text-[9px] text-gray-500">Dense offsets</label>
            <input value={denseOffsets} onChange={(e) => setDenseOffsets(e.target.value)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Merge epsilon</label>
            <input type="number" value={mergeEps} onChange={(e) => setMergeEps(Number(e.target.value) || 1e-5)} className={inputClass} />
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Targets (Just Set)</div>
            <div className="flex flex-wrap gap-2 text-[9px]">
              <button onClick={() => applyPreset('just5')} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">5-limit</button>
              <button onClick={() => applyPreset('just7')} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">7-limit</button>
              <button onClick={() => applyPreset('penta')} className="px-2 py-1 rounded bg-gray-800/70 border border-gray-700">Pentatonic</button>
            </div>
            <label className="text-[9px] text-gray-500">Max denominator (approx)</label>
            <input type="number" value={maxDen} onChange={(e) => setMaxDen(Math.max(2, Number(e.target.value) || 128))} className={inputClass} />

            <div className="space-y-2">
              {parsedTargets.map((target) => (
                <div key={target.id} className={`border rounded p-2 ${target.valid ? 'border-gray-800' : 'border-red-500/60'}`}>
                  <div className="flex items-center gap-2">
                    <input
                      value={target.text}
                      onChange={(e) => updateTarget(target.id, { text: e.target.value })}
                      className="flex-1 min-h-[30px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeTarget(target.id)}
                      className="px-2 py-1 text-[9px] bg-red-900/40 border border-red-500/50 rounded"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] text-gray-500">Weight</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={target.weight}
                      onChange={(e) => updateTarget(target.id, { weight: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-[9px] text-gray-300 w-10 text-right">{target.weight.toFixed(2)}</span>
                  </div>
                  {!target.valid && <div className="text-[9px] text-red-300 mt-1">Invalid ratio.</div>}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-[1fr_72px_auto] gap-2">
              <input
                value={newTargetText}
                onChange={(e) => setNewTargetText(e.target.value)}
                placeholder="Add ratio (e.g., 9/8)"
                className={inputClass}
              />
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={newTargetWeight}
                onChange={(e) => setNewTargetWeight(Number(e.target.value) || 0)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={addTarget}
                className="min-h-[34px] px-3 rounded bg-indigo-700/70 border border-indigo-500 text-[10px] font-bold"
              >
                Add
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] text-gray-500">Weight mode</span>
              <select value={weightMode} onChange={(e) => setWeightMode(e.target.value as WeightMode)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px]">
                <option value="tenney">Tenney</option>
                <option value="euler">Euler Gradus</option>
                <option value="flat">Flat</option>
              </select>
              <span className="text-[9px] text-gray-500">Normalize</span>
              <select value={weightNormalization} onChange={(e) => setWeightNormalization(e.target.value as WeightNormalization)} className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px]">
                <option value="max">Max</option>
                <option value="l1">L1</option>
              </select>
            </div>
            {invalidTargets.length > 0 && (
              <div className="text-[9px] text-yellow-300">Invalid targets are ignored in compute.</div>
            )}
            {config.targets.length === 0 && (
              <div className="text-[9px] text-red-300">Add at least one valid target ratio.</div>
            )}
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Strictness & Normalization</div>
            <label className="text-[9px] text-gray-500">p-norm strictness</label>
            <input type="number" value={p} onChange={(e) => setP(Number(e.target.value) || 1)} className={inputClass} />
            <div className="text-[9px] text-gray-500">p &gt; 8 approximates max()</div>
            <label className="text-[9px] text-gray-500">Normalization</label>
            <select value={zNormalization} onChange={(e) => setZNormalization(e.target.value as ZNormalization)} className={inputClass}>
              <option value="sqrt">sqrt(n) / E</option>
              <option value="gamma">1 / (E * n^gamma)</option>
            </select>
            <label className="text-[9px] text-gray-500">Gamma (gamma)</label>
            <input type="number" value={gamma} onChange={(e) => setGamma(Number(e.target.value) || 0.5)} className={inputClass} />
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Color & Texture</div>
            <label className="text-[9px] text-gray-500">Color sigma (cents)</label>
            <input type="number" value={colorSigma} onChange={(e) => setColorSigma(Number(e.target.value) || 5)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Color sharpen</label>
            <input type="number" value={colorSharpen} onChange={(e) => setColorSharpen(Number(e.target.value) || 1.2)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Visibility floor</label>
            <input type="number" value={colorFloor} onChange={(e) => setColorFloor(clamp(Number(e.target.value) || 0, 0, 0.4))} className={inputClass} />
            <div className="text-[9px] text-gray-500">R=5th, B=3rd, G=7th accuracy.</div>
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Cognitive Filter</div>
            <label className="text-[9px] text-gray-500">Cognitive weight</label>
            <input type="range" min={0} max={1} step={0.01} value={cognitiveWeight} onChange={(e) => setCognitiveWeight(Number(e.target.value))} className="w-full" />
            <div className="text-[9px] text-gray-400">{cognitiveWeight.toFixed(2)}</div>
            <label className="text-[9px] text-gray-500">Physical curve</label>
            <input type="number" value={yPhysCurve} onChange={(e) => setYPhysCurve(Number(e.target.value) || 0.65)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Cognitive curve</label>
            <input type="number" value={yCogCurve} onChange={(e) => setYCogCurve(Number(e.target.value) || 1)} className={inputClass} />
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Visualization</div>
            <label className="text-[9px] text-gray-500">Z scale</label>
            <input type="number" value={zScale} onChange={(e) => setZScale(Number(e.target.value) || 1)} className={inputClass} />
            <label className="text-[9px] text-gray-500">Point scale</label>
            <input type="number" value={pointScale} onChange={(e) => setPointScale(Number(e.target.value) || 1)} className={inputClass} />
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={lodAuto} onChange={(e) => setLodAuto(e.target.checked)} className="accent-indigo-500" />
              Auto LOD (peaks only when zoomed out)
            </label>
            <label className="text-[9px] text-gray-500">LOD threshold (zoom)</label>
            <input type="number" value={lodThreshold} onChange={(e) => setLodThreshold(Number(e.target.value) || 1)} className={inputClass} />
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>Compute</div>
            <label className="flex items-center gap-2 text-[10px] text-gray-400">
              <input type="checkbox" checked={autoCompute} onChange={(e) => setAutoCompute(e.target.checked)} className="accent-indigo-500" />
              Auto compute
            </label>
            <button
              type="button"
              onClick={compute}
              disabled={!configValid}
              className="w-full min-h-[34px] rounded bg-indigo-800/70 border border-indigo-500 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
            >
              Run Compute
            </button>
            {result && (
              <div className="text-[9px] text-gray-400 space-y-1">
                <div>Points: {result.stats.pointCount}</div>
                <div>Peaks injected: {result.stats.peakCount}</div>
                <div>Compute time: {result.stats.computeMs.toFixed(1)} ms</div>
              </div>
            )}
            {error && <div className="text-[9px] text-red-300">{error}</div>}
          </div>

          <div className={sectionClass}>
            <div className={labelClass}>QA Benchmarks</div>
            <div className="text-[9px] text-gray-400 space-y-1">
              {qaReport.map((line, idx) => (
                <div key={`qa-${idx}`}>{line}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <div ref={hostRef} className="absolute inset-0" />
          {(!result || result.stats.pointCount === 0) && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-gray-400 pointer-events-none">
              <div className="bg-black/60 border border-white/10 rounded-lg px-4 py-2">
                {status === 'computing' ? 'Computing grid...' : 'No points yet. Run compute or add valid targets.'}
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 bg-black/60 border border-white/10 rounded-lg p-2 text-[10px] text-gray-200 min-w-[180px]">
            {hoverInfo ? (
              <div className="space-y-1">
                <div className="text-indigo-300 font-bold">n = {hoverInfo.n.toFixed(3)}</div>
                <div>z (pure): {hoverInfo.z.toFixed(3)}</div>
                <div>y phys: {hoverInfo.yPhys.toFixed(1)}</div>
                <div>y cog: {hoverInfo.yCog.toFixed(3)}</div>
                <div>Delta fifth: {hoverInfo.deltaP5.toFixed(3)} cents</div>
                <div>Delta third: {hoverInfo.deltaM3.toFixed(3)} cents</div>
                <div>Delta seventh: {hoverInfo.deltaN7.toFixed(3)} cents</div>
              </div>
            ) : (
              <div className="text-gray-500">Hover a point to inspect.</div>
            )}
          </div>
          <div className="absolute bottom-3 left-3 bg-black/50 border border-white/10 rounded-lg p-2 text-[9px] text-gray-400">
            Scroll to zoom. Left drag to pan. Right drag to orbit.
          </div>
        </div>
      </div>
    </div>
  );
};

export default JustIntonationTopology;
