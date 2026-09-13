'use client';

import { Check, CloudOff, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline';

/**
 * Tells the student exactly where their text stands (section 47).
 * "Saved" is only ever shown after the server confirms the write.
 */
export function SaveStatus({
  state,
  savedAt,
  className,
}: {
  state: SaveState;
  savedAt?: string | null;
  className?: string;
}) {
  const map: Record<SaveState, { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }> = {
    clean: { icon: Check, label: savedAt ? `Saved ${savedAt}` : 'Saved', tone: 'text-content-tertiary' },
    dirty: { icon: Pencil, label: 'Unsaved changes', tone: 'text-content-tertiary' },
    saving: { icon: Loader2, label: 'Saving…', tone: 'text-content-tertiary' },
    saved: { icon: Check, label: savedAt ? `Saved ${savedAt}` : 'Saved', tone: 'text-success' },
    error: { icon: AlertCircle, label: 'Could not save — retrying', tone: 'text-danger' },
    offline: { icon: CloudOff, label: 'Offline — kept on this device', tone: 'text-warning' },
  };

  const { icon: Icon, label, tone } = map[state];

  return (
    // aria-live so the state change is announced without moving focus.
    <p aria-live="polite" className={cn('flex items-center gap-1.5 text-2xs', tone, className)}>
      <Icon className={cn('size-3', state === 'saving' && 'animate-spin')} aria-hidden="true" />
      {label}
    </p>
  );
}
