'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock } from 'lucide-react';
import { setTaskStatus } from '@/lib/actions/tasks';
import { useToast } from '@/components/ui/toast';
import { formatDue } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { TaskWithSubject } from '@/lib/data/dashboard';
import { runAction } from '@/lib/actions/run';

const PRIORITY_DOT: Record<string, string | null> = {
  none: null,
  low: 'bg-content-tertiary',
  medium: 'bg-accent',
  high: 'bg-warning',
  urgent: 'bg-danger',
};

export function TaskRow({
  task,
  timezone,
  showSubject = true,
}: {
  task: TaskWithSubject;
  timezone: string;
  showSubject?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = React.useTransition();
  // Optimistic: the tick lands immediately, and rolls back if the write fails.
  const [done, setDone] = React.useState(task.status === 'completed');

  const due = formatDue(task.due_at, task.due_has_time, timezone);

  const toggle = () => {
    const next = !done;
    setDone(next);
    startTransition(async () => {
      const result = await runAction(() => setTaskStatus(task.id, next ? 'completed' : 'planned'));
      if (!result.ok) {
        setDone(!next);
        toast(result.error, 'error');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-sunken',
        pending && 'opacity-70',
      )}
    >
      <button
        onClick={toggle}
        disabled={pending}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className={cn(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors',
          done
            ? 'border-primary bg-primary text-primary-contrast'
            : 'border-line-strong hover:border-primary',
        )}
      >
        {done && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-snug text-content',
            done && 'text-content-tertiary line-through',
          )}
        >
          {task.title}
        </p>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {due && (
            <span
              className={cn(
                'flex items-center gap-1 text-2xs',
                due.overdue && !done ? 'font-medium text-danger' : 'text-content-tertiary',
              )}
            >
              <Clock className="size-3" aria-hidden="true" />
              {due.label}
            </span>
          )}

          {showSubject && task.subjects && task.subject_id && (
            <Link
              href={`/subjects/${task.subject_id}`}
              className="flex items-center gap-1 text-2xs text-content-tertiary hover:text-content"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full"
                style={{ backgroundColor: task.subjects.color }}
              />
              {task.subjects.name}
            </Link>
          )}

          {PRIORITY_DOT[task.priority] && (
            <span className="flex items-center gap-1 text-2xs text-content-tertiary">
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', PRIORITY_DOT[task.priority])}
              />
              {task.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
