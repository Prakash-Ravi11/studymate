-- StudyMate 0012: claim/complete plumbing for outbound reminder delivery.
--
-- in_app reminders need none of this: they are delivered by being read, so the
-- app queries them directly. push and email have to be pushed outward by a
-- worker, and a worker introduces two problems this migration solves.
--
--   1. Two worker runs overlapping must not send the same reminder twice.
--   2. A worker that dies mid-send must not strand a reminder forever.
--
-- Both are handled with a LEASE rather than a 'sending' status. A claim stamps
-- claimed_at and the row stays 'scheduled'; the claim query ignores rows whose
-- lease is still warm. If the worker dies, the lease simply expires and the next
-- run picks the reminder up -- no reaper process, no status that means "we think
-- something is happening", nothing to get stuck in.

alter table public.reminders
  add column claimed_at timestamptz,
  add column attempts   integer not null default 0;

comment on column public.reminders.claimed_at is
  'Lease timestamp set by claim_due_reminders. Null means unclaimed.';
comment on column public.reminders.attempts is
  'Delivery attempts made. Bounded by claim_due_reminders so a permanently '
  'undeliverable reminder stops being retried instead of looping forever.';

-- The claim query reads (channel, status, fire_at, claimed_at). The existing
-- partial index on fire_at covers the hot predicate; this one keeps the channel
-- split cheap once a deployment has both in_app and outbound reminders.
create index reminders_outbound_idx
  on public.reminders (channel, fire_at)
  where status = 'scheduled' and channel <> 'in_app';

-- ------------------------------------------------------------------ claiming
--
-- SECURITY INVOKER (the default), deliberately. The worker authenticates with
-- the service role, which bypasses RLS on its own, so there is nothing for a
-- definer context to add -- and a definer function here would be a standing
-- privilege-escalation target reachable through PostgREST. EXECUTE is revoked
-- from anon and authenticated below, so no signed-in browser session can reach
-- it at all.
--
-- FOR UPDATE SKIP LOCKED is what makes concurrent workers safe: each run takes
-- rows no other run holds rather than blocking on them.
create or replace function public.claim_due_reminders(
  p_limit       integer  default 50,
  p_lease       interval default interval '5 minutes',
  p_max_attempts integer default 5
)
returns table (
  id             uuid,
  user_id        uuid,
  task_id        uuid,
  label          text,
  fire_at        timestamptz,
  channel        public.reminder_channel,
  attempts       integer,
  email          text,
  timezone       text,
  task_title     text,
  task_due_at    timestamptz,
  task_due_has_time boolean
)
language plpgsql
volatile
set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.reminders r
       set claimed_at = now(),
           attempts   = r.attempts + 1
     where r.id in (
       -- Every reason not to deliver is evaluated HERE, before the lease is
       -- taken. Filtering after the update would stamp a row the worker then
       -- silently drops, so it would be re-claimed every time its lease
       -- expired, burning an attempt each round until it hit the ceiling --
       -- and complete_reminder, never called for it, would never mark it
       -- failed. Unclaimable is the correct state for these, not claimed.
       select c.id
         from public.reminders c
         left join public.tasks    t on t.id = c.task_id
         left join public.profiles p on p.id = c.user_id
        where c.status = 'scheduled'
          and c.channel <> 'in_app'
          and c.fire_at <= now()
          and c.attempts < p_max_attempts
          -- Unclaimed, or a lease that expired because the worker holding it
          -- never reported back.
          and (c.claimed_at is null or c.claimed_at < now() - p_lease)
          -- A reminder whose task was finished or abandoned between scheduling
          -- and firing has nothing left to say. The open set is inbox/planned/
          -- in_progress -- it must stay in step with OPEN_STATUSES in the web
          -- app, or the two disagree about which reminders are still live.
          and (c.task_id is null or t.status in ('inbox', 'planned', 'in_progress'))
          -- The same two switches the in-app tray honours, so turning
          -- notifications off in Settings silences every channel, not just one.
          and case
                when c.offset_minutes is not null then coalesce(p.notify_deadline_reminders, true)
                else coalesce(p.notify_task_reminders, true)
              end
        order by c.fire_at
        limit p_limit
        -- OF c: lock only the reminder. t and p are on the nullable side of an
        -- outer join and must not be locked, and the worker is not changing
        -- them anyway.
        for update of c skip locked
     )
    returning r.*
  )
  select c.id,
         c.user_id,
         c.task_id,
         c.label,
         c.fire_at,
         c.channel,
         c.attempts,
         u.email::text,
         coalesce(p.timezone, 'UTC'),
         t.title,
         t.due_at,
         t.due_has_time
    from claimed c
    left join auth.users      u on u.id = c.user_id
    left join public.profiles p on p.id = c.user_id
    left join public.tasks    t on t.id = c.task_id;
end;
$$;

comment on function public.claim_due_reminders(integer, interval, integer) is
  'Lease a batch of due outbound reminders for delivery. Service role only.';

-- ---------------------------------------------------------------- completing
--
-- Called once per claimed reminder. Success is terminal. Failure releases the
-- lease so the next run retries, until attempts hits the ceiling -- at which
-- point the reminder is marked failed and stops consuming worker budget. The
-- provider's message is kept in `error` so a stuck reminder can be explained
-- rather than guessed at.
create or replace function public.complete_reminder(
  p_id           uuid,
  p_error        text    default null,
  p_max_attempts integer default 5
)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_error is null then
    update public.reminders
       set status     = 'sent',
           sent_at    = now(),
           error      = null,
           claimed_at = null
     where id = p_id;
  else
    update public.reminders
       set status     = case when attempts >= p_max_attempts then 'failed'::public.reminder_status
                             else 'scheduled'::public.reminder_status end,
           error      = left(p_error, 1000),
           -- Releasing the lease is what makes the row retryable. Holding it
           -- would leave the reminder waiting out a timeout it has no reason
           -- to wait out.
           claimed_at = null
     where id = p_id;
  end if;
end;
$$;

comment on function public.complete_reminder(uuid, text, integer) is
  'Record the outcome of one delivery attempt. Service role only.';

-- ------------------------------------------------------------------ releasing
--
-- Undo a claim the worker cannot act on -- a channel this deployment has no
-- provider for, say. complete_reminder would be wrong here: the attempt is not
-- evidence about the reminder, it is evidence about the deployment, and
-- charging it would walk a perfectly good reminder to 'failed' over a missing
-- API key. This hands back the lease AND the attempt, leaving the row exactly
-- as the claim found it.
create or replace function public.release_reminder_claim(p_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  update public.reminders
     set claimed_at = null,
         attempts   = greatest(attempts - 1, 0)
   where id = p_id
     and status = 'scheduled';
end;
$$;

comment on function public.release_reminder_claim(uuid) is
  'Return a claimed reminder to the queue without charging an attempt. Service role only.';

-- Neither function is part of the browser API surface. PostgREST would
-- otherwise expose both as RPC endpoints to any signed-in user, letting one
-- student mark another's reminders sent.
revoke all on function public.claim_due_reminders(integer, interval, integer)
  from public, anon, authenticated;
revoke all on function public.complete_reminder(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_reminder_claim(uuid)
  from public, anon, authenticated;
