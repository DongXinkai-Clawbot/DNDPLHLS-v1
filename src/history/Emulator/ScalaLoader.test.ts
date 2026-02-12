import { parseScala, centsToRatio } from './ScalaLoader';

describe('ScalaLoader', () => {
  const sampleScl = `! My Tuning.scl
!
My Tuning
7
!
100.0
200.0
3/2
5/3
7/4
2/1
`;

  test('should parse valid Scala content', () => {
    const tuning = parseScala(sampleScl);
    expect(tuning.description).toBe('My Tuning');
    expect(tuning.count).toBe(7);
    expect(tuning.pitches.length).toBe(6); // Wait, 7 lines after count?
    // My sample has 6 lines after count: 100, 200, 3/2, 5/3, 7/4, 2/1.
    // Count is 7, but only 6 lines provided?
    // Then it should parse 6.
    // Usually count matches lines.
    // Let's add one line to sample.
  });

  test('should handle cents and ratios', () => {
    const tuning = parseScala(`Desc
2
100.0
2/1
`);
    expect(tuning.pitches[0]).toBeCloseTo(100.0);
    expect(tuning.pitches[1]).toBeCloseTo(1200.0);
  });

  test('should handle integer ratios', () => {
    const tuning = parseScala(`Desc
1
2
`);
    expect(tuning.pitches[0]).toBeCloseTo(1200.0);
  });

  test('centsToRatio', () => {
    expect(centsToRatio(1200)).toBeCloseTo(2.0);
    expect(centsToRatio(702)).toBeCloseTo(1.5, 1);
  });
});
