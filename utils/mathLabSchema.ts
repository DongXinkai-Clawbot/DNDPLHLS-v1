import type { MathLabState, MathNoteSet, MathObject, MathSamplingSettings, MathDot, DotQuantizeMode } from '../types';

export const MATHLAB_SCHEMA_VERSION = 4;

const clampNumber = (value: any, fallback: number, min?: number, max?: number) => {
  const v = Number.isFinite(value) ? Number(value) : fallback;
  if (min !== undefined && v < min) return min;
  if (max !== undefined && v > max) return max;
  return v;
};

const sanitizeSampling = (incoming: any, fallback: MathSamplingSettings): MathSamplingSettings => {
  const quantize = (incoming?.quantize as DotQuantizeMode) || fallback.quantize;
  const strategy = incoming?.strategy;
  const resolvedStrategy =
    strategy === 'uniform_x' || strategy === 'uniform_param' || strategy === 'arc_length'
      || strategy === 'adaptive_pixel' || strategy === 'adaptive_curvature'
      ? strategy
      : fallback.strategy;
  const invalidPolicy = incoming?.invalidPolicy;
  const resolvedInvalidPolicy =
    invalidPolicy === 'skip' || invalidPolicy === 'clamp' || invalidPolicy === 'mark' || invalidPolicy === 'break'
      ? invalidPolicy
      : fallback.invalidPolicy;
  return {
    sampleCount: clampNumber(incoming?.sampleCount, fallback.sampleCount, 10, 5000),
    strategy: resolvedStrategy,
    mappingMode: incoming?.mappingMode || fallback.mappingMode,
    boundedRange: {
      min: clampNumber(incoming?.boundedRange?.min, fallback.boundedRange.min),
      max: clampNumber(incoming?.boundedRange?.max, fallback.boundedRange.max),
    },
    complexComponent: incoming?.complexComponent || fallback.complexComponent,
    implicitResolution: Number.isFinite(incoming?.implicitResolution) ? Number(incoming.implicitResolution) : fallback.implicitResolution,
    invalidPolicy: resolvedInvalidPolicy,
    baseFreq: clampNumber(incoming?.baseFreq, fallback.baseFreq, 1, 20000),
    rangeMin: clampNumber(incoming?.rangeMin, fallback.rangeMin, 1, 20000),
    rangeMax: clampNumber(incoming?.rangeMax, fallback.rangeMax, 1, 20000),
    quantize,
    edoDivisions: Number.isFinite(incoming?.edoDivisions) ? Number(incoming.edoDivisions) : fallback.edoDivisions,
    centsStep: Number.isFinite(incoming?.centsStep) ? Number(incoming.centsStep) : fallback.centsStep,
    normalizeToOctave: incoming?.normalizeToOctave ?? fallback.normalizeToOctave,
    primeLimit: Number.isFinite(incoming?.primeLimit) ? Number(incoming.primeLimit) : fallback.primeLimit,
  };
};

const sanitizeDot = (incoming: any, idx: number): MathDot => {
  const role = incoming?.role === 'chord' || incoming?.role === 'marker' || incoming?.role === 'scale' || incoming?.role === 'ignore'
    ? incoming.role
    : (incoming?.role === 'control' ? 'marker' : 'scale');
  return {
    id: typeof incoming?.id === 'string' ? incoming.id : `dot-${Date.now()}-${idx}`,
    x: clampNumber(incoming?.x, 0),
    y: clampNumber(incoming?.y, 0),
    label: typeof incoming?.label === 'string' ? incoming.label : '',
    color: typeof incoming?.color === 'string' ? incoming.color : undefined,
    role,
    locked: !!incoming?.locked,
    sourceObjectId: typeof incoming?.sourceObjectId === 'string' ? incoming.sourceObjectId : undefined,
    u: Number.isFinite(incoming?.u) ? Number(incoming.u) : undefined,
    generatedAt: typeof incoming?.generatedAt === 'string' ? incoming.generatedAt : undefined,
    segmentId: Number.isFinite(incoming?.segmentId) ? Number(incoming.segmentId) : undefined,
  };
};

const sanitizeNoteSet = (incoming: any, fallback: MathNoteSet, idx: number): MathNoteSet => {
  const base = fallback;
  const mapping = sanitizeSampling(incoming?.mapping, base.mapping);
  const playback = {
    mode: incoming?.playback?.mode === 'chord' || incoming?.playback?.mode === 'arp' ? incoming.playback.mode : 'scale',
    order: incoming?.playback?.order === 'y' || incoming?.playback?.order === 'custom' || incoming?.playback?.order === 'created'
      ? incoming.playback.order
      : 'x',
    speedUnit: incoming?.playback?.speedUnit === 'ms' ? 'ms' : 'bpm',
    bpm: clampNumber(incoming?.playback?.bpm, base.playback.bpm, 20, 400),
    noteMs: clampNumber(incoming?.playback?.noteMs, base.playback.noteMs, 0, 60000),
    gapMs: clampNumber(incoming?.playback?.gapMs, base.playback.gapMs, 0, 60000),
    chordMs: clampNumber(incoming?.playback?.chordMs, base.playback.chordMs, 20, 60000),
    gate: clampNumber(incoming?.playback?.gate, base.playback.gate ?? 0.8, 0, 1),
  };
  return {
    id: typeof incoming?.id === 'string' ? incoming.id : `set-${Date.now()}-${idx}`,
    name: typeof incoming?.name === 'string' ? incoming.name : base.name,
    createdAt: typeof incoming?.createdAt === 'string' ? incoming.createdAt : new Date().toISOString(),
    updatedAt: typeof incoming?.updatedAt === 'string' ? incoming.updatedAt : new Date().toISOString(),
    dots: Array.isArray(incoming?.dots) ? incoming.dots.map((d: any, i: number) => sanitizeDot(d, i)) : base.dots,
    mapping,
    playback,
    timelineGrid: incoming?.timelineGrid ? {
      snapX: !!incoming.timelineGrid.snapX,
      xStep: clampNumber(incoming.timelineGrid.xStep, 0),
    } : base.timelineGrid,
    export: incoming?.export ? {
      order: incoming.export.order === 'y' || incoming.export.order === 'custom' || incoming.export.order === 'created'
        ? incoming.export.order
        : 'x',
      dedupe: incoming.export.dedupe !== undefined ? !!incoming.export.dedupe : true,
      normalizeToOctave: incoming.export.normalizeToOctave !== undefined ? !!incoming.export.normalizeToOctave : true,
    } : base.export,
  };
};

const sanitizeObject = (incoming: any, idx: number): MathObject => {
  const type = incoming?.type;
  const safeType = type === 'parametric' || type === 'polar' || type === 'implicit' || type === 'point' || type === 'vector_field'
    ? type
    : 'explicit';
  return {
    id: typeof incoming?.id === 'string' ? incoming.id : `obj-${Date.now()}-${idx}`,
    name: typeof incoming?.name === 'string' && incoming.name.trim() ? incoming.name : (typeof incoming?.expression === 'string' ? incoming.expression.slice(0, 24) : `Object ${idx + 1}`),
    type: safeType,
    expression: typeof incoming?.expression === 'string' ? incoming.expression : 'x',
    params: {
      min: clampNumber(incoming?.params?.min, -10),
      max: clampNumber(incoming?.params?.max, 10),
    },
    visible: incoming?.visible !== undefined ? !!incoming.visible : true,
    color: typeof incoming?.color === 'string' ? incoming.color : '#3b82f6',
    locked: !!incoming?.locked,
    mappingEnabled: incoming?.mappingEnabled !== undefined ? !!incoming.mappingEnabled : true,
    tags: Array.isArray(incoming?.tags) ? incoming.tags.map(String) : undefined,
    group: typeof incoming?.group === 'string' ? incoming.group : 'default',
    order: Number.isFinite(incoming?.order) ? Number(incoming.order) : idx,
    implicitResolutionMode: incoming?.implicitResolutionMode === 'manual' ? 'manual' : 'auto',
    implicitResolution: Number.isFinite(incoming?.implicitResolution) ? Number(incoming.implicitResolution) : undefined,
    implicitShowAll: incoming?.implicitShowAll !== undefined ? !!incoming.implicitShowAll : true,
    angleUnit: incoming?.angleUnit === 'deg' ? 'deg' : 'rad',
    polarNegativeMode: incoming?.polarNegativeMode === 'clamp' ? 'clamp' : 'allow',
    samplingOverride: incoming?.samplingOverride ? {
      enabled: incoming.samplingOverride.enabled !== undefined ? !!incoming.samplingOverride.enabled : false,
      sampleCount: Number.isFinite(incoming.samplingOverride.sampleCount) ? Number(incoming.samplingOverride.sampleCount) : undefined,
      strategy: incoming.samplingOverride.strategy === 'uniform_x' || incoming.samplingOverride.strategy === 'uniform_param'
        || incoming.samplingOverride.strategy === 'arc_length' || incoming.samplingOverride.strategy === 'adaptive_pixel'
        || incoming.samplingOverride.strategy === 'adaptive_curvature'
        ? incoming.samplingOverride.strategy
        : undefined,
    } : undefined,
  };
};

export const createDefaultMathLabState = (): MathLabState => {
  const now = new Date().toISOString();
  const defaultSampling: MathSamplingSettings = {
    sampleCount: 300,
    strategy: 'uniform_param',
    mappingMode: 'y_ratio',
    boundedRange: { min: 200, max: 800 },
    quantize: 'none',
    complexComponent: 'abs',
    implicitResolution: undefined,
    invalidPolicy: 'break',
    baseFreq: 440,
    rangeMin: 20,
    rangeMax: 20000,
    edoDivisions: 12,
    centsStep: 50,
    normalizeToOctave: false,
    primeLimit: 11,
  };
  const defaultNoteSet: MathNoteSet = {
    id: 'set-1',
    name: 'Default Note Set',
    createdAt: now,
    updatedAt: now,
    dots: [],
    mapping: { ...defaultSampling },
    playback: {
      mode: 'scale',
      order: 'x',
      speedUnit: 'bpm',
      bpm: 90,
      noteMs: 500,
      gapMs: 120,
      chordMs: 1500,
      gate: 0.8,
    },
    export: {
      order: 'x',
      dedupe: true,
      normalizeToOctave: true,
    },
  };

  return {
    version: MATHLAB_SCHEMA_VERSION,
    objects: [],
    view: { xMin: -10, xMax: 10, yMin: -10, yMax: 10, grid: true },
    sampling: { ...defaultSampling },
    noteSets: [defaultNoteSet],
    activeNoteSetId: defaultNoteSet.id,
    editor: {
      tool: 'pan',
      selectedDotId: null,
      selectedObjectId: null,
      hoverDotId: null,
      showThumbnails: true,
      showDotLabels: true,
      showDebugPitch: false,
      snapThresholdPx: 14,
      snapThresholdMath: 0.25,
      snapTarget: 'visible',
      snapUseHighRes: true,
      snapGroup: 'default',
    },
    consequentialScales: [],
    activeConsequentialScaleId: null,
    consequentialCache: {},
    unifiedFunctionState: { variableBindings: {}, variableDefs: {} },
  };
};

export const migrateMathLabState = (incoming: any, fallback: MathLabState) => {
  const base = fallback;
  if (!incoming || typeof incoming !== 'object') {
    return { next: base, warnings: ['Invalid mathLab payload'] };
  }

  const warnings: string[] = [];
  const objects = Array.isArray(incoming.objects)
    ? incoming.objects.map((o: any, i: number) => sanitizeObject(o, i))
    : base.objects;

  const view = incoming.view ? {
    xMin: clampNumber(incoming.view.xMin, base.view.xMin),
    xMax: clampNumber(incoming.view.xMax, base.view.xMax),
    yMin: clampNumber(incoming.view.yMin, base.view.yMin),
    yMax: clampNumber(incoming.view.yMax, base.view.yMax),
    grid: incoming.view.grid !== undefined ? !!incoming.view.grid : base.view.grid,
  } : base.view;

  const sampling = sanitizeSampling(incoming.sampling, base.sampling);

  const noteSets = Array.isArray(incoming.noteSets)
    ? incoming.noteSets.map((n: any, i: number) => sanitizeNoteSet(n, base.noteSets[0] || createDefaultMathLabState().noteSets[0], i))
    : base.noteSets;

  const activeNoteSetId = typeof incoming.activeNoteSetId === 'string'
    ? incoming.activeNoteSetId
    : base.activeNoteSetId;

  const editor = incoming.editor ? {
    tool: incoming.editor.tool === 'select' || incoming.editor.tool === 'add_dot' || incoming.editor.tool === 'delete' ? incoming.editor.tool : base.editor.tool,
    selectedDotId: incoming.editor.selectedDotId ?? base.editor.selectedDotId,
    selectedObjectId: incoming.editor.selectedObjectId ?? base.editor.selectedObjectId,
    hoverDotId: incoming.editor.hoverDotId ?? base.editor.hoverDotId,
    showThumbnails: incoming.editor.showThumbnails !== undefined ? !!incoming.editor.showThumbnails : base.editor.showThumbnails,
    showDotLabels: incoming.editor.showDotLabels !== undefined ? !!incoming.editor.showDotLabels : base.editor.showDotLabels,
    showDebugPitch: incoming.editor.showDebugPitch !== undefined ? !!incoming.editor.showDebugPitch : base.editor.showDebugPitch,
    snapThresholdPx: clampNumber(incoming.editor.snapThresholdPx, base.editor.snapThresholdPx ?? 14, 1, 200),
    snapThresholdMath: clampNumber(incoming.editor.snapThresholdMath, base.editor.snapThresholdMath ?? 0.25, 0, 1000),
    snapTarget: incoming.editor.snapTarget === 'selected' || incoming.editor.snapTarget === 'mapping' || incoming.editor.snapTarget === 'group'
      ? incoming.editor.snapTarget
      : (incoming.editor.snapTarget === 'visible' ? 'visible' : base.editor.snapTarget),
    snapUseHighRes: incoming.editor.snapUseHighRes !== undefined ? !!incoming.editor.snapUseHighRes : base.editor.snapUseHighRes,
    snapGroup: typeof incoming.editor.snapGroup === 'string' ? incoming.editor.snapGroup : base.editor.snapGroup,
  } : base.editor;

  const unified = incoming.unifiedFunctionState || {};
  const unifiedFunctionState = {
    variableBindings: typeof unified.variableBindings === 'object' && unified.variableBindings ? unified.variableBindings : {},
    variableDefs: typeof unified.variableDefs === 'object' && unified.variableDefs ? unified.variableDefs : {},
  };

  if (!Array.isArray(incoming.objects)) warnings.push('Missing objects list; used defaults');
  if (!Array.isArray(incoming.noteSets)) warnings.push('Missing noteSets; used defaults');

  return {
    next: {
      version: MATHLAB_SCHEMA_VERSION,
      objects,
      view,
      sampling,
      noteSets,
      activeNoteSetId,
      editor,
      consequentialScales: Array.isArray(incoming.consequentialScales) ? incoming.consequentialScales : base.consequentialScales,
      activeConsequentialScaleId: incoming.activeConsequentialScaleId ?? base.activeConsequentialScaleId,
      consequentialCache: incoming.consequentialCache || {},
      unifiedFunctionState,
    },
    warnings,
  };
};
