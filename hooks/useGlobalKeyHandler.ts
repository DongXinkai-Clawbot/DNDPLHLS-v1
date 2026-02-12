import { useEffect, useRef } from 'react';
import type { PrimeLimit } from '../types';
import { startNote } from '../audioEngine';
import { useStore } from '../store';
import { shallow } from 'zustand/shallow';

type GlobalKeyHandlerOptions = {
  activeTab: string;
  isEnabled?: boolean;
};

export const useGlobalKeyHandler = ({ activeTab, isEnabled = true }: GlobalKeyHandlerOptions) => {
  const {
    customKeyboard,
    keyBindings,
    settings,
    resetHarmonicCenter,
    navigateSelection,
    setNavAxisHorizontal,
    setNavAxisVertical,
    comparisonNodes,
    toggleKeyboard,
    toggleComparisonTray,
    setModifierKeys,
    togglePureUIMode,
    undoSettings,
    redoSettings,
    panels,
    keyboardLayout,
    keyboardHoldNotes,
    addComparisonGroup,
    clearComparisonNodesOnly
  } = useStore((s) => ({
    customKeyboard: s.customKeyboard,
    keyBindings: s.keyBindings,
    settings: s.settings,
    resetHarmonicCenter: s.resetHarmonicCenter,
    navigateSelection: s.navigateSelection,
    setNavAxisHorizontal: s.setNavAxisHorizontal,
    setNavAxisVertical: s.setNavAxisVertical,
    comparisonNodes: s.comparisonNodes,
    toggleKeyboard: s.toggleKeyboard,
    toggleComparisonTray: s.toggleComparisonTray,
    setModifierKeys: s.setModifierKeys,
    togglePureUIMode: s.togglePureUIMode,
    undoSettings: s.undoSettings,
    redoSettings: s.redoSettings,
    panels: s.panels,
    keyboardLayout: s.keyboardLayout,
    keyboardHoldNotes: s.keyboardHoldNotes,
    addComparisonGroup: s.addComparisonGroup,
    clearComparisonNodesOnly: s.clearComparisonNodesOnly
  }), shallow);
  const chordVoicesRef = useRef<(() => void)[]>([]);
  const keyboardVoicesRef = useRef<Record<string, () => void>>({});
  const prevHoldRef = useRef(keyboardHoldNotes);
  const prevLayoutRef = useRef<'custom' | 'standard'>(keyboardLayout);

  useEffect(() => {
    if (!isEnabled) return;
    if (typeof window === 'undefined') return;

    const isKeyboardFullscreen = () => {
      const keyboard = panels.keyboard;
      return !!(keyboard && keyboard.isOpen && keyboard.mode === 'fullscreen');
    };

    if (isKeyboardFullscreen()) {
      Object.values(keyboardVoicesRef.current).forEach(stop => stop());
      keyboardVoicesRef.current = {};
      chordVoicesRef.current.forEach(stop => stop());
      chordVoicesRef.current = [];
    }

    const setNodePlaying = (nodeId: string, isPlaying: boolean) => {
      const { playingNodeIds, setPlayingNodeStates } = useStore.getState();
      const newMap = new Map(playingNodeIds);
      if (isPlaying) {
        newMap.set(nodeId, { channels: [0], velocity: 100 });
      } else {
        newMap.delete(nodeId);
      }
      setPlayingNodeStates(newMap);
    };
    if (prevHoldRef.current && !keyboardHoldNotes) {
      Object.entries(keyboardVoicesRef.current).forEach(([id, stop]) => {
        stop();
        setNodePlaying(id, false);
      });
      keyboardVoicesRef.current = {};
    }
    if (prevLayoutRef.current === 'custom' && keyboardLayout !== 'custom') {
      Object.entries(keyboardVoicesRef.current).forEach(([id, stop]) => {
        stop();
        setNodePlaying(id, false);
      });
      keyboardVoicesRef.current = {};
    }
    prevHoldRef.current = keyboardHoldNotes;
    prevLayoutRef.current = keyboardLayout;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isKeyboardFullscreen()) return;

      const isMathPanelOpen = panels.mathlab && panels.mathlab.isOpen;
      const isSettingsMathTab = panels.settings && panels.settings.isOpen && (activeTab as any) === 'math';
      const isSettingsToolsTab = panels.settings && panels.settings.isOpen && (activeTab as any) === 'tools';

      if (isMathPanelOpen || isSettingsMathTab || isSettingsToolsTab) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const key = e.key.toLowerCase();
      const boundNode = keyboardLayout === 'custom'
        ? customKeyboard.find(node => keyBindings[node.id] === key)
        : null;
      if (boundNode) {
        if (e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const active = keyboardVoicesRef.current[boundNode.id];
        if (keyboardHoldNotes) {
          if (active) {
            active();
            setNodePlaying(boundNode.id, false);
            delete keyboardVoicesRef.current[boundNode.id];
          } else {
            keyboardVoicesRef.current[boundNode.id] = startNote(boundNode, settings, 'keyboard');
            setNodePlaying(boundNode.id, true);
          }
        } else if (!active) {
          keyboardVoicesRef.current[boundNode.id] = startNote(boundNode, settings, 'keyboard');
          setNodePlaying(boundNode.id, true);
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (key === 'tab') {
        e.preventDefault();
        setModifierKeys({ tab: true });
        return;
      }

      if (key === 'z') setModifierKeys({ z: true });
      if (key === 'a') setModifierKeys({ a: true });
      if (key === 'x') setModifierKeys({ x: true });
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redoSettings();
        else undoSettings();
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        redoSettings();
        return;
      }
      if (e.repeat) return;
      if (key === 'h') {
        e.preventDefault();
        togglePureUIMode();
        return;
      }
      if (key === 'arrowright') {
        e.preventDefault();
        navigateSelection({ dx: 1, dy: 0 });
        return;
      }
      if (key === 'arrowleft') {
        e.preventDefault();
        navigateSelection({ dx: -1, dy: 0 });
        return;
      }
      if (key === 'arrowup') {
        e.preventDefault();
        navigateSelection({ dx: 0, dy: 1 });
        return;
      }
      if (key === 'arrowdown') {
        e.preventDefault();
        navigateSelection({ dx: 0, dy: -1 });
        return;
      }
      if (key === '=' || key === '+') {
        e.preventDefault();
        navigateSelection({ dz: 1 });
        return;
      }
      if (key === '-' || key === '_') {
        e.preventDefault();
        navigateSelection({ dz: -1 });
        return;
      }
      if (!settings.isSimpleMode) {
        if (key === 'k') {
          toggleKeyboard();
          return;
        }
        if (key === 'c') {
          toggleComparisonTray();
          return;
        }
        if (key === 'enter' && e.shiftKey) {
          if (comparisonNodes.length > 0) {

            addComparisonGroup(`Chord ${Date.now().toString(36).slice(-4).toUpperCase()}`, [...comparisonNodes]);
            clearComparisonNodesOnly();
          }
          return;
        }
      }

      if (!settings.isSimpleMode && settings.navigationShortcuts) {
        for (const [l, k] of Object.entries(settings.navigationShortcuts)) {
          if (key === (k as string).toLowerCase() && parseInt(l) <= settings.maxPrimeLimit) {
            if (e.shiftKey) setNavAxisVertical(parseInt(l) as PrimeLimit);
            else setNavAxisHorizontal(parseInt(l) as PrimeLimit);
            return;
          }
        }
      }
      if (key === 'r') resetHarmonicCenter();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isKeyboardFullscreen()) return;

      const isMathPanelOpen = panels.mathlab && panels.mathlab.isOpen;
      const isSettingsMathTab = panels.settings && panels.settings.isOpen && (activeTab as any) === 'math';
      const isSettingsToolsTab = panels.settings && panels.settings.isOpen && (activeTab as any) === 'tools';
      if (isMathPanelOpen || isSettingsMathTab || isSettingsToolsTab) return;

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const key = e.key.toLowerCase();
      const boundNode = keyboardLayout === 'custom'
        ? customKeyboard.find(node => keyBindings[node.id] === key)
        : null;
      if (boundNode) {
        if (!keyboardHoldNotes) {
          const stop = keyboardVoicesRef.current[boundNode.id];
          if (stop) {
            stop();
            setNodePlaying(boundNode.id, false);
            delete keyboardVoicesRef.current[boundNode.id];
          }
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (key === 'tab') {
        e.preventDefault();
        setModifierKeys({ tab: false });
        // Don't return here, let it bubble if needed, but we consumed it as modifier
      }
      if (key === 'z') setModifierKeys({ z: false });
      if (key === 'a') setModifierKeys({ a: false });
      if (key === 'x') setModifierKeys({ x: false });
      if (key === 'enter') {
        chordVoicesRef.current.forEach(stop => stop());
        chordVoicesRef.current = [];
      }
      const targetNode = customKeyboard.find(node => keyBindings[node.id] === key);
      if (targetNode && keyboardVoicesRef.current[targetNode.id]) {
        keyboardVoicesRef.current[targetNode.id]();
        setNodePlaying(targetNode.id, false);
        delete keyboardVoicesRef.current[targetNode.id];
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [
    activeTab,
    addComparisonGroup,
    clearComparisonNodesOnly,
    comparisonNodes,
    customKeyboard,
    isEnabled,
    keyboardHoldNotes,
    keyboardLayout,
    keyBindings,
    navigateSelection,
    panels,
    redoSettings,
    resetHarmonicCenter,
    setModifierKeys,
    setNavAxisHorizontal,
    setNavAxisVertical,
    setNavAxisVertical,
    settings,
    toggleComparisonTray,
    toggleKeyboard,
    togglePureUIMode,
    undoSettings
  ]);
};
