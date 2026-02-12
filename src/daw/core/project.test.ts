import { ProjectManager, ProjectState } from './project';
import { SequencerEngine } from './sequencer';
import { MixerEngine } from './mixer';

describe('ProjectManager', () => {
  let sequencer: SequencerEngine;
  let mixer: MixerEngine;
  let projectManager: ProjectManager;

  beforeEach(() => {
    sequencer = new SequencerEngine();
    mixer = new MixerEngine();
    projectManager = new ProjectManager(sequencer, mixer);
  });

  test('should save project state', () => {
    // Setup initial state
    const track = sequencer.addTrack('My Track');
    const channel = mixer.createChannel(track.id, 'My Channel');
    sequencer.setBpm(130);

    const state = projectManager.saveProject('My Song', 'Me');

    expect(state).toBeDefined();
    expect(state.metadata.name).toBe('My Song');
    expect(state.metadata.bpm).toBe(130);
    expect(state.sequencer.tracks.length).toBe(1);
    expect(state.mixer.channels.length).toBe(2); // Master + My Channel
  });

  test('should load project state', () => {
    // Setup a state to load
    const trackId = 'track-abc';
    const state: ProjectState = {
      metadata: {
        id: 'proj-1',
        name: 'Loaded Song',
        author: 'User',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        version: '1.0.0',
        bpm: 140,
        timeSignature: [4, 4],
      },
      sequencer: {
        tracks: [
          {
            id: trackId,
            name: 'Loaded Track',
            type: 'midi',
            color: '#FFFFFF',
            clips: [],
            volume: 0.8,
            pan: 0,
            muted: false,
            soloed: false,
            recordArmed: false,
            pluginChain: [],
          },
        ],
      },
      mixer: {
        channels: [
          {
            id: 'master',
            name: 'Master',
            volume: 0.8,
            pan: 0,
            muted: false,
            soloed: false,
            sends: [],
            inserts: [],
            outputId: 'master',
          },
          {
            id: trackId,
            name: 'Loaded Channel',
            volume: 0.6,
            pan: -0.5,
            muted: true,
            soloed: false,
            sends: [],
            inserts: [],
            outputId: 'master',
          },
        ],
        vcaGroups: [],
      },
    };

    projectManager.loadProject(state);

    expect(sequencer.getBpm()).toBe(140);
    const loadedTrack = sequencer.getTrack(trackId);
    expect(loadedTrack).toBeDefined();
    expect(loadedTrack?.name).toBe('Loaded Track');

    const loadedChannel = mixer.getChannel(trackId);
    expect(loadedChannel).toBeDefined();
    expect(loadedChannel?.volume).toBe(0.6);
    expect(loadedChannel?.muted).toBe(true);
  });
});
