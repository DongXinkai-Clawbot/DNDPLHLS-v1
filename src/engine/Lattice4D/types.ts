/**
 * @module Lattice4D
 * @description Type definitions for the 4-Dimensional Prime Limit Harmonic Lattice engine.
 *
 * This module defines the core data structures used to represent harmonic lattice nodes
 * in a 4-dimensional space (typically representing prime factors 3, 5, 7, 11).
 */

import { Vector3, Vector4 } from 'three';

/**
 * Represents a single node in the harmonic lattice.
 * Each node corresponds to a specific frequency ratio derived from prime factors.
 */
export interface LatticeNode {
  /** Unique identifier for the node, typically a string representation of its prime coordinates (e.g., "0,1,-1,0") */
  id: string;

  /**
   * The 4-dimensional integer coordinates representing the powers of the prime factors.
   * [p3, p5, p7, p11] where ratio = 3^p3 * 5^p5 * 7^p7 * 11^p11
   */
  coordinates: [number, number, number, number];

  /** The frequency ratio of this node relative to the root (1/1). */
  ratio: number;

  /** The cent value deviation from the root. */
  cents: number;

  /** The degree of dissonance or complexity associated with this ratio. */
  complexity?: number;

  /** Optional localized position in 3D space after projection. */
  position?: Vector3;
}

/**
 * Represents a connection (edge) between two nodes in the lattice.
 * Edges typically represent specific musical intervals (e.g., a perfect fifth, major third).
 */
export interface LatticeEdge {
  /** The ID of the source node. */
  sourceId: string;

  /** The ID of the target node. */
  targetId: string;

  /** The prime factor associated with this edge (e.g., 3 for a P5, 5 for a M3). */
  primeFactor: number;

  /** The interval name (e.g., "P5", "M3"). */
  intervalName: string;
}

/**
 * Configuration for the 4D to 3D projection.
 * Determines how the 4 basis vectors of the 4D lattice are mapped into 3D space.
 */
export interface ProjectionConfig {
  /** The 3D vector representing the direction of the prime 3 axis. */
  axis3: Vector3;
  /** The 3D vector representing the direction of the prime 5 axis. */
  axis5: Vector3;
  /** The 3D vector representing the direction of the prime 7 axis. */
  axis7: Vector3;
  /** The 3D vector representing the direction of the prime 11 axis. */
  axis11: Vector3;

  /** Global scaling factor for the lattice visualization. */
  scale: number;
}
