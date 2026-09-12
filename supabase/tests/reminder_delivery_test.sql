-- StudyMate reminder-delivery test.
--
-- Run against any StudyMate database after applying migrations 0001-0012:
--   psql "$DATABASE_URL" -f supabase/tests/reminder_delivery_test.sql
-- Every row of the output must read PASS.
--
-- Exercises the claim/complete contract the outbound worker depends on: that a
-- due reminder is leased exactly once, that a warm lease blocks a second worker
-- and an expired one does not, that reminders nobody should receive are never
-- claimed at all, and that the two functions are unreachable from the browser.
--
-- The in_app channel is deliberately expected NOT to be claimed: it is
-- delivered by being read, and the worker must leave it alone or a student gets
-- the same reminder twice.

create temp table _rd_results(step int, check_name text, observed text, expected text, pass boolean);

do $$
declare
  u uuid := '33333333-3333-3333-3333-333333333333';
  subj uuid; open_task uuid; done_task uuid;
  r_email uuid; r_inapp uuid; r_future uuid; r_done uuid; r_push uuid;
  n int; st text; claimed timestamptz; sent timestamptz; att int; err text;
  claimed_ids uuid[];
  got_email text; got_tz text; got_title text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  values (u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
          'reminder-worker@test.invalid','x',now(),now())
  on conflict (id) do nothing;

  update public.profiles set timezone = 'Asia/Kolkata' where id = u;

  insert into public.subjects (user_id, name, code) values (u,'Thermodynamics','ME8391')
    returning id into subj;
  insert into public.tasks (user_id, subject_id, title, status, due_at, due_has_time)
    values (u, subj, 'Submit lab record', 'planned', now() + interval '2 hours', true)
    returning id into open_task;
  insert into public.tasks (user_id, subject_id, title, status)
    values (u, subj, 'Already handed in', 'completed')
    returning id into done_task;

  -- Due, outbound, on an open task, anchored to the deadline.
  insert into public.reminders (user_id, task_id, fire_at, offset_minutes, channel)
    values (u, open_task, now() - interval '1 minute', -60, 'email') returning id into r_email;
  -- Due, but in-app: the app reads this one, the worker must not take it.
  insert into public.reminders (user_id, task_id, fire_at, offset_minutes, channel)
    values (u, open_task, now() - interval '1 minute', -60, 'in_app') returning id into r_inapp;
  -- Outbound but not yet due.
  insert into public.reminders (user_id, task_id, fire_at, offset_minutes, channel)
    values (u, open_task, now() + interval '1 hour', -60, 'email') returning id into r_future;
  -- Due and outbound, but the task is already finished.
  insert into public.reminders (user_id, task_id, fire_at, offset_minutes, channel)
    values (u, done_task, now() - interval '1 minute', -60, 'email') returning id into r_done;
  -- Due, outbound, absolute (a task reminder rather than a deadline one).
  insert into public.reminders (user_id, task_id, fire_at, channel)
    values (u, open_task, now() - interval '1 minute', 'push') returning id into r_push;

  -- ===================== claim selects the right rows =====================
  select count(*) into n from public.claim_due_reminders(50, interval '5 minutes', 5)
   where id in (r_email, r_push);
  insert into _rd_results values (1,'Due outbound reminders are claimed', n||' rows','2 rows', n=2);

  select status, claimed_at into st, claimed from public.reminders where id = r_inapp;
  insert into _rd_results values (2,'in_app reminder left for the app',
    coalesce(claimed::text,'unclaimed'),'unclaimed', claimed is null);

  select claimed_at into claimed from public.reminders where id = r_future;
  insert into _rd_results values (3,'Reminder not yet due is not claimed',
    coalesce(claimed::text,'unclaimed'),'unclaimed', claimed is null);

  select claimed_at into claimed from public.reminders where id = r_done;
  insert into _rd_results values (4,'Reminder on a finished task is not claimed',
    coalesce(claimed::text,'unclaimed'),'unclaimed', claimed is null);

  select attempts into att from public.reminders where id = r_email;
  insert into _rd_results values (5,'Claim records the attempt', att::text,'1', att = 1);

  -- ===================== the lease =====================
  select count(*) into n from public.claim_due_reminders(50, interval '5 minutes', 5);
  insert into _rd_results values (6,'A warm lease blocks a second worker', n||' rows','0 rows', n=0);

  -- Simulate a worker that died without reporting back.
  update public.reminders set claimed_at = now() - interval '10 minutes' where id = r_email;
  select count(*) into n from public.claim_due_reminders(50, interval '5 minutes', 5)
   where id = r_email;
  insert into _rd_results values (7,'An expired lease is reclaimed', n||' rows','1 row', n=1);

  -- ===================== the claimed payload =====================
  update public.reminders set claimed_at = null, attempts = 0 where id = r_email;
  select email, timezone, task_title into got_email, got_tz, got_title
    from public.claim_due_reminders(50, interval '5 minutes', 5) where id = r_email;
  insert into _rd_results values (8,'Claim carries the address to deliver to',
    coalesce(got_email,'null'),'reminder-worker@test.invalid',
    got_email = 'reminder-worker@test.invalid');
  insert into _rd_results values (9,'Claim carries the student timezone',
    coalesce(got_tz,'null'),'Asia/Kolkata', got_tz = 'Asia/Kolkata');
  insert into _rd_results values (10,'Claim carries the task title',
    coalesce(got_title,'null'),'Submit lab record', got_title = 'Submit lab record');

  -- ===================== completing =====================
  perform public.complete_reminder(r_email, null, 5);
  select status, sent_at, claimed_at, error into st, sent, claimed, err
    from public.reminders where id = r_email;
  insert into _rd_results values (11,'Success marks the reminder sent', st,'sent', st = 'sent');
  insert into _rd_results values (12,'Success stamps sent_at and frees the lease',
    format('sent_at %s, lease %s', coalesce(sent::text,'null'), coalesce(claimed::text,'free')),
    'sent_at set, lease free', sent is not null and claimed is null);

  -- A failure below the ceiling goes back in the queue with the reason kept.
  perform public.complete_reminder(r_push, 'provider returned 503', 5);
  select status, claimed_at, error into st, claimed, err from public.reminders where id = r_push;
  insert into _rd_results values (13,'Failure below the ceiling is retryable',
    format('%s, lease %s', st, coalesce(claimed::text,'free')),'scheduled, lease free',
    st = 'scheduled' and claimed is null);
  insert into _rd_results values (14,'Failure records the provider reason',
    coalesce(err,'null'),'provider returned 503', err = 'provider returned 503');

  -- At the ceiling it stops being retried.
  update public.reminders set attempts = 5 where id = r_push;
  perform public.complete_reminder(r_push, 'provider returned 503', 5);
  select status into st from public.reminders where id = r_push;
  insert into _rd_results values (15,'Failure at the ceiling stops retrying', st,'failed', st = 'failed');

  update public.reminders set status = 'scheduled', attempts = 5, claimed_at = null where id = r_push;
  select count(*) into n from public.claim_due_reminders(50, interval '5 minutes', 5) where id = r_push;
  insert into _rd_results values (16,'Exhausted reminder is not claimed again', n||' rows','0 rows', n=0);

  -- ===================== notification preferences =====================
  update public.reminders set status='scheduled', attempts=0, claimed_at=null, sent_at=null
    where id in (r_email, r_push);
  update public.profiles set notify_deadline_reminders = false where id = u;

  -- ONE claim, two assertions. claim_due_reminders leases the whole batch, so
  -- calling it twice and filtering each result by id would lease the second
  -- reminder on the first call and then find its lease warm on the second --
  -- a property of the claim, not a bug, but it makes per-id calls meaningless.
  select coalesce(array_agg(id), '{}') into claimed_ids
    from public.claim_due_reminders(50, interval '5 minutes', 5);

  insert into _rd_results values (17,'Deadline switch off silences deadline reminders',
    case when r_email = any(claimed_ids) then 'claimed' else 'not claimed' end,
    'not claimed', not (r_email = any(claimed_ids)));
  insert into _rd_results values (18,'Deadline switch off leaves task reminders alone',
    case when r_push = any(claimed_ids) then 'claimed' else 'not claimed' end,
    'claimed', r_push = any(claimed_ids));

  -- ===================== reachability from the browser =====================
  insert into _rd_results values (19,'anon cannot execute claim_due_reminders',
    has_function_privilege('anon','public.claim_due_reminders(integer,interval,integer)','execute')::text,
    'false',
    not has_function_privilege('anon','public.claim_due_reminders(integer,interval,integer)','execute'));
  insert into _rd_results values (20,'authenticated cannot execute claim_due_reminders',
    has_function_privilege('authenticated','public.claim_due_reminders(integer,interval,integer)','execute')::text,
    'false',
    not has_function_privilege('authenticated','public.claim_due_reminders(integer,interval,integer)','execute'));
  insert into _rd_results values (21,'anon cannot execute complete_reminder',
    has_function_privilege('anon','public.complete_reminder(uuid,text,integer)','execute')::text,
    'false',
    not has_function_privilege('anon','public.complete_reminder(uuid,text,integer)','execute'));
  insert into _rd_results values (22,'authenticated cannot execute complete_reminder',
    has_function_privilege('authenticated','public.complete_reminder(uuid,text,integer)','execute')::text,
    'false',
    not has_function_privilege('authenticated','public.complete_reminder(uuid,text,integer)','execute'));

  delete from auth.users where id = u;
end $$;

select step, check_name, observed, expected,
       case when pass then 'PASS' else '*** FAIL ***' end as result
from _rd_results order by step;

-- Fail loudly so CI can gate on the exit status.
do $$
declare failures int;
begin
  select count(*) into failures from _rd_results where not pass;
  if failures > 0 then
    raise exception 'REMINDER DELIVERY TEST FAILED: % check(s) did not pass', failures;
  end if;
end $$;
