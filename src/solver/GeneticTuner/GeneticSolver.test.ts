import { GeneticSolver } from './GeneticSolver';
import { GeneticConfig, FitnessFunction } from './types';

describe('GeneticSolver', () => {
  const config: GeneticConfig = {
    populationSize: 20,
    mutationRate: 0.1,
    mutationAmount: 5,
    crossoverRate: 0.7,
    elitismCount: 2,
    maxGenerations: 10,
  };

  const simpleFitness: FitnessFunction = (genes: number[]) => {
    // Fitness is the sum of genes (closer to 100 is better)
    // Target is [100, 100, 100...]
    const sum = genes.reduce((acc, val) => acc + val, 0);
    return -Math.abs(sum - 300); // Maximize negative error (minimize distance)
  };

  test('should initialize and run', () => {
    const solver = new GeneticSolver(config, simpleFitness, 3, [0, 50]);
    const best = solver.run();
    expect(best).toBeDefined();
    expect(best.genes.length).toBe(3);
    // Since we run for 10 gens, fitness should improve from initial.
    // Initial max sum ~150 (3 * 50). Target 300. Fitness ~-150.
    // But mutation allows it to grow.
  });

  test('should respect elitism', () => {
    const solver = new GeneticSolver(config, simpleFitness, 3, [0, 50]);
    const gen0Best = solver.getBest();
    solver.step();
    const gen1Best = solver.getBest();
    
    // With elitism, the best fitness should never decrease.
    expect(gen1Best.fitness).toBeGreaterThanOrEqual(gen0Best.fitness);
  });

  test('should increase generation count', () => {
    const solver = new GeneticSolver(config, simpleFitness, 3, [0, 50]);
    expect(solver.getGeneration()).toBe(0);
    solver.step();
    expect(solver.getGeneration()).toBe(1);
  });
});
