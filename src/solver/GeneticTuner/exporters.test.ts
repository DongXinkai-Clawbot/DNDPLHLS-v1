import { exportRank2ToScala } from './exporters';
import { Individual } from './types';

describe('Exporters', () => {
  test('should export 12-TET correctly', () => {
    // 12-TET: Period 1200, Generator 100 (semitone)
    const genome: Individual = { genes: [1200, 100], fitness: 0 };
    const tuning = exportRank2ToScala(genome, 12, '12-TET Test');
    
    expect(tuning.count).toBe(12);
    expect(tuning.pitches[0]).toBeCloseTo(100);
    expect(tuning.pitches[11]).toBeCloseTo(1200);
  });

  test('should export Meantone correctly', () => {
    // Meantone: Period 1200, Generator ~696.578 (1/4 comma meantone fifth)
    // Chain 12
    const genome: Individual = { genes: [1200, 696.578], fitness: 0 };
    const tuning = exportRank2ToScala(genome, 12, 'Meantone Test');
    
    expect(tuning.count).toBe(12);
    // Fifth (gen 1) should be present: ~697
    // Major third (gen 4) should be pure: ~386?
    // 4 * 696.578 = 2786.312
    // 2786.312 - 2400 = 386.312. Correct.
    
    const m3 = tuning.pitches.find(p => Math.abs(p - 386.3) < 1.0);
    expect(m3).toBeDefined();
  });
});
