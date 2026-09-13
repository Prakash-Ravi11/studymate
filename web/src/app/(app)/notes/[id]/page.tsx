import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteEditor } from '@/components/notes/note-editor';
import { requireOnboardedUser } from '@/lib/data/guards';
import { getNote } from '@/lib/data/notes';
import { listSubjectOptions } from '@/lib/data/subjects';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const note = await getNote(id);
  return { title: note?.title?.trim() || 'Untitled note' };
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireOnboardedUser();
  const { id } = await params;

  const [note, subjects] = await Promise.all([getNote(id), listSubjectOptions()]);

  // RLS already scopes the read to this user, so a miss means it does not exist
  // OR belongs to someone else -- both are correctly a 404, which also avoids
  // confirming that another user's note id is real.
  if (!note) notFound();

  return <NoteEditor note={note} subjects={subjects} />;
}
