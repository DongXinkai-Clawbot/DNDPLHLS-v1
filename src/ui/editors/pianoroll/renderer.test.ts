import { PianoRollRenderer, Viewport } from './renderer';
import { NoteEvent } from '../../../daw/core/sequencer';

describe('PianoRollRenderer', () => {
  let renderer: PianoRollRenderer;

  beforeEach(() => {
    renderer = new PianoRollRenderer();
    renderer.setSize(800, 600);
  });

  test('should render visible notes', () => {
    const notes: NoteEvent[] = [
      {
        id: '1',
        startTime: 0,
        duration: 960,
        pitch: 60,
        velocity: 100,
        channel: 1,
        selected: false,
        muted: false,
      },
      {
        id: '2',
        startTime: 1000,
        duration: 960,
        pitch: 62,
        velocity: 100,
        channel: 1,
        selected: false,
        muted: false,
      },
    ];

    const viewport: Viewport = {
      startTime: 0,
      endTime: 2000,
      minPitch: 50,
      maxPitch: 70,
    };

    const nodes = renderer.getRenderNodes(notes, viewport);
    
    expect(nodes.length).toBe(2);
    expect(nodes[0].id).toBe('1');
    expect(nodes[1].id).toBe('2');
  });

  test('should cull invisible notes', () => {
    const notes: NoteEvent[] = [
      {
        id: '1',
        startTime: 0,
        duration: 960,
        pitch: 60,
        velocity: 100,
        channel: 1,
        selected: false,
        muted: false,
      },
      {
        id: '2', // Out of Time range (too late)
        startTime: 3000,
        duration: 960,
        pitch: 60,
        velocity: 100,
        channel: 1,
        selected: false,
        muted: false,
      },
      {
        id: '3', // Out of Pitch range (too high)
        startTime: 0,
        duration: 960,
        pitch: 80,
        velocity: 100,
        channel: 1,
        selected: false,
        muted: false,
      },
    ];

    const viewport: Viewport = {
      startTime: 0,
      endTime: 2000,
      minPitch: 50,
      maxPitch: 70,
    };

    const nodes = renderer.getRenderNodes(notes, viewport);
    
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe('1');
  });
});
