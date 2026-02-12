export type Accidental = 'natural' | 'sharp' | 'flat' | 'quarter-sharp' | 'quarter-flat' | 'three-quarter-sharp' | 'three-quarter-flat';

export interface StaffGlyph {
  noteName: string; // C, D, E...
  octave: number;
  position: number; // Relative to Middle C (C4 = 0)
  accidental: Accidental;
  centsDeviation: number; // Remaining cents not covered by accidental
}

export class NotationEngine {
  // Standard mapping: C=0, D=1, E=2, F=3, G=4, A=5, B=6
  private static noteOffsets = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; 
  // C, C#, D, D#, E, F, F#, G, G#, A, A#, B
  
  // Basic accidentals for 12-EDO (prefer sharps for now)
  private static noteAccidentals: Accidental[] = [
    'natural', 'sharp', 'natural', 'sharp', 'natural', 'natural', 'sharp', 'natural', 'sharp', 'natural', 'sharp', 'natural'
  ];

  /**
   * Converts a MIDI pitch (floating point) to staff notation.
   * @param pitch MIDI note number (can be fractional)
   */
  public getGlyph(pitch: number): StaffGlyph {
    const roundedPitch = Math.round(pitch); // Nearest semitone
    const deviation = (pitch - roundedPitch) * 100; // Cents deviation from nearest semitone
    
    // Determine accidental based on deviation
    // If deviation is close to +/- 50 cents, use quarter tone accidental
    // Threshold for quarter tone: e.g. > 25 cents.
    
    // Let's implement Stein-Zimmermann logic (24-EDO)
    // Quantize pitch to nearest quarter tone (0.5 semitone)
    const quarterTone = Math.round(pitch * 2) / 2;
    const semitone = Math.floor(quarterTone);
    const isQuarter = (quarterTone - semitone) !== 0;
    
    const octave = Math.floor(semitone / 12) - 1;
    const noteIndex = semitone % 12;
    
    // Position logic (C4 = 60)
    // C=0, D=1, E=2...
    // Offset in octave
    const octaveOffset = NotationEngine.noteOffsets[noteIndex];
    // Total position: (octave - 4) * 7 + octaveOffset
    // C4 is octave 4. (4-4)*7 + 0 = 0.
    const position = (octave - 4) * 7 + octaveOffset;
    
    let accidental = NotationEngine.noteAccidentals[noteIndex];
    
    // Adjust for quarter tone
    if (isQuarter) {
      // If base is natural, becomes quarter-sharp
      // If base is sharp, becomes three-quarter-sharp
      if (accidental === 'natural') accidental = 'quarter-sharp';
      else if (accidental === 'sharp') accidental = 'three-quarter-sharp';
    }
    
    // Calculate remaining deviation
    const remainingCents = (pitch - quarterTone) * 100;

    return {
      noteName: this.getNoteName(noteIndex),
      octave,
      position,
      accidental,
      centsDeviation: remainingCents,
    };
  }

  private getNoteName(index: number): string {
    const names = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
    return names[index];
  }
}
