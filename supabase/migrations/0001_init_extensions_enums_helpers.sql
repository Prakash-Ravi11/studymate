-- StudyMate 0001: extensions, enums, shared helpers
-- Design notes:
--   * user_id is denormalised onto every content table so RLS policies are flat,
--     index-backed `user_id = (select auth.uid())` checks with no joins or
--     correlated subqueries. Joining through subjects in a policy would force a
--     per-row lookup and risk recursive policy evaluation.
--   * auth.uid() is always wrapped in `(select ...)` so Postgres hoists it into an
--     InitPlan and evaluates it once per statement instead of once per row.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- enums
create type public.resource_type as enum (
  'pdf', 'document', 'presentation', 'spreadsheet',
  'image', 'link', 'video', 'audio', 'other'
);

create type public.note_type as enum (
  'quick', 'class', 'study', 'assignment'
);

create type public.task_status as enum (
  'inbox', 'planned', 'in_progress', 'completed', 'cancelled'
);

create type public.task_priority as enum (
  'none', 'low', 'medium', 'high', 'urgent'
);

-- Reminders are deliberately decoupled from any single delivery mechanism
-- (section 41): the channel is data, so email/push/web can be added later
-- without touching task or reminder rows.
create type public.reminder_channel as enum (
  'in_app', 'push', 'email'
);

create type public.reminder_status as enum (
  'scheduled', 'sent', 'dismissed', 'failed', 'cancelled'
);

create type public.transcription_status as enum (
  'none', 'pending', 'processing', 'completed', 'failed', 'unsupported'
);

create type public.activity_kind as enum (
  'created', 'updated', 'completed', 'deleted', 'uploaded', 'recorded'
);

-- ---------------------------------------------------------------- helpers
-- search_path is pinned to '' so the function cannot be hijacked by a mutable
-- search_path; every identifier below is therefore fully qualified.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger helper: stamps updated_at on every UPDATE so the app never has to.';
