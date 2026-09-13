'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsClient } from '@/lib/use-client-value';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = React.createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.toast;
}

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES: Record<ToastTone, string> = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-primary',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const isClient = useIsClient();
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, tone, message }]);
      // Errors stay longer: they usually need reading, not just noticing.
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient &&
        createPortal(
          // aria-live so a toast is announced without stealing focus.
          <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
          >
            {toasts.map((t) => {
              const Icon = ICONS[t.tone];
              return (
                <div
                  key={t.id}
                  className={cn(
                    'pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line',
                    'bg-surface-raised p-3 shadow-lg',
                    'motion-safe:animate-[sm-toast-in_180ms_ease-out]',
                  )}
                >
                  <Icon className={cn('mt-px size-4 shrink-0', TONES[t.tone])} aria-hidden="true" />
                  <p className="flex-1 text-xs leading-relaxed text-content">{t.message}</p>
                  <button
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss notification"
                    className="rounded p-0.5 text-content-tertiary hover:text-content"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
