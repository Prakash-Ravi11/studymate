-- StudyMate 0005: voice_notes + tasks

-- ---------------------------------------------------------------- voice_notes
-- The transcript lives in its own column, not inside the audio object, so it is
-- indexable and searchable independently of the binary (section 45).
create table public.voice_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  title      text not null default 'Voice note' check (length(title) between 1 and 300),

  file_path  text not null,
  file_name  text not null,
  file_size  bigint check (file_size is null or file_size >= 0),
  mime_type  text not null,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),

  transcript            text,
  transcription_status  public.transcription_status not null default 'none',
  transcription_error   text,
  transcribed_at        timestamptz,

  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger voice_notes_set_updated_at
  before update on public.voice_notes
  for each row execute function public.set_updated_at();

create unique index voice_notes_file_path_key on public.voice_notes (file_path);
create index voice_notes_user_idx    on public.voice_notes (user_id, created_at desc);
create index voice_notes_subject_idx on public.voice_notes (subject_id, created_at desc)
  where subject_id is not null;
create index voice_notes_tags_idx    on public.voice_notes using gin (tags);

alter table public.voice_notes add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(transcript, '')), 'B') ||
    setweight(to_tsvector('english', public.tags_to_text(tags)), 'C')
  ) stored;

create index voice_notes_search_idx on public.voice_notes using gin (search_tsv);

-- ---------------------------------------------------------------- tasks
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  title       text not null check (length(trim(title)) between 1 and 300),
  description text check (description is null or length(description) <= 5000),

  status   public.task_status   not null default 'inbox',
  priority public.task_priority not null default 'none',

  due_at   timestamptz,
  -- Distinguishes "due Monday" from "due Monday 6:00 PM". Without this the UI
  -- has to invent a time and then display an invented time back to the student.
  due_has_time boolean not null default false,

  completed_at timestamptz,
  cancelled_at timestamptz,

  -- Capture provenance: a task created from a class note or recording keeps the
  -- link back to what it came from.
  note_id       uuid references public.notes(id) on delete set null,
  voice_note_id uuid references public.voice_notes(id) on delete set null,

  -- RFC 5545 RRULE string, e.g. FREQ=WEEKLY;BYDAY=MO. Stored as text so the
  -- recurrence vocabulary can grow without a migration.
  repeat_rule  text check (repeat_rule is null or length(repeat_rule) <= 500),
  repeat_until timestamptz,

  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_due_time_requires_due
    check (not due_has_time or due_at is not null),
  constraint tasks_repeat_requires_due
    check (repeat_rule is null or due_at is not null)
);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Keep terminal timestamps consistent with status in the database rather than
-- trusting every call site to remember. Reopening a task clears completed_at.
create or replace function public.sync_task_status_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.cancelled_at := null;
  elsif new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.completed_at := null;
  else
    new.completed_at := null;
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_status_timestamps
  before insert or update of status on public.tasks
  for each row execute function public.sync_task_status_timestamps();

-- "What is due today / overdue" is the single hottest query in the product.
create index tasks_user_due_idx on public.tasks (user_id, due_at)
  where status in ('inbox', 'planned', 'in_progress');
create index tasks_user_status_idx  on public.tasks (user_id, status, created_at desc);
create index tasks_subject_idx      on public.tasks (subject_id, status)
  where subject_id is not null;
create index tasks_tags_idx         on public.tasks using gin (tags);

alter table public.tasks add column search_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', public.tags_to_text(tags)), 'C')
  ) stored;

create index tasks_search_idx on public.tasks using gin (search_tsv);

-- Tasks may also carry attachments (a photo of the whiteboard, the brief PDF).
create table public.task_attachments (
  task_id     uuid not null references public.tasks(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, resource_id)
);

create index task_attachments_resource_idx on public.task_attachments (resource_id);
create index task_attachments_user_idx     on public.task_attachments (user_id);
