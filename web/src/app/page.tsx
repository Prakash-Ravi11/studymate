import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Mic, FileText, CheckSquare, FolderOpen, Search, CalendarDays } from 'lucide-react';
import { Wordmark } from '@/components/logo';
import { getCurrentUser } from '@/lib/supabase/server';

const CAPABILITIES = [
  { icon: Mic, title: 'Record the lecture', body: 'Capture audio mid-class and find it later by what was said, not just when it was recorded.' },
  { icon: CheckSquare, title: 'Turn talk into tasks', body: 'Type the deadline the way your lecturer said it. StudyMate works out the date and shows you before saving.' },
  { icon: FolderOpen, title: 'File every resource', body: 'Slides, PDFs, papers and links, filed under the subject they belong to.' },
  { icon: FileText, title: 'Write as you go', body: 'Class notes that save themselves, so nothing is lost when you close the tab.' },
  { icon: Search, title: 'Find it in one search', body: 'One box across notes, files, tasks, subjects and recording transcripts.' },
  { icon: CalendarDays, title: 'See the week coming', body: 'Every deadline on one calendar, so nothing arrives as a surprise.' },
];

export default async function LandingPage() {
  // Someone already signed in wants their dashboard, not the pitch.
  if (await getCurrentUser()) redirect('/home');

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-content-secondary hover:bg-surface-sunken hover:text-content"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-contrast hover:bg-primary-hover"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="relative py-16 sm:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 size-[32rem] -translate-x-1/2 rounded-full bg-primary opacity-[0.06] blur-3xl"
          />
          <div className="relative max-w-2xl">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-content sm:text-[2.75rem] sm:leading-[1.1]">
              Your course, finally in one place.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-content-secondary">
              Lecture slides in one folder, deadlines in a group chat, notes in a different app, and
              a recording you will never listen to again. StudyMate gathers all of it under the
              subject it belongs to, and tells you what is actually due tonight.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-base font-medium text-primary-contrast hover:bg-primary-hover"
              >
                Start for free
              </Link>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-md border border-line-strong px-5 text-base font-medium text-content hover:bg-surface-sunken"
              >
                I have an account
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-surface p-6">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold text-content">{title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-content-secondary">{body}</p>
            </div>
          ))}
        </section>

        <section className="py-16 sm:py-20">
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center sm:px-12">
            <h2 className="text-xl font-semibold tracking-tight text-content">
              Built for the week you are actually having.
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-content-secondary">
              Capture in seconds during class. Sort it out when you get home.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-contrast hover:bg-primary-hover"
            >
              Create your account
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <Wordmark className="opacity-70" />
          <p className="text-2xs text-content-tertiary">
            Your academic data stays private to your account.
          </p>
        </div>
      </footer>
    </div>
  );
}
