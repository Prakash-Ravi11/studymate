-- StudyMate RLS penetration test.
--
-- Run against any StudyMate database after applying migrations 0001-0010:
--   psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
-- Every row of the output must read PASS. A single FAIL means one student can
-- reach another student's data and the build must not ship.
--
-- The test creates two real auth users, writes data as A, then performs every
-- cross-user attack we can express in SQL as B: direct-id reads, filtered reads,
-- updates, deletes, forging a row owned by A, rewriting user_id to steal a row,
-- and reaching A's content through the global-search RPC. It cleans up after
-- itself by deleting both users (all data cascades).

create temp table _rls_results(step int, check_name text, observed text, expected text, pass boolean);
grant all on _rls_results to authenticated;

do $$
declare
  a uuid := '11111111-1111-1111-1111-111111111111';
  b uuid := '22222222-2222-2222-2222-222222222222';
  subj_a uuid; n int; affected int; forged text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-a@test.invalid','x',now(),now()),
         (b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-b@test.invalid','x',now(),now())
  on conflict (id) do nothing;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);

  insert into public.subjects (user_id,name,code) values (a,'Engineering Mathematics','MA8251') returning id into subj_a;
  insert into public.tasks (user_id,subject_id,title,status) values (a,subj_a,'Finish Unit 3 questions','planned');
  insert into public.notes (user_id,subject_id,title,content) values (a,subj_a,'Unit 3 lecture','<p>Laplace transforms</p>');

  -- ===================== switch to attacker =====================
  perform set_config('request.jwt.claims', json_build_object('sub',b,'role','authenticated')::text, true);

  select count(*) into n from public.subjects where id=subj_a;
  insert into _rls_results values (1,'B reads A subject by direct id', n||' rows','0 rows', n=0);

  select count(*) into n from public.tasks where user_id=a;
  insert into _rls_results values (2,'B reads A tasks by user_id filter', n||' rows','0 rows', n=0);

  select count(*) into n from public.profiles where id=a;
  insert into _rls_results values (3,'B reads A profile', n||' rows','0 rows', n=0);

  select count(*) into n from public.notes where subject_id=subj_a;
  insert into _rls_results values (4,'B reads A notes by subject_id', n||' rows','0 rows', n=0);

  update public.subjects set name='HACKED' where id=subj_a;
  get diagnostics affected = row_count;
  insert into _rls_results values (5,'B updates A subject', affected||' rows','0 rows', affected=0);

  delete from public.tasks where user_id=a;
  get diagnostics affected = row_count;
  insert into _rls_results values (6,'B deletes A tasks', affected||' rows','0 rows', affected=0);

  begin
    insert into public.subjects (user_id,name) values (a,'Forged by B');
    forged := 'INSERT SUCCEEDED';
  exception when insufficient_privilege then forged := 'blocked by WITH CHECK';
  end;
  insert into _rls_results values (7,'B forges row owned by A', forged,'blocked by WITH CHECK', forged<>'INSERT SUCCEEDED');

  begin
    update public.subjects set user_id=b where id=subj_a;
    get diagnostics affected = row_count;
    forged := affected||' rows';
  exception when insufficient_privilege then forged := 'blocked';
  end;
  insert into _rls_results values (8,'B steals A subject via user_id rewrite', forged,'0 rows / blocked', forged in ('0 rows','blocked'));

  select count(*) into n from public.search_all('Engineering Mathematics');
  insert into _rls_results values (9,'B global-search finds A content', n||' rows','0 rows', n=0);

  select count(*) into n from public.search_all('Laplace');
  insert into _rls_results values (10,'B searches A note body text', n||' rows','0 rows', n=0);

  -- ===================== back to the owner =====================
  perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);

  select count(*) into n from public.subjects where id=subj_a and name='Engineering Mathematics';
  insert into _rls_results values (11,'A still sees own intact subject', n||' rows','1 row', n=1);

  select count(*) into n from public.tasks where user_id=a;
  insert into _rls_results values (12,'A task survived B deletion attempt', n||' rows','1 row', n=1);

  select count(*) into n from public.search_all('Laplace');
  insert into _rls_results values (13,'A global-search finds own note', n||' rows','>=1 row', n>=1);

  select count(*) into n from public.profiles where id=a;
  insert into _rls_results values (14,'A profile auto-created on signup', n||' rows','1 row', n=1);

  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims', null, true);
  delete from auth.users where id in (a,b);
end $$;

select step, check_name, observed, expected,
       case when pass then 'PASS' else '*** FAIL ***' end as result
from _rls_results order by step;

-- Fail loudly so CI can gate on the exit status.
do $$
declare failures int;
begin
  select count(*) into failures from _rls_results where not pass;
  if failures > 0 then
    raise exception 'RLS TEST FAILED: % check(s) did not pass', failures;
  end if;
end $$;
