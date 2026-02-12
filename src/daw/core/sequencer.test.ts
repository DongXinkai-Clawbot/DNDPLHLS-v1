import { SequencerEngine, QuantizationSettings } from './sequencer';

describe('SequencerEngine', () => {
  let sequencer: SequencerEngine;

  beforeEach(() => {
    sequencer = new SequencerEngine();
  });

  test('should initialize with default values', () => {
    expect(sequencer.getBpm()).toBe(120);
  });

  test('should add a track', () => {
    const track = sequencer.addTrack('Test Track', 'midi');
    expect(track).toBeDefined();
    expect(track.name).toBe('Test Track');
    expect(track.type).toBe('midi');
    expect(sequencer.getTrack(track.id)).toBe(track);
  });

  test('should remove a track', () => {
    const track = sequencer.addTrack('To Remove');
    sequencer.removeTrack(track.id);
    expect(sequencer.getTrack(track.id)).toBeUndefined();
  });

  test('should add a clip to a track', () => {
    const track = sequencer.addTrack('Clip Track');
    const clip = sequencer.addClip(track.id, 0, 960);
    
    expect(clip).toBeDefined();
    expect(clip.trackId).toBe(track.id);
    expect(track.clips).toContain(clip);
    expect(clip.duration).toBe(960);
  });

  test('should add a note to a clip', () => {
    const track = sequencer.addTrack('Note Track');
    const clip = sequencer.addClip(track.id, 0, 960);
    
    const noteData = {
      pitch: 60,
      startTime: 0,
      duration: 240,
      velocity: 100,
      channel: 1,
      selected: false,
      muted: false
    };

    const note = sequencer.addNoteToClip(track.id, clip.id, noteData);
    
    expect(note).toBeDefined();
    expect(note.pitch).toBe(60);
    expect(clip.notes).toContain(note);
  });

  test('should quantize notes', () => {
    const track = sequencer.addTrack('Quantize Track');
    const clip = sequencer.addClip(track.id, 0, 3840);
    
    // Add a note slightly off-grid (grid 1/4 = 960 ticks)
    // 970 is close to 960
    const note = sequencer.addNoteToClip(track.id, clip.id, {
      pitch: 60,
      startTime: 970, // 10 ticks late
      duration: 240,
      velocity: 100,
      channel: 1,
      selected: false,
      muted: false
    });

    const settings: QuantizationSettings = {
      enabled: true,
      grid: '1/4',
      strength: 1.0,
      swing: 0
    };

    sequencer.quantizeClip(track.id, clip.id, settings);

    expect(note.startTime).toBe(960);
  });

  test('should respect quantization strength', () => {
    const track = sequencer.addTrack('Strength Track');
    const clip = sequencer.addClip(track.id, 0, 3840);
    
    // 980 is 20 ticks away from 960
    const note = sequencer.addNoteToClip(track.id, clip.id, {
      pitch: 60,
      startTime: 980,
      duration: 240,
      velocity: 100,
      channel: 1,
      selected: false,
      muted: false
    });

    const settings: QuantizationSettings = {
      enabled: true,
      grid: '1/4',
      strength: 0.5, // Should move halfway (10 ticks) to 970
      swing: 0
    };

    sequencer.quantizeClip(track.id, clip.id, settings);

    expect(note.startTime).toBe(970);
  });
});
