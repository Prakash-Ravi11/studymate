'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Mic, FileText, Link2, UploadCloud, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { QuickAdd } from '@/components/tasks/quick-add';
import { VoiceRecorder } from '@/components/voice/recorder';
import { createNote } from '@/lib/actions/notes';
import { createLinkResource } from '@/lib/actions/resources';
import { cn } from '@/lib/utils';
import { runAction } from '@/lib/actions/run';

type Mode = 'task' | 'voice' | 'link';

const MODES: { value: Mode; label: string; icon: typeof CheckSquare }[] = [
  { value: 'task', label: 'Task', icon: CheckSquare },
  { value: 'voice', label: 'Record', icon: Mic },
  { value: 'link', label: 'Link', icon: Link2 },
];

/**
 * Capture anything in one or two taps (sections 20 and 50).
 *
 * Tasks and recordings are handled inline -- the whole point is to avoid
 * navigating during class. Notes and uploads jump to their own screens because
 * both genuinely need the full editor or the drop zone.
 */
export function QuickCapture({
  open,
  onClose,
  subjects,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  subjects: { id: string; name: string; color: string }[];
  timezone: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = React.useState<Mode>('task');
  const [creatingNote, setCreatingNote] = React.useState(false);
  const [linkPending, setLinkPending] = React.useState(false);

  async function newNote() {
    setCreatingNote(true);
    const result = await runAction(() => createNote({ noteType: 'class' }));
    setCreatingNote(false);
    if (!result.ok) return toast(result.error, 'error');
    onClose();
    router.push(`/notes/${result.data.id}`);
  }

  async function addLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLinkPending(true);
    const result = await runAction(() => createLinkResource({
      title: String(form.get('title') ?? ''),
      url: String(form.get('url') ?? ''),
      subjectId: String(form.get('subject_id') ?? '') || null,
    }));
    setLinkPending(false);
    if (!result.ok) return toast(result.error, 'error');
    toast('Link saved', 'success');
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick capture" size="md">
      <div role="tablist" aria-label="Capture type" className="flex gap-1 rounded-lg bg-surface-sunken p-1">
        {MODES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              mode === value
                ? 'bg-surface text-content shadow-xs'
                : 'text-content-secondary hover:text-content',
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === 'task' && (
          <QuickAdd
            subjects={subjects}
            timezone={timezone}
            autoFocus
            onCreated={onClose}
          />
        )}

        {mode === 'voice' && <VoiceRecorder subjects={subjects} />}

        {mode === 'link' && (
          <form onSubmit={addLink} className="space-y-3">
            <Field label="Link" required>
              {(a) => (
                <Input
                  {...a}
                  name="url"
                  type="url"
                  placeholder="https://…"
                  required
                  autoFocus
                />
              )}
            </Field>
            <Field label="Title" required>
              {(a) => <Input {...a} name="title" placeholder="What is it?" required />}
            </Field>
            <Field label="Subject">
              {(a) => (
                <Select {...a} name="subject_id">
                  <option value="">No subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={linkPending}>
                Save link
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-line pt-3">
        <button
          onClick={newNote}
          disabled={creatingNote}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs font-medium text-content hover:bg-surface-sunken disabled:opacity-60"
        >
          {creatingNote ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="size-3.5 text-content-tertiary" aria-hidden="true" />
          )}
          New note
        </button>
        <button
          onClick={() => {
            onClose();
            router.push('/resources');
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-xs font-medium text-content hover:bg-surface-sunken"
        >
          <UploadCloud className="size-3.5 text-content-tertiary" aria-hidden="true" />
          Upload a file
        </button>
      </div>
    </Modal>
  );
}
