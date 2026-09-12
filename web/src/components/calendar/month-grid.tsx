'use client';

import * as React from 'react';
import Link from 'next/link';
import { TZDate } from '@date-fns/tz';
import {
  format, isSameMonth, isSameDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TaskRow } from '@/components/tasks/task-row';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { TaskWithSubject } from '@/lib/data/dashboard';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month view of everything with a deadline.
 *
 * Day cells are computed in the student's timezone: a task due 00:30 UTC
 * belongs to the previous day for someone in UTC-5, and putting it on the wrong
 * square makes the whole calendar untrustworthy.
 */
export function MonthGrid({
  tasks,
  timezone,
  monthOffset,
}: {
  tasks: TaskWithSubject[];
  timezone: string;
  monthOffset: number;
}) {
  const today = new TZDate(new Date(), timezone);
  const month = addMonths(today, monthOffset);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  // Bucket once, rather than filtering the whole task list inside every cell.
  const byDay = React.useMemo(() => {
    const map = new Map<string, TaskWithSubject[]>();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const key = format(new TZDate(new Date(task.due_at), timezone), 'yyyy-MM-dd');
      const bucket = map.get(key);
      if (bucket) bucket.push(task);
      else map.set(key, [task]);
    }
    return map;
  }, [tasks, timezone]);

  const [selected, setSelected] = React.useState<string | null>(null);
  const selectedTasks = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-content">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/calendar?m=${monthOffset - 1}`}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-content-secondary hover:bg-surface-sunken"
          >
            <ChevronLeft className="size-4" />
          </Link>
          {monthOffset !== 0 && (
            <Link
              href="/calendar"
              className="rounded-md px-2 py-1 text-2xs font-medium text-content-secondary hover:bg-surface-sunken"
            >
              Today
            </Link>
          )}
          <Link
            href={`/calendar?m=${monthOffset + 1}`}
            aria-label="Next month"
            className="rounded-md p-1.5 text-content-secondary hover:bg-surface-sunken"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-line bg-surface-sunken">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-1.5 text-center text-2xs font-medium text-content-tertiary"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayTasks = byDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, today);

            return (
              <button
                key={key}
                onClick={() => setSelected(dayTasks.length ? key : null)}
                aria-label={`${format(day, 'd MMMM')}, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}`}
                aria-pressed={selected === key}
                className={cn(
                  'min-h-16 border-b border-r border-line p-1 text-left transition-colors sm:min-h-24',
                  !inMonth && 'bg-surface-sunken/40',
                  selected === key && 'bg-primary-subtle',
                  dayTasks.length > 0 && 'hover:bg-surface-sunken',
                )}
              >
                <span
                  className={cn(
                    'inline-grid size-5 place-items-center rounded-full text-2xs tabular-nums',
                    isToday && 'bg-primary font-semibold text-primary-contrast',
                    !isToday && inMonth && 'text-content',
                    !inMonth && 'text-content-tertiary',
                  )}
                >
                  {format(day, 'd')}
                </span>

                <div className="mt-0.5 space-y-0.5">
                  {dayTasks.slice(0, 2).map((t) => (
                    <span
                      key={t.id}
                      className={cn(
                        'block truncate rounded px-1 py-px text-[10px] leading-tight',
                        t.status === 'completed'
                          ? 'text-content-tertiary line-through'
                          : 'text-content',
                      )}
                      style={
                        t.subjects
                          ? { backgroundColor: `${t.subjects.color}1a` }
                          : { backgroundColor: 'var(--sm-surface-sunken)' }
                      }
                    >
                      {t.title}
                    </span>
                  ))}
                  {dayTasks.length > 2 && (
                    <span className="block px-1 text-[10px] text-content-tertiary">
                      +{dayTasks.length - 2} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selected && selectedTasks.length > 0 && (
        <Card className="p-2">
          <h3 className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-content-secondary">
            {format(new TZDate(new Date(`${selected}T12:00:00Z`), timezone), 'EEEE d MMMM')}
          </h3>
          <div className="space-y-0.5">
            {selectedTasks.map((t) => (
              <TaskRow key={t.id} task={t} timezone={timezone} />
            ))}
          </div>
        </Card>
      )}

      {tasks.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled this month"
          description="Tasks with a due date appear here so you can see the shape of the week ahead."
        />
      )}
    </div>
  );
}
