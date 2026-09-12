'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Flag, Hash, CornerDownLeft, X } from 'lucide-react';
import { parseTaskInput, type ParsedTask } from '@/lib/parse-task';
import { createTask } from '@/lib/actions/tasks';
import { useToast } from '@/components/ui/toast';
import { formatDue } from '@/lib/dates';
import { cn } from '@/lib/utils';

type SubjectOption = { id: string; name: string; color: string };

const REMINDER_CHOICES = [
  { label: 'No reminder', value: '' },
  { label: 'At the deadline', value: '0' },
  { label: '1 hour before', value: '-60' },
  { label: '3 hours before', value: '-180' },
  { label: '1 day before', value: '-1440' },
  { label: '2 days before', value: '-2880' },
];

/**
 * Quick capture for tasks.
 *
 * The student types one line; chrono extracts the date. Crucially the parsed
 * result is rendered back BEFORE saving (section 11) -- the app states what it
 * understood rather than silently committing a guessed date, and every field
 * stays editable.
 */
export function QuickAdd({
  subjects,
  timezone,
  defaultSubjectId,
  autoFocus,
  onCreated,
}: {
  subjects: SubjectOption[];
  timezone: string;
  defaultSubjectId?: string;
  autoFocus?: boolean;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [raw, setRaw] = React.useState('');
  const [subjectId, setSubjectId] = React.useState(defaultSubjectId ?? '');
  const [reminder, setReminder] = React.useState('');
  const [pending, setPending] = React.useState(false);
  // Set when the student overrides what the parser found.
  const [dateOverride, setDateOverride] = React.useState<string | null>(null);

  // Re-parsed on every keystroke; cheap and keeps the preview honest.
  const parsed: ParsedTask = React.useMemo(() => parseTaskInput(raw), [raw]);

  const effectiveDue = dateOverride ?? parsed.dueAt;
  const effectiveHasTime = dateOverride ? true : parsed.hasTime;
  const duePreview = formatDue(effectiveDue, effectiveHasTime, timezone);
  const canSubmit = parsed.title.length > 0 && !pending;

  async function submit() {
    if (!canSubmit) return;
    setPending(true);
    const result = await createTask({
      title: parsed.title,
      subjectId: subjectId || null,
      dueAt: effectiveDue,
      dueHasTime: effectiveHasTime,
      priority: parsed.priority,
      tags: parsed.tags,
      reminderOffsetMinutes: reminder !== '' && effectiveDue ? Number(reminder) : null,
    });
    setPending(false);

    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }

    setRaw('');
    setDateOverride(null);
    setReminder('');
    toast('Task added', 'success');
    inputRef.current?.focus();
    router.refresh();
    onCreated?.();
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 px-3">
        <input
          ref={inputRef}
          value={raw}
          autoFocus={autoFocus}
          onChange={(e) => {
            setRaw(e.target.value);
            setDateOverride(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Finish Unit 3 questions by Monday 6pm"
          aria-label="Task description"
          className="h-11 flex-1 bg-transparent text-sm text-content outline-none placeholder:text-content-tertiary"
        />
        {raw && (
          <button
            onClick={() => {
              setRaw('');
              setDateOverride(null);
            }}
            aria-label="Clear"
            className="rounded p-1 text-content-tertiary hover:text-content"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            canSubmit
              ? 'bg-primary text-primary-contrast hover:bg-primary-hover'
              : 'cursor-not-allowed bg-surface-sunken text-content-tertiary',
          )}
        >
          Add
          <CornerDownLeft className="size-3" aria-hidden="true" />
        </button>
      </div>

      {raw.trim() && (
        <div className="border-t border-line px-3 py-2.5">
          {/* What the app understood, stated plainly before anything is saved. */}
          <p className="text-2xs text-content-tertiary">
            Will create:{' '}
            <span className="font-medium text-content">{parsed.title || '(no title yet)'}</span>
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <label className="flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-2xs">
              <CalendarClock className="size-3 text-content-tertiary" aria-hidden="true" />
              <span className="sr-only">Due date</span>
              <input
                type="datetime-local"
                value={
                  effectiveDue
                    ? new Date(
                        new Date(effectiveDue).getTime() -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ''
                }
                onChange={(e) =>
                  setDateOverride(e.target.value ? new Date(e.target.value).toISOString() : null)
                }
                className="bg-transparent text-2xs text-content outline-none"
              />
            </label>

            {duePreview && parsed.matchedText && !dateOverride && (
              // Naming the matched words makes the inference auditable.
              <span className="rounded-md bg-primary-subtle px-2 py-1 text-2xs text-primary">
                read “{parsed.matchedText}” as {duePreview.label}
              </span>
            )}

            <label className="flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-2xs">
              <span className="sr-only">Subject</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="bg-transparent text-2xs text-content outline-none"
              >
                <option value="">No subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {effectiveDue && (
              <label className="flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1 text-2xs">
                <span className="sr-only">Reminder</span>
                <select
                  value={reminder}
                  onChange={(e) => setReminder(e.target.value)}
                  className="bg-transparent text-2xs text-content outline-none"
                >
                  {REMINDER_CHOICES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {parsed.priority !== 'none' && (
              <span className="flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-1 text-2xs text-warning">
                <Flag className="size-2.5" aria-hidden="true" />
                {parsed.priority}
              </span>
            )}

            {parsed.tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-0.5 rounded-md bg-surface-sunken px-2 py-1 text-2xs text-content-secondary"
              >
                <Hash className="size-2.5" aria-hidden="true" />
                {t}
              </span>
            ))}
          </div>

          <p className="mt-2 text-2xs text-content-tertiary">
            Try <code className="text-content-secondary">!high</code> for priority or{' '}
            <code className="text-content-secondary">#tag</code> to label it.
          </p>
        </div>
      )}
    </div>
  );
}
