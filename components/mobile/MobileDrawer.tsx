import React, { useEffect, useRef } from 'react';

type MobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/**
 * Mobile bottom drawer.
 *
 * Goals:
 * - Content scroll should NOT drag the drawer.
 * - Drag-to-close is bound ONLY to the header handle.
 * - Uses pointer events for consistent touch + mouse behavior.
 */
export const MobileDrawer = ({
  isOpen,
  onClose,
  title,
  children
}: MobileDrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const drawer = drawerRef.current;
    const handle = handleRef.current;
    if (!drawer || !handle) return;

    const applyDelta = (delta: number) => {
      const clamped = Math.max(0, delta);
      const progress = Math.min(clamped / 220, 1);
      drawer.style.transform = clamped ? `translateY(${clamped}px)` : '';
      drawer.style.opacity = clamped ? `${1 - progress * 0.5}` : '';
    };

    const schedule = () => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const delta = currentY.current - startY.current;
        if (delta > 0) applyDelta(delta);
      });
    };

    const resetStyles = () => {
      drawer.style.transform = '';
      drawer.style.opacity = '';
      if (raf.current !== null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isOpen) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      dragging.current = true;
      startY.current = e.clientY;
      currentY.current = e.clientY;

      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      currentY.current = e.clientY;
      schedule();
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;

      const delta = currentY.current - startY.current;
      resetStyles();
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

      if (delta > 120) {
        onClose();
      }
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);

    return () => {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      handle.removeEventListener('pointercancel', onPointerUp);
      resetStyles();
    };
  }, [isOpen, onClose]);

  return (
    <>
      <button
        type="button"
        aria-hidden={!isOpen}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-3xl shadow-2xl transform transition-transform duration-300 pointer-events-auto ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '90vh' }}
      >
        <div className="border-b border-gray-800">
          <div
            ref={handleRef}
            className="flex items-center justify-center py-3"
            style={{ touchAction: 'none' }}
            aria-label="Drag to close"
          >
            <div className="w-12 h-1 bg-gray-600 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-4 pb-3">
            <h2 className="text-white font-bold text-base">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors min-h-[44px] px-3"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(90vh - 88px)' }}>
          {children}
        </div>
      </div>
    </>
  );
};
