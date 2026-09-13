'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsClient } from '@/lib/use-client-value';

/**
 * Accessible modal dialog.
 *
 * Built on <div role="dialog"> rather than <dialog> so the backdrop, animation
 * and stacking behave identically across browsers. It therefore has to do by
 * hand what <dialog> gives free:
 *   - focus moves into the dialog on open and returns to the trigger on close
 *   - Tab is trapped inside while open
 *   - Escape closes
 *   - background scroll is locked
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusTo = React.useRef<HTMLElement | null>(null);
  const isClient = useIsClient();
  const titleId = React.useId();
  const descId = React.useId();

  // Held in a ref so the effect below depends only on `open`. Every caller
  // passes onClose as an inline arrow, so its identity changes on each parent
  // render; with it in the dependency list, an unrelated re-render tore the
  // effect down and rebuilt it -- and the teardown pulls focus back to the
  // trigger and releases the scroll lock. Typing in a dialog while anything
  // above it re-rendered meant losing the caret mid-word.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control, or the panel itself if there is nothing to focus.
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    window.requestAnimationFrame(() => (focusables()[0] ?? panelRef.current)?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  if (!isClient || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-[var(--sm-overlay)] motion-safe:animate-[sm-fade-in_150ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-t-2xl border border-line bg-surface-raised shadow-lg',
          'sm:rounded-2xl motion-safe:animate-[sm-panel-in_180ms_ease-out]',
          'max-h-[90vh] overflow-y-auto',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-content">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-0.5 text-xs text-content-secondary">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-content-tertiary hover:bg-surface-sunken hover:text-content"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive-action confirmation. Never delete without one (section 39). */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-content-secondary">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 rounded-md border border-line-strong px-3.5 text-sm font-medium text-content hover:bg-surface-sunken"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="h-9 rounded-md bg-danger px-3.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Working...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
