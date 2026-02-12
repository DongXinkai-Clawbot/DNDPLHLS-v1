import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import { useStore } from '../store';
import { shallow } from 'zustand/shallow';
import type { NodeData, PrimeLimit, WebMidi } from '../types';
import { calculateCents, getPrimeVectorFromRatio, normalizeOctave, parseMathExpression } from '../musicLogic';
import { startNote } from '../audioEngine';
import { updateTimbreModState, updateTimbreVoiceExpression } from '../timbreEngine';
import type { TimbreVoiceExpression } from '../timbreEngine';
import { MidiDeviceManager } from '../engine/midi/midiDeviceManager';
import { getDeviceManager } from '../midiOut';
import { createLogger } from '../utils/logger';

type MidiSystemOptions = {
  isEnabled?: boolean;
  deviceManager?: MidiDeviceManager | null;
};

const log = createLogger('midi/use-midi-system');

export const useMidiSystem = (options: MidiSystemOptions = {}) => {
  const isEnabled = options.isEnabled ?? true;
  const {
    settings,
    nodes
  } = useStore((s) => ({
    settings: s.settings,
    nodes: s.nodes
  }), shallow);
  const settingsRef = useRef(settings);
  const activeVoices = useRef<Map<string, () => void>>(new Map());
  const activeNoteNodes = useRef<Map<string, string>>(new Map());
  const activeNodeCounts = useRef<Map<string, number>>(new Map());
  const channelModsRef = useRef<Map<number, TimbreVoiceExpression>>(new Map());
  const [midiAccess, setMidiAccess] = useState<WebMidi.MIDIAccess | null>(null);
  const deviceManagerRef = useRef<MidiDeviceManager | null>(options.deviceManager ?? null);
  const [rebindToken, setRebindToken] = useState(0);

  const latticeIndex = useMemo(() => {
    const entries = nodes.map((node) => ({
      cents: ((node.cents % 1200) + 1200) % 1200,
      node,
    }));
    entries.sort((a, b) => a.cents - b.cents);
    return entries;
  }, [nodes]);

  const axisNodeIndex = useMemo(() => {
    const map = new Map<string, NodeData>();
    nodes.forEach((node) => {
      if (!node.originLimit) return;
      const axis = node.originLimit as PrimeLimit;
      const step = node.primeVector[axis];
      if (typeof step === 'number') {
        map.set(`${axis}:${step}`, node);
      }
    });
    return map;
  }, [nodes]);

  useEffect(() => {
    deviceManagerRef.current = options.deviceManager ?? getDeviceManager();
  }, [options.deviceManager]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const clearActiveVoices = useCallback(() => {
    activeVoices.current.forEach((stop) => stop());
    activeVoices.current.clear();

    if (activeNodeCounts.current.size > 0) {
      const { playingNodeIds, setPlayingNodeStates } = useStore.getState();
      const newMap = new Map(playingNodeIds);
      activeNodeCounts.current.forEach((_count, nodeId) => {
        newMap.delete(nodeId);
      });
      setPlayingNodeStates(newMap);
    }

    activeNodeCounts.current.clear();
    activeNoteNodes.current.clear();
    channelModsRef.current.clear();
  }, []);

  const requestMidiAccess = useCallback(() => {
    if (!isEnabled) return;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      log.warn('requestMIDIAccess not available');
      return;
    }

    // Try without sysex first (more compatible)
    // If that fails, user can still use basic MIDI
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        setMidiAccess(access as unknown as WebMidi.MIDIAccess);
        log.info('MIDI access granted without sysex');
      })
      .catch((e: any) => {
        // If sysex-less fails, log it but don't crash
        const errorMsg = e?.message || 'MIDI access denied';
        log.warn('MIDI access request failed:', errorMsg);
        setMidiAccess(null);
        // Don't retry - let user know MIDI is unavailable
      });
  }, [isEnabled, log]);

  useEffect(() => {
    if (!isEnabled) {
      setMidiAccess(null);
      clearActiveVoices();
      return;
    }
    requestMidiAccess();
  }, [clearActiveVoices, isEnabled, requestMidiAccess]);

  useEffect(() => {
    if (!isEnabled) return;
    const access = midiAccess;
    if (!access) return;
    const handleStateChange = (e: any) => {
      const port = e?.port;
      if (port?.state === 'disconnected') {
        clearActiveVoices();
      }
      setRebindToken((v) => v + 1);
    };
    if (typeof access.addEventListener === 'function') {
      access.addEventListener('statechange', handleStateChange as EventListener);
      return () => {
        access.removeEventListener('statechange', handleStateChange as EventListener);
      };
    }
    access.onstatechange = handleStateChange;
    return () => {
      if (access.onstatechange === handleStateChange) {
        access.onstatechange = null;
      }
    };
  }, [clearActiveVoices, isEnabled, midiAccess]);

  useEffect(() => {
    if (!isEnabled) return;
    const deviceManager = deviceManagerRef.current;
    if (!deviceManager) return;

    const handleDeviceConnected = () => {
      log.info('Device connected, refreshing MIDI access');
      requestMidiAccess();
      setRebindToken((v) => v + 1);
    };

    const handleDeviceDisconnected = () => {
      log.info('Device disconnected');
      clearActiveVoices();
      setRebindToken((v) => v + 1);
    };

    const handleConfigChanged = () => {
      setRebindToken((v) => v + 1);
    };

    deviceManager.on('device-connected', handleDeviceConnected);
    deviceManager.on('device-disconnected', handleDeviceDisconnected);
    deviceManager.on('configuration-changed', handleConfigChanged);
    deviceManager.on('device-list-updated', handleConfigChanged);

    return () => {
      deviceManager.off('device-connected', handleDeviceConnected);
      deviceManager.off('device-disconnected', handleDeviceDisconnected);
      deviceManager.off('configuration-changed', handleConfigChanged);
      deviceManager.off('device-list-updated', handleConfigChanged);
    };
  }, [clearActiveVoices, isEnabled, requestMidiAccess]);

  useEffect(() => {
    if (!isEnabled) return;
    const access = midiAccess;
    if (!access || !settings.midi.enabled) return;

    const setNodePlaying = (nodeId: string, isPlaying: boolean, channel = 0, velocity = 100) => {
      const { playingNodeIds, setPlayingNodeStates } = useStore.getState();
      const newMap = new Map(playingNodeIds);
      if (isPlaying) {
        newMap.set(nodeId, { channels: [channel], velocity });
      } else {
        newMap.delete(nodeId);
      }
      setPlayingNodeStates(newMap);
    };

    const markNodeActive = (nodeId: string, channel: number, velocity: number) => {
      const counts = activeNodeCounts.current;
      const nextCount = (counts.get(nodeId) ?? 0) + 1;
      counts.set(nodeId, nextCount);
      if (nextCount === 1) setNodePlaying(nodeId, true, channel, velocity);
    };

    const markNodeInactive = (nodeId: string) => {
      const counts = activeNodeCounts.current;
      const nextCount = (counts.get(nodeId) ?? 0) - 1;
      if (nextCount <= 0) {
        counts.delete(nodeId);
        setNodePlaying(nodeId, false);
      } else {
        counts.set(nodeId, nextCount);
      }
    };

    const clearNoteKey = (noteKey: string) => {
      const nodeId = activeNoteNodes.current.get(noteKey);
      if (nodeId) {
        activeNoteNodes.current.delete(noteKey);
        markNodeInactive(nodeId);
      }
    };

    const buildNoteKey = (inputId: string, channel: number, note: number) => `${inputId}:${channel}:${note}`;
    const parseChannelFromNoteKey = (noteKey: string) => {
      const parts = noteKey.split(':');
      if (parts.length < 3) return null;
      const channel = parseInt(parts[1], 10);
      return Number.isFinite(channel) ? channel : null;
    };
    const getChannelMods = (channel: number): TimbreVoiceExpression => {
      const existing = channelModsRef.current.get(channel);
      if (existing) return existing;
      const defaults: TimbreVoiceExpression = { modWheel: 0, aftertouch: 0, cc7: 0, cc74: 0, pitchBend: 0.5 };
      channelModsRef.current.set(channel, defaults);
      return defaults;
    };
    const updateChannelMods = (channel: number, partial: Partial<TimbreVoiceExpression>) => {
      const current = getChannelMods(channel);
      const next = { ...current, ...partial };
      channelModsRef.current.set(channel, next);
      return next;
    };
    const applyExpressionToChannel = (channel: number, partial: Partial<TimbreVoiceExpression>) => {
      activeVoices.current.forEach((_stop, key) => {
        const keyChannel = parseChannelFromNoteKey(key);
        if (keyChannel === channel) {
          updateTimbreVoiceExpression(key, partial);
        }
      });
    };

    const getFilteredStepIndex = (n: number, keyFilter: string) => {
      const pc = ((n % 12) + 12) % 12;
      const oct = Math.floor(n / 12);
      if (keyFilter === 'white') {
        const whitePcMap = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6];
        return whitePcMap[pc] === -1 ? null : oct * 7 + whitePcMap[pc];
      } else if (keyFilter === 'black') {
        const blackPcMap = [-1, 0, -1, 1, -1, -1, 2, -1, 3, -1, 4, -1];
        return blackPcMap[pc] === -1 ? null : oct * 5 + blackPcMap[pc];
      }
      return n;
    };

    const findNearestNode = (targetCents: number) => {
      if (latticeIndex.length === 0) return null;
      let lo = 0;
      let hi = latticeIndex.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (latticeIndex[mid].cents < targetCents) lo = mid + 1;
        else hi = mid;
      }
      const right = latticeIndex[lo % latticeIndex.length];
      const left = latticeIndex[(lo - 1 + latticeIndex.length) % latticeIndex.length];
      const diffRight = Math.min(Math.abs(right.cents - targetCents), 1200 - Math.abs(right.cents - targetCents));
      const diffLeft = Math.min(Math.abs(left.cents - targetCents), 1200 - Math.abs(left.cents - targetCents));
      const best = diffLeft <= diffRight ? { node: left.node, diff: diffLeft } : { node: right.node, diff: diffRight };
      return best.diff <= 50 ? best.node : null;
    };

    const handleMidiMessage = (inputId: string) => (e: WebMidi.MIDIMessageEvent) => {
      const [status, note, velocity] = e.data;
      const rawVelocity = velocity ?? 0;
      const command = status >> 4;
      const channel = (status & 0xF) + 1;

      const noteKey = buildNoteKey(inputId, channel, note);

      const currentSettings = settingsRef.current;
      const midiSettings = currentSettings.midi;

      const deviceManager = deviceManagerRef.current;
      if (deviceManager) {
        const shouldProcess = deviceManager.processMidiMessage(e.data);
        if (!shouldProcess) return;
      } else {

        if (midiSettings.channel !== 0 && channel !== midiSettings.channel) return;
      }

      const globalChannel = midiSettings.channel && midiSettings.channel > 0 ? midiSettings.channel : 1;

      if (command === 11) {
        const ccValue = rawVelocity / 127;
        if (note === 1) {
          updateChannelMods(channel, { modWheel: ccValue });
          applyExpressionToChannel(channel, { modWheel: ccValue });
          if (channel === globalChannel) updateTimbreModState({ modWheel: ccValue });
        } else if (note === 7) {
          updateChannelMods(channel, { cc7: ccValue });
          applyExpressionToChannel(channel, { cc7: ccValue });
          if (channel === globalChannel) updateTimbreModState({ cc7: ccValue });
        } else if (note === 74) {
          updateChannelMods(channel, { cc74: ccValue });
          applyExpressionToChannel(channel, { cc74: ccValue });
          if (channel === globalChannel) updateTimbreModState({ cc74: ccValue });
        }
        return;
      }
      if (command === 10) {
        const pressure = velocity ?? 0;
        updateTimbreVoiceExpression(noteKey, { aftertouch: pressure / 127 });
        return;
      }
      if (command === 13) {
        const pressure = note ?? 0;
        const value = pressure / 127;
        updateChannelMods(channel, { aftertouch: value });
        applyExpressionToChannel(channel, { aftertouch: value });
        if (channel === globalChannel) updateTimbreModState({ aftertouch: value });
        return;
      }
      if (command === 14) {
        const lsb = note ?? 0;
        const msb = velocity ?? 0;
        const value14 = ((msb & 0x7f) << 7) | (lsb & 0x7f);
        const value = value14 / 16383;
        updateChannelMods(channel, { pitchBend: value });
        applyExpressionToChannel(channel, { pitchBend: value });
        if (channel === globalChannel) updateTimbreModState({ pitchBend: value });
        return;
      }

      if (command === 9 && rawVelocity > 0) {
        const velNorm = midiSettings.velocitySensitivity ? rawVelocity / 127 : 1;
        const channelMods = getChannelMods(channel);
        const stepIdx = getFilteredStepIndex(note, midiSettings.keyFilter);
        const centerIdx = getFilteredStepIndex(midiSettings.centerNote, midiSettings.keyFilter);
        if (stepIdx === null || centerIdx === null) return;

        const stepDiff = stepIdx - centerIdx;
        const mode = midiSettings.mappingMode || 'lattice';
        const div = midiSettings.mappingDivisions || 12;

        const previousStop = activeVoices.current.get(noteKey);
        if (previousStop) {
          previousStop();
          activeVoices.current.delete(noteKey);
          clearNoteKey(noteKey);
        }

        if (mode === 'axis') {
          const axis = (midiSettings.restrictAxis || 3) as PrimeLimit;
          const bAxis = BigInt(axis);
          const absStep = BigInt(Math.abs(stepDiff));
          let nRaw = 1n;
          let dRaw = 1n;
          if (stepDiff >= 0) nRaw = bAxis ** absStep;
          else dRaw = bAxis ** absStep;
          const { ratio } = normalizeOctave({ n: nRaw, d: dRaw });

          const tempNode: NodeData = {
            id: `midi-axis-${axis}-${stepDiff}`,
            position: new Vector3(),
            primeVector: { 3: 0, 5: 0, 7: 0, 11: 0, 13: 0, 17: 0, 19: 0, 23: 0, 29: 0, 31: 0, [axis]: stepDiff },
            ratio,
            octave: 0,
            cents: calculateCents(ratio),
            gen: 0,
            originLimit: axis,
            parentId: null,
            name: `Axis ${axis}^${stepDiff}`
          };

          const registerOffset = Math.floor(stepDiff / div);
          const playableNode = { ...tempNode, octave: registerOffset };

          const realNode = axisNodeIndex.get(`${axis}:${stepDiff}`);
          const stop = startNote(playableNode, currentSettings, 'keyboard', 0, undefined, { velocity: velNorm, noteKey, voiceMods: channelMods });
          activeVoices.current.set(noteKey, stop);
          if (realNode) {
            activeNoteNodes.current.set(noteKey, realNode.id);
            markNodeActive(realNode.id, channel, rawVelocity);
          }
        } else if (mode === 'custom') {
          const mapping = midiSettings.mappingScale || [];
          const modStep = ((stepDiff % div) + div) % div;
          const octaveOffset = Math.floor(stepDiff / div);
          const ratioStr = mapping[modStep] || '1/1';
          let n = 1n;
          let d = 1n;
          let ratioFloat: number | undefined = undefined;
          try {
            if (ratioStr.includes('/')) {
              const [ns, ds] = ratioStr.split('/');

              if (ns.includes('.') || ds.includes('.')) {
                const numVal = parseFloat(ns) || 1;
                const denVal = parseFloat(ds) || 1;
                ratioFloat = numVal / denVal;

                const precision = 10000000000;
                n = BigInt(Math.round(ratioFloat * precision));
                d = BigInt(precision);
              } else {
                n = parseMathExpression(ns);
                d = parseMathExpression(ds);
              }
            } else if (ratioStr.includes('.')) {

              ratioFloat = parseFloat(ratioStr);
              const precision = 10000000000;
              n = BigInt(Math.round(ratioFloat * precision));
              d = BigInt(precision);
            } else {
              n = parseMathExpression(ratioStr);
            }
          } catch (e) { }

          if (ratioFloat === undefined && d !== 0n) {
            ratioFloat = Number(n) / Number(d);
          }

          const tempNode: NodeData = {
            id: `midi-custom-${note}`,
            position: new Vector3(),
            primeVector: getPrimeVectorFromRatio(n, d),
            ratio: { n, d },
            ratioFloat: ratioFloat,
            octave: octaveOffset,
            cents: calculateCents({ n, d }),
            gen: 0,
            originLimit: 0,
            parentId: null,
            name: ratioStr
          };
          const stop = startNote(tempNode, currentSettings, 'keyboard', 0, undefined, { velocity: velNorm, noteKey, voiceMods: channelMods });
          activeVoices.current.set(noteKey, stop);
        } else {
          const targetCents = stepDiff * (1200 / div);
          const normTarget = ((targetCents % 1200) + 1200) % 1200;
          const bestNode = findNearestNode(normTarget);
          if (bestNode) {
            const octaveOffset = Math.floor((targetCents + 50) / 1200);
            const stop = startNote({ ...bestNode, octave: octaveOffset }, currentSettings, 'keyboard', 0, undefined, { velocity: velNorm, noteKey, voiceMods: channelMods });
            activeVoices.current.set(noteKey, stop);
            activeNoteNodes.current.set(noteKey, bestNode.id);
            markNodeActive(bestNode.id, channel, rawVelocity);
          }
        }
      } else if (command === 8 || (command === 9 && rawVelocity === 0)) {
        const stop = activeVoices.current.get(noteKey);
        if (stop) {
          stop();
          activeVoices.current.delete(noteKey);
        }
        clearNoteKey(noteKey);
      }
    };

    const inputs = Array.from(access.inputs.values()) as WebMidi.MIDIInput[];

    const deviceManager = deviceManagerRef.current;
    let activeInputs: WebMidi.MIDIInput[];

    if (deviceManager) {
      const selectedDevice = deviceManager.getSelectedDevice();
      if (selectedDevice && selectedDevice.type === 'input') {
        activeInputs = inputs.filter(i => i.id === selectedDevice.id);
      } else {

        activeInputs = inputs;
      }
    } else {

      activeInputs = settings.midi.inputName ? inputs.filter(i => i.name === settings.midi.inputName) : inputs;
    }

    const handlers = new Map<string, (e: WebMidi.MIDIMessageEvent) => void>();
    activeInputs.forEach((input) => {
      const handler = handleMidiMessage(input.id);
      handlers.set(input.id, handler);
      input.addEventListener('midimessage', handler);
    });

    return () => {
      handlers.forEach((handler, id) => {
        const input = activeInputs.find((i) => i.id === id);
        if (input) input.removeEventListener('midimessage', handler);
      });
      clearActiveVoices();
    };
  }, [axisNodeIndex, clearActiveVoices, isEnabled, latticeIndex, midiAccess, rebindToken, settings.midi]);
};
