/**
 * @module GeneticTuner
 * @description Type definitions for the Genetic Algorithm based Temperament Solver.
 */

/**
 * Represents a single candidate solution (genome) in the population.
 */
export interface Individual {
  /**
   * The genetic code. For temperament tuning, this is typically an array of cents values
   * representing the tuning of prime factors or generators.
   */
  genes: number[];

  /**
   * The fitness score of this individual.
   * Higher is usually better, but for error minimization, we might invert it or use cost.
   * Here, we use fitness (higher = better).
   */
  fitness: number;

  /**
   * Optional metadata about what this tuning represents (e.g. "Meantone", "Werckmeister").
   */
  metadata?: Record<string, any>;
}

/**
 * Configuration for the Genetic Algorithm.
 */
export interface GeneticConfig {
  /** Size of the population in each generation. */
  populationSize: number;

  /** Probability of mutation for each gene (0.0 to 1.0). */
  mutationRate: number;

  /** Magnitude of mutation (max change in cents). */
  mutationAmount: number;

  /** Probability of crossover between two parents. */
  crossoverRate: number;

  /** Number of elite individuals to preserve unchanged. */
  elitismCount: number;

  /** Maximum number of generations to run. */
  maxGenerations: number;
}

/**
 * Interface for the fitness function.
 * Takes a genome and returns a fitness score.
 */
export interface FitnessFunction {
  (genes: number[]): number;
}
