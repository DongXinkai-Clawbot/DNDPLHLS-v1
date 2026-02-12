import type { HuntLogEntry, HuntLogLevel } from './types';

export class HuntLogger {
  private entries: HuntLogEntry[] = [];

  log(level: HuntLogLevel, message: string, data?: Omit<HuntLogEntry, 'level' | 'message'>) {
    this.entries.push({ level, message, ...(data || {}) });
  }

  info(message: string, data?: Omit<HuntLogEntry, 'level' | 'message'>) {
    this.log('info', message, data);
  }

  debug(message: string, data?: Omit<HuntLogEntry, 'level' | 'message'>) {
    this.log('debug', message, data);
  }

  error(message: string, data?: Omit<HuntLogEntry, 'level' | 'message'>) {
    this.log('error', message, data);
  }

  flush(): HuntLogEntry[] {
    return [...this.entries];
  }
}
