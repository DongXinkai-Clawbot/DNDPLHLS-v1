
export type DestinationType = 
  | 'webmidi'      
  | 'mts-esp'      
  | 'native-host'  
  | 'internal';    

export type DestinationStatus =
  | 'disconnected'
  | 'connecting'
  | 'preflighting'
  | 'ready'
  | 'error';

export interface DestinationCapabilities {
  supportsPb: boolean;
  supportsMpe: boolean;
  supportsMts: boolean;
  maxMessagesPerSecond?: number;
  transport?: string;
}

export interface OutputDestination {
  id: string;
  type: DestinationType;
  name: string;
  
  pitchBendRangeSemitones: number;  
  
  connected: boolean;
  status?: DestinationStatus;
  lastError?: string;
  lastErrorCode?: string;
  lastConnectedAt?: number;
  lastPreflightAt?: number;
  capabilitiesSnapshot?: DestinationCapabilities;
  
  webmidi?: {
    outputId: string;
    sendRpnOnConnect: boolean;  
  };
  
  mtsEsp?: {
    clientCount: number;
    broadcastIntervalMs: number;
    mode?: 'broadcast-only' | 'broadcast+passthrough';
    broadcastPolicy?: 'onchange' | 'interval' | 'manual';
    intervalMs?: number;
  };
  
  nativeHost?: {
    pluginId: string;
    format: 'vst3' | 'au';
  };
}

export interface DestinationManager {
  getActive(): OutputDestination | null;
  setActive(id: string): void;
  list(): OutputDestination[];
  add(destination: OutputDestination): void;
  remove(id: string): void;
  update(id: string, updates: Partial<OutputDestination>): void;
  
  getPitchBendRange(): number;
  setPitchBendRange(semitones: number): void;
}

// Note: destination IDs must be globally unique across tabs/instances for group sync.
const createDestinationId = (type: DestinationType): string => {
  const c: any = (globalThis as any).crypto;
  const uuid = typeof c?.randomUUID === 'function' ? c.randomUUID() : null;
  if (uuid) return `dest-${type}-${uuid}`;
  return `dest-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function createDefaultDestination(type: DestinationType, name?: string): OutputDestination {
  const id = createDestinationId(type);
  
  const base: OutputDestination = {
    id,
    type,
    name: name ?? getDefaultName(type),
    pitchBendRangeSemitones: 48,  
    connected: false,
    status: 'disconnected',
  };
  
  switch (type) {
    case 'webmidi':
      return {
        ...base,
        webmidi: {
          outputId: '',
          sendRpnOnConnect: true,
        },
      };
    
    case 'mts-esp':
      return {
        ...base,
        mtsEsp: {
          clientCount: 0,
          broadcastIntervalMs: 100,
          mode: 'broadcast-only',
          broadcastPolicy: 'onchange',
          intervalMs: 1000,
        },
      };
    
    case 'native-host':
      return {
        ...base,
        nativeHost: {
          pluginId: '',
          format: 'vst3',
        },
      };
    
    case 'internal':
    default:
      return base;
  }
}

function getDefaultName(type: DestinationType): string {
  switch (type) {
    case 'webmidi': return 'MIDI Output';
    case 'mts-esp': return 'MTS-ESP Master';
    case 'native-host': return 'Plugin Host';
    case 'internal': return 'Internal Audio';
    default: return 'Unknown';
  }
}

export function isValidPitchBendRange(semitones: number): boolean {
  return Number.isFinite(semitones) && semitones >= 1 && semitones <= 96;
}

export function clampPitchBendRange(semitones: number): number {
  if (!Number.isFinite(semitones)) return 48;
  return Math.min(96, Math.max(1, Math.round(semitones)));
}

export function getPitchBendRangeFromDestination(
  destination: OutputDestination | null | undefined,
  defaultValue: number = 48
): number {
  if (!destination) return defaultValue;
  return clampPitchBendRange(destination.pitchBendRangeSemitones);
}
