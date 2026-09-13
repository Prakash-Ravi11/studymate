import type { Metadata } from 'next';
import { PageContainer } from '@/components/shell/page-header';
import { NotesList, NewNoteButton } from '@/components/notes/notes-client';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listNotes } from '@/lib/data/notes';

export const metadata: Metadata = { title: 'Notes' };

export default async function NotesPage() {
  await requireOnboardedUser();
  const notes = await listNotes();

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-content">Notes</h1>
          <p className="mt-1 text-sm text-content-secondary">
            {notes.length > 0
              ? `${notes.length} note${notes.length === 1 ? '' : 's'}, newest first.`
              : 'Everything you write, in one place.'}
          </p>
        </div>
        <NewNoteButton />
      </div>

      <NotesList notes={notes} />
    </PageContainer>
  );
}
