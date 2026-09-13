# Try StudyMate

The app has to run on **your** machine. It cannot be served from the build
sandbox: that environment's egress policy blocks `*.supabase.co`, so the app
there cannot reach its own database. Your normal network can, so it will just
work locally.

Takes about two minutes.

---

## 1. Get the code

```bash
git clone https://github.com/Prakash-Ravi11/studymate.git
cd studymate
git checkout claude/fervent-mendel-w123jn
```

Already have it cloned? `git fetch && git checkout claude/fervent-mendel-w123jn && git pull`

## 2. Install

```bash
cd web
npm install
```

Needs Node 18 or newer (`node --version`).

## 3. Point it at the database

Create `web/.env.local` with exactly this:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xrhttgjwwxlfupofpvns.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lpDDMGwEE-ShPF6yzLS5Qg_yaNxnj7_
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

One line does it:

```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://xrhttgjwwxlfupofpvns.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lpDDMGwEE-ShPF6yzLS5Qg_yaNxnj7_
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EOF
```

The publishable key is meant to be public — it carries no privileges of its own,
and every request it makes is still gated by row-level security.

## 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>.

---

## Logins

Both are pre-confirmed, so no confirmation email is needed.

### The main one — a term already in progress

```
demo@studymate.app
StudyMate2026!
```

Lands straight on a populated dashboard: 5 subjects, 12 tasks spread across
overdue / today / this week / unscheduled, 5 notes, and 2 scheduled reminders.
Timezone is set to Asia/Kolkata — change it in **Settings** if you are elsewhere,
and the due dates will re-read against your day.

### A brand-new account — the first-run experience

```
newuser@studymate.app
StudyMate2026!
```

Completely empty and not yet onboarded, so you get the onboarding flow and every
empty state as a new student would.

> Signing up with your own email may not work: Supabase's built-in mail is
> heavily rate-limited and only delivers to project members. Use the accounts
> above instead.

---

## Worth trying

| | |
|---|---|
| **Dashboard** | Tick something off. The count in the headline changes. |
| **⌘K / Ctrl-K** | Search "Laplace" or "AVL" — it searches note *bodies*, not just titles. |
| **Quick add** | On Tasks, type `Finish DBMS assignment by Monday 6pm !high #lab`. It shows you what it understood *before* saving, and never invents a time you didn't give. |
| **Subjects** | Open one for its own workspace — overview, resources, notes, tasks, voice. |
| **Calendar** | Deadlines laid out; click a day to add to it. |
| **Notes** | Open one and type. Watch the save indicator — it autosaves. |
| **Resources / Voice** | Deliberately empty. Upload a PDF or record something; those are real, they go to Supabase Storage. |
| **Class Mode** | `/class` — the big-buttons, capture-in-two-taps screen for during a lecture. |
| **Dark mode** | Bottom-left of the sidebar. Reload: it persists. |
| **Phone** | Open it on your phone on the same wifi (`npm run dev` prints a network URL) or narrow the window — the mobile layout is its own, not a squeezed desktop. |

---

## Honest caveats

These flows have **never been run against a live database** — the build
environment could not reach Supabase, so you are the first real user. The
database layer is thoroughly tested (36/36 checks against a clean cluster), and
the app builds and type-checks clean, but if something breaks in the UI, that is
entirely plausible. Tell me what you saw and I will fix it.

Specifically not built yet:

- **Web push notifications.** Reminders are stored and the in-app ones surface,
  but browser push needs VAPID keys and a service worker.
- **Email reminders.** The code is there behind `EMAIL_PROVIDER`, but no real
  send has ever been made.
- **Recurring tasks.** The repeat rule is stored; nothing expands it yet.

---

## Resetting

To wipe the demo account back to its seeded state:

```bash
psql "$DATABASE_URL" -f supabase/seed/demo.sql
```

The seed is idempotent — it clears that user's rows before reinserting.

These two accounts and the seed data are **demo fixtures**. Delete them before
this database is used for anything real.
