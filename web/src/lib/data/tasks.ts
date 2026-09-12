import { createClient } from '@/lib/supabase/server';
import { endOfTodayUtc, endOfDayInUtc } from '@/lib/dates';
import { OPEN_STATUSES, type TaskWithSubject } from './dashboard';

export type TaskView = 'today' | 'upcoming' | 'overdue' | 'unscheduled' | 'completed' | 'all';

export const TASK_VIEWS: { value: TaskView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'unscheduled', label: 'Unscheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

const FIELDS =
  'id,title,status,priority,due_at,due_has_time,subject_id,created_at,subjects(name,color)';

export async function listTasks(options: {
  view: TaskView;
  timezone: string;
  subjectId?: string;
}): Promise<TaskWithSubject[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  let query = supabase.from('tasks').select(FIELDS);

  switch (options.view) {
    case 'today':
      query = query
        .in('status', OPEN_STATUSES)
        .not('due_at', 'is', null)
        .lte('due_at', endOfTodayUtc(options.timezone))
        .order('due_at', { ascending: true });
      break;
    case 'upcoming':
      query = query
        .in('status', OPEN_STATUSES)
        .gt('due_at', endOfTodayUtc(options.timezone))
        .lte('due_at', endOfDayInUtc(options.timezone, 30))
        .order('due_at', { ascending: true });
      break;
    case 'overdue':
      query = query
        .in('status', OPEN_STATUSES)
        .not('due_at', 'is', null)
        .lt('due_at', now)
        .order('due_at', { ascending: true });
      break;
    case 'unscheduled':
      query = query
        .in('status', OPEN_STATUSES)
        .is('due_at', null)
        .order('created_at', { ascending: false });
      break;
    case 'completed':
      query = query.eq('status', 'completed').order('completed_at', { ascending: false });
      break;
    case 'all':
      // due_at nulls last so scheduled work leads.
      query = query
        .neq('status', 'cancelled')
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      break;
  }

  if (options.subjectId) query = query.eq('subject_id', options.subjectId);

  const { data, error } = await query.limit(200);

  if (error) {
    console.error(`listTasks(${options.view}) failed:`, error.message);
    return [];
  }
  return (data ?? []) as TaskWithSubject[];
}

/** Counts for the view tabs, so the student sees where the work is. */
export async function taskViewCounts(timezone: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const endToday = endOfTodayUtc(timezone);

  const [today, overdue, unscheduled] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES).not('due_at', 'is', null).lte('due_at', endToday),
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES).not('due_at', 'is', null).lt('due_at', now),
    supabase.from('tasks').select('id', { count: 'exact', head: true })
      .in('status', OPEN_STATUSES).is('due_at', null),
  ]);

  return {
    today: today.count ?? 0,
    overdue: overdue.count ?? 0,
    unscheduled: unscheduled.count ?? 0,
  };
}
