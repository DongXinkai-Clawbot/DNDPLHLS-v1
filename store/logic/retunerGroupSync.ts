import type { AppState, AppSettings, OutputDestination } from '../../types';
import { nativeBridgeCore } from '../../native/bridge';
import { STORAGE_KEYS } from './storageKeys';

// Channel identifiers (keep stable for backward compatibility).
const BC_NAME = STORAGE_KEYS.retunerGroupSyncChannel;
const STORAGE_KEY = STORAGE_KEYS.retunerGroupSyncMessage;

type RetunerGroupId = 'Off' | 'A' | 'B' | 'C' | 'D';

type GroupSyncMessage = {
  v: 1;
  type: 'hello' | 'state';
  sender: string;
  ts: number;
  group: RetunerGroupId;
  payload?: {
    retuner?: any;
    retunerDestinations?: OutputDestination[];
  };
};

const createInstanceId = (): string => {
  const c: any = (globalThis as any).crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const INSTANCE_ID = createInstanceId();

const getGroup = (settings: AppSettings): RetunerGroupId => {
  const g = (settings as any)?.retuner?.group;
  return (g === 'A' || g === 'B' || g === 'C' || g === 'D') ? g : 'Off';
};

const sanitizeDestinationsForSync = (dests: OutputDestination[] | undefined | null): OutputDestination[] => {
  if (!Array.isArray(dests)) return [];
  return dests.map(d => ({
    ...d,
    // Connection status is runtime-only; don't spam group sync with it.
    connected: false,
    status: 'disconnected',
    lastError: undefined,
    lastErrorCode: undefined,
    lastConnectedAt: undefined,
    lastPreflightAt: undefined,
    capabilitiesSnapshot: undefined,
  }));
};

const safeJsonParse = (s: string): any | null => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

export function setupRetunerGroupSync(useStore: any): void {
  if (typeof window === 'undefined') return;

  let bc: BroadcastChannel | null = null;
  try {
    bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BC_NAME) : null;
  } catch {
    bc = null;
  }

  let suppressBroadcastUntil = 0;
  let lastSentHash = '';
  let lastSentGroup: RetunerGroupId = 'Off';

  const send = (msg: GroupSyncMessage) => {
    // 1) BroadcastChannel
    try {
      bc?.postMessage(msg);
    } catch {
      // ignore
    }

    // 2) localStorage fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
      // some browsers only fire 'storage' on remove/change; remove immediately
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    // 3) Native relay (for plugin multi-instance where storage may not be shared)
    // Avoid spamming console in mock mode.
    try {
      if (!nativeBridgeCore.isMockMode() && nativeBridgeCore.isConnected()) {
        void nativeBridgeCore.call('sync.broadcast' as any, msg as any).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  };

  const applyState = (incoming: GroupSyncMessage) => {
    if (!incoming || incoming.v !== 1) return;
    if (incoming.sender === INSTANCE_ID) return;
    if (typeof incoming.ts !== 'number' || Date.now() - incoming.ts > 30_000) {
      // Drop stale messages.
      return;
    }

    const state: AppState = useStore.getState();
    const settings: AppSettings = state.settings;
    const myGroup = getGroup(settings);
    if (myGroup === 'Off') return;
    if (incoming.group !== myGroup) return;

    if (incoming.type === 'hello') {
      // Reply with our current state for this group.
      const payload = {
        retuner: (settings as any).retuner,
        retunerDestinations: sanitizeDestinationsForSync((settings as any).retunerDestinations),
      };
      send({ v: 1, type: 'state', sender: INSTANCE_ID, ts: Date.now(), group: myGroup, payload });
      return;
    }

    if (incoming.type === 'state' && incoming.payload) {
      suppressBroadcastUntil = Date.now() + 150;

      useStore.setState((prev: AppState) => {
        const prevSettings = prev.settings as any;
        const nextSettings = {
          ...prevSettings,
          // Merge retuner settings (incoming wins)
          retuner: {
            ...(prevSettings.retuner || {}),
            ...(incoming.payload?.retuner || {}),
          },
          // Replace destinations wholesale (keeps IDs consistent across the group)
          retunerDestinations: sanitizeDestinationsForSync(incoming.payload?.retunerDestinations),
        };

        return {
          ...prev,
          settings: nextSettings,
        };
      });
    }
  };

  // Incoming: BroadcastChannel
  if (bc) {
    bc.onmessage = (ev) => applyState(ev.data as GroupSyncMessage);
  }

  // Incoming: localStorage
  window.addEventListener('storage', (ev) => {
    if (ev.key !== STORAGE_KEY || !ev.newValue) return;
    const msg = safeJsonParse(ev.newValue);
    if (msg) applyState(msg as GroupSyncMessage);
  });

  // Incoming: native relay
  try {
    nativeBridgeCore.on('sync.message' as any, (params: any) => {
      applyState(params as GroupSyncMessage);
    });
  } catch {
    // ignore
  }

  // Outgoing: subscribe to store
  useStore.subscribe((state: AppState) => {
    const settings: AppSettings = state.settings;
    const group = getGroup(settings);

    // Track group changes and request state when entering a group.
    if (group !== lastSentGroup) {
      lastSentGroup = group;
      lastSentHash = '';
      if (group !== 'Off') {
        send({ v: 1, type: 'hello', sender: INSTANCE_ID, ts: Date.now(), group });
      }
    }

    if (group === 'Off') return;
    if (Date.now() < suppressBroadcastUntil) return;

    // Only sync retuner settings + destinations.
    const payload = {
      retuner: (settings as any).retuner,
      retunerDestinations: sanitizeDestinationsForSync((settings as any).retunerDestinations),
    };

    const hash = JSON.stringify(payload);
    if (hash === lastSentHash) return;
    lastSentHash = hash;

    send({ v: 1, type: 'state', sender: INSTANCE_ID, ts: Date.now(), group, payload });
  });

  // Kickstart: if already in a group, request state.
  try {
    const state: AppState = useStore.getState();
    const group = getGroup(state.settings);
    if (group !== 'Off') {
      lastSentGroup = group;
      send({ v: 1, type: 'hello', sender: INSTANCE_ID, ts: Date.now(), group });
    }
  } catch {
    // ignore
  }
}
