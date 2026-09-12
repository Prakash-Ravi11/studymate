'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/data/guards';
import type { TablesUpdate, TaskPriority, TaskStatus } from '@/lib/supabase/database.types';

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

/** Paths whose cached output depends on task state. */
function revalidateTaskViews(subjectId?: string | null) {
  revalidatePath('/home');
  revalidatePath('/tasks');
  revalidatePath('/calendar');
  if (subjectId) revalidatePath(`/subjects/${subjectId}`);
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  subjectId?: string | null;
  dueAt?: string | null;
  dueHasTime?: boolean;
  priority?: TaskPriority;
  status?: TaskStatus;
  tags?: string[];
  noteId?: string | null;
  voiceNoteId?: string | null;
  /** Minutes relative to due_at; negative means before. */
  reminderOffsetMinutes?: number | null;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const title = input.title.trim();

  if (!title) return { ok: false, error: 'Give the task a title.' };
  if (title.length > 300) return { ok: false, error: 'That title is too long (max 300 characters).' };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: user.id,
      title,
      description: input.description?.trim() || null,
      subject_id: input.subjectId || null,
      due_at: input.dueAt ?? null,
      due_has_time: Boolean(input.dueAt && input.dueHasTime),
      priority: input.priority ?? 'none',
      // A task with a date is planned; one without is still in the inbox.
      status: input.status ?? (input.dueAt ? 'planned' : 'inbox'),
      tags: input.tags ?? [],
      note_id: input.noteId || null,
      voice_note_id: input.voiceNoteId || null,
    })
    .select('id,subject_id')
    .single();

  if (error) {
    console.error('createTask failed:', error.message);
    return { ok: false, error: 'Could not save that task. Please try again.' };
  }

  if (input.reminderOffsetMinutes != null && input.dueAt) {
    const fireAt = new Date(
      new Date(input.dueAt).getTime() + input.reminderOffsetMinutes * 60_000,
    ).toISOString();

    const { error: reminderError } = await supabase.from('reminders').insert({
      user_id: user.id,
      task_id: data.id,
      fire_at: fireAt,
      offset_minutes: input.reminderOffsetMinutes,
    });

    // The task exists; a failed reminder must not discard it. Report the
    // partial outcome instead of claiming total success or total failure.
    if (reminderError) {
      console.error('Reminder creation failed:', reminderError.message);
      revalidateTaskViews(data.subject_id);
      return { ok: false, error: 'Task saved, but the reminder could not be set.' };
    }
  }

  await supabase.from('activity').insert({
    user_id: user.id,
    kind: 'created',
    entity_type: 'task',
    entity_id: data.id,
    subject_id: data.subject_id,
    entity_title: title,
  });

  revalidateTaskViews(data.subject_id);
  return { ok: true, data: { id: data.id } };
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  // completed_at / cancelled_at are maintained by a database trigger, so they
  // are never set here and cannot drift from status.
  const { data, error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select('id,title,subject_id')
    .single();

  if (error) {
    console.error('setTaskStatus failed:', error.message);
    return { ok: false, error: 'Could not update that task.' };
  }

  if (status === 'completed') {
    await supabase.from('activity').insert({
      user_id: user.id,
      kind: 'completed',
      entity_type: 'task',
      entity_id: data.id,
      subject_id: data.subject_id,
      entity_title: data.title,
    });
    // Finishing a task makes its pending reminders pointless.
    await supabase
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('task_id', taskId)
      .eq('status', 'scheduled');
  }

  revalidateTaskViews(data.subject_id);
  return { ok: true, data: undefined };
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    subjectId?: string | null;
    dueAt?: string | null;
    dueHasTime?: boolean;
    priority?: TaskPriority;
    status?: TaskStatus;
    tags?: string[];
  },
): Promise<ActionResult> {
  await requireUser();
  const supabase = await createClient();

  // Typed against the table so a stray key is a compile error, not a 400.
  const update: TablesUpdate<'tasks'> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: 'Give the task a title.' };
    update.title = t;
  }
  if (patch.description !== undefined) update.description = patch.description?.trim() || null;
  if (patch.subjectId !== undefined) update.subject_id = patch.subjectId || null;
  if (patch.dueAt !== undefined) {
    update.due_at = patch.dueAt;
    // Clearing the date must clear the time flag, or the CHECK constraint
    // tasks_due_time_requires_due rejects the row.
    update.due_has_time = patch.dueAt ? Boolean(patch.dueHasTime) : false;
  } else if (patch.dueHasTime !== undefined) {
    update.due_has_time = patch.dueHasTime;
  }
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.tags !== undefined) update.tags = patch.tags;

  if (Object.keys(update).length === 0) return { ok: true, data: undefined };

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', taskId)
    .select('subject_id')
    .single();

  if (error) {
    console.error('updateTask failed:', error.message);
    return { ok: false, error: 'Could not save those changes.' };
  }

  revalidateTaskViews(data.subject_id);
  return { ok: true, data: undefined };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  // Read first so the activity entry can keep a title after the row is gone.
  const { data: existing } = await supabase
    .from('tasks')
    .select('title,subject_id')
    .eq('id', taskId)
    .single();

  const { error } = await supabase.from('tasks').delete().eq('id', taskId);

  if (error) {
    console.error('deleteTask failed:', error.message);
    return { ok: false, error: 'Could not delete that task.' };
  }

  if (existing) {
    await supabase.from('activity').insert({
      user_id: user.id,
      kind: 'deleted',
      entity_type: 'task',
      entity_id: null,
      subject_id: existing.subject_id,
      entity_title: existing.title,
    });
  }

  revalidateTaskViews(existing?.subject_id);
  return { ok: true, data: undefined };
}
