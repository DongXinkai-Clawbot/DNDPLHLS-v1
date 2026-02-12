export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

type LogEntry = {
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
};

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5
};

const BUFFER_LIMIT = 500;
const logBuffer: LogEntry[] = [];
let currentLevel: LogLevel = resolveInitialLevel();

function resolveInitialLevel(): LogLevel {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem('hl-log-level');
    const override = (window as any).__HL_LOG_LEVEL__ as LogLevel | undefined;
    const candidate = override || (stored as LogLevel | null);
    if (candidate && candidate in LEVEL_RANK) return candidate;
  }
  return import.meta.env.DEV ? 'info' : 'silent';
}

function shouldOutput(level: LogLevel) {
  if (!import.meta.env.DEV) return false;
  return LEVEL_RANK[level] <= LEVEL_RANK[currentLevel] && currentLevel !== 'silent';
}

function record(entry: LogEntry) {
  logBuffer.unshift(entry);
  if (logBuffer.length > BUFFER_LIMIT) {
    logBuffer.length = BUFFER_LIMIT;
  }
}

function emit(level: LogLevel, scope: string, message: string, data?: unknown) {
  const entry = { ts: Date.now(), level, scope, message, data };
  record(entry);
  if (shouldOutput(level)) {
    const prefix = `[${scope}]`;
    if (level === 'error') console.error(prefix, message, data ?? '');
    else if (level === 'warn') console.warn(prefix, message, data ?? '');
    else if (level === 'info') console.info(prefix, message, data ?? '');
    else if (level === 'debug') console.debug(prefix, message, data ?? '');
    else console.log(prefix, message, data ?? '');
  }
}

export function createLogger(scope: string) {
  return {
    error: (message: string, data?: unknown) => emit('error', scope, message, data),
    warn: (message: string, data?: unknown) => emit('warn', scope, message, data),
    info: (message: string, data?: unknown) => emit('info', scope, message, data),
    debug: (message: string, data?: unknown) => emit('debug', scope, message, data),
    trace: (message: string, data?: unknown) => emit('trace', scope, message, data)
  };
}

export function setLogLevel(level: LogLevel) {
  if (!(level in LEVEL_RANK)) return;
  currentLevel = level;
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem('hl-log-level', level);
  }
}

export function getLogLevel() {
  return currentLevel;
}

export function getLogBuffer(filter?: { scopePrefix?: string; levelAtLeast?: LogLevel }) {
  if (!filter) return [...logBuffer];
  const levelMin = filter.levelAtLeast ? LEVEL_RANK[filter.levelAtLeast] : 0;
  return logBuffer.filter((entry) => {
    if (filter.scopePrefix && !entry.scope.startsWith(filter.scopePrefix)) return false;
    return LEVEL_RANK[entry.level] >= levelMin;
  });
}

export function clearLogBuffer() {
  logBuffer.length = 0;
}
