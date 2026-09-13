'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { createSubject, updateSubject } from '@/lib/actions/subjects';
import { runAction } from '@/lib/actions/run';
import { SUBJECT_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { SubjectOverview } from '@/lib/supabase/database.types';

export function SubjectForm({
  open,
  onClose,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  /** Present when editing; absent when creating. */
  subject?: SubjectOverview | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [color, setColor] = React.useState<string>(subject?.color ?? SUBJECT_COLORS[0]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const semesterRaw = String(form.get('semester') ?? '').trim();

    const input = {
      name: String(form.get('name') ?? ''),
      code: String(form.get('code') ?? ''),
      instructor: String(form.get('instructor') ?? ''),
      description: String(form.get('description') ?? ''),
      color,
      semester: semesterRaw ? Number(semesterRaw) : null,
    };

    setPending(true);
    setError(null);
    // runAction always resolves, so `pending` always clears -- a rejected or
    // stalled action used to leave this button spinning with no way back.
    const result = subject
      ? await runAction(() => updateSubject(subject.id, input))
      : await runAction(() => createSubject(input));
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast(subject ? 'Subject updated' : `${input.name.trim()} added`, 'success');
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Edit subject' : 'New subject'}
      description={
        subject ? undefined : 'Subjects are how your files, notes and deadlines get organised.'
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && (
          <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <Field label="Subject name" required>
          {(a) => (
            <Input
              {...a}
              name="name"
              defaultValue={subject?.name ?? ''}
              placeholder="Engineering Mathematics"
              required
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Course code" hint="Optional">
            {(a) => <Input {...a} name="code" defaultValue={subject?.code ?? ''} placeholder="MA8251" />}
          </Field>
          <Field label="Semester">
            {(a) => (
              <Input
                {...a}
                name="semester"
                type="number"
                min={1}
                max={20}
                defaultValue={subject?.semester ?? ''}
                placeholder="5"
              />
            )}
          </Field>
        </div>

        <Field label="Instructor">
          {(a) => (
            <Input
              {...a}
              name="instructor"
              defaultValue={subject?.instructor ?? ''}
              placeholder="Dr. Raman"
            />
          )}
        </Field>

        <Field label="Description">
          {(a) => (
            <Textarea
              {...a}
              name="description"
              defaultValue={subject?.description ?? ''}
              placeholder="What this subject covers"
              rows={2}
            />
          )}
        </Field>

        <div>
          <span className="block text-xs font-medium text-content-secondary">Colour</span>
          <div role="radiogroup" aria-label="Subject colour" className="mt-2 flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Colour ${c}`}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'size-6 rounded-full transition-transform',
                  color === c ? 'ring-2 ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-105',
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {subject ? 'Save changes' : 'Create subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
