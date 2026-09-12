# StudyMate rebuild — handoff

Working state as of 2026-09-12. Everything here that mattered lived only in the
chat transcript; this file is the durable version so work can resume from a
cleared context.

**Branch:** `claude/fervent-mendel-w123jn` · **PR:** [#1](https://github.com/Prakash-Ravi11/studymate/pull/1) (draft)

---

## 1. What this project became

The original repo was an **Expo React Native app + Java Spring Boot backend**.
The master build prompt described a **web app on Supabase** (command palette,
`Ctrl+K`, drag-and-drop upload, semantic HTML/ARIA, desktop layouts) — a
different product from what existed.

That fork was put to the user, who chose:

1. **Next.js web + Supabase.** Port the visual identity, retire the Expo screens
   and the Spring Boot backend.
2. **Create a new Supabase project** (rather than reuse an existing one).

`frontend/` (Expo) and `backend/` (Spring Boot) are **deliberately still in the
repo**. They are superseded but were not deleted while their replacement is
unverifiable — removal is a follow-up to propose once the web app is confirmed
working end-to-end.

---

## 2. ⚠️ The blocker that shapes everything

**This sandbox cannot reach the Supabase project.**

```
xrhttgjwwxlfupofpvns.supabase.co:443  →  403 CONNECT (egress policy denial)
```

Confirmed via `curl -sS "$HTTPS_PROXY/__agentproxy/status"`. `/root/.ccr/README.md`
states policy denials must be **reported, not routed around**, so no workaround
was attempted.

Consequences:

- The Supabase **MCP tools work** — they use a different allowed path. That is
  how migrations were applied and the RLS tests actually run. Database work is
  genuinely verified.
- The **app cannot reach Supabase**. Sign-in, onboarding, dashboard, search,
  uploads, recording — none of it can be exercised at runtime from here.
- `web/e2e/smoke.mjs` probes reachability first and marks those checks
  **SKIPPED, not passed**. Do not report them as working.

**To unblock:** allowlist `*.supabase.co` for the environment, or run the suite
on a normal network.

---

## 3. Supabase project

| | |
|---|---|
| Project ref | `xrhttgjwwxlfupofpvns` |
| URL | `https://xrhttgjwwxlfupofpvns.supabase.co` |
| Region | `ap-south-1` |
| Org | `xllyryqoopyzqezudcui` ("Zesus coders") |
| Cost | Free tier, $0/month |

Credentials live in `web/.env.local` (gitignored). `web/.env.example` is the
committed template. The publishable key is safe in the browser — it carries no
privileges and every request it makes is still gated by RLS. The service-role
key was never fetched and is not needed unless the reminder-delivery worker is
deployed.

### Test fixture

A confirmed test account exists in the **dev** database, created via SQL with a
pgcrypto bcrypt hash plus a matching `auth.identities` row (GoTrue requires
both for password sign-in):

```
e2e@studymate.test / TestPassword123!
```

Disposable. **Delete it before this database is used for real.**

---

## 4. Database — fully applied and verified

11 migrations in `supabase/migrations/`, applied to the live project.

**Tables:** `profiles`, `subjects`, `resources`, `notes`, `note_attachments`,
`voice_notes`, `tasks`, `task_attachments`, `reminders`, `activity`, plus a
`subject_overview` view.

**Design decisions worth not re-litigating:**

- `user_id` is denormalised onto every content table so RLS predicates are flat,
  index-backed equality checks with no joins or correlated subqueries. Joining
  through `subjects` in a policy would force a per-row lookup and risk recursive
  policy evaluation.
- `auth.uid()` is always wrapped as `(select auth.uid())` so Postgres hoists it
  into an InitPlan — evaluated once per statement, not once per row.
- Tags are `text[]` + GIN, not a join table: they are only ever filtered and
  searched, never joined to attributes of their own.
- Full-text search uses stored generated `tsvector` columns per table, unioned
  by `search_all()`. That RPC is **SECURITY INVOKER on purpose** — RLS scopes
  every branch automatically. Making it DEFINER would expose every student's
  data through one endpoint.
- Reminders store both the rule (`offset_minutes`) and the materialised instant
  (`fire_at`), with a trigger re-anchoring `fire_at` when a task's due date
  moves. Channel is data (`in_app`/`push`/`email`) so delivery mechanisms can be
  added without touching rows.
- Task terminal timestamps (`completed_at`/`cancelled_at`) are maintained by
  trigger, so status can never drift from them.
- `tasks.due_has_time` distinguishes "due Monday" from "due Monday 6pm" — without
  it the UI must invent a time and then display the invention back to the student.
- Storage buckets are **private** with MIME allowlists and size caps. Policies
  pin every object key to `users/{auth.uid()}/...`, making each bucket a set of
  per-user trees regardless of what key a client supplies.

### Security status

- **Supabase security advisors: zero findings.**
  They caught a real one: `handle_new_user()` was a `SECURITY DEFINER` function
  callable by `anon` via `/rest/v1/rpc/handle_new_user`, because PostgREST
  exposes every `public` function and Postgres grants EXECUTE to PUBLIC by
  default. Migration `0010` revokes EXECUTE on all trigger functions.
- **`supabase/tests/rls_test.sql` — 14/14 passing.** Real cross-user attacks:
  direct-id reads, filtered reads, update, delete, forging a row owned by
  another user, rewriting `user_id` to steal a row, and reaching content through
  global search. It raises an exception on any failure so CI can gate on it.

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql
```

---

## 5. Web app — what exists

`web/` — Next.js 16.3.4, React 19.2.8, TypeScript, Tailwind 4. ~9,750 lines.

**Routes:** `/` (landing), `/login`, `/signup`, `/forgot-password`,
`/reset-password`, `/auth/callback`, `/onboarding`, `/home`, `/subjects`,
`/subjects/[id]`, `/tasks`, `/calendar`, `/notes`, `/notes/[id]`, `/resources`,
`/voice`, `/class` (Class Mode), `/settings`.

**Server actions:** `auth`, `onboarding`, `profile`, `subjects`, `tasks`,
`notes`, `resources`, `voice`, `search`.

**Notable implementation points:**

- **Design system** (`src/app/globals.css`): one semantic token layer driving
  both themes. Components never reference a raw hex or Tailwind shade. Dark mode
  is **class-based, not media-query-based**, so an explicit choice persists and
  can override the OS — the mobile app lost its theme on every launch because it
  held the flag in component state only. A blocking pre-paint script stamps the
  theme class to avoid a light flash.
- **Accessibility**: `:focus-visible` styled once globally, `prefers-reduced-motion`
  honoured globally, skip link as first tab stop, `Field` wires label + control +
  error via `aria-describedby`, requiredness via `aria-required` (the visual
  asterisk is `aria-hidden`), modal has focus trap + Escape + scroll lock + focus
  restore, toasts are `aria-live`.
- **Auth**: uses `getUser()`, never `getSession()` — `getSession()` trusts the
  cookie without revalidating, which is not a sound basis for a server-side
  access decision. Supabase's developer-facing error strings are mapped to
  sentences a student can act on. Password reset reports success even for unknown
  addresses so the form cannot enumerate accounts. Both user-controlled redirect
  targets (`next` param, emailed callback) are restricted to same-site paths.
- **Defence in depth**: `requireUser()` runs in page code as well as in the
  proxy, because routing is not an authorisation boundary. RLS backstops both.
- **Natural-language task parsing** (`src/lib/parse-task.ts`, chrono-node):
  returns the matched phrase so the UI can **show its interpretation** rather
  than silently inventing a date, and never fabricates a time when only a day was
  given.
- **Transcription** (`src/lib/transcription.ts`): provider abstraction, OpenAI
  Whisper implemented, swappable. **Opt-in via env.** With nothing configured,
  recording/storage/playback all still work and notes are marked `unsupported`
  rather than implying a transcript is coming.
- **Timezone**: captured from the browser at onboarding into `profiles.timezone`.
  All date boundaries go through `TZDate` (`src/lib/dates.ts`) so "today" and
  "tomorrow morning" mean the student's, not the server's.

---

## 6. Expensive gotchas — do not rediscover these

1. **Next.js 16 renamed `middleware` → `proxy`.** Session refresh and route
   protection live in `web/src/proxy.ts`, exporting `proxy()`. Confirmed in
   `node_modules/next/dist/docs/`. Training-data memory gets this wrong.
   **Read the bundled docs before writing Next code in this repo.**

2. **`database.types.ts` must keep the per-table `Relationships` key.**
   postgrest's `GenericTable` requires it. Dropping it (to condense the generated
   file) made `Database['public']` fail the `GenericSchema` constraint, which
   collapsed the client's `Schema` generic to `never` — **every `.from()` and
   `.rpc()` call was silently untyped while appearing type-safe.** Verify after
   any regeneration by confirming a deliberate type error is still caught.

3. **`array_to_string` is STABLE, not IMMUTABLE**, so it cannot be used in a
   generated column. Migration `0003` adds `public.tags_to_text(text[])`, an
   honestly-IMMUTABLE wrapper (narrowing to `text[]` removes the polymorphic
   output-function uncertainty).

4. **chrono-node**: `assign()` exists on the concrete `ParsingComponents` class,
   not the public `ParsedComponents` interface. Adjust the returned `Date`
   instead of reaching into library internals.

5. **Playwright Chromium** is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
   (not `.../chromium/...`). Never run `playwright install`.

6. Standalone node scripts need `--env-file=.env.local`; they do not inherit
   Next's env loading.

---

## 7. What remains

| # | Item | Notes |
|---|---|---|
| 1 | **Runtime verification** | Blocked by §2. The single highest-value remaining item — everything below is lower confidence until this runs. |
| 2 | **README** | Still describes the old Expo + Spring Boot app. Needs full rewrite: architecture, Supabase setup, migrations, storage, env vars, local dev, deployment, testing, limitations. |
| 3 | **Reminder delivery** | Schema, scheduling and the channel abstraction exist. No worker actually *sends* anything yet — reminders are stored and queryable but nothing fires. Must not be described as working. |
| 4 | **Final UI/UX polish pass** | Prompt §61. Not yet done systematically. |
| 5 | **Retire `frontend/` and `backend/`** | Propose after §1 passes. |
| 6 | **Recurring tasks** | `repeat_rule` (RRULE) is stored; no expansion logic yet. |
| 7 | **Delete test fixture** | `e2e@studymate.test` before production use. |

Honest status against the prompt's Definition of Done: schema, RLS, storage,
auth, subjects, tasks, notes, resources, voice, transcription, calendar, search,
dashboard, quick capture, class mode, settings and dark mode are **built and
type-checked**; they are **not runtime-verified**. Reminder *delivery* is not
built. The README is not done.

---

## 8. Commands

```bash
# Web app
cd web
npm install
npm run dev                 # http://localhost:3000
npm run build               # production build (passes)
npx tsc --noEmit            # typecheck (clean)
npm run lint

# End-to-end (needs a network where Supabase is reachable)
node --env-file=.env.local e2e/smoke.mjs
#   Probes Supabase first; marks auth-dependent checks SKIPPED if unreachable.
#   Screenshots land in web/e2e/screenshots/ (gitignored).

# Database
psql "$DATABASE_URL" -f supabase/tests/rls_test.sql     # must print 14 PASS
npx supabase gen types typescript --project-id xrhttgjwwxlfupofpvns \
  > web/src/lib/supabase/database.types.ts              # then re-check gotcha #2
```

Migrations were applied through the Supabase MCP tools, and the same SQL is
committed in `supabase/migrations/` in order.

---

## 9. Conventions

- Commits: `user.email=noreply@anthropic.com`, `user.name=Claude`, ending with
  the `Co-Authored-By` / `Claude-Session` trailers.
- Never claim a flow works without having run it. The E2E suite's SKIPPED state
  exists precisely so untested paths are not reported as passing.
- Prompt §62 is the governing rule: no fake functionality. If something cannot
  be completed, say so rather than stubbing it to look finished.
