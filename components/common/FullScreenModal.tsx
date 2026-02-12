import React, { useEffect } from 'react';

type FullScreenModalProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Full-screen modal optimized for mobile.
 *
 * - Fixed layout with safe-area padding.
 * - Locks background scroll to prevent iOS "rubber band" glitches.
 * - Escape-to-close for keyboard users.
 */
export const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen,
  title,
  onClose,
  children
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-auto" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-gray-950 text-white flex flex-col"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm font-black uppercase tracking-widest text-gray-200 truncate">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] px-3 rounded-lg border border-gray-700 bg-black/40 text-xs font-black uppercase tracking-widest text-gray-200 active:scale-95"
          >
            Close
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3">
          {children}
        </div>
      </div>
    </div>
  );
};
