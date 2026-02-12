export type MidiDiagnosticsState = 'idle' | 'requesting' | 'ready' | 'error';

export type MidiMessageEntry = {
  ts: number;
  dir: 'in' | 'out';
  data: number[];
};

const MAX_MESSAGES = 24;

const diagnostics = {
  state: 'idle' as MidiDiagnosticsState,
  lastError: '',
  recentMessages: [] as MidiMessageEntry[]
};

export const setMidiDiagnosticsState = (state: MidiDiagnosticsState, error?: string) => {
  diagnostics.state = state;
  diagnostics.lastError = error || '';
};

export const recordMidiMessage = (dir: 'in' | 'out', message: ArrayLike<number>) => {
  const data = Array.from(message);
  diagnostics.recentMessages.unshift({ ts: Date.now(), dir, data });
  if (diagnostics.recentMessages.length > MAX_MESSAGES) {
    diagnostics.recentMessages.length = MAX_MESSAGES;
  }
};

export const getMidiDiagnostics = () => diagnostics;
