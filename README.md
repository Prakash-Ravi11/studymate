# StudyMate

A study workspace for students: subjects, tasks with natural-language due dates,
rich-text notes, a file library, voice notes, a calendar, and search across all
of it. Built as a Next.js web app on Supabase.

> **Status:** the web app is built and type-checks, and the database layer is
> applied and tested against the live project. The application's runtime flows
> have **not** been verified end-to-end yet, and web push reminders are not
> implemented. See [Current limitations](#current-limitations) before relying on
> anything here — that section is accurate, not aspirational.

---

## Repository layout

| Path | What it is |
|---|---|
| `web/` | **The product.** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4. |
| `supabase/` | Migrations (`0001`–`0011`) and `tests/rls_test.sql`, a cross-user penetration test. |
| `frontend/` | **Legacy.** The original Expo React Native app. Superseded; kept until the rebuild is runtime-verified. |
| `backend/` | **Legacy.** The original Spring Boot REST API. Superseded; same. |

Do not add features to `frontend/` or `backend/`. They are retained for
reference only and are proposed for removal once `web/` is verified.

---

## Architecture

```
Browser ──► Next.js App Router ──► Supabase (Postgres + Auth + Storage)
            │  server components        │
            │  server actions           └─ Row Level Security is the
            └─ proxy.ts (session)          security boundary
```

**There is no application server of our own.** Next.js server components read
data, server actions write it, and Supabase holds everything. Authorisation is
not implemented in application code — it is implemented as Postgres RLS
policies, so a bug in a page or an action cannot leak another student's data.

A few structural decisions worth knowing before you change anything:

- **Reads live in `web/src/lib/data/*`, writes in `web/src/lib/actions/*`.**
  Business rules belong in actions, not in components.
- **Auth checks use `getUser()`, never `getSession()`.** `getSession()` trusts
  the cookie without revalidating it with the auth server, which is not a sound
  basis for a server-side access decision.
- **Pages call `requireUser()` / `requireOnboardedUser()`** even though the proxy
  already redirects unauthenticated traffic. Routing is not an authorisation
  boundary; RLS backstops both layers.
- **Next.js 16 renamed `middleware` to `proxy`.** Session refresh and route
  protection live in `web/src/proxy.ts` and export `proxy()`. If you are
  reaching for `middleware.ts` from memory, read `node_modules/next/dist/docs/`
  first — this trips up most people (and most models) exactly once.

### Database

Ten tables plus a `subject_overview` view: `profiles`, `subjects`, `resources`,
`notes`, `note_attachments`, `voice_notes`, `tasks`, `task_attachments`,
`reminders`, `activity`.

- `user_id` is **denormalised onto every content table** so RLS predicates stay
  flat, index-backed equality checks — no joins, no correlated subqueries, no
  risk of recursive policy evaluation.
- `auth.uid()` is always written as `(select auth.uid())` so Postgres hoists it
  into an InitPlan: evaluated once per statement instead of once per row.
- Tags are `text[]` with a GIN index rather than a join table — they are only
  ever filtered and searched, never joined to attributes of their own.
- Full-text search uses a stored generated `tsvector` per table, unioned by the
  `search_all()` RPC. That function is **SECURITY INVOKER on purpose**: RLS then
  scopes every branch automatically. Making it DEFINER would turn one endpoint
  into a read of every student's data.
- Tasks record `due_has_time`, distinguishing "due Monday" from "due Monday 6pm",
  so the UI never has to invent a time and then display its own invention back
  to the student.

### Reminders

A reminder stores both the rule and the instant: `offset_minutes` means "a day
before the deadline" and survives the due date moving, while `fire_at` is the
concrete UTC instant a scheduler can index. A trigger re-anchors `fire_at`
whenever the parent task's `due_at` changes, so a rescheduled assignment never
keeps a stale reminder.

Delivery splits by channel, and the split is not cosmetic:

- **`in_app`** is delivered *by being read*. The notification tray queries
  reminders whose instant has passed, so it works with no worker, no cron and no
  extra configuration. Modelling it as a send would mean every reminder silently
  failing on any deployment that had not set up a scheduler.
- **`email`** is pushed outward by a worker — see below.
- **`push`** is **not implemented.** Web Push needs a VAPID key pair, a service
  worker and a table of per-device subscriptions, none of which exist. The
  worker reports the channel as unconfigured and leaves the reminder queued
  rather than marking it sent; the UI does not offer the channel.

#### Running the delivery worker

Only needed for email. Set `SUPABASE_SERVICE_ROLE_KEY` and
`REMINDER_CRON_SECRET`, then point any scheduler at the endpoint:

```bash
curl -X POST https://your-app/api/reminders/deliver \
     -H "Authorization: Bearer $REMINDER_CRON_SECRET"
```

Once a minute is plenty — reminder granularity is a minute. The response is a
run summary: how many were claimed, delivered, failed, and how many were
skipped because the channel is unconfigured.

Claiming is lease-based rather than status-based, which makes overlapping runs
safe (`FOR UPDATE SKIP LOCKED`) and means a worker that dies mid-send strands
nothing — the lease expires and the next run picks the work up. Failures are
retried to a ceiling of five attempts and then marked `failed` with the
provider's reason kept on the row. A channel this deployment cannot deliver at
all is *released* rather than failed, handing back both the lease and the
attempt, so a missing API key never walks a good reminder to `failed`.

With both secrets unset the endpoint returns 503 and does nothing — it will not
claim reminders it cannot deliver.

### Storage

Three **private** buckets with MIME allowlists and size caps:

| Bucket | Limit | Accepts |
|---|---|---|
| `resources` | 50 MB | PDF, Office/OpenDocument, text/CSV/Markdown, images |
| `voice-notes` | 25 MB | webm, ogg, mpeg, mp4, wav, m4a, aac |
| `avatars` | 2 MB | png, jpeg, webp |

Policies pin every object key to `users/{auth.uid()}/...`, which makes each
bucket a set of per-user trees regardless of what key a client supplies. Nothing
in StudyMate is socially shared, so reads go through short-lived signed URLs
rather than public object URLs.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is enough)
- `psql`, only if you want to run the RLS test suite

### 1. Create the database

Apply the migrations in `supabase/migrations/` **in order** to a fresh Supabase
project. Either link the project with the Supabase CLI and run
`supabase db push`, or paste each file into the SQL editor in numeric sequence.
They are ordinary SQL and have no external dependencies.

### 2. Configure the web app

```bash
cd web
cp .env.example .env.local
```

Fill in `.env.local` from **Supabase Dashboard → Project Settings → API**:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | The publishable ("anon") key. Safe in the browser — it carries no privileges of its own and every request it makes is still gated by RLS. |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin; used to build password-reset and email-confirmation links. |
| `SUPABASE_SERVICE_ROLE_KEY` | no | **Bypasses RLS entirely.** Server-only. Needed only for outbound reminder delivery. Never prefix it with `NEXT_PUBLIC_`. |
| `REMINDER_CRON_SECRET` | no | Shared secret for the delivery endpoint. Required alongside the service-role key. |
| `EMAIL_PROVIDER` | no | `resend` to enable email reminders; leave unset to disable. |
| `EMAIL_API_KEY` / `EMAIL_FROM` | no | Required when a provider is set. |
| `TRANSCRIPTION_PROVIDER` | no | `openai` to enable voice transcription; leave unset to disable. |
| `TRANSCRIPTION_API_KEY` | no | Required when a provider is set. |
| `TRANSCRIPTION_MODEL` | no | Defaults to `whisper-1`. |

With no transcription provider configured, recording, storage and playback all
still work — recordings are marked `unsupported` rather than implying a
transcript is on its way.

### 3. Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## Commands

All from `web/` unless noted.

```bash
npm run dev          # dev server
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test:sanitize  # HTML sanitiser unit tests
npm run test:e2e     # end-to-end smoke suite (real Chromium)
```

```bash
# From the repository root — cross-user RLS penetration test. Expect 14 PASS.
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
```

Standalone node scripts need `--env-file=.env.local`; they do not inherit
Next's env loading. That is why `test:e2e` passes the flag explicitly.

---

## Testing

**`supabase/tests/rls_test.sql` — 14/14 passing.** Real cross-user attacks
against the live schema: direct-id reads, filtered reads, update, delete,
forging a row owned by another user, rewriting `user_id` to steal a row, and
reaching another student's content through global search. It raises an
exception on any failure, so CI can gate on it.

**Supabase security advisors report zero findings.** They caught a real problem
during development: `handle_new_user()` was a `SECURITY DEFINER` function
callable by `anon` through `/rest/v1/rpc/handle_new_user`, because PostgREST
exposes every `public` function and Postgres grants `EXECUTE` to `PUBLIC` by
default. Migration `0010` revokes it on all trigger functions.

**`supabase/tests/reminder_delivery_test.sql` — 22/22 passing.** Covers the
claim/complete contract the worker depends on: that a due reminder is leased
exactly once, that a warm lease blocks a second worker and an expired one does
not, that `in_app` rows are left for the app, that reminders on finished tasks
and reminders a student switched off in Settings are never claimed, that the
attempt ceiling holds, and that neither function is reachable from `anon` or
`authenticated`.

```bash
psql "$DATABASE_URL" -f supabase/tests/reminder_delivery_test.sql
```

**`web/e2e/smoke.mjs`** drives a real Chromium against a running dev server.
It probes Supabase reachability first and marks the authenticated half of the
suite **SKIPPED** when the host is unreachable — *skipped is not passed*. A
sandboxed CI runner or a locked-down corporate network will commonly block
`*.supabase.co`; in that case the suite says so rather than emitting a wall of
misleading failures.

If Chromium is already provisioned (as in this project's dev container, at
`/opt/pw-browsers/`), do **not** run `playwright install`.

---

## Current limitations

Stated plainly, because a README that overstates a build is worse than no README.

1. **The application is not runtime-verified.** Everything below type-checks and
   builds, but sign-in, onboarding, dashboard, uploads and recording have not
   been exercised against a live Supabase instance from the development
   environment, because its egress policy blocks `*.supabase.co`. The database
   layer *is* verified — migrations, the RLS suite and the reminder-delivery
   suite all ran against the real project through a different path. Email
   delivery in particular has never made a real call to a provider.
2. **Web push reminders are not implemented.** In-app delivery works with no
   configuration, and email delivery works once a provider is configured. The
   `push` channel is stored and understood but nothing sends it, and the worker
   says so rather than marking such reminders sent.
3. **Recurring tasks do not expand.** `repeat_rule` (RRULE) is stored and
   round-trips, but nothing generates the occurrences.
4. **`frontend/` and `backend/` are dead weight.** They are the previous Expo and
   Spring Boot implementation, retained only until item 1 is satisfied.

---

## License

The original README advertised MIT, but **no `LICENSE` file has ever been
committed**, so the project is currently unlicensed in the legal sense. Add one
before publishing or accepting contributions.
