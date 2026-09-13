-- StudyMate 0010: close the advisor findings from 0001-0009.

-- ------------------------------------------------- SECURITY DEFINER exposure
-- PostgREST exposes every function in the `public` schema as an RPC endpoint,
-- and Postgres grants EXECUTE to PUBLIC by default. That made
-- /rest/v1/rpc/handle_new_user callable by anon -- a SECURITY DEFINER function
-- reachable without signing in. It would fail outside trigger context, but an
-- unauthenticated caller should not be able to reach a definer function at all.
--
-- Trigger functions are invoked by the trigger machinery, which does not consult
-- EXECUTE grants, so revoking here costs nothing operationally.
revoke all on function public.handle_new_user()             from public, anon, authenticated;
revoke all on function public.set_updated_at()              from public, anon, authenticated;
revoke all on function public.sync_task_status_timestamps() from public, anon, authenticated;
revoke all on function public.resync_task_reminders()       from public, anon, authenticated;

-- Pure helper; no reason to expose it as an API endpoint either.
revoke all on function public.tags_to_text(text[]) from public, anon;

-- ------------------------------------------------------- unindexed foreign keys
-- Without these, deleting a note or voice note forces a sequential scan of tasks
-- to enforce ON DELETE SET NULL. Partial, because the columns are almost always
-- null -- only tasks captured from a note or recording carry provenance.
create index tasks_note_idx on public.tasks (note_id)
  where note_id is not null;
create index tasks_voice_note_idx on public.tasks (voice_note_id)
  where voice_note_id is not null;
