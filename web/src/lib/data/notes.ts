import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Note } from '@/lib/supabase/database.types';

export type NoteListItem = Pick<
  Note,
  'id' | 'title' | 'note_type' | 'subject_id' | 'updated_at' | 'is_pinned' | 'is_favorite' | 'content_text'
> & { subjects: { name: string; color: string } | null };

export async function listNotes(options: { subjectId?: string; archived?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from('notes')
    .select(
      'id,title,note_type,subject_id,updated_at,is_pinned,is_favorite,content_text,subjects(name,color)',
    );

  query = options.archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
  if (options.subjectId) query = query.eq('subject_id', options.subjectId);

  // Pinned notes float to the top, then most recently edited.
  const { data, error } = await query
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('listNotes failed:', error.message);
    return [];
  }
  return (data ?? []) as NoteListItem[];
}

/** Cached per request: generateMetadata needs the title, the page needs the body. */
export const getNote = cache(async (id: string): Promise<Note | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('getNote failed:', error.message);
    return null;
  }
  return data;
});
