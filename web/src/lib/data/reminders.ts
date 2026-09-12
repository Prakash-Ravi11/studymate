import { createClient } from '@/lib/supabase/server';
import { getProfile } from './profile';

/**
 * In-app reminder delivery.
 *
 * The other channels (push, email) need a worker to push a message outward.
 * In-app delivery does not: a reminder is "delivered" the moment the student
 * can see it, so the read below *is* the delivery mechanism. Modelling it as a
 * send would mean a reminder silently failing whenever no worker happened to be
 * deployed -- which is exactly the failure mode this app must not have.
 *
 * A reminder is therefore due when its instant has passed and nobody has
 * dismissed or cancelled it. `scheduled` is the resting state; the student
 * moves it to `dismissed`.
 */

export type DueReminder = {
  id: string;
  label: string | null;
  fireAt: string;
  /** True when the reminder is anchored to a deadline rather than a fixed time. */
  isDeadline: boolean;
  task: {
    id: string;
    title: string;
    dueAt: string | null;
    dueHasTime: boolean;
    subjectId: string | null;
    subjectName: string | null;
    subjectColor: string | null;
  } | null;
};

type ReminderRow = {
  id: string;
  label: string | null;
  fire_at: string;
  offset_minutes: number | null;
  tasks: {
    id: string;
    title: string;
    due_at: string | null;
    due_has_time: boolean;
    status: string;
    subject_id: string | null;
    subjects: { name: string; color: string } | null;
  } | null;
};

/**
 * Reminders the student should be seeing right now, newest first.
 *
 * Only `in_app` rows are returned. A reminder addressed to push or email is
 * that worker's to deliver; surfacing it here as well would double-notify.
 */
export async function listDueReminders(limit = 25): Promise<DueReminder[]> {
  const profile = await getProfile();
  if (!profile) return [];

  // Both switches off means the student asked not to be interrupted. Skip the
  // query rather than fetching rows we would only throw away.
  if (!profile.notify_task_reminders && !profile.notify_deadline_reminders) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reminders')
    .select(
      'id,label,fire_at,offset_minutes,' +
        'tasks(id,title,due_at,due_has_time,status,subject_id,subjects(name,color))',
    )
    .eq('channel', 'in_app')
    .eq('status', 'scheduled')
    .lte('fire_at', new Date().toISOString())
    .order('fire_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to load due reminders:', error.message);
    return [];
  }

  return (data as unknown as ReminderRow[])
    .filter((row) => {
      // A task that is already finished or abandoned has nothing to remind
      // about. completeTask cancels its reminders, but a status changed by any
      // other path (or a row predating that code) must not resurface here.
      if (row.tasks && row.tasks.status !== 'todo' && row.tasks.status !== 'in_progress') {
        return false;
      }
      // offset_minutes is what distinguishes the two notification switches in
      // Settings: a relative reminder tracks a deadline, an absolute one is a
      // reminder the student set on a task themselves.
      return row.offset_minutes !== null
        ? profile.notify_deadline_reminders
        : profile.notify_task_reminders;
    })
    .map((row) => ({
      id: row.id,
      label: row.label,
      fireAt: row.fire_at,
      isDeadline: row.offset_minutes !== null,
      task: row.tasks
        ? {
            id: row.tasks.id,
            title: row.tasks.title,
            dueAt: row.tasks.due_at,
            dueHasTime: row.tasks.due_has_time,
            subjectId: row.tasks.subject_id,
            subjectName: row.tasks.subjects?.name ?? null,
            subjectColor: row.tasks.subjects?.color ?? null,
          }
        : null,
    }));
}
