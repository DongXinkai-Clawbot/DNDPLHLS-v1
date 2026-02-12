
export interface TuningAssignment {
  midiNote: number;
  frequency: number;
  cents: number;
  ratio?: { n: bigint; d: bigint };
  label?: string;
}

export interface TuningMap {
  id: string;
  name: string;
  format: 'ute' | 'uinst';
  keyAssignments: Map<number, TuningAssignment>;
  metadata: {
    author?: string;
    description?: string;
    created: Date;
    modified: Date;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TuningMapSync {
  
  async parseUTE(content: string): Promise<TuningMap> {
    const lines = content.split(/\r?\n/).map(line => line.trim());
    const tuningMap: Partial<TuningMap> = {
      format: 'ute',
      keyAssignments: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
      },
    };

    let currentSection: 'tuning' | 'notes' | null = null;

    for (const line of lines) {
      
      if (!line || line.startsWith('#') || line.startsWith(';')) {
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        const section = line.slice(1, -1).toLowerCase();
        if (section === 'tuning') {
          currentSection = 'tuning';
        } else if (section === 'notes') {
          currentSection = 'notes';
        }
        continue;
      }

      const eqIndex = line.indexOf('=');
      if (eqIndex === -1) continue;

      const key = line.slice(0, eqIndex).trim();
      const value = line.slice(eqIndex + 1).trim();

      if (currentSection === 'tuning') {
        if (key.toLowerCase() === 'name') {
          tuningMap.name = value;
        } else if (key.toLowerCase() === 'author') {
          if (!tuningMap.metadata) tuningMap.metadata = { created: new Date(), modified: new Date() };
          tuningMap.metadata.author = value;
        } else if (key.toLowerCase() === 'description') {
          if (!tuningMap.metadata) tuningMap.metadata = { created: new Date(), modified: new Date() };
          tuningMap.metadata.description = value;
        }
      } else if (currentSection === 'notes') {
        const midiNote = parseInt(key, 10);
        const frequency = parseFloat(value);

        if (!isNaN(midiNote) && !isNaN(frequency) && midiNote >= 0 && midiNote <= 127) {
          const cents = this.frequencyToCents(frequency);
          const assignment: TuningAssignment = {
            midiNote,
            frequency,
            cents,
          };
          tuningMap.keyAssignments!.set(midiNote, assignment);
        }
      }
    }

    if (!tuningMap.name) {
      throw new Error('UTE file missing required field: Name');
    }

    tuningMap.id = this.generateId(tuningMap.name);

    return tuningMap as TuningMap;
  }

  async parseUINST(content: string): Promise<TuningMap> {
    
    const tuningMap = await this.parseUTE(content);
    tuningMap.format = 'uinst';
    return tuningMap;
  }

  async exportUTE(tuningMap: TuningMap): Promise<string> {
    const lines: string[] = [];

    lines.push('[Tuning]');
    lines.push(`Name=${tuningMap.name}`);
    if (tuningMap.metadata.author) {
      lines.push(`Author=${tuningMap.metadata.author}`);
    }
    if (tuningMap.metadata.description) {
      lines.push(`Description=${tuningMap.metadata.description}`);
    }
    lines.push('');

    lines.push('[Notes]');
    
    const sortedNotes = Array.from(tuningMap.keyAssignments.entries())
      .sort((a, b) => a[0] - b[0]);

    for (const [midiNote, assignment] of sortedNotes) {
      lines.push(`${midiNote}=${assignment.frequency.toFixed(6)}`);
    }

    return lines.join('\n');
  }

  async exportUINST(tuningMap: TuningMap): Promise<string> {
    
    return this.exportUTE(tuningMap);
  }

  validateTuningMap(tuningMap: TuningMap): ValidationResult {
    const errors: string[] = [];

    if (!tuningMap.id) {
      errors.push('Missing required field: id');
    }
    if (!tuningMap.name) {
      errors.push('Missing required field: name');
    }
    if (!tuningMap.format) {
      errors.push('Missing required field: format');
    }
    if (!tuningMap.keyAssignments) {
      errors.push('Missing required field: keyAssignments');
    }
    if (!tuningMap.metadata) {
      errors.push('Missing required field: metadata');
    }

    if (tuningMap.format && tuningMap.format !== 'ute' && tuningMap.format !== 'uinst') {
      errors.push(`Invalid format: ${tuningMap.format} (must be 'ute' or 'uinst')`);
    }

    if (tuningMap.keyAssignments) {
      for (const [midiNote, assignment] of tuningMap.keyAssignments.entries()) {
        
        if (midiNote < 0 || midiNote > 127) {
          errors.push(`Invalid MIDI note: ${midiNote} (must be 0-127)`);
        }

        if (assignment.frequency <= 0) {
          errors.push(`Invalid frequency for note ${midiNote}: ${assignment.frequency} (must be > 0)`);
        }

        if (assignment.frequency < 20 || assignment.frequency > 20000) {
          errors.push(`Frequency out of range for note ${midiNote}: ${assignment.frequency} (must be 20-20000 Hz)`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private frequencyToCents(frequency: number): number {
    if (frequency <= 0) return 0;
    
    return 1200 * Math.log2(frequency / 440);
  }

  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

export function createTuningMapSync(): TuningMapSync {
  return new TuningMapSync();
}
