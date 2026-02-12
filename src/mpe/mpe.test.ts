import { MPEManager, MPENoteState } from './mpe';

describe('MPEManager', () => {
  let mpe: MPEManager;

  beforeEach(() => {
    mpe = new MPEManager();
  });

  test('should handle Note On', () => {
    // Note On (Channel 2, Note 60, Velocity 127)
    // Status 0x91 (Channel 2)
    mpe.processMidiMessage(0x91, 60, 127);
    
    const notes = mpe.getActiveNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].channel).toBe(2);
    expect(notes[0].midiNote).toBe(60);
    expect(notes[0].velocity).toBe(1.0);
    expect(notes[0].active).toBe(true);
  });

  test('should handle Note Off', () => {
    // Note On
    mpe.processMidiMessage(0x91, 60, 127);
    
    // Note Off (Channel 2, Note 60, Velocity 0)
    // Status 0x81 (Channel 2)
    mpe.processMidiMessage(0x81, 60, 0);
    
    const active = mpe.getActiveNotes();
    expect(active.length).toBe(0);
    
    const all = mpe.getAllNotes();
    expect(all.length).toBe(1);
    expect(all[0].active).toBe(false);
  });

  test('should handle Pitch Bend (14-bit)', () => {
    // Note On
    mpe.processMidiMessage(0x91, 60, 127);
    
    // Pitch Bend (Channel 2)
    // LSB = 0, MSB = 127 (Max = 16383)
    // Center is 8192 (0x2000)
    // Max is 16383 (0x3FFF) -> +1.0
    mpe.processMidiMessage(0xE1, 127, 127); // Max
    
    const notes = mpe.getActiveNotes();
    // 16383 - 8192 = 8191. 8191 / 8192 = 0.9998...
    // Close to 1.0
    expect(notes[0].pitchBend).toBeCloseTo(1.0, 3);
  });

  test('should handle Timbre (CC 74)', () => {
    // Note On
    mpe.processMidiMessage(0x91, 60, 127);
    
    // CC 74 (Channel 2)
    mpe.processMidiMessage(0xB1, 74, 64); // Half (0.5)
    
    const notes = mpe.getActiveNotes();
    expect(notes[0].timbre).toBeCloseTo(0.5, 2);
  });

  test('should ignore Master Channel (1)', () => {
    // Note On Channel 1
    mpe.processMidiMessage(0x90, 60, 127);
    
    const notes = mpe.getActiveNotes();
    expect(notes.length).toBe(0);
  });
});
