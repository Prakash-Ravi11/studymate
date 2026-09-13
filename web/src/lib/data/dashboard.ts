import { createClient } from '@/lib/supabase/server';
import { endOfTodayUtc, endOfDayInUtc } from '@/lib/dates';
import type { TaskStatus } from '@/lib/supabase/database.types';

/** Statuses that still need the student's attention. */
export const OPEN_STATUSES: TaskStatus[] = ['inbox', 'planned', 'in_progress'];

/** A task joined to the bit of its subject the UI renders. */
export type TaskWithSubject = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  due_at: string | null;
  due_has_time: boolean;
  subject_id: string | null;
  subjects: { name: string; color: string } | null;
};

const TASK_FIELDS = 'id,title,status,priority,due_at,due_has_time,subject_id,subjects(name,color)';

export type Dashboard = {
  overdue: TaskWithSubject[];
  today: TaskWithSubject[];
  upcoming: TaskWithSubject[];
  inbox: TaskWithSubject[];
  counts: { subjects: number; openTasks: number; completedThisWeek: number };
  recent: {
    notes: { id: string; title: string; updated_at: string; content_text: string | null }[];
    resources: { id: string; title: string; resource_type: string; created_at: string }[];
    voice: { id: string; title: string; duration_ms: number | null; created_at: string }[];
  };
};

/**
 * Everything the dashboard renders, in one pass.
 *
 * Each bucket is its own query because they need different ranges, but they are
 * issued together rather than awaited in sequence -- eight round trips one
 * after another is what makes a dashboard feel slow.
 */
export async function getDashboard(userId: string, timezone: string): Promise<Dashboard> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const endToday = endOfTodayUtc(timezone);
  const endWeek = endOfDayInUtc(timezone, 7);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [overdue, today, upcoming, inbox, subjectCount, openCount, doneCount, notes, resources, voice] =
    await Promise.all([
      supabase.from('tasks').select(TASK_FIELDS)
        .in('status', OPEN_STATUSES).not('due_at', 'is', null).lt('due_at', now)
        .order('due_at', { ascending: true }).limit(20),

      supabase.from('tasks').select(TASK_FIELDS)
        .in('status', OPEN_STATUSES).gte('due_at', now).lte('due_at', endToday)
        .order('due_at', { ascending: true }).limit(20),

      supabase.from('tasks').select(TASK_FIELDS)
        .in('status', OPEN_STATUSES).gt('due_at', endToday).lte('due_at', endWeek)
        .order('due_at', { ascending: true }).limit(10),

      // Captured but not yet scheduled -- the "sort this out" pile.
      supabase.from('tasks').select(TASK_FIELDS)
        .eq('status', 'inbox').is('due_at', null)
        .order('created_at', { ascending: false }).limit(5),

      supabase.from('subjects').select('id', { count: 'exact', head: true }).is('archived_at', null),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', OPEN_STATUSES),
      supabase.from('tasks').select('id', { count: 'exact', head: true })
        .eq('status', 'completed').gte('completed_at', weekAgo),

      supabase.from('notes').select('id,title,updated_at,content_text')
        .is('archived_at', null).order('updated_at', { ascending: false }).limit(4),
      supabase.from('resources').select('id,title,resource_type,created_at')
        .order('created_at', { ascending: false }).limit(4),
      supabase.from('voice_notes').select('id,title,duration_ms,created_at')
        .order('created_at', { ascending: false }).limit(4),
    ]);

  // A failed bucket should degrade that section, not blank the dashboard.
  for (const [name, res] of Object.entries({ overdue, today, upcoming, inbox, notes, resources, voice })) {
    if (res.error) console.error(`Dashboard query "${name}" failed:`, res.error.message);
  }

  return {
    overdue: (overdue.data ?? []) as TaskWithSubject[],
    today: (today.data ?? []) as TaskWithSubject[],
    upcoming: (upcoming.data ?? []) as TaskWithSubject[],
    inbox: (inbox.data ?? []) as TaskWithSubject[],
    counts: {
      subjects: subjectCount.count ?? 0,
      openTasks: openCount.count ?? 0,
      completedThisWeek: doneCount.count ?? 0,
    },
    recent: {
      notes: notes.data ?? [],
      resources: resources.data ?? [],
      voice: voice.data ?? [],
    },
  };
}
