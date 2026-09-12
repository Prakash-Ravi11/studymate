'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, Clock } from 'lucide-react';
import {
  fetchDueReminders,
  dismissReminder,
  dismissAllReminders,
  snoozeReminder,
  SNOOZE_OPTIONS,
} from '@/lib/actions/reminders';
import { useToast } from '@/components/ui/toast';
import { formatDue, relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { DueReminder } from '@/lib/data/reminders';

/** How often an open tab re-checks for reminders that have come due. */
const POLL_MS = 60_000;

export function NotificationBell({
  initial,
  timezone,
  className,
}: {
  initial: DueReminder[];
  timezone: string;
  className?: string;
}) {
  const [reminders, setReminders] = React.useState(initial);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [snoozing, setSnoozing] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();

  // The server-rendered list is a snapshot from page load; a navigation or
  // router.refresh() sends a newer one, which should win. Adjusting state
  // during render is React's documented way to do that -- an effect would
  // paint the stale list first and then immediately repaint.
  const [lastInitial, setLastInitial] = React.useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setReminders(initial);
  }

  /**
   * Reminders come due with the clock, not with anything the student does, so
   * an open tab has to ask. Polling stops while the tab is hidden -- a
   * backgrounded tab firing a request a minute for hours is pure waste -- and
   * re-checks immediately on return, when the answer has likely changed.
   */
  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await fetchDueReminders();
        if (!cancelled) setReminders(next);
      } catch {
        // Offline or a dropped connection. The existing list stays on screen;
        // the next tick will recover.
      }
    };

    const interval = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSnoozing(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const count = reminders.length;

  async function onDismiss(id: string) {
    setBusy(id);
    // Removed from the list first: the student has acted, and waiting on a
    // round trip to reflect that reads as an unresponsive UI.
    setReminders((r) => r.filter((x) => x.id !== id));
    const result = await dismissReminder(id);
    setBusy(null);
    if (!result.ok) {
      toast(result.error, 'error');
      setReminders(await fetchDueReminders());
      return;
    }
    router.refresh();
  }

  async function onSnooze(id: string, minutes: number) {
    setBusy(id);
    setSnoozing(null);
    setReminders((r) => r.filter((x) => x.id !== id));
    const result = await snoozeReminder(id, minutes);
    setBusy(null);
    if (!result.ok) {
      toast(result.error, 'error');
      setReminders(await fetchDueReminders());
      return;
    }
    const option = SNOOZE_OPTIONS.find((o) => o.minutes === minutes);
    toast(`Snoozed for ${option?.label ?? `${minutes} minutes`}.`, 'success');
    router.refresh();
  }

  async function onDismissAll() {
    const previous = reminders;
    setReminders([]);
    const result = await dismissAllReminders();
    if (!result.ok) {
      toast(result.error, 'error');
      setReminders(previous);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count > 0 ? `Reminders, ${count} due` : 'Reminders'}
        className="relative rounded-md p-2 text-content-secondary hover:bg-surface-sunken hover:text-content"
      >
        <Bell className="size-4" aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full',
              'bg-danger px-1 text-[10px] font-semibold leading-4 text-white',
            )}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Due reminders"
          className={cn(
            'absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden',
            'rounded-lg border border-line bg-surface-raised shadow-lg',
            'motion-safe:animate-[sm-panel-in_140ms_ease-out]',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-xs font-semibold text-content">Reminders</p>
            {count > 0 && (
              <button
                onClick={() => void onDismissAll()}
                className="rounded px-1.5 py-0.5 text-2xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content"
              >
                Clear all
              </button>
            )}
          </div>

          {count === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-content-tertiary">
              Nothing due right now.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {reminders.map((reminder) => {
                const due = reminder.task
                  ? formatDue(reminder.task.dueAt, reminder.task.dueHasTime, timezone)
                  : null;
                const title = reminder.task?.title ?? reminder.label ?? 'Reminder';

                return (
                  <li key={reminder.id} className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {reminder.task ? (
                          <Link
                            href="/tasks"
                            onClick={() => setOpen(false)}
                            className="block truncate text-xs font-medium text-content hover:text-primary"
                          >
                            {title}
                          </Link>
                        ) : (
                          <p className="truncate text-xs font-medium text-content">{title}</p>
                        )}

                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-2xs text-content-tertiary">
                          {reminder.task?.subjectName && (
                            <span className="inline-flex items-center gap-1">
                              <span
                                aria-hidden="true"
                                className="size-1.5 rounded-full"
                                style={{ backgroundColor: reminder.task.subjectColor ?? undefined }}
                              />
                              {reminder.task.subjectName}
                            </span>
                          )}
                          {due && (
                            <span className={cn(due.overdue && 'text-danger')}>
                              {due.overdue ? 'Overdue' : 'Due'} {due.label}
                            </span>
                          )}
                          <span>· {relativeTime(reminder.fireAt)}</span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          onClick={() => setSnoozing((s) => (s === reminder.id ? null : reminder.id))}
                          disabled={busy === reminder.id}
                          aria-label={`Snooze reminder for ${title}`}
                          aria-expanded={snoozing === reminder.id}
                          className="rounded p-1 text-content-tertiary hover:bg-surface-sunken hover:text-content disabled:opacity-50"
                        >
                          <Clock className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => void onDismiss(reminder.id)}
                          disabled={busy === reminder.id}
                          aria-label={`Dismiss reminder for ${title}`}
                          className="rounded p-1 text-content-tertiary hover:bg-surface-sunken hover:text-content disabled:opacity-50"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {snoozing === reminder.id && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {SNOOZE_OPTIONS.map((option) => (
                          <button
                            key={option.minutes}
                            onClick={() => void onSnooze(reminder.id, option.minutes)}
                            className="rounded border border-line px-1.5 py-0.5 text-2xs text-content-secondary hover:border-line-strong hover:text-content"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
