'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/guards';
import type { ActionResult } from './tasks';

const HEX = /^#[0-9A-Fa-f]{6}$/;

function validate(name: string, color: string): string | null {
  if (!name.trim()) return 'Give the subject a name.';
  if (name.trim().length > 120) return 'That name is too long (max 120 characters).';
  if (!HEX.test(color)) return 'Pick a colour from the palette.';
  return null;
}

export async function createSubject(input: {
  name: string;
  code?: string | null;
  instructor?: string | null;
  description?: string | null;
  color: string;
  semester?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const invalid = validate(input.name, input.color);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      code: input.code?.trim() || null,
      instructor: input.instructor?.trim() || null,
      description: input.description?.trim() || null,
      color: input.color,
      semester: input.semester ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // subjects_user_code_key: one subject code per student.
    if (error.code === '23505') {
      return { ok: false, error: 'You already have a subject with that code.' };
    }
    console.error('createSubject failed:', error.message);
    return { ok: false, error: 'Could not create that subject. Please try again.' };
  }

  await supabase.from('activity').insert({
    user_id: user.id,
    kind: 'created',
    entity_type: 'subject',
    entity_id: data.id,
    subject_id: data.id,
    entity_title: input.name.trim(),
  });

  revalidatePath('/subjects');
  revalidatePath('/home');
  return { ok: true, data: { id: data.id } };
}

export async function updateSubject(
  id: string,
  patch: {
    name?: string;
    code?: string | null;
    instructor?: string | null;
    description?: string | null;
    color?: string;
    semester?: number | null;
  },
): Promise<ActionResult> {
  await requireUser();

  if (patch.name !== undefined || patch.color !== undefined) {
    const invalid = validate(patch.name ?? 'x', patch.color ?? '#000000');
    if (patch.name !== undefined && !patch.name.trim()) {
      return { ok: false, error: 'Give the subject a name.' };
    }
    if (patch.color !== undefined && !HEX.test(patch.color)) {
      return { ok: false, error: 'Pick a colour from the palette.' };
    }
    if (patch.name !== undefined && patch.name.trim().length > 120) return { ok: false, error: invalid! };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('subjects')
    .update({
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.code !== undefined && { code: patch.code?.trim() || null }),
      ...(patch.instructor !== undefined && { instructor: patch.instructor?.trim() || null }),
      ...(patch.description !== undefined && { description: patch.description?.trim() || null }),
      ...(patch.color !== undefined && { color: patch.color }),
      ...(patch.semester !== undefined && { semester: patch.semester }),
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'You already have a subject with that code.' };
    console.error('updateSubject failed:', error.message);
    return { ok: false, error: 'Could not save those changes.' };
  }

  revalidatePath('/subjects');
  revalidatePath(`/subjects/${id}`);
  return { ok: true, data: undefined };
}

/**
 * Deleting a subject does NOT delete its contents.
 *
 * Every child FK is ON DELETE SET NULL, so notes, tasks, files and recordings
 * survive and become unfiled. Losing a term's material because a subject was
 * tidied away would be unforgivable; the UI says so before confirming.
 */
export async function deleteSubject(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('subjects')
    .select('name')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('subjects').delete().eq('id', id);

  if (error) {
    console.error('deleteSubject failed:', error.message);
    return { ok: false, error: 'Could not delete that subject.' };
  }

  if (existing) {
    await supabase.from('activity').insert({
      user_id: user.id,
      kind: 'deleted',
      entity_type: 'subject',
      entity_id: null,
      subject_id: null,
      entity_title: existing.name,
    });
  }

  revalidatePath('/subjects');
  revalidatePath('/home');
  return { ok: true, data: undefined };
}

export async function setSubjectArchived(id: string, archived: boolean): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from('subjects')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    console.error('setSubjectArchived failed:', error.message);
    return { ok: false, error: 'Could not update that subject.' };
  }

  revalidatePath('/subjects');
  revalidatePath(`/subjects/${id}`);
  return { ok: true, data: undefined };
}
