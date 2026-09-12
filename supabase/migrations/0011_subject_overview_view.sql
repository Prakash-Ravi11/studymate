-- StudyMate 0011: per-subject counts in one query.
--
-- Subject cards show task/note/resource/recording counts. Fetching those per
-- card is a textbook N+1 (one list query, then 4 counts per subject). This view
-- computes them all in a single scan.
--
-- security_invoker = true is essential: without it the view would execute as its
-- owner and silently bypass the RLS policies on every underlying table, exposing
-- every student's counts to every other student. With it, the policies from 0007
-- apply exactly as they do on a direct table query.
create or replace view public.subject_overview
with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.name,
  s.code,
  s.description,
  s.color,
  s.icon,
  s.instructor,
  s.semester,
  s.archived_at,
  s.created_at,
  s.updated_at,
  coalesce(t.open_tasks, 0)      as open_tasks,
  coalesce(t.overdue_tasks, 0)   as overdue_tasks,
  coalesce(t.done_tasks, 0)      as done_tasks,
  coalesce(t.total_tasks, 0)     as total_tasks,
  coalesce(n.note_count, 0)      as note_count,
  coalesce(r.resource_count, 0)  as resource_count,
  coalesce(v.voice_count, 0)     as voice_count,
  greatest(
    s.updated_at,
    coalesce(t.last_touched, s.updated_at),
    coalesce(n.last_touched, s.updated_at),
    coalesce(r.last_touched, s.updated_at)
  ) as last_activity_at
from public.subjects s
left join (
  select subject_id,
         count(*) filter (where status in ('inbox','planned','in_progress')) as open_tasks,
         count(*) filter (where status in ('inbox','planned','in_progress')
                            and due_at is not null and due_at < now())       as overdue_tasks,
         count(*) filter (where status = 'completed')                        as done_tasks,
         count(*) filter (where status <> 'cancelled')                       as total_tasks,
         max(updated_at) as last_touched
  from public.tasks group by subject_id
) t on t.subject_id = s.id
left join (
  select subject_id, count(*) as note_count, max(updated_at) as last_touched
  from public.notes where archived_at is null group by subject_id
) n on n.subject_id = s.id
left join (
  select subject_id, count(*) as resource_count, max(updated_at) as last_touched
  from public.resources group by subject_id
) r on r.subject_id = s.id
left join (
  select subject_id, count(*) as voice_count
  from public.voice_notes group by subject_id
) v on v.subject_id = s.id;

comment on view public.subject_overview is
  'Subjects with per-subject counts. security_invoker so RLS still applies.';

revoke all on public.subject_overview from anon;
grant select on public.subject_overview to authenticated;
