-- StudyMate 0008: Storage buckets + per-user path policies.
--
-- Path convention (section 6):
--   users/{user_id}/subjects/{subject_id}/resources/{uuid}-{filename}
--   users/{user_id}/voice/{uuid}.webm
--   users/{user_id}/avatar/{uuid}.png
--
-- storage.foldername(name) splits the object key into segments (1-indexed), so
-- segment 2 is the owning user id. Every policy pins segment 1 to 'users' and
-- segment 2 to the caller, which makes each bucket a set of private per-user
-- trees no matter what key a client supplies.
--
-- All three buckets are private. Nothing in StudyMate is socially shared, so
-- reads go through short-lived signed URLs rather than public object URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resources', 'resources', false, 52428800, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/rtf',
    'text/plain', 'text/csv', 'text/markdown',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic'
  ]),
  ('voice-notes', 'voice-notes', false, 26214400, array[
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4',
    'audio/wav', 'audio/x-wav', 'audio/x-m4a', 'audio/aac'
  ]),
  ('avatars', 'avatars', false, 2097152, array[
    'image/png', 'image/jpeg', 'image/webp'
  ])
on conflict (id) do nothing;

-- ------------------------------------------------------------- resources
create policy resources_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy resources_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy resources_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy resources_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'resources'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- ----------------------------------------------------------- voice-notes
create policy voice_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy voice_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy voice_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy voice_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- --------------------------------------------------------------- avatars
create policy avatar_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy avatar_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy avatar_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy avatar_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
