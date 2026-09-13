-- StudyMate 0002: profiles + subjects

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  avatar_url   text,
  institution  text,
  course       text,
  year         smallint check (year is null or year between 1 and 10),
  semester     smallint check (semester is null or semester between 1 and 20),
  -- IANA zone name. Reminders are scheduled in UTC but rendered and parsed in
  -- this zone, so "remind me tomorrow morning" means the student's morning.
  timezone     text not null default 'UTC',
  -- Notification preferences live here rather than in a separate table: they are
  -- a small fixed set read on every dashboard load.
  notify_task_reminders     boolean not null default true,
  notify_deadline_reminders boolean not null default true,
  notify_daily_summary      boolean not null default false,
  daily_summary_at          time not null default '08:00',
  onboarded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Created automatically by handle_new_user().';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile whenever a user signs up. SECURITY DEFINER is
-- required: the auth system inserts into auth.users under a role that has no
-- rights on public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name', '')), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- subjects
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 120),
  code        text check (code is null or length(code) <= 32),
  description text check (description is null or length(description) <= 2000),
  -- Hex colour validated at the database edge so a bad client cannot poison the UI.
  color       text not null default '#6366F1'
                check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon        text check (icon is null or length(icon) <= 64),
  instructor  text check (instructor is null or length(instructor) <= 160),
  semester    smallint check (semester is null or semester between 1 and 20),
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- Primary access path is "all my subjects, newest first".
create index subjects_user_idx on public.subjects (user_id, created_at desc);
-- Partial index for the common "active subjects only" listing.
create index subjects_user_active_idx on public.subjects (user_id)
  where archived_at is null;
-- A student should not end up with two "MA8251" rows by double-submitting.
create unique index subjects_user_code_key on public.subjects (user_id, lower(code))
  where code is not null;
