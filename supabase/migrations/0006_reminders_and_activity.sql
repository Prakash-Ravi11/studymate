-- StudyMate 0006: reminders + activity stream

-- ---------------------------------------------------------------- reminders
-- Section 41: reminders must not be welded to one delivery mechanism. A reminder
-- is a scheduled intent; `channel` says how it should surface, and a delivery
-- worker (web push, email, in-app) claims rows by channel and fire_at.
--
-- Both the RULE and the materialised instant are stored:
--   offset_minutes -> "one day before the deadline" (survives due-date changes)
--   fire_at        -> the concrete UTC instant a scheduler can index on
-- A trigger recomputes fire_at whenever the parent task's due_at moves, so a
-- rescheduled assignment never keeps a stale reminder.
create table public.reminders (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,

  label   text check (label is null or length(label) <= 300),

  -- Absolute UTC instant. Always stored in UTC; rendered in profiles.timezone.
  fire_at timestamptz not null,
  -- Non-null when the reminder is defined relative to the task due date.
  -- Negative = before the deadline (e.g. -1440 for "one day before").
  offset_minutes integer,

  channel public.reminder_channel not null default 'in_app',
  status  public.reminder_status  not null default 'scheduled',

  repeat_rule text check (repeat_rule is null or length(repeat_rule) <= 500),

  sent_at    timestamptz,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reminders_offset_requires_task
    check (offset_minutes is null or task_id is not null),
  constraint reminders_standalone_needs_label
    check (task_id is not null or label is not null)
);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();

-- The scheduler's claim query: due, still scheduled, oldest first.
create index reminders_due_idx on public.reminders (fire_at)
  where status = 'scheduled';
create index reminders_user_idx on public.reminders (user_id, fire_at desc);
create index reminders_task_idx on public.reminders (task_id)
  where task_id is not null;

-- Keep relative reminders anchored to their task's due date.
create or replace function public.resync_task_reminders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_at is distinct from old.due_at then
    if new.due_at is null then
      -- The deadline was removed: a "1 day before" reminder no longer means
      -- anything, so cancel rather than firing at a stale instant.
      update public.reminders
         set status = 'cancelled'
       where task_id = new.id
         and offset_minutes is not null
         and status = 'scheduled';
    else
      update public.reminders
         set fire_at = new.due_at + make_interval(mins => offset_minutes)
       where task_id = new.id
         and offset_minutes is not null
         and status = 'scheduled';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_resync_reminders
  after update of due_at on public.tasks
  for each row execute function public.resync_task_reminders();

-- ---------------------------------------------------------------- activity
-- entity_title is denormalised on purpose: the feed must still read correctly
-- after the underlying row is deleted ("Deleted Physics Unit 3.pdf").
create table public.activity (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    public.activity_kind not null,
  entity_type text not null check (entity_type in
    ('subject', 'resource', 'note', 'task', 'voice_note')),
  entity_id    uuid,
  subject_id   uuid references public.subjects(id) on delete set null,
  entity_title text not null check (length(entity_title) <= 300),
  created_at   timestamptz not null default now()
);

create index activity_user_idx on public.activity (user_id, created_at desc);
create index activity_subject_idx on public.activity (subject_id, created_at desc)
  where subject_id is not null;
