import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { PageContainer } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskRow } from '@/components/tasks/task-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { requireOnboardedUser } from '@/lib/data/guards';
import { listSubjectOptions } from '@/lib/data/subjects';
import { listTasks, taskViewCounts, TASK_VIEWS, type TaskView } from '@/lib/data/tasks';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Tasks' };

const EMPTY_COPY: Record<TaskView, { title: string; description: string }> = {
  today: { title: 'Nothing due today', description: 'Enjoy it, or pull something forward from Upcoming.' },
  upcoming: { title: 'Nothing scheduled', description: 'Add deadlines as they are announced so they do not surprise you.' },
  overdue: { title: 'Nothing overdue', description: 'You are on top of everything that had a deadline.' },
  unscheduled: { title: 'Nothing waiting', description: 'Tasks captured without a date land here so you can schedule them later.' },
  completed: { title: 'Nothing finished yet', description: 'Completed tasks are kept here as a record of the term.' },
  all: { title: 'No tasks yet', description: 'Type what you need to do in the box above — dates in plain English work.' },
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; subject?: string }>;
}) {
  const { profile } = await requireOnboardedUser();
  const timezone = profile?.timezone ?? 'UTC';
  const params = await searchParams;

  const view = (TASK_VIEWS.find((v) => v.value === params.view)?.value ?? 'today') as TaskView;

  const [tasks, counts, subjects] = await Promise.all([
    listTasks({ view, timezone, subjectId: params.subject }),
    taskViewCounts(timezone),
    listSubjectOptions(),
  ]);

  const badge: Partial<Record<TaskView, number>> = {
    today: counts.today,
    overdue: counts.overdue,
    unscheduled: counts.unscheduled,
  };

  return (
    <PageContainer>
      <div className="pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-content">Tasks</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Everything you need to finish, in one list.
        </p>
      </div>

      <QuickAdd subjects={subjects} timezone={timezone} defaultSubjectId={params.subject} />

      <nav
        aria-label="Task views"
        className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-px"
      >
        {TASK_VIEWS.map((v) => {
          const active = v.value === view;
          const count = badge[v.value];
          return (
            <Link
              key={v.value}
              href={`/tasks?view=${v.value}${params.subject ? `&subject=${params.subject}` : ''}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content',
              )}
            >
              {v.label}
              {count ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-2xs tabular-nums',
                    v.value === 'overdue' && count > 0
                      ? 'bg-danger-subtle text-danger'
                      : 'bg-surface-sunken text-content-tertiary',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4">
        {tasks.length === 0 ? (
          <EmptyState icon={CheckCircle2} {...EMPTY_COPY[view]} />
        ) : (
          <Card className="p-2">
            <div className="space-y-0.5">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} timezone={timezone} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
