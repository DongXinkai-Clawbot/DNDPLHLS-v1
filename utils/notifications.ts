import { useStore } from '../store';
import type { AppNotification, NotificationDialog } from '../types';

type NotificationInput = Omit<AppNotification, 'id'> & { id?: string };
type DialogInput = Omit<NotificationDialog, 'id' | 'type'>;

const getActions = () => useStore.getState();

export const notify = (notification: NotificationInput) => {
  const { pushNotification } = getActions();
  if (pushNotification) pushNotification(notification);
};

export const notifyInfo = (message: string, title = 'Info') =>
  notify({ level: 'info', title, message });

export const notifySuccess = (message: string, title = 'Success') =>
  notify({ level: 'success', title, message });

export const notifyWarning = (message: string, title = 'Warning') =>
  notify({ level: 'warning', title, message, autoCloseMs: 7000 });

export const notifyError = (message: string, title = 'Error') =>
  notify({ level: 'error', title, message, autoCloseMs: 10000 });

export const openConfirm = (dialog: DialogInput) => {
  const { openConfirmDialog } = getActions();
  if (openConfirmDialog) openConfirmDialog(dialog);
};

export const openPrompt = (dialog: DialogInput) => {
  const { openPromptDialog } = getActions();
  if (openPromptDialog) openPromptDialog(dialog);
};
