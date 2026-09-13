'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, FileText, Pin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { createNote } from '@/lib/actions/notes';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { NoteListItem } from '@/lib/data/notes';
import type { NoteType } from '@/lib/supabase/database.types';
import { runAction } from '@/lib/actions/run';

const TYPE_LABEL: Record<NoteType, string> = {
  quick: 'Quick',
  class: 'Class',
  study: 'Study',
  assignment: 'Assignment',
};

export function NewNoteButton({
  subjectId,
  noteType = 'quick',
  label = 'New note',
  variant = 'primary',
}: {
  subjectId?: string;
  noteType?: NoteType;
  label?: string;
  variant?: 'primary' | 'outline';
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function create() {
    setPending(true);
    const result = await runAction(() => createNote({ subjectId: subjectId ?? null, noteType }));
    setPending(false);
    if (!result.ok) return toast(result.error, 'error');
    // Straight into the editor: a new note with nothing in it is not a
    // destination, it is a detour.
    router.push(`/notes/${result.data.id}`);
  }

  return (
    <Button onClick={create} loading={pending} variant={variant}>
      <Plus className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function NotesList({ notes }: { notes: NoteListItem[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No notes yet"
        description="Write during class or afterwards. Notes save themselves as you type."
        action={<NewNoteButton label="Write your first note" />}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {notes.map((note) => (
        <Card key={note.id} interactive>
          <Link href={`/notes/${note.id}`} className="block px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {note.is_pinned && (
                    <Pin className="size-3 shrink-0 text-primary" aria-label="Pinned" />
                  )}
                  {note.is_favorite && (
                    <Star className="size-3 shrink-0 text-warning" aria-label="Favourite" />
                  )}
                  <h3
                    className={cn(
                      'truncate text-sm font-medium',
                      note.title ? 'text-content' : 'text-content-tertiary italic',
                    )}
                  >
                    {note.title || 'Untitled note'}
                  </h3>
                </div>
                {note.content_text?.trim() && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-content-secondary">
                    {note.content_text.trim().slice(0, 180)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-2xs text-content-tertiary">
                  {relativeTime(note.updated_at)}
                </span>
                <span className="rounded-full bg-surface-sunken px-1.5 py-px text-2xs text-content-tertiary">
                  {TYPE_LABEL[note.note_type]}
                </span>
              </div>
            </div>
            {note.subjects && (
              <p className="mt-2 flex items-center gap-1 text-2xs text-content-tertiary">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: note.subjects.color }}
                />
                {note.subjects.name}
              </p>
            )}
          </Link>
        </Card>
      ))}
    </div>
  );
}
