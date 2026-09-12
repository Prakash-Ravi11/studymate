import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle, CalendarDays, CheckCircle2, FileText, FolderOpen,
  Inbox, Mic, BookOpen, ArrowRight,
} from 'lucide-react';
import { PageContainer } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskRow } from '@/components/tasks/task-row';
import { requireOnboardedUser } from '@/lib/data/guards';
import { getDashboard, type TaskWithSubject } from '@/lib/data/dashboard';
import { greeting, relativeTime } from '@/lib/dates';
import { formatDuration } from '@/lib/utils';

export const metadata: Metadata = { title: 'Home' };

function TaskGroup({
  title,
  icon: Icon,
  tone,
  tasks,
  timezone,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'danger';
  tasks: TaskWithSubject[];
  timezone: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby={`group-${title}`}>
      <h2
        id={`group-${title}`}
        className={`mb-1.5 flex items-center gap-1.5 px-2.5 text-xs font-semibold ${
          tone === 'danger' ? 'text-danger' : 'text-content-secondary'
        }`}
      >
        <Icon className="size-3.5" />
        {title}
        <span className="font-normal text-content-tertiary">{tasks.length}</span>
      </h2>
      <div className="space-y-0.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} timezone={timezone} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { user, profile } = await requireOnboardedUser();
  const timezone = profile?.timezone ?? 'UTC';
  const data = await getDashboard(user.id, timezone);

  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const dueNow = data.overdue.length + data.today.length;
  const hasAnyTask = dueNow + data.upcoming.length + data.inbox.length > 0;
  const brandNew = data.counts.subjects === 0 && data.counts.openTasks === 0;

  // The headline states the actual situation rather than a generic greeting
  // (section 44): the dashboard should reflect the student's real state.
  const headline =
    dueNow === 0
      ? 'Nothing is due today.'
      : `You have ${dueNow} thing${dueNow === 1 ? '' : 's'} to finish today.`;

  return (
    <PageContainer width="wide">
      <header className="pb-6">
        <p className="text-sm text-content-secondary">
          {greeting(timezone)}
          {firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-content">{headline}</h1>
      </header>

      {brandNew ? (
        <EmptyState
          icon={BookOpen}
          title="Start with a subject"
          description="Subjects are how StudyMate organises everything else — your files, notes, recordings and deadlines all hang off them."
          action={
            <Link
              href="/subjects"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-contrast hover:bg-primary-hover"
            >
              Create your first subject
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-6">
            {hasAnyTask ? (
              <Card className="p-2">
                <div className="space-y-5">
                  <TaskGroup
                    title="Overdue"
                    icon={AlertTriangle}
                    tone="danger"
                    tasks={data.overdue}
                    timezone={timezone}
                  />
                  <TaskGroup
                    title="Today"
                    icon={CalendarDays}
                    tasks={data.today}
                    timezone={timezone}
                  />
                  <TaskGroup
                    title="Next 7 days"
                    icon={CalendarDays}
                    tasks={data.upcoming}
                    timezone={timezone}
                  />
                  <TaskGroup
                    title="Unscheduled"
                    icon={Inbox}
                    tasks={data.inbox}
                    timezone={timezone}
                  />
                </div>
              </Card>
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="You are all caught up"
                description="No deadlines in the next week. Add what is coming up so it does not sneak up on you."
                action={
                  <Link
                    href="/tasks"
                    className="inline-flex h-9 items-center rounded-md border border-line-strong px-3.5 text-sm font-medium text-content hover:bg-surface-sunken"
                  >
                    Add a task
                  </Link>
                }
              />
            )}
          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <h2 className="text-xs font-semibold text-content-secondary">This week</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {[
                  ['Open', data.counts.openTasks],
                  ['Done', data.counts.completedThisWeek],
                  ['Subjects', data.counts.subjects],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-2xs text-content-tertiary">{label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-content">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <RecentCard
              title="Recent notes"
              href="/notes"
              icon={FileText}
              items={data.recent.notes.map((n) => ({
                id: n.id,
                href: `/notes/${n.id}`,
                primary: n.title || 'Untitled note',
                secondary: relativeTime(n.updated_at),
              }))}
              emptyLabel="No notes yet"
            />

            <RecentCard
              title="Recent files"
              href="/resources"
              icon={FolderOpen}
              items={data.recent.resources.map((r) => ({
                id: r.id,
                href: '/resources',
                primary: r.title,
                secondary: relativeTime(r.created_at),
              }))}
              emptyLabel="No files yet"
            />

            <RecentCard
              title="Recent recordings"
              href="/voice"
              icon={Mic}
              items={data.recent.voice.map((v) => ({
                id: v.id,
                href: '/voice',
                primary: v.title,
                secondary: `${formatDuration(v.duration_ms)} · ${relativeTime(v.created_at)}`,
              }))}
              emptyLabel="No recordings yet"
            />
          </aside>
        </div>
      )}
    </PageContainer>
  );
}

function RecentCard({
  title,
  href,
  icon: Icon,
  items,
  emptyLabel,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; href: string; primary: string; secondary: string }[];
  emptyLabel: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-content-secondary">
          <Icon className="size-3.5" />
          {title}
        </h2>
        <Link href={href} className="text-2xs text-content-tertiary hover:text-primary">
          View all
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-2xs text-content-tertiary">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="-mx-1.5 block rounded-md px-1.5 py-1 hover:bg-surface-sunken"
              >
                <span className="block truncate text-xs text-content">{item.primary}</span>
                <span className="block text-2xs text-content-tertiary">{item.secondary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
