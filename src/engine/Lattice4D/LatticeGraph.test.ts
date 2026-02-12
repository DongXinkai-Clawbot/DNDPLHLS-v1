import { HarmonicLatticeGraph } from './LatticeGraph';

describe('HarmonicLatticeGraph', () => {
  let graph: HarmonicLatticeGraph;

  beforeEach(() => {
    graph = new HarmonicLatticeGraph([1, 1, 0, 0]); // Small 2D slice for testing (3-limit, 5-limit)
  });

  test('should initialize correctly', () => {
    expect(graph.getNodeCount()).toBe(0);
    expect(graph.getEdges().length).toBe(0);
  });

  test('should generate nodes for [1, 1, 0, 0]', () => {
    // Limits: 3 -> 1, 5 -> 1.
    // Dimensions:
    // P3: -1, 0, 1 (3 nodes)
    // P5: -1, 0, 1 (3 nodes)
    // Total should be 3 * 3 = 9 nodes?
    // Let's trace:
    // (0,0) -> (1,0), (-1,0), (0,1), (0,-1)
    // (1,0) -> (1,1), (1,-1) (Limit 1 reached for P3)
    // ...
    // Yes, 3x3 grid centered at 0,0.
    
    graph.generate();
    
    const nodes = graph.getNodes();
    expect(nodes.length).toBe(9);
    
    // Check specific nodes
    const root = nodes.find(n => n.id === '0,0,0,0');
    expect(root).toBeDefined();
    expect(root?.ratio).toBe(1);

    const p5 = nodes.find(n => n.id === '1,0,0,0'); // 3^1
    expect(p5).toBeDefined();
    expect(p5?.ratio).toBe(3);

    const m3 = nodes.find(n => n.id === '0,1,0,0'); // 5^1
    expect(m3).toBeDefined();
    expect(m3?.ratio).toBe(5);
  });

  test('should generate edges correctly', () => {
    graph.generate();
    const edges = graph.getEdges();
    
    // Each node has potentially 4 neighbors in 2D grid (up, down, left, right)
    // Corners have 2, edges have 3, center has 4.
    // Total edges = sum of degrees / 2? No, directed edges here.
    // Internal edges:
    // Horizontal (P3): 3 rows * 2 links * 2 directions = 12
    // Vertical (P5): 3 cols * 2 links * 2 directions = 12
    // Total = 24 directed edges.
    
    expect(edges.length).toBe(24);
  });

  test('should handle higher dimensions', () => {
    // [1, 1, 1, 0] -> 3x3x3 = 27 nodes
    graph = new HarmonicLatticeGraph([1, 1, 1, 0]);
    graph.generate();
    expect(graph.getNodeCount()).toBe(27);
  });
});
