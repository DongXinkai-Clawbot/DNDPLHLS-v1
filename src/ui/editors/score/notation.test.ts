import { NotationEngine } from './notation';

describe('NotationEngine', () => {
  let engine: NotationEngine;

  beforeEach(() => {
    engine = new NotationEngine();
  });

  test('should handle standard notes', () => {
    // Middle C (60)
    const c4 = engine.getGlyph(60);
    expect(c4.noteName).toBe('C');
    expect(c4.octave).toBe(4);
    expect(c4.position).toBe(0);
    expect(c4.accidental).toBe('natural');

    // A4 (69)
    const a4 = engine.getGlyph(69);
    expect(a4.noteName).toBe('A');
    expect(a4.position).toBe(5); // C=0, D=1, E=2, F=3, G=4, A=5
  });

  test('should handle sharps', () => {
    // C#4 (61)
    const cis4 = engine.getGlyph(61);
    expect(cis4.noteName).toBe('C');
    expect(cis4.accidental).toBe('sharp');
    expect(cis4.position).toBe(0);
  });

  test('should handle quarter tones', () => {
    // C quarter-sharp 4 (60.5)
    const cqs4 = engine.getGlyph(60.5);
    expect(cqs4.noteName).toBe('C');
    expect(cqs4.accidental).toBe('quarter-sharp');
    
    // C three-quarter-sharp 4 (61.5)
    const ctqs4 = engine.getGlyph(61.5);
    expect(ctqs4.noteName).toBe('C');
    expect(ctqs4.accidental).toBe('three-quarter-sharp');
  });

  test('should calculate cents deviation', () => {
    // C4 + 10 cents (60.1)
    const c4plus10 = engine.getGlyph(60.1);
    // Rounded to 60 (Natural)
    // Deviation (60.1 - 60) * 100 = 10 cents
    expect(c4plus10.accidental).toBe('natural');
    expect(c4plus10.centsDeviation).toBeCloseTo(10);
    
    // C4 + 60 cents (60.6)
    // Rounded to 60.5 (Quarter Sharp)
    // Deviation (60.6 - 60.5) * 100 = 10 cents
    const c4plus60 = engine.getGlyph(60.6);
    expect(c4plus60.accidental).toBe('quarter-sharp');
    expect(c4plus60.centsDeviation).toBeCloseTo(10);
  });
});
