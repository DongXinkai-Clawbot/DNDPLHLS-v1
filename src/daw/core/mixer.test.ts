import { MixerEngine, MixerChannel } from './mixer';

describe('MixerEngine', () => {
  let mixer: MixerEngine;

  beforeEach(() => {
    mixer = new MixerEngine();
  });

  test('should create a master channel on initialization', () => {
    const master = mixer.getChannel('master');
    expect(master).toBeDefined();
    expect(master?.name).toBe('Master');
  });

  test('should create a new channel', () => {
    const channel = mixer.createChannel('track-1', 'Track 1');
    expect(channel).toBeDefined();
    expect(channel.id).toBe('track-1');
    expect(mixer.getChannel('track-1')).toBe(channel);
  });

  test('should set volume and pan', () => {
    const channel = mixer.createChannel('track-1', 'Track 1');
    mixer.setVolume('track-1', 0.5);
    mixer.setPan('track-1', -0.5);

    expect(channel.volume).toBe(0.5);
    expect(channel.pan).toBe(-0.5);
  });

  test('should add a send', () => {
    const channel = mixer.createChannel('track-1', 'Track 1');
    const send = mixer.addSend('track-1', 'return-A', 'post');

    expect(send).toBeDefined();
    expect(send.destinationId).toBe('return-A');
    expect(channel.sends).toContain(send);
  });

  test('should handle VCA groups', () => {
    const channel = mixer.createChannel('track-1', 'Track 1');
    const vca = mixer.createVCAGroup('VCA 1');

    mixer.addChannelToVCA(vca.id, channel.id);
    
    expect(channel.vcaGroupId).toBe(vca.id);
    expect(vca.members).toContain(channel.id);
  });

  test('should calculate effective volume with VCA', () => {
    const channel = mixer.createChannel('track-1', 'Track 1');
    mixer.setVolume('track-1', 0.8);

    const vca = mixer.createVCAGroup('VCA 1');
    mixer.addChannelToVCA(vca.id, channel.id);
    
    // VCA at 1.0 (default) -> Effective volume = 0.8 * 1.0 = 0.8
    expect(mixer.getEffectiveVolume(channel.id)).toBe(0.8);

    // Reduce VCA volume to 0.5 -> Effective volume = 0.8 * 0.5 = 0.4
    vca.volume = 0.5;
    expect(mixer.getEffectiveVolume(channel.id)).toBe(0.4);
  });
});
