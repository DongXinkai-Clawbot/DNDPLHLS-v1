import { createLogger } from './logger';
import { notifyError, notifyWarning } from './notifications';

const log = createLogger('errors');

const toMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const reportFatalError = (title: string, error: unknown, message?: string) => {
  const detail = toMessage(error);
  log.error(title, error);
  notifyError(message || detail || 'An unexpected error occurred.', title);
};

export const reportRecoverableError = (title: string, error: unknown, message?: string) => {
  const detail = toMessage(error);
  log.warn(title, error);
  notifyWarning(message || detail || 'Something went wrong. Please try again.', title);
};
