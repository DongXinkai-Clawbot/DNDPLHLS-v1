
import { bigIntReplacer, bigIntReviver } from './utils';
import { buildSessionSnapshotFromState, applySessionSnapshot } from './snapshot';
import type { SavedSession } from '../../types';
import { registerSample } from '../../audioEngine';
import { createLogger } from '../../utils/logger';

const log = createLogger('store/session');

export const saveSession = (get: any) => {
    const s = get();
    const session = buildSessionSnapshotFromState(s);
    const blob = new Blob([JSON.stringify(session, bigIntReplacer)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lattice-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const loadSession = async (set: any, get: any, file: File) => {
    try {
        const text = await file.text();
        const session = JSON.parse(text, bigIntReviver) as SavedSession;
        applySessionSnapshot(set, get, session);
    } catch (e) {
        log.error('Session load error', e);
        get().pushNotification?.({
            level: 'error',
            title: 'Session',
            message: 'Failed to load session file.'
        });
    }
};

export const loadFileToNewLattice = async (set: any, get: any, file: File) => {
    try {
      const currentSnapshot = buildSessionSnapshotFromState(get());
      const text = await file.text();
      const newSession = JSON.parse(text, bigIntReviver) as SavedSession;

      if (!newSession.settings) {
        get().pushNotification?.({
          level: 'warning',
          title: 'Session',
          message: 'Invalid session file (missing settings).'
        });
        return;
      }

      set({
        latticeSlotCurrent: currentSnapshot,
        latticeSlotNew: newSession,
        latticeSlotNewName: file.name || "session.json",
      });

      applySessionSnapshot(set, get, newSession);
    } catch (e) {
      log.error('Load file error', e);
      get().pushNotification?.({
        level: 'error',
        title: 'Session',
        message: 'Failed to load file.'
      });
    }
};

export const uploadCustomSample = async (set: any, name: string, file: File) => {
    const buf = await file.arrayBuffer();
    if (await registerSample(name, buf)) {
        set((s: any) => ({ customSampleNames: [...s.customSampleNames, name] }));
        get().pushNotification?.({
            level: 'success',
            title: 'Sample Loaded',
            message: `Sample "${name}" loaded. Select it in Audio settings.`
        });
    } else {
        get().pushNotification?.({
            level: 'error',
            title: 'Sample Error',
            message: 'Failed to decode audio.'
        });
    }
};
