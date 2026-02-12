/**
 * @module Lattice4D
 * @description Core logic for constructing the 4-Dimensional Prime Limit Harmonic Lattice.
 *
 * This class handles the graph traversal and generation of harmonic nodes based on prime limits.
 * It ensures unique nodes and handles the complex 4D coordinate system mapping.
 */

import { LatticeNode, LatticeEdge } from './types';
import { Vector3 } from 'three';

/**
 * Prime factors used for the 4 axes.
 * Typically 3, 5, 7, 11 (Prime Limit 11).
 */
const PRIMES = [3, 5, 7, 11];

/**
 * Manages the data structure for the 4D Harmonic Lattice.
 * It generates nodes through recursive exploration or bounded grid generation.
 */
export class HarmonicLatticeGraph {
  /**
   * Map of node IDs to LatticeNode objects for O(1) retrieval.
   * Key is the coordinate string (e.g., "0,1,-1,2").
   */
  private nodes: Map<string, LatticeNode>;

  /**
   * Array of edges connecting the nodes.
   */
  private edges: LatticeEdge[];

  /**
   * Maximum depth of exploration for each prime factor.
   * [limit3, limit5, limit7, limit11]
   */
  private limits: [number, number, number, number];

  /**
   * Constructs a new Harmonic Lattice Graph.
   * @param limits Maximum steps in each prime direction [3, 5, 7, 11]. Defaults to [3, 2, 1, 1].
   */
  constructor(limits: [number, number, number, number] = [3, 2, 1, 1]) {
    this.nodes = new Map();
    this.edges = [];
    this.limits = limits;
  }

  /**
   * Generates the lattice graph starting from the origin (1/1).
   * Uses Breadth-First Search (BFS) to explore adjacent nodes within the specified limits.
   */
  generate(): void {
    // Reset graph
    this.nodes.clear();
    this.edges = [];

    // Root node: 1/1 (0, 0, 0, 0)
    const rootCoords: [number, number, number, number] = [0, 0, 0, 0];
    const rootNode = this.createNode(rootCoords);
    this.nodes.set(rootNode.id, rootNode);

    const queue: LatticeNode[] = [rootNode];
    const visited = new Set<string>();
    visited.add(rootNode.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const [p3, p5, p7, p11] = current.coordinates;

      // Explore neighbors for each prime factor (positive and negative directions)
      // Prime 3 (Index 0)
      this.exploreNeighbor(current, 0, 1, visited, queue);
      this.exploreNeighbor(current, 0, -1, visited, queue);

      // Prime 5 (Index 1)
      this.exploreNeighbor(current, 1, 1, visited, queue);
      this.exploreNeighbor(current, 1, -1, visited, queue);

      // Prime 7 (Index 2)
      this.exploreNeighbor(current, 2, 1, visited, queue);
      this.exploreNeighbor(current, 2, -1, visited, queue);

      // Prime 11 (Index 3)
      this.exploreNeighbor(current, 3, 1, visited, queue);
      this.exploreNeighbor(current, 3, -1, visited, queue);
    }
  }

  /**
   * Explores a neighbor in a specific prime dimension.
   * @param current The current node.
   * @param dimensionIndex Index of the prime dimension (0=3, 1=5, 2=7, 3=11).
   * @param direction Direction of movement (1 or -1).
   * @param visited Set of visited node IDs.
   * @param queue BFS queue.
   */
  private exploreNeighbor(
    current: LatticeNode,
    dimensionIndex: number,
    direction: number,
    visited: Set<string>,
    queue: LatticeNode[]
  ): void {
    const newCoords = [...current.coordinates] as [number, number, number, number];
    newCoords[dimensionIndex] += direction;

    // Check bounds
    if (Math.abs(newCoords[dimensionIndex]) > this.limits[dimensionIndex]) {
      return;
    }

    const newNodeId = newCoords.join(',');
    let neighborNode = this.nodes.get(newNodeId);
    let isNew = false;

    if (!neighborNode) {
      neighborNode = this.createNode(newCoords);
      this.nodes.set(newNodeId, neighborNode);
      isNew = true;
    }

    // Add edge
    this.edges.push({
      sourceId: current.id,
      targetId: neighborNode.id,
      primeFactor: PRIMES[dimensionIndex],
      intervalName: this.getIntervalName(PRIMES[dimensionIndex], direction),
    });

    if (isNew) {
      // If we just created it, we must add it to the queue to explore its neighbors
      // But we must also ensure we don't re-queue if we visit it again from another path
      if (!visited.has(neighborNode.id)) {
        visited.add(neighborNode.id);
        queue.push(neighborNode);
      }
    }
  }

  /**
   * Creates a LatticeNode from coordinates.
   * Calculates ratio and cents.
   * @param coords The 4D coordinates.
   * @returns A fully populated LatticeNode.
   */
  private createNode(coords: [number, number, number, number]): LatticeNode {
    const [p3, p5, p7, p11] = coords;
    
    // Calculate raw frequency ratio
    // ratio = 3^p3 * 5^p5 * 7^p7 * 11^p11
    // We normalize to octave [1, 2) usually, but here we store the raw absolute ratio first.
    // However, for floating point stability, we might want to compute cents directly or use a Fraction class.
    // For this engine, we use double precision float for ratio.
    
    let ratio = Math.pow(3, p3) * Math.pow(5, p5) * Math.pow(7, p7) * Math.pow(11, p11);

    // Cents calculation: 1200 * log2(ratio)
    // Note: This is the absolute cents from 1/1, not octave reduced.
    const cents = 1200 * Math.log2(ratio);

    return {
      id: coords.join(','),
      coordinates: coords,
      ratio: ratio,
      cents: cents,
      complexity: Math.abs(p3) + Math.abs(p5) + Math.abs(p7) + Math.abs(p11), // Simple Manhattan distance complexity
    };
  }

  /**
   * Helper to name basic intervals.
   * @param prime The prime factor.
   * @param direction The direction (positive/negative).
   */
  private getIntervalName(prime: number, direction: number): string {
    const sign = direction > 0 ? '+' : '-';
    switch (prime) {
      case 3: return direction > 0 ? 'P5' : 'P4'; // Perfect Fifth / Fourth (approx)
      case 5: return direction > 0 ? 'M3' : 'm6'; // Major Third / Minor Sixth
      case 7: return direction > 0 ? 'H7' : 'H1'; // Harmonic 7th / Inverse
      case 11: return direction > 0 ? 'U11' : 'L11'; // Undecimal 11th
      default: return `${sign}${prime}`;
    }
  }

  /**
   * Returns all generated nodes.
   */
  getNodes(): LatticeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns all edges.
   */
  getEdges(): LatticeEdge[] {
    return this.edges;
  }

  /**
   * Returns the total number of nodes in the graph.
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Finds nodes that represent "commas" (intervals very close to unison).
   * These are useful for identifying potential temperament options.
   * 
   * @param thresholdCents The maximum deviation from unison in cents. Default 25.
   * @returns Array of LatticeNodes that are within the threshold but not the root.
   */
  findCommas(thresholdCents: number = 25): LatticeNode[] {
    const commas: LatticeNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.id === '0,0,0,0') continue;
      
      // We look for proximity to ANY octave of the root?
      // Usually commas are small intervals.
      // But 1200.01 cents is also a comma (approx octave).
      // We are interested in `abs(cents % 1200)`?
      // Or just small absolute ratios.
      // Syntonic comma is 21.5 cents.
      // Pythagorean comma is 23.5 cents.
      
      // Let's normalize cents to nearest octave.
      const octaves = Math.round(node.cents / 1200);
      const deviation = Math.abs(node.cents - (octaves * 1200));
      
      if (deviation < thresholdCents && deviation > 0.001) {
        commas.push(node);
      }
    }
    // Sort by complexity (simplest commas first)
    return commas.sort((a, b) => (a.complexity || 0) - (b.complexity || 0));
  }
}
