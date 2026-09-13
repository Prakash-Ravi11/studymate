'use server';

import { revalidatePath } from 'next/cache';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { SESSION_EXPIRED, type ActionResult } from './result';
import { withResult } from './with-result';

export async function updateProfile(patch: {
  fullName?: string;
  institution?: string;
  course?: string;
  year?: number | null;
  semester?: number | null;
  timezone?: string;
}): Promise<ActionResult> {
  return withResult('save your profile', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };

    if (patch.semester != null && (patch.semester < 1 || patch.semester > 20)) {
      return { ok: false, error: 'Semester should be between 1 and 20.' };
    }
    if (patch.year != null && (patch.year < 1 || patch.year > 10)) {
      return { ok: false, error: 'Year should be between 1 and 10.' };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        ...(patch.fullName !== undefined && { full_name: patch.fullName.trim() || null }),
        ...(patch.institution !== undefined && { institution: patch.institution.trim() || null }),
        ...(patch.course !== undefined && { course: patch.course.trim() || null }),
        ...(patch.year !== undefined && { year: patch.year }),
        ...(patch.semester !== undefined && { semester: patch.semester }),
        ...(patch.timezone !== undefined && { timezone: patch.timezone }),
      })
      .eq('id', user.id);

    if (error) {
      console.error('updateProfile failed:', error.message);
      return { ok: false, error: 'Could not save your profile.' };
    }

    revalidatePath('/settings');
    revalidatePath('/', 'layout');
    return { ok: true, data: undefined };
  });
}

export async function updateNotificationPrefs(patch: {
  taskReminders?: boolean;
  deadlineReminders?: boolean;
  dailySummary?: boolean;
  dailySummaryAt?: string;
}): Promise<ActionResult> {
  return withResult('save those settings', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };
    const supabase = await createClient();

    const { error } = await supabase
      .from('profiles')
      .update({
        ...(patch.taskReminders !== undefined && { notify_task_reminders: patch.taskReminders }),
        ...(patch.deadlineReminders !== undefined && {
          notify_deadline_reminders: patch.deadlineReminders,
        }),
        ...(patch.dailySummary !== undefined && { notify_daily_summary: patch.dailySummary }),
        ...(patch.dailySummaryAt !== undefined && { daily_summary_at: patch.dailySummaryAt }),
      })
      .eq('id', user.id);

    if (error) {
      console.error('updateNotificationPrefs failed:', error.message);
      return { ok: false, error: 'Could not save your preferences.' };
    }

    revalidatePath('/settings');
    return { ok: true, data: undefined };
  });
}

/**
 * Export everything the account holds, as JSON.
 *
 * Every query is RLS-scoped, so this can only ever return the caller's own
 * data. Files are referenced by path rather than inlined -- a 50 MB PDF base64
 * encoded into a JSON blob helps nobody.
 */
export async function exportMyData(): Promise<ActionResult<{ json: string }>> {
  return withResult('export your data', async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: SESSION_EXPIRED };
    const supabase = await createClient();

    const [profile, subjects, tasks, notes, resources, voice, reminders] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subjects').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('notes').select('*'),
      supabase.from('resources').select('*'),
      supabase.from('voice_notes').select('*'),
      supabase.from('reminders').select('*'),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profile.data ?? null,
      subjects: subjects.data ?? [],
      tasks: tasks.data ?? [],
      notes: notes.data ?? [],
      resources: resources.data ?? [],
      voice_notes: voice.data ?? [],
      reminders: reminders.data ?? [],
      note: 'Files and recordings are referenced by storage path; download them from the app.',
    };

    return { ok: true, data: { json: JSON.stringify(payload, null, 2) } };
  });
}
