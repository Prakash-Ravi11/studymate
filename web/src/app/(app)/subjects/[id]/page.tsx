import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, CheckSquare, FileText, FolderOpen, Mic, LayoutGrid, User,
} from 'lucide-react';
import { PageContainer } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TaskRow } from '@/components/tasks/task-row';
import { QuickAdd } from '@/components/tasks/quick-add';
import { NotesList, NewNoteButton } from '@/components/notes/notes-client';
import { Uploader } from '@/components/resources/uploader';
import { ResourcesGrid } from '@/components/resources/resources-client';
import { VoiceRecorder } from '@/components/voice/recorder';
import { VoiceList } from '@/components/voice/voice-list';
import { requireOnboardedUser } from '@/lib/data/guards';
import { getSubject, listSubjectOptions } from '@/lib/data/subjects';
import { listTasks } from '@/lib/data/tasks';
import { listNotes } from '@/lib/data/notes';
import { listResources } from '@/lib/data/resources';
import { createClient } from '@/lib/supabase/server';
import { isTranscriptionEnabled } from '@/lib/transcription';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutGrid },
  { value: 'tasks', label: 'Tasks', icon: CheckSquare },
  { value: 'resources', label: 'Resources', icon: FolderOpen },
  { value: 'notes', label: 'Notes', icon: FileText },
  { value: 'voice', label: 'Voice', icon: Mic },
] as const;

type Tab = (typeof TABS)[number]['value'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const subject = await getSubject(id);
  return { title: subject?.name ?? 'Subject' };
}

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { profile } = await requireOnboardedUser();
  const timezone = profile?.timezone ?? 'UTC';
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  const subject = await getSubject(id);
  // RLS scopes the lookup, so a miss is either "does not exist" or "belongs to
  // someone else" -- both correctly a 404.
  if (!subject) notFound();

  const tab = (TABS.find((t) => t.value === tabParam)?.value ?? 'overview') as Tab;
  const subjects = await listSubjectOptions();

  return (
    <PageContainer width="wide">
      <Link
        href="/subjects"
        className="flex w-fit items-center gap-1.5 text-xs text-content-secondary hover:text-content"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All subjects
      </Link>

      <header className="mt-3 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-1.5 size-3 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-content">{subject.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-content-secondary">
                {subject.code && <span>{subject.code}</span>}
                {subject.instructor && (
                  <span className="flex items-center gap-1">
                    <User className="size-3" aria-hidden="true" />
                    {subject.instructor}
                  </span>
                )}
                {subject.semester && <span>Semester {subject.semester}</span>}
              </p>
            </div>
          </div>
          {subject.overdue_tasks > 0 && (
            <Badge tone="danger">{subject.overdue_tasks} overdue</Badge>
          )}
        </div>
      </header>

      <nav aria-label="Subject sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.value === tab;
          return (
            <Link
              key={t.value}
              href={`/subjects/${id}?tab=${t.value}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-content-secondary hover:text-content',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === 'overview' && <Overview subject={subject} timezone={timezone} />}
        {tab === 'tasks' && (
          <TasksTab subjectId={id} subjects={subjects} timezone={timezone} />
        )}
        {tab === 'resources' && <ResourcesTab subjectId={id} subjects={subjects} />}
        {tab === 'notes' && <NotesTab subjectId={id} />}
        {tab === 'voice' && <VoiceTab subjectId={id} subjects={subjects} />}
      </div>
    </PageContainer>
  );
}

async function Overview({
  subject,
  timezone,
}: {
  subject: NonNullable<Awaited<ReturnType<typeof getSubject>>>;
  timezone: string;
}) {
  const upcoming = await listTasks({ view: 'all', timezone, subjectId: subject.id });
  const open = upcoming.filter((t) => t.status !== 'completed').slice(0, 6);
  const pct =
    subject.total_tasks > 0 ? Math.round((subject.done_tasks / subject.total_tasks) * 100) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        {subject.description && (
          <Card className="p-4">
            <h2 className="text-xs font-semibold text-content-secondary">About</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-content-secondary">
              {subject.description}
            </p>
          </Card>
        )}

        <Card className="p-2">
          <h2 className="px-2.5 pb-1.5 pt-2 text-xs font-semibold text-content-secondary">
            What is open
          </h2>
          {open.length === 0 ? (
            <p className="px-2.5 pb-3 text-xs text-content-tertiary">
              Nothing outstanding for this subject.
            </p>
          ) : (
            <div className="space-y-0.5">
              {open.map((t) => (
                <TaskRow key={t.id} task={t} timezone={timezone} showSubject={false} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <aside className="space-y-4">
        <Card className="p-4">
          <h2 className="text-xs font-semibold text-content-secondary">Progress</h2>
          {pct === null ? (
            <p className="mt-2 text-xs text-content-tertiary">No tasks yet.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-content">{pct}%</p>
              <p className="text-2xs text-content-tertiary">
                {subject.done_tasks} of {subject.total_tasks} tasks done
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Task progress"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${pct}%`, backgroundColor: subject.color }}
                />
              </div>
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-xs font-semibold text-content-secondary">In this subject</h2>
          <dl className="mt-2.5 space-y-1.5">
            {[
              ['Open tasks', subject.open_tasks],
              ['Notes', subject.note_count],
              ['Files', subject.resource_count],
              ['Recordings', subject.voice_count],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <dt className="text-xs text-content-secondary">{label}</dt>
                <dd className="text-xs font-medium tabular-nums text-content">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-line pt-2 text-2xs text-content-tertiary">
            Last activity {relativeTime(subject.last_activity_at)}
          </p>
        </Card>
      </aside>
    </div>
  );
}

async function TasksTab({
  subjectId,
  subjects,
  timezone,
}: {
  subjectId: string;
  subjects: { id: string; name: string; color: string }[];
  timezone: string;
}) {
  const tasks = await listTasks({ view: 'all', timezone, subjectId });

  return (
    <div className="space-y-4">
      <QuickAdd subjects={subjects} timezone={timezone} defaultSubjectId={subjectId} />
      {tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks for this subject"
          description="Add assignments and deadlines as they are announced."
        />
      ) : (
        <Card className="p-2">
          <div className="space-y-0.5">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} timezone={timezone} showSubject={false} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

async function ResourcesTab({
  subjectId,
  subjects,
}: {
  subjectId: string;
  subjects: { id: string; name: string; color: string }[];
}) {
  const resources = await listResources({ subjectId });
  return (
    <div>
      <Uploader subjectId={subjectId} subjects={subjects} />
      <ResourcesGrid resources={resources} subjects={subjects} />
    </div>
  );
}

async function NotesTab({ subjectId }: { subjectId: string }) {
  const notes = await listNotes({ subjectId });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewNoteButton subjectId={subjectId} noteType="class" label="New class note" />
      </div>
      <NotesList notes={notes} />
    </div>
  );
}

async function VoiceTab({
  subjectId,
  subjects,
}: {
  subjectId: string;
  subjects: { id: string; name: string; color: string }[];
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('voice_notes')
    .select(
      'id,title,duration_ms,created_at,transcript,transcription_status,transcription_error,subject_id,subjects(name,color)',
    )
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <VoiceRecorder subjects={subjects} defaultSubjectId={subjectId} />
      <VoiceList
        items={(data ?? []) as Parameters<typeof VoiceList>[0]['items']}
        canTranscribe={isTranscriptionEnabled()}
      />
    </div>
  );
}
