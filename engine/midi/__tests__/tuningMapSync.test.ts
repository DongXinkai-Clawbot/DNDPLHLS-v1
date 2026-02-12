import { TuningMapSync, createTuningMapSync, TuningMap } from '../tuningMapSync';

describe('TuningMapSync Tests', () => {
  let sync: TuningMapSync;

  beforeEach(() => {
    sync = createTuningMapSync();
  });

  describe('Property 12: Tuning File Parsing', () => {
    test('should parse valid UTE file', async () => {
      const uteContent = `
[Tuning]
Name=Test Tuning
Author=Test Author
Description=Test Description

[Notes]
60=440.000000
61=466.163762
62=493.883301
`;

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.name).toBe('Test Tuning');
      expect(tuningMap.format).toBe('ute');
      expect(tuningMap.metadata.author).toBe('Test Author');
      expect(tuningMap.metadata.description).toBe('Test Description');
      expect(tuningMap.keyAssignments.size).toBe(3);
      expect(tuningMap.keyAssignments.get(60)?.frequency).toBe(440);
    });

    test('should parse valid UINST file', async () => {
      const uinstContent = `
[Tuning]
Name=Test Instrument

[Notes]
60=440.000000
`;

      const tuningMap = await sync.parseUINST(uinstContent);

      expect(tuningMap.name).toBe('Test Instrument');
      expect(tuningMap.format).toBe('uinst');
      expect(tuningMap.keyAssignments.size).toBe(1);
    });

    test('should handle files with comments', async () => {
      const uteContent = `
# This is a comment
[Tuning]
Name=Test Tuning
; Another comment

[Notes]
60=440.000000
# Comment in notes section
61=466.163762
`;

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.keyAssignments.size).toBe(2);
    });

    test('should handle files with empty lines', async () => {
      const uteContent = `
[Tuning]
Name=Test Tuning

[Notes]

60=440.000000

61=466.163762

`;

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.keyAssignments.size).toBe(2);
    });

    test('should reject file without name', async () => {
      const uteContent = `
[Tuning]
Author=Test Author

[Notes]
60=440.000000
`;

      await expect(sync.parseUTE(uteContent)).rejects.toThrow('missing required field: Name');
    });

    test('should skip invalid note entries', async () => {
      const uteContent = `
[Tuning]
Name=Test Tuning

[Notes]
60=440.000000
invalid=not_a_number
128=500.000000
-1=400.000000
61=466.163762
`;

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.keyAssignments.size).toBe(2);
      expect(tuningMap.keyAssignments.has(60)).toBe(true);
      expect(tuningMap.keyAssignments.has(61)).toBe(true);
    });
  });

  describe('Property 13: Tuning Map Round-Trip', () => {
    test('should preserve data through UTE round-trip', async () => {
      const originalContent = `[Tuning]
Name=Test Tuning
Author=Test Author
Description=Test Description

[Notes]
60=440.000000
61=466.163762
62=493.883301
`;

      const tuningMap = await sync.parseUTE(originalContent);

      const exportedContent = await sync.exportUTE(tuningMap);

      const reparsedMap = await sync.parseUTE(exportedContent);

      expect(reparsedMap.name).toBe(tuningMap.name);
      expect(reparsedMap.format).toBe(tuningMap.format);
      expect(reparsedMap.metadata.author).toBe(tuningMap.metadata.author);
      expect(reparsedMap.metadata.description).toBe(tuningMap.metadata.description);
      expect(reparsedMap.keyAssignments.size).toBe(tuningMap.keyAssignments.size);

      for (const [note, assignment] of tuningMap.keyAssignments.entries()) {
        const reparsedAssignment = reparsedMap.keyAssignments.get(note);
        expect(reparsedAssignment).toBeDefined();
        expect(Math.abs(reparsedAssignment!.frequency - assignment.frequency)).toBeLessThan(0.000001);
      }
    });

    test('should preserve data through UINST round-trip', async () => {
      const originalContent = `[Tuning]
Name=Test Instrument

[Notes]
60=440.000000
61=466.163762
`;

      const tuningMap = await sync.parseUINST(originalContent);
      const exportedContent = await sync.exportUINST(tuningMap);
      const reparsedMap = await sync.parseUINST(exportedContent);

      expect(reparsedMap.name).toBe(tuningMap.name);
      expect(reparsedMap.keyAssignments.size).toBe(tuningMap.keyAssignments.size);
    });

    test('should handle round-trip with all 128 MIDI notes', async () => {
      
      const lines = ['[Tuning]', 'Name=Full Scale', '', '[Notes]'];
      for (let i = 0; i < 128; i++) {
        const freq = 440 * Math.pow(2, (i - 69) / 12);
        lines.push(`${i}=${freq.toFixed(6)}`);
      }
      const originalContent = lines.join('\n');

      const tuningMap = await sync.parseUTE(originalContent);
      const exportedContent = await sync.exportUTE(tuningMap);
      const reparsedMap = await sync.parseUTE(exportedContent);

      expect(reparsedMap.keyAssignments.size).toBe(128);
    });
  });

  describe('Property 14: Invalid Tuning Data Rejection', () => {
    test('should reject tuning map with missing id', () => {
      const invalidMap: any = {
        name: 'Test',
        format: 'ute',
        keyAssignments: new Map(),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(invalidMap);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    test('should reject tuning map with invalid format', () => {
      const invalidMap: any = {
        id: 'test',
        name: 'Test',
        format: 'invalid',
        keyAssignments: new Map(),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(invalidMap);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid format'))).toBe(true);
    });

    test('should reject tuning map with invalid MIDI note range', () => {
      const invalidMap: TuningMap = {
        id: 'test',
        name: 'Test',
        format: 'ute',
        keyAssignments: new Map([
          [128, { midiNote: 128, frequency: 440, cents: 0 }],
          [-1, { midiNote: -1, frequency: 440, cents: 0 }],
        ]),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(invalidMap);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid MIDI note'))).toBe(true);
    });

    test('should reject tuning map with invalid frequency', () => {
      const invalidMap: TuningMap = {
        id: 'test',
        name: 'Test',
        format: 'ute',
        keyAssignments: new Map([
          [60, { midiNote: 60, frequency: 0, cents: 0 }],
          [61, { midiNote: 61, frequency: -100, cents: 0 }],
        ]),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(invalidMap);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid frequency'))).toBe(true);
    });

    test('should reject tuning map with frequency out of range', () => {
      const invalidMap: TuningMap = {
        id: 'test',
        name: 'Test',
        format: 'ute',
        keyAssignments: new Map([
          [60, { midiNote: 60, frequency: 10, cents: 0 }], 
          [61, { midiNote: 61, frequency: 25000, cents: 0 }], 
        ]),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(invalidMap);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Frequency out of range'))).toBe(true);
    });

    test('should accept valid tuning map', () => {
      const validMap: TuningMap = {
        id: 'test',
        name: 'Test',
        format: 'ute',
        keyAssignments: new Map([
          [60, { midiNote: 60, frequency: 440, cents: 0 }],
          [61, { midiNote: 61, frequency: 466.163762, cents: 100 }],
        ]),
        metadata: { created: new Date(), modified: new Date() },
      };

      const result = sync.validateTuningMap(validMap);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('TuningMapSync unit tests', () => {
    test('should generate ID from name', async () => {
      const uteContent = `
[Tuning]
Name=Test Tuning Name

[Notes]
60=440.000000
`;

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.id).toBe('test-tuning-name');
    });

    test('should calculate cents correctly', async () => {
      const uteContent = `
[Tuning]
Name=Test

[Notes]
60=440.000000
69=440.000000
`;

      const tuningMap = await sync.parseUTE(uteContent);

      const note60 = tuningMap.keyAssignments.get(60);
      const note69 = tuningMap.keyAssignments.get(69);

      expect(note60).toBeDefined();
      expect(note69).toBeDefined();

      expect(note60!.cents).toBe(0);
      expect(note69!.cents).toBe(0);
    });

    test('should handle Windows line endings', async () => {
      const uteContent = '[Tuning]\r\nName=Test\r\n\r\n[Notes]\r\n60=440.000000\r\n';

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.name).toBe('Test');
      expect(tuningMap.keyAssignments.size).toBe(1);
    });

    test('should handle Unix line endings', async () => {
      const uteContent = '[Tuning]\nName=Test\n\n[Notes]\n60=440.000000\n';

      const tuningMap = await sync.parseUTE(uteContent);

      expect(tuningMap.name).toBe('Test');
      expect(tuningMap.keyAssignments.size).toBe(1);
    });
  });
});

