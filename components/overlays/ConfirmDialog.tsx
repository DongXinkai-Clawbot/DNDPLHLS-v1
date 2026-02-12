
import React, { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    confirmBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/70"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }}
      />

      <div
        className="relative w-[min(92vw,520px)] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl p-4"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="text-sm font-black tracking-wide text-gray-100 mb-2">
          {title}
        </div>

        <div className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap mb-4">
          {message}
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-gray-600 text-gray-200 text-xs hover:bg-gray-800"
            onClick={onCancel}
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            className={[
              "px-3 py-1.5 rounded-md text-xs font-black tracking-wide",
              danger
                ? "bg-red-900/60 hover:bg-red-900 text-red-100 border border-red-700"
                : "bg-blue-900/60 hover:bg-blue-900 text-blue-100 border border-blue-700",
            ].join(" ")}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
