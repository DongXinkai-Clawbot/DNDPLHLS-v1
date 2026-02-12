/**
 * @module GeneticTuner
 * @description Core implementation of the Genetic Algorithm solver for temperament finding.
 */

import { Individual, GeneticConfig, FitnessFunction } from './types';

/**
 * Manages the genetic evolution of temperament tunings.
 * Uses a population-based approach to explore the search space of tunings.
 */
export class GeneticSolver {
  private population: Individual[];
  private config: GeneticConfig;
  private fitnessFn: FitnessFunction;
  private generation: number;

  /**
   * Creates a new Genetic Solver.
   * @param config Configuration for the GA.
   * @param fitnessFn Function to evaluate the fitness of a genome (array of numbers).
   * @param geneLength The number of genes (e.g. number of prime factors or generators).
   * @param initialRange Range [min, max] for random initialization of genes.
   */
  constructor(
    config: GeneticConfig,
    fitnessFn: FitnessFunction,
    geneLength: number,
    initialRange: [number, number]
  ) {
    this.config = config;
    this.fitnessFn = fitnessFn;
    this.generation = 0;
    this.population = this.initializePopulation(geneLength, initialRange);
    this.evaluateFitness(); // Evaluate initial population immediately
  }

  /**
   * Initializes a random population of individuals.
   * @param geneLength Length of the genome.
   * @param range Range for random initialization.
   */
  private initializePopulation(geneLength: number, range: [number, number]): Individual[] {
    const population: Individual[] = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      const genes = Array.from({ length: geneLength }, () => 
        range[0] + Math.random() * (range[1] - range[0])
      );
      population.push({ genes, fitness: 0 });
    }
    return population;
  }

  /**
   * Runs the genetic algorithm for one generation.
   * Evaluates fitness, selects parents, breeds new population.
   */
  step(): void {
    // 1. Sort by fitness (descending) for elitism
    // Assumes current population is already evaluated (from constructor or previous step)
    this.population.sort((a, b) => b.fitness - a.fitness);

    // 2. Selection & Breeding
    const newPopulation: Individual[] = [];

    // Elitism: Preserve the best individuals
    for (let i = 0; i < this.config.elitismCount; i++) {
      if (i < this.population.length) {
        newPopulation.push({ ...this.population[i] });
      }
    }

    // Fill the rest of the population
    while (newPopulation.length < this.config.populationSize) {
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();
      
      let childGenes: number[];

      // Crossover
      if (Math.random() < this.config.crossoverRate) {
        childGenes = this.crossover(parent1.genes, parent2.genes);
      } else {
        childGenes = [...parent1.genes];
      }

      // Mutation
      childGenes = this.mutate(childGenes);

      newPopulation.push({ genes: childGenes, fitness: 0 });
    }

    this.population = newPopulation;
    this.evaluateFitness(); // Evaluate the new generation immediately
    this.generation++;
  }

  /**
   * Runs the algorithm for multiple generations or until convergence.
   * @param generations Number of generations to run. Defaults to config.maxGenerations.
   * @returns The best individual found.
   */
  run(generations?: number): Individual {
    const limit = generations || this.config.maxGenerations;
    for (let i = 0; i < limit; i++) {
      this.step();
    }
    return this.getBest();
  }

  /**
   * Evaluates fitness for the entire population.
   */
  private evaluateFitness(): void {
    for (const individual of this.population) {
      individual.fitness = this.fitnessFn(individual.genes);
    }
  }

  /**
   * Selects a parent using Tournament Selection.
   * Picks k random individuals and returns the best one.
   */
  private selectParent(): Individual {
    const tournamentSize = 3;
    let best: Individual | null = null;
    
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * this.population.length);
      const candidate = this.population[randomIndex];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    return best!;
  }

  /**
   * Performs crossover between two genomes (Uniform Crossover).
   * Each gene is randomly picked from either parent.
   */
  private crossover(genes1: number[], genes2: number[]): number[] {
    return genes1.map((gene, index) => 
      Math.random() < 0.5 ? gene : genes2[index]
    );
  }

  /**
   * Mutates a genome by adding random noise to genes.
   */
  private mutate(genes: number[]): number[] {
    return genes.map(gene => {
      if (Math.random() < this.config.mutationRate) {
        // Gaussian mutation or uniform range? simple uniform for now.
        const mutation = (Math.random() * 2 - 1) * this.config.mutationAmount;
        return gene + mutation;
      }
      return gene;
    });
  }

  /**
   * Returns the best individual in the current population.
   */
  getBest(): Individual {
    // Ensure sorted or find max
    return this.population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );
  }

  /**
   * Returns the current generation number.
   */
  getGeneration(): number {
    return this.generation;
  }
}
