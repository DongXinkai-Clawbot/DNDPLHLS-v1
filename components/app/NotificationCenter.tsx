import React, { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { useStore } from '../../store';
import type { AppNotification, NotificationDialog } from '../../types';

const LEVEL_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  info: { border: 'border-blue-500/40', bg: 'bg-blue-900/30', text: 'text-blue-100' },
  success: { border: 'border-green-500/40', bg: 'bg-green-900/30', text: 'text-green-100' },
  warning: { border: 'border-yellow-500/40', bg: 'bg-yellow-900/30', text: 'text-yellow-100' },
  error: { border: 'border-red-500/40', bg: 'bg-red-900/30', text: 'text-red-100' },
};

const defaultAutoCloseMs = (level: AppNotification['level']) => {
  if (level === 'error') return 8000;
  if (level === 'warning') return 6000;
  return 4500;
};

const resolveLevelStyles = (level: AppNotification['level']) => {
  return LEVEL_STYLES[level] || LEVEL_STYLES.info;
};

export const NotificationCenter = () => {
  const {
    notifications,
    activeDialog,
    dismissNotification,
    closeDialog,
  } = useStore((s) => ({
    notifications: s.notifications,
    activeDialog: s.activeDialog,
    dismissNotification: s.dismissNotification,
    closeDialog: s.closeDialog,
  }), shallow);

  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeIds = new Set(notifications.map((n) => n.id));
    timersRef.current.forEach((timerId, id) => {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId);
        timersRef.current.delete(id);
      }
    });

    notifications.forEach((n) => {
      if (timersRef.current.has(n.id)) return;
      const ms = n.autoCloseMs ?? defaultAutoCloseMs(n.level);
      if (ms <= 0) return;
      const timerId = window.setTimeout(() => {
        dismissNotification(n.id);
        timersRef.current.delete(n.id);
      }, ms);
      timersRef.current.set(n.id, timerId);
    });
  }, [notifications, dismissNotification]);

  const dialog = activeDialog as NotificationDialog | null;
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (dialog?.type === 'prompt') {
      setPromptValue(dialog.defaultValue ?? '');
    }
  }, [dialog?.id]);

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.type === 'prompt') {
      dialog.onConfirm?.(promptValue);
    } else {
      dialog.onConfirm?.();
    }
    closeDialog();
  };

  const handleCancel = () => {
    if (!dialog) return;
    dialog.onCancel?.();
    closeDialog();
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => {
          const styles = resolveLevelStyles(n.level);
          return (
            <div
              key={n.id}
              className={`pointer-events-auto w-[320px] max-w-[80vw] border ${styles.border} ${styles.bg} ${styles.text} rounded-lg px-3 py-2 shadow-lg backdrop-blur`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {n.title && <div className="text-xs font-bold uppercase tracking-wider">{n.title}</div>}
                  <div className="text-xs leading-relaxed">{n.message}</div>
                </div>
                <button
                  onClick={() => dismissNotification(n.id)}
                  className="text-[10px] uppercase font-bold opacity-70 hover:opacity-100"
                >
                  Close
                </button>
              </div>
              {n.actions && n.actions.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {n.actions.map((action) => (
                    <button
                      key={action.id ?? action.label}
                      onClick={() => action.onClick?.()}
                      className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-black/40 hover:bg-black/60"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[1001] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 text-white">
            <div className="text-sm font-bold uppercase tracking-wider mb-2">{dialog.title}</div>
            <div className="text-xs text-gray-300 leading-relaxed mb-4">{dialog.message}</div>

            {dialog.type === 'prompt' && (
              <input
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-sm text-white mb-4 outline-none focus:border-blue-500"
                autoFocus
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-2 text-xs font-bold uppercase text-gray-300 hover:text-white"
              >
                {dialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-2 text-xs font-bold uppercase bg-blue-600 hover:bg-blue-500 rounded"
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
