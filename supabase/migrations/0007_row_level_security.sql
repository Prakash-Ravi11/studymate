-- StudyMate 0007: Row Level Security.
--
-- Every policy is scoped `to authenticated` so the anon role can read nothing at
-- all, and every predicate is a flat `user_id = (select auth.uid())` that hits
-- the (user_id, ...) index. INSERT policies carry WITH CHECK so a client cannot
-- forge a row owned by somebody else, and UPDATE policies carry both USING and
-- WITH CHECK so ownership cannot be reassigned mid-update.

alter table public.profiles         enable row level security;
alter table public.subjects         enable row level security;
alter table public.resources        enable row level security;
alter table public.notes            enable row level security;
alter table public.note_attachments enable row level security;
alter table public.voice_notes      enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_attachments enable row level security;
alter table public.reminders        enable row level security;
alter table public.activity         enable row level security;

-- ---------------------------------------------------------------- profiles
-- No INSERT policy: profiles are created solely by the handle_new_user trigger.
-- No DELETE policy: account deletion cascades from auth.users.
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------- subjects
create policy subjects_select_own on public.subjects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy subjects_insert_own on public.subjects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy subjects_update_own on public.subjects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy subjects_delete_own on public.subjects
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- resources
create policy resources_select_own on public.resources
  for select to authenticated using ((select auth.uid()) = user_id);
create policy resources_insert_own on public.resources
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy resources_update_own on public.resources
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy resources_delete_own on public.resources
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- notes
create policy notes_select_own on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy notes_insert_own on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notes_delete_own on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------- note_attachments
create policy note_attachments_select_own on public.note_attachments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy note_attachments_insert_own on public.note_attachments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy note_attachments_delete_own on public.note_attachments
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- voice_notes
create policy voice_notes_select_own on public.voice_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy voice_notes_insert_own on public.voice_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy voice_notes_update_own on public.voice_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy voice_notes_delete_own on public.voice_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- tasks
create policy tasks_select_own on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_insert_own on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy tasks_delete_own on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ------------------------------------------------------- task_attachments
create policy task_attachments_select_own on public.task_attachments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy task_attachments_insert_own on public.task_attachments
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_attachments_delete_own on public.task_attachments
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- reminders
create policy reminders_select_own on public.reminders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy reminders_insert_own on public.reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reminders_update_own on public.reminders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy reminders_delete_own on public.reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- activity
-- Append-only from the client's perspective: no UPDATE policy.
create policy activity_select_own on public.activity
  for select to authenticated using ((select auth.uid()) = user_id);
create policy activity_insert_own on public.activity
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy activity_delete_own on public.activity
  for delete to authenticated using ((select auth.uid()) = user_id);
