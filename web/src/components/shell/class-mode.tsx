'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mic, FileText, CheckSquare, UploadCloud, ArrowLeft, Loader2 } from 'lucide-react';
import { VoiceRecorder } from '@/components/voice/recorder';
import { QuickAdd } from '@/components/tasks/quick-add';
import { createNote } from '@/lib/actions/notes';
import { useToast } from '@/components/ui/toast';
import { Select } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { runAction } from '@/lib/actions/run';

type Panel = null | 'voice' | 'task';

/**
 * Class Mode (section 21).
 *
 * Four big targets and nothing else. The subject is chosen once, at the top,
 * and every capture inherits it -- nobody should be filling in ten fields while
 * a lecturer is still talking. Details get added later, from the normal screens.
 */
export function ClassMode({
  subjects,
  timezone,
}: {
  subjects: { id: string; name: string; color: string }[];
  timezone: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? '');
  const [panel, setPanel] = React.useState<Panel>(null);
  const [creatingNote, setCreatingNote] = React.useState(false);

  async function newNote() {
    setCreatingNote(true);
    const result = await runAction(() => createNote({ noteType: 'class', subjectId: subjectId || null }));
    setCreatingNote(false);
    if (!result.ok) return toast(result.error, 'error');
    router.push(`/notes/${result.data.id}`);
  }

  const actions = [
    { key: 'voice' as const, icon: Mic, label: 'Record', hint: 'Capture the lecture', onClick: () => setPanel('voice') },
    { key: 'note' as const, icon: FileText, label: 'Note', hint: 'Write as you listen', onClick: newNote },
    { key: 'task' as const, icon: CheckSquare, label: 'Task', hint: 'Catch a deadline', onClick: () => setPanel('task') },
    { key: 'upload' as const, icon: UploadCloud, label: 'Upload', hint: 'Slides or a photo', onClick: () => router.push(`/resources${subjectId ? `?subject=${subjectId}` : ''}`) },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/home"
          className="flex items-center gap-1.5 text-xs text-content-secondary hover:text-content"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Leave class mode
        </Link>

        {subjects.length > 0 && (
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label="Subject for everything captured here"
            className="h-8 w-auto text-xs"
          >
            <option value="">No subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <header className="py-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-content">In class</h1>
        <p className="mt-1.5 text-sm text-content-secondary">
          Capture now. Sort it out when you get home.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ key, icon: Icon, label, hint, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            disabled={key === 'note' && creatingNote}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
              panel === key
                ? 'border-primary bg-primary-subtle'
                : 'border-line bg-surface hover:border-line-strong hover:bg-surface-sunken',
              'disabled:opacity-60',
            )}
          >
            {key === 'note' && creatingNote ? (
              <Loader2 className="size-8 animate-spin text-content-tertiary" aria-hidden="true" />
            ) : (
              <Icon className="size-8 text-primary" aria-hidden="true" />
            )}
            <span className="text-base font-semibold text-content">{label}</span>
            <span className="text-2xs text-content-tertiary">{hint}</span>
          </button>
        ))}
      </div>

      {panel === 'voice' && (
        <div className="mt-4">
          <VoiceRecorder subjects={subjects} defaultSubjectId={subjectId || undefined} />
        </div>
      )}

      {panel === 'task' && (
        <div className="mt-4">
          <QuickAdd
            subjects={subjects}
            timezone={timezone}
            defaultSubjectId={subjectId || undefined}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
