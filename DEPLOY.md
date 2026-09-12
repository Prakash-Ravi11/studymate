# Deploying StudyMate to Vercel

About three minutes. You have to click through it yourself — this repository's
build environment has no Vercel credentials and its egress policy blocks
`api.vercel.com`, so the deploy cannot be driven from here.

---

## 1. Import the repository

Go to **<https://vercel.com/new>** and import `Prakash-Ravi11/studymate`.

Then change two things from the defaults:

| Setting | Value | Why |
|---|---|---|
| **Root Directory** | `web` | The Next.js app is not at the repo root. Miss this and the build fails with "No Next.js version detected". |
| **Branch** | `claude/fervent-mendel-w123jn` | The rebuild is not merged to `main` yet. |

Framework preset, build command and output directory are detected correctly once
the root directory is right — leave them alone.

## 2. Environment variables

Add these two in the import screen (**Environment Variables**):

```
NEXT_PUBLIC_SUPABASE_URL=https://xrhttgjwwxlfupofpvns.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lpDDMGwEE-ShPF6yzLS5Qg_yaNxnj7_
```

That is all that is required.

**`NEXT_PUBLIC_SITE_URL` is deliberately not needed.** The app reads Vercel's own
`VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` when it is unset, so production
and preview deployments each link back to themselves. Set it only when you put a
custom domain in front.

Optional, and not needed to try the app:

| Variable | Effect if unset |
|---|---|
| `TRANSCRIPTION_PROVIDER`, `TRANSCRIPTION_API_KEY` | Recording, storage and playback still work; recordings are marked `unsupported` rather than pretending a transcript is coming. |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | Email reminders are not sent. In-app reminders still work — they need no worker at all. |
| `REMINDER_WORKER_SECRET` | `POST /api/reminders/deliver` returns 503 and claims nothing. |

## 3. Deploy

Hit **Deploy**. You will get a URL like `studymate-xxxx.vercel.app`.

Sign in with the accounts from [TRY_IT.md](./TRY_IT.md):

```
demo@studymate.app / StudyMate2026!      populated dashboard
newuser@studymate.app / StudyMate2026!   empty, shows onboarding
```

Both are pre-confirmed, so **nothing about signing in depends on step 4.**

## 4. Afterwards — tell Supabase about the new URL

Only matters for **password reset** and **email confirmation**, because those
send a link back to the app and Supabase rejects redirect targets that are not
allowlisted. Signing in with the demo accounts works without it.

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: your Vercel production URL
- **Redirect URLs**: add both
  ```
  https://<your-app>.vercel.app/**
  http://localhost:3000/**
  ```

The `/**` wildcard covers `/auth/callback`, which is where both flows land.

---

## Why deploy rather than just use your laptop's LAN address

Testing on a phone via `http://192.168.x.x:3000` mostly works, with one real
exception: **microphone recording will not run.** Browsers only expose
`navigator.mediaDevices` in a secure context — HTTPS, or localhost. A LAN IP over
plain HTTP is neither, so the Voice screen will tell you it needs a secure
connection.

Vercel gives you HTTPS, so voice notes work there. Everything else — dashboard,
tasks, notes, search, uploads — is fine either way.

## Known behaviour on a deployed instance

- **Uploads and recordings go to real Supabase Storage**, into a private
  per-user folder. They are genuinely stored, and genuinely inaccessible to any
  other account.
- **In-app reminders need no configuration.** The tray reads reminders whose time
  has passed, so it works on a bare deployment with no cron and no worker.
- **Web push is not built.** Nothing in the UI offers it.
- **These flows have never run against a live database from the build
  environment**, which could not reach Supabase. The database layer is tested
  (36/36 against a clean cluster) and the app builds clean, but you are the first
  real user. Report anything that breaks.

## Troubleshooting

### "404: NOT_FOUND" on every path, but the deployment says Ready

The build succeeded and served nothing, which almost always means Vercel built
code that contains no Next.js app. Check the deployment's **Source** line in the
Vercel dashboard — it names the repository, branch and commit actually built.

Three ways to land here, all of which produce an identical 404:

1. **Wrong repository.** This project was forked from
   `Harsh-Thakur-2006/StudyMate`. Importing the upstream rather than
   `Prakash-Ravi11/studymate` deploys a repo that has never contained the
   rebuild.
2. **Wrong branch.** `main` is still the original Expo + Spring Boot tree. At
   `51a379c` the repository root is only `.vscode`, `README.md`, `backend` and
   `frontend` — no `web/`, no Next.js app. The rebuild lives on
   `claude/fervent-mendel-w123jn` until the PR is merged.
3. **Root Directory unset.** Even on the right branch, building from the
   repository root finds `frontend/`, `backend/`, `supabase/` and `web/` with no
   app at top level.

Confirm what a given commit actually contains before assuming the build is at
fault:

```bash
git ls-tree --name-only <commit>      # expect a `web` entry
```

### Preview URLs instead of a stable one

Vercel only treats the **production branch** as production. While the rebuild is
unmerged, set **Settings → Git → Production Branch** to
`claude/fervent-mendel-w123jn`, or merge the PR and leave it on `main`.

## Redeploying

Vercel rebuilds on every push to the branch. To point production at `main`
later, merge the PR and change the production branch in
**Settings → Git**.
