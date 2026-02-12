import type {
  WorkspaceLayoutNode,
  WorkspacePaneNode,
  WorkspaceSplitDirection,
  WorkspaceSplitNode,
  WorkspaceTemplateId,
  WorkspaceViewType
} from '../types';

const DEFAULT_MIN_WIDTH = 280;
const DEFAULT_MIN_HEIGHT = 220;

export const createPaneNode = (
  paneId: string,
  viewType: WorkspaceViewType,
  overrides?: Partial<WorkspacePaneNode>
): WorkspacePaneNode => ({
  type: 'pane',
  paneId,
  viewType,
  viewState: {},
  minWidth: DEFAULT_MIN_WIDTH,
  minHeight: DEFAULT_MIN_HEIGHT,
  ...(overrides || {})
});

export const createSplitNode = (
  direction: WorkspaceSplitDirection,
  ratio: number,
  a: WorkspaceLayoutNode,
  b: WorkspaceLayoutNode
): WorkspaceSplitNode => ({
  type: 'split',
  direction,
  ratio,
  a,
  b
});

export const updatePaneNode = (
  node: WorkspaceLayoutNode,
  paneId: string,
  updater: (pane: WorkspacePaneNode) => WorkspacePaneNode
): WorkspaceLayoutNode => {
  if (node.type === 'pane') {
    return node.paneId === paneId ? updater(node) : node;
  }
  return {
    ...node,
    a: updatePaneNode(node.a, paneId, updater),
    b: updatePaneNode(node.b, paneId, updater)
  };
};

export const splitPaneNode = (
  node: WorkspaceLayoutNode,
  paneId: string,
  direction: WorkspaceSplitDirection,
  nextPane: WorkspacePaneNode,
  ratio = 0.5,
  placeBefore = false
): WorkspaceLayoutNode => {
  if (node.type === 'pane') {
    if (node.paneId !== paneId) return node;
    return placeBefore
      ? createSplitNode(direction, ratio, nextPane, node)
      : createSplitNode(direction, ratio, node, nextPane);
  }
  return {
    ...node,
    a: splitPaneNode(node.a, paneId, direction, nextPane, ratio, placeBefore),
    b: splitPaneNode(node.b, paneId, direction, nextPane, ratio, placeBefore)
  };
};

export const removePaneNode = (node: WorkspaceLayoutNode, paneId: string): WorkspaceLayoutNode | null => {
  if (node.type === 'pane') {
    return node.paneId === paneId ? null : node;
  }
  const nextA = removePaneNode(node.a, paneId);
  const nextB = removePaneNode(node.b, paneId);
  if (!nextA && !nextB) return null;
  if (!nextA) return nextB;
  if (!nextB) return nextA;
  return { ...node, a: nextA, b: nextB };
};

export const getPaneIds = (node: WorkspaceLayoutNode): string[] => {
  if (node.type === 'pane') return [node.paneId];
  return [...getPaneIds(node.a), ...getPaneIds(node.b)];
};

export const hasPaneViewType = (
  node: WorkspaceLayoutNode,
  viewType: WorkspaceViewType
): boolean => {
  if (node.type === 'pane') {
    return node.viewType === viewType;
  }
  return hasPaneViewType(node.a, viewType) || hasPaneViewType(node.b, viewType);
};

export const getMinSize = (node: WorkspaceLayoutNode): { minWidth: number; minHeight: number } => {
  if (node.type === 'pane') {
    return {
      minWidth: node.minWidth ?? DEFAULT_MIN_WIDTH,
      minHeight: node.minHeight ?? DEFAULT_MIN_HEIGHT
    };
  }
  const a = getMinSize(node.a);
  const b = getMinSize(node.b);
  if (node.direction === 'row') {
    return {
      minWidth: a.minWidth + b.minWidth,
      minHeight: Math.max(a.minHeight, b.minHeight)
    };
  }
  return {
    minWidth: Math.max(a.minWidth, b.minWidth),
    minHeight: a.minHeight + b.minHeight
  };
};

export const buildWorkspaceTemplate = (
  template: WorkspaceTemplateId,
  startId = 1
): { layout: WorkspaceLayoutNode; nextId: number } => {
  let nextId = startId;
  const makePane = (viewType: WorkspaceViewType) => createPaneNode(`pane-${nextId++}`, viewType);

  if (template === 'single') {
    const layout = makePane('hunt');
    return { layout, nextId };
  }

  if (template === 'split-vertical') {
    const layout = createSplitNode('row', 0.5, makePane('hunt'), makePane('ji-scroller'));
    return { layout, nextId };
  }

  if (template === 'split-horizontal') {
    const layout = createSplitNode('col', 0.5, makePane('ji-scroller'), makePane('lattice'));
    return { layout, nextId };
  }

  if (template === 'grid-2x2') {
    const top = createSplitNode('row', 0.5, makePane('hunt'), makePane('ji-scroller'));
    const bottom = createSplitNode('row', 0.5, makePane('lattice'), makePane('empty'));
    const layout = createSplitNode('col', 0.5, top, bottom);
    return { layout, nextId };
  }

  const layout = createSplitNode(
    'row',
    0.33,
    makePane('hunt'),
    createSplitNode('row', 0.5, makePane('ji-scroller'), makePane('lattice'))
  );
  return { layout, nextId };
};
