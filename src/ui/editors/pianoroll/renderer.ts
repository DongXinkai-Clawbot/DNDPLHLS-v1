import { NoteEvent } from '../../../daw/core/sequencer';

export interface Viewport {
  startTime: number; // Pulses
  endTime: number;
  minPitch: number; // MIDI Note
  maxPitch: number;
}

export interface RenderRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  selected: boolean;
}

export class PianoRollRenderer {
  private width: number = 800;
  private height: number = 600;
  private noteHeight: number = 20; // Pixels per semitone

  constructor() {}

  public setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  public setNoteHeight(h: number): void {
    this.noteHeight = h;
  }

  /**
   * Calculates the render commands (virtual DOM nodes) for visible notes.
   */
  public getRenderNodes(notes: NoteEvent[], viewport: Viewport): RenderRect[] {
    const renderNodes: RenderRect[] = [];
    
    // Pixels per pulse
    const duration = viewport.endTime - viewport.startTime;
    if (duration <= 0) return [];
    const pixelsPerPulse = this.width / duration;

    // Filter and Map
    // Optimization: If notes are sorted by time, we can binary search start/end indices.
    // Assuming unsorted for now.
    
    for (const note of notes) {
      // Check visibility (Time)
      if (note.startTime + note.duration < viewport.startTime) continue;
      if (note.startTime > viewport.endTime) continue;

      // Check visibility (Pitch)
      if (note.pitch < viewport.minPitch) continue;
      if (note.pitch > viewport.maxPitch) continue;

      // Map to screen coords
      const x = (note.startTime - viewport.startTime) * pixelsPerPulse;
      const w = note.duration * pixelsPerPulse;
      
      // Pitch Y: higher pitch -> lower Y (standard screen coords)
      // Or higher pitch -> higher Y (math coords)?
      // Standard Piano Roll: High pitch at top (low Y).
      // viewport.maxPitch is top of screen (Y=0).
      // viewport.minPitch is bottom of screen (Y=height).
      
      // Pitch range
      const pitchRange = viewport.maxPitch - viewport.minPitch;
      // Normalized pitch (0 at min, 1 at max)
      const normPitch = (note.pitch - viewport.minPitch) / pitchRange;
      
      // Screen Y (0 at top)
      // y = height * (1 - normPitch) - noteHeight/2 ?
      // Or more precise: Each semitone has fixed height.
      // Usually viewport defines scroll position, not min/max pitch directly.
      // But Viewport interface uses min/max pitch.
      // Let's assume linear mapping.
      
      const y = this.height * (1 - normPitch) - (this.noteHeight / 2);

      renderNodes.push({
        id: note.id,
        x,
        y,
        width: Math.max(1, w), // Minimum 1px width
        height: this.noteHeight,
        color: note.selected ? '#ff0000' : '#00ff00',
        selected: note.selected,
      });
    }

    return renderNodes;
  }
}
