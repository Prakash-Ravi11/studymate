'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { sanitizeNoteHtml } from '@/lib/sanitize';
import { SESSION_EXPIRED, type ActionResult } from './result';
import type { NoteType } from '@/lib/supabase/database.types';
import { logActivity } from './activity';

export async function createNote(input: {
  title?: string;
  content?: string;
  noteType?: NoteType;
  subjectId?: string | null;
  tags?: string[];
}): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      title: (input.title ?? '').trim().slice(0, 300),
      content: sanitizeNoteHtml(input.content ?? ''),
      note_type: input.noteType ?? 'quick',
      subject_id: input.subjectId || null,
      tags: input.tags ?? [],
    })
    .select('id,subject_id')
    .single();

  if (error) {
    console.error('createNote failed:', error.message);
    return { ok: false, error: 'Could not create that note.' };
  }

  await logActivity(supabase, {
    user_id: user.id,
    kind: 'created',
    entity_type: 'note',
    entity_id: data.id,
    subject_id: data.subject_id,
    entity_title: input.title?.trim() || 'Untitled note',
  });

  revalidatePath('/notes');
  revalidatePath('/home');
  return { ok: true, data: { id: data.id } };
}

/**
 * Autosave target.
 *
 * Returns the server's updated_at so the editor can show "Saved 12:04" from the
 * real write time rather than from when it optimistically thought it saved.
 */
export async function saveNote(
  id: string,
  patch: {
    title?: string;
    content?: string;
    noteType?: NoteType;
    subjectId?: string | null;
    tags?: string[];
    isPinned?: boolean;
    isFavorite?: boolean;
  },
): Promise<ActionResult<{ updatedAt: string }>> {
  if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notes')
    .update({
      ...(patch.title !== undefined && { title: patch.title.trim().slice(0, 300) }),
      // Always sanitised server-side -- see lib/sanitize.ts.
      ...(patch.content !== undefined && { content: sanitizeNoteHtml(patch.content) }),
      ...(patch.noteType !== undefined && { note_type: patch.noteType }),
      ...(patch.subjectId !== undefined && { subject_id: patch.subjectId || null }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.isPinned !== undefined && { is_pinned: patch.isPinned }),
      ...(patch.isFavorite !== undefined && { is_favorite: patch.isFavorite }),
    })
    .eq('id', id)
    .select('updated_at,subject_id')
    .single();

  if (error) {
    console.error('saveNote failed:', error.message);
    return { ok: false, error: 'Could not save. Your text is still here — check your connection.' };
  }

  revalidatePath('/notes');
  if (data.subject_id) revalidatePath(`/subjects/${data.subject_id}`);
  return { ok: true, data: { updatedAt: data.updated_at } };
}

export async function setNoteArchived(id: string, archived: boolean): Promise<ActionResult> {
  if (!(await getCurrentUser())) return { ok: false, error: SESSION_EXPIRED };
  const supabase = await createClient();
  const { error } = await supabase
    .from('notes')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    console.error('setNoteArchived failed:', error.message);
    return { ok: false, error: 'Could not update that note.' };
  }
  revalidatePath('/notes');
  return { ok: true, data: undefined };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SESSION_EXPIRED };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('notes')
    .select('title,subject_id')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('notes').delete().eq('id', id);

  if (error) {
    console.error('deleteNote failed:', error.message);
    return { ok: false, error: 'Could not delete that note.' };
  }

  if (existing) {
    await logActivity(supabase, {
      user_id: user.id,
      kind: 'deleted',
      entity_type: 'note',
      entity_id: null,
      subject_id: existing.subject_id,
      entity_title: existing.title || 'Untitled note',
    });
  }

  revalidatePath('/notes');
  revalidatePath('/home');
  return { ok: true, data: undefined };
}
